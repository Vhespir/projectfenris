export async function postRoutes(app, { pool }) {
  // List posts
  app.get('/posts', async (req) => {
    const { type, category, limit = 50, offset = 0 } = req.query
    let query = `
      SELECT p.id, p.post_type, p.category, p.title, p.body,
             p.location_label, p.latitude, p.longitude,
             p.upvote_count, p.created_at, p.updated_at,
             u.username, u.reputation, u.is_trusted
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.is_removed = FALSE
    `
    const params = []
    if (type) { params.push(type); query += ` AND p.post_type = $${params.length}` }
    if (category) { params.push(category); query += ` AND p.category = $${params.length}` }
    params.push(Math.min(Number(limit), 100))
    params.push(Number(offset))
    query += ` ORDER BY p.upvote_count DESC, p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`
    const { rows } = await pool.query(query, params)
    return rows
  })

  // Get single post
  app.get('/posts/:id', async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT p.id, p.post_type, p.category, p.title, p.body,
             p.location_label, p.latitude, p.longitude,
             p.upvote_count, p.created_at, p.updated_at,
             u.username, u.reputation, u.is_trusted
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND p.is_removed = FALSE
    `, [req.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Post not found' })
    return rows[0]
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

    const { rows } = await pool.query(`
      INSERT INTO posts (user_id, post_type, category, title, body, location_label, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, post_type, category, title, body, location_label, latitude, longitude,
                upvote_count, created_at
    `, [req.user.id, post_type, category, title.trim(), body.trim(),
        location_label || null, latitude || null, longitude || null])

    return reply.code(201).send(rows[0])
  })

  // Upvote
  app.post('/posts/:id/upvote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)

    try {
      await pool.query(
        'INSERT INTO upvotes (user_id, post_id) VALUES ($1, $2)',
        [req.user.id, postId]
      )
      await pool.query(
        'UPDATE posts SET upvote_count = upvote_count + 1 WHERE id = $1',
        [postId]
      )
      return { upvoted: true }
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Already upvoted' })
      if (err.code === '23503') return reply.code(404).send({ error: 'Post not found' })
      throw err
    }
  })

  // Remove upvote
  app.delete('/posts/:id/upvote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const postId = Number(req.params.id)
    const { rowCount } = await pool.query(
      'DELETE FROM upvotes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Upvote not found' })
    await pool.query('UPDATE posts SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [postId])
    return { upvoted: false }
  })
}
