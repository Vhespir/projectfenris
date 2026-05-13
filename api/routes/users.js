export async function userRoutes(app, { pool }) {
  app.get('/users/:username', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, username, reputation, is_trusted, is_moderator,
              region_state, region_county, threat_profile, created_at
       FROM users WHERE username = $1`,
      [req.params.username]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })

    const user = rows[0]

    const { rows: posts } = await pool.query(
      `SELECT id, post_type, category, title, upvote_count, created_at
       FROM posts WHERE user_id = $1 AND is_removed = FALSE
       ORDER BY created_at DESC LIMIT 10`,
      [user.id]
    )

    return { ...user, posts }
  })

  app.patch('/users/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { region_state, region_county, threat_profile } = req.body ?? {}
    const { rows } = await pool.query(
      `UPDATE users
       SET region_state   = COALESCE($1, region_state),
           region_county  = COALESCE($2, region_county),
           threat_profile = COALESCE($3, threat_profile)
       WHERE id = $4
       RETURNING id, username, email, reputation, is_trusted, region_state, region_county, threat_profile`,
      [region_state ?? null, region_county ?? null,
       threat_profile ? JSON.stringify(threat_profile) : null, req.user.id]
    )
    return rows[0]
  })
}
