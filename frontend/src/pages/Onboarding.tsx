import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const THREAT_OPTIONS = [
  'Tornado', 'Hurricane', 'Earthquake', 'Wildfire', 'Flood',
  'Winter Storm', 'Drought', 'Civil Unrest', 'Power Grid Failure',
  'Supply Chain Disruption', 'Pandemic', 'Chemical/Hazmat',
]

const PREP_LEVELS = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Getting started with the basics' },
  { value: 'intermediate', label: 'Intermediate',  desc: 'Solid foundation, building out' },
  { value: 'advanced',     label: 'Advanced',      desc: 'Comprehensive systems in place' },
  { value: 'expert',       label: 'Expert',        desc: 'Long-term self-sufficient' },
]

const TOTAL_STEPS = 3

export default function Onboarding() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [regionState, setRegionState] = useState('')
  const [regionCounty, setRegionCounty] = useState('')
  const [threats, setThreats] = useState<string[]>([])
  const [prepLevel, setPrepLevel] = useState('')

  if (!user) { navigate('/login'); return null }

  function toggleThreat(t: string) {
    setThreats(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region_state:   regionState || null,
          region_county:  regionCounty || null,
          threat_profile: threats,
          prep_level:     prepLevel || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        login({ ...user, ...data })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleFinish() {
    await save()
    navigate('/feed')
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '6px', boxSizing: 'border-box' as const,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
  }
  const chipActive = (active: boolean) => ({
    padding: '7px 14px', borderRadius: '5px', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'var(--font-display)', fontWeight: 500, transition: 'all 0.15s',
    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
  })

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i < step ? 'var(--color-accent)' : 'var(--color-border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Step 1: Region */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
              Step 1 of {TOTAL_STEPS}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '22px' : '26px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
              Where are you based?
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
              This surfaces local events and community reports relevant to your area. You can change this any time in settings.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  State
                </label>
                <select value={regionState} onChange={e => setRegionState(e.target.value)} style={inputStyle}>
                  <option value="">Select state...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  County / Area
                </label>
                <input
                  value={regionCounty}
                  onChange={e => setRegionCounty(e.target.value)}
                  placeholder="e.g. Travis County"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={{
                flex: 1, padding: '12px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                background: 'var(--color-accent)', color: '#0A0A0A', border: 'none',
              }}>
                Continue
              </button>
              <button onClick={() => setStep(2)} style={{
                padding: '12px 20px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer',
                background: 'transparent', color: 'var(--color-subtle)', border: '1px solid var(--color-border)',
              }}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Threat profile */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
              Step 2 of {TOTAL_STEPS}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '22px' : '26px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
              What threats are most relevant to you?
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              Select all that apply. The feed and alerts will prioritize these event types.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
              {THREAT_OPTIONS.map(t => (
                <button key={t} type="button" onClick={() => toggleThreat(t)} style={{
                  ...chipActive(threats.includes(t)),
                  borderColor: threats.includes(t) ? 'var(--color-danger)' : 'var(--color-border)',
                  background: threats.includes(t) ? 'rgba(239,68,68,0.08)' : 'transparent',
                  color: threats.includes(t) ? 'var(--color-danger)' : 'var(--color-muted)',
                }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={{
                padding: '12px 20px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer',
                background: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)',
              }}>
                Back
              </button>
              <button onClick={() => setStep(3)} style={{
                flex: 1, padding: '12px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                background: 'var(--color-accent)', color: '#0A0A0A', border: 'none',
              }}>
                Continue
              </button>
              <button onClick={() => setStep(3)} style={{
                padding: '12px 20px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer',
                background: 'transparent', color: 'var(--color-subtle)', border: '1px solid var(--color-border)',
              }}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Prep level + finish */}
        {step === 3 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
              Step 3 of {TOTAL_STEPS}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '22px' : '26px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
              Where are you in your prep journey?
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              This helps surface the right content and community resources for your level.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
              {PREP_LEVELS.map(pl => (
                <button key={pl.value} type="button" onClick={() => setPrepLevel(pl.value)} style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', transition: 'all 0.15s',
                  background: prepLevel === pl.value ? 'rgba(34,197,94,0.08)' : 'var(--color-surface)',
                  border: `1px solid ${prepLevel === pl.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: prepLevel === pl.value ? 'var(--color-accent)' : 'var(--color-text)', marginBottom: '2px' }}>
                    {pl.label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-body)' }}>
                    {pl.desc}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(2)} style={{
                padding: '12px 20px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer',
                background: 'transparent', color: 'var(--color-muted)', border: '1px solid var(--color-border)',
              }}>
                Back
              </button>
              <button onClick={handleFinish} disabled={saving} style={{
                flex: 1, padding: '12px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? 'var(--color-border)' : 'var(--color-accent)',
                color: saving ? 'var(--color-muted)' : '#0A0A0A', border: 'none',
              }}>
                {saving ? 'Saving...' : 'Go to Feed'}
              </button>
            </div>
          </div>
        )}

        {/* Skip all */}
        {step < 3 && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => navigate('/feed')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)',
            }}>
              Skip setup, go to Feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
