import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const COUNTRIES = [
  'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech-republic',
  'denmark', 'estonia', 'finland', 'france', 'germany', 'greece', 'hungary',
  'iceland', 'ireland', 'italy', 'latvia', 'liechtenstein', 'lithuania',
  'luxembourg', 'malta', 'moldova', 'montenegro', 'netherlands',
  'north-macedonia', 'norway', 'poland', 'portugal', 'romania', 'serbia',
  'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland', 'ukraine',
  'united-kingdom', 'albania', 'andorra', 'bosnia-herzegovina',
  'georgia', 'israel', 'kosovo', 'monaco', 'turkey',
]

function parseCapPolygon(polyStr) {
  try {
    const coords = polyStr.trim().split(/\s+/).map(pair => {
      const [lat, lon] = pair.split(',').map(Number)
      return [lon, lat]
    }).filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat))

    if (coords.length < 3) return null

    const first = coords[0], last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) coords.push(coords[0])

    return JSON.stringify({ type: 'Polygon', coordinates: [coords] })
  } catch {
    return null
  }
}

async function fetchCountry(country) {
  const res = await fetch(`https://feeds.meteoalarm.org/api/v1/warnings/feeds-${country}`, {
    headers: { 'User-Agent': 'FenrisBot/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.warnings ?? []
}

async function storeAlert(source, eventType, title, severity, geomJson, properties, externalId, startsAt, expiresAt) {
  if (geomJson) {
    return pool.query(`
      INSERT INTO disaster_events
        (source, event_type, title, severity, geometry, properties, external_id, starts_at, expires_at)
      VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, $7, $8, $9)
      ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [source, eventType, title, severity, geomJson, properties, externalId, startsAt, expiresAt])
  } else {
    return pool.query(`
      INSERT INTO disaster_events
        (source, event_type, title, severity, geometry, properties, external_id, starts_at, expires_at)
      VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8)
      ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
    `, [source, eventType, title, severity, properties, externalId, startsAt, expiresAt])
  }
}

export async function fetchMeteoAlarm() {
  try {
    const results = await Promise.allSettled(COUNTRIES.map(c => fetchCountry(c)))
    const allWarnings = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    let stored = 0

    for (const warning of allWarnings) {
      const alert = warning?.alert
      if (!alert) continue

      const info = Array.isArray(alert.info) ? alert.info[0] : alert.info
      if (!info) continue

      const areas = Array.isArray(info.area) ? info.area : (info.area ? [info.area] : [])

      for (let i = 0; i < areas.length; i++) {
        const area = areas[i]
        if (!area) continue

        const rawPolygon = Array.isArray(area.polygon) ? area.polygon[0] : area.polygon
        const geomJson = rawPolygon ? parseCapPolygon(rawPolygon) : null

        const externalId = `${alert.identifier}-${i}`
        const severity = (info.severity === 'Unknown' || !info.severity) ? 'Minor' : info.severity
        const eventType = info.event ?? 'weather_warning'
        const areaDesc = area.areaDesc ?? ''
        const title = `${eventType} - ${areaDesc}`

        const { rowCount } = await storeAlert(
          'meteoalarm',
          eventType,
          title,
          severity,
          geomJson,
          JSON.stringify({ areaDesc, event: eventType, severity }),
          externalId,
          info.onset ?? null,
          info.expires ?? null,
        )
        stored += rowCount
      }
    }

    console.log(`MeteoAlarm: ${stored} new of ${allWarnings.length} warnings across ${COUNTRIES.length} countries`)
  } catch (err) {
    console.error('MeteoAlarm fetch error:', err.message)
  }
}
