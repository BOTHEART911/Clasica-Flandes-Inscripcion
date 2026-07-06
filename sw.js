/* Service Worker — Clásica 2026 Participante.
   network-first para navegación (con shell de respaldo en caché) y
   cache-first para estáticos del propio origen. NUNCA intercepta las
   llamadas a script.google.com (API /exec) ni a Firebase. */
const CACHE = 'clasica-part-v9';
const SHELL = ['./index.html', './styles.css', './app.js', './ubicaciones.js', './version.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function esExterno_(url) {
  const h = url.hostname;
  return h.indexOf('script.google.com') !== -1
      || h.indexOf('script.googleusercontent.com') !== -1
      || h.indexOf('firebaseio.com') !== -1
      || h.indexOf('firebase') !== -1
      || h.indexOf('googleapis.com') !== -1;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;               // no cachear POST (API /exec)
  const url = new URL(req.url);
  if (esExterno_(url)) return;                     // dejar pasar API y Firebase

  // Navegación: network-first, con index.html de la caché como respaldo.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Estáticos del mismo origen: cache-first con actualización en segundo plano.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(r => {
          if (r && r.status === 200) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return r;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
