self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evenement) => evenement.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (evenement) => {
  if (evenement.request.mode !== "navigate") {
    return;
  }
  evenement.respondWith(fetch(evenement.request));
});
