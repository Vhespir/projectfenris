import axios from 'axios'
import pg from 'pg'
import { generateSlug } from '../lib/slugs.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SEVERITY_MAP = {
  Extreme: 'Extreme',
  Severe: 'Severe',
  Moderate: 'Moderate',
  Minor: 'Minor',
  Unknown: 'Minor',
}

export async function fetchNOAA() {
  try {
    const res = await axios.get('https://api.weather.gov/alerts/active', {
      headers: { 'User-Agent': 'ProjectFenris/1.0 contact@projectfenris.com' },
      timeout: 15000,
    })

    const alerts = res.data.features
    let stored = 0

    for (const alert of alerts) {
      const p = alert.properties
      const geomJson = alert.geometry ? JSON.stringify(alert.geometry) : null

      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties,
           external_id, starts_at, expires_at, slug)
        VALUES (
          $1, $2, $3, $4,
          CASE WHEN $5::text IS NOT NULL THEN ST_GeomFromGeoJSON($5) ELSE NULL END,
          $6, $7, $8, $9, $10
        )
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
      `, [
        'noaa',
        p.event,
        p.headline || p.event,
        SEVERITY_MAP[p.severity] || 'Minor',
        geomJson,
        JSON.stringify(p),
        p.id,
        p.onset || p.effective || null,
        p.expires || null,
        generateSlug(),
      ])

      stored += rowCount
    }

    console.log(`NOAA: ${stored} new of ${alerts.length} alerts`)
  } catch (err) {
    console.error('NOAA fetch error:', err.message)
  }
}
