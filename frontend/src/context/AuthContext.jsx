import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import API_BASE from '../config'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sage_token'

// ── Guard against HMR duplicate interceptors ──────────────────────────────────
// We store the interceptor ID on the axios object itself so Vite hot-reloads
// don't stack multiple copies of the same interceptor.
if (axios.__sageAuthInterceptorId === undefined) {
  axios.__sageAuthInterceptorId = axios.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      // Must assign a NEW headers object — some axios versions share a reference
      config.headers = Object.assign({}, config.headers, {
        Authorization: `Bearer ${token}`,
      })
    }
    return config
  })
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Validate stored token on mount (only once)
  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await axios.get(`${API_BASE}/api/auth/me`)
        setUser(res.data.user)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [])

  const login = useCallback(async (identifier, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      username: identifier,
      password,
    })
    const { token, user: u } = res.data
    localStorage.setItem(TOKEN_KEY, token)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (username, email, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/register`, {
      username,
      email,
      password,
    })
    const { token, user: u } = res.data
    localStorage.setItem(TOKEN_KEY, token)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
