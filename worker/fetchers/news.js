import Parser from 'rss-parser'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const parser = new Parser({ timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FenrisBot/1.0)' } })

// Dedicated emergency/disaster feeds -- always relevant, no filtering needed
const DEDICATED_FEEDS = [
  { url: 'https://www.nhc.noaa.gov/nhc_at1.xml',                                       source: 'NHC',        category: 'hurricane',     region: 'Atlantic' },
  { url: 'https://www.nhc.noaa.gov/nhc_ep1.xml',                                       source: 'NHC',        category: 'hurricane',     region: 'Eastern Pacific' },
  { url: 'https://www.nhc.noaa.gov/nhc_cp1.xml',                                       source: 'NHC',        category: 'hurricane',     region: 'Central Pacific' },
  { url: 'https://tsunami.gov/events/xml/PAAQAtom.xml',                                source: 'PTWC',       category: 'tsunami',       region: null },
  { url: 'https://emergency.cdc.gov/han/rss_feed.asp',                                 source: 'CDC',        category: 'health',        region: null },
  { url: 'https://emergency.cdc.gov/rss/index.asp',                                   source: 'CDC',        category: 'health',        region: null },
  { url: 'https://tools.cdc.gov/api/v2/resources/media/132608.rss',                    source: 'CDC',        category: 'health',        region: null },
  { url: 'https://www.cdc.gov/rss/outbreaks.xml',                                      source: 'CDC',        category: 'health',        region: null },
  { url: 'https://www.aphis.usda.gov/aphis/newsroom/news/rss',                         source: 'USDA APHIS', category: 'health',        region: null },
  { url: 'https://promedmail.org/feed/',                                                source: 'ProMED',     category: 'health',        region: null },
  { url: 'https://www.usgs.gov/news/all-news/feed',                                    source: 'USGS',       category: 'science',       region: null },
  { url: 'https://www.fema.gov/about/news-multimedia/news/feed',                       source: 'FEMA',       category: 'emergency',     region: null },
  { url: 'https://www.fema.gov/feeds/news-releases.xml',                               source: 'FEMA',       category: 'emergency',     region: null },
  { url: 'https://www.gdacs.org/xml/rss.xml',                                          source: 'GDACS',      category: 'emergency',     region: null },
  { url: 'https://www.dhs.gov/news/rss.xml',                                           source: 'DHS',        category: 'emergency',     region: null },
  { url: 'https://www.cisa.gov/cybersecurity-advisories/alerts.xml',                   source: 'CISA',       category: 'cybersecurity', region: null },
  { url: 'https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml', source: 'CISA',       category: 'cybersecurity', region: null },
  { url: 'https://www.phmsa.dot.gov/news/rss.xml',                                     source: 'PHMSA',      category: 'infrastructure', region: null },
  { url: 'https://www.nrc.gov/public-involve/listserver-subscription/news-rss.xml',    source: 'NRC',        category: 'nuclear',       region: null },
  { url: 'https://www.iaea.org/newscenter/news/rss',                                   source: 'IAEA',       category: 'nuclear',       region: null },
  { url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml', source: 'FDA',   category: 'recall',        region: null },
  { url: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml',                        source: 'WHO',        category: 'health',        region: null },
  { url: 'https://www.gov.uk/foreign-travel-advice.atom',                               source: 'FCDO',       category: 'travel',        region: null },
  { url: 'https://www.arrl.org/news/rss',                                               source: 'ARRL',       category: 'comms',         region: null },
  { url: 'https://www.epa.gov/rss/epa-newsroom.xml',                                   source: 'EPA',        category: 'environment',   region: null },
  { url: 'https://kb.cert.org/vuls/bypublished/rss/',                                   source: 'CERT/CC',    category: 'cybersecurity', region: null },
]

// General news feeds -- filter by relevance keywords before storing
const GENERAL_FEEDS = [
  { url: 'https://feeds.npr.org/1001/rss.xml',                    source: 'NPR',                    category: 'news',          region: null },
  { url: 'https://feeds.npr.org/1003/rss.xml',                    source: 'NPR',                    category: 'news',          region: null },
  { url: 'https://feeds.npr.org/1057/rss.xml',                    source: 'NPR',                    category: 'environment',   region: null },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines',      source: 'PBS',                    category: 'news',          region: null },
  { url: 'https://rss.app/feeds/tXH0tNNUMF9KRbHH.xml',           source: 'Reuters',                category: 'news',          region: null },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml',         source: 'Sky News',               category: 'news',          region: null },
  { url: 'https://feeds.skynews.com/feeds/rss/us.xml',            source: 'Sky News',               category: 'news',          region: 'US' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',           source: 'BBC',                    category: 'news',          region: null },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC',            category: 'environment',   region: null },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml',             source: 'Al Jazeera',             category: 'news',          region: null },
  { url: 'https://www.un.org/press/en/rss.xml',                   source: 'UN',                     category: 'geopolitical',  region: null },
  { url: 'https://www.nato.int/rss.xml',                          source: 'NATO',                   category: 'geopolitical',  region: null },
  { url: 'https://modernsurvivalblog.com/feed/',                   source: 'Modern Survival Blog',   category: 'preparedness',  region: null },
  { url: 'https://askaprepper.com/feed/',                          source: 'Ask a Prepper',          category: 'preparedness',  region: null },
  { url: 'https://www.prepperwebsite.com/feed/',                   source: 'Prepper Website',        category: 'preparedness',  region: null },
  { url: 'https://www.shtfplan.com/feed/',                         source: 'SHTFplan',               category: 'preparedness',  region: null },
  { url: 'https://www.theorganicprepper.com/feed/',                source: 'The Organic Prepper',    category: 'preparedness',  region: null },
  { url: 'https://www.backdoorsurvival.com/feed/',                 source: 'Backdoor Survival',      category: 'preparedness',  region: null },
  { url: 'https://www.offgridweb.com/feed/',                       source: 'Off Grid Web',           category: 'preparedness',  region: null },
  { url: 'https://survivopedia.com/feed/',                         source: 'Survivopedia',           category: 'preparedness',  region: null },
  { url: 'https://graywolfsurvival.com/feed/',                     source: 'Gray Wolf Survival',     category: 'preparedness',  region: null },
  { url: 'https://survivalblog.com/feed/',                         source: 'Survival Blog',          category: 'preparedness',  region: null },
  { url: 'https://shtfpreparedness.com/feed/',                     source: 'SHTF Preparedness',      category: 'preparedness',  region: null },
  { url: 'https://www.prepared.org/feed/',                         source: 'Prepared',               category: 'preparedness',  region: null },
  { url: 'https://www.fbi.gov/feeds/fbi-in-the-news/rss.xml',     source: 'FBI',                    category: 'security',      region: null },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml',    source: 'Federal Reserve',        category: 'financial',     region: null },
  { url: 'https://www.ams.usda.gov/market-news/rss',              source: 'USDA Market News',       category: 'financial',     region: null },
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
  'epidemic', 'pandemic', 'outbreak', 'disease', 'virus', 'pathogen',
  'preparedness', 'prepper', 'survival', 'shtf', 'bug out', 'bugging out', 'bug in',
  'water supply', 'food supply', 'supply chain', 'food storage', 'water storage',
  'civil unrest', 'unrest', 'conflict', 'riot', 'protest', 'curfew',
  'famine', 'crisis', 'blackout',
  'solar flare', 'geomagnetic', 'solar storm', 'aurora', 'cme', 'coronal mass',
  'space weather', 'emp', 'electromagnetic pulse', 'kp index',
  'ham radio', 'amateur radio', 'grid down', 'off grid', 'off-grid',
  'homestead', 'homesteading', 'self sufficient', 'self-sufficient',
  'pipeline', 'cyberattack', 'cyber attack', 'ransomware', 'infrastructure attack',
  'recall', 'contaminated', 'food safety', 'e. coli', 'salmonella', 'listeria',
  'bird flu', 'h5n1', 'avian flu', 'avian influenza', 'mpox', 'monkeypox',
  'norovirus', 'hepatitis', 'cholera', 'plague', 'anthrax', 'botulism',
  'bank failure', 'bank collapse', 'recession', 'inflation', 'interest rate',
  'federal reserve', 'economic crisis', 'gold price', 'silver price', 'precious metal',
  'commodity', 'food price', 'oil price', 'fdic', 'hyperinflation', 'debt crisis',
  'currency collapse', 'stagflation', 'depression', 'bank run',
  'terrorism', 'terror attack', 'active shooter', 'mass casualty', 'hostage',
  'invasion', 'military operation', 'biological weapon', 'chemical weapon', 'dirty bomb',
  'sanctions', 'critical infrastructure', 'vulnerability', 'exploit', 'zero-day', 'malware',
  'water contamination', 'toxic spill', 'superfund', 'fish kill', 'algal bloom',
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
