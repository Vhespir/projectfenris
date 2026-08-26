import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface User {
  id: number
  username: string
  email: string
  reputation: number
  is_trusted: boolean
  is_moderator: boolean
  muted_until?: string | null
  region_state: string | null
  region_county: string | null
  avatar_url: string | null
  user_lat: number | null
  user_lon: number | null
  is_founding_member?: boolean
  preferences?: Record<string, unknown>
}

interface AuthContextValue {
  user: User | null
  login: (user: User) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function login(u: User) {
    setUser(u)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'DELETE', credentials: 'same-origin' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
