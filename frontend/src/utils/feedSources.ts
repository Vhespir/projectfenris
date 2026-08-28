// Mirrors api/lib/feedSources.js's shape. The catalog itself is fetched
// from /api/feed-sources (single source of truth lives server-side), this
// file just has the types and the query-param-building logic shared by
// the Dashboard and Map pages.

export interface FeedSource {
  id: string
  label: string
  table: 'news' | 'event'
  value: string
  defaultSubscribed: boolean
}

export interface FeedSourceGroup {
  label: string
  sources: FeedSource[]
}

export interface FeedSourceCatalog {
  groups: FeedSourceGroup[]
  defaultIds: string[]
}

export async function fetchFeedSourceCatalog(): Promise<FeedSourceCatalog> {
  const res = await fetch('/api/feed-sources')
  if (!res.ok) return { groups: [], defaultIds: [] }
  return res.json()
}

// A user who's never touched the setting gets the curated defaults, not
// an empty feed and not all 37 sources firehosed at once.
export function subscribedSourceIds(preferences: Record<string, unknown> | undefined, catalog: FeedSourceCatalog): string[] {
  const saved = preferences?.feedSources
  if (Array.isArray(saved)) return saved as string[]
  return catalog.defaultIds
}

// Turns subscribed ids + the catalog into the actual comma-separated
// values each endpoint's ?source=/?sources= param expects.
export function sourceQueryValues(ids: string[], catalog: FeedSourceCatalog, table: 'news' | 'event'): string[] {
  const wanted = new Set(ids)
  const all = catalog.groups.flatMap(g => g.sources)
  return all.filter(s => s.table === table && wanted.has(s.id)).map(s => s.value)
}
