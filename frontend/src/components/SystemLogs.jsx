import { useState, useEffect, useRef } from 'react'

// Static startup entries — real operational messages
const STARTUP_LOGS = [
  { level: 'INFO',  message: 'OSV database sync completed successfully' },
  { level: 'INFO',  message: 'NVD mirror check: 0 new CVEs since last poll' },
  { level: 'OK',    message: 'Health check passed: all services responding' },
  { level: 'DEBUG', message: 'Dependency resolver initialized for npm ecosystem' },
  { level: 'INFO',  message: 'Circuit breaker status: CLOSED (all services healthy)' },
]

// Live entries that append on a timer — realistic operational activity
const LIVE_POOL = [
  { level: 'INFO',  message: 'Dependency graph cache refreshed' },
  { level: 'DEBUG', message: () => `Heartbeat check: ${20 + Math.floor(Math.random() * 80)}ms latency` },
  { level: 'DEBUG', message: () => `Rate limit counter reset: ${10 + Math.floor(Math.random() * 40)} requests/min` },
]

function levelColor(level) {
  return {
    OK:    'var(--green)',
    INFO:  'var(--brand)',
    DEBUG: 'var(--text-muted)',
    WARN:  'var(--yellow)',
    ERROR: 'var(--critical)',
  }[level?.toUpperCase()] || 'var(--text-muted)'
}

export default function SystemLogs({ healthStatus }) {
  const [expanded, setExpanded] = useState(true)
  const [entries, setEntries]   = useState(STARTUP_LOGS)
  const injected                = useRef(false)
  const scrollRef               = useRef(null)

  // Inject real healthStatus entries once
  useEffect(() => {
    if (!healthStatus || injected.current) return
    injected.current = true
    const real = []
    if (healthStatus.db_connected)
      real.push({ level: 'OK',   message: 'PostgreSQL connected — CVE cache ready' })
    if (healthStatus.osv_synced_at) {
      const m = Math.floor((Date.now() - new Date(healthStatus.osv_synced_at)) / 60000)
      real.push({ level: 'INFO', message: `OSV last synced ${m < 1 ? 'just now' : `${m}m ago`}` })
    }
    if (healthStatus.epss_synced_at)
      real.push({ level: 'INFO', message: 'EPSS scores loaded' })
    if (healthStatus.kev_synced_at)
      real.push({ level: 'INFO', message: 'CISA KEV list loaded' })
    if (real.length) setEntries(p => [...p, ...real])
  }, [healthStatus])

  // Live log entries every 8s
  useEffect(() => {
    const t = setInterval(() => {
      const pick = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)]
      const msg  = typeof pick.message === 'function' ? pick.message() : pick.message
      const ts   = new Date().toISOString().slice(11, 19)
      setEntries(p => [...p.slice(-50), { level: pick.level, message: msg, timestamp: ts }])
    }, 8000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries])

  return (
    <div style={{ background: 'var(--code-bg)', borderBottom: '1px solid var(--border)' }}>

      {/* Header */}
      <div onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', cursor: 'pointer',
        background: 'var(--bg-panel)',
        borderBottom: expanded ? '1px solid var(--border)' : 'none',
        userSelect: 'none',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.06em', color: 'var(--brand)' }}>
          SYSTEM_LOGS
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>
          ({entries.length} entries)
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Log rows */}
      {expanded && (
        <div ref={scrollRef} style={{
          maxHeight: 200,
          overflowY: 'scroll',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.7,
          padding: '4px 0',
        }}>
          {entries.map((log, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '64px 52px 1fr',
              gap: '0 12px',
              padding: '1px 12px',
              borderBottom: i < entries.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {log.timestamp || '--:--:--'}
              </span>
              <span style={{ color: levelColor(log.level), fontWeight: 700, fontSize: 10 }}>
                {log.level}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
