"""
security/zip_ingestion/extractor.py
Safely extracts a validated ZIP into an isolated temporary workspace.
Workspace is automatically cleaned up after scanning (try/finally in caller).
NEVER extracts into the application root.
"""
import os
import zipfile
import tempfile
import shutil
import logging
from .validator import NESTED_ARCHIVE_EXTS, MAX_SINGLE_FILE_BYTES

log = logging.getLogger(__name__)

# Source files we care about — everything else is ignored during extraction
ALLOWED_SOURCE_EXTENSIONS = {
    # Manifests
    '.json', '.xml', '.txt', '.toml', '.cfg', '.ini',
    # Source code
    '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.kt',
    # Config / docs
    '.yml', '.yaml', '.md', '.env', '.gradle',
    # License files (no extension)
}

IGNORED_DIRS = {
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    'dist', 'build', 'target', '.tox', '.mypy_cache',
    'coverage', '.pytest_cache',
}


def create_workspace(transaction_id: str) -> str:
    """
    Create an isolated temporary workspace for this scan.
    Returns the workspace root path.
    Format: <tempdir>/sage_scan_<transaction_id>/
    """
    base = tempfile.gettempdir()
    workspace = os.path.join(base, f"sage_scan_{transaction_id}")
    project_dir = os.path.join(workspace, "project")
    os.makedirs(project_dir, exist_ok=True)
    log.debug(f"Created workspace: {workspace}")
    return workspace


def cleanup_workspace(workspace: str) -> None:
    """Delete the temporary workspace. Always called in finally block."""
    try:
        if workspace and os.path.exists(workspace):
            shutil.rmtree(workspace, ignore_errors=True)
            log.debug(f"Cleaned up workspace: {workspace}")
    except Exception as e:
        log.warning(f"Workspace cleanup failed: {e}")


def extract_zip(zip_path: str, workspace: str) -> str:
    """
    Extract the ZIP into workspace/project/.
    Only extracts files with allowed extensions.
    Skips ignored directories, nested archives, and oversized files.
    Returns the project root path.
    """
    project_dir = os.path.join(workspace, "project")
    extracted_count = 0
    skipped_count = 0

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for info in zf.infolist():
            name = info.filename

            # Skip directories
            if name.endswith('/') or info.file_size == 0:
                continue

            # Normalize path separators
            clean_name = name.replace('\\', '/')
            parts = clean_name.split('/')

            # Skip ignored dirs
            if any(part in IGNORED_DIRS for part in parts):
                skipped_count += 1
                continue

            # Check extension
            _, ext = os.path.splitext(parts[-1].lower())

            # Allow files with no extension (LICENSE, COPYING, Makefile etc.)
            if ext and ext not in ALLOWED_SOURCE_EXTENSIONS:
                # Special case: skip nested archives entirely
                if ext in NESTED_ARCHIVE_EXTS:
                    log.warning(f"Skipping nested archive: {name!r}")
                skipped_count += 1
                continue

            # Skip oversized individual files
            if info.file_size > MAX_SINGLE_FILE_BYTES:
                log.warning(f"Skipping oversized file: {name!r} ({info.file_size // 1024}KB)")
                skipped_count += 1
                continue

            # Build safe destination path
            dest_path = os.path.join(project_dir, clean_name)
            dest_path = os.path.normpath(dest_path)

            # Final path traversal check (defense in depth)
            if not dest_path.startswith(os.path.normpath(project_dir)):
                log.warning(f"Path traversal blocked post-normalization: {name!r}")
                continue

            # Extract
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with zf.open(info) as src, open(dest_path, 'wb') as dst:
                shutil.copyfileobj(src, dst)
            extracted_count += 1

    log.info(f"Extraction complete: {extracted_count} files extracted, {skipped_count} skipped")
    return project_dir
