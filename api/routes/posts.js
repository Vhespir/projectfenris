import { emitToChannel, emitToUser } from '../lib/socket.js'
import { checkMuted } from '../lib/moderation.js'

const CATEGORY_TO_CHANNEL = {
  'Gear and Equipment': 'gear',
  'Food and Water': 'food',
  'Medical and First Aid': 'medical',
  'Communications and Ham Radio': 'comms',
  'Security and Self Defense': 'security',
  'Evacuation and Bugging Out': 'evac',
  'Homesteading and Self Sufficiency': 'homestead',
  'Skills and Training': 'skills',
  'General Discussion': 'general',
}

const AAR_INCIDENT_TYPES = [
  'hurricane', 'earthquake', 'wildfire', 'flood', 'tornado', 'winter_storm',
  'power_outage', 'medical', 'financial', 'civil_unrest', 'evacuation', 'other',
]

const CHANNEL_FILTER_MAP = {
  field:     { type: 'field_report',       category: null },
  news:      { type: 'self_reported_news', category: null },
  aar:       { type: 'aar',                category: null },
  pattern:   { type: 'pattern',            category: null },
  gear:      { type: 'community', category: 'Gear and Equipment' },
  food:      { type: 'community', category: 'Food and Water' },
  medical:   { type: 'community', category: 'Medical and First Aid' },
  comms:     { type: 'community', category: 'Communications and Ham Radio' },
  security:  { type: 'community', category: 'Security and Self Defense' },
  evac:      { type: 'community', category: 'Evacuation and Bugging Out' },
  homestead: { type: 'community', category: 'Homesteading and Self Sufficiency' },
  skills:    { type: 'community', category: 'Skills and Training' },
  general:   { type: 'community', category: 'General Discussion' },
}

export async function postRoutes(app, { pool }) {
  // List posts (supports ?ref=SLUG to filter by cited event/news)
  app.get('/posts', async (req) => {
    const { type, category, channels, sort = 'recent', limit = 50, offset = 0, ref } = req.query
    let query = `
      SELECT p.id, p.post_type, p.category, p.title, p.body, p.slug,
             p.location_label, p.latitude, p.longitude,
             p.incident_type, p.state, p.duration, p.key_takeaway,
             p.upvote_count, p.downvote_count, p.created_at, p.updated_at,
             u.username, u.reputation, u.is_trusted,
             (u.id <= 100) AS is_founding_member
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.is_removed = FALSE
    `
    const params = []

    // Filter to posts that cited a specific event/news slug
    if (ref) {
      const slug = String(ref).toUpperCase().trim()
      query += `
        AND p.id IN (
          SELECT cr.source_id FROM content_references cr
          JOIN disaster_events de ON de.id = cr.target_id AND cr.target_type = 'event' AND de.slug = $${params.length + 1}
          UNION
          SELECT cr.source_id FROM content_references cr
          JOIN news_items ni ON ni.id = cr.target_id AND cr.target_type = 'news' AND ni.slug = $${params.length + 1}
        )
      `
      params.push(slug)
    }

    if (channels) {
      const channelList = String(channels).split(',').map(s => s.trim()).filter(s => CHANNEL_FILTER_MAP[s])
      if (channelList.length > 0) {
        const conditions = channelList.map(ch => {
          const f = CHANNEL_FILTER_MAP[ch]
          return f.category
            ? `(p.post_type = '${f.type}' AND p.category = '${f.category}')`
            : `(p.post_type = '${f.type}')`
        })
        query += ` AND (${conditions.join(' OR ')})`
      }
    } else if (type) {
      params.push(type); query += ` AND p.post_type = $${params.length}`
      if (category) { params.push(category); query += ` AND p.category = $${params.length}` }
    }
    params.push(Math.min(Number(limit), 100))
    params.push(Number(offset))

    const orderBy = sort === 'signal'
      ? `(p.upvote_count - p.downvote_count)::float / POWER(EXTRACT(EPOCH FROM NOW() - p.created_at) / 3600.0 + 2, 1.5) DESC, p.created_at DESC`
      : sort === 'proven'
        ? `p.upvote_count DESC, p.created_at DESC`
        : sort === 'controversial'
          ? `LEAST(p.upvote_count, p.downvote_count)::float / GREATEST(GREATEST(p.upvote_count, p.downvote_count), 1) * (p.upvote_count + p.downvote_count) DESC, p.created_at DESC`
          : `p.created_at DESC`

    query += ` ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`
    const { rows } = await pool.query(query, params)
    return rows
  })

  // Get single post
  app.get('/posts/:id', async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT p.id, p.post_type, p.category, p.title, p.body, p.slug,
             p.location_label, p.latitude, p.longitude,
             p.incident_type, p.state, p.duration,
             p.what_worked, p.what_failed, p.wish_had, p.key_takeaway,
             p.upvote_count, p.downvote_count, p.created_at, p.updated_at,
             u.id AS user_id, u.username, u.reputation, u.is_trusted,
             (u.id <= 100) AS is_founding_member
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.is_removed = FALSE
    `, [req.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' })
    return rows[0]
  })

  // Get current user's vote on a post
  app.get('/posts/:id/myvote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, req.params.id]
    )
    return { vote: rows[0]?.vote ?? null }
  })

  // Create post
  app.post('/posts', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    if (await checkMuted(pool, req.user.id, reply)) return
    const {
      post_type, category, title, body, location_label, latitude, longitude,
      incident_type, state, duration, what_worked, what_failed, wish_had, key_takeaway,
    } = req.body ?? {}

    const validTypes = ['community', 'field_report', 'self_reported_news', 'aar']
    if (!post_type || !validTypes.includes(post_type)) {
      return reply.code(400).send({ error: 'Invalid post_type' })
    }
    if (!title?.trim()) {
      return reply.code(400).send({ error: 'title is required' })
    }
    if (title.trim().length > 200) {
      return reply.code(400).send({ error: 'Title must be 200 characters or fewer' })
    }

    const isAar = post_type === 'aar'
    if (isAar) {
      if (!incident_type || !AAR_INCIDENT_TYPES.includes(incident_type)) {
        return reply.code(400).send({ error: 'A valid incident_type is required for after-action reports' })
      }
      if (!body?.trim()) {
        return reply.code(400).send({ error: 'narrative is required' })
      }
      if (body.trim().length > 20000) {
        return reply.code(400).send({ error: 'Narrative must be 20,000 characters or fewer' })
      }
    } else {
      if (!category || !body?.trim()) {
        return reply.code(400).send({ error: 'post_type, category, title, and body are required' })
      }
      if (body.trim().length > 10000) {
        return reply.code(400).send({ error: 'Body must be 10,000 characters or fewer' })
      }
    }

    const lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null
    const lon = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null
    if ((lat !== null && isNaN(lat)) || (lon !== null && isNaN(lon))) {
      return reply.code(400).send({ error: 'Invalid latitude or longitude' })
    }

    const clean = (arr) => (Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : [])

    const { rows } = await pool.query(`
      INSERT INTO posts (
        user_id, post_type, category, title, body, location_label, latitude, longitude,
        incident_type, state, duration, what_worked, what_failed, wish_had, key_takeaway
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id, post_type, category, title, body, slug, location_label, latitude, longitude,
                incident_type, state, duration, what_worked, what_failed, wish_had, key_takeaway,
                upvote_count, created_at
    `, [
      req.user.id, post_type, isAar ? incident_type : category, title.trim(), body.trim(),
      location_label?.trim() || null, lat, lon,
      isAar ? incident_type : null,
      isAar ? (state?.trim() || null) : null,
      isAar ? (duration?.trim() || null) : null,
      isAar ? clean(what_worked) : [],
      isAar ? clean(what_failed) : [],
      isAar ? clean(wish_had) : [],
      isAar ? (key_takeaway?.trim() || null) : null,
    ])

    const channelId = post_type === 'field_report' ? 'field'
      : post_type === 'self_reported_news' ? 'news'
      : post_type === 'aar' ? 'aar'
      : (CATEGORY_TO_CHANNEL[category] ?? 'general')
    emitToChannel(channelId, 'new_post', rows[0])
    emitToChannel('all', 'new_post', rows[0])

    const postId = rows[0].id
    const bodyText = body.trim()

    // Process @mentions and #slug references asynchronously
    Promise.resolve().then(async () => {
      const mentionPattern = /@([a-zA-Z0-9_]+)/g
      const refPattern = /#([A-Z]+-[A-Z]+(?:-\d+)?)/gi
      const mentions = [...bodyText.matchAll(mentionPattern)].map(m => m[1])
      const slugRefs = [...new Set([...bodyText.matchAll(refPattern)].map(m => m[1].toUpperCase()))]

      // @mention notifications
      for (const username of [...new Set(mentions)]) {
        try {
          const uRes = await pool.query('SELECT id FROM users WHERE username = $1', [username])
          if (!uRes.rows.length) continue
          const mentionedId = uRes.rows[0].id
          if (mentionedId === req.user.id) continue
          const msg = `@${req.user.username} mentioned you in a post`
          await pool.query(
            `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'mention', $2, $3)
             ON CONFLICT DO NOTHING`,
            [mentionedId, msg, `/post/${postId}`]
          )
          emitToUser(mentionedId, 'notification', { message: msg, link: `/post/${postId}` })
        } catch {}
      }

      // #slug content references
      for (const slug of slugRefs) {
        try {
          const evRes = await pool.query('SELECT id FROM disaster_events WHERE slug = $1', [slug])
          if (evRes.rows.length) {
            await pool.query(
              `INSERT INTO content_references (source_type, source_id, target_type, target_id)
               VALUES ('post', $1, 'event', $2) ON CONFLICT DO NOTHING`,
              [postId, evRes.rows[0].id]
            )
            continue
          }
          const nwRes = await pool.query('SELECT id FROM news_items WHERE slug = $1', [slug])
          if (nwRes.rows.length) {
            await pool.query(
              `INSERT INTO content_references (source_type, source_id, target_type, target_id)
               VALUES ('post', $1, 'news', $2) ON CONFLICT DO NOTHING`,
              [postId, nwRes.rows[0].id]
            )
          }
        } catch {}
      }
    }).catch(() => {})

    return reply.code(201).send(rows[0])
  })

  // Edit post (author only)
  app.patch('/posts/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const {
      title, body, location_label, state, duration,
      what_worked, what_failed, wish_had, key_takeaway,
    } = req.body ?? {}
    const nothingToUpdate = [title, body, location_label, state, duration, key_takeaway].every(v => !v?.trim?.())
      && what_worked === undefined && what_failed === undefined && wish_had === undefined
    if (nothingToUpdate) {
      return reply.code(400).send({ error: 'Nothing to update' })
    }
    if (title && title.trim().length > 200) {
      return reply.code(400).send({ error: 'Title must be 200 characters or fewer' })
    }
    if (body && body.trim().length > 10000) {
      return reply.code(400).send({ error: 'Body must be 10,000 characters or fewer' })
    }

    const { rows } = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND is_removed = FALSE', [postId])
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })

    const clean = (arr) => arr !== undefined
      ? (Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : [])
      : null

    const { rows: updated } = await pool.query(`
      UPDATE posts SET
        title          = COALESCE($1, title),
        body           = COALESCE($2, body),
        location_label = COALESCE($3, location_label),
        state          = COALESCE($4, state),
        duration       = COALESCE($5, duration),
        what_worked    = COALESCE($6, what_worked),
        what_failed    = COALESCE($7, what_failed),
        wish_had       = COALESCE($8, wish_had),
        key_takeaway   = COALESCE($9, key_takeaway),
        updated_at     = NOW()
      WHERE id = $10
      RETURNING id, title, body, location_label, state, duration,
                what_worked, what_failed, wish_had, key_takeaway, updated_at
    `, [
      title?.trim() || null, body?.trim() || null,
      location_label?.trim() || null, state?.trim() || null, duration?.trim() || null,
      clean(what_worked), clean(what_failed), clean(wish_had),
      key_takeaway?.trim() || null, postId,
    ])
    return updated[0]
  })

  // Toggle upvote (mutual exclusion with downvote)
  app.post('/posts/:id/upvote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const { rows: post } = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND is_removed = FALSE', [postId])
    if (!post[0]) return reply.code(404).send({ error: 'Post not found' })

    const { rows: prev } = await pool.query(
      'SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    )
    const oldVote = prev[0]?.vote ?? null
    const authorId = post[0].user_id

    if (oldVote === 'up') {
      // Remove upvote (toggle off)
      await pool.query('DELETE FROM post_votes WHERE user_id = $1 AND post_id = $2', [req.user.id, postId])
      await pool.query('UPDATE posts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 1, 0) WHERE id = $1', [authorId])
    } else if (oldVote === 'down') {
      // Switch from downvote to upvote
      await pool.query('UPDATE post_votes SET vote = $1 WHERE user_id = $2 AND post_id = $3', ['up', req.user.id, postId])
      await pool.query('UPDATE posts SET upvote_count = upvote_count + 1, downvote_count = GREATEST(downvote_count - 1, 0) WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = reputation + 2 WHERE id = $1', [authorId])
    } else {
      // New upvote
      await pool.query('INSERT INTO post_votes (user_id, post_id, vote) VALUES ($1, $2, $3)', [req.user.id, postId, 'up'])
      await pool.query('UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [authorId])
    }

    const { rows } = await pool.query('SELECT upvote_count, downvote_count FROM posts WHERE id = $1', [postId])
    return { vote: oldVote === 'up' ? null : 'up', ...rows[0] }
  })

  // Toggle downvote (mutual exclusion with upvote)
  app.post('/posts/:id/downvote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const { rows: post } = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND is_removed = FALSE', [postId])
    if (!post[0]) return reply.code(404).send({ error: 'Post not found' })

    const { rows: prev } = await pool.query(
      'SELECT vote FROM post_votes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    )
    const oldVote = prev[0]?.vote ?? null
    const authorId = post[0].user_id

    if (oldVote === 'down') {
      // Remove downvote (toggle off)
      await pool.query('DELETE FROM post_votes WHERE user_id = $1 AND post_id = $2', [req.user.id, postId])
      await pool.query('UPDATE posts SET downvote_count = GREATEST(downvote_count - 1, 0) WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [authorId])
    } else if (oldVote === 'up') {
      // Switch from upvote to downvote
      await pool.query('UPDATE post_votes SET vote = $1 WHERE user_id = $2 AND post_id = $3', ['down', req.user.id, postId])
      await pool.query('UPDATE posts SET downvote_count = downvote_count + 1, upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 2, 0) WHERE id = $1', [authorId])
    } else {
      // New downvote
      await pool.query('INSERT INTO post_votes (user_id, post_id, vote) VALUES ($1, $2, $3)', [req.user.id, postId, 'down'])
      await pool.query('UPDATE posts SET downvote_count = downvote_count + 1 WHERE id = $1', [postId])
      if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 1, 0) WHERE id = $1', [authorId])
    }

    const { rows } = await pool.query('SELECT upvote_count, downvote_count FROM posts WHERE id = $1', [postId])
    return { vote: oldVote === 'down' ? null : 'down', ...rows[0] }
  })

  // Remove post (author or moderator)
  app.delete('/posts/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM posts WHERE id = $1 AND is_removed = FALSE', [postId])
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' })
    const isOwner = rows[0].user_id === req.user.id
    const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    const isMod = u[0]?.is_moderator ?? false
    if (!isOwner && !isMod) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('UPDATE posts SET is_removed = TRUE WHERE id = $1', [postId])
    return { removed: true }
  })
}
