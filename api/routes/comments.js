import { emitToUser } from '../lib/socket.js'
import { checkMuted } from '../lib/moderation.js'

export async function commentRoutes(app, { pool }) {
  const commentSelect = `
    SELECT c.id, c.post_id, c.guide_id, c.body, c.created_at, c.upvote_count, c.noise_count,
           u.id AS user_id, u.username, u.is_trusted, u.reputation,
           (u.id <= 100) AS is_founding_member
    FROM comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.is_removed = FALSE
  `

  app.get('/posts/:id/comments', async (req) => {
    const { rows } = await pool.query(
      `${commentSelect} AND c.post_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    )
    return rows
  })

  app.post('/posts/:id/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (await checkMuted(pool, req.user.id, reply)) return
    const { body } = req.body ?? {}
    if (!body?.trim()) return reply.code(400).send({ error: 'Comment cannot be empty' })
    if (body.trim().length > 2000) return reply.code(400).send({ error: 'Comment must be 2,000 characters or fewer' })

    const { rows: post } = await pool.query(
      'SELECT id, user_id, title FROM posts WHERE id = $1 AND is_removed = FALSE', [req.params.id]
    )
    if (!post.length) return reply.code(404).send({ error: 'Post not found' })

    const { rows } = await pool.query(
      `INSERT INTO comments (post_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at, upvote_count, noise_count`,
      [req.params.id, req.user.id, body.trim()]
    )
    const { rows: u } = await pool.query(
      'SELECT id, username, is_trusted, reputation FROM users WHERE id = $1', [req.user.id]
    )

    const postAuthorId = post[0].user_id
    if (postAuthorId && postAuthorId !== req.user.id) {
      const title = post[0].title?.length > 60 ? post[0].title.slice(0, 60) + '...' : post[0].title
      const message = `${u[0]?.username ?? 'Someone'} commented on "${title}"`
      const link = `/post/${req.params.id}`
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'comment_on_post', $2, $3)`,
        [postAuthorId, message, link]
      )
      emitToUser(postAuthorId, 'notification', { message, link })
    }

    return reply.code(201).send({
      ...rows[0],
      user_id: u[0]?.id,
      username: u[0]?.username,
      is_trusted: u[0]?.is_trusted ?? false,
      reputation: u[0]?.reputation ?? 0,
      is_founding_member: (u[0]?.id ?? 0) <= 100,
    })
  })

  app.get('/guides/:id/comments', async (req) => {
    const { rows } = await pool.query(
      `${commentSelect} AND c.guide_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    )
    return rows
  })

  app.post('/guides/:id/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (await checkMuted(pool, req.user.id, reply)) return
    const { body } = req.body ?? {}
    if (!body?.trim()) return reply.code(400).send({ error: 'Comment cannot be empty' })
    if (body.trim().length > 2000) return reply.code(400).send({ error: 'Comment must be 2,000 characters or fewer' })

    const { rows: guide } = await pool.query(
      'SELECT id, user_id, title FROM guides WHERE id = $1 AND is_removed = FALSE', [req.params.id]
    )
    if (!guide.length) return reply.code(404).send({ error: 'Guide not found' })

    const { rows } = await pool.query(
      `INSERT INTO comments (guide_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at, upvote_count, noise_count`,
      [req.params.id, req.user.id, body.trim()]
    )
    const { rows: u } = await pool.query(
      'SELECT id, username, is_trusted, reputation FROM users WHERE id = $1', [req.user.id]
    )

    const guideAuthorId = guide[0].user_id
    if (guideAuthorId && guideAuthorId !== req.user.id) {
      const title = guide[0].title?.length > 60 ? guide[0].title.slice(0, 60) + '...' : guide[0].title
      const message = `${u[0]?.username ?? 'Someone'} commented on "${title}"`
      const link = `/compendium/${req.params.id}`
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, link) VALUES ($1, 'comment_on_guide', $2, $3)`,
        [guideAuthorId, message, link]
      )
      emitToUser(guideAuthorId, 'notification', { message, link })
    }

    return reply.code(201).send({
      ...rows[0],
      user_id: u[0]?.id,
      username: u[0]?.username,
      is_trusted: u[0]?.is_trusted ?? false,
      reputation: u[0]?.reputation ?? 0,
      is_founding_member: (u[0]?.id ?? 0) <= 100,
    })
  })

  // Edit comment (author only)
  app.patch('/comments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { body } = req.body ?? {}
    if (!body?.trim()) return reply.code(400).send({ error: 'Comment cannot be empty' })
    if (body.trim().length > 2000) return reply.code(400).send({ error: 'Comment must be 2,000 characters or fewer' })

    const { rows } = await pool.query('SELECT user_id FROM comments WHERE id = $1 AND is_removed = FALSE', [commentId])
    if (!rows.length) return reply.code(404).send({ error: 'Comment not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })

    const { rows: updated } = await pool.query(
      'UPDATE comments SET body = $1 WHERE id = $2 RETURNING id, body',
      [body.trim(), commentId]
    )
    return updated[0]
  })

  // Signal vote (add or switch from noise)
  app.post('/comments/:id/signal', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { rows: comment } = await pool.query(
      'SELECT id FROM comments WHERE id = $1 AND is_removed = FALSE', [commentId]
    )
    if (!comment[0]) return reply.code(404).send({ error: 'Comment not found' })

    const { rows: prev } = await pool.query(
      'SELECT vote FROM comment_votes WHERE user_id = $1 AND comment_id = $2',
      [req.user.id, commentId]
    )
    const oldVote = prev[0]?.vote ?? null

    await pool.query(`
      INSERT INTO comment_votes (user_id, comment_id, vote) VALUES ($1, $2, 'signal')
      ON CONFLICT (user_id, comment_id) DO UPDATE SET vote = 'signal'
    `, [req.user.id, commentId])

    if (oldVote !== 'signal') {
      await pool.query('UPDATE comments SET upvote_count = upvote_count + 1 WHERE id = $1', [commentId])
    }
    if (oldVote === 'noise') {
      await pool.query('UPDATE comments SET noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [commentId])
    }

    const { rows } = await pool.query('SELECT upvote_count, noise_count FROM comments WHERE id = $1', [commentId])
    return { vote: 'signal', ...rows[0] }
  })

  // Remove signal vote
  app.delete('/comments/:id/signal', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { rowCount } = await pool.query(
      "DELETE FROM comment_votes WHERE user_id = $1 AND comment_id = $2 AND vote = 'signal'",
      [req.user.id, commentId]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Vote not found' })

    await pool.query('UPDATE comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [commentId])

    const { rows } = await pool.query('SELECT upvote_count, noise_count FROM comments WHERE id = $1', [commentId])
    return { vote: null, ...rows[0] }
  })

  // Noise vote (add or switch from signal)
  app.post('/comments/:id/noise', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { rows: comment } = await pool.query(
      'SELECT id FROM comments WHERE id = $1 AND is_removed = FALSE', [commentId]
    )
    if (!comment[0]) return reply.code(404).send({ error: 'Comment not found' })

    const { rows: prev } = await pool.query(
      'SELECT vote FROM comment_votes WHERE user_id = $1 AND comment_id = $2',
      [req.user.id, commentId]
    )
    const oldVote = prev[0]?.vote ?? null

    await pool.query(`
      INSERT INTO comment_votes (user_id, comment_id, vote) VALUES ($1, $2, 'noise')
      ON CONFLICT (user_id, comment_id) DO UPDATE SET vote = 'noise'
    `, [req.user.id, commentId])

    if (oldVote !== 'noise') {
      await pool.query('UPDATE comments SET noise_count = noise_count + 1 WHERE id = $1', [commentId])
    }
    if (oldVote === 'signal') {
      await pool.query('UPDATE comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [commentId])
    }

    const { rows } = await pool.query('SELECT upvote_count, noise_count FROM comments WHERE id = $1', [commentId])
    return { vote: 'noise', ...rows[0] }
  })

  // Remove noise vote
  app.delete('/comments/:id/noise', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { rowCount } = await pool.query(
      "DELETE FROM comment_votes WHERE user_id = $1 AND comment_id = $2 AND vote = 'noise'",
      [req.user.id, commentId]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Vote not found' })

    await pool.query('UPDATE comments SET noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [commentId])

    const { rows } = await pool.query('SELECT upvote_count, noise_count FROM comments WHERE id = $1', [commentId])
    return { vote: null, ...rows[0] }
  })

  // Remove comment (author or moderator)
  app.delete('/comments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const commentId = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM comments WHERE id = $1 AND is_removed = FALSE', [commentId])
    if (!rows.length) return reply.code(404).send({ error: 'Comment not found' })
    const isOwner = rows[0].user_id === req.user.id
    const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    const isMod = u[0]?.is_moderator ?? false
    if (!isOwner && !isMod) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('UPDATE comments SET is_removed = TRUE WHERE id = $1', [commentId])
    return { removed: true }
  })
}
