export async function notificationRoutes(app, { pool }) {
  app.get('/notifications/count', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    )
    return { count: rows[0].count }
  })

  app.get('/notifications', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      `SELECT id, type, message, link, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    )
    return rows
  })

  app.post('/notifications/read-all', { preHandler: [app.authenticate] }, async (req) => {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id])
    return { ok: true }
  })

  app.patch('/notifications/:id/read', { preHandler: [app.authenticate] }, async (req) => {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    return { ok: true }
  })
}
