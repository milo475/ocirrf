import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearTokens, restoreSession, setTokens } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Эхлэхэд refreshToken-оор session сэргээх оролдлого
  useEffect(() => {
    let alive = true
    restoreSession()
      .then((data) => {
        if (alive && data) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })

    // api.js 401-ийн дараа refresh бүтэхгүй үед энэ event-ийг гаргадаг
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => {
      alive = false
      window.removeEventListener('auth:logout', onLogout)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setTokens(data)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth-ыг AuthProvider дотор л хэрэглэнэ')
  return ctx
}
