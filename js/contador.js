/* Contador de visitas.
 *
 * Un sitio estático no puede contar visitas por sí solo: no hay nadie del otro
 * lado llevando la cuenta. Hace falta un contador propio, que es gratis y se
 * monta en diez minutos (está explicado en el LEAME, sección "Contador de visitas").
 *
 * Poné abajo la dirección de tu contador. Si queda vacía, no se muestra nada
 * y el sistema funciona igual que siempre.
 */
var CONTADOR_URL = "";

(function () {
  "use strict";
  function mostrar(n) {
    document.querySelectorAll("[data-contador]").forEach((e) => {
      e.textContent = n.toLocaleString("es-AR");
      e.parentElement && e.parentElement.classList.remove("oculto");
    });
  }

  window.addEventListener("load", function () {
    if (!CONTADOR_URL) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    // una visita por sesión: si la persona navega entre páginas no suma de nuevo
    let sumar = "1";
    try {
      if (sessionStorage.getItem("ra-contada")) sumar = "0";
      else sessionStorage.setItem("ra-contada", "1");
    } catch (e) { /* si el navegador no deja guardar, cuenta igual */ }

    fetch(CONTADOR_URL + (CONTADOR_URL.includes("?") ? "&" : "?") + "sumar=" + sumar)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.visitas === "number") mostrar(d.visitas); })
      .catch(() => { /* sin conexión o contador caído: no se muestra nada */ });
  });
})();
