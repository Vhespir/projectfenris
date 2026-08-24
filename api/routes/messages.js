import { emitToUser } from '../lib/socket.js'
import { checkMuted } from '../lib/moderation.js'

export async function messageRoutes(app, { pool }) {
  app.get('/messages/unread-count', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM messages WHERE recipient_id = $1 AND is_read = FALSE',
      [req.user.id]
    )
    return { count: rows[0].count }
  })

  app.get('/messages', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(`
      WITH convos AS (
        SELECT
          LEAST(sender_id, recipient_id)    AS user_a,
          GREATEST(sender_id, recipient_id) AS user_b,
          MAX(created_at) AS last_at
        FROM messages
        WHERE sender_id = $1 OR recipient_id = $1
        GROUP BY LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
      ),
      partner_convos AS (
        SELECT
          CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS partner_id,
          last_at
        FROM convos
      )
      SELECT
        pc.partner_id,
        u.username  AS partner_username,
        u.avatar_url AS partner_avatar,
        pc.last_at,
        (SELECT COUNT(*)::int FROM messages m2
         WHERE m2.sender_id = pc.partner_id AND m2.recipient_id = $1 AND NOT m2.is_read) AS unread_count,
        (SELECT body FROM messages m3
         WHERE (m3.sender_id = $1 AND m3.recipient_id = pc.partner_id)
            OR (m3.sender_id = pc.partner_id AND m3.recipient_id = $1)
         ORDER BY m3.created_at DESC LIMIT 1) AS last_body
      FROM partner_convos pc
      JOIN users u ON u.id = pc.partner_id
      ORDER BY pc.last_at DESC
    `, [req.user.id])
    return rows
  })

  app.get('/messages/:username', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { rows: partner } = await pool.query(
      'SELECT id FROM users WHERE username = $1', [req.params.username]
    )
    if (!partner[0]) return reply.code(404).send({ error: 'User not found' })
    const partnerId = partner[0].id

    const { rows } = await pool.query(`
      SELECT id, (sender_id = $1) AS is_mine, body, is_read, created_at
      FROM messages
      WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC
      LIMIT 200
    `, [req.user.id, partnerId])
    return rows
  })

  app.post('/messages/:username', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (await checkMuted(pool, req.user.id, reply)) return
    const { body } = req.body ?? {}
    if (!body?.trim()) return reply.code(400).send({ error: 'Message cannot be empty' })
    if (body.trim().length > 2000) return reply.code(400).send({ error: 'Message must be 2,000 characters or fewer' })

    const { rows: partner } = await pool.query(
      'SELECT id, username FROM users WHERE username = $1', [req.params.username]
    )
    if (!partner[0]) return reply.code(404).send({ error: 'User not found' })
    if (partner[0].id === req.user.id) return reply.code(400).send({ error: 'Cannot message yourself' })

    const { rows } = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3)
       RETURNING id, TRUE AS is_mine, body, is_read, created_at`,
      [req.user.id, partner[0].id, body.trim()]
    )

    const { rows: me } = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id])
    emitToUser(partner[0].id, 'new_message', {
      from: me[0].username,
      preview: body.trim().slice(0, 80),
    })

    return reply.code(201).send(rows[0])
  })

  app.patch('/messages/:username/read', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { rows: partner } = await pool.query(
      'SELECT id FROM users WHERE username = $1', [req.params.username]
    )
    if (!partner[0]) return reply.code(404).send({ error: 'User not found' })
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND recipient_id = $2 AND NOT is_read',
      [partner[0].id, req.user.id]
    )
    return { ok: true }
  })
}
