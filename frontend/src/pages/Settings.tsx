import { useState, useEffect, type FormEvent, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../utils/push'

const THREAT_OPTIONS = [
  'Tornado', 'Hurricane', 'Earthquake', 'Wildfire', 'Flood',
  'Winter Storm', 'Drought', 'Civil Unrest', 'Power Grid Failure',
  'Supply Chain Disruption', 'Pandemic', 'Chemical/Hazmat',
]

const FOCUS_OPTIONS = [
  'Water Storage', 'Food Storage', 'Medical and First Aid', 'Communications',
  'Power and Energy', 'Security and Defense', 'Evacuation Planning',
  'Shelter and Housing', 'Financial Preparedness', 'Vehicle and Transport',
  'Homesteading', 'Off Grid Living', 'Ham Radio', 'Community Organizing',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const SHOWCASE_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'edc',        label: 'Every Day Carry',      placeholder: 'What you carry daily -- tools, comms, medical...' },
  { key: 'bob',        label: 'Bug Out Bag',           placeholder: 'Your 72-hour kit contents and setup...' },
  { key: 'vehicle',    label: 'Vehicle Kit',           placeholder: 'What you keep in your vehicle...' },
  { key: 'food_water', label: 'Food and Water',        placeholder: 'Storage capacity, methods, rotation system...' },
  { key: 'power',      label: 'Power and Energy',      placeholder: 'Solar, generator, batteries, backup...' },
  { key: 'comms',      label: 'Communications',        placeholder: 'Radios, licenses, mesh network, backup comms...' },
  { key: 'medical',    label: 'Medical Supplies',      placeholder: 'IFAK, trauma kit, medications, certifications...' },
  { key: 'skills',     label: 'Skills and Certs',      placeholder: 'First aid, ham radio, wilderness survival, trades...' },
]

const ALERT_CATEGORIES = [
  { id: 'severe_weather', label: 'Severe Weather',  desc: 'tornado, hurricane, high wind, severe thunderstorm' },
  { id: 'flooding',       label: 'Flooding',         desc: 'flash flood, river flood, coastal flood' },
  { id: 'earthquake',     label: 'Earthquakes',      desc: 'all seismic activity' },
  { id: 'wildfire',       label: 'Wildfire',         desc: 'fire weather, red flag warnings' },
  { id: 'winter_storm',   label: 'Winter Storms',    desc: 'blizzard, ice storm, winter weather' },
  { id: 'air_quality',    label: 'Air Quality',      desc: 'smoke, ozone, particulate alerts' },
  { id: 'tsunami',        label: 'Tsunami',          desc: 'coastal and tsunami warnings' },
  { id: 'other',          label: 'Other',            desc: 'any other high-severity event type' },
]

const ALL_CATEGORY_IDS = ALERT_CATEGORIES.map(c => c.id)

const SEVERITY_OPTIONS = [
  { value: 'extreme',  label: 'Extreme only',              desc: 'Life-threatening events only' },
  { value: 'severe',   label: 'Severe and above',          desc: 'Serious threat to life or property' },
  { value: 'moderate', label: 'Moderate and above',        desc: 'Significant impact expected' },
  { value: 'minor',    label: 'All alerts',                desc: 'Every alert regardless of severity' },
]

const PWD_REQUIREMENTS = [
  { label: '8+ characters',      test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter',   test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter',   test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',             test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

const STRENGTH_COLOR = ['', '#EF4444', '#EF4444', '#F59E0B', '#22C55E', '#22C55E']
const STRENGTH_LABEL = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong']

export default function Settings() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [form, setForm] = useState({
    region_state: '',
    region_county: '',
    threat_profile: [] as string[],
    bio: '',
    prep_level: '',
    focus_areas: [] as string[],
    years_prepping: '' as string | number,
    living_situation: '',
    showcase: {} as Record<string, string>,
  })
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    push: false,
    severity: 'severe',
    categories: ALL_CATEGORY_IDS,
    radius_km: 150,
  })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // 2FA state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [twoFaMode, setTwoFaMode] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [twoFaSetup, setTwoFaSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaError, setTwoFaError] = useState<string | null>(null)
  const [twoFaLoading, setTwoFaLoading] = useState(false)

  // Change password state
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        setForm({
          region_state:     data.region_state     ?? '',
          region_county:    data.region_county    ?? '',
          threat_profile:   data.threat_profile   ?? [],
          bio:              data.bio              ?? '',
          prep_level:       data.prep_level       ?? '',
          focus_areas:      data.focus_areas      ?? [],
          years_prepping:   data.years_prepping   ?? '',
          living_situation: data.living_situation ?? '',
          showcase:         data.showcase         ?? {},
        })
        setAvatarUrl(data.avatar_url ?? null)
        setTwoFaEnabled(data.two_fa_enabled ?? false)
        if (data.notification_prefs) {
          setNotifPrefs({
            email:      data.notification_prefs.email      ?? true,
            push:       data.notification_prefs.push       ?? false,
            severity:   data.notification_prefs.severity   ?? 'severe',
            categories: data.notification_prefs.categories ?? ALL_CATEGORY_IDS,
            radius_km:  data.notification_prefs.radius_km  ?? 150,
          })
        }
      })
  }, [])

  function toggleArr(key: 'threat_profile' | 'focus_areas', val: string) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }))
  }

  // Push on/off is saved immediately, not held for the main Save button:
  // the subscription itself (browser permission + endpoint on file) and
  // the notification_prefs.push flag the worker actually checks need to
  // agree right away, otherwise a granted subscription with the flag still
  // off would just never fire, or a revoked one would keep the flag on.
  async function savePushPref(push: boolean) {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_prefs: { push } }),
    })
    if (res.ok) setNotifPrefs(p => ({ ...p, push }))
    return res.ok
  }

  async function handleTogglePush() {
    setPushError(null)
    if (notifPrefs.push) {
      setPushBusy(true)
      try {
        await unsubscribeFromPush()
        await savePushPref(false)
      } finally {
        setPushBusy(false)
      }
      return
    }
    if (!pushSupported()) {
      setPushError("This browser doesn't support push notifications.")
      return
    }
    setPushBusy(true)
    try {
      const ok = await subscribeToPush()
      if (ok) await savePushPref(true)
      else setPushError('Push permission was denied or the subscription failed. Check your browser notification settings.')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd })
      if (res.ok) {
        const { avatar_url } = await res.json()
        setAvatarUrl(avatar_url)
        if (user) login({ ...user, avatar_url })
      }
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  async function handleAvatarRemove() {
    const res = await fetch('/api/users/me/avatar', { method: 'DELETE' })
    if (res.ok) {
      setAvatarUrl(null)
      if (user) login({ ...user, avatar_url: null })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region_state:       form.region_state     || null,
          region_county:      form.region_county    || null,
          threat_profile:     form.threat_profile,
          bio:                form.bio.trim()        || null,
          prep_level:         form.prep_level        || null,
          focus_areas:        form.focus_areas,
          years_prepping:     form.years_prepping !== '' ? Number(form.years_prepping) : null,
          living_situation:   form.living_situation  || null,
          showcase:           Object.keys(form.showcase).some(k => form.showcase[k].trim())
                                ? Object.fromEntries(Object.entries(form.showcase).filter(([, v]) => v.trim()))
                                : null,
          notification_prefs: notifPrefs,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      login({ ...user!, ...data })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  async function handle2faSetup() {
    setTwoFaError(null)
    setTwoFaLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setTwoFaError(data.error); return }
      setTwoFaSetup(data)
      setTwoFaMode('setup')
    } catch {
      setTwoFaError('Something went wrong.')
    } finally {
      setTwoFaLoading(false)
    }
  }

  async function handle2faEnable(e: FormEvent) {
    e.preventDefault()
    setTwoFaError(null)
    setTwoFaLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp_code: twoFaCode }),
      })
      const data = await res.json()
      if (!res.ok) { setTwoFaError(data.error); return }
      setTwoFaEnabled(true)
      setTwoFaMode('idle')
      setTwoFaSetup(null)
      setTwoFaCode('')
    } catch {
      setTwoFaError('Something went wrong.')
    } finally {
      setTwoFaLoading(false)
    }
  }

  async function handle2faDisable(e: FormEvent) {
    e.preventDefault()
    setTwoFaError(null)
    setTwoFaLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp_code: twoFaCode }),
      })
      const data = await res.json()
      if (!res.ok) { setTwoFaError(data.error); return }
      setTwoFaEnabled(false)
      setTwoFaMode('idle')
      setTwoFaCode('')
    } catch {
      setTwoFaError('Something went wrong.')
    } finally {
      setTwoFaLoading(false)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdError('New passwords do not match')
      return
    }
    setPwdSaving(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwdForm.current, new_password: pwdForm.next }),
      })
      const data = await res.json()
      if (!res.ok) { setPwdError(data.error); return }
      setPwdForm({ current: '', next: '', confirm: '' })
      setPwdSaved(true)
      setTimeout(() => setPwdSaved(false), 2500)
    } catch {
      setPwdError('Something went wrong.')
    } finally {
      setPwdSaving(false)
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
    borderRadius: '8px', padding: '24px', marginBottom: '12px',
  }
  const sectionHeader = {
    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
    color: 'var(--color-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', marginBottom: '16px',
  }
  const chipBtn = (active: boolean) => ({
    padding: '5px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'var(--font-display)', transition: 'all 0.15s',
    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
    borderStyle: 'solid' as const, borderWidth: '1px',
    borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
  })

  const pwdScore = PWD_REQUIREMENTS.filter(r => r.test(pwdForm.next)).length

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>
        Edit Profile
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Avatar */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Profile Photo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img
              src={avatarUrl || '/wolf-avatar.jpeg'}
              alt="avatar"
              style={{ width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--color-border)', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                style={{ padding: '7px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: avatarUploading ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', transition: 'all 0.15s' }}
              >
                {avatarUploading ? 'Uploading...' : 'Upload Photo'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  Remove photo
                </button>
              )}
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                JPEG, PNG, WebP or GIF. Max 2 MB.
              </span>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Identity */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Identity</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Username</label>
            <div style={{ ...inputStyle, color: 'var(--color-subtle)', cursor: 'not-allowed' }}>{user?.username}</div>
          </div>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell the community about yourself and your prep journey..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>
        </div>

        {/* Region */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Region</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>State</label>
              <select value={form.region_state} onChange={e => setForm(f => ({ ...f, region_state: e.target.value }))} style={inputStyle}>
                <option value="">Select state...</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>County / Area</label>
              <input value={form.region_county} onChange={e => setForm(f => ({ ...f, region_county: e.target.value }))} placeholder="e.g. Travis County" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Preparedness Profile */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Preparedness Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Prep Level</label>
              <select value={form.prep_level} onChange={e => setForm(f => ({ ...f, prep_level: e.target.value }))} style={inputStyle}>
                <option value="">Select...</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Years Prepping</label>
              <input type="number" min={0} max={60} value={form.years_prepping} onChange={e => setForm(f => ({ ...f, years_prepping: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Living Situation</label>
              <select value={form.living_situation} onChange={e => setForm(f => ({ ...f, living_situation: e.target.value }))} style={inputStyle}>
                <option value="">Select...</option>
                <option value="urban">Urban</option>
                <option value="suburban">Suburban</option>
                <option value="rural">Rural</option>
                <option value="homestead">Homestead</option>
                <option value="off-grid">Off Grid</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Focus Areas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              {FOCUS_OPTIONS.map(f => (
                <button key={f} type="button" onClick={() => toggleArr('focus_areas', f)} style={chipBtn(form.focus_areas.includes(f))}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Threat profile */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Threat Focus</div>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '14px' }}>Select the threats most relevant to your area.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {THREAT_OPTIONS.map(t => (
              <button key={t} type="button" onClick={() => toggleArr('threat_profile', t)} style={{ ...chipBtn(form.threat_profile.includes(t)), borderColor: form.threat_profile.includes(t) ? 'var(--color-danger)' : 'var(--color-border)', background: form.threat_profile.includes(t) ? 'rgba(239,68,68,0.08)' : 'transparent', color: form.threat_profile.includes(t) ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Showcase */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Showcase</div>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>Share your setup with the community. All fields optional.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SHOWCASE_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <textarea
                  value={form.showcase[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, showcase: { ...f.showcase, [key]: e.target.value } }))}
                  placeholder={placeholder}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Alert Preferences */}
        <div style={sectionStyle}>
          <div style={sectionHeader}>Alert Preferences</div>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '18px' }}>
            Control which events trigger email alerts. Alerts only fire for events near your saved region.
          </p>

          {/* Email toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>Email Alerts</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Receive email notifications for high-severity events near you</div>
            </div>
            <button
              type="button"
              onClick={() => setNotifPrefs(p => ({ ...p, email: !p.email }))}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', flexShrink: 0,
                background: notifPrefs.email ? 'var(--color-accent)' : 'var(--color-border)',
                position: 'relative', transition: 'background 0.2s',
              }}
              aria-label="Toggle email alerts"
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: notifPrefs.email ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Push toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '12px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>Push Notifications</div>
              <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Get an instant notification on this device for high-severity events near you, even with the site closed. Faster than email for anything time-sensitive.
              </div>
            </div>
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={pushBusy}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', flexShrink: 0,
                cursor: pushBusy ? 'not-allowed' : 'pointer',
                background: notifPrefs.push ? 'var(--color-accent)' : 'var(--color-border)',
                position: 'relative', transition: 'background 0.2s', opacity: pushBusy ? 0.6 : 1,
              }}
              aria-label="Toggle push notifications"
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: notifPrefs.push ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>
          {pushError && (
            <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginBottom: '20px' }}>{pushError}</div>
          )}
          {!pushError && <div style={{ marginBottom: '20px' }} />}

          {notifPrefs.email && (
            <>
              {/* Severity threshold */}
              <label style={labelStyle}>Minimum Severity</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {SEVERITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNotifPrefs(p => ({ ...p, severity: opt.value }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      background: notifPrefs.severity === opt.value ? 'rgba(34,197,94,0.08)' : 'var(--color-bg)',
                      border: `1px solid ${notifPrefs.severity === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${notifPrefs.severity === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: notifPrefs.severity === opt.value ? 'var(--color-accent)' : 'transparent',
                    }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <label style={labelStyle}>Alert Categories</label>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '10px' }}>Only receive alerts for the event types you care about.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ALERT_CATEGORIES.map(cat => {
                  const on = notifPrefs.categories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNotifPrefs(p => ({
                        ...p,
                        categories: on
                          ? p.categories.filter(c => c !== cat.id)
                          : [...p.categories, cat.id],
                      }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                        background: on ? 'rgba(34,197,94,0.06)' : 'var(--color-bg)',
                        border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        border: `2px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: on ? 'var(--color-accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{cat.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{cat.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Alert radius */}
              <label style={{ ...labelStyle, marginTop: '20px' }}>Alert Radius</label>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '10px' }}>Only receive alerts for events within this distance of your saved location.</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([100, 150, 250, 500] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNotifPrefs(p => ({ ...p, radius_km: r }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: '6px', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      background: notifPrefs.radius_km === r ? 'rgba(34,197,94,0.08)' : 'var(--color-bg)',
                      border: `1px solid ${notifPrefs.radius_km === r ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      color: notifPrefs.radius_km === r ? 'var(--color-accent)' : 'var(--color-muted)',
                      fontWeight: notifPrefs.radius_km === r ? 700 : 400,
                    }}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            </>
          )}
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

      {/* Change Password */}
      <div style={{ ...sectionStyle, marginTop: '12px' }}>
        <div style={sectionHeader}>Change Password</div>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password"
              value={pwdForm.current}
              onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))}
              placeholder="Your current password"
              required
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={pwdForm.next}
              onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))}
              placeholder="New password"
              required
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
            {pwdForm.next.length > 0 && (
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
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              value={pwdForm.confirm}
              onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Confirm new password"
              required
              style={{
                ...inputStyle,
                borderColor: pwdForm.confirm && pwdForm.confirm !== pwdForm.next ? 'var(--color-danger)' : undefined,
              }}
              onFocus={e => (e.target.style.borderColor = pwdForm.confirm && pwdForm.confirm !== pwdForm.next ? 'var(--color-danger)' : 'var(--color-accent)')}
              onBlur={e => (e.target.style.borderColor = pwdForm.confirm && pwdForm.confirm !== pwdForm.next ? 'var(--color-danger)' : 'var(--color-border)')}
            />
          </div>

          {pwdError && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
              {pwdError}
            </div>
          )}

          <button
            type="submit"
            disabled={pwdSaving || pwdScore < 5 || pwdForm.next !== pwdForm.confirm}
            style={{
              padding: '9px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)',
              fontSize: '13px', fontWeight: 600,
              cursor: pwdSaving || pwdScore < 5 || pwdForm.next !== pwdForm.confirm ? 'not-allowed' : 'pointer',
              background: pwdSaved ? 'rgba(34,197,94,0.2)' : pwdSaving || pwdScore < 5 || pwdForm.next !== pwdForm.confirm ? 'var(--color-border)' : 'transparent',
              color: pwdSaved ? 'var(--color-accent)' : pwdSaving || pwdScore < 5 || pwdForm.next !== pwdForm.confirm ? 'var(--color-muted)' : 'var(--color-text)',
              border: pwdSaved ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              transition: 'all 0.2s', alignSelf: 'flex-start',
            }}
          >
            {pwdSaved ? 'Password Updated' : pwdSaving ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div style={{ ...sectionStyle, marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: twoFaMode === 'idle' ? 0 : '20px' }}>
          <div style={sectionHeader}>Two-Factor Authentication</div>
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '3px 8px', borderRadius: '4px',
            background: twoFaEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)',
            color: twoFaEnabled ? 'var(--color-accent)' : 'var(--color-muted)',
            border: `1px solid ${twoFaEnabled ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`,
          }}>
            {twoFaEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>

        {twoFaMode === 'idle' && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              {twoFaEnabled
                ? 'Your account is protected with an authenticator app.'
                : 'Add a second layer of security using an authenticator app like Google Authenticator or Authy.'}
            </p>
            {twoFaEnabled ? (
              <button
                onClick={() => { setTwoFaMode('disable'); setTwoFaCode(''); setTwoFaError(null) }}
                style={{ padding: '7px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: 'var(--color-danger)', transition: 'all 0.15s' }}
              >
                Disable 2FA
              </button>
            ) : (
              <button
                onClick={handle2faSetup}
                disabled={twoFaLoading}
                style={{ padding: '7px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: twoFaLoading ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', transition: 'all 0.15s' }}
              >
                {twoFaLoading ? 'Loading...' : 'Set Up 2FA'}
              </button>
            )}
          </div>
        )}

        {twoFaMode === 'setup' && twoFaSetup && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>
              Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img
                src={twoFaSetup.qrDataUrl}
                alt="2FA QR code"
                style={{ width: '180px', height: '180px', borderRadius: '8px', border: '2px solid var(--color-border)', background: '#fff', padding: '8px' }}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Manual entry code
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px 14px', letterSpacing: '0.15em', userSelect: 'all' }}>
                  {twoFaSetup.secret}
                </div>
              </div>
            </div>

            <form onSubmit={handle2faEnable} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFaCode}
                  onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  autoComplete="one-time-code"
                  style={{ ...inputStyle, fontSize: '20px', letterSpacing: '0.25em', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              {twoFaError && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                  {twoFaError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={twoFaLoading || twoFaCode.length !== 6}
                  style={{ padding: '9px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: twoFaLoading || twoFaCode.length !== 6 ? 'not-allowed' : 'pointer', background: twoFaLoading || twoFaCode.length !== 6 ? 'var(--color-border)' : 'var(--color-accent)', color: twoFaLoading || twoFaCode.length !== 6 ? 'var(--color-muted)' : '#0A0A0A', border: 'none', transition: 'all 0.15s' }}
                >
                  {twoFaLoading ? 'Verifying...' : 'Enable 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFaMode('idle'); setTwoFaSetup(null); setTwoFaCode(''); setTwoFaError(null) }}
                  style={{ padding: '9px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', transition: 'all 0.15s' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {twoFaMode === 'disable' && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>
              Enter your authenticator code to disable 2FA.
            </p>
            <form onSubmit={handle2faDisable} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Authenticator Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFaCode}
                  onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  autoComplete="one-time-code"
                  style={{ ...inputStyle, fontSize: '20px', letterSpacing: '0.25em', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              {twoFaError && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                  {twoFaError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={twoFaLoading || twoFaCode.length !== 6}
                  style={{ padding: '9px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: twoFaLoading || twoFaCode.length !== 6 ? 'not-allowed' : 'pointer', background: 'transparent', color: twoFaLoading || twoFaCode.length !== 6 ? 'var(--color-muted)' : 'var(--color-danger)', border: `1px solid ${twoFaLoading || twoFaCode.length !== 6 ? 'var(--color-border)' : 'rgba(239,68,68,0.4)'}`, transition: 'all 0.15s' }}
                >
                  {twoFaLoading ? 'Disabling...' : 'Confirm Disable'}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFaMode('idle'); setTwoFaCode(''); setTwoFaError(null) }}
                  style={{ padding: '9px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', transition: 'all 0.15s' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
