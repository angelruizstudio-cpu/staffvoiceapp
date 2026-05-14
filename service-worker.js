const CACHE_NAME = "staff-voice-v23";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./users.html",
  "./case.html",
  "./login.html",
  "./status.html",
  "./unauthorized.html",
  "./styles.css",
  "./app.js",
  "./admin.js",
  "./users.js",
  "./case.js",
  "./login.js",
  "./status.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./assets/wts-seal.png",
  "./assets/hero.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  if (["script", "style", "worker"].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
