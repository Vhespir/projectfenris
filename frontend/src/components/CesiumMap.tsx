import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Viewer, Cartesian3, Color, ImageryLayer, UrlTemplateImageryProvider,
  WebMapServiceImageryProvider, GeoJsonDataSource, CustomDataSource,
  ColorMaterialProperty, ConstantProperty, ScreenSpaceEventType,
  JulianDate, Credit, HeightReference, defined, Entity, Cartesian2,
  Ion, createWorldTerrainAsync, BoundingSphere, HeadingPitchRange,
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
  eonet: 'square',
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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  return (Math.atan2(Math.sin(Δλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * 180 / Math.PI + 360) % 360
}

function clusterBadgeUrl(count: number): string {
  const label = count >= 1000 ? `${Math.floor(count / 1000)}k` : String(count)
  const [bg, ring] = count >= 50
    ? ['#EF4444', 'rgba(239,68,68,0.28)']
    : count >= 10
      ? ['#F59E0B', 'rgba(245,158,11,0.28)']
      : ['#22C55E', 'rgba(34,197,94,0.28)']
  const size = count >= 100 ? 46 : count >= 50 ? 42 : count >= 10 ? 38 : 32
  const fs = label.length > 2 ? 11 : 13
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="19" fill="${ring}"/>
    <circle cx="20" cy="20" r="15" fill="${bg}" fill-opacity="0.92" stroke="#0A0A0A" stroke-width="1.5"/>
    <text x="20" y="20" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-weight="700" font-size="${fs}" fill="#FFFFFF">${label}</text>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

function setupClustering(ds: CustomDataSource, pixelRange = 60) {
  ds.clustering.enabled = true
  ds.clustering.pixelRange = pixelRange
  ds.clustering.minimumClusterSize = 2
  ds.clustering.clusterEvent.addEventListener((entities: Entity[], cluster: unknown) => {
    const c = cluster as {
      billboard: { id: unknown; show: boolean; image: string; width: number; height: number; disableDepthTestDistance: number }
      label: { show: boolean }
      point: { show: boolean }
    }
    const n = entities.length
    const sz = n >= 100 ? 46 : n >= 50 ? 42 : n >= 10 ? 38 : 32
    c.label.show = false
    c.point.show = false
    c.billboard.show = true
    c.billboard.image = clusterBadgeUrl(n)
    c.billboard.width = sz
    c.billboard.height = sz
    c.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY
    // Cesium only puts the clustered entities array on cluster.label.id,
    // never on the billboard, but the badge is the billboard (the label
    // is hidden above). Without this, picking the visible badge returns
    // no id at all and the click handler's cluster branch never fires.
    c.billboard.id = entities
  })
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
  initialFlyTo?: { lat: number; lon: number }
  measureMode?: boolean
}

export default function CesiumMap({
  events, activeFilters, activeOverlays, atFilters, onAtCount, fireRange, flyToRef, initialFlyTo, measureMode,
}: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const navigate = useNavigate()
  const [sidebar, setSidebar] = useState<{ html: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null)
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([])
  const measureModeRef = useRef(false)
  const measureSourceRef = useRef<CustomDataSource | null>(null)

  const radarLayerRef = useRef<ImageryLayer | null>(null)
  const alertsSourceRef = useRef<GeoJsonDataSource | null>(null)
  const eventsSourceRef = useRef<CustomDataSource | null>(null)
  const atSourceRef = useRef<CustomDataSource | null>(null)
  const firmsLayerRef = useRef<ImageryLayer | null>(null)
  const satelliteLayerRef = useRef<ImageryLayer | null>(null)
  const reportsSourceRef = useRef<CustomDataSource | null>(null)

  const atStatesRef = useRef<unknown[][]>([])
  const atTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const atDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Viewer init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string

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

    // Default base map: Esri World Imagery (free, no key, seamless
    // high-resolution satellite/aerial imagery, verified by fetching real
    // tiles over Washington DC at zoom 17-19 where individual people and
    // parked cars are visible) plus a transparent reference layer of
    // borders, coastlines, and place labels on top, since raw satellite
    // imagery alone has no country/city names on it.
    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.add(
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: new Credit('© Esri, Maxar, Earthstar Geographics, and the GIS user community'),
        })
      )
    )
    viewer.imageryLayers.add(
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: new Credit('© Esri'),
        })
      )
    )

    createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true })
      .then(provider => { if (viewerRef.current) viewerRef.current.terrainProvider = provider })
      .catch(() => {})

    viewer.scene.backgroundColor = Color.fromCssColorString('#0A0A0A')
    viewer.scene.globe.baseColor = Color.fromCssColorString('#111111')
    viewer.scene.globe.showGroundAtmosphere = false
    viewer.scene.globe.enableLighting = true
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = true
    if (viewer.scene.sun) viewer.scene.sun.show = false
    if (viewer.scene.moon) viewer.scene.moon.show = false
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 20, 18000000),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
    })

    if (initialFlyTo) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(initialFlyTo.lon, initialFlyTo.lat, 3000000),
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        duration: 2,
      })
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        viewerRef.current?.camera.flyTo({
          destination: Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, 8000000),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: 2,
        })
      }, () => {})
    }

    viewer.screenSpaceEventHandler.setInputAction((click: { position: Cartesian2 }) => {
      setContextMenu(null)

      if (measureModeRef.current) {
        const ray = viewer.scene.camera.getPickRay(click.position)
        if (!ray) return
        const intersection = viewer.scene.globe.pick(ray, viewer.scene)
        if (!intersection) return
        const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(intersection)
        if (!carto) return
        const lat = carto.latitude * (180 / Math.PI)
        const lon = carto.longitude * (180 / Math.PI)
        setMeasurePoints(prev => prev.length >= 2 ? [[lon, lat]] : [...prev, [lon, lat]])
        return
      }

      const picked = viewer.scene.pick(click.position)
      if (defined(picked) && picked.id instanceof Entity) {
        const desc = (picked.id as Entity).description?.getValue(JulianDate.now()) as string | undefined
        if (desc) {
          setSidebar({ html: desc })
          return
        }
      }
      // Cesium's clustering renders a badge for the group but does nothing
      // when you click it, the clustered entities live on picked.id as an
      // array, not a single Entity, so the branch above never catches it.
      // Zoom into the cluster's bounding sphere instead, same as clicking a
      // cluster on a normal map does.
      if (defined(picked) && Array.isArray(picked.id)) {
        const clustered = picked.id as Entity[]
        const positions = clustered
          .map(e => e.position?.getValue(JulianDate.now()))
          .filter((p): p is Cartesian3 => !!p)
        if (positions.length > 0) {
          const sphere = BoundingSphere.fromPoints(positions)
          viewer.camera.flyToBoundingSphere(sphere, {
            duration: 1,
            offset: new HeadingPitchRange(0, -Math.PI / 2, Math.max(sphere.radius * 3, 50000)),
          })
        }
        // Zooming in isn't enough on its own: tightly-packed points can
        // still read as one cluster at the new zoom level, so clicking felt
        // like it did nothing. Show what's actually in the cluster right
        // away by stacking each entity's own popup content in the sidebar.
        const items = clustered
          .map(e => e.description?.getValue(JulianDate.now()) as string | undefined)
          .filter((html): html is string => !!html)
        if (items.length > 0) {
          setSidebar({
            html: `
              <div style="font-family:'Space Grotesk',sans-serif;min-width:220px">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#71717A;margin-bottom:10px">
                  ${items.length} items in this cluster
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto">
                  ${items.map(html => `<div style="border-top:1px solid #262626;padding-top:10px">${html}</div>`).join('')}
                </div>
              </div>
            `,
          })
        } else {
          setSidebar(null)
        }
        return
      }
      setSidebar(null)
    }, ScreenSpaceEventType.LEFT_CLICK)

    viewer.screenSpaceEventHandler.setInputAction((click: { position: Cartesian2 }) => {
      const ray = viewer.scene.camera.getPickRay(click.position)
      if (!ray) { setContextMenu(null); return }
      const intersection = viewer.scene.globe.pick(ray, viewer.scene)
      if (!intersection) { setContextMenu(null); return }
      const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(intersection)
      if (!carto) { setContextMenu(null); return }
      const lat = carto.latitude * (180 / Math.PI)
      const lon = carto.longitude * (180 / Math.PI)
      const canvasRect = containerRef.current!.getBoundingClientRect()
      const x = Math.min(click.position.x, canvasRect.width - 230)
      const y = Math.min(click.position.y, canvasRect.height - 100)
      setContextMenu({ x, y, lat, lon })
    }, ScreenSpaceEventType.RIGHT_CLICK)

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
        orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        duration: 2,
      })
    }
    return () => { if (flyToRef) flyToRef.current = null }
  }, [flyToRef])

  // ── Measure mode sync ────────────────────────────────────────────────────────
  useEffect(() => {
    measureModeRef.current = !!measureMode
    if (!measureMode) {
      setMeasurePoints([])
      if (measureSourceRef.current && viewerRef.current) {
        measureSourceRef.current.entities.removeAll()
      }
    }
  }, [measureMode])

  // ── Measure drawing ──────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!measureSourceRef.current) {
      measureSourceRef.current = new CustomDataSource('measure')
      viewer.dataSources.add(measureSourceRef.current)
    }
    measureSourceRef.current.entities.removeAll()
    if (measurePoints.length === 0) return

    const [p1] = measurePoints
    measureSourceRef.current.entities.add({
      position: Cartesian3.fromDegrees(p1[0], p1[1]) as never,
      billboard: {
        image: svgUrl('circle', '#22C55E', 16),
        width: 16, height: 16,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    })

    if (measurePoints.length === 2) {
      const p2 = measurePoints[1]
      measureSourceRef.current.entities.add({
        position: Cartesian3.fromDegrees(p2[0], p2[1]) as never,
        billboard: {
          image: svgUrl('circle', '#22C55E', 16),
          width: 16, height: 16,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      })
      measureSourceRef.current.entities.add({
        polyline: {
          positions: [
            Cartesian3.fromDegrees(p1[0], p1[1]),
            Cartesian3.fromDegrees(p2[0], p2[1]),
          ] as never,
          width: 2,
          material: new ColorMaterialProperty(Color.fromCssColorString('#22C55E').withAlpha(0.85)) as never,
          clampToGround: true,
        } as never,
      })
    }
  }, [measurePoints])

  // ── Event markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!eventsSourceRef.current) {
      eventsSourceRef.current = new CustomDataSource('events')
      setupClustering(eventsSourceRef.current, 60)
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
            // RainViewer's real cap is 7, not the 12 this had before: past
            // that it doesn't serve blurrier tiles, it serves a literal
            // "Zoom Level Not Supported" placeholder image baked into the
            // tile itself, confirmed by fetching raw tiles directly at
            // z=7 through 18 (7 is the last one that isn't the same
            // placeholder every time). Capping here lets Cesium upsample
            // the deepest real tile when zooming further instead.
            maximumLevel: 7,
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

  // ── Live satellite (GOES-East + GOES-West GeoColor) ─────────────────────────
  // The old daily-MODIS layer here got removed: real gaps (see git history),
  // and only ever "yesterday", not actually live. GOES-East/West are
  // geostationary (fixed viewpoint, continuous full-disk coverage, no
  // orbital gaps) and GIBS updates each one every 10 minutes. Requesting
  // time "default" always resolves to whatever the latest available scan
  // is, confirmed against GIBS's own capabilities document. GeoColor is
  // NOAA's true-color-by-day / IR-plus-city-lights-by-night composite, so
  // it looks right around the clock instead of going black at night.
  // Coverage is the Americas and both oceans on either side, not the whole
  // globe: there's no equivalent Meteosat/Himawari composite in GIBS to
  // cover Europe/Africa/Asia, so this is honestly labeled accordingly.
  const liveSatelliteActive = activeOverlays.has('satellite_live')
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    if (!liveSatelliteActive) {
      if (satelliteLayerRef.current) {
        viewer.imageryLayers.remove(satelliteLayerRef.current)
        satelliteLayerRef.current = null
      }
      return
    }

    const goesEast = new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
        maximumLevel: 7,
        credit: new Credit('NOAA / NASA EOSDIS GIBS / GOES-East'),
      })
    )
    const goesWest = new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-West_ABI_GeoColor/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
        maximumLevel: 7,
        credit: new Credit('NOAA / NASA EOSDIS GIBS / GOES-West'),
      })
    )
    viewer.imageryLayers.add(goesWest)
    viewer.imageryLayers.add(goesEast)
    // Only one ref to clean up both: they're always added/removed together.
    satelliteLayerRef.current = goesEast
    const secondLayer = goesWest

    return () => {
      if (viewerRef.current) {
        viewerRef.current.imageryLayers.remove(secondLayer)
        if (satelliteLayerRef.current) viewerRef.current.imageryLayers.remove(satelliteLayerRef.current)
      }
      satelliteLayerRef.current = null
    }
  }, [liveSatelliteActive])

  // ── Citizen reports (first-hand field reports + self-reported news) ─────────
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
      reportsSourceRef.current = new CustomDataSource('citizen-reports')
      setupClustering(reportsSourceRef.current, 50)
      viewer.dataSources.add(reportsSourceRef.current)
    }

    async function fetchReports() {
      try {
        // Ground truth from people actually there, not just official feeds:
        // field reports (structured, category-tagged) and self-reported news
        // (someone posting what they're seeing before any outlet covers it).
        const res = await fetch('/api/posts?channels=field,news&limit=150')
        if (!res.ok || !reportsSourceRef.current) return
        const posts = await res.json()
        reportsSourceRef.current.entities.removeAll()

        for (const post of posts) {
          if (post.latitude == null || post.longitude == null) continue
          const diff = Date.now() - new Date(post.created_at).getTime()
          const mins = Math.floor(diff / 60000)
          const age = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
          const isNews = post.post_type === 'self_reported_news'
          const color = isNews ? '#38BDF8' : '#F59E0B'
          const kindLabel = isNews ? 'Self-Reported News' : `Field Report · ${esc(post.category)}`
          const mediaThumb = Array.isArray(post.media) && post.media[0]
            ? `<img src="${esc(post.media[0].thumbnail_url ?? post.media[0].url)}" style="width:100%;max-height:120px;object-fit:cover;border-radius:4px;margin-bottom:8px" />`
            : ''

          reportsSourceRef.current.entities.add({
            position: Cartesian3.fromDegrees(post.longitude, post.latitude),
            billboard: {
              image: svgUrl('diamond', color, 22),
              width: 22,
              height: 22,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: HeightReference.CLAMP_TO_GROUND,
            },
            description: `
              <div style="font-family:'Space Grotesk',sans-serif;min-width:220px;background:#111111;color:#F4F4F5;border-radius:6px">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${color};margin-bottom:4px">
                  ${kindLabel}
                </div>
                <div style="font-weight:600;font-size:14px;margin-bottom:8px;line-height:1.3">${esc(post.title)}</div>
                ${mediaThumb}
                <div style="font-size:12px;color:#71717A;display:flex;gap:8px">
                  <span>▲ ${post.upvote_count}</span>
                  <span>·</span>
                  <span>${esc(post.username ?? 'anonymous')}</span>
                  <span>·</span>
                  <span>${age}</span>
                </div>
                <div style="margin-top:10px">
                  <a href="/post/${post.id}" style="font-size:12px;color:${color};text-decoration:none;font-weight:600">
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
      setupClustering(atSourceRef.current, 35)
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
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Detail sidebar */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '300px',
          transform: sidebar ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          zIndex: 1000, pointerEvents: sidebar ? 'auto' : 'none',
          background: 'rgba(13,13,13,0.97)',
          borderLeft: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Event Detail
          </span>
          <button
            onClick={() => setSidebar(null)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-muted)', fontSize: '18px', lineHeight: 1,
              padding: '2px 4px', display: 'flex', alignItems: 'center',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {sidebar && <div dangerouslySetInnerHTML={{ __html: sidebar.html }} />}
        </div>
      </div>

      {/* Measure result panel */}
      {measureMode && (
        <div style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, pointerEvents: 'none',
          background: 'rgba(13,13,13,0.96)', border: '1px solid var(--color-border)',
          borderRadius: '8px', padding: '10px 18px',
          backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-muted)',
          textAlign: 'center', minWidth: '240px',
        }}>
          {measurePoints.length === 0 && 'Click a point on the globe to start measuring'}
          {measurePoints.length === 1 && 'Click a second point to measure distance'}
          {measurePoints.length === 2 && (() => {
            const [p1, p2] = measurePoints
            const km = haversineKm(p1[1], p1[0], p2[1], p2[0])
            const mi = km * 0.6214
            const brg = bearingDeg(p1[1], p1[0], p2[1], p2[0])
            return (
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-accent)' }}>{km.toFixed(1)} km</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>{mi.toFixed(1)} mi</div>
                </div>
                <div style={{ width: '1px', height: '30px', background: 'var(--color-border)' }} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>{Math.round(brg)}°</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-subtle)' }}>bearing</div>
                </div>
                <div style={{ width: '1px', height: '30px', background: 'var(--color-border)' }} />
                <div style={{ pointerEvents: 'auto' }}>
                  <button
                    onClick={() => setMeasurePoints([])}
                    style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute', left: contextMenu.x, top: contextMenu.y,
            zIndex: 1100, pointerEvents: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            background: 'rgba(13,13,13,0.97)', border: '1px solid var(--color-border)',
            borderRadius: '6px', overflow: 'hidden',
            backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
            minWidth: '220px',
          }}>
            <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
              {contextMenu.lat.toFixed(4)}, {contextMenu.lon.toFixed(4)}
            </div>
            <button
              onClick={() => {
                const p = new URLSearchParams({
                  channel: 'field',
                  lat: contextMenu.lat.toFixed(5),
                  lon: contextMenu.lon.toFixed(5),
                })
                navigate(`/community?${p.toString()}`)
                setContextMenu(null)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '9px 12px', background: 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--color-text)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '15px' }}>!</span>
              File Field Report Here
            </button>
            <button
              onClick={() => {
                if (viewerRef.current) {
                  viewerRef.current.camera.flyTo({
                    destination: Cartesian3.fromDegrees(contextMenu.lon, contextMenu.lat, 500000),
                    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
                    duration: 1.5,
                  })
                }
                setContextMenu(null)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '9px 12px', background: 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--color-text)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '13px' }}>⊕</span>
              Zoom to Location
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
