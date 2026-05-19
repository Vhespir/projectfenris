import axios from 'axios'
import pg from 'pg'
import { generateSlug } from '../lib/slugs.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function fetchFEMA() {
  try {
    const res = await axios.get(
      'https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries?$top=50&$orderby=declarationDate desc',
      { timeout: 15000 }
    )

    const disasters = res.data.DisasterDeclarationsSummaries
    let stored = 0

    for (const d of disasters) {
      const externalId = String(d.disasterNumber)
      const { rowCount } = await pool.query(`
        INSERT INTO disaster_events
          (source, event_type, title, severity, geometry, properties,
           external_id, starts_at, slug)
        VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8)
        ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
      `, [
        'fema',
        d.incidentType,
        `${d.incidentType} - ${d.designatedArea}, ${d.state}`,
        'Severe',
        JSON.stringify(d),
        externalId,
        d.declarationDate || null,
        generateSlug(),
      ])

      stored += rowCount
    }

    console.log(`FEMA: ${stored} new of ${disasters.length} declarations`)
  } catch (err) {
    console.error('FEMA fetch error:', err.message)
  }
}
