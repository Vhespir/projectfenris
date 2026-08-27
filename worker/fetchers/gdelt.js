import pg from 'pg'
import { isRelevant } from './news.js'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// GDELT monitors global news coverage (translated and original-language)
// in near-real-time and is the dataset most OSINT/conflict-early-warning
// work is actually built on. Free, no key. It asks for at most one request
// every 5 seconds; running once per 10-minute worker cycle is nowhere near
// that, so no throttling needed here.
//
// sourcelang:english restricts to English-language source articles. GDELT's
// real differentiator is surfacing non-English coverage before it's picked
// up by English wire services, but the MeteoAlarm feed already burned this
// project once on showing untranslated foreign-language text in the feed
// (see meteoalarm.js), so that's not happening again until there's an
// actual translation step in front of it, not just a filter.
const QUERY = encodeURIComponent(
  '(flood OR wildfire OR earthquake OR tsunami OR hurricane OR typhoon OR volcano OR eruption ' +
  'OR "power outage" OR blackout OR "civil unrest" OR riot OR curfew OR "state of emergency" ' +
  'OR evacuation OR "mass casualty" OR "chemical spill" OR "nuclear plant") sourcelang:english'
)
const GDELT_URL = `https://api.gdeltproject.org/api/v2/doc/doc?query=${QUERY}&mode=artlist&maxrecords=40&format=json&sort=datedesc`

function parseSeenDate(s) {
  // "20260827T010000Z" -> ISO 8601
  if (!s || s.length < 15) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
}

export async function fetchGDELT() {
  try {
    const res = await fetch(GDELT_URL, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`Status ${res.status}`)

    const data = await res.json()
    const articles = Array.isArray(data.articles) ? data.articles : []
    let stored = 0

    for (const a of articles) {
      if (!a.title || !a.url) continue
      // GDELT's own query matching is looser than an exact keyword search
      // (it'll surface an article that only tangentially mentions a term
      // buried in the body), so run titles through the same relevance
      // filter the RSS feeds use as a second pass.
      if (!isRelevant(a.title, null)) continue
      const { rowCount } = await pool.query(`
        INSERT INTO news_items (source, title, url, summary, category, region, published_at)
        VALUES ('GDELT', $1, $2, NULL, 'global', $3, $4)
        ON CONFLICT (url) WHERE url IS NOT NULL DO NOTHING
      `, [
        a.title.trim(),
        a.url,
        a.sourcecountry ?? null,
        parseSeenDate(a.seendate),
      ])
      stored += rowCount
    }

    console.log(`GDELT: ${stored} new of ${articles.length} articles`)
  } catch (err) {
    console.error('GDELT fetch error:', err.message)
  }
}
