/**
 * ExtendedFindings.jsx
 * Renders SAST, license, secrets, and attack path findings from ZIP scans.
 * Only renders when the snapshot contains the new extended fields.
 * Does NOT modify any existing Analytics sections.
 */
import { useState } from 'react'

const SEV_COLOR = { CRITICAL: 'var(--critical)', HIGH: 'var(--high)', MEDIUM: 'var(--medium)', LOW: 'var(--low)', UNKNOWN: 'var(--text-muted)' }
const SEV_DIM   = { CRITICAL: 'var(--red-dim)',  HIGH: 'var(--yellow-dim)', MEDIUM: 'var(--blue-dim)', LOW: 'var(--green-dim)', UNKNOWN: 'var(--bg-elevated)' }
const STATUS_COLOR = { PASS: 'var(--green)', REVIEW: 'var(--yellow)', CONFLICT: 'var(--critical)', UNKNOWN: 'var(--text-muted)' }
const STATUS_DIM   = { PASS: 'var(--green-dim)', REVIEW: 'var(--yellow-dim)', CONFLICT: 'var(--red-dim)', UNKNOWN: 'var(--bg-elevated)' }

const Badge = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: bg || 'var(--bg-elevated)', color: color || 'var(--text)',
    fontFamily: 'var(--font-mono)',
  }}>{label}</span>
)

const SevBadge = ({ sev }) => {
  const s = (sev || 'UNKNOWN').toUpperCase()
  return <Badge label={s} color={SEV_COLOR[s]} bg={SEV_DIM[s]} />
}

const StatusBadge = ({ status }) => {
  const s = (status || 'UNKNOWN').toUpperCase()
  return <Badge label={s} color={STATUS_COLOR[s]} bg={STATUS_DIM[s]} />
}

function SectionHeader({ icon, title, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h2>
      {count != null && (
        <span style={{
          marginLeft: 'auto', padding: '2px 10px', borderRadius: 20,
          background: color || 'var(--bg-elevated)', fontSize: 12, fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>{count}</span>
      )}
    </div>
  )
}

// ── Code Findings (SAST) ──────────────────────────────────────────────────────

function CodeFindingCard({ finding, idx }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${SEV_COLOR[finding.severity?.toUpperCase()] || 'var(--border)'}22`,
      borderLeft: `3px solid ${SEV_COLOR[finding.severity?.toUpperCase()] || 'var(--border)'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <SevBadge sev={finding.severity} />
            <Badge label={`Conf: ${finding.confidence}`} color="var(--text-muted)" bg="var(--bg-elevated)" />
            <Badge label={finding.rule_id || finding.type} color="var(--brand)" bg="var(--brand-dim)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {finding.language || 'python'}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {finding.type?.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            📄 {finding.file}:{finding.line}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
            {finding.description}
          </div>
        </div>
      </div>

      {/* Data flow */}
      {finding.data_flow?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Data Flow</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {finding.data_flow.map((step, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 4,
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)',
                }}>{step}</span>
                {i < finding.data_flow.length - 1 && <span style={{ color: 'var(--brand)', fontWeight: 700 }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source / Sink row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        {finding.source && (
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>SOURCE</span>
            <code style={{ fontSize: 12, color: 'var(--green)' }}>{finding.source}</code>
          </div>
        )}
        {finding.sink && (
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>SINK</span>
            <code style={{ fontSize: 12, color: 'var(--critical)' }}>{finding.sink}</code>
          </div>
        )}
      </div>

      {/* Remediation (expandable) */}
      {finding.remediation && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            {expanded ? 'Hide' : 'Show'} remediation
          </button>
          {expanded && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--green-dim)', borderRadius: 6, fontSize: 12, color: 'var(--green)', lineHeight: 1.6 }}>
              ✅ {finding.remediation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Secret Findings ───────────────────────────────────────────────────────────

function SecretCard({ finding }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--yellow)',
      borderLeft: '3px solid var(--yellow)', borderRadius: 10, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <Badge label="SECRET" color="var(--yellow)" bg="var(--yellow-dim)" />
        <Badge label={finding.secret_type || 'Credential'} color="var(--text-muted)" bg="var(--bg-elevated)" />
        <Badge label="HIGH" color={SEV_COLOR.HIGH} bg={SEV_DIM.HIGH} />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        📄 {finding.file}:{finding.line}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{finding.description}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>VARIABLE</span>
          <code style={{ fontSize: 12 }}>{finding.source}</code>
        </div>
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>VALUE</span>
          <code style={{ fontSize: 12, color: 'var(--critical)' }}>{finding.redacted_value || '********'}</code>
        </div>
        {finding.fingerprint && (
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>FINGERPRINT</span>
            <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{finding.fingerprint}</code>
          </div>
        )}
      </div>
    </div>
  )
}

// ── License Findings ──────────────────────────────────────────────────────────

function LicenseTable({ findings }) {
  const [filter, setFilter] = useState('ALL')
  const statuses = ['ALL', 'PASS', 'REVIEW', 'CONFLICT', 'UNKNOWN']
  const filtered = filter === 'ALL' ? findings : findings.filter(f => f.status === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: filter === s ? (STATUS_DIM[s] || 'var(--brand-dim)') : 'var(--bg-elevated)',
            color: filter === s ? (STATUS_COLOR[s] || 'var(--brand)') : 'var(--text-muted)',
            border: `1px solid ${filter === s ? (STATUS_COLOR[s] || 'var(--brand)') : 'var(--border)'}`,
            fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
          }}>{s} {s !== 'ALL' && `(${findings.filter(f => f.status === s).length})`}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Dependency', 'Version', 'License', 'Status', 'Confidence'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                title={f.reason}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{f.dependency}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.dep_version}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 11 }}>
                    {f.license_spdx || f.license_raw || 'UNKNOWN'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}><StatusBadge status={f.status} /></td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{f.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            No {filter === 'ALL' ? '' : filter} license findings.
          </div>
        )}
        {filtered.length > 100 && (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>
            Showing first 100 of {filtered.length} findings.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Attack Paths ──────────────────────────────────────────────────────────────

function AttackPathCard({ path, idx }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${SEV_COLOR[path.severity?.toUpperCase()] || 'var(--border)'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <Badge label={path.label || 'Potential Attack Path'} color="var(--yellow)" bg="var(--yellow-dim)" />
        {path.severity && <SevBadge sev={path.severity} />}
        <Badge label={`Conf: ${path.confidence || 'MEDIUM'}`} color="var(--text-muted)" bg="var(--bg-elevated)" />
        <Badge label={path.type?.replace(/_/g, ' ')} color="var(--brand)" bg="var(--brand-dim)" />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {path.description}
      </div>

      {/* Attack path steps */}
      {path.steps?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {path.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: step.type === 'entry_point' ? 'var(--green)' :
                            step.type === 'taint_source' ? 'var(--brand)' :
                            step.type === 'sink' || step.type === 'vulnerability' ? 'var(--critical)' :
                            'var(--text-muted)',
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                  {step.node}
                </span>
                {step.file && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {step.file}:{step.line}
                  </span>
                )}
                {step.cvss && (
                  <span style={{ fontSize: 11, color: 'var(--critical)', marginLeft: 8 }}>
                    CVSS {step.cvss}
                  </span>
                )}
              </div>
              {i < path.steps.length - 1 && (
                <div style={{ position: 'absolute', marginLeft: -12, marginTop: 14, color: 'var(--text-muted)', fontSize: 10 }}>↓</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ExtendedFindings component ──────────────────────────────────────────

export default function ExtendedFindings({ snapshot }) {
  const codeFindingsRaw  = snapshot?.code_findings    || []
  const secretFindings   = snapshot?.secret_findings  || []
  const licenseFindings  = snapshot?.license_findings || []
  const attackPaths      = snapshot?.attack_paths     || []

  // Filter out skipped files
  const codeFindings = codeFindingsRaw.filter(f => f.status !== 'SKIPPED')

  const hasAny = codeFindings.length > 0 || secretFindings.length > 0 ||
                 licenseFindings.length > 0 || attackPaths.length > 0

  if (!hasAny) return null

  const [activeTab, setActiveTab] = useState(
    codeFindings.length > 0 ? 'code' :
    licenseFindings.length > 0 ? 'license' :
    secretFindings.length > 0 ? 'secrets' : 'attack'
  )

  const tabs = [
    { key: 'code',    label: `Code Findings`,   count: codeFindings.length,   icon: '🧪', show: codeFindings.length > 0 },
    { key: 'license', label: `License`,          count: licenseFindings.length, icon: '📜', show: licenseFindings.length > 0 },
    { key: 'secrets', label: `Secrets`,          count: secretFindings.length,  icon: '🔑', show: secretFindings.length > 0 },
    { key: 'attack',  label: `Attack Paths`,     count: attackPaths.length,     icon: '🗺️', show: attackPaths.length > 0 },
  ].filter(t => t.show)

  const codeHigh = codeFindings.filter(f => ['CRITICAL','HIGH'].includes(f.severity?.toUpperCase())).length
  const licReview = licenseFindings.filter(f => f.status === 'REVIEW').length
  const licConflict = licenseFindings.filter(f => f.status === 'CONFLICT').length

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
        borderTop: '1px solid var(--border)', paddingTop: 24,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          ── EXTENDED ANALYSIS ──
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* ZIP scan info banner */}
      {snapshot?.scan_type === 'ZIP' && (
        <div style={{
          padding: '12px 16px', background: 'var(--brand-dim)', border: '1px solid var(--brand)',
          borderRadius: 10, marginBottom: 20, fontSize: 12, color: 'var(--brand)', lineHeight: 1.6,
        }}>
          <strong>ZIP Project Scan</strong> — Source code was analyzed locally.
          {snapshot.projects_discovered?.length > 0 && (
            <span> Discovered {snapshot.projects_discovered.length} project(s): {snapshot.projects_discovered.map(p => p.name).join(', ')}.</span>
          )}
          {snapshot.summary?.sast_files_analyzed > 0 && (
            <span> {snapshot.summary.sast_files_analyzed} source files analyzed.</span>
          )}
          {snapshot.project_license?.spdx_id && snapshot.project_license.spdx_id !== 'UNKNOWN' && (
            <span> Project license: <strong>{snapshot.project_license.spdx_id}</strong> (from {snapshot.project_license.source}).</span>
          )}
        </div>
      )}

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {codeFindings.length > 0 && (
          <div style={{ padding: '10px 16px', background: codeHigh > 0 ? 'var(--red-dim)' : 'var(--bg-card)', border: `1px solid ${codeHigh > 0 ? 'var(--critical)' : 'var(--border)'}`, borderRadius: 10, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Code Findings</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: codeHigh > 0 ? 'var(--critical)' : 'var(--text)' }}>{codeFindings.length}</div>
            {codeHigh > 0 && <div style={{ fontSize: 11, color: 'var(--critical)' }}>{codeHigh} HIGH+</div>}
          </div>
        )}
        {secretFindings.length > 0 && (
          <div style={{ padding: '10px 16px', background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 10, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Secrets Found</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--yellow)' }}>{secretFindings.length}</div>
            <div style={{ fontSize: 11, color: 'var(--yellow)' }}>Redacted in UI</div>
          </div>
        )}
        {licenseFindings.length > 0 && (
          <div style={{ padding: '10px 16px', background: licConflict > 0 ? 'var(--red-dim)' : licReview > 0 ? 'var(--yellow-dim)' : 'var(--green-dim)', border: `1px solid ${licConflict > 0 ? 'var(--critical)' : licReview > 0 ? 'var(--yellow)' : 'var(--green)'}`, borderRadius: 10, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>License Issues</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: licConflict > 0 ? 'var(--critical)' : licReview > 0 ? 'var(--yellow)' : 'var(--green)' }}>{licReview + licConflict}</div>
            {licReview > 0 && <div style={{ fontSize: 11, color: 'var(--yellow)' }}>{licReview} REVIEW</div>}
          </div>
        )}
        {attackPaths.length > 0 && (
          <div style={{ padding: '10px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Attack Paths</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{attackPaths.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Potential</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
            color: activeTab === t.key ? 'var(--brand)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            {t.icon} {t.label} <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'code' && (
        <div>
          <SectionHeader icon="🧪" title="Static Analysis Findings" count={codeFindings.length} color={codeHigh > 0 ? 'var(--red-dim)' : 'var(--bg-elevated)'} />
          <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            ℹ️ Python findings use real AST analysis. JavaScript findings are pattern-based (lower precision). 
            Hover over findings for full data flow. Not equivalent to commercial SAST tools.
          </div>
          {codeFindings.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--green)', fontSize: 14 }}>✅ No code security findings detected.</div>
            : codeFindings.map((f, i) => <CodeFindingCard key={i} finding={f} idx={i} />)
          }
        </div>
      )}

      {activeTab === 'license' && (
        <div>
          <SectionHeader icon="📜" title="License Analysis" count={licenseFindings.length} />
          <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            ℹ️ REVIEW status means the license may impose obligations depending on usage context. 
            This is a governance signal — not legal advice. Consult legal counsel for compliance decisions.
          </div>
          {snapshot?.project_license?.license_conflict && (
            <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--critical)', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
              ⚠️ <strong>License Conflict:</strong> {snapshot.project_license.license_conflict.message}
            </div>
          )}
          <LicenseTable findings={licenseFindings} />
        </div>
      )}

      {activeTab === 'secrets' && (
        <div>
          <SectionHeader icon="🔑" title="Potential Secrets" count={secretFindings.length} color="var(--yellow-dim)" />
          <div style={{ padding: '8px 12px', background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 8, fontSize: 11, color: 'var(--yellow)', marginBottom: 16, lineHeight: 1.6 }}>
            ⚠️ Actual secret values are never displayed. Only type, location, and a fingerprint are shown.
            Rotate any flagged credentials immediately and move secrets to environment variables.
          </div>
          {secretFindings.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--green)', fontSize: 14 }}>✅ No hardcoded secrets detected.</div>
            : secretFindings.map((f, i) => <SecretCard key={i} finding={f} />)
          }
        </div>
      )}

      {activeTab === 'attack' && (
        <div>
          <SectionHeader icon="🗺️" title="Potential Attack Paths" count={attackPaths.length} />
          <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            ℹ️ All paths are labeled "Potential" — SAGE does not claim confirmed exploitability.
            Evidence chains show how user input could reach vulnerable code or dependencies.
          </div>
          {attackPaths.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No attack paths detected.</div>
            : attackPaths.map((p, i) => <AttackPathCard key={i} path={p} idx={i} />)
          }
        </div>
      )}
    </div>
  )
}
