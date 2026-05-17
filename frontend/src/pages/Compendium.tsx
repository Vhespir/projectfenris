import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { getTier } from '../utils/tier'

interface Guide {
  id: number
  title: string
  body: string
  category: string
  region: string | null
  signal_count: number
  noise_count: number
  created_at: string
  username: string | null
  reputation: number
  is_founding_member?: boolean
}

const CATEGORIES = [
  'Beginner Guides',
  'Advanced Techniques',
  'Regional Specific',
  'Gear Reviews',
  'DIY and Build',
  'Medical References',
  'Comms and Technology',
  'Homesteading and Farming',
  'Off Grid Systems',
  'Ham Radio and Comms',
  'Security and Defense',
  'Financial Resilience',
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}y ago`
}


function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link to={`/compendium/${guide.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '6px', padding: '18px 20px', transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 7px',
            borderRadius: '3px', background: 'rgba(34,197,94,0.08)', color: 'var(--color-accent)',
            border: '1px solid rgba(34,197,94,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {guide.category}
          </span>
          {guide.region && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              {guide.region}
            </span>
          )}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.4 }}>
          {guide.title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
          {guide.body.length > 140 ? guide.body.slice(0, 140) + '...' : guide.body}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
          {guide.signal_count > 0
            ? <span style={{ color: 'var(--color-accent)' }}>{guide.signal_count} signal</span>
            : <span style={{ color: 'var(--color-subtle)' }}>No votes yet</span>
          }
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>{guide.username ?? 'anonymous'}</span>
            {(() => { const t = getTier(guide.reputation ?? 0); return t ? (
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t.short}
              </span>
            ) : null })()}
            {guide.is_founding_member && (
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Founder
              </span>
            )}
          </span>
          <span>{timeAgo(guide.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '6px', boxSizing: 'border-box' as const,
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)',
  color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

export default function Compendium() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: '', region: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function loadGuides(category = activeCategory) {
    setLoading(true)
    const params = category ? `?category=${encodeURIComponent(category)}` : ''
    fetch(`/api/guides${params}`)
      .then(r => r.json())
      .then(data => { setGuides(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadGuides() }, [activeCategory])

  const displayed = search
    ? guides.filter(g => g.title.toLowerCase().includes(search.toLowerCase()) || g.body.toLowerCase().includes(search.toLowerCase()))
    : guides

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      setShowForm(false)
      setForm({ title: '', body: '', category: '', region: '' })
      loadGuides()
    } catch {
      setFormError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Compendium</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Community guides and resources. Practical, evergreen, voted on by the people who use them.</p>
        </div>
        <button onClick={() => { if (!user) navigate('/login'); else setShowForm(v => !v) }} style={{
          padding: '9px 18px', borderRadius: '6px', fontFamily: 'var(--font-display)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
          background: showForm ? 'var(--color-surface)' : 'var(--color-accent)',
          color: showForm ? 'var(--color-muted)' : '#0A0A0A',
          borderWidth: showForm ? '1px' : '0', borderStyle: 'solid', borderColor: 'var(--color-border)',
        }}>
          {showForm ? 'Cancel' : '+ Submit Guide'}
        </button>
      </div>

      {/* Submit form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '8px', padding: '24px', marginBottom: '28px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, margin: 0 }}>Submit a Guide</h2>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required style={inputStyle}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Region (optional)</label>
              <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="e.g. Pacific Northwest, Texas Gulf Coast" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Clear, descriptive title" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Content</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required rows={8}
              placeholder="Write your guide here. Be specific, be practical." style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>
          <button type="submit" disabled={submitting} style={{
            padding: '10px', borderRadius: '6px', fontFamily: 'var(--font-display)',
            fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
            color: submitting ? 'var(--color-muted)' : '#0A0A0A', border: 'none',
          }}>
            {submitting ? 'Submitting...' : 'Submit Guide'}
          </button>
        </form>
      )}

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guides..."
          style={{
            ...inputStyle,
            fontSize: '14px', padding: '10px 14px',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Category sidebar */}
        <div style={isMobile ? { overflowX: 'auto', paddingBottom: '4px' } : { position: 'sticky', top: '80px' }}>
          {!isMobile && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Categories
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? '6px' : '2px' }}>
            <button onClick={() => setActiveCategory('')} style={{
              textAlign: 'left', padding: '6px 10px', borderRadius: '4px', fontSize: '12px',
              fontFamily: 'var(--font-display)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              border: `1px solid ${activeCategory === '' ? 'rgba(34,197,94,0.4)' : isMobile ? 'var(--color-border)' : 'transparent'}`,
              background: activeCategory === '' ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: activeCategory === '' ? 'var(--color-accent)' : 'var(--color-muted)',
            }}>
              All Guides
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                textAlign: 'left', padding: '6px 10px', borderRadius: '4px', fontSize: '12px',
                fontFamily: 'var(--font-display)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                border: `1px solid ${activeCategory === cat ? 'rgba(34,197,94,0.4)' : isMobile ? 'var(--color-border)' : 'transparent'}`,
                background: activeCategory === cat ? 'rgba(34,197,94,0.1)' : 'transparent',
                color: activeCategory === cat ? 'var(--color-accent)' : 'var(--color-muted)',
              }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Guides list */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', marginBottom: '16px' }}>
            {loading ? 'Loading...' : `${displayed.length} guide${displayed.length !== 1 ? 's' : ''}`}
          </div>

          {!loading && displayed.length === 0 && (
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: '8px',
              padding: '64px 32px', textAlign: 'center',
              background: 'var(--color-surface)',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>
                No guides yet{activeCategory ? ` in ${activeCategory}` : ''}.
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
                Be the first to contribute. High-rated guides surface to the top and earn contributor badges.
              </p>
              <button onClick={() => { if (!user) navigate('/login'); else setShowForm(true) }} style={{
                padding: '9px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
                background: 'var(--color-accent)', color: '#0A0A0A',
              }}>
                Submit the first guide
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map(g => <GuideCard key={g.id} guide={g} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
