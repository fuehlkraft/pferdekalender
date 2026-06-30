// ════════════════════════════════════════════════════════════════
// Fühlkraft Pferdekalender — Service Worker
// ════════════════════════════════════════════════════════════════
//
// WICHTIGSTE REGEL FÜR DICH (oder mich, beim nächsten Update):
// Jedes Mal, wenn eine neue index.html hochgeladen wird, MUSS auch
// die Zahl in SW_VERSION hier unten erhöht werden (z.B. von '3.9.0'
// auf '3.10.0'). Nur DANN merkt der Browser überhaupt, dass es eine
// neue Version gibt, und zeigt den "Update verfügbar"-Hinweis in
// der App an. Ändert sich nur die index.html, aber nicht diese
// Zahl hier, bleibt die alte Version für alle stecken!
//
// Wie das Ganze funktioniert (kurz erklärt):
// 1. Eine neue Version dieser Datei wird vom Browser im Hintergrund
//    erkannt und "installiert", aber NICHT sofort aktiv. Sie wartet.
// 2. index.html zeigt deshalb einen Hinweis-Banner an ("Update
//    verfügbar"), sobald das passiert.
// 3. Erst wenn die Person in der App auf "Update installieren"
//    klickt, wird dieser Service Worker aktiv und die Seite lädt
//    neu, jetzt mit der neuen Version.
// 4. Ein einfaches Neuladen der Seite (z.B. Pull-to-Refresh) holt
//    sich die Inhalte dagegen IMMER zuerst aus dem Cache (siehe
//    "Cache-First" weiter unten), nie automatisch vom Server. Genau
//    das verhindert das versehentliche, unangekündigte Update.
// ════════════════════════════════════════════════════════════════

const SW_VERSION = '3.25.4';
const CACHE_NAME = 'fuehlkraft-kalender-' + SW_VERSION;

// Die wichtigsten Dateien, die direkt beim Installieren vorbereitet werden.
// Fehlt eine davon (z.B. weil sie unter diesem Namen nicht existiert),
// soll das die Installation nicht blockieren, siehe unten bei "install".
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// ── INSTALL ──────────────────────────────────────────────────────
// Neue Version im Hintergrund vorbereiten (Dateien herunterladen und
// cachen), OHNE die gerade laufende, aktive Version zu stören.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        APP_SHELL.map(function (url) {
          return cache.add(url).catch(function () {
            // Einzelne fehlende Datei soll die ganze Installation nicht abbrechen
          });
        })
      );
    })
  );
  // WICHTIG: bewusst KEIN self.skipWaiting() hier!
  // Die neue Version soll erst nach ausdrücklicher Zustimmung
  // (Klick auf den Update-Button in der App) aktiv werden.
});

// ── ACTIVATE ─────────────────────────────────────────────────────
// Läuft erst, wenn die neue Version freigegeben wurde (skipWaiting).
// Räumt alte, nicht mehr benötigte Caches auf.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── FETCH: Cache-First ──────────────────────────────────────────
// Das ist der entscheidende Teil für das gewünschte Verhalten:
// Eigene Dateien werden IMMER zuerst aus dem Cache bedient. Ein
// einfaches Neuladen der Seite (auch Pull-to-Refresh) bekommt dadurch
// die zuletzt zugestimmte Version, nicht automatisch die neueste vom
// Server. Nur wenn etwas wirklich nicht im Cache liegt, wird es einmal
// nachgeladen und für später mit abgelegt.
self.addEventListener('fetch', function (event) {
  const req = event.request;

  // Nur eigene (same-origin) GET-Anfragen behandeln. Anfragen an andere
  // Server (z.B. für die KI-Funktionen) werden ganz normal durchgelassen
  // und gar nicht erst angefasst.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // sw.js selbst nie aus dem Cache bedienen, damit der Browser dessen
  // Änderungen jederzeit zuverlässig erkennen kann.
  if (req.url.indexOf('sw.js') !== -1) return;
  // version.json wird bewusst NIE vom Service Worker abgefangen oder gecacht.
  // Die manuelle Update-Prüfung in der App (Button "Update prüfen") muss
  // garantiert immer direkt zum Server durchgehen, ganz ohne jede
  // Zwischenschicht, damit sie zuverlässig erkennt, ob es eine neue
  // Version gibt, statt versehentlich eine alte, zwischengespeicherte
  // Antwort zu bekommen.
  if (req.url.indexOf('version.json') !== -1) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return response;
      }).catch(function () {
        // Offline und nichts im Cache gefunden: nichts weiter möglich
        return cached;
      });
    })
  );
});

// ── MESSAGE ──────────────────────────────────────────────────────
// Reagiert auf den Klick auf "Update installieren" in der App
// (siehe Funktion updateSW() in index.html).
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
