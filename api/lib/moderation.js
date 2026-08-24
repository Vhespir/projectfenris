// Shared mute check for every content/message creation route. Muting is
// deliberately narrower than banning -- a muted user can still browse, vote,
// and read DMs sent to them, just not create new posts/comments/guides/
// AARs/messages until muted_until passes. Banning is enforced globally in
// api/index.js's `authenticate` decorator instead, since it should block
// everything, not just creation.

export async function checkMuted(pool, userId, reply) {
  const { rows } = await pool.query('SELECT muted_until FROM users WHERE id = $1', [userId])
  const until = rows[0]?.muted_until
  if (until && new Date(until) > new Date()) {
    reply.code(403).send({ error: `You are muted until ${new Date(until).toLocaleString()}` })
    return true
  }
  return false
}
