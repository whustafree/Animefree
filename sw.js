// sw.js
// He cambiado el nombre de la versión para obligar a recargar los archivos nuevos
const CACHE_NAME = 'whustaf-v60-'; 
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
        .then(() => self.skipWaiting()) // Instalar inmediatamente
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(k => Promise.all(
            k.map(key => key !== CACHE_NAME && caches.delete(key)) // Borrar cachés viejos
        )).then(() => self.clients.claim()) // Tomar control inmediatamente
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        fetch(e.request)
        .then(res => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
            return res;
        })
        .catch(() => caches.match(e.request))
    );
});