import Parser from 'rss-parser'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FenrisBot/1.0)' } })

// Dedicated emergency/disaster feeds -- always relevant, no filtering needed
const DEDICATED_FEEDS = [
  { url: 'https://www.nhc.noaa.gov/nhc_at1.xml',                  source: 'NHC',    category: 'hurricane',  region: 'Atlantic' },
  { url: 'https://www.nhc.noaa.gov/nhc_ep1.xml',                  source: 'NHC',    category: 'hurricane',  region: 'Eastern Pacific' },
  { url: 'https://www.nhc.noaa.gov/nhc_cp1.xml',                  source: 'NHC',    category: 'hurricane',  region: 'Central Pacific' },
  { url: 'https://emergency.cdc.gov/han/rss_feed.asp',            source: 'CDC',    category: 'health',     region: null },
  { url: 'https://www.usgs.gov/news/all-news/feed',               source: 'USGS',   category: 'science',    region: null },
  { url: 'https://www.fema.gov/about/news-multimedia/news/feed',  source: 'FEMA',   category: 'emergency',  region: null },
  { url: 'https://www.weather.gov/xml/current_obs/rss.xml',       source: 'NWS',    category: 'weather',    region: null },
]

// General news feeds -- filter by relevance keywords before storing
const GENERAL_FEEDS = [
  { url: 'https://feeds.npr.org/1001/rss.xml',                                         source: 'NPR',     category: 'news',        region: null },
  { url: 'https://feeds.npr.org/1003/rss.xml',                                         source: 'NPR',     category: 'news',        region: null },
  { url: 'https://feeds.npr.org/1057/rss.xml',                                         source: 'NPR',     category: 'environment', region: null },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines',                           source: 'PBS',     category: 'news',        region: null },
  { url: 'https://rss.app/feeds/tXH0tNNUMF9KRbHH.xml',                                source: 'Reuters', category: 'news',        region: null },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml',                              source: 'Sky News', category: 'news',       region: null },
  { url: 'https://feeds.skynews.com/feeds/rss/us.xml',                                 source: 'Sky News', category: 'news',       region: 'US' },
]

const RELEVANCE_KEYWORDS = [
  'earthquake', 'quake', 'seismic', 'tsunami', 'hurricane', 'typhoon', 'cyclone',
  'tornado', 'flood', 'flooding', 'wildfire', 'fire', 'volcano', 'eruption',
  'storm', 'blizzard', 'drought', 'heat wave', 'heatwave', 'landslide', 'avalanche',
  'emergency', 'disaster', 'evacuation', 'evacuate', 'shelter in place', 'shelter-in-place',
  'power outage', 'blackout', 'grid', 'infrastructure failure', 'infrastructure',
  'hazmat', 'chemical spill', 'chemical', 'explosion', 'radiation', 'nuclear', 'contamination',
  'air quality', 'aqi', 'smoke', 'ash',
  'warning', 'watch', 'advisory', 'alert', 'declaration',
  'fema', 'national guard', 'state of emergency', 'martial law',
  'epidemic', 'pandemic', 'outbreak', 'disease', 'virus',
  'preparedness', 'prepper', 'survival', 'shtf', 'bug out',
  'water supply', 'food supply', 'supply chain',
  'civil unrest', 'unrest', 'conflict', 'riot', 'protest', 'curfew',
  'famine', 'crisis', 'blackout',
]

function isRelevant(title, summary) {
  const text = `${title ?? ''} ${summary ?? ''}`.toLowerCase()
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw))
}

async function storeFeedItem(item, feed, skipFilter = false) {
  if (!item.title || !item.link) return 0
  const title = item.title.trim()
  const summary = item.contentSnippet?.trim() || item.summary?.trim() || null
  if (!skipFilter && !isRelevant(title, summary)) return 0

  const { rowCount } = await pool.query(`
    INSERT INTO news_items (source, title, url, summary, category, region, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (url) WHERE url IS NOT NULL DO NOTHING
  `, [
    feed.source,
    title,
    item.link,
    summary,
    feed.category,
    feed.region,
    item.pubDate ? new Date(item.pubDate).toISOString() : null,
  ])
  return rowCount
}

export async function fetchNews() {
  let totalStored = 0
  let feedCount = 0

  for (const feed of DEDICATED_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url)
      for (const item of result.items) {
        totalStored += await storeFeedItem(item, feed, true)
      }
      feedCount++
    } catch (err) {
      // silently skip unavailable feeds
    }
  }

  for (const feed of GENERAL_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url)
      for (const item of result.items) {
        totalStored += await storeFeedItem(item, feed, false)
      }
      feedCount++
    } catch (err) {
      // silently skip unavailable feeds
    }
  }

  console.log(`News: ${totalStored} new items across ${feedCount} feeds`)
}
