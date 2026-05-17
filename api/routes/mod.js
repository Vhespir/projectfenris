export async function modRoutes(app, { pool }) {
  const isMod = async (req, reply) => {
    await app.authenticate(req, reply)
    const { rows } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    if (!rows[0]?.is_moderator) return reply.code(403).send({ error: 'Forbidden' })
  }

  // Posts
  app.get('/mod/posts', { preHandler: [isMod] }, async (req) => {
    const { status = 'all', limit = 100, offset = 0 } = req.query
    let where = ''
    if (status === 'active')  where = 'WHERE p.is_removed = FALSE'
    if (status === 'removed') where = 'WHERE p.is_removed = TRUE'
    const { rows } = await pool.query(`
      SELECT p.id, p.post_type, p.category, p.title, p.body,
             p.upvote_count, p.downvote_count, p.is_removed, p.created_at,
             u.username, u.id AS user_id
      FROM posts p LEFT JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [Math.min(Number(limit), 200), Number(offset)])
    return rows
  })

  app.patch('/mod/posts/:id/restore', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE posts SET is_removed = FALSE WHERE id = $1 AND is_removed = TRUE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Post not found or not removed' })
    return { restored: true }
  })

  app.delete('/mod/posts/:id', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE posts SET is_removed = TRUE WHERE id = $1 AND is_removed = FALSE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Post not found or already removed' })
    return { removed: true }
  })

  // Comments
  app.get('/mod/comments', { preHandler: [isMod] }, async (req) => {
    const { status = 'all', limit = 100, offset = 0 } = req.query
    let where = ''
    if (status === 'active')  where = 'WHERE c.is_removed = FALSE'
    if (status === 'removed') where = 'WHERE c.is_removed = TRUE'
    const { rows } = await pool.query(`
      SELECT c.id, c.body, c.is_removed, c.created_at,
             u.username, u.id AS user_id,
             c.post_id, c.guide_id,
             p.title AS post_title,
             g.title AS guide_title
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN posts p ON p.id = c.post_id
      LEFT JOIN guides g ON g.id = c.guide_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [Math.min(Number(limit), 200), Number(offset)])
    return rows
  })

  app.patch('/mod/comments/:id/restore', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE comments SET is_removed = FALSE WHERE id = $1 AND is_removed = TRUE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Comment not found or not removed' })
    return { restored: true }
  })

  app.delete('/mod/comments/:id', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE comments SET is_removed = TRUE WHERE id = $1 AND is_removed = FALSE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Comment not found or already removed' })
    return { removed: true }
  })

  // Users
  app.get('/mod/users', { preHandler: [isMod] }, async (req) => {
    const { search = '', limit = 100, offset = 0 } = req.query
    const params = [`%${search}%`, Math.min(Number(limit), 200), Number(offset)]
    const { rows } = await pool.query(`
      SELECT id, username, email, reputation, is_trusted, is_moderator, created_at,
             region_state, region_county
      FROM users
      WHERE username ILIKE $1 OR email ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, params)
    return rows
  })

  app.patch('/mod/users/:id', { preHandler: [isMod] }, async (req, reply) => {
    const { is_trusted, is_moderator } = req.body ?? {}
    if (Number(req.params.id) === req.user.id) {
      return reply.code(400).send({ error: 'Cannot modify your own moderator status' })
    }
    const updates = []
    const values = []
    if (is_trusted !== undefined) { values.push(is_trusted); updates.push(`is_trusted = $${values.length}`) }
    if (is_moderator !== undefined) { values.push(is_moderator); updates.push(`is_moderator = $${values.length}`) }
    if (!updates.length) return reply.code(400).send({ error: 'Nothing to update' })
    values.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, username, is_trusted, is_moderator`,
      values
    )
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' })
    return rows[0]
  })
}
