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
        el.setAttribute("crossorigin", "anonymous");
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

    const assets = crear("a-assets", { timeout: "20000" }, escena);
    medios.forEach((m) => { if (m.tipo === "video") assets.appendChild(m.el); });

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

    // si el usuario toca la pantalla, reintentamos lo que esté a la vista
    contenedor.addEventListener("click", () => {
      visibles.forEach((i) => { const m = medioDe(i); if (m && m.el.paused) reproducir(m); });
    });

    meta.laminas.forEach((l, i) => {
      const c = l.contenido || {};
      const ancla = crear("a-entity", { "mindar-image-target": "targetIndex: " + i }, escena);
      const dx = num(c.dx, 0), dy = num(c.dy, 0), dz = num(c.dz, 0);
      const rot = num(c.rotacion, 0);
      const url = c.archivo ? paquete.url(c.archivo) : null;

      if (c.tipo === "video" && url) {
        const { w, h } = medidas(l, c);
        crear("a-video", {
          src: "#ra-medio-" + i, width: w, height: h,
          position: `${dx} ${dy} ${0.002 + dz}`, rotation: `0 0 ${rot}`,
          material: "shader: flat; transparent: false; side: double",
        }, ancla);
      } else if (c.tipo === "imagen" && url) {
        const { w, h } = medidas(l, c);
        crear("a-image", {
          src: url, width: w, height: h,
          position: `${dx} ${dy} ${0.002 + dz}`, rotation: `0 0 ${rot}`,
          material: "shader: flat; transparent: true; alphaTest: 0.01; side: double",
        }, ancla);
      } else if (c.tipo === "modelo" && url) {
        const esc = num(c.escala, 0.6);
        const orient = c.orientacion === "pared" ? "0 0 0" : "90 0 0";
        const base = crear("a-entity", { position: `${dx} ${dy} ${dz}`, rotation: orient }, ancla);
        const giro = crear("a-entity", { rotation: `0 ${rot} 0` }, base);
        if (c.girar) giro.setAttribute("animation", `property: rotation; from: 0 ${rot} 0; to: 0 ${rot + 360} 0; loop: true; dur: 9000; easing: linear`);
        crear("a-gltf-model", { src: url, scale: `${esc} ${esc} ${esc}` }, giro);
      } else if (c.tipo === "audio" && url) {
        const t = Math.max(0.12, num(c.escala, 0.3));
        crear("a-image", {
          src: dibujarIconoAudio(), width: t, height: t,
          position: `${dx} ${dy} 0.01`,
          material: "shader: flat; transparent: true",
          animation: "property: scale; from: 1 1 1; to: 1.12 1.12 1.12; dir: alternate; loop: true; dur: 600; easing: easeInOutSine",
        }, ancla);
      }

      ancla.addEventListener("targetFound", () => {
        visibles.add(i);
        const m = medioDe(i);
        if (m) reproducir(m);
        op.alEncontrar && op.alEncontrar(i, l);
      });
      ancla.addEventListener("targetLost", () => {
        visibles.delete(i);
        const m = medioDe(i);
        if (m) m.el.pause();
        op.alPerder && op.alPerder(i, l, visibles.size);
      });
    });

    escena.addEventListener("arReady", () => { op.alListo && op.alListo(); });
    escena.addEventListener("arError", (e) => {
      op.alError && op.alError(e.detail && e.detail.error === "VIDEO_FAIL"
        ? "No se pudo usar la cámara. Revisá que el navegador tenga permiso y que ninguna otra aplicación la esté usando."
        : "Hubo un problema al arrancar la realidad aumentada.");
    });
    window.__RA = {
      escena, visibles, medios,
      info: () => medios.map((m) => ({
        lamina: m.indice + 1, tipo: m.tipo, listo: m.el.readyState, pausado: m.el.paused,
        silencio: m.el.muted, ancho: m.el.videoWidth || null, falla: m.falla, desbloqueado: m.desbloqueado,
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

  window.EscenaRA = { iniciar, medidas };
})();
