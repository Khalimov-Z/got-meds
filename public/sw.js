const CACHE_NAME = "gotmeds-static-v3";
const OFFLINE_URL = "/offline";
const CORE_ASSETS = [
  "/favicon.ico",
  "/icons/gotmeds-icon.svg",
  "/icons/gotmeds-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all([cacheOfflinePage(cache), cacheCoreAssets(cache)])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || !networkResponse.ok) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));

          return networkResponse;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cachedResponse) => cachedResponse || Response.error())
        )
    );
  }
});

async function cacheOfflinePage(cache) {
  const offlineRequest = new Request(OFFLINE_URL, { cache: "reload" });
  const offlineResponse = await fetch(offlineRequest);

  if (!offlineResponse || !offlineResponse.ok) {
    throw new Error("Offline page is unavailable");
  }

  await cache.put(OFFLINE_URL, offlineResponse.clone());

  const html = await offlineResponse.text();
  const assetUrls = extractLocalAssets(html).filter((assetUrl) =>
    isStaticAsset(new URL(assetUrl, self.location.origin).pathname)
  );

  await Promise.all(
    assetUrls.map((assetUrl) =>
      cache.add(new Request(assetUrl, { cache: "reload" })).catch(() => undefined)
    )
  );
}

function cacheCoreAssets(cache) {
  return cache.addAll(
    CORE_ASSETS.map((assetUrl) => new Request(assetUrl, { cache: "reload" }))
  );
}

function extractLocalAssets(html) {
  const assets = new Set();
  const pattern = /\b(?:href|src)="([^"]+)"/g;
  let match = pattern.exec(html);

  while (match) {
    const assetUrl = match[1];

    if (assetUrl.startsWith("/")) {
      assets.add(assetUrl);
    }

    match = pattern.exec(html);
  }

  return Array.from(assets);
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|ico|webp)$/.test(pathname)
  );
}
