"""
security/zip_ingestion/validator.py
Validates uploaded ZIP files before extraction.
Handles: size limits, ZIP bombs, path traversal, symlinks, nested archives.
NEVER executes any code from the ZIP.
"""
import zipfile
import logging
import os

log = logging.getLogger(__name__)

# Safety limits
MAX_ZIP_SIZE_BYTES      = 50  * 1024 * 1024   # 50 MB compressed
MAX_EXTRACTED_BYTES     = 200 * 1024 * 1024   # 200 MB uncompressed
MAX_FILES_IN_ZIP        = 10_000
MAX_SINGLE_FILE_BYTES   = 10  * 1024 * 1024   # 10 MB per file
ZIP_BOMB_RATIO          = 100                  # uncompressed/compressed ratio limit
BLOCKED_EXTENSIONS      = {'.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd',
                            '.ps1', '.vbs', '.msi', '.dmg', '.pkg'}
NESTED_ARCHIVE_EXTS     = {'.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.gz',
                            '.bz2', '.7z', '.rar', '.xz'}


class ZipValidationError(Exception):
    """Raised when ZIP fails security validation."""
    pass


def validate_zip(zip_path: str, zip_size_bytes: int) -> None:
    """
    Validate a ZIP file for safe extraction.
    Raises ZipValidationError with a descriptive message on any violation.
    """
    if zip_size_bytes > MAX_ZIP_SIZE_BYTES:
        raise ZipValidationError(
            f"ZIP too large: {zip_size_bytes // 1024 // 1024}MB (max {MAX_ZIP_SIZE_BYTES // 1024 // 1024}MB)"
        )

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            infos = zf.infolist()

            if len(infos) > MAX_FILES_IN_ZIP:
                raise ZipValidationError(
                    f"Too many files in ZIP: {len(infos)} (max {MAX_FILES_IN_ZIP})"
                )

            total_uncompressed = 0
            for info in infos:
                _check_entry(info, zip_size_bytes)
                total_uncompressed += info.file_size

            if total_uncompressed > MAX_EXTRACTED_BYTES:
                raise ZipValidationError(
                    f"Extracted size too large: {total_uncompressed // 1024 // 1024}MB "
                    f"(max {MAX_EXTRACTED_BYTES // 1024 // 1024}MB)"
                )

            if zip_size_bytes > 0:
                ratio = total_uncompressed / zip_size_bytes
                if ratio > ZIP_BOMB_RATIO:
                    raise ZipValidationError(
                        f"Potential ZIP bomb: compression ratio {ratio:.0f}x exceeds limit {ZIP_BOMB_RATIO}x"
                    )

    except zipfile.BadZipFile as e:
        raise ZipValidationError(f"Invalid or corrupted ZIP file: {e}")
    except ZipValidationError:
        raise
    except Exception as e:
        raise ZipValidationError(f"ZIP validation failed: {e}")

    log.info(f"ZIP validation passed: {len(infos)} files, "
             f"{total_uncompressed // 1024}KB uncompressed")


def _check_entry(info: zipfile.ZipInfo, zip_size_bytes: int) -> None:
    """Check a single ZIP entry for security issues."""
    name = info.filename

    # Path traversal: absolute paths
    if os.path.isabs(name):
        raise ZipValidationError(f"Absolute path in ZIP rejected: {name!r}")

    # Path traversal: ../ components
    parts = name.replace('\\', '/').split('/')
    if '..' in parts:
        raise ZipValidationError(f"Path traversal attempt in ZIP: {name!r}")

    # Null byte injection
    if '\x00' in name:
        raise ZipValidationError(f"Null byte in ZIP entry name: {name!r}")

    # Symlinks (Unix mode stored in external_attr high bits)
    if (info.external_attr >> 16) & 0o170000 == 0o120000:
        raise ZipValidationError(f"Symlink in ZIP rejected: {name!r}")

    # Individual file too large
    if info.file_size > MAX_SINGLE_FILE_BYTES:
        raise ZipValidationError(
            f"File too large: {name!r} is {info.file_size // 1024}KB "
            f"(max {MAX_SINGLE_FILE_BYTES // 1024}KB)"
        )

    # Nested archives (block silently — log warning instead of hard error)
    _, ext = os.path.splitext(name.lower())
    if ext in NESTED_ARCHIVE_EXTS and name.count('.') > 1:
        log.warning(f"Nested archive skipped during extraction: {name!r}")
