// This is the service worker with the Cache-first network

const CACHE = "pwabuilder-precache";
const precacheFiles = [
    /* Add an array of files to precache for your app */
    "./",
    "./index.html",
    "./db.js",
    "./app.js",
    "./style.css",
    "./manifest.json",
    "./assets/icon-192.png",
    "./assets/icon-512.png",
];

// Install stage sets up the cache-array to configure pre-cache content
self.addEventListener("install", event => {
    console.log("[PWA Builder] Install Event processing");
    event.waitUntil(
        caches.open(CACHE).then(cache => {
            console.log("[PWA Builder] Caching pages during install");
            return cache.addAll(precacheFiles);
        })
    );
});

// If any fetch fails, it will look for the request in the cache and serve it from there first
self.addEventListener("fetch", event => {
    console.log("[PWA Builder] The service worker is serving the asset.");
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

// This is a simple example of a service worker with Cache-first network
