importScripts('/p/scramjet.all.js');

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    await scramjet.loadConfig();

    if (scramjet.route(event)) {
      return scramjet.fetch(event);
    }

    return fetch(event.request);
  })());
});
