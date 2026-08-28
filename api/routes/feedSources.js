import { FEED_SOURCE_GROUPS, DEFAULT_FEED_SOURCE_IDS } from '../lib/feedSources.js'

export async function feedSourceRoutes(app) {
  // Public: the catalog itself isn't user data, just what's available to
  // subscribe to. No auth needed to look at the list.
  app.get('/feed-sources', async () => {
    return { groups: FEED_SOURCE_GROUPS, defaultIds: DEFAULT_FEED_SOURCE_IDS }
  })
}
