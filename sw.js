/* Offline cache. The clock must keep running when the Wi-Fi drops.
   - Files from this site: network first (so a git push shows up on the next page load), falling
     back to the cache after a short wait or when offline. Every good response refreshes the cache.
   - Google Fonts: cache first.
   - Anything else (the masjid feed, audio range requests) is left to the network.
   The page posts the list of everything it loaded ('cache-urls'), so the first visit is enough
   to work offline and no file list has to be kept here. */
const CACHE = 'azan-clock-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_WAIT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(url) {
  return url.origin === self.location.origin || FONT_HOSTS.indexOf(url.hostname) !== -1;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(data.urls.map((u) => {
    let url;
    try { url = new URL(u); } catch (e) { return null; }
    if (!cacheable(url) || /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) return null;
    return cache.match(url.href).then((hit) => {
      if (hit) return null;
      const same = url.origin === self.location.origin;
      return fetch(url.href, { mode: same ? 'same-origin' : 'cors', credentials: 'omit' })
        .then((res) => {
          if (!res.ok) return null;
          const put = cache.put(url.href, res.clone());
          /* Font files do not show up in the page's resource list, so take them from the CSS. */
          return url.hostname === 'fonts.googleapis.com' ? put.then(() => res.text()).then((css) => cacheFontFiles(cache, css)) : put;
        })
        .catch(() => null);
    });
  }))));
});

function cacheFontFiles(cache, css) {
  const urls = (css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g) || []).map((m) => m.slice(4, -1));
  return Promise.all(urls.map((u) => cache.match(u).then((hit) => hit || fetch(u, { mode: 'cors', credentials: 'omit' })
    .then((res) => (res.ok ? cache.put(u, res) : null)).catch(() => null))));
}

function networkFirst(request) {
  return caches.open(CACHE).then((cache) => new Promise((resolve) => {
    let done = false;
    const fallback = () => cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    const timer = setTimeout(() => {
      fallback().then((hit) => { if (hit && !done) { done = true; resolve(hit); } });
    }, NETWORK_WAIT_MS);
    fetch(request).then((res) => {
      if (res.ok && res.status === 200) cache.put(request, res.clone());
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then((hit) => {
        if (!done) { done = true; resolve(hit || Response.error()); }
      });
    });
  }));
}

function cacheFirst(request) {
  return caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (FONT_HOSTS.indexOf(url.hostname) !== -1) event.respondWith(cacheFirst(req));
});
