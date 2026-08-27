export async function pushRoutes(app, { pool }) {
  // Public: the VAPID public key is meant to be handed to browsers, not a
  // secret. Serving it from an endpoint instead of baking it into the
  // frontend build means rotating it doesn't require a frontend redeploy.
  app.get('/push/vapid-public-key', async (_req, reply) => {
    const key = process.env.VAPID_PUBLIC_KEY
    if (!key) return reply.code(503).send({ error: 'Push is not configured on this server yet' })
    return { key }
  })

  app.post('/push/subscribe', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { endpoint, keys } = req.body ?? {}
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: 'endpoint and keys.p256dh/keys.auth are required' })
    }
    await pool.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4
    `, [req.user.id, endpoint, keys.p256dh, keys.auth])
    return reply.code(201).send({ ok: true })
  })

  app.delete('/push/subscribe', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { endpoint } = req.body ?? {}
    if (!endpoint) return reply.code(400).send({ error: 'endpoint is required' })
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user.id, endpoint]
    )
    return reply.code(204).send()
  })
}
