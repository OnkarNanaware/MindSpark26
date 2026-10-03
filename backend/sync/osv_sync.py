"""
osv_sync.py — Delta sync via OSV GCS modified_id.csv + /v1/vulns/{id} API.

OSV publishes a per-ecosystem CSV at:
  https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/modified_id.csv

Format: <iso_modified_date>,<osv_id>  (sorted newest-first)
We stream it, stop when we hit a timestamp we've already processed,
then fetch full JSON for each new/changed ID via GET /v1/vulns/{id}.

seed.py runs once (full ZIP). This file handles all ongoing delta syncs.
"""
import csv
import io
import json
import logging
import requests
import time
from datetime import datetime, timezone

log = logging.getLogger(__name__)

OSV_CSV_URL  = "https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/modified_id.csv"
OSV_VULN_URL = "https://api.osv.dev/v1/vulns/{osv_id}"

ECOSYSTEMS = [
    ("npm",   "npm"),
    ("PyPI",  "pypi"),
    ("Maven", "maven"),
]

def _parse_severity(vuln):
    for sev in vuln.get("severity", []):
        try:
            score = float(sev.get("score", ""))
            if score >= 9.0: return "CRITICAL", score
            if score >= 7.0: return "HIGH",     score
            if score >= 4.0: return "MEDIUM",   score
            return "LOW", score
        except (ValueError, TypeError):
            pass
    db  = vuln.get("database_specific", {})
    sev = db.get("severity", "").upper()
    if sev in ("CRITICAL","HIGH","MEDIUM","LOW"):
        return sev, {"CRITICAL":9.5,"HIGH":7.5,"MEDIUM":5.0,"LOW":2.0}[sev]
    return "MEDIUM", 0.0

def _get_fix_version(affected):
    for a in affected:
        for r in a.get("ranges", []):
            for ev in r.get("events", []):
                if "fixed" in ev and ev["fixed"]:
                    return ev["fixed"]
    return None

def _get_affected_versions(affected):
    versions = []
    for a in affected:
        versions.extend(a.get("versions", []))
    return list(set(versions))

def _upsert_vuln(cur, raw, osv_ecosystem):
    osv_id = raw.get("id", "")
    if not osv_id:
        return 0
    aliases  = raw.get("aliases", [])
    cve_id   = next((a for a in aliases if a.startswith("CVE-")), None)
    summary  = raw.get("summary", "") or (raw.get("details","") or "")[:300]
    severity, cvss = _parse_severity(raw)
    affected = raw.get("affected", [])
    fix_ver  = _get_fix_version(affected)
    aff_vers = _get_affected_versions(affected)
    packages = list({
        a.get("package",{}).get("name","")
        for a in affected
        if a.get("package",{}).get("name")
    })
    if not packages:
        return 0
    count = 0
    for pname in packages:
        cur.execute("""
            INSERT INTO vulnerabilities
                (osv_id, cve_id, ecosystem, package_name,
                 severity, cvss_score, description,
                 affected_versions, fixed_version,
                 osv_url, nvd_url, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, NOW())
            ON CONFLICT (osv_id, ecosystem, package_name)
            DO UPDATE SET
                cve_id            = EXCLUDED.cve_id,
                severity          = EXCLUDED.severity,
                cvss_score        = EXCLUDED.cvss_score,
                description       = EXCLUDED.description,
                affected_versions = EXCLUDED.affected_versions,
                fixed_version     = EXCLUDED.fixed_version,
                updated_at        = NOW()
        """, (
            osv_id, cve_id, osv_ecosystem, pname,
            severity, cvss, summary,
            json.dumps(aff_vers), fix_ver,
            f"https://osv.dev/vulnerability/{osv_id}",
            f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id else None,
        ))
        count += 1
    return count

def _last_sync_time(source):
    try:
        from db import get_conn, get_cursor
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute(
                    "SELECT synced_at FROM sync_log WHERE source=%s AND status='ok' ORDER BY synced_at DESC LIMIT 1",
                    (source,)
                )
                row = cur.fetchone()
                return row["synced_at"] if row else None
    except Exception as e:
        log.warning(f"Could not read last_sync_time for {source}: {e}")
        return None

def _log_sync(source, status, records, message, synced_at=None):
    try:
        from db import get_conn, get_cursor
        ts = synced_at or datetime.now(timezone.utc)
        with get_conn() as conn:
            with get_cursor(conn) as cur:
                cur.execute(
                    "INSERT INTO sync_log (source, status, records, message, synced_at) VALUES (%s,%s,%s,%s,%s)",
                    (source, status, records, message, ts)
                )
    except Exception as e:
        log.warning(f"Could not write sync_log: {e}")

def delta_sync_ecosystem(osv_ecosystem, internal_eco):
    """
    Stream modified_id.csv from GCS.
    Stop when we hit a timestamp <= last sync.
    Fetch full JSON for each new/changed ID via /v1/vulns/{id}.
    """
    from db import get_conn, get_cursor

    source = f"OSV_{internal_eco}"
    last   = _last_sync_time(source)
    sync_start = datetime.now(timezone.utc)

    if last:
        cutoff = last
        log.info(f"Delta sync {osv_ecosystem} since {cutoff.isoformat()}")
    else:
        cutoff = None
        log.info(f"No prior sync for {osv_ecosystem} — fetching all recent changes")

    # Step 1: Download modified_id.csv
    csv_url = OSV_CSV_URL.format(ecosystem=osv_ecosystem)
    try:
        resp = requests.get(csv_url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        log.error(f"Could not fetch modified_id.csv for {osv_ecosystem}: {e}")
        _log_sync(source, "error", 0, str(e), sync_start)
        return 0

    # Step 2: Parse CSV, collect IDs newer than last sync
    new_ids = []
    reader  = csv.reader(io.StringIO(resp.text))
    for row in reader:
        if len(row) < 2:
            continue
        ts_str, osv_id = row[0].strip(), row[1].strip()
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        if cutoff and ts <= cutoff:
            break  # CSV is sorted newest-first — stop here

        new_ids.append(osv_id)

    if not new_ids:
        log.debug(f"{osv_ecosystem}: no changes since last sync")
        _log_sync(source, "ok", 0, "no changes", sync_start)
        return 0

    log.info(f"{osv_ecosystem}: {len(new_ids)} changed vulns to fetch")

    # Step 3: Fetch full JSON for each changed ID
    total = 0
    for i, osv_id in enumerate(new_ids):
        try:
            r = requests.get(
                OSV_VULN_URL.format(osv_id=osv_id),
                timeout=15
            )
            if r.status_code == 404:
                continue  # Withdrawn/deleted vuln
            r.raise_for_status()
            raw = r.json()

            with get_conn() as conn:
                with get_cursor(conn) as cur:
                    total += _upsert_vuln(cur, raw, osv_ecosystem)

            time.sleep(0.1)  # Polite pause — OSV has no rate limit but be nice

        except Exception as e:
            log.warning(f"Could not fetch {osv_id}: {e}")
            continue

    log.info(f"{osv_ecosystem} delta done: {total} rows upserted from {len(new_ids)} changed vulns")
    _log_sync(source, "ok", total, None, sync_start)
    return total

def sync_all():
    """Called by APScheduler every 5 minutes."""
    total = 0
    for osv_eco, internal_eco in ECOSYSTEMS:
        total += delta_sync_ecosystem(osv_eco, internal_eco)
    if total > 0:
        log.info(f"Delta sync complete: {total} total rows updated")
    return total
