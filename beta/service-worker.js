// Load Scramjet
importScripts('/p/scramjet.all.js');

// Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler (Scramjet handles proxying internally)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let Scramjet handle its own prefix
  if (url.pathname.startsWith('/scramjet/')) {
    return; // DO NOT interfere
  }

  // Otherwise just pass through normally
  event.respondWith(fetch(event.request));
});
