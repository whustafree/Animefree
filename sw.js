// sw.js
const CACHE_NAME = 'whustaf-v50-FORCE-UPDATE'; // <--- CAMBIA ESTO SIEMPRE QUE EDITES ALGO
const ASSETS = [
    './',
    './index.html',
    './web.html',
    './tv.html',
    './style.css',
    './app_web.js',
    './app_tv.js',
    './manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
        .then(c => c.addAll(ASSETS))
        .then(() => self.skipWaiting()) // Obliga a instalarse de inmediato
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(k => Promise.all(
            k.map(key => key !== CACHE_NAME && caches.delete(key)) // Borra el caché viejo
        )).then(() => self.clients.claim()) // Toma control inmediato
    );
});

self.addEventListener('fetch', e => {
    // Estrategia: Network First (Intenta internet, si falla usa caché)
    // Esto es mejor para una app de streaming que necesita datos frescos
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        fetch(e.request)
        .then(res => {
            // Si es un archivo estático (JS/CSS/HTML), actualiza la copia en caché
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
            return res;
        })
        .catch(() => caches.match(e.request)) // Si no hay internet, usa caché
    );
});
