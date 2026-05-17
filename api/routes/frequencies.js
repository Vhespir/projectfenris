const VALID_CATEGORIES = ['police','fire','ems','noaa_weather','ham_repeater','gmrs','military','other']

export async function frequencyRoutes(app, { pool }) {
  // List frequencies with filters
  app.get('/frequencies', async (req) => {
    const { state, county, category, search, limit = 100, offset = 0 } = req.query
    let query = `
      SELECT f.id, f.state, f.county, f.category, f.frequency_mhz,
             f.name, f.description, f.tone_ctcss, f.tone_dcs, f.notes,
             f.is_verified, f.created_at,
             u.username AS submitted_by
      FROM frequencies f
      LEFT JOIN users u ON u.id = f.submitted_by
      WHERE 1=1
    `
    const params = []
    if (state)    { params.push(state);    query += ` AND f.state = $${params.length}` }
    if (county)   { params.push(county);   query += ` AND f.county ILIKE $${params.length}` }
    if (category) { params.push(category); query += ` AND f.category = $${params.length}` }
    if (search) {
      params.push(`%${search}%`)
      query += ` AND (f.name ILIKE $${params.length} OR f.description ILIKE $${params.length} OR f.county ILIKE $${params.length})`
    }

    params.push(Math.min(Number(limit), 500))
    params.push(Number(offset))
    query += ` ORDER BY f.state ASC, f.category ASC, f.frequency_mhz ASC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const { rows } = await pool.query(query, params)
    return rows
  })

  // Get distinct states that have entries
  app.get('/frequencies/states', async () => {
    const { rows } = await pool.query(
      `SELECT DISTINCT state FROM frequencies ORDER BY state ASC`
    )
    return rows.map(r => r.state)
  })

  // Submit new frequency (auth required)
  app.post('/frequencies', { preHandler: [app.authenticate] }, async (req, reply) => {
    const {
      state, county, category, frequency_mhz, name,
      description, tone_ctcss, tone_dcs, notes,
    } = req.body ?? {}

    if (!state?.trim() || !category || !frequency_mhz || !name?.trim()) {
      return reply.code(400).send({ error: 'state, category, frequency_mhz, and name are required' })
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return reply.code(400).send({ error: 'Invalid category' })
    }
    const mhz = parseFloat(frequency_mhz)
    if (isNaN(mhz) || mhz < 0.1 || mhz > 10000) {
      return reply.code(400).send({ error: 'frequency_mhz must be a valid number between 0.1 and 10000' })
    }
    if (name.trim().length > 120) {
      return reply.code(400).send({ error: 'Name must be 120 characters or fewer' })
    }

    const { rows } = await pool.query(`
      INSERT INTO frequencies
        (submitted_by, state, county, category, frequency_mhz, name, description, tone_ctcss, tone_dcs, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, state, county, category, frequency_mhz, name, description, is_verified, created_at
    `, [
      req.user.id, state.trim().toUpperCase(), county?.trim() || null, category, mhz,
      name.trim(), description?.trim() || null,
      tone_ctcss?.trim() || null, tone_dcs?.trim() || null, notes?.trim() || null,
    ])
    return reply.code(201).send(rows[0])
  })

  // Verify a frequency (moderator only)
  app.patch('/frequencies/:id/verify', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    if (!u[0]?.is_moderator) return reply.code(403).send({ error: 'Forbidden' })
    const { rows } = await pool.query(
      'UPDATE frequencies SET is_verified = TRUE WHERE id = $1 RETURNING id, is_verified',
      [req.params.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'Not found' })
    return rows[0]
  })

  // Delete a frequency (submitter or moderator)
  app.delete('/frequencies/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { rows } = await pool.query('SELECT submitted_by FROM frequencies WHERE id = $1', [req.params.id])
    if (!rows.length) return reply.code(404).send({ error: 'Not found' })
    const isOwner = rows[0].submitted_by === req.user.id
    const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
    if (!isOwner && !u[0]?.is_moderator) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM frequencies WHERE id = $1', [req.params.id])
    return { removed: true }
  })
}
