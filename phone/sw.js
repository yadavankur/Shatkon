// Shatkon's service worker: it makes the game installable and lets it open with no signal.
// Network first: every file is fetched fresh whenever there is a connection, so a new version of the
// game or its rule files is never held back by an old copy. The copy kept here is only used offline.
const CACHE = 'shatkon-offline-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) => ev.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('shatkon-')) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (ev) => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname;      // one copy per file: the page adds ?t=... to skip the browser's cache
  ev.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) { const copy = res.clone(); ev.waitUntil(caches.open(CACHE).then((c) => c.put(key, copy))); }
      return res;
    } catch (e) {
      const hit = await caches.match(key);
      if (hit) return hit;
      throw e;
    }
  })());
});
