import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface AAR {
  id: number
  title: string
  incident_type: string
  location_label: string | null
  state: string | null
  duration: string | null
  key_takeaway: string | null
  narrative: string
  what_worked: string[]
  what_failed: string[]
  wish_had: string[]
  signal_count: number
  noise_count: number
  created_at: string
  username: string | null
  reputation: number
  is_trusted: boolean
  is_founding_member: boolean
  user_id?: number
}

const INCIDENT_TYPES = [
  { value: 'hurricane',      label: 'Hurricane' },
  { value: 'earthquake',     label: 'Earthquake' },
  { value: 'wildfire',       label: 'Wildfire' },
  { value: 'flood',          label: 'Flood' },
  { value: 'tornado',        label: 'Tornado' },
  { value: 'winter_storm',   label: 'Winter Storm' },
  { value: 'power_outage',   label: 'Power Outage' },
  { value: 'medical',        label: 'Medical Emergency' },
  { value: 'financial',      label: 'Financial Crisis' },
  { value: 'civil_unrest',   label: 'Civil Unrest' },
  { value: 'evacuation',     label: 'Evacuation' },
  { value: 'other',          label: 'Other' },
]

const TYPE_COLOR: Record<string, string> = {
  hurricane:    '#3B82F6',
  earthquake:   '#F97316',
  wildfire:     '#EF4444',
  flood:        '#06B6D4',
  tornado:      '#8B5CF6',
  winter_storm: '#93C5FD',
  power_outage: '#F59E0B',
  medical:      '#22C55E',
  financial:    '#EAB308',
  civil_unrest: '#F87171',
  evacuation:   '#FB923C',
  other:        '#71717A',
}

function typeLabel(t: string) {
  return INCIDENT_TYPES.find(x => x.value === t)?.label ?? t
}

function tierBadge(rep: number, isFounder: boolean, isTrusted: boolean) {
  if (isFounder) return { label: 'Founder', color: '#A78BFA' }
  if (rep >= 2500) return { label: 'Sentinel', color: '#F59E0B' }
  if (rep >= 1001) return { label: 'Operator', color: '#F97316' }
  if (isTrusted)   return { label: 'Trusted', color: '#3B82F6' }
  if (rep >= 101)  return { label: 'Contrib', color: '#94A3B8' }
  return null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── List Page ────────────────────────────────────────────────────────────────

export default function AfterAction() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [reports, setReports] = useState<AAR[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort] = useState('recent')
  const [showForm, setShowForm] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', sort })
    if (typeFilter) params.set('incident_type', typeFilter)
    fetch(`/api/aar?${params}`)
      .then(r => r.json())
      .then(d => { setReports(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [typeFilter, sort])

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            After Action Reports
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', marginTop: '6px' }}>
            Real emergencies documented by community members. What worked, what failed, what they wish they had.
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
            {showForm ? 'Cancel' : '+ Submit Report'}
          </button>
        )}
      </div>

      {showForm && user && <SubmitForm onSuccess={() => { setShowForm(false); load() }} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          <button onClick={() => setTypeFilter('')} style={{
            padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
            fontFamily: 'var(--font-mono)', border: '1px solid',
            borderColor: typeFilter === '' ? 'var(--color-accent)' : 'var(--color-border)',
            background: typeFilter === '' ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: typeFilter === '' ? 'var(--color-accent)' : 'var(--color-muted)',
          }}>All</button>
          {INCIDENT_TYPES.map(t => (
            <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)} style={{
              padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
              fontFamily: 'var(--font-mono)', border: '1px solid',
              borderColor: typeFilter === t.value ? TYPE_COLOR[t.value] : 'var(--color-border)',
              background: typeFilter === t.value ? `${TYPE_COLOR[t.value]}22` : 'transparent',
              color: typeFilter === t.value ? TYPE_COLOR[t.value] : 'var(--color-muted)',
            }}>{t.label}</button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          color: 'var(--color-muted)', borderRadius: '4px', padding: '5px 10px',
          fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer',
        }}>
          <option value="recent">Recent</option>
          <option value="signal">Most Signal</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)', marginBottom: '12px' }}>
            No reports yet.{typeFilter ? ' Try removing the filter.' : ''}
          </div>
          {user && !showForm && (
            <button onClick={() => setShowForm(true)} style={{
              padding: '8px 16px', borderRadius: '6px', background: 'var(--color-accent)',
              border: 'none', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
            }}>Be the first to submit</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}

      {!user && (
        <div style={{ marginTop: '24px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
          <Link to="/register" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600 }}>Join Project Fenris</Link>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', marginLeft: '6px' }}>to submit your own after action report.</span>
        </div>
      )}
    </div>
  )
}

function ReportCard({ report: r }: { report: AAR }) {
  const color = TYPE_COLOR[r.incident_type] ?? 'var(--color-muted)'
  const badge = tierBadge(r.reputation, r.is_founding_member, r.is_trusted)
  return (
    <Link to={`/aar/${r.id}`}
      style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '14px 16px', borderLeft: `3px solid ${color}` }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          {typeLabel(r.incident_type)}
        </span>
        {r.location_label && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.location_label}{r.state ? `, ${r.state}` : ''}</span>
        )}
        {r.duration && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.duration}</span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3, marginBottom: r.key_takeaway ? '6px' : '0' }}>
        {r.title}
      </div>
      {r.key_takeaway && (
        <div style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.4 }}>
          {r.key_takeaway}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#22C55E' }}>{r.signal_count} signal</span>
        {r.what_worked.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.what_worked.length} worked</span>}
        {r.what_failed.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.what_failed.length} failed</span>}
        {r.wish_had.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.wish_had.length} wish had</span>}
        {r.username && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{r.username}</span>
            {badge && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44`, textTransform: 'uppercase' }}>
                {badge.label}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

function ListInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (t) { onChange([...values, t]); setDraft('') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '4px',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '13px',
          }}
        />
        <button type="button" onClick={add} style={{
          padding: '8px 14px', borderRadius: '4px', background: 'transparent',
          border: '1px solid var(--color-border)', color: 'var(--color-muted)',
          fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer',
        }}>Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {values.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: 'var(--color-bg)', borderRadius: '3px', border: '1px solid var(--color-border)' }}>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>{v}</span>
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [incidentType, setIncidentType] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [state, setState] = useState('')
  const [duration, setDuration] = useState('')
  const [narrative, setNarrative] = useState('')
  const [whatWorked, setWhatWorked] = useState<string[]>([])
  const [whatFailed, setWhatFailed] = useState<string[]>([])
  const [wishHad, setWishHad] = useState<string[]>([])
  const [keyTakeaway, setKeyTakeaway] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '4px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '13px',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !incidentType || !narrative.trim()) {
      setError('Title, incident type, and narrative are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/aar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, incident_type: incidentType, location_label: locationLabel || null,
          state: state || null, duration: duration || null, narrative,
          what_worked: whatWorked, what_failed: whatFailed, wish_had: wishHad,
          key_takeaway: keyTakeaway || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to submit'); setSubmitting(false); return }
      navigate(`/aar/${data.id}`)
      onSuccess()
    } catch {
      setError('Network error'); setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '28px', padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '20px' }}>Submit After Action Report</div>
      {error && <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: '#EF4444', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What happened in one line" style={fieldStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Incident Type *</label>
            <select value={incidentType} onChange={e => setIncidentType(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="">Select type...</option>
              {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input value={locationLabel} onChange={e => setLocationLabel(e.target.value)} placeholder="City, county..." style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>State / Region</label>
            <input value={state} onChange={e => setState(e.target.value)} placeholder="TX, CA..." style={fieldStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Duration</label>
          <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 5 days, 3 weeks" style={fieldStyle} />
        </div>

        <div>
          <label style={labelStyle}>Narrative * <span style={{ color: 'var(--color-subtle)', textTransform: 'none', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>-- tell the full story</span></label>
          <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={8} placeholder="What happened, when, how bad it was, how you responded, what the outcome was..." style={{ ...fieldStyle, resize: 'vertical', minHeight: '140px' }} />
        </div>

        <div>
          <label style={labelStyle}>What Worked <span style={{ color: 'var(--color-subtle)', textTransform: 'none', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>-- add one item at a time, press Enter or Add</span></label>
          <ListInput values={whatWorked} onChange={setWhatWorked} placeholder="e.g. Water storage, hand-crank radio..." />
        </div>

        <div>
          <label style={labelStyle}>What Failed <span style={{ color: 'var(--color-subtle)', textTransform: 'none', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>-- what didn't work, what you ran out of</span></label>
          <ListInput values={whatFailed} onChange={setWhatFailed} placeholder="e.g. Generator fuel, communication plan..." />
        </div>

        <div>
          <label style={labelStyle}>Wish I Had <span style={{ color: 'var(--color-subtle)', textTransform: 'none', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>-- what you'd add to your preps based on this experience</span></label>
          <ListInput values={wishHad} onChange={setWishHad} placeholder="e.g. Satellite communicator, backup fuel..." />
        </div>

        <div>
          <label style={labelStyle}>Key Takeaway <span style={{ color: 'var(--color-subtle)', textTransform: 'none', fontFamily: 'var(--font-body)', letterSpacing: 0 }}>-- one sentence lesson learned</span></label>
          <input value={keyTakeaway} onChange={e => setKeyTakeaway(e.target.value)} placeholder="The single most important lesson from this experience" style={fieldStyle} />
        </div>

        <button type="submit" disabled={submitting} style={{
          alignSelf: 'flex-end', padding: '10px 24px', borderRadius: '6px',
          background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
          border: 'none', color: '#0A0A0A', fontFamily: 'var(--font-display)',
          fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </form>
  )
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

export function AARDetail() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [report, setReport] = useState<AAR | null>(null)
  const [loading, setLoading] = useState(true)
  const [myVote, setMyVote] = useState<'signal' | 'noise' | null>(null)
  const [editing, setEditing] = useState(false)

  const id = window.location.pathname.split('/').pop()

  useEffect(() => {
    fetch(`/api/aar/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setReport(d); setLoading(false) })
      .catch(() => setLoading(false))
    if (user) {
      fetch(`/api/aar/${id}/myvote`)
        .then(r => r.ok ? r.json() : { vote: null })
        .then(d => setMyVote(d.vote))
        .catch(() => {})
    }
  }, [id, user])

  async function vote(v: 'signal' | 'noise') {
    if (!user) return
    const res = await fetch(`/api/aar/${id}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: v }),
    })
    if (res.ok) {
      const data = await res.json()
      setMyVote(data.vote)
      setReport(prev => prev ? { ...prev, signal_count: data.signal_count, noise_count: data.noise_count } : prev)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!report) return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#EF4444' }}>Report not found.</div>

  const color = TYPE_COLOR[report.incident_type] ?? 'var(--color-muted)'
  const badge = tierBadge(report.reputation, report.is_founding_member, report.is_trusted)
  const isOwner = user && report.user_id === (user as { id?: number }).id

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/aar" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)', textDecoration: 'none' }}>
          After Action Reports
        </Link>
        <span style={{ color: 'var(--color-subtle)', margin: '0 6px' }}>/</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>#{report.id}</span>
      </div>

      <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', borderLeft: `4px solid ${color}`, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '3px', background: `${color}22`, border: `1px solid ${color}44` }}>
            {typeLabel(report.incident_type)}
          </span>
          {report.location_label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}>{report.location_label}{report.state ? `, ${report.state}` : ''}</span>}
          {report.duration && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{report.duration}</span>}
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '20px' : '26px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 10px' }}>{report.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {report.username && (
            <Link to={`/profile/${report.username}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}>{report.username}</span>
              {badge && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44`, textTransform: 'uppercase' }}>{badge.label}</span>}
            </Link>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{timeAgo(report.created_at)}</span>
          {isOwner && (
            <button onClick={() => setEditing(v => !v)} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', padding: '2px 8px' }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {editing && isOwner && (
        <EditForm report={report} onSuccess={updated => { setReport(updated); setEditing(false) }} />
      )}

      {/* Key Takeaway callout */}
      {report.key_takeaway && (
        <div style={{ marginBottom: '24px', padding: '14px 18px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', background: 'rgba(34,197,94,0.06)', borderLeft: '4px solid var(--color-accent)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Key Takeaway</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text)', fontWeight: 500 }}>{report.key_takeaway}</div>
        </div>
      )}

      {/* Structured lists */}
      {(report.what_worked.length > 0 || report.what_failed.length > 0 || report.wish_had.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {report.what_worked.length > 0 && (
            <div style={{ padding: '14px', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '6px', background: 'rgba(34,197,94,0.04)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>What Worked</div>
              <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {report.what_worked.map((item, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.4 }}>{item}</li>)}
              </ul>
            </div>
          )}
          {report.what_failed.length > 0 && (
            <div style={{ padding: '14px', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>What Failed</div>
              <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {report.what_failed.map((item, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.4 }}>{item}</li>)}
              </ul>
            </div>
          )}
          {report.wish_had.length > 0 && (
            <div style={{ padding: '14px', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', background: 'rgba(245,158,11,0.04)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Wish I Had</div>
              <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {report.wish_had.map((item, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.4 }}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Narrative */}
      <div style={{ padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Full Narrative</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{report.narrative}</div>
      </div>

      {/* Vote bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rate this report</span>
        <button onClick={() => vote('signal')} disabled={!user} style={{
          padding: '5px 14px', borderRadius: '4px', cursor: user ? 'pointer' : 'not-allowed',
          background: myVote === 'signal' ? 'rgba(34,197,94,0.15)' : 'transparent',
          border: `1px solid ${myVote === 'signal' ? 'rgba(34,197,94,0.5)' : 'var(--color-border)'}`,
          color: myVote === 'signal' ? '#22C55E' : 'var(--color-muted)',
          fontFamily: 'var(--font-mono)', fontSize: '12px',
        }}>
          Signal {report.signal_count}
        </button>
        <button onClick={() => vote('noise')} disabled={!user} style={{
          padding: '5px 14px', borderRadius: '4px', cursor: user ? 'pointer' : 'not-allowed',
          background: myVote === 'noise' ? 'rgba(239,68,68,0.1)' : 'transparent',
          border: `1px solid ${myVote === 'noise' ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
          color: myVote === 'noise' ? '#EF4444' : 'var(--color-muted)',
          fontFamily: 'var(--font-mono)', fontSize: '12px',
        }}>
          Noise {report.noise_count}
        </button>
        {!user && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}><Link to="/login" style={{ color: 'var(--color-accent)' }}>Sign in</Link> to vote</span>}
      </div>
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditForm({ report, onSuccess }: { report: AAR; onSuccess: (updated: AAR) => void }) {
  const [title, setTitle] = useState(report.title)
  const [narrative, setNarrative] = useState(report.narrative)
  const [locationLabel, setLocationLabel] = useState(report.location_label ?? '')
  const [state, setState] = useState(report.state ?? '')
  const [duration, setDuration] = useState(report.duration ?? '')
  const [whatWorked, setWhatWorked] = useState<string[]>(report.what_worked)
  const [whatFailed, setWhatFailed] = useState<string[]>(report.what_failed)
  const [wishHad, setWishHad] = useState<string[]>(report.wish_had)
  const [keyTakeaway, setKeyTakeaway] = useState(report.key_takeaway ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '4px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: '13px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px',
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/aar/${report.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, narrative, location_label: locationLabel, state, duration, what_worked: whatWorked, what_failed: whatFailed, wish_had: wishHad, key_takeaway: keyTakeaway }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); setSaving(false); return }
      onSuccess({ ...report, title, narrative, location_label: locationLabel, state, duration, what_worked: whatWorked, what_failed: whatFailed, wish_had: wishHad, key_takeaway: keyTakeaway })
    } catch { setError('Network error'); setSaving(false) }
  }

  return (
    <form onSubmit={save} style={{ marginBottom: '24px', padding: '20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>Edit Report</div>
      {error && <div style={{ marginBottom: '10px', color: '#EF4444', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div><label style={labelStyle}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} style={fieldStyle} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div><label style={labelStyle}>Location</label><input value={locationLabel} onChange={e => setLocationLabel(e.target.value)} style={fieldStyle} /></div>
          <div><label style={labelStyle}>State</label><input value={state} onChange={e => setState(e.target.value)} style={fieldStyle} /></div>
          <div><label style={labelStyle}>Duration</label><input value={duration} onChange={e => setDuration(e.target.value)} style={fieldStyle} /></div>
        </div>
        <div><label style={labelStyle}>Key Takeaway</label><input value={keyTakeaway} onChange={e => setKeyTakeaway(e.target.value)} style={fieldStyle} /></div>
        <div><label style={labelStyle}>What Worked</label><ListInput values={whatWorked} onChange={setWhatWorked} placeholder="Add item..." /></div>
        <div><label style={labelStyle}>What Failed</label><ListInput values={whatFailed} onChange={setWhatFailed} placeholder="Add item..." /></div>
        <div><label style={labelStyle}>Wish I Had</label><ListInput values={wishHad} onChange={setWishHad} placeholder="Add item..." /></div>
        <div><label style={labelStyle}>Narrative</label><textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={8} style={{ ...fieldStyle, resize: 'vertical' }} /></div>
        <button type="submit" disabled={saving} style={{ alignSelf: 'flex-end', padding: '9px 20px', borderRadius: '6px', background: 'var(--color-accent)', border: 'none', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
