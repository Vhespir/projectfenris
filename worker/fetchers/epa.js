import axios from 'axios'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function aqi_to_severity(aqi) {
  if (aqi >= 301) return 'Extreme'
  if (aqi >= 201) return 'Severe'
  if (aqi >= 101) return 'Moderate'
  return 'Minor'
}

export async function fetchEPA() {
  const apiKey = process.env.AIRNOW_API_KEY
  if (!apiKey) {
    console.log('EPA: AIRNOW_API_KEY not set, skipping')
    return
  }

  try {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
    const hour = `${dateStr}T${pad(now.getUTCHours())}`

    const res = await axios.get('https://www.airnowapi.org/aq/data/', {
      params: {
        startDate: hour,
        endDate: hour,
        parameters: 'PM25,OZONE',
        BBOX: '-125.0,24.0,-66.0,50.0',
        dataType: 'A',
        format: 'application/json',
        verbose: 1,
        API_KEY: apiKey,
      },
      timeout: 20000,
    })

    const readings = res.data
    if (!Array.isArray(readings)) return

    const unhealthy = readings.filter(r => r.AQI >= 101)
    let stored = 0

    for (const r of unhealthy) {
      // API returns UTC as "YYYY-MM-DDTHH:MM"
      const externalId = `${r.SiteName}-${r.Parameter}-${r.UTC}`
      const geomJson = JSON.stringify({ type: 'Point', coordinates: [r.Longitude, r.Latitude] })

      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties,
           external_id, starts_at)
        VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5), $6, $7, $8)
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
      `, [
        'epa',
        'air_quality',
        `Air Quality: ${r.Parameter} AQI ${r.AQI} - ${r.SiteName}`,
        aqi_to_severity(r.AQI),
        geomJson,
        JSON.stringify(r),
        externalId,
        r.UTC ? `${r.UTC}:00Z` : null,
      ])

      stored += rowCount
    }

    console.log(`EPA: ${stored} new unhealthy readings of ${unhealthy.length} above threshold (${readings.length} total)`)
  } catch (err) {
    console.error('EPA fetch error:', err.message)
  }
}
