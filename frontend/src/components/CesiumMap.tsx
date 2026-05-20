import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Viewer, Cartesian3, Color, ImageryLayer, UrlTemplateImageryProvider,
  WebMapServiceImageryProvider, GeoJsonDataSource, CustomDataSource,
  ColorMaterialProperty, ConstantProperty, ScreenSpaceEventType,
  JulianDate, Credit, HeightReference, defined, Entity, Cartesian2,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { DisasterEvent, AirTrafficFilters, FireTimeRange } from './MapEventLayer'
import { SEVERITY_COLOR } from './MapEventLayer'

const FIRMS_KEY = 'de1d4e98f4b93285338eb01c72831ac6'

const FIRMS_LAYERS: Record<FireTimeRange, string> = {
  '24h': 'fires_viirs_noaa20_24',
  '48h': 'fires_viirs_noaa20_48',
  '7d':  'fires_viirs_noaa20_7',
}

const SOURCE_SHAPE: Record<string, string> = {
  usgs:  'triangle',
  gdacs: 'pentagon',
  epa:   'diamond',
}

const SEVERITY_SIZE: Record<string, number> = {
  Extreme: 22, Severe: 18, Moderate: 14, Minor: 11,
}

const ALERT_COLORS: Record<string, string> = {
  Extreme:  '#EF4444',
  Severe:   '#F59E0B',
  Moderate: '#3B82F6',
  Minor:    '#22C55E',
}

const SQUAWK_EMERGENCY: Record<string, { label: string; color: string }> = {
  '7700': { label: 'GENERAL EMERGENCY', color: '#EF4444' },
  '7600': { label: 'RADIO FAILURE',     color: '#F59E0B' },
  '7500': { label: 'HIJACK',            color: '#EF4444' },
}

const POSITION_SOURCE: Record<number, string> = {
  0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM',
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function svgUrl(shape: string, color: string, size: number): string {
  const shapes: Record<string, string> = {
    circle:   `<circle cx="12" cy="12" r="9" fill="${color}" fill-opacity="0.9" stroke="#0A0A0A" stroke-width="2"/>`,
    triangle: `<polygon points="12,2 22,20 2,20" fill="${color}" fill-opacity="0.9" stroke="#0A0A0A" stroke-width="2"/>`,
    square:   `<rect x="3" y="3" width="18" height="18" fill="${color}" fill-opacity="0.9" stroke="#0A0A0A" stroke-width="2"/>`,
    diamond:  `<polygon points="12,2 22,12 12,22 2,12" fill="${color}" fill-opacity="0.9" stroke="#0A0A0A" stroke-width="2"/>`,
    pentagon: `<polygon points="12,2 21,8 18,19 6,19 3,8" fill="${color}" fill-opacity="0.9" stroke="#0A0A0A" stroke-width="2"/>`,
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${shapes[shape] ?? shapes.circle}</svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

function planeUrl(track: number, color: string, size: number): string {
  const rot = track ?? 0
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
    <g transform="rotate(${rot}, 16, 16)">
      <path d="M16 3 L18 12 L30 18 L30 21 L18 17 L18.5 26 L22 28 L22 30 L16 28 L10 30 L10 28 L13.5 26 L14 17 L2 21 L2 18 L14 12 Z"
            fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="0.75" stroke-linejoin="round"/>
    </g>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

function altColor(onGround: boolean, baroAlt: number | null, emergency: boolean): string {
  if (emergency) return '#EF4444'
  if (onGround) return '#52525B'
  const altFt = baroAlt != null ? baroAlt * 3.281 : null
  if (altFt == null) return '#60A5FA'
  if (altFt < 5000) return '#F59E0B'
  if (altFt < 25000) return '#60A5FA'
  return '#CBD5E1'
}

function passesAtFilter(s: unknown[], filters: AirTrafficFilters): boolean {
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
    default: return true
  }
}

function centerOfGeometry(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point') {
    return [(geom as GeoJSON.Point).coordinates[0], (geom as GeoJSON.Point).coordinates[1]]
  }
  if (geom.type === 'Polygon') {
    const coords = (geom as GeoJSON.Polygon).coordinates[0]
    const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
    return [lon, lat]
  }
  if (geom.type === 'MultiPolygon') {
    const allCoords = (geom as GeoJSON.MultiPolygon).coordinates.flat(2)
    const lon = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length
    const lat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length
    return [lon, lat]
  }
  return null
}

interface CesiumMapProps {
  events: DisasterEvent[]
  activeFilters: Set<string>
  activeOverlays: Set<string>
  atFilters: AirTrafficFilters
  onAtCount: (n: number) => void
  fireRange: FireTimeRange
  flyToRef?: React.MutableRefObject<((lat: number, lon: number) => void) | null>
}

export default function CesiumMap({
  events, activeFilters, activeOverlays, atFilters, onAtCount, fireRange, flyToRef,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [popup, setPopup] = useState<{ html: string; x: number; y: number } | null>(null)

  const radarLayerRef = useRef<ImageryLayer | null>(null)
  const alertsSourceRef = useRef<GeoJsonDataSource | null>(null)
  const eventsSourceRef = useRef<CustomDataSource | null>(null)
  const atSourceRef = useRef<CustomDataSource | null>(null)
  const firmsLayerRef = useRef<ImageryLayer | null>(null)
  const reportsSourceRef = useRef<CustomDataSource | null>(null)

  const atStatesRef = useRef<unknown[][]>([])
  const atTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const atDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Viewer init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
    })

    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.add(
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c', 'd'],
          maximumLevel: 19,
          credit: new Credit('© OpenStreetMap contributors © CARTO'),
        })
      )
    )

    viewer.scene.backgroundColor = Color.fromCssColorString('#0A0A0A')
    viewer.scene.globe.baseColor = Color.fromCssColorString('#111111')
    viewer.scene.globe.showGroundAtmosphere = false
    if (viewer.scene.sun) viewer.scene.sun.show = false
    if (viewer.scene.moon) viewer.scene.moon.show = false
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 20, 18000000),
    })

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        viewerRef.current?.camera.flyTo({
          destination: Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, 5000000),
          duration: 2,
        })
      }, () => {})
    }

    viewer.screenSpaceEventHandler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position)
      if (defined(picked) && picked.id instanceof Entity) {
        const desc = (picked.id as Entity).description?.getValue(JulianDate.now()) as string | undefined
        if (desc) {
          const canvasRect = containerRef.current!.getBoundingClientRect()
          const x = Math.min(click.position.x + 10, canvasRect.width - 280)
          const y = Math.min(click.position.y + 10, canvasRect.height - 200)
          setPopup({ html: desc, x, y })
          return
        }
      }
      setPopup(null)
    }, ScreenSpaceEventType.LEFT_CLICK)

    viewerRef.current = viewer

    return () => {
      if (atTimerRef.current) clearInterval(atTimerRef.current)
      if (atDebounceRef.current) clearTimeout(atDebounceRef.current)
      viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // ── flyTo ref ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!flyToRef) return
    flyToRef.current = (lat: number, lon: number) => {
      viewerRef.current?.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, 3000000),
        duration: 2,
      })
    }
    return () => { if (flyToRef) flyToRef.current = null }
  }, [flyToRef])

  // ── Event markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!eventsSourceRef.current) {
      eventsSourceRef.current = new CustomDataSource('events')
      viewer.dataSources.add(eventsSourceRef.current)
    }
    eventsSourceRef.current.entities.removeAll()

    for (const event of events) {
      if (!activeFilters.has(event.source) || !event.geometry) continue

      const center = centerOfGeometry(event.geometry)
      if (!center) continue
      const [lon, lat] = center

      const color = SEVERITY_COLOR[event.severity] ?? '#71717A'
      const size  = SEVERITY_SIZE[event.severity] ?? 12
      const shape = SOURCE_SHAPE[event.source] ?? 'circle'

      const p = event.properties as Record<string, string>
      const country = p.country ? ` · ${p.country}` : ''
      const iso3    = p.iso3    ? ` (${p.iso3})`     : ''

      eventsSourceRef.current.entities.add({
        position: Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: svgUrl(shape, color, size + 8),
          width: size + 8,
          height: size + 8,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
        description: `
          <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:4px">
              ${esc(event.source.toUpperCase())} · ${esc(event.event_type.replace(/_/g, ' '))}${esc(country)}${esc(iso3)}
            </div>
            <div style="font-weight:600;font-size:14px;margin-bottom:8px;line-height:1.3">${esc(event.title)}</div>
            <div style="font-size:12px;color:#A1A1AA;margin-bottom:4px">
              <span style="color:${color};font-weight:600">${event.severity}</span>
              ${event.expires_at ? ` · Expires ${new Date(event.expires_at).toLocaleString()}` : ''}
            </div>
            ${event.slug ? `
              <div style="margin-top:10px;border-top:1px solid #262626;padding-top:8px;display:flex;align-items:center;gap:12px">
                <span style="font-family:monospace;font-size:10px;padding:2px 6px;border:1px solid #333;border-radius:4px;color:#71717A">#${event.slug}</span>
                <a href="/event/${event.slug}" style="font-size:11px;color:#22C55E;text-decoration:none;font-weight:600">
                  ${(event.discussion_count ?? 0) > 0 ? `${event.discussion_count} discussions` : 'Discuss'}
                </a>
              </div>
            ` : ''}
          </div>
        `,
      })
    }
  }, [events, activeFilters])

  // ── Radar ────────────────────────────────────────────────────────────────────
  const radarActive = activeOverlays.has('radar')
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!radarActive) {
      if (radarLayerRef.current) {
        viewer.imageryLayers.remove(radarLayerRef.current)
        radarLayerRef.current = null
      }
      return
    }

    let cancelled = false
    async function fetchRadar() {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const data = await res.json()
        const past = data?.radar?.past
        if (cancelled || !Array.isArray(past) || past.length === 0) return
        const path = past[past.length - 1].path as string

        if (radarLayerRef.current) viewer!.imageryLayers.remove(radarLayerRef.current)
        const layer = new ImageryLayer(
          new UrlTemplateImageryProvider({
            url: `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/6/1_0.png`,
            maximumLevel: 12,
            credit: new Credit('RainViewer'),
          })
        )
        layer.alpha = 0.65
        viewer!.imageryLayers.add(layer)
        radarLayerRef.current = layer
      } catch {}
    }

    fetchRadar()
    const id = setInterval(fetchRadar, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
      if (radarLayerRef.current && viewerRef.current) {
        viewerRef.current.imageryLayers.remove(radarLayerRef.current)
        radarLayerRef.current = null
      }
    }
  }, [radarActive])

  // ── Weather alerts ───────────────────────────────────────────────────────────
  const alertsActive = activeOverlays.has('alerts')
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!alertsActive) {
      if (alertsSourceRef.current) {
        viewer.dataSources.remove(alertsSourceRef.current)
        alertsSourceRef.current = null
      }
      return
    }

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
          features.push({ ...f, properties: { ...f.properties, _source: 'nws' } })
        }
      }

      if (meteoRes.status === 'fulfilled' && meteoRes.value.ok) {
        const evts = await meteoRes.value.json()
        for (const e of evts) {
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

      if (alertsSourceRef.current) viewer!.dataSources.remove(alertsSourceRef.current)

      const ds = new GeoJsonDataSource('weather-alerts')
      await ds.load({ type: 'FeatureCollection', features })
      if (cancelled) return

      type PropBag = { getValue: () => string } | undefined

      for (const entity of ds.entities.values) {
        const props = entity.properties as Record<string, PropBag> | undefined
        const severity  = props?.severity?.getValue()  ?? 'Minor'
        const source    = props?._source?.getValue()   ?? 'nws'
        const eventName = props?.event?.getValue()     ?? 'Weather Alert'
        const headline  = props?.headline?.getValue()  ?? eventName
        const expires   = props?.expires?.getValue()
        const areaDesc  = props?.areaDesc?.getValue()

        const color = Color.fromCssColorString(ALERT_COLORS[severity] ?? '#71717A')
        if (entity.polygon) {
          entity.polygon.material = new ColorMaterialProperty(color.withAlpha(0.18)) as never
          entity.polygon.outlineColor = new ConstantProperty(color.withAlpha(0.7)) as never
          entity.polygon.outlineWidth = new ConstantProperty(1) as never
        }

        const sourceName = source === 'meteoalarm' ? 'MeteoAlarm (EU)' : 'NWS (US)'
        entity.description = new ConstantProperty(`
          <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:4px">
              ${esc(sourceName)} · ${esc(eventName)}
            </div>
            <div style="font-weight:600;font-size:14px;margin-bottom:6px">${esc(headline)}</div>
            <div style="font-size:12px;color:#A1A1AA">
              <span style="color:${ALERT_COLORS[severity] ?? '#71717A'};font-weight:600">${esc(severity)}</span>
              ${expires ? ` · Expires ${new Date(expires).toLocaleString()}` : ''}
            </div>
            ${areaDesc ? `<div style="font-size:11px;color:#71717A;margin-top:4px">${esc(areaDesc)}</div>` : ''}
          </div>
        `) as never
      }

      alertsSourceRef.current = ds
      viewer!.dataSources.add(ds)
    }

    fetchAlerts()
    const id = setInterval(fetchAlerts, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
      if (alertsSourceRef.current && viewerRef.current) {
        viewerRef.current.dataSources.remove(alertsSourceRef.current)
        alertsSourceRef.current = null
      }
    }
  }, [alertsActive])

  // ── NASA FIRMS fire layer ────────────────────────────────────────────────────
  const firesActive = activeOverlays.has('fires')
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!firesActive) {
      if (firmsLayerRef.current) {
        viewer.imageryLayers.remove(firmsLayerRef.current)
        firmsLayerRef.current = null
      }
      return
    }

    if (firmsLayerRef.current) {
      viewer.imageryLayers.remove(firmsLayerRef.current)
    }

    const layer = new ImageryLayer(
      new WebMapServiceImageryProvider({
        url: `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/${FIRMS_KEY}`,
        layers: FIRMS_LAYERS[fireRange],
        parameters: { transparent: true, format: 'image/png', version: '1.1.1' },
        credit: new Credit('NASA FIRMS'),
      })
    )
    layer.alpha = 0.95
    viewer.imageryLayers.add(layer)
    firmsLayerRef.current = layer

    return () => {
      if (firmsLayerRef.current && viewerRef.current) {
        viewerRef.current.imageryLayers.remove(firmsLayerRef.current)
        firmsLayerRef.current = null
      }
    }
  }, [firesActive, fireRange])

  // ── Field reports ────────────────────────────────────────────────────────────
  const reportsActive = activeOverlays.has('reports')
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!reportsActive) {
      if (reportsSourceRef.current) {
        viewer.dataSources.remove(reportsSourceRef.current)
        reportsSourceRef.current = null
      }
      return
    }

    if (!reportsSourceRef.current) {
      reportsSourceRef.current = new CustomDataSource('field-reports')
      viewer.dataSources.add(reportsSourceRef.current)
    }

    async function fetchReports() {
      try {
        const res = await fetch('/api/posts?type=field_report&limit=100')
        if (!res.ok || !reportsSourceRef.current) return
        const posts = await res.json()
        reportsSourceRef.current.entities.removeAll()

        for (const post of posts) {
          if (post.latitude == null || post.longitude == null) continue
          const diff = Date.now() - new Date(post.created_at).getTime()
          const mins = Math.floor(diff / 60000)
          const age = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`

          reportsSourceRef.current.entities.add({
            position: Cartesian3.fromDegrees(post.longitude, post.latitude),
            billboard: {
              image: svgUrl('diamond', '#F59E0B', 22),
              width: 22,
              height: 22,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: HeightReference.CLAMP_TO_GROUND,
            },
            description: `
              <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#F59E0B;margin-bottom:4px">
                  Field Report · ${esc(post.category)}
                </div>
                <div style="font-weight:600;font-size:14px;margin-bottom:8px;line-height:1.3">${esc(post.title)}</div>
                <div style="font-size:12px;color:#71717A;display:flex;gap:8px">
                  <span>▲ ${post.upvote_count}</span>
                  <span>·</span>
                  <span>${esc(post.username ?? 'anonymous')}</span>
                  <span>·</span>
                  <span>${age}</span>
                </div>
                <div style="margin-top:10px">
                  <a href="/post/${post.id}" style="font-size:12px;color:#F59E0B;text-decoration:none;font-weight:600">
                    View full report →
                  </a>
                </div>
              </div>
            `,
          })
        }
      } catch {}
    }

    fetchReports()
    const id = setInterval(fetchReports, 5 * 60 * 1000)
    return () => {
      clearInterval(id)
      if (reportsSourceRef.current && viewerRef.current) {
        viewerRef.current.dataSources.remove(reportsSourceRef.current)
        reportsSourceRef.current = null
      }
    }
  }, [reportsActive])

  // ── Air traffic ──────────────────────────────────────────────────────────────
  const trafficActive = activeOverlays.has('traffic')

  const renderAtStates = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer || !atSourceRef.current) return

    atSourceRef.current.entities.removeAll()
    let count = 0

    for (const s of atStatesRef.current) {
      if (!passesAtFilter(s, atFilters)) continue

      const icao24   = s[0] as string
      const callsign = (s[1] as string)?.trim() || icao24
      const country  = s[2] as string
      const lon      = s[5] as number | null
      const lat      = s[6] as number | null
      const baroAlt  = s[7] as number | null
      const onGround = s[8] as boolean
      const velocity = s[9] as number | null
      const track    = s[10] as number | null
      const vertRate = s[11] as number | null
      const squawk   = s[14] as string | null
      const posSource = s[16] as number | null
      const lastContact = s[4] as number | null

      if (lon == null || lat == null) continue

      const emergency = squawk ? SQUAWK_EMERGENCY[squawk] : null
      const color = altColor(onGround, baroAlt, !!emergency)
      const size = emergency ? 28 : onGround ? 16 : 22

      const altFt  = baroAlt != null ? Math.round(baroAlt * 3.281).toLocaleString() + ' ft' : 'N/A'
      const spdKts = velocity != null ? Math.round(velocity * 1.944) + ' kts' : 'N/A'
      const hdg    = track != null ? Math.round(track) + '°' : 'N/A'
      const vr     = vertRate != null
        ? (vertRate > 1 ? `▲ ${Math.round(vertRate * 196.85)} fpm` : vertRate < -1 ? `▼ ${Math.abs(Math.round(vertRate * 196.85))} fpm` : '→ Level')
        : 'N/A'
      const vrColor = vertRate != null ? (vertRate > 1 ? '#22C55E' : vertRate < -1 ? '#F59E0B' : '#71717A') : '#71717A'
      const src   = posSource != null ? (POSITION_SOURCE[posSource] ?? 'Unknown') : 'Unknown'
      const ageSecs = lastContact != null ? Math.round(Date.now() / 1000 - lastContact) : null
      const age   = ageSecs != null ? (ageSecs < 60 ? `${ageSecs}s ago` : `${Math.round(ageSecs / 60)}m ago`) : 'N/A'

      const emergencyBanner = emergency
        ? `<div style="background:${emergency.color};color:${emergency.color === '#F59E0B' ? '#0A0A0A' : '#fff'};padding:5px 10px;border-radius:4px;font-weight:700;font-size:11px;margin-bottom:10px;letter-spacing:.08em;text-align:center">
             SQUAWK ${esc(squawk ?? '')} · ${emergency.label}
           </div>`
        : ''

      atSourceRef.current.entities.add({
        position: Cartesian3.fromDegrees(lon, lat, baroAlt ?? 0),
        billboard: {
          image: planeUrl(track ?? 0, color, size),
          width: size,
          height: size,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `
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
        `,
      })
      count++
    }
    onAtCount(count)
  }, [atFilters, onAtCount])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!trafficActive) {
      if (atSourceRef.current) {
        viewer.dataSources.remove(atSourceRef.current)
        atSourceRef.current = null
      }
      if (atTimerRef.current) { clearInterval(atTimerRef.current); atTimerRef.current = null }
      if (atDebounceRef.current) { clearTimeout(atDebounceRef.current); atDebounceRef.current = null }
      atStatesRef.current = []
      onAtCount(0)
      return
    }

    if (!atSourceRef.current) {
      atSourceRef.current = new CustomDataSource('air-traffic')
      viewer.dataSources.add(atSourceRef.current)
    }

    const cancelled = { v: false }

    async function fetchAt() {
      const cam = viewer!.camera
      // Convert camera position to lon/lat/alt to estimate bounding box
      const carto = viewer!.scene.globe.ellipsoid.cartesianToCartographic(cam.positionWC)
      if (!carto) return

      // Build a rough bounding box from the camera frustum
      const scene = viewer!.scene
      const canvas = scene.canvas
      const corners = [
        new Cartesian2(0, 0),
        new Cartesian2(canvas.width, 0),
        new Cartesian2(0, canvas.height),
        new Cartesian2(canvas.width, canvas.height),
      ]

      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
      let hasCorners = false
      for (const corner of corners) {
        const ray = scene.camera.getPickRay(corner)
        if (!ray) continue
        const intersection = scene.globe.pick(ray, scene)
        if (!intersection) continue
        const c = viewer!.scene.globe.ellipsoid.cartesianToCartographic(intersection)
        if (!c) continue
        const lat = c.latitude * (180 / Math.PI)
        const lon = c.longitude * (180 / Math.PI)
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
        hasCorners = true
      }

      if (!hasCorners) return

      const url = `/api/proxy/opensky` +
        `?lamin=${minLat.toFixed(2)}&lomin=${minLon.toFixed(2)}` +
        `&lamax=${maxLat.toFixed(2)}&lomax=${maxLon.toFixed(2)}`

      try {
        const res = await fetch(url)
        if (cancelled.v || !res.ok) return
        const data = await res.json()
        if (cancelled.v) return
        atStatesRef.current = data.states ?? []
        renderAtStates()
      } catch {}
    }

    fetchAt()
    atTimerRef.current = setInterval(fetchAt, 30_000)

    const onMoveEnd = () => {
      if (atDebounceRef.current) clearTimeout(atDebounceRef.current)
      atDebounceRef.current = setTimeout(() => fetchAt(), 400)
    }
    viewer.camera.moveEnd.addEventListener(onMoveEnd)

    return () => {
      cancelled.v = true
      if (atTimerRef.current) { clearInterval(atTimerRef.current); atTimerRef.current = null }
      if (atDebounceRef.current) { clearTimeout(atDebounceRef.current); atDebounceRef.current = null }
      viewer.camera.moveEnd.removeEventListener(onMoveEnd)
      if (atSourceRef.current && viewerRef.current) {
        viewerRef.current.dataSources.remove(atSourceRef.current)
        atSourceRef.current = null
      }
    }
  }, [trafficActive, renderAtStates, onAtCount])

  useEffect(() => {
    if (atSourceRef.current) renderAtStates()
  }, [atFilters, renderAtStates])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {popup && (
        <div
          style={{
            position: 'absolute',
            left: popup.x,
            top: popup.y,
            zIndex: 1000,
            pointerEvents: 'auto',
            maxWidth: 280,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            background: 'rgba(17,17,17,0.97)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '14px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
          }}>
            <button
              onClick={() => setPopup(null)}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted)', fontSize: '16px', lineHeight: 1,
                padding: '2px 6px',
              }}
            >
              ×
            </button>
            <div dangerouslySetInnerHTML={{ __html: popup.html }} />
          </div>
        </div>
      )}
    </div>
  )
}
