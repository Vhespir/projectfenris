import pg from 'pg'
import { generateSlug } from '../lib/slugs.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const ALERT_SEVERITY = {
  Red: 'Extreme', Orange: 'Severe', Yellow: 'Moderate', Green: 'Minor',
}

const EVENT_TYPE_LABEL = {
  EQ: 'earthquake', TC: 'tropical_cyclone', FL: 'flood',
  VO: 'volcano', WF: 'wildfire', DR: 'drought',
}

function parseDotNetDate(val) {
  if (!val) return null
  if (typeof val === 'string') {
    const m = val.match(/\/Date\((\d+)\)\//)
    if (m) return new Date(parseInt(m[1])).toISOString()
    return val
  }
  return null
}

export async function fetchGDACS() {
  try {
    const fromDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const toDate   = new Date().toISOString().slice(0, 10)

    const res = await fetch(
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` +
      `?eventlist=EQ,TC,FL,VO,WF&alertlevel=Green;Yellow;Orange;Red` +
      `&fromDate=${fromDate}&toDate=${toDate}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FenrisBot/1.0)' },
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) throw new Error(`Status ${res.status}`)

    const data = await res.json()
    const features = Array.isArray(data.features) ? data.features : []
    let stored = 0

    for (const feature of features) {
      const p = feature.properties ?? {}
      const eventCode  = p.eventtype  ?? p.EventType  ?? ''
      const alertLevel = p.alertlevel ?? p.AlertLevel ?? 'Green'
      const severity   = ALERT_SEVERITY[alertLevel] ?? 'Minor'
      const eventType  = EVENT_TYPE_LABEL[eventCode] ?? eventCode.toLowerCase() ?? 'unknown'
      const externalId = `${eventCode}-${p.eventid ?? p.EventId ?? 0}-${p.episodeid ?? p.EpisodeId ?? 0}`
      const title      = p.name ?? p.eventname ?? p.Name ?? `${eventType} alert`

      const geom = feature.geometry
        ? `ST_GeomFromGeoJSON('${JSON.stringify(feature.geometry)}')`
        : 'NULL'

      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties, external_id, starts_at, expires_at, slug)
        VALUES ($1, $2, $3, $4, ${geom}, $5, $6, $7, NOW() + INTERVAL '7 days', $8)
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
        DO UPDATE SET expires_at = NOW() + INTERVAL '7 days', fetched_at = NOW()
      `, [
        'gdacs', eventType, title, severity,
        JSON.stringify({
          country: p.country ?? p.Country,
          iso3:    p.iso3    ?? p.Iso3,
          alertlevel: alertLevel,
          eventtype:  eventCode,
        }),
        externalId,
        parseDotNetDate(p.fromdate ?? p.FromDate),
        generateSlug(),
      ])

      stored += rowCount
    }

    console.log(`GDACS: ${stored} new/updated of ${features.length} events`)
  } catch (err) {
    console.error('GDACS fetch error:', err.message)
  }
}
