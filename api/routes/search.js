export async function searchRoutes(app, { pool }) {
  app.get('/search', async (req, reply) => {
    const q = String(req.query.q ?? '').trim()
    if (!q || q.length < 2) return reply.code(400).send({ error: 'Query must be at least 2 characters' })

    const tsq = q
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .join(' & ')

    if (!tsq) return reply.code(400).send({ error: 'Invalid query' })

    const [postsRes, guidesRes, eventsRes, newsRes, usersRes] = await Promise.allSettled([
      pool.query(`
        SELECT
          p.id, 'post' AS type, p.post_type, p.category, p.title,
          LEFT(p.body, 200) AS snippet,
          p.upvote_count, p.created_at,
          u.username,
          ts_rank(to_tsvector('english', p.title || ' ' || p.body), query) AS rank
        FROM posts p
        LEFT JOIN users u ON u.id = p.user_id,
        to_tsquery('english', $1) query
        WHERE p.is_removed = FALSE
          AND to_tsvector('english', p.title || ' ' || p.body) @@ query
        ORDER BY rank DESC, p.created_at DESC
        LIMIT 10
      `, [tsq]),

      pool.query(`
        SELECT
          g.id, 'guide' AS type, g.category, g.title,
          LEFT(g.body, 200) AS snippet,
          g.signal_count, g.created_at,
          u.username,
          ts_rank(to_tsvector('english', g.title || ' ' || g.body), query) AS rank
        FROM guides g
        LEFT JOIN users u ON u.id = g.user_id,
        to_tsquery('english', $1) query
        WHERE g.is_removed = FALSE
          AND to_tsvector('english', g.title || ' ' || g.body) @@ query
        ORDER BY rank DESC, g.signal_count DESC
        LIMIT 10
      `, [tsq]),

      pool.query(`
        SELECT
          e.id, 'event' AS type, e.source, e.event_type, e.title, e.severity,
          e.starts_at, e.expires_at, e.fetched_at,
          ts_rank(to_tsvector('english', e.title || ' ' || e.event_type), query) AS rank
        FROM disaster_events e,
        to_tsquery('english', $1) query
        WHERE to_tsvector('english', e.title || ' ' || e.event_type) @@ query
          AND (e.expires_at IS NULL OR e.expires_at > NOW())
        ORDER BY rank DESC, e.fetched_at DESC
        LIMIT 10
      `, [tsq]),

      pool.query(`
        SELECT
          n.id, 'news' AS type, n.source, n.title, n.url,
          LEFT(coalesce(n.summary, ''), 200) AS snippet,
          n.category, n.published_at,
          ts_rank(to_tsvector('english', n.title || ' ' || coalesce(n.summary, '')), query) AS rank
        FROM news_items n,
        to_tsquery('english', $1) query
        WHERE to_tsvector('english', n.title || ' ' || coalesce(n.summary, '')) @@ query
        ORDER BY rank DESC, n.published_at DESC NULLS LAST
        LIMIT 10
      `, [tsq]),

      pool.query(`
        SELECT id, username, avatar_url, bio, prep_level, is_trusted, created_at
        FROM users
        WHERE username ILIKE $1 OR bio ILIKE $1
        ORDER BY
          CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,
          username ASC
        LIMIT 8
      `, [`%${q}%`, `${q}%`]),
    ])

    return {
      query: q,
      posts:  postsRes.status  === 'fulfilled' ? postsRes.value.rows  : [],
      guides: guidesRes.status === 'fulfilled' ? guidesRes.value.rows : [],
      events: eventsRes.status === 'fulfilled' ? eventsRes.value.rows : [],
      news:   newsRes.status   === 'fulfilled' ? newsRes.value.rows   : [],
      users:  usersRes.status  === 'fulfilled' ? usersRes.value.rows  : [],
    }
  })
}
