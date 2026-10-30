/* Paquetes de experiencias RA (.zip)
 *
 * Estructura del zip:
 *   experiencia.json   datos de la experiencia (título, autoría, láminas y contenidos)
 *   targets.mind       imágenes compiladas por MindAR (una por lámina, en el mismo orden)
 *   laminas/N.jpg      la imagen de cada lámina (para mostrarla, imprimirla y volver a editarla)
 *   contenido/N.ext    lo que aparece sobre cada lámina (video, imagen, modelo 3D o audio)
 *
 * Todo se abre en memoria con URLs blob:, así funciona igual en GitHub Pages
 * que abriendo el HTML con doble clic desde la notebook.
 */
(function () {
  "use strict";

  const FORMATO = "ra-ipesfa";
  const VERSION = 1;

  const TIPOS = {
    video: { ext: ["mp4", "webm", "m4v", "mov", "ogv"], mime: { mp4: "video/mp4", m4v: "video/mp4", mov: "video/mp4", webm: "video/webm", ogv: "video/ogg" } },
    imagen: { ext: ["png", "jpg", "jpeg", "webp", "gif", "svg"], mime: { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" } },
    modelo: { ext: ["glb"], mime: { glb: "model/gltf-binary" } },
    audio: { ext: ["mp3", "ogg", "oga", "wav", "m4a", "aac"], mime: { mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac" } },
  };

  function extension(nombre) {
    const m = /\.([a-z0-9]+)$/i.exec(nombre || "");
    return m ? m[1].toLowerCase() : "";
  }

  function tipoDeArchivo(nombre, mime) {
    const ext = extension(nombre);
    for (const [tipo, def] of Object.entries(TIPOS)) if (def.ext.includes(ext)) return tipo;
    if (mime) {
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("image/")) return "imagen";
      if (mime.startsWith("audio/")) return "audio";
      if (mime === "model/gltf-binary") return "modelo";
    }
    return null;
  }

  function mimeDe(nombre) {
    const ext = extension(nombre);
    for (const def of Object.values(TIPOS)) if (def.mime[ext]) return def.mime[ext];
    if (ext === "json") return "application/json";
    return "application/octet-stream";
  }

  function slug(txt) {
    return (txt || "experiencia")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "experiencia";
  }

  /* Lee un paquete desde un Blob/File (zip). Devuelve un objeto listo para el visor. */
  async function leer(blobZip) {
    if (typeof JSZip === "undefined") throw new Error("Falta la biblioteca JSZip.");
    let zip;
    try {
      zip = await JSZip.loadAsync(blobZip);
    } catch (e) {
      throw new Error("El archivo no es un .zip válido.");
    }
    // Admite zips que tengan todo dentro de una carpeta (por ejemplo, si alguien lo descomprimió y lo volvió a comprimir)
    let base = "";
    if (!zip.file("experiencia.json")) {
      const cand = Object.keys(zip.files).find((p) => /(^|\/)experiencia\.json$/.test(p));
      if (!cand) throw new Error("El .zip no tiene experiencia.json: no parece un paquete de experiencia RA.");
      base = cand.replace(/experiencia\.json$/, "");
    }
    const meta = JSON.parse(await zip.file(base + "experiencia.json").async("string"));
    if (meta.formato !== FORMATO) throw new Error("El paquete no es de este sistema (formato desconocido).");
    if (!Array.isArray(meta.laminas) || !meta.laminas.length) throw new Error("El paquete no tiene láminas.");

    const urls = {};
    const blobs = {};
    async function cargar(ruta) {
      if (!ruta) return null;
      if (urls[ruta]) return urls[ruta];
      const f = zip.file(base + ruta);
      if (!f) throw new Error("Falta el archivo " + ruta + " dentro del paquete.");
      const datos = await f.async("arraybuffer");
      const b = new Blob([datos], { type: mimeDe(ruta) });
      blobs[ruta] = b;
      urls[ruta] = URL.createObjectURL(b);
      return urls[ruta];
    }
    await cargar(meta.targets || "targets.mind");
    for (const l of meta.laminas) {
      await cargar(l.imagen);
      if (l.contenido && l.contenido.archivo) await cargar(l.contenido.archivo);
    }
    return {
      meta,
      zip: blobZip,
      urls,
      blobs,
      url(ruta) { return urls[ruta]; },
      liberar() { Object.values(urls).forEach((u) => URL.revokeObjectURL(u)); },
    };
  }

  /* Arma el zip. datos = { titulo, autoria, descripcion, mind (ArrayBuffer/Uint8Array),
   *   laminas: [{ nombre, imagenBlob, proporcion, calidad, contenido: { tipo, blob, nombreArchivo, ...ajustes } }] } */
  async function crear(datos) {
    const zip = new JSZip();
    const meta = {
      formato: FORMATO,
      version: VERSION,
      titulo: datos.titulo || "Experiencia sin título",
      autoria: datos.autoria || "",
      descripcion: datos.descripcion || "",
      creado: new Date().toISOString(),
      targets: "targets.mind",
      laminas: [],
    };
    zip.file("targets.mind", datos.mind);
    datos.laminas.forEach((l, i) => {
      const rutaImg = "laminas/" + (i + 1) + ".jpg";
      zip.file(rutaImg, l.imagenBlob);
      const c = l.contenido || {};
      const ext = extension(c.nombreArchivo) || "bin";
      const rutaCont = c.blob ? "contenido/" + (i + 1) + "." + ext : null;
      if (c.blob) zip.file(rutaCont, c.blob);
      const ajustes = Object.assign({}, c);
      delete ajustes.blob;
      delete ajustes.url;
      ajustes.archivo = rutaCont;
      meta.laminas.push({
        nombre: l.nombre || "Lámina " + (i + 1),
        imagen: rutaImg,
        proporcion: l.proporcion,
        calidad: l.calidad,
        contenido: ajustes,
      });
    });
    zip.file("experiencia.json", JSON.stringify(meta, null, 2));
    zip.file("LEAME.txt",
      "Paquete de experiencia de realidad aumentada (sistema RA del IPESfa).\r\n\r\n" +
      "No hace falta descomprimirlo: abrí el visor y elegí este .zip con el botón\r\n" +
      "\"Abrir experiencia\". Las imágenes de la carpeta laminas son las que hay\r\n" +
      "que imprimir o proyectar para apuntarles con la cámara.\r\n");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/zip" });
    return { blob, nombre: slug(meta.titulo) + ".zip", meta };
  }

  function descargar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function esOnline() {
    return location.protocol === "http:" || location.protocol === "https:";
  }

  window.Paquete = { leer, crear, descargar, tipoDeArchivo, mimeDe, extension, slug, esOnline, TIPOS, FORMATO };
})();
