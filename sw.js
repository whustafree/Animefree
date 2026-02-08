const CACHE_NAME = 'animofree-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Instalación: Guardamos los archivos en la caché del celular
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activación: Limpiamos cachés viejas si actualizamos la app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Interceptamos las peticiones. Si no hay internet, usamos la caché.
self.addEventListener('fetch', (event) => {
  // Solo cacheamos archivos locales, no las peticiones a la API (porque son dinámicas)
  if (event.request.url.includes('api.consumet.org') || event.request.url.includes('api.allorigins.win')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
