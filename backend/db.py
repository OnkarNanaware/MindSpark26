"""
db.py — PostgreSQL connection + schema for DepAnalyzer CVE cache.
Single source of truth for all DB access.
"""
import os
import logging
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

log = logging.getLogger(__name__)

def _get_url():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL env var not set")
    return url

@contextmanager
def get_conn():
    """Context manager: yields a connection, commits on success, rolls back on error."""
    # sslmode="prefer" works locally (no SSL) and in production (SSL available)
    # Override via DATABASE_URL param: ?sslmode=require for strict production
    url = _get_url()
    if "sslmode=" in url:
        conn = psycopg2.connect(url)
    else:
        conn = psycopg2.connect(url, sslmode="prefer")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# ── Schema ──────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id            SERIAL PRIMARY KEY,
    osv_id        TEXT NOT NULL,
    cve_id        TEXT,
    ecosystem     TEXT NOT NULL,
    package_name  TEXT NOT NULL,
    severity      TEXT,
    cvss_score    REAL DEFAULT 0.0,
    description   TEXT,
    affected_versions JSONB DEFAULT '[]',
    fixed_version TEXT,
    osv_url       TEXT,
    nvd_url       TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(osv_id, ecosystem, package_name)
);

CREATE INDEX IF NOT EXISTS idx_vuln_pkg_eco
    ON vulnerabilities (ecosystem, package_name);

CREATE INDEX IF NOT EXISTS idx_vuln_cve
    ON vulnerabilities (cve_id);

CREATE TABLE IF NOT EXISTS sync_log (
    id          SERIAL PRIMARY KEY,
    source      TEXT NOT NULL,   -- 'OSV_npm' | 'OSV_pypi' | 'OSV_maven' | 'EPSS' | 'KEV'
    status      TEXT NOT NULL,   -- 'ok' | 'error'
    records     INTEGER DEFAULT 0,
    message     TEXT,
    synced_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epss_scores (
    cve_id      TEXT PRIMARY KEY,
    epss        REAL,
    percentile  REAL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kev_entries (
    cve_id             TEXT PRIMARY KEY,
    vendor_project     TEXT,
    product            TEXT,
    vulnerability_name TEXT,
    date_added         DATE,
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resolver_cache (
    cache_key   TEXT PRIMARY KEY,          -- e.g. "npm:lodash@4.17.21"
    ecosystem   TEXT NOT NULL,
    deps        JSONB NOT NULL DEFAULT '{}',
    hit_count   INTEGER DEFAULT 1,
    cached_at   TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE TABLE IF NOT EXISTS scan_snapshots (
    id           TEXT PRIMARY KEY,         -- transaction_id (UUID)
    ecosystem    TEXT NOT NULL,
    project_name TEXT NOT NULL,
    result       BYTEA NOT NULL,           -- gzip-compressed JSON (~80% smaller than raw)
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_snapshots_expires
    ON scan_snapshots (expires_at);

CREATE INDEX IF NOT EXISTS idx_resolver_cache_expires
    ON resolver_cache (expires_at);

-- ── Users (authentication) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    last_login    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);

-- ── SAGE Extension: SAST + License tables ────────────────────────────────────

CREATE TABLE IF NOT EXISTS code_findings (
    id            SERIAL PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    rule_id       TEXT NOT NULL,
    type          TEXT NOT NULL,
    severity      TEXT NOT NULL,
    confidence    TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    line_number   INTEGER,
    col_number    INTEGER,
    source        TEXT,
    sink          TEXT,
    data_flow     JSONB DEFAULT '[]',
    description   TEXT,
    remediation   TEXT,
    status        TEXT DEFAULT 'OPEN',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_findings_txn
    ON code_findings (transaction_id);

CREATE TABLE IF NOT EXISTS secret_findings (
    id            SERIAL PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    secret_type   TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    line_number   INTEGER,
    fingerprint   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secret_findings_txn
    ON secret_findings (transaction_id);

CREATE TABLE IF NOT EXISTS license_findings (
    id                SERIAL PRIMARY KEY,
    transaction_id    TEXT NOT NULL,
    dependency        TEXT,
    dep_version       TEXT,
    license_raw       TEXT,
    license_spdx      TEXT,
    project_license   TEXT,
    usage_context     TEXT,
    status            TEXT NOT NULL,
    reason            TEXT,
    source            TEXT,
    confidence        TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_findings_txn
    ON license_findings (transaction_id);

"""

def init_schema():
    """Run once at startup — creates tables if they don't exist."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(SCHEMA)
    log.info("DB schema initialised")

def get_resolver_cache(cache_key: str):
    """Get cached resolver deps. Returns None if miss or expired."""
    try:
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute(
                    """SELECT deps FROM resolver_cache
                       WHERE cache_key=%s AND expires_at > NOW()""",
                    (cache_key,)
                )
                row = cur.fetchone()
                if row:
                    # Increment hit count async (best effort)
                    try:
                        cur.execute(
                            "UPDATE resolver_cache SET hit_count=hit_count+1 WHERE cache_key=%s",
                            (cache_key,)
                        )
                    except Exception:
                        pass
                    return row["deps"]
    except Exception as e:
        log.debug(f"Resolver cache get error: {e}")
    return None

def set_resolver_cache(cache_key: str, ecosystem: str, deps: dict, ttl_hours: int = 24):
    """Store resolver deps in cache. TTL 24h by default."""
    import json
    try:
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute(
                    """INSERT INTO resolver_cache (cache_key, ecosystem, deps, expires_at)
                       VALUES (%s, %s, %s, NOW() + INTERVAL '%s hours')
                       ON CONFLICT (cache_key) DO UPDATE SET
                           deps       = EXCLUDED.deps,
                           cached_at  = NOW(),
                           expires_at = NOW() + INTERVAL '%s hours',
                           hit_count  = resolver_cache.hit_count + 1""",
                    (cache_key, ecosystem, json.dumps(deps), ttl_hours, ttl_hours)
                )
    except Exception as e:
        log.debug(f"Resolver cache set error: {e}")

def purge_expired_resolver_cache():
    """Delete expired cache entries. Called daily by scheduler."""
    try:
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute("DELETE FROM resolver_cache WHERE expires_at < NOW()")
                deleted = cur.rowcount
                log.info(f"Resolver cache: purged {deleted} expired entries")
    except Exception as e:
        log.warning(f"Resolver cache purge error: {e}")

def purge_expired_scan_snapshots():
    """Delete scan snapshots past their 30-day TTL. Called daily by scheduler."""
    try:
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute("DELETE FROM scan_snapshots WHERE expires_at < NOW()")
                deleted = cur.rowcount
                log.info(f"Scan snapshots: purged {deleted} expired entries")
    except Exception as e:
        log.warning(f"Scan snapshot purge error: {e}")

def last_sync_time(source: str):
    """Return ISO timestamp of last successful sync for a source, or None.
    Raises on DB connection failure so callers can detect real DB outages."""
    with get_conn() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT synced_at FROM sync_log WHERE source=%s AND status='ok' ORDER BY synced_at DESC LIMIT 1",
                (source,)
            )
            row = cur.fetchone()
            return row["synced_at"].isoformat() if row else None
