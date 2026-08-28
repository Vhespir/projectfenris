// The canonical catalog of subscribable feed sources: every distinct value
// that shows up in news_items.source or disaster_events.source, grouped
// for a browse-and-subscribe UI (RSS-reader style) instead of the old
// coarse show/hide-everything toggles. Defined once here rather than
// duplicated in the frontend, since new sources only ever get added in
// worker/fetchers/, this is the one place that needs updating alongside
// a new fetcher.
//
// id is what actually gets stored in a user's preferences.feedSources and
// sent back as a query param; table says which endpoint it filters
// (news_items.source or disaster_events.source), and value is the exact
// string stored in that column, news_items sources are the display-case
// names the RSS fetchers use ('USGS'), disaster_events sources are the
// lowercase identifiers the dedicated fetchers use ('usgs'), same
// organization can legitimately appear as both: USGS's own news feed vs
// USGS's structured earthquake data are genuinely different content.
const s = (id, label, table, value, defaultSubscribed = false) => ({ id, label, table, value, defaultSubscribed })

export const FEED_SOURCE_GROUPS = [
  {
    label: 'Weather & Storms',
    sources: [
      s('event:noaa', 'NWS Weather Alerts', 'event', 'noaa', true),
      s('event:meteoalarm', 'MeteoAlarm (Europe)', 'event', 'meteoalarm', true),
      s('news:NHC', 'National Hurricane Center', 'news', 'NHC', true),
      s('news:PTWC', 'Pacific Tsunami Warning Center', 'news', 'PTWC', true),
    ],
  },
  {
    label: 'Seismic & Global Disasters',
    sources: [
      s('event:usgs', 'USGS Earthquakes', 'event', 'usgs', true),
      s('news:USGS', 'USGS News', 'news', 'USGS', false),
      s('event:gdacs', 'GDACS Global Disasters', 'event', 'gdacs', true),
      s('news:GDACS', 'GDACS News', 'news', 'GDACS', false),
      s('event:eonet', 'NASA EONET', 'event', 'eonet', true),
    ],
  },
  {
    label: 'Government & Emergency Management',
    sources: [
      s('news:FEMA', 'FEMA', 'news', 'FEMA', true),
      s('news:DHS', 'DHS', 'news', 'DHS', false),
      s('news:CISA-KEV', 'CISA (Exploited Vulnerabilities)', 'news', 'CISA-KEV', false),
      s('news:PHMSA', 'PHMSA (Pipeline Safety)', 'news', 'PHMSA', false),
      s('news:NRC', 'NRC (Nuclear Regulatory)', 'news', 'NRC', false),
      s('news:IAEA', 'IAEA (Nuclear, Global)', 'news', 'IAEA', false),
      s('news:FDA', 'FDA Recalls', 'news', 'FDA', true),
      s('news:FCDO', 'UK Foreign Travel Advice', 'news', 'FCDO', false),
    ],
  },
  {
    label: 'Health',
    sources: [
      s('news:CDC', 'CDC', 'news', 'CDC', true),
    ],
  },
  {
    label: 'Security & Global Patterns',
    sources: [
      s('news:FBI', 'FBI', 'news', 'FBI', false),
      s('news:UN', 'United Nations', 'news', 'UN', false),
      s('news:GDELT', 'GDELT Global News Monitor', 'news', 'GDELT', false),
    ],
  },
  {
    label: 'Financial',
    sources: [
      s('news:Federal Reserve', 'Federal Reserve', 'news', 'Federal Reserve', false),
      s('news:USDA Market News', 'USDA Market News', 'news', 'USDA Market News', false),
    ],
  },
  {
    label: 'Environmental',
    sources: [
      s('event:epa', 'EPA Air Quality', 'event', 'epa', true),
    ],
  },
  {
    label: 'General Wire News',
    sources: [
      s('news:BBC', 'BBC', 'news', 'BBC', false),
      s('news:Al Jazeera', 'Al Jazeera', 'news', 'Al Jazeera', false),
      s('news:NPR', 'NPR', 'news', 'NPR', false),
      s('news:PBS', 'PBS', 'news', 'PBS', false),
      s('news:Sky News', 'Sky News', 'news', 'Sky News', false),
    ],
  },
  {
    label: 'Ham Radio',
    sources: [
      s('news:ARRL', 'ARRL', 'news', 'ARRL', false),
    ],
  },
  {
    label: 'Prepper & Homesteading Blogs',
    sources: [
      s('news:Ask a Prepper', 'Ask a Prepper', 'news', 'Ask a Prepper', false),
      s('news:Modern Survival Blog', 'Modern Survival Blog', 'news', 'Modern Survival Blog', false),
      s('news:Off Grid Web', 'Off Grid Web', 'news', 'Off Grid Web', false),
      s('news:SHTF Preparedness', 'SHTF Preparedness', 'news', 'SHTF Preparedness', false),
      s('news:SHTFplan', 'SHTFplan', 'news', 'SHTFplan', false),
      s('news:Survival Blog', 'Survival Blog', 'news', 'Survival Blog', false),
      s('news:Survivopedia', 'Survivopedia', 'news', 'Survivopedia', false),
      s('news:The Organic Prepper', 'The Organic Prepper', 'news', 'The Organic Prepper', false),
    ],
  },
]

export const ALL_FEED_SOURCES = FEED_SOURCE_GROUPS.flatMap(g => g.sources)
export const DEFAULT_FEED_SOURCE_IDS = ALL_FEED_SOURCES.filter(x => x.defaultSubscribed).map(x => x.id)

// Turns a user's subscribed source ids into the actual column values each
// endpoint needs, ?sources=usgs,gdacs for /events and ?source=USGS,GDACS
// for /news. Falls back to the defaults for ids that don't resolve
// (a stale id from a source that's since been removed from the catalog is
// just dropped, not an error).
export function resolveSubscribedValues(ids, table) {
  const wanted = new Set(ids)
  return ALL_FEED_SOURCES.filter(x => x.table === table && wanted.has(x.id)).map(x => x.value)
}
