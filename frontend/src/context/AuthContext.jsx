import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearTokens, restoreSession, serverLogout, setTokens } from '../lib/api'

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
    // Сервер талд refresh token-ыг revoke хийнэ (V4-08) — хариуг хүлээхгүй
    void serverLogout()
    clearTokens()
    setUser(null)
  }, [])

  /** Нууц үг сольсны дараах шинэ token+user-ийг хэрэглэнэ (V4-06) */
  const applyAuth = useCallback((data) => {
    setTokens(data)
    setUser(data.user)
  }, [])

  /**
   * Профайл сольсны дараа context-ийг шинэчилнэ — эс тэгвэл дахин
   * нэвтрэх хүртэл цэсэнд хуучин нэр харагдана.
   */
  const patchUser = useCallback((fields) => {
    setUser((u) => (u ? { ...u, ...fields } : u))
  }, [])

  // Effective permission шалгалт — backend login/refresh/me-гээс ирдэг массив.
  // ADMIN-д бүх түлхүүр ирдэг тул includes() хангалттай.
  const hasPerm = useCallback(
    (key) => !!user?.permissions?.includes(key),
    [user],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPerm,
        applyAuth,
        patchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth-ыг AuthProvider дотор л хэрэглэнэ')
  return ctx
}
