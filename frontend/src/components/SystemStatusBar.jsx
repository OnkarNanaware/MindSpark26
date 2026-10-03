import { useEffect, useState } from 'react'
import API_BASE from '../config'

const APP_START = Date.now()

function useStatusData(externalHealth) {
  const [health, setHealth] = useState(null)
  const [time,   setTime]   = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (externalHealth) { setHealth(externalHealth); return }
    const load = async () => {
      try { setHealth(await (await fetch(`${API_BASE}/api/health`)).json()) } catch {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [externalHealth])

  const h = health
  const osv = (() => {
    if (!h?.osv_synced_at) return { color: 'var(--critical)', label: 'Never synced', dot: 'var(--critical)' }
    const m = Math.floor((Date.now() - new Date(h.osv_synced_at)) / 60000)
    if (m < 10) return { color: 'var(--ok)',       label: `Synced ${m}m ago`,  dot: 'var(--ok)' }
    if (m < 90) return { color: 'var(--medium)',   label: `Synced ${m}m ago`,  dot: 'var(--medium)' }
    return               { color: 'var(--critical)', label: `${m}m ago`,        dot: 'var(--critical)' }
  })()

  const uptimeMins = Math.floor((Date.now() - APP_START) / 60000)
  const timeStr    = time.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'

  return { h, osv, uptimeMins, timeStr }
}

const StatusItem = ({ dot, label, value, valueColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
    <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{label}</span>
    <span style={{ color: valueColor || 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}</span>
  </div>
)

const Divider = () => (
  <span style={{ color: 'var(--border)', userSelect: 'none', fontSize: 14 }}>|</span>
)

export default function SystemStatusBar({ healthStatus: externalHealth }) {
  const { h, osv, uptimeMins, timeStr } = useStatusData(externalHealth)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 24px',
      height: 36,
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
      flexWrap: 'nowrap',
    }}
      role="status"
      aria-label="System status"
    >
      <StatusItem
        dot="var(--ok)"
        label="System"
        value="Online"
        valueColor="var(--ok)"
      />

      <Divider />

      <StatusItem
        dot={h?.db_connected ? 'var(--ok)' : 'var(--critical)'}
        label="Database"
        value={h?.db_connected ? 'Connected' : 'Disconnected'}
        valueColor={h?.db_connected ? 'var(--ok)' : 'var(--critical)'}
      />

      <Divider />

      <StatusItem
        dot={osv.dot}
        label="OSV"
        value={osv.label}
        valueColor={osv.color}
      />

      <Divider />

      <StatusItem
        dot="var(--text-muted)"
        label="NVD"
        value="Idle"
        valueColor="var(--text-muted)"
      />

      <Divider />

      <StatusItem
        dot="var(--text-muted)"
        label="Uptime"
        value={`${uptimeMins}m`}
        valueColor="var(--text-secondary)"
      />

      <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
        {timeStr}
      </span>
    </div>
  )
}

export function SystemStatusFooter() {
  // Collapsed into the main status bar — render nothing
  return null
}
