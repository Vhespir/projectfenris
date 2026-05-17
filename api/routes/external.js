// Proxy routes for external data APIs.
// All responses are cached server-side to avoid hammering rate limits.

const _cache = new Map()

async function withCache(key, ttlMs, fn) {
  const hit = _cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await fn()
  _cache.set(key, { value, expires: Date.now() + ttlMs })
  return value
}

function parseNRCText(text) {
  const lines = text.split('\n')
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  const reportDate = dateMatch ? dateMatch[0] : null
  const reactors = []
  let inData = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (/^-{5,}/.test(line)) { inData = true; continue }
    if (!inData) continue
    // Match: Name ... STATE  UNIT  POWER  [status text]
    const m = line.match(/^(.+?)\s{2,}([A-Z]{2})\s+(\d)\s+(\d{1,3})\s*(.*?)$/)
    if (m) {
      reactors.push({
        name: m[1].trim(),
        state: m[2],
        unit: parseInt(m[3]),
        power: parseInt(m[4]),
        status: m[5].trim() || null,
      })
    }
  }
  return { reportDate, total: reactors.length, reactors }
}

export async function externalRoutes(app) {
  const H = { 'User-Agent': 'ProjectFenris/1.0 contact@projectfenris.com' }

  // ── Precious metals (gold + silver) ──────────────────────────────────────────
  app.get('/external/metals', async (_req, reply) => {
    try {
      const data = await withCache('metals', 5 * 60_000, async () => {
        const res = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
          headers: H, signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) throw new Error(`goldprice ${res.status}`)
        const json = await res.json()
        const item = json.items?.[0]
        if (!item) throw new Error('no items')
        return {
          gold:   { price: item.xauPrice,  change_pct: item.pcXau  },
          silver: { price: item.xagPrice,  change_pct: item.pcXag  },
          ts: json.ts,
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'metals unavailable', detail: err.message })
    }
  })

  // ── WTI crude oil (EIA v2) ────────────────────────────────────────────────────
  app.get('/external/oil', async (_req, reply) => {
    const key = process.env.EIA_API_KEY
    if (!key) return reply.code(503).send({ error: 'EIA_API_KEY not configured' })
    try {
      const data = await withCache('oil', 60 * 60_000, async () => {
        const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/` +
          `?api_key=${key}&frequency=daily&data[0]=value` +
          `&facets[series][]=RWTC&sort[0][column]=period&sort[0][direction]=desc&length=2`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`EIA ${res.status}`)
        const json = await res.json()
        const rows = json.response?.data ?? []
        if (rows.length < 1) throw new Error('no data')
        const latest = rows[0]
        const prev   = rows[1]
        const change = prev ? latest.value - prev.value : null
        const change_pct = prev ? (change / prev.value) * 100 : null
        return {
          price:      latest.value,
          change:     change,
          change_pct: change_pct,
          period:     latest.period,
          unit:       latest.unit ?? 'dollars per barrel',
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'oil unavailable', detail: err.message })
    }
  })

  // ── FRED time series ──────────────────────────────────────────────────────────
  // Series: T10Y2Y (yield curve spread), M2SL (M2 money supply)
  app.get('/external/fred/:series', async (req, reply) => {
    const key = process.env.FRED_API_KEY
    if (!key) return reply.code(503).send({ error: 'FRED_API_KEY not configured' })
    const { series } = req.params
    const allowed = new Set(['T10Y2Y', 'M2SL', 'CPIAUCSL', 'UNRATE', 'DGS10', 'DGS2'])
    if (!allowed.has(series)) return reply.code(400).send({ error: 'series not allowed' })
    try {
      const data = await withCache(`fred_${series}`, 24 * 60 * 60_000, async () => {
        const url = `https://api.stlouisfed.org/fred/series/observations` +
          `?series_id=${series}&api_key=${key}&sort_order=desc&limit=13&file_type=json`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`FRED ${res.status}`)
        const json = await res.json()
        const obs = (json.observations ?? [])
          .filter(o => o.value !== '.')
          .map(o => ({ date: o.date, value: parseFloat(o.value) }))
        return { series, observations: obs }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'FRED unavailable', detail: err.message })
    }
  })

  // ── BLS CPI ───────────────────────────────────────────────────────────────────
  app.get('/external/bls/cpi', async (_req, reply) => {
    const key = process.env.BLS_API_KEY
    if (!key) return reply.code(503).send({ error: 'BLS_API_KEY not configured' })
    try {
      const data = await withCache('bls_cpi', 24 * 60 * 60_000, async () => {
        const now = new Date()
        const endYear = now.getFullYear()
        const startYear = endYear - 2
        const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0` +
          `?startyear=${startYear}&endyear=${endYear}&registrationkey=${key}`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`BLS ${res.status}`)
        const json = await res.json()
        const series = json.Results?.series?.[0]?.data ?? []
        // Sort ascending
        const sorted = [...series]
          .sort((a, b) => a.year !== b.year ? a.year - b.year : a.period.localeCompare(b.period))
        if (sorted.length < 13) return { cpi: null, yoy_pct: null, period: null }
        const latest = sorted[sorted.length - 1]
        const yearAgo = sorted[sorted.length - 13]
        const cpi = parseFloat(latest.value)
        const cpiYearAgo = parseFloat(yearAgo.value)
        return {
          cpi,
          yoy_pct: ((cpi - cpiYearAgo) / cpiYearAgo) * 100,
          period: `${latest.periodName} ${latest.year}`,
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'BLS unavailable', detail: err.message })
    }
  })

  // ── FDIC bank failures ────────────────────────────────────────────────────────
  app.get('/external/fdic', async (_req, reply) => {
    try {
      const data = await withCache('fdic', 6 * 60 * 60_000, async () => {
        const url = `https://banks.data.fdic.gov/api/failures` +
          `?fields=name,faildate,savr,restype,state&sort_by=faildate&sort_order=DESC&limit=10&format=json`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`FDIC ${res.status}`)
        const json = await res.json()
        const failures = (json.data ?? []).map(d => d.data ?? d)
        const currentYear = new Date().getFullYear()
        const thisYear = failures.filter(f => f.faildate?.startsWith(String(currentYear)))
        return { failures, this_year_count: thisYear.length }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'FDIC unavailable', detail: err.message })
    }
  })

  // ── NRC nuclear reactor status ────────────────────────────────────────────────
  app.get('/external/nrc', async (_req, reply) => {
    try {
      const data = await withCache('nrc', 2 * 60 * 60_000, async () => {
        const url = `https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/powerreactor.txt`
        const res = await fetch(url, {
          headers: { ...H, Accept: 'text/plain' },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) throw new Error(`NRC ${res.status}`)
        const text = await res.text()
        return parseNRCText(text)
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'NRC unavailable', detail: err.message })
    }
  })

  // ── NIFC wildfire perimeters (GeoJSON, fires > 1000 acres) ───────────────────
  app.get('/external/perimeters', async (_req, reply) => {
    try {
      const data = await withCache('perimeters', 30 * 60_000, async () => {
        const base = `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services` +
          `/Current_WildlandFire_Perimeters/FeatureServer/0/query`
        const params = new URLSearchParams({
          where: 'GISAcres > 1000',
          outFields: 'IncidentName,GISAcres,PercentContained,CreateDate',
          f: 'geojson',
        })
        const res = await fetch(`${base}?${params}`, {
          headers: H, signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) throw new Error(`NIFC ${res.status}`)
        return res.json()
      })
      reply.header('Content-Type', 'application/json')
      return data
    } catch (err) {
      reply.code(503).send({ error: 'NIFC unavailable', detail: err.message })
    }
  })

  // ── Crypto prices (CoinGecko) ─────────────────────────────────────────────────
  app.get('/external/crypto', async (_req, reply) => {
    try {
      const data = await withCache('crypto', 5 * 60_000, async () => {
        const url = `https://api.coingecko.com/api/v3/simple/price` +
          `?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=false`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(10_000) })
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
        const json = await res.json()
        return {
          bitcoin:  { price: json.bitcoin?.usd,  change_pct: json.bitcoin?.usd_24h_change  },
          ethereum: { price: json.ethereum?.usd, change_pct: json.ethereum?.usd_24h_change },
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'crypto unavailable', detail: err.message })
    }
  })

  // ── BLS unemployment (initial claims ICSA) ────────────────────────────────────
  app.get('/external/bls/unemployment', async (_req, reply) => {
    const key = process.env.BLS_API_KEY
    if (!key) return reply.code(503).send({ error: 'BLS_API_KEY not configured' })
    try {
      const data = await withCache('bls_unemployment', 24 * 60 * 60_000, async () => {
        const now = new Date()
        const endYear = now.getFullYear()
        const startYear = endYear - 1
        const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/ICSA` +
          `?startyear=${startYear}&endyear=${endYear}&registrationkey=${key}`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`BLS ${res.status}`)
        const json = await res.json()
        const pts = (json.Results?.series?.[0]?.data ?? [])
          .sort((a, b) => b.year !== a.year ? b.year - a.year : b.period.localeCompare(a.period))
        if (!pts.length) return { claims: null, prev_claims: null, period: null }
        const latest = pts[0]
        const prev   = pts[1]
        const claims = parseInt(latest.value.replace(/,/g, ''))
        const prevClaims = prev ? parseInt(prev.value.replace(/,/g, '')) : null
        const fourWeekAvg = pts.slice(0, 4).reduce((s, p) => s + parseInt(p.value.replace(/,/g, '')), 0) / Math.min(pts.length, 4)
        return {
          claims,
          prev_claims: prevClaims,
          change: prevClaims ? claims - prevClaims : null,
          four_week_avg: Math.round(fourWeekAvg),
          period: `Week of ${latest.periodName} ${latest.year}`,
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'BLS unemployment unavailable', detail: err.message })
    }
  })

  // ── Drought Monitor (national statistics) ─────────────────────────────────────
  app.get('/external/drought', async (_req, reply) => {
    try {
      const data = await withCache('drought', 24 * 60 * 60_000, async () => {
        const today = new Date().toISOString().slice(0, 10)
        const past  = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
        const url = `https://droughtmonitor.unl.edu/api/statisticsdata/nationstatisticsdata/${past}/${today}/1/json/`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`DroughtMonitor ${res.status}`)
        const json = await res.json()
        if (!Array.isArray(json) || !json.length) throw new Error('empty')
        const latest = json.sort((a, b) => b.MapDate.localeCompare(a.MapDate))[0]
        return {
          date: latest.MapDate,
          none: latest.None,
          d0: latest.D0,
          d1: latest.D1,
          d2: latest.D2,
          d3: latest.D3,
          d4: latest.D4,
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'drought unavailable', detail: err.message })
    }
  })

  // ── Radiation monitoring (Radmon.org community network) ──────────────────────
  app.get('/external/radiation', async (_req, reply) => {
    try {
      const data = await withCache('radiation', 10 * 60_000, async () => {
        const url = `https://www.radmon.org/radmon.php?task=getjson&user=guest&passwd=guest&limit=100`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`Radmon ${res.status}`)
        const json = await res.json()
        const stations = Array.isArray(json) ? json : []
        const valid = stations.filter(s => s.cpm != null && s.cpm > 0 && s.cpm < 10000)
        const avgCpm = valid.length ? valid.reduce((s, r) => s + r.cpm, 0) / valid.length : null
        const elevated = valid.filter(s => s.cpm > 100)
        return {
          station_count: valid.length,
          avg_cpm: avgCpm ? Math.round(avgCpm * 10) / 10 : null,
          elevated_count: elevated.length,
          stations: valid.slice(0, 5).map(s => ({
            user: s.user, cpm: s.cpm, uSv: s.uSv,
            lat: s.lat, lon: s.lon,
          })),
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'radiation unavailable', detail: err.message })
    }
  })

  // ── NASA Near Earth Objects ───────────────────────────────────────────────────
  app.get('/external/neo', async (_req, reply) => {
    try {
      const data = await withCache('neo', 24 * 60 * 60_000, async () => {
        const start = new Date().toISOString().slice(0, 10)
        const end   = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
        const url = `https://api.nasa.gov/neo/rest/v1/feed` +
          `?start_date=${start}&end_date=${end}&api_key=DEMO_KEY`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`NASA NEO ${res.status}`)
        const json = await res.json()
        const allObjects = Object.values(json.near_earth_objects ?? {}).flat()
        const sorted = allObjects
          .map(o => {
            const approach = o.close_approach_data?.[0]
            return {
              name: o.name,
              hazardous: o.is_potentially_hazardous_asteroid,
              diameter_km: o.estimated_diameter?.kilometers?.estimated_diameter_max ?? null,
              miss_distance_lunar: parseFloat(approach?.miss_distance?.lunar ?? '0'),
              miss_distance_km: parseFloat(approach?.miss_distance?.kilometers ?? '0'),
              velocity_kms: parseFloat(approach?.relative_velocity?.kilometers_per_second ?? '0'),
              date: approach?.close_approach_date ?? start,
            }
          })
          .sort((a, b) => a.miss_distance_lunar - b.miss_distance_lunar)
        const hazardous = sorted.filter(o => o.hazardous)
        return {
          total: allObjects.length,
          hazardous_count: hazardous.length,
          closest: sorted.slice(0, 5),
          date_range: `${start} to ${end}`,
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'NEO unavailable', detail: err.message })
    }
  })
}
