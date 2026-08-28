import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getTier } from '../utils/tier'
import { useContextDrawer } from '../context/ContextDrawerContext'
import { fetchFeedSourceCatalog, subscribedSourceIds, sourceQueryValues, type FeedSourceCatalog } from '../utils/feedSources'

interface GeoJSON {
  type: string
  coordinates: unknown
}

interface EventItem {
  id: number
  source: string
  event_type: string
  title: string
  severity: string
  slug: string | null
  fetched_at: string
  expires_at: string | null
  properties: Record<string, unknown>
  geometry: GeoJSON | null
  discussion_count: number
}

const RADIUS_OPTIONS = [100, 250, 500, 1000]

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function eventCentroid(geom: GeoJSON | null): [number, number] | null {
  if (!geom) return null
  const coords = geom.coordinates
  if (geom.type === 'Point') {
    const [lon, lat] = coords as number[]
    return [lat, lon]
  }
  let ring: number[][]
  if (geom.type === 'Polygon') ring = (coords as number[][][])[0]
  else if (geom.type === 'MultiPolygon') ring = (coords as number[][][][])[0][0]
  else return null
  const lats = ring.map(c => c[1])
  const lons = ring.map(c => c[0])
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ]
}

interface NewsItem {
  id: number
  source: string
  title: string
  url: string | null
  summary: string | null
  category: string | null
  region: string | null
  slug: string | null
  published_at: string | null
  discussion_count: number
}

interface PostItem {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  location_label: string | null
  upvote_count: number
  created_at: string
  username: string | null
  reputation: number
  is_founding_member?: boolean
}

type FeedItem =
  | ({ kind: 'event' } & EventItem)
  | ({ kind: 'news' } & NewsItem)
  | ({ kind: 'post' } & PostItem)

const SEVERITY_COLOR: Record<string, string> = {
  Extreme:  'var(--color-danger)',
  Severe:   'var(--color-danger)',
  Moderate: 'var(--color-warning)',
  Minor:    'var(--color-accent)',
}

const SOURCE_LABEL: Record<string, string> = {
  noaa: 'NOAA', usgs: 'USGS', gdacs: 'GDACS', epa: 'EPA', eonet: 'EONET', meteoalarm: 'MeteoAlarm',
}

const CAT_COLOR: Record<string, string> = {
  emergency: '#EF4444', health: '#EC4899', cybersecurity: '#3B82F6',
  recall: '#F59E0B', travel: '#A78BFA', nuclear: '#22C55E',
  hurricane: '#F97316', tsunami: '#06B6D4', wildfire: '#F97316',
  preparedness: '#84CC16', environment: '#22C55E', news: '#6B7280',
  geopolitical: '#8B5CF6', financial: '#10B981', security: '#EF4444',
  comms: '#06B6D4', infrastructure: '#F59E0B', space_weather: '#FBBF24',
  science: '#06B6D4',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function CiteButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => {
        e.preventDefault(); e.stopPropagation()
        navigator.clipboard.writeText(`#${slug}`).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      style={{
        background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px',
        color: copied ? 'var(--color-accent)' : 'var(--color-subtle)',
        fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
        padding: '2px 7px', cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
        borderColor: copied ? 'rgba(34,197,94,0.4)' : 'var(--color-border)',
      }}
    >
      {copied ? 'Copied!' : `#${slug}`}
    </button>
  )
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
  const { open: openDrawer } = useContextDrawer()
  const navigate = useNavigate()
  const centroid = item.geometry ? eventCentroid(item.geometry) : null

  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '6px', padding: '14px 18px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
        <SourceBadge label={SOURCE_LABEL[item.source] ?? item.source.toUpperCase()} verified={true} />
        <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {item.event_type.replace(/_/g, ' ')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {item.severity}
        </span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '5px', lineHeight: 1.4 }}>
        {item.title}
      </div>
      {p.areaDesc && (
        <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '8px' }}>
          {p.areaDesc.length > 120 ? p.areaDesc.slice(0, 120) + '...' : p.areaDesc}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', flex: 1 }}>
          {timeAgo(item.fetched_at)}
          {item.expires_at && ` · expires ${new Date(item.expires_at).toLocaleString()}`}
        </span>
        {centroid && (
          <button
            onClick={e => { e.stopPropagation(); navigate('/map', { state: { flyTo: { lat: centroid[0], lon: centroid[1] } } }) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px',
              cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--color-muted)', letterSpacing: '0.04em', padding: '2px 7px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-accent)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5"/>
              <ellipse cx="8" cy="8" rx="3" ry="6" stroke="currentColor" strokeWidth="1"/>
            </svg>
            Map
          </button>
        )}
        {item.slug && (
          <>
            <CiteButton slug={item.slug} />
            <button
              onClick={e => { e.stopPropagation(); openDrawer(item.slug!, 'event') }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', letterSpacing: '0.04em', padding: 0 }}
            >
              {item.discussion_count > 0 ? `${item.discussion_count} discussion${item.discussion_count !== 1 ? 's' : ''}` : 'Discuss'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  const { open: openDrawer } = useContextDrawer()
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '14px 18px' }}>
      <a href={item.url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
          <SourceBadge label={item.source} verified={true} />
          {item.category && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.category}
            </span>
          )}
          {item.region && <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{item.region}</span>}
          {item.published_at && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
              {timeAgo(item.published_at)}
            </span>
          )}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '5px', lineHeight: 1.4 }}>
          {item.title}
        </div>
        {item.summary && (
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '8px' }}>
            {item.summary.length > 160 ? item.summary.slice(0, 160) + '...' : item.summary}
          </div>
        )}
      </a>
      {item.slug && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
          <CiteButton slug={item.slug} />
          <button
            onClick={() => openDrawer(item.slug!, 'news')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', letterSpacing: '0.04em', padding: 0 }}
          >
            {item.discussion_count > 0 ? `${item.discussion_count} discussion${item.discussion_count !== 1 ? 's' : ''}` : 'Discuss'}
          </button>
        </div>
      )}
    </div>
  )
}

const POST_TYPE_COLOR: Record<string, string> = {
  field_report:        '#F59E0B',
  self_reported_news:  '#3B82F6',
}
const POST_TYPE_LABEL: Record<string, string> = {
  field_report:        'Field Report',
  self_reported_news:  'Community Report',
}

function PostCard({ item }: { item: PostItem }) {
  const color = POST_TYPE_COLOR[item.post_type] ?? 'var(--color-muted)'
  const label = POST_TYPE_LABEL[item.post_type] ?? item.post_type
  return (
    <Link to={`/post/${item.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '6px', padding: '14px 18px',
          borderLeft: `3px solid ${color}`, transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
          <SourceBadge label={label} verified={false} />
          <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {item.category.replace(/_/g, ' ')}
          </span>
          {item.location_label && (
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{item.location_label}</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
            {timeAgo(item.created_at)}
          </span>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '5px', lineHeight: 1.4 }}>
          {item.title}
        </div>
        {item.body && (
          <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {item.body.length > 160 ? item.body.slice(0, 160) + '...' : item.body}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
          {item.upvote_count > 0 && <span style={{ color: 'var(--color-accent)' }}>{item.upvote_count} signal</span>}
          {item.username && (
            <>
              {item.upvote_count > 0 && <span>·</span>}
              <span>{item.username}</span>
              {(() => { const t = getTier(item.reputation ?? 0); return t ? (
                <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', padding: '1px 4px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t.short}
                </span>
              ) : null })()}
              {item.is_founding_member && (
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Founder
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function readFilters(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem('feed_filters') ?? '{}') } catch { return {} }
}

const SEVERITY_LEVELS = ['Extreme', 'Severe', 'Moderate', 'Minor'] as const

const SEVERITY_SCORE: Record<string, number> = {
  Extreme: 4, Severe: 3, Moderate: 2, Minor: 1,
}

function severityScore(item: FeedItem): number {
  if (item.kind === 'event') return SEVERITY_SCORE[item.severity] ?? 0
  return 0
}

function SidebarLabel({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', marginTop: '18px' }}>
      <span>{children}</span>
      {active && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />}
    </div>
  )
}

function FilterBtn({ active, color, children, onClick }: { active: boolean; color?: string; children: React.ReactNode; onClick: () => void }) {
  const accentColor = color ?? 'var(--color-accent)'
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '5px 10px', borderRadius: '4px', fontSize: '11px',
      fontFamily: 'var(--font-mono)', cursor: 'pointer',
      border: `1px solid ${active ? accentColor + '60' : 'var(--color-border)'}`,
      background: active ? accentColor + '14' : 'transparent',
      color: active ? accentColor : 'var(--color-subtle)',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

export default function FeedPage() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const socket = useSocket()
  const hasLocation = !!(user?.user_lat && user?.user_lon)
  const [newAlertBanner, setNewAlertBanner] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [nearMe, setNearMe] = useState<boolean>(() => (readFilters().nearMe as boolean) ?? true)
  const [nearMeKm, setNearMeKm] = useState<number>(() => (readFilters().nearMeKm as number) ?? 500)
  const [timePeriod, setTimePeriod] = useState<number>(() => (readFilters().timePeriod as number) ?? 7)
  const [sourceCatalog, setSourceCatalog] = useState<FeedSourceCatalog>({ groups: [], defaultIds: [] })
  const [mobileColumn, setMobileColumn] = useState<'events' | 'news' | 'reports'>('events')
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set())
  const [activeEventTypes, setActiveEventTypes] = useState<Set<string>>(new Set())
  const [activeNewsCategories, setActiveNewsCategories] = useState<Set<string>>(new Set())
  const [keywordFilterOn, setKeywordFilterOn] = useState(false)
  const [kwInput, setKwInput] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'severity'>(() => (readFilters().sortBy as 'newest' | 'severity') ?? 'newest')
  const [eventTypesExpanded, setEventTypesExpanded] = useState(false)
  // Three independent columns instead of one merged list means three
  // independent "show more" counters instead of one shared displayCount.
  const [eventsShown, setEventsShown] = useState(30)
  const [newsShown, setNewsShown] = useState(30)
  const [reportsShown, setReportsShown] = useState(30)
  const [searchText, setSearchText] = useState('')
  const initKeywords = ((user?.preferences as Record<string, unknown> | undefined)?.feed as { keywords?: string[] } | undefined)?.keywords ?? []
  const [savedKeywords, setSavedKeywords] = useState<string[]>(initKeywords)

  useEffect(() => {
    const kws = ((user?.preferences as Record<string, unknown> | undefined)?.feed as { keywords?: string[] } | undefined)?.keywords
    if (Array.isArray(kws)) setSavedKeywords(kws)
  }, [user?.id])

  useEffect(() => { fetchFeedSourceCatalog().then(setSourceCatalog) }, [])

  // Which sources actually get requested now comes from the same
  // subscription Settings and the Dashboard use, not a hardcoded source
  // list (the old one was noaa,usgs,gdacs,epa, missing EONET and
  // MeteoAlarm entirely) and not this page's own separate filter UI.
  function buildFeedUrls() {
    const catalogReady = sourceCatalog.groups.length > 0
    const subscribed = subscribedSourceIds(user?.preferences, sourceCatalog)
    const eventSources = sourceQueryValues(subscribed, sourceCatalog, 'event')
    const newsSources = sourceQueryValues(subscribed, sourceCatalog, 'news')
    const eventsUrl = !catalogReady ? `/api/events?days=${timePeriod}`
      : eventSources.length ? `/api/events?days=${timePeriod}&sources=${eventSources.map(encodeURIComponent).join(',')}`
      : null
    const newsUrl = !catalogReady ? `/api/news?days=${timePeriod}&limit=2000`
      : newsSources.length ? `/api/news?days=${timePeriod}&limit=2000&source=${newsSources.map(encodeURIComponent).join(',')}`
      : null
    return { eventsUrl, newsUrl }
  }

  function loadFeed() {
    setLoading(true)
    const { eventsUrl, newsUrl } = buildFeedUrls()
    Promise.all([
      eventsUrl ? fetch(eventsUrl).then(r => r.json()) : Promise.resolve([]),
      newsUrl ? fetch(newsUrl).then(r => r.json()) : Promise.resolve([]),
      fetch(`/api/posts?limit=500`).then(r => r.json()),
    ]).then(([evts, nws, psts]) => {
      setEvents(Array.isArray(evts) ? evts : [])
      setNews(Array.isArray(nws) ? nws : [])
      const community = Array.isArray(psts)
        ? psts.filter((p: PostItem) => p.post_type === 'field_report' || p.post_type === 'self_reported_news')
        : []
      setPosts(community)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(loadFeed, [timePeriod, sourceCatalog, user])

  useEffect(() => {
    if (!socket) return
    const handler = () => setNewAlertBanner(true)
    socket.on('new_alert', handler)
    return () => { socket.off('new_alert', handler) }
  }, [socket])

  useEffect(() => {
    try {
      localStorage.setItem('feed_filters', JSON.stringify({ nearMe, nearMeKm, sortBy, timePeriod }))
    } catch {}
  }, [nearMe, nearMeKm, sortBy, timePeriod])

  function toggle<T>(set: Set<T>, val: T): Set<T> {
    const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n
  }

  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event_type))
    return Array.from(types).sort()
  }, [events])

  const newsCategories = useMemo(() => {
    const cats = new Set(news.map(n => n.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [news])

  const activeFilterCount =
    activeSeverities.size + activeEventTypes.size + activeNewsCategories.size + (keywordFilterOn ? 1 : 0)

  const combined: FeedItem[] = useMemo(() => [
    ...events.map(e => ({ kind: 'event' as const, ...e })),
    ...news.map(n => ({ kind: 'news' as const, ...n })),
    ...posts.map(p => ({ kind: 'post' as const, ...p })),
  ].sort((a, b) => {
    const dateA = a.kind === 'event' ? a.fetched_at : a.kind === 'news' ? (a.published_at ?? '') : a.created_at
    const dateB = b.kind === 'event' ? b.fetched_at : b.kind === 'news' ? (b.published_at ?? '') : b.created_at
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  }), [events, news, posts])

  const filtered = useMemo(() => {
    const base = combined.filter(item => {
      if (item.kind === 'event') {
        if (activeSeverities.size > 0 && !activeSeverities.has(item.severity)) return false
        if (activeEventTypes.size > 0 && !activeEventTypes.has(item.event_type)) return false
        if (hasLocation && nearMe && user?.user_lat && user?.user_lon) {
          const centroid = eventCentroid(item.geometry)
          if (!centroid) return false
          if (haversine(user.user_lat, user.user_lon, centroid[0], centroid[1]) > nearMeKm) return false
        }
      }
      if (item.kind === 'news') {
        if (item.category && activeNewsCategories.size > 0 && !activeNewsCategories.has(item.category)) return false
      }
      if (keywordFilterOn && savedKeywords.length > 0) {
        let text = ''
        if (item.kind === 'event') text = `${item.title} ${item.event_type} ${(item.properties as Record<string, string>).areaDesc ?? ''}`
        else if (item.kind === 'news') text = `${item.title} ${item.summary ?? ''} ${item.category ?? ''}`
        else text = `${item.title} ${item.body}`
        const lower = text.toLowerCase()
        if (!savedKeywords.some(kw => lower.includes(kw))) return false
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase()
        let text = ''
        if (item.kind === 'event') text = `${item.title} ${item.event_type} ${(item.properties as Record<string, string>).areaDesc ?? ''}`
        else if (item.kind === 'news') text = `${item.title} ${item.summary ?? ''} ${item.source} ${item.category ?? ''}`
        else text = `${item.title} ${item.body} ${item.location_label ?? ''}`
        if (!text.toLowerCase().includes(q)) return false
      }
      return true
    })

    if (sortBy === 'severity') {
      return [...base].sort((a, b) => {
        const diff = severityScore(b) - severityScore(a)
        if (diff !== 0) return diff
        const dateA = a.kind === 'event' ? a.fetched_at : a.kind === 'news' ? (a.published_at ?? '') : a.created_at
        const dateB = b.kind === 'event' ? b.fetched_at : b.kind === 'news' ? (b.published_at ?? '') : b.created_at
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
    }
    return base
  }, [combined, activeSeverities, activeEventTypes, activeNewsCategories, nearMe, nearMeKm, hasLocation, user?.user_lat, user?.user_lon, keywordFilterOn, savedKeywords, sortBy, searchText])

  const severeCounts = events.filter(e => e.severity === 'Extreme' || e.severity === 'Severe').length

  // Three columns instead of one merged list: split the shared filtered
  // array back out by kind for independent rendering and pagination.
  const filteredEvents = useMemo(() => filtered.filter(i => i.kind === 'event'), [filtered])
  const filteredNews = useMemo(() => filtered.filter(i => i.kind === 'news'), [filtered])
  const filteredReports = useMemo(() => filtered.filter(i => i.kind === 'post'), [filtered])

  const filterSignature = useMemo(() =>
    [sortBy, [...activeSeverities].sort().join(), [...activeEventTypes].sort().join(),
     [...activeNewsCategories].sort().join(), nearMe, nearMeKm, keywordFilterOn,
     savedKeywords.join(), searchText,
    ].join('|'),
    [sortBy, activeSeverities, activeEventTypes, activeNewsCategories, nearMe, nearMeKm, keywordFilterOn, savedKeywords, searchText]
  )

  useEffect(() => { setEventsShown(30); setNewsShown(30); setReportsShown(30) }, [filterSignature])

  async function saveKeywords(kws: string[]) {
    if (!user) return
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { feed: { keywords: kws } } }),
    }).catch(() => {})
  }

  function addKeyword() {
    const kw = kwInput.trim().toLowerCase()
    if (!kw || savedKeywords.includes(kw)) { setKwInput(''); return }
    const next = [...savedKeywords, kw]
    setSavedKeywords(next)
    setKwInput('')
    saveKeywords(next)
  }

  function removeKeyword(kw: string) {
    const next = savedKeywords.filter(k => k !== kw)
    setSavedKeywords(next)
    if (next.length === 0) setKeywordFilterOn(false)
    saveKeywords(next)
  }

  function resetFilters() {
    setNearMe(true)
    setActiveSeverities(new Set())
    setActiveEventTypes(new Set())
    setActiveNewsCategories(new Set())
    setKeywordFilterOn(false)
    setSortBy('newest')
    setSearchText('')
    setTimePeriod(7)
  }

  const locationLabel = [user?.region_county, user?.region_state].filter(Boolean).join(', ')

  const visibleEventTypes = eventTypesExpanded ? eventTypes : eventTypes.slice(0, 6)

  const filterContent = (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', letterSpacing: '0.04em', marginBottom: '12px' }}>
        Filters
      </div>

      <SidebarLabel>Time Period</SidebarLabel>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {([1, 3, 7, 30] as const).map(d => (
          <button
            key={d}
            onClick={() => setTimePeriod(d)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
              fontFamily: 'var(--font-mono)', fontWeight: timePeriod === d ? 700 : 400,
              background: timePeriod === d ? 'var(--color-accent)' : 'transparent',
              color: timePeriod === d ? '#0A0A0A' : 'var(--color-subtle)',
              border: `1px solid ${timePeriod === d ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            {d === 1 ? 'Today' : `${d}d`}
          </button>
        ))}
      </div>

      {hasLocation && (
        <>
          <SidebarLabel>Location</SidebarLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
            <FilterBtn active={nearMe} onClick={() => setNearMe(v => !v)}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Near Me</span>
                <span style={{ color: 'var(--color-subtle)' }}>{nearMeKm}km</span>
              </span>
            </FilterBtn>
          </div>
          {nearMe && (
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', paddingLeft: '2px' }}>
              {RADIUS_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setNearMeKm(r)}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: '5px', cursor: 'pointer', fontSize: '10px',
                    fontFamily: 'var(--font-mono)', fontWeight: nearMeKm === r ? 700 : 400,
                    background: nearMeKm === r ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: nearMeKm === r ? '#0A0A0A' : 'var(--color-subtle)',
                    border: `1px solid ${nearMeKm === r ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  {r >= 1000 ? '1k' : r}
                </button>
              ))}
            </div>
          )}
          {locationLabel && (
            <div style={{ fontSize: '10px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', padding: '2px 10px', marginBottom: '4px' }}>
              {locationLabel}
            </div>
          )}
        </>
      )}

      <SidebarLabel active={activeSeverities.size > 0}>Severity (Events)</SidebarLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {SEVERITY_LEVELS.map(s => {
          const c = s === 'Extreme' || s === 'Severe' ? '#EF4444' : s === 'Moderate' ? '#F59E0B' : '#22C55E'
          return (
            <FilterBtn key={s} active={activeSeverities.has(s)} color={c} onClick={() => setActiveSeverities(set => toggle(set, s))}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{s}</span>
                <span style={{ color: 'var(--color-subtle)' }}>{events.filter(e => e.severity === s).length}</span>
              </span>
            </FilterBtn>
          )
        })}
      </div>

      {eventTypes.length > 0 && (
        <>
          <SidebarLabel active={activeEventTypes.size > 0}>Event Types</SidebarLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleEventTypes.map(type => (
              <FilterBtn key={type} active={activeEventTypes.has(type)} onClick={() => setActiveEventTypes(s => toggle(s, type))}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ textTransform: 'capitalize' }}>{type.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--color-subtle)' }}>{events.filter(e => e.event_type === type).length}</span>
                </span>
              </FilterBtn>
            ))}
          </div>
          {eventTypes.length > 6 && (
            <button onClick={() => setEventTypesExpanded(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '3px 10px',
              fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)',
              textAlign: 'left', width: '100%',
            }}>
              {eventTypesExpanded ? 'show less' : `show ${eventTypes.length - 6} more`}
            </button>
          )}
        </>
      )}

      {newsCategories.length > 0 && (
        <>
          <SidebarLabel active={activeNewsCategories.size > 0}>Category (News)</SidebarLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {newsCategories.map(cat => {
              const isActive = activeNewsCategories.has(cat)
              const catColor = CAT_COLOR[cat] ?? '#6B7280'
              return (
                <button
                  key={cat}
                  onClick={() => setActiveNewsCategories(s => toggle(s, cat))}
                  style={{
                    padding: '3px 8px', borderRadius: '12px', fontSize: '10px',
                    fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    border: `1px solid ${isActive ? catColor + '80' : 'var(--color-border)'}`,
                    background: isActive ? catColor + '22' : 'transparent',
                    color: isActive ? catColor : 'var(--color-subtle)',
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              )
            })}
          </div>
        </>
      )}

      {user && (
        <>
          <SidebarLabel active={keywordFilterOn}>Keywords</SidebarLabel>
          {savedKeywords.length > 0 && (
            <FilterBtn active={keywordFilterOn} onClick={() => setKeywordFilterOn(v => !v)}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Keyword filter</span>
                <span style={{ color: 'var(--color-subtle)' }}>{savedKeywords.length}</span>
              </span>
            </FilterBtn>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
            {savedKeywords.map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px',
                background: keywordFilterOn ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)',
                color: keywordFilterOn ? 'var(--color-accent)' : 'var(--color-subtle)',
                border: `1px solid ${keywordFilterOn ? 'rgba(34,197,94,0.25)' : 'var(--color-border)'}`,
              }}>
                {kw}
                <button
                  onClick={() => removeKeyword(kw)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-subtle)', padding: 0, fontSize: '12px', lineHeight: 1, display: 'flex', alignItems: 'center' }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <input
              type="text"
              value={kwInput}
              onChange={e => setKwInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              placeholder="Add keyword..."
              style={{
                flex: 1, padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                fontFamily: 'var(--font-mono)', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={addKeyword}
              disabled={!kwInput.trim()}
              style={{
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                cursor: kwInput.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
                border: '1px solid var(--color-border)', background: 'transparent',
                color: kwInput.trim() ? 'var(--color-text)' : 'var(--color-subtle)',
              }}
            >
              +
            </button>
          </div>
        </>
      )}

      <button onClick={resetFilters} style={{
        marginTop: '16px', width: '100%', padding: '5px 10px', borderRadius: '4px',
        fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
        border: '1px solid var(--color-border)', background: 'transparent',
        color: 'var(--color-subtle)', transition: 'color 0.15s',
      }}>
        Reset filters
      </button>
    </>
  )

  return (
    <div style={{
      maxWidth: '1600px', margin: '0 auto', padding: '28px 24px',
      display: isMobile ? 'block' : 'grid',
      gridTemplateColumns: isMobile ? undefined : '1fr 220px',
      gap: isMobile ? undefined : '32px',
      alignItems: isMobile ? undefined : 'start',
    }}>
      {/* Main column */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Live Feed
          </h1>
          {severeCounts > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-danger)',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '4px', padding: '2px 8px',
            }}>
              {severeCounts} severe
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>
            {loading ? '...' : `${filtered.length} items · ${timePeriod === 1 ? 'today' : `${timePeriod}d`}`}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setSortBy('newest')}
              style={{
                padding: '3px 10px', borderRadius: '4px', fontSize: '10px',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                border: `1px solid ${sortBy === 'newest' ? 'var(--color-accent)60' : 'var(--color-border)'}`,
                background: sortBy === 'newest' ? 'var(--color-accent)14' : 'transparent',
                color: sortBy === 'newest' ? 'var(--color-accent)' : 'var(--color-subtle)',
                transition: 'all 0.15s',
              }}
            >
              Newest
            </button>
            <button
              onClick={() => setSortBy('severity')}
              style={{
                padding: '3px 10px', borderRadius: '4px', fontSize: '10px',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                border: `1px solid ${sortBy === 'severity' ? '#EF444460' : 'var(--color-border)'}`,
                background: sortBy === 'severity' ? '#EF444414' : 'transparent',
                color: sortBy === 'severity' ? '#EF4444' : 'var(--color-subtle)',
                transition: 'all 0.15s',
              }}
            >
              Severity
            </button>
          </div>
          {isMobile && (
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{
                fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600,
                padding: '4px 12px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: showFilters ? 'var(--color-surface)' : 'transparent',
                color: showFilters ? 'var(--color-text)' : 'var(--color-muted)',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              <span>{showFilters ? 'Hide Filters' : 'Filters'}</span>
              {activeFilterCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: 'var(--color-accent)', color: '#0A0A0A',
                  fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {isMobile && showFilters && (
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '8px', padding: '16px', marginBottom: '20px',
          }}>
            {filterContent}
          </div>
        )}

        {newAlertBanner && (
          <button
            onClick={() => { setNewAlertBanner(false); loadFeed() }}
            style={{
              width: '100%', marginBottom: '10px', padding: '9px 16px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              fontSize: '12px', color: 'var(--color-danger)', textAlign: 'center',
              letterSpacing: '0.03em',
            }}
          >
            New severe alert, click to refresh
          </button>
        )}

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search feed..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 36px 9px 14px', borderRadius: '6px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: '13px', fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)',
                fontSize: '16px', lineHeight: 1, padding: '0 2px',
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Mobile: a tab per column instead of three side by side, no room for that on a phone */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
            {([
              ['events', 'Events', filteredEvents.length],
              ['news', 'News', filteredNews.length],
              ['reports', 'Reports', filteredReports.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setMobileColumn(key)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
                  fontFamily: 'var(--font-display)', fontWeight: mobileColumn === key ? 700 : 400,
                  border: `1px solid ${mobileColumn === key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: mobileColumn === key ? 'rgba(34,197,94,0.1)' : 'transparent',
                  color: mobileColumn === key ? 'var(--color-accent)' : 'var(--color-muted)',
                }}
              >
                {label} {count}
              </button>
            ))}
          </div>
        )}

        {isMobile ? (
          <FeedColumn
            items={mobileColumn === 'events' ? filteredEvents : mobileColumn === 'news' ? filteredNews : filteredReports}
            shown={mobileColumn === 'events' ? eventsShown : mobileColumn === 'news' ? newsShown : reportsShown}
            onShowMore={() => {
              if (mobileColumn === 'events') setEventsShown(n => n + 30)
              else if (mobileColumn === 'news') setNewsShown(n => n + 30)
              else setReportsShown(n => n + 30)
            }}
            loading={loading}
            emptyText="No items match the current filters"
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
            <div>
              <ColumnHeader label="Events" count={filteredEvents.length} color="var(--color-danger)" />
              <FeedColumn items={filteredEvents} shown={eventsShown} onShowMore={() => setEventsShown(n => n + 30)} loading={loading} emptyText="No events match" />
            </div>
            <div>
              <ColumnHeader label="News" count={filteredNews.length} color="#3B82F6" />
              <FeedColumn items={filteredNews} shown={newsShown} onShowMore={() => setNewsShown(n => n + 30)} loading={loading} emptyText="No news matches" />
            </div>
            <div>
              <ColumnHeader label="Reports" count={filteredReports.length} color="#F59E0B" />
              <FeedColumn items={filteredReports} shown={reportsShown} onShowMore={() => setReportsShown(n => n + 30)} loading={loading} emptyText="No reports match" />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar - desktop only */}
      {!isMobile && (
        <div style={{ position: 'sticky', top: '80px' }}>
          {filterContent}
        </div>
      )}
    </div>
  )
}

function ColumnHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 2px', marginBottom: '8px', borderBottom: `2px solid ${color}`,
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{count}</span>
    </div>
  )
}

function FeedColumn({ items, shown, onShowMore, loading, emptyText }: {
  items: FeedItem[]
  shown: number
  onShowMore: () => void
  loading: boolean
  emptyText: string
}) {
  const visible = items.slice(0, shown)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {visible.map(item =>
        item.kind === 'event'
          ? <EventCard key={`e-${item.id}`} item={item} />
          : item.kind === 'post'
            ? <PostCard key={`p-${item.id}`} item={item} />
            : <NewsCard key={`n-${item.id}`} item={item} />
      )}
      {!loading && items.length === 0 && (
        <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {emptyText}
        </div>
      )}
      {shown < items.length && (
        <button
          onClick={onShowMore}
          style={{
            padding: '8px 0', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
            fontSize: '11px', color: 'var(--color-subtle)', background: 'transparent',
            border: '1px solid var(--color-border)', letterSpacing: '0.05em',
          }}
        >
          show {Math.min(30, items.length - shown)} more
        </button>
      )}
    </div>
  )
}
