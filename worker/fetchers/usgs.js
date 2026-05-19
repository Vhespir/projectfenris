import axios from 'axios'
import pg from 'pg'
import { generateSlug } from '../lib/slugs.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function magnitude_to_severity(mag) {
  if (mag >= 6.0) return 'Extreme'
  if (mag >= 5.0) return 'Severe'
  if (mag >= 3.0) return 'Moderate'
  return 'Minor'
}

export async function fetchUSGS() {
  try {
    const res = await axios.get(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      { timeout: 15000 }
    )

    const quakes = res.data.features
    let stored = 0

    for (const quake of quakes) {
      const p = quake.properties
      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties,
           external_id, starts_at, slug)
        VALUES ($1, $2, $3, $4, ST_Force2D(ST_GeomFromGeoJSON($5)), $6, $7, $8, $9)
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
      `, [
        'usgs',
        'earthquake',
        p.title,
        magnitude_to_severity(p.mag),
        JSON.stringify(quake.geometry),
        JSON.stringify(p),
        quake.id,
        p.time ? new Date(p.time).toISOString() : null,
        generateSlug(),
      ])

      stored += rowCount
    }

    console.log(`USGS: ${stored} new of ${quakes.length} earthquakes`)
  } catch (err) {
    console.error('USGS fetch error:', err.message)
  }
}
