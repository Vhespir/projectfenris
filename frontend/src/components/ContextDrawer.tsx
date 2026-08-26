import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useContextDrawer } from '../context/ContextDrawerContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { PostBody } from './PostBody'

interface RefData {
  id: number
  type: 'event' | 'news' | 'guide' | 'aar'
  slug: string
  title: string
  severity?: string
  source?: string
  category?: string
  url?: string
  fetched_at?: string
  published_at?: string
  incident_date?: string
  expires_at?: string
  starts_at?: string
  author?: string
  signal_count?: number
  properties?: Record<string, string>
}

interface ThreadPost {
  id: number
  post_type: string
  title: string
  body: string
  upvote_count: number
  created_at: string
  username: string | null
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

export function ContextDrawer() {
  const { slug, type, close } = useContextDrawer()
  const isMobile = useIsMobile()
  const [item, setItem] = useState<RefData | null>(null)
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) { setItem(null); setPosts([]); return }
    setLoading(true)
    const lookupUrl = `/api/refs/lookup?slug=${encodeURIComponent(slug)}${type ? `&type=${encodeURIComponent(type)}` : ''}`
    Promise.all([
      fetch(lookupUrl, { credentials: 'include' }),
      fetch(`/api/posts?ref=${encodeURIComponent(slug)}&sort=recent&limit=20`, { credentials: 'include' }),
    ]).then(async ([refRes, postsRes]) => {
      if (!refRes.ok) { setLoading(false); return }
      const [refData, postsData] = await Promise.all([refRes.json(), postsRes.ok ? postsRes.json() : []])
      setItem(refData)
      setPosts(Array.isArray(postsData) ? postsData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug, type])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!slug) return null

  const accentColor = item?.severity
    ? (SEV_COLOR[item.severity] ?? 'var(--color-accent)')
    : item?.type === 'guide' ? '#8B5CF6'
    : item?.type === 'aar' ? '#3B82F6'
    : 'var(--color-accent)'

  const drawerWidth = isMobile ? '100vw' : '400px'

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={close}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 900,
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: drawerWidth,
        background: 'var(--color-bg)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 901,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: '12px',
          position: 'sticky', top: 0,
          background: 'var(--color-bg)',
          zIndex: 1,
        }}>
          <button
            onClick={close}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-subtle)', padding: '4px', lineHeight: 1,
              fontFamily: 'var(--font-mono)', fontSize: '16px',
            }}
          >
            x
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', letterSpacing: '0.08em' }}>
            #{slug}
          </span>
        </div>

        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</span>
          </div>
        )}

        {!loading && item && (
          <div style={{ flex: 1, padding: '20px' }}>
            {/* Event/news/guide/aar card */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {item.type}
                </span>
                {item.severity && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: accentColor, fontWeight: 600 }}>{item.severity}</span>
                )}
                {item.source && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>{item.source}</span>
                )}
                {item.category && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>{item.category}</span>
                )}
              </div>

              <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35, marginBottom: '8px' }}>
                {item.title}
              </div>

              {item.properties?.areaDesc && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
                  {item.properties.areaDesc}
                </div>
              )}

              {item.expires_at && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginBottom: '8px' }}>
                  Expires {new Date(item.expires_at).toLocaleString()}
                </div>
              )}

              {item.author && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginBottom: '8px' }}>
                  by{' '}
                  <Link to={`/profile/${item.author}`} onClick={close} style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                    @{item.author}
                  </Link>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {(item.type === 'event' || item.type === 'news') && (
                  <Link
                    to={`/event/${item.slug}`}
                    onClick={close}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                      background: 'var(--color-accent)', color: '#0A0A0A',
                      padding: '5px 12px', borderRadius: '4px', textDecoration: 'none',
                    }}
                  >
                    Full thread
                  </Link>
                )}
                {item.type === 'guide' && (
                  <Link
                    to={`/compendium/${item.id}`}
                    onClick={close}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                      background: '#8B5CF6', color: '#fff',
                      padding: '5px 12px', borderRadius: '4px', textDecoration: 'none',
                    }}
                  >
                    Read guide
                  </Link>
                )}
                {item.type === 'aar' && (
                  <Link
                    to={`/post/${item.id}`}
                    onClick={close}
                    style={{
                      fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                      background: '#3B82F6', color: '#fff',
                      padding: '5px 12px', borderRadius: '4px', textDecoration: 'none',
                    }}
                  >
                    Read AAR
                  </Link>
                )}
                {item.type === 'news' && item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', textDecoration: 'none', padding: '5px 0' }}>
                    Source
                  </a>
                )}
                <Link
                  to={`/community?cite=${item.slug}`}
                  onClick={close}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    color: 'var(--color-muted)', textDecoration: 'none',
                    padding: '5px 0', marginLeft: 'auto',
                  }}
                >
                  Post about this
                </Link>
              </div>
            </div>

            {/* Intelligence thread */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                Thread
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{posts.length}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            </div>

            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>
                No posts yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {posts.map(post => (
                  <div key={post.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.15)' }}>
                      <Link to={`/profile/${post.username}`} onClick={close}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', textDecoration: 'none' }}>
                        @{post.username}
                      </Link>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <Link to={`/post/${post.id}`} onClick={close} style={{ textDecoration: 'none' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.3 }}>
                          {post.title}
                        </div>
                      </Link>
                      <PostBody text={post.body} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !item && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Not found.</span>
          </div>
        )}
      </div>
    </>
  )
}
