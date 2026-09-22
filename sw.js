/* Service worker: solo para que la app se instale y abra sin conexion.
   El audio NO pasa por aqui: el navegador se lo pide a Google directamente.

   Politica: para el codigo de la app se pide primero a la red, y la copia
   guardada es el respaldo. Asi una version nueva entra a la primera; antes
   habia que recargar dos veces porque se servia la copia vieja. */

const CACHE = 'musica-simple-2';
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

self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'limpiar') {
    caches.keys().then(k => Promise.all(k.map(n => caches.delete(n))));
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const esCodigo = /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname === BASE;
  const esImagen = /\.(png|ico|svg|css)$/.test(url.pathname);
  if (!esCodigo && !esImagen) return;

  if (esCodigo) {
    // Primero la red; si no hay, la copia guardada.
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

  // Imagenes e iconos: de la copia guardada, que no cambian.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }))
  );
});
