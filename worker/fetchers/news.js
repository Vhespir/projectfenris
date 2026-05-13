import Parser from 'rss-parser'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const parser = new Parser({ timeout: 15000 })

const FEEDS = [
  {
    url: 'https://www.nhc.noaa.gov/nhc_at1.xml',
    source: 'NHC',
    category: 'hurricane',
    region: 'Atlantic',
  },
  {
    url: 'https://www.nhc.noaa.gov/nhc_ep1.xml',
    source: 'NHC',
    category: 'hurricane',
    region: 'Eastern Pacific',
  },
  {
    url: 'https://feeds.npr.org/1003/rss.xml',
    source: 'NPR',
    category: 'news',
    region: null,
  },
  {
    url: 'https://feeds.npr.org/1057/rss.xml',
    source: 'NPR',
    category: 'environment',
    region: null,
  },
]

export async function fetchNews() {
  let totalStored = 0

  for (const feed of FEEDS) {
    try {
      const result = await parser.parseURL(feed.url)

      for (const item of result.items) {
        if (!item.title || !item.link) continue

        const { rowCount } = await pool.query(`
          INSERT INTO news_items (source, title, url, summary, category, region, published_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (url) WHERE url IS NOT NULL DO NOTHING
        `, [
          feed.source,
          item.title.trim(),
          item.link,
          item.contentSnippet?.trim() || item.summary?.trim() || null,
          feed.category,
          feed.region,
          item.pubDate ? new Date(item.pubDate).toISOString() : null,
        ])

        totalStored += rowCount
      }
    } catch (err) {
      console.error(`News fetch error (${feed.source}): ${err.message}`)
    }
  }

  console.log(`News: ${totalStored} new items across ${FEEDS.length} feeds`)
}
