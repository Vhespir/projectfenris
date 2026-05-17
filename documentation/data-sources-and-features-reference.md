# Project Fenris -- Data Sources and Features Reference

## How to Use This Document
This is a reference library of every data source, API, RSS feed, widget concept, tool idea, and feature possibility for Project Fenris. It is NOT a build list. When building a specific feature consult this document for the relevant API or feed. Build one thing at a time with focused prompts.

---

## Free APIs and RSS Feeds

### Emergency and Disaster

**NOAA/NWS:**
- Active weather alerts: `https://api.weather.gov/alerts/active`
- All alerts GeoJSON: `https://api.weather.gov/alerts`
- Zone alerts: `https://api.weather.gov/alerts/active/zone/{zoneId}`
- No API key required

**National Hurricane Center:**
- Atlantic: `https://www.nhc.noaa.gov/index-at.xml`
- Pacific: `https://www.nhc.noaa.gov/index-ep.xml`
- All advisories: `https://www.nhc.noaa.gov/nhc_at1.xml`

**USGS Earthquakes:**
- Past hour all: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`
- Past hour significant: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson`
- Past day M2.5+: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson`
- Past 7 days M4.5+: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson`
- No API key required

**GDACS Global Disasters:**
- RSS: `https://www.gdacs.org/xml/rss.xml`
- GeoJSON API: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS`
- No API key required

**FEMA:**
- Disaster declarations: `https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries`
- News releases: `https://www.fema.gov/feeds/news-releases.xml`
- No API key required

**USGS Volcanoes:**
- Volcano notifications: `https://volcanoes.usgs.gov/vns2/`

**Pacific Tsunami Warning Center:**
- `https://tsunami.gov/events/xml/PAAQAtom.xml`

**NOAA Space Weather SWPC:**
- Alerts JSON: `https://services.swpc.noaa.gov/products/alerts.json`
- 3-day forecast: `https://services.swpc.noaa.gov/text/3-day-forecast.txt`
- Planetary K-index: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
- No API key required

**NASA FIRMS Fire:**
- WMS tiles already implemented
- CSV API: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{API_KEY}/VIIRS_SNPP_NRT/{area}/{days}`
- Free API key at firms.modaps.eosdis.nasa.gov

**Lightning Strikes:**
- Blitzortung.org: `https://www.blitzortung.org/en/live_lightning_maps.php`
- Real-time WebSocket feed available for registered users
- Free for non-commercial use

**Avalanche:**
- `https://avalanche.org/avalanche-center-api/` (varies by center)

**USGS River Gauges and Flood:**
- Current conditions: `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd={state}&parameterCd=00060,00065`
- No API key required

**Drought Monitor:**
- JSON API: `https://droughtmonitor.unl.edu/api/`
- No API key required

**ProMED Infectious Disease:**
- RSS: `https://promedmail.org/feed/`

**WHO Disease Outbreaks:**
- RSS: `https://www.who.int/feeds/entity/csr/don/en/rss.xml`

**CDC Wastewater Surveillance (NWSS):**
- Early warning disease tracking via sewage
- API: `https://data.cdc.gov/resource/2ew6-ywp6.json`
- No API key required
- Valuable early warning system -- detects disease spread before clinical cases appear

**Wildfire Perimeters NIFC:**
- GeoJSON: `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Current_WildlandFire_Perimeters/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson`
- No API key required

---

### Financial and Economic

**Gold and Silver:**
- GoldAPI.io: `https://www.goldapi.io/api/XAU/USD` -- free tier 100 requests/month
- Metals-API: `https://metals-api.com/api/latest?access_key={KEY}&base=USD&symbols=XAU,XAG`
- GoldPrice.org free: `https://data-asg.goldprice.org/dbXRates/USD` -- no key required
- Best free option: goldprice.org -- scrapeable or use their API

**Oil Prices WTI:**
- EIA API: `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key={KEY}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=5`
- Free EIA API key at eia.gov/opendata

**Inflation and CPI:**
- BLS API: `https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0`
- Free registration at bls.gov for higher rate limits

**Federal Reserve:**
- Press releases RSS: `https://www.federalreserve.gov/feeds/press_all.xml`
- FRED economic data: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL`
- M2 money supply: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL`
- Velocity of money: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2V`
- Yield curve: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y`

**Bank Failures FDIC:**
- `https://banks.data.fdic.gov/api/failures?fields=name,cert,faildate&sort_by=faildate&sort_order=DESC&limit=10&format=json`
- No API key required

**Treasury Yields:**
- Daily rates: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve`

**USDA Commodity Prices:**
- Market news RSS: `https://www.ams.usda.gov/market-news/rss`
- API: `https://marsapi.ams.usda.gov/services/v1.2/reports` -- free registration

**FAO Food Price Index:**
- `https://www.fao.org/worldfoodsituation/foodpricesindex/en/`

**Baltic Dry Index:**
- Leading economic indicator -- shipping costs
- Available via quandl.com or investing.com scraping

**Unemployment Claims:**
- BLS weekly: `https://api.bls.gov/publicAPI/v2/timeseries/data/ICSA`

**Crypto (optional):**
- CoinGecko: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd`
- Free, no API key for basic tier

---

### Infrastructure and Grid

**Power Outages:**
- PowerOutage.us: `https://poweroutage.us/api/web/1.1/outagedata` -- unofficial
- EIA grid monitor: `https://www.eia.gov/electricity/gridmonitor/`
- Note: No clean free public API for live outage data

**Nuclear Plant Status NRC:**
- Power reactor status: `https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactor.txt`
- No API key required

**Pipeline Incidents PHMSA:**
- RSS: `https://www.phmsa.dot.gov/news/rss.xml`

**FAA Flight Delays:**
- Airport status: `https://nasstatus.faa.gov/api/airport-status-information`
- No API key required

**CISA Cybersecurity:**
- Alerts RSS: `https://www.cisa.gov/uscert/ncas/alerts.xml`
- Advisories RSS: `https://www.cisa.gov/uscert/ncas/advisories.xml`
- Current activity: `https://www.cisa.gov/uscert/ncas/current-activity.xml`
- No API key required

**EPA RadNet Radiation:**
- Near real-time: `https://www.epa.gov/radnet/near-real-time-and-laboratory-data-state`

**Radmon.org Community Radiation:**
- Live network: `https://www.radmon.org/radmon.php?task=getjson&user=guest&passwd=guest&limit=100`
- Free, community operated global radiation monitoring network

**Coast Guard Marine Safety:**
- Local notices: `https://navcen.uscg.gov/?pageName=lnmMain`

**GPS Disruption:**
- FAA GPS NOTAMs: `https://notams.faa.gov/notamSearch/`

---

### Medical and Health

**CDC:**
- Health alerts RSS: `https://emergency.cdc.gov/rss/index.asp`
- MMWR RSS: `https://www.cdc.gov/mmwr/rss/rss.html`
- Outbreaks RSS: `https://www.cdc.gov/rss/outbreaks.xml`
- FluView (flu activity): `https://www.cdc.gov/flu/weekly/flureport.htm`
- Wastewater surveillance: `https://data.cdc.gov/resource/2ew6-ywp6.json`

**FDA:**
- Food safety recalls RSS: `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/rss`
- Drug recalls API: `https://api.fda.gov/drug/enforcement.json?limit=10&sort=report_date:desc`
- Drug shortages: `https://api.fda.gov/drug/shortages.json`
- No API key required for basic tier

**USDA FSIS Food Recalls:**
- RSS: `https://www.fsis.usda.gov/rss/recalls.xml`

**WHO:**
- Disease outbreak news RSS: `https://www.who.int/feeds/entity/csr/don/en/rss.xml`

**USDA APHIS Livestock Disease:**
- Animal disease news: `https://www.aphis.usda.gov/aphis/newsroom/news/rss`

---

### Geopolitical and Security

**State Department:**
- Travel advisories RSS: `https://travel.state.gov/content/travel/en/traveladvisories/RSS.xml`

**DHS:**
- News RSS: `https://www.dhs.gov/news/rss.xml`

**FBI:**
- Press releases RSS: `https://www.fbi.gov/feeds/fbi-in-the-news/rss.xml`

**ACLED Armed Conflict:**
- API: `https://api.acleddata.com/acled/read/?key={KEY}&email={EMAIL}`
- Free registration at acleddata.com
- Global conflict events with coordinates -- excellent for map layer

**UN Security Council:**
- Press RSS: `https://www.un.org/press/en/rss.xml`

**NATO:**
- News RSS: `https://www.nato.int/rss.xml`

**IAEA Nuclear:**
- News RSS: `https://www.iaea.org/newscenter/news/rss`

---

### Communications

**ARRL Ham Radio:**
- News RSS: `https://www.arrl.org/news/rss`

**FCC:**
- News releases RSS: `https://docs.fcc.gov/public/attachments/DOC-401918A1.xml`

**CERT Vulnerabilities:**
- RSS: `https://kb.cert.org/vuls/bypublished/rss/`

**Ham Radio Band Conditions:**
- PropNET: `https://propnet.org/`
- DXWatch: `https://dxwatch.com/`

**Satellite Pass Predictions:**
- Heavens-Above API: `https://www.heavens-above.com/`
- N2YO API: `https://www.n2yo.com/api/`

---

### Environmental

**EPA AirNow (already implemented):**
- `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode={ZIP}&distance=25&API_KEY={KEY}`

**USGS Groundwater:**
- `https://waterservices.usgs.gov/nwis/gwlevels/?format=json&stateCd={state}`

**Reservoir Storage Bureau of Reclamation:**
- `https://www.usbr.gov/rsvrWater/HistoricalApp.html`

**Snowpack NRCS:**
- `https://www.nrcs.usda.gov/wps/portal/wcc/home/snowClimateMonitoring/snowpack/`

**Harmful Algal Blooms NOAA:**
- `https://coastalscience.noaa.gov/research/habs/habsos/`

**Sea Level NOAA Tides:**
- `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=web_services&station={STATION}&datum=MLLW&units=english&time_zone=lst&format=json`

---

### Transportation

**FAA NOTAMs:**
- `https://notams.faa.gov/notamSearch/`

**Maritime Traffic:**
- MarineTraffic free tier: `https://www.marinetraffic.com/en/ais/home/`
- VesselFinder: `https://www.vesselfinder.com/`

**DOT Road Conditions:**
- `https://ops.fhwa.dot.gov/511/`
- State 511 systems vary

**CBP Port Wait Times:**
- `https://bwt.cbp.gov/api/bwtdata`
- No API key required

---

### Space and Astronomy

**NASA NEO (Near Earth Objects):**
- `https://api.nasa.gov/neo/rest/v1/feed?start_date={DATE}&end_date={DATE}&api_key={KEY}`
- Free API key at api.nasa.gov

**Solar Flares:**
- NOAA SWPC already listed above
- SpaceWeatherLive: `https://www.spaceweatherlive.com/`

---

## News RSS Feeds

### Tier 1 -- Government (always on)
- NWS alerts: `https://api.weather.gov/alerts/active`
- USGS news: `https://www.usgs.gov/news/science-explorer-news/rss.xml`
- FEMA news: `https://www.fema.gov/feeds/news-releases.xml`
- CDC: `https://tools.cdc.gov/api/v2/resources/media/132608.rss`
- EPA: `https://www.epa.gov/rss/epa-newsroom.xml`
- NHC: `https://www.nhc.noaa.gov/index-at.xml`

### Tier 2 -- Wire and Public (on by default)
- NPR Top Stories: `https://feeds.npr.org/1001/rss.xml`
- NPR Around the Nation: `https://feeds.npr.org/1003/rss.xml`
- NPR Environment: `https://feeds.npr.org/1057/rss.xml`
- PBS NewsHour: `https://www.pbs.org/newshour/feeds/rss/headlines`
- BBC World: `https://feeds.bbci.co.uk/news/world/rss.xml`
- BBC Science/Environment: `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml`
- Sky News World: `https://feeds.skynews.com/feeds/rss/world.xml`
- Sky News US: `https://feeds.skynews.com/feeds/rss/us.xml`
- Al Jazeera English: `https://www.aljazeera.com/xml/rss/all.xml`
- Reuters (via proxy): `https://feeds.reuters.com/reuters/topNews`

### Tier 3 -- Preparedness Specialty (opt in)
- Modern Survival Blog: `https://modernsurvivalblog.com/feed/`
- Ask a Prepper: `https://askaprepper.com/feed/`
- Prepper Website: `https://www.prepperwebsite.com/feed/`
- Backdoor Survival: `https://www.backdoorsurvival.com/feed/`
- Off Grid Web: `https://www.offgridweb.com/feed/`
- Survivopedia: `https://survivopedia.com/feed/`
- Gray Wolf Survival: `https://graywolfsurvival.com/feed/`
- SHTFplan: `https://www.shtfplan.com/feed/`
- Survival Blog (Rawles): `https://survivalblog.com/feed/`
- The Organic Prepper: `https://www.theorganicprepper.com/feed/`
- SHTF Preparedness: `https://shtfpreparedness.com/feed/`
- Prepared: `https://www.prepared.org/feed/`

---

## Free APIs Summary

| Source | What It Provides | API Key |
|---|---|---|
| NOAA/NWS | Weather alerts, forecasts | No |
| USGS | Earthquakes, river gauges, groundwater | No |
| GDACS | Global disasters | No |
| FEMA | Disaster declarations | No |
| NASA FIRMS | Fire events | Yes (free) |
| EPA AirNow | Air quality | Yes (free) |
| NOAA SWPC | Space weather, geomagnetic storms | No |
| BLS | Inflation, unemployment | Optional (free) |
| EIA | Oil prices, energy, grid data | Yes (free) |
| FDIC | Bank failures | No |
| ACLED | Global conflict events with coordinates | Yes (free) |
| CoinGecko | Crypto prices | No (basic) |
| GoldPrice.org | Gold and silver prices | No |
| FDA | Drug and food recalls | No |
| CDC | Health alerts, outbreaks, wastewater | No |
| USDA FSIS | Food recalls | No |
| WHO | Disease outbreaks | No |
| CISA | Cybersecurity alerts | No |
| NRC | Nuclear plant status | No |
| State Dept | Travel advisories | No |
| NIFC | Wildfire perimeters | No |
| USGS Water | River and flood levels | No |
| Drought Monitor | Drought status | No |
| NOAA Tides | Sea level, coastal flooding | No |
| ARRL | Ham radio news | No |
| NHC | Hurricane tracking | No |
| Blitzortung | Lightning strikes | No (free non-commercial) |
| Radmon.org | Community radiation monitoring | No |
| NASA NEO | Near Earth Objects | Yes (free) |
| CBP | Port wait times | No |
| FAA | Flight delays, NOTAMs | No |

---

## Dashboard Widget Ideas

### Emergency Widgets
- Active alerts in region (NOAA/NWS) -- BUILT
- Earthquake activity near me (USGS) -- BUILT
- Global disasters (GDACS) -- BUILT
- Wildfire activity (NASA FIRMS) -- BUILT
- Space weather and solar flares (NOAA SWPC)
- Lightning strike map (Blitzortung)
- Hurricane tracking (NHC)
- River gauge levels (USGS)
- Drought status (Drought Monitor)
- Tsunami warnings (PTWC)
- Volcano activity (USGS)
- Radiation monitoring (Radmon.org)

### Financial Widgets
- Gold spot price (GoldPrice.org)
- Silver spot price (GoldPrice.org)
- Oil price WTI (EIA)
- Inflation/CPI (BLS)
- Federal Reserve announcements
- Bank failures (FDIC)
- M2 money supply (FRED)
- Yield curve (FRED)
- Baltic Dry Index
- Unemployment claims (BLS)

### Infrastructure Widgets
- Power outages in my region (PowerOutage.us)
- Nuclear plant status (NRC)
- Air quality index (EPA AirNow) -- BUILT
- CISA cybersecurity alerts
- GPS disruption alerts (FAA)
- Pipeline incidents (PHMSA)

### Medical Widgets
- CDC outbreak alerts
- FDA food recalls
- Drug shortages (FDA)
- Wastewater disease surveillance (CDC NWSS)
- Flu activity (CDC FluView)

### Geopolitical Widgets
- State Dept travel advisories
- Global conflict events (ACLED)
- DHS threat bulletins

### Communications Widgets
- Ham radio band conditions
- Space weather impacts on comms
- Satellite pass predictions

### News Widgets
- Latest preparedness news -- BUILT
- Community field reports -- BUILT
- Breaking events from community

---

## Unique Features Nobody Has Built

### High Value -- Build These

**Mutual Aid Network Map**
Community members opt in to be a local resource. Map shows who in your county has what skills and supplies. During an actual emergency knowing who nearby has medical training, ham radio, food stores, or shelter capacity is invaluable. Searchable by skill, region, and availability.

**Emergency Frequency Database**
Comprehensive searchable database of local emergency frequencies by county. Police, fire, EMS, ham repeaters, NOAA weather radio stations, GMRS channels in active use locally. Currently scattered across radioreference.com, RepeaterBook, and state agency websites. Nobody has consolidated it cleanly.

**After Action Reports**
Structured format for members to document real emergencies they survived. Hurricane, power outage, job loss, medical emergency, anything. What worked, what failed, what they wish they had. The most valuable preparedness content that exists nowhere in organized form. Community learns from real experience.

**Regional Threat Calendar**
For each region -- when is tornado season, hurricane season, fire season, flood season, ice storm season, power grid stress season. Historical event data overlaid. Shows patterns over time. Helps people prep for their specific regional threats at the right time of year.

**Bug Out Route Planner**
Enter location, destination, vehicle type. Get route options ranked by fuel efficiency, road condition, bridge weight limits, and known hazard zones. Integrates real-time road condition data. Nothing like this exists anywhere.

**Threat Timeline Tracker**
Historical record of events in a region over time. When did the last major tornado hit your county? What was the drought status 5 years ago? Pattern recognition for local threats. All data exists in NOAA and USGS -- nobody has built the clean regional history tool.

**Prep Score / Readiness Assessment**
Comprehensive readiness assessment across all categories. Water, food, medical, communications, power, shelter, security, financial, community. Shows overall readiness percentage with specific gaps highlighted and actionable next steps. Like a credit score for preparedness.

**Local Resource Database**
Crowdsourced and verified map of local resources. Water sources, edible plants by region, fishing spots, hunting areas, fuel suppliers, generator rental, propane suppliers, feed stores, water treatment facilities. Crowdsourced and community maintained.

**Skill Exchange**
I can teach water purification, you can teach first aid. Community skill sharing board with scheduling. Builds the human network that matters most in a real emergency.

**Barter Network**
Local exchange board for preppers. Post what you have, post what you need. No money, no ads. Skills, supplies, equipment. Deeply on brand for the platform philosophy.

### Medium Value

**Verified Local Expert Directory**
Ham radio operators, medical professionals, farmers, mechanics, engineers. Members with verified credentials who have opted in to be a local resource. Searchable by skill and region.

**Prep Challenge System**
Monthly community challenges. Build your 72 hour kit this month. Test your water storage. Get your ham license. Drives engagement and real preparedness improvement. Community tracks progress together.

**Solar Panel Sizing Calculator**
Based on location, consumption, battery backup goals. Uses real solar irradiance data for the user's region.

**Rainwater Collection Calculator**
Roof size, regional rainfall data, storage needed. Region-specific data from NOAA precipitation records.

**Firewood Calculator**
BTU requirements for your climate, cords needed per winter. Region-specific heating degree day data.

**EMP Hardening Guide and Calculator**
What equipment needs a Faraday cage, how to build one sized correctly. Very niche but extremely relevant to serious preppers.

**Generator Fuel Consumption Calculator**
Runtime by load percentage, fuel storage needed for X days of operation.

---

## Hostable Reference Content (Public Domain)

All of the following are public domain and can be hosted directly on Project Fenris:

- FEMA preparedness guides
- Red Cross first aid manuals
- Military field manuals: FM 21-76 Survival, FM 4-25.11 First Aid
- USDA food preservation guides
- State emergency management plans
- Nuclear attack survival guide (FEMA)
- Wilderness survival reference cards
- Edible and medicinal plant guides by region
- Water purification method comparison charts
- Seed saving guides
- Morse code reference
- Emergency hand signal reference
- Phonetic alphabet reference

---

## Interactive Reference Tools

- Morse code trainer
- Ham radio phonetic alphabet trainer
- Knot tying guide with illustrations
- Fire starting method comparison
- Water source identification guide
- Emergency frequency quick reference cards by state (printable PDF)
- Emergency contact card template (downloadable fillable PDF)

---

## Additional Calculators

- Seed storage calculator -- seeds per person per year for self sufficiency
- Well water pump sizing calculator
- Faraday cage sizing guide
- Solar flare impact assessment based on equipment and shielding
- EMP hardening calculator
- Propane storage calculator
- Freeze date calculator by region (frost dates for gardeners)
- Bug out vehicle range calculator (fuel, load, terrain)

---

## Financial Data Worth Monitoring (Prepper Specific)

Beyond gold and silver, serious preppers watch:
- Silver to gold ratio
- Dollar index DXY
- 10 year minus 2 year treasury spread (yield curve inversion = recession signal)
- M2 money supply growth rate
- Velocity of money (declining = deflationary pressure)
- Baltic Dry Index (shipping costs, leading economic indicator)
- Corporate bond spreads (credit market stress)
- Repo market stress (Federal Reserve overnight operations)
- Consumer confidence index
- Manufacturing PMI (ISM)
- Weekly unemployment claims
- Continuing claims (longer term unemployment trend)
- Retail sales (consumer spending health)
- Housing starts (construction activity)

---

## Biological and Pandemic Monitoring

Beyond CDC general alerts:
- CDC FluView -- flu activity by state week by week
- CDC NWSS -- wastewater surveillance, detects disease spread 1-2 weeks before clinical cases
- USDA APHIS -- livestock and animal disease outbreaks
- ProMED -- independent infectious disease monitoring, often faster than official sources
- HealthMap -- automated global disease outbreak monitoring
- WHO GOARN -- global outbreak alert and response network
- Flu Near You -- crowdsourced illness reporting
- Tick surveillance maps -- CDC
- Mosquito activity and arbovirus alerts -- CDC ArboNET

---

## Weather Beyond Alerts

- Jet stream position -- NOAA Climate Prediction Center
- El Nino/La Nina status: `https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html`
- Seasonal outlook: `https://www.cpc.ncep.noaa.gov/`
- Lightning density maps -- Blitzortung.org
- Snow water equivalent -- NRCS
- Frost and freeze alerts -- NOAA
- Pollen counts -- NAB (National Allergy Bureau)
- UV index -- EPA
- Rip current risk -- NOAA
- Wildfire weather outlook -- Storm Prediction Center
- Winter storm outlook -- Weather Prediction Center