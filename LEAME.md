# Realidad aumentada · IPESfa

Sistema libre para crear y ver experiencias de realidad aumentada (estilo Artivive / Aumentaty) desde el navegador. No usa servidor, ni cuentas, ni instalación.

## Cómo está armado

- `index.html` portada, QR para el celular y descarga del kit sin internet.
- `creador.html` se carga la imagen de cada lámina y el contenido (video MP4, imagen, modelo .glb o audio), se analiza en el navegador y se descarga un paquete `.zip`.
- `visor.html` abre un paquete `.zip`, prende la cámara y muestra el contenido sobre la lámina. Guarda en el navegador las experiencias abiertas (sección Mis experiencias).
- `experiencias/` galería pública: los `.zip` que se suban acá y se anoten en `lista.json` aparecen en el visor cuando se usa online.
- `lib/` A-Frame 1.5, MindAR 1.2.5, JSZip y qrcode-generator, todo local (sin CDN).

## Publicar en GitHub Pages

1. Crear un repositorio (por ejemplo `ra-ipesfa`) y subir el contenido de esta carpeta a la raíz.
2. En el repo: Settings → Pages → Source: *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. En un minuto queda en `https://USUARIO.github.io/ra-ipesfa/` con HTTPS (necesario para la cámara del celular).

## Agregar experiencias a la galería

1. Subir el `.zip` (y una miniatura `.jpg` opcional) a `experiencias/`.
2. Sumarlo en `experiencias/lista.json`.
3. Para que también quede disponible sin conexión, agregarlo a `js/archivos.js` y subir `VERSION_APP`.

Un QR directo a una experiencia: `https://USUARIO.github.io/ra-ipesfa/visor.html?p=experiencias/ARCHIVO.zip` (el visor lo genera con el botón *QR para el celular*).

## Uso sin internet

**En la notebook.** Descargar el kit desde la portada, descomprimir y abrir `index.html` con doble clic (Chrome, Edge o Firefox). También están `visor-un-archivo.html` y `creador-un-archivo.html`, que traen todo adentro y no dependen de la carpeta.

**En el celular.** La carpeta descomprimida **no funciona en el teléfono**, y no es un error del sistema: cuando se abre un HTML desde el administrador de archivos, Android se lo pasa al navegador como `content://`, que no tiene carpeta, así que no cargan ni los estilos ni los programas. Además, a una página abierta así el teléfono no le da permiso de cámara (hace falta `https://`). El camino en el celular es entrar **una vez** al sitio publicado: queda guardado y después abre sin conexión, incluso en modo avión. Conviene agregarlo a la pantalla de inicio.

## Rearmar los archivos únicos

Si se editan `visor.html` o `creador.html`, hay que volver a generar las versiones de un solo archivo:

```
python3 herramientas-armar-un-archivo.py
```

## Formato del paquete

`experiencia.json` (datos y ajustes de cada lámina), `targets.mind` (láminas compiladas por MindAR), `laminas/N.jpg` y `contenido/N.ext`.
