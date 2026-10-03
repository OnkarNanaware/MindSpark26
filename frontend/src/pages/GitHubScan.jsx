import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import API_BASE from '../config'
import { useScan } from '../App'

const USAGE_OPTIONS = [
  { value: 'internal',                label: 'Internal use only' },
  { value: 'commercial_closed_source', label: 'Commercial / closed-source' },
  { value: 'open_source',             label: 'Open source' },
  { value: 'saas',                    label: 'SaaS (network service)' },
  { value: 'distributed',             label: 'Distributed application' },
]

const GITHUB_STEPS = [
  { label: 'Validating repository URL' },
  { label: 'Downloading repository archive' },
  { label: 'Extracting project files securely' },
  { label: 'Scanning dependency files' },
  { label: 'Resolving dependency tree' },
  { label: 'Checking for vulnerabilities' },
  { label: 'Analyzing licenses' },
  { label: 'Building attack paths & risk report' },
]

// Validate GitHub URL client-side (basic check before sending to server)
function isValidGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  return /^https:\/\/github\.com\/[A-Za-z0-9]([A-Za-z0-9\-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.\-]{1,100}/i.test(trimmed)
}

export default function GitHubScan() {
  const navigate        = useNavigate()
  const { setScanning } = useScan()
  const abortRef        = useRef(null)

  const [repoUrl,        setRepoUrl]        = useState('')
  const [usageContext,   setUsageContext]    = useState('internal')
  const [scanning,       setLocalScanning]  = useState(false)
  const [step,           setStep]           = useState(0)
  const [error,          setError]          = useState(null)
  const [urlTouched,     setUrlTouched]     = useState(false)

  const progress = Math.round(((step + 1) / GITHUB_STEPS.length) * 100)
  const isValid  = isValidGitHubUrl(repoUrl)
  const showUrlError = urlTouched && repoUrl.trim() && !isValid

  async function startScan() {
    if (!isValid) {
      setError('Please enter a valid public GitHub repository URL.')
      setUrlTouched(true)
      return
    }
    setError(null)
    setLocalScanning(true)
    if (typeof setScanning === 'function') setScanning(true)

    abortRef.current = new AbortController()

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setStep(s => Math.min(s + 1, GITHUB_STEPS.length - 2))
    }, 2800)

    try {
      const res = await axios.post(
        `${API_BASE}/api/scan/github`,
        { repoUrl: repoUrl.trim(), usage_context: usageContext },
        {
          timeout: 600000,  // 10 min — large repos can take time
          signal: abortRef.current.signal,
          headers: { 'Content-Type': 'application/json' },
        }
      )

      clearInterval(interval)
      setStep(GITHUB_STEPS.length - 1)

      setTimeout(() => {
        if (typeof setScanning === 'function') setScanning(false)
        navigate('/results', { state: { result: res.data } })
      }, 600)

    } catch (err) {
      clearInterval(interval)
      if (typeof setScanning === 'function') setScanning(false)
      setLocalScanning(false)
      setStep(0)

      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return

      const status  = err?.response?.status
      const data    = err?.response?.data || {}
      const msg     = data.error
      const details = data.details || []

      let display = msg || 'GitHub repository scan failed — please try again.'

      if (status === 400)  display = msg || 'Invalid GitHub repository URL.'
      if (status === 403)  display = 'Repository is private or access is restricted.'
      if (status === 404)  display = 'Repository not found. Verify the URL and that it is public.'
      if (status === 413)  display = 'Repository is too large to analyze (max 100 MB).'
      if (status === 422)  display = msg || 'No supported dependency files were found in this repository.'
      if (status === 429)  display = 'Too many requests — please wait 60 seconds and try again.'
      if (status === 502)  display = 'Failed to download the repository. GitHub may be temporarily unavailable.'

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

  // ── Scanning overlay ────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div style={{ minHeight: 'calc(100vh - 96px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '90%', maxWidth: 520, padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Analyzing GitHub Repository</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
              {repoUrl} · Running full security analysis…
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {GITHUB_STEPS.map((s, i) => {
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
              aria-label={`Step ${step + 1} of ${GITHUB_STEPS.length}`}
              style={{ background: 'var(--bg-elevated)', borderRadius: 2, height: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', background: 'var(--text)', width: `${progress}%`, transition: 'width 0.5s ease', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Step {step + 1} of {GITHUB_STEPS.length}</span>
              <button onClick={handleCancel} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Input form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'calc(100vh - 96px)', background: 'var(--bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34D399', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
            <span>GITHUB REPOSITORY ANALYSIS</span>
          </div>

          <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2 }}>
            GitHub Repository Scanner
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 600 }}>
            Paste any public GitHub repository URL. The system downloads, extracts, and runs the full SCA + SAST + license pipeline automatically.
          </p>

          {/* Mode switcher — consistent with ZipScan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <div style={{ display: 'inline-flex', padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', gap: 4 }}>
              <button
                onClick={() => navigate('/scan')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <span>Manifest Scanner</span>
              </button>

              <button
                onClick={() => navigate('/zip-scan')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                <span>Repository ZIP</span>
              </button>

              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)' }}
              >
                <span>GitHub Repository</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0, 212, 178, 0.2)', color: '#00D4B2', fontWeight: 700 }}>NEW</span>
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 28, marginBottom: 20 }}>

          {/* GitHub URL input */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="github-url" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              GitHub Repository URL
            </label>

            <div style={{ position: 'relative' }}>
              {/* GitHub icon */}
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>

              <input
                id="github-url"
                type="url"
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={e => { setRepoUrl(e.target.value); setError(null) }}
                onBlur={() => setUrlTouched(true)}
                onKeyDown={e => e.key === 'Enter' && startScan()}
                autoComplete="url"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${showUrlError ? 'var(--critical)' : repoUrl && isValid ? 'var(--ok)' : 'var(--border)'}`,
                  color: 'var(--text)',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { if (!showUrlError && !(repoUrl && isValid)) e.target.style.borderColor = 'var(--border-light)' }}
                onBlurCapture={e => { if (!showUrlError && !(repoUrl && isValid)) e.target.style.borderColor = 'var(--border)' }}
              />

              {/* Validation indicator */}
              {repoUrl.trim() && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                  {isValid ? (
                    <span style={{ color: 'var(--ok)' }}>✓</span>
                  ) : (
                    <span style={{ color: 'var(--critical)' }}>✗</span>
                  )}
                </div>
              )}
            </div>

            {showUrlError && (
              <p style={{ fontSize: 12, color: 'var(--critical)', marginTop: 6 }}>
                Enter a valid GitHub URL, e.g. https://github.com/owner/repo
              </p>
            )}
            {isValid && (
              <p style={{ fontSize: 12, color: 'var(--ok)', marginTop: 6 }}>
                Valid GitHub repository URL
              </p>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: isValid || showUrlError ? 4 : 6, lineHeight: 1.5 }}>
              Only public repositories. No authentication required. Accepts .git URLs and /tree/branch links.
            </p>
          </div>

          {/* Usage context */}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="usage-context-gh" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
              Project Usage Context
            </label>
            <select
              id="usage-context-gh"
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
            id="github-scan-button"
            onClick={startScan}
            disabled={!isValid}
            style={{
              width: '100%', padding: '15px 24px', borderRadius: 'var(--radius)',
              background: isValid
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'var(--bg-elevated)',
              color: isValid ? '#FFFFFF' : 'var(--text-muted)',
              border: `1px solid ${isValid ? 'rgba(5, 150, 105, 0.4)' : 'var(--border)'}`,
              boxShadow: isValid ? '0 4px 20px rgba(5, 150, 105, 0.4)' : 'none',
              fontWeight: 700, fontSize: 15,
              cursor: isValid ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', fontFamily: 'var(--font-ui)',
            }}
          >
            {isValid ? 'Analyze Repository →' : 'Enter a GitHub repository URL to continue'}
          </button>
        </div>

        {/* Capability cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'No install needed', desc: 'Downloads archive directly — no git clone, no npm install' },
            { label: 'Public repos only', desc: 'No GitHub tokens required; private repos are not supported' },
            { label: 'Full SCA pipeline', desc: 'Same CVE, license, SAST, and risk analysis as ZIP uploads' },
            { label: 'Multi-project', desc: 'Discovers manifests recursively across frontend/backend subdirs' },
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
