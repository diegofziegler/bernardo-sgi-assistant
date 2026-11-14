# 🤖 Bernardo — Asistente Inteligente de Soporte para SGI

**Bernardo** es un componente de interfaz flotante y *Backend-for-Frontend (BFF)* desarrollado en Python (FastAPI + Redis) que actúa como agente de soporte técnico para la aplicación **SGI** (construida en BackboneJS).

Se presenta mediante un ícono flotante con la cara de un robot en la esquina inferior derecha de la pantalla, ofreciendo asistencia proactiva, historial persistente de sesión y respuestas en tiempo real conectadas a un motor RAG externo (`entrega_7`).

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────┐
│   Aplicación SGI            │
│   (Frontend BackboneJS)     │
│                             │
│  <script src=".../widget.js">│
└──────────────┬──────────────┘
               │ 1. Inyecta Web Component (Shadow DOM)
               │ 2. Streaming SSE (POST /api/bernardo/chat/stream)
               ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│   Bernardo BFF              │──────▶│   Redis                     │
│   (FastAPI Asíncrono)       │       │   (Persistencia de sesión   │
│                             │       │    e historial UI)          │
└──────────────┬──────────────┘       └─────────────────────────────┘
               │ 3. Consulta HTTP Asíncrona (POST /api/v1/chat)
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

* **Saludo Proactivo:** Invita al usuario a interactuar mediante una burbuja de bienvenida configurable.

## 📁 Estructura del Repositorio

```
bernardo-sgi-assistant/
├── pyproject.toml              # Definición del proyecto y dependencias (uv)
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusiones estándar de Python / uv
├── README.md                   # Documentación del proyecto
└── BackboneJs/
    └── src/
        └── bernardo/
            ├── __init__.py
            ├── config.py       # Configuración tipada con Pydantic Settings
            ├── redis_store.py  # Almacenamiento asíncrono de historial en Redis
            ├── rag_client.py   # Cliente HTTP asíncrono hacia la API RAG
            ├── main.py         # Servidor FastAPI (endpoints SSE, historial y widget.js)
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

   ```
   git clone <url-de-tu-repo-bernardo>
   cd bernardo-sgi-assistant
   
   ```

2. **Configurar las variables de entorno:**
   Copiá el archivo de ejemplo y ajustá las URLs según tu entorno:

   ```
   cp .env.example .env
   
   ```

   Variables disponibles en `.env`:

   | Variable | Descripción | Valor por defecto | 
   | ----- | ----- | ----- | 
   | `PORT` | Puerto donde escuchará el servidor de Bernardo | `8001` | 
   | `RAG_API_URL` | Endpoint de chat del servicio RAG (`entrega_7`) | `http://localhost:8000/api/v1/chat` | 
   | `REDIS_URL` | Cadena de conexión a Redis para el historial UI | `redis://localhost:6379/1` | 
   | `SESSION_TTL_SECONDS` | Tiempo de vida de la sesión en Redis (en segundos) | `86400` (24 hs) | 
   | `ALLOWED_ORIGINS` | Lista JSON de orígenes permitidos por CORS | `["*"]` | 

3. **Instalar dependencias con `uv`:**

   ```
   uv sync
   
   ```

4. **Levantar el servidor FastAPI:**

   ```
   uv run uvicorn bernardo.main:app --host 0.0.0.0 --port 8001 --reload --app-dir BackboneJs/src
   
   ```

   Podés verificar que el servicio esté operativo ingresando a `http://localhost:8001/health`.

## 🧩 Integración en SGI (BackboneJS)

Para incorporar a Bernardo en cualquier vista o layout principal de **SGI**, agregá la etiqueta `<script>` antes del cierre de `</body>` en tu plantilla HTML base:

```
<!-- Opcional: Vincular la conversación al ID del usuario autenticado en SGI -->
<script>
  window.SGI_USER_ID = "id_usuario_logueado";
</script>

<!-- Cargar el widget de Bernardo desde el servidor FastAPI -->
<script src="http://localhost:8001/widget.js" defer></script>

```

> **Nota sobre Identidad de Sesión:** Si `window.SGI_USER_ID` está definido, Bernardo utilizará `sgi_user_<id>` como `thread_id` en Redis y en el motor RAG. De lo contrario, generará automáticamente un UUID único y lo persistirá en el `localStorage` del navegador.

## 🔌 Endpoints Expuestos

| Método | Ruta | Descripción | 
| ----- | ----- | ----- | 
| `GET` | `/health` | Verifica el estado del servicio Bernardo. | 
| `GET` | `/widget.js` | Sirve el código JavaScript del Web Component inyectable. | 
| `GET` | `/api/bernardo/history/{thread_id}` | Recupera el historial de conversación almacenado en Redis. | 
| `POST` | `/api/bernardo/chat/stream` | Recibe una consulta, la envía al RAG y transmite la respuesta vía SSE. | 
