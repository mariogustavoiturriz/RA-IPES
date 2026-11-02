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

## Tipos de contenido

Sobre cada lámina puede aparecer un video, una imagen, un modelo 3D (.glb), un audio, un **rompecabezas** o una actividad de **ordenar palabras**. Si se elige una imagen, el creador pregunta si se muestra tal cual o si se parte en piezas. Las piezas salen desordenadas y se tocan de a dos para intercambiarlas; al completarlo aparece el mensaje que haya puesto el docente.

Para ordenar palabras no hace falta ningún archivo: se escriben las frases en el orden correcto, una por línea, y el sistema las muestra desordenadas. Se acomodan con el mismo gesto de tocar de a dos.

En la galería hay un ejemplo de las dos cosas: **Dos actividades para tocar** (rompecabezas del teorema de Pitágoras y los cuatro pasos de Pólya). Las láminas para imprimir están en `ejemplos/pitagoras.jpg` y `ejemplos/problemas.jpg`.

También hay, por lámina: bordes suaves (el contenido se desvanece hacia los costados), y un enlace que se abre al tocar el contenido. Quien mira puede agrandar con dos dedos y volver al tamaño original con doble toque.

## Compartir una experiencia por QR

Un QR no puede llevar el paquete adentro, solo una dirección: para que funcione, el `.zip` tiene que estar publicado.

1. En el creador, después de generar, poner en **Compartir** la dirección del sitio (queda guardada).
2. Subir el `.zip` a `experiencias/` del repo.
3. Usar el QR que muestra, o el botón **Hoja para imprimir**, que arma una hoja por lámina con la imagen, el QR y las instrucciones. Es lo que se cuelga en el pasillo o se reparte en clase.

Del otro lado, en el visor hay un botón **Escanear código QR**: el estudiante no necesita recibir ningún link.

Importante: si el paquete queda en Google Drive no va a funcionar, porque Drive no permite que otra página lo descargue. GitHub sí.

## Agregar experiencias a la galería

1. Subir el `.zip` (y una miniatura `.jpg` opcional) a `experiencias/`.
2. Sumarlo en `experiencias/lista.json`.
3. Para que también quede disponible sin conexión, agregarlo a `js/archivos.js` y subir `VERSION_APP`.

Un QR directo a una experiencia: `https://USUARIO.github.io/ra-ipesfa/visor.html?p=experiencias/ARCHIVO.zip` (el visor lo genera con el botón *QR para el celular*).

## Independencia: visor y paquete van por separado

El visor y el paquete no tienen por qué estar en el mismo lugar, ni pertenecer a la misma persona.

- Cualquiera puede publicar **su propia copia del sistema** (es todo estático: no hay servidor ni cuentas). El QR que arma el creador apunta al visor que vos le indiques.
- El paquete puede vivir en otro lado: en el creador hay un campo para poner su dirección completa.
- El visor abre el QR de cualquier sitio. Si ese sitio no permite la descarga cruzada, el visor manda al visor de esa persona en vez de fallar.
- **Instalado en el celular**, el visor aparece en el menú de compartir de Android: un `.zip` que llegue por WhatsApp, mail o Drive se abre tocando Compartir y eligiendo la aplicación. Sin hosting de por medio.

## Uso sin internet

**En el aula, sin internet.** Correr `python3 servidor.py` en la notebook: sirve la carpeta por `https://` en la red Wi-Fi y los celulares entran a la dirección que muestra. Los `.zip` que se dejen en `experiencias/` aparecen solos en la galería, sin editar `lista.json`.

**En la notebook.** Descargar el kit desde la portada, descomprimir y abrir `index.html` con doble clic (Chrome, Edge o Firefox). También están `visor-un-archivo.html` y `creador-un-archivo.html`, que traen todo adentro y no dependen de la carpeta.

**En el celular.** La carpeta descomprimida **no funciona en el teléfono**, y no es un error del sistema: cuando se abre un HTML desde el administrador de archivos, Android se lo pasa al navegador como `content://`, que no tiene carpeta, así que no cargan ni los estilos ni los programas. Además, a una página abierta así el teléfono no le da permiso de cámara (hace falta `https://`). El camino en el celular es entrar **una vez** al sitio publicado: queda guardado y después abre sin conexión, incluso en modo avión. Conviene agregarlo a la pantalla de inicio.

## Rearmar los archivos únicos

Si se editan `visor.html` o `creador.html`, hay que volver a generar las versiones de un solo archivo:

```
python3 herramientas-armar-un-archivo.py
```

## Formato del paquete

`experiencia.json` (datos y ajustes de cada lámina), `targets.mind` (láminas compiladas por MindAR), `laminas/N.jpg` y `contenido/N.ext`.
