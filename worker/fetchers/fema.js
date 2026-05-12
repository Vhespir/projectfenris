import axios from 'axios'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function fetchFEMA() {
  try {
    const res = await axios.get(
      'https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries?$top=50&$orderby=declarationDate desc'
    )

    const disasters = res.data.DisasterDeclarationsSummaries

    for (const disaster of disasters) {
      await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties, fetched_at)
        VALUES
          ($1, $2, $3, $4, NULL, $5, NOW())
        ON CONFLICT DO NOTHING
      `, [
        'fema',
        disaster.incidentType,
        `${disaster.incidentType} - ${disaster.designatedArea}, ${disaster.state}`,
        'Severe',
        JSON.stringify(disaster)
      ])
    }

    console.log(`FEMA: stored ${disasters.length} declarations`)
  } catch (err) {
    console.error('FEMA fetch error:', err.message)
  }
}
