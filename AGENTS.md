# AGENTS.md — Especificación Técnica de Bernardo (Asistente SGI)

Este archivo contiene el contexto arquitectónico, contratos de integración, estructura del proyecto y reglas de desarrollo para **Bernardo**, el asistente de soporte técnico de **SGI**. Está diseñado para que cualquier agente de programación (Gemini, Codex, Cursor, Claude, etc.) pueda comprender, reconstruir, depurar o agregar nuevas funcionalidades sin romper la compatibilidad con el ecosistema existente.

## 1. Propósito y Contexto del Proyecto

* **Nombre del Agente:** Bernardo
* **Aplicación Anfitriona:** **SGI** (Sistema de Gestión Integral), cuyo frontend está construido en **BackboneJS**.
* **Rol:** Asistente virtual de soporte al usuario. Se presenta inicialmente como un botón flotante circular con el ícono SVG de la cara de un robot en la esquina inferior derecha de SGI, acompañado de una burbuja proactiva de bienvenida (o de alertas operativas globales). Al hacer clic, despliega una ventana de chat asíncrona.
* **Arquitectura:** *Backend-for-Frontend (BFF)* en **Python (FastAPI)** + **Redis** + **Web Component embebible con Shadow DOM** servido dinámicamente por el propio backend.

## 2. Estructura Exacta del Repositorio

El proyecto utiliza `uv` como gestor de dependencias y entornos virtuales. Los fuentes residen bajo `BackboneJs/src/bernardo/`:

```text
bernardo-sgi-assistant/
├── pyproject.toml                  # Dependencias y configuración de build (hatchling)
├── .env                            # Variables de entorno locales (no versionado)
├── .env.example                    # Plantilla de variables de entorno
├── README.md                       # Documentación general y guía de despliegue
├── AGENTS.md                       # Este archivo (especificación para agentes IA)
└── BackboneJs/
    └── src/
        └── bernardo/
            ├── __init__.py
            ├── config.py           # Configuración tipada mediante pydantic-settings
            ├── redis_store.py      # Persistencia asíncrona del historial UI y alertas en Redis
            ├── rag_client.py       # Cliente HTTP asíncrono (httpx) hacia la API RAG
            ├── main.py             # Servidor FastAPI (CORS, SSE streaming, alertas, endpoints y widget)
            └── static/
                └── widget.js       # Script autocontenido con Shadow DOM, UI del robot y polling de alertas
```

## 3. Comandos de Ejecución y Desarrollo

* **Sincronizar dependencias:**

  ```bash
  uv sync
  ```

* **Levantar servidor de desarrollo (obligatorio indicar `--app-dir`):**

  ```bash
  uv run uvicorn bernardo.main:app --host 0.0.0.0 --port 8001 --reload --app-dir BackboneJs/src
  ```

* **Verificación de salud:**
  `GET http://localhost:8001/health`

## 4. Contratos de Integración Externos (NO ROMPER)

Bernardo no ejecuta modelos de embeddings ni busca directamente en la base vectorial; delega la inteligencia RAG a un microservicio externo (`entrega_7`).

### 4.1. Contrato con el Servicio RAG (`entrega_7`)

* **Endpoint:** `POST {RAG_API_URL}` (por defecto `http://localhost:8000/api/v1/chat`).
* **Request JSON (`ChatRequest`):**

  ```json
  {
    "message": "string (1..20000 chars)",
    "thread_id": "string (regex: ^[\\w.:-]+$)",
    "idioma_destino": "es"
  }
  ```

  *Nota:* El esquema del RAG tiene `extra="forbid"`. Nunca enviar campos adicionales en el payload hacia `entrega_7`.

* **Response JSON (`ChatResponse`):**

  ```json
  {
    "thread_id": "string",
    "reply": "string",
    "idioma_destino": "string",
    "history": [
      { "sender": "string", "content": "string" }
    ]
  }
  ```

### 4.2. Contrato con Redis (Estado de Sesión UI y Alertas Globales)

* **Cliente:** `redis.asyncio.Redis` (`decode_responses=True`).
* **Historial de Chat UI:** Clave `bernardo:ui_history:{thread_id}` (estructura `LIST` de Redis con objetos JSON `{"role": "user"|"assistant", "content": "..."}`) con TTL configurable vía `SESSION_TTL_SECONDS` (default `86400` segundos).
* **Alertas Proactivas Globales:** Clave `bernardo:global_alert` (estructura `STRING` JSON con `{"id", "title", "message", "severity", "created_at"}`) con TTL dinámico definido al crear la alerta (`ttl_seconds`).

### 4.3. Contrato de Integración con SGI (BackboneJS)

* SGI integra a Bernardo mediante una única etiqueta `<script src="http://<host>:8001/widget.js" defer></script>`.
* **Identidad de Sesión (`thread_id`):**
  1. Si `window.SGI_USER_ID` está definido en el contexto global de BackboneJS, `widget.js` construye `sgi_user_<SGI_USER_ID>`.
  2. Si no existe, genera un UUID y lo almacena en `localStorage` bajo la clave `bernardo_sgi_thread_id`.
* **Placeholder Dinámico:** El endpoint `GET /widget.js` reemplaza `__BERNARDO_BASE_URL__` en tiempo de ejecución por `str(request.base_url).rstrip("/")` para que las llamadas `fetch` apunten siempre al servidor correcto sin hardcodear dominios.
* **Comportamiento de Alertas en UI:** `widget.js` consulta `GET /api/bernardo/alerts/active` al cargar y cada 45 segundos. Cuando existe una alerta activa, muestra el indicador pulsante rojo en el lanzador, el banner interno en la ventana de chat y la burbuja proactiva flotante (si el usuario no descartó ese `alert.id` en `sessionStorage`). Cuando el endpoint devuelve `has_alert: false`, el widget debe ocultar tanto el punto rojo y el banner interno como `proactiveBubble`.

## 5. Endpoints Internos de Bernardo

| Método | Ruta | Auth | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Pública | Retorna `{"status": "ok", "agent": "Bernardo", "target_app": "SGI"}`. |
| `GET` | `/widget.js` | Pública | Sirve `static/widget.js` (`text/plain`) inyectando la URL base del servidor. |
| `GET` | `/api/bernardo/history/{thread_id}` | Pública | Devuelve el historial almacenado en Redis para reconstruir el chat al abrir el widget. |
| `POST` | `/api/bernardo/chat/stream` | Pública | Recibe `{message, thread_id, idioma_destino}`, guarda en Redis, consulta el RAG y responde vía **Server-Sent Events (`text/event-stream`)** con eventos JSON: `{"type": "chunk", "content": "..."}`, `{"type": "done"}` o `{"type": "error", "content": "..."}`. |
| `GET` | `/api/bernardo/alerts/active` | Pública | Retorna `{"has_alert": bool, "alert": dict | null}` consultando `bernardo:global_alert` en Redis. |
| `POST` | `/api/bernardo/alerts` | `X-Admin-Key` | Publica una alerta global proactiva (`title`, `message`, `severity`: `"info"|"maintenance"|"critical"`, `ttl_seconds`: `60..86400`). |
| `DELETE` | `/api/bernardo/alerts` | `X-Admin-Key` | Elimina manualmente `bernardo:global_alert` de Redis. |

### 5.1. Comandos de Referencia para Gestión de Alertas (PowerShell)

* **Publicar alerta de mantenimiento/incidente:**

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

* **Eliminar alerta activa:**

  ```powershell
  Invoke-RestMethod -Uri "http://localhost:8001/api/bernardo/alerts" `
      -Method Delete `
      -Headers @{ "X-Admin-Key" = "cambia_este_token_secreto_sgi" }
  ```

## 6. Reglas y Convenciones para Modificaciones Futuras

1. **Aislamiento CSS Obligatorio (Shadow DOM):** Toda modificación visual en `static/widget.js` debe permanecer encapsulada dentro de `host.attachShadow({ mode: "open" })`. Nunca inyectar estilos globales en `document.head` que puedan alterar los estilos de BackboneJS/Bootstrap de SGI.
2. **Asincronía Pura:** Todo I/O en FastAPI (`httpx.AsyncClient`, `redis.asyncio`, lectura de archivos o generadores SSE) debe ser estrictamente no bloqueante (`async`/`await`).
3. **CORS y Preflight (`OPTIONS`):** Mantener `CORSMiddleware` configurado para soportar peticiones pre-flight `OPTIONS` desde los orígenes donde se despliegue SGI.
4. **Identidad y Tono de Bernardo:** Cualquier mensaje de sistema, saludo proactivo, alerta o mensaje de error en la UI debe mantener la persona de **Bernardo** (cordial, técnico, claro y enfocado en ayudar dentro de **SGI**).
5. **Validación de `thread_id`:** Respetar siempre el patrón `^[\w.:-]+$` exigido por el esquema de validación de `entrega_7`.
6. **Seguridad Administrativa:** Todo endpoint que modifique estado global visible para todos los usuarios (como `/api/bernardo/alerts`) debe validar la cabecera `X-Admin-Key` contra `settings.ADMIN_API_KEY`.

## 7. Roadmap Sugerido de Nuevas Features

Si se solicita expandir a Bernardo, priorizar estas mejoras manteniendo la arquitectura actual:

* **Renderizado de Markdown y Fuentes/Referencias:** Parsear listas, negritas, bloques de código y enlaces/referencias documentales devueltas por el RAG dentro de `.msg.assistant` en `widget.js` (sanitizando HTML para evitar XSS).
* **Contexto de Vista Activa de BackboneJS:** Permitir que `widget.js` lea una variable opcional `window.SGI_CURRENT_MODULE` (ej. `"Facturación"`, `"Inventario"`) para enriquecer la consulta enviada al RAG.
* **Streaming Real End-to-End:** Si `entrega_7` expone un endpoint de streaming nativo de LangGraph (`astream_events`), adaptar `rag_client.py` para consumirlo por chunks en lugar de esperar la respuesta completa y simular el streaming token a token.
* **Botón de Limpiar Conversación:** Agregar un endpoint `DELETE /api/bernardo/history/{thread_id}` y un botón en el header del chat para reiniciar el hilo en Redis.