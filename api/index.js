import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'
import pg from 'pg'
import { runMigrations } from './db/migrate.js'
import { authRoutes } from './routes/auth.js'
import { postRoutes } from './routes/posts.js'
import { userRoutes } from './routes/users.js'

dotenv.config()

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })
await app.register(jwt, { secret: process.env.JWT_SECRET })

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized' })
  }
})

app.get('/health', async () => ({ status: 'ok', service: 'fenris-api' }))

app.get('/events', async (req) => {
  const { source, severity, limit = 500 } = req.query
  let query = `
    SELECT id, source, event_type, title, severity,
           ST_AsGeoJSON(geometry)::json AS geometry,
           properties, external_id, starts_at, expires_at, fetched_at
    FROM disaster_events
    WHERE (expires_at IS NULL OR expires_at > NOW())
  `
  const params = []
  if (source) { params.push(source); query += ` AND source = $${params.length}` }
  if (severity) { params.push(severity); query += ` AND severity = $${params.length}` }
  params.push(Math.min(Number(limit), 1000))
  query += ` ORDER BY fetched_at DESC LIMIT $${params.length}`
  const { rows } = await pool.query(query, params)
  return rows
})

app.get('/news', async (req) => {
  const { limit = 50 } = req.query
  const { rows } = await pool.query(
    `SELECT id, source, title, url, summary, category, region, published_at
     FROM news_items ORDER BY published_at DESC NULLS LAST LIMIT $1`,
    [Math.min(Number(limit), 200)]
  )
  return rows
})

await app.register(authRoutes, { pool })
await app.register(postRoutes, { pool })
await app.register(userRoutes, { pool })

try {
  await runMigrations(process.env.DATABASE_URL)
  await app.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' })
  console.log('Fenris API running')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
