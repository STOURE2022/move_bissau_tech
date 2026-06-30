// Service Worker MoveBissau — notifications + mise à jour
const CACHE_NAME = 'movebissau-v2';

// Install — nouveau SW prêt
self.addEventListener('install', (e) => {
  // Ne pas skipWaiting automatiquement — attendre que l'utilisateur accepte la MAJ
  e.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      console.log('[SW] Nouvelle version installée');
    })
  );
});

// Activate — nettoyer les anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => {
      console.log('[SW] Anciens caches supprimés');
      return self.clients.claim();
    })
  );
});

// Message du client — "skipWaiting" pour activer la nouvelle version
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification reçue
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'MoveBissau';
  const options = {
    body: data.body || '',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
