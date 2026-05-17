import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '6px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box' as const,
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      if (data.requires_2fa) {
        setStep('totp')
        return
      }
      login(data.user)
      navigate('/map')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp_code: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      login(data.user)
      navigate('/map')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {step === 'credentials' ? (
          <>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                Sign In
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Welcome back.</p>
            </div>

            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                  {error}
                </div>
              )}

              {[
                { key: 'email',    label: 'Email',    type: 'email',    placeholder: 'you@example.com' },
                { key: 'password', label: 'Password', type: 'password', placeholder: 'Your password' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    required
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                  fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? 'var(--color-border)' : 'var(--color-accent)',
                  color: loading ? 'var(--color-muted)' : '#0A0A0A',
                  border: 'none', transition: 'background 0.15s', marginTop: '4px',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--color-muted)' }}>
              <Link to="/forgot-password" style={{ color: 'var(--color-muted)', textDecoration: 'underline' }}>
                Forgot your password?
              </Link>
            </p>
            <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px', color: 'var(--color-muted)' }}>
              No account?{' '}
              <Link to="/register" style={{ color: 'var(--color-accent)' }}>Join Project Fenris</Link>
            </p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: 'var(--color-accent)' }}>2FA</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                Authentication Required
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            <form onSubmit={handleTotp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  autoComplete="one-time-code"
                  required
                  style={{
                    ...inputStyle,
                    fontSize: '24px',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                style={{
                  padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                  fontSize: '14px', fontWeight: 600,
                  cursor: loading || totpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  background: loading || totpCode.length !== 6 ? 'var(--color-border)' : 'var(--color-accent)',
                  color: loading || totpCode.length !== 6 ? 'var(--color-muted)' : '#0A0A0A',
                  border: 'none', transition: 'background 0.15s',
                }}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--color-muted)' }}>
              <button
                onClick={() => { setStep('credentials'); setError(null); setTotpCode('') }}
                style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-body)', textDecoration: 'underline' }}
              >
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
