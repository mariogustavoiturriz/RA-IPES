/* Lector de códigos QR con la cámara.
 *
 * Usa el lector que ya traen los celulares (BarcodeDetector) y, si no está,
 * cae en jsQR, que funciona en cualquier navegador.
 *
 * Uso:  const txt = await LectorQR.leer();   // null si el usuario cancela
 */
(function () {
  "use strict";

  function crearPantalla() {
    const cap = document.createElement("div");
    cap.className = "qr-capa";
    cap.innerHTML =
      '<video class="qr-video" playsinline muted></video>' +
      '<div class="qr-marco"></div>' +
      '<div class="qr-texto">Apuntá al código QR</div>' +
      '<button class="btn qr-cerrar">✕ Cancelar</button>';
    document.body.appendChild(cap);
    return cap;
  }

  async function leer() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Este navegador no permite usar la cámara para leer el código.");
    }
    const cap = crearPantalla();
    const video = cap.querySelector(".qr-video");
    const aviso = cap.querySelector(".qr-texto");
    let stream = null, parar = false, lienzo = null, ctx = null;

    function cerrar() {
      parar = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      cap.remove();
    }

    return new Promise((resolver, rechazar) => {
      cap.querySelector(".qr-cerrar").onclick = () => { cerrar(); resolver(null); };

      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(async (s) => {
          stream = s;
          video.srcObject = s;
          await video.play().catch(() => {});

          let detector = null;
          try {
            if ("BarcodeDetector" in window) {
              const formatos = await window.BarcodeDetector.getSupportedFormats();
              if (formatos.includes("qr_code")) detector = new window.BarcodeDetector({ formats: ["qr_code"] });
            }
          } catch (e) { detector = null; }

          if (!detector && typeof jsQR === "undefined") {
            cerrar();
            rechazar(new Error("No se pudo cargar el lector de códigos."));
            return;
          }

          let intentos = 0;
          async function mirar() {
            if (parar) return;
            if (video.readyState >= 2) {
              let texto = null;
              try {
                if (detector) {
                  const r = await detector.detect(video);
                  if (r && r.length) texto = r[0].rawValue;
                } else {
                  if (!lienzo) {
                    lienzo = document.createElement("canvas");
                    ctx = lienzo.getContext("2d", { willReadFrequently: true });
                  }
                  const k = 480 / Math.max(video.videoWidth, 1);
                  lienzo.width = Math.round(video.videoWidth * Math.min(1, k));
                  lienzo.height = Math.round(video.videoHeight * Math.min(1, k));
                  ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
                  const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
                  const r = jsQR(datos.data, datos.width, datos.height, { inversionAttempts: "dontInvert" });
                  if (r && r.data) texto = r.data;
                }
              } catch (e) { /* seguimos mirando */ }
              if (texto) { cerrar(); resolver(texto); return; }
              if (++intentos === 90) aviso.textContent = "Acercá un poco más el código y buscá buena luz";
            }
            requestAnimationFrame(mirar);
          }
          mirar();
        })
        .catch(() => {
          cerrar();
          rechazar(new Error("No se pudo abrir la cámara. Revisá que el navegador tenga permiso."));
        });
    });
  }

  window.LectorQR = { leer };
})();
