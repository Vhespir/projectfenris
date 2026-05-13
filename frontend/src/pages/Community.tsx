import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Post {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  location_label: string | null
  upvote_count: number
  created_at: string
  username: string | null
  is_trusted: boolean
}

const TYPE_LABELS: Record<string, string> = {
  community: 'Community',
  field_report: 'Field Report',
  self_reported_news: 'News Report',
}

const TYPE_COLOR: Record<string, string> = {
  community: 'var(--color-info)',
  field_report: 'var(--color-warning)',
  self_reported_news: 'var(--color-accent)',
}

const FIELD_REPORT_CATEGORIES = [
  'Weather Event', 'Natural Disaster', 'Infrastructure', 'Civil Unrest',
  'Hazmat or Environmental', 'Medical or Health', 'General Observation',
]

const COMMUNITY_CATEGORIES = [
  'Gear and Equipment', 'Food and Water', 'Medical and First Aid', 'Shelter and Housing',
  'Communications and Ham Radio', 'Evacuation and Bugging Out', 'Skills and Training',
  'Homesteading and Self Sufficiency', 'Off Grid Living', 'Security and Self Defense',
  'Financial Preparedness', 'Community Organizing', 'Regional Prep', 'General Discussion',
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PostCard({ post }: { post: Post }) {
  const color = TYPE_COLOR[post.post_type] ?? 'var(--color-muted)'
  return (
    <Link to={`/post/${post.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '6px', padding: '16px 20px', borderLeft: `3px solid ${color}`,
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 7px',
            borderRadius: '3px', background: `${color}18`, color, border: `1px solid ${color}40`,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {TYPE_LABELS[post.post_type] ?? post.post_type}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            {post.category}
          </span>
          {post.location_label && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
              {post.location_label}
            </span>
          )}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.4 }}>
          {post.title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
          {post.body.length > 140 ? post.body.slice(0, 140) + '...' : post.body}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
            {post.upvote_count} {post.upvote_count === 1 ? 'upvote' : 'upvotes'}
          </span>
          <span>{post.username ?? 'anonymous'}{post.is_trusted ? ' ✓' : ''}</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'field_report', label: 'Field Reports' },
  { key: 'community', label: 'Community' },
  { key: 'self_reported_news', label: 'News Reports' },
]

export default function Community() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    post_type: 'community',
    category: '',
    title: '',
    body: '',
    location_label: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function loadPosts(type = typeFilter) {
    setLoading(true)
    const url = type ? `/api/posts?type=${type}` : '/api/posts'
    fetch(url)
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadPosts() }, [typeFilter])

  const categories = form.post_type === 'field_report' ? FIELD_REPORT_CATEGORIES : COMMUNITY_CATEGORIES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setFormError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      setShowForm(false)
      setForm({ post_type: 'community', category: '', title: '', body: '', location_label: '' })
      loadPosts()
    } catch {
      setFormError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '6px', boxSizing: 'border-box' as const,
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)',
    color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Community</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>Field reports, gear discussion, and regional prep</p>
        </div>
        <button onClick={() => { if (!user) navigate('/login'); else setShowForm(v => !v) }} style={{
          padding: '9px 18px', borderRadius: '6px', fontFamily: 'var(--font-display)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
          background: 'var(--color-accent)', color: '#0A0A0A',
        }}>
          {showForm ? 'Cancel' : '+ New Post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '8px', padding: '24px', marginBottom: '24px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, margin: 0 }}>New Post</h2>

          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.post_type} onChange={e => setForm(f => ({ ...f, post_type: e.target.value, category: '' }))} style={inputStyle}>
                <option value="community">Community Post</option>
                <option value="field_report">Field Report</option>
                <option value="self_reported_news">News Report</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required style={inputStyle}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Clear, descriptive title" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Body</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required rows={5}
              placeholder="Details, context, what you're seeing..." style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>

          <div>
            <label style={labelStyle}>Location (optional)</label>
            <input value={form.location_label} onChange={e => setForm(f => ({ ...f, location_label: e.target.value }))} placeholder="City, county, or region" style={inputStyle} />
          </div>

          <button type="submit" disabled={submitting} style={{
            padding: '10px', borderRadius: '6px', fontFamily: 'var(--font-display)',
            fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
            color: submitting ? 'var(--color-muted)' : '#0A0A0A', border: 'none',
          }}>
            {submitting ? 'Posting...' : 'Submit Post'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setTypeFilter(f.key)} style={{
            padding: '5px 14px', borderRadius: '4px', fontSize: '12px',
            fontFamily: 'var(--font-display)', cursor: 'pointer',
            border: `1px solid ${typeFilter === f.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: typeFilter === f.key ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: typeFilter === f.key ? 'var(--color-accent)' : 'var(--color-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
          {loading ? 'Loading...' : `${posts.length} posts`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {posts.map(p => <PostCard key={p.id} post={p} />)}
        {!loading && posts.length === 0 && (
          <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            No posts yet. Be the first.
          </div>
        )}
      </div>
    </div>
  )
}
