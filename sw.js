// sw.js — corre en segundo plano, incluso con la app cerrada, para poder mostrar notificaciones.
self.addEventListener('push', (event) => {
  let data = { title: 'Zancada', body: '' };
  try { data = event.data ? event.data.json() : data; } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Zancada', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
