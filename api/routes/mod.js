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

  // Guides
  app.get('/mod/guides', { preHandler: [isMod] }, async (req) => {
    const { status = 'all', limit = 100, offset = 0 } = req.query
    let where = ''
    if (status === 'active')  where = 'WHERE g.is_removed = FALSE'
    if (status === 'removed') where = 'WHERE g.is_removed = TRUE'
    const { rows } = await pool.query(`
      SELECT g.id, g.title, g.category, g.region,
             g.signal_count, g.noise_count, g.is_removed, g.created_at,
             u.username, u.id AS user_id
      FROM guides g LEFT JOIN users u ON u.id = g.user_id
      ${where}
      ORDER BY g.created_at DESC
      LIMIT $1 OFFSET $2
    `, [Math.min(Number(limit), 200), Number(offset)])
    return rows
  })

  app.patch('/mod/guides/:id/restore', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE guides SET is_removed = FALSE WHERE id = $1 AND is_removed = TRUE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Guide not found or not removed' })
    return { restored: true }
  })

  app.delete('/mod/guides/:id', { preHandler: [isMod] }, async (req, reply) => {
    const { rowCount } = await pool.query(
      'UPDATE guides SET is_removed = TRUE WHERE id = $1 AND is_removed = FALSE',
      [req.params.id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Guide not found or already removed' })
    return { removed: true }
  })

  // Users
  app.get('/mod/users', { preHandler: [isMod] }, async (req) => {
    const { search = '', limit = 100, offset = 0 } = req.query
    const params = [`%${search}%`, Math.min(Number(limit), 200), Number(offset)]
    const { rows } = await pool.query(`
      SELECT id, username, email, reputation, is_trusted, is_moderator, created_at,
             region_state, region_county, is_banned, banned_at, banned_reason, muted_until
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

  // Ban -- reversible, blocks login immediately and every authenticated
  // action from then on (enforced in api/index.js's `authenticate`), even
  // against a session cookie issued before the ban.
  app.patch('/mod/users/:id/ban', { preHandler: [isMod] }, async (req, reply) => {
    const id = Number(req.params.id)
    if (id === req.user.id) return reply.code(400).send({ error: 'Cannot ban yourself' })
    const { rows: target } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [id])
    if (!target[0]) return reply.code(404).send({ error: 'User not found' })
    if (target[0].is_moderator) {
      return reply.code(400).send({ error: 'Cannot ban a moderator -- remove their moderator status first' })
    }
    const { reason } = req.body ?? {}
    const { rows } = await pool.query(
      `UPDATE users SET is_banned = TRUE, banned_at = NOW(), banned_reason = $1
       WHERE id = $2
       RETURNING id, username, is_banned, banned_at, banned_reason`,
      [reason?.trim() || null, id]
    )
    return rows[0]
  })

  app.patch('/mod/users/:id/unban', { preHandler: [isMod] }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE users SET is_banned = FALSE, banned_at = NULL, banned_reason = NULL
       WHERE id = $1
       RETURNING id, username, is_banned`,
      [req.params.id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' })
    return rows[0]
  })

  // Mute -- temporary and narrower than a ban. Only blocks creating new
  // posts/comments/guides/AARs/messages (enforced via checkMuted in each of
  // those routes); browsing, voting, and reading DMs still work.
  app.patch('/mod/users/:id/mute', { preHandler: [isMod] }, async (req, reply) => {
    const id = Number(req.params.id)
    if (id === req.user.id) return reply.code(400).send({ error: 'Cannot mute yourself' })
    const hours = Number(req.body?.hours)
    if (!hours || hours <= 0 || hours > 24 * 90) {
      return reply.code(400).send({ error: 'hours must be a positive number, 2160 (90 days) or fewer' })
    }
    const { rows } = await pool.query(
      `UPDATE users SET muted_until = NOW() + ($1 || ' hours')::interval
       WHERE id = $2
       RETURNING id, username, muted_until`,
      [hours, id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' })
    return rows[0]
  })

  app.patch('/mod/users/:id/unmute', { preHandler: [isMod] }, async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE users SET muted_until = NULL WHERE id = $1 RETURNING id, username, muted_until`,
      [req.params.id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'User not found' })
    return rows[0]
  })

  // Hard delete -- irreversible. Votes/messages/notifications/inventory are
  // cascade-deleted with the account; posts/comments/guides/AARs survive
  // with the author set to NULL (see the ON DELETE clauses in the schema
  // migrations). Blocked for moderator accounts as a safety rail -- remove
  // moderator status first if one genuinely needs deleting.
  app.delete('/mod/users/:id', { preHandler: [isMod] }, async (req, reply) => {
    const id = Number(req.params.id)
    if (id === req.user.id) return reply.code(400).send({ error: 'Cannot delete your own account here' })
    const { rows: target } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [id])
    if (!target[0]) return reply.code(404).send({ error: 'User not found' })
    if (target[0].is_moderator) {
      return reply.code(400).send({ error: 'Cannot delete a moderator -- remove their moderator status first' })
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id])
    return { deleted: true }
  })

  // Full recent activity for one user, to review before acting on them.
  app.get('/mod/users/:id/activity', { preHandler: [isMod] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: userRows } = await pool.query(
      'SELECT id, username, email, is_banned, banned_reason, muted_until FROM users WHERE id = $1',
      [id]
    )
    if (!userRows[0]) return reply.code(404).send({ error: 'User not found' })

    const [posts, comments, guides, aars] = await Promise.all([
      pool.query(
        `SELECT id, post_type, title, is_removed, created_at FROM posts
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]
      ),
      pool.query(
        `SELECT id, body, post_id, guide_id, is_removed, created_at FROM comments
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]
      ),
      pool.query(
        `SELECT id, title, is_removed, created_at FROM guides
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]
      ),
      pool.query(
        `SELECT id, title, created_at FROM after_action_reports
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]
      ),
    ])

    return {
      user: userRows[0],
      posts: posts.rows,
      comments: comments.rows,
      guides: guides.rows,
      aars: aars.rows,
    }
  })

  // Bulk actions
  app.post('/mod/posts/bulk-remove', { preHandler: [isMod] }, async (req, reply) => {
    const ids = (req.body?.ids ?? []).map(Number).filter(Number.isFinite)
    if (!ids.length) return reply.code(400).send({ error: 'ids array is required' })
    const { rowCount } = await pool.query(
      'UPDATE posts SET is_removed = TRUE WHERE id = ANY($1) AND is_removed = FALSE', [ids]
    )
    return { removed: rowCount }
  })

  app.post('/mod/comments/bulk-remove', { preHandler: [isMod] }, async (req, reply) => {
    const ids = (req.body?.ids ?? []).map(Number).filter(Number.isFinite)
    if (!ids.length) return reply.code(400).send({ error: 'ids array is required' })
    const { rowCount } = await pool.query(
      'UPDATE comments SET is_removed = TRUE WHERE id = ANY($1) AND is_removed = FALSE', [ids]
    )
    return { removed: rowCount }
  })

  app.post('/mod/users/bulk-ban', { preHandler: [isMod] }, async (req, reply) => {
    const ids = (req.body?.ids ?? []).map(Number).filter(n => Number.isFinite(n) && n !== req.user.id)
    if (!ids.length) return reply.code(400).send({ error: 'ids array is required' })
    const { reason } = req.body ?? {}
    const { rowCount } = await pool.query(
      `UPDATE users SET is_banned = TRUE, banned_at = NOW(), banned_reason = $1
       WHERE id = ANY($2) AND is_moderator = FALSE`,
      [reason?.trim() || null, ids]
    )
    return { banned: rowCount }
  })
}
