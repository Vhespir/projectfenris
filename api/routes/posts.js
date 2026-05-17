import { emitToChannel } from '../lib/socket.js'

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

export async function postRoutes(app, { pool }) {
  // List posts
  app.get('/posts', async (req) => {
    const { type, category, sort = 'recent', limit = 50, offset = 0 } = req.query
    let query = `
      SELECT p.id, p.post_type, p.category, p.title, p.body,
             p.location_label, p.latitude, p.longitude,
             p.upvote_count, p.downvote_count, p.created_at, p.updated_at,
             u.username, u.reputation, u.is_trusted,
             (u.id <= 100) AS is_founding_member
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.is_removed = FALSE
    `
    const params = []
    if (type) { params.push(type); query += ` AND p.post_type = $${params.length}` }
    if (category) { params.push(category); query += ` AND p.category = $${params.length}` }
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
      SELECT p.id, p.post_type, p.category, p.title, p.body,
             p.location_label, p.latitude, p.longitude,
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
  app.post('/posts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { post_type, category, title, body, location_label, latitude, longitude } = req.body ?? {}

    if (!post_type || !category || !title || !body) {
      return reply.code(400).send({ error: 'post_type, category, title, and body are required' })
    }

    const validTypes = ['community', 'field_report', 'self_reported_news']
    if (!validTypes.includes(post_type)) {
      return reply.code(400).send({ error: 'Invalid post_type' })
    }
    if (title.trim().length > 200) {
      return reply.code(400).send({ error: 'Title must be 200 characters or fewer' })
    }
    if (body.trim().length > 10000) {
      return reply.code(400).send({ error: 'Body must be 10,000 characters or fewer' })
    }

    const lat = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : null
    const lon = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : null
    if ((lat !== null && isNaN(lat)) || (lon !== null && isNaN(lon))) {
      return reply.code(400).send({ error: 'Invalid latitude or longitude' })
    }

    const { rows } = await pool.query(`
      INSERT INTO posts (user_id, post_type, category, title, body, location_label, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, post_type, category, title, body, location_label, latitude, longitude,
                upvote_count, created_at
    `, [req.user.id, post_type, category, title.trim(), body.trim(),
        location_label || null, lat, lon])

    const channelId = post_type === 'field_report' ? 'field'
      : post_type === 'self_reported_news' ? 'news'
      : (CATEGORY_TO_CHANNEL[category] ?? 'general')
    emitToChannel(channelId, 'new_post', rows[0])
    emitToChannel('all', 'new_post', rows[0])

    return reply.code(201).send(rows[0])
  })

  // Edit post (author only)
  app.patch('/posts/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const { title, body } = req.body ?? {}
    if (!title?.trim() && !body?.trim()) {
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

    const { rows: updated } = await pool.query(`
      UPDATE posts SET
        title = COALESCE($1, title),
        body  = COALESCE($2, body),
        updated_at = NOW()
      WHERE id = $3
      RETURNING id, title, body, updated_at
    `, [title?.trim() ?? null, body?.trim() ?? null, postId])
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
