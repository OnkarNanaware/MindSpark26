import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, getProjectScans, deleteProject } from '../utils/projectStore'

const SEV_LABEL = s => {
  if (s >= 90) return { label: 'CRITICAL', color: 'var(--critical)', bg: 'var(--red-dim)' }
  if (s >= 70) return { label: 'HIGH',     color: 'var(--high)',     bg: 'var(--yellow-dim)' }
  if (s >= 40) return { label: 'MEDIUM',   color: 'var(--medium)',   bg: 'var(--yellow-dim)' }
  if (s >= 1)  return { label: 'LOW',      color: 'var(--low)',      bg: 'var(--green-dim)' }
  return               { label: 'CLEAN',   color: 'var(--ok)',       bg: 'var(--green-dim)' }
}

export default function History() {
  const navigate = useNavigate()
  const [projects, setProjects]           = useState(getAllProjects())
  const [expandedProject, setExpanded]    = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleDelete = (e, name) => {
    e.stopPropagation()
    if (confirmDelete === name) {
      deleteProject(name)
      setConfirmDelete(null)
      setProjects(getAllProjects())
      if (expandedProject === name) setExpanded(null)
    } else {
      setConfirmDelete(name)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const formatDate = ts => new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="page-container-md">
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 8 }}>
          Scan History
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          View and compare past vulnerability scans across all your projects.
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            No scan history yet
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            Run your first scan to start tracking vulnerabilities over time.
          </div>
          <button
            onClick={() => navigate('/scan')}
            className="btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Launch Scanner Studio →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map(project => {
            const scans = getProjectScans(project.name)
            const isExpanded = expandedProject === project.name
            const risk = SEV_LABEL(project.lastRisk)

            return (
              <div key={project.name} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Project header row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : project.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(isExpanded ? null : project.name)}
                  aria-expanded={isExpanded}
                  style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  {/* Project name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {project.scanCount} scan{project.scanCount !== 1 ? 's' : ''} · Last: {formatDate(project.lastScan)}
                    </div>
                  </div>

                  {/* Risk badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: risk.color, lineHeight: 1 }}>
                        {project.lastRisk}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: risk.color, marginTop: 2, letterSpacing: '0.04em' }}>
                        {risk.label}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>

                    {/* Delete */}
                    <button
                      onClick={e => handleDelete(e, project.name)}
                      title={confirmDelete === project.name ? 'Click again to confirm' : 'Delete project history'}
                      aria-label={confirmDelete === project.name ? 'Confirm delete' : 'Delete project'}
                      style={{
                        background: 'none',
                        border: '1px solid',
                        borderColor: confirmDelete === project.name ? 'var(--critical)' : 'var(--border)',
                        color: confirmDelete === project.name ? 'var(--critical)' : 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        transition: 'all 0.15s',
                        minHeight: 28,
                      }}
                    >
                      {confirmDelete === project.name ? 'Confirm' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Expanded scan list */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Scan History — {scans.length} record{scans.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {scans.map(scan => {
                        const scanRisk = SEV_LABEL(scan.summary.risk_score)
                        return (
                          <div key={scan.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '12px 14px',
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', minWidth: 160, flexShrink: 0 }}>
                              {formatDate(scan.timestamp)}
                            </div>
                            <div style={{ flex: 1, display: 'flex', gap: 16, fontSize: 13 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{scan.summary.vulnerabilities}</strong> CVEs
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>·</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{scan.summary?.total_packages || scan.packages || 0}</strong> packages
                              </span>
                            </div>
                            <div style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 18,
                              fontWeight: 700,
                              color: scanRisk.color,
                              minWidth: 40,
                              textAlign: 'right',
                            }}>
                              {scan.summary.risk_score}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
