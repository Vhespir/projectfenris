import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

async function geocode(state, county) {
  try {
    const q = county ? `${county}, ${state}, USA` : `${state}, USA`
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'ProjectFenris/1.0 (projectfenris.com)' } }
    )
    if (!res.ok) return null
    const [hit] = await res.json()
    return hit ? { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) } : null
  } catch {
    return null
  }
}

const UPLOADS_DIR = '/app/uploads/avatars'
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function userRoutes(app, { pool }) {
  // Username autocomplete for @mention in post editor
  app.get('/users/autocomplete', async (req, reply) => {
    const q = String(req.query.q ?? '').trim()
    if (!q) return []
    const { rows } = await pool.query(
      `SELECT username, avatar_url, is_trusted
       FROM users
       WHERE username ILIKE $1
       ORDER BY (username ILIKE $2) DESC, username ASC
       LIMIT 8`,
      [`${q}%`, q]
    )
    return rows
  })

  app.get('/users/:username', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, username, reputation, is_trusted, is_moderator,
              region_state, region_county, threat_profile, created_at,
              bio, prep_level, focus_areas, years_prepping, living_situation, showcase,
              avatar_url, (id <= 100) AS is_founding_member
       FROM users WHERE username = $1`,
      [req.params.username]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })
    const user = rows[0]

    const [{ rows: posts }, { rows: guides }] = await Promise.all([
      pool.query(
        `SELECT id, post_type, category, title, upvote_count, created_at
         FROM posts WHERE user_id = $1 AND is_removed = FALSE
         ORDER BY created_at DESC LIMIT 20`,
        [user.id]
      ),
      pool.query(
        `SELECT id, title, category, rating, rating_count, created_at
         FROM guides WHERE user_id = $1 AND is_removed = FALSE
         ORDER BY created_at DESC LIMIT 20`,
        [user.id]
      ),
    ])

    return { ...user, posts, guides }
  })

  app.patch('/users/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const {
      region_state, region_county, threat_profile,
      bio, prep_level, focus_areas, years_prepping, living_situation, showcase,
      preferences, notification_prefs,
    } = req.body ?? {}

    const { rows } = await pool.query(
      `UPDATE users SET
         region_state       = COALESCE($1,  region_state),
         region_county      = COALESCE($2,  region_county),
         threat_profile     = COALESCE($3,  threat_profile),
         bio                = COALESCE($4,  bio),
         prep_level         = COALESCE($5,  prep_level),
         focus_areas        = COALESCE($6,  focus_areas),
         years_prepping     = COALESCE($7,  years_prepping),
         living_situation   = COALESCE($8,  living_situation),
         showcase           = COALESCE($9,  showcase),
         preferences        = CASE WHEN $10::jsonb IS NOT NULL THEN preferences || $10::jsonb ELSE preferences END,
         notification_prefs = CASE WHEN $11::jsonb IS NOT NULL THEN notification_prefs || $11::jsonb ELSE notification_prefs END
       WHERE id = $12
       RETURNING id, username, email, reputation, is_trusted,
                 region_state, region_county, threat_profile,
                 bio, prep_level, focus_areas, years_prepping, living_situation, showcase,
                 avatar_url, preferences, notification_prefs, user_lat, user_lon`,
      [
        region_state        ?? null,
        region_county       ?? null,
        threat_profile      ? JSON.stringify(threat_profile)      : null,
        bio                 ?? null,
        prep_level          ?? null,
        focus_areas         ? JSON.stringify(focus_areas)         : null,
        years_prepping      ?? null,
        living_situation    ?? null,
        showcase            ? JSON.stringify(showcase)            : null,
        preferences         ? JSON.stringify(preferences)         : null,
        notification_prefs  ? JSON.stringify(notification_prefs)  : null,
        req.user.id,
      ]
    )

    if (region_state || region_county) {
      const state  = region_state  ?? rows[0].region_state
      const county = region_county ?? rows[0].region_county
      if (state) {
        const coords = await geocode(state, county)
        if (coords) {
          await pool.query(
            'UPDATE users SET user_lat = $1, user_lon = $2 WHERE id = $3',
            [coords.lat, coords.lon, req.user.id]
          )
          rows[0].user_lat = coords.lat
          rows[0].user_lon = coords.lon
        }
      }
    }

    return rows[0]
  })

  app.post('/users/me/avatar', {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const data = await req.file({ limits: { fileSize: MAX_SIZE } })
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })
    if (!ALLOWED_MIME.has(data.mimetype)) {
      data.file.resume()
      return reply.code(400).send({ error: 'Only JPEG, PNG, WebP, and GIF are allowed' })
    }

    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
    const ext = extMap[data.mimetype]
    const filename = `${req.user.id}.${ext}`

    await fs.mkdir(UPLOADS_DIR, { recursive: true })

    // Delete any old avatar for this user
    try {
      const existing = await fs.readdir(UPLOADS_DIR)
      for (const f of existing) {
        if (f.startsWith(`${req.user.id}.`) && f !== filename) {
          await fs.unlink(path.join(UPLOADS_DIR, f))
        }
      }
    } catch {}

    await pipeline(data.file, createWriteStream(path.join(UPLOADS_DIR, filename)))

    const avatarUrl = `/uploads/avatars/${filename}`
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id])

    return { avatar_url: avatarUrl }
  })

  app.delete('/users/me/avatar', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const existing = await fs.readdir(UPLOADS_DIR)
      for (const f of existing) {
        if (f.startsWith(`${req.user.id}.`)) {
          await fs.unlink(path.join(UPLOADS_DIR, f))
        }
      }
    } catch {}
    await pool.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.user.id])
    return { avatar_url: null }
  })
}
