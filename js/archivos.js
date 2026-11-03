/* Archivos de la aplicación: los usa el service worker (para funcionar sin conexión)
 * y la portada (para armar el kit descargable). Si agregás archivos al sistema, sumalos acá. */
var ARCHIVOS_APP = [
  "index.html", "visor.html", "creador.html", "acerca.html", "manifest.webmanifest", "LEAME.md", "LICENCIA.md",
  "css/estilo.css", "img/icono.svg",
  "js/archivos.js", "js/paquete.js", "js/biblioteca.js", "js/escena-ra.js", "js/lector-qr.js",
  "lib/aframe.min.js", "lib/mindar-image-aframe.prod.js", "lib/jszip.min.js", "lib/qrcode.js", "lib/jsqr.js", "lib/LICENCIA-mindar.txt",
  "ejemplos/lamina-1-geometria.jpg", "ejemplos/lamina-2-solidos.jpg", "ejemplos/pitagoras.jpg", "ejemplos/problemas.jpg", "ejemplos/cuadrados.jpg",
  "experiencias/lista.json", "experiencias/geometria-en-movimiento.zip", "experiencias/geometria-en-movimiento.jpg",
  "experiencias/dos-actividades.zip", "experiencias/dos-actividades.jpg",
  "experiencias/cuadrados-perfectos.zip", "experiencias/cuadrados-perfectos.jpg"
];
/* Estos no se guardan para usar sin conexión en el celular (pesan mucho y no hacen falta ahí),
   pero sí van en el kit que se descarga para la notebook. */
var ARCHIVOS_KIT_EXTRA = ["visor-un-archivo.html", "creador-un-archivo.html", "servidor.py", "herramientas-armar-un-archivo.py"];
var VERSION_APP = "2.2.0";
if (typeof self !== "undefined") self.ARCHIVOS_APP = ARCHIVOS_APP;
