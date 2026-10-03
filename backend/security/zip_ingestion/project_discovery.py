"""
security/zip_ingestion/project_discovery.py
Discovers project boundaries within an extracted ZIP.
Does NOT blindly merge all manifests.
Detects multi-project layouts and reports ambiguity.
Reuses existing parsers — no new parsing logic here.
"""
import os
import logging

log = logging.getLogger(__name__)

# Manifest files that signal a project root
MANIFEST_FILES = {
    'package.json':       'npm',
    'package-lock.json':  'npm-lock',
    'requirements.txt':   'pypi',
    'pom.xml':            'maven',
    'pyproject.toml':     None,   # detected but not yet parseable — reported as limitation
}

# If a manifest is inside one of these dirs, it's not a project root
# (it's a dependency or build artifact)
SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', 'venv', '.venv',
    'dist', 'build', 'target', 'vendor',
}

MAX_DEPTH_SEARCH = 4   # Don't search more than 4 levels deep


class DiscoveredProject:
    def __init__(self, name: str, root: str, ecosystem: str,
                 manifest_path: str, manifest_content: str):
        self.name            = name
        self.root            = root               # absolute path to project dir
        self.ecosystem       = ecosystem
        self.manifest_path   = manifest_path      # absolute path to manifest file
        self.manifest_content = manifest_content  # file content as string
        self.limitation      = None               # set if ecosystem not fully supported

    def to_dict(self):
        return {
            'name':       self.name,
            'root':       self.root,
            'ecosystem':  self.ecosystem,
            'manifest':   self.manifest_path,
            'limitation': self.limitation,
        }


def discover_projects(project_dir: str) -> dict:
    """
    Walk the extracted project directory and find all project roots.
    Returns:
        {
            'projects': [DiscoveredProject, ...],
            'ambiguities': ['description...'],
            'unsupported': ['pyproject.toml at backend/...']
        }
    """
    found_manifests = []
    _walk_for_manifests(project_dir, project_dir, 0, found_manifests)

    projects     = []
    ambiguities  = []
    unsupported  = []

    # Group manifests by directory
    by_dir = {}
    for manifest_path, filename, ecosystem in found_manifests:
        d = os.path.dirname(manifest_path)
        by_dir.setdefault(d, []).append((manifest_path, filename, ecosystem))

    # Resolve each directory
    for d, entries in by_dir.items():
        # Filter out None-ecosystem (unsupported)
        supported   = [(p, f, e) for p, f, e in entries if e is not None]
        unsup       = [(p, f, e) for p, f, e in entries if e is None]

        for p, f, _ in unsup:
            rel = os.path.relpath(p, project_dir)
            unsupported.append(f"{f} at {rel} — ecosystem not supported in this version")

        if not supported:
            continue

        # If multiple supported manifests in same dir, prefer lock-file > package.json
        ecosystem_priority = {'npm-lock': 0, 'npm': 1, 'pypi': 2, 'maven': 3}
        supported.sort(key=lambda x: ecosystem_priority.get(x[2], 99))
        chosen_path, chosen_file, chosen_eco = supported[0]

        if len(supported) > 1:
            others = [f for _, f, _ in supported[1:]]
            rel = os.path.relpath(d, project_dir)
            ambiguities.append(
                f"Multiple manifests found in {rel!r}: using {chosen_file!r}, "
                f"ignoring {others}. Review project boundaries manually."
            )

        # Read manifest content
        try:
            with open(chosen_path, 'r', encoding='utf-8', errors='replace') as fh:
                content = fh.read()
        except Exception as e:
            log.warning(f"Cannot read manifest {chosen_path}: {e}")
            continue

        # Derive project name from directory name
        rel_dir  = os.path.relpath(d, project_dir)
        proj_name = rel_dir if rel_dir != '.' else os.path.basename(project_dir)
        proj_name = proj_name.replace(os.sep, '/').strip('/')

        proj = DiscoveredProject(
            name=proj_name,
            root=d,
            ecosystem=chosen_eco,
            manifest_path=chosen_path,
            manifest_content=content,
        )

        # Flag pyproject.toml limitation
        if chosen_file == 'pyproject.toml':
            proj.limitation = "pyproject.toml detected but not fully supported. Use requirements.txt for best results."

        projects.append(proj)
        log.info(f"Discovered project: {proj_name!r} ({chosen_eco}) at {rel_dir!r}")

    if not projects:
        ambiguities.append("No supported manifest files found in ZIP. "
                           "Supported: package.json, package-lock.json, requirements.txt, pom.xml")

    return {
        'projects':    projects,
        'ambiguities': ambiguities,
        'unsupported': unsupported,
    }


def _walk_for_manifests(base: str, current: str, depth: int, results: list):
    if depth > MAX_DEPTH_SEARCH:
        return
    try:
        entries = os.listdir(current)
    except PermissionError:
        return

    for entry in entries:
        full = os.path.join(current, entry)
        if os.path.isdir(full):
            if entry not in SKIP_DIRS:
                _walk_for_manifests(base, full, depth + 1, results)
        elif entry in MANIFEST_FILES:
            eco = MANIFEST_FILES[entry]
            results.append((full, entry, eco))
