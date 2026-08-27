import { sendAlertEmail } from './email.js'
import { sendAlertPush } from './push.js'

const SEVERITY_ORDER = { minor: 0, moderate: 1, severe: 2, extreme: 3 }

const CATEGORY_KEYWORDS = {
  severe_weather: ['tornado', 'hurricane', 'tropical storm', 'high wind', 'severe thunderstorm', 'typhoon', 'cyclone'],
  flooding:       ['flood'],
  earthquake:     ['earthquake', 'seismic'],
  wildfire:       ['red flag', 'fire weather', 'wildfire'],
  winter_storm:   ['winter storm', 'blizzard', 'ice storm', 'winter weather', 'freeze warning', 'frost warning'],
  air_quality:    ['air quality', 'smoke', 'ozone'],
  tsunami:        ['tsunami'],
}

function getEventCategory(eventType) {
  const lower = (eventType ?? '').toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat
  }
  return 'other'
}

function severityMeetsThreshold(eventSeverity, userThreshold) {
  const eSev = (eventSeverity ?? '').toLowerCase()
  const uSev = (userThreshold ?? 'severe').toLowerCase()
  return (SEVERITY_ORDER[eSev] ?? -1) >= (SEVERITY_ORDER[uSev] ?? 2)
}

function categoryAllowed(eventType, userCategories) {
  if (!userCategories || userCategories.length === 0) return true
  const cat = getEventCategory(eventType)
  return userCategories.includes(cat)
}

export async function checkPendingAlerts(pool) {
  // Neither channel being configured means there's nothing this function
  // can do; either one alone is enough to proceed; the per-user checks
  // further down (notification_prefs.email / push subscriptions existing)
  // decide who actually gets which channel.
  const emailReady = !!process.env.RESEND_API_KEY
  const pushReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  if (!emailReady && !pushReady) return

  let events
  try {
    const { rows } = await pool.query(`
      SELECT id, source, event_type, title, severity, slug, properties, starts_at, expires_at, geometry
      FROM disaster_events
      WHERE severity IN ('Extreme', 'Severe')
        AND (expires_at IS NULL OR expires_at > NOW())
        AND geometry IS NOT NULL
    `)
    // Previously restricted to fetched_at > NOW() - INTERVAL '20 minutes',
    // meant to avoid re-scanning the whole active-severe-event set every
    // cycle. That silently dropped any event fetched during a worker gap
    // longer than 20 minutes (a deploy, a crash, a VPS hiccup): once that
    // window passed, the event just never got alerted on, no retry, no
    // catch-up, nothing logged. The event_alerts table's (user_id,
    // event_id) primary key already guarantees no one gets double-alerted
    // for the same event, so it's what should be doing this job, not a
    // time window: every currently-active severe/extreme event gets
    // checked every cycle, regardless of when it was first fetched.
    events = rows
  } catch (err) {
    console.error('[alerts] failed to fetch events:', err.message)
    return
  }

  if (events.length === 0) return
  console.log(`[alerts] checking ${events.length} high-severity event(s)`)

  for (const event of events) {
    let users
    try {
      const { rows } = await pool.query(`
        SELECT u.id, u.username, u.email, u.notification_prefs,
          ST_Distance(
            ST_SetSRID(ST_MakePoint(u.user_lon, u.user_lat), 4326)::geography,
            ST_Centroid($1::geometry)::geography
          ) AS centroid_dist_m
        FROM users u
        WHERE u.user_lat IS NOT NULL
          AND u.user_lon IS NOT NULL
          AND (
            (u.notification_prefs->>'email')::boolean = true
            OR (u.notification_prefs->>'push')::boolean = true
          )
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(u.user_lon, u.user_lat), 4326)::geography,
            ST_Centroid($1::geometry)::geography,
            500000
          )
          AND NOT EXISTS (
            SELECT 1 FROM event_alerts ea
            WHERE ea.user_id = u.id AND ea.event_id = $2
          )
      `, [event.geometry, event.id])
      users = rows
    } catch (err) {
      console.error(`[alerts] user query failed for event ${event.id}:`, err.message)
      continue
    }

    for (const user of users) {
      const prefs = user.notification_prefs ?? {}
      const radiusM = (prefs.radius_km ?? 150) * 1000
      if (user.centroid_dist_m > radiusM) continue
      if (!severityMeetsThreshold(event.severity, prefs.severity ?? 'severe')) continue
      if (!categoryAllowed(event.event_type, prefs.categories)) continue

      // A user can genuinely want only one channel (push but not email, or
      // vice versa), and either being unconfigured on this deploy shouldn't
      // block the other, so these are independent, not else-branches.
      if (emailReady && prefs.email) {
        await sendAlertEmail({ to: user.email, username: user.username, event })
      }
      if (pushReady && prefs.push) {
        await sendAlertPush(pool, user, event)
      }

      try {
        await pool.query(
          'INSERT INTO event_alerts (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, event.id]
        )
      } catch (err) {
        console.error(`[alerts] failed to record alert (user=${user.id}, event=${event.id}):`, err.message)
      }

      console.log(`[alerts] sent ${event.severity} alert to ${user.username} for event ${event.id}`)
    }
  }
}
