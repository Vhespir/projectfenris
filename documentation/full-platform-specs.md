# Project Fenris -- Full Platform Spec

## Vision
The world's prepper hub. The definitive home for the global preparedness community. The place every serious prepper ends up eventually because nothing else comes close.

## Mission
A self-hosted, community-driven preparedness platform. Live disaster data, crowdsourced ground truth, deep community profiles, practical tools, and a global knowledge base. All in one place, owned by the community.

## Tagline
"Stay Informed. Stay Ready."

## Philosophy
Quiet confidence. Serious without being heavy. Technical without gatekeeping. Preparedness as responsibility, not paranoia. Built for the world, not just the US.

---

## Platform Layers

### 1. Data Layer
- Live map (Leaflet.js) showing NOAA alerts, USGS earthquakes, FEMA declarations, EPA air quality
- Verified news feed aggregated from NWS, USGS, FEMA, Reuters, AP, local RSS feeds
- Real time updates via Socket.io
- Publicly accessible, no account required
- Global data sources expanding over time

### 2. Community Layer
- Self reported news and field reports from members on the ground
- Location tagged, time stamped, categorized
- Regional groups and hyperlocal filtering
- Upvoting and reputation system for accuracy
- Clear visual distinction between verified sources and community reports
- Global regions supported by PostGIS architecture

### 3. Profile and Showcase Layer
- Deep customizable profiles
- Every field optional with granular privacy controls
- Members can showcase their preps, gear, and setups
- Inspires others while respecting opsec preferences

**Profile sections:**

Identity:
- Username, avatar, location (as specific or vague as desired), join date, contributor status, reputation score

Preparedness Profile:
- Prep level: beginner, intermediate, advanced, expert
- Focus areas: food storage, medical, comms, off grid, security, bugging out
- Years prepping, living situation

Showcase:
- EDC, bug out bag, vehicle kit
- Food and water storage setup
- Power and energy systems
- Communications setup
- Medical supplies
- Skills and certifications (first aid, ham radio license, wilderness survival)

Activity:
- Posts and guides contributed
- Field reports submitted
- Contributor feed status
- Reputation and badges

### 4. Knowledge Layer (Compendium)
- Community contributed guides and resources
- Regional threat profiles
- Skill references covering water, medical, comms, food, and shelter
- Rating system where high rated guides surface to the top
- Trusted contributor badges for established members
- Cross cultural knowledge exchange as global community grows

### 5. Tools Layer
- Supply calculator
- Inventory tracker
- Bug out bag builder with scenario checklists
- Risk assessment by region
- Evacuation route planner
- Caloric and water storage calculators

### 6. Distributed Sensor Network (Contributor Network)
- Members contribute their own live data feeds
- RTL-SDR feeds (ADS-B, NOAA satellite imagery, weather balloon sondes)
- Personal weather stations (Ecowitt, Ambient Weather, Davis)
- Ham radio and APRS data
- Air quality monitors (PurpleAir, CO2, particulate)
- Seismic sensors (Raspberry Shake)
- Water level sensors
- Geiger counters
- Solar and power monitoring
- Trail cameras and security feeds
- Data appears on community map as contributor layer
- Contributors receive free pro tier as incentive
- Starts with founder as first node, grows organically

---

## Content Types

### Field Reports
- Anyone can post
- Short, location tagged, time sensitive
- Feeds directly into the map as community pins
- Examples: road conditions, power outages, local hazards

### Community Posts
- Anyone can post
- Longer form, gear discussion, strategy sharing, regional prep
- Upvoted and sorted by quality

### Self Reported News
- Anyone can post
- Eyewitness reports of active events
- Clearly labeled as community reported vs verified source
- Reputation system discourages false reports

### Guides and Resources
- Anyone can submit
- Goes through community rating before being featured
- High rated guides pinned to regional resource pages
- Trusted contributors get elevated initial visibility

---

## Post Categories

### Field Reports
- Weather Event
- Natural Disaster
- Infrastructure (power, water, roads)
- Civil Unrest
- Hazmat or Environmental
- Medical or Health
- General Observation

### Community Posts
- Gear and Equipment
- Food and Water
- Medical and First Aid
- Shelter and Housing
- Communications and Ham Radio
- Evacuation and Bugging Out
- Skills and Training
- Homesteading and Self Sufficiency
- Off Grid Living
- Security and Self Defense
- Financial Preparedness
- Community Organizing
- Regional Prep
- General Discussion

### Guides
- Beginner Guides
- Advanced Techniques
- Regional Specific
- Gear Reviews
- DIY and Build
- Medical References
- Comms and Technology
- Homesteading and Farming
- Off Grid Systems
- Ham Radio and Comms
- Security and Defense
- Financial Resilience

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

## User Reputation System
- Reputation built through quality contributions over time
- High reputation members get elevated guide visibility
- Eventually moderation privileges in home region
- False reports damage reputation score
- Trusted Contributor badge for established members

---

## Monetization (Future)

### Phase 1: Community Supported
- Voluntary supporter tier
- Badge and recognition, no paywall on core features
- Ko-fi or similar for one time donations

### Phase 2: Freemium
- Free tier: map, feed, community, basic profile
- Pro tier: extended alert history, advanced map filters, granular notification controls, data export
- Contributor tier: free pro in exchange for active data feed contribution

### Phase 3: Data and Platform
- Contributor feed analytics for pro contributors
- Verified organizational accounts for emergency management, news outlets
- Anonymized aggregated data licensing to researchers and planners
- SMS alerts via Twilio once revenue supports it

### What to avoid
No ads. Ever. Undermines trust and contradicts the platform philosophy.

---

## V1 Scope

Pages:
- Landing: hero, value pillars, live map preview, join CTA
- Live Map: full interactive map, toggleable data layers
- News Feed: verified sources plus community reports combined
- Community: regional posts, field reports
- Individual Post
- User Profile (basic in V1, deep showcase in V2)
- Register and Login

Features:
- Live map with NOAA, USGS, FEMA, EPA data
- Combined news feed (verified plus community)
- User accounts with region setting
- Post creation with category and location tags
- Upvoting and basic reputation
- Search and filter by region and category

---

## Deliberately Out of V1
- Deep profile showcase
- Tools and calculators
- Compendium and knowledge base
- Contributor sensor network
- Mobile app
- Monetization
- Internationalization (architecture supports it, UI deferred)

---

## Global Expansion Roadmap
- Internationalization architecture built in from day one (PostGIS, region tagging, metric and imperial units)
- English first launch
- International data sources added as community grows (regional equivalents of NOAA, USGS, FEMA)
- Translation follows naturally as international members join
- Community self organizes regionally

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Fastify |
| Database | PostgreSQL + PostGIS |
| Real-time | Socket.io |
| Auth | Auth.js |
| Hosting | Sentinel VPS via Docker Compose |
| Reverse Proxy | Nginx |
| Map | Leaflet.js |
| Email | Resend |

---

## Design Direction
- Dark background, near black
- Green accent used sparingly and intentionally
- Minimal chrome, data forward
- Geometric wolf logo (Project Fenris identity)
- Dashboard aesthetic meets editorial design
- Mobile responsive from day one

## Color Palette

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
| Accent green hover | #4ADE80 | Hover states |
| Danger | #EF4444 | Severe alerts, errors |
| Warning | #F59E0B | Moderate alerts, warnings |
| Info | #3B82F6 | Informational states |

## Where Green Appears
- Live data pulsing indicator
- Active alerts on the map
- Verified and trusted contributor badges
- CTA buttons
- Key stats and numbers
- Wolf eye in the logo

## Typography

| Role | Font | Usage |
|---|---|---|
| Display | Space Grotesk | Headings, navigation, labels, UI elements |
| Body | Inter | Posts, guides, news, long form reading |
| Monospace | FiraCode | Data readouts, coordinates, timestamps, code |

---

## Map Marker System

Shape communicates type, color communicates severity.

### Shapes
- Circle: weather events (NOAA)
- Triangle: seismic (USGS)
- Square: federal declarations (FEMA)
- Diamond: air quality (EPA)
- Pin: community field reports (wolf head icon at higher zoom)

### Colors by Severity
- Green #22C55E: minor, advisory, watch
- Yellow #F59E0B: moderate, warning
- Red #EF4444: severe, emergency
- Gray #71717A: expired or informational

---

## Onboarding Flow

Five steps, under two minutes, skippable at any point.

**Step 1 -- Set Your Region**
State and county minimum. Optional precise location for hyperlocal filtering.

**Step 2 -- Choose Your Threat Profile**
Checkboxes for relevant local threats: tornado, hurricane, earthquake, wildfire, flood, winter storm, civil unrest, and others.

**Step 3 -- Notification Preferences**
Email, browser push, or both. Severity threshold: all events, moderate and above, or severe only.

**Step 4 -- Explore Prompt**
Land on the live map filtered to their region.

**Step 5 -- Optional Profile Setup**
Username, brief bio, skills or experience tags.

---

## Email System

Provider: Resend (free tier, 3000 emails/month)
Library: Nodemailer pointed at Resend SMTP
Env: RESEND_API_KEY

### Welcome Email
Subject: "Welcome to Project Fenris"
Content: Confirms region is set, map is live, feed is ready. Single CTA back to the map.

### Alert Email
Subject: "[SEVERITY] Event Type -- Region"
Content: Type, severity, location, source, issued, expires, brief description. Two CTAs: View on Map, Community Reports.

### Notification Tiers
- Email: moderate and above, daily digest option
- SMS: reserved for future monetization phase

---

## Error Pages

Tone: calm, operational, in character.
Visual: minimal wolf head, faded, single green eye.

### 404
Title: "Signal Lost"
Message: "This location isn't on the map. Whatever you were looking for has gone dark."
CTA: "Return to Base"

### 500
Title: "Something Went Wrong"
Message: "The network is experiencing interference. Our systems are aware and working to restore signal."
CTA: "Try Again"

### 403
Title: "Access Denied"
Message: "You don't have clearance for this location. Make sure you're signed in."
CTA: "Sign In"

### 503
Title: "Going Dark Briefly"
Message: "Project Fenris is undergoing maintenance. We'll be back online shortly. Stay ready."

---

## News Feed Sources

### V1 Launch Sources
**Government and Official:**
- NOAA/NWS, USGS, FEMA, CDC, EPA, DHS, NHC

**Wire Services:**
- AP News, Reuters

**Public Broadcasting:**
- NPR News, PBS NewsHour

### Future Regional and Global Expansion
- Local TV, newspaper, and radio RSS by region
- State and municipal emergency management
- International equivalents of NOAA, USGS, FEMA by country
- Community submitted local sources
- Regional ham radio nets

---

## Notification System

### Trigger Logic
1. New event ingested from data sources
2. PostGIS checks event geometry against user regions
3. Queue notification if event meets user threshold
4. Deliver via email and in-app bell

### User Controls
- Severity threshold, event types, quiet hours
- Manage from profile settings

---

## Search Architecture

### V1: PostgreSQL Full Text Search
- tsvector columns on posts, guides, events
- GIN indexes for performance
- Filter by content type, region, date, severity

### Future: Meilisearch
Self hostable, migrate when PostgreSQL search becomes a bottleneck.

---

## Launch Strategy

### Soft Launch Checklist
- [ ] Live map pulling real data from all sources
- [ ] News feed showing verified content
- [ ] Community posts working end to end
- [ ] User registration and onboarding complete
- [ ] Notification emails sending via Resend
- [ ] Mobile responsive
- [ ] Error pages in place
- [ ] Basic moderation tools available
- [ ] Performance acceptable on Sentinel
- [ ] Used personally for several weeks
- [ ] Backblaze B2 backups running
- [ ] SSL configured on projectfenris.com
- [ ] Uptime monitoring active

### Target Communities
- r/prepperintel, r/preppers, r/collapse, r/homesteading, r/SHTF
- Ham radio communities
- Homesteading Facebook groups
- Twitter/X prepper community

---

## Domain
projectfenris.com

---

## Build Order
1. Docker stack stable locally
2. Database schema and migrations
3. Data ingestion worker (NOAA, USGS, FEMA, EPA)
4. Live map frontend
5. News feed (verified sources)
6. Auth: register, login, sessions
7. Community posts and field reports
8. Self reported news with reputation system
9. Deep profile and showcase
10. Landing page polish
11. Deploy to Sentinel