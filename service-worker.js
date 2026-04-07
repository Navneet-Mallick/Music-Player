// GrooveBox Service Worker - Cache First Strategy

const CACHE = "grooovebox-v1";
const precacheFiles = [
    "./",
    "./index.html",
    "./db.js",
    "./app.js",
    "./style.css",
    "./manifest.json",
    "./image.png",
];

// Install - cache all files
self.addEventListener("install", event => {
    console.log("[GrooveBox SW] Installing...");
    event.waitUntil(
        caches.open(CACHE).then(cache => {
            console.log("[GrooveBox SW] Caching app files");
            return cache.addAll(precacheFiles);
        })
    );
});

// Activate - clear old caches
self.addEventListener("activate", event => {
    console.log("[GrooveBox SW] Activating...");
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE).map(k => {
                    console.log("[GrooveBox SW] Deleting old cache:", k);
                    return caches.delete(k);
                })
            )
        )
    );
});

// Fetch - serve from cache, fallback to network
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});