/* Contador de visitas propio, para Cloudflare Workers (plan gratuito).
 *
 * Para qué: un sitio estático no puede contar visitas solo. Esto es lo más
 * chico que hace falta del otro lado. Es tuyo, no depende de ningún servicio
 * de terceros y no guarda nada de quien visita: solamente un número.
 *
 * Cómo montarlo, una sola vez:
 *
 *   1. Entrá a dash.cloudflare.com y hacete una cuenta gratis.
 *   2. Workers & Pages → Create → Worker. Ponele un nombre, por ejemplo
 *      contador-ra. Deploy.
 *   3. Storage & Databases → KV → Create namespace. Nombre: visitas.
 *   4. Volvé al Worker → Settings → Bindings → Add → KV namespace.
 *      Variable name: CONTADOR     KV namespace: visitas
 *   5. Worker → Edit code. Borrá todo lo que haya y pegá este archivo. Deploy.
 *   6. Copiá la dirección del Worker (termina en .workers.dev) y ponela en
 *      js/contador.js, en la línea CONTADOR_URL.
 *
 * Límite del plan gratuito: 100.000 visitas por día. De sobra.
 */

export default {
  async fetch(request, env) {
    const cabeceras = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cabeceras });
    }

    const sumar = new URL(request.url).searchParams.get("sumar") === "1";
    let visitas = parseInt((await env.CONTADOR.get("visitas")) || "0", 10);
    if (!Number.isFinite(visitas)) visitas = 0;

    if (sumar) {
      visitas += 1;
      await env.CONTADOR.put("visitas", String(visitas));
    }

    return new Response(JSON.stringify({ visitas }), { headers: cabeceras });
  },
};
