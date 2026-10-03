import json
import requests
import sys
import os
import logging
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.validation import validate_package_name, validate_version

log = logging.getLogger(__name__)

NPM_REGISTRY = 'https://registry.npmjs.org'

def get_latest_version(name):
    try:
        res = requests.get(f"{NPM_REGISTRY}/{name}/latest", timeout=5)
        if res.status_code == 200:
            return res.json().get('version')
    except requests.exceptions.Timeout as e:
        log.warning(f"Timeout fetching latest version for {name}: {e}")
        return None
    except requests.exceptions.RequestException as e:
        log.warning(f"Network error fetching latest version for {name}: {e}")
        return None
    except Exception as e:
        log.error(f"Error fetching latest version for {name}: {e}")
        return None
    return None

def _strip_jsonc(text: str) -> str:
    """Strip JS-style comments and trailing commas so real-world package.json
    files (JSONC format used by VSCode, many editors) can be parsed by
    Python's strict json.loads.

    Handles:
      - Single-line comments  // ...
      - Multi-line comments   /* ... */
      - Trailing commas before } or ]
    Correctly skips comment-like sequences inside string literals.
    """
    import re
    result = []
    i = 0
    n = len(text)
    in_string = False
    escape = False

    while i < n:
        ch = text[i]

        if escape:
            result.append(ch)
            escape = False
            i += 1
            continue

        if in_string:
            if ch == '\\':
                escape = True
                result.append(ch)
            elif ch == '"':
                in_string = False
                result.append(ch)
            else:
                result.append(ch)
            i += 1
            continue

        # Outside a string — check for comment starts
        if ch == '/' and i + 1 < n:
            nxt = text[i + 1]
            if nxt == '/':
                # Single-line comment — skip until newline
                i += 2
                while i < n and text[i] != '\n':
                    i += 1
                continue
            if nxt == '*':
                # Multi-line comment — skip until */
                i += 2
                while i < n - 1 and not (text[i] == '*' and text[i + 1] == '/'):
                    i += 1
                i += 2  # skip */
                continue

        if ch == '"':
            in_string = True
            result.append(ch)
            i += 1
            continue

        result.append(ch)
        i += 1

    cleaned = ''.join(result)
    # Remove trailing commas before } or ]
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
    return cleaned


def parse(content):
    # Strip UTF-8 BOM and normalize Windows CRLF → LF before parsing
    content = content.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
    # Strip JSONC comments and trailing commas (common in real package.json files)
    content = _strip_jsonc(content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid package.json: {e}")

    project_name    = data.get('name', 'my-app')
    project_version = data.get('version', '1.0.0')

    # Validate project name if present
    if project_name:
        try:
            validate_package_name(project_name)
        except ValueError:
            project_name = 'my-app'

    # ── Workspace / monorepo root detection ───────────────────────────────────
    # A workspace root has a `workspaces` key but typically no direct deps of
    # its own. Give a clear, actionable error instead of a confusing generic one.
    is_workspace_root = (
        'workspaces' in data and
        not data.get('dependencies') and
        not data.get('devDependencies') and
        not data.get('peerDependencies') and
        not data.get('optionalDependencies')
    )
    if is_workspace_root:
        workspaces = data['workspaces']
        if isinstance(workspaces, dict):
            workspaces = workspaces.get('packages', [])
        ws_list = ', '.join(workspaces[:4]) if workspaces else '(none listed)'
        raise ValueError(
            f"This is an npm workspaces root (packages: {ws_list}). "
            "Please paste the package.json from one of the individual workspace "
            "packages (the ones inside packages/ or apps/) — they contain the "
            "actual dependency lists that can be scanned."
        )

    # ── Collect deps from all standard sections ───────────────────────────────
    # optionalDependencies are intentionally excluded: they are platform-specific
    # (e.g. fsevents on macOS) and may not install at all, producing scan noise.
    deps = {}
    for section in ['dependencies', 'devDependencies', 'peerDependencies']:
        for name, version_val in data.get(section, {}).items():
            # Validate package name
            try:
                validate_package_name(name)
            except ValueError:
                continue

            # Lock-file format puts {"version":"4.17.4",...} as the value
            if isinstance(version_val, dict):
                version_str = version_val.get('version', '')
            else:
                version_str = str(version_val)

            # Validate version string if it's not a wildcard
            if version_str and version_str not in ['*', 'x', 'latest', '']:
                try:
                    validate_version(version_str)
                except ValueError:
                    continue

            # Strip semver operators — ^4.18.2 → 4.18.2, ~2.0.0 → 2.0.0
            clean = version_str.lstrip('^~>=<! ').split(' ')[0].strip()

            # Only truly unpinned: *, x, latest, empty
            truly_unpinned = clean in ('*', 'x', 'latest', '') or (clean and not clean[0].isdigit())
            warning = None

            if truly_unpinned:
                latest = get_latest_version(name)
                clean = latest or 'unknown'
                warning = f"No version pinned — scanning latest ({clean}). Pin version: \"{name}\": \"{clean}\""

            deps[name] = {'version': clean, 'pinned': not truly_unpinned, 'warning': warning}

    return {
        'project_name': project_name,
        'project_version': project_version,
        'deps': [{'name': k, 'version': v['version'], 'pinned': v['pinned'], 'warning': v['warning']} for k, v in deps.items()]
    }
