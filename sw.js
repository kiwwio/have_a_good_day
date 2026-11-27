/* 好日子行事曆 — Service Worker（離線快取）
   改版時請同步修改 VERSION，舊快取會自動清除。 */
const VERSION = 'v3.1';
const APP_CACHE = 'haorizi-app-' + VERSION;
const FONT_CACHE = 'haorizi-fonts';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest', './install.html',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('haorizi-app-') && k !== APP_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google 字型：先用快取，沒有才下載（離線時退回手機內建字型）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONT_CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }
      catch (e) { return new Response('', { status: 504 }); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 網頁本身：先用快取立刻打開，同時在背景更新（下次打開就是新版）
  event.respondWith(caches.open(APP_CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { event.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('目前沒有網路，請連上網路後再試一次。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
