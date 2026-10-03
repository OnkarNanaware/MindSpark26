"""
bulk_seed.py — Downloads OSV vulnerability ZIPs directly and seeds the DB.
Much faster than delta sync (one HTTP call vs 229k individual API calls).
Run once: cd backend && python sync/bulk_seed.py
"""
import io, json, logging, os, sys, zipfile, time
import requests

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

# OSV bulk ZIP URLs (Google Cloud Storage — public, no auth needed)
ECOSYSTEMS = [
    ("https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip",   "npm",   "npm"),
    ("https://osv-vulnerabilities.storage.googleapis.com/PyPI/all.zip",  "PyPI",  "pypi"),
    ("https://osv-vulnerabilities.storage.googleapis.com/Maven/all.zip", "Maven", "maven"),
]

BATCH_SIZE = 500

def _get_conn():
    import psycopg2
    url = os.environ["DATABASE_URL"]
    if "sslmode=" in url:
        return psycopg2.connect(url, connect_timeout=30)
    return psycopg2.connect(url, sslmode="prefer", connect_timeout=30)

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

def _flush_batch(batch):
    import psycopg2.extras
    try:
        conn = _get_conn()
        cur  = conn.cursor()
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
        log.warning(f"Batch flush error: {e}")
        return 0

def seed_ecosystem(url, osv_ecosystem, internal_eco):
    log.info(f"Downloading {osv_ecosystem} ZIP from OSV...")
    try:
        resp = requests.get(url, timeout=120, stream=True)
        resp.raise_for_status()
        total_bytes = int(resp.headers.get('content-length', 0))
        data = bytearray()
        downloaded = 0
        for chunk in resp.iter_content(chunk_size=1024*1024):
            data.extend(chunk)
            downloaded += len(chunk)
            if total_bytes:
                pct = downloaded * 100 // total_bytes
                print(f"\r  Downloading {osv_ecosystem}: {pct}% ({downloaded//1024//1024}MB/{total_bytes//1024//1024}MB)", end='', flush=True)
        print()
    except Exception as e:
        log.error(f"Download failed for {osv_ecosystem}: {e}")
        return 0

    log.info(f"Processing {osv_ecosystem} ZIP ({len(data)//1024//1024}MB)...")
    total  = 0
    batch  = []
    try:
        with zipfile.ZipFile(io.BytesIO(bytes(data))) as zf:
            names = zf.namelist()
            log.info(f"{osv_ecosystem}: {len(names)} vulnerability files")
            for i, fname in enumerate(names):
                if i > 0 and i % 5000 == 0:
                    pct = round(i / len(names) * 100)
                    log.info(f"  {osv_ecosystem}: {i}/{len(names)} ({pct}%) — {total} rows inserted")
                try:
                    raw = json.loads(zf.read(fname))
                except Exception:
                    continue

                osv_id   = raw.get("id", "")
                if not osv_id:
                    continue
                aliases  = raw.get("aliases", [])
                cve_id   = next((a for a in aliases if a.startswith("CVE-")), None)
                summary  = raw.get("summary", "") or (raw.get("details","") or "")[:300]
                severity, cvss = _parse_severity(raw)
                affected = raw.get("affected", [])
                fix_ver  = _get_fix_version(affected)
                aff_vers = list(set(v for a in affected for v in a.get("versions", [])))
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
            if batch:
                total += _flush_batch(batch)
    except Exception as e:
        log.error(f"ZIP processing error: {e}")
        return total

    # Log sync timestamp so delta sync knows where to start from
    try:
        conn = _get_conn()
        cur  = conn.cursor()
        cur.execute(
            "INSERT INTO sync_log (source, status, records, message) VALUES (%s,'ok',%s,'bulk seed')",
            (f"OSV_{internal_eco}", total)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        log.warning(f"sync_log write error: {e}")

    log.info(f"{osv_ecosystem}: DONE — {total} rows inserted")
    return total

if __name__ == "__main__":
    from db import init_schema
    init_schema()

    grand_total = 0
    for url, osv_eco, internal_eco in ECOSYSTEMS:
        t0 = time.time()
        n  = seed_ecosystem(url, osv_eco, internal_eco)
        grand_total += n
        log.info(f"{osv_eco} finished in {round(time.time()-t0)}s")
        print()

    log.info(f"=== Bulk seed complete: {grand_total} total rows ===")
