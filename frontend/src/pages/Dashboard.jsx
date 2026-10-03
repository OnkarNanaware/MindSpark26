import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'
import FileUpload from '../components/FileUpload'
import Tooltip from '../components/Tooltip'
import { DATA_SOURCE_DETAIL } from '../data/dataSources'
import {
  FileText,
  Archive,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  ChevronRight,
  GitBranch,
  Lock
} from 'lucide-react'

const SEVS = [
  { level: 'CRITICAL', score: '9.0–10.0', color: 'var(--critical)', label: 'Immediate fix required', bg: 'var(--red-dim)' },
  { level: 'HIGH',     score: '7.0–8.9',  color: 'var(--high)',     label: 'Fix in current sprint', bg: 'var(--warn-bg)' },
  { level: 'MEDIUM',   score: '4.0–6.9',  color: 'var(--medium)',   label: 'Scheduled maintenance',  bg: 'rgba(250, 204, 21, 0.1)' },
  { level: 'LOW',      score: '0.1–3.9',  color: 'var(--low)',      label: 'Monitor / backlog',   bg: 'var(--fix-bg)' },
]

function MediationPanel({ eco }) {
  if (!eco || !eco.mediationExample) return null
  const ex = eco.mediationExample
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60A5FA', fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <GitBranch size={14} />
        <Tooltip termKey="mediation">Dependency Mediation</Tooltip>
        <span style={{ marginLeft: 'auto', color: eco.color, fontWeight: 600, fontSize: 11, textTransform: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
          {eco.label} rules
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>{eco.mediationRule}</p>
      <div style={{ background: 'var(--code-bg)', borderRadius: 'var(--radius)', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, border: '1px solid var(--border)' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: 11 }}>{ex.package} requested by contestants:</div>
        {Array.isArray(ex.contestants) && ex.contestants.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>depth {c.depth}</span>
            <span style={{ color: c.safe ? 'var(--low)' : 'var(--high)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.requester}>{c.requester}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>{ex.package}@</span>
              <span style={{ color: c.safe ? 'var(--low)' : 'var(--critical)', fontWeight: 700 }}>{c.version}</span>
              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 2, background: c.safe ? 'var(--green-dim)' : 'var(--red-dim)', color: c.safe ? 'var(--low)' : 'var(--critical)', fontWeight: 700 }}>
                {c.safe ? 'SAFE' : 'UNSAFE'}
              </span>
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>Resolved: </span>
          <span style={{ color: 'var(--critical)', fontWeight: 700 }}>{ex.package}@{ex.winner}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>({ex.winReason})</span>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--critical)', marginTop: 10, lineHeight: 1.5, fontWeight: 500 }}>⚠ {ex.danger}</p>
      <p style={{ fontSize: 12.5, color: 'var(--low)', marginTop: 6, lineHeight: 1.5 }}>Fix: {eco.mediationFix}</p>
    </div>
  )
}

function RightPanel({ eco }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 84 }}>

      {/* Severity matrix */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60A5FA', fontFamily: 'var(--font-mono)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} />
          <Tooltip termKey="severity">CVSS v3.1 Severity Matrix</Tooltip>
        </div>
        {SEVS.map(s => (
          <div key={s.level} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 26, borderRadius: 'var(--radius-sm)', background: s.bg, border: `1px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: s.color, fontWeight: 700 }}>{s.level.slice(0, 4)}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: s.color, fontWeight: 600 }}>{s.level}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{s.score}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Scores reflect official <Tooltip termKey="cvss">CVSS v3.1</Tooltip> and <Tooltip termKey="osv">OSV.dev</Tooltip> threat intelligence.
        </div>
      </div>

      {/* Dependency types */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60A5FA', fontFamily: 'var(--font-mono)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={14} />
          <span>Dependency Topology</span>
        </div>

        {/* Visual flow */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 2, color: 'var(--text-secondary)', marginBottom: 14, padding: '10px 12px', background: 'var(--code-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-muted)' }}>project-root</div>
          <div style={{ color: 'var(--border)' }}>  └─► <span style={{ color: 'var(--low)', fontWeight: 600 }}>[DIRECT]</span> express</div>
          <div style={{ color: 'var(--border)' }}>        └─► <span style={{ color: 'var(--medium)', fontWeight: 600 }}>[TRANSITIVE]</span> body-parser</div>
        </div>

        {[
          { label: '[DIRECT]',     color: 'var(--low)',    bg: 'var(--green-dim)',  desc: 'Declared in manifest. You directly manage versioning.' },
          { label: '[TRANSITIVE]', color: 'var(--medium)', bg: 'rgba(250, 204, 21, 0.1)', desc: 'Installed automatically as indirect dependencies. 85%+ CVEs live here.' },
        ].map(d => (
          <div key={d.label} style={{ marginBottom: 10, padding: '10px 12px', background: d.bg, borderRadius: 'var(--radius-sm)', border: `1px solid ${d.color}33` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: d.color, marginBottom: 2 }}>{d.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{d.desc}</div>
          </div>
        ))}
      </div>

      <MediationPanel eco={eco} />

      {/* CVE path example */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#60A5FA', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
          CVE Attack Propagation Chain
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 2 }}>
          {(eco?.cvePathExample || ['my-app', 'express', 'body-parser', 'lodash (CVE)']).map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--border)', marginLeft: i * 8, fontSize: 11 }}>└─</span>}
              <span style={{ marginLeft: i > 0 ? i * 8 : 0, color: p.includes('(CVE)') ? 'var(--critical)' : 'var(--text-secondary)' }}>
                {p}
              </span>
              {i === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>← your app</span>}
              {p.includes('(CVE)') && <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 2, background: 'var(--red-dim)', color: 'var(--critical)', fontWeight: 700 }}>EXPLOITABLE</span>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          <Tooltip termKey="rootCause">Root cause injection</Tooltip>:{' '}
          {(eco?.cvePathExample || ['my-app', 'express', 'body-parser', 'lodash (CVE)']).slice(1, -1).join(' → ')}.
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const lastEco = location.state?.lastEcosystem
  const presetKey = location.state?.preset

  const [error, setError] = useState('')
  const [activeMode, setActiveMode] = useState('manifest') // 'manifest' | 'zip'
  const [eco, setEco] = useState(() => {
    if (presetKey && ECOSYSTEMS[presetKey]) return ECOSYSTEMS[presetKey]
    if (lastEco && ECOSYSTEMS[lastEco]) return ECOSYSTEMS[lastEco]
    return ECOSYSTEMS.npm
  })
  const [initialContent, setInitialContent] = useState(() => {
    if (presetKey && ECOSYSTEMS[presetKey]) return ECOSYSTEMS[presetKey].sampleContent
    return ''
  })

  useEffect(() => {
    if (location.state?.preset && ECOSYSTEMS[location.state.preset]) {
      const e = ECOSYSTEMS[location.state.preset]
      setEco(e)
      setInitialContent(e.sampleContent)
    }
  }, [location.state])

  const analyze = async (content, filename) => {
    setError('')
    const detectedEco = detectEcosystem(filename)
    navigate('/scanning', { state: { code: content, ecosystem: detectedEco?.label?.toLowerCase() || 'npm' } })
  }

  const loadPreset = (key) => {
    const e = ECOSYSTEMS[key]
    setEco(e)
    setInitialContent(e.sampleContent)
  }

  return (
    <div className="page-container">
      {/* ══ Studio Header ══ */}
      <div style={{ marginBottom: 32, maxWidth: 940 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
          <Zap size={13} />
          <span>SAGE SCANNER STUDIO · HIGH-PRECISION DEPENDENCY RADAR</span>
        </div>

        <h1 style={{ fontSize: 'clamp(28px, 3.8vw, 42px)', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.15 }}>
          Vulnerability & Supply Chain Studio
        </h1>

        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 740 }}>
          Ingest dependency manifests or complete codebase archives. SAGE builds the full recursive
          dependency graph, cross-checks against OSV & NVD databases, and delivers precision non-breaking patches.
        </p>

        {/* ══ Dual Workspace Mode Switcher ══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', gap: 4 }}>
            <button
              onClick={() => setActiveMode('manifest')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeMode === 'manifest' ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'transparent',
                color: activeMode === 'manifest' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                boxShadow: activeMode === 'manifest' ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={15} />
              <span>Manifest Scanner</span>
            </button>

            <button
              onClick={() => navigate('/zip-scan')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Archive size={15} />
              <span>Repository ZIP Audit</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0, 212, 178, 0.15)', color: '#00D4B2', fontWeight: 700 }}>SAST</span>
            </button>
          </div>

          {/* Quick presets pill list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Instant Templates:</span>
            <button onClick={() => loadPreset('npm')} className="a-btn" style={{ fontSize: 12, padding: '5px 10px', minHeight: 30 }}>
              Node.js
            </button>
            <button onClick={() => loadPreset('pypi')} className="a-btn" style={{ fontSize: 12, padding: '5px 10px', minHeight: 30 }}>
              Python
            </button>
            <button onClick={() => loadPreset('maven')} className="a-btn" style={{ fontSize: 12, padding: '5px 10px', minHeight: 30 }}>
              Maven
            </button>
          </div>
        </div>

        {/* Security / Privacy notice */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 20,
          padding: '12px 18px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}>
          <Lock size={16} color="#00D4B2" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>In-Memory Ephemeral Analysis:</strong> Manifest metadata is evaluated strictly in RAM. Zero source code or secret tokens are ever stored or retained.
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="scanner-layout">
        <div>
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', padding: '14px 18px', color: 'var(--critical)', marginBottom: 20, fontSize: 14, fontWeight: 500 }}>
              ⚠ {error}
            </div>
          )}
          <FileUpload
            key={`${eco.label}-${initialContent?.length}`}
            onAnalyze={analyze}
            loading={false}
            onEcosystemChange={setEco}
            initialEco={eco.label.toLowerCase()}
            initialContent={initialContent}
          />
        </div>

        <div>
          <RightPanel eco={eco} />
        </div>
      </div>
    </div>
  )
}
