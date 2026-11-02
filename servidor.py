#!/usr/bin/env python3
"""Servidor local para usar el sistema en los celulares SIN internet.

Para qué sirve: los celulares no le dan permiso de cámara a un archivo abierto
desde una carpeta, pero sí a una página servida por https://. Este script sirve
esta carpeta por https desde la notebook, usando un certificado propio.
Los celulares se conectan por la misma red Wi-Fi (no hace falta internet).

Uso:   python3 servidor.py
Parar: Ctrl+C
"""
import http.server, socketserver, ssl, socket, subprocess, os, sys

PUERTO = 8443
CARPETA = os.path.dirname(os.path.abspath(__file__))
CERT = os.path.join(CARPETA, "certificado.pem")
CLAVE = os.path.join(CARPETA, "clave.pem")


def ip_de_la_red():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # no manda nada, solo averigua la IP local
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def armar_certificado(ip):
    if os.path.exists(CERT) and os.path.exists(CLAVE):
        return
    print("Generando el certificado (solo la primera vez)...")
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "3650",
        "-keyout", CLAVE, "-out", CERT, "-subj", "/CN=RA IPESfa",
        "-addext", f"subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost",
    ], check=True, capture_output=True)


def listar_experiencias():
    """Arma la galeria sola, mirando los .zip que haya en la carpeta experiencias."""
    import json
    carpeta = os.path.join(CARPETA, "experiencias")
    items = []
    if os.path.isdir(carpeta):
        for nombre in sorted(os.listdir(carpeta)):
            if not nombre.lower().endswith(".zip"):
                continue
            base = nombre[:-4]
            imagen = None
            for ext in (".jpg", ".jpeg", ".png", ".webp"):
                if os.path.exists(os.path.join(carpeta, base + ext)):
                    imagen = "experiencias/" + base + ext
                    break
            tam = os.path.getsize(os.path.join(carpeta, nombre))
            items.append({
                "titulo": base.replace("-", " ").replace("_", " ").capitalize(),
                "descripcion": f"{tam // 1024} KB",
                "archivo": "experiencias/" + nombre,
                "imagen": imagen,
            })
    return json.dumps({"experiencias": items}, ensure_ascii=False).encode("utf-8")


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=CARPETA, **kw)
    def do_GET(self):
        if self.path.split("?")[0].endswith("/experiencias/lista.json"):
            datos = listar_experiencias()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(datos)))
            self.end_headers()
            self.wfile.write(datos)
            return
        super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    ip = ip_de_la_red()
    try:
        armar_certificado(ip)
    except FileNotFoundError:
        sys.exit("Falta openssl. En Debian/Ubuntu: sudo apt install openssl")
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, CLAVE)
    srv = Servidor(("0.0.0.0", PUERTO), Manejador)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    print("\n  Sistema de realidad aumentada - IPESfa")
    print("  " + "-" * 44)
    print(f"  En esta notebook:   https://localhost:{PUERTO}/")
    print(f"  En los celulares:   https://{ip}:{PUERTO}/")
    print("\n  Los celulares tienen que estar en la misma red Wi-Fi.")
    print("  La primera vez el navegador avisa que el certificado no es conocido:")
    print("  hay que tocar 'Configuracion avanzada' y 'Continuar'. Es tu propia")
    print("  notebook, no hay riesgo. Despues la camara funciona normalmente.")
    print("\n  Los .zip que dejes en la carpeta 'experiencias' aparecen solos")
    print("  en la galeria del visor, sin tocar ningun archivo de configuracion.")
    print("\n  Ctrl+C para parar.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Servidor detenido.")
