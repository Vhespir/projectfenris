import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  username: string
  email: string
  reputation: number
  is_trusted: boolean
  region_state: string | null
  region_county: string | null
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('fenris_token')
    if (!stored) { setLoading(false); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) { setUser(u); setToken(stored) }
        else localStorage.removeItem('fenris_token')
      })
      .catch(() => localStorage.removeItem('fenris_token'))
      .finally(() => setLoading(false))
  }, [])

  function login(t: string, u: User) {
    setToken(t)
    setUser(u)
    localStorage.setItem('fenris_token', t)
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('fenris_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
