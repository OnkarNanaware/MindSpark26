"""
test_integration.py — End-to-end tests against LIVE external APIs.

These tests make REAL HTTP calls to:
  - OSV API (api.osv.dev)
  - npm registry (registry.npmjs.org)
  - PyPI API (pypi.org)
  - Maven Central (repo1.maven.org)

They assert on SPECIFIC CVE IDs that are documented and stable in OSV.
No external calls are mocked.  DB calls are skipped if the DB is unavailable
(scanner falls back to live OSV automatically).

Packages chosen because their CVEs are permanently documented in OSV:
  npm:
    minimist@1.2.5   → CVE-2021-44906  (Prototype Pollution)
    semver@5.7.1     → CVE-2022-25883  (ReDoS)
  PyPI:
    Pillow@9.0.0     → CVE-2022-22816, CVE-2022-22817  (buffer overread / integer overflow)
    urllib3@1.26.4   → CVE-2021-33503  (ReDoS)
  Maven:
    log4j:log4j@1.2.17
                     → CVE-2019-17571  (Deserialization of Untrusted Data)

Run with:  ./venv/bin/pytest tests/test_integration.py -v --timeout=60
"""
import sys
import os
import time
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ── OSV client — raw query tests ──────────────────────────────────────────────

class TestOsvLiveQuery:
    """Call the real OSV API and assert specific known CVE IDs are present."""

    def test_minimist_1_2_5_has_prototype_pollution_cve(self):
        """minimist@1.2.5 must return CVE-2021-44906 (Prototype Pollution).
        This is a permanently documented vulnerability fixed in 1.2.6."""
        from cve.osv_client import query_package
        vulns = query_package('minimist', '1.2.5', 'npm')
        assert len(vulns) > 0, "OSV returned no vulnerabilities for minimist@1.2.5"
        cve_ids = []
        for v in vulns:
            cve_ids.extend([a for a in v.get('aliases', []) if a.startswith('CVE-')])
            if v.get('id', '').startswith('CVE-'):
                cve_ids.append(v['id'])
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 not found in OSV response for minimist@1.2.5.\n"
            f"Returned aliases: {cve_ids}"
        )

    def test_minimist_1_2_6_is_clean(self):
        """minimist@1.2.6 is the patched version — OSV must report no vulnerabilities."""
        from cve.osv_client import query_package
        vulns = query_package('minimist', '1.2.6', 'npm')
        # 1.2.6 is the fix; CVE-2021-44906 must NOT match
        cve_ids = []
        for v in vulns:
            cve_ids.extend([a for a in v.get('aliases', []) if a == 'CVE-2021-44906'])
        assert 'CVE-2021-44906' not in cve_ids, (
            "CVE-2021-44906 should NOT affect minimist@1.2.6 (the patched release)"
        )

    def test_semver_5_7_1_has_redos_cve(self):
        """semver@5.7.1 must return CVE-2022-25883 (Regular Expression Denial of Service)."""
        from cve.osv_client import query_package
        vulns = query_package('semver', '5.7.1', 'npm')
        assert len(vulns) > 0, "OSV returned no vulnerabilities for semver@5.7.1"
        cve_ids = []
        for v in vulns:
            cve_ids.extend([a for a in v.get('aliases', []) if a.startswith('CVE-')])
        assert 'CVE-2022-25883' in cve_ids, (
            f"CVE-2022-25883 not found for semver@5.7.1.\nReturned: {cve_ids}"
        )

    def test_log4j_1_2_17_has_deserialization_cve(self):
        """log4j@1.2.17 (Maven) must contain CVE-2019-17571 (Deserialization)."""
        from cve.osv_client import query_package
        vulns = query_package('log4j:log4j', '1.2.17', 'maven')
        assert len(vulns) > 0, "OSV returned no vulnerabilities for log4j:log4j@1.2.17"
        cve_ids = []
        for v in vulns:
            cve_ids.extend([a for a in v.get('aliases', []) if a.startswith('CVE-')])
        assert 'CVE-2019-17571' in cve_ids, (
            f"CVE-2019-17571 not found for log4j:log4j@1.2.17.\nReturned: {cve_ids}"
        )

    def test_urllib3_1_26_4_has_redos_cve(self):
        """urllib3@1.26.4 (PyPI) must contain CVE-2021-33503 (ReDoS in netloc parsing)."""
        from cve.osv_client import query_package
        vulns = query_package('urllib3', '1.26.4', 'pypi')
        assert len(vulns) > 0, "OSV returned no vulnerabilities for urllib3@1.26.4"
        cve_ids = []
        for v in vulns:
            cve_ids.extend([a for a in v.get('aliases', []) if a.startswith('CVE-')])
        assert 'CVE-2021-33503' in cve_ids, (
            f"CVE-2021-33503 not found for urllib3@1.26.4.\nReturned: {cve_ids}"
        )

    def test_minimist_1_2_6_has_no_prototype_pollution(self):
        """CVE-2021-44906 must NOT affect minimist@1.2.6 (the patched release).
        This verifies that the patched version is correctly excluded by the
        'fixed' event in OSV's affected range."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('minimist', '1.2.6', 'npm')
        # Run through format_vuln — it filters out non-affected versions
        formatted = [format_vuln(v, 'minimist', '1.2.6') for v in raw]
        formatted = [f for f in formatted if f is not None]
        cve_ids = [f['cve_id'] for f in formatted]
        assert 'CVE-2021-44906' not in cve_ids, (
            "CVE-2021-44906 should NOT affect minimist@1.2.6 (it is the fix release)"
        )


# ── format_vuln — real OSV payload → structured output ───────────────────────

class TestFormatVulnWithRealPayload:
    """Call OSV, take the raw response and run it through format_vuln.
    Verifies the formatter extracts real fields correctly."""

    def test_minimist_format_includes_real_fix_version(self):
        """After formatting a real OSV response the fix_version must be >= 1.2.6."""
        from cve.osv_client import query_package, format_vuln
        from packaging.version import Version

        raw_vulns = query_package('minimist', '1.2.5', 'npm')
        assert raw_vulns, "No vulns returned from OSV for minimist@1.2.5"

        formatted = [format_vuln(v, 'minimist', '1.2.5') for v in raw_vulns]
        formatted = [f for f in formatted if f is not None]
        assert formatted, "format_vuln returned None for all minimist vulns"

        for f in formatted:
            if f.get('cve_id') == 'CVE-2021-44906':
                assert f['fix_version'] is not None
                assert Version(f['fix_version']) >= Version('1.2.6'), (
                    f"fix_version {f['fix_version']} should be >= 1.2.6"
                )
                assert f['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM')
                assert f['source'] == 'OSV'
                break
        else:
            pytest.fail("CVE-2021-44906 not found in formatted vulns")

    def test_log4j_format_extracts_severity(self):
        """CVE-2019-17571 (log4j@1.2.17 deserialization) must be at least MEDIUM severity."""
        from cve.osv_client import query_package, format_vuln

        raw_vulns = query_package('log4j:log4j', '1.2.17', 'maven')
        assert raw_vulns, "No vulns from OSV for log4j:log4j@1.2.17"

        formatted = [format_vuln(v, 'log4j:log4j', '1.2.17') for v in raw_vulns]
        formatted = [f for f in formatted if f is not None]

        cve_sev = {f['cve_id']: f['severity'] for f in formatted}
        assert 'CVE-2019-17571' in cve_sev, (
            f"CVE-2019-17571 missing from formatted output. Found: {list(cve_sev.keys())}"
        )
        assert cve_sev['CVE-2019-17571'] in ('CRITICAL', 'HIGH', 'MEDIUM'), (
            f"Unexpected severity: {cve_sev['CVE-2019-17571']}"
        )


# ── scanner.scan_package — DB-first with live OSV fallback ───────────────────

class TestScanPackageLive:
    """scan_package hits DB first; since DB is unavailable in this test env,
    it falls back to the live OSV API automatically.  We assert on real CVE IDs."""

    def setup_method(self):
        from cve import scanner
        scanner._scan_cache.clear()

    def test_minimist_scan_finds_cve_2021_44906(self):
        """scan_package('minimist', '1.2.5', 'npm') must find CVE-2021-44906."""
        from cve.scanner import scan_package
        results = scan_package('minimist', '1.2.5', 'npm')
        assert results, "scan_package returned no vulnerabilities for minimist@1.2.5"
        cve_ids = [r['cve_id'] for r in results]
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 not in scan results for minimist@1.2.5.\nFound: {cve_ids}"
        )

    def test_log4j_scan_finds_deserialization_cve(self):
        """scan_package on log4j@1.2.17 must find CVE-2019-17571."""
        from cve.scanner import scan_package
        results = scan_package('log4j:log4j', '1.2.17', 'maven')
        assert results, "No vulnerabilities found for log4j:log4j@1.2.17"
        cve_ids = [r['cve_id'] for r in results]
        assert 'CVE-2019-17571' in cve_ids, (
            f"CVE-2019-17571 not found.\nReturned: {cve_ids}"
        )

    def test_minimist_scan_result_has_required_fields(self):
        """Every vuln returned by scan_package must have the required output fields."""
        from cve.scanner import scan_package
        results = scan_package('minimist', '1.2.5', 'npm')
        assert results
        for r in results:
            assert 'cve_id'      in r, f"Missing cve_id in {r}"
            assert 'severity'    in r, f"Missing severity in {r}"
            assert 'cvss_score'  in r, f"Missing cvss_score in {r}"
            assert 'fix_version' in r, f"Missing fix_version in {r}"
            assert 'source'      in r, f"Missing source in {r}"
            assert r['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')

    def test_scan_tree_live_npm(self):
        """scan_tree on a real npm dep tree must find CVE-2021-44906 in minimist."""
        from cve.scanner import scan_tree
        graph = [{'name': 'minimist', 'version': '1.2.5',
                  'type': 'direct', 'dependencies': []}]
        results = scan_tree(graph, 'npm', app_name='test-app', max_depth=1)
        assert results, "scan_tree returned no vulnerabilities for minimist@1.2.5"
        cve_ids = [r['cve_id'] for r in results]
        assert 'CVE-2021-44906' in cve_ids

    def test_scan_tree_live_path_is_set(self):
        """scan_tree must annotate each vulnerability with the dependency path."""
        from cve.scanner import scan_tree
        graph = [{'name': 'minimist', 'version': '1.2.5',
                  'type': 'direct', 'dependencies': []}]
        results = scan_tree(graph, 'npm', app_name='my-api', max_depth=1)
        for r in results:
            assert 'path' in r, "path missing from vulnerability"
            assert r['path'][0] == 'my-api', "root of path must be app_name"
            assert 'minimist' in r['path'], "minimist must appear in path"


# ── resolver — live registry calls ───────────────────────────────────────────

class TestResolverLive:
    """Verify resolvers fetch REAL transitive dependency trees from live registries."""

    def setup_method(self):
        from resolvers import npm_resolver, pypi_resolver, maven_resolver
        npm_resolver._cache.clear()
        pypi_resolver._cache.clear()
        maven_resolver._cache.clear()

    def test_npm_express_resolves_real_transitives(self):
        """express@4.18.2 must resolve real transitive deps from npm registry.
        Known deps: accepts, body-parser, cookie."""
        from resolvers.npm_resolver import resolve
        graph, _ = resolve([{'name': 'express', 'version': '4.18.2'}], max_depth=1)

        assert len(graph) == 1
        assert graph[0]['name'] == 'express'
        assert graph[0]['version'] == '4.18.2'
        child_names = [c['name'] for c in graph[0]['dependencies']]
        assert len(child_names) > 0, "express@4.18.2 must have transitive deps"
        assert any(n in child_names for n in ('accepts', 'body-parser', 'cookie')), (
            f"Expected well-known express deps but got: {child_names}"
        )

    def test_pypi_requests_resolves_real_transitives(self):
        """requests@2.28.0 must resolve real transitive deps from PyPI.
        Known deps: certifi, urllib3, idna, charset-normalizer."""
        from resolvers.pypi_resolver import resolve
        graph, _ = resolve([{'name': 'requests', 'version': '2.28.0'}], max_depth=1)

        assert len(graph) == 1
        assert graph[0]['name'] == 'requests'
        child_names = [c['name'] for c in graph[0]['dependencies']]
        assert len(child_names) > 0, "requests@2.28.0 must have transitive deps"
        assert any(n in child_names for n in ('certifi', 'urllib3', 'idna')), (
            f"Expected well-known requests deps but got: {child_names}"
        )

    def test_maven_spring_webmvc_resolves_transitives(self):
        """org.springframework:spring-webmvc@5.3.25 must resolve real deps from Maven Central."""
        from resolvers.maven_resolver import resolve
        graph, _ = resolve(
            [{'name': 'org.springframework:spring-webmvc', 'version': '5.3.25'}],
            max_depth=1,
        )
        assert len(graph) == 1
        assert graph[0]['name'] == 'org.springframework:spring-webmvc'
        child_names = [c['name'] for c in graph[0]['dependencies']]
        assert len(child_names) > 0, (
            "spring-webmvc@5.3.25 must have compile-scope transitive deps"
        )


# ── full /api/scan pipeline — live resolution + live OSV ─────────────────────

class TestApiScanLive:
    """POST /api/scan with real package.json / requirements.txt / pom.xml.
    No mocking of resolvers or scan_tree — real registries and real OSV calls."""

    def test_npm_scan_minimist_finds_real_cve(self):
        """Full npm scan with minimist@1.2.5 in package.json must find CVE-2021-44906."""
        import json
        os.environ['DISABLE_SCHEDULER'] = 'true'
        from app import app, _rate_limiter
        app.config['TESTING'] = True
        _rate_limiter._store.clear()

        payload = {
            "content": json.dumps({
                "name": "test-project",
                "version": "1.0.0",
                "dependencies": {"minimist": "1.2.5"},
            }),
            "filename": "package.json",
            "project_name": "test-project",
        }
        with app.test_client() as c:
            resp = c.post('/api/scan',
                          data=json.dumps(payload),
                          content_type='application/json')

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 not found in /api/scan result.\nAll CVEs: {cve_ids}"
        )

    def test_pypi_scan_urllib3_finds_real_cve(self):
        """Full PyPI scan with urllib3@1.26.4 must find CVE-2021-33503."""
        import json
        os.environ['DISABLE_SCHEDULER'] = 'true'
        from app import app, _rate_limiter
        app.config['TESTING'] = True
        _rate_limiter._store.clear()

        payload = {
            "content": "urllib3==1.26.4\n",
            "filename": "requirements.txt",
            "project_name": "test-project",
        }
        with app.test_client() as c:
            resp = c.post('/api/scan',
                          data=json.dumps(payload),
                          content_type='application/json')

        assert resp.status_code == 200
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2021-33503' in cve_ids, (
            f"CVE-2021-33503 not found.\nAll CVEs: {cve_ids}"
        )

    def test_maven_scan_log4j_finds_real_cve(self):
        """Full Maven scan with log4j@1.2.17 must find CVE-2019-17571."""
        import json
        os.environ['DISABLE_SCHEDULER'] = 'true'
        from app import app, _rate_limiter
        app.config['TESTING'] = True
        _rate_limiter._store.clear()

        pom = """<?xml version="1.0"?>
<project>
  <groupId>com.example</groupId>
  <artifactId>test-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>log4j</groupId>
      <artifactId>log4j</artifactId>
      <version>1.2.17</version>
    </dependency>
  </dependencies>
</project>"""
        payload = {
            "content": pom,
            "filename": "pom.xml",
            "project_name": "test-project",
        }
        with app.test_client() as c:
            resp = c.post('/api/scan',
                          data=json.dumps(payload),
                          content_type='application/json')

        assert resp.status_code == 200
        body = resp.get_json()
        cve_ids = [v['cve_id'] for v in body.get('vulnerabilities', [])]
        assert 'CVE-2019-17571' in cve_ids, (
            f"CVE-2019-17571 not found in Maven scan.\nAll CVEs: {cve_ids}"
        )

    def test_npm_scan_risk_score_nonzero_for_vulnerable_package(self):
        """A scan with a known-vulnerable package must return a non-zero risk score."""
        import json
        os.environ['DISABLE_SCHEDULER'] = 'true'
        from app import app, _rate_limiter
        app.config['TESTING'] = True
        _rate_limiter._store.clear()

        payload = {
            "content": json.dumps({
                "name": "test-project",
                "version": "1.0.0",
                "dependencies": {"minimist": "1.2.5"},
            }),
            "filename": "package.json",
            "project_name": "test-project",
        }
        with app.test_client() as c:
            resp = c.post('/api/scan',
                          data=json.dumps(payload),
                          content_type='application/json')

        body = resp.get_json()
        assert body['summary']['risk_score'] > 0, (
            "Risk score must be > 0 for a package with known vulnerabilities"
        )

    def test_npm_scan_fix_version_is_real_semver(self):
        """fix_version in the response must be a valid semantic version string."""
        import json
        from packaging.version import Version
        os.environ['DISABLE_SCHEDULER'] = 'true'
        from app import app, _rate_limiter
        app.config['TESTING'] = True
        _rate_limiter._store.clear()

        payload = {
            "content": json.dumps({
                "name": "test-project",
                "version": "1.0.0",
                "dependencies": {"minimist": "1.2.5"},
            }),
            "filename": "package.json",
            "project_name": "test-project",
        }
        with app.test_client() as c:
            resp = c.post('/api/scan',
                          data=json.dumps(payload),
                          content_type='application/json')

        body = resp.get_json()
        for v in body.get('vulnerabilities', []):
            if v.get('fix_version'):
                try:
                    Version(v['fix_version'])
                except Exception:
                    pytest.fail(
                        f"fix_version '{v['fix_version']}' for {v['cve_id']} "
                        f"is not a valid semver"
                    )
