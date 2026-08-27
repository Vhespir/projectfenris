import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

// cisa.gov's RSS feeds are blocked outright from this app's actual hosting
// IP (see the IP_BLOCKED note in fetchers/news.js). This static JSON file
// might or might not share that block, unproven either way, so try direct
// first and only fall back to the public proxy the other blocked federal
// feeds use if that fails. The proxy isn't assumed reliable here either:
// it's timed out on this specific file (1.6MB) in testing, likely just too
// big for it, so direct is genuinely the better first try, not a formality.
async function fetchKEV() {
  try {
    const res = await fetch(KEV_URL, { signal: AbortSignal.timeout(20000) })
    if (res.ok) return res
    throw new Error(`Status ${res.status}`)
  } catch {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(KEV_URL)}`, {
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Status ${res.status} (direct and proxied both failed)`)
    return res
  }
}

// Only pull vulnerabilities added recently: the full catalog is 1,600+
// entries going back years, and re-inserting all of them every 10 minutes
// (deduped by URL, but still a full table scan of the fetched JSON) would
// be pointless. A handful of CVEs get added most days.
const LOOKBACK_DAYS = 14

export async function fetchCISA() {
  try {
    const res = await fetchKEV()
    const data = await res.json()
    const vulns = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : []
    const cutoff = Date.now() - LOOKBACK_DAYS * 86400000
    let stored = 0

    for (const v of vulns) {
      const addedAt = v.dateAdded ? new Date(v.dateAdded) : null
      if (!addedAt || addedAt.getTime() < cutoff) continue

      const title = `${v.cveID}: ${v.vulnerabilityName ?? 'Known Exploited Vulnerability'}`
      const url = `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?field_cve=${encodeURIComponent(v.cveID ?? '')}`

      const { rowCount } = await pool.query(`
        INSERT INTO news_items (source, title, url, summary, category, region, published_at)
        VALUES ('CISA-KEV', $1, $2, $3, 'cybersecurity', NULL, $4)
        ON CONFLICT (url) WHERE url IS NOT NULL DO NOTHING
      `, [
        title, url,
        [v.shortDescription, v.knownRansomwareCampaignUse === 'Known' ? 'Known ransomware campaign use.' : null]
          .filter(Boolean).join(' '),
        addedAt.toISOString(),
      ])
      stored += rowCount
    }

    console.log(`CISA KEV: ${stored} new of ${vulns.length} total catalog entries`)
  } catch (err) {
    console.error('CISA KEV fetch error:', err.message)
  }
}
