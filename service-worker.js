/* SquadPlay Service Worker - App Shell + Offline */
const CACHE = 'squadplay-v1.0.0-' + (self.registration ? self.registration.scope : '');

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest'
  // Nota: si añades iconos locales, inclúyelos aquí: './icons/icon-192.png', './icons/icon-512.png'
];

// Instalar: precache básico del shell
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

// Activar: limpiar cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Estrategias
const cacheFirst = async (req) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
};

const networkFirst = async (req) => {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Fallback de navegación a index.html
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
};

// Fetch: app shell + recursos de mismos origen
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navegación: servimos shell offline si no hay red
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst('./index.html'));
    return;
  }

  // Mismo origen: estrategia según recurso
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/data.json')) {
      // datos: intenta red primero para actualizar, cae a caché
      event.respondWith(networkFirst(req));
    } else {
      // estáticos: cache-first
      event.respondWith(cacheFirst(req));
    }
  }
});