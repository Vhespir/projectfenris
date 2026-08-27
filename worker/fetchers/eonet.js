import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// NASA's Earth Observatory Natural Event Tracker: one clean, NASA-maintained
// API aggregating storms, volcanoes, floods, and more from multiple
// upstream sources (JTWC, Smithsonian GVP, etc.), already geocoded. Free,
// no key, no rate limit posted. Wildfires are excluded from the query
// entirely (not just filtered client-side): EONET's wildfire category is
// IRWIN's raw US incident feed, which is already covered in detail by the
// dedicated NIFC fetcher and the FIRMS heat layer, and it's so much larger
// than every other category combined that leaving it in would crowd the
// results limit out with duplicate fire pins instead of the events EONET
// actually adds coverage for.
const EONET_CATEGORIES = [
  'severeStorms', 'volcanoes', 'floods', 'drought', 'landslides',
  'dustHaze', 'seaLakeIce', 'snow', 'tempExtremes', 'earthquakes',
].join(',')
const EONET_URL = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=${EONET_CATEGORIES}&limit=200`

const CATEGORY_TO_EVENT_TYPE = {
  wildfires: 'wildfire',
  severeStorms: 'severe_storm',
  volcanoes: 'volcano',
  floods: 'flood',
  drought: 'drought',
  earthquakes: 'earthquake',
  seaLakeIce: 'ice',
  snow: 'snow',
  dustHaze: 'dust_haze',
  landslides: 'landslide',
  manmade: 'other',
  tempExtremes: 'temperature_extreme',
  waterColor: 'water_color',
}

export async function fetchEONET() {
  try {
    const res = await fetch(EONET_URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`Status ${res.status}`)

    const data = await res.json()
    const events = Array.isArray(data.events) ? data.events : []
    let stored = 0

    for (const ev of events) {
      const category = ev.categories?.[0]
      const geometry = Array.isArray(ev.geometry) ? ev.geometry : []
      // Storms and drifting events carry a track of points over time; the
      // most recent one is the event's current position.
      const latest = geometry[geometry.length - 1]
      if (!latest?.coordinates) continue

      const eventType = CATEGORY_TO_EVENT_TYPE[category?.id] ?? category?.id?.toLowerCase() ?? 'other'
      const point = latest.type === 'Point'
        ? { type: 'Point', coordinates: latest.coordinates }
        : null
      if (!point) continue // polygon-tracked events (rare) skipped for now, not worth the extra geometry handling

      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties, external_id, starts_at, expires_at)
        VALUES ('eonet', $1, $2, NULL, ST_GeomFromGeoJSON($3), $4, $5, $6, NOW() + INTERVAL '7 days')
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
        DO UPDATE SET
          geometry   = EXCLUDED.geometry,
          expires_at = NOW() + INTERVAL '7 days',
          fetched_at = NOW()
      `, [
        eventType,
        ev.title,
        JSON.stringify(point),
        JSON.stringify({
          category: category?.title ?? null,
          source: ev.sources?.[0]?.id ?? null,
          link: ev.sources?.[0]?.url ?? ev.link ?? null,
          magnitude: latest.magnitudeValue ?? null,
          magnitudeUnit: latest.magnitudeUnit ?? null,
        }),
        ev.id,
        latest.date ?? null,
      ])
      stored += rowCount
    }

    console.log(`EONET: ${stored} new/updated of ${events.length} open events`)
  } catch (err) {
    console.error('EONET fetch error:', err.message)
  }
}
