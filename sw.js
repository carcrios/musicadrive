/* Service worker: la app se instala y abre sin conexion.
   El audio NO pasa por aqui: el navegador se lo pide a Google directamente.

   Para el codigo de la app se pide PRIMERO a la red y la copia guardada es
   el respaldo. Asi una version nueva entra sola al recargar, sin tener que
   hacer Ctrl+Shift+R ni borrar los datos del sitio. */

const CACHE = 'mi-musica-2.6.8';
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

  const esCodigo = /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname === BASE;
  const esImagen = /\.(png|ico|svg|css)$/.test(url.pathname);
  if (!esCodigo && !esImagen) return;

  if (esCodigo) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      }).catch(() => caches.match(e.request).then(hit => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }))
  );
});
