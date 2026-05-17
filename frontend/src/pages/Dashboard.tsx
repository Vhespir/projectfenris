import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { EventLayer, RadarLayer, WeatherAlertLayer, type DisasterEvent } from '../components/MapEventLayer'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
interface LayoutItem { id: string; width: 'full' | 'half' }

// ─── Layout persistence ───────────────────────────────────────────────────────

const LS_LAYOUT = 'fenris_dashboard_layout'

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'alerts',        width: 'full' },
  { id: 'map',           width: 'full' },
  { id: 'event_counts',  width: 'half' },
  { id: 'news',          width: 'half' },
  { id: 'community',     width: 'half' },
  { id: 'field_reports', width: 'half' },
  { id: 'quick_actions', width: 'half' },
  { id: 'inventory',     width: 'half' },
]

function loadLayout(): LayoutItem[] {
  try { const s = localStorage.getItem(LS_LAYOUT); if (s) return JSON.parse(s) } catch {}
  return DEFAULT_LAYOUT
}

const MAP_WIDGETS = new Set(['map', 'radar_widget'])

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
  useEffect(() => { const id = setInterval(() => setT(new Date()), 60000); return () => clearInterval(id) }, [])
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

// ─── Widget wrapper ───────────────────────────────────────────────────────────

function Widget({
  title, link, linkLabel, editMode, dragListeners, dragAttributes,
  onToggleWidth, onRemove, width, children,
}: {
  title: string; link?: string; linkLabel?: string
  editMode: boolean
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  onToggleWidth: () => void; onRemove: () => void
  width: 'full' | 'half'
  children: React.ReactNode
}) {
  const eBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px',
    color: 'var(--color-muted)', cursor: 'pointer', fontSize: '12px', padding: '1px 6px',
    fontFamily: 'var(--font-mono)', lineHeight: 1.4,
  }
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', overflow: 'hidden', outline: editMode ? '1px dashed rgba(255,255,255,0.06)' : 'none' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
        {editMode && (
          <span
            {...dragAttributes}
            {...dragListeners}
            style={{ color: 'var(--color-subtle)', cursor: 'grab', fontSize: '14px', lineHeight: 1, flexShrink: 0, touchAction: 'none', userSelect: 'none' }}
            title="Drag to reorder"
          >
            ⠿
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{title}</span>
        {editMode ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button onClick={onToggleWidth} style={eBtnStyle} title={width === 'full' ? 'Make half width' : 'Make full width'}>
              {width === 'full' ? '½' : '■'}
            </button>
            <button onClick={onRemove} style={{ ...eBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}>×</button>
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

function NewsContent({ data }: { data: DashData }) {
  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!data.news.length) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>No news items yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {data.news.slice(0, 8).map(item => (
        <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', background: 'var(--color-surface)', padding: '11px 14px' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.source}</span>
            {item.published_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>{timeAgo(item.published_at)}</span>}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>{item.title}</div>
        </a>
      ))}
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
  const [stats, setStats] = useState({ total: 0, out: 0, low: 0, expiringSoon: 0 })

  useEffect(() => {
    const keys = ['bob_72hr', 'bob_winter', 'bob_wildfire', 'food_water', 'medical', 'tools', 'comms', 'power', 'documents', 'shelter']
    let total = 0, out = 0, low = 0, expiringSoon = 0
    const today = new Date().toISOString().slice(0, 10)
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    for (const key of keys) {
      try {
        const items: { qty: number; par: number; expiry: string }[] = JSON.parse(localStorage.getItem(`fenris_inv_${key}`) ?? '[]')
        total += items.length
        for (const i of items) {
          if (i.qty === 0) out++
          else if (i.par > 0 && i.qty < i.par) low++
          if (i.expiry && i.expiry >= today && i.expiry <= soon) expiringSoon++
        }
      } catch {}
    }
    setStats({ total, out, low, expiringSoon })
  }, [])

  if (stats.total === 0) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', marginBottom: '12px' }}>No inventory tracked yet.</div>
      <Link to="/tools" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
        Open Inventory Manager
      </Link>
    </div>
  )

  const statItems = [
    { value: stats.total,        label: 'Items Tracked', color: 'var(--color-text)' },
    { value: stats.out,          label: 'Out of Stock',  color: '#EF4444' },
    { value: stats.low,          label: 'Running Low',   color: '#F59E0B' },
    { value: stats.expiringSoon, label: 'Expiring Soon', color: '#F59E0B' },
  ].filter(s => s.value > 0 || s.label === 'Items Tracked')

  return (
    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      {statItems.map(s => (
        <div key={s.label}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{s.label}</div>
        </div>
      ))}
      <Link to="/tools" style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none', padding: '7px 14px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px' }}>
        Manage
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

// ─── Widget registry ──────────────────────────────────────────────────────────

interface WidgetDef {
  id: string; label: string; description: string
  defaultWidth: 'full' | 'half'
  link?: string; linkLabel?: string
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: 'alerts',        label: 'Active Alerts',   description: 'Severe and Extreme events from all sources',        defaultWidth: 'full',  link: '/feed',      linkLabel: 'View feed' },
  { id: 'map',           label: 'Live Map',         description: 'Interactive map with live event markers',           defaultWidth: 'full',  link: '/map',       linkLabel: 'Full map' },
  { id: 'event_counts',  label: 'Event Summary',    description: 'Active event counts by severity, source, and type', defaultWidth: 'half',  link: '/feed',      linkLabel: 'View feed' },
  { id: 'news',          label: 'Latest News',      description: 'Verified news from curated sources',               defaultWidth: 'half',  link: '/feed',      linkLabel: 'View all' },
  { id: 'community',     label: 'Community',        description: 'Latest community posts and discussions',            defaultWidth: 'half',  link: '/community', linkLabel: 'View all' },
  { id: 'field_reports', label: 'Field Reports',    description: 'Ground-level reports from members',                 defaultWidth: 'half',  link: '/community', linkLabel: 'View all' },
  { id: 'quick_actions', label: 'Quick Actions',    description: 'Navigation links and auth actions',                 defaultWidth: 'half' },
  { id: 'inventory',     label: 'Inventory Status', description: 'Summary of your prep inventory',                   defaultWidth: 'half',  link: '/tools',     linkLabel: 'Manage' },
  { id: 'top_guides',    label: 'Top Guides',       description: 'Highest rated guides from the compendium',          defaultWidth: 'half',  link: '/compendium', linkLabel: 'View all' },
  { id: 'radar_widget', label: 'Radar',            description: 'Live weather radar overlay',                         defaultWidth: 'half',  link: '/map',        linkLabel: 'Full map' },
]

// ─── Widget content dispatcher ───────────────────────────────────────────────

function renderWidgetContent(id: string, data: DashData, user: { username: string } | null) {
  switch (id) {
    case 'alerts':        return <AlertsContent data={data} />
    case 'map':           return <MapContent data={data} />
    case 'event_counts':  return <EventCountsContent data={data} />
    case 'news':          return <NewsContent data={data} />
    case 'community':     return <CommunityContent data={data} />
    case 'field_reports': return <FieldReportsContent data={data} />
    case 'quick_actions': return <QuickActionsContent user={user} />
    case 'inventory':     return <InventoryContent />
    case 'top_guides':    return <TopGuidesContent />
    case 'radar_widget': return <RadarWidgetContent />
    default: return null
  }
}

// ─── Sortable Widget ──────────────────────────────────────────────────────────

function SortableWidget({
  item, def, editMode, isMobile, data, user, onToggleWidth, onRemove,
}: {
  item: LayoutItem; def: WidgetDef; editMode: boolean; isMobile: boolean
  data: DashData; user: { username: string } | null
  onToggleWidth: () => void; onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  // The dragged element stays as an invisible placeholder; DragOverlay renders
  // the visible clone above all stacking contexts (including Leaflet panes).
  // Non-dragged elements animate via transform EXCEPT the map widget -- Leaflet
  // breaks when its container is moved by a CSS transform.
  const isMap = item.id === 'map'
  const applyTransform = !isDragging && !isMap
  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: item.width === 'full' || isMobile ? '1 / -1' : 'span 1',
        transform: applyTransform ? CSS.Transform.toString(transform) : undefined,
        transition: applyTransform ? transition : undefined,
        opacity: isDragging ? 0 : 1,
        // Map widget needs position+zIndex so it paints above animated sort widgets.
        // Animated widgets get z-index:0 from their CSS transform stacking context;
        // the map at z-index:2 stays on top. DragOverlay uses z-index:999 internally
        // so the drag ghost still renders above everything.
        position: isMap ? 'relative' : undefined,
        zIndex: isMap ? 2 : undefined,
      }}
    >
      <Widget
        title={def.label}
        link={!editMode ? def.link : undefined}
        linkLabel={def.linkLabel}
        editMode={editMode}
        dragListeners={listeners as Record<string, unknown>}
        dragAttributes={attributes as Record<string, unknown>}
        onToggleWidth={onToggleWidth}
        onRemove={onRemove}
        width={item.width}
      >
        {renderWidgetContent(item.id, data, user)}
      </Widget>
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

  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout)
  const [editMode, setEditMode] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Hydrate layout from server preferences when user first loads
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!user || hydratedRef.current) return
    const serverLayout = (user.preferences as { dashboard_layout?: LayoutItem[] } | undefined)?.dashboard_layout
    if (serverLayout && Array.isArray(serverLayout) && serverLayout.length > 0) {
      setLayout(serverLayout)
    }
    hydratedRef.current = true
  }, [user])

  // Persist layout to localStorage; debounce-save to server for logged-in users
  useEffect(() => {
    localStorage.setItem(LS_LAYOUT, JSON.stringify(layout))
    if (!user) return
    if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current)
    layoutSaveTimer.current = setTimeout(() => {
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { dashboard_layout: layout } }),
      }).catch(() => {})
    }, 2000)
    return () => { if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current) }
  }, [layout])

  const data: DashData = { events, news, posts, loading }
  const severeCount = events.filter(e => e.severity === 'Extreme' || e.severity === 'Severe').length
  const inLayout = new Set(layout.map(l => l.id))
  const available = WIDGET_DEFS.filter(w => !inLayout.has(w.id))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      setLayout(prev => {
        const oldIndex = prev.findIndex(l => l.id === active.id)
        const newIndex = prev.findIndex(l => l.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function toggleWidth(idx: number) {
    setLayout(prev => prev.map((item, i) => i === idx ? { ...item, width: item.width === 'full' ? 'half' : 'full' } : item))
  }
  function removeWidget(id: string) {
    setLayout(prev => prev.filter(item => item.id !== id))
  }
  function addWidget(id: string) {
    const def = WIDGET_DEFS.find(w => w.id === id)
    setLayout(prev => [...prev, { id, width: def?.defaultWidth ?? 'half' }])
  }
  function resetLayout() {
    setLayout(DEFAULT_LAYOUT)
  }

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div>
      {/* SITREP Header */}
      <div style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '16px' : '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Left: live indicator + title + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block', animation: 'pulse-green 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.12em' }}>LIVE</span>
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>SITREP</span>
            {!isMobile && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', letterSpacing: '0.06em' }}>{dateStr} · {timeStr}</span>}
          </div>

          {/* Right: severe badge + edit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {severeCount > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '5px', padding: '4px 10px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#EF4444', letterSpacing: '0.04em' }}>
                  {severeCount} severe
                </span>
              </div>
            )}
            {severeCount === 0 && !loading && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '5px', padding: '4px 10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.04em' }}>All clear</span>
              </div>
            )}
            <button
              onClick={() => setEditMode(v => !v)}
              style={{
                padding: '5px 12px', borderRadius: '5px', fontSize: '12px',
                fontFamily: 'var(--font-display)', fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${editMode ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: editMode ? 'rgba(34,197,94,0.1)' : 'transparent',
                color: editMode ? 'var(--color-accent)' : 'var(--color-muted)',
              }}
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

      {/* Widget grid */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Map is excluded from SortableContext -- it is never a drag source or
              drop target, so dnd-kit never applies transforms to it or registers
              it for collision detection. Other widgets sort around it freely. */}
          <SortableContext items={layout.filter(l => !MAP_WIDGETS.has(l.id)).map(l => l.id)} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              {layout.map((item, idx) => {
                const def = WIDGET_DEFS.find(w => w.id === item.id)
                if (!def) return null

                if (MAP_WIDGETS.has(item.id)) {
                  return (
                    <div
                      key={item.id}
                      style={{ gridColumn: item.width === 'full' || isMobile ? '1 / -1' : 'span 1', position: 'relative', zIndex: 1 }}
                    >
                      <Widget
                        title={def.label}
                        link={!editMode ? def.link : undefined}
                        linkLabel={def.linkLabel}
                        editMode={editMode}
                        onToggleWidth={() => toggleWidth(idx)}
                        onRemove={() => removeWidget(item.id)}
                        width={item.width}
                      >
                        {renderWidgetContent(item.id, data, user)}
                      </Widget>
                    </div>
                  )
                }

                return (
                  <SortableWidget
                    key={item.id}
                    item={item}
                    def={def}
                    editMode={editMode}
                    isMobile={isMobile}
                    data={data}
                    user={user}
                    onToggleWidth={() => toggleWidth(idx)}
                    onRemove={() => removeWidget(item.id)}
                  />
                )
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeId ? (() => {
              const item = layout.find(l => l.id === activeId)
              const def = WIDGET_DEFS.find(w => w.id === activeId)
              if (!item || !def) return null
              return (
                <div style={{ opacity: 0.92, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', borderRadius: '8px', cursor: 'grabbing' }}>
                  <Widget
                    title={def.label}
                    editMode={false}
                    onToggleWidth={() => {}}
                    onRemove={() => {}}
                    width={item.width}
                  >
                    {renderWidgetContent(activeId, data, user)}
                  </Widget>
                </div>
              )
            })() : null}
          </DragOverlay>
        </DndContext>

        {/* Edit mode: add widgets + reset */}
        {editMode && (
          <div style={{ marginTop: '16px', border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>
              {available.length > 0 ? 'Add Widget' : 'All widgets are active'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: available.length > 0 ? '16px' : '0' }}>
              {available.map(w => (
                <button key={w.id} onClick={() => addWidget(w.id)} style={{
                  padding: '7px 14px', borderRadius: '5px', fontSize: '12px',
                  fontFamily: 'var(--font-display)', fontWeight: 500, cursor: 'pointer',
                  border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                }}>
                  <span>+ {w.label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-subtle)', fontWeight: 400 }}>{w.description}</span>
                </button>
              ))}
            </div>
            <button onClick={resetLayout} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', padding: 0,
            }}>
              Reset to default layout
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
