import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import dotenv from 'dotenv'
import pg from 'pg'
import fs from 'node:fs'
import { runMigrations } from './db/migrate.js'
import { authRoutes } from './routes/auth.js'
import { postRoutes } from './routes/posts.js'
import { userRoutes } from './routes/users.js'
import { commentRoutes } from './routes/comments.js'
import { messageRoutes } from './routes/messages.js'
import { notificationRoutes } from './routes/notifications.js'
import { searchRoutes } from './routes/search.js'
import { modRoutes } from './routes/mod.js'
import { externalRoutes } from './routes/external.js'
import { frequencyRoutes } from './routes/frequencies.js'
import { inventoryRoutes } from './routes/inventory.js'
import { gardenRoutes } from './routes/garden.js'
import { refRoutes } from './routes/refs.js'
import { pushRoutes } from './routes/push.js'
import { checkMuted } from './lib/moderation.js'
import { initSocket } from './lib/socket.js'
import { startEventNotifier } from './lib/eventNotifier.js'

dotenv.config()

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters')
  process.exit(1)
}

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const app = Fastify({
  logger: {
    serializers: {
      // Privacy commitment: don't log search queries. The default req
      // serializer logs the full URL including query string, which for
      // GET /search?q=... would put whatever someone searched for straight
      // into the logs. Strip the query string on that one path only.
      req(request) {
        const url = request.url?.startsWith('/search?') ? '/search?[redacted]' : request.url
        return { method: request.method, url, hostname: request.hostname, remoteAddress: request.ip, remotePort: request.socket?.remotePort }
      },
    },
  },
  bodyLimit: 1_048_576, // 1 MB max JSON body
})

await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
})

await app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://projectfenris.com', 'https://www.projectfenris.com']
    : true,
  credentials: true,
})

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.ip,
})

await app.register(cookie)

await app.register(jwt, {
  secret: process.env.JWT_SECRET,
  cookie: { cookieName: 'session', signed: false },
})

await app.register(multipart, {
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
})

fs.mkdirSync('/app/uploads/avatars', { recursive: true })
await app.register(staticFiles, {
  root: '/app/uploads',
  prefix: '/uploads/',
  decorateReply: false,
})

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized' })
    return
  }
  // Re-checked on every authenticated request, not just at login, so a ban
  // takes effect immediately even against an already-issued session cookie.
  const { rows } = await pool.query('SELECT is_banned, banned_reason FROM users WHERE id = $1', [req.user.id])
  if (rows[0]?.is_banned) {
    reply.clearCookie('session', { path: '/' })
    reply.code(403).send({ error: `This account has been banned${rows[0].banned_reason ? `: ${rows[0].banned_reason}` : '.'}` })
  }
})

app.get('/health', async () => ({ status: 'ok', service: 'fenris-api' }))

// Proxy OpenSky (CORS-blocked from the browser; cache per bbox for 20s)
const openskyCache = new Map()
const OPENSKY_TTL = 20_000

app.get('/proxy/opensky', async (req, reply) => {
  const { lamin, lomin, lamax, lomax } = req.query
  if (!lamin || !lomin || !lamax || !lomax) {
    return reply.code(400).send({ error: 'lamin, lomin, lamax, lomax required' })
  }
  const key = `${lamin},${lomin},${lamax},${lomax}`
  const cached = openskyCache.get(key)
  if (cached && Date.now() - cached.ts < OPENSKY_TTL) return cached.data

  try {
    const res = await fetch(
      `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
    )
    if (!res.ok) return reply.code(res.status).send({ error: 'OpenSky unavailable' })
    const data = await res.json()
    openskyCache.set(key, { data, ts: Date.now() })
    if (openskyCache.size > 100) {
      const now = Date.now()
      for (const [k, v] of openskyCache) {
        if (now - v.ts > OPENSKY_TTL) openskyCache.delete(k)
      }
    }
    return data
  } catch {
    return reply.code(503).send({ error: 'OpenSky unavailable' })
  }
})

app.get('/events', async (req) => {
  const { source, sources, severity, limit = 2000, days } = req.query
  let query = `
    SELECT id, source, event_type, title, severity, slug,
           ST_AsGeoJSON(geometry)::json AS geometry,
           properties, external_id, starts_at, expires_at, fetched_at,
           (SELECT COUNT(*)::int FROM content_references
            WHERE target_type = 'event' AND target_id = disaster_events.id) AS discussion_count
    FROM disaster_events
    WHERE (expires_at IS NULL OR expires_at > NOW())
  `
  const params = []
  if (source) {
    params.push(source); query += ` AND source = $${params.length}`
  } else if (sources) {
    const list = String(sources).split(',').map(s => s.trim()).filter(Boolean)
    if (list.length > 0) { params.push(list); query += ` AND source = ANY($${params.length}::text[])` }
  }
  if (severity) { params.push(severity); query += ` AND severity = $${params.length}` }
  if (days) {
    const d = Math.min(Math.max(Number(days), 1), 90)
    query += ` AND fetched_at > NOW() - INTERVAL '${d} days'`
  }
  params.push(Math.min(Number(limit), 5000))
  query += ` ORDER BY fetched_at DESC LIMIT $${params.length}`
  const { rows } = await pool.query(query, params)
  return rows
})

app.get('/news', async (req) => {
  const { limit = 50, category, source, days } = req.query
  let query = `SELECT id, source, title, url, summary, category, region, slug, published_at,
    (SELECT COUNT(*)::int FROM content_references
     WHERE target_type = 'news' AND target_id = news_items.id) AS discussion_count
   FROM news_items WHERE 1=1`
  const params = []
  if (category) {
    const cats = String(category).split(',').map(c => c.trim()).filter(Boolean)
    if (cats.length === 1) { params.push(cats[0]); query += ` AND category = $${params.length}` }
    else if (cats.length > 1) { params.push(cats); query += ` AND category = ANY($${params.length}::text[])` }
  }
  if (source) { params.push(String(source).trim()); query += ` AND source = $${params.length}` }
  if (days) {
    const d = Math.min(Math.max(Number(days), 1), 90)
    query += ` AND published_at > NOW() - INTERVAL '${d} days'`
  }
  params.push(Math.min(Number(limit), 2000))
  query += ` ORDER BY published_at DESC NULLS LAST LIMIT $${params.length}`
  const { rows } = await pool.query(query, params)
  return rows
})

app.get('/guides', async (req) => {
  const { category, limit = 50 } = req.query
  let query = `
    SELECT g.id, g.user_id, g.title, g.body, g.category, g.region, g.signal_count, g.noise_count, g.created_at,
           u.username, u.is_trusted, u.reputation, (u.id <= 100) AS is_founding_member
    FROM guides g LEFT JOIN users u ON g.user_id = u.id
    WHERE g.is_removed = false
  `
  const params = []
  if (category) { params.push(category); query += ` AND g.category = $${params.length}` }
  params.push(Math.min(Number(limit), 200))
  query += ` ORDER BY g.signal_count DESC, g.created_at DESC LIMIT $${params.length}`
  const { rows } = await pool.query(query, params)
  return rows
})

app.get('/guides/:id', async (req, reply) => {
  const { rows } = await pool.query(`
    SELECT g.id, g.user_id, g.title, g.body, g.category, g.region, g.signal_count, g.noise_count, g.created_at,
           u.username, u.is_trusted, u.reputation, (u.id <= 100) AS is_founding_member
    FROM guides g LEFT JOIN users u ON g.user_id = u.id
    WHERE g.id = $1 AND g.is_removed = false
  `, [req.params.id])
  if (!rows[0]) return reply.code(404).send({ error: 'Not found' })
  return rows[0]
})

app.get('/guides/:id/myvote', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await pool.query(
    'SELECT vote FROM guide_votes WHERE user_id = $1 AND guide_id = $2',
    [req.user.id, req.params.id]
  )
  if (!rows[0]) return reply.code(404).send({ error: 'No vote' })
  return { vote: rows[0].vote }
})

app.post('/guides/:id/signal', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows: guide } = await pool.query(
    'SELECT id, user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id]
  )
  if (!guide[0]) return reply.code(404).send({ error: 'Not found' })

  const { rows: prev } = await pool.query(
    'SELECT vote FROM guide_votes WHERE user_id = $1 AND guide_id = $2',
    [req.user.id, req.params.id]
  )
  const oldVote = prev[0]?.vote ?? null

  try {
    await pool.query(`
      INSERT INTO guide_votes (user_id, guide_id, vote) VALUES ($1, $2, 'signal')
      ON CONFLICT (user_id, guide_id) DO UPDATE SET vote = 'signal'
    `, [req.user.id, req.params.id])
  } catch (err) {
    if (err.code === '23503') return reply.code(404).send({ error: 'Not found' })
    throw err
  }

  if (oldVote !== 'signal') {
    await pool.query('UPDATE guides SET signal_count = signal_count + 1 WHERE id = $1', [req.params.id])
    if (guide[0].user_id) await pool.query('UPDATE users SET reputation = reputation + 2 WHERE id = $1', [guide[0].user_id])
  }
  if (oldVote === 'noise') {
    await pool.query('UPDATE guides SET noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [req.params.id])
    if (guide[0].user_id) await pool.query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [guide[0].user_id])
  }

  const { rows } = await pool.query('SELECT signal_count, noise_count FROM guides WHERE id = $1', [req.params.id])
  return { vote: 'signal', ...rows[0] }
})

app.delete('/guides/:id/signal', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows: guide } = await pool.query(
    'SELECT id, user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id]
  )
  if (!guide[0]) return reply.code(404).send({ error: 'Not found' })

  const { rowCount } = await pool.query(
    "DELETE FROM guide_votes WHERE user_id = $1 AND guide_id = $2 AND vote = 'signal'",
    [req.user.id, req.params.id]
  )
  if (!rowCount) return reply.code(404).send({ error: 'Vote not found' })

  await pool.query('UPDATE guides SET signal_count = GREATEST(signal_count - 1, 0) WHERE id = $1', [req.params.id])
  if (guide[0].user_id) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 2, 0) WHERE id = $1', [guide[0].user_id])

  const { rows } = await pool.query('SELECT signal_count, noise_count FROM guides WHERE id = $1', [req.params.id])
  return { vote: null, ...rows[0] }
})

app.post('/guides/:id/noise', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows: guide } = await pool.query(
    'SELECT id, user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id]
  )
  if (!guide[0]) return reply.code(404).send({ error: 'Not found' })

  const { rows: prev } = await pool.query(
    'SELECT vote FROM guide_votes WHERE user_id = $1 AND guide_id = $2',
    [req.user.id, req.params.id]
  )
  const oldVote = prev[0]?.vote ?? null

  try {
    await pool.query(`
      INSERT INTO guide_votes (user_id, guide_id, vote) VALUES ($1, $2, 'noise')
      ON CONFLICT (user_id, guide_id) DO UPDATE SET vote = 'noise'
    `, [req.user.id, req.params.id])
  } catch (err) {
    if (err.code === '23503') return reply.code(404).send({ error: 'Not found' })
    throw err
  }

  if (oldVote !== 'noise') {
    await pool.query('UPDATE guides SET noise_count = noise_count + 1 WHERE id = $1', [req.params.id])
    if (guide[0].user_id) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 1, 0) WHERE id = $1', [guide[0].user_id])
  }
  if (oldVote === 'signal') {
    await pool.query('UPDATE guides SET signal_count = GREATEST(signal_count - 1, 0) WHERE id = $1', [req.params.id])
    if (guide[0].user_id) await pool.query('UPDATE users SET reputation = GREATEST(reputation - 2, 0) WHERE id = $1', [guide[0].user_id])
  }

  const { rows } = await pool.query('SELECT signal_count, noise_count FROM guides WHERE id = $1', [req.params.id])
  return { vote: 'noise', ...rows[0] }
})

app.delete('/guides/:id/noise', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows: guide } = await pool.query(
    'SELECT id, user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id]
  )
  if (!guide[0]) return reply.code(404).send({ error: 'Not found' })

  const { rowCount } = await pool.query(
    "DELETE FROM guide_votes WHERE user_id = $1 AND guide_id = $2 AND vote = 'noise'",
    [req.user.id, req.params.id]
  )
  if (!rowCount) return reply.code(404).send({ error: 'Vote not found' })

  await pool.query('UPDATE guides SET noise_count = GREATEST(noise_count - 1, 0) WHERE id = $1', [req.params.id])
  if (guide[0].user_id) await pool.query('UPDATE users SET reputation = reputation + 1 WHERE id = $1', [guide[0].user_id])

  const { rows } = await pool.query('SELECT signal_count, noise_count FROM guides WHERE id = $1', [req.params.id])
  return { vote: null, ...rows[0] }
})

app.post('/guides', {
  onRequest: [app.authenticate],
  config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
}, async (req, reply) => {
  if (await checkMuted(pool, req.user.id, reply)) return
  const { title, body, category, region } = req.body
  if (!title?.trim() || !body?.trim() || !category?.trim()) {
    return reply.code(400).send({ error: 'title, body, and category are required' })
  }
  const { rows } = await pool.query(`
    INSERT INTO guides (user_id, title, body, category, region)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [req.user.id, title.trim(), body.trim(), category.trim(), region?.trim() || null])
  return reply.code(201).send({ id: rows[0].id })
})

app.patch('/guides/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { title, body, category, region } = req.body ?? {}
  if (!title?.trim() && !body?.trim() && !category?.trim()) {
    return reply.code(400).send({ error: 'Nothing to update' })
  }
  const { rows: g } = await pool.query('SELECT user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id])
  if (!g[0]) return reply.code(404).send({ error: 'Not found' })
  if (g[0].user_id !== req.user.id) return reply.code(403).send({ error: 'Forbidden' })
  const { rows } = await pool.query(`
    UPDATE guides SET
      title    = COALESCE($1, title),
      body     = COALESCE($2, body),
      category = COALESCE($3, category),
      region   = COALESCE($4, region)
    WHERE id = $5
    RETURNING id, title, body, category, region
  `, [title?.trim() || null, body?.trim() || null, category?.trim() || null, region !== undefined ? (region?.trim() || null) : undefined, req.params.id])
  return rows[0]
})

app.delete('/guides/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows: g } = await pool.query('SELECT user_id FROM guides WHERE id = $1 AND is_removed = false', [req.params.id])
  if (!g[0]) return reply.code(404).send({ error: 'Not found' })
  const isOwner = g[0].user_id === req.user.id
  const { rows: u } = await pool.query('SELECT is_moderator FROM users WHERE id = $1', [req.user.id])
  if (!isOwner && !u[0]?.is_moderator) return reply.code(403).send({ error: 'Forbidden' })
  await pool.query('UPDATE guides SET is_removed = TRUE WHERE id = $1', [req.params.id])
  return { removed: true }
})

await app.register(authRoutes, { pool })
await app.register(postRoutes, { pool })
await app.register(userRoutes, { pool })
await app.register(commentRoutes, { pool })
await app.register(messageRoutes, { pool })
await app.register(notificationRoutes, { pool })
await app.register(searchRoutes, { pool })
await app.register(modRoutes, { pool })
await app.register(externalRoutes)
await app.register(frequencyRoutes, { pool })
await app.register(inventoryRoutes, { pool })
await app.register(gardenRoutes, { pool })
await app.register(refRoutes, { pool })
await app.register(pushRoutes, { pool })

try {
  await runMigrations(process.env.DATABASE_URL)
  await app.ready()
  initSocket(app.server, token => app.jwt.verify(token))
  startEventNotifier()
  await app.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' })
  console.log('Fenris API running')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
