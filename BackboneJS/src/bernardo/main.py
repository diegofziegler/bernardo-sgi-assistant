import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from bernardo.config import settings
from bernardo.rag_client import rag_client
from bernardo.redis_store import session_store

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await session_store.close()


app = FastAPI(title="Bernardo - Asistente SGI", lifespan=lifespan)

#app.add_middleware(
#    CORSMiddleware,
#    allow_origins=settings.ALLOWED_ORIGINS,
#    allow_credentials=True,
#    allow_methods=["*"],
#    allow_headers=["*"],
#)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # O poné los dominios específicos de tu app BackboneJS
    allow_credentials=True,
    allow_methods=["*"],  # Permite GET, POST, OPTIONS, PUT, DELETE, etc.
    allow_headers=["*"],  # Permite Content-Type, Authorization, etc.
)


class BernardoChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=20_000)
    thread_id: str = Field(min_length=1, max_length=200, pattern=r"^[\w.:-]+$")
    idioma_destino: str | None = "es"


class GlobalAlertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=3, max_length=100, examples=["Mantenimiento Programado"])
    message: str = Field(
        min_length=5,
        max_length=1000,
        examples=["La base de datos de facturación estará en mantenimiento durante 15 minutos."],
    )
    severity: Literal["info", "maintenance", "critical"] = "maintenance"
    ttl_seconds: int = Field(default=3600, ge=60, le=86400)


def verify_admin_key(x_admin_key: str = Header(..., alias="X-Admin-Key")):
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="X-Admin-Key inválida.")


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "Bernardo", "target_app": "SGI"}


from fastapi.responses import Response

@app.get("/widget.js")
async def get_widget_script(request: Request):
    widget_path = STATIC_DIR / "widget.js"
    if not widget_path.exists():
        raise HTTPException(status_code=404, detail="Widget JS no encontrado.")
    script_content = widget_path.read_text(encoding="utf-8")
    base_url = str(request.base_url).rstrip("/")
    final_js = script_content.replace("__BERNARDO_BASE_URL__", base_url)
    return Response(content=final_js, media_type="application/javascript")

@app.post("/api/bernardo/alerts", dependencies=[Depends(verify_admin_key)])
async def publish_alert(payload: GlobalAlertRequest):
    alert_id = str(uuid.uuid4())[:8]
    alert = await session_store.set_global_alert(
        alert_id=alert_id,
        title=payload.title,
        message=payload.message,
        severity=payload.severity,
        ttl_seconds=payload.ttl_seconds,
    )
    return {"status": "active", "alert": alert}


@app.delete("/api/bernardo/alerts", dependencies=[Depends(verify_admin_key)])
async def dismiss_global_alert():
    await session_store.clear_global_alert()
    return {"status": "cleared"}


@app.get("/api/bernardo/alerts/active")
async def get_active_alert():
    alert = await session_store.get_global_alert()
    if not alert:
        return {"has_alert": False, "alert": None}
    return {"has_alert": True, "alert": alert}


@app.get("/api/bernardo/history/{thread_id}")
async def get_ui_history(thread_id: str):
    history = await session_store.get_history(thread_id)
    return {"thread_id": thread_id, "messages": history}


@app.post("/api/bernardo/chat/stream")
async def chat_stream(payload: BernardoChatRequest):
    await session_store.append_message(payload.thread_id, "user", payload.message)

    async def event_generator():
        try:
            reply_text = await rag_client.ask(
                message=payload.message,
                thread_id=payload.thread_id,
                idioma_destino=payload.idioma_destino,
            )
            await session_store.append_message(payload.thread_id, "assistant", reply_text)

            tokens = reply_text.split(" ")
            for i, token in enumerate(tokens):
                chunk = token if i == 0 else f" {token}"
                data = json.dumps({"type": "chunk", "content": chunk}, ensure_ascii=False)
                yield f"data: {data}\n\n"
                await asyncio.sleep(0.02)

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            error_msg = f"Lo siento, tuve un problema consultando la documentación de SGI: {exc}"
            data = json.dumps({"type": "error", "content": error_msg}, ensure_ascii=False)
            yield f"data: {data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
    