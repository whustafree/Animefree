const CACHE_NAME = 'whustaf-v44-split';
const ASSETS = ['./', './index.html', './web.html', './tv.html', './style.css', './app_web.js', './app_tv.js', './manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(key => key!==CACHE_NAME && caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => { if(!e.request.url.includes('api')) e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });