export async function refRoutes(app, { pool }) {
  // Resolve a slug to its event, news, guide, or AAR (used by PostBody ref cards)
  app.get('/refs/lookup', async (req, reply) => {
    const slug = String(req.query.slug ?? '').toUpperCase().trim()
    const typeHint = req.query.type ? String(req.query.type).toLowerCase() : null
    if (!slug) return reply.code(400).send({ error: 'slug required' })

    const checks = typeHint
      ? [typeHint]
      : ['event', 'news', 'guide', 'aar']

    for (const t of checks) {
      if (t === 'event') {
        const r = await pool.query(
          `SELECT id, 'event' AS type, slug, title, severity, source, event_type,
                  fetched_at, starts_at, expires_at, properties
           FROM disaster_events WHERE slug = $1`, [slug])
        if (r.rows.length) return r.rows[0]
      }
      if (t === 'news') {
        const r = await pool.query(
          `SELECT id, 'news' AS type, slug, title, source, category, url, published_at
           FROM news_items WHERE slug = $1`, [slug])
        if (r.rows.length) return r.rows[0]
      }
      if (t === 'guide') {
        const r = await pool.query(
          `SELECT g.id, 'guide' AS type, g.slug, g.title, g.category, g.signal_count, g.created_at,
                  u.username AS author
           FROM guides g JOIN users u ON u.id = g.user_id
           WHERE g.slug = $1`, [slug])
        if (r.rows.length) return r.rows[0]
      }
      if (t === 'aar') {
        const r = await pool.query(
          `SELECT p.id, 'aar' AS type, p.slug, p.title, p.incident_type, p.created_at,
                  u.username AS author
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.slug = $1 AND p.post_type = 'aar' AND p.is_removed = FALSE`, [slug])
        if (r.rows.length) return r.rows[0]
      }
    }

    return reply.code(404).send({ error: 'not found' })
  })

  // Autocomplete search for # references (events, news, guides, AARs)
  app.get('/refs/search', async (req, reply) => {
    const q = String(req.query.q ?? '').trim()
    if (!q || q.length < 1) return []

    const slugPat  = `%${q.toUpperCase()}%`
    const titlePat = `%${q}%`

    const [evRes, nwRes, guideRes] = await Promise.all([
      pool.query(
        `SELECT id, 'event' AS type, slug, title, severity, source
         FROM disaster_events
         WHERE (slug ILIKE $1 OR title ILIKE $2)
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY (slug ILIKE $1) DESC, fetched_at DESC
         LIMIT 4`,
        [slugPat, titlePat]
      ),
      pool.query(
        `SELECT id, 'news' AS type, slug, title, source, category
         FROM news_items
         WHERE slug ILIKE $1 OR title ILIKE $2
         ORDER BY (slug ILIKE $1) DESC, published_at DESC NULLS LAST
         LIMIT 3`,
        [slugPat, titlePat]
      ),
      pool.query(
        `SELECT g.id, 'guide' AS type, g.slug, g.title, g.category
         FROM guides g
         WHERE g.slug ILIKE $1 OR g.title ILIKE $2
         ORDER BY (g.slug ILIKE $1) DESC, g.signal_count DESC
         LIMIT 2`,
        [slugPat, titlePat]
      ),
    ])

    return [...evRes.rows, ...nwRes.rows, ...guideRes.rows]
  })
}
