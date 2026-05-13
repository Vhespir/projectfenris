import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const THREAT_OPTIONS = [
  'Tornado', 'Hurricane', 'Earthquake', 'Wildfire', 'Flood',
  'Winter Storm', 'Drought', 'Civil Unrest', 'Power Grid Failure',
  'Supply Chain Disruption', 'Pandemic', 'Chemical/Hazmat',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export default function Settings() {
  const { user, token, login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    region_state: '',
    region_county: '',
    threat_profile: [] as string[],
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setForm({
          region_state: data.region_state ?? '',
          region_county: data.region_county ?? '',
          threat_profile: data.threat_profile ?? [],
        })
      })
  }, [])

  function toggleThreat(t: string) {
    setForm(f => ({
      ...f,
      threat_profile: f.threat_profile.includes(t)
        ? f.threat_profile.filter(x => x !== t)
        : [...f.threat_profile, t],
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          region_state: form.region_state || null,
          region_county: form.region_county || null,
          threat_profile: form.threat_profile,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      login(token!, { ...user!, ...data })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '6px', boxSizing: 'border-box' as const,
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)',
    color: 'var(--color-muted)', marginBottom: '5px',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  }
  const sectionStyle = {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: '8px', padding: '24px', marginBottom: '16px',
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>
        Edit Profile
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Identity
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Username</label>
            <div style={{ ...inputStyle, color: 'var(--color-muted)', cursor: 'not-allowed' }}>
              {user?.username}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
            Username cannot be changed.
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Region
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>State</label>
              <select value={form.region_state} onChange={e => setForm(f => ({ ...f, region_state: e.target.value }))} style={inputStyle}>
                <option value="">Select state...</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>County / Area</label>
              <input
                value={form.region_county}
                onChange={e => setForm(f => ({ ...f, region_county: e.target.value }))}
                placeholder="e.g. Travis County"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Threat Profile
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
            Select the threats most relevant to your area.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {THREAT_OPTIONS.map(t => {
              const active = form.threat_profile.includes(t)
              return (
                <button
                  key={t} type="button" onClick={() => toggleThreat(t)}
                  style={{
                    padding: '5px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
                    fontFamily: 'var(--font-display)', transition: 'all 0.15s',
                    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          padding: '11px', borderRadius: '6px', fontFamily: 'var(--font-display)',
          fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          background: saved ? 'rgba(34,197,94,0.2)' : saving ? 'var(--color-border)' : 'var(--color-accent)',
          color: saved ? 'var(--color-accent)' : saving ? 'var(--color-muted)' : '#0A0A0A',
          border: saved ? '1px solid var(--color-accent)' : 'none',
          transition: 'all 0.2s',
        }}>
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
