import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { EventLayer, RadarLayer, WeatherAlertLayer, type DisasterEvent } from '../components/MapEventLayer'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useContextDrawer } from '../context/ContextDrawerContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number; source: string; title: string; url: string | null
  summary: string | null; category: string | null; published_at: string | null
  slug?: string | null; discussion_count?: number
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
    '0': { type: 'live_feed',     config: {} },
    '1': { type: 'map',           config: {} },
    '2': { type: 'event_counts',  config: {} },
    '3': { type: 'top_guides',    config: {} },
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

function eventCentroid(geom: DisasterEvent['geometry']): [number, number] | null {
  if (!geom) return null
  if (geom.type === 'Point') {
    const [lon, lat] = (geom as GeoJSON.Point).coordinates
    return [lat, lon]
  }
  let ring: number[][]
  if (geom.type === 'Polygon') ring = (geom as GeoJSON.Polygon).coordinates[0]
  else if (geom.type === 'MultiPolygon') ring = (geom as GeoJSON.MultiPolygon).coordinates[0][0]
  else return null
  const lats = ring.map(c => c[1])
  const lons = ring.map(c => c[0])
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ]
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
  title, link, linkLabel, editMode, children, onPickSlot, onClear, onConfigure,
  dragHandleProps, isDropTarget,
  onResize, currentSpan, maxSpan, currentMinHeight,
}: {
  title: string; link?: string; linkLabel?: string
  editMode: boolean; children: React.ReactNode
  onPickSlot: () => void; onClear: () => void; onConfigure?: () => void
  dragHandleProps?: { attributes: ReturnType<typeof useDraggable>['attributes']; listeners: ReturnType<typeof useDraggable>['listeners'] }
  isDropTarget?: boolean
  onResize?: (span: number, minHeight: number) => void; currentSpan?: number; maxSpan?: number; currentMinHeight?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startSpan: number } | null>(null)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const [resizing, setResizing] = useState(false)

  const span = currentSpan ?? 1
  const maxSpanVal = maxSpan ?? 1

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current || !panelRef.current) return
      const { startX, startY, startW, startH, startSpan } = dragRef.current
      const newH = Math.max(80, startH + (e.clientY - startY))
      panelRef.current.style.minHeight = `${newH}px`
      if (maxSpanVal > 1) {
        const colWidth = startW / startSpan
        const deltaSpan = Math.round((e.clientX - startX) / colWidth)
        const newSpan = Math.min(maxSpanVal, Math.max(1, startSpan + deltaSpan))
        panelRef.current.dataset.pendingSpan = String(newSpan)
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (!dragRef.current || !panelRef.current) return
      const { startX, startY, startW, startH, startSpan } = dragRef.current
      const newH = Math.max(80, startH + (e.clientY - startY))
      let newSpan = startSpan
      if (maxSpanVal > 1) {
        const colWidth = startW / startSpan
        const deltaSpan = Math.round((e.clientX - startX) / colWidth)
        newSpan = Math.min(maxSpanVal, Math.max(1, startSpan + deltaSpan))
      }
      onResizeRef.current?.(newSpan, newH)
      dragRef.current = null
      setResizing(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [maxSpanVal])

  const eBtnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '3px',
    color: 'var(--color-muted)', cursor: 'pointer', fontSize: '12px', padding: '1px 6px',
    fontFamily: 'var(--font-mono)', lineHeight: 1.4,
  }

  return (
    <div
      ref={panelRef}
      style={{
        border: `1px solid ${isDropTarget ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: '8px', background: 'var(--color-surface)', overflow: 'hidden',
        boxShadow: isDropTarget ? '0 0 0 2px rgba(34,197,94,0.2)' : 'none',
        minHeight: currentMinHeight ? `${currentMinHeight}px` : undefined,
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
        {editMode && dragHandleProps && (
          <span
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            title="Drag to move"
            style={{ cursor: 'grab', color: 'var(--color-subtle)', fontSize: '13px', lineHeight: 1, letterSpacing: '-1px', touchAction: 'none', flexShrink: 0, padding: '2px' }}
          >
            ⠿
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{title}</span>
        {editMode ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {onConfigure && <button onClick={onConfigure} style={eBtnStyle}>Config</button>}
            <button onClick={e => { e.stopPropagation(); onPickSlot() }} style={eBtnStyle}>Change</button>
            <button onClick={e => { e.stopPropagation(); onClear() }} style={{ ...eBtnStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }}>Remove</button>
          </div>
        ) : link ? (
          <Link to={link} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', letterSpacing: '0.04em', textDecoration: 'none' }}>
            {linkLabel ?? 'View all'}
          </Link>
        ) : null}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      {editMode && onResize && (
        <div
          onMouseDown={e => {
            e.preventDefault()
            setResizing(true)
            dragRef.current = {
              startX: e.clientX, startY: e.clientY,
              startW: panelRef.current?.offsetWidth ?? 200, startH: panelRef.current?.offsetHeight ?? 120,
              startSpan: span,
            }
          }}
          style={{
            position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px',
            cursor: maxSpanVal > 1 ? 'nwse-resize' : 'ns-resize', zIndex: 5,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '3px',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: resizing ? 1 : 0.35 }}>
            <path d="M9 1 L1 9 M9 5 L5 9 M9 9 L9 9" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Empty slot ───────────────────────────────────────────────────────────────

function EmptySlot({ editMode, onClick, isDropTarget, dropRef }: { editMode: boolean; onClick: () => void; isDropTarget?: boolean; dropRef?: (node: HTMLElement | null) => void }) {
  const [hovered, setHovered] = useState(false)
  const active = hovered || isDropTarget
  return (
    <div
      ref={dropRef}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px dashed ${isDropTarget ? 'rgba(34,197,94,0.5)' : active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '8px',
        minHeight: '120px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        gap: '7px',
        cursor: editMode ? 'pointer' : 'default',
        background: isDropTarget ? 'rgba(34,197,94,0.06)' : active ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'border-color 0.12s, background 0.12s',
      }}
    >
      <span style={{ fontSize: '16px', color: isDropTarget ? 'rgba(34,197,94,0.6)' : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', lineHeight: 1, transition: 'color 0.12s' }}>
        {isDropTarget ? '⇩' : '+'}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: isDropTarget ? 'rgba(34,197,94,0.6)' : active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', letterSpacing: '0.08em', transition: 'color 0.12s' }}>
        {isDropTarget ? 'Drop here' : 'Add a panel.'}
      </span>
    </div>
  )
}

// ─── Widget: Live Feed (events + news + community reports, combined) ─────────

interface LiveFeedRow {
  kind: 'event' | 'news' | 'post'
  key: string
  title: string
  badge: string
  color: string
  timeIso: string | null
  slug?: string | null
  discussionCount?: number
  centroid?: [number, number] | null
  url?: string | null
  postId?: number
}

function LiveFeedContent({ data, config, onSetConfig }: {
  data: DashData
  config?: Record<string, unknown>
  onSetConfig?: (u: Record<string, unknown>) => void
}) {
  const { open: openDrawer } = useContextDrawer()
  const navigate = useNavigate()

  const showEvents = config?.showEvents !== false
  const showNews   = config?.showNews   !== false
  const showPosts  = config?.showPosts  !== false
  const severeOnly = config?.severeOnly !== false
  const configOpen = config?._open === true

  const rows = useMemo<LiveFeedRow[]>(() => {
    const out: LiveFeedRow[] = []
    if (showEvents) {
      // Same anti-flood cap as before: don't let one source+type (e.g. a
      // MeteoAlarm storm issuing one alert per French department) bury
      // everything else in near-duplicates.
      const seenCounts = new Map<string, number>()
      for (const e of data.events) {
        if (severeOnly && e.severity !== 'Extreme' && e.severity !== 'Severe') continue
        const dupKey = `${e.source}:${e.event_type}`
        const count = seenCounts.get(dupKey) ?? 0
        seenCounts.set(dupKey, count + 1)
        if (count >= 3) continue
        out.push({
          kind: 'event', key: `e-${e.id}`, title: e.title,
          badge: `${e.severity.toUpperCase()} · ${e.event_type.replace(/_/g, ' ')}`,
          color: SEV_COLOR[e.severity] ?? '#71717A',
          timeIso: e.fetched_at, slug: e.slug, discussionCount: e.discussion_count,
          centroid: eventCentroid(e.geometry),
        })
      }
    }
    if (showNews) {
      for (const n of data.news) {
        out.push({
          kind: 'news', key: `n-${n.id}`, title: n.title,
          badge: n.source, color: '#3B82F6',
          timeIso: n.published_at, slug: n.slug, discussionCount: n.discussion_count, url: n.url,
        })
      }
    }
    if (showPosts) {
      for (const p of data.posts) {
        if (p.post_type !== 'field_report' && p.post_type !== 'self_reported_news') continue
        out.push({
          kind: 'post', key: `p-${p.id}`, title: p.title,
          badge: POST_TYPE_LABEL[p.post_type] ?? p.post_type,
          color: POST_TYPE_COLOR[p.post_type] ?? '#71717A',
          timeIso: p.created_at, postId: p.id,
        })
      }
    }
    return out.sort((a, b) => new Date(b.timeIso ?? 0).getTime() - new Date(a.timeIso ?? 0).getTime())
  }, [data, showEvents, showNews, showPosts, severeOnly])

  const configPanel = configOpen && onSetConfig ? (
    <div style={{ padding: '12px 14px', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Show</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {([
          ['showEvents', showEvents, 'Events'],
          ['showNews', showNews, 'News'],
          ['showPosts', showPosts, 'Community'],
        ] as const).map(([key, active, label]) => (
          <button key={key} onClick={() => onSetConfig({ [key]: !active })}
            style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer',
              border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: active ? 'var(--color-accent)' : 'var(--color-muted)' }}>
            {label}
          </button>
        ))}
      </div>
      {showEvents && (
        <button onClick={() => onSetConfig({ severeOnly: !severeOnly })}
          style={{ alignSelf: 'flex-start', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer',
            border: `1px solid ${severeOnly ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: severeOnly ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: severeOnly ? 'var(--color-accent)' : 'var(--color-muted)' }}>
          {severeOnly ? '✓ ' : ''}Severe/Extreme events only
        </button>
      )}
    </div>
  ) : null

  if (data.loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>

  if (rows.length === 0) return (
    <div>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#22C55E', letterSpacing: '0.06em' }}>NOTHING TO SHOW</span>
      </div>
      {configPanel}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
        {rows.slice(0, 10).map(row => (
          <div key={row.key} style={{ background: 'var(--color-surface)', padding: '9px 14px', borderLeft: `3px solid ${row.color}` }}>
            <div
              onClick={() => {
                if (row.kind === 'post' && row.postId) navigate(`/post/${row.postId}`)
                else if (row.kind === 'news' && row.url) window.open(row.url, '_blank', 'noopener,noreferrer')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, cursor: (row.kind === 'post' || (row.kind === 'news' && row.url)) ? 'pointer' : 'default' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: row.color, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, maxWidth: '38%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.badge}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
              {row.timeIso && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', flexShrink: 0 }}>{timeAgo(row.timeIso)}</span>}
            </div>
            {(row.centroid || row.slug) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                {row.centroid && (
                  <button
                    onClick={e => { e.stopPropagation(); navigate('/map', { state: { flyTo: { lat: row.centroid![0], lon: row.centroid![1] } } }) }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.04em', padding: 0 }}
                  >
                    Map
                  </button>
                )}
                {row.slug && (
                  <button
                    onClick={e => { e.stopPropagation(); openDrawer(row.slug!, row.kind === 'event' ? 'event' : 'news') }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.04em', padding: 0 }}
                  >
                    {row.discussionCount ? `${row.discussionCount} discussion${row.discussionCount !== 1 ? 's' : ''}` : 'Discuss'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {rows.length > 10 && (
        <Link to="/feed" style={{ display: 'block', padding: '10px 14px', background: 'var(--color-surface)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)', textDecoration: 'none', textAlign: 'center' }}>
          +{rows.length - 10} more in the full feed
        </Link>
      )}
      {configPanel}
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

function EventCountsContent({ data, config, onSetConfig }: {
  data: DashData
  config?: Record<string, unknown>
  onSetConfig?: (u: Record<string, unknown>) => void
}) {
  // MeteoAlarm alone can carry thousands of Minor-severity advisories across
  // 45 countries -- real data, but it swamps this summary's whole point,
  // which is telling you what actually matters. Minor is hidden by default;
  // toggle it back on via Config to see everything.
  const hideMinor = config?.hideMinor !== false
  const configOpen = config?._open === true
  const events = hideMinor ? data.events.filter(e => e.severity !== 'Minor') : data.events
  const hiddenCount = data.events.length - events.length

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

  const configPanel = configOpen && onSetConfig ? (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.15)' }}>
      <button onClick={() => onSetConfig({ hideMinor: !hideMinor })}
        style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer',
          border: `1px solid ${hideMinor ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: hideMinor ? 'rgba(34,197,94,0.1)' : 'transparent',
          color: hideMinor ? 'var(--color-accent)' : 'var(--color-muted)' }}>
        {hideMinor ? '✓ ' : ''}Hide Minor-severity events
      </button>
    </div>
  ) : null

  return (
    <div>
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
          {hiddenCount > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: 'auto' }}>
              +{hiddenCount} minor hidden
            </div>
          )}
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

interface MetalQuote { price: number; change_pct: number | null; sparkline?: number[] }
interface MetalsData { gold?: MetalQuote; silver?: MetalQuote }
interface OilData { price: number; change_pct: number | null; period: string; unit: string; sparkline?: number[] }
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

  const fmtUSD2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {showGold   && (goldPrice   != null ? <PriceRow label="Gold"    price={goldPrice}   changePct={metals!.gold!.change_pct   ?? null} fmt={fmtUSD2} sparkline={metals!.gold!.sparkline} /> : <UnavailableRow label="Gold" />)}
      {showSilver && (silverPrice != null ? <PriceRow label="Silver"  price={silverPrice} changePct={metals!.silver!.change_pct ?? null} fmt={n => `$${n.toFixed(2)}`} sparkline={metals!.silver!.sparkline} /> : <UnavailableRow label="Silver" />)}
      {showOil    && (oilPrice    != null ? <PriceRow label="WTI"     price={oilPrice}    changePct={oil!.change_pct            ?? null} fmt={n => `$${n.toFixed(2)}`} sparkline={oil!.sparkline} /> : <UnavailableRow label="WTI" />)}
      {showSP500  && (stockMap['S&P 500'] ? <PriceRow label="S&P 500" price={stockMap['S&P 500'].price}  changePct={stockMap['S&P 500'].change_pct}  fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sparkline={stockMap['S&P 500'].sparkline} /> : <UnavailableRow label="S&P 500" />)}
      {showDow    && (stockMap['Dow']     ? <PriceRow label="Dow"     price={stockMap['Dow'].price}       changePct={stockMap['Dow'].change_pct}       fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} sparkline={stockMap['Dow'].sparkline} />     : <UnavailableRow label="Dow" />)}
      {showNasdaq && (stockMap['NASDAQ']  ? <PriceRow label="NASDAQ"  price={stockMap['NASDAQ'].price}    changePct={stockMap['NASDAQ'].change_pct}    fmt={n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sparkline={stockMap['NASDAQ'].sparkline} />  : <UnavailableRow label="NASDAQ" />)}
      <div style={{ padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>
        Yahoo Finance · 1mo daily
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

// ─── Widget: River Levels (USGS streamflow) ───────────────────────────────────

interface StreamflowSite {
  site_code: string; site_name: string
  discharge_cfs: number | null; gauge_height_ft: number | null
}

function StreamflowContent() {
  const { user } = useAuth()
  const state = user?.region_state
  const [sites, setSites] = useState<StreamflowSite[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!state) { setLoading(false); return }
    setLoading(true)
    setFailed(false)
    fetch(`/api/external/streamflow?state=${encodeURIComponent(state)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setSites(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setFailed(true); setLoading(false) })
  }, [state])

  if (!state) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', marginBottom: '10px' }}>
        Set your state in Settings to see river levels near you.
      </div>
      <Link to="/settings" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
        Open Settings
      </Link>
    </div>
  )

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (failed || !sites || sites.length === 0) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'center' }}>Data unavailable.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {sites.map(s => (
        <div key={s.site_code} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'var(--color-surface)' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.site_name}</span>
          {s.discharge_cfs != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', flexShrink: 0 }}>{Math.round(s.discharge_cfs).toLocaleString()} cfs</span>}
          {s.gauge_height_ft != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)', flexShrink: 0 }}>{s.gauge_height_ft.toFixed(1)} ft</span>}
        </div>
      ))}
      <div style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>USGS Water Services · live gauge readings, highest flow first</div>
    </div>
  )
}

// ─── Widget: Active Wildfires (NIFC WFIGS perimeters) ─────────────────────────

interface WildfireItem {
  name: string; acres: number | null; contained_pct: number | null
  state: string; discovered_at: string | null
}

function WildfiresContent() {
  const [items, setItems] = useState<WildfireItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/external/wildfires')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
  if (!items.length) return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#22C55E', letterSpacing: '0.06em' }}>NO LARGE UNCONTAINED WILDFIRES</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
      {items.map(f => {
        const color = f.contained_pct == null ? 'var(--color-muted)' : f.contained_pct < 25 ? '#EF4444' : f.contained_pct < 75 ? '#F59E0B' : '#22C55E'
        return (
          <div key={`${f.name}-${f.state}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'var(--color-surface)', borderLeft: `3px solid ${color}` }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.name}{f.state ? ` (${f.state})` : ''}
            </span>
            {f.acres != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', flexShrink: 0 }}>{f.acres.toLocaleString()} ac</span>}
            {f.contained_pct != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, flexShrink: 0 }}>{f.contained_pct}% contained</span>}
          </div>
        )
      })}
      <div style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)' }}>NIFC WFIGS · uncontained incidents, largest first</div>
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
          {item.summary && (
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', lineHeight: 1.4, marginTop: '3px' }}>
              {item.summary.length > 140 ? item.summary.slice(0, 140) + '...' : item.summary}
            </div>
          )}
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
  { id: 'live_feed',        label: 'Live Feed',           description: 'Events, news, and community reports in one filterable stream, with map and discuss links', category: 'Situational Awareness', link: '/feed', linkLabel: 'View feed', configurable: true },
  { id: 'map',              label: 'Live Map',            description: 'Interactive map with live event markers',             category: 'Situational Awareness', link: '/map',        linkLabel: 'Full map' },
  { id: 'event_counts',     label: 'Event Summary',       description: 'Active event counts by severity, source, and type',  category: 'Situational Awareness', link: '/feed',       linkLabel: 'View feed', configurable: true },
  { id: 'radar_widget',     label: 'Radar',               description: 'Live weather radar overlay',                         category: 'Situational Awareness', link: '/map',        linkLabel: 'Full map' },
  { id: 'storm_threats',    label: 'Storm Threats',       description: 'Active hurricane and tsunami advisories',             category: 'Situational Awareness' },
  { id: 'wildfires',        label: 'Active Wildfires',     description: 'Uncontained wildfire incidents by size, from NIFC',  category: 'Situational Awareness' },
  { id: 'streamflow',       label: 'River Levels',         description: 'Live USGS gauge readings for your state',            category: 'Situational Awareness' },
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
  { id: 'inventory',        label: 'Inventory Status',    description: 'Summary of your prep inventory',                   category: 'Tools',                 link: '/tools',      linkLabel: 'Manage' },
]

const PANEL_CATEGORIES = ['Situational Awareness', 'News & Intel', 'Community', 'Economic', 'Science', 'Tools']

// ─── Panel content dispatcher ────────────────────────────────────────────────

function renderPanelContent(
  type: string,
  data: DashData,
  config?: Record<string, unknown>,
  onSetConfig?: (update: Record<string, unknown>) => void,
) {
  switch (type) {
    case 'live_feed':        return <LiveFeedContent data={data} config={config} onSetConfig={onSetConfig} />
    case 'map':              return <MapContent data={data} />
    case 'event_counts':     return <EventCountsContent data={data} config={config} onSetConfig={onSetConfig} />
    case 'community':        return <CommunityContent data={data} />
    case 'field_reports':    return <FieldReportsContent data={data} />
    case 'inventory':        return <InventoryContent />
    case 'top_guides':       return <TopGuidesContent />
    case 'radar_widget':     return <RadarWidgetContent />
    case 'markets':          return <MarketsContent config={config} onSetConfig={onSetConfig} />
    case 'economic_signals': return <EconomicSignalsContent />
    case 'space_weather':    return <SpaceWeatherContent />
    case 'recalls':          return <RecallsContent />
    case 'crypto':           return <CryptoContent />
    case 'drought':          return <DroughtContent />
    case 'wildfires':        return <WildfiresContent />
    case 'streamflow':       return <StreamflowContent />
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

// ─── Slot (draggable/droppable grid cell) ─────────────────────────────────────

function DashSlot({
  slotKey, slot, def, editMode, span, numCols, activeDragKey,
  onPickSlot, onClear, onConfigure, onResize, onSetConfig, data,
}: {
  slotKey: string; slot: SlotEntry | null; def: PanelDef | null | undefined
  editMode: boolean; span: number; numCols: number; activeDragKey: string | null
  onPickSlot: () => void; onClear: () => void; onConfigure?: () => void
  onResize: (span: number, minHeight: number) => void
  onSetConfig: (u: Record<string, unknown>) => void
  data: DashData
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: slotKey, disabled: !editMode || !slot })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: slotKey, disabled: !editMode })
  const spanStyle: React.CSSProperties = span > 1 ? { gridColumn: `span ${span}` } : {}
  const isDropTarget = isOver && activeDragKey !== null && activeDragKey !== slotKey

  const setRefs = (node: HTMLElement | null) => { setDragRef(node); setDropRef(node) }

  if (!slot || !def) {
    return (
      <div style={spanStyle}>
        <EmptySlot editMode={editMode} isDropTarget={isDropTarget} dropRef={setRefs} onClick={onPickSlot} />
      </div>
    )
  }

  return (
    <div ref={setRefs} style={{ position: 'relative', opacity: isDragging ? 0.35 : 1, ...spanStyle }}>
      <Panel
        title={def.label}
        link={!editMode ? def.link : undefined}
        linkLabel={def.linkLabel}
        editMode={editMode}
        onPickSlot={onPickSlot}
        onClear={onClear}
        onConfigure={onConfigure}
        dragHandleProps={editMode ? { attributes, listeners } : undefined}
        isDropTarget={isDropTarget}
        currentSpan={span}
        maxSpan={numCols}
        onResize={onResize}
        currentMinHeight={typeof slot.config.minHeight === 'number' ? slot.config.minHeight : undefined}
      >
        {renderPanelContent(slot.type, data, slot.config, onSetConfig)}
      </Panel>
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
  const [activeDragKey, setActiveDragKey] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hydratedRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    async function fetchData() {
      const [evs, nws, psts] = await Promise.all([
        fetch('/api/events?limit=3000').then(r => r.json()).catch(() => []),
        fetch('/api/news?limit=100').then(r => r.json()).catch(() => []),
        fetch('/api/posts?limit=50').then(r => r.json()).catch(() => []),
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
      setSaveStatus('saving')
      fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: { dashboard: { columns, rows, slots } } }),
      })
        .then(res => {
          if (!res.ok) throw new Error(`save failed: ${res.status}`)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        })
        .catch(err => {
          console.error('Dashboard layout save failed:', err)
          setSaveStatus('error')
        })
    }, 2000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [columns, rows, slots, user])

  useEffect(() => {
    if (editMode) return
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
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDragKey(String(e.active.id))
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveDragKey(null)
    if (!e.over) return
    const a = String(e.active.id), b = String(e.over.id)
    if (a !== b) swapSlots(a, b)
  }

  function renderSlot(key: string) {
    const slot = slots[key] ?? null
    const def = slot ? PANEL_DEFS.find(p => p.id === slot.type) : null
    const numCols = typeof columns === 'number' ? columns : 2
    const span = typeof slot?.config?.span === 'number' ? Math.min(slot.config.span, numCols) : 1

    return (
      <DashSlot
        key={key}
        slotKey={key}
        slot={slot}
        def={def}
        editMode={editMode}
        span={span}
        numCols={numCols}
        activeDragKey={activeDragKey}
        onPickSlot={() => setPickerSlot(key)}
        onClear={() => setSlots(prev => ({ ...prev, [key]: null }))}
        onConfigure={def?.configurable ? () => setSlotConfig(key, { _open: !slot!.config._open }) : undefined}
        onResize={(s, h) => setSlotConfig(key, { span: s, minHeight: h })}
        onSetConfig={u => setSlotConfig(key, u)}
        data={data}
      />
    )
  }

  const activeDragLabel = activeDragKey != null
    ? PANEL_DEFS.find(p => p.id === slots[activeDragKey]?.type)?.label
    : null

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
            {editMode && user && saveStatus !== 'idle' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                color: saveStatus === 'error' ? '#EF4444' : saveStatus === 'saved' ? 'var(--color-accent)' : 'var(--color-subtle)',
              }}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save failed, try again'}
              </span>
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

      {editMode && (
        <div style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)', padding: '6px 24px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(34,197,94,0.8)', letterSpacing: '0.08em' }}>
            Drag the ⠿ handle to move a panel. Drag the corner to resize.
          </span>
        </div>
      )}

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragKey(null)}>
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
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: '14px', alignItems: 'start' }}>
                {Array.from({ length: rows * numCols }, (_, i) => renderSlot(String(i)))}
              </div>
            )
          })()}
          <DragOverlay>
            {activeDragLabel ? (
              <div style={{
                padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-accent)',
                background: 'var(--color-surface-elevated)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)',
                cursor: 'grabbing',
              }}>
                {activeDragLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

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
