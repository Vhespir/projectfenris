import cron from 'node-cron'
import dotenv from 'dotenv'
import { fetchNOAA } from './fetchers/noaa.js'
import { fetchUSGS } from './fetchers/usgs.js'
import { fetchFEMA } from './fetchers/fema.js'

dotenv.config()

console.log('Fenris worker starting...')

// run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('Running data fetch...')
  await Promise.allSettled([
    fetchNOAA(),
    fetchUSGS(),
    fetchFEMA()
  ])
  console.log('Data fetch complete')
})

// run immediately on startup
console.log('Running initial fetch...')
await Promise.allSettled([
  fetchNOAA(),
  fetchUSGS(),
  fetchFEMA()
])
console.log('Initial fetch complete')
