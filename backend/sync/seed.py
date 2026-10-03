"""
seed.py — Local ZIP seed with connection-per-batch to avoid Neon timeout.
Ctrl+C safe — re-running skips already-inserted rows (ON CONFLICT).
Usage: cd backend && python3 sync/seed.py
"""
import json, logging, os, sys, zipfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())
load_env()

LOCAL_ZIPS = [
    ("/tmp/npm.zip",   "npm",   "npm"),
    ("/tmp/pypi.zip",  "PyPI",  "pypi"),
    ("/tmp/maven.zip", "Maven", "maven"),
]

# Small batch + fresh connection every flush = no timeout
BATCH_SIZE = 500

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

def _flush_batch(batch):
    """Fresh connection per batch — never hits Neon idle timeout."""
    import psycopg2, psycopg2.extras
    url = os.environ["DATABASE_URL"]
    try:
        conn = (psycopg2.connect(url, connect_timeout=30,
                                keepalives=1, keepalives_idle=10,
                                keepalives_interval=5, keepalives_count=3)
                if "sslmode=" in url else
                psycopg2.connect(url, sslmode="prefer", connect_timeout=30,
                                keepalives=1, keepalives_idle=10,
                                keepalives_interval=5, keepalives_count=3))
        cur = conn.cursor()
        psycopg2.extras.execute_values(cur, """
            INSERT INTO vulnerabilities
                (osv_id, cve_id, ecosystem, package_name,
                 severity, cvss_score, description,
                 affected_versions, fixed_version,
                 osv_url, nvd_url)
            VALUES %s
            ON CONFLICT (osv_id, ecosystem, package_name)
            DO UPDATE SET
                severity          = EXCLUDED.severity,
                cvss_score        = EXCLUDED.cvss_score,
                description       = EXCLUDED.description,
                affected_versions = EXCLUDED.affected_versions,
                fixed_version     = EXCLUDED.fixed_version,
                updated_at        = NOW()
        """, batch, page_size=500)
        conn.commit()
        conn.close()
        return len(batch)
    except Exception as e:
        log.warning(f"Batch error: {e} — retrying once...")
        try:
            conn.close()
        except Exception:
            pass
        # Retry once with a fresh connection
        try:
            import time; time.sleep(3)
            conn = psycopg2.connect(url, connect_timeout=30) if "sslmode=" in url else psycopg2.connect(url, sslmode="prefer", connect_timeout=30)
            cur  = conn.cursor()
            psycopg2.extras.execute_values(cur, """
                INSERT INTO vulnerabilities
                    (osv_id, cve_id, ecosystem, package_name,
                     severity, cvss_score, description,
                     affected_versions, fixed_version,
                     osv_url, nvd_url)
                VALUES %s
                ON CONFLICT (osv_id, ecosystem, package_name) DO NOTHING
            """, batch, page_size=500)
            conn.commit()
            conn.close()
            return len(batch)
        except Exception as e2:
            log.error(f"Retry also failed: {e2} — skipping batch")
            return 0

def seed_from_zip(zip_path, osv_ecosystem, internal_eco):
    import psycopg2
    log.info(f"Reading {zip_path}...")
    total = 0
    batch = []

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        log.info(f"{osv_ecosystem}: {len(names)} files")

        for i, fname in enumerate(names):
            if i > 0 and i % 10000 == 0:
                pct = round(i / len(names) * 100)
                log.info(f"  {osv_ecosystem}: {i}/{len(names)} ({pct}%) — {total} rows inserted")

            try:
                raw = json.loads(zf.read(fname))
            except Exception:
                continue

            osv_id = raw.get("id", "")
            if not osv_id:
                continue

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

            for pname in packages:
                batch.append((
                    osv_id, cve_id, osv_ecosystem, pname,
                    severity, cvss, summary,
                    json.dumps(aff_vers), fix_ver,
                    f"https://osv.dev/vulnerability/{osv_id}",
                    f"https://nvd.nist.gov/vuln/detail/{cve_id}" if cve_id else None,
                ))

            if len(batch) >= BATCH_SIZE:
                total += _flush_batch(batch)
                batch = []

        # Flush remainder
        if batch:
            total += _flush_batch(batch)

    # Write sync_log timestamp — delta sync reads this to know where to start
    url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(url, connect_timeout=30) if "sslmode=" in url else psycopg2.connect(url, sslmode="prefer", connect_timeout=30)
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO sync_log (source, status, records, message) VALUES (%s,'ok',%s,'initial seed')",
        (f"OSV_{internal_eco}", total)
    )
    conn.commit()
    conn.close()

    log.info(f"{osv_ecosystem}: ✓ complete — {total} rows")
    return total

if __name__ == "__main__":
    log.info("=== DepAnalyzer Seed (connection-per-batch) ===")

    from db import init_schema
    init_schema()

    grand_total = 0
    for zip_path, osv_eco, internal_eco in LOCAL_ZIPS:
        if not os.path.exists(zip_path):
            log.warning(f"Skipping {osv_eco} — {zip_path} not found")
            continue
        grand_total += seed_from_zip(zip_path, osv_eco, internal_eco)

    log.info("Syncing EPSS + KEV...")
    from sync.epss_kev_sync import sync_epss, sync_kev
    sync_epss()
    sync_kev()

    log.info(f"=== Seed complete: {grand_total} total rows ===")
