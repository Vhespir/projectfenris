// Minimal service worker whose only job is Web Push delivery: show a
// notification when a push arrives, and take the user to the relevant
// page when they click it. Deliberately not a full offline-caching PWA
// service worker, that's a different, bigger feature.

self.addEventListener('push', event => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Project Fenris', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Project Fenris', {
      body: payload.body ?? '',
      icon: '/logo.png',
      badge: '/logo.png',
      data: { url: payload.url ?? '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
