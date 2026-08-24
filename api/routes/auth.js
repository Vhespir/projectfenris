import bcrypt from 'bcrypt'
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib'
import qrcode from 'qrcode'
import crypto from 'node:crypto'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/email.js'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === 'production',
}

const PRE_AUTH_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 10 * 60,
  secure: process.env.NODE_ENV === 'production',
}

const LOGIN_RATE    = { max: 10, timeWindow: '15 minutes' }
const REGISTER_RATE = { max: 5,  timeWindow: '1 hour' }
const TOTP_RATE     = { max: 10, timeWindow: '15 minutes' }

const PWD_REQUIREMENTS = [
  [/.{8,}/,        'Password must be at least 8 characters'],
  [/[A-Z]/,        'Password must contain at least one uppercase letter'],
  [/[a-z]/,        'Password must contain at least one lowercase letter'],
  [/[0-9]/,        'Password must contain at least one number'],
  [/[^A-Za-z0-9]/, 'Password must contain at least one special character'],
]

function validatePassword(pwd) {
  for (const [re, msg] of PWD_REQUIREMENTS) {
    if (!re.test(pwd)) return msg
  }
  return null
}

export async function authRoutes(app, { pool }) {
  app.post('/auth/register', {
    config: { rateLimit: REGISTER_RATE },
  }, async (req, reply) => {
    const { username, email, password } = req.body ?? {}

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'username, email, and password are required' })
    }
    if (username.length < 3 || username.length > 50) {
      return reply.code(400).send({ error: 'Username must be 3-50 characters' })
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return reply.code(400).send({ error: 'Username may only contain letters, numbers, underscores, and hyphens' })
    }
    const pwdErr = validatePassword(password)
    if (pwdErr) return reply.code(400).send({ error: pwdErr })

    const passwordHash = await bcrypt.hash(password, 12)

    try {
      const { rows } = await pool.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, reputation, is_trusted, avatar_url, two_fa_enabled, created_at`,
        [username.trim(), email.trim().toLowerCase(), passwordHash]
      )
      const user = rows[0]
      const token = app.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '30d' })
      reply.setCookie('session', token, COOKIE_OPTS)
      sendWelcomeEmail(user.username, user.email)
      return reply.code(201).send({ user })
    } catch (err) {
      if (err.code === '23505') {
        const field = err.constraint?.includes('email') ? 'email' : 'username'
        return reply.code(409).send({ error: `That ${field} is already taken` })
      }
      throw err
    }
  })

  app.post('/auth/login', {
    config: { rateLimit: LOGIN_RATE },
  }, async (req, reply) => {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password are required' })
    }

    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash, reputation, is_trusted, avatar_url,
              two_fa_enabled, created_at, is_banned, banned_reason
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    )

    const hash = rows[0]?.password_hash ?? '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const valid = await bcrypt.compare(password, hash)

    if (!rows.length || !valid) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    const user = rows[0]
    if (user.is_banned) {
      return reply.code(403).send({ error: `This account has been banned${user.banned_reason ? `: ${user.banned_reason}` : '.'}` })
    }
    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id])

    if (user.two_fa_enabled) {
      const preAuthToken = app.jwt.sign({ id: user.id, pre_auth: true }, { expiresIn: '10m' })
      reply.setCookie('pre_auth', preAuthToken, PRE_AUTH_OPTS)
      return { requires_2fa: true }
    }

    const { password_hash: _, two_fa_enabled: __, is_banned: ___, banned_reason: ____, ...safeUser } = user
    const token = app.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '30d' })
    reply.setCookie('session', token, COOKIE_OPTS)
    return { user: safeUser }
  })

  app.post('/auth/2fa/verify', {
    config: { rateLimit: TOTP_RATE },
  }, async (req, reply) => {
    const { totp_code } = req.body ?? {}
    if (!totp_code) return reply.code(400).send({ error: 'totp_code is required' })

    const preAuthCookie = req.cookies?.pre_auth
    if (!preAuthCookie) return reply.code(401).send({ error: 'No pending authentication' })

    let payload
    try {
      payload = app.jwt.verify(preAuthCookie)
    } catch {
      return reply.code(401).send({ error: 'Authentication expired. Please sign in again.' })
    }

    if (!payload.pre_auth) return reply.code(401).send({ error: 'Invalid authentication state' })

    const { rows } = await pool.query(
      `SELECT id, username, email, reputation, is_trusted, avatar_url,
              totp_secret, two_fa_enabled, created_at
       FROM users WHERE id = $1`,
      [payload.id]
    )
    if (!rows.length) return reply.code(401).send({ error: 'User not found' })

    const user = rows[0]
    if (!user.two_fa_enabled || !user.totp_secret) {
      return reply.code(400).send({ error: '2FA is not enabled on this account' })
    }

    const { valid: isValid } = await verifyTotp({ token: String(totp_code), secret: user.totp_secret, epochTolerance: 30 })
    if (!isValid) return reply.code(401).send({ error: 'Invalid authentication code' })

    reply.clearCookie('pre_auth', { path: '/' })
    const { totp_secret: _s, two_fa_enabled: _e, ...safeUser } = user
    const token = app.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '30d' })
    reply.setCookie('session', token, COOKIE_OPTS)
    return { user: safeUser }
  })

  app.post('/auth/2fa/setup', {
    onRequest: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT email FROM users WHERE id = $1`, [req.user.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })

    const secret = generateSecret()
    const otpauthUrl = generateURI({ strategy: 'totp', issuer: 'Project Fenris', label: rows[0].email, secret })
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl)

    await pool.query(
      `UPDATE users SET totp_secret = $1, two_fa_enabled = false WHERE id = $2`,
      [secret, req.user.id]
    )

    return { qrDataUrl, secret }
  })

  app.post('/auth/2fa/enable', {
    onRequest: [app.authenticate],
    config: { rateLimit: TOTP_RATE },
  }, async (req, reply) => {
    const { totp_code } = req.body ?? {}
    if (!totp_code) return reply.code(400).send({ error: 'totp_code is required' })

    const { rows } = await pool.query(
      `SELECT totp_secret, two_fa_enabled FROM users WHERE id = $1`, [req.user.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })
    if (!rows[0].totp_secret) return reply.code(400).send({ error: 'Complete setup first' })
    if (rows[0].two_fa_enabled) return reply.code(400).send({ error: '2FA is already enabled' })

    const { valid: isValid } = await verifyTotp({ token: String(totp_code), secret: rows[0].totp_secret, epochTolerance: 30 })
    if (!isValid) return reply.code(401).send({ error: 'Invalid code. Check your authenticator app.' })

    await pool.query(`UPDATE users SET two_fa_enabled = true WHERE id = $1`, [req.user.id])
    return { ok: true }
  })

  app.post('/auth/2fa/disable', {
    onRequest: [app.authenticate],
    config: { rateLimit: TOTP_RATE },
  }, async (req, reply) => {
    const { totp_code } = req.body ?? {}
    if (!totp_code) return reply.code(400).send({ error: 'totp_code is required' })

    const { rows } = await pool.query(
      `SELECT totp_secret, two_fa_enabled FROM users WHERE id = $1`, [req.user.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })
    if (!rows[0].two_fa_enabled) return reply.code(400).send({ error: '2FA is not enabled' })

    const { valid: isValid } = await verifyTotp({ token: String(totp_code), secret: rows[0].totp_secret, epochTolerance: 30 })
    if (!isValid) return reply.code(401).send({ error: 'Invalid code' })

    await pool.query(
      `UPDATE users SET two_fa_enabled = false, totp_secret = null WHERE id = $1`, [req.user.id]
    )
    return { ok: true }
  })

  app.patch('/auth/password', {
    onRequest: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const { current_password, new_password } = req.body ?? {}
    if (!current_password || !new_password) {
      return reply.code(400).send({ error: 'current_password and new_password are required' })
    }
    const pwdErr = validatePassword(new_password)
    if (pwdErr) return reply.code(400).send({ error: pwdErr })

    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`, [req.user.id]
    )
    if (!rows.length) return reply.code(404).send({ error: 'User not found' })

    const valid = await bcrypt.compare(current_password, rows[0].password_hash)
    if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' })

    const newHash = await bcrypt.hash(new_password, 12)
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, req.user.id])
    return { ok: true }
  })

  app.post('/auth/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { email } = req.body ?? {}
    if (!email) return reply.code(400).send({ error: 'Email is required' })

    const { rows } = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    )

    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000)
      await pool.query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [token, expires, rows[0].id]
      )
      sendPasswordResetEmail(rows[0].username, rows[0].email, token)
    }

    return { message: 'If that email is registered, a reset link has been sent.' }
  })

  app.post('/auth/reset-password', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { token, password } = req.body ?? {}
    if (!token || !password) return reply.code(400).send({ error: 'Token and password are required' })

    const pwdErr = validatePassword(password)
    if (pwdErr) return reply.code(400).send({ error: pwdErr })

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [token]
    )
    if (!rows[0]) return reply.code(400).send({ error: 'Invalid or expired reset link' })

    const hash = await bcrypt.hash(password, 12)
    await pool.query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [hash, rows[0].id]
    )
    return { message: 'Password updated. You can now sign in.' }
  })

  app.delete('/auth/logout', async (req, reply) => {
    reply.clearCookie('session', { path: '/' })
    return { ok: true }
  })

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    const { rows } = await pool.query(
      `SELECT id, username, email, reputation, is_trusted, is_moderator,
              region_state, region_county, avatar_url, two_fa_enabled,
              preferences, notification_prefs, created_at, last_seen_at, user_lat, user_lon,
              muted_until, (id <= 100) AS is_founding_member
       FROM users WHERE id = $1`,
      [req.user.id]
    )
    if (!rows.length) throw { statusCode: 404, message: 'User not found' }
    return rows[0]
  })
}
