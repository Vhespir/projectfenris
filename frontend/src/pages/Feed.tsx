import { useEffect, useState } from 'react'

interface EventItem {
  id: number
  source: string
  event_type: string
  title: string
  severity: string
  fetched_at: string
  expires_at: string | null
  properties: Record<string, unknown>
}

interface NewsItem {
  id: number
  source: string
  title: string
  url: string | null
  summary: string | null
  category: string | null
  region: string | null
  published_at: string | null
}

type FeedItem =
  | ({ kind: 'event' } & EventItem)
  | ({ kind: 'news' } & NewsItem)

const SEVERITY_COLOR: Record<string, string> = {
  Extreme: 'var(--color-danger)',
  Severe: 'var(--color-danger)',
  Moderate: 'var(--color-warning)',
  Minor: 'var(--color-accent)',
}

const SOURCE_LABEL: Record<string, string> = {
  noaa: 'NOAA',
  usgs: 'USGS',
  fema: 'FEMA',
  epa: 'EPA',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function SourceBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontFamily: 'var(--font-mono)',
      padding: '2px 7px', borderRadius: '3px',
      background: verified ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.15)',
      color: verified ? 'var(--color-accent)' : 'var(--color-muted)',
      border: `1px solid ${verified ? 'rgba(34,197,94,0.25)' : 'var(--color-border)'}`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {verified && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }} />}
      {label}
    </span>
  )
}

function EventCard({ item }: { item: EventItem }) {
  const color = SEVERITY_COLOR[item.severity] ?? 'var(--color-muted)'
  const p = item.properties as Record<string, string>
  const areaDesc = p.areaDesc

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '6px', padding: '16px 20px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <SourceBadge label={SOURCE_LABEL[item.source] ?? item.source} verified={true} />
        <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          {item.event_type}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '11px',
          color, fontFamily: 'var(--font-mono)', fontWeight: 600,
        }}>
          {item.severity}
        </span>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.4 }}>
        {item.title}
      </div>
      {areaDesc && (
        <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '6px' }}>
          {areaDesc.length > 120 ? areaDesc.slice(0, 120) + '...' : areaDesc}
        </div>
      )}
      <div style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
        {timeAgo(item.fetched_at)}
        {item.expires_at && ` · expires ${timeAgo(item.expires_at).replace(' ago', '')}`}
      </div>
    </div>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '6px', padding: '16px 20px',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <SourceBadge label={item.source} verified={true} />
          {item.category && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              {item.category}
            </span>
          )}
          {item.region && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{item.region}</span>
          )}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px', lineHeight: 1.4 }}>
          {item.title}
        </div>
        {item.summary && (
          <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '6px', lineHeight: 1.5 }}>
            {item.summary.length > 160 ? item.summary.slice(0, 160) + '...' : item.summary}
          </div>
        )}
        {item.published_at && (
          <div style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
            {timeAgo(item.published_at)}
          </div>
        )}
      </div>
    </a>
  )
}

const FILTERS = ['all', 'noaa', 'usgs', 'fema', 'news'] as const
type Filter = typeof FILTERS[number]

export default function FeedPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/events?limit=200').then(r => r.json()),
      fetch('/api/news?limit=100').then(r => r.json()),
    ]).then(([evts, nws]) => {
      setEvents(evts)
      setNews(nws)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const combined: FeedItem[] = [
    ...events.map(e => ({ kind: 'event' as const, ...e })),
    ...news.map(n => ({ kind: 'news' as const, ...n })),
  ].sort((a, b) => {
    const dateA = a.kind === 'event' ? a.fetched_at : (a.published_at ?? a.fetched_at ?? '')
    const dateB = b.kind === 'event' ? b.fetched_at : (b.published_at ?? b.fetched_at ?? '')
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })

  const filtered = combined.filter(item => {
    if (filter === 'news') return item.kind === 'news'
    if (filter !== 'all' && item.kind === 'event' && item.source !== filter) return false
    if (filter !== 'all' && item.kind === 'news') return false
    if (severityFilter !== 'all' && item.kind === 'event' && item.severity !== severityFilter) return false
    return true
  })

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          Live Feed
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
          Verified alerts and news from official sources
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: '4px', fontSize: '12px',
            fontFamily: 'var(--font-display)', cursor: 'pointer',
            border: `1px solid ${filter === f ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: filter === f ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: filter === f ? 'var(--color-accent)' : 'var(--color-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {f === 'all' ? 'All' : f.toUpperCase()}
          </button>
        ))}

        {(filter === 'all' || ['noaa', 'usgs', 'fema'].includes(filter)) && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {['all', 'Extreme', 'Severe', 'Moderate', 'Minor'].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)} style={{
                padding: '5px 10px', borderRadius: '4px', fontSize: '11px',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                border: `1px solid ${severityFilter === s ? (SEVERITY_COLOR[s] ?? 'var(--color-accent)') : 'var(--color-border)'}`,
                background: severityFilter === s ? `${SEVERITY_COLOR[s]}18` : 'transparent',
                color: severityFilter === s ? (SEVERITY_COLOR[s] ?? 'var(--color-accent)') : 'var(--color-muted)',
              }}>
                {s === 'all' ? 'All Severity' : s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginBottom: '20px' }}>
        {loading ? 'Loading...' : `${filtered.length} items`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(item =>
          item.kind === 'event'
            ? <EventCard key={`e-${item.id}`} item={item} />
            : <NewsCard key={`n-${item.id}`} item={item} />
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            No items match the current filter
          </div>
        )}
      </div>
    </div>
  )
}
