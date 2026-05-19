import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { EventLayer, RadarLayer, WeatherAlertLayer, type DisasterEvent } from '../components/MapEventLayer'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number; source: string; title: string; url: string | null
  summary: string | null; category: string | null; published_at: string | null
}
interface Post {
  id: number; post_type: string; category: string; title: string
  upvote_count: number; created_at: string; username: string | null; is_trusted: boolean
  location_label: string | null; latitude: number | null; longitude: number | null
}
interface DashData { events: DisasterEvent[]; news: NewsItem[]; posts: Post[]; loading: boolean }

type ColMode = 1 | 2 | 3 | 'focus'

interface SlotEntry {
  type: string
  config: Record<string, unknown>
}

interface DashboardPrefs {
  columns: ColMode
  rows: number
  slots: Record<string, SlotEntry | null>
}

// ─── Default layout ───────────────────────────────────────────────────────────

const DEFAULT_PREFS: DashboardPrefs = {
  columns: 2,
  rows: 3,
  slots: {
    '0': { type: 'alerts',        config: {} },
    '1': { type: 'map',           config: {} },
    '2': { type: 'news',          config: {} },
    '3': { type: 'event_counts',  config: {} },
    '4': { type: 'community',     config: {} },
    '5': { type: 'field_reports', config: {} },
  },
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  Extreme: '#EF4444', Severe: '#EF4444', Moderate: '#F59E0B', Minor: '#22C55E',
}
const POST_TYPE_LABEL: Record<string, string> = {
  community: 'Community', field_report: 'Field Report', self_reported_news: 'News Report',
}
const POST_TYPE_COLOR: Record<string, string> = {
  community: '#3B82F6', field_report: '#F59E0B', self_reported_news: '#22C55E',
}
const ALL_MAP_SOURCES = new Set(['usgs', 'gdacs', 'epa'])

// ─── Utilities ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function useCurrentTime() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

function GeolocateUser() {
  const map = useMap()
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      pos => { if (!cancelled) map.setView([pos.coords.latitude, pos.coords.longitude], 6, { animate: true }) },
      () => {}
    )
    return () => { cancelled = true }
  }, [map])
  return null
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({
  title, link, linkLabel, editMode, children, onPickSlot, onClear, onConfigure, onMoveStart, isMoving,
}: {
  title: string; link?: string; linkLabel?: string
  editMode: boolean; children: React.ReactNode
  onPickSlot: () => void; onClear: () => void; onConfigure?: () => void
  onMoveStart?: () => void; isMoving?: boolean
}) {
  const eBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px',
    color: 'var(--color-muted)', cursor: 'pointer', fontSize: '12px', padding: '1px 6px',
    fontFamily: 'var(--font-mono)', lineHeight: 1.4,
  }
  return (
    <div style={{ border: `1px solid ${isMoving ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: '8px', background: 'var(--color-surface)', overflow: 'hidden', boxShadow: isMoving ? '0 0 0 2px rgba(34,197,94,0.2)' : 'none' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{title}</span>
        {editMode ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {onConfigure && <button onClick={onConfigure} style={eBtnStyle} title="Configure">&#9881;</button>}
            {onMoveStart && (
              <button
                onClick={e => { e.stopPropagation(); onMoveStart() }}
                title={isMoving ? 'Cancel move' : 'Move panel'}
                style={{ ...eBtnStyle, color: isMoving ? 'var(--color-accent)' : 'var(--color-muted)', borderColor: isMoving ? 'var(--color-accent)' : 'var(--color-border)' }}
              >
                &#8645;
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onPickSlot() }} style={eBtnStyle} title="Change panel">&#9998;</button>
            <button onClick={e => { e.stopPropagation(); onClear() }} style={{ ...eBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }} title="Remove">&#215;</button>
          </div>
        ) : link ? (
          <Link to={link} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', letterSpacing: '0.04em', textDecoration: 'none' }}>
            {linkLabel ?? 'View all'}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

// ─── Empty slot ───────────────────────────────────────────────────────────────

function EmptySlot({ editMode, onClick, isMoveTarget }: { editMode: boolean; onClick: () => void; isMoveTarget?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isMoveTarget
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px dashed ${isMoveTarget ? 'rgba(34,197,94,0.5)' : active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '8px',
        minHeight: '120px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        gap: '7px',
        cursor: (editMode || isMoveTarget) ? 'pointer' : 'default',
        background: isMoveTarget ? 'rgba(34,197,94,0.04)' : active ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'border-color 0.12s, background 0.12s',
      }}
    >
      <span style={{ fontSize: '16px', color: isMoveTarget ? 'rgba(34,197,94,0.5)' : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', lineHeight: 1, transition: 'color 0.12s' }}>
        {isMoveTarget ? '⇅' : '+'}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: isMoveTarget ? 'rgba(34,197,94,0.5)' : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', letterSpacing: '0.08em', transition: 'color 0.12s' }}>
        {isMoveTarget ? 'Move here.' : 'Add a panel.'}
      </span>
    </div>
  )
}

// ─── Widget: Active Alerts ────────────────────────────────────────────────────

function AlertsContent({ data }: { data: DashData }) {
  const pinned = data.events
    .filter(e => e.severity === 'Extreme' || e.severity === 'Severe')
    .sort((a, b) => (a.severity === 'Extreme' ? 0 : 1) - (b.severity === 'Extreme' ? 0 : 1))

  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  if (pinned.length === 0) return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#22C55E', letterSpacing: '0.06em' }}>NO SEVERE OR EXTREME ALERTS ACTIVE</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {pinned.slice(0, 10).map(e => {
        const color = SEV_COLOR[e.severity] ?? '#F59E0B'
        const p = (e.properties ?? {}) as Record<string, string>
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--color-surface)', borderLeft: `3px solid ${color}` }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{e.severity}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
            {p.areaDesc && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', flexShrink: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.areaDesc.split(';')[0]}</span>}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', flexShrink: 0 }}>{e.source?.toUpperCase()}</span>
          </div>
        )
      })}
      {pinned.length > 10 && (
        <Link to="/feed" style={{ display: 'block', padding: '10px 14px', background: 'var(--color-surface)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)', textDecoration: 'none', textAlign: 'center' }}>
          +{pinned.length - 10} more active alerts
        </Link>
      )}
    </div>
  )
}

// ─── Widget: Live Map ─────────────────────────────────────────────────────────

function MapAutoResize() {
  const map = useMap()
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 50); return () => clearTimeout(t) }, [map])
  return null
}

function RadarWidgetContent() {
  return (
    <div style={{ height: '280px' }}>
      <MapContainer
        center={[40, -95]} zoom={3}
        scrollWheelZoom={false} zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />
        <MapAutoResize />
        <RadarLayer />
      </MapContainer>
    </div>
  )
}

function MapContent({ data }: { data: DashData }) {
  const mapEvents = useMemo(() => data.events.filter(e => ALL_MAP_SOURCES.has(e.source)), [data.events])
  return (
    <div style={{ position: 'relative', height: '360px' }}>
      <MapContainer
        center={[30, -10]} zoom={2}
        scrollWheelZoom={false} zoomControl={true}
        maxBounds={[[-85, -200], [85, 200]]} maxBoundsViscosity={0.8}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />
        <MapAutoResize />
        <GeolocateUser />
        <RadarLayer />
        <WeatherAlertLayer />
        <EventLayer events={mapEvents} activeFilters={ALL_MAP_SOURCES} />
      </MapContainer>
      <Link to="/map" style={{
        position: 'absolute', bottom: '12px', right: '12px', zIndex: 1000,
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px',
        padding: '7px 14px', borderRadius: '6px',
        background: 'rgba(10,10,10,0.88)', border: '1px solid var(--color-border)',
        color: 'var(--color-accent)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        Open Full Map
      </Link>
    </div>
  )
}

// ─── Widget: Event Counts ─────────────────────────────────────────────────────

function EventCountsContent({ data }: { data: DashData }) {
  const events = data.events

  const bySev: Record<string, number> = {}
  const bySrc: Record<string, number> = {}
  const byType: Record<string, number> = {}

  for (const e of events) {
    bySev[e.severity] = (bySev[e.severity] ?? 0) + 1
    bySrc[e.source]   = (bySrc[e.source]   ?? 0) + 1
    const t = (e.event_type ?? e.source ?? 'other').toLowerCase()
    byType[t] = (byType[t] ?? 0) + 1
  }

  const sevOrder = ['Extreme', 'Severe', 'Moderate', 'Minor']
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6)

  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Total + severity breakdown */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{events.length}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>Active Events</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {sevOrder.filter(s => bySev[s]).map(s => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: SEV_COLOR[s] ?? 'var(--color-muted)' }}>{bySev[s]}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By source */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>By Source</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
            <div key={src} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '3px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)' }}>{src.toUpperCase()}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top event types */}
      {topTypes.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Top Event Types</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topTypes.map(([type, count]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '2px', background: 'var(--color-border)', borderRadius: '1px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(count / events.length * 100)}%`, background: 'var(--color-accent)', borderRadius: '1px' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', minWidth: '80px', textAlign: 'right' }}>
                  {type.replace(/_/g, ' ')} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Widget: Latest News ──────────────────────────────────────────────────────

const NEWS_CATS: [string, string][] = [
  ['all',            'All'],
  ['emergency',      'Emergency'],
  ['health',         'Health'],
  ['cybersecurity',  'Cyber'],
  ['recall',         'Recalls'],
  ['travel',         'Travel'],
  ['nuclear',        'Nuclear'],
  ['hurricane',      'Hurricane'],
  ['environment',    'Environment'],
  ['science',        'Science'],
]

function NewsContent({ data, config, onSetConfig }: {
  data: DashData
  config?: Record<string, unknown>
  onSetConfig?: (u: Record<string, unknown>) => void
}) {
  const category = (config?.category as string | undefined) || 'all'
  const configOpen = config?._open === true
  const [filteredNews, setFilteredNews] = useState<NewsItem[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)

  useEffect(() => {
    if (category === 'all') { setFilteredNews(null); return }
    setFilterLoading(true)
    fetch(`/api/news?category=${category}&limit=10`)
      .then(r => r.json())
      .then(d => { setFilteredNews(Array.isArray(d) ? d : []); setFilterLoading(false) })
      .catch(() => { setFilteredNews([]); setFilterLoading(false) })
  }, [category])

  const displayNews = filteredNews ?? data.news
  const isLoading = category === 'all' ? data.loading : filterLoading

  const configPanel = configOpen && onSetConfig ? (
    <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Filter by Category</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {NEWS_CATS.map(([val, lbl]) => {
          const active = val === 'all' ? category === 'all' : category === val
          return (
            <button key={val}
              onClick={() => onSetConfig({ category: val === 'all' ? undefined : val, _open: true })}
              style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer',
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-muted)' }}>
              {lbl}
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  if (isLoading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  if (!displayNews.length) return (
    <div>
      <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>
        No news items{category !== 'all' ? ` in "${category}"` : ''}.
        {category !== 'all' && <div style={{ marginTop: '6px', fontSize: '11px' }}>Try a different category below.</div>}
      </div>
      {configPanel}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {displayNews.slice(0, 8).map(item => (
        <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '11px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.source}</span>
            {category === 'all' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.category}</span>
            )}
            {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>{item.title}</div>
        </a>
      ))}
      {configPanel}
    </div>
  )
}

// ─── Widget: Community Posts ──────────────────────────────────────────────────

function CommunityContent({ data }: { data: DashData }) {
  const posts = data.posts.filter(p => p.post_type !== 'field_report').slice(0, 6)

  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!posts.length) return (
    <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>
      No posts yet. <Link to="/community" style={{ color: 'var(--color-accent)' }}>Be first to post.</Link>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {posts.map(post => (
        <Link key={post.id} to={`/post/${post.id}`}
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '11px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: POST_TYPE_COLOR[post.post_type] ?? 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {POST_TYPE_LABEL[post.post_type] ?? post.post_type}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(post.created_at)}</span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>{post.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
            <span>{post.upvote_count} votes</span>
            {post.username && <><span>·</span><span>{post.username}</span></>}
            {post.is_trusted && (
              <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: 'var(--color-accent)', border: '1px solid rgba(34,197,94,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trusted
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Widget: Field Reports ────────────────────────────────────────────────────

function FieldReportsContent({ data }: { data: DashData }) {
  const reports = data.posts.filter(p => p.post_type === 'field_report').slice(0, 6)

  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {reports.length === 0 && (
        <div style={{ padding: '20px', background: 'var(--color-surface)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>
          No field reports yet.
        </div>
      )}
      {reports.map(post => (
        <Link key={post.id} to={`/post/${post.id}`}
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '11px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {post.category}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(post.created_at)}</span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>{post.title}</div>
          {post.location_label && (
            <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>{post.location_label}</div>
          )}
        </Link>
      ))}
      <Link to="/community?type=field_report" style={{
        display: 'block', padding: '10px 14px', background: 'var(--color-surface)',
        fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
        color: '#F59E0B', textDecoration: 'none', textAlign: 'center',
      }}>
        Post a field report
      </Link>
    </div>
  )
}

// ─── Widget: Quick Actions ────────────────────────────────────────────────────

function QuickActionsContent({ user }: { user: { username: string } | null }) {
  const links = [
    { label: 'Live Feed', to: '/feed', desc: 'Events and verified news' },
    { label: 'Full Map', to: '/map', desc: 'Interactive global map' },
    { label: 'Compendium', to: '/compendium', desc: 'Community guide library' },
    { label: 'Tools', to: '/tools', desc: 'Calculators and inventory' },
    { label: 'Community', to: '/community', desc: 'Posts, field reports, discussion' },
  ]

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {links.map(link => (
          <Link key={link.to} to={link.to} style={{
            textDecoration: 'none', padding: '12px 14px', borderRadius: '6px',
            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '3px' }}>{link.label}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-subtle)', lineHeight: 1.4 }}>{link.desc}</div>
          </Link>
        ))}
      </div>
      {!user && (
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
          <Link to="/register" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '6px', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
            Join
          </Link>
          <Link to="/login" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: '6px', border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px', textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Widget: Inventory Status ─────────────────────────────────────────────────

function InventoryContent() {
  const [kits, setKits] = useState<{ id: string; name: string; type: string }[]>([])
  const [stats, setStats] = useState({ total: 0, out: 0, low: 0, expiringSoon: 0 })

  useEffect(() => {
    try {
      const storedKits: { id: string; name: string; type: string }[] = JSON.parse(localStorage.getItem('fenris_kits') ?? '[]')
      setKits(storedKits)
      let total = 0, out = 0, low = 0, expiringSoon = 0
      const today = new Date().toISOString().slice(0, 10)
      const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      for (const kit of storedKits) {
        try {
          const items: { qty: number; par: number; expiry?: string | null }[] = JSON.parse(localStorage.getItem(`fenris_kit_items_${kit.id}`) ?? '[]')
          total += items.length
          for (const i of items) {
            const qty = Number(i.qty)
            const par = Number(i.par)
            if (qty === 0) out++
            else if (par > 0 && qty < par) low++
            if (i.expiry && i.expiry >= today && i.expiry <= soon) expiringSoon++
          }
        } catch {}
      }
      setStats({ total, out, low, expiringSoon })
    } catch {}
  }, [])

  if (kits.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', marginBottom: '12px' }}>No kits created yet.</div>
      <Link to="/tools" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
        Open Inventory Manager
      </Link>
    </div>
  )

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {[
          { value: stats.total,        label: 'Items',         color: 'var(--color-text)' },
          { value: stats.out,          label: 'Out of Stock',  color: '#EF4444' },
          { value: stats.low,          label: 'Low Stock',     color: '#F59E0B' },
          { value: stats.expiringSoon, label: 'Expiring Soon', color: '#F59E0B' },
        ].filter(s => s.label === 'Items' || s.value > 0).map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
        {kits.slice(0, 4).map(kit => {
          const items: { qty: number; par: number }[] = (() => { try { return JSON.parse(localStorage.getItem(`fenris_kit_items_${kit.id}`) ?? '[]') } catch { return [] } })()
          const hasIssues = items.some(i => Number(i.qty) === 0 || (Number(i.par) > 0 && Number(i.qty) < Number(i.par)))
          return (
            <div key={kit.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--color-surface)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: items.length === 0 ? 'var(--color-muted)' : hasIssues ? '#F59E0B' : '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'var(--color-text)', flex: 1 }}>{kit.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{items.length} items</span>
            </div>
          )
        })}
      </div>
      {kits.length > 4 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textAlign: 'center' }}>+{kits.length - 4} more kits</div>
      )}
      <Link to="/tools" style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none', padding: '7px 14px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', textAlign: 'center' }}>
        Manage Inventory
      </Link>
    </div>
  )
}

// ─── Widget: Top Guides ───────────────────────────────────────────────────────

interface GuideItem {
  id: number; title: string; category: string
  signal_count: number; noise_count: number; created_at: string; username: string | null; is_trusted: boolean
}

function TopGuidesContent() {
  const [guides, setGuides] = useState<GuideItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/guides?limit=6')
      .then(r => r.json())
      .then(data => { setGuides(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!guides.length) return (
    <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>
      No guides yet. <Link to="/compendium" style={{ color: 'var(--color-accent)' }}>Submit the first one.</Link>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {guides.map(g => (
        <Link key={g.id} to={`/compendium/${g.id}`}
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '11px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.category}</span>
            {g.signal_count > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', marginLeft: 'auto' }}>
                {g.signal_count} signal
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>{g.title}</div>
          {g.username && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>{g.username}</span>
              {g.is_trusted && (
                <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.1)', color: 'var(--color-accent)', border: '1px solid rgba(34,197,94,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Trusted
                </span>
              )}
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}

// ─── Widget: Markets (Metals / Oil / Indices) ─────────────────────────────────

interface MetalsData { gold: { price: number; change_pct: number }; silver: { price: number; change_pct: number } }
interface OilData { price: number; change_pct: number | null; period: string; unit: string }
interface StockItem { label: string; price: number; change_pct: number | null; sparkline?: number[] }

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null
  const W = 64, H = 28
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 2) - 1}`
  ).join(' ')
  const color = positive ? '#22C55E' : '#EF4444'
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  )
}

function PriceRow({ label, price, changePct, fmt, sparkline }: {
  label: string; price: number; changePct: number | null; fmt: (n: number) => string
  sparkline?: number[]
}) {
  const color = changePct == null ? 'var(--color-muted)' : changePct >= 0 ? '#22C55E' : '#EF4444'
  const sign  = changePct != null && changePct >= 0 ? '+' : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '56px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '17px', fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>{fmt(price)}</span>
      {sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} positive={(changePct ?? 0) >= 0} />}
      {changePct != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, fontWeight: 600 }}>{sign}{changePct.toFixed(2)}%</span>
      )}
    </div>
  )
}

function UnavailableRow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', opacity: 0.4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '56px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>unavailable</span>
    </div>
  )
}

function MarketsContent({ config, onSetConfig }: { config?: Record<string, unknown>; onSetConfig?: (u: Record<string, unknown>) => void }) {
  const [metals, setMetals] = useState<MetalsData | null>(null)
  const [oil, setOil] = useState<OilData | null>(null)
  const [stocks, setStocks] = useState<StockItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  const showGold   = config?.showGold   !== false
  const showSilver = config?.showSilver !== false
  const showOil    = config?.showOil    !== false
  const showSP500  = config?.showSP500  !== false
  const showDow    = config?.showDow    !== false
  const showNasdaq = config?.showNasdaq !== false
  const configOpen = config?._open      === true

  useEffect(() => {
    Promise.all([
      fetch('/api/external/metals').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/oil').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/stocks').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([m, o, s]) => {
      setMetals(m && !m.error ? m : null)
      setOil(o && !o.error ? o : null)
      setStocks(Array.isArray(s) ? s : null)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!metals && !oil && !stocks) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  const goldPrice   = metals?.gold?.price   != null ? Number(metals.gold.price)   : null
  const silverPrice = metals?.silver?.price != null ? Number(metals.silver.price) : null
  const oilPrice    = oil?.price            != null ? Number(oil.price)            : null

  const stockMap: Record<string, StockItem> = {}
  for (const s of stocks ?? []) stockMap[s.label] = s

  const instruments: [string, string, boolean][] = [
    ['Gold',    'showGold',   showGold],
    ['Silver',  'showSilver', showSilver],
    ['WTI Oil', 'showOil',    showOil],
    ['S&P 500', 'showSP500',  showSP500],
    ['Dow',     'showDow',    showDow],
    ['NASDAQ',  'showNasdaq', showNasdaq],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {showGold   && (goldPrice   != null ? <PriceRow label="Gold"    price={goldPrice}   changePct={metals!.gold.change_pct   ?? null} fmt={n => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} /> : <UnavailableRow label="Gold" />)}
      {showSilver && (silverPrice != null ? <PriceRow label="Silver"  price={silverPrice} changePct={metals!.silver.change_pct ?? null} fmt={n => `$${n.toFixed(2)}`} /> : <UnavailableRow label="Silver" />)}
      {showOil    && (oilPrice    != null ? <PriceRow label="WTI"     price={oilPrice}    changePct={oil!.change_pct           ?? null} fmt={n => `$${n.toFixed(2)}`} /> : <UnavailableRow label="WTI" />)}
      {showSP500  && (stockMap['S&P 500'] ? <PriceRow label="S&P 500" price={stockMap['S&P 500'].price}  changePct={stockMap['S&P 500'].change_pct}  fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sparkline={stockMap['S&P 500'].sparkline} /> : <UnavailableRow label="S&P 500" />)}
      {showDow    && (stockMap['Dow']     ? <PriceRow label="Dow"     price={stockMap['Dow'].price}       changePct={stockMap['Dow'].change_pct}       fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} sparkline={stockMap['Dow'].sparkline} />     : <UnavailableRow label="Dow" />)}
      {showNasdaq && (stockMap['NASDAQ']  ? <PriceRow label="NASDAQ"  price={stockMap['NASDAQ'].price}    changePct={stockMap['NASDAQ'].change_pct}    fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sparkline={stockMap['NASDAQ'].sparkline} />  : <UnavailableRow label="NASDAQ" />)}
      <div style={{ padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>
        Gold/Silver: GoldPrice.org{oil?.period ? ` · WTI: EIA` : ''}{stocks?.length ? ' · Indices: Yahoo Finance' : ''}
      </div>
      {configOpen && onSetConfig && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Toggle Instruments</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {instruments.map(([label, key, active]) => (
              <button key={key} onClick={() => onSetConfig({ [key]: !active })}
                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Widget: Economic Signals ─────────────────────────────────────────────────

function EconomicSignalsContent() {
  const [yieldCurve, setYieldCurve] = useState<{ observations: { date: string; value: number }[] } | null>(null)
  const [m2, setM2] = useState<{ observations: { date: string; value: number }[] } | null>(null)
  const [cpi, setCpi] = useState<{ cpi: number; yoy_pct: number; period: string } | null>(null)
  const [fdic, setFdic] = useState<{ failures: { name: string; faildate: string; state: string }[]; this_year_count: number } | null>(null)
  const [unemp, setUnemp] = useState<{ claims: number; change: number | null; four_week_avg: number; period: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/external/fred/T10Y2Y').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/fred/M2SL').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/bls/cpi').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/fdic').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/external/bls/unemployment').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([yc, m, c, f, u]) => {
      setYieldCurve(yc && !yc.error ? yc : null)
      setM2(m && !m.error ? m : null)
      setCpi(c && !c.error ? c : null)
      setFdic(f && !f.error ? f : null)
      setUnemp(u && !u.error ? u : null)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  const latestYield = yieldCurve?.observations?.[0]
  const yieldInverted = latestYield && latestYield.value < 0
  const yieldColor = latestYield ? (yieldInverted ? '#EF4444' : '#22C55E') : 'var(--color-muted)'

  const latestM2 = m2?.observations?.[0]
  const prevM2 = m2?.observations?.[12]
  const m2Yoy = latestM2 && prevM2 ? ((latestM2.value - prevM2.value) / prevM2.value) * 100 : null

  const rows = [
    latestYield && {
      label: 'Yield Curve',
      value: `${latestYield.value >= 0 ? '+' : ''}${latestYield.value.toFixed(2)}%`,
      note: yieldInverted ? 'INVERTED' : 'Normal',
      color: yieldColor,
    },
    cpi?.yoy_pct != null && {
      label: 'CPI YoY',
      value: `${cpi.yoy_pct.toFixed(1)}%`,
      note: cpi.period,
      color: cpi.yoy_pct > 5 ? '#EF4444' : cpi.yoy_pct > 3 ? '#F59E0B' : '#22C55E',
    },
    latestM2 && {
      label: 'M2 Supply',
      value: `$${(latestM2.value / 1000).toFixed(1)}T`,
      note: m2Yoy != null ? `${m2Yoy >= 0 ? '+' : ''}${m2Yoy.toFixed(1)}% YoY` : '',
      color: 'var(--color-muted)',
    },
    unemp?.claims != null && {
      label: 'Init. Claims',
      value: unemp.claims.toLocaleString(),
      note: `${unemp.change != null ? (unemp.change >= 0 ? '+' : '') + unemp.change.toLocaleString() + ' · ' : ''}4wk avg ${unemp.four_week_avg.toLocaleString()}`,
      color: unemp.claims > 300000 ? '#EF4444' : unemp.claims > 250000 ? '#F59E0B' : 'var(--color-muted)',
    },
    fdic && {
      label: 'Bank Failures',
      value: String(fdic.this_year_count),
      note: `this year${fdic.failures[0] ? ` · ${fdic.failures[0].name}` : ''}`,
      color: fdic.this_year_count > 0 ? '#F59E0B' : '#22C55E',
    },
  ].filter(Boolean) as { label: string; value: string; note: string; color: string }[]

  if (!rows.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '96px', flexShrink: 0 }}>{row.label}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: row.color, flex: 1 }}>{row.value}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textAlign: 'right' }}>{row.note}</span>
        </div>
      ))}
      <div style={{ padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>FRED · BLS · FDIC</div>
    </div>
  )
}

// ─── Widget: Space Weather ────────────────────────────────────────────────────

function SpaceWeatherContent() {
  const [alerts, setAlerts] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?category=space_weather&limit=6')
      .then(r => r.json())
      .then(data => { setAlerts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!alerts.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>No space weather alerts.</div>

  const levelColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('g5') || t.includes('x5') || t.includes('extreme')) return '#EF4444'
    if (t.includes('g4') || t.includes('g3') || t.includes('x1') || t.includes('x2')) return '#F59E0B'
    if (t.includes('g2') || t.includes('m5')) return '#EAB308'
    return '#3B82F6'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {alerts.map(item => {
        const color = levelColor(item.title)
        return (
          <a key={item.id} href={item.url ?? 'https://www.swpc.noaa.gov'} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '10px 14px', borderLeft: `3px solid ${color}` }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NOAA SWPC</span>
              {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{item.title}</div>
          </a>
        )
      })}
    </div>
  )
}

// ─── Widget: Active Recalls ───────────────────────────────────────────────────

function RecallsContent() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?category=recall&limit=8')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!items.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>No active recalls.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {items.map(item => (
        <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '10px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.source}</span>
            {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{item.title}</div>
        </a>
      ))}
    </div>
  )
}

// ─── Widget: Crypto ──────────────────────────────────────────────────────────

function CryptoContent() {
  const [data, setData] = useState<{ bitcoin: { price: number; change_pct: number }; ethereum: { price: number; change_pct: number } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/external/crypto')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && !d.error ? d : null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!data) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  const coins = [
    { label: 'BTC', ...data.bitcoin },
    { label: 'ETH', ...data.ethereum },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {coins.map(c => {
        const color = c.change_pct >= 0 ? '#22C55E' : '#EF4444'
        return (
          <div key={c.label} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '36px', flexShrink: 0 }}>{c.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>
              ${c.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color, fontWeight: 600 }}>
              {c.change_pct >= 0 ? '+' : ''}{c.change_pct.toFixed(2)}%
            </span>
          </div>
        )
      })}
      <div style={{ padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>CoinGecko · 24h change</div>
    </div>
  )
}

// ─── Widget: Drought Monitor ──────────────────────────────────────────────────

function DroughtContent() {
  const [data, setData] = useState<{ date: string; none: number; d0: number; d1: number; d2: number; d3: number; d4: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/external/drought')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && !d.error ? d : null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!data) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  const levels = [
    { key: 'd4', label: 'D4 Exceptional', pct: data.d4, color: '#7C3AED' },
    { key: 'd3', label: 'D3 Extreme',     pct: data.d3, color: '#EF4444' },
    { key: 'd2', label: 'D2 Severe',      pct: data.d2, color: '#F97316' },
    { key: 'd1', label: 'D1 Moderate',    pct: data.d1, color: '#F59E0B' },
    { key: 'd0', label: 'D0 Abnormal',    pct: data.d0, color: '#EAB308' },
    { key: 'none', label: 'No Drought',   pct: data.none, color: '#22C55E' },
  ]

  const inDrought = 100 - (data.none ?? 0)

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700, color: inDrought > 50 ? '#F59E0B' : 'var(--color-text)', lineHeight: 1 }}>
            {inDrought.toFixed(1)}%
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>US in drought</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginBottom: '4px', marginLeft: 'auto' }}>
          {data.date}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {levels.filter(l => l.pct > 0).map(l => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', width: '100px', flexShrink: 0 }}>{l.label}</span>
            <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${l.pct}%`, background: l.color, borderRadius: '2px' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', width: '38px', textAlign: 'right' }}>{l.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>NOAA/USDA/NIDIS Drought Monitor</div>
    </div>
  )
}



// ─── Widget: Near Earth Objects ───────────────────────────────────────────────

interface NEOObject { name: string; hazardous: boolean; diameter_km: number | null; miss_distance_lunar: number; velocity_kms: number; date: string }

function NearEarthContent() {
  const [data, setData] = useState<{ total: number; hazardous_count: number; closest: NEOObject[]; date_range: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/external/neo')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d && !d.error ? d : null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!data) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>{data.total}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>Near Earth Objects</div>
        </div>
        {data.hazardous_count > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: '#EF4444', lineHeight: 1 }}>{data.hazardous_count}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px' }}>Potentially Hazardous</div>
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textAlign: 'right' }}>{data.date_range}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
        {data.closest.slice(0, 4).map((o, i) => {
          const jplUrl = `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(o.name.replace(/[()]/g, '').trim())}`
          return (
            <a key={i} href={jplUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'var(--color-surface)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
            >
              {o.hazardous && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#EF4444', flexShrink: 0 }}>PHA</span>}
              <span style={{ fontSize: '12px', color: o.hazardous ? '#F59E0B' : 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', flexShrink: 0 }}>{o.miss_distance_lunar.toFixed(1)} LD</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', flexShrink: 0 }}>{o.date}</span>
            </a>
          )
        })}
      </div>
      <a href="https://cneos.jpl.nasa.gov/ca/" target="_blank" rel="noopener noreferrer"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textDecoration: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-subtle)')}
      >
        NASA CNEOS · LD = lunar distances
      </a>
    </div>
  )
}

// ─── Widget: Storm Threats (NHC + PTWC) ──────────────────────────────────────

function StormThreatsContent() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?category=hurricane,tsunami&limit=6')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  const srcColor = (source: string) => source === 'NHC' ? '#3B82F6' : source === 'PTWC' ? '#F59E0B' : 'var(--color-muted)'

  if (!items.length) return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#22C55E', letterSpacing: '0.06em' }}>NO ACTIVE STORM ADVISORIES</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {items.map(item => (
        <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '10px 14px', borderLeft: `3px solid ${srcColor(item.source)}` }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: srcColor(item.source), textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.source}</span>
            {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{item.title}</div>
        </a>
      ))}
    </div>
  )
}

// ─── Widget: CISA Cybersecurity Alerts ────────────────────────────────────────

function CisaAlertsContent() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?category=cybersecurity&limit=6')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!items.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>No recent advisories.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {items.map(item => (
        <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '10px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.source}</span>
            {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{item.title}</div>
        </a>
      ))}
    </div>
  )
}

// ─── Widget: Travel Advisories ────────────────────────────────────────────────

function TravelAdvisoriesContent() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?category=travel&limit=6')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!items.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>No recent advisories.</div>

  const levelColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('level 4') || t.includes('do not travel')) return '#EF4444'
    if (t.includes('level 3') || t.includes('reconsider')) return '#F59E0B'
    if (t.includes('level 2') || t.includes('exercise increased')) return '#EAB308'
    return 'var(--color-muted)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {items.map(item => {
        const color = levelColor(item.title)
        return (
          <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '10px 14px', borderLeft: `3px solid ${color}` }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>State Dept</span>
              {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.3 }}>{item.title}</div>
          </a>
        )
      })}
    </div>
  )
}

// ─── Panel registry ───────────────────────────────────────────────────────────

interface PanelDef {
  id: string; label: string; description: string; category: string
  link?: string; linkLabel?: string; configurable?: boolean
}

const PANEL_DEFS: PanelDef[] = [
  { id: 'alerts',           label: 'Active Alerts',      description: 'Severe and Extreme events from all sources',          category: 'Situational Awareness', link: '/feed',       linkLabel: 'View feed' },
  { id: 'map',              label: 'Live Map',            description: 'Interactive map with live event markers',             category: 'Situational Awareness', link: '/map',        linkLabel: 'Full map' },
  { id: 'event_counts',     label: 'Event Summary',       description: 'Active event counts by severity, source, and type',  category: 'Situational Awareness', link: '/feed',       linkLabel: 'View feed' },
  { id: 'radar_widget',     label: 'Radar',               description: 'Live weather radar overlay',                         category: 'Situational Awareness', link: '/map',        linkLabel: 'Full map' },
  { id: 'storm_threats',    label: 'Storm Threats',       description: 'Active hurricane and tsunami advisories',             category: 'Situational Awareness' },
  { id: 'news',             label: 'Latest News',         description: 'Verified news from curated sources',                 category: 'News & Intel',          link: '/feed',       linkLabel: 'View all', configurable: true },
  { id: 'space_weather',    label: 'Space Weather',       description: 'NOAA SWPC geomagnetic storm and solar flare alerts', category: 'News & Intel' },
  { id: 'cisa_alerts',      label: 'CISA Alerts',         description: 'Cybersecurity advisories and alerts from CISA',     category: 'News & Intel' },
  { id: 'travel_advisories',label: 'Travel Advisories',   description: 'US State Department travel advisories by country',  category: 'News & Intel' },
  { id: 'recalls',          label: 'Active Recalls',      description: 'Recent FDA and USDA food and drug recall alerts',   category: 'News & Intel' },
  { id: 'community',        label: 'Community',           description: 'Latest community posts and discussions',             category: 'Community',             link: '/community',  linkLabel: 'View all' },
  { id: 'field_reports',    label: 'Field Reports',       description: 'Ground-level reports from members',                 category: 'Community',             link: '/community',  linkLabel: 'View all' },
  { id: 'top_guides',       label: 'Top Guides',          description: 'Highest rated guides from the compendium',          category: 'Community',             link: '/compendium', linkLabel: 'View all' },
  { id: 'markets',          label: 'Markets',             description: 'Gold, silver, oil, and stock index prices',         category: 'Economic', configurable: true },
  { id: 'economic_signals', label: 'Economic Signals',    description: 'Yield curve, CPI, M2 money supply, bank failures',  category: 'Economic' },
  { id: 'crypto',           label: 'Crypto',              description: 'Bitcoin and Ethereum spot prices with 24h change',  category: 'Economic' },
  { id: 'drought',          label: 'Drought Monitor',     description: 'US drought coverage by level from NOAA/USDA/NIDIS',category: 'Economic' },
  { id: 'near_earth',       label: 'Near Earth Objects',  description: 'Upcoming asteroid and comet close approaches from NASA', category: 'Science' },
  { id: 'quick_actions',    label: 'Quick Actions',       description: 'Navigation links and auth actions',                 category: 'Tools' },
  { id: 'inventory',        label: 'Inventory Status',    description: 'Summary of your prep inventory',                   category: 'Tools',                 link: '/tools',      linkLabel: 'Manage' },
]

const PANEL_CATEGORIES = ['Situational Awareness', 'News & Intel', 'Community', 'Economic', 'Science', 'Tools']

// ─── Panel content dispatcher ────────────────────────────────────────────────

function renderPanelContent(
  type: string,
  data: DashData,
  user: { username: string } | null,
  config?: Record<string, unknown>,
  onSetConfig?: (update: Record<string, unknown>) => void,
) {
  switch (type) {
    case 'alerts':           return <AlertsContent data={data} />
    case 'map':              return <MapContent data={data} />
    case 'event_counts':     return <EventCountsContent data={data} />
    case 'news':             return <NewsContent data={data} config={config} onSetConfig={onSetConfig} />
    case 'community':        return <CommunityContent data={data} />
    case 'field_reports':    return <FieldReportsContent data={data} />
    case 'quick_actions':    return <QuickActionsContent user={user} />
    case 'inventory':        return <InventoryContent />
    case 'top_guides':       return <TopGuidesContent />
    case 'radar_widget':     return <RadarWidgetContent />
    case 'markets':          return <MarketsContent config={config} onSetConfig={onSetConfig} />
    case 'economic_signals': return <EconomicSignalsContent />
    case 'space_weather':    return <SpaceWeatherContent />
    case 'recalls':          return <RecallsContent />
    case 'crypto':           return <CryptoContent />
    case 'drought':          return <DroughtContent />
    case 'near_earth':       return <NearEarthContent />
    case 'storm_threats':    return <StormThreatsContent />
    case 'cisa_alerts':      return <CisaAlertsContent />
    case 'travel_advisories':return <TravelAdvisoriesContent />
    default: return null
  }
}

// ─── Panel picker modal ───────────────────────────────────────────────────────

function PanelPicker({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', width: '100%', maxWidth: '500px', maxHeight: '72vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Select Panel</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>&#215;</button>
        </div>
        <div style={{ overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {PANEL_CATEGORIES.map(cat => {
            const panels = PANEL_DEFS.filter(p => p.category === cat)
            return (
              <div key={cat}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {panels.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSelect(p.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'rgba(34,197,94,0.05)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{p.label}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-subtle)' }}>{p.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '24px', maxWidth: '360px', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '10px' }}>Change Column Layout?</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
          Switching column count resets all slot assignments. Your current layout will be cleared.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-display)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '7px 16px', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            Reset and Switch
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const now = useCurrentTime()

  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const [columns, setColumns] = useState<ColMode>(DEFAULT_PREFS.columns)
  const [rows, setRows] = useState(DEFAULT_PREFS.rows)
  const [slots, setSlots] = useState<Record<string, SlotEntry | null>>(DEFAULT_PREFS.slots)
  const [editMode, setEditMode] = useState(false)
  const [pickerSlot, setPickerSlot] = useState<string | null>(null)
  const [confirmColumns, setConfirmColumns] = useState<ColMode | null>(null)
  const [movingSlot, setMovingSlot] = useState<string | null>(null)

  const hydratedRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function fetchData() {
      const [evs, nws, psts] = await Promise.all([
        fetch('/api/events?limit=500').then(r => r.json()).catch(() => []),
        fetch('/api/news?limit=10').then(r => r.json()).catch(() => []),
        fetch('/api/posts?limit=20').then(r => r.json()).catch(() => []),
      ])
      setEvents(Array.isArray(evs) ? evs : [])
      setNews(Array.isArray(nws) ? nws : [])
      setPosts(Array.isArray(psts) ? psts : [])
      setLoading(false)
    }
    fetchData()
    const id = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user || hydratedRef.current) return
    hydratedRef.current = true
    const pref = (user.preferences as { dashboard?: DashboardPrefs } | undefined)?.dashboard
    if (pref?.columns && pref?.rows && pref?.slots) {
      setColumns(pref.columns)
      setRows(pref.rows)
      setSlots(pref.slots)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: { dashboard: { columns, rows, slots } } }),
      }).catch(() => {})
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [columns, rows, slots, user])

  useEffect(() => {
    if (editMode) return
    setMovingSlot(null)
    setSlots(prev => {
      const next = { ...prev }
      let changed = false
      for (const key of Object.keys(next)) {
        const slot = next[key]
        if (slot?.config?._open) {
          next[key] = { ...slot, config: { ...slot.config, _open: false } }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [editMode])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMovingSlot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const data: DashData = { events, news, posts, loading }
  const severeCount = events.filter(e => e.severity === 'Extreme' || e.severity === 'Severe').length

  function setSlotConfig(key: string, update: Record<string, unknown>) {
    setSlots(prev => {
      const slot = prev[key]
      if (!slot) return prev
      return { ...prev, [key]: { ...slot, config: { ...slot.config, ...update } } }
    })
  }

  function handlePickerSelect(panelId: string) {
    if (pickerSlot === null) return
    setSlots(prev => ({ ...prev, [pickerSlot]: { type: panelId, config: {} } }))
    setPickerSlot(null)
  }

  function applyColumnSwitch(mode: ColMode) {
    setColumns(mode)
    setRows(3)
    setSlots({})
    setConfirmColumns(null)
  }

  function handleColumnChange(mode: ColMode) {
    if (mode === columns) return
    const anyFilled = Object.values(slots).some(s => s !== null)
    if (anyFilled) {
      setConfirmColumns(mode)
    } else {
      applyColumnSwitch(mode)
    }
  }

  function removeRow(rowIdx: number) {
    const numCols = columns as number
    const total = rows * numCols
    setSlots(prev => {
      const next: Record<string, SlotEntry | null> = {}
      let newIdx = 0
      for (let i = 0; i < total; i++) {
        if (Math.floor(i / numCols) === rowIdx) continue
        next[String(newIdx)] = prev[String(i)] ?? null
        newIdx++
      }
      return next
    })
    setRows(r => r - 1)
  }

  function swapSlots(a: string, b: string) {
    setSlots(prev => ({ ...prev, [a]: prev[b] ?? null, [b]: prev[a] ?? null }))
    setMovingSlot(null)
  }

  function renderSlot(key: string) {
    const slot = slots[key] ?? null
    const def = slot ? PANEL_DEFS.find(p => p.id === slot.type) : null
    const isMoving = movingSlot === key
    const isMoveTarget = movingSlot !== null && movingSlot !== key

    if (!slot || !def) {
      return (
        <EmptySlot
          key={key}
          editMode={editMode}
          isMoveTarget={isMoveTarget}
          onClick={() => { if (isMoveTarget) swapSlots(movingSlot!, key); else if (editMode) setPickerSlot(key) }}
        />
      )
    }

    const onConfigure = def.configurable
      ? () => setSlotConfig(key, { _open: !slot.config._open })
      : undefined

    return (
      <div key={key} style={{ position: 'relative' }}>
        <Panel
          title={def.label}
          link={!editMode ? def.link : undefined}
          linkLabel={def.linkLabel}
          editMode={editMode}
          onPickSlot={() => setPickerSlot(key)}
          onClear={() => setSlots(prev => ({ ...prev, [key]: null }))}
          onConfigure={onConfigure}
          onMoveStart={() => setMovingSlot(isMoving ? null : key)}
          isMoving={isMoving}
        >
          {renderPanelContent(slot.type, data, user, slot.config, u => setSlotConfig(key, u))}
        </Panel>
        {isMoveTarget && (
          <div
            onClick={() => swapSlots(movingSlot!, key)}
            style={{ position: 'absolute', inset: 0, borderRadius: '8px', cursor: 'pointer', border: '1px dashed rgba(34,197,94,0.45)', background: 'rgba(34,197,94,0.04)', zIndex: 10 }}
          />
        )}
      </div>
    )
  }

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  const colBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
  })

  const COL_MODES: { value: ColMode; label: string }[] = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 'focus', label: 'Focus' },
  ]

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '16px' : '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block', animation: 'pulse-green 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.12em' }}>LIVE</span>
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>SITREP</span>
            {!isMobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', letterSpacing: '0.06em' }}>{dateStr} · {timeStr}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
            {editMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '2px' }}>Cols</span>
                {COL_MODES.map(m => (
                  <button key={String(m.value)} onClick={() => handleColumnChange(m.value)} style={colBtnStyle(columns === m.value)}>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            {!editMode && severeCount > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '5px', padding: '4px 10px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#EF4444', letterSpacing: '0.04em' }}>{severeCount} severe</span>
              </div>
            )}
            {!editMode && severeCount === 0 && !loading && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '5px', padding: '4px 10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.04em' }}>All clear</span>
              </div>
            )}
            <button
              onClick={() => setEditMode(v => !v)}
              style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 500, cursor: 'pointer', border: `1px solid ${editMode ? 'var(--color-accent)' : 'var(--color-border)'}`, background: editMode ? 'rgba(34,197,94,0.1)' : 'transparent', color: editMode ? 'var(--color-accent)' : 'var(--color-muted)' }}
            >
              {editMode ? 'Done' : 'Edit Layout'}
            </button>
          </div>
        </div>
        {isMobile && (
          <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.06em' }}>
            {dateStr} · {timeStr}
          </div>
        )}
      </div>

      {movingSlot !== null && (
        <div style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)', padding: '6px 24px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(34,197,94,0.8)', letterSpacing: '0.08em' }}>
            Click any slot to move the panel there. Press Esc to cancel.
          </span>
        </div>
      )}

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        {columns === 'focus' && !isMobile ? (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', alignItems: 'start' }}>
            {renderSlot('0')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[1, 2, 3].map(i => renderSlot(String(i)))}
            </div>
          </div>
        ) : columns === 'focus' && isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[0, 1, 2, 3].map(i => renderSlot(String(i)))}
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Array.from({ length: rows * (columns as number) }, (_, i) => renderSlot(String(i)))}
          </div>
        ) : (() => {
          const numCols = columns as number
          const removeRowIdx = (() => {
            for (let r = rows - 1; r >= 0; r--) {
              const keys = Array.from({ length: numCols }, (_, c) => String(r * numCols + c))
              if (keys.every(k => !slots[k])) return r
            }
            return null
          })()
          return (
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              {Array.from({ length: numCols }, (_, colIdx) => (
                <div key={colIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {Array.from({ length: rows }, (_, rowIdx) => renderSlot(String(rowIdx * numCols + colIdx)))}
                </div>
              ))}
            </div>
          )
        })()}

        {columns !== 'focus' && !isMobile && editMode && (() => {
          const numCols = columns as number
          const removeRowIdx = (() => {
            for (let r = rows - 1; r >= 0; r--) {
              const keys = Array.from({ length: numCols }, (_, c) => String(r * numCols + c))
              if (keys.every(k => !slots[k])) return r
            }
            return null
          })()
          return removeRowIdx !== null && rows > 1 ? (
            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <button
                onClick={() => removeRow(removeRowIdx)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(239,68,68,0.5)', padding: '2px 0' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
              >
                Remove empty row
              </button>
            </div>
          ) : null
        })()}

        {columns !== 'focus' && editMode && (
          <div style={{ marginTop: '14px' }}>
            <button
              onClick={() => setRows(r => r + 1)}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
            >
              + Add Row
            </button>
          </div>
        )}

        {editMode && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              onClick={() => { setColumns(DEFAULT_PREFS.columns); setRows(DEFAULT_PREFS.rows); setSlots(DEFAULT_PREFS.slots) }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', padding: '4px 0' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-muted)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-subtle)')}
            >
              Reset to default layout
            </button>
          </div>
        )}
      </div>

      {pickerSlot !== null && (
        <PanelPicker onSelect={handlePickerSelect} onClose={() => setPickerSlot(null)} />
      )}
      {confirmColumns !== null && (
        <ConfirmDialog onConfirm={() => applyColumnSwitch(confirmColumns)} onCancel={() => setConfirmColumns(null)} />
      )}
    </div>
  )
}
