/* Service Worker — Clásica 2026 Participante.
   Estrategia: network-first para navegación, cache-first para estáticos.
   La versión de caché se ata a APP_VERSION vía query en el registro. */
const CACHE = 'clasica-part-v1';
const ASSETS = ['./index.html', './styles.css', './app.js', './ubicaciones.js', './version.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return; // nunca cachear POST al /exec
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
