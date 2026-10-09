// Offline app shell. The app itself (index.html + the built JS/CSS) is kept on
// the device so a child can open it without internet and read the books they
// saved (those live in the "ps-books-v1" cache, written by the app). API calls
// are never cached here — the app decides what to keep offline.
const SHELL = 'ps-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.add('/');
      try {
        const res = await fetch('/app-assets.json', { cache: 'no-store' });
        const files = res.ok ? await res.json() : [];
        await cache.addAll(files.map((f) => `/assets/${f}`));
      } catch {
        // assets are still cached as they load
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('ps-shell-') && n !== SHELL).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__offline__/')) return;

  // Pages: the newest from the network; the saved shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(SHELL)).put('/', res.clone());
          return res;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })()
    );
    return;
  }

  // Hashed build files never change: cache first. Other files (pictures,
  // animations): cached copy at once, refreshed in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      const cached = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        if (!url.pathname.startsWith('/assets/')) event.waitUntil(refresh.then(() => undefined));
        return cached;
      }
      return refresh;
    })()
  );
});
