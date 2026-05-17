import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap, TileLayer, WMSTileLayer } from 'react-leaflet'
import L from 'leaflet'

const FIRMS_KEY = 'de1d4e98f4b93285338eb01c72831ac6'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Weather alerts (NWS + MeteoAlarm) ───────────────────────────────────────

const ALERT_STYLE: Record<string, string> = {
  Extreme:  '#EF4444',
  Severe:   '#F59E0B',
  Moderate: '#3B82F6',
  Minor:    '#22C55E',
}

function alertStyle(severity: string) {
  const color = ALERT_STYLE[severity] ?? '#71717A'
  return { color, weight: 1, fillColor: color, fillOpacity: 0.18, opacity: 0.7 }
}

function alertPopup(source: string, event: string, headline: string, severity: string, expires: string | null, areaDesc: string | null) {
  const color = ALERT_STYLE[severity] ?? '#71717A'
  const sourceName = source === 'meteoalarm' ? 'MeteoAlarm (EU)' : 'NWS (US)'
  return `
    <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:4px">
        ${esc(sourceName)} · ${esc(event)}
      </div>
      <div style="font-weight:600;font-size:14px;margin-bottom:6px">${esc(headline)}</div>
      <div style="font-size:12px;color:#A1A1AA">
        <span style="color:${color};font-weight:600">${esc(severity)}</span>
        ${expires ? ` · Expires ${new Date(expires).toLocaleString()}` : ''}
      </div>
      ${areaDesc ? `<div style="font-size:11px;color:#71717A;margin-top:4px">${esc(areaDesc)}</div>` : ''}
    </div>
  `
}

export function WeatherAlertLayer() {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAlerts() {
      const [nwsRes, meteoRes] = await Promise.allSettled([
        fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert,update'),
        fetch('/api/events?source=meteoalarm&limit=1000'),
      ])

      if (cancelled) return

      const features: GeoJSON.Feature[] = []

      if (nwsRes.status === 'fulfilled' && nwsRes.value.ok) {
        const data = await nwsRes.value.json()
        for (const f of data.features ?? []) {
          if (!f.geometry) continue
          features.push({
            ...f,
            properties: { ...f.properties, _source: 'nws' },
          })
        }
      }

      if (meteoRes.status === 'fulfilled' && meteoRes.value.ok) {
        const events = await meteoRes.value.json()
        for (const e of events) {
          if (!e.geometry) continue
          const p = e.properties as Record<string, string>
          features.push({
            type: 'Feature',
            geometry: e.geometry,
            properties: {
              _source: 'meteoalarm',
              severity: e.severity,
              event: p.event ?? e.event_type,
              headline: e.title,
              expires: e.expires_at,
              areaDesc: p.areaDesc ?? null,
            },
          })
        }
      }

      if (cancelled) return

      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }

      layerRef.current = L.geoJSON({ type: 'FeatureCollection', features }, {
        style: f => alertStyle(f?.properties?.severity ?? 'Minor'),
        onEachFeature: (f, layer) => {
          const p = f.properties
          layer.bindPopup(alertPopup(
            p._source, p.event ?? 'Weather Alert',
            p.headline ?? p.event,
            p.severity ?? 'Minor',
            p.expires ?? null,
            p.areaDesc ?? null,
          ))
        },
      }).addTo(map)
    }

    fetchAlerts()
    const id = setInterval(fetchAlerts, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [map])

  return null
}

// ─── Radar ───────────────────────────────────────────────────────────────────

export function RadarLayer() {
  const [path, setPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchLatest() {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const data = await res.json()
        const past = data?.radar?.past
        if (!cancelled && Array.isArray(past) && past.length > 0) setPath(past[past.length - 1].path)
      } catch {}
    }
    fetchLatest()
    const id = setInterval(fetchLatest, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (!path) return null

  return (
    <TileLayer
      url={`https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/6/1_0.png`}
      opacity={0.65}
      zIndex={200}
      maxNativeZoom={12}
    />
  )
}

// ─── Air traffic ─────────────────────────────────────────────────────────────

const SQUAWK_EMERGENCY: Record<string, { label: string; color: string }> = {
  '7700': { label: 'GENERAL EMERGENCY', color: '#EF4444' },
  '7600': { label: 'RADIO FAILURE',     color: '#F59E0B' },
  '7500': { label: 'HIJACK',            color: '#EF4444' },
}

const POSITION_SOURCE: Record<number, string> = {
  0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM',
}

const AIR_TRAFFIC_MIN_ZOOM = 5

export type AltitudeBand = 'all' | 'cruising' | 'medium' | 'low' | 'ground'

export interface AirTrafficFilters {
  altitudeBand: AltitudeBand
  emergencyOnly: boolean
}

function altColor(onGround: boolean, baroAlt: number | null, emergency: boolean): string {
  if (emergency) return '#EF4444'
  if (onGround) return '#52525B'
  const altFt = baroAlt != null ? baroAlt * 3.281 : null
  if (altFt == null) return '#60A5FA'
  if (altFt < 5000)  return '#F59E0B'
  if (altFt < 25000) return '#60A5FA'
  return '#CBD5E1'
}

function planeIcon(track: number | null, color: string, size: number): L.DivIcon {
  const rot = track ?? 0
  // Aircraft silhouette pointing north (up); rotated by track
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 3 L18 12 L30 18 L30 21 L18 17 L18.5 26 L22 28 L22 30 L16 28 L10 30 L10 28 L13.5 26 L14 17 L2 21 L2 18 L14 12 Z"
          fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="0.75" stroke-linejoin="round"/>
  </svg>`
  return L.divIcon({
    html: `<div style="transform:rotate(${rot}deg);width:${size}px;height:${size}px;transform-origin:center">${svg}</div>`,
    className: '',
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size],
  })
}

function passesFilter(s: unknown[], filters: AirTrafficFilters): boolean {
  const onGround = s[8] as boolean
  const baroAlt  = s[7] as number | null
  const squawk   = s[14] as string | null
  const emergency = squawk ? !!SQUAWK_EMERGENCY[squawk] : false

  if (filters.emergencyOnly && !emergency) return false

  const altFt = baroAlt != null ? baroAlt * 3.281 : null
  switch (filters.altitudeBand) {
    case 'ground':   return onGround
    case 'low':      return !onGround && altFt != null && altFt < 5000
    case 'medium':   return !onGround && altFt != null && altFt >= 5000 && altFt < 25000
    case 'cruising': return !onGround && (altFt == null || altFt >= 25000)
    default:         return true
  }
}

interface AirTrafficLayerProps {
  filters: AirTrafficFilters
  onCount?: (n: number) => void
}

export function AirTrafficLayer({ filters, onCount }: AirTrafficLayerProps) {
  const map = useMap()
  const groupRef = useRef<L.LayerGroup | null>(null)
  const hintRef = useRef<L.Control | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statesRef = useRef<unknown[][]>([])
  const [zoom, setZoom] = useState(map.getZoom())

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [map])

  useEffect(() => {
    if (zoom < AIR_TRAFFIC_MIN_ZOOM) {
      if (!hintRef.current) {
        const Hint = L.Control.extend({
          onAdd() {
            const d = L.DomUtil.create('div')
            d.style.cssText = 'background:rgba(17,17,17,0.85);color:#71717A;font-family:Space Grotesk,sans-serif;font-size:11px;padding:6px 12px;border-radius:4px;border:1px solid #262626;pointer-events:none'
            d.textContent = 'Zoom in to see air traffic'
            return d
          },
          onRemove() {},
        })
        hintRef.current = new Hint({ position: 'bottomleft' })
        hintRef.current.addTo(map)
      }
      if (groupRef.current) groupRef.current.clearLayers()
    } else {
      if (hintRef.current) { map.removeControl(hintRef.current); hintRef.current = null }
    }
  }, [zoom, map])

  // Re-render markers when filters change without re-fetching
  useEffect(() => {
    renderStates(statesRef.current)
  }, [filters])  // eslint-disable-line react-hooks/exhaustive-deps

  const renderStates = useCallback((states: unknown[][]) => {
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map)
    groupRef.current.clearLayers()

    let count = 0
    for (const s of states) {
      if (!passesFilter(s, filters)) continue

      const icao24      = s[0] as string
      const callsign    = (s[1] as string)?.trim() || icao24
      const country     = s[2] as string
      const lastContact = s[4] as number | null
      const lon         = s[5] as number | null
      const lat         = s[6] as number | null
      const baroAlt     = s[7] as number | null
      const onGround    = s[8] as boolean
      const velocity    = s[9] as number | null
      const track       = s[10] as number | null
      const vertRate    = s[11] as number | null
      const squawk      = s[14] as string | null
      const posSource   = s[16] as number | null

      if (lon == null || lat == null) continue

      const emergency = squawk ? SQUAWK_EMERGENCY[squawk] : null
      const color = altColor(onGround, baroAlt, !!emergency)
      const size = emergency ? 28 : onGround ? 18 : 24

      const marker = L.marker([lat, lon], { icon: planeIcon(track, color, size) })

      const altFt  = baroAlt != null ? Math.round(baroAlt * 3.281).toLocaleString() + ' ft' : 'N/A'
      const spdKts = velocity != null ? Math.round(velocity * 1.944) + ' kts' : 'N/A'
      const hdg    = track != null ? Math.round(track) + '°' : 'N/A'
      const vr     = vertRate != null
        ? (vertRate > 1 ? `▲ ${Math.round(vertRate * 196.85)} fpm` : vertRate < -1 ? `▼ ${Math.abs(Math.round(vertRate * 196.85))} fpm` : '→ Level')
        : 'N/A'
      const vrColor = vertRate != null ? (vertRate > 1 ? '#22C55E' : vertRate < -1 ? '#F59E0B' : '#71717A') : '#71717A'
      const src  = posSource != null ? (POSITION_SOURCE[posSource] ?? 'Unknown') : 'Unknown'
      const ageSecs = lastContact != null ? Math.round(Date.now() / 1000 - lastContact) : null
      const age  = ageSecs != null ? (ageSecs < 60 ? `${ageSecs}s ago` : `${Math.round(ageSecs / 60)}m ago`) : 'N/A'

      const emergencyBanner = emergency
        ? `<div style="background:${emergency.color};color:${emergency.color === '#F59E0B' ? '#0A0A0A' : '#fff'};padding:5px 10px;border-radius:4px;font-weight:700;font-size:11px;margin-bottom:10px;letter-spacing:.08em;text-align:center">
             SQUAWK ${esc(squawk ?? '')} · ${emergency.label}
           </div>`
        : ''

      marker.bindPopup(`
        <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px;padding:0">
          ${emergencyBanner}
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#52525B;margin-bottom:3px">${esc(country)} · ${src}</div>
          <div style="font-weight:700;font-size:22px;letter-spacing:.05em;color:#F4F4F5;margin-bottom:2px;font-family:'Fira Code',monospace">${esc(callsign)}</div>
          <div style="font-size:10px;color:#52525B;margin-bottom:12px;font-family:'Fira Code',monospace">${icao24.toUpperCase()}</div>
          ${onGround
            ? `<div style="font-size:12px;color:#71717A;background:rgba(82,82,91,0.15);border:1px solid #262626;border-radius:4px;padding:5px 10px;text-align:center;margin-bottom:10px">On ground</div>`
            : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;padding:6px 8px">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:2px">Altitude</div>
                  <div style="font-size:13px;font-weight:600;font-family:'Fira Code',monospace">${altFt}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;padding:6px 8px">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:2px">Speed</div>
                  <div style="font-size:13px;font-weight:600;font-family:'Fira Code',monospace">${spdKts}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;padding:6px 8px">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:2px">Heading</div>
                  <div style="font-size:13px;font-weight:600;font-family:'Fira Code',monospace">${hdg}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:4px;padding:6px 8px">
                  <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#52525B;margin-bottom:2px">Vert Rate</div>
                  <div style="font-size:13px;font-weight:600;font-family:'Fira Code',monospace;color:${vrColor}">${vr}</div>
                </div>
              </div>`}
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#3F3F46;font-family:'Fira Code',monospace;border-top:1px solid #1C1C1C;padding-top:8px">
            <span>SQK ${squawk ?? '----'}</span>
            <span>Updated ${age}</span>
          </div>
        </div>
      `, { maxWidth: 260 })

      groupRef.current.addLayer(marker)
      count++
    }
    onCount?.(count)
  }, [map, filters, onCount])

  const fetchAndRender = useCallback(async (cancelled: { v: boolean }) => {
    if (map.getZoom() < AIR_TRAFFIC_MIN_ZOOM) return
    const b = map.getBounds()
    const url = `/api/proxy/opensky` +
      `?lamin=${b.getSouth().toFixed(2)}&lomin=${b.getWest().toFixed(2)}` +
      `&lamax=${b.getNorth().toFixed(2)}&lomax=${b.getEast().toFixed(2)}`

    try {
      const res = await fetch(url)
      if (cancelled.v || !res.ok) return
      const data = await res.json()
      if (cancelled.v) return
      statesRef.current = data.states ?? []
      renderStates(statesRef.current)
    } catch {}
  }, [map, renderStates])

  useEffect(() => {
    const cancelled = { v: false }
    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchAndRender(cancelled), 400)
    }
    fetchAndRender(cancelled)
    timerRef.current = setInterval(() => fetchAndRender(cancelled), 30_000)
    map.on('moveend', onMoveEnd)
    return () => {
      cancelled.v = true
      if (timerRef.current) clearInterval(timerRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      map.off('moveend', onMoveEnd)
      if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null }
      if (hintRef.current) { map.removeControl(hintRef.current); hintRef.current = null }
    }
  }, [map, fetchAndRender])

  return null
}

// ─── NASA FIRMS fire hotspots ─────────────────────────────────────────────────

export type FireTimeRange = '24h' | '48h' | '7d'

const FIRMS_LAYERS: Record<FireTimeRange, string> = {
  '24h': 'fires_viirs_noaa20_24',
  '48h': 'fires_viirs_noaa20_48',
  '7d':  'fires_viirs_noaa20_7',
}

interface FireLayerProps {
  range?: FireTimeRange
}

export function FireLayer({ range = '24h' }: FireLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!map.getPane('firmsPane')) {
      map.createPane('firmsPane')
    }
    const pane = map.getPane('firmsPane')!
    pane.style.zIndex = '300'
    pane.style.filter = [
      'drop-shadow(0 0 2px rgba(255,80,0,1))',
      'drop-shadow(0 0 5px rgba(255,140,0,0.8))',
      'drop-shadow(0 0 10px rgba(255,60,0,0.5))',
    ].join(' ')
  }, [map])

  return (
    <WMSTileLayer
      url={`https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/${FIRMS_KEY}?`}
      layers={FIRMS_LAYERS[range]}
      format="image/png"
      transparent={true}
      version="1.1.1"
      opacity={0.95}
      zIndex={300}
      pane="firmsPane"
      attribution='<a href="https://firms.modaps.eosdis.nasa.gov">NASA FIRMS</a>'
    />
  )
}

// ─── Field report pins ────────────────────────────────────────────────────────

interface FieldReport {
  id: number
  title: string
  category: string
  latitude: number
  longitude: number
  upvote_count: number
  created_at: string
  username: string | null
}

function wolfPinIcon(size = 36): L.DivIcon {
  const half = size / 2
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
        background:#F59E0B;transform:rotate(-45deg);
        border:2px solid #0A0A0A;box-shadow:0 2px 8px rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;
      ">
        <img src="/logo.png" style="
          width:${Math.round(size * 0.6)}px;height:${Math.round(size * 0.6)}px;
          transform:rotate(45deg);object-fit:contain;
        " />
      </div>
    `,
    className: '',
    iconAnchor: [half, size],
    popupAnchor: [0, -size],
  })
}

function timeAgoMap(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function FieldReportLayer() {
  const map = useMap()
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/posts?type=field_report&limit=100')
        if (!res.ok) return
        const posts: FieldReport[] = await res.json()

        if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map)
        groupRef.current.clearLayers()

        for (const post of posts) {
          if (post.latitude == null || post.longitude == null) continue

          const marker = L.marker([post.latitude, post.longitude], { icon: wolfPinIcon(34) })
          marker.bindPopup(`
            <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#F59E0B;margin-bottom:4px">
                Field Report · ${esc(post.category)}
              </div>
              <div style="font-weight:600;font-size:14px;margin-bottom:8px;line-height:1.3">${esc(post.title)}</div>
              <div style="font-size:12px;color:#71717A;display:flex;align-items:center;gap:8px">
                <span>▲ ${post.upvote_count}</span>
                <span>·</span>
                <span>${esc(post.username ?? 'anonymous')}</span>
                <span>·</span>
                <span>${timeAgoMap(post.created_at)}</span>
              </div>
              <div style="margin-top:10px">
                <a href="/post/${post.id}" style="font-size:12px;color:#F59E0B;text-decoration:none;font-weight:600">
                  View full report →
                </a>
              </div>
            </div>
          `)
          groupRef.current.addLayer(marker)
        }
      } catch {}
    }

    fetchReports()
    const id = setInterval(fetchReports, 5 * 60 * 1000)
    return () => {
      clearInterval(id)
      if (groupRef.current) { map.removeLayer(groupRef.current); groupRef.current = null }
    }
  }, [map])

  return null
}

// ─── Disaster event markers ───────────────────────────────────────────────────

export interface DisasterEvent {
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

export const SEVERITY_COLOR: Record<string, string> = {
  Extreme:  '#EF4444',
  Severe:   '#EF4444',
  Moderate: '#F59E0B',
  Minor:    '#22C55E',
}

const SEVERITY_SIZE: Record<string, number> = {
  Extreme:  22,
  Severe:   18,
  Moderate: 14,
  Minor:    11,
}

function svgIcon(svg: string, size: number): L.DivIcon {
  return L.divIcon({ html: svg, className: '', iconAnchor: [size / 2, size / 2] })
}

function makeIcon(shape: string, color: string, size: number): L.DivIcon {
  const shapes: Record<string, string> = {
    circle:   `<circle cx="12" cy="12" r="9" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>`,
    triangle: `<polygon points="12,3 22,21 2,21" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>`,
    square:   `<rect x="3" y="3" width="18" height="18" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>`,
    diamond:  `<polygon points="12,2 22,12 12,22 2,12" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>`,
    pentagon: `<polygon points="12,2 22,9 18,21 6,21 2,9" fill="${color}" fill-opacity="0.85" stroke="#0A0A0A" stroke-width="1.5"/>`,
  }
  return svgIcon(
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${shapes[shape] ?? shapes.circle}</svg>`,
    size,
  )
}

export function circleIcon(color: string, size = 16)   { return makeIcon('circle',   color, size) }
export function triangleIcon(color: string, size = 16) { return makeIcon('triangle', color, size) }
export function squareIcon(color: string, size = 16)   { return makeIcon('square',   color, size) }
export function diamondIcon(color: string, size = 16)  { return makeIcon('diamond',  color, size) }
export function pentagonIcon(color: string, size = 16) { return makeIcon('pentagon', color, size) }

const SOURCE_SHAPE: Record<string, string> = {
  noaa:  'circle',
  usgs:  'triangle',
  gdacs: 'pentagon',
  epa:   'diamond',
}

function formatTime(iso: string | null) {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleString()
}

interface EventLayerProps {
  events: DisasterEvent[]
  activeFilters: Set<string>
  popups?: boolean
}

export function EventLayer({ events, activeFilters, popups = true }: EventLayerProps) {
  const map = useMap()
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map)
    groupRef.current.clearLayers()

    for (const event of events) {
      if (!activeFilters.has(event.source) || !event.geometry) continue

      const color = SEVERITY_COLOR[event.severity] ?? '#71717A'
      const size  = SEVERITY_SIZE[event.severity] ?? 12
      const shape = SOURCE_SHAPE[event.source] ?? 'circle'

      let latlng: L.LatLngExpression | null = null
      if (event.geometry.type === 'Point') {
        const [lng, lat] = (event.geometry as GeoJSON.Point).coordinates
        latlng = [lat, lng]
      } else if (event.geometry.type === 'Polygon' || event.geometry.type === 'MultiPolygon') {
        latlng = L.geoJSON(event.geometry as GeoJSON.GeoJsonObject).getBounds().getCenter()
      }
      if (!latlng) continue

      const marker = L.marker(latlng, { icon: makeIcon(shape, color, size) })

      if (popups) {
        const p = event.properties as Record<string, string>
        const country = p.country ? ` · ${p.country}` : ''
        const iso3    = p.iso3    ? ` (${p.iso3})`     : ''
        marker.bindPopup(`
          <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:4px">
              ${esc(event.source.toUpperCase())} · ${esc(event.event_type.replace(/_/g, ' '))}${esc(country)}${esc(iso3)}
            </div>
            <div style="font-weight:600;font-size:14px;margin-bottom:8px;line-height:1.3">${esc(event.title)}</div>
            <div style="font-size:12px;color:#A1A1AA;margin-bottom:4px">
              <span style="color:${color};font-weight:600">${event.severity}</span>
              ${event.expires_at ? ` · Expires ${formatTime(event.expires_at)}` : ''}
              ${event.starts_at  ? `<br><span style="color:#52525B">Started ${formatTime(event.starts_at)}</span>` : ''}
            </div>
            ${p.areaDesc ? `<div style="font-size:11px;color:#71717A;margin-top:4px;border-top:1px solid #262626;padding-top:6px">${p.areaDesc}</div>` : ''}
            <div style="margin-top:10px;border-top:1px solid #262626;padding-top:8px;display:flex;gap:12px">
              <a href="/feed" style="font-size:12px;color:#22C55E;text-decoration:none;font-weight:600">View in Feed</a>
              <a href="/community" style="font-size:12px;color:#71717A;text-decoration:none">Community</a>
            </div>
          </div>
        `)
      }

      groupRef.current.addLayer(marker)
    }
  }, [events, activeFilters, map, popups])

  return null
}
