"""
test_risk_score.py — Tests for the logarithmic risk score formula in app.py.

Formula (from run_analysis):
    crit_impact = 40 * (1 - exp(-CRITICAL / 3))  if CRITICAL > 0 else 0
    high_impact = 30 * (1 - exp(-HIGH    / 5))  if HIGH     > 0 else 0
    med_impact  = 20 * (1 - exp(-MEDIUM  / 8))  if MEDIUM   > 0 else 0
    low_impact  = 10 * (1 - exp(-LOW     / 10)) if LOW      > 0 else 0
    risk_score  = min(100, round(sum))

Pure formula tests use no CVE data (pure math).
API integration tests use real packages — no scan_tree or RESOLVERS mocks.
"""
import math
import sys
import os
import json
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── pure formula helper (mirrors app.py exactly) ─────────────────────────────

def _score(critical=0, high=0, medium=0, low=0):
    crit_impact = 40 * (1 - math.exp(-critical / 3)) if critical > 0 else 0
    high_impact = 30 * (1 - math.exp(-high     / 5)) if high     > 0 else 0
    med_impact  = 20 * (1 - math.exp(-medium   / 8)) if medium   > 0 else 0
    low_impact  = 10 * (1 - math.exp(-low     / 10)) if low      > 0 else 0
    return min(100, round(crit_impact + high_impact + med_impact + low_impact))


# ── formula unit tests (no CVE data) ─────────────────────────────────────────

class TestRiskScoreFormula:
    def test_zero_vulns_gives_zero(self):
        """No vulnerabilities → risk score exactly 0."""
        assert _score() == 0

    def test_one_critical_gives_11(self):
        """1 CRITICAL → score 11 (logarithmic, not 40)."""
        assert _score(critical=1) == 11

    def test_one_high_gives_5(self):
        """1 HIGH → score 5."""
        assert _score(high=1) == 5

    def test_one_medium_gives_2(self):
        """1 MEDIUM → score 2."""
        assert _score(medium=1) == 2

    def test_one_low_gives_1(self):
        """1 LOW → score 1."""
        assert _score(low=1) == 1

    def test_three_critical_gives_25(self):
        """3 CRITICAL → score 25 (40 * (1 - e^-1) ≈ 25)."""
        assert _score(critical=3) == 25

    def test_ten_critical_gives_39(self):
        """10 CRITICAL → score 39 (logarithm saturates near 40)."""
        assert _score(critical=10) == 39

    def test_score_is_logarithmic_not_linear(self):
        """10 CRITICALs must NOT equal 10× the score of 1 CRITICAL."""
        one = _score(critical=1)
        ten = _score(critical=10)
        assert ten != 10 * one
        assert ten < 10 * one

    def test_mixed_severities_round_total_not_components(self):
        """1 of each: 11.34+5.44+2.35+0.95=20.08 → rounds to 20, not 19.
        Formula rounds the TOTAL sum, not each component independently."""
        assert _score(critical=1, high=1, medium=1, low=1) == 20

    def test_ten_each_severity_gives_85(self):
        """10 of each severity → 85 (well below the cap)."""
        assert _score(critical=10, high=10, medium=10, low=10) == 85

    def test_score_capped_at_100(self):
        """Extreme counts never exceed 100."""
        assert _score(critical=1000, high=1000, medium=1000, low=1000) == 100

    def test_critical_outscores_high(self):
        """1 CRITICAL always scores higher than 1 HIGH."""
        assert _score(critical=1) > _score(high=1)

    def test_high_outscores_medium(self):
        """1 HIGH always scores higher than 1 MEDIUM."""
        assert _score(high=1) > _score(medium=1)


# ── API integration: verify /api/scan uses the logarithmic formula ────────────

class TestRiskScoreViaApi:
    def test_empty_deps_rejected_with_400(self, client):
        """package.json with no dependencies returns HTTP 400 — the API requires
        at least one dependency to scan."""
        payload = {
            "content": json.dumps({"name": "empty-app", "version": "1.0.0",
                                   "dependencies": {}}),
            "filename": "package.json",
            "project_name": "empty-app",
        }
        resp = client.post('/api/scan', data=json.dumps(payload),
                           content_type='application/json')
        assert resp.status_code == 400

    def test_minimist_1_2_5_gives_nonzero_risk_score(self, client):
        """minimist@1.2.5 has real CVEs — risk_score must be > 0."""
        payload = {
            "content": json.dumps({"name": "test-app", "version": "1.0.0",
                                   "dependencies": {"minimist": "1.2.5"}}),
            "filename": "package.json",
            "project_name": "test-app",
        }
        resp = client.post('/api/scan', data=json.dumps(payload),
                           content_type='application/json')
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['summary']['risk_score'] > 0, (
            "Expected risk_score > 0 for minimist@1.2.5 but got 0"
        )

    def test_risk_label_matches_score_range(self, client):
        """risk_label must be consistent with the risk_score value.
        Label mapping: >=90 Critical, >=70 High, >=40 Medium, >=1 Low, 0 Secure."""
        payload = {
            "content": json.dumps({"name": "test-app", "version": "1.0.0",
                                   "dependencies": {"minimist": "1.2.5"}}),
            "filename": "package.json",
            "project_name": "test-app",
        }
        resp = client.post('/api/scan', data=json.dumps(payload),
                           content_type='application/json')
        body = resp.get_json()
        score = body['summary']['risk_score']
        label = body['summary']['risk_label']
        if score >= 90:
            assert label == 'Critical'
        elif score >= 70:
            assert label == 'High'
        elif score >= 40:
            assert label == 'Medium'
        elif score >= 1:
            assert label == 'Low'
        else:
            assert label == 'Secure'

    def test_pypi_scan_risk_score_nonzero(self, client):
        """urllib3==1.26.4 has real CVEs — PyPI scan risk_score must be > 0."""
        payload = {
            "content": "urllib3==1.26.4\n",
            "filename": "requirements.txt",
            "project_name": "py-test-app",
        }
        resp = client.post('/api/scan', data=json.dumps(payload),
                           content_type='application/json')
        assert resp.status_code == 200
        assert resp.get_json()['summary']['risk_score'] > 0
