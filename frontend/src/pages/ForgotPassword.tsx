import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '6px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box' as const,
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSent(true)
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
            Reset Password
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
            Enter your email and we'll send a reset link.
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '20px 24px', borderRadius: '8px', textAlign: 'center',
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '8px' }}>
              Check your inbox
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
              If <strong style={{ color: 'var(--color-text)' }}>{email}</strong> is registered, a reset link is on its way. Check your spam folder if it doesn't arrive within a few minutes.
            </p>
            <Link to="/login" style={{ display: 'inline-block', marginTop: '20px', fontSize: '13px', color: 'var(--color-accent)' }}>
              Back to sign in
            </Link>
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
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'var(--color-border)' : 'var(--color-accent)',
                color: loading ? 'var(--color-muted)' : '#0A0A0A',
                border: 'none', transition: 'background 0.15s',
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
              <Link to="/login" style={{ color: 'var(--color-muted)', textDecoration: 'underline' }}>
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
