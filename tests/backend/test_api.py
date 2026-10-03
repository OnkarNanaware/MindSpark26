"""
API endpoint tests.

Local:      pytest tests/backend/test_api.py -v
Production: BASE_URL=https://www.depanalyzer.com pytest tests/backend/test_api.py -v
"""
import os
import pytest
import requests

# Local backend lives on :5000; production frontend and API share the same host
BASE = os.environ.get('BASE_URL', 'http://localhost:5000')
SCAN = f"{BASE}/api/scan"

def server_running():
    try:
        requests.get(f"{BASE}/api/health", timeout=5)
        return True
    except Exception:
        return False

skip_if_offline = pytest.mark.skipif(
    not server_running(),
    reason=f"Server not reachable at {BASE}"
)

# ── Payloads — real packages with known CVEs ──────────────────────────────────

NPM_PAYLOAD = {
    "content": '{"name":"test-app","version":"1.0.0","dependencies":{"lodash":"4.17.11","express":"4.17.1","axios":"0.21.1"}}',
    "filename": "package.json"
}

PYPI_PAYLOAD = {
    "content": "Django==3.2.0\nrequests==2.27.0\nPillow==9.0.0\nFlask==2.0.1",
    "filename": "requirements.txt"
}

MAVEN_PAYLOAD = {
    "content": """<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId><artifactId>test-app</artifactId><version>1.0.0</version>
  <dependencies>
    <dependency><groupId>log4j</groupId><artifactId>log4j</artifactId><version>1.2.17</version></dependency>
    <dependency><groupId>commons-collections</groupId><artifactId>commons-collections</artifactId><version>3.2.1</version></dependency>
    <dependency><groupId>org.apache.struts</groupId><artifactId>struts2-core</artifactId><version>2.3.16</version></dependency>
  </dependencies>
</project>""",
    "filename": "pom.xml"
}

# ── Health ────────────────────────────────────────────────────────────────────

@skip_if_offline
def test_health_endpoint():
    res = requests.get(f"{BASE}/api/health", timeout=5)
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'

@skip_if_offline
def test_health_shows_db_connected():
    res = requests.get(f"{BASE}/api/health", timeout=5)
    assert res.json()['db_connected'] is True

# ── npm scan ──────────────────────────────────────────────────────────────────

@skip_if_offline
def test_scan_npm_returns_200():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert res.status_code == 200

@skip_if_offline
def test_scan_npm_has_required_fields():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    data = res.json()
    for field in ['ecosystem', 'project_name', 'summary', 'graph', 'dependency_tree', 'vulnerabilities', 'transaction_id']:
        assert field in data, f"Missing field: {field}"

@skip_if_offline
def test_scan_npm_correct_ecosystem():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert res.json()['ecosystem'] == 'npm'

@skip_if_offline
def test_scan_npm_correct_project_name():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert res.json()['project_name'] == 'test-app'

@skip_if_offline
def test_scan_npm_graph_has_root():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    graph = res.json()['graph']
    assert graph['name'] == 'test-app'
    assert graph['type'] == 'root'

@skip_if_offline
def test_scan_npm_finds_vulnerabilities():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    data = res.json()
    assert isinstance(data['vulnerabilities'], list)
    assert data['summary']['vulnerabilities'] > 0, "lodash 4.17.11 should have CVEs"

@skip_if_offline
def test_scan_npm_risk_score_nonzero():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert res.json()['summary']['risk_score'] > 0

@skip_if_offline
def test_scan_npm_has_transaction_id():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    tx = res.json().get('transaction_id')
    assert tx and len(tx) == 36, "transaction_id should be a UUID"

@skip_if_offline
def test_scan_npm_has_scan_timestamp():
    res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert 'scan_timestamp' in res.json()

# ── PyPI scan ─────────────────────────────────────────────────────────────────

@skip_if_offline
def test_scan_pypi_returns_200():
    res = requests.post(SCAN, json=PYPI_PAYLOAD, timeout=60)
    assert res.status_code == 200

@skip_if_offline
def test_scan_pypi_correct_ecosystem():
    res = requests.post(SCAN, json=PYPI_PAYLOAD, timeout=60)
    assert res.json()['ecosystem'] == 'pypi'

@skip_if_offline
def test_scan_pypi_finds_vulnerabilities():
    res = requests.post(SCAN, json=PYPI_PAYLOAD, timeout=60)
    assert res.json()['summary']['vulnerabilities'] > 0, "Django 3.2.0 / Pillow 9.0.0 should have CVEs"

# ── Maven scan ────────────────────────────────────────────────────────────────

@skip_if_offline
def test_scan_maven_returns_200():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    assert res.status_code == 200

@skip_if_offline
def test_scan_maven_correct_ecosystem():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    assert res.json()['ecosystem'] == 'maven'

@skip_if_offline
def test_scan_maven_finds_critical_cves():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    assert res.json()['summary']['critical'] > 0, "log4j 1.2.17 should have CRITICAL CVEs"

@skip_if_offline
def test_scan_maven_has_kev_vulns():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    vulns = res.json().get('vulnerabilities', [])
    kev_count = sum(1 for v in vulns if v.get('in_kev'))
    assert kev_count > 0, "commons-collections 3.2.1 / log4j 1.2.17 should have KEV entries"

# ── EPSS / KEV fields ─────────────────────────────────────────────────────────

@skip_if_offline
def test_vulnerabilities_have_epss_fields():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    assert res.status_code == 200
    for v in res.json().get('vulnerabilities', []):
        assert 'epss_score' in v, f"Missing epss_score on {v.get('cve_id')}"
        assert 'epss_percentile' in v, f"Missing epss_percentile on {v.get('cve_id')}"
        assert 'in_kev' in v, f"Missing in_kev on {v.get('cve_id')}"

@skip_if_offline
def test_epss_score_is_float_or_none():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    for v in res.json().get('vulnerabilities', []):
        score = v.get('epss_score')
        assert score is None or isinstance(score, float), f"epss_score bad type: {type(score)}"

@skip_if_offline
def test_in_kev_is_bool():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    for v in res.json().get('vulnerabilities', []):
        assert isinstance(v.get('in_kev'), bool), f"in_kev bad type: {type(v.get('in_kev'))}"

@skip_if_offline
def test_vulns_sorted_by_severity():
    res = requests.post(SCAN, json=MAVEN_PAYLOAD, timeout=60)
    vulns = res.json().get('vulnerabilities', [])
    if len(vulns) > 1:
        sev_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        for i in range(len(vulns) - 1):
            assert sev_order.get(vulns[i]['severity'], 4) <= sev_order.get(vulns[i + 1]['severity'], 4)

# ── Input validation ──────────────────────────────────────────────────────────

@skip_if_offline
def test_empty_content_returns_400():
    res = requests.post(SCAN, json={"content": "", "filename": "package.json"}, timeout=10)
    assert res.status_code == 400

@skip_if_offline
def test_invalid_json_manifest_returns_400():
    res = requests.post(SCAN, json={"content": "not json {{", "filename": "package.json"}, timeout=10)
    assert res.status_code == 400

@skip_if_offline
def test_oversized_content_returns_4xx():
    big = '{"name":"test","dependencies":{' + ','.join([f'"pkg{i}":"1.0.0"' for i in range(5000)]) + '}}'
    res = requests.post(SCAN, json={"content": big, "filename": "package.json"}, timeout=10)
    # 413 from Flask directly; 400 when a proxy (Vercel) intercepts first
    assert res.status_code in (400, 413), f"Expected 400 or 413, got {res.status_code}"

@skip_if_offline
def test_invalid_json_body_returns_400():
    res = requests.post(SCAN, data="not json", headers={"Content-Type": "application/json"}, timeout=5)
    assert res.status_code == 400

@skip_if_offline
def test_cve_invalid_format_returns_400():
    res = requests.get(f"{BASE}/api/cve/NOT-A-CVE", timeout=5)
    assert res.status_code == 400

# ── Scan snapshots (GET /api/scans/<id>) ──────────────────────────────────────

@skip_if_offline
def test_get_scan_invalid_uuid_returns_400():
    res = requests.get(f"{BASE}/api/scans/not-a-valid-uuid", timeout=5)
    assert res.status_code == 400
    assert 'error' in res.json()

@skip_if_offline
def test_get_scan_nonexistent_id_returns_404():
    res = requests.get(f"{BASE}/api/scans/00000000-0000-0000-0000-000000000000", timeout=5)
    assert res.status_code == 404
    assert 'error' in res.json()

@skip_if_offline
def test_get_scan_roundtrip():
    scan_res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert scan_res.status_code == 200
    data = scan_res.json()
    tx_id = data.get('transaction_id')
    assert tx_id, "scan response missing transaction_id"

    fetch_res = requests.get(f"{BASE}/api/scans/{tx_id}", timeout=10)
    if fetch_res.status_code == 404:
        pytest.skip("Snapshot storage not yet deployed on this server")
    assert fetch_res.status_code == 200
    fetched = fetch_res.json()
    assert fetched['ecosystem'] == data['ecosystem']
    assert fetched['project_name'] == data['project_name']
    assert fetched['transaction_id'] == tx_id

@skip_if_offline
def test_get_scan_result_has_graph_and_dependency_tree():
    scan_res = requests.post(SCAN, json=NPM_PAYLOAD, timeout=60)
    assert scan_res.status_code == 200
    tx_id = scan_res.json().get('transaction_id')

    fetch_res = requests.get(f"{BASE}/api/scans/{tx_id}", timeout=10)
    if fetch_res.status_code == 404:
        pytest.skip("Snapshot storage not yet deployed on this server")
    assert fetch_res.status_code == 200
    fetched = fetch_res.json()
    assert 'graph' in fetched, "Snapshot missing graph"
    assert 'dependency_tree' in fetched, "Snapshot missing dependency_tree"
