import { useState, useRef, useEffect } from 'react'
import Tooltip from './Tooltip'
import ECOSYSTEMS, { detectEcosystem } from '../data/ecosystems'

function detectFromContent(text) {
  if (!text || text.trim().length < 10) return null
  const t = text.trim()
  if (t.includes('<groupId>') || t.includes('<artifactId>') || t.includes('<dependencies>'))
    return 'maven'
  try {
    const parsed = JSON.parse(t)
    if (parsed.dependencies || parsed.devDependencies || parsed.peerDependencies ||
        (parsed.name && parsed.version))
      return 'npm'
  } catch (_) {}
  const lines = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  const pypiPattern = /^[a-zA-Z0-9_\-\.]+\s*(==|>=|<=|~=|!=|>|<|\[)/
  const plainPkg    = /^[a-zA-Z0-9_\-\.]+$/
  const pypiLines   = lines.filter(l => pypiPattern.test(l.trim()) || plainPkg.test(l.trim()))
  if (pypiLines.length > 0 && pypiLines.length >= lines.length * 0.6) return 'pypi'
  return null
}

const PLACEHOLDERS = {
  npm:   `{\n  "name": "my-project",\n  "dependencies": {\n    "express": "4.17.1",\n    "lodash": "4.17.21"\n  }\n}`,
  pypi:  `Django==3.2.0\nrequests==2.28.0\nnumpy==1.23.0`,
  maven: `<dependencies>\n  <dependency>\n    <groupId>org.springframework</groupId>\n    <artifactId>spring-core</artifactId>\n    <version>5.3.0</version>\n  </dependency>\n</dependencies>`,
}

const ECO_ICONS = { npm: 'N', pypi: 'P', maven: 'M' }

export default function FileUpload({ onAnalyze, loading, onEcosystemChange, initialEco, initialContent }) {
  const [content, setContent] = useState(initialContent || '')
  const [activeEco, setActiveEco] = useState(initialEco || 'npm')
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (initialEco && ECOSYSTEMS[initialEco]) {
      setActiveEco(initialEco)
      onEcosystemChange?.(ECOSYSTEMS[initialEco])
    } else {
      onEcosystemChange?.(ECOSYSTEMS.npm)
    }
    if (initialContent) {
      setContent(initialContent)
    }
  }, [initialEco, initialContent])

  const loadSample = (key) => {
    const e = ECOSYSTEMS[key]
    setActiveEco(key)
    setContent(e.sampleContent)
    onEcosystemChange?.(e)
  }

  const handleFile = f => {
    const e = detectEcosystem(f.name)
    const key = Object.keys(ECOSYSTEMS).find(k => ECOSYSTEMS[k] === e) || 'npm'
    setActiveEco(key)
    onEcosystemChange?.(e)
    const r = new FileReader()
    r.onload = ev => setContent(ev.target.result)
    r.readAsText(f)
  }

  const eco = ECOSYSTEMS[activeEco]
  const canScan = content.trim() && !loading && content.length <= 512000

  return (
    <div>
      {/* Ecosystem tabs with cyber blue active state */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {Object.entries(ECOSYSTEMS).map(([key, e], idx, arr) => {
          const active = activeEco === key
          return (
            <button
              key={key}
              onClick={() => { setActiveEco(key); setContent(''); onEcosystemChange?.(e) }}
              aria-pressed={active}
              style={{
                flex: 1,
                padding: '14px 0',
                border: 'none',
                borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                background: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderBottom: active ? `2px solid #3B82F6` : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#60A5FA' : 'var(--text-muted)', marginBottom: 2, fontFamily: 'var(--font-ui)' }}>
                {e.label}
              </div>
              <div style={{ fontSize: 11, color: active ? 'var(--text-secondary)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {e.file}
              </div>
            </button>
          )
        })}
      </div>

      {/* Drop zone */}
      <div
        onClick={() => ref.current.click()}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
        aria-label="Upload dependency file — click or drag and drop"
        style={{
          border: `2px dashed ${drag ? '#3B82F6' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: drag ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
          marginBottom: 16,
          transition: 'all 0.15s',
          minHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: drag ? '0 0 20px rgba(59, 130, 246, 0.25)' : 'none',
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Drop manifest file here or <span style={{ color: '#3B82F6', textDecoration: 'underline' }}>browse</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          package.json · requirements.txt · pom.xml · package-lock.json
        </div>
        <input ref={ref} type="file" hidden accept=".json,.txt,.xml" onChange={e => handleFile(e.target.files[0])} />
      </div>

      {/* Or paste separator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, color: 'var(--text-muted)', fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span>or paste contents below</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Auto-detect label + load example */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>{eco.lang}</span>
          {content.trim() && (
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 'var(--radius-sm)', background: 'var(--green-dim)', color: 'var(--low)', border: '1px solid var(--fix-border)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              auto-detected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {content.trim() && (
            <button
              onClick={() => setContent('')}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.15s' }}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => loadSample(activeEco)}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500, transition: 'all 0.15s' }}
          >
            Load Example
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={e => {
          const val = e.target.value
          setContent(val)
          const detected = detectFromContent(val)
          if (detected && detected !== activeEco) {
            setActiveEco(detected)
            onEcosystemChange?.(ECOSYSTEMS[detected])
          }
        }}
        rows={12}
        placeholder={PLACEHOLDERS[activeEco]}
        aria-label="Paste dependency file contents"
        style={{
          width: '100%',
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          lineHeight: 1.65,
          padding: '16px 18px',
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text)',
          resize: 'vertical',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--border-light)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />

      {content.trim() && content.length > 512000 && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--vuln-border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--critical)', fontWeight: 500 }}>
          ⚠ File too large ({Math.round(content.length / 1024)}KB). Maximum is 512KB.
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={() => onAnalyze(content, eco.file)}
        disabled={!canScan}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '14px 28px',
          background: canScan ? 'var(--text)' : 'var(--bg-elevated)',
          color: canScan ? 'var(--bg)' : 'var(--text-muted)',
          border: `1px solid ${canScan ? 'var(--text)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 15,
          cursor: canScan ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        {loading ? 'Scanning…' : 'Scan for Vulnerabilities'}
      </button>
    </div>
  )
}
