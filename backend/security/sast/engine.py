"""
security/sast/engine.py
SASTEngine adapter interface + CustomASTEngine implementation.
Future engines (SemgrepEngine, CodeQLEngine) implement the same interface.
"""
import os
import logging
from typing import List, Protocol, runtime_checkable
from abc import abstractmethod

log = logging.getLogger(__name__)

MAX_FILES_PER_PROJECT = 500
MAX_TOTAL_SOURCE_MB   = 50
MAX_ANALYSIS_SECONDS  = 120

SOURCE_EXTENSIONS = {
    '.py':  'python',
    '.js':  'javascript',
    '.ts':  'javascript',
    '.jsx': 'javascript',
    '.tsx': 'javascript',
}

SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', 'venv', '.venv',
    'dist', 'build', 'target', '.tox', '.mypy_cache', 'vendor',
    'coverage', '__tests__',
}


class SASTEngine:
    """Base adapter interface for SAST engines."""

    def analyze_project(self, project_dir: str) -> dict:
        raise NotImplementedError

    def analyze_file(self, file_path: str) -> List[dict]:
        raise NotImplementedError

    @property
    def engine_name(self) -> str:
        raise NotImplementedError


class CustomASTEngine(SASTEngine):
    """
    SAGE's built-in static analysis engine.
    Python: real AST via stdlib ast module.
    JavaScript/TypeScript: pattern-based (documented limitation).
    """

    @property
    def engine_name(self) -> str:
        return "SAGE-CustomAST"

    def analyze_project(self, project_dir: str) -> dict:
        """
        Walk the project directory and analyze all source files.
        Respects limits: max files, max total size, max time.
        """
        import time
        start_time    = time.time()
        all_findings  = []
        files_analyzed = 0
        files_skipped  = 0
        total_bytes    = 0
        imports_map    = {}   # file -> list of imported module names

        for root, dirs, files in os.walk(project_dir):
            # Prune ignored dirs in-place
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for filename in files:
                _, ext = os.path.splitext(filename.lower())
                if ext not in SOURCE_EXTENSIONS:
                    continue

                file_path = os.path.join(root, filename)
                rel_path  = os.path.relpath(file_path, project_dir)

                # Time limit
                if time.time() - start_time > MAX_ANALYSIS_SECONDS:
                    log.warning(f"SAST time limit reached after {files_analyzed} files")
                    files_skipped += 1
                    break

                # File count limit
                if files_analyzed >= MAX_FILES_PER_PROJECT:
                    log.warning(f"SAST file limit reached ({MAX_FILES_PER_PROJECT})")
                    files_skipped += 1
                    break

                # Total size limit
                try:
                    fsize = os.path.getsize(file_path)
                except OSError:
                    continue
                total_bytes += fsize
                if total_bytes > MAX_TOTAL_SOURCE_MB * 1024 * 1024:
                    log.warning(f"SAST total size limit reached")
                    files_skipped += 1
                    break

                findings = self.analyze_file(file_path)
                # Normalize file paths to relative
                for f in findings:
                    if 'file' in f:
                        f['file'] = rel_path.replace(os.sep, '/')

                # Collect import info for correlation engine
                lang = SOURCE_EXTENSIONS.get(ext)
                if lang == 'python':
                    imports_map[rel_path] = _extract_python_imports(file_path)
                elif lang == 'javascript':
                    imports_map[rel_path] = _extract_js_imports(file_path)

                all_findings.extend(findings)
                files_analyzed += 1

        # Separate secret findings from code findings
        code_findings   = [f for f in all_findings if not f.get('is_secret') and f.get('type') != 'HARDCODED_SECRET' and 'status' in f and f['status'] != 'SKIPPED']
        secret_findings = [f for f in all_findings if f.get('is_secret') or f.get('type') == 'HARDCODED_SECRET']
        skipped_files   = [f for f in all_findings if f.get('status') == 'SKIPPED']

        log.info(f"SAST complete: {files_analyzed} files, "
                 f"{len(code_findings)} code findings, "
                 f"{len(secret_findings)} secret findings, "
                 f"{files_skipped} skipped")

        return {
            'engine':           self.engine_name,
            'files_analyzed':   files_analyzed,
            'files_skipped':    files_skipped,
            'code_findings':    code_findings,
            'secret_findings':  [_redact_secret(s) for s in secret_findings],
            'skipped_files':    skipped_files,
            'imports_map':      imports_map,
        }

    def analyze_file(self, file_path: str) -> List[dict]:
        _, ext = os.path.splitext(file_path.lower())
        lang   = SOURCE_EXTENSIONS.get(ext)
        if lang == 'python':
            from .ast.python_analyzer import analyze_file as py_analyze
            return py_analyze(file_path)
        elif lang == 'javascript':
            from .ast.javascript_analyzer import analyze_file as js_analyze
            return js_analyze(file_path)
        return []


def _redact_secret(finding: dict) -> dict:
    """Ensure no actual secret value appears in the finding."""
    safe = dict(finding)
    safe.pop('value', None)
    safe['redacted_value'] = '********'
    return safe


def _extract_python_imports(file_path: str) -> List[str]:
    """Extract imported module names from a Python file."""
    import ast as _ast
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as fh:
            tree = _ast.parse(fh.read(), filename=file_path)
        for node in _ast.walk(tree):
            if isinstance(node, _ast.Import):
                for alias in node.names:
                    imports.append(alias.name.split('.')[0])
            elif isinstance(node, _ast.ImportFrom):
                if node.module:
                    imports.append(node.module.split('.')[0])
    except Exception:
        pass
    return list(set(imports))


def _extract_js_imports(file_path: str) -> List[str]:
    """Extract require/import module names from a JS/TS file."""
    import re
    imports = []
    require_re = re.compile(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""")
    import_re  = re.compile(r"""import\s+.*?from\s+['"]([^'"]+)['"]""")
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
        for m in require_re.finditer(content):
            pkg = m.group(1).split('/')[0].lstrip('@')
            if not pkg.startswith('.'):
                imports.append(pkg)
        for m in import_re.finditer(content):
            pkg = m.group(1).split('/')[0].lstrip('@')
            if not pkg.startswith('.'):
                imports.append(pkg)
    except Exception:
        pass
    return list(set(imports))
