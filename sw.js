/* Service worker: guarda la aplicación en el celular/compu después de la primera visita,
 * así el visor y el creador funcionan aunque no haya conexión. */
importScripts("js/archivos.js");
const CACHE = "ra-ipesfa-" + VERSION_APP;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./"].concat(ARCHIVOS_APP))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ra-ipesfa-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  // La galería y sus paquetes: primero la red (para ver lo nuevo), si no hay conexión, lo guardado
  if (url.pathname.includes("/experiencias/")) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // El resto de la aplicación: primero lo guardado
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
