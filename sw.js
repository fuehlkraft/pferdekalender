// Fühlkraft Kalender - Service Worker
const CACHE_NAME = 'fuehlkraft-kalender-v6';

// Installation
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(['./']);
    })
  );
});

// Aktivierung - alte Caches löschen
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
});

// Fetch - Netzwerk zuerst, dann Cache
self.addEventListener('fetch', function(e){
  e.respondWith(
    fetch(e.request).then(function(response){
      // Neue Version im Cache speichern
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache){
        cache.put(e.request, clone);
      });
      return response;
    }).catch(function(){
      // Offline: aus Cache laden
      return caches.match(e.request);
    })
  );
});

// Update-Signal empfangen
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
