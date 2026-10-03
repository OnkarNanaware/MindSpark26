import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import API_BASE from '../config'
import { useScan } from '../App'

const USAGE_OPTIONS = [
  { value: 'internal',               label: 'Internal use only' },
  { value: 'commercial_closed_source', label: 'Commercial / closed-source' },
  { value: 'open_source',            label: 'Open source' },
  { value: 'saas',                   label: 'SaaS (network service)' },
  { value: 'distributed',            label: 'Distributed application' },
]

const ZIP_STEPS = [
  { label: 'Validating ZIP (security checks)' },
  { label: 'Extracting project safely' },
  { label: 'Discovering project structure' },
  { label: 'Resolving dependency tree' },
  { label: 'Scanning for vulnerabilities' },
  { label: 'Running static analysis (SAST)' },
  { label: 'Analyzing licenses' },
  { label: 'Building attack paths' },
]

export default function ZipScan() {
  const navigate        = useNavigate()
  const { setScanning } = useScan()
  const fileRef         = useRef(null)
  const abortRef        = useRef(null)

  const [file,          setFile]         = useState(null)
  const [usageContext,  setUsageContext]  = useState('internal')
  const [projectLicense, setProjectLicense] = useState('')
  const [scanning,      setLocalScanning] = useState(false)
  const [step,          setStep]          = useState(0)
  const [error,         setError]         = useState(null)
  const [dragOver,      setDragOver]      = useState(false)

  const progress = Math.round(((step + 1) / ZIP_STEPS.length) * 100)

  function handleFile(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Only .zip files are supported.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('ZIP must be under 50 MB.')
      return
    }
    setError(null)
    setFile(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  async function startScan() {
    if (!file) { setError('Please select a ZIP file first.'); return }
    setError(null)
    setLocalScanning(true)
    if (typeof setScanning === 'function') setScanning(true)

    abortRef.current = new AbortController()

    // Step progression
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setStep(s => Math.min(s + 1, ZIP_STEPS.length - 2))
    }, 2500)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('usage_context', usageContext)
      if (projectLicense) formData.append('project_license', projectLicense)

      const res = await axios.post(`${API_BASE}/api/scan/zip`, formData, {
        timeout: 300000,   // 5 min for large projects
        signal: abortRef.current.signal,
        // Do NOT override headers here — axios auto-sets multipart/form-data with boundary,
        // and explicitly setting Content-Type would strip the Authorization header.
      })

      clearInterval(interval)
      setStep(ZIP_STEPS.length - 1)

      setTimeout(() => {
        if (typeof setScanning === 'function') setScanning(false)
        navigate('/results', { state: { result: res.data } })
      }, 600)

    } catch (err) {
      clearInterval(interval)
      if (typeof setScanning === 'function') setScanning(false)
      setLocalScanning(false)
      setStep(0)  // reset overlay so it exits

      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return

      const status  = err?.response?.status
      const data    = err?.response?.data || {}
      const msg     = data.error
      const details = data.details || []

      let display = msg || 'ZIP scan failed — please try again.'
      if (status === 413) display = 'ZIP too large (max 50 MB).'
      if (status === 429) display = 'Too many requests — wait 60s and retry.'
      if (status === 400 && msg) display = msg

      // Append backend details (e.g. manifest not found hints)
      if (details.length > 0) {
        display = display + '\n\nDetails: ' + details.slice(0, 3).join(' | ')
      }

      setError(display)
    }
  }

  function handleCancel() {
    if (abortRef.current) abortRef.current.abort()
    if (typeof setScanning === 'function') setScanning(false)
    setLocalScanning(false)
    setStep(0)
  }

  // ── Scanning state UI ──────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div style={{ minHeight: 'calc(100vh - 96px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '90%', maxWidth: 520, padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Scanning Project ZIP</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {file?.name} · Running full security analysis…
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {ZIP_STEPS.map((s, i) => {
              const isPast    = i < step
              const isCurrent = i === step
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius)',
                  background: isCurrent ? 'var(--bg-elevated)' : 'transparent',
                  border: `1px solid ${isCurrent ? 'var(--border-light)' : 'transparent'}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isPast ? 'var(--ok)' : isCurrent ? 'var(--text-secondary)' : 'var(--border)'}`,
                    background: isPast ? 'var(--ok)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: isPast ? 'var(--bg)' : isCurrent ? 'var(--text-secondary)' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}>
                    {isPast ? '✓' : isCurrent ? (i + 1) : ''}
                  </div>
                  <span style={{
                    fontSize: 14,
                    fontWeight: isCurrent ? 600 : 400,
                    color: isPast ? 'var(--ok)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                    transition: 'color 0.2s',
                  }}>
                    {s.label}
                  </span>
                  {isCurrent && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                      {[0, 1, 2].map(d => (
                        <div key={d} style={{
                          width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)',
                          animation: `pulse 1s ease-in-out ${d * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 24 }}>
            <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
              aria-label={`Step ${step + 1} of ${ZIP_STEPS.length}`}
              style={{ background: 'var(--bg-elevated)', borderRadius: 2, height: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', background: 'var(--text)', width: `${progress}%`, transition: 'width 0.5s ease', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Step {step + 1} of {ZIP_STEPS.length}</span>
              <button onClick={handleCancel} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Upload form ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'calc(100vh - 96px)', background: 'var(--bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
            <span>FULL ARCHIVE REPOSITORY AUDIT</span>
          </div>

          <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2 }}>
            Repository ZIP Audit & SAST Scanner
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 600 }}>
            Upload a zipped project codebase to execute comprehensive dependency discovery, static analysis (SAST secrets & injection flaws), and license policy verification.
          </p>

          {/* Dual Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <div style={{ display: 'inline-flex', padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', gap: 4 }}>
              <button
                onClick={() => navigate('/scan')}
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
                <span>Manifest Scanner</span>
              </button>

              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF', /* button on gradient bg, keep white */
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
                }}
              >
                <span>Repository ZIP Audit</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0, 212, 178, 0.15)', color: '#00D4B2', fontWeight: 700 }}>SAST</span>
              </button>

              <button
                onClick={() => navigate('/github-scan')}
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
                <span>GitHub Repository</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 20 }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#3B82F6' : file ? 'var(--ok)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '48px 28px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(59, 130, 246, 0.08)' : file ? 'var(--green-dim)' : 'var(--bg-panel)',
              transition: 'all 0.15s',
              marginBottom: 24,
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: dragOver ? '0 0 24px rgba(59, 130, 246, 0.25)' : 'none',
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            aria-label="Click or drag to upload ZIP file"
          >
            <input ref={fileRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])} />
            {file ? (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ok)' }}>{file.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</div>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-secondary)' }}>Drop project ZIP here or <span style={{ color: 'var(--text)', textDecoration: 'underline' }}>browse</span></div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Maximum 50 MB · .zip only</div>
              </>
            )}
          </div>

          {/* Usage context */}
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="usage-context" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              Project Usage Context
            </label>
            <select
              id="usage-context"
              value={usageContext}
              onChange={e => setUsageContext(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, cursor: 'pointer', outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {USAGE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Used for license governance evaluation only — does not affect vulnerability scanning.
            </p>
          </div>

          {/* Optional project license */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="project-license" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              Project License
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>optional · auto-detected from LICENSE file</span>
            </label>
            <input
              id="project-license"
              type="text"
              placeholder="e.g. MIT, Apache-2.0, GPL-3.0-only"
              value={projectLicense}
              onChange={e => setProjectLicense(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-ui)', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--border-light)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--red-dim)',
              border: '1px solid var(--vuln-border)',
              borderRadius: 'var(--radius)', fontSize: 14, color: 'var(--critical)',
              marginBottom: 16, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontWeight: 500,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Scan button */}
          <button
            id="zip-scan-button"
            onClick={startScan}
            disabled={!file}
            style={{
              width: '100%', padding: '15px 24px', borderRadius: 'var(--radius)',
              background: file ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' : 'var(--bg-elevated)',
              color: file ? '#FFFFFF' : 'var(--text-muted)',
              border: `1px solid ${file ? 'rgba(59, 130, 246, 0.4)' : 'var(--border)'}`,
              boxShadow: file ? '0 4px 20px rgba(37, 99, 235, 0.4)' : 'none',
              fontWeight: 700, fontSize: 15,
              cursor: file ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', fontFamily: 'var(--font-ui)',
            }}
          >
            {file ? 'Start Full Security & SAST Audit →' : 'Select a ZIP file to continue'}
          </button>
        </div>

        {/* Capability cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Source stays local', desc: 'Code never sent to OSV, NVD, or any external API' },
            { label: 'SAST analysis', desc: 'SQL injection, command injection, hardcoded secrets' },
            { label: 'License governance', desc: 'SPDX normalization and policy evaluation' },
            { label: 'Attack paths', desc: 'Import → dependency → CVE evidence chains' },
          ].map(c => (
            <div key={c.label} style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
