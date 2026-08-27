# Project Fenris: Roadmap / TODO

Running list of things discussed and deliberately deferred, so they don't
get lost. Not a formal process, just a shared memory.

## Data sources (verified free/working, not yet built)

- **Cloudflare Radar**: free API, tracks internet outages and traffic
  anomalies per country/region in near-real-time. Real signal for
  detecting state-level internet shutdowns during unrest.
- **EPA RadNet**: near-real-time radiation monitoring network, free API.
- **NOAA Storm Events Database (NCEI)**: decades of historical severe
  weather by county, free. Batch/bulk dataset, not a live feed. Would
  power "here's your area's real track record" instead of generic advice.
- **FAA TFR feed** (`tfr.faa.gov/tfrapi/exportTfrList`): confirmed working,
  free, no key. Pairs with the existing air traffic layer. Standout pick,
  build this one first among the data sources.
- **OpenFEMA** (`fema.gov/api/open/v2/DisasterDeclarationsSummaries`):
  confirmed working, free, no key. Every federal disaster declaration by
  county, historical and current.

## Checked and ruled out

- **DOE EAGLE-I power outage data**: the live/near-real-time feed sits
  behind a FEMA-partner API token, not actually open. Historical archives
  (2014-2025) are free bulk downloads from Oak Ridge National Lab, but
  that's not worth wiring up as a live feature.
- **Road511** (unified multi-state traffic camera API): paid only (14-day
  free trial, then $29-299/mo). Not pursuing, see below for the
  free-but-fragmented alternative.

## Traffic cameras (scoped, not started)

No free unified national API exists. Each state DOT runs its own system.
WSDOT (Washington) is the easiest real starting point: free API, just
email them for an access code, still-image snapshots (not video, ~90s
refresh). Full coverage means integrating states one at a time, real
per-state effort, not a single build.

## Life-saving features

- ~~Web Push notifications~~: **shipped.** Reuses the exact proximity +
  severity matching logic in `worker/lib/alerts.js`, adds a second
  delivery channel alongside email (`worker/lib/push.js`, `api/routes/
  push.js`, `frontend/public/sw.js`, a Settings toggle). Needs
  `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` set (see `.env.example`) to
  actually send; silently skipped otherwise, same as unset RESEND_API_KEY
  already did for email. Also fixed while in there: the alert check used
  to only look at events fetched in the last 20 minutes, so an event
  fetched during a worker downtime gap (a deploy, a crash) longer than
  that silently never got alerted on, no retry. Now checks every
  currently-active severe/extreme event every cycle and relies on the
  `event_alerts` table's per-user-per-event primary key to prevent
  double-sends, which is the actual right tool for that job.
- **Site-wide banner for an active severe event near you**: catches
  anyone browsing who hasn't (or can't) grant push permission. Cheap,
  complements push rather than replacing it. Not built yet.
- SMS alerts: more reliable than push for someone without the browser
  permission granted, but has a real per-message cost (Twilio-class
  pricing). Worth it only if push turns out not to be enough.

## Explicitly declined / out of scope for now

- Native long-form video hosting (creator content): real storage/compute
  cost, set aside in favor of allowing embeds from other platforms
  instead.
- Live streaming (build-your-own): same reasoning, embedding existing
  platforms' live streams is the practical answer, not hosting streams
  ourselves.
