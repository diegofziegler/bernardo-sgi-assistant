import json
from redis.asyncio import Redis
from bernardo.config import settings


class RedisSessionStore:
    def __init__(self) -> None:
        self.redis: Redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)

    def _key(self, thread_id: str) -> str:
        return f"bernardo:ui_history:{thread_id}"

    async def get_history(self, thread_id: str) -> list[dict[str, str]]:
        raw_items = await self.redis.lrange(self._key(thread_id), 0, -1)
        return [json.loads(item) for item in raw_items]

    async def append_message(self, thread_id: str, role: str, content: str) -> None:
        key = self._key(thread_id)
        payload = json.dumps({"role": role, "content": content}, ensure_ascii=False)
        await self.redis.rpush(key, payload)
        await self.redis.expire(key, settings.SESSION_TTL_SECONDS)

    async def close(self) -> None:
        await self.redis.aclose()


session_store = RedisSessionStore()