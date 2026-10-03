"""
security/license/dep_license.py
Fetches license information for resolved dependencies.
Uses the same registry APIs the resolvers already call — no new external deps.
Source code is NEVER sent to registries. Only package name + version.
Parallel fetching with hard timeout to prevent blocking.
"""
import logging
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from .spdx import normalize

log = logging.getLogger(__name__)

REGISTRY_TIMEOUT = 3    # seconds per request (tight)
MAX_PACKAGES     = 60   # max packages to query (prevents hanging on huge projects)
OVERALL_TIMEOUT  = 25   # seconds for all license fetches combined


def get_dep_licenses(resolved_deps: list, ecosystem: str) -> list:
    """
    For every resolved dependency, attempt to determine its license.
    Parallel fetch with hard 25s overall timeout.
    """
    # Collect unique (name, version) pairs
    packages = []
    visited  = set()

    def _collect(deps):
        for dep in deps:
            if len(packages) >= MAX_PACKAGES:
                return
            key = f"{dep.get('name')}@{dep.get('version')}"
            if key in visited:
                continue
            visited.add(key)
            name    = dep.get('name', '')
            version = dep.get('version', '')
            if not name or not version or version == 'unknown':
                continue
            packages.append((name, version))
            _collect(dep.get('dependencies', []))

    _collect(resolved_deps)

    if not packages:
        return []

    findings = []

    # Parallel fetch with bounded thread pool
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_pkg = {
            executor.submit(_fetch_license, name, version, ecosystem): (name, version)
            for name, version in packages
        }
        try:
            for future in as_completed(future_to_pkg, timeout=OVERALL_TIMEOUT):
                name, version = future_to_pkg[future]
                try:
                    lic_raw, lic_spdx, source, confidence = future.result(timeout=1)
                except Exception as e:
                    log.debug(f"License fetch failed for {name}@{version}: {e}")
                    lic_raw, lic_spdx, source, confidence = 'UNKNOWN', 'UNKNOWN', 'error', 'LOW'

                findings.append({
                    'dependency':   name,
                    'version':      version,
                    'license_raw':  lic_raw,
                    'license_spdx': lic_spdx,
                    'source':       source,
                    'confidence':   confidence,
                })
        except TimeoutError:
            log.warning(f"License lookup timeout ({OVERALL_TIMEOUT}s) — returning partial results")
            for f in future_to_pkg:
                f.cancel()

    log.info(f"License lookup complete: {len(findings)}/{len(packages)} packages")
    return findings


def _fetch_license(name: str, version: str, ecosystem: str):
    try:
        if ecosystem in ('npm', 'npm-lock'):
            return _npm_license(name, version)
        elif ecosystem == 'pypi':
            return _pypi_license(name, version)
        elif ecosystem == 'maven':
            return _maven_license(name, version)
    except Exception as e:
        log.debug(f"License fetch failed for {name}@{version}: {e}")
    return ('UNKNOWN', 'UNKNOWN', 'fetch_error', 'LOW')


def _npm_license(name: str, version: str):
    url = f"https://registry.npmjs.org/{name}/{version}"
    try:
        r = requests.get(url, timeout=REGISTRY_TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            raw  = data.get('license', '')
            if isinstance(raw, dict):
                raw = raw.get('type', '') or raw.get('name', '')
            raw = str(raw).strip()
            if raw:
                return (raw, normalize(raw), 'npmjs.org', 'HIGH')
    except Exception as e:
        log.debug(f"npm license {name}@{version}: {e}")
    return ('UNKNOWN', 'UNKNOWN', 'npmjs.org', 'LOW')


def _pypi_license(name: str, version: str):
    url = f"https://pypi.org/pypi/{name}/{version}/json"
    try:
        r = requests.get(url, timeout=REGISTRY_TIMEOUT)
        if r.status_code == 200:
            info = r.json().get('info', {})
            raw  = info.get('license', '')
            if not raw:
                for c in info.get('classifiers', []):
                    if c.startswith('License ::'):
                        parts = c.split(' :: ')
                        if len(parts) >= 3:
                            raw = parts[-1].strip()
                            break
            raw = str(raw).strip()
            if raw:
                return (raw, normalize(raw), 'pypi.org', 'HIGH')
    except Exception as e:
        log.debug(f"pypi license {name}@{version}: {e}")
    return ('UNKNOWN', 'UNKNOWN', 'pypi.org', 'LOW')


def _maven_license(name: str, version: str):
    if ':' not in name:
        return ('UNKNOWN', 'UNKNOWN', 'maven_central', 'LOW')
    group_id, artifact_id = name.split(':', 1)
    group_path = group_id.replace('.', '/')
    pom_url = (
        f"https://repo1.maven.org/maven2/"
        f"{group_path}/{artifact_id}/{version}/{artifact_id}-{version}.pom"
    )
    try:
        r = requests.get(pom_url, timeout=REGISTRY_TIMEOUT)
        if r.status_code == 200:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(r.text)
            ns   = {'m': 'http://maven.apache.org/POM/4.0.0'}
            for ns_map in [ns, {}]:
                prefix = 'm:' if ns_map else ''
                lics = root.find(f'{prefix}licenses', ns_map or None)
                if lics is not None:
                    for lic in lics.findall(f'{prefix}license', ns_map or None):
                        name_el = lic.find(f'{prefix}name', ns_map or None)
                        if name_el is not None and name_el.text:
                            raw = name_el.text.strip()
                            return (raw, normalize(raw), 'maven_central', 'HIGH')
    except Exception as e:
        log.debug(f"maven license {name}@{version}: {e}")
    return ('UNKNOWN', 'UNKNOWN', 'maven_central', 'LOW')
