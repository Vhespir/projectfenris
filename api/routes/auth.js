import bcrypt from 'bcrypt'

export async function authRoutes(app, { pool }) {
  app.post('/auth/register', async (req, reply) => {
    const { username, email, password } = req.body ?? {}

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'username, email, and password are required' })
    }
    if (username.length < 3 || username.length > 50) {
      return reply.code(400).send({ error: 'Username must be 3-50 characters' })
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    try {
      const { rows } = await pool.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, reputation, is_trusted, created_at`,
        [username.trim(), email.trim().toLowerCase(), passwordHash]
      )
      const user = rows[0]
      const token = app.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '30d' })
      return reply.code(201).send({ token, user })
    } catch (err) {
      if (err.code === '23505') {
        const field = err.constraint?.includes('email') ? 'email' : 'username'
        return reply.code(409).send({ error: `That ${field} is already taken` })
      }
      throw err
    }
  })

  app.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password are required' })
    }

    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash, reputation, is_trusted, created_at
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    )

    if (!rows.length) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id])

    const { password_hash: _, ...safeUser } = user
    const token = app.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '30d' })
    return { token, user: safeUser }
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      `SELECT id, username, email, reputation, is_trusted, is_moderator,
              region_state, region_county, created_at, last_seen_at
       FROM users WHERE id = $1`,
      [req.user.id]
    )
    if (!rows.length) throw { statusCode: 404, message: 'User not found' }
    return rows[0]
  })
}
