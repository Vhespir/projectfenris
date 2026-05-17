import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? 'Project Fenris <onboarding@resend.dev>'
const BASE_URL = process.env.BASE_URL ?? 'https://projectfenris.com'

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background:#0A0A0A; color:#F4F4F5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin:0; padding:0; }
    .wrap { max-width:560px; margin:40px auto; padding:32px 24px; }
    .logo { font-size:15px; font-weight:700; letter-spacing:0.08em; color:#F4F4F5; margin-bottom:36px; }
    .logo span { color:#22C55E; }
    h1 { font-size:22px; font-weight:700; margin:0 0 14px; color:#F4F4F5; line-height:1.3; }
    p { font-size:14px; line-height:1.65; color:#A1A1AA; margin:0 0 20px; }
    .btn { display:inline-block; background:#22C55E; color:#0A0A0A; padding:11px 26px; border-radius:6px; text-decoration:none; font-weight:700; font-size:13px; }
    .btn-outline { display:inline-block; color:#A1A1AA; padding:10px 20px; border-radius:6px; text-decoration:none; font-size:13px; border:1px solid #262626; margin-left:10px; }
    .meta { font-size:12px; font-family:monospace; color:#52525B; background:#111111; border:1px solid #262626; border-radius:6px; padding:14px 16px; margin-bottom:20px; line-height:1.8; }
    .meta strong { color:#A1A1AA; }
    hr { border:none; border-top:1px solid #1C1C1C; margin:28px 0; }
    .footer { font-size:11px; color:#3F3F46; line-height:1.6; }
    .severity-extreme, .severity-severe { color:#EF4444; font-weight:700; }
    .severity-moderate { color:#F59E0B; font-weight:700; }
    .severity-minor { color:#22C55E; font-weight:700; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">PROJECT <span>FENRIS</span></div>
    ${content}
    <hr>
    <div class="footer">
      projectfenris.com &middot; Stay Informed. Stay Ready.<br>
      You received this because you have email alerts enabled on Project Fenris.<br>
      Manage your alert preferences in <a href="${BASE_URL}/settings" style="color:#52525B">Settings</a>.
    </div>
  </div>
</body>
</html>`
}

export async function sendAlertEmail({ to, username, event }) {
  if (!resend) return
  const sev = event.severity?.toLowerCase() ?? 'unknown'
  const sevClass = `severity-${sev}`
  const props = event.properties ?? {}
  const area = props.areaDesc ?? props.headline ?? event.title
  const issued = event.starts_at
    ? new Date(event.starts_at).toLocaleString('en-US', { timeZoneName: 'short' })
    : 'Unknown'
  const expires = event.expires_at
    ? new Date(event.expires_at).toLocaleString('en-US', { timeZoneName: 'short' })
    : 'Until further notice'

  const html = baseTemplate(`
    <h1><span class="${sevClass}">[${event.severity?.toUpperCase()}]</span> ${event.event_type?.replace(/_/g, ' ')}</h1>
    <p style="color:#F4F4F5;margin-bottom:8px">Hi ${username},</p>
    <p>A high-severity event has been detected near your region.</p>
    <div class="meta">
      <strong>Area:</strong> ${area}<br>
      <strong>Source:</strong> ${event.source?.toUpperCase()}<br>
      <strong>Issued:</strong> ${issued}<br>
      <strong>Expires:</strong> ${expires}
    </div>
    ${props.description ? `<p>${props.description.slice(0, 400)}${props.description.length > 400 ? '...' : ''}</p>` : ''}
    <a href="${BASE_URL}/map" class="btn">View on Map</a>
    <a href="${BASE_URL}/community" class="btn-outline">Community Reports</a>
  `)

  const areaLabel = typeof area === 'string' ? area.slice(0, 60) : ''
  const subject = `[${event.severity?.toUpperCase()}] ${event.event_type?.replace(/_/g, ' ')} -- ${areaLabel}`

  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[email] alert send failed:', err?.message)
  }
}
