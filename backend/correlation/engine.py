"""
correlation/engine.py
Correlates SAST findings, dependency graph, vulnerability findings, and license findings.
Produces evidence-based attack paths.
Does NOT claim exploitability — uses "Potentially reachable".
"""
import logging
from typing import List, Dict

log = logging.getLogger(__name__)


def correlate(
    sast_result: dict,
    resolved_deps: list,
    vulnerabilities: list,
    license_findings: list,
) -> dict:
    """
    Cross-reference SAST imports against the dependency graph and vulnerabilities.

    Returns:
        {
            'enriched_vulnerabilities': [...],   # vulns with reachability hints
            'attack_paths': [...],
            'import_dep_map': {...},             # file -> [matched dep names]
        }
    """
    imports_map: Dict[str, List[str]] = sast_result.get('imports_map', {})
    code_findings: List[dict]         = sast_result.get('code_findings', [])

    # Build flat dep index: name → dep dict
    dep_index = {}
    _flatten_deps(resolved_deps, dep_index)

    # Build vuln index: package_name → list of vulns
    vuln_index: Dict[str, list] = {}
    for v in vulnerabilities:
        pkg = (v.get('package') or v.get('package_name') or '').lower()
        vuln_index.setdefault(pkg, []).append(v)

    # ── Reachability correlation ───────────────────────────────────────────────
    import_dep_map: Dict[str, List[str]] = {}
    for file_path, imports in imports_map.items():
        matched = []
        for imp in imports:
            # Match import against dependency names (case-insensitive, strip underscores)
            imp_key = imp.lower().replace('_', '-')
            for dep_name in dep_index:
                dep_key = dep_name.lower().replace('_', '-')
                if imp_key == dep_key or imp_key.startswith(dep_key):
                    matched.append(dep_name)
                    break
        if matched:
            import_dep_map[file_path] = matched

    # Enrich vulns with reachability evidence
    enriched_vulns = []
    for v in vulnerabilities:
        v = dict(v)
        pkg = (v.get('package') or '').lower().replace('_', '-')
        reachable_from = []
        for file_path, deps in import_dep_map.items():
            for dep in deps:
                if dep.lower().replace('_', '-') == pkg:
                    reachable_from.append(file_path)
                    break
        if reachable_from:
            v['reachability'] = 'POTENTIALLY_REACHABLE'
            v['reachable_from'] = reachable_from
            v['reachability_note'] = (
                "This package is imported by application code. "
                "The vulnerability is potentially reachable, but exploitability "
                "has not been confirmed."
            )
        else:
            v['reachability'] = 'UNCONFIRMED'
            v['reachable_from'] = []
        enriched_vulns.append(v)

    # ── Attack path generation ─────────────────────────────────────────────────
    attack_paths = []

    # Path type 1: HTTP Input → tainted var → SQL/CMD sink (from SAST)
    for finding in code_findings:
        if finding.get('type') in ('SQL_INJECTION', 'COMMAND_INJECTION'):
            path = {
                'id':          f"AP-CODE-{finding.get('rule_id')}-L{finding.get('line', 0)}",
                'type':        'CODE_TAINT_PATH',
                'label':       'Potential Attack Path',
                'confidence':  finding.get('confidence', 'MEDIUM'),
                'severity':    finding.get('severity', 'HIGH'),
                'steps': [
                    {'node': 'External HTTP Request',  'type': 'entry_point'},
                    {'node': finding.get('source', 'user_input'), 'type': 'taint_source',
                     'file': finding.get('file'), 'line': finding.get('line')},
                ] + [
                    {'node': step, 'type': 'propagation'}
                    for step in (finding.get('data_flow') or [])[:-1]
                ] + [
                    {'node': finding.get('sink', 'sink'), 'type': 'sink',
                     'file': finding.get('file'), 'line': finding.get('line')},
                ],
                'description': finding.get('description', ''),
                'evidence':    finding.get('data_flow', []),
            }
            attack_paths.append(path)

    # Path type 2: App code → imported dep → CVE
    for file_path, matched_deps in import_dep_map.items():
        for dep_name in matched_deps:
            dep_vulns = vuln_index.get(dep_name.lower(), [])
            for vuln in dep_vulns[:3]:  # cap at 3 vulns per dep per file
                path = {
                    'id':         f"AP-DEP-{dep_name}-{vuln.get('cve_id', 'UNKNOWN')}",
                    'type':       'DEPENDENCY_VULN_PATH',
                    'label':      'Potential Attack Path',
                    'confidence': 'MEDIUM',
                    'severity':   vuln.get('severity', 'UNKNOWN'),
                    'steps': [
                        {'node': 'External Request',  'type': 'entry_point'},
                        {'node': file_path,           'type': 'application_code'},
                        {'node': dep_name,            'type': 'dependency'},
                        {'node': vuln.get('cve_id', 'CVE-UNKNOWN'), 'type': 'vulnerability',
                         'cvss': vuln.get('cvss_score'), 'severity': vuln.get('severity')},
                    ],
                    'description': (
                        f"{file_path} imports {dep_name}, which has {vuln.get('cve_id')}. "
                        f"The vulnerability is potentially reachable through application code."
                    ),
                    'evidence': [
                        f"{file_path} imports {dep_name}",
                        f"{dep_name} has {vuln.get('cve_id')} (CVSS: {vuln.get('cvss_score', 'N/A')})",
                    ],
                }
                attack_paths.append(path)

    log.info(
        f"Correlation: {len(enriched_vulns)} vulns enriched, "
        f"{len(import_dep_map)} files with matched imports, "
        f"{len(attack_paths)} attack paths"
    )

    return {
        'enriched_vulnerabilities': enriched_vulns,
        'attack_paths':             attack_paths,
        'import_dep_map':           import_dep_map,
    }


def _flatten_deps(deps: list, index: dict, visited: set = None):
    """Recursively flatten dependency tree into a name→dep index."""
    if visited is None:
        visited = set()
    for dep in deps:
        name = dep.get('name', '')
        if not name or name in visited:
            continue
        visited.add(name)
        index[name] = dep
        _flatten_deps(dep.get('dependencies', []), index, visited)
