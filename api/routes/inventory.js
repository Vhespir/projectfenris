const VALID_TYPES = [
  'edc', 'bob', 'ghb', 'inch', 'vehicle', 'home_cache',
  'ifak', 'trauma', 'med_kit', 'comms', 'power_cache', 'custom',
]

export async function inventoryRoutes(app, { pool }) {
  // ── Kits ────────────────────────────────────────────────────────────────────

  app.get('/inventory/kits', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(`
      SELECT k.id, k.name, k.type, k.purpose, k.location_label,
             k.weight_limit_g, k.budget_cents, k.notes, k.sort_order,
             k.household_people, k.household_pets, k.household_days,
             k.created_at, k.updated_at,
             COUNT(i.id)::int                           AS item_count,
             COALESCE(SUM(i.weight_g  * i.qty), 0)::int AS total_weight_g,
             COALESCE(SUM(i.cost_cents * i.qty), 0)::int AS total_cost_cents
      FROM inventory_kits k
      LEFT JOIN inventory_items i ON i.kit_id = k.id
      WHERE k.user_id = $1
      GROUP BY k.id
      ORDER BY k.sort_order ASC, k.created_at ASC
    `, [req.user.id])
    return rows
  })

  app.post('/inventory/kits', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { name, type = 'custom', purpose, location_label, weight_limit_g, budget_cents, notes,
            household_people = 2, household_pets = 0, household_days = 14 } = req.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
    if (!VALID_TYPES.includes(type)) return reply.code(400).send({ error: 'invalid type' })
    const { rows } = await pool.query(`
      INSERT INTO inventory_kits (user_id, name, type, purpose, location_label, weight_limit_g, budget_cents, notes,
                                   household_people, household_pets, household_days)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, name, type, purpose, location_label, weight_limit_g, budget_cents, notes, sort_order,
                household_people, household_pets, household_days, created_at, updated_at
    `, [req.user.id, name.trim(), type, purpose?.trim() || null, location_label?.trim() || null,
        weight_limit_g ? Number(weight_limit_g) : null, budget_cents ? Number(budget_cents) : null, notes?.trim() || null,
        Number(household_people) || 2, Number(household_pets) || 0, Number(household_days) || 14])
    return reply.code(201).send({ ...rows[0], item_count: 0, total_weight_g: 0, total_cost_cents: 0 })
  })

  app.patch('/inventory/kits/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query('SELECT user_id FROM inventory_kits WHERE id=$1', [id])
    if (!existing.length) return reply.code(404).send({ error: 'Kit not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { name, type, purpose, location_label, weight_limit_g, budget_cents, notes,
            household_people, household_pets, household_days } = req.body ?? {}
    if (type && !VALID_TYPES.includes(type)) return reply.code(400).send({ error: 'invalid type' })
    const { rows } = await pool.query(`
      UPDATE inventory_kits SET
        name             = COALESCE($1, name),
        type             = COALESCE($2, type),
        purpose          = COALESCE($3, purpose),
        location_label   = COALESCE($4, location_label),
        weight_limit_g   = COALESCE($5, weight_limit_g),
        budget_cents     = COALESCE($6, budget_cents),
        notes            = COALESCE($7, notes),
        household_people = COALESCE($8, household_people),
        household_pets   = COALESCE($9, household_pets),
        household_days   = COALESCE($10, household_days),
        updated_at       = NOW()
      WHERE id = $11
      RETURNING id, name, type, purpose, location_label, weight_limit_g, budget_cents, notes, sort_order,
                household_people, household_pets, household_days, updated_at
    `, [name?.trim() || null, type || null, purpose?.trim() ?? null, location_label?.trim() ?? null,
        weight_limit_g !== undefined ? (weight_limit_g ? Number(weight_limit_g) : null) : undefined,
        budget_cents !== undefined ? (budget_cents ? Number(budget_cents) : null) : undefined,
        notes?.trim() ?? null,
        household_people !== undefined ? Number(household_people) : undefined,
        household_pets !== undefined ? Number(household_pets) : undefined,
        household_days !== undefined ? Number(household_days) : undefined,
        id])
    return rows[0]
  })

  app.delete('/inventory/kits/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM inventory_kits WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Kit not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM inventory_kits WHERE id=$1', [id])
    return { deleted: true }
  })

  // ── Items ────────────────────────────────────────────────────────────────────

  app.get('/inventory/kits/:id/items', { preHandler: [app.authenticate] }, async (req, reply) => {
    const kitId = Number(req.params.id)
    const { rows: kit } = await pool.query('SELECT user_id FROM inventory_kits WHERE id=$1', [kitId])
    if (!kit.length) return reply.code(404).send({ error: 'Kit not found' })
    if (kit[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { rows } = await pool.query(`
      SELECT id, kit_id, template_id, name, category, qty, par, unit,
             weight_g, cost_cents, to_char(expiry,'YYYY-MM-DD') AS expiry,
             note, storage_location, sort_order, created_at, updated_at
      FROM inventory_items WHERE kit_id=$1
      ORDER BY category ASC, sort_order ASC, name ASC
    `, [kitId])
    return rows
  })

  app.post('/inventory/kits/:id/items', { preHandler: [app.authenticate] }, async (req, reply) => {
    const kitId = Number(req.params.id)
    const { rows: kit } = await pool.query('SELECT user_id FROM inventory_kits WHERE id=$1', [kitId])
    if (!kit.length) return reply.code(404).send({ error: 'Kit not found' })
    if (kit[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { template_id, name, category = 'Other', qty = 0, par = 0, unit = 'units',
            weight_g, cost_cents, expiry, note, storage_location } = req.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'name required' })
    const { rows } = await pool.query(`
      INSERT INTO inventory_items (kit_id, user_id, template_id, name, category, qty, par, unit,
                                   weight_g, cost_cents, expiry, note, storage_location)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, kit_id, template_id, name, category, qty, par, unit,
                weight_g, cost_cents, to_char(expiry,'YYYY-MM-DD') AS expiry,
                note, storage_location, sort_order, created_at, updated_at
    `, [kitId, req.user.id, template_id || null, name.trim(), category,
        Number(qty), Number(par), unit,
        weight_g ? Number(weight_g) : null, cost_cents ? Number(cost_cents) : null,
        expiry || null, note?.trim() || null, storage_location?.trim() || null])
    return reply.code(201).send(rows[0])
  })

  app.post('/inventory/kits/:id/items/bulk', { preHandler: [app.authenticate] }, async (req, reply) => {
    const kitId = Number(req.params.id)
    const { rows: kit } = await pool.query('SELECT user_id FROM inventory_kits WHERE id=$1', [kitId])
    if (!kit.length) return reply.code(404).send({ error: 'Kit not found' })
    if (kit[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const { items } = req.body ?? {}
    if (!Array.isArray(items) || items.length === 0) return reply.code(400).send({ error: 'items required' })
    if (items.length > 200) return reply.code(400).send({ error: 'too many items (max 200)' })
    const inserted = []
    for (const item of items) {
      const { name, category = 'Other', qty = 0, par = 0, unit = 'units',
              weight_g, cost_cents, expiry, note, storage_location, template_id } = item
      if (!name?.trim()) continue
      const { rows } = await pool.query(`
        INSERT INTO inventory_items (kit_id, user_id, template_id, name, category, qty, par, unit,
                                     weight_g, cost_cents, expiry, note, storage_location)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id, kit_id, template_id, name, category, qty, par, unit,
                  weight_g, cost_cents, to_char(expiry,'YYYY-MM-DD') AS expiry,
                  note, storage_location, sort_order, created_at, updated_at
      `, [kitId, req.user.id, template_id || null, name.trim(), category,
          Number(qty), Number(par), unit,
          weight_g ? Number(weight_g) : null, cost_cents ? Number(cost_cents) : null,
          expiry || null, note?.trim() || null, storage_location?.trim() || null])
      if (rows[0]) inserted.push(rows[0])
    }
    return reply.code(201).send(inserted)
  })

  app.patch('/inventory/items/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows: existing } = await pool.query('SELECT user_id FROM inventory_items WHERE id=$1', [id])
    if (!existing.length) return reply.code(404).send({ error: 'Item not found' })
    if (existing[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    const body = req.body ?? {}
    const sets = []
    const params = []
    const str  = (k) => { if (k in body) { params.push(body[k]?.trim?.() ?? null); sets.push(`${k}=$${params.length}`) } }
    const num  = (k) => { if (k in body) { params.push(body[k] !== null && body[k] !== undefined ? Number(body[k]) : null); sets.push(`${k}=$${params.length}`) } }
    const raw  = (k) => { if (k in body) { params.push(body[k] ?? null); sets.push(`${k}=$${params.length}`) } }
    str('name'); str('category'); str('unit'); str('note'); str('storage_location')
    num('qty'); num('par'); num('weight_g'); num('cost_cents')
    raw('expiry')
    if (sets.length === 0) return reply.code(400).send({ error: 'nothing to update' })
    sets.push('updated_at=NOW()')
    params.push(id)
    const { rows } = await pool.query(
      `UPDATE inventory_items SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    )
    return rows[0]
  })

  app.delete('/inventory/items/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = Number(req.params.id)
    const { rows } = await pool.query('SELECT user_id FROM inventory_items WHERE id=$1', [id])
    if (!rows.length) return reply.code(404).send({ error: 'Item not found' })
    if (rows[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
    await pool.query('DELETE FROM inventory_items WHERE id=$1', [id])
    return { deleted: true }
  })
}
