import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface DisasterEvent {
  id: number
  source: string
  event_type: string
  title: string
  severity: string
  geometry: GeoJSON.Geometry | null
  properties: Record<string, unknown>
  external_id: string
  starts_at: string | null
  expires_at: string | null
  fetched_at: string
}

const SEVERITY_COLOR: Record<string, string> = {
  Extreme: '#EF4444',
  Severe:  '#EF4444',
  Moderate:'#F59E0B',
  Minor:   '#22C55E',
}

function svgIcon(svg: string): L.DivIcon {
  return L.divIcon({ html: svg, className: '', iconAnchor: [12, 12] })
}

function circleIcon(color: string) {
  return svgIcon(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>
  </svg>`)
}

function triangleIcon(color: string) {
  return svgIcon(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,3 22,21 2,21" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>
  </svg>`)
}

function squareIcon(color: string) {
  return svgIcon(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>
  </svg>`)
}

function diamondIcon(color: string) {
  return svgIcon(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 22,12 12,22 2,12" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>
  </svg>`)
}

const SOURCE_ICON: Record<string, (c: string) => L.DivIcon> = {
  noaa: circleIcon,
  usgs: triangleIcon,
  fema: squareIcon,
  epa:  diamondIcon,
}

function formatTime(iso: string | null) {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleString()
}

interface EventLayerProps {
  events: DisasterEvent[]
  activeFilters: Set<string>
}

function EventLayer({ events, activeFilters }: EventLayerProps) {
  const map = useMap()
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!groupRef.current) {
      groupRef.current = L.layerGroup().addTo(map)
    }
    groupRef.current.clearLayers()

    for (const event of events) {
      if (!activeFilters.has(event.source) || !event.geometry) continue

      const color = SEVERITY_COLOR[event.severity] ?? '#71717A'
      const iconFn = SOURCE_ICON[event.source] ?? circleIcon

      let latlng: L.LatLngExpression | null = null
      if (event.geometry.type === 'Point') {
        const [lng, lat] = (event.geometry as GeoJSON.Point).coordinates
        latlng = [lat, lng]
      } else if (event.geometry.type === 'Polygon' || event.geometry.type === 'MultiPolygon') {
        latlng = L.geoJSON(event.geometry as GeoJSON.GeoJsonObject).getBounds().getCenter()
      }
      if (!latlng) continue

      const p = event.properties as Record<string, string>
      const marker = L.marker(latlng, { icon: iconFn(color) })
      marker.bindPopup(`
        <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:4px">
            ${event.source.toUpperCase()} · ${event.event_type}
          </div>
          <div style="font-weight:600;font-size:14px;margin-bottom:6px">${event.title}</div>
          <div style="font-size:12px;color:#A1A1AA">
            <span style="color:${color};font-weight:600">${event.severity}</span>
            ${event.expires_at ? ` · Expires ${formatTime(event.expires_at)}` : ''}
          </div>
          ${p.areaDesc ? `<div style="font-size:11px;color:#71717A;margin-top:4px">${p.areaDesc}</div>` : ''}
        </div>
      `)
      groupRef.current.addLayer(marker)
    }
  }, [events, activeFilters, map])

  return null
}

const SOURCES = [
  { key: 'noaa', label: 'Weather (NOAA)' },
  { key: 'usgs', label: 'Seismic (USGS)' },
  { key: 'fema', label: 'Federal (FEMA)' },
  { key: 'epa',  label: 'Air Quality (EPA)' },
]

export default function MapPage() {
  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState(new Set(['noaa', 'usgs', 'fema', 'epa']))

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false) })
      .catch(() => { setError('Failed to load event data'); setLoading(false) })
  }, [])

  function toggleFilter(source: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(source) ? next.delete(source) : next.add(source)
      return next
    })
  }

  const counts = events.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--color-bg)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap',
      }}>
        {SOURCES.map(s => (
          <button key={s.key} onClick={() => toggleFilter(s.key)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '4px', fontSize: '12px',
            fontFamily: 'var(--font-display)', cursor: 'pointer',
            border: `1px solid ${activeFilters.has(s.key) ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: activeFilters.has(s.key) ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: activeFilters.has(s.key) ? 'var(--color-accent)' : 'var(--color-muted)',
            transition: 'all 0.15s',
          }}>
            {s.label}
            {counts[s.key] != null && (
              <span style={{
                background: 'var(--color-surface-elevated)',
                borderRadius: '3px', padding: '1px 5px', fontSize: '11px',
              }}>{counts[s.key]}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
          {loading ? 'Loading...' : error ? <span style={{ color: 'var(--color-danger)' }}>{error}</span> : `${events.length} active events`}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[39.5, -98.35]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />
          <EventLayer events={events} activeFilters={activeFilters} />
        </MapContainer>
      </div>
    </div>
  )
}
