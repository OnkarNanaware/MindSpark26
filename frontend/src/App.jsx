import { Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Scanning from './pages/Scanning'
import Analytics from './pages/Analytics'
import Learn from './pages/Learn'
import History from './pages/History'
import ZipScan from './pages/ZipScan'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import SystemStatusBar, { SystemStatusFooter } from './components/SystemStatusBar'
import SystemLogs from './components/SystemLogs'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import API_BASE from './config'

export const ScanContext = createContext({ scanning: false, scanProject: '', setScanning: () => {}, setScanProject: () => {} })
export const useScan = () => useContext(ScanContext)

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { user, logout } = useAuth()
  const [scanning, setScanning] = useState(false)
  const [scanProject, setScanProject] = useState('')
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
    return savedTheme
  })
  const [healthStatus, setHealthStatus] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/health`)
        setHealthStatus(res.data)
      } catch (err) {
        console.error('Health check failed:', err)
        setHealthStatus({ error: true })
      }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 60000)
    return () => clearInterval(interval)
  }, [])

  const getRelativeTime = (isoString) => {
    if (!isoString) return 'Unknown'
    const now = new Date()
    const then = new Date(isoString)
    const diffMs = now - then
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const getSyncColor = (isoString) => {
    if (!isoString) return 'var(--text-muted)'
    const now = new Date()
    const then = new Date(isoString)
    const diffMs = now - then
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 30) return 'var(--green)'
    if (diffMins < 120) return 'var(--yellow)'
    return 'var(--red)'
  }

  return (
    <ScanContext.Provider value={{ scanning, setScanning, scanProject, setScanProject }}>
      <ErrorBoundary>
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
          {!isLanding && (
            <>
              {/* ══ Nav — Next-Gen Cyber Header ══ */}
              <nav className="nav">
                {/* Logo */}
                <NavLink to="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text)', marginRight: 24, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '0.4px', textDecoration: 'none', flexShrink: 0 }}>
                  <img src="/logo.png" alt="SAGE Shield" style={{ width: 30, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(0, 212, 178, 0.5))' }} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    SAGE
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)', letterSpacing: '0.08em' }}>CYBER</span>
                  </span>
                </NavLink>

                {/* Nav links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[
                    { to: '/scan',     label: 'Scanner Studio' },
                    { to: '/zip-scan', label: 'Repository ZIP' },
                    { to: '/learn',    label: 'Knowledge Hub' },
                    { to: '/history',  label: 'Audit History' },
                  ].map(({ to, label }) => (
                    <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                      {label}
                    </NavLink>
                  ))}
                </div>

                {/* Right side controls */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>

                  {/* Scanning indicator */}
                  {scanning && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius)', color: 'var(--ok)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                      Scanning
                    </div>
                  )}

                  {/* OSV status */}
                  {healthStatus?.error
                    ? <div title="Backend unreachable" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius)', cursor: 'default' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--critical)', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--critical)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>OSV Offline</span>
                      </div>
                    : healthStatus?.osv_synced_at
                      ? <div title={`Last sync: ${healthStatus.osv_synced_at}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'default' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: getSyncColor(healthStatus.osv_synced_at), display: 'inline-block', boxShadow: `0 0 6px ${getSyncColor(healthStatus.osv_synced_at)}` }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OSV {getRelativeTime(healthStatus.osv_synced_at)}</span>
                        </div>
                      : null}

                  {/* Logs toggle */}
                  <button onClick={() => setShowLogs(!showLogs)}
                    style={{ background: showLogs ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-elevated)', border: showLogs ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border)', color: showLogs ? '#60A5FA' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '6px 10px', borderRadius: 'var(--radius)', transition: 'all 0.15s' }}>
                    Logs
                  </button>

                  {/* New Scan CTA */}
                  {location.pathname !== '/scan' && (
                    <NavLink to="/scan" className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', minHeight: 32, textDecoration: 'none' }}>
                      + New Scan
                    </NavLink>
                  )}

                  {/* User avatar + logout */}
                  {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#00D4B2,#60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {user.username?.[0]?.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{user.username}</span>
                      </div>
                      <button onClick={logout} title="Sign out" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--critical)', cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 'var(--radius)', fontWeight: 600, transition: 'all 0.15s' }}>
                        Sign out
                      </button>
                    </div>
                  )}

                  {/* Theme toggle */}
                  <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    className="theme-toggle-btn">
                    <div className="theme-toggle-knob">
                      {theme === 'dark' ? '🌙' : '☀️'}
                    </div>
                  </button>
                </div>
              </nav>
              {/* System Status Bar */}
              <SystemStatusBar healthStatus={healthStatus} />

              {/* Terminal Logs panel */}
              {showLogs && (
                <div style={{ borderBottom: '1px solid var(--border)', maxHeight: 200, overflow: 'hidden' }}>
                  <SystemLogs />
                </div>
              )}

              <SystemStatusFooter healthStatus={healthStatus} />
            </>
          )}

          <Routes>
            <Route path="/" element={<Landing theme={theme} toggleTheme={toggleTheme} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/scan"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/scanning" element={<ProtectedRoute><Scanning /></ProtectedRoute>} />
            <Route path="/results"  element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/learn"    element={<ProtectedRoute><Learn /></ProtectedRoute>} />
            <Route path="/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/zip-scan" element={<ProtectedRoute><ZipScan /></ProtectedRoute>} />
          </Routes>
        </div>
      </ErrorBoundary>
    </ScanContext.Provider>
  )
}