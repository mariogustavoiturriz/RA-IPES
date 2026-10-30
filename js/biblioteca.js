/* "Mis experiencias": guarda en el navegador los paquetes que se abrieron, para volver a usarlos sin internet.
 * Si el navegador no deja guardar (modo incógnito, archivo local con restricciones), simplemente no se usa. */
(function () {
  "use strict";
  const DB = "ra-ipesfa", STORE = "paquetes";
  let dbProm = null;

  function abrir() {
    if (dbProm) return dbProm;
    dbProm = new Promise((ok, mal) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
        req.onsuccess = () => ok(req.result);
        req.onerror = () => mal(req.error);
      } catch (e) { mal(e); }
    });
    return dbProm;
  }

  async function tx(modo, fn) {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const t = db.transaction(STORE, modo);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    });
  }

  async function miniatura(blob) {
    try {
      const bmp = await createImageBitmap(blob);
      const k = 240 / Math.max(bmp.width, bmp.height);
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.75);
    } catch (e) { return null; }
  }

  async function guardar(paquete) {
    const m = paquete.meta;
    const id = Paquete.slug(m.titulo) + "-" + (m.creado || "").replace(/\D/g, "").slice(0, 14);
    const primera = paquete.blobs[m.laminas[0].imagen];
    const reg = {
      id, titulo: m.titulo, autoria: m.autoria || "", laminas: m.laminas.length,
      guardado: Date.now(), tamano: paquete.zip.size, mini: primera ? await miniatura(primera) : null,
      zip: paquete.zip,
    };
    await tx("readwrite", (s) => s.put(reg));
    return id;
  }

  async function listar() {
    const todos = await tx("readonly", (s) => s.getAll());
    return (todos || []).sort((a, b) => b.guardado - a.guardado);
  }

  async function obtener(id) { return tx("readonly", (s) => s.get(id)); }
  async function borrar(id) { return tx("readwrite", (s) => s.delete(id)); }

  window.Biblioteca = { guardar, listar, obtener, borrar };
})();
