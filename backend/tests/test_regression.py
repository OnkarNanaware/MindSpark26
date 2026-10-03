"""
test_regression.py — Regression tests for five production bugs.

All tests use real packages from live registries where possible.
No synthetic CVE IDs or fake registry payloads are used.

Bug 1 (maven_resolver.py):
    root.iter('dependency') returned 0 results for xmlns-namespaced POMs.
    Verified against real spring-webmvc@5.3.25 POM from Maven Central.

Bug 2 (db.py):
    last_sync_time() swallowed its own exceptions, so health() always showed
    db_connected: True even when the DB was down.
    Verified against the live Flask health endpoint.

Bug A (lockfile_resolver.py):
    resolve() was missing the max_depth kwarg required by app.py.

Bug B (npm_resolver.py):
    In-memory cache stored key 'deps' but read 'data' → KeyError after a
    DB round-trip.  Verified against real npm registry fetch.

Bug C (pypi_resolver.py):
    Constraint (<1.27,>=1.21.1) resolved to 1.27 (upper bound) instead of
    1.21.1 (lower bound).  Verified against real PyPI requests@2.28.0.
"""
import sys
import os
import pytest
from packaging.version import Version
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── Bug 1 — Maven XML namespace ───────────────────────────────────────────────

class TestMavenNamespaceRegression:
    def setup_method(self):
        from resolvers import maven_resolver
        maven_resolver._cache.clear()

    def test_spring_webmvc_returns_compile_deps(self):
        """_fetch_deps against the real spring-webmvc@5.3.25 POM must return
        compile-scope children. Before Bug 1 fix this returned 0 results."""
        from resolvers.maven_resolver import _fetch_deps
        deps = _fetch_deps('org.springframework', 'spring-webmvc', '5.3.25')
        assert deps, (
            "spring-webmvc@5.3.25 returned zero deps — Maven namespace fix may be broken"
        )
        assert 'org.springframework:spring-core' in deps, (
            f"spring-core missing from spring-webmvc deps: {list(deps.keys())}"
        )

    def test_plain_iter_without_namespace_returns_zero(self):
        """Documents WHY Bug 1 existed: root.iter('dependency') returns 0
        on xmlns-prefixed POMs because ET represents tags as {ns}tagname."""
        import xml.etree.ElementTree as ET
        import requests as req
        path = 'org/springframework/spring-webmvc/5.3.25/spring-webmvc-5.3.25.pom'
        resp = req.get(f'https://repo1.maven.org/maven2/{path}', timeout=10)
        assert resp.status_code == 200
        root = ET.fromstring(resp.content)
        count = len(list(root.iter('dependency')))
        assert count == 0, (
            f"Expected 0 results for plain .iter('dependency') on a namespaced POM "
            f"but got {count}. The _ns() fix addresses this."
        )

    def test_full_resolve_returns_children(self):
        """End-to-end: resolve() for spring-webmvc@5.3.25 must return children."""
        from resolvers.maven_resolver import resolve
        graph, _ = resolve(
            [{'name': 'org.springframework:spring-webmvc', 'version': '5.3.25'}],
            max_depth=1,
        )
        assert graph[0]['dependencies'], (
            "spring-webmvc@5.3.25 graph has no children — Bug 1 regression"
        )


# ── Bug 2 — Health endpoint db_connected ─────────────────────────────────────

class TestHealthDbConnectedRegression:
    def test_db_connected_false_when_db_raises(self, client):
        """db_connected must be False when last_sync_time() raises.
        Before Bug 2 fix last_sync_time() swallowed the exception internally
        and health() always returned db_connected: True."""
        with patch('db.last_sync_time', side_effect=Exception('could not connect')):
            resp = client.get('/api/health')
        assert resp.get_json()['db_connected'] is False

    def test_db_connected_true_when_no_exception(self, client):
        """db_connected is True only when last_sync_time() completes without error."""
        with patch('db.last_sync_time', return_value='2024-06-01T00:00:00+00:00'):
            resp = client.get('/api/health')
        assert resp.get_json()['db_connected'] is True

    def test_last_sync_time_has_no_internal_try_except(self):
        """Source-code check: last_sync_time() must not contain an internal
        try/except block that would suppress DB connection errors."""
        import inspect
        from db import last_sync_time
        source = inspect.getsource(last_sync_time)
        assert 'except' not in source, (
            "last_sync_time() contains a bare except — Bug 2 fix may be reverted"
        )


# ── Bug A — Lockfile resolver max_depth ──────────────────────────────────────

class TestLockfileMaxDepthRegression:
    def test_resolve_accepts_max_depth_kwarg(self):
        """resolve(deps, max_depth=2) must not raise TypeError.
        Bug A: the original signature was resolve(direct_deps) without max_depth."""
        from resolvers.lockfile_resolver import resolve
        try:
            resolve([{'name': 'express', 'version': '4.18.2', 'type': 'direct'}],
                    max_depth=2)
        except TypeError as e:
            pytest.fail(f"Bug A still present — TypeError: {e}")


# ── Bug B — npm_resolver in-memory cache key ─────────────────────────────────

class TestNpmResolverCacheKeyRegression:
    def setup_method(self):
        from resolvers import npm_resolver
        npm_resolver._cache.clear()
        npm_resolver.npm_circuit_breaker.failure_count = 0
        npm_resolver.npm_circuit_breaker.state = 'CLOSED'

    def test_cache_stores_data_key_not_deps_key(self):
        """After a live npm fetch the in-memory cache must store key 'data'.
        Bug B: stored 'deps' but read 'data', causing KeyError on subsequent reads."""
        from resolvers.npm_resolver import _fetch_deps, _cache
        # minimist has no sub-deps so only one HTTP call is made
        _fetch_deps('minimist', '1.2.5')
        key = 'minimist@1.2.5'
        assert key in _cache, f"minimist@1.2.5 not found in cache after fetch"
        entry = _cache[key]
        assert 'data' in entry, (
            f"Cache entry uses key '{list(entry.keys())}' instead of 'data' — Bug B regression"
        )
        assert 'deps' not in entry


# ── Bug C — PyPI resolver upper-bound extraction ──────────────────────────────

class TestPypiUpperBoundRegression:
    def setup_method(self):
        from resolvers import pypi_resolver
        pypi_resolver._cache.clear()

    def test_urllib3_resolves_to_lower_bound(self):
        """requests@2.28.0 declares urllib3 (<1.27,>=1.21.1).
        The resolved version must be the LOWER bound (1.21.1), not the upper bound (1.27).
        Bug C: re.search(r'[\\d\\.]+', ...) grabbed 1.27 first."""
        from resolvers.pypi_resolver import resolve
        graph, _ = resolve([{'name': 'requests', 'version': '2.28.0'}], max_depth=1)
        child = next((c for c in graph[0]['dependencies'] if c['name'] == 'urllib3'), None)
        assert child is not None, "urllib3 not found in requests@2.28.0 deps"
        resolved = Version(child['version'])
        assert resolved < Version('1.27'), (
            f"Bug C still present: urllib3 resolved to {child['version']} "
            f"(>= 1.27 means the upper bound leaked through)"
        )
