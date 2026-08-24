import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// https://services.swpc.noaa.gov/products/alerts.json
// Returns array of { product_id, issue_datetime, message }

const CODE_LABELS = {
  ALTEF0: 'Electron Flux Alert (Moderate)',
  ALTEF1: 'Electron Flux Alert (High)',
  ALTEF2: 'Electron Flux Alert (Very High)',
  ALTEF3: 'Electron Flux Alert (Extreme)',
  ALTTP1: 'Solar Radiation Storm Alert (S1)',
  ALTTP2: 'Solar Radiation Storm Alert (S2)',
  ALTTP3: 'Solar Radiation Storm Alert (S3)',
  ALTTP4: 'Solar Radiation Storm Alert (S4)',
  ALTTP5: 'Solar Radiation Storm Alert (S5)',
  ALTK01: 'Geomagnetic Storm Alert (Kp=1)',
  ALTK02: 'Geomagnetic Storm Alert (Kp=2)',
  ALTK03: 'Geomagnetic Storm Alert (Kp=3)',
  ALTK04: 'Geomagnetic Storm Alert (Kp=4)',
  ALTK05: 'Geomagnetic Storm Alert (G1)',
  ALTK06: 'Geomagnetic Storm Alert (G2)',
  ALTK07: 'Geomagnetic Storm Alert (G3)',
  ALTK08: 'Geomagnetic Storm Alert (G4)',
  ALTK09: 'Geomagnetic Storm Alert (G5)',
  WATA20: 'Geomagnetic Storm Watch (G2)',
  WATA30: 'Geomagnetic Storm Watch (G3)',
  WATA40: 'Geomagnetic Storm Watch (G4)',
  WATA50: 'Geomagnetic Storm Watch (G5)',
  WSTP01: 'Space Weather Warning (G1)',
  WSTP02: 'Space Weather Warning (G2)',
  WSTP03: 'Space Weather Warning (G3)',
  WSTP04: 'Space Weather Warning (G4)',
  WSTP05: 'Space Weather Warning (G5)',
  SUMXM1: 'Solar Flare Summary (M1)',
  SUMXM5: 'Solar Flare Summary (M5)',
  SUMX10: 'Solar Flare Summary (X1)',
  SUMX20: 'Solar Flare Summary (X2)',
  SUMX50: 'Solar Flare Summary (X5+)',
  SUMSUD: 'Sudden Ionospheric Disturbance',
  SUMRPC: 'Radio Propagation Disturbance',
}

function extractTitle(message, productId) {
  const codeMatch = message.match(/Space Weather Message Code:\s*(\S+)/i)
  if (codeMatch) {
    const code = codeMatch[1].trim()
    if (CODE_LABELS[code]) return CODE_LABELS[code]
    return `Space Weather Alert: ${code}`
  }
  const firstLine = message.split('\n').find(l => l.trim())
  return firstLine?.trim() || `Space Weather Alert ${productId}`
}

function extractSummary(message) {
  const lines = message.split('\n').map(l => l.trim()).filter(Boolean)
  const skip = /^(Space Weather Message Code|Issue Time|Serial Number|NOAA Space Weather)/i
  const content = lines.filter(l => !skip.test(l))
  return content.slice(0, 4).join(' ').slice(0, 600) || null
}

export async function fetchSWPC() {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/products/alerts.json', {
      headers: { 'User-Agent': 'ProjectFenris/1.0 contact@projectfenris.com' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const alerts = await res.json()
    if (!Array.isArray(alerts)) return

    const cutoff = new Date(Date.now() - 7 * 86400000)
    let stored = 0

    for (const alert of alerts) {
      if (!alert.product_id || !alert.message) continue
      const issuedAt = alert.issue_datetime ? new Date(alert.issue_datetime.replace(' ', 'T') + 'Z') : null
      if (issuedAt && issuedAt < cutoff) continue

      const title = extractTitle(alert.message, alert.product_id)
      const summary = extractSummary(alert.message)
      const url = `https://services.swpc.noaa.gov/alerts/${alert.product_id}`

      const { rowCount } = await pool.query(`
        INSERT INTO news_items (source, title, url, summary, category, region, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (url) WHERE url IS NOT NULL DO NOTHING
      `, [
        'NOAA SWPC',
        title,
        url,
        summary,
        'space_weather',
        null,
        issuedAt ? issuedAt.toISOString() : null,
      ])
      stored += rowCount
    }

    console.log(`SWPC: ${stored} new of ${alerts.length} alerts`)
  } catch (err) {
    console.error('SWPC fetch error:', err.message)
  }
}
