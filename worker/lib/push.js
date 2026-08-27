import webpush from 'web-push'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:contact@projectfenris.com'

let configured = false
function ensureConfigured() {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

// Sends one push notification to one subscription. Returns 'sent',
// 'gone' (the subscription is dead, endpoint expired or the user revoked
// permission, caller should delete it), or 'error' (a transient failure,
// worth leaving the subscription alone and trying again next time).
export async function sendPush(subscription, payload) {
  if (!ensureConfigured()) return 'error'
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return 'sent'
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'gone'
    console.error('[push] send failed:', err.statusCode ?? '', err.message)
    return 'error'
  }
}

export async function sendAlertPush(pool, user, event) {
  const { rows: subs } = await pool.query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [user.id]
  )
  if (!subs.length) return

  const payload = {
    title: `${event.severity}: ${event.title}`,
    body: (event.event_type ?? '').replace(/_/g, ' '),
    url: event.slug ? `/event/${event.slug}` : '/dashboard',
  }

  for (const sub of subs) {
    const result = await sendPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    if (result === 'gone') {
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {})
    }
  }
}
