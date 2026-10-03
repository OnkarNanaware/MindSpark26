"""
security/license/detector.py
Detects the project's own license from:
  - LICENSE / LICENCE / COPYING / UNLICENSE files
  - SPDX-License-Identifier headers in source files
  - package.json license field
  - pom.xml <licenses> section
NEVER assumes MIT or any default. Returns UNKNOWN if undetectable.
"""
import os
import re
import json
import logging
from .spdx import normalize

log = logging.getLogger(__name__)

LICENSE_FILENAMES = {
    'license', 'licence', 'license.md', 'licence.md',
    'license.txt', 'licence.txt', 'copying', 'copying.md',
    'unlicense', 'licenses',
}

SPDX_HEADER_RE = re.compile(
    r'SPDX-License-Identifier:\s*([A-Za-z0-9\.\-\+ ]+)',
    re.IGNORECASE
)

# Heuristic patterns to identify license text
LICENSE_TEXT_PATTERNS = {
    'MIT':           re.compile(r'permission is hereby granted, free of charge', re.IGNORECASE),
    'Apache-2.0':    re.compile(r'apache license.*version 2', re.IGNORECASE),
    'GPL-3.0-only':  re.compile(r'gnu general public license.*version 3', re.IGNORECASE),
    'GPL-2.0-only':  re.compile(r'gnu general public license.*version 2', re.IGNORECASE),
    'LGPL-2.1-only': re.compile(r'gnu lesser general public license.*version 2\.1', re.IGNORECASE),
    'LGPL-3.0-only': re.compile(r'gnu lesser general public license.*version 3', re.IGNORECASE),
    'BSD-2-Clause':  re.compile(r'redistribution and use in source and binary forms.*2 conditions', re.IGNORECASE),
    'BSD-3-Clause':  re.compile(r'redistribution and use in source and binary forms.*3 conditions', re.IGNORECASE),
    'ISC':           re.compile(r'isc license', re.IGNORECASE),
    'AGPL-3.0-only': re.compile(r'gnu affero general public license.*version 3', re.IGNORECASE),
    'MPL-2.0':       re.compile(r'mozilla public license.*2\.0', re.IGNORECASE),
    'Unlicense':     re.compile(r'this is free and unencumbered software', re.IGNORECASE),
}


class LicenseDetectionResult:
    def __init__(self, spdx_id: str, raw: str, source: str, confidence: str,
                 conflicts: list = None):
        self.spdx_id    = spdx_id    # canonical SPDX or UNKNOWN
        self.raw        = raw
        self.source     = source     # 'LICENSE_FILE' | 'SPDX_HEADER' | 'package.json' | 'pom.xml'
        self.confidence = confidence # 'HIGH' | 'MEDIUM' | 'LOW'
        self.conflicts  = conflicts or []

    def to_dict(self):
        return {
            'spdx_id':    self.spdx_id,
            'raw':        self.raw,
            'source':     self.source,
            'confidence': self.confidence,
            'conflicts':  self.conflicts,
        }


def detect_project_license(project_dir: str) -> LicenseDetectionResult:
    """
    Detect the project's license from various sources.
    Returns UNKNOWN if no license is found.
    """
    sources = []

    # 1. LICENSE file detection
    for entry in os.listdir(project_dir):
        if entry.lower() in LICENSE_FILENAMES:
            path = os.path.join(project_dir, entry)
            if os.path.isfile(path):
                result = _parse_license_file(path)
                if result:
                    sources.append(result)

    # 2. package.json license field
    pkg_json = os.path.join(project_dir, 'package.json')
    if os.path.exists(pkg_json):
        result = _parse_package_json_license(pkg_json)
        if result:
            sources.append(result)

    # 3. pom.xml license section
    pom_xml = os.path.join(project_dir, 'pom.xml')
    if os.path.exists(pom_xml):
        result = _parse_pom_license(pom_xml)
        if result:
            sources.append(result)

    # 4. SPDX header scan (first 10 source files)
    spdx_from_headers = _scan_spdx_headers(project_dir)
    sources.extend(spdx_from_headers)

    if not sources:
        return LicenseDetectionResult('UNKNOWN', '', 'none', 'LOW')

    # De-duplicate and check for conflicts
    unique_spdx = list({s.spdx_id for s in sources if s.spdx_id != 'UNKNOWN'})

    if len(unique_spdx) == 0:
        return LicenseDetectionResult('UNKNOWN', '', 'ambiguous', 'LOW')

    if len(unique_spdx) == 1:
        primary = next(s for s in sources if s.spdx_id == unique_spdx[0])
        return primary

    # Conflict: multiple different licenses detected
    conflict_desc = [f"{s.spdx_id} (from {s.source})" for s in sources]
    log.warning(f"License conflict in {project_dir}: {conflict_desc}")
    return LicenseDetectionResult(
        spdx_id='CONFLICT',
        raw=', '.join(s.raw for s in sources),
        source='multiple',
        confidence='LOW',
        conflicts=conflict_desc,
    )


def _parse_license_file(path: str) -> 'LicenseDetectionResult | None':
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read(8192)   # first 8KB is enough

        # Check SPDX header line first
        m = SPDX_HEADER_RE.search(content)
        if m:
            raw = m.group(1).strip()
            return LicenseDetectionResult(normalize(raw), raw, 'SPDX_HEADER', 'HIGH')

        # Heuristic text matching
        for spdx_id, pattern in LICENSE_TEXT_PATTERNS.items():
            if pattern.search(content):
                return LicenseDetectionResult(spdx_id, spdx_id, 'LICENSE_FILE', 'HIGH')

        # Unknown content but file exists
        return LicenseDetectionResult('UNKNOWN', content[:80].strip(), 'LICENSE_FILE', 'LOW')

    except Exception as e:
        log.debug(f"License file parse error {path}: {e}")
        return None


def _parse_package_json_license(path: str) -> 'LicenseDetectionResult | None':
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
        raw = data.get('license', '')
        if not raw:
            return None
        # Handle SPDX expression objects: {"type": "MIT", "url": "..."}
        if isinstance(raw, dict):
            raw = raw.get('type', '') or raw.get('name', '')
        spdx = normalize(str(raw))
        return LicenseDetectionResult(spdx, str(raw), 'package.json', 'HIGH')
    except Exception as e:
        log.debug(f"package.json license parse error {path}: {e}")
        return None


def _parse_pom_license(path: str) -> 'LicenseDetectionResult | None':
    import xml.etree.ElementTree as ET
    try:
        tree = ET.parse(path)
        root = tree.getroot()
        ns   = {'m': 'http://maven.apache.org/POM/4.0.0'}

        # Try with namespace first, then without
        for ns_map in [ns, {}]:
            prefix = 'm:' if ns_map else ''
            licenses_el = root.find(f'{prefix}licenses', ns_map or None)
            if licenses_el is not None:
                for lic in licenses_el.findall(f'{prefix}license', ns_map or None):
                    name_el = lic.find(f'{prefix}name', ns_map or None)
                    if name_el is not None and name_el.text:
                        raw  = name_el.text.strip()
                        spdx = normalize(raw)
                        return LicenseDetectionResult(spdx, raw, 'pom.xml', 'MEDIUM')
    except Exception as e:
        log.debug(f"pom.xml license parse error {path}: {e}")
    return None


def _scan_spdx_headers(project_dir: str) -> list:
    """Scan up to 10 source files for SPDX-License-Identifier headers."""
    results = []
    count   = 0
    for root, dirs, files in os.walk(project_dir):
        dirs[:] = [d for d in dirs if d not in {'node_modules', '.git', 'venv', '.venv'}]
        for fname in files:
            if count >= 10:
                break
            _, ext = os.path.splitext(fname.lower())
            if ext in {'.py', '.js', '.ts', '.java', '.go'}:
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as fh:
                        head = fh.read(1024)
                    m = SPDX_HEADER_RE.search(head)
                    if m:
                        raw = m.group(1).strip()
                        results.append(LicenseDetectionResult(
                            normalize(raw), raw, f'SPDX_HEADER:{fname}', 'MEDIUM'
                        ))
                        count += 1
                except Exception:
                    pass
    return results
