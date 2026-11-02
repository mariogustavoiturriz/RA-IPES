/* Escena de realidad aumentada: arma A-Frame + MindAR a partir de un paquete abierto con Paquete.leer().
 *
 * Unidades: dentro de cada lámina, 1 = el ancho de la imagen; el origen es el centro de la lámina.
 * El eje Z sale de la lámina hacia la cámara.
 *
 * Uso:
 *   const sesion = await EscenaRA.iniciar(contenedor, paquete, { alEncontrar, alPerder, alListo, alError });
 *   sesion.silenciar(true|false); sesion.detener();
 */
(function () {
  "use strict";

  // MindAR deja un listener de 'resize' colgado al terminar; los anotamos para poder sacarlos.
  const listenersResize = [];
  let anotando = false;
  const addOriginal = window.addEventListener.bind(window);
  window.addEventListener = function (tipo, fn, opts) {
    if (anotando && tipo === "resize") listenersResize.push([fn, opts]);
    return addOriginal(tipo, fn, opts);
  };

  let iconoAudio = null;
  function dibujarIconoAudio() {
    if (iconoAudio) return iconoAudio;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(20,52,95,0.92)";
    g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.moveTo(62, 102); g.lineTo(98, 102); g.lineTo(140, 64); g.lineTo(140, 192); g.lineTo(98, 154); g.lineTo(62, 154); g.closePath(); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 12; g.lineCap = "round";
    g.beginPath(); g.arc(140, 128, 34, -0.8, 0.8); g.stroke();
    g.beginPath(); g.arc(140, 128, 62, -0.8, 0.8); g.stroke();
    iconoAudio = c.toDataURL("image/png");
    return iconoAudio;
  }

  function num(v, def) {
    const n = parseFloat(v);
    return isFinite(n) ? n : def;
  }

  /* Calcula ancho y alto del contenido plano (video o imagen) en unidades de la lámina */
  function medidas(lamina, c) {
    const prop = num(lamina.proporcion, 1); // alto/ancho de la lámina
    const esc = num(c.escala, 1);
    if (c.ajuste === "propio" && num(c.proporcion, 0) > 0) {
      return { w: esc, h: esc * c.proporcion };
    }
    return { w: esc, h: esc * prop };
  }

  function crear(tag, attrs, padre) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (padre) padre.appendChild(el);
    return el;
  }

  /* Debe llamarse dentro del gesto del usuario (clic en "Iniciar") para que los videos y audios
   * puedan sonar después, sobre todo en iPhone. */
  function prepararMedios(paquete, silenciado) {
    const medios = [];
    paquete.meta.laminas.forEach((l, i) => {
      const c = l.contenido || {};
      if (!c.archivo) return;
      let el = null;
      if (c.tipo === "video") {
        el = document.createElement("video");
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        el.setAttribute("muted", "");
        el.preload = "auto";
        el.loop = c.repetir !== false;
        el.src = paquete.url(c.archivo);
        el.id = "ra-medio-" + i;
      } else if (c.tipo === "audio") {
        el = new Audio();
        el.preload = "auto";
        el.loop = c.repetir !== false;
        el.src = paquete.url(c.archivo);
      }
      if (el) {
        el.muted = true; // arranca siempre en silencio; es la única forma de que el celular lo deje
        const m = { indice: i, el, tipo: c.tipo, conSonido: c.sonido !== false, desbloqueado: false, falla: null };
        el.addEventListener("error", () => { m.falla = codigoError(el); });
        // "desbloqueo": play + pause dentro del toque del usuario
        const p = el.play();
        if (p && p.then) p.then(() => { el.pause(); el.currentTime = 0; m.desbloqueado = true; }).catch(() => {});
        medios.push(m);
      }
    });
    return medios;
  }

  function textoCanvas(texto) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(20,52,95,0.93)";
    if (g.roundRect) { g.beginPath(); g.roundRect(8, 8, c.width - 16, c.height - 16, 44); g.fill(); }
    else g.fillRect(8, 8, c.width - 16, c.height - 16);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let tam = 92;
    do { g.font = "bold " + tam + "px system-ui, sans-serif"; tam -= 6; }
    while (g.measureText(texto).width > c.width - 90 && tam > 28);
    g.fillText(texto, c.width / 2, c.height / 2);
    return c;
  }

  function placaCanvas(texto, proporcion) {
    const W = 768, H = Math.max(96, Math.round(W * proporcion));
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(250,247,240,0.97)";
    const r = Math.min(H * 0.28, 46);
    if (g.roundRect) { g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, r); g.fill(); }
    else g.fillRect(4, 4, W - 8, H - 8);
    g.strokeStyle = "rgba(20,52,95,0.85)";
    g.lineWidth = 6;
    if (g.roundRect) { g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, r); g.stroke(); }
    g.fillStyle = "#14345f";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let tam = Math.round(H * 0.46);
    do { g.font = "bold " + tam + "px system-ui, sans-serif"; tam -= 4; }
    while (g.measureText(texto).width > W - 60 && tam > 16);
    g.fillText(texto, W / 2, H / 2);
    return c;
  }

  /* Dibuja la máscara que suaviza los bordes: blanco en el medio, que se va
     desvaneciendo hacia afuera. Se usa igual en la escena y en la vista previa
     del creador, así lo que ves al armar es lo que se ve después. */
  /* Dibuja la máscara que suaviza los bordes: opaca en el medio y desvanecida
     hacia afuera. La calculamos píxel por píxel en vez de usar el desenfoque del
     navegador, porque varios Android no lo tienen y el borde salía duro.
     Se usa igual en la escena y en la vista previa del creador. */
  function mascaraCanvas(aspecto, suavidad, conAlfa) {
    const W = 192;
    const H = Math.max(16, Math.round(W * (aspecto || 1)));
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const img = g.createImageData(W, H);
    const px = img.data;
    const s = Math.max(0, Math.min(0.45, suavidad || 0));
    const banda = Math.max(1, Math.min(W, H) * s * 0.5);   // ancho del desvanecido
    const radio = banda * 0.9;                             // esquinas redondeadas
    const mx = W / 2, my = H / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // distancia al borde de un rectángulo de esquinas redondeadas
        const dx = Math.abs(x + 0.5 - mx) - (mx - radio);
        const dy = Math.abs(y + 0.5 - my) - (my - radio);
        const fuera = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
        const d = fuera + Math.min(Math.max(dx, dy), 0) - radio;
        let t = -d / banda;                 // 1 bien adentro, 0 en el borde
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const a = t * t * (3 - 2 * t);      // suavizado, para que no se note el corte
        const i = (y * W + x) * 4;
        if (conAlfa) { px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = Math.round(a * 255); }
        else { px[i] = px[i + 1] = px[i + 2] = Math.round(a * 255); px[i + 3] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* El plano del video lo armamos a mano con three.js. Si se deja que A-Frame lo
     tome de <a-assets>, el video queda en un contenedor con display:none y muchos
     Android entregan el sonido pero no los cuadros: se escucha y no se ve. */
  function registrarComponente() {
    if (AFRAME.components["ra-video"]) return;
    AFRAME.registerComponent("ra-video", {
      schema: {
        id: { type: "string" }, src: { type: "string" },
        w: { type: "number", default: 1 }, h: { type: "number", default: 1 },
        suave: { type: "number", default: 0 },
      },
      init: function () {
        const T = AFRAME.THREE;
        let tex = null;
        if (this.data.id) {
          const video = document.getElementById(this.data.id);
          if (!video) return;
          tex = new T.VideoTexture(video);
          this.video = video;
        } else if (this.data.src) {
          tex = new T.TextureLoader().load(this.data.src);
        } else return;
        tex.minFilter = T.LinearFilter;
        tex.magFilter = T.LinearFilter;
        if ("colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        else if ("encoding" in tex && T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
        const opciones = { map: tex, side: T.DoubleSide };
        if (this.data.suave > 0) {
          const mascara = new T.CanvasTexture(mascaraCanvas(this.data.h / this.data.w, this.data.suave));
          mascara.minFilter = T.LinearFilter;
          opciones.alphaMap = mascara;
          opciones.transparent = true;
          opciones.depthWrite = false;
        }
        const mat = new T.MeshBasicMaterial(opciones);
        if ("toneMapped" in mat) mat.toneMapped = false;
        this.malla = new T.Mesh(new T.PlaneGeometry(this.data.w, this.data.h), mat);
        this.malla.userData.lamina = this.el.dataset.lamina;
        this.el.setObject3D("mesh", this.malla);
        this.textura = tex;
        this.cuadros = 0;
      },

      /* three.js se apoya en requestVideoFrameCallback para enterarse de que hay un
         cuadro nuevo. En Android ese aviso no llega cuando el video no se está
         mostrando en pantalla, así que la textura queda clavada en el primer cuadro
         mientras el audio sigue corriendo. Acá le avisamos nosotros en cada cuadro. */
      tick: function () {
        const v = this.video;
        if (!v || !this.textura) return;
        if (!v.paused && v.readyState >= 2) {
          this.textura.needsUpdate = true;
          this.cuadros++;
        }
      },
      remove: function () {
        if (!this.malla) return;
        this.el.removeObject3D("mesh");
        this.malla.material.map && this.malla.material.map.dispose();
        this.malla.material.alphaMap && this.malla.material.alphaMap.dispose();
        this.malla.material.dispose();
        this.malla.geometry.dispose();
      },
    });
  }

  /* Rompecabezas: la imagen se parte en una grilla y las piezas aparecen
     desordenadas sobre la lámina. Se tocan de a dos para intercambiarlas. */
  function registrarRompecabezas() {
    if (AFRAME.components["ra-rompecabezas"]) return;
    AFRAME.registerComponent("ra-rompecabezas", {
      schema: {
        src: { type: "string" },
        w: { type: "number", default: 1 }, h: { type: "number", default: 1 },
        cols: { type: "int", default: 3 }, filas: { type: "int", default: 3 },
        pista: { type: "boolean", default: true },
        mensaje: { type: "string", default: "¡Muy bien!" },
      },
      init: function () {
        const T = AFRAME.THREE, d = this.data;
        const grupo = new T.Group();
        this.el.setObject3D("mesh", grupo);
        this.grupo = grupo;
        const tex = new T.TextureLoader().load(d.src);
        tex.minFilter = T.LinearFilter;
        if ("colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        this.tex = tex;

        if (d.pista) {
          const pista = new T.Mesh(
            new T.PlaneGeometry(d.w, d.h),
            new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.16, depthWrite: false })
          );
          pista.position.z = -0.004;
          pista.userData.pista = true;
          grupo.add(pista);
        }

        const cw = d.w / d.cols, ch = d.h / d.filas;
        this.piezas = [];
        for (let r = 0; r < d.filas; r++) {
          for (let c = 0; c < d.cols; c++) {
            const g = new T.PlaneGeometry(cw * 0.94, ch * 0.94);
            const u0 = c / d.cols, u1 = (c + 1) / d.cols;
            const v0 = 1 - (r + 1) / d.filas, v1 = 1 - r / d.filas;
            const uv = g.attributes.uv;
            uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
            uv.needsUpdate = true;
            const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
            m.userData.pieza = r * d.cols + c;
            grupo.add(m);
            this.piezas.push(m);
          }
        }
        this.orden = this.piezas.map((_, i) => i);   // orden[casillero] = pieza que está ahí
        this.seleccion = null;
        this.resuelto = false;
        this.mezclar();
      },

      posicionDe: function (casillero) {
        const d = this.data, cw = d.w / d.cols, ch = d.h / d.filas;
        const c = casillero % d.cols, r = Math.floor(casillero / d.cols);
        return { x: -d.w / 2 + cw * (c + 0.5), y: d.h / 2 - ch * (r + 0.5) };
      },
      colocar: function () {
        this.orden.forEach((pieza, casillero) => {
          const p = this.posicionDe(casillero);
          this.piezas[pieza].position.set(p.x, p.y, 0);
        });
      },
      estaResuelto: function () { return this.orden.every((pieza, casillero) => pieza === casillero); },
      mezclar: function () {
        let vueltas = 0;
        do {
          for (let i = this.orden.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = this.orden[i]; this.orden[i] = this.orden[j]; this.orden[j] = t;
          }
        } while (this.estaResuelto() && ++vueltas < 20);
        this.colocar();
      },
      resaltar: function (casillero, si) {
        const m = this.piezas[this.orden[casillero]];
        if (!m) return;
        m.material.color.setHex(si ? 0xffd27a : 0xffffff);
        m.position.z = si ? 0.012 : 0;
        m.scale.setScalar(si ? 1.07 : 1);
      },
      /* Llamado desde el visor cuando el usuario toca una pieza */
      tocar: function (malla) {
        if (this.resuelto || !malla) return true;
        let o = malla;
        while (o && o.userData.pieza === undefined) o = o.parent;
        if (!o) return true;
        const casillero = this.orden.indexOf(o.userData.pieza);
        if (casillero < 0) return true;
        if (this.seleccion === null) { this.seleccion = casillero; this.resaltar(casillero, true); return true; }
        if (this.seleccion === casillero) { this.resaltar(casillero, false); this.seleccion = null; return true; }
        this.resaltar(this.seleccion, false);
        const a = this.seleccion, b = casillero;
        const t = this.orden[a]; this.orden[a] = this.orden[b]; this.orden[b] = t;
        this.seleccion = null;
        this.colocar();
        if (this.estaResuelto()) this.festejar();
        return true;
      },
      festejar: function () {
        const T = AFRAME.THREE, d = this.data;
        this.resuelto = true;
        this.piezas.forEach((m) => m.scale.setScalar(1 / 0.94));   // se cierran los huecos
        this.grupo.children.forEach((o) => { if (o.userData.pista) o.visible = false; });
        // El cartel va en la pantalla y no en la escena: así se ve siempre,
        // esté la cámara cerca o lejos de la lámina.
        this.el.emit("rompecabezas-resuelto", { mensaje: d.mensaje || "¡Muy bien!" }, true);
      },
      remove: function () {
        if (!this.grupo) return;
        this.grupo.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); }
        });
        this.el.removeObject3D("mesh");
      },
    });
  }

  /* Ordenar: las palabras o frases aparecen desordenadas, una debajo de la otra.
     Se tocan de a dos para intercambiarlas, igual que el rompecabezas. */
  function registrarOrdenar() {
    if (AFRAME.components["ra-ordenar"]) return;
    AFRAME.registerComponent("ra-ordenar", {
      schema: {
        items: { type: "string" },                 // textos, separados por |
        fotos: { type: "string" },                 // o direcciones de imágenes, separadas por |
        w: { type: "number", default: 1 }, h: { type: "number", default: 1 },
        dir: { type: "string", default: "columna" },
        mensaje: { type: "string", default: "¡Muy bien!" },
      },
      init: function () {
        const T = AFRAME.THREE, d = this.data;
        const fotos = (d.fotos || "").split("|").map((t) => t.trim()).filter(Boolean);
        const textos = (d.items || "").split("|").map((t) => t.trim()).filter(Boolean);
        const n = fotos.length || textos.length;
        if (!n) return;
        this.textos = fotos.length ? null : textos;
        const grupo = new T.Group();
        this.el.setObject3D("mesh", grupo);
        this.grupo = grupo;

        this.enFila = d.dir === "fila";
        // cada pieza ocupa un casillero; el casillero es el ancho o el alto dividido en n
        if (this.enFila) {
          this.paso = (d.w * 0.94) / n;
          this.anchoPieza = this.paso * 0.88;
          this.altoPieza = Math.min(d.h * 0.8, this.anchoPieza * (fotos.length ? 1 : 0.5));
        } else {
          this.paso = (d.h * 0.92) / n;
          this.anchoPieza = d.w * (fotos.length ? 0.55 : 0.86);
          this.altoPieza = this.paso * 0.84;
        }

        const cargador = new T.TextureLoader();
        this.piezas = [];
        for (let i = 0; i < n; i++) {
          const g = new T.Group();
          if (fotos.length) {
            // marco oscuro detrás, para que se despegue de la lámina
            const marco = new T.Mesh(
              new T.PlaneGeometry(this.anchoPieza * 1.06, this.altoPieza * 1.06),
              new T.MeshBasicMaterial({ color: 0x14345f, side: T.DoubleSide })
            );
            marco.position.z = -0.002;
            g.add(marco);
            const tex = cargador.load(fotos[i]);
            tex.minFilter = T.LinearFilter;
            if ("colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
            const foto = new T.Mesh(
              new T.PlaneGeometry(this.anchoPieza, this.altoPieza),
              new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })
            );
            g.add(foto);
          } else {
            const tex = new T.CanvasTexture(placaCanvas(textos[i], this.altoPieza / this.anchoPieza));
            tex.minFilter = T.LinearFilter;
            g.add(new T.Mesh(
              new T.PlaneGeometry(this.anchoPieza, this.altoPieza),
              new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthWrite: false })
            ));
          }
          g.userData.pieza = i;
          g.children.forEach((o) => { o.userData.pieza = i; });
          grupo.add(g);
          this.piezas.push(g);
        }
        this.orden = this.piezas.map((_, i) => i);
        this.seleccion = null;
        this.resuelto = false;
        this.mezclar();
      },
      posicionDe: function (casillero) {
        const n = this.piezas.length;
        if (this.enFila) return { x: -this.paso * (n - 1) / 2 + this.paso * casillero, y: 0 };
        return { x: 0, y: this.paso * (n - 1) / 2 - this.paso * casillero };
      },
      colocar: function () {
        this.orden.forEach((pieza, casillero) => {
          const p = this.posicionDe(casillero);
          this.piezas[pieza].position.set(p.x, p.y, 0);
        });
      },
      estaResuelto: function () { return this.orden.every((pieza, casillero) => pieza === casillero); },
      mezclar: function () {
        let vueltas = 0;
        do {
          for (let i = this.orden.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = this.orden[i]; this.orden[i] = this.orden[j]; this.orden[j] = t;
          }
        } while (this.estaResuelto() && ++vueltas < 20);
        this.colocar();
      },
      resaltar: function (casillero, si) {
        const g = this.piezas[this.orden[casillero]];
        if (!g) return;
        g.children.forEach((o) => { if (o.material) o.material.color.setHex(si ? 0xffd27a : (o === g.children[0] && g.children.length > 1 ? 0x14345f : 0xffffff)); });
        g.position.z = si ? 0.012 : 0;
        g.scale.setScalar(si ? 1.06 : 1);
      },
      tocar: function (malla) {
        if (this.resuelto || !malla) return;
        let o = malla;
        while (o && o.userData.pieza === undefined) o = o.parent;
        if (!o) return;
        const casillero = this.orden.indexOf(o.userData.pieza);
        if (casillero < 0) return;
        if (this.seleccion === null) { this.seleccion = casillero; this.resaltar(casillero, true); return; }
        if (this.seleccion === casillero) { this.resaltar(casillero, false); this.seleccion = null; return; }
        this.resaltar(this.seleccion, false);
        const a = this.seleccion, b = casillero;
        const t = this.orden[a]; this.orden[a] = this.orden[b]; this.orden[b] = t;
        this.seleccion = null;
        this.colocar();
        if (this.estaResuelto()) {
          this.resuelto = true;
          this.el.emit("rompecabezas-resuelto", { mensaje: this.data.mensaje || "¡Muy bien!" }, true);
        }
      },
      remove: function () {
        if (!this.grupo) return;
        this.grupo.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); }
        });
        this.el.removeObject3D("mesh");
      },
    });
  }

  function codigoError(el) {
    const e = el.error;
    if (!e) return null;
    return {
      1: "se canceló la carga del video",
      2: "se cortó la descarga del video",
      3: "el navegador no puede decodificar este video",
      4: "este navegador no soporta el formato del video (probá convertirlo a MP4 H.264)",
    }[e.code] || "no se pudo abrir el video";
  }

  function avisar(contenedor, texto) {
    let d = contenedor.querySelector(".ra-diag");
    if (!d) {
      d = document.createElement("div");
      d.className = "ra-diag";
      d.style.cssText = "position:fixed;z-index:63;left:12px;right:12px;top:72px;max-width:520px;margin:0 auto;" +
        "background:rgba(192,57,43,.94);color:#fff;padding:10px 14px;border-radius:12px;font:14px/1.4 system-ui,sans-serif";
      contenedor.appendChild(d);
    }
    d.textContent = texto;
    clearTimeout(d._t);
    d._t = setTimeout(() => { d.remove(); }, 9000);
  }

  async function iniciar(contenedor, paquete, opciones) {
    const op = Object.assign({ silenciado: false }, opciones || {});
    if (typeof AFRAME === "undefined" || !window.MINDAR) throw new Error("No se cargaron las bibliotecas de RA (A-Frame / MindAR).");
    const meta = paquete.meta;
    registrarComponente();
    registrarRompecabezas();
    registrarOrdenar();
    const medios = prepararMedios(paquete, op.silenciado);
    const medioDe = (i) => medios.find((m) => m.indice === i);

    contenedor.innerHTML = "";
    anotando = true;

    const escena = crear("a-scene", {
      "mindar-image": [
        "imageTargetSrc: " + paquete.url(meta.targets || "targets.mind"),
        "maxTrack: " + Math.min(2, meta.laminas.length),
        "filterMinCF: 0.0001",
        "filterBeta: 0.001",
        "uiLoading: no",
        "uiScanning: no",
        "uiError: no",
      ].join("; "),
      "color-space": "sRGB",
      renderer: "colorManagement: true; physicallyCorrectLights: true; alpha: true; antialias: true",
      "vr-mode-ui": "enabled: false",
      "device-orientation-permission-ui": "enabled: false",
      embedded: "",
      loading: "false",
    });
    escena.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

    medios.forEach((m) => {
      if (m.tipo !== "video") return;
      m.el.style.cssText = "position:absolute;top:0;left:0;width:64px;height:64px;opacity:0.01;pointer-events:none;z-index:-3";
      contenedor.appendChild(m.el);
    });

    crear("a-camera", { position: "0 0 0", "look-controls": "enabled: false", "wasd-controls": "enabled: false" }, escena);
    crear("a-entity", { light: "type: ambient; intensity: 1.2" }, escena);
    crear("a-entity", { light: "type: directional; intensity: 1.6", position: "0.5 1 1" }, escena);

    const visibles = new Set();
    let silencio = !!op.silenciado;

    function reproducir(m) {
      const el = m.el;
      if (m.falla) { avisar(contenedor, "Lámina " + (m.indice + 1) + ": " + m.falla); return; }
      // una vez que arrancó, recién ahí se le devuelve el sonido
      el.addEventListener("playing", function alArrancar() {
        el.removeEventListener("playing", alArrancar);
        if (m.conSonido && !silencio) el.muted = false;
      });
      const p = el.play();
      if (p && p.catch) p.catch(() => {
        el.muted = true;               // segundo intento, siempre en silencio
        const q = el.play();
        if (q && q.catch) q.catch(() => {
          avisar(contenedor, m.falla || "El celular no dejó arrancar el video. Tocá la pantalla y volvé a apuntar a la lámina.");
        });
      });
    }

    /* ----- Agrandar y achicar con dos dedos ----- */
    let escalaUsuario = 1, pellizco = null;

    function aplicarEscala() {
      Object.values(contenidos).forEach((e) => {
        if (e.object3D) e.object3D.scale.set(escalaUsuario, escalaUsuario, escalaUsuario);
      });
    }
    const separacion = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    contenedor.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) pellizco = { d: separacion(e.touches), base: escalaUsuario };
    }, { passive: true });
    contenedor.addEventListener("touchmove", (e) => {
      if (!pellizco || e.touches.length !== 2) return;
      const k = separacion(e.touches) / (pellizco.d || 1);
      escalaUsuario = Math.max(0.25, Math.min(4, pellizco.base * k));
      aplicarEscala();
      e.preventDefault();          // que no haga zoom la página
    }, { passive: false });
    contenedor.addEventListener("touchend", () => { pellizco = null; }, { passive: true });

    // doble toque: vuelve al tamaño original
    let ultimoToque = { t: 0, x: 0, y: 0 };
    contenedor.addEventListener("click", (ev) => {
      const ahora = Date.now();
      const cerca = Math.hypot((ev.clientX || 0) - ultimoToque.x, (ev.clientY || 0) - ultimoToque.y) < 32;
      if (ahora - ultimoToque.t < 350 && cerca) { escalaUsuario = 1; aplicarEscala(); }
      ultimoToque = { t: ahora, x: ev.clientX || 0, y: ev.clientY || 0 };
    });

    /* ----- Tocar para abrir un enlace ----- */
    let botonEnlace = null;
    function mostrarEnlace() {
      const conEnlace = [...visibles].find((i) => enlaces[i]);
      if (!conEnlace && conEnlace !== 0) {
        if (botonEnlace) { botonEnlace.remove(); botonEnlace = null; }
        return;
      }
      const url = enlaces[conEnlace];
      if (!botonEnlace) {
        botonEnlace = document.createElement("button");
        botonEnlace.className = "btn ra-enlace";
        contenedor.appendChild(botonEnlace);
      }
      let donde = url;
      try { donde = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
      botonEnlace.textContent = "🔗 Abrir " + donde;
      botonEnlace.onclick = (ev) => { ev.stopPropagation(); window.open(url, "_blank", "noopener"); };
    }

    // tocar directamente sobre el contenido también abre el enlace
    function tocoElContenido(ev) {
      const cam = escena.camera;
      if (!cam) return null;
      if (ev.clientX === undefined) return null;
      const r = contenedor.getBoundingClientRect();
      const punto = new AFRAME.THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1
      );
      const rayo = new AFRAME.THREE.Raycaster();
      rayo.setFromCamera(punto, cam);
      const objetos = [];
      Object.values(contenidos).forEach((e) => { if (e.object3D && e.object3D.visible) objetos.push(e.object3D); });
      const choques = rayo.intersectObjects(objetos, true);
      if (!choques.length) return null;
      const objeto = choques[0].object;
      let o = objeto;
      while (o && o.el === undefined) o = o.parent;
      return o && o.el ? { el: o.el, objeto } : null;
    }

    contenedor.addEventListener("click", (ev) => {
      // si algo quedó pausado, lo reintentamos
      visibles.forEach((i) => { const m = medioDe(i); if (m && m.el.paused) reproducir(m); });
      const golpe = tocoElContenido(ev);
      if (!golpe) return;
      const comps = golpe.el.components || {};
      const juego = comps["ra-rompecabezas"] || comps["ra-ordenar"];
      if (juego && juego.tocar) { juego.tocar(golpe.objeto); return; }   // el toque es del juego, no abre nada
      const i = golpe.el.dataset.lamina;
      if (i !== undefined && enlaces[i]) window.open(enlaces[i], "_blank", "noopener");
    });

    const contenidos = {};   // lo que aparece sobre cada lámina
    const enlaces = {};      // dirección a abrir al tocar, por lámina

    meta.laminas.forEach((l, i) => {
      const c = l.contenido || {};
      let contenido = null;
      const ancla = crear("a-entity", { "mindar-image-target": "targetIndex: " + i }, escena);
      const dx = num(c.dx, 0), dy = num(c.dy, 0), dz = num(c.dz, 0);
      const rot = num(c.rotacion, 0);
      const url = c.archivo ? paquete.url(c.archivo) : null;

      const suave = Math.max(0, Math.min(0.45, num(c.suave, 0.12)));

      if (c.tipo === "ordenar") {
        const w = num(c.escala, 1), h = w * num(l.proporcion, 1);
        contenido = crear("a-entity", { position: `${dx} ${dy} ${0.006 + dz}` }, ancla);
        contenido.setAttribute("ra-ordenar", {
          items: (c.items || []).join("|"),
          fotos: (c.archivos || []).map((a) => paquete.url(a)).join("|"),
          w: w, h: h,
          dir: c.direccion || "columna",
          mensaje: c.mensaje || "¡Muy bien!",
        });
      } else if (c.tipo === "imagen" && c.juego === "rompecabezas" && url) {
        const { w, h } = medidas(l, c);
        contenido = crear("a-entity", {
          "ra-rompecabezas": `src: ${url}; w: ${w}; h: ${h}; cols: ${Math.max(2, num(c.cols, 3))};` +
                             ` filas: ${Math.max(2, num(c.filas, 3))}; pista: ${c.pista !== false};` +
                             ` mensaje: ${(c.mensaje || "¡Muy bien!").replace(/[;:]/g, " ")}`,
          position: `${dx} ${dy} ${0.004 + dz}`, rotation: `0 0 ${rot}`,
        }, ancla);
      } else if ((c.tipo === "video" || c.tipo === "imagen") && url) {
        const { w, h } = medidas(l, c);
        contenido = crear("a-entity", {
          "ra-video": (c.tipo === "video" ? `id: ra-medio-${i}` : `src: ${url}`) +
                      `; w: ${w}; h: ${h}; suave: ${suave}`,
          position: `${dx} ${dy} ${0.002 + dz}`, rotation: `0 0 ${rot}`,
        }, ancla);
      } else if (c.tipo === "modelo" && url) {
        const esc = num(c.escala, 0.6);
        const orient = c.orientacion === "pared" ? "0 0 0" : "90 0 0";
        const base = contenido = crear("a-entity", { position: `${dx} ${dy} ${dz}`, rotation: orient }, ancla);
        const giro = crear("a-entity", { rotation: `0 ${rot} 0` }, base);
        if (c.girar) giro.setAttribute("animation", `property: rotation; from: 0 ${rot} 0; to: 0 ${rot + 360} 0; loop: true; dur: 9000; easing: linear`);
        crear("a-gltf-model", { src: url, scale: `${esc} ${esc} ${esc}` }, giro);
      } else if (c.tipo === "audio" && url) {
        const t = Math.max(0.12, num(c.escala, 0.3));
        contenido = crear("a-image", {
          src: dibujarIconoAudio(), width: t, height: t,
          position: `${dx} ${dy} 0.01`,
          material: "shader: flat; transparent: true",
          animation: "property: scale; from: 1 1 1; to: 1.12 1.12 1.12; dir: alternate; loop: true; dur: 600; easing: easeInOutSine",
        }, ancla);
      }

      if (contenido) {
        contenidos[i] = contenido;
        contenido.dataset.lamina = i;
      }
      if (c.enlace && /^https?:\/\//i.test(c.enlace)) enlaces[i] = c.enlace;

      ancla.addEventListener("targetFound", () => {
        visibles.add(i);
        const m = medioDe(i);
        if (m) reproducir(m);
        aplicarEscala();
        mostrarEnlace();
        op.alEncontrar && op.alEncontrar(i, l);
      });
      ancla.addEventListener("targetLost", () => {
        visibles.delete(i);
        const m = medioDe(i);
        if (m) m.el.pause();
        mostrarEnlace();
        op.alPerder && op.alPerder(i, l, visibles.size);
      });
    });

    escena.addEventListener("rompecabezas-resuelto", (ev) => {
      const cartel = document.createElement("div");
      cartel.className = "ra-festejo";
      cartel.innerHTML = "<span>🎉</span>" + ((ev.detail && ev.detail.mensaje) || "¡Muy bien!");
      contenedor.appendChild(cartel);
      setTimeout(() => cartel.classList.add("se-va"), 3600);
      setTimeout(() => cartel.remove(), 4400);
    });

    escena.addEventListener("arReady", () => { op.alListo && op.alListo(); });
    escena.addEventListener("arError", (e) => {
      op.alError && op.alError(e.detail && e.detail.error === "VIDEO_FAIL"
        ? "No se pudo usar la cámara. Revisá que el navegador tenga permiso y que ninguna otra aplicación la esté usando."
        : "Hubo un problema al arrancar la realidad aumentada.");
    });
    const cuadrosDe = (i) => {
      const comps = escena.querySelectorAll("[ra-video]");
      for (const c of comps) if (c.components["ra-video"].data.id === "ra-medio-" + i) return c.components["ra-video"].cuadros;
      return null;
    };
    window.__RA = {
      escena, visibles, medios,
      info: () => medios.map((m) => ({
        lamina: m.indice + 1, tipo: m.tipo, listo: m.el.readyState, pausado: m.el.paused,
        silencio: m.el.muted, ancho: m.el.videoWidth || null, falla: m.falla, desbloqueado: m.desbloqueado,
        tiempo: Math.round((m.el.currentTime || 0) * 10) / 10, refrescos: cuadrosDe(m.indice),
      })),
    };

    contenedor.appendChild(escena);

    let detenida = false;
    return {
      escena,
      silenciar(si) {
        silencio = !!si;
        medios.forEach((m) => { m.el.muted = silencio || !m.conSonido || m.el.paused; });
      },
      detener() {
        if (detenida) return;
        detenida = true;
        medios.forEach((m) => { try { m.el.pause(); m.el.removeAttribute("src"); m.el.load(); } catch (e) {} });
        const sistema = escena.systems && escena.systems["mindar-image-system"];
        try {
          if (sistema && sistema.video) {
            if (sistema.video.srcObject) sistema.video.srcObject.getTracks().forEach((t) => t.stop());
            sistema.video.remove();
          }
          if (sistema && sistema.controller) {
            sistema.controller.stopProcessVideo();
            sistema.controller.dispose();
          }
        } catch (e) { /* ya estaba detenido */ }
        if (sistema) sistema.stop = function () {}; // evita el doble stop al sacar la escena
        try { escena.parentNode && escena.parentNode.removeChild(escena); } catch (e) {}
        listenersResize.splice(0).forEach(([fn, o]) => window.removeEventListener("resize", fn, o));
        anotando = false;
        contenedor.querySelectorAll("video").forEach((v) => v.remove());
        contenedor.innerHTML = "";
        window.__RA = null;
      },
    };
  }

  window.EscenaRA = { iniciar, medidas, mascaraCanvas };
})();
