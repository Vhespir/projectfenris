export async function gardenRoutes(app, { pool }) {
  // ── Beds ────────────────────────────────────────────────────────────────────

  app.get('/garden/beds', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.location_label, b.size_sqft, b.notes, b.sort_order,
             b.created_at, b.updated_at,
             COUNT(c.id)::int AS crop_count,
             COUNT(c.id) FILTER (WHERE c.status NOT IN ('done'))::int AS active_crop_count
      FROM garden_beds b
      LEFT JOIN garden_crops c ON c.bed_id = b.id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.sort_order ASC, b.created_at ASC
    `, [req.user.id])
    return rows
  })

  app.post('/garden/beds', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { name, location_label, size_sqft, notes } = req.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
    const { rows } = await pool.query(`
      INSERT INTO garden_beds (user_id, name, location_label, size_sqft, notes)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, name, location_label, size_sqft, notes, sort_order, created_at, updated_at
    `, [req.user.id, name.trim(), location_label?.trim() || null,
        size_sqft ? Number(size_sqft) : null, notes?.trim() || null])
    return reply.code(201).send({ ...rows[0], crop_count: 0, active_crop_count: 0 })
  })

  app.patch('/garden/beds/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query('SELECT user_id FROM garden_beds WHERE id=$1', [id])
    if (!existing.length) return reply.code(404).send({ error: 'Bed not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { name, location_label, size_sqft, notes } = req.body ?? {}
    const { rows } = await pool.query(`
      UPDATE garden_beds SET
        name           = COALESCE($1, name),
        location_label = COALESCE($2, location_label),
        size_sqft      = COALESCE($3, size_sqft),
        notes          = COALESCE($4, notes),
        updated_at     = NOW()
      WHERE id = $5
      RETURNING id, name, location_label, size_sqft, notes, sort_order, updated_at
    `, [name?.trim() || null, location_label?.trim() ?? null,
        size_sqft !== undefined ? (size_sqft ? Number(size_sqft) : null) : undefined,
        notes?.trim() ?? null, id])
    return rows[0]
  })

  app.delete('/garden/beds/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM garden_beds WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Bed not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM garden_beds WHERE id=$1', [id])
    return { deleted: true }
  })

  // ── Crops ───────────────────────────────────────────────────────────────────
  // Includes every crop ever assigned to the bed, done or not, so the
  // frontend can build rotation history from one call.

  app.get('/garden/beds/:id/crops', { preHandler: [app.authenticate] }, async (req, reply) => {
    const bedId = Number(req.params.id)
    const { rows: bed } = await pool.query('SELECT user_id FROM garden_beds WHERE id=$1', [bedId])
    if (!bed.length) return reply.code(404).send({ error: 'Bed not found' })
    if (bed[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { rows } = await pool.query(`
      SELECT c.id, c.bed_id, c.name, c.variety, c.family, c.status,
             to_char(c.planted_date,'YYYY-MM-DD') AS planted_date,
             to_char(c.expected_harvest_date,'YYYY-MM-DD') AS expected_harvest_date,
             c.season, c.notes, c.created_at, c.updated_at,
             COALESCE(SUM(h.quantity), 0) AS total_yield
      FROM garden_crops c
      LEFT JOIN garden_harvests h ON h.crop_id = c.id
      WHERE c.bed_id = $1
      GROUP BY c.id
      ORDER BY c.planted_date DESC NULLS LAST, c.created_at DESC
    `, [bedId])
    return rows
  })

  app.post('/garden/beds/:id/crops', { preHandler: [app.authenticate] }, async (req, reply) => {
    const bedId = Number(req.params.id)
    const { rows: bed } = await pool.query('SELECT user_id FROM garden_beds WHERE id=$1', [bedId])
    if (!bed.length) return reply.code(404).send({ error: 'Bed not found' })
    if (bed[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { name, variety, family = 'Other', status = 'planned',
            planted_date, expected_harvest_date, season, notes } = req.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
    const { rows } = await pool.query(`
      INSERT INTO garden_crops (bed_id, user_id, name, variety, family, status, planted_date, expected_harvest_date, season, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, bed_id, name, variety, family, status,
                to_char(planted_date,'YYYY-MM-DD') AS planted_date,
                to_char(expected_harvest_date,'YYYY-MM-DD') AS expected_harvest_date,
                season, notes, created_at, updated_at
    `, [bedId, req.user.id, name.trim(), variety?.trim() || null, family, status,
        planted_date || null, expected_harvest_date || null, season?.trim() || null, notes?.trim() || null])
    return reply.code(201).send({ ...rows[0], total_yield: 0 })
  })

  app.patch('/garden/crops/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query('SELECT user_id FROM garden_crops WHERE id=$1', [id])
    if (!existing.length) return reply.code(404).send({ error: 'Crop not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const body = req.body ?? {}
    const sets = []
    const params = []
    const str = (k) => { if (k in body) { params.push(body[k]?.trim?.() ?? null); sets.push(`${k}=$${params.length}`) } }
    const raw = (k) => { if (k in body) { params.push(body[k] ?? null); sets.push(`${k}=$${params.length}`) } }
    str('name'); str('variety'); str('family'); str('status'); str('season'); str('notes')
    raw('planted_date'); raw('expected_harvest_date')
    if (sets.length === 0) return reply.code(400).send({ error: 'nothing to update' })
    sets.push('updated_at=NOW()')
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE garden_crops SET ${sets.join(',')} WHERE id=$${params.length}
       RETURNING id, bed_id, name, variety, family, status,
                 to_char(planted_date,'YYYY-MM-DD') AS planted_date,
                 to_char(expected_harvest_date,'YYYY-MM-DD') AS expected_harvest_date,
                 season, notes, updated_at`,
      params
    )
    return rows[0]
  })

  app.delete('/garden/crops/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM garden_crops WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Crop not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM garden_crops WHERE id=$1', [id])
    return { deleted: true }
  })

  // ── Harvest logs ────────────────────────────────────────────────────────────

  app.get('/garden/crops/:id/harvests', { preHandler: [app.authenticate] }, async (req, reply) => {
    const cropId = Number(req.params.id)
    const { rows: crop } = await pool.query('SELECT user_id FROM garden_crops WHERE id=$1', [cropId])
    if (!crop.length) return reply.code(404).send({ error: 'Crop not found' })
    if (crop[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { rows } = await pool.query(`
      SELECT id, crop_id, to_char(harvest_date,'YYYY-MM-DD') AS harvest_date, quantity, unit, notes, created_at
      FROM garden_harvests WHERE crop_id=$1
      ORDER BY harvest_date DESC, created_at DESC
    `, [cropId])
    return rows
  })

  app.post('/garden/crops/:id/harvests', { preHandler: [app.authenticate] }, async (req, reply) => {
    const cropId = Number(req.params.id)
    const { rows: crop } = await pool.query('SELECT user_id FROM garden_crops WHERE id=$1', [cropId])
    if (!crop.length) return reply.code(404).send({ error: 'Crop not found' })
    if (crop[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { harvest_date, quantity = 0, unit = 'lbs', notes } = req.body ?? {}
    const { rows } = await pool.query(`
      INSERT INTO garden_harvests (crop_id, user_id, harvest_date, quantity, unit, notes)
      VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6)
      RETURNING id, crop_id, to_char(harvest_date,'YYYY-MM-DD') AS harvest_date, quantity, unit, notes, created_at
    `, [cropId, req.user.id, harvest_date || null, Number(quantity), unit, notes?.trim() || null])
    return reply.code(201).send(rows[0])
  })

  app.delete('/garden/harvests/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM garden_harvests WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Harvest not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM garden_harvests WHERE id=$1', [id])
    return { deleted: true }
  })

  // ── Seed inventory ──────────────────────────────────────────────────────────

  app.get('/garden/seeds', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(`
      SELECT id, name, variety, family, qty, unit, viability_year, source, notes, created_at, updated_at
      FROM garden_seeds WHERE user_id=$1
      ORDER BY family ASC, name ASC
    `, [req.user.id])
    return rows
  })

  app.post('/garden/seeds', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { name, variety, family = 'Other', qty = 0, unit = 'packets', viability_year, source, notes } = req.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
    const { rows } = await pool.query(`
      INSERT INTO garden_seeds (user_id, name, variety, family, qty, unit, viability_year, source, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, name, variety, family, qty, unit, viability_year, source, notes, created_at, updated_at
    `, [req.user.id, name.trim(), variety?.trim() || null, family, Number(qty), unit,
        viability_year ? Number(viability_year) : null, source?.trim() || null, notes?.trim() || null])
    return reply.code(201).send(rows[0])
  })

  app.patch('/garden/seeds/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query('SELECT user_id FROM garden_seeds WHERE id=$1', [id])
    if (!existing.length) return reply.code(404).send({ error: 'Seed not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const body = req.body ?? {}
    const sets = []
    const params = []
    const str = (k) => { if (k in body) { params.push(body[k]?.trim?.() ?? null); sets.push(`${k}=$${params.length}`) } }
    const num = (k) => { if (k in body) { params.push(body[k] !== null && body[k] !== undefined ? Number(body[k]) : null); sets.push(`${k}=$${params.length}`) } }
    str('name'); str('variety'); str('family'); str('unit'); str('source'); str('notes')
    num('qty'); num('viability_year')
    if (sets.length === 0) return reply.code(400).send({ error: 'nothing to update' })
    sets.push('updated_at=NOW()')
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE garden_seeds SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    )
    return rows[0]
  })

  app.delete('/garden/seeds/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM garden_seeds WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Seed not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM garden_seeds WHERE id=$1', [id])
    return { deleted: true }
  })
}
