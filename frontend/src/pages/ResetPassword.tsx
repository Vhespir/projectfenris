import { useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '6px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box' as const,
}

const PWD_REQUIREMENTS = [
  { label: '8+ characters',     test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',  test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',            test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

const STRENGTH_COLOR = ['', '#EF4444', '#EF4444', '#F59E0B', '#22C55E', '#22C55E']
const STRENGTH_LABEL = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong']

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pwdScore = PWD_REQUIREMENTS.filter(r => r.test(password)).length
  const mismatch = confirm.length > 0 && confirm !== password

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-muted)', marginBottom: '16px' }}>Invalid reset link.</p>
          <Link to="/forgot-password" style={{ color: 'var(--color-accent)' }}>Request a new one</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            New Password
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
            Choose a strong password for your account.
          </p>
        </div>

        {done ? (
          <div style={{
            padding: '20px 24px', borderRadius: '8px', textAlign: 'center',
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '8px' }}>
              Password updated
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
              Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
              {password.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {PWD_REQUIREMENTS.map((_, i) => (
                      <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i < pwdScore ? STRENGTH_COLOR[pwdScore] : 'var(--color-border)', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: STRENGTH_COLOR[pwdScore] }}>
                    {STRENGTH_LABEL[pwdScore]}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={{ ...inputStyle, borderColor: mismatch ? 'var(--color-danger)' : undefined }}
                onFocus={e => (e.target.style.borderColor = mismatch ? 'var(--color-danger)' : 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor = mismatch ? 'var(--color-danger)' : 'var(--color-border)')}
              />
            </div>

            <button
              type="submit"
              disabled={loading || pwdScore < 5 || mismatch}
              style={{
                padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '14px', fontWeight: 600,
                cursor: loading || pwdScore < 5 || mismatch ? 'not-allowed' : 'pointer',
                background: loading || pwdScore < 5 || mismatch ? 'var(--color-border)' : 'var(--color-accent)',
                color: loading || pwdScore < 5 || mismatch ? 'var(--color-muted)' : '#0A0A0A',
                border: 'none', transition: 'background 0.15s',
              }}
            >
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
