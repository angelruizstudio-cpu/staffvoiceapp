const CACHE_NAME = "staff-voice-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./login.html",
  "./unauthorized.html",
  "./styles.css",
  "./app.js",
  "./admin.js",
  "./login.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./assets/wts-seal.png",
  "./assets/hero.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
