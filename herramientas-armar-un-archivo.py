#!/usr/bin/env python3
"""Arma las versiones de un solo archivo (visor-un-archivo.html y creador-un-archivo.html):
mete adentro del HTML el CSS, el JavaScript y las bibliotecas, así no dependen de la carpeta.
Se corre parado en la carpeta del sitio:  python3 herramientas-armar-un-archivo.py
"""
import re, base64, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
ICONO = "data:image/svg+xml;base64," + base64.b64encode(open("img/icono.svg", "rb").read()).decode()

def inlinar(origen, destino):
    s = open(origen, encoding="utf-8").read()
    s = re.sub(r'\s*<link rel="manifest"[^>]*>', "", s)
    s = re.sub(r'\s*<link rel="icon"[^>]*>', '\n<link rel="icon" href="' + ICONO + '">', s)

    def css(m):
        txt = open(m.group(1), encoding="utf-8").read()
        return "<style>\n" + txt + "\n</style>"
    s = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, s)

    def js(m):
        txt = open(m.group(1), encoding="utf-8").read().replace("</script>", "<\\/script>")
        return "<script>\n" + txt + "\n</script>"
    s = re.sub(r'<script src="([^"]+)"></script>', js, s)

    s = s.replace('"img/icono.svg"', '"' + ICONO + '"')
    s = s.replace('href="visor.html"', 'href="visor-un-archivo.html"')
    s = s.replace('href="creador.html"', 'href="creador-un-archivo.html"')
    open(destino, "w", encoding="utf-8").write(s)
    print(destino, round(len(s.encode()) / 1048576, 1), "MB")

inlinar("visor.html", "visor-un-archivo.html")
inlinar("creador.html", "creador-un-archivo.html")
