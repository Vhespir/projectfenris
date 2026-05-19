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
  // Format: ReportDt|Unit|Power  (pipe-delimited, 365 days of data)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(1)
  const byDate = {}
  for (const line of lines) {
    const parts = line.split('|')
    if (parts.length < 3) continue
    const dateStr = parts[0].split(' ')[0]
    const unitName = parts[1].trim()
    const power = parseInt(parts[2].trim(), 10)
    if (isNaN(power)) continue
    if (!byDate[dateStr]) byDate[dateStr] = []
    byDate[dateStr].push({ unitName, power })
  }
  const dates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a))
  if (!dates.length) return { reportDate: null, total: 0, reactors: [] }
  const latestDate = dates[0]
  const reactors = byDate[latestDate].map(r => {
    const unitMatch = r.unitName.match(/\s(\d+)$/)
    return {
      name: unitMatch ? r.unitName.slice(0, -unitMatch[0].length).trim() : r.unitName,
      state: '',
      unit: unitMatch ? parseInt(unitMatch[1]) : null,
      power: r.power,
      status: null,
    }
  })
  return { reportDate: latestDate, total: reactors.length, reactors }
}

export async function externalRoutes(app) {
  const H = { 'User-Agent': 'ProjectFenris/1.0 contact@projectfenris.com' }

  // ── Precious metals (gold + silver via Yahoo Finance) ─────────────────────────
  app.get('/external/metals', async (_req, reply) => {
    try {
      const data = await withCache('metals', 5 * 60_000, async () => {
        const targets = [
          { sym: 'GC%3DF', label: 'gold' },
          { sym: 'SI%3DF', label: 'silver' },
        ]
        const result = {}
        for (const t of targets) {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.sym}?interval=1d&range=1mo`
            const res = await fetch(url, {
              headers: { ...H, 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8_000),
            })
            if (!res.ok) continue
            const json = await res.json()
            const r = json.chart?.result?.[0]
            const meta = r?.meta
            if (!meta) continue
            const prev = meta.chartPreviousClose ?? meta.previousClose
            const curr = meta.regularMarketPrice
            const closes = (r?.indicators?.quote?.[0]?.close ?? [])
              .filter(v => v != null && typeof v === 'number')
            result[t.label] = {
              price: curr,
              change_pct: prev && curr ? ((curr - prev) / prev) * 100 : null,
              sparkline: closes.slice(-15),
            }
          } catch {}
        }
        if (!result.gold && !result.silver) throw new Error('no metals data from Yahoo Finance')
        return result
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'metals unavailable', detail: err.message })
    }
  })

  // ── WTI crude oil (Yahoo Finance CL=F) ───────────────────────────────────────
  app.get('/external/oil', async (_req, reply) => {
    try {
      const data = await withCache('oil', 5 * 60_000, async () => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=1mo`
        const res = await fetch(url, {
          headers: { ...H, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8_000),
        })
        if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`)
        const json = await res.json()
        const r = json.chart?.result?.[0]
        const meta = r?.meta
        if (!meta) throw new Error('no oil data')
        const prev = meta.chartPreviousClose ?? meta.previousClose
        const curr = meta.regularMarketPrice
        const closes = (r?.indicators?.quote?.[0]?.close ?? [])
          .filter(v => v != null && typeof v === 'number')
        return {
          price:      curr,
          change_pct: prev && curr ? ((curr - prev) / prev) * 100 : null,
          sparkline:  closes.slice(-15),
          period:     new Date().toISOString().slice(0, 10),
          unit:       'dollars per barrel',
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
        const url = `https://www.nrc.gov/reading-rm/doc-collections/event-status/reactor-status/PowerReactorStatusForLast365Days.txt`
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

  // ── Drought Monitor (national statistics, CSV endpoint) ──────────────────────
  app.get('/external/drought', async (_req, reply) => {
    try {
      const data = await withCache('drought', 24 * 60 * 60_000, async () => {
        const today = new Date().toISOString().slice(0, 10)
        const url = `https://droughtmonitor.unl.edu/DmData/GISData.aspx?mode=csv&aoi=us&date=${today}`
        const res = await fetch(url, { headers: H, signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`DroughtMonitor ${res.status}`)
        const text = await res.text()
        const lines = text.trim().split('\n').filter(l => !l.startsWith('MapDate'))
        const conus = lines.find(l => l.includes(',CONUS,')) || lines[0]
        if (!conus) throw new Error('no data')
        const parts = conus.split(',')
        const rawDate = parts[0].trim()
        const dateStr = rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate
        return {
          date: dateStr,
          none: parseFloat(parts[2]),
          d0:   parseFloat(parts[3]),
          d1:   parseFloat(parts[4]),
          d2:   parseFloat(parts[5]),
          d3:   parseFloat(parts[6]),
          d4:   parseFloat(parts[7]),
        }
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'drought unavailable', detail: err.message })
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

  // ── Stock market indices (Yahoo Finance) ──────────────────────────────────────
  app.get('/external/stocks', async (_req, reply) => {
    try {
      const data = await withCache('stocks', 5 * 60_000, async () => {
        const targets = [
          { sym: '%5EGSPC', label: 'S&P 500' },
          { sym: '%5EDJI',  label: 'Dow' },
          { sym: '%5EIXIC', label: 'NASDAQ' },
        ]
        const results = []
        for (const t of targets) {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.sym}?interval=1d&range=1mo`
            const res = await fetch(url, {
              headers: { ...H, 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8_000),
            })
            if (!res.ok) continue
            const json = await res.json()
            const result = json.chart?.result?.[0]
            const meta = result?.meta
            if (!meta) continue
            const prev = meta.chartPreviousClose ?? meta.previousClose
            const curr = meta.regularMarketPrice
            const closes = (result?.indicators?.quote?.[0]?.close ?? [])
              .filter(v => v != null && typeof v === 'number')
            results.push({
              label: t.label,
              price: curr,
              change_pct: prev && curr ? ((curr - prev) / prev) * 100 : null,
              sparkline: closes.slice(-15),
            })
          } catch {}
        }
        if (!results.length) throw new Error('no data from Yahoo Finance')
        return results
      })
      return data
    } catch (err) {
      reply.code(503).send({ error: 'stocks unavailable', detail: err.message })
    }
  })
}
