import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  EventLayer, RadarLayer, WeatherAlertLayer, AirTrafficLayer, FieldReportLayer, FireLayer, WildfirePerimeterLayer,
  type DisasterEvent, type AirTrafficFilters, type AltitudeBand, type FireTimeRange,
} from '../components/MapEventLayer'
import { useIsMobile } from '../hooks/useIsMobile'

const SOURCES = [
  { key: 'usgs',  label: 'Seismic (USGS)' },
  { key: 'gdacs', label: 'Global (GDACS)' },
  { key: 'epa',   label: 'Air Quality (EPA)' },
]

const OVERLAYS = [
  { key: 'radar',      label: 'Radar' },
  { key: 'alerts',     label: 'Weather Alerts' },
  { key: 'traffic',    label: 'Air Traffic' },
  { key: 'fires',      label: 'Fires' },
  { key: 'perimeters', label: 'Fire Perimeters' },
  { key: 'reports',    label: 'Field Reports' },
]

const FIRE_RANGES: { key: FireTimeRange; label: string; desc: string }[] = [
  { key: '24h', label: '24 hours', desc: 'Last 24 hrs' },
  { key: '48h', label: '48 hours', desc: 'Last 48 hrs' },
  { key: '7d',  label: '7 days',   desc: 'Last 7 days' },
]

const ALT_BANDS: { key: AltitudeBand; label: string; desc: string }[] = [
  { key: 'all',      label: 'All',      desc: 'Every aircraft' },
  { key: 'cruising', label: 'Cruising', desc: '>25,000 ft' },
  { key: 'medium',   label: 'Medium',   desc: '5k – 25k ft' },
  { key: 'low',      label: 'Low',      desc: '<5,000 ft' },
  { key: 'ground',   label: 'Ground',   desc: 'On ground' },
]

const ALT_LEGEND = [
  { color: '#CBD5E1', label: 'Cruising  >25k ft' },
  { color: '#60A5FA', label: 'Medium  5k–25k ft' },
  { color: '#F59E0B', label: 'Low  <5,000 ft' },
  { color: '#52525B', label: 'On ground' },
  { color: '#EF4444', label: 'Emergency squawk' },
]

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

export default function MapPage() {
  const isMobile = useIsMobile()
  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState(new Set(['usgs', 'gdacs', 'epa']))
  const [activeOverlays, setActiveOverlays] = useState(new Set(['radar', 'alerts']))

  const [atFilters, setAtFilters] = useState<AirTrafficFilters>({ altitudeBand: 'all', emergencyOnly: false })
  const [atPanelOpen, setAtPanelOpen] = useState(false)
  const [atCount, setAtCount] = useState(0)

  const [fireRange, setFireRange] = useState<FireTimeRange>('24h')
  const [firePanelOpen, setFirePanelOpen] = useState(false)

  useEffect(() => {
    fetch('/api/events?sources=usgs,gdacs,epa&limit=1000')
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false) })
      .catch(() => { setError('Failed to load event data'); setLoading(false) })
  }, [])

  function toggleFilter(key: string) {
    setActiveFilters(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleOverlay(key: string) {
    setActiveOverlays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const counts = events.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1; return acc
  }, {} as Record<string, number>)

  const btn = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '4px 12px', borderRadius: '4px', fontSize: '12px',
    fontFamily: 'var(--font-display)', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
    transition: 'all 0.15s',
  })

  const divider = <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', flexShrink: 0 }} />

  const trafficActive = activeOverlays.has('traffic')
  const firesActive = activeOverlays.has('fires')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--color-bg)' }}>
      <div className="map-filter-bar" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap',
      }}>
        {OVERLAYS.map(o => (
          <span key={o.key} style={{ display: 'contents' }}>
            <button onClick={() => toggleOverlay(o.key)} style={btn(activeOverlays.has(o.key))}>
              {o.label}
              {o.key === 'traffic' && trafficActive && atCount > 0 && (
                <span style={{
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: '3px', padding: '1px 5px', fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {atCount.toLocaleString()}
                </span>
              )}
            </button>
            {o.key === 'traffic' && trafficActive && (
              <button
                onClick={() => setAtPanelOpen(o => !o)}
                style={{
                  ...btn(atPanelOpen),
                  paddingLeft: '8px', paddingRight: '8px',
                  borderColor: atPanelOpen ? 'var(--color-accent)' : 'var(--color-border)',
                }}
                title="Air traffic filters"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            {o.key === 'fires' && firesActive && (
              <button
                onClick={() => setFirePanelOpen(o => !o)}
                style={{
                  ...btn(firePanelOpen),
                  paddingLeft: '8px', paddingRight: '8px',
                  borderColor: firePanelOpen ? '#F59E0B' : 'var(--color-border)',
                  background: firePanelOpen ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: firePanelOpen ? '#F59E0B' : 'var(--color-muted)',
                }}
                title="Fire layer options"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </span>
        ))}

        {divider}

        {SOURCES.map(s => (
          <button key={s.key} onClick={() => toggleFilter(s.key)} style={btn(activeFilters.has(s.key))}>
            {s.label}
            {counts[s.key] != null && (
              <span style={{ background: 'var(--color-surface-elevated)', borderRadius: '3px', padding: '1px 5px', fontSize: '11px' }}>
                {counts[s.key]}
              </span>
            )}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', flexShrink: 0 }}>
          {loading ? 'Loading...' : error
            ? <span style={{ color: 'var(--color-danger)' }}>{error}</span>
            : `${events.length} active events`}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[20, 0]}
          zoom={3}
          worldCopyJump={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />
          <GeolocateUser />
          {activeOverlays.has('radar')   && <RadarLayer />}
          {activeOverlays.has('alerts')  && <WeatherAlertLayer />}
          {trafficActive && <AirTrafficLayer filters={atFilters} onCount={setAtCount} />}
          {firesActive && <FireLayer range={fireRange} />}
          {activeOverlays.has('perimeters') && <WildfirePerimeterLayer />}
          {activeOverlays.has('reports') && <FieldReportLayer />}
          <EventLayer events={events} activeFilters={activeFilters} />
        </MapContainer>

        {/* Fire layer panel */}
        {firesActive && firePanelOpen && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'auto' : 36,
            top: isMobile ? 8 : 'auto',
            right: 10,
            zIndex: 1000,
            background: 'rgba(17,17,17,0.96)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            minWidth: '200px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fire Hotspots
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B' }}>
                NASA FIRMS
              </span>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
                Time Range
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {FIRE_RANGES.map(r => {
                  const active = fireRange === r.key
                  return (
                    <button
                      key={r.key}
                      onClick={() => setFireRange(r.key)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', width: '100%', textAlign: 'left',
                        border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`,
                        background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
                        fontFamily: 'var(--font-display)', fontSize: '12px',
                        color: active ? '#F59E0B' : 'var(--color-muted)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span>{r.label}</span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: active ? 'rgba(245,158,11,0.6)' : 'var(--color-subtle)' }}>
                        {r.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
                Legend
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { color: '#EF4444', label: 'High confidence' },
                  { color: '#F59E0B', label: 'Medium confidence' },
                  { color: '#FCD34D', label: 'Low confidence' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Air traffic filter panel */}
        {trafficActive && atPanelOpen && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'auto' : 36,
            top: isMobile ? 8 : 'auto',
            right: 10,
            zIndex: 1000,
            background: 'rgba(17,17,17,0.96)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '16px',
            width: isMobile ? 'calc(100vw - 20px)' : '240px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Air Traffic
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)' }}>
                {atCount.toLocaleString()} aircraft
              </span>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
                Altitude Band
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {ALT_BANDS.map(b => {
                  const active = atFilters.altitudeBand === b.key
                  return (
                    <button
                      key={b.key}
                      onClick={() => setAtFilters(f => ({ ...f, altitudeBand: b.key }))}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', width: '100%', textAlign: 'left',
                        border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : 'var(--color-border)'}`,
                        background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                        fontFamily: 'var(--font-display)', fontSize: '12px',
                        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span>{b.label}</span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: active ? 'rgba(34,197,94,0.6)' : 'var(--color-subtle)' }}>
                        {b.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <button
                onClick={() => setAtFilters(f => ({ ...f, emergencyOnly: !f.emergencyOnly }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 9px', borderRadius: '4px', cursor: 'pointer', width: '100%', textAlign: 'left',
                  border: `1px solid ${atFilters.emergencyOnly ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
                  background: atFilters.emergencyOnly ? 'rgba(239,68,68,0.08)' : 'transparent',
                  fontFamily: 'var(--font-display)', fontSize: '12px',
                  color: atFilters.emergencyOnly ? '#EF4444' : 'var(--color-muted)',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  border: `1.5px solid ${atFilters.emergencyOnly ? '#EF4444' : 'var(--color-border)'}`,
                  background: atFilters.emergencyOnly ? '#EF4444' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {atFilters.emergencyOnly && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  )}
                </span>
                Emergency squawks only
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
                Legend
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ALT_LEGEND.map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setAtFilters({ altitudeBand: 'all', emergencyOnly: false })}
              style={{
                marginTop: '12px', width: '100%', padding: '5px', borderRadius: '4px',
                fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-subtle)', transition: 'color 0.15s',
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
