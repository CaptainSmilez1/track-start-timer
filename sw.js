const CACHE = "starta-v15";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./sounds/bang.wav",
  "./sounds/horn.wav",
  "./sounds/buzzer.wav",
  "./sounds/whistle.wav",
  "./sounds/quack.wav",
  "./sounds/boing.wav",
  "./sounds/goat.wav"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){ return cache.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      const fetchPromise = fetch(event.request).then(function(res){
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(event.request, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
