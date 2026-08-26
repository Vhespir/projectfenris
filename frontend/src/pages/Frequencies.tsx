import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface Frequency {
  id: number
  state: string
  county: string | null
  category: string
  frequency_mhz: number
  name: string
  description: string | null
  tone_ctcss: string | null
  tone_dcs: string | null
  notes: string | null
  is_verified: boolean
  created_at: string
  submitted_by: string | null
}

const CATEGORIES = [
  { value: 'noaa_weather',  label: 'NOAA Weather',  color: '#3B82F6' },
  { value: 'ham_repeater',  label: 'Ham Radio',      color: '#22C55E' },
  { value: 'gmrs',          label: 'GMRS',           color: '#F59E0B' },
  { value: 'police',        label: 'Police',         color: '#8B5CF6' },
  { value: 'fire',          label: 'Fire',           color: '#EF4444' },
  { value: 'ems',           label: 'EMS',            color: '#06B6D4' },
  { value: 'military',      label: 'Military',       color: '#6B7280' },
  { value: 'other',         label: 'Other',          color: '#71717A' },
]

function catLabel(cat: string) { return CATEGORIES.find(c => c.value === cat)?.label ?? cat }
function catColor(cat: string) { return CATEGORIES.find(c => c.value === cat)?.color ?? 'var(--color-muted)' }

const US_STATES = [
  'ALL','AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

export default function Frequencies() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [freqs, setFreqs] = useState<Frequency[]>([])
  const [loading, setLoading] = useState(true)
  const [stateFilter, setStateFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (stateFilter && stateFilter !== '') params.set('state', stateFilter)
    if (catFilter) params.set('category', catFilter)
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/frequencies?${params}`)
      .then(r => r.json())
      .then(d => { setFreqs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [stateFilter, catFilter, search])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Emergency Frequency Database
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', marginTop: '6px' }}>
            Police, fire, EMS, ham radio, NOAA weather, and GMRS frequencies by region. Community-maintained.
          </p>
        </div>
        {user && (
          <button onClick={() => setShowForm(v => !v)} style={{
            padding: '9px 18px', borderRadius: '6px',
            background: showForm ? 'transparent' : 'var(--color-accent)',
            border: showForm ? '1px solid var(--color-border)' : 'none',
            color: showForm ? 'var(--color-muted)' : '#0A0A0A',
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}>
            {showForm ? 'Cancel' : '+ Add Frequency'}
          </button>
        )}
      </div>

      {showForm && user && <SubmitForm onSuccess={() => { setShowForm(false); load() }} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          color: 'var(--color-muted)', borderRadius: '4px', padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer',
        }}>
          {US_STATES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, county..."
          style={{
            flex: 1, minWidth: '160px', padding: '6px 12px', borderRadius: '4px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '13px',
          }}
        />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setCatFilter('')} style={{
            padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
            fontFamily: 'var(--font-mono)', border: '1px solid',
            borderColor: catFilter === '' ? 'var(--color-accent)' : 'var(--color-border)',
            background: catFilter === '' ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: catFilter === '' ? 'var(--color-accent)' : 'var(--color-muted)',
          }}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCatFilter(catFilter === c.value ? '' : c.value)} style={{
              padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
              fontFamily: 'var(--font-mono)', border: '1px solid',
              borderColor: catFilter === c.value ? c.color : 'var(--color-border)',
              background: catFilter === c.value ? `${c.color}22` : 'transparent',
              color: catFilter === c.value ? c.color : 'var(--color-muted)',
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
      ) : freqs.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)' }}>
          No frequencies found.{(stateFilter !== 'ALL' || catFilter || search) ? ' Try adjusting filters.' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
          {isMobile ? (
            freqs.map(f => <FreqRowMobile key={f.id} freq={f} />)
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr 96px 80px 80px 36px', gap: '0 12px', padding: '6px 14px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                {['MHz', 'Category', 'Name / Description', 'Location', 'Tone', 'Source', ''].map((h, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                ))}
              </div>
              {freqs.map(f => <FreqRow key={f.id} freq={f} />)}
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', lineHeight: 1.6 }}>
        National frequencies (NOAA Weather Radio, GMRS, Ham calling) shown for all state selections.
        Local police, fire, and EMS frequencies require community submission -- not all areas covered.
        Always verify critical frequencies against official sources before relying on them.
        {!user && <> <Link to="/register" style={{ color: 'var(--color-accent)', marginLeft: '4px' }}>Create an account</Link> to submit frequencies for your area.</>}
      </div>
    </div>
  )
}

function FreqRow({ freq: f }: { freq: Frequency }) {
  const color = catColor(f.category)
  const tone = f.tone_ctcss ? `C ${f.tone_ctcss}` : f.tone_dcs ? `D ${f.tone_dcs}` : null
  const location = f.county ? `${f.county}, ${f.state}` : f.state === 'ALL' ? 'National' : f.state

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr 96px 80px 80px 36px', gap: '0 12px', padding: '9px 14px', background: 'var(--color-surface)', alignItems: 'center' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
        {Number(f.frequency_mhz).toFixed(4)}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {catLabel(f.category)}
      </span>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>{f.name}</div>
        {f.description && <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-subtle)', marginTop: '1px' }}>{f.description}</div>}
        {f.notes && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginTop: '1px' }}>{f.notes}</div>}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}>{location}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{tone ?? '--'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
        {f.submitted_by ? f.submitted_by : 'Seeded'}
      </span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {f.is_verified && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>
            VFD
          </span>
        )}
      </div>
    </div>
  )
}

function FreqRowMobile({ freq: f }: { freq: Frequency }) {
  const color = catColor(f.category)
  const tone = f.tone_ctcss ? `CTCSS ${f.tone_ctcss}` : f.tone_dcs ? `DCS ${f.tone_dcs}` : null
  const location = f.county ? `${f.county}, ${f.state}` : f.state === 'ALL' ? 'National' : f.state

  return (
    <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '2px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
          {Number(f.frequency_mhz).toFixed(4)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {catLabel(f.category)}
        </span>
        {f.is_verified && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>VFD</span>
        )}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500 }}>{f.name}</div>
      {f.description && <div style={{ fontSize: '12px', color: 'var(--color-subtle)', marginTop: '2px' }}>{f.description}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{location}</span>
        {tone && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{tone}</span>}
        {f.notes && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{f.notes}</span>}
      </div>
    </div>
  )
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, setStateVal] = useState('ALL')
  const [county, setCounty] = useState('')
  const [category, setCategory] = useState('ham_repeater')
  const [frequencyMhz, setFrequencyMhz] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [toneCTCSS, setToneCTCSS] = useState('')
  const [toneDCS, setToneDCS] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: '4px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '13px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!state || !category || !frequencyMhz || !name.trim()) {
      setError('State, category, frequency, and name are required.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/frequencies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state, county: county || null, category, frequency_mhz: frequencyMhz, name,
          description: description || null, tone_ctcss: toneCTCSS || null,
          tone_dcs: toneDCS || null, notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); setSubmitting(false); return }
      onSuccess()
    } catch { setError('Network error'); setSubmitting(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '28px', padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>Add Frequency</div>
      {error && <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#EF4444', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <label style={labelStyle}>State *</label>
          <select value={state} onChange={e => setStateVal(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {US_STATES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'National (ALL)' : s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>County</label>
          <input value={county} onChange={e => setCounty(e.target.value)} placeholder="Optional" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Category *</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Frequency MHz *</label>
          <input value={frequencyMhz} onChange={e => setFrequencyMhz(e.target.value)} placeholder="e.g. 146.520" style={fieldStyle} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Harris County EMS Dispatch" style={fieldStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of use" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>CTCSS Tone</label>
          <input value={toneCTCSS} onChange={e => setToneCTCSS(e.target.value)} placeholder="e.g. 107.2" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>DCS Code</label>
          <input value={toneDCS} onChange={e => setToneDCS(e.target.value)} placeholder="e.g. 023" style={fieldStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="License info, usage notes..." style={fieldStyle} />
        </div>
      </div>
      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
          Submissions are reviewed by moderators before verification badge is awarded.
        </span>
        <button type="submit" disabled={submitting} style={{
          padding: '9px 20px', borderRadius: '6px', background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
          border: 'none', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
