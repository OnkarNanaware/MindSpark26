import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]           = useState('login') // 'login' | 'register'
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail]         = useState('')
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const switchMode = (m) => {
    setMode(m); setError('')
    setIdentifier(''); setEmail(''); setUsername('')
    setPassword(''); setConfirm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (password !== confirm) { setError('Passwords do not match.'); return }
      if (password.length < 6)  { setError('Password must be at least 6 characters.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(identifier, password)
      } else {
        await register(username, email, password)
      }
      navigate('/scan')
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background glows */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,178,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 500, height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'float 10s ease-in-out infinite reverse',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        position: 'relative',
        zIndex: 1,
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <img src="/logo.png" alt="SAGE" style={{
            width: 36, height: 40, objectFit: 'contain',
            filter: 'drop-shadow(0 0 12px rgba(0,212,178,0.6))',
          }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800, fontSize: 20,
              color: 'var(--text)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              SAGE
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59,130,246,0.15)', color: '#60A5FA',
                border: '1px solid rgba(59,130,246,0.3)',
              }}>CYBER</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              Dependency Vulnerability Scanner
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 3,
          marginBottom: 28,
          gap: 3,
        }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: 13,
              transition: 'all 0.18s',
              background: mode === m
                ? 'linear-gradient(135deg, rgba(0,212,178,0.15), rgba(59,130,246,0.15))'
                : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: mode === m ? '0 1px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
            }}>
              {m === 'login' ? '🔐 Sign In' : '✨ Create Account'}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text)',
            background: 'linear-gradient(135deg, #00D4B2, #60A5FA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'login'
              ? 'Sign in to access SAGE vulnerability scanning.'
              : 'Start securing your dependencies in minutes.'}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(244,63,94,0.1)',
            border: '1px solid rgba(244,63,94,0.25)',
            color: 'var(--critical)',
            fontSize: 13,
            marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {mode === 'register' && (
            <Field
              id="auth-username"
              label="Username"
              placeholder="johnsmith"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              icon="👤"
            />
          )}

          {mode === 'login' ? (
            <Field
              id="auth-identifier"
              label="Username or Email"
              placeholder="johnsmith or john@example.com"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              icon="👤"
            />
          ) : (
            <Field
              id="auth-email"
              label="Email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              icon="✉️"
            />
          )}

          {/* Password */}
          <div>
            <label htmlFor="auth-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, userSelect: 'none' }}>🔑</span>
              <input
                id="auth-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                style={inputStyle(true)}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 13, padding: '4px 6px',
              }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <Field
              id="auth-confirm"
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              icon="🔒"
            />
          )}

          {/* Submit */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading
                ? 'rgba(0,212,178,0.3)'
                : 'linear-gradient(135deg, #00D4B2, #0EA5E9)',
              color: '#fff',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(0,212,178,0.3)',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading
              ? <><Spinner /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? '→ Sign In' : '→ Create Account'}
          </button>
        </form>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24, marginBottom: 0 }}>
          {mode === 'login'
            ? <>Don't have an account? <button onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', color: '#00D4B2', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Create one</button></>
            : <>Already have an account? <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#00D4B2', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Sign in</button></>
          }
        </p>
      </div>
    </div>
  )
}

function Field({ id, label, type = 'text', placeholder, value, onChange, autoComplete, icon }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, userSelect: 'none' }}>{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={inputStyle(true)}
        />
      </div>
    </div>
  )
}

function inputStyle() {
  return {
    width: '100%',
    padding: '10px 12px 10px 38px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  }
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
