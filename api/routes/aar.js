const VALID_TYPES = [
  'hurricane', 'earthquake', 'wildfire', 'flood', 'tornado', 'winter_storm',
  'power_outage', 'medical', 'financial', 'civil_unrest', 'evacuation', 'other',
]

export async function aarRoutes(app, { pool }) {
  // List AARs
  app.get('/aar', async (req) => {
    const { incident_type, state, sort = 'recent', limit = 50, offset = 0 } = req.query
    let query = `
      SELECT a.id, a.title, a.incident_type, a.location_label, a.state,
             a.duration, a.key_takeaway, a.signal_count, a.noise_count, a.created_at,
             u.username, u.reputation, u.is_trusted, (u.id <= 100) AS is_founding_member
      FROM after_action_reports a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.is_removed = FALSE
    `
    const params = []
    if (incident_type) { params.push(incident_type); query += ` AND a.incident_type = $${params.length}` }
    if (state)         { params.push(state);          query += ` AND a.state = $${params.length}` }

    const order = sort === 'signal'
      ? `a.signal_count DESC, a.created_at DESC`
      : sort === 'proven'
        ? `a.signal_count DESC`
        : `a.created_at DESC`

    params.push(Math.min(Number(limit), 100))
    params.push(Number(offset))
    query += ` ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`

    const { rows } = await pool.query(query, params)
    return rows
  })

  // Get single AAR with full detail
  app.get('/aar/:id', async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT a.id, a.title, a.incident_type, a.location_label, a.state,
             a.duration, a.narrative, a.what_worked, a.what_failed, a.wish_had,
             a.key_takeaway, a.signal_count, a.noise_count, a.created_at, a.updated_at,
             u.id AS user_id, u.username, u.reputation, u.is_trusted,
             (u.id <= 100) AS is_founding_member
      FROM after_action_reports a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.id = $1 AND a.is_removed = FALSE
    `, [req.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Report not found' })
    return rows[0]
  })

  // Get current user's vote
  app.get('/aar/:id/myvote', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      'SELECT vote FROM aar_votes WHERE user_id = $1 AND aar_id = $2',
      [req.user.id, req.params.id]
    )
    return { vote: rows[0]?.vote ?? null }
  })

  // Create AAR
  app.post('/aar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const {
      title, incident_type, location_label, state, duration,
      narrative, what_worked = [], what_failed = [], wish_had = [], key_takeaway,
    } = req.body ?? {}

    if (!title?.trim() || !incident_type || !narrative?.trim()) {
      return reply.code(400).send({ error: 'title, incident_type, and narrative are required' })
    }
    if (!VALID_TYPES.includes(incident_type)) {
      return reply.code(400).send({ error: 'Invalid incident_type' })
    }
    if (title.trim().length > 200) {
      return reply.code(400).send({ error: 'Title must be 200 characters or fewer' })
    }
    if (narrative.trim().length > 20000) {
      return reply.code(400).send({ error: 'Narrative must be 20,000 characters or fewer' })
    }

    const clean = (arr) => (Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : [])

    const { rows } = await pool.query(`
      INSERT INTO after_action_reports
        (user_id, title, incident_type, location_label, state, duration,
         narrative, what_worked, what_failed, wish_had, key_takeaway)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, title, incident_type, location_label, state, duration,
                key_takeaway, signal_count, created_at
    `, [
      req.user.id, title.trim(), incident_type,
      location_label?.trim() || null, state?.trim() || null, duration?.trim() || null,
      narrative.trim(), clean(what_worked), clean(what_failed), clean(wish_had),
      key_takeaway?.trim() || null,
    ])
    return reply.code(201).send(rows[0])
  })

  // Edit AAR (author only)
  app.patch('/aar/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query(
      'SELECT user_id FROM after_action_reports WHERE id = $1 AND is_removed = FALSE', [id]
    )
    if (!existing.length) return reply.code(404).send({ error: 'Report not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })

    const {
      title, narrative, location_label, state, duration,
      what_worked, what_failed, wish_had, key_takeaway,
    } = req.body ?? {}

    const clean = (arr) => arr !== undefined
      ? (Array.isArray(arr) ? arr.map(s => String(s).trim()).filter(Boolean) : [])
      : null

    const { rows } = await pool.query(`
      UPDATE after_action_reports SET
        title          = COALESCE($1, title),
        narrative      = COALESCE($2, narrative),
        location_label = COALESCE($3, location_label),
        state          = COALESCE($4, state),
        duration       = COALESCE($5, duration),
        what_worked    = COALESCE($6, what_worked),
        what_failed    = COALESCE($7, what_failed),
        wish_had       = COALESCE($8, wish_had),
        key_takeaway   = COALESCE($9, key_takeaway),
        updated_at     = NOW()
      WHERE id = $10
      RETURNING id, title, updated_at
    `, [
      title?.trim() || null, narrative?.trim() || null,
      location_label?.trim() || null, state?.trim() || null, duration?.trim() || null,
      clean(what_worked), clean(what_failed), clean(wish_had),
      key_takeaway?.trim() || null, id,
    ])
    return rows[0]
  })

  // Toggle signal/noise vote
  app.post('/aar/:id/vote', { preHandler: [app.authenticate] }, async (req, reply) => {
    const aarId = Number(req.params.id)
    const { vote } = req.body ?? {}
    if (!['signal', 'noise'].includes(vote)) return reply.code(400).send({ error: 'vote must be signal or noise' })

    const { rows: existing } = await pool.query(
      'SELECT user_id FROM after_action_reports WHERE id = $1 AND is_removed = FALSE', [aarId]
    )
    if (!existing.length) return reply.code(404).send({ error: 'Report not found' })

    const { rows: prev } = await pool.query(
      'SELECT vote FROM aar_votes WHERE user_id = $1 AND aar_id = $2',
      [req.user.id, aarId]
    )
    const oldVote = prev[0]?.vote ?? null
    const authorId = existing[0].user_id

    if (oldVote === vote) {
      await pool.query('DELETE FROM aar_votes WHERE user_id = $1 AND aar_id = $2', [req.user.id, aarId])
      if (vote === 'signal') {
        await pool.query('UPDATE after_action_reports SET signal_count = GREATEST(signal_count - 1, 0) WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 2, 0) WHERE id = $1', [authorId])
      } else {
        await pool.query('UPDATE after_action_reports SET noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [authorId])
      }
    } else if (oldVote) {
      await pool.query('UPDATE aar_votes SET vote = $1 WHERE user_id = $2 AND aar_id = $3', [vote, req.user.id, aarId])
      if (vote === 'signal') {
        await pool.query('UPDATE after_action_reports SET signal_count = signal_count + 1, noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = reputation + 3 WHERE id = $1', [authorId])
      } else {
        await pool.query('UPDATE after_action_reports SET noise_count = noise_count + 1, signal_count = GREATEST(signal_count - 1, 0) WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 3, 0) WHERE id = $1', [authorId])
      }
    } else {
      await pool.query('INSERT INTO aar_votes (user_id, aar_id, vote) VALUES ($1,$2,$3)', [req.user.id, aarId, vote])
      if (vote === 'signal') {
        await pool.query('UPDATE after_action_reports SET signal_count = signal_count + 1 WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = reputation + 2 WHERE id = $1', [authorId])
      } else {
        await pool.query('UPDATE after_action_reports SET noise_count = noise_count + 1 WHERE id = $1', [aarId])
        if (authorId) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 1, 0) WHERE id = $1', [authorId])
      }
    }

    const { rows } = await pool.query('SELECT signal_count, noise_count FROM after_action_reports WHERE id = $1', [aarId])
    return { vote: oldVote === vote ? null : vote, ...rows[0] }
  })

  // Delete AAR (author or moderator)
  app.delete('/aar/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query(
      'SELECT user_id FROM after_action_reports WHERE id = $1 AND is_removed = FALSE', [id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'Report not found' })
    const isOwner = rows[0].user_id === req.user.id
    const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    if (!isOwner && !u[0]?.is_moderator) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('UPDATE after_action_reports SET is_removed = TRUE WHERE id = $1', [id])
    return { removed: true }
  })
}
