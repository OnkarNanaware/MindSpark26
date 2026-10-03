"""
security/github_ingestion.py
Securely download and extract a public GitHub repository archive,
then surface the extracted project_dir to the existing analysis pipeline.

Design contract
---------------
- validate_github_url()   -> (owner, repo, branch)
- download_and_extract()  -> project_dir inside an already-created workspace
- All cleanup is the caller's responsibility (workspace via extractor.create_workspace).
- NEVER executes any code from the downloaded repository.
- NEVER requires GitHub authentication for public repositories.
- NEVER stores the download permanently.
"""

import io
import os
import re
import shutil
import logging
import zipfile

log = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

# Maximum archive download size: 100 MB
MAX_GITHUB_DOWNLOAD_BYTES = 100 * 1024 * 1024

# Maximum individual file size during extraction: 5 MB
MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024

# Maximum number of files to extract (abuse guard)
MAX_FILE_COUNT = 10_000

# Request timeout for the archive download (seconds)
DOWNLOAD_TIMEOUT = 60

# GitHub archive URL template (no auth needed for public repos)
GITHUB_ARCHIVE_URL = "https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}"

# Default branches to try in order
DEFAULT_BRANCHES = ["main", "master"]

# Extensions allowed during extraction (superset of ZIP extractor)
ALLOWED_SOURCE_EXTENSIONS = {
    ".json", ".xml", ".txt", ".toml", ".cfg", ".ini",
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".kt",
    ".yml", ".yaml", ".md", ".env", ".gradle", ".lock",
    ".sum", ".mod",
}

# Directories to skip during extraction
IGNORED_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", "target", ".tox", ".mypy_cache",
    "coverage", ".pytest_cache",
}

# Validated GitHub URL pattern
_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/"
    r"(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9\-]{0,37}[A-Za-z0-9])?)"
    r"/"
    r"(?P<repo>[A-Za-z0-9_.\-]{1,100}?)"
    r"(?:\.git)?"
    r"(?:/tree/(?P<branch>[A-Za-z0-9_.\-/]{1,200}))?"
    r"/?$",
    re.IGNORECASE,
)


# ── Public API ─────────────────────────────────────────────────────────────────

class GitHubIngestionError(Exception):
    """Raised for all expected failure cases (invalid URL, 404, too large, etc.)."""
    def __init__(self, message, http_status=400):
        super().__init__(message)
        self.http_status = http_status


def validate_github_url(url):
    """
    Validate a GitHub repository URL.
    Returns (owner, repo, branch_or_None).
    Raises GitHubIngestionError on invalid input.
    """
    if not isinstance(url, str):
        raise GitHubIngestionError("repoUrl must be a string.")

    url = url.strip()

    if not url:
        raise GitHubIngestionError("repoUrl is required.")

    # SSRF guard: must be exactly github.com
    if not url.lower().startswith("https://github.com/"):
        raise GitHubIngestionError(
            "Only public GitHub repository URLs (https://github.com/...) are accepted."
        )

    m = _GITHUB_URL_RE.match(url)
    if not m:
        raise GitHubIngestionError(
            "Invalid GitHub repository URL. "
            "Expected format: https://github.com/owner/repository"
        )

    owner  = m.group("owner")
    repo   = m.group("repo").rstrip("/")
    branch = m.group("branch")  # may be None

    # Strip '.git' suffix from repo name if present
    if repo.lower().endswith(".git"):
        repo = repo[:-4]

    log.info("[GitHub Analyzer] Repository URL validated: %s/%s branch=%r", owner, repo, branch)
    return owner, repo, branch


def download_and_extract(owner, repo, branch, workspace):
    """
    Download the GitHub archive for the given repo and extract it into
    workspace/project/ (same layout as extract_zip()).

    Returns the project_dir path (workspace/project/).
    Raises GitHubIngestionError on any failure.
    """
    project_dir = os.path.join(workspace, "project")
    os.makedirs(project_dir, exist_ok=True)

    branches_to_try = [branch] if branch else DEFAULT_BRANCHES

    archive_bytes = None
    last_error    = None

    for b in branches_to_try:
        url = GITHUB_ARCHIVE_URL.format(owner=owner, repo=repo, branch=b)
        log.info("[GitHub Analyzer] Repository download started: %s", url)
        try:
            archive_bytes = _download_archive(url)
            log.info(
                "[GitHub Analyzer] Repository downloaded: %d KB",
                len(archive_bytes) // 1024,
            )
            break
        except GitHubIngestionError as e:
            last_error = e
            if e.http_status == 404:
                log.debug("Branch %r not found, trying next…", b)
                continue
            raise  # re-raise non-404 errors immediately

    if archive_bytes is None:
        if last_error:
            raise last_error
        raise GitHubIngestionError(
            "Repository '{}'/{}' not found or is inaccessible.".format(owner, repo), 404
        )

    log.info("[GitHub Analyzer] Repository extracted to: %s", project_dir)
    _extract_archive(archive_bytes, project_dir)

    return project_dir


# ── Internal helpers ───────────────────────────────────────────────────────────

def _download_archive(url):
    """
    Download a GitHub ZIP archive. Returns raw bytes.
    Enforces MAX_GITHUB_DOWNLOAD_BYTES size limit.
    """
    import urllib.request
    import urllib.error

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SAGE-SCA-Analyzer/1.0",
            "Accept":     "application/zip",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
            # Check Content-Length header if present
            cl = resp.headers.get("Content-Length")
            if cl and int(cl) > MAX_GITHUB_DOWNLOAD_BYTES:
                raise GitHubIngestionError(
                    "Repository archive is too large ({} MB, max {} MB).".format(
                        int(cl) // 1024 // 1024,
                        MAX_GITHUB_DOWNLOAD_BYTES // 1024 // 1024,
                    ),
                    413,
                )

            buf  = io.BytesIO()
            read = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                read += len(chunk)
                if read > MAX_GITHUB_DOWNLOAD_BYTES:
                    raise GitHubIngestionError(
                        "Repository archive exceeds the size limit ({} MB).".format(
                            MAX_GITHUB_DOWNLOAD_BYTES // 1024 // 1024
                        ),
                        413,
                    )
                buf.write(chunk)

            return buf.getvalue()

    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise GitHubIngestionError(
                "Repository not found. Verify the URL and that the repository is public.",
                404,
            )
        if e.code == 403:
            raise GitHubIngestionError(
                "Access forbidden. The repository may be private or rate-limited.",
                403,
            )
        raise GitHubIngestionError(
            "GitHub returned HTTP {} when downloading the repository.".format(e.code),
            502,
        )
    except GitHubIngestionError:
        raise
    except Exception as e:
        raise GitHubIngestionError(
            "Failed to download repository archive: {}".format(e),
            502,
        )


def _extract_archive(archive_bytes, project_dir):
    """
    Extract a ZIP archive (in memory) into project_dir.
    Applies the same security checks as the ZIP extractor:
      - path traversal prevention
      - skip ignored dirs
      - extension allowlist
      - per-file size limit
      - total file count limit

    GitHub archives wrap everything inside a top-level '<repo>-<branch>/'
    directory — we strip that prefix so the resulting layout matches what
    discover_projects() expects.
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(archive_bytes))
    except zipfile.BadZipFile as e:
        raise GitHubIngestionError(
            "Downloaded archive is not a valid ZIP: {}".format(e), 502
        )

    infolist = zf.infolist()
    prefix   = _detect_top_level_prefix(infolist)

    extracted_count = 0
    skipped_count   = 0

    with zf:
        for info in infolist:
            name = info.filename

            # Skip directories
            if name.endswith("/") or info.file_size == 0:
                continue

            clean_name = name.replace("\\", "/")

            # Strip the top-level archive prefix
            if prefix and clean_name.startswith(prefix):
                clean_name = clean_name[len(prefix):]
            if not clean_name:
                continue

            parts = clean_name.split("/")

            # Skip ignored directories
            if any(part in IGNORED_DIRS for part in parts[:-1]):
                skipped_count += 1
                continue

            # Extension allowlist
            _, ext = os.path.splitext(parts[-1].lower())
            if ext and ext not in ALLOWED_SOURCE_EXTENSIONS:
                skipped_count += 1
                continue

            # Per-file size limit
            if info.file_size > MAX_SINGLE_FILE_BYTES:
                log.warning(
                    "[GitHub Analyzer] Skipping oversized file: %r (%d KB)",
                    name, info.file_size // 1024,
                )
                skipped_count += 1
                continue

            # Total file count limit
            if extracted_count >= MAX_FILE_COUNT:
                log.warning(
                    "[GitHub Analyzer] File count limit reached (%d). Skipping rest.",
                    MAX_FILE_COUNT,
                )
                break

            # Build destination path
            dest_path = os.path.normpath(os.path.join(project_dir, clean_name))

            # Path traversal guard
            if not dest_path.startswith(os.path.normpath(project_dir)):
                log.warning("[GitHub Analyzer] Path traversal blocked: %r", name)
                skipped_count += 1
                continue

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            try:
                with zf.open(info) as src, open(dest_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                extracted_count += 1
            except Exception as e:
                log.warning("[GitHub Analyzer] Skipping file %r: %s", name, e)
                skipped_count += 1

    log.info(
        "[GitHub Analyzer] Extraction complete: %d extracted, %d skipped",
        extracted_count, skipped_count,
    )


def _detect_top_level_prefix(infolist):
    """
    GitHub archives contain a single top-level directory like 'repo-main/'.
    Detect and return it so we can strip it.
    Returns empty string if no common prefix is found.
    """
    if not infolist:
        return ""
    first = infolist[0].filename.replace("\\", "/")
    if "/" not in first:
        return ""
    candidate = first.split("/")[0] + "/"
    if all(item.filename.replace("\\", "/").startswith(candidate) for item in infolist):
        return candidate
    return ""
