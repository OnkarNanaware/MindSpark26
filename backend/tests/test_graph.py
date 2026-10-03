"""
test_graph.py — Dependency graph structure tests using live scans.

No resolver or scanner mocks.  Uses minimist@1.2.5 (a leaf package with a
known CVE) to verify that the graph object returned by /api/scan has the
correct structure, node types, path annotations, and vulnerability data.
"""
import json
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

NPM_MINIMIST = {
    "content": json.dumps({
        "name": "graph-test-app",
        "version": "1.0.0",
        "dependencies": {"minimist": "1.2.5"},
    }),
    "filename": "package.json",
    "project_name": "graph-test-app",
}


class TestGraphStructure:
    def _scan(self, client):
        resp = client.post('/api/scan',
                           data=json.dumps(NPM_MINIMIST),
                           content_type='application/json')
        assert resp.status_code == 200
        return resp.get_json()

    def test_graph_key_present(self, client):
        """Response must contain a 'graph' key."""
        body = self._scan(client)
        assert 'graph' in body

    def test_graph_root_name_matches_project(self, client):
        """Root node name must match the submitted project_name."""
        body = self._scan(client)
        assert body['graph']['name'] == 'graph-test-app'

    def test_graph_root_type_is_root(self, client):
        """Root graph node must have type='root'."""
        body = self._scan(client)
        assert body['graph']['type'] == 'root'

    def test_graph_root_vulnerabilities_empty(self, client):
        """Root node vulnerabilities list must always be empty."""
        body = self._scan(client)
        assert body['graph']['vulnerabilities'] == []

    def test_minimist_appears_as_direct_dep(self, client):
        """minimist must appear as a 'direct' child of the root."""
        body = self._scan(client)
        children = body['graph']['dependencies']
        mini = next((n for n in children if n['name'] == 'minimist'), None)
        assert mini is not None, "minimist not found in graph children"
        assert mini['type'] == 'direct'

    def test_vulnerable_package_has_vuln_data_in_graph(self, client):
        """minimist@1.2.5 must carry CVE-2021-44906 in its graph node."""
        body = self._scan(client)
        children = body['graph']['dependencies']
        mini = next((n for n in children if n['name'] == 'minimist'), None)
        assert mini is not None
        cve_ids = [v['cve_id'] for v in mini.get('vulnerabilities', [])]
        assert 'CVE-2021-44906' in cve_ids, (
            f"CVE-2021-44906 not in minimist graph node.\nFound: {cve_ids}"
        )

    def test_summary_total_packages_at_least_one(self, client):
        """summary.total_packages must be >= 1 (minimist was scanned)."""
        body = self._scan(client)
        assert body['summary']['total_packages'] >= 1

    def test_vuln_path_starts_with_project_name(self, client):
        """Every vulnerability path must start with the project name."""
        body = self._scan(client)
        for v in body.get('vulnerabilities', []):
            assert v['path'][0] == 'graph-test-app', (
                f"Path {v['path']} does not start with 'graph-test-app'"
            )
