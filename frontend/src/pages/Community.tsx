import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { getTier } from '../utils/tier'
import { useSocket } from '../context/SocketContext'
import { MentionTextarea } from '../components/MentionTextarea'

interface Post {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  location_label: string | null
  upvote_count: number
  downvote_count: number
  created_at: string
  username: string | null
  reputation: number
  is_founding_member?: boolean
}

interface Channel {
  id: string
  label: string
  type: string | null
  category: string | null
}

const CHANNELS: Channel[] = [
  { id: 'all',       label: 'All Posts',             type: null,                 category: null },
  { id: 'field',     label: 'Field Reports',          type: 'field_report',       category: null },
  { id: 'news',      label: 'News Reports',           type: 'self_reported_news', category: null },
  { id: 'aar',       label: 'After Action Reports',  type: 'aar',                category: null },
  { id: 'gear',      label: 'Gear and Equipment',     type: 'community',          category: 'Gear and Equipment' },
  { id: 'food',      label: 'Food and Water',         type: 'community',          category: 'Food and Water' },
  { id: 'medical',   label: 'Medical',                type: 'community',          category: 'Medical and First Aid' },
  { id: 'comms',     label: 'Communications',         type: 'community',          category: 'Communications and Ham Radio' },
  { id: 'security',  label: 'Security',               type: 'community',          category: 'Security and Self Defense' },
  { id: 'evac',      label: 'Bug Out and Evac',       type: 'community',          category: 'Evacuation and Bugging Out' },
  { id: 'homestead', label: 'Homesteading',           type: 'community',          category: 'Homesteading and Self Sufficiency' },
  { id: 'skills',    label: 'Skills and Training',    type: 'community',          category: 'Skills and Training' },
  { id: 'general',   label: 'General Discussion',     type: 'community',          category: 'General Discussion' },
]

const FIELD_REPORT_CATEGORIES = [
  'Weather Event', 'Natural Disaster', 'Infrastructure', 'Civil Unrest',
  'Hazmat or Environmental', 'Medical or Health', 'General Observation',
]

const TYPE_COLOR: Record<string, string> = {
  community:          'var(--color-info)',
  field_report:       'var(--color-warning)',
  self_reported_news: 'var(--color-accent)',
  aar:                'var(--color-danger)',
}
const TYPE_LABEL: Record<string, string> = {
  community:          'Community',
  field_report:       'Field Report',
  self_reported_news: 'News Report',
  aar:                'After Action Report',
}

const AAR_INCIDENT_TYPES = [
  { value: 'hurricane',    label: 'Hurricane' },
  { value: 'earthquake',   label: 'Earthquake' },
  { value: 'wildfire',     label: 'Wildfire' },
  { value: 'flood',        label: 'Flood' },
  { value: 'tornado',      label: 'Tornado' },
  { value: 'winter_storm', label: 'Winter Storm' },
  { value: 'power_outage', label: 'Power Outage' },
  { value: 'medical',      label: 'Medical Emergency' },
  { value: 'financial',    label: 'Financial Crisis' },
  { value: 'civil_unrest', label: 'Civil Unrest' },
  { value: 'evacuation',   label: 'Evacuation' },
  { value: 'other',        label: 'Other' },
]

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

const SORTS = [
  { key: 'recent',        label: 'Recent' },
  { key: 'signal',        label: 'Signal' },
  { key: 'proven',        label: 'Proven' },
  { key: 'controversial', label: 'Controversial' },
] as const
type Sort = typeof SORTS[number]['key']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PostCard({ post, currentUser }: { post: Post; currentUser: { id: number } | null }) {
  const navigate = useNavigate()
  const color = TYPE_COLOR[post.post_type] ?? 'var(--color-muted)'
  const [myVote, setMyVote] = useState<'up' | 'down' | null>(null)
  const [upvotes, setUpvotes] = useState(post.upvote_count)
  const [downvotes, setDownvotes] = useState(post.downvote_count)
  const [voting, setVoting] = useState(false)

  async function handleVote(dir: 'up' | 'down', e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUser) { navigate('/login'); return }
    if (voting) return
    setVoting(true)
    try {
      const endpoint = dir === 'up' ? 'upvote' : 'downvote'
      const res = await fetch(`/api/posts/${post.id}/${endpoint}`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setMyVote(data.vote)
      setUpvotes(data.upvote_count)
      setDownvotes(data.downvote_count)
    } finally { setVoting(false) }
  }

  return (
    <div
      onClick={() => navigate(`/post/${post.id}`)}
      style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${color}`, borderRadius: '6px', padding: '14px 18px',
        cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px',
          background: `${color}18`, color, border: `1px solid ${color}40`,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {TYPE_LABEL[post.post_type] ?? post.post_type}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
          {post.category}
        </span>
        {post.location_label && (
          <span style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{post.location_label}</span>
        )}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px', lineHeight: 1.4 }}>
        {post.title}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
        {post.body.length > 140 ? post.body.slice(0, 140) + '...' : post.body}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
        <button onClick={e => handleVote('up', e)} disabled={voting} style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px',
          border: `1px solid ${myVote === 'up' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
          background: myVote === 'up' ? 'rgba(34,197,94,0.12)' : 'transparent',
          color: myVote === 'up' ? 'var(--color-accent)' : 'var(--color-subtle)',
          fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: voting ? 'not-allowed' : 'pointer',
        }}>
          Signal {upvotes > 0 && upvotes}
        </button>
        <button onClick={e => handleVote('down', e)} disabled={voting} style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px',
          border: `1px solid ${myVote === 'down' ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
          background: myVote === 'down' ? 'rgba(239,68,68,0.1)' : 'transparent',
          color: myVote === 'down' ? 'var(--color-danger)' : 'var(--color-subtle)',
          fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: voting ? 'not-allowed' : 'pointer',
        }}>
          Noise {downvotes > 0 && downvotes}
        </button>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span style={{ color: 'var(--color-subtle)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {post.username ?? 'anonymous'}
          {(() => { const t = getTier(post.reputation ?? 0); return t ? (
            <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t.short}
            </span>
          ) : null })()}
          {post.is_founding_member && (
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Founder
            </span>
          )}
        </span>
        <span style={{ color: 'var(--color-subtle)' }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  )
}

export default function Community() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const socket = useSocket()
  const [searchParams, setSearchParams] = useSearchParams()

  const channelId = searchParams.get('channel') ?? 'all'
  const channel = CHANNELS.find(c => c.id === channelId) ?? CHANNELS[0]

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>('recent')
  const [search, setSearch] = useState('')
  const citeSlug = searchParams.get('cite')
  const initLat = searchParams.get('lat') ?? ''
  const initLon = searchParams.get('lon') ?? ''
  const [showForm, setShowForm] = useState(!!(citeSlug || (initLat && initLon)))
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [newPostBanner, setNewPostBanner] = useState(false)
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([])

  useEffect(() => {
    const saved = user?.preferences?.channels
    if (Array.isArray(saved)) setSubscribedChannels(saved as string[])
    else setSubscribedChannels([])
  }, [user])

  const defaultType = channel.type ?? 'community'
  const defaultCategory = channel.category ?? ''

  const [form, setForm] = useState({
    post_type: initLat && initLon ? 'field_report' : defaultType,
    category: defaultCategory,
    title: '',
    body: citeSlug ? `#${citeSlug} ` : '',
    location_label: '',
    latitude: initLat,
    longitude: initLon,
    incident_type: '',
    state: '',
    duration: '',
    what_worked: [] as string[],
    what_failed: [] as string[],
    wish_had: [] as string[],
    key_takeaway: '',
  })

  function selectChannel(id: string) {
    const ch = CHANNELS.find(c => c.id === id) ?? CHANNELS[0]
    setSearchParams({ channel: id })
    setShowForm(false)
    setSearch('')
    setForm(f => ({ ...f, post_type: ch.type ?? 'community', category: ch.category ?? '' }))
  }

  async function toggleSubscription(chId: string) {
    if (!user) { navigate('/login'); return }
    const next = subscribedChannels.includes(chId)
      ? subscribedChannels.filter(c => c !== chId)
      : [...subscribedChannels, chId]
    setSubscribedChannels(next)
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { channels: next } }),
    })
  }

  const subscribedKey = subscribedChannels.join(',')

  function loadPosts() {
    setLoading(true)
    setNewPostBanner(false)
    if (channelId === 'subscribed') {
      if (subscribedChannels.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }
      const params = new URLSearchParams({ sort, channels: subscribedChannels.join(',') })
      fetch(`/api/posts?${params}`)
        .then(r => r.json())
        .then(data => { setPosts(Array.isArray(data) ? data : []); setLoading(false) })
        .catch(() => setLoading(false))
      return
    }
    const params = new URLSearchParams({ sort })
    if (channel.type) params.set('type', channel.type)
    if (channel.category) params.set('category', channel.category)
    fetch(`/api/posts?${params}`)
      .then(r => r.json())
      .then(data => { setPosts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadPosts() }, [channelId, sort, subscribedKey])

  useEffect(() => {
    if (!socket) return
    const roomId = channelId === 'subscribed' ? 'all' : channelId
    socket.emit('join_channel', roomId)
    const handler = () => setNewPostBanner(true)
    socket.on('new_post', handler)
    return () => {
      socket.emit('leave_channel', roomId)
      socket.off('new_post', handler)
    }
  }, [socket, channelId])

  function handleGetLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(5), longitude: pos.coords.longitude.toFixed(5) })); setLocating(false) },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error); return }
      setShowForm(false)
      setForm(f => ({ ...f, title: '', body: '', location_label: '', latitude: '', longitude: '' }))
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

  const isFixedChannel = !!(channel.type && channel.category)
  const formCategories = form.post_type === 'field_report' ? FIELD_REPORT_CATEGORIES : CHANNELS.filter(c => c.type === 'community' && c.category).map(c => c.category!)

  const displayed = search.trim()
    ? posts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.body.toLowerCase().includes(search.toLowerCase()) ||
        (p.location_label ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : posts

  const SYSTEM_CHANNELS = CHANNELS.slice(0, 3)
  const TOPIC_CHANNELS = CHANNELS.slice(3)

  const channelSidebarBtnStyle = (active: boolean) => ({
    display: 'block' as const, width: '100%', textAlign: 'left' as const,
    padding: '7px 10px', borderRadius: '5px', cursor: 'pointer', marginBottom: '1px',
    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
    border: 'none' as const,
    color: active ? 'var(--color-text)' : 'var(--color-muted)',
    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: active ? 600 : 400,
    borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
  })

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* Sidebar -- desktop */}
        {!isMobile && (
          <div style={{ width: '200px', flexShrink: 0, position: 'sticky', top: '80px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', paddingLeft: '10px' }}>
              Community
            </div>

            {user && (
              <button onClick={() => selectChannel('subscribed')} style={channelSidebarBtnStyle(channelId === 'subscribed')}>
                {subscribedChannels.length > 0 ? '★' : '☆'} Subscribed
              </button>
            )}

            {SYSTEM_CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch.id)}
                style={channelSidebarBtnStyle(channelId === ch.id)}
              >
                {ch.id === 'field' ? '! ' : ch.id === 'news' ? '~ ' : '# '}{ch.label}
              </button>
            ))}

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '16px 0 8px', paddingLeft: '10px' }}>
              Topics
            </div>

            {TOPIC_CHANNELS.map(ch => {
              const isSubbed = subscribedChannels.includes(ch.id)
              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '1px' }}>
                  <button
                    onClick={() => selectChannel(ch.id)}
                    style={{ ...channelSidebarBtnStyle(channelId === ch.id), flex: 1, marginBottom: 0 }}
                  >
                    # {ch.label}
                  </button>
                  {user && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleSubscription(ch.id) }}
                      title={isSubbed ? 'Unsubscribe' : 'Subscribe'}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px 5px', borderRadius: '4px', lineHeight: 1,
                        color: isSubbed ? 'var(--color-accent)' : 'var(--color-subtle)',
                        fontSize: '13px', flexShrink: 0,
                      }}
                    >
                      {isSubbed ? '★' : '☆'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              {isMobile ? (
                <select
                  value={channelId}
                  onChange={e => selectChannel(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', fontSize: '15px', fontWeight: 600, paddingLeft: '8px' }}
                >
                  {user && <option value="subscribed">{subscribedChannels.length > 0 ? '★' : '☆'} Subscribed</option>}
                  {SYSTEM_CHANNELS.map(ch => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                  <option disabled>-- Topics --</option>
                  {TOPIC_CHANNELS.map(ch => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                </select>
              ) : (
                <div>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '2px' }}>
                    {channelId === 'subscribed' ? '★ Subscribed' : channel.id === 'all' ? '# ' : channel.type === 'field_report' ? '! ' : channel.type === 'self_reported_news' ? '~ ' : '# '}{channelId !== 'subscribed' && channel.label}
                  </h1>
                  {loading ? null : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>
                      {posts.length} post{posts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
            {channelId !== 'subscribed' && <button
              onClick={() => { if (!user) navigate('/login'); else setShowForm(v => !v) }}
              style={{
                padding: '8px 16px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: showForm ? 'var(--color-surface)' : 'var(--color-accent)',
                color: showForm ? 'var(--color-muted)' : '#0A0A0A',
                border: showForm ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {showForm ? 'Cancel' : '+ Post'}
            </button>}
          </div>

          {/* Post form */}
          {showForm && (
            <form onSubmit={handleSubmit} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '8px', padding: '20px', marginBottom: '20px',
              display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                New post in {channel.label}
              </div>

              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '13px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}

              {/* Type + category -- only shown when not a fixed channel */}
              {!isFixedChannel && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={form.post_type} onChange={e => setForm(f => ({ ...f, post_type: e.target.value, category: '' }))} style={inputStyle}>
                      <option value="community">Community Post</option>
                      <option value="field_report">Field Report</option>
                      <option value="self_reported_news">News Report</option>
                      <option value="aar">After Action Report</option>
                    </select>
                  </div>
                  {form.post_type !== 'self_reported_news' && form.post_type !== 'aar' && (
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required style={inputStyle}>
                        <option value="">Select...</option>
                        {formCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {form.post_type === 'aar' && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Incident Type</label>
                    <select value={form.incident_type} onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))} required style={inputStyle}>
                      <option value="">Select...</option>
                      {AAR_INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>State (optional)</label>
                    <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Texas" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Duration (optional)</label>
                    <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 3 days" style={inputStyle} />
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Clear, descriptive title" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>{form.post_type === 'aar' ? 'Narrative' : 'Body'}</label>
                <MentionTextarea
                  value={form.body}
                  onChange={v => setForm(f => ({ ...f, body: v }))}
                  rows={4}
                  placeholder={form.post_type === 'aar'
                    ? 'What happened, in your own words.'
                    : "Details, context, what you're seeing... Type @ to mention a user or # to cite an event/news item."}
                  style={{ ...inputStyle, resize: 'vertical' as const, width: '100%' }}
                />
              </div>

              {form.post_type === 'aar' && (
                <>
                  <div>
                    <label style={labelStyle}>What Worked</label>
                    <ListInput values={form.what_worked} onChange={v => setForm(f => ({ ...f, what_worked: v }))} placeholder="Add something that worked, press Enter" />
                  </div>
                  <div>
                    <label style={labelStyle}>What Failed</label>
                    <ListInput values={form.what_failed} onChange={v => setForm(f => ({ ...f, what_failed: v }))} placeholder="Add something that failed, press Enter" />
                  </div>
                  <div>
                    <label style={labelStyle}>What You Wish You Had</label>
                    <ListInput values={form.wish_had} onChange={v => setForm(f => ({ ...f, wish_had: v }))} placeholder="Add something you wish you'd had, press Enter" />
                  </div>
                  <div>
                    <label style={labelStyle}>Key Takeaway (optional)</label>
                    <input value={form.key_takeaway} onChange={e => setForm(f => ({ ...f, key_takeaway: e.target.value }))} placeholder="The one thing worth remembering" style={inputStyle} />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Location (optional)</label>
                <input value={form.location_label} onChange={e => setForm(f => ({ ...f, location_label: e.target.value }))} placeholder="City, county, or region" style={inputStyle} />
              </div>

              {form.post_type === 'field_report' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Pin to Map (optional)</label>
                    <button type="button" onClick={handleGetLocation} disabled={locating} style={{
                      padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                      cursor: locating ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)',
                      background: 'transparent', color: locating ? 'var(--color-subtle)' : 'var(--color-accent)',
                    }}>
                      {locating ? 'Locating...' : 'Use my location'}
                    </button>
                    {form.latitude && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, latitude: '', longitude: '' }))} style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                        cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-subtle)',
                      }}>Clear</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                    <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Latitude" style={inputStyle} />
                    <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Longitude" style={inputStyle} />
                  </div>
                  {form.latitude && <div style={{ marginTop: '5px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>Will appear as a pin on the map</div>}
                </div>
              )}

              <button type="submit" disabled={submitting} style={{
                padding: '10px', borderRadius: '6px', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? 'var(--color-border)' : 'var(--color-accent)',
                color: submitting ? 'var(--color-muted)' : '#0A0A0A', border: 'none',
              }}>
                {submitting ? 'Posting...' : 'Submit Post'}
              </button>
            </form>
          )}

          {/* New post banner */}
          {newPostBanner && (
            <button
              onClick={() => { setNewPostBanner(false); loadPosts() }}
              style={{
                width: '100%', marginBottom: '10px', padding: '9px 16px',
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                fontSize: '12px', color: 'var(--color-accent)', textAlign: 'center',
                letterSpacing: '0.03em',
              }}
            >
              New posts available -- click to refresh
            </button>
          )}

          {/* Sort + search */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSort(s.key)} style={{
                padding: '5px 12px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)',
                cursor: 'pointer', letterSpacing: '0.03em', fontWeight: sort === s.key ? 600 : 400,
                border: `1px solid ${sort === s.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: sort === s.key ? 'rgba(34,197,94,0.1)' : 'transparent',
                color: sort === s.key ? 'var(--color-accent)' : 'var(--color-muted)',
              }}>
                {s.label}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto', padding: '5px 12px', borderRadius: '4px', width: '160px',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontSize: '13px', fontFamily: 'var(--font-body)', outline: 'none',
              }}
            />
          </div>

          {/* Posts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>
                Loading...
              </div>
            ) : channelId === 'subscribed' && subscribedChannels.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>☆</div>
                <div style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                  No subscriptions yet
                </div>
                <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {isMobile ? 'Switch to a topic channel to subscribe.' : 'Star topics in the sidebar to subscribe.'}
                </div>
              </div>
            ) : displayed.length === 0 ? (
              <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '60px 0', textAlign: 'center' }}>
                {search ? `No posts match "${search}".` : 'No posts yet. Be the first.'}
              </div>
            ) : (
              displayed.map(p => <PostCard key={p.id} post={p} currentUser={user} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
