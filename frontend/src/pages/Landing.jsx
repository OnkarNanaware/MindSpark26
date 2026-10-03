import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE_SHORT, DATA_SOURCE_DETAIL } from '../data/dataSources'
import {
  Shield,
  ShieldAlert,
  ArrowRight,
  Terminal,
  Layers,
  Zap,
  GitBranch,
  FileCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Code2
} from 'lucide-react'

export default function Landing({ theme = 'dark', toggleTheme }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

  useEffect(() => {
    const nav = document.getElementById('landing-nav')
    let lastScrollY = window.scrollY
    const onScroll = () => {
      const currentY = window.scrollY
      nav?.classList.toggle('scrolled', currentY > 20)
      if (menuOpen && Math.abs(currentY - lastScrollY) > 10) setMenuOpen(false)
      lastScrollY = currentY
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.12 })
    document.querySelectorAll('.landing-page .reveal').forEach(el => obs.observe(el))
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect() }
  }, [menuOpen])

  const handleScan = (preset) => {
    setMenuOpen(false)
    if (preset) {
      navigate('/scan', { state: { preset } })
    } else {
      navigate('/scan')
    }
  }

  const copyFixCmd = (cmd) => {
    navigator.clipboard?.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  return (
    <div className="landing-page">
      <style>{landingCss}</style>

      {/* ══ Navigation Bar ══ */}
      <nav className="lp-nav" id="landing-nav">
        <button className="lp-nav-logo" onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <img src="/logo.png" alt="SAGE Shield Logo" className="lp-logo-img" />
          <span className="lp-logo-text">SAGE</span>
          <span className="lp-logo-badge">CYBER</span>
        </button>

        {/* Desktop links */}
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Intelligence</a>
          <a href="#problem" className="lp-nav-link">Transitive Risk</a>
          <a href="#pipeline" className="lp-nav-link">Security Pipeline</a>
          <button onClick={() => navigate('/learn')} className="lp-nav-link">Knowledge Hub</button>
        </div>

        {/* Desktop CTA */}
        <div className="lp-nav-cta">
          <button onClick={() => navigate('/zip-scan')} className="lp-btn-ghost">
            ZIP Scanner
          </button>
          <button onClick={() => handleScan()} className="lp-btn-primary">
            <span>Launch Studio</span>
            <ArrowRight size={15} />
          </button>
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="lp-theme-toggle"
            >
              <div className="lp-theme-knob">
                {theme === 'dark' ? '🌙' : '☀️'}
              </div>
            </button>
          )}
        </div>

        {/* Hamburger for mobile */}
        <button
          className="lp-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        >
          <span style={{ transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none' }} />
          <span style={{ opacity: menuOpen ? 0 : 1 }} />
          <span style={{ transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
        </button>

        {/* Mobile drawer */}
        {menuOpen && (
          <>
            <div className="lp-mobile-menu">
              <a href="#features" className="lp-mobile-link" onClick={() => setMenuOpen(false)}>Intelligence</a>
              <a href="#problem" className="lp-mobile-link" onClick={() => setMenuOpen(false)}>Transitive Risk</a>
              <a href="#pipeline" className="lp-mobile-link" onClick={() => setMenuOpen(false)}>Security Pipeline</a>
              <button onClick={() => { setMenuOpen(false); navigate('/learn') }} className="lp-mobile-link" style={{ textAlign: 'left', background: 'none', border: 'none' }}>Knowledge Hub</button>
              <button onClick={() => { setMenuOpen(false); navigate('/zip-scan') }} className="lp-mobile-link" style={{ textAlign: 'left', background: 'none', border: 'none' }}>ZIP Archive Audit</button>
              {toggleTheme && (
                <button
                  onClick={() => { toggleTheme(); setMenuOpen(false); }}
                  className="lp-mobile-link"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                  <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <button onClick={() => handleScan()} className="lp-mobile-cta">
                Launch Scanner Studio
              </button>
            </div>
            <div className="lp-menu-backdrop" onClick={() => setMenuOpen(false)} />
          </>
        )}
      </nav>

      {/* ══ Hero Section ══ */}
      <section className="lp-hero">
        <div className="lp-hero-bg-glow" />
        <div className="lp-hero-cyber-grid" />

        <div className="lp-hero-content">
          {/* Status Live Pill */}
          <div className="lp-hero-badge reveal">
            <span className="lp-badge-dot" />
            <span>Autonomous Supply Chain Shield · Multi-Ecosystem CVE Radar</span>
            <span className="lp-badge-live">LIVE</span>
          </div>

          {/* Main Headline */}
          <h1 className="lp-hero-title reveal reveal-delay-1">
            Zero-Trust Dependency Intelligence & <br />
            <span className="text-gradient">Transitive CVE Radar</span>
          </h1>

          {/* Subtitle with rewritten crisp sentences */}
          <p className="lp-hero-sub reveal reveal-delay-2">
            Pinpoint critical vulnerabilities hiding 10+ layers deep in transitive packages.
            Simulate dependency conflicts, calculate attack blast radiuses, and deploy verified,
            non-breaking patches in seconds.
          </p>

          {/* Action Buttons */}
          <div className="lp-hero-actions reveal reveal-delay-3">
            <button onClick={() => handleScan()} className="lp-btn-hero">
              <img src="/logo.png" alt="" style={{ width: 20, height: 24, objectFit: 'contain' }} />
              <span>Open Scanner Studio</span>
              <ArrowRight size={17} />
            </button>
            <button onClick={() => navigate('/zip-scan')} className="lp-btn-hero-ghost">
              <Layers size={17} />
              <span>Full Repository Audit</span>
            </button>
            <button onClick={() => navigate('/learn')} className="lp-btn-hero-ghost">
              <Terminal size={17} />
              <span>Security Academy</span>
            </button>
          </div>

          {/* One-Click Presets */}
          <div className="lp-presets-bar reveal reveal-delay-3">
            <span className="lp-presets-label">⚡ Test Instant Presets:</span>
            <button onClick={() => handleScan('npm')} className="lp-preset-chip">
              <span className="chip-dot npm" /> Node.js (Express & Lodash)
            </button>
            <button onClick={() => handleScan('pypi')} className="lp-preset-chip">
              <span className="chip-dot pypi" /> Python (Django & Requests)
            </button>
            <button onClick={() => handleScan('maven')} className="lp-preset-chip">
              <span className="chip-dot maven" /> Java (Spring & Log4j)
            </button>
          </div>

          {/* Social Proof Strip */}
          <div className="lp-hero-proof reveal reveal-delay-4">
            <span className="proof-item"><CheckCircle2 size={14} className="text-accent" /> Backed by OSV.dev & NVD NIST</span>
            <span className="proof-sep">·</span>
            <span className="proof-item"><CheckCircle2 size={14} className="text-accent" /> 100% In-Memory (Zero Code Retention)</span>
            <span className="proof-sep">·</span>
            <span className="proof-item"><CheckCircle2 size={14} className="text-accent" /> Direct & Transitive Graph Resolution</span>
            <span className="proof-sep">·</span>
            <a href="https://github.com/OnkarNanaware/MindSpark26" target="_blank" rel="noopener noreferrer" className="proof-link">
              Open Source GitHub <ExternalLink size={12} />
            </a>
          </div>

          {/* ══ Interactive Cyber Threat Cockpit Simulator ══ */}
          <div className="lp-cockpit-wrap reveal reveal-delay-4">
            <div className="lp-cockpit-card">
              <div className="lp-cockpit-header">
                <div className="lp-window-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="lp-cockpit-title">
                  <span className="pulse-indicator" />
                  SAGE TELEMETRY RADAR — ACTIVE THREAT GRAPH SIMULATION
                </div>
                <div className="lp-cockpit-tag">CVSS v3.1 AUDIT ENGINE</div>
              </div>

              <div className="lp-cockpit-body">
                {/* Visual Tree Section replicating the Shield Logo */}
                <div className="lp-tree-sim">
                  <div className="lp-tree-badge">
                    <img src="/logo.png" alt="SAGE" style={{ width: 22, height: 26 }} />
                    <span>DEPENDENCY BLAST RADIUS MAP</span>
                  </div>

                  <div className="lp-nodes-canvas">
                    {/* Node 1 Root App */}
                    <div className="lp-node node-root">
                      <div className="node-icon">📦</div>
                      <div className="node-info">
                        <strong>web-app</strong>
                        <span>Root Manifest</span>
                      </div>
                    </div>

                    <div className="lp-connector conn-1" />

                    {/* Node 2 Direct Dep */}
                    <div className="lp-node node-direct">
                      <div className="node-icon">⚡</div>
                      <div className="node-info">
                        <strong>express@4.17.1</strong>
                        <span className="tag-direct">DIRECT DEP</span>
                      </div>
                    </div>

                    <div className="lp-connector conn-2" />

                    {/* Node 3 Middle Transitive */}
                    <div className="lp-node node-trans">
                      <div className="node-icon">🔗</div>
                      <div className="node-info">
                        <strong>body-parser@1.19.0</strong>
                        <span className="tag-trans">TRANSITIVE L1</span>
                      </div>
                    </div>

                    <div className="lp-connector conn-3" />

                    {/* Node 4 Exploit Target */}
                    <div className="lp-node node-vuln">
                      <div className="node-icon vuln-pulse">🔍</div>
                      <div className="node-info">
                        <strong className="text-critical">lodash@4.17.15</strong>
                        <span className="tag-vuln">CVE-2020-28500 (CVSS 7.5)</span>
                      </div>
                    </div>
                  </div>

                  <div className="lp-sim-meta">
                    <span>Target: <code>ejs@3.1.5</code> (CVE-2022-29078 · CVSS 9.8)</span>
                    <span className="kev-pill">⚠️ CISA KEV ACTIVELY EXPLOITED</span>
                  </div>
                </div>

                {/* Live Audit Metrics Sidebar */}
                <div className="lp-cockpit-stats">
                  <div className="stat-box risk">
                    <div className="stat-label">SECURITY RISK SCORE</div>
                    <div className="stat-val text-critical">84<small>/100</small></div>
                    <div className="stat-sub">High Risk · Immediate Action Needed</div>
                  </div>

                  <div className="stat-row">
                    <div className="stat-mini">
                      <span className="mini-num">64</span>
                      <span className="mini-lbl">Packages Scanned</span>
                    </div>
                    <div className="stat-mini">
                      <span className="mini-num text-critical">3</span>
                      <span className="mini-lbl">Critical CVEs</span>
                    </div>
                    <div className="stat-mini">
                      <span className="mini-num text-high">5</span>
                      <span className="mini-lbl">High CVEs</span>
                    </div>
                  </div>

                  <div className="lp-fix-box">
                    <div className="fix-header">
                      <span>VERIFIED REMEDIATION PATCH</span>
                      <button onClick={() => copyFixCmd('npm install lodash@4.17.21 ejs@3.1.9')} className="fix-copy-btn">
                        {copiedCmd ? '✓ Copied' : 'Copy Fix'}
                      </button>
                    </div>
                    <code>$ npm install lodash@4.17.21 ejs@3.1.9</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Section 2: Transitive Threat Reality ══ */}
      <section className="lp-section reveal" id="problem">
        <div className="section-head text-center">
          <div className="lp-section-badge">The Transitive Security Blind Spot</div>
          <h2 className="lp-section-title">90% of Exploitable CVEs Live in Packages You Never Installed</h2>
          <p className="lp-section-sub">
            Modern applications don't get compromised through top-level dependencies.
            Attackers hide malicious payloads in deeply nested sub-dependencies that evade shallow audits.
          </p>
        </div>

        <div className="lp-metrics-grid">
          <div className="lp-metric-card">
            <div className="metric-glow" />
            <div className="metric-big text-cyan">85%+</div>
            <div className="metric-title">Vulnerabilities in Transitive Tree</div>
            <div className="metric-desc">
              Packages pulled in automatically as second, third, or fourth-tier dependencies carry the vast majority of real-world remote code execution exploits.
            </div>
            <div className="metric-foot">Sonatype State of Software Supply Chain</div>
          </div>

          <div className="lp-metric-card">
            <div className="metric-glow" />
            <div className="metric-big text-blue">&lt; 15s</div>
            <div className="metric-title">Instant In-Memory Tree Resolution</div>
            <div className="metric-desc">
              SAGE traverses recursive lockfile hierarchies and maps every edge against live OSV & NVD databases without requiring slow agent installs or account registrations.
            </div>
            <div className="metric-foot">SAGE High-Performance Resolver Engine</div>
          </div>

          <div className="lp-metric-card">
            <div className="metric-glow" />
            <div className="metric-big text-green">0 Bytes</div>
            <div className="metric-title">Zero-Knowledge Private Scanning</div>
            <div className="metric-desc">
              Your source code, environment variables, and proprietary logic are never stored or transmitted. All dependency hash audits execute in ephemeral memory and vanish immediately.
            </div>
            <div className="metric-foot">Ephemeral Cryptographic Sandbox</div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══ Section 3: Core Features & Capabilities ══ */}
      <section className="lp-section reveal" id="features">
        <div className="section-head text-center">
          <div className="lp-section-badge">Platform Intelligence</div>
          <h2 className="lp-section-title">Enterprise Security Built for Engineering Velocity</h2>
          <p className="lp-section-sub">
            Everything you need to safeguard software composition, resolve tricky mediation deadlocks, and automate compliance audits.
          </p>
        </div>

        <div className="lp-features-grid">
          {[
            {
              icon: <GitBranch size={24} className="text-cyan" />,
              title: 'Recursive Blast Radius Mapping',
              text: 'Visualizes the complete dependency tree with dynamic node scaling. Immediately identify which parent library dragged an insecure package into your build.',
            },
            {
              icon: <Zap size={24} className="text-blue" />,
              title: 'Dependency Mediation Explainer',
              text: 'Reveals the exact resolver conflict algorithms across npm, pip, and Maven, explaining why a vulnerable version won over a safe alternative.',
            },
            {
              icon: <Terminal size={24} className="text-green" />,
              title: 'Precision Surgical Fix Engine',
              text: 'Calculates the minimal semver bump required to excise vulnerable packages without introducing breaking API changes or cascade regressions.',
            },
            {
              icon: <ShieldAlert size={24} className="text-critical" />,
              title: 'CISA KEV & EPSS Threat Feeds',
              text: 'Prioritize fixes using real-world exploit telemetry. Flags vulnerabilities actively weaponized by adversaries in the wild today.',
            },
            {
              icon: <Layers size={24} className="text-purple" />,
              title: 'Full Repository & SAST Scanner',
              text: 'Drop a ZIP archive to uncover hardcoded secrets, misconfigured credentials, API keys, and restrictive license compliance violations in one go.',
            },
            {
              icon: <FileCheck size={24} className="text-cyan" />,
              title: 'Audit-Ready PDF & SBOM Export',
              text: 'Export complete Software Bills of Materials (SBOM), CSV matrices, and executive vulnerability summaries formatted for compliance audits.',
            },
          ].map((feat, i) => (
            <div key={feat.title} className="lp-feature-card">
              <div className="lp-feat-icon-wrap">{feat.icon}</div>
              <h3 className="lp-feat-title">{feat.title}</h3>
              <p className="lp-feat-text">{feat.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-divider" />

      {/* ══ Section 4: Security Pipeline ══ */}
      <section className="lp-section reveal" id="pipeline">
        <div className="section-head text-center">
          <div className="lp-section-badge">How It Works</div>
          <h2 className="lp-section-title">From Codebase Upload to Safe Fix in 4 Steps</h2>
          <p className="lp-section-sub">
            Zero friction. No CLI installations required. Drop your manifests or archive and let SAGE do the heavy lifting.
          </p>
        </div>

        <div className="lp-steps-row">
          {[
            {
              step: '01',
              title: 'Upload Manifest or ZIP',
              desc: 'Drag & drop package.json, requirements.txt, pom.xml, or complete project ZIP repositories.',
            },
            {
              step: '02',
              title: 'Graph DAG Resolution',
              desc: 'Resolves direct and transitive dependency trees using official ecosystem conflict rules.',
            },
            {
              step: '03',
              title: 'Real-time Vulnerability Correlation',
              desc: 'Cross-checks every package against OSV.dev, NVD NIST, and CISA Known Exploited Vulnerabilities.',
            },
            {
              step: '04',
              title: 'Deploy One-Click Fixes',
              desc: 'Copy verified CLI commands with minimal version bumps, or download compliance SBOM reports.',
            },
          ].map((s) => (
            <div key={s.step} className="lp-step-card">
              <div className="lp-step-num">{s.step}</div>
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Section 5: High-Converting CTA Band ══ */}
      <div className="lp-cta-wrapper reveal">
        <div className="lp-cta-box">
          <div className="lp-cta-glow" />
          <div className="lp-cta-left">
            <img src="/logo.png" alt="SAGE" style={{ width: 56, height: 64, marginBottom: 16, filter: 'drop-shadow(0 0 16px rgba(0, 212, 178, 0.6))' }} />
            <h2 className="lp-cta-headline">Secure Your Software Supply Chain Right Now.</h2>
            <p className="lp-cta-subhead">
              Zero registration. Zero telemetry tracking. Drop your manifest to identify and neutralize hidden vulnerabilities in seconds.
            </p>
          </div>
          <div className="lp-cta-right">
            <button onClick={() => handleScan()} className="lp-btn-hero">
              <span>Open Scanner Studio</span>
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/zip-scan')} className="lp-btn-hero-ghost">
              <span>Upload Project ZIP</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══ Footer ══ */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <img src="/logo.png" alt="SAGE" style={{ width: 32, height: 36, objectFit: 'contain' }} />
              <span>SAGE CYBER DEFENSE</span>
            </div>
            <p className="lp-footer-desc">
              Autonomous Software Supply Chain Security and Transitive Vulnerability Intelligence. Free, open source, and privacy-preserving.
            </p>
          </div>

          <div className="lp-footer-nav-col">
            <div className="lp-footer-col-title">WORKSPACE</div>
            <button onClick={() => navigate('/scan')} className="lp-footer-btn">Scanner Studio</button>
            <button onClick={() => navigate('/zip-scan')} className="lp-footer-btn">Repository ZIP Scan</button>
            <button onClick={() => navigate('/learn')} className="lp-footer-btn">Knowledge Academy</button>
            <button onClick={() => navigate('/history')} className="lp-footer-btn">Audit History</button>
          </div>

          <div className="lp-footer-nav-col">
            <div className="lp-footer-col-title">ECOSYSTEMS</div>
            <span className="lp-footer-item">Node.js (npm & yarn)</span>
            <span className="lp-footer-item">Python (PyPI & pip)</span>
            <span className="lp-footer-item">Java (Maven & Gradle)</span>
            <span className="lp-footer-item">Go (go.mod)</span>
          </div>

          <div className="lp-footer-nav-col">
            <div className="lp-footer-col-title">THREAT INTEL</div>
            <a href="https://osv.dev" target="_blank" rel="noopener noreferrer" className="lp-footer-link">Google OSV.dev <ExternalLink size={11} /></a>
            <a href="https://nvd.nist.gov" target="_blank" rel="noopener noreferrer" className="lp-footer-link">NIST NVD <ExternalLink size={11} /></a>
            <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer" className="lp-footer-link">CISA KEV Catalog <ExternalLink size={11} /></a>
            <a href="https://github.com/OnkarNanaware/MindSpark26" target="_blank" rel="noopener noreferrer" className="lp-footer-link">Project GitHub <ExternalLink size={11} /></a>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} SAGE Security Intelligence. Built for open-source engineering safety.</div>
          <div>Powered by OSV.dev · NVD NIST · GitHub Advisory API</div>
        </div>
      </footer>
    </div>
  )
}

const landingCss = `
.landing-page {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
}

/* Nav */
.lp-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  height: 68px;
  display: flex;
  align-items: center;
  padding: 0 40px;
  border-bottom: 1px solid rgba(26, 41, 66, 0.6);
  background: rgba(7, 11, 20, 0.85);
  transition: all 0.25s ease;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.lp-nav.scrolled {
  background: rgba(7, 11, 20, 0.98);
  border-color: rgba(26, 41, 66, 0.9);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}
[data-theme="light"] .lp-nav {
  background: rgba(255, 255, 255, 0.94) !important;
  border-bottom: 1px solid rgba(203, 213, 225, 0.8) !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .lp-nav.scrolled {
  background: rgba(255, 255, 255, 0.98) !important;
  border-bottom: 1px solid rgba(203, 213, 225, 0.95) !important;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08) !important;
}

.lp-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.lp-logo-img {
  width: 32px;
  height: 38px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(0, 212, 178, 0.45));
}
.lp-logo-text {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 19px;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}
[data-theme="light"] .lp-logo-text {
  color: #0F172A !important;
}
.lp-logo-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.15);
  color: #60A5FA;
  border: 1px solid rgba(59, 130, 246, 0.3);
  letter-spacing: 0.08em;
}
[data-theme="light"] .lp-logo-badge {
  background: rgba(37, 99, 235, 0.1) !important;
  color: #1D4ED8 !important;
  border-color: rgba(37, 99, 235, 0.25) !important;
}

.lp-nav-links {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 36px;
  flex: 1;
}
.lp-nav-link {
  padding: 7px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #94A3B8;
  text-decoration: none;
  border-radius: var(--radius);
  transition: all 0.15s ease;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-ui);
}
.lp-nav-link:hover {
  color: #FFFFFF;
  background: rgba(59, 130, 246, 0.15);
}
[data-theme="light"] .lp-nav-link {
  color: #334155 !important;
  font-weight: 600 !important;
}
[data-theme="light"] .lp-nav-link:hover {
  color: #1D4ED8 !important;
  background: rgba(37, 99, 235, 0.08) !important;
}

.lp-nav-cta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.lp-btn-ghost {
  padding: 8px 16px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
}
.lp-btn-ghost:hover {
  color: var(--text-primary);
  border-color: rgba(59, 130, 246, 0.4);
  background: var(--bg-hover);
}
[data-theme="light"] .lp-btn-ghost {
  color: #0F172A !important;
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
}
[data-theme="light"] .lp-btn-ghost:hover {
  color: #1D4ED8 !important;
  border-color: #3B82F6 !important;
  background: #F8FAFC !important;
}

.lp-btn-primary {
  padding: 9px 20px;
  font-size: 13.5px;
  font-weight: 700;
  color: #FFFFFF !important;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: var(--radius);
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.lp-btn-primary:hover {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  box-shadow: 0 4px 18px rgba(37, 99, 235, 0.5);
  transform: translateY(-1px);
}

/* Theme toggle button inside landing navbar */
.lp-theme-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: #0F1A30;
  cursor: pointer;
  position: relative;
  transition: all 0.25s ease;
  padding: 0;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.15);
}
[data-theme="light"] .lp-theme-toggle {
  background: #DBEAFE !important;
  border: 1px solid #93C5FD !important;
  box-shadow: 0 1px 4px rgba(37, 99, 235, 0.15) !important;
}
.lp-theme-knob {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3B82F6;
  position: absolute;
  top: 2px;
  left: 22px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.25);
}
[data-theme="light"] .lp-theme-knob {
  background: #F59E0B !important;
  left: 3px !important;
}

/* Hero */
.lp-hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 32px 80px;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.lp-hero-bg-glow {
  position: absolute;
  top: -150px;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(0, 212, 178, 0.08) 45%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
.lp-hero-cyber-grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(to right, rgba(26, 41, 66, 0.25) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(26, 41, 66, 0.25) 1px, transparent 1px);
  background-size: 50px 50px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, #000 20%, transparent 80%);
  pointer-events: none;
  z-index: 0;
}
.lp-hero-content {
  position: relative;
  z-index: 1;
  max-width: 1080px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lp-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(13, 21, 39, 0.85);
  border: 1px solid rgba(59, 130, 246, 0.35);
  font-size: 13px;
  font-weight: 600;
  color: #94A3B8;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.lp-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00D4B2;
  box-shadow: 0 0 10px #00D4B2;
}
.lp-badge-live {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.2);
  color: #10B981;
}

.lp-hero-title {
  font-family: var(--font-display);
  font-size: clamp(38px, 5.2vw, 68px);
  font-weight: 800;
  letter-spacing: -1.5px;
  line-height: 1.1;
  color: var(--text-primary);
  margin-bottom: 22px;
}
.text-gradient {
  background: linear-gradient(135deg, #60A5FA 0%, #00D4B2 50%, #38BDF8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lp-hero-sub {
  font-size: clamp(16px, 1.8vw, 19px);
  color: var(--text-secondary);
  max-width: 780px;
  margin: 0 auto 36px;
  line-height: 1.65;
}

.lp-hero-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.lp-btn-hero {
  padding: 14px 30px;
  font-size: 15px;
  font-weight: 700;
  color: #FFFFFF;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: var(--radius);
  box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.lp-btn-hero:hover {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  box-shadow: 0 6px 28px rgba(37, 99, 235, 0.6);
  transform: translateY(-2px);
}
.lp-btn-hero-ghost {
  padding: 14px 26px;
  font-size: 15px;
  font-weight: 600;
  color: #E2E8F0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.lp-btn-hero-ghost:hover {
  color: #FFFFFF;
  border-color: rgba(59, 130, 246, 0.4);
  background: var(--bg-elevated);
}

/* Presets bar */
.lp-presets-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 24px;
}
.lp-presets-label {
  font-size: 13px;
  color: #64748B;
  font-weight: 600;
  font-family: var(--font-mono);
}
.lp-preset-chip {
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: all 0.15s ease;
}
.lp-preset-chip:hover {
  border-color: rgba(59, 130, 246, 0.4);
  color: #FFFFFF;
  background: var(--bg-elevated);
  transform: translateY(-1px);
}
.chip-dot { width: 7px; height: 7px; border-radius: 50%; }
.chip-dot.npm { background: #EF4444; }
.chip-dot.pypi { background: #38BDF8; }
.chip-dot.maven { background: #F59E0B; }

/* Social proof */
.lp-hero-proof {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 50px;
}
.proof-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}
.proof-sep { color: var(--border); }
.proof-link {
  color: #3B82F6;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.proof-link:hover { text-decoration: underline; color: #2563EB; }
.text-accent { color: #00D4B2; }

/* Cockpit Simulator */
.lp-cockpit-wrap {
  width: 100%;
  max-width: 1020px;
  margin-top: 10px;
}
.lp-cockpit-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.2);
  text-align: left;
}
.lp-cockpit-header {
  height: 44px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 18px;
  gap: 14px;
}
.lp-window-dots {
  display: flex;
  gap: 6px;
}
.lp-window-dots .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot.red { background: #F43F5E; }
.dot.yellow { background: #FACC15; }
.dot.green { background: #10B981; }

.lp-cockpit-title {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.pulse-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00D4B2;
  box-shadow: 0 0 8px #00D4B2;
  animation: pulse 1.5s infinite;
}
.lp-cockpit-tag {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  color: #60A5FA;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.lp-cockpit-body {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 0;
}
.lp-tree-sim {
  padding: 28px;
  border-right: 1px solid var(--border);
  background: radial-gradient(circle at 20% 30%, rgba(37, 99, 235, 0.08) 0%, transparent 60%);
}
.lp-tree-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 700;
  color: #00D4B2;
  margin-bottom: 24px;
  letter-spacing: 0.05em;
}

.lp-nodes-canvas {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  padding-left: 10px;
}
.lp-node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  width: fit-content;
  min-width: 260px;
}
.lp-node.node-root { border-color: rgba(59, 130, 246, 0.35); }
.lp-node.node-direct { margin-left: 28px; }
.lp-node.node-trans { margin-left: 56px; }
.lp-node.node-vuln {
  margin-left: 84px;
  background: rgba(244, 63, 94, 0.1);
  border-color: rgba(244, 63, 94, 0.4);
  box-shadow: 0 0 16px rgba(244, 63, 94, 0.2);
}

.node-icon { font-size: 15px; }
.vuln-pulse { animation: pulse 1.2s infinite; }
.node-info { display: flex; flex-direction: column; }
.node-info strong { font-size: 13px; color: var(--text-primary); font-family: var(--font-mono); }
.node-info span { font-size: 11px; color: var(--text-secondary); }
.tag-direct { color: #10B981 !important; font-weight: 700; }
.tag-trans { color: #F59E0B !important; font-weight: 700; }
.tag-vuln { color: #F43F5E !important; font-weight: 700; }
.text-critical { color: #F43F5E; }

.lp-connector {
  width: 2px;
  height: 8px;
  background: var(--border-light);
  margin-left: 36px;
}
.conn-2 { margin-left: 64px; }
.conn-3 { margin-left: 92px; background: rgba(244, 63, 94, 0.5); }

.lp-sim-meta {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}
.kev-pill {
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(244, 63, 94, 0.15);
  color: #F43F5E;
  border: 1px solid rgba(244, 63, 94, 0.3);
  font-size: 10px;
  font-weight: 700;
}

/* Cockpit Stats */
.lp-cockpit-stats {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--bg-panel);
}
.stat-box.risk {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.stat-label {
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}
.stat-val {
  font-family: var(--font-mono);
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}
.stat-val small { font-size: 16px; color: var(--text-muted); font-weight: 500; }
.stat-sub { font-size: 11px; color: var(--text-secondary); font-weight: 500; }

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.stat-mini {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
}
.mini-num { font-family: var(--font-mono); font-size: 20px; font-weight: 800; color: var(--text-primary); }
.mini-lbl { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
.text-high { color: #FB923C; }

.lp-fix-box {
  background: var(--bg-card);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius);
  padding: 14px;
}
.fix-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 10.5px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: #10B981;
}
.fix-copy-btn {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10B981;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.lp-fix-box code {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
}

/* Sections */
.lp-section {
  padding: 90px 32px;
  max-width: 1240px;
  margin: 0 auto;
}
.section-head { margin-bottom: 50px; }
.text-center { text-align: center; }
.lp-section-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #00D4B2;
  margin-bottom: 12px;
  font-family: var(--font-mono);
}
.lp-section-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 3.5vw, 44px);
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--text-primary);
  margin-bottom: 16px;
  line-height: 1.2;
}
.lp-section-sub {
  font-size: 17px;
  color: var(--text-secondary);
  max-width: 640px;
  margin: 0 auto;
  line-height: 1.6;
}
.lp-divider {
  width: 100%;
  max-width: 1240px;
  height: 1px;
  background: var(--border);
  margin: 0 auto;
}

/* Metrics Grid */
.lp-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.lp-metric-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 36px 30px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
}
.lp-metric-card:hover {
  border-color: rgba(59, 130, 246, 0.45);
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
.metric-big {
  font-family: var(--font-display);
  font-size: 54px;
  font-weight: 800;
  letter-spacing: -2px;
  line-height: 1;
  margin-bottom: 16px;
}
.text-cyan { color: #00D4B2; }
.text-blue { color: #3B82F6; }
.text-green { color: #10B981; }
.text-purple { color: #818CF8; }

.metric-title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.metric-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin-bottom: 20px;
}
.metric-foot {
  font-size: 11.5px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

/* Features Grid */
.lp-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.lp-feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 32px 28px;
  transition: all 0.25s ease;
}
.lp-feature-card:hover {
  border-color: rgba(59, 130, 246, 0.4);
  background: var(--bg-elevated);
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
}
.lp-feat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.lp-feat-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
}
.lp-feat-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.65;
}

/* Steps Row */
.lp-steps-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
.lp-step-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 30px 24px;
  position: relative;
  transition: all 0.2s ease;
}
.lp-step-card:hover {
  border-color: rgba(0, 212, 178, 0.4);
}
.lp-step-num {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 800;
  color: #00D4B2;
  margin-bottom: 16px;
}
.lp-step-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.lp-step-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* CTA Wrapper */
.lp-cta-wrapper {
  max-width: 1240px;
  margin: 30px auto 90px;
  padding: 0 32px;
}
.lp-cta-box {
  background: linear-gradient(135deg, #0D172B 0%, #101F3B 100%);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 24px;
  padding: 56px 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.lp-cta-glow {
  position: absolute;
  top: -100px;
  right: -50px;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 212, 178, 0.2) 0%, transparent 70%);
  pointer-events: none;
}
.lp-cta-left { max-width: 600px; }
.lp-cta-headline {
  font-family: var(--font-display);
  font-size: clamp(28px, 3.2vw, 40px);
  font-weight: 800;
  color: #FFFFFF;
  line-height: 1.2;
  margin-bottom: 12px;
}
.lp-cta-subhead {
  font-size: 16px;
  color: #94A3B8;
  line-height: 1.6;
}
.lp-cta-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

/* Footer */
.lp-footer {
  border-top: 1px solid var(--border);
  background: var(--bg-panel);
  padding: 60px 40px 30px;
}
.lp-footer-top {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 48px;
  margin-bottom: 50px;
}
.lp-footer-brand { max-width: 320px; }
.lp-footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 14px;
}
.lp-footer-desc {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.65;
}
.lp-footer-col-title {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #60A5FA;
  margin-bottom: 16px;
  font-family: var(--font-mono);
}
.lp-footer-nav-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lp-footer-btn, .lp-footer-link, .lp-footer-item {
  font-size: 13.5px;
  color: var(--text-secondary);
  background: none;
  border: none;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: color 0.15s ease;
}
.lp-footer-btn:hover, .lp-footer-link:hover { color: #FFFFFF; }
.lp-footer-item { cursor: default; color: var(--text-muted); }

.lp-footer-bottom {
  max-width: 1240px;
  margin: 0 auto;
  border-top: 1px solid var(--border);
  padding-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
  gap: 12px;
}

/* Animations & Mobile */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
.reveal-delay-4 { transition-delay: 0.4s; }

.lp-hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  cursor: pointer;
  border-radius: 8px;
  padding: 6px;
  margin-left: auto;
}
.lp-hamburger span {
  display: block;
  width: 18px;
  height: 2px;
  background: #FFFFFF;
  border-radius: 2px;
  transition: all 0.25s ease;
}

.lp-mobile-menu {
  position: fixed;
  top: 68px;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-bottom: 2px solid var(--border);
  padding: 16px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
  z-index: 210;
}
.lp-mobile-link {
  display: block;
  padding: 12px 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 8px;
  transition: background 0.15s;
}
.lp-mobile-link:hover { background: var(--bg-elevated); }
.lp-mobile-cta {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  color: #FFFFFF;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.lp-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 205;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

/* ═══════════════════════════════════════════════════════════════
   LIGHT MODE OVERRIDES FOR LANDING PAGE
   Ensures crystal-clear contrast and crisp text on white theme
   ═══════════════════════════════════════════════════════════════ */
[data-theme="light"] .lp-hero-badge {
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  color: #334155 !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05) !important;
}
[data-theme="light"] .lp-badge-live {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #059669 !important;
}
[data-theme="light"] .lp-hero-sub {
  color: #475569 !important;
}
[data-theme="light"] .lp-btn-hero-ghost {
  color: #0F172A !important;
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .lp-btn-hero-ghost:hover {
  background: #F1F5F9 !important;
  border-color: #3B82F6 !important;
  color: #2563EB !important;
}
[data-theme="light"] .lp-preset-chip {
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  color: #334155 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .lp-preset-chip:hover {
  background: #F1F5F9 !important;
  border-color: #3B82F6 !important;
  color: #2563EB !important;
}
[data-theme="light"] .lp-presets-label {
  color: #334155 !important;
}
[data-theme="light"] .proof-item {
  color: #334155 !important;
  font-weight: 600 !important;
}
[data-theme="light"] .proof-sep {
  color: #CBD5E1 !important;
}
[data-theme="light"] .proof-link {
  color: #2563EB !important;
  font-weight: 600 !important;
}

/* Cockpit Simulator in light mode */
[data-theme="light"] .lp-cockpit-card {
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(59, 130, 246, 0.15) !important;
}
[data-theme="light"] .lp-cockpit-header {
  background: #F8FAFC !important;
  border-bottom: 1px solid #E2E8F0 !important;
}
[data-theme="light"] .lp-cockpit-title {
  color: #334155 !important;
  font-weight: 600 !important;
}
[data-theme="light"] .lp-cockpit-tag {
  background: rgba(37, 99, 235, 0.1) !important;
  color: #1D4ED8 !important;
  border: 1px solid rgba(37, 99, 235, 0.25) !important;
}
[data-theme="light"] .lp-tree-sim {
  background: radial-gradient(circle at 20% 30%, rgba(37, 99, 235, 0.04) 0%, transparent 60%) !important;
  border-right: 1px solid #E2E8F0 !important;
}
[data-theme="light"] .lp-tree-badge {
  color: #0D9488 !important;
  font-weight: 800 !important;
}
[data-theme="light"] .lp-node {
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .lp-node.node-root {
  border-color: #3B82F6 !important;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.15) !important;
}
[data-theme="light"] .lp-node.node-vuln {
  background: #FFF1F2 !important;
  border-color: #FDA4AF !important;
  box-shadow: 0 0 16px rgba(244, 63, 94, 0.15) !important;
}
[data-theme="light"] .node-info strong {
  color: #0F172A !important;
  font-weight: 700 !important;
}
[data-theme="light"] .node-info span {
  color: #475569 !important;
  font-weight: 500 !important;
}
[data-theme="light"] .node-info strong.text-critical {
  color: #DC2626 !important;
  font-weight: 800 !important;
}
[data-theme="light"] .lp-connector {
  background: #CBD5E1 !important;
}
[data-theme="light"] .conn-3 {
  background: #F43F5E !important;
}
[data-theme="light"] .lp-sim-meta {
  color: #334155 !important;
  font-weight: 600 !important;
}
[data-theme="light"] .lp-sim-meta code {
  background: #F1F5F9 !important;
  color: #0F172A !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  border: 1px solid #CBD5E1 !important;
}
[data-theme="light"] .kev-pill {
  background: #FFF1F2 !important;
  color: #DC2626 !important;
  border: 1px solid #FECDD3 !important;
}

/* Cockpit Stats right column in light mode */
[data-theme="light"] .lp-cockpit-stats {
  background: #F8FAFC !important;
  border-left: 1px solid #E2E8F0 !important;
}
[data-theme="light"] .stat-box.risk {
  background: #FFFFFF !important;
  border-color: #CBD5E1 !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .stat-label {
  color: #475569 !important;
}
[data-theme="light"] .stat-sub {
  color: #334155 !important;
  font-weight: 600 !important;
}
[data-theme="light"] .stat-mini {
  background: #FFFFFF !important;
  border-color: #CBD5E1 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
}
[data-theme="light"] .mini-lbl {
  color: #475569 !important;
}
[data-theme="light"] .mini-num {
  color: #0F172A !important;
}
[data-theme="light"] .lp-fix-box {
  background: #FFFFFF !important;
  border: 1px solid #6EE7B7 !important;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.08) !important;
}
[data-theme="light"] .fix-header {
  color: #059669 !important;
  font-weight: 700 !important;
}
[data-theme="light"] .fix-copy-btn {
  background: #ECFDF5 !important;
  color: #059669 !important;
  border: 1px solid #A7F3D0 !important;
}
[data-theme="light"] .lp-fix-box code {
  color: #0F172A !important;
  background: #F8FAFC !important;
}

/* Landing sections in light mode */
[data-theme="light"] .lp-section-badge {
  background: rgba(37, 99, 235, 0.08) !important;
  color: #1D4ED8 !important;
  border: 1px solid rgba(37, 99, 235, 0.2) !important;
  padding: 4px 10px !important;
  border-radius: 4px !important;
}
[data-theme="light"] .lp-section-title {
  color: #0F172A !important;
}
[data-theme="light"] .lp-section-sub {
  color: #475569 !important;
}
[data-theme="light"] .lp-metric-card,
[data-theme="light"] .lp-feature-card,
[data-theme="light"] .lp-step-card {
  background: #FFFFFF !important;
  border: 1px solid #CBD5E1 !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
}
[data-theme="light"] .metric-title,
[data-theme="light"] .lp-feat-title,
[data-theme="light"] .lp-step-title {
  color: #0F172A !important;
}
[data-theme="light"] .metric-desc,
[data-theme="light"] .lp-feat-text,
[data-theme="light"] .lp-step-desc {
  color: #475569 !important;
}
[data-theme="light"] .metric-foot {
  color: #64748B !important;
  border-top-color: #E2E8F0 !important;
}
[data-theme="light"] .lp-footer {
  background: #F8FAFC !important;
  border-top-color: #CBD5E1 !important;
}
[data-theme="light"] .lp-footer-logo {
  color: #0F172A !important;
}
[data-theme="light"] .lp-footer-desc {
  color: #475569 !important;
}
[data-theme="light"] .lp-footer-col-title {
  color: #1D4ED8 !important;
}
[data-theme="light"] .lp-footer-btn,
[data-theme="light"] .lp-footer-link {
  color: #475569 !important;
}
[data-theme="light"] .lp-footer-btn:hover,
[data-theme="light"] .lp-footer-link:hover {
  color: #1D4ED8 !important;
}
[data-theme="light"] .lp-footer-bottom {
  border-top-color: #E2E8F0 !important;
  color: #64748B !important;
}

/* Mobile drawer in light mode */
[data-theme="light"] .lp-hamburger {
  background: #FFFFFF !important;
  border-color: #CBD5E1 !important;
}
[data-theme="light"] .lp-hamburger span {
  background: #0F172A !important;
}
[data-theme="light"] .lp-mobile-menu {
  background: #FFFFFF !important;
  border-color: #CBD5E1 !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15) !important;
}
[data-theme="light"] .lp-mobile-link {
  color: #0F172A !important;
}
[data-theme="light"] .lp-mobile-link:hover {
  background: #F1F5F9 !important;
  color: #1D4ED8 !important;
}

@media(max-width: 960px) {
  .lp-nav { padding: 0 20px; }
  .lp-nav-links, .lp-nav-cta { display: none !important; }
  .lp-hamburger { display: flex !important; }
  .lp-cockpit-body { grid-template-columns: 1fr; }
  .lp-tree-sim { border-right: none; border-bottom: 1px solid var(--border); }
  .lp-metrics-grid, .lp-features-grid, .lp-steps-row { grid-template-columns: 1fr; }
  .lp-cta-box { flex-direction: column; align-items: flex-start; padding: 36px 24px; }
  .lp-footer-top { grid-template-columns: 1fr; gap: 32px; }
  .lp-node.node-direct, .lp-node.node-trans, .lp-node.node-vuln { margin-left: 0; }
  .lp-connector { display: none; }
}
`
