/* Service worker: solo para que la app se instale y abra sin conexion.
   El audio NO pasa por aqui: el navegador se lo pide a Google directamente. */

const CACHE = 'mi-musica-2.6.3';
const BASE = new URL('./', self.location).pathname;
const CONCHA = [BASE, BASE + 'index.html', BASE + 'app.js', BASE + 'config.js',
                BASE + 'manifest.webmanifest', BASE + 'icon-192.png', BASE + 'icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CONCHA).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!/\.(html|js|css|png|webmanifest)$/.test(url.pathname) && CONCHA.indexOf(url.pathname) < 0) return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      const red = fetch(e.request).then(r => {
        if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
