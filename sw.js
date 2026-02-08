const CACHE_NAME = 'whustaf-tv-v40';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(key => key!==CACHE_NAME && caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => { if(!e.request.url.includes('api')) e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });