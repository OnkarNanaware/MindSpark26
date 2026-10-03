import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wraps any route that requires authentication.
 * Redirects unauthenticated users to /login, preserving the intended path.
 * Shows a minimal loading state while the token is being validated.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border)',
          borderTopColor: '#00D4B2',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          Verifying session…
        </span>
      </div>
    )
  }

  if (!user) {
    // Pass the original destination so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
