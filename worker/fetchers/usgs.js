import axios from 'axios'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function fetchUSGS() {
  try {
    const res = await axios.get(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
    )

    const quakes = res.data.features

    for (const quake of quakes) {
      await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties, fetched_at)
        VALUES
          ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, NOW())
        ON CONFLICT DO NOTHING
      `, [
        'usgs',
        'earthquake',
        quake.properties.title,
        quake.properties.mag >= 5 ? 'Severe' :
        quake.properties.mag >= 3 ? 'Moderate' : 'Minor',
        JSON.stringify(quake.geometry),
        JSON.stringify(quake.properties)
      ])
    }

    console.log(`USGS: stored ${quakes.length} earthquakes`)
  } catch (err) {
    console.error('USGS fetch error:', err.message)
  }
}
