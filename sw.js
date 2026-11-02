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

/* Cuando alguien comparte un .zip con esta aplicación desde el menú de compartir
   del celular, llega acá como POST. Lo guardamos un momento y mandamos al visor. */
const BUZON = "ra-compartido";
const RUTA_BUZON = new URL("paquete-compartido.zip", self.registration.scope).href;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.pathname.endsWith("/recibir-compartido")) {
    e.respondWith((async () => {
      try {
        const datos = await req.formData();
        const archivo = datos.get("paquete");
        if (archivo) {
          const buzon = await caches.open(BUZON);
          await buzon.put(RUTA_BUZON, new Response(archivo, { headers: { "Content-Type": "application/zip" } }));
          return Response.redirect(new URL("visor.html?compartido=1", self.registration.scope).href, 303);
        }
      } catch (err) { /* abajo */ }
      return Response.redirect(new URL("visor.html?compartido=error", self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== "GET" || url.origin !== location.origin) return;
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
