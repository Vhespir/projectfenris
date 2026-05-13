# Project Fenris -- Full Platform Spec

## Mission
A self-hosted, community-driven preparedness platform. Live disaster data, crowdsourced ground truth, practical tools, and a knowledge base. All in one place, owned by the community.

## Tagline
"Stay Informed. Stay Ready."

## Philosophy
Quiet confidence. Serious without being heavy. Technical without gatekeeping. Preparedness as responsibility, not paranoia.

---

## Platform Layers

### 1. Data Layer
- Live map (Leaflet.js) showing NOAA alerts, USGS earthquakes, FEMA declarations, EPA air quality
- Verified news feed aggregated from NWS, USGS, FEMA, Reuters, AP, local RSS feeds
- Real time updates via Socket.io
- Publicly accessible, no account required

### 2. Community Layer
- Self reported news and field reports from members on the ground
- Location tagged, time stamped, categorized
- Regional groups and hyperlocal filtering
- Upvoting and reputation system for accuracy
- Clear visual distinction between verified sources and community reports

### 3. Knowledge Layer (Compendium)
- Community contributed guides and resources
- Regional threat profiles
- Skill references covering water, medical, comms, food, and shelter
- Rating system where high rated guides surface to the top
- Trusted contributor badges for established members

### 4. Tools Layer
- Supply calculator
- Inventory tracker
- Bug out bag builder with scenario checklists
- Risk assessment by region
- Evacuation route planner
- Caloric and water storage calculators

### 5. Contributor Network (V3)
- Members can submit their own data feeds
- RTL-SDR feeds, personal weather stations, scanner audio
- Appears on community map as contributor data layer
- Opt-in, power user feature

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

## Launch Strategy

### Philosophy
Don't rush. Launch when it feels right. One shot at a first impression.

### Target Communities for Soft Launch
- r/prepperintel
- r/preppers
- r/collapse
- r/homesteading
- r/SHTF
- Ham radio communities
- Homesteading Facebook groups
- Twitter/X prepper community

### Approach
Soft launch in one or two subreddits with a genuine post. Not a promotion. "I built this thing, here's what it does, looking for feedback from people who would actually use it." Early adopters from that community become founding members who set the culture.

### Soft Launch Checklist
Do not launch until all of these are true:

- [ ] Live map pulling real data from NOAA, USGS, FEMA, EPA
- [ ] News feed showing verified source content
- [ ] Community posts working end to end
- [ ] User registration and onboarding complete
- [ ] Notification emails sending correctly via Resend
- [ ] Mobile responsive, looks good on phone
- [ ] Error pages in place
- [ ] Basic moderation tools available
- [ ] Performance acceptable on Sentinel
- [ ] Used personally for several weeks and trusted
- [ ] Backblaze B2 backups running on database
- [ ] SSL configured on projectfenris.com
- [ ] Uptime monitoring active

---

## Search Architecture

### V1: PostgreSQL Full Text Search
Built in, no extra infrastructure, good enough for early stage.

**Searchable content:**
- Disaster events by type, location, severity
- Community posts by keyword, region, category
- Guides by topic, category, keyword
- News by keyword, source, region

**Implementation:**
- tsvector columns on posts, guides, and events tables
- GIN indexes for fast full text queries
- Search endpoint in Fastify API
- Filter by content type, region, date range, severity

### Future: Meilisearch
Self hostable, lightweight, excellent relevance scoring. Migrate when PostgreSQL search becomes a bottleneck. Runs comfortably on Sentinel alongside existing stack.

---

## Notification System

### Trigger Logic
1. New event ingested from NOAA, USGS, FEMA, or EPA
2. System checks event geometry against all user regions via PostGIS
3. If event overlaps user region and meets severity threshold, queue notification
4. Deliver via email (Resend) and in-app notification bell

### Delivery Channels
- Email: Resend, for users not actively on site
- In-app: notification bell, real time via Socket.io for active users
- SMS: future phase, severe and extreme only

### User Controls
- Severity threshold: all events, moderate and above, severe only
- Event types: weather, seismic, federal declarations, air quality, community reports
- Quiet hours: suppress non-extreme notifications between user defined hours
- Manage preferences from profile settings at any time

### Notification Queue
- Worker service handles notification dispatch
- Batches non-urgent notifications to avoid email flooding
- Extreme severity bypasses batching and sends immediately
- Tracks sent notifications to prevent duplicates

---

## News Feed Sources

### V1 Launch Sources (National, Non-Biased, Authoritative)

**Government and Official:**
- NOAA/NWS: weather.gov alerts RSS
- USGS: earthquake.usgs.gov feeds
- FEMA: fema.gov disaster declarations
- CDC: emergency preparedness feeds
- EPA: airnow.gov air quality
- DHS: ready.gov alerts
- NHC: National Hurricane Center RSS

**Wire Services:**
- AP News: disaster and emergency categories
- Reuters: US news and environment

**Public Broadcasting:**
- NPR News: factual, widely trusted
- PBS NewsHour: emergency and national news

### Future Regional Expansion

**Local News:**
- Local TV station RSS feeds by state and metro
- Local newspaper RSS feeds
- Local radio station emergency feeds

**State Level:**
- State emergency management agencies
- State departments of health and transportation
- State fire marshal and forestry

**Regional Government:**
- County emergency management offices
- Municipal alert systems
- Regional transit authorities

**Specialty Regional:**
- Regional NWS offices filterable by area
- USGS regional seismic networks
- Regional air quality management districts
- River gauge and flood monitoring by watershed

**Community Sourced (Contributor Network Phase):**
- Member submitted local RSS feeds
- Verified local sources added by trusted contributors
- Regional ham radio nets

### Source Architecture
Each source tagged with region in database. National sources show for all users. Regional sources filter by user location. Users can add custom sources in later versions.

---

## Error Pages

Tone: calm, operational, in character. Never apologetic or corporate.
Visual: minimal wolf head, faded, single green eye. Radar aesthetic.

### 404 -- Page Not Found
Title: "Signal Lost"
Message: "This location isn't on the map. Whatever you were looking for has gone dark."
CTA: "Return to Base"

### 500 -- Server Error
Title: "Something Went Wrong"
Message: "The network is experiencing interference. Our systems are aware and working to restore signal."
CTA: "Try Again"
Visual note: wolf eye flickering via subtle CSS animation

### 403 -- Unauthorized
Title: "Access Denied"
Message: "You don't have clearance for this location. Make sure you're signed in."
CTA: "Sign In"

### 503 -- Maintenance
Title: "Going Dark Briefly"
Message: "Project Fenris is undergoing maintenance. We'll be back online shortly. Stay ready."
No CTA, show expected return time if known.

---

## Email System

Provider: Resend (free tier, 3000 emails/month)
Library: Nodemailer pointed at Resend SMTP
Env: RESEND_API_KEY

### Welcome Email
Subject: "Welcome to Project Fenris"
Content: Confirms region is set, map is live, feed is ready. Single CTA back to the map. Short, functional, no fluff.

### Alert Email
Subject: "[SEVERITY] Event Type -- Region"
Content: Type, severity, location, source, issued, expires, brief description. Two CTAs: View on Map, Community Reports. Plain text friendly, no images.

### Notification Tiers
- Email: moderate and above, daily digest option
- SMS: reserved for future monetization phase

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
State and county minimum. Optional precise location for hyperlocal filtering. Makes the feed and map immediately relevant.

**Step 2 -- Choose Your Threat Profile**
Checkboxes for relevant local threats: tornado, hurricane, earthquake, wildfire, flood, winter storm, civil unrest, and others. Personalizes alert preferences and map filters.

**Step 3 -- Notification Preferences**
Email, browser push, or both. Severity threshold: all events, moderate and above, or severe only.

**Step 4 -- Explore Prompt**
Land on the live map filtered to their region. First experience shows the platform already working for them, not an empty feed.

**Step 5 -- Optional Profile Setup**
Username, brief bio, skills or experience tags. Optional but encourages early identity investment.

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

## V1 Scope

Pages:
- Landing: hero, value pillars, live map preview, join CTA
- Live Map: full interactive map, toggleable data layers
- News Feed: verified sources plus community reports combined
- Community: regional posts, field reports
- Individual Post
- User Profile
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
- Tools and calculators
- Compendium and knowledge base
- Contributor network
- Mobile app
- Monetization

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

---

## Design Direction
- Dark background, near black
- Green accent used sparingly and intentionally -- signals live, active, verified, important
- Minimal chrome, data forward
- Geometric wolf logo (Project Fenris identity)
- Monospace or geometric sans typography
- Dashboard aesthetic meets editorial design
- Mobile responsive from day one

## Typography

| Role | Font | Usage |
|---|---|---|
| Display | Space Grotesk | Headings, navigation, labels, UI elements |
| Body | Inter | Posts, guides, news, long form reading |
| Monospace | FiraCode | Data readouts, coordinates, timestamps, code |

All three available free on Google Fonts.

---

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

## Where It Stays Neutral
- Body text
- Navigation
- Post content
- Background surfaces
- Most UI chrome

---

## Domain
projectfenris.com

---

## Build Order
1. Docker stack running locally
2. Database schema and migrations
3. Data ingestion worker (NOAA, USGS, FEMA, EPA)
4. Live map frontend
5. News feed (verified sources)
6. Auth: register, login, sessions
7. Community posts and field reports
8. Self reported news with reputation system
9. Landing page polish
10. Deploy to Sentinel
