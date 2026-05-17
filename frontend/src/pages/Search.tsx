import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'

type ResultType = 'all' | 'posts' | 'guides' | 'events' | 'news'

interface PostResult {
  id: number
  type: 'post'
  post_type: string
  category: string
  title: string
  snippet: string
  upvote_count: number
  created_at: string
  username: string
}

interface GuideResult {
  id: number
  type: 'guide'
  category: string
  title: string
  snippet: string
  signal_count: number
  created_at: string
  username: string
}

interface EventResult {
  id: number
  type: 'event'
  source: string
  event_type: string
  title: string
  severity: string
  fetched_at: string
}

interface NewsResult {
  id: number
  type: 'news'
  source: string
  title: string
  url: string
  snippet: string
  category: string
  published_at: string
}

interface SearchResults {
  query: string
  posts: PostResult[]
  guides: GuideResult[]
  events: EventResult[]
  news: NewsResult[]
}

const SEV_COLORS: Record<string, string> = {
  Extreme: '#EF4444',
  Severe:  '#EF4444',
  Moderate:'#F59E0B',
  Minor:   '#22C55E',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '12px', marginTop: '28px',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.1em', color: 'var(--color-accent)', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)',
      }}>{count}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
    </div>
  )
}

export default function Search() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const initialQ = searchParams.get('q') ?? ''
  const [inputVal, setInputVal] = useState(initialQ)
  const [activeTab, setActiveTab] = useState<ResultType>('all')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setInputVal(q)
    if (!q || q.length < 2) { setResults(null); return }
    runSearch(q)
  }, [searchParams])

  async function runSearch(q: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { setError('Search failed. Try again.'); setLoading(false); return }
      setResults(await res.json())
    } catch {
      setError('Search unavailable.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = inputVal.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const tabs: { id: ResultType; label: string; count: number }[] = results ? [
    { id: 'all',    label: 'All',    count: results.posts.length + results.guides.length + results.events.length + results.news.length },
    { id: 'posts',  label: 'Posts',  count: results.posts.length },
    { id: 'guides', label: 'Guides', count: results.guides.length },
    { id: 'events', label: 'Events', count: results.events.length },
    { id: 'news',   label: 'News',   count: results.news.length },
  ] : []

  const totalCount = results
    ? results.posts.length + results.guides.length + results.events.length + results.news.length
    : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: isMobile ? '24px 16px' : '40px 24px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Search input */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-subtle)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Search posts, guides, events, news..."
              style={{
                width: '100%', padding: '13px 14px 13px 42px',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: '8px', color: 'var(--color-text)',
                fontFamily: 'var(--font-body)', fontSize: '15px', outline: 'none',
              }}
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => { setInputVal(''); setResults(null); navigate('/search'); inputRef.current?.focus() }}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer',
                  fontSize: '18px', lineHeight: 1, padding: '2px',
                }}
              >
                x
              </button>
            )}
          </div>
        </form>

        {/* Status */}
        {loading && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', marginBottom: '16px' }}>
            Searching...
          </div>
        )}
        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-danger)', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        {results && !loading && (
          <>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                    background: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: activeTab === tab.id ? '#0A0A0A' : 'var(--color-muted)',
                    border: `1px solid ${activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  {tab.label} {tab.count > 0 && <span style={{ opacity: 0.7 }}>({tab.count})</span>}
                </button>
              ))}
            </div>

            {totalCount === 0 ? (
              <div style={{
                marginTop: '48px', textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)',
              }}>
                No results for "{results.query}"
              </div>
            ) : (
              <>
                {/* Posts */}
                {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                  <>
                    <SectionLabel label="Community Posts" count={results.posts.length} />
                    {results.posts.map(p => (
                      <Link key={p.id} to={`/post/${p.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                        <div style={{
                          padding: '14px 16px', marginBottom: '6px',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: '8px', transition: 'border-color 0.15s',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>{p.post_type}</span>
                            <span style={{ color: 'var(--color-border)', fontSize: '10px' }}>·</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{p.category}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '6px' }}>
                            {p.snippet}{p.snippet?.length >= 200 ? '...' : ''}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
                            {p.username} · {timeAgo(p.created_at)} · {p.upvote_count} signal
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}

                {/* Guides */}
                {(activeTab === 'all' || activeTab === 'guides') && results.guides.length > 0 && (
                  <>
                    <SectionLabel label="Compendium Guides" count={results.guides.length} />
                    {results.guides.map(g => (
                      <Link key={g.id} to={`/compendium/${g.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                        <div style={{
                          padding: '14px 16px', marginBottom: '6px',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            {g.category}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                            {g.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '6px' }}>
                            {g.snippet}{g.snippet?.length >= 200 ? '...' : ''}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
                            {g.username} · {timeAgo(g.created_at)} · {g.signal_count} signal
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}

                {/* Events */}
                {(activeTab === 'all' || activeTab === 'events') && results.events.length > 0 && (
                  <>
                    <SectionLabel label="Live Events" count={results.events.length} />
                    {results.events.map(e => (
                      <Link key={e.id} to="/map" style={{ display: 'block', textDecoration: 'none' }}>
                        <div style={{
                          padding: '14px 16px', marginBottom: '6px',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderLeft: `3px solid ${SEV_COLORS[e.severity] ?? 'var(--color-border)'}`,
                          borderRadius: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {e.severity && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                                color: SEV_COLORS[e.severity] ?? 'var(--color-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                              }}>{e.severity}</span>
                            )}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase' }}>
                              {e.source}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                            {e.title}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
                            {e.event_type.replace(/_/g, ' ')} · {timeAgo(e.fetched_at)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}

                {/* News */}
                {(activeTab === 'all' || activeTab === 'news') && results.news.length > 0 && (
                  <>
                    <SectionLabel label="News" count={results.news.length} />
                    {results.news.map(n => (
                      <a key={n.id} href={n.url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                        <div style={{
                          padding: '14px 16px', marginBottom: '6px',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            {n.source}{n.category ? ` · ${n.category}` : ''}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                            {n.title}
                          </div>
                          {n.snippet && (
                            <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '6px' }}>
                              {n.snippet}{n.snippet?.length >= 200 ? '...' : ''}
                            </div>
                          )}
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
                            {n.published_at ? timeAgo(n.published_at) : ''}
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Empty state -- no query yet */}
        {!results && !loading && !error && (
          <div style={{
            marginTop: '80px', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-subtle)', lineHeight: 2,
          }}>
            Search across community posts, guides, live events, and news.
          </div>
        )}
      </div>
    </div>
  )
}
