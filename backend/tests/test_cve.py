"""
test_cve.py — Tests for the CVE scanning pipeline against the live OSV API.

All assertions use real CVE IDs for real packages:
  minimist@1.2.5  → CVE-2021-44906 (Prototype Pollution, fixed in 1.2.6)
  semver@5.7.1    → CVE-2022-25883 (ReDoS)
  urllib3@1.26.4  → CVE-2021-33503 (ReDoS)
  log4j:log4j@1.2.17 → CVE-2019-17571 (Deserialization)

No OSV HTTP calls are mocked.
DB calls are not mocked — the scanner falls back to live OSV automatically
when the DB is unreachable (expected in test environments).
"""
import sys
import os
import pytest
from packaging.version import Version

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── helpers ───────────────────────────────────────────────────────────────────

def _cve_ids_from_raw(vulns):
    """Extract all CVE- aliases from a list of raw OSV vuln dicts."""
    ids = []
    for v in vulns:
        ids.extend(a for a in v.get('aliases', []) if a.startswith('CVE-'))
        if v.get('id', '').startswith('CVE-'):
            ids.append(v['id'])
    return ids


def setup_module():
    """Clear the scan cache so previous test runs do not hide live API failures."""
    from cve import scanner
    scanner._scan_cache.clear()


# ── osv_client — real HTTP calls to api.osv.dev ───────────────────────────────

class TestOsvClientLive:
    def test_minimist_1_2_5_returns_vulns(self):
        """query_package returns at least one vulnerability for minimist@1.2.5."""
        from cve.osv_client import query_package
        result = query_package('minimist', '1.2.5', 'npm')
        assert result, "OSV returned no vulnerabilities for minimist@1.2.5"

    def test_minimist_1_2_5_contains_cve_2021_44906(self):
        """CVE-2021-44906 (Prototype Pollution) must be in the OSV response
        for minimist@1.2.5."""
        from cve.osv_client import query_package
        result = query_package('minimist', '1.2.5', 'npm')
        assert 'CVE-2021-44906' in _cve_ids_from_raw(result), (
            f"CVE-2021-44906 missing from OSV response.\nReturned: {_cve_ids_from_raw(result)}"
        )

    def test_semver_5_7_1_contains_cve_2022_25883(self):
        """CVE-2022-25883 (ReDoS) must be present for semver@5.7.1."""
        from cve.osv_client import query_package
        result = query_package('semver', '5.7.1', 'npm')
        assert 'CVE-2022-25883' in _cve_ids_from_raw(result), (
            f"CVE-2022-25883 missing.\nReturned: {_cve_ids_from_raw(result)}"
        )

    def test_urllib3_1_26_4_contains_cve_2021_33503(self):
        """CVE-2021-33503 (ReDoS in netloc) must be present for urllib3@1.26.4."""
        from cve.osv_client import query_package
        result = query_package('urllib3', '1.26.4', 'pypi')
        assert 'CVE-2021-33503' in _cve_ids_from_raw(result), (
            f"CVE-2021-33503 missing.\nReturned: {_cve_ids_from_raw(result)}"
        )

    def test_log4j_1_2_17_contains_cve_2019_17571(self):
        """CVE-2019-17571 (Deserialization) must be present for log4j:log4j@1.2.17."""
        from cve.osv_client import query_package
        result = query_package('log4j:log4j', '1.2.17', 'maven')
        assert 'CVE-2019-17571' in _cve_ids_from_raw(result), (
            f"CVE-2019-17571 missing.\nReturned: {_cve_ids_from_raw(result)}"
        )

    def test_minimist_1_2_6_cve_2021_44906_not_affected(self):
        """minimist@1.2.6 is the patched release — format_vuln must filter it out."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('minimist', '1.2.6', 'npm')
        formatted = [format_vuln(v, 'minimist', '1.2.6') for v in raw]
        formatted = [f for f in formatted if f is not None]
        assert 'CVE-2021-44906' not in [f['cve_id'] for f in formatted], (
            "CVE-2021-44906 must NOT match minimist@1.2.6 (the fix release)"
        )


# ── format_vuln — real OSV payload → structured output ───────────────────────

class TestFormatVulnLive:
    def test_minimist_fix_version_is_gte_1_2_6(self):
        """format_vuln must derive a fix_version >= 1.2.6 for minimist@1.2.5."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('minimist', '1.2.5', 'npm')
        formatted = [format_vuln(v, 'minimist', '1.2.5') for v in raw]
        formatted = [f for f in formatted if f is not None]
        hit = next((f for f in formatted if f['cve_id'] == 'CVE-2021-44906'), None)
        assert hit is not None, "CVE-2021-44906 not in formatted results"
        assert hit['fix_version'] is not None
        assert Version(hit['fix_version']) >= Version('1.2.6')

    def test_formatted_vuln_has_required_fields(self):
        """Every formatted vuln must carry cve_id, severity, cvss_score,
        fix_version, fix, osv_url, source."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('minimist', '1.2.5', 'npm')
        formatted = [format_vuln(v, 'minimist', '1.2.5') for v in raw if v]
        formatted = [f for f in formatted if f is not None]
        assert formatted, "No formatted results"
        required = ('cve_id', 'severity', 'cvss_score', 'fix_version', 'fix', 'source', 'osv_url')
        for f in formatted:
            for field in required:
                assert field in f, f"Missing field '{field}' in {f.get('cve_id')}"

    def test_formatted_severity_is_valid_value(self):
        """Severity must be one of CRITICAL / HIGH / MEDIUM / LOW."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('semver', '5.7.1', 'npm')
        formatted = [format_vuln(v, 'semver', '5.7.1') for v in raw]
        formatted = [f for f in formatted if f is not None]
        for f in formatted:
            assert f['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), (
                f"Unexpected severity '{f['severity']}' for {f['cve_id']}"
            )

    def test_source_is_osv(self):
        """Formatted vulns from the OSV client always carry source='OSV'."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('minimist', '1.2.5', 'npm')
        formatted = [format_vuln(v, 'minimist', '1.2.5') for v in raw]
        formatted = [f for f in formatted if f is not None]
        for f in formatted:
            assert f['source'] == 'OSV', f"Expected source=OSV, got {f['source']}"

    def test_log4j_deserialization_severity_at_least_high(self):
        """CVE-2019-17571 (log4j deserialization) must be at least HIGH severity."""
        from cve.osv_client import query_package, format_vuln
        raw = query_package('log4j:log4j', '1.2.17', 'maven')
        formatted = [format_vuln(v, 'log4j:log4j', '1.2.17') for v in raw]
        formatted = [f for f in formatted if f is not None]
        hit = next((f for f in formatted if f['cve_id'] == 'CVE-2019-17571'), None)
        assert hit is not None, "CVE-2019-17571 not in formatted results"
        assert hit['severity'] in ('CRITICAL', 'HIGH'), (
            f"CVE-2019-17571 should be HIGH or CRITICAL, got {hit['severity']}"
        )


# ── scanner.scan_package — DB-first, live OSV fallback ───────────────────────

class TestScanPackageLive:
    def setup_method(self):
        from cve import scanner
        scanner._scan_cache.clear()

    def test_minimist_scan_finds_cve_2021_44906(self):
        """scan_package returns CVE-2021-44906 for minimist@1.2.5."""
        from cve.scanner import scan_package
        results = scan_package('minimist', '1.2.5', 'npm')
        assert results, "No vulnerabilities returned for minimist@1.2.5"
        assert 'CVE-2021-44906' in [r['cve_id'] for r in results]

    def test_urllib3_scan_finds_cve_2021_33503(self):
        """scan_package returns CVE-2021-33503 for urllib3@1.26.4."""
        from cve.scanner import scan_package
        results = scan_package('urllib3', '1.26.4', 'pypi')
        assert results, "No vulnerabilities returned for urllib3@1.26.4"
        assert 'CVE-2021-33503' in [r['cve_id'] for r in results]

    def test_log4j_scan_finds_cve_2019_17571(self):
        """scan_package returns CVE-2019-17571 for log4j:log4j@1.2.17."""
        from cve.scanner import scan_package
        results = scan_package('log4j:log4j', '1.2.17', 'maven')
        assert results, "No vulnerabilities returned for log4j:log4j@1.2.17"
        assert 'CVE-2019-17571' in [r['cve_id'] for r in results]

    def test_scan_package_result_fields(self):
        """Every result from scan_package must include the standard output fields."""
        from cve.scanner import scan_package
        results = scan_package('minimist', '1.2.5', 'npm')
        assert results
        for r in results:
            for field in ('cve_id', 'severity', 'cvss_score', 'fix_version', 'source'):
                assert field in r, f"Field '{field}' missing for {r.get('cve_id')}"
            assert r['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')


# ── scanner.scan_tree — BFS traversal of real dep graph ──────────────────────

class TestScanTreeLive:
    def setup_method(self):
        from cve import scanner
        scanner._scan_cache.clear()

    def test_scan_tree_finds_cve_in_direct_dep(self):
        """scan_tree on a single direct dep (minimist@1.2.5) finds CVE-2021-44906."""
        from cve.scanner import scan_tree
        graph = [{'name': 'minimist', 'version': '1.2.5',
                  'type': 'direct', 'dependencies': []}]
        results = scan_tree(graph, 'npm', app_name='test-app', max_depth=1)
        assert results, "scan_tree found no vulnerabilities"
        assert 'CVE-2021-44906' in [r['cve_id'] for r in results]

    def test_scan_tree_attaches_correct_path(self):
        """scan_tree sets path=[app_name, pkg_name] for a direct dependency."""
        from cve.scanner import scan_tree
        graph = [{'name': 'minimist', 'version': '1.2.5',
                  'type': 'direct', 'dependencies': []}]
        results = scan_tree(graph, 'npm', app_name='my-service', max_depth=1)
        for r in results:
            assert r['path'][0] == 'my-service'
            assert 'minimist' in r['path']

    def test_scan_tree_marks_direct_dep(self):
        """Vulnerabilities in direct deps must have is_direct=True."""
        from cve.scanner import scan_tree
        graph = [{'name': 'minimist', 'version': '1.2.5',
                  'type': 'direct', 'dependencies': []}]
        results = scan_tree(graph, 'npm', app_name='test-app', max_depth=1)
        assert all(r['is_direct'] for r in results)

    def test_scan_tree_empty_graph_returns_empty(self):
        """scan_tree with no deps returns an empty list (no OSV call made)."""
        from cve.scanner import scan_tree
        results = scan_tree([], 'npm', app_name='empty-app', max_depth=2)
        assert results == []
