/* sw.js — offline cache. Bump VERSION on every release. Never touches the Gemini API. */
const VERSION = '2.0.0';
const CACHE = 'vito-' + VERSION;
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/text.js', 'js/config.js', 'js/library.js', 'js/engine.js', 'js/achievements.js', 'js/store.js', 'js/ai.js', 'js/dom.js', 'js/views.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // delete every older cache — including the ones left by the previous version of the app
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'generativelanguage.googleapis.com') return;
  if (url.origin === location.origin) {
    // stale-while-revalidate: instant from cache, refreshed in the background for the next open
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); cache.put(req, res.clone()); return res; } catch (err) { return Response.error(); }
    }));
  }
});
