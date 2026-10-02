const CACHE_NAME = "ontime-streak-v108";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/db.js",
  "./js/auth-gate.js",
  "./js/guest-view.js",
  "./js/gender.js",
  "./js/firebase-init.js",
  "./js/firebase-config.js",
  "./js/vendor/firebase-app.js",
  "./js/vendor/firebase-auth.js",
  "./js/vendor/firebase-firestore.js",
  "./js/streak.js",
  "./js/comments-util.js",
  "./js/confetti.js",
  "./js/backup.js",
  "./js/version.js",
  "./js/pull-to-refresh.js",
  "./js/prizes.js",
  "./js/devtools.js",
  "./js/ui-home.js",
  "./js/ui-history.js",
  "./js/ui-prizes.js",
  "./js/ui-settings.js",
  "./js/ui-invites.js",
  "./js/calendar-sync.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./prizes/manifest.json",
  "./prizes/low/alon-olearchik.jpg",
  "./prizes/low/amir-lev.jpg",
  "./prizes/low/anteater.jpg",
  "./prizes/low/apples.jpg",
  "./prizes/low/avocado.jpg",
  "./prizes/low/carrots.jpg",
  "./prizes/low/cherries.jpg",
  "./prizes/low/cherry-blossom.jpg",
  "./prizes/low/debbie-harry.jpg",
  "./prizes/low/disney.jpg",
  "./prizes/low/drums.jpg",
  "./prizes/low/dusty-springfield.jpg",
  "./prizes/low/ehud-banai.jpg",
  "./prizes/low/eyal-talmudi.jpg",
  "./prizes/low/eyal-yonati.jpg",
  "./prizes/low/firefly.jpg",
  "./prizes/low/flying-squirrel.jpg",
  "./prizes/low/grover.jpg",
  "./prizes/low/guitar.jpg",
  "./prizes/low/kittens.jpg",
  "./prizes/low/lettuce.jpg",
  "./prizes/low/lion.jpg",
  "./prizes/low/peanut-butter.jpg",
  "./prizes/low/peas.jpg",
  "./prizes/low/pet-rat.jpg",
  "./prizes/low/piano.jpg",
  "./prizes/low/piglet.jpg",
  "./prizes/low/pink-panther-anteater.jpg",
  "./prizes/low/puppies.jpg",
  "./prizes/low/rainbow.jpg",
  "./prizes/low/ram-orion.jpg",
  "./prizes/low/rami-fortis.jpg",
  "./prizes/low/ramzi-abed-ramzi.jpg",
  "./prizes/low/salad.jpg",
  "./prizes/low/shabi.jpg",
  "./prizes/low/sting-bass.jpg",
  "./prizes/low/strawberries.jpg",
  "./prizes/low/ted-lasso.jpg",
  "./prizes/low/tiger.jpg",
  "./prizes/low/tigrina.jpg",
  "./prizes/low/tomatoes.jpg",
  "./prizes/low/tulips.jpg",
  "./prizes/low/wild-cats.jpg",
  "./prizes/low/wildcat-cheetah.jpg",
  "./prizes/low/wildcat-ocelot.jpg",
  "./prizes/low/wind-instruments.jpg",
  "./prizes/low/yahli-sobol.jpg",
  "./prizes/low/yardena-arazi.jpg",
  "./prizes/low/yehudit-ravitz.jpg",
  "./prizes/high/netanel.jpg",
  "./prizes/high/berry.jpg",
  "./prizes/high/julian-cope.jpg",
  "./prizes/high/syd-barrett.jpg",
  "./prizes/high/david-bowie.jpg",
  "./prizes/high/ketzef.jpg",
  "./prizes/high/shlulit.jpg",
  "./prizes/high/shesek.jpg",
  "./prizes/high/mulan.jpg",
  "./prizes/high/nunu.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // cache:"reload" bypasses the HTTP cache. A plain addAll can be served
    // stale copies (GitHub Pages sends max-age=600), which then get frozen
    // into this version's cache and the app reports the previous version.
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
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
