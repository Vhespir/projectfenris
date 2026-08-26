import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const REQUIREMENTS = [
  { label: '8+ characters',          test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',        test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',        test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',                  test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character',       test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function strengthScore(pwd: string) {
  return REQUIREMENTS.filter(r => r.test(pwd)).length
}

const STRENGTH_LABEL = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#EF4444', '#EF4444', '#F59E0B', '#22C55E', '#22C55E']

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '6px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box' as const,
}

export default function Register() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pwdFocused, setPwdFocused] = useState(false)

  const score = strengthScore(form.password)
  const allMet = score === REQUIREMENTS.length

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      login(data.user)
      navigate('/onboarding')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Join Project Fenris
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
            Stay informed. Stay ready.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <input
              type="text"
              placeholder="wolfpack42"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--color-accent)'; setPwdFocused(true) }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; setPwdFocused(false) }}
            />

            {/* Strength bar */}
            {form.password.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  {REQUIREMENTS.map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: '3px', borderRadius: '2px',
                      background: i < score ? STRENGTH_COLOR[score] : 'var(--color-border)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: STRENGTH_COLOR[score], textAlign: 'right' }}>
                  {STRENGTH_LABEL[score]}
                </div>
              </div>
            )}

            {/* Requirements checklist */}
            {(pwdFocused || (form.password.length > 0 && !allMet)) && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {REQUIREMENTS.map(req => {
                  const met = req.test(form.password)
                  return (
                    <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: met ? 'var(--color-accent)' : 'var(--color-subtle)' }}>
                      <span>{met ? '✓' : '○'}</span>
                      <span>{req.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !allMet}
            style={{
              padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-display)',
              fontSize: '14px', fontWeight: 600,
              cursor: loading || !allMet ? 'not-allowed' : 'pointer',
              background: loading || !allMet ? 'var(--color-border)' : 'var(--color-accent)',
              color: loading || !allMet ? 'var(--color-muted)' : '#0A0A0A',
              border: 'none', transition: 'background 0.15s', marginTop: '4px',
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--color-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
