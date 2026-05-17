# Project Fenris -- Full Platform Spec

## Reference Documents
- `full-platform-specs-final.md` -- this file. Architecture, built state, priority list, launch checklist.
- `data-sources-and-features-reference.md` -- API catalog, RSS feeds, dashboard widget ideas, unique feature concepts, calculators, reference tools. Consult when building any new data integration or tool.

---

## Vision
The world's prepper hub. The definitive home for the global preparedness community. The place every serious prepper ends up eventually because nothing else comes close.

## Mission
A self-hosted, community-driven preparedness platform. Live disaster data, crowdsourced ground truth, deep community profiles, practical tools, and a global knowledge base. All in one place, owned by the community.

## Tagline
"Stay Informed. Stay Ready."

## Live URL
projectfenris.com

## Philosophy
Quiet confidence. Serious without being heavy. Technical without gatekeeping. Preparedness as responsibility, not paranoia. Built for the world, not just the US. Simple, fast, no friction.

---

## Core UX Principle
The Dashboard IS the home page -- a live SITREP (situation report). Open Fenris and immediately get a briefing on what's happening right now. No marketing landing page. No setup required.

---

## The Pages

### 1. Dashboard (Home -- /)  [BUILT]
Widget-based SITREP dashboard. No marketing landing page. Operational from first load.

Header bar:
- Live pulse dot + "SITREP" label
- Current date and time (updates every minute)
- Severe event count badge (red) or "All clear" (green) when no active severe events
- "Edit Layout" button

Widget system:
- 8 available widgets, user-configurable layout saved to localStorage (`fenris_dashboard_layout`)
- Edit mode: move up/down, toggle full/half width, remove, add back
- Reset to default layout button
- Grid layout: 2-column desktop, 1-column mobile; full-width widgets span both columns

Available widgets (built):
- **Active Alerts** -- Severe/Extreme events sorted by severity, color-coded border, source label, area description. "No severe alerts" green state when empty. Links to /feed.
- **Live Map** -- Interactive Leaflet map (USGS + GDACS + EPA markers, radar, weather alerts). Geolocates to user on load. "Open Full Map" overlay button.
- **Event Summary** -- Total active event count, severity breakdown (Extreme/Severe/Moderate/Minor counts), source breakdown, top event types with bar chart.
- **Latest News** -- 8 most recent news items. Source badge, title, timestamp. External links open in new tab. Links to /feed.
- **Community** -- 6 most recent community + self_reported_news posts. Type badge, title, vote count, author. Links to /community.
- **Field Reports** -- Posts of type field_report. Category, title, location label. "Post a field report" CTA. Links to /community.
- **Quick Actions** -- Navigation grid (Feed, Map, Compendium, Tools, Community). Join/Sign In CTAs for unauthenticated users.
- **Inventory Status** -- Reads localStorage inventory (all 10 section caches). Shows total items, out of stock, running low, expiring soon counts. Links to /tools.

Future widgets (see data-sources-and-features-reference.md for full list and APIs):
- Space weather / solar flares (NOAA SWPC -- no key)
- River gauge levels (USGS Water -- no key)
- Hurricane tracking (NHC -- no key)
- Gold and silver spot prices (GoldPrice.org -- no key)
- Bank failures (FDIC -- no key)
- CDC outbreak alerts / wastewater surveillance (CDC -- no key)
- Power outages in region (PowerOutage.us -- unofficial)
- CISA cybersecurity alerts (no key)
- Nuclear plant status (NRC -- no key)
- Global conflict events (ACLED -- free key)
- FDA food and drug recalls (no key)

Data fetches (shared, loaded once per page load):
- `/api/events?limit=500` -- all active events
- `/api/news?limit=10` -- latest news
- `/api/posts?limit=20` -- latest posts (filtered per widget client-side)

Default layout (in order): Active Alerts (full), Live Map (full), Event Summary (half) + Latest News (half), Community (half) + Field Reports (half), Quick Actions (half) + Inventory Status (half)

TODO:
- Region-aware filtering (once onboarding captures location)
- Persist layout to users.preferences JSONB once profile system is built [DONE -- debounce-saves on change, hydrates from server on login]
- Refresh data on interval [DONE -- 5 min auto-refresh]
- Widget: Compendium top guides [DONE -- available to add]
- Widget: Weather radar standalone [DONE -- radar_widget available to add]

### 2. Feed (/feed)  [BUILT]
Combined chronological stream of disaster events + verified news + community field reports + community reports.
- Two-column layout: feed items left, filter sidebar right
- Collapses to single column on mobile with toggle button for filters
- Severe count badge in header
- Dynamic filters: Content (Events/News/Field Reports/Community Reports), Source (NOAA/USGS/GDACS/EPA), Severity, Event Type, News Category
- Reset filters button
- Field reports link through to /post/:id
- Community reports (self_reported_news) link through to /post/:id

TODO:
- Location-aware sorting (user region surfaces first)
- Filter by region

### 3. Map (/map)  [BUILT]
Full screen Leaflet map with CartoDB dark tiles.
- Event sources (toggleable): USGS seismic, GDACS global disasters, EPA air quality
- Overlay layers (toggleable): Radar (RainViewer tiles), Weather Alerts (NWS polygons), Air Traffic (OpenSky, min zoom 5 to avoid rate limits), NASA FIRMS fire layer (WMS tiles, 24h/48h/7d time range selector with confidence legend)
- Community field reports as wolf head pins (lat/lon attached to field report posts)
- Filter bar scrolls horizontally on mobile (map-filter-bar CSS class)
- Marker shapes: triangle (USGS), circle (GDACS), diamond (EPA), wolf head pin (field reports)
- Colors by severity: green (minor), amber (moderate), red (severe/extreme)
- FIRMS fire layer uses VIIRS NOAA-20 NRT feed with configurable time range

TODO:
- Click popups already show "View in Feed" and "Community" links [DONE]
- Geolocate to user region on map page load [DONE]

### 4. Community (/community)  [BUILT]
Posts with categories, Signal/Noise voting, post types (community, field_report, self_reported_news).
- Post creation (requires auth)
- Type filtering (All / Field Reports / Community / News Reports)
- Category filtering per type (contextual pills, only shows when a typed filter is active) [DONE]
- Signal vote (helpful) and Noise vote (not helpful) with remove support -- "Signal N" / "Noise N" buttons, count hidden when zero
- Sort by: Recent, Signal, Proven, Controversial
  - Recent: newest first
  - Signal: net score over time decay
  - Proven: most signal votes all time
  - Controversial: most divided (LEAST/GREATEST ratio * total votes)
- Field report posts include optional lat/lon (browser geolocation or manual entry) -- feed into wolf head pins on map
- Comments on posts (threaded, with delete)

TODO:
- Regional filtering
- Channel/topic structure (subreddit-like, see Community Section below)
- Moderation tools

### 5. Compendium (/compendium)  [BUILT]
Community guide library.
- Category sidebar (vertical on desktop, horizontal scrollable pills on mobile)
- Full text client-side search
- Guide cards with signal vote count, author, timestamp, trusted contributor badge [DONE]
- Submit guide form (requires auth)
- 12 categories built in
- Guide detail page (/compendium/:id) with full body, Signal/Noise vote buttons, signal + noise counts, comment thread, trusted contributor badges [DONE]
- Guides sorted by signal_count DESC

TODO:
- Regional threat profiles as a pinned resource type

### 6. Tools (/tools)  [BUILT -- partial]
Grid of tool cards, click to expand inline.

Built:
- Inventory Manager -- flagship tool. 8 sections (Bug Out Bag, Food & Water, Medical, Tools & Equipment, Communications, Power & Lighting, Documents, Shelter & Clothing), each its own localStorage cache. Pre-filled template checklists per section. Household data (people/pets/days) drives "Suggest build" which auto-fills par levels. Bug Out Bag section has 72-Hour, Winter Storm, Wildfire sub-scenarios. Inline qty +/-, expiry alerts, restock list, coverage progress bar per section.
- Water Storage Calculator (people, pets, days, climate/activity modifiers -- outputs total gallons, drinking/sanitation split, container counts for 55gal/5gal/1gal)
- Caloric Needs Calculator (adults, children, elderly, activity level -- daily totals, 72h/2wk/30d targets, rice/beans/oats estimate)

Stubs (coming soon):
- Risk Assessment -- zip code input pulling from USGS/NOAA/FEMA/EPA threat data

### 7. Profile (/profile/:username)  [BUILT]
Full profile page + Settings (/settings) for editing.

Built:
- Profile display: bio, avatar, prep level, focus areas, years prepping, living situation, threat focus
- Showcase section: EDC, bug out bag, vehicle kit, food/water, power, comms, medical, skills/certs
- Activity tabs: Posts, Field Reports, Guides (count badges on each)
- Signal Score (displayed as "Signal Score", backed by users.reputation column), tier badge (color-coded by score), Moderator badge
- Avatar: upload (click avatar on profile), remove, default wolf avatar
- Edit Profile links to /settings
- Settings: full profile edit form, avatar upload, password change with strength meter, 2FA setup/disable (TOTP)
- Guides tab shows signal count per guide -- noise count intentionally not shown on profile (UX decision: noise is a content quality signal, not a user shaming metric)

TODO:
- Privacy controls per field

### 8. About (/about)  [BUILT]
Platform philosophy, stats bar (data sources, countries, cost, no ads), pillars, spec copy. Linked in footer only (not main nav -- intentional).

### 9. Error Pages  [BUILT]
Tone: calm, operational, in character.
Visual: minimal wolf head, faded, single green eye.

| Code | Title | Message | CTA |
|---|---|---|---|
| 404 | Signal Lost | This location isn't on the map. Whatever you were looking for has gone dark. | Return to Base |
| 500 | Something Went Wrong | The network is experiencing interference. Our systems are aware and working to restore signal. | Try Again |
| 403 | Access Denied | You don't have clearance for this location. Make sure you're signed in. | Sign In |
| 503 | Going Dark Briefly | Project Fenris is undergoing maintenance. We'll be back online shortly. Stay ready. | none |

---

## Navigation  [BUILT]
Desktop: Logo | Feed | Map | Community | Compendium | Tools -- right: username + Sign Out (authed) or Sign In + Join (guest)
Mobile: Logo + hamburger -- dropdown with all links and auth

---

## Auth  [BUILT]
Custom JWT. Register and login pages. Token stored in httpOnly cookie (NOT localStorage). useAuth context provides user object. Protected routes redirect to /login. Fetch calls do not need Authorization headers -- cookies sent automatically.

- Onboarding flow post-registration (region, threat profile, prep level) [DONE]

TODO:
- Password reset via email

---

## Platform Layers

### Data Layer  [BUILT]
- Events: NOAA/NWS weather alerts, USGS seismic, GDACS global disasters, EPA air quality
- News: NHC, CDC, USGS News, FEMA, NWS (dedicated feeds, always stored), NPR, PBS, Reuters, Sky News (general feeds, keyword filtered)
- Worker fetches on schedule, stores to PostgreSQL
- `sources` API param allows per-page source filtering (prevents MeteoAlarm crowding)
- PostGIS ready, geometry columns in use for GDACS events
- GDACS uses GeoJSON API (not RSS) with 14-day lookback and rolling 7-day expires_at

TODO:
- Real-time updates via Socket.io
- Location-aware queries (ST_DWithin once user has location_point)

### Community Layer  [BUILT -- partial]
- Posts with categories, Signal/Noise voting (add/remove), post types exist
- Comments on posts (migration 003, API, UI)
- Field reports feed into map as wolf head pins via lat/lon on posts
- Sort: Recent, Signal, Proven, Controversial
- Vote buttons labeled "Signal" / "Noise" throughout (community list and post detail)
- Tier badge shown next to author username on post cards and comment threads

TODO:
- Regional groups

### Profile and Showcase Layer  [BUILT]
- users table with JSONB columns for preferences, focus_areas, showcase
- Migration 002 ready with all profile fields
- Profile UI fully built out with posts, field reports, guides tabs

### Knowledge Layer (Compendium)  [BUILT]
- Guides with categories, Signal/Noise binary votes, community submission
- Guide detail page with Signal/Noise vote buttons (Signal = helpful, Noise = not helpful)
- Comments on guides (same comments table, guide_id FK)
- Guide votes stored in guide_votes table (signal/noise, one vote per user per guide, upsert on switch)
- Signal count displayed in Compendium cards, Dashboard top guides widget, Profile guides tab
- Noise count displayed on guide detail page only -- intentionally hidden on profile page
- Reputation effects: guide signal received +2 / removed -2; guide noise received -1 / removed +1
- Trusted contributor badges on guide cards and guide detail page [DONE]

### Tools Layer  [BUILT -- partial]
- Water, calories, bug out bag, inventory manager built and working

TODO:
- Risk Assessment (zip code + real threat data)

### Distributed Sensor Network (V3)
Future phase. RTL-SDR, personal weather stations (Ecowitt, Ambient Weather, Davis), ham radio/APRS, air quality monitors, seismic sensors (Raspberry Shake), water level sensors, Geiger counters, solar/power monitoring, trail cameras. Contributor layer on the map. Contributors receive free pro tier. Founder as first node.

---

## Content Types

### Field Reports  [BUILT]
Short, location tagged, time sensitive. Feeds into map as wolf head pins. Can spawn community discussion threads. Lat/lon attached at post creation via browser geolocation or manual entry.

### Community Posts  [BUILT]
Longer form, gear discussion, strategy sharing, regional prep. Upvoted and sorted.

### Self Reported News  [BUILT]
Eyewitness reports of active events. Labeled as community reported. Appears in Feed alongside events and news. Reputation system discourages false reports.

### Guides and Resources  [BUILT]
Community submitted, rated, surfaced by quality.

---

## Post Categories  [BUILT IN DB]

### Field Reports
Weather Event, Natural Disaster, Infrastructure (power, water, roads), Civil Unrest, Hazmat or Environmental, Medical or Health, General Observation

### Community Posts
Gear and Equipment, Food and Water, Medical and First Aid, Shelter and Housing, Communications and Ham Radio, Evacuation and Bugging Out, Skills and Training, Homesteading and Self Sufficiency, Off Grid Living, Security and Self Defense, Financial Preparedness, Community Organizing, Regional Prep, General Discussion

### Guides
Beginner Guides, Advanced Techniques, Regional Specific, Gear Reviews, DIY and Build, Medical References, Comms and Technology, Homesteading and Farming, Off Grid Systems, Ham Radio and Comms, Security and Defense, Financial Resilience

---

## Community Section -- Dedicated Prepper Community  [PARTIALLY BUILT]

### Concept
A purpose built prepper community structured like Reddit but integrated into a platform that actually serves their needs. Topic channels people subscribe to, post in, and vote on. Not bolted on -- fully integrated with live data, tools, and profiles.

### Why It Works
r/prepperintel, r/preppers, r/collapse are huge and active but live on a generic platform with no live data, no tools, no profile showcase. Project Fenris gives that same community energy a proper home with everything they need in one place.

### Structure  [TODO]
Topic based channels similar to subreddits. Users subscribe to channels relevant to them. Posts appear in their community feed. Can browse all channels or just subscribed ones.

Default channels at launch:
- general
- field-reports
- gear-and-equipment
- food-and-water
- medical-and-first-aid
- shelter-and-housing
- comms-and-ham-radio
- bugging-out
- homesteading
- off-grid
- security-and-defense
- financial-prep
- regional (auto-created per region as community grows)

### Post Types Within Community  [PARTIAL]
- Text post [BUILT]
- Link post [TODO]
- Image post [TODO]
- Field report (special type, feeds into map via lat/lon) [BUILT]
- Guide submission (routes to compendium for rating) [TODO]
- Poll [TODO]

### Voting and Sorting  [BUILT]
- Signal vote (helpful/upvote) and Noise vote (not helpful/downvote), both add/remove [BUILT]
- Buttons labeled "Signal" / "Noise" on post cards and post detail page
- Sort by: Recent, Signal, Proven, Controversial [BUILT]
  - Recent: newest first
  - Signal: (signal - noise) / time decay -- favors net-positive posts relative to age
  - Proven: highest signal count all time
  - Controversial: most divided (LEAST/GREATEST ratio * total votes)
- Regional filter [TODO]

---

## Signal Score and Tier System  [BUILT -- partial]

### Vocabulary
- Signal = upvote. When a user votes content useful they are Signaling it.
- Noise = downvote. When a user votes content not useful they are marking it as Noise.
- Proven = the hot/trending sort. Content that has accumulated Signal over time.
- Signal Score = the user's reputation score. Called "Signal Score" everywhere in the UI.

The word Signal intentionally does double duty. A user Signals a post (verb). A user has a Signal Score (noun). Signal Score reflects how much Signal their contributions have generated.

### Signal Score Effects  [BUILT]
| Action | Effect |
|---|---|
| Someone Signals your post | +1 |
| That Signal removed | -1 |
| Someone marks your post as Noise | -1 |
| That Noise removed | +1 |
| Someone Signals your guide | +2 |
| That Signal removed | -2 |
| Someone marks your guide as Noise | -1 |
| That Noise removed | +1 |
| Field report confirmed by community | +3 |
| Field report flagged as inaccurate | -3 |
| First to report a breaking event | +5 |
| Guide downloaded as offline resource | +1 per download |
| Post cited as source by another member | +2 |

Note: first four rows (post Signal/Noise) and next four (guide Signal/Noise) are fully implemented. Field report confirmation, first report bonus, downloads, and citations are future features.

### Reputation Tiers  [BUILT -- badge display only, capability unlocks TODO]

| Signal Score | Title | Badge Color | Why |
|---|---|---|---|
| 0-100 | Member | none | Default, no badge clutter |
| 101-500 | Contributor | #94A3B8 slate | Understated -- you're giving back |
| 501-1000 | Trusted Contributor | #3B82F6 blue | Calm, reliable, community trusts your content |
| 1001-2500 | Operator | #F97316 orange | Active, skilled, operationally engaged |
| 2500+ | Sentinel | #F59E0B gold | Universal prestige, top tier |

Special: Founding Member -- first 100 users, permanent #A78BFA purple badge regardless of score. [TODO -- flag not yet implemented]

Tier is derived from users.reputation INTEGER at query time -- no separate tier column. Badge shown next to author username on post cards, comment threads, guide cards, and profile page. Member tier shows no badge.

users.is_trusted BOOLEAN = true for Trusted Contributor and above (used for permission checks).
users.is_moderator BOOLEAN = true for Operator and above.

### Capability Unlocks  [TODO]
- Contributor: advanced feed filters, source suggestions
- Trusted Contributor: guide priority placement, verify community reports, contributor analytics
- Operator: regional moderation, verify field reports
- Sentinel: platform advisory input, early feature access, permanent gold Sentinel badge

### What Complements Power Users
- Contributor analytics -- see how many people read their guides, used their field reports
- Regional authority -- recognized expert in their area
- Profile showcase prominence -- trusted contributors appear higher in regional member lists
- Direct line to platform feedback -- their bug reports and suggestions get priority attention

---

## Comprehensive Resource Goal

Project Fenris should minimize the need for users to go elsewhere. Everything a serious prepper needs in one place:
- What is happening right now (sitrep dashboard, map)
- What their local community is reporting (feed, field reports)
- Trusted news sources (curated RSS feeds)
- Their inventory and prep status (inventory manager)
- Guides and resources (compendium)
- Community discussion and advice (community section)
- Tools and calculators (tools suite)
- Their prep profile and showcase (deep profiles)

### Seed Content Strategy
Platform needs content before community can contribute meaningfully. Founder writes initial guides to set tone and quality bar.

Priority guide topics to write first:
- 72 hour emergency kit fundamentals
- Water storage and purification
- Food storage basics and rotation
- Communications -- from cell phones to ham radio
- Regional threat assessment (how to evaluate your area)
- Bug out bag builder guide
- Power outage preparedness
- Medical supplies for preppers
- Financial preparedness basics
- Community organizing for neighborhood resilience

### RSS Feed Curation Strategy
Curate manually before exposing options to users. Quality over quantity. Twenty reliable feeds beats two hundred noisy ones. Vet each source before adding. Users choose from curated list, not raw internet.

---

## Discord Community

### Purpose
Behind the scenes community during development. Founding members help write guides, suggest RSS sources, test features, shape platform culture. They arrive at launch already invested.

### Launch Timing
When there is something real to show. projectfenris.com is already live with a working map. That is enough.

### Structure at Launch
- announcements
- general
- feedback
- bug-reports
- show-your-preps
- guide-writing (collaborative guide development)
- source-suggestions (RSS feed recommendations)
- regional channels as they fill up

### Discord to Platform Pipeline
Discord members become founding members on the platform. Discord activity informs what features get built. Platform members get invited to Discord. Community exists in both places and reinforces itself.

---

## Community Guidelines

One principle: don't waste each other's time.

Hard rules:
- No spam or repeated posts
- No unsourced fearmongering
- No political content
- Disclose affiliate relationships
- Include location context on regional posts
- Community reports must be clearly labeled as such

---

## User Reputation System  [BUILT -- partial]
- Signal Score (users.reputation) built and live -- post and guide votes affect it in real time
- Tier badges displayed next to author names throughout the platform (post cards, comments, guide cards, profile)
- Tier derived from score at query time -- no separate column
- High signal score members get elevated guide visibility (sorted by signal_count DESC)
- Capability unlocks and moderation privileges per tier -- TODO

### Signal Score Tier System

Tier thresholds, display names, badge colors:

| Score | Tier | Short Label | Badge Color |
|---|---|---|---|
| 0-100 | Member | (no badge) | -- |
| 101-500 | Contributor | Contrib | #94A3B8 (slate) |
| 501-1000 | Trusted Contributor | Trusted | #3B82F6 (blue) |
| 1001-2499 | Operator | Operator | #F97316 (orange) |
| 2500+ | Sentinel | Sentinel | #F59E0B (gold) |

Badge renders as a small pill next to the author name wherever authors appear:
- Post cards in Community feed
- Post detail page
- Comment threads (posts and guides)
- Guide cards in Compendium
- Guide detail page
- User profile header (full tier title, larger pill)

Noise count intentionally hidden on user profile pages. Only shown on post detail and guide detail pages where it provides content-level feedback, not user judgment.

---

## Signal Source System  [TODO -- V2]

Self-hosted data contributors who run active feeds (weather stations, ham radio, sensors, etc.) earn a separate Signal Source badge. This is distinct from the tier system -- it marks infrastructure contribution, not content contribution.

### What Qualifies

**Tier 1 data sources (V2 launch targets):**
- Personal weather stations (WU API, Open-Meteo integration)
- APRS/ham radio (via APRS-IS gateway)
- ADS-B receivers (dump1090 / tar1090 feed)
- Air quality monitors (Purple Air, DIY PM2.5)
- Geiger / radiation counters (DIY or commercial with API)

**Tier 2 data sources (V3):**
- Seismic sensors (Raspberry Shake, similar)
- Water level gauges (stream / flood monitoring)
- Off-grid power monitors (solar, battery bank telemetry)
- Meshtastic / LoRa mesh nodes (offline mesh coverage reporting)
- Agricultural sensors (soil moisture, freeze alert)

**Tier 3 data sources (V3+):**
- AIS marine receivers
- Custom industrial sensors with JSON API

### Signal Source Badge

- Color: #06B6D4 (cyan -- distinct from all tier badge colors)
- Label: "Signal Source" or abbreviated feed type (e.g. "WX", "APRS", "ADS-B")
- Displayed in profile header alongside (not instead of) tier badge
- Map attribution: contributor's username shown on markers originating from their feed
- Does not replace or affect tier score -- separate axis entirely

### Contributor Benefits

- Small passive Signal Score bonus: +1 per week while feed is verified active (capped at +52/year)
- Free access to Operator-tier features for as long as feed remains active
- Personal sensor dashboard: uptime metrics, data quality score, rolling charts of own feed
- Custom alerts from own sensors (e.g. "alert me when my PWS drops below 28F")
- API access to own historical data export
- Map pin attribution with username on all community-sourced markers

### Feed Verification

Feed must be:
- Returning valid data for the last 24 hours
- Updating at least once per hour (configurable per feed type)
- Within geographic plausibility check (coordinates make sense for user's region)

Verified status checked nightly. Badge and benefits pause if feed goes dark for more than 48 hours. Automatically restored when feed resumes.

### Founder Node

Founder (vhespir) plans to self-host personal data feeds. This serves a dual purpose: validates the contributor pipeline before opening to the public, and ensures the map has at least one active community node at launch. Founder node is not held to the 48-hour lapse rule during development.

### DB Schema Additions (V2)

```sql
signal_sources
  id, user_id, feed_type VARCHAR, feed_url TEXT,
  label TEXT, latitude NUMERIC, longitude NUMERIC,
  is_verified BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()

signal_source_readings
  id, source_id, reading JSONB, recorded_at TIMESTAMPTZ
  -- rolling window, older rows pruned by worker
```

### UI Surface (V2)

- Profile page: Signal Source badge + feed type label in header, sensor dashboard tab
- Map: community feed markers use contributor's username as tooltip attribution
- Admin/moderator: feed verification queue, lapse notifications

---

## Personalization  [TODO]
Location only at launch. User sets region during onboarding. Local content surfaces first in feed. Map defaults to their region. Community shows their region first. No complex preference engines at launch.

---

## Onboarding Flow  [BUILT -- partial]
Three steps, skippable at any point. Runs after registration.

Step 1: Set region (state and county) [DONE]
Step 2: Choose threat profile (multi-select chips) [DONE]
Step 3: Set prep level (beginner/intermediate/advanced/expert) [DONE]
Saves via PATCH /api/users/me. Redirects to /feed on finish.

TODO:
- Step: Notification preferences (email, severity threshold, quiet hours) -- requires email system
- Land on feed filtered to user region -- requires location-aware feed queries

---

## Database Schema  [BUILT -- migrations 001-007 applied]

```sql
users
  id, email, password_hash, username, region,
  reputation INTEGER DEFAULT 0,
  is_trusted BOOLEAN, is_moderator BOOLEAN,
  threat_profile JSONB, preferences JSONB,
  bio, avatar_url, prep_level, focus_areas JSONB,
  years_prepping, living_situation, showcase JSONB,
  created_at

news_items
  id, source, title, url, summary,
  category, region, published_at, created_at

posts
  id, user_id, post_type, category, title, body,
  location_label, latitude, longitude,
  region, upvote_count, downvote_count, is_removed, created_at

guides
  id, user_id, title, body, category, region,
  signal_count INTEGER DEFAULT 0,
  noise_count INTEGER DEFAULT 0,
  is_removed, created_at, updated_at

guide_votes
  user_id, guide_id, vote VARCHAR(6) CHECK (vote IN ('signal', 'noise'))
  PRIMARY KEY (user_id, guide_id)

comments
  id, post_id (nullable FK -> posts), guide_id (nullable FK -> guides),
  user_id, body, is_removed, created_at

disaster_events
  id, source, event_type, title, severity,
  geometry PostGIS, properties JSONB, external_id,
  fetched_at, starts_at, expires_at

upvotes
  user_id, post_id
  PRIMARY KEY (user_id, post_id)

downvotes
  user_id, post_id
  PRIMARY KEY (user_id, post_id)
```

### Reputation (signal score) effects
| Action | Delta |
|---|---|
| Post upvote received | +1 |
| Post upvote removed | -1 |
| Post downvote received | -1 |
| Post downvote removed | +1 |
| Guide signal received | +2 |
| Guide signal removed | -2 |
| Guide noise received | -1 |
| Guide noise removed | +1 |

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Vite + TypeScript | BUILT |
| Backend | Node.js + Fastify | BUILT |
| Database | PostgreSQL + PostGIS | BUILT |
| Real-time | Socket.io | TODO |
| Auth | Custom JWT (httpOnly cookie) | BUILT |
| Hosting | Sentinel VPS via Docker Compose | BUILT |
| Reverse Proxy | Nginx | BUILT |
| Map | Leaflet.js + react-leaflet | BUILT |
| Email | Resend | TODO |
| Backups | Backblaze B2 | TODO |

---

## Design System  [BUILT]

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| Background | #0A0A0A | Page background |
| Surface | #111111 | Cards, panels |
| Surface elevated | #171717 | Modals, dropdowns |
| Border | #262626 | Dividers, outlines |
| Text primary | #F4F4F5 | Body text, headings |
| Text muted | #71717A | Secondary text, timestamps |
| Text subtle | #3F3F46 | Placeholder, disabled |
| Accent green | #22C55E | CTAs, live indicators, verified badges |
| Accent hover | #4ADE80 | Hover states |
| Danger | #EF4444 | Severe alerts, errors |
| Warning | #F59E0B | Moderate alerts, warnings |
| Info | #3B82F6 | Informational states |

### Where Green Appears
Live data pulsing indicator, active alerts, verified badges, CTA buttons, key stats, wolf eye in logo. Nowhere else.

### Typography
| Role | Font | Usage |
|---|---|---|
| Display | Space Grotesk | Headings, navigation, labels |
| Body | Inter | Posts, guides, news, long form |
| Monospace | Fira Code | Data, coordinates, timestamps |

---

## Map Layers and Marker System

### Data Sources
**Event Sources (toggleable):**
- USGS: seismic events  [BUILT]
- GDACS: global disasters (GeoJSON API, 14-day lookback, rolling 7-day expires_at)  [BUILT]
- EPA: air quality  [BUILT]

**Overlay Layers (toggleable):**
- Radar: RainViewer weather radar tiles  [BUILT]
- Weather Alerts: NWS active alert polygons  [BUILT]
- Air Traffic: OpenSky live ADS-B (min zoom 5)  [BUILT]
- NASA FIRMS: fire events WMS tiles (VIIRS NOAA-20 NRT) -- 24h/48h/7d time range selector, confidence legend  [BUILT]

**Community:**
- Field reports from members as wolf head pins (lat/lon on posts)  [BUILT]

### Marker Shapes by Source
| Shape | Source |
|---|---|
| Triangle | USGS seismic |
| Circle | GDACS global disasters |
| Diamond | EPA air quality |
| WMS tile layer | NASA FIRMS fire events |
| Wolf head pin | Community field reports |

### Colors by Severity
| Color | Severity |
|---|---|
| #22C55E | Minor, advisory, watch |
| #F59E0B | Moderate, warning |
| #EF4444 | Severe, emergency |
| #71717A | Expired, informational |

---

## News Feed Architecture  [BUILT -- partial]

### Source Tiers

**Tier 1 -- Always on, locked:**  [BUILT]
NWS, NOAA, USGS, FEMA, CDC, EPA, NHC. Authoritative, low volume, high signal. No noise possible.

**Tier 2 -- On by default, user can toggle off:**  [BUILT]
NPR (Top Stories, Around the Nation, Environment), PBS NewsHour, Reuters, Sky News World, Sky News US. Keyword filtered at ingest. Toggleable in Feed sidebar under "News Source".

**Tier 3 -- Off by default, user opts in:**  [TODO]
Regional outlets, additional sources as platform grows.

**Tier 4 -- Community:**  [BUILT]
Self reported news and field reports shown in Feed stream with toggleable filters. Location filtering via Near Me toggle (500km Haversine) when user has coordinates set.

Note: AP and Reuters are not freely available via RSS. AP has a paid API, Reuters shut down public RSS. Add when budget allows via NewsAPI.org or similar paid aggregator. Reuters currently served via rss.app proxy feed.

### Filtering Stack
Applied in order:
1. Location -- Near Me toggle (client-side Haversine, 500km) against event GeoJSON geometry  [BUILT]
2. Source -- event source toggles (NOAA, USGS, GDACS, EPA) and news source toggles  [BUILT]
3. Severity -- Extreme/Severe/Moderate/Minor filter buttons  [BUILT]
4. Event type -- dynamic list from fetched events  [BUILT]
5. News category -- dynamic list from fetched news  [BUILT]
6. Keyword -- saved keyword matching across all content types  [TODO]
7. User preference-based filters -- category, radius, severity threshold from preferences JSONB  [TODO]

### Location Architecture  [BUILT]
users table has user_lat / user_lon DOUBLE PRECISION columns (migration 009). Geocoded server-side via Nominatim (OpenStreetMap) when the user saves their region in settings or onboarding -- no API key required. Feed uses client-side Haversine distance against event GeoJSON geometry for "Near Me" filtering (500km radius). Events without geometry always show. News and posts are not distance-filtered (text region only).

"Near Me" toggle visibility requirement: migration 009 must have run (Docker rebuild) AND the user must save their region in Settings to trigger geocoding. Existing accounts with region set before migration 009 will not have coordinates until they re-save. The toggle is hidden if user_lat / user_lon are null.

### User Preferences Schema (JSONB in users table -- column added in migration 006, UI TODO)
```json
{
  "feed": {
    "sources": ["noaa", "usgs", "npr"],
    "categories": ["weather", "seismic", "fire"],
    "radius": "state",
    "keywords": ["power outage", "tornado warning"],
    "severity": "moderate"
  }
}
```

### Feed Item Labels
Every item shows:
- Source badge (NOAA, USGS, NPR, Community, Field Report)
- Region tag
- Category tag
- Severity dot (color coded)
- Timestamp

---

## Email System  [BUILT -- partial]
Provider: Resend (free tier, 3000 emails/month)
Package: `resend` installed in api.
Env vars required: `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Project Fenris <no-reply@projectfenris.com>`), `BASE_URL` (e.g. `https://projectfenris.com`)
Template utility: `api/lib/email.js` -- dark-themed HTML templates matching Fenris design.

### Welcome Email  [BUILT]
Subject: "Welcome to Project Fenris"
Fires on successful registration, non-blocking (not awaited). Fails silently with console log.
CTA: Open the Feed. Prompt to set region for location-aware alerts.

### Alert Email  [BUILT -- utility ready, triggers TODO]
Subject: "[SEVERITY] Event Type -- Area"
Severity, area, source, issued, expires, description excerpt. CTAs: View on Map, Community Reports.
`sendAlertEmail({ to, username, event })` is implemented in `api/lib/email.js`.
TODO: wire triggers -- query users near event region, deduplicate per event per user, call from worker on Extreme/Severe ingest.

### Notification Tiers
- Email: welcome on register (live), severe event alerts (trigger TODO)
- SMS: future phase when monetization supports it

---

## Notification System  [BUILT -- partial]
In-app bell icon in navbar with unread count badge and dropdown. Notifications fire on new comments to your posts and guides (not your own comments). Bell polls count every 60 seconds. Dropdown marks individual or all notifications read, navigates to linked content.

Triggers live:
- New comment on a post you authored
- New comment on a guide you authored

Triggers TODO:
- Severe/extreme event ingested matching user region (requires location_point + PostGIS)
- Email delivery via Resend

User controls TODO: severity threshold, event types, quiet hours.

---

## Search Architecture  [TODO]
V1: PostgreSQL full text search. tsvector columns, GIN indexes, filter by type, region, date, severity.
Future: Meilisearch when PostgreSQL becomes a bottleneck.

---

## Monetization Roadmap

### Phase 1: Community Supported
Voluntary supporter tier, badge and recognition, Ko-fi for one time donations.

### Phase 2: Freemium
Free: map, feed, community, basic profile.
Pro: extended alert history, advanced filters, granular notifications, data export.
Contributor: free pro in exchange for active data feed.

### Phase 3: Platform
Contributor feed analytics, verified organizational accounts, anonymized data licensing, SMS alerts via Twilio.

No ads. Ever.

---

## Global Expansion
Internationalization architecture built in from day one. English first. International data sources added as community grows. Translation follows naturally. Community self organizes regionally.

---

## Unique Features (Long-Term Differentiators)
Full detail and APIs in data-sources-and-features-reference.md.

**High value -- nobody has built these:**
- **Mutual Aid Network Map** -- opt-in map of local members by skill and supply. Who nearby has medical training, ham radio, food stores, shelter.
- **Emergency Frequency Database** -- searchable local emergency frequencies by county. Police, fire, EMS, ham repeaters, NOAA weather radio. Consolidates radioreference.com, RepeaterBook, state agency data.
- **After Action Reports** -- structured format for members to document real emergencies they survived. What worked, what failed. Most valuable prep content that exists nowhere in organized form.
- **Regional Threat Calendar** -- when is tornado season, hurricane season, fire season for each region. Historical event data overlaid. Prep at the right time of year.
- **Bug Out Route Planner** -- location to destination with vehicle type, fuel, road conditions, hazard zones. Real-time data integration.
- **Prep Score / Readiness Assessment** -- comprehensive readiness rating across water, food, medical, comms, power, shelter, security, financial, community. Like a credit score for preparedness.

**Medium value:**
- Prep Challenge System (monthly community challenges driving real readiness improvement)
- Solar Panel / Rainwater / Firewood calculators (region-specific using NOAA data)
- Local Resource Database (crowdsourced water sources, edible plants, fuel, feed stores)
- Skill Exchange board (I can teach X, you teach Y -- builds real emergency networks)
- Verified Local Expert Directory (ham operators, medical professionals, farmers, mechanics)

---

## Remaining Build Priority

### High Priority (core product gaps)
1. Severe event alert emails -- wire `sendAlertEmail` into worker on Extreme/Severe ingest, query users by region, deduplicate per event per user

### Medium Priority (community and engagement)
1. Search (PostgreSQL full text -- tsvector/GIN)
2. Risk Assessment tool (zip code + USGS/NOAA/FEMA/EPA)
3. Channel/topic structure for Community (subreddit-like)

### Lower Priority (polish and scale)
4. Moderation queue dashboard (mod remove buttons exist on posts/comments -- full mod queue TODO)
5. Real-time updates via Socket.io
6. Keyword feed filtering (user-saved keywords matched against news/events)

### Already built (removed from list)
- Profile page UI (built)
- Onboarding flow (built)
- Community field reports in Feed stream (built)
- Self-reported news in Feed stream (built)
- Downvote + controversial filter (built)
- Tier/reputation system and badges (built)
- In-app notification bell (built)
- Feed location awareness -- Near Me toggle, Nominatim geocoding (built)

### Infrastructure
- SSL on projectfenris.com
- Backblaze B2 backups
- Uptime monitoring

---

## Launch Checklist
- [x] Widget-based SITREP dashboard (8 widgets, user-configurable layout, localStorage persistence)
- [x] Feed pulling real data from all sources
- [x] Map showing live events (USGS, GDACS, EPA, radar, weather alerts, air traffic)
- [x] NASA FIRMS fire layer on map (24h/48h/7d, VIIRS NOAA-20)
- [x] Community field reports as wolf head pins on map
- [x] Community posts working end to end (create, upvote, downvote, sort)
- [x] Comments on posts and guides
- [x] Compendium with guide detail, Signal/Noise votes, and comments
- [x] Inventory Manager tool (flagship -- 8 sections, templates, suggested build)
- [x] Auth (register, login, logout, httpOnly cookie JWT)
- [x] Mobile responsive (all pages)
- [x] About page
- [x] Error pages (404, 500, 403, 503)
- [x] Profile page fully built out (bio, avatar, prep level, showcase, posts/field reports/guides tabs, signal score)
- [x] Onboarding flow (region, threat profile, prep level)
- [x] In-app notification bell (comment notifications, unread badge, mark read)
- [x] Feed location awareness (Near Me toggle, Haversine filter, Nominatim geocoding on region save)
- [x] Welcome email via Resend on registration (RESEND_API_KEY + EMAIL_FROM + BASE_URL required in env)
- [ ] Basic moderation tools
- [ ] Performance acceptable on Sentinel
- [ ] Used personally for several weeks
- [ ] Backblaze B2 backups running
- [ ] SSL configured on projectfenris.com
- [ ] Uptime monitoring active

---

## Target Launch Communities
r/prepperintel, r/preppers, r/collapse, r/homesteading, r/SHTF, ham radio communities, homesteading Facebook groups, Twitter/X prepper community

---

## About Page Copy  [BUILT]

Project Fenris exists for people who pay attention.

Not out of fear. Out of habit. Out of a belief that knowing what's happening, early and clearly, is one of the most responsible things a person can do.

The information has always been out there. The tools exist. The community exists. But they've always been scattered across subreddits, bookmark folders, and apps that never talk to each other. No single place to watch, prepare, and connect.

Project Fenris is not a doomsday platform. No bunkers, no collapse fantasies, no gear affiliate links. Just real data, practical tools, and a community of people who believe preparedness is about responsibility. To yourself. To your neighbors. To the people around you when things go sideways.

The wolf watches. So do we.

---

## Domain
projectfenris.com
