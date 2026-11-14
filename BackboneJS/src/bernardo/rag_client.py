import httpx
from bernardo.config import settings


class SgiRagClient:
    def __init__(self) -> None:
        self.api_url = settings.RAG_API_URL

    async def ask(self, message: str, thread_id: str, idioma_destino: str | None = None) -> str:
        payload = {
            "message": message,
            "thread_id": thread_id,
            "idioma_destino": idioma_destino or settings.DEFAULT_LANGUAGE,
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(self.api_url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("reply", "No recibí respuesta del motor de conocimiento.")


rag_client = SgiRagClient()