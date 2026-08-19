/**
 * ConectaFone Pro - Service Worker (Cache Buster & Network First)
 */

const CACHE_VERSION = 'conectafone-pro-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW] Removendo cache antigo:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora chamadas WebRTC, STUN e TURN
  if (
    event.request.url.includes('peerjs') ||
    event.request.url.includes('stun') ||
    event.request.url.includes('turn') ||
    event.request.url.includes('metered')
  ) {
    return;
  }

  // Network First: Sempre busca a versão mais recente da Vercel
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
