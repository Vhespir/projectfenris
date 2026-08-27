import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLocation } from 'react-router-dom'
import CesiumMap from '../components/CesiumMap'
import type { DisasterEvent, AirTrafficFilters, AltitudeBand, FireTimeRange } from '../components/MapEventLayer'
import { useIsMobile } from '../hooks/useIsMobile'

const SOURCES = [
  { key: 'usgs',  label: 'Seismic (USGS)' },
  { key: 'gdacs', label: 'Global (GDACS)' },
  { key: 'epa',   label: 'Air Quality (EPA)' },
  { key: 'eonet', label: 'NASA EONET' },
]

const OVERLAYS = [
  { key: 'radar',   label: 'Radar' },
  { key: 'alerts',  label: 'Weather Alerts' },
  { key: 'traffic', label: 'Air Traffic' },
  { key: 'fires',   label: 'Fires' },
  { key: 'reports', label: 'Citizen Reports' },
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

const LEGEND_SOURCES = [
  { shape: 'circle',   color: '#22C55E', label: 'NOAA' },
  { shape: 'triangle', color: '#F59E0B', label: 'USGS Seismic' },
  { shape: 'pentagon', color: '#3B82F6', label: 'GDACS Global' },
  { shape: 'diamond',  color: '#A78BFA', label: 'EPA Air Quality' },
  { shape: 'square',   color: '#71717A', label: 'NASA EONET' },
  { shape: 'square',   color: '#F59E0B', label: 'Field Report' },
  { shape: 'square',   color: '#38BDF8', label: 'Self-Reported News' },
]

const LEGEND_SEVERITY = [
  { color: '#EF4444', label: 'Extreme' },
  { color: '#F59E0B', label: 'Severe' },
  { color: '#3B82F6', label: 'Moderate' },
  { color: '#22C55E', label: 'Minor' },
]

function LegendShape({ shape, color }: { shape: string; color: string }) {
  const s = 14
  const shapes: Record<string, ReactElement> = {
    circle:   <circle cx="7" cy="7" r="5.5" fill={color} />,
    triangle: <polygon points="7,1 13,13 1,13" fill={color} />,
    pentagon: <polygon points="7,1 13,5 11,12 3,12 1,5" fill={color} />,
    diamond:  <polygon points="7,1 13,7 7,13 1,7" fill={color} />,
    square:   <rect x="1.5" y="1.5" width="11" height="11" fill={color} />,
  }
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      {shapes[shape] ?? shapes.circle}
    </svg>
  )
}

export default function MapPage() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const pendingFlyTo = (location.state as { flyTo?: { lat: number; lon: number } } | null)?.flyTo

  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState(new Set(['usgs', 'gdacs', 'epa', 'eonet']))
  const [activeOverlays, setActiveOverlays] = useState(new Set(['radar', 'alerts']))

  const [atFilters, setAtFilters] = useState<AirTrafficFilters>({ altitudeBand: 'all', emergencyOnly: false })
  const [atPanelOpen, setAtPanelOpen] = useState(false)
  const [atCount, setAtCount] = useState(0)

  const [fireRange, setFireRange] = useState<FireTimeRange>('24h')
  const [firePanelOpen, setFirePanelOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ label: string; lat: number; lon: number }[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const flyToRef = useRef<((lat: number, lon: number) => void) | null>(null)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchSeqRef = useRef(0)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function doSearch(q: string) {
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    const seq = ++searchSeqRef.current

    setSearching(true)
    try {
      const res = await fetch(`/api/external/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      const data = await res.json()
      if (seq !== searchSeqRef.current) return // a newer keystroke already superseded this request
      const results = Array.isArray(data) ? data : []
      setSearchResults(results)
      setSearchOpen(true)
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && seq === searchSeqRef.current) setSearchResults([])
    } finally {
      if (seq === searchSeqRef.current) setSearching(false)
    }
  }

  // Live suggestions as you type, debounced so every keystroke doesn't fire
  // a request (the geocode endpoint is rate-limited to 20/min per IP, and
  // there's no reason to hit Nominatim harder than a person actually types).
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    const t = setTimeout(() => doSearch(q), 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault()
    // Enter/Go while a suggestion list is already showing: go to the top
    // match instead of re-querying for what's already on screen.
    if (searchOpen && searchResults.length > 0) {
      selectSearchResult(searchResults[0])
      return
    }
    const q = searchQuery.trim()
    if (!q) return
    await doSearch(q)
  }

  function selectSearchResult(r: { lat: number; lon: number }) {
    flyToRef.current?.(r.lat, r.lon)
    setSearchOpen(false)
  }

  useEffect(() => {
    fetch('/api/events?sources=usgs,gdacs,epa,eonet&limit=1000')
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

  const btn = (active: boolean, accentColor = 'var(--color-accent)') => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '4px 12px', borderRadius: '4px', fontSize: '12px',
    fontFamily: 'var(--font-display)', cursor: 'pointer',
    border: `1px solid ${active ? accentColor : 'var(--color-border)'}`,
    background: active ? `color-mix(in srgb, ${accentColor} 10%, transparent)` : 'transparent',
    color: active ? accentColor : 'var(--color-muted)',
    transition: 'all 0.15s',
  })

  const divider = <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', flexShrink: 0 }} />

  const trafficActive = activeOverlays.has('traffic')
  const firesActive   = activeOverlays.has('fires')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--color-bg)' }}>

      {/* Filter bar */}
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
                  borderRadius: '3px', padding: '1px 5px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                }}>
                  {atCount.toLocaleString()}
                </span>
              )}
            </button>

            {o.key === 'traffic' && trafficActive && (
              <button
                onClick={() => setAtPanelOpen(v => !v)}
                style={{ ...btn(atPanelOpen), paddingLeft: '8px', paddingRight: '8px' }}
                title="Air traffic filters"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}

            {o.key === 'fires' && firesActive && (
              <button
                onClick={() => setFirePanelOpen(v => !v)}
                style={{ ...btn(firePanelOpen, '#F59E0B'), paddingLeft: '8px', paddingRight: '8px' }}
                title="Fire layer options"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
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

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div ref={searchBoxRef} style={{ position: 'relative' }}>
            <form onSubmit={runSearch} style={{ display: 'flex' }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                placeholder="Go to a place..."
                style={{
                  width: '160px', padding: '5px 10px', borderRadius: '5px 0 0 5px', fontSize: '12px',
                  fontFamily: 'var(--font-mono)', background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)', borderRight: 'none',
                  color: 'var(--color-text)', outline: 'none',
                }}
              />
              <button type="submit" disabled={searching} style={{
                padding: '5px 10px', borderRadius: '0 5px 5px 0', fontSize: '12px', fontFamily: 'var(--font-mono)',
                cursor: searching ? 'not-allowed' : 'pointer', border: '1px solid var(--color-border)',
                background: 'var(--color-surface-elevated)', color: 'var(--color-muted)',
              }}>
                {searching ? '...' : 'Go'}
              </button>
            </form>
            {searchOpen && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '280px', zIndex: 20,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.4)', overflow: 'hidden',
              }}>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectSearchResult(r)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      fontSize: '12px', color: 'var(--color-text)', background: 'none', border: 'none',
                      borderBottom: i < searchResults.length - 1 ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setMeasureMode(v => !v)}
            style={btn(measureMode, '#A78BFA')}
            title="Measure distance between two points"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="2" y1="14" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="2" y1="14" x2="2" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="14" y1="2" x2="11" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="14" y1="2" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Measure
          </button>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
            {loading ? 'Loading...' : error
              ? <span style={{ color: 'var(--color-danger)' }}>{error}</span>
              : `${events.length} active events`}
          </span>
        </div>
      </div>

      {/* Globe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <CesiumMap
          events={events}
          activeFilters={activeFilters}
          activeOverlays={activeOverlays}
          atFilters={atFilters}
          onAtCount={setAtCount}
          fireRange={fireRange}
          flyToRef={flyToRef}
          initialFlyTo={pendingFlyTo}
          measureMode={measureMode}
        />

        {/* Legend toggle */}
        <div style={{ position: 'absolute', bottom: 36, left: 10, zIndex: 1000 }}>
          <button
            onClick={() => setLegendOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 10px', borderRadius: '4px', cursor: 'pointer',
              border: `1px solid ${legendOpen ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: legendOpen ? 'rgba(34,197,94,0.08)' : 'rgba(17,17,17,0.88)',
              color: legendOpen ? 'var(--color-accent)' : 'var(--color-muted)',
              fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em',
              backdropFilter: 'blur(6px)', transition: 'all 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="9" y1="4.5" x2="15" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="9" y1="11.5" x2="15" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            MAP KEY
          </button>

          {legendOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px',
              background: 'rgba(17,17,17,0.96)', border: '1px solid var(--color-border)',
              borderRadius: '8px', padding: '14px', minWidth: '190px',
              backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Event Sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '13px' }}>
                {LEGEND_SOURCES.map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    <LegendShape shape={l.shape} color={l.color} />
                    {l.label}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '11px' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Severity
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {LEGEND_SEVERITY.map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fire panel */}
        {firesActive && firePanelOpen && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'auto' : 36, top: isMobile ? 8 : 'auto', right: 10,
            zIndex: 1000, background: 'rgba(17,17,17,0.96)', border: '1px solid var(--color-border)',
            borderRadius: '8px', padding: '16px', minWidth: '200px',
            backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fire Hotspots
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B' }}>NASA FIRMS</span>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
                Time Range
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {FIRE_RANGES.map(r => {
                  const active = fireRange === r.key
                  return (
                    <button key={r.key} onClick={() => setFireRange(r.key)} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', width: '100%', textAlign: 'left',
                      border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
                      fontFamily: 'var(--font-display)', fontSize: '12px',
                      color: active ? '#F59E0B' : 'var(--color-muted)', transition: 'all 0.12s',
                    }}>
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
                {[{ color: '#EF4444', label: 'High confidence' }, { color: '#F59E0B', label: 'Medium confidence' }, { color: '#FCD34D', label: 'Low confidence' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Air traffic panel */}
        {trafficActive && atPanelOpen && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'auto' : 36, top: isMobile ? 8 : 'auto', right: 10,
            zIndex: 1000, background: 'rgba(17,17,17,0.96)', border: '1px solid var(--color-border)',
            borderRadius: '8px', padding: '16px', width: isMobile ? 'calc(100vw - 20px)' : '240px',
            backdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
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
                    <button key={b.key} onClick={() => setAtFilters(f => ({ ...f, altitudeBand: b.key }))} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', width: '100%', textAlign: 'left',
                      border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : 'var(--color-border)'}`,
                      background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
                      fontFamily: 'var(--font-display)', fontSize: '12px',
                      color: active ? 'var(--color-accent)' : 'var(--color-muted)', transition: 'all 0.12s',
                    }}>
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
                  color: atFilters.emergencyOnly ? '#EF4444' : 'var(--color-muted)', transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  border: `1.5px solid ${atFilters.emergencyOnly ? '#EF4444' : 'var(--color-border)'}`,
                  background: atFilters.emergencyOnly ? '#EF4444' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {atFilters.emergencyOnly && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3.5 6L6.5 2" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
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
