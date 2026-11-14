# 🤖 Bernardo — Asistente Inteligente de Soporte para SGI

**Bernardo** es un componente de interfaz flotante y *Backend-for-Frontend (BFF)* desarrollado en Python (FastAPI + Redis) que actúa como agente de soporte técnico para la aplicación **SGI** (construida en BackboneJS).

Se presenta mediante un ícono flotante con la cara de un robot en la esquina inferior derecha de la pantalla, ofreciendo asistencia proactiva, avisos globales de incidentes o mantenimiento, historial persistente de sesión y respuestas en tiempo real conectadas a un motor RAG externo (`entrega_7`).

## 🏗️ Arquitectura del Sistema

```text
┌─────────────────────────────┐
│   Aplicación SGI            │
│   (Frontend BackboneJS)     │
│                             │
│  <script src=".../widget.js">│
└──────────────┬──────────────┘
               │ 1. Inyecta Web Component (Shadow DOM)
               │ 2. Streaming SSE (POST /api/bernardo/chat/stream)
               │ 3. Polling de Alertas (GET /api/bernardo/alerts/active)
               ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   Bernardo BFF              │──────▶│   Redis                     │
│   (FastAPI Asíncrono)       │       │   (Historial UI + Alertas   │
│                             │       │    Globales con TTL)        │
└──────────────┬──────────────┘       └─────────────────────────────┘
               │ 4. Consulta HTTP Asíncrona (POST /api/v1/chat)
               ▼
┌─────────────────────────────┐
│   Motor RAG (entrega_7)     │
│   (LangGraph + Base         │
│    Vectorial + Redis)       │
└─────────────────────────────┘
```

### Características Principales

* **Aislamiento Visual Total (Shadow DOM):** El widget inyectado no entra en conflicto con las hojas de estilo de BackboneJS, Bootstrap u otros frameworks presentes en SGI.
* **Gestión de Estado con Redis:** Conserva el historial de mensajes de la interfaz por usuario o sesión (`thread_id`) aunque se navegue entre vistas o se recargue el navegador.
* **Respuestas en Streaming (SSE):** Transmite la respuesta progresivamente mediante *Server-Sent Events* para evitar bloqueos visuales mientras el RAG procesa la consulta.
* **Alertas Proactivas de Incidentes y Mantenimiento:** Permite que sistemas de monitoreo o administradores publiquen avisos globales (caídas de base de datos, mantenimientos programados) que Bernardo muestra automáticamente en la burbuja flotante y en el encabezado del chat.

## 📁 Estructura del Repositorio

```text
bernardo-sgi-assistant/
├── pyproject.toml              # Definición del proyecto y dependencias (uv)
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusiones estándar de Python / uv
├── README.md                   # Documentación del proyecto
├── AGENTS.md                   # Especificación técnica para agentes IA
└── BackboneJs/
    └── src/
        └── bernardo/
            ├── __init__.py
            ├── config.py       # Configuración tipada con Pydantic Settings
            ├── redis_store.py  # Almacenamiento asíncrono de historial y alertas en Redis
            ├── rag_client.py   # Cliente HTTP asíncrono hacia la API RAG
            ├── main.py         # Servidor FastAPI (endpoints SSE, alertas, historial y widget.js)
            └── static/
                └── widget.js   # Script embebible del asistente flotante
```

## ⚙️ Requisitos Previos

* **Python 3.11+**
* [**uv**](https://docs.astral.sh/uv/) (gestor de paquetes y entornos virtuales)
* **Redis** en ejecución (local o remoto)
* **Servicio RAG (`entrega_7`)** activo y accesible por red

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio e ingresar al directorio:**

   ```bash
   git clone <url-de-tu-repo-bernardo>
   cd bernardo-sgi-assistant
   ```

2. **Configurar las variables de entorno:**
   Copiá el archivo de ejemplo y ajustá las URLs y claves según tu entorno:

   ```bash
   cp .env.example .env
   ```

   Variables disponibles en `.env`:

   | Variable | Descripción | Valor por defecto |
   | :--- | :--- | :--- |
   | `PORT` | Puerto donde escuchará el servidor de Bernardo | `8001` |
   | `RAG_API_URL` | Endpoint de chat del servicio RAG (`entrega_7`) | `http://localhost:8000/api/v1/chat` |
   | `REDIS_URL` | Cadena de conexión a Redis para el historial UI y alertas | `redis://localhost:6379/1` |
   | `SESSION_TTL_SECONDS` | Tiempo de vida de la sesión en Redis (en segundos) | `86400` (24 hs) |
   | `ALLOWED_ORIGINS` | Lista JSON de orígenes permitidos por CORS | `["*"]` |
   | `ADMIN_API_KEY` | Token secreto (`X-Admin-Key`) para publicar o limpiar alertas | `cambia_este_token_secreto_sgi` |

3. **Instalar dependencias con `uv`:**

   ```bash
   uv sync
   ```

4. **Levantar el servidor FastAPI:**

   ```bash
   uv run uvicorn bernardo.main:app --host 0.0.0.0 --port 8001 --reload --app-dir BackboneJs/src
   ```

   Podés verificar que el servicio esté operativo ingresando a `http://localhost:8001/health`.

## 🧩 Integración en SGI (BackboneJS)

Para incorporar a Bernardo en cualquier vista o layout principal de **SGI**, agregá la etiqueta `<script>` antes del cierre de `</body>` en tu plantilla HTML base:

```html
<!-- Opcional: Vincular la conversación al ID del usuario autenticado en SGI -->
<script>
  window.SGI_USER_ID = "id_usuario_logueado";
</script>

<!-- Cargar el widget de Bernardo desde el servidor FastAPI -->
<script src="http://localhost:8001/widget.js" defer></script>
```

> **Nota sobre Identidad de Sesión:** Si `window.SGI_USER_ID` está definido, Bernardo utilizará `sgi_user_<id>` como `thread_id` en Redis y en el motor RAG. De lo contrario, generará automáticamente un UUID único y lo persistirá en el `localStorage` del navegador.

## 🚨 Alertas Proactivas (Incidentes y Mantenimiento)

Bernardo permite notificar proactivamente a todos los usuarios conectados a SGI ante caídas de base de datos, degradación de servicios o ventanas de mantenimiento. El widget consulta `GET /api/bernardo/alerts/active` al cargar y realiza un chequeo periódico cada 45 segundos.

Severidades soportadas: `"info"`, `"maintenance"`, `"critical"`.

### Ejemplos de Uso en PowerShell

**a) Publicar una alerta global de mantenimiento o incidente:**

```powershell
$body = @{
    title = "Mantenimiento en Base de Datos"
    message = "Estamos realizando tareas de mantenimiento en la base de datos operativa. El servicio volvera en 10 minutos."
    severity = "maintenance"
    ttl_seconds = 1800
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/api/bernardo/alerts" `
    -Method Post `
    -Headers @{ "X-Admin-Key" = "cambia_este_token_secreto_sgi"; "Content-Type" = "application/json" } `
    -Body $body
```

**b) Desactivar la alerta cuando el servicio se normaliza:**

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/api/bernardo/alerts" `
    -Method Delete `
    -Headers @{ "X-Admin-Key" = "cambia_este_token_secreto_sgi" }
```

## 🔌 Endpoints Expuestos

| Método | Ruta | Autenticación | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Pública | Verifica el estado del servicio Bernardo. |
| `GET` | `/widget.js` | Pública | Sirve el código JavaScript del Web Component inyectable. |
| `GET` | `/api/bernardo/history/{thread_id}` | Pública | Recupera el historial de conversación almacenado en Redis. |
| `POST` | `/api/bernardo/chat/stream` | Pública | Recibe una consulta, la envía al RAG y transmite la respuesta vía SSE. |
| `GET` | `/api/bernardo/alerts/active` | Pública | Devuelve la alerta global activa en Redis (si existe). |
| `POST` | `/api/bernardo/alerts` | `X-Admin-Key` | Publica o actualiza una alerta global proactiva con TTL. |
| `DELETE` | `/api/bernardo/alerts` | `X-Admin-Key` | Elimina manualmente la alerta global activa en Redis. |