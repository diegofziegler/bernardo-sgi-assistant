# 🚀 Guía Rápida: Levantar y Testear Bernardo con Cloudflare Tunnel

Esta guía resume los pasos para exponer **Bernardo** (puerto `8001`) hacia internet mediante **Cloudflare Tunnel**, conectarlo con el motor RAG (`entrega_7` en el puerto `8000`) y probarlo dentro de una página web de ejemplo.

---

## 1. Arquitectura de la Demo Local

```text
[ Navegador / App SGI ]
         │
         ▼  (HTTPS público)
[ Cloudflare Tunnel ] ──▶ http://localhost:8001 (Bernardo BFF + widget.js)
                                   │
                                   ├──▶ Redis (Sesiones y Alertas)
                                   └──▶ http://localhost:8000 (RAG entrega_7)
```

> **Importante:** El túnel de Cloudflare debe apuntar al puerto **8001** (donde corre Bernardo), ya que es el servicio que expone `/widget.js` y los endpoints de chat. El puerto **8000** (`entrega_7`) es consumido internamente por Bernardo.

---

## 2. Levantar los Servicios (en terminales separadas)

### Terminal 1: Servicio RAG (`entrega_7`)
Asegurate de tener Redis activo y levantá el servicio RAG en el puerto `8000`:
```powershell
uv run uvicorn entrega_7.main:app --host 0.0.0.0 --port 8000
```

### Terminal 2: Asistente Bernardo (`bernardo-sgi-assistant`)
En la carpeta raíz de Bernardo, levantá el servidor FastAPI en el puerto `8001` habilitando las cabeceras de proxy para que reconozca el `https://` del túnel:
```powershell
uv run uvicorn bernardo.main:app --host 0.0.0.0 --port 8001 --reload --proxy-headers --forwarded-allow-ips="*" --app-dir BackboneJs/src
```

### Terminal 3: Túnel de Cloudflare apuntando a Bernardo (puerto `8001`)
Ejecutá el túnel rápido hacia el puerto `8001`:
```powershell
cloudflared tunnel --url http://localhost:8001
```
Copiá la URL pública generada en consola (por ejemplo: `https://ejemplo-demo-sgi.trycloudflare.com`).

---

## 3. Verificación Rápida del Script

Antes de probar la página HTML, abrí en tu navegador la siguiente URL (reemplazando por tu dominio generado):
```text
https://ejemplo-demo-sgi.trycloudflare.com/widget.js
```
Si ves el código JavaScript del widget, el túnel y el servidor están listos.

---

## 4. Página HTML de Ejemplo para Testear

Creá un archivo llamado `demo_sgi.html` en cualquier carpeta de tu computadora y pegá el siguiente contenido (reemplazando la URL del túnel en el `<script>`):

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo SGI + Bernardo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
            margin: 0;
            padding: 40px;
        }
        .card {
            max-width: 720px;
            margin: 0 auto;
            background: #ffffff;
            padding: 28px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
    </style>
</head>
<body>

    <div class="card">
        <h1>SGI — Entorno de Pruebas</h1>
        <p>Esta página simula el frontend de <strong>SGI (BackboneJS)</strong> cargando el asistente flotante <strong>Bernardo</strong> a través de Cloudflare Tunnel.</p>
        <p>Hacé clic en el ícono del robot en la esquina inferior derecha para iniciar una consulta.</p>
    </div>

    <!-- Identificador opcional del usuario logueado en SGI -->
    <script>
        window.SGI_USER_ID = "usuario_demo_01";
    </script>

    <!-- Reemplazar con la URL pública generada por cloudflared para el puerto 8001 -->
    <script src="https://ejemplo-demo-sgi.trycloudflare.com/widget.js" defer></script>

</body>
</html>
```

### Cómo ejecutar la página de prueba
Para evitar restricciones de origen local (`file://`) en el navegador, levantá un servidor HTTP simple en la carpeta donde guardaste `demo_sgi.html`:
```powershell
python -m http.server 3000
```
Luego abrí `http://localhost:3000/demo_sgi.html` en tu navegador.