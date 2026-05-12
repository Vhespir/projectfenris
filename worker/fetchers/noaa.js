import axios from 'axios'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function fetchNOAA() {
  try {
    const res = await axios.get('https://api.weather.gov/alerts/active', {
      headers: { 'User-Agent': 'ProjectFenris/1.0 contact@projectfenris.com' }
    })

    const alerts = res.data.features

    for (const alert of alerts) {
      await pool.query(`
        INSERT INTO disaster_events 
          (source, event_type, title, severity, geometry, properties, fetched_at)
        VALUES 
          ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, NOW())
        ON CONFLICT DO NOTHING
      `, [
        'noaa',
        alert.properties.event,
        alert.properties.headline,
        alert.properties.severity,
        JSON.stringify(alert.geometry),
        JSON.stringify(alert.properties)
      ])
    }

    console.log(`NOAA: stored ${alerts.length} alerts`)
  } catch (err) {
    console.error('NOAA fetch error:', err.message)
  }
}
