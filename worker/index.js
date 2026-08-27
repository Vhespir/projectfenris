import cron from 'node-cron'
import dotenv from 'dotenv'
import pg from 'pg'
import { fetchNOAA } from './fetchers/noaa.js'
import { fetchUSGS } from './fetchers/usgs.js'
import { fetchGDACS } from './fetchers/gdacs.js'
import { fetchMeteoAlarm } from './fetchers/meteoalarm.js'
import { fetchEPA }  from './fetchers/epa.js'
import { fetchNews } from './fetchers/news.js'
import { fetchSWPC } from './fetchers/swpc.js'
import { fetchCISA } from './fetchers/cisa.js'
import { fetchEONET } from './fetchers/eonet.js'
import { fetchGDELT } from './fetchers/gdelt.js'
import { checkPendingAlerts } from './lib/alerts.js'

dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function runAll() {
  await Promise.allSettled([
    fetchNOAA(), fetchUSGS(), fetchGDACS(), fetchEPA(), fetchNews(), fetchSWPC(), fetchMeteoAlarm(),
    fetchCISA(), fetchEONET(), fetchGDELT(),
  ])
  await checkPendingAlerts(pool)
}

console.log('Fenris worker starting...')

cron.schedule('*/10 * * * *', async () => {
  console.log('Running data fetch...')
  await runAll()
  console.log('Data fetch complete')
})

console.log('Running initial fetch...')
await runAll()
console.log('Initial fetch complete')
