import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'

dotenv.config()

const app = Fastify({ logger: true })

// plugins
await app.register(cors, {
  origin: true
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET
})

// health check
app.get('/api/health', async (req, reply) => {
  return { status: 'ok', service: 'fenris-api' }
})

// start
try {
  await app.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' })
  console.log('Fenris API running')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
