const CACHE_NAME = "ontime-streak-v33";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/db.js",
  "./js/auth-gate.js",
  "./js/guest-view.js",
  "./js/firebase-init.js",
  "./js/firebase-config.js",
  "./js/vendor/firebase-app.js",
  "./js/vendor/firebase-auth.js",
  "./js/vendor/firebase-firestore.js",
  "./js/streak.js",
  "./js/confetti.js",
  "./js/backup.js",
  "./js/version.js",
  "./js/prizes.js",
  "./js/devtools.js",
  "./js/ui-home.js",
  "./js/ui-history.js",
  "./js/ui-prizes.js",
  "./js/ui-settings.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./prizes/manifest.json",
  "./prizes/tier1/placeholder.jpg",
  "./prizes/tier2/placeholder.jpg",
  "./prizes/tier3/placeholder.jpg",
  "./prizes/tier4/placeholder.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 503 });
        });
    })
  );
});
