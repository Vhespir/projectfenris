import pg from 'pg'
import { emitToChannel } from './socket.js'

export function startEventNotifier() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

  async function connect() {
    try {
      await client.connect()
      await client.query('LISTEN new_event')
      console.log('[notifier] listening for new severe events')

      client.on('notification', msg => {
        try {
          const event = JSON.parse(msg.payload)
          emitToChannel('all', 'new_alert', event)
          console.log(`[notifier] emitted new_alert: ${event.severity} ${event.event_type} (id=${event.id})`)
        } catch (err) {
          console.error('[notifier] bad payload:', err.message)
        }
      })

      client.on('error', err => {
        console.error('[notifier] pg error:', err.message)
        reconnect()
      })
    } catch (err) {
      console.error('[notifier] connect failed:', err.message)
      reconnect()
    }
  }

  function reconnect() {
    setTimeout(() => {
      console.log('[notifier] reconnecting...')
      startEventNotifier()
    }, 5000)
  }

  connect()
}
