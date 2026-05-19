import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { PostBody } from '../components/PostBody'

interface ThreadEvent {
  id: number
  type: 'event' | 'news'
  slug: string
  title: string
  severity?: string
  source: string
  category?: string
  url?: string
  event_type?: string
  fetched_at?: string
  published_at?: string
  starts_at?: string | null
  expires_at?: string | null
  properties?: Record<string, unknown>
}

interface ThreadPost {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  upvote_count: number
  created_at: string
  username: string | null
  is_trusted: boolean
}

const SEV_COLOR: Record<string, string> = {
  Extreme: '#EF4444', Severe: '#EF4444', Moderate: '#F59E0B', Minor: '#22C55E',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CiteButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(`#${slug}`).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      style={{
        background: 'transparent',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'var(--color-border)'}`,
        borderRadius: '5px', padding: '6px 14px', cursor: 'pointer',
        fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.06em',
        color: copied ? 'var(--color-accent)' : 'var(--color-muted)',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {copied ? 'Copied!' : `Cite #${slug}`}
    </button>
  )
}

export default function EventThread() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [item, setItem] = useState<ThreadEvent | null>(null)
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      fetch(`/api/refs/lookup?slug=${encodeURIComponent(slug.toUpperCase())}`, { credentials: 'include' }),
      fetch(`/api/posts?ref=${encodeURIComponent(slug.toUpperCase())}&sort=recent&limit=50`, { credentials: 'include' }),
    ]).then(async ([refRes, postsRes]) => {
      if (!refRes.ok) { setNotFound(true); setLoading(false); return }
      const [refData, postsData] = await Promise.all([refRes.json(), postsRes.ok ? postsRes.json() : []])
      setItem(refData)
      setPosts(Array.isArray(postsData) ? postsData : [])
      setLoading(false)
    }).catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</span>
    </div>
  )

  if (notFound || !item) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)' }}>#{slug} not found.</span>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
        Go back
      </button>
    </div>
  )

  const accentColor = item.severity ? (SEV_COLOR[item.severity] ?? 'var(--color-accent)') : 'var(--color-accent)'
  const timestamp = item.fetched_at ?? item.published_at
  const p = (item.properties ?? {}) as Record<string, string>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: isMobile ? '24px 16px' : '40px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: 0, marginBottom: '24px', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Back
        </button>

        {/* Event/news header card */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderLeft: `4px solid ${accentColor}`, borderRadius: '8px',
          padding: '20px 24px', marginBottom: '32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {item.type === 'event' ? 'EVENT' : 'NEWS'}
            </span>
            {item.severity && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: accentColor, letterSpacing: '0.08em', fontWeight: 600 }}>{item.severity}</span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.source}
            </span>
            {item.category && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.04em' }}>{item.category}</span>
            )}
            {timestamp && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(timestamp)}</span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3, marginBottom: '10px' }}>
            {item.title}
          </h1>

          {p.areaDesc && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
              {p.areaDesc}
            </div>
          )}

          {item.expires_at && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', marginBottom: '10px' }}>
              Expires {new Date(item.expires_at).toLocaleString()}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            <CiteButton slug={item.slug} />
            <Link
              to={`/community?cite=${item.slug}`}
              style={{
                padding: '6px 14px', borderRadius: '5px', fontSize: '12px',
                fontFamily: 'var(--font-display)', fontWeight: 600,
                background: 'var(--color-accent)', color: '#0A0A0A',
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              Post about this
            </Link>
            {item.type === 'news' && item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)', textDecoration: 'none', letterSpacing: '0.04em' }}>
                Source
              </a>
            )}
          </div>
        </div>

        {/* Intelligence thread */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Intelligence Thread
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{posts.length}</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)', lineHeight: 2 }}>
            No posts yet.<br />
            <Link to={`/community?cite=${item.slug}`} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
              Be the first to post about this.
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {post.post_type.replace(/_/g, ' ')}
                  </span>
                  <Link to={`/profile/${post.username}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                    @{post.username}
                  </Link>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>
                    {timeAgo(post.created_at)}
                  </span>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <Link to={`/post/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '10px', lineHeight: 1.35 }}>
                      {post.title}
                    </div>
                  </Link>
                  <PostBody text={post.body} />
                </div>
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
                    {post.upvote_count} signal
                  </span>
                  <Link to={`/post/${post.id}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', textDecoration: 'none', marginLeft: 'auto', letterSpacing: '0.04em' }}>
                    View post
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
