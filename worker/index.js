import cron from 'node-cron'
import dotenv from 'dotenv'
import { fetchNOAA } from './fetchers/noaa.js'
import { fetchUSGS } from './fetchers/usgs.js'
import { fetchFEMA } from './fetchers/fema.js'
import { fetchEPA }  from './fetchers/epa.js'
import { fetchNews } from './fetchers/news.js'

dotenv.config()

async function runAll() {
  await Promise.allSettled([fetchNOAA(), fetchUSGS(), fetchFEMA(), fetchEPA(), fetchNews()])
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
