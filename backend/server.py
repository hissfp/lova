import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from jwt import PyJWTError  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from auth_utils import decode_token  # noqa: E402
from db import client, ensure_indexes  # noqa: E402
from routes.ai import router as ai_router  # noqa: E402
from routes.auth import router as auth_router  # noqa: E402
from routes.chats import router as chats_router  # noqa: E402
from routes.moments import router as moments_router  # noqa: E402
from routes.users import router as users_router  # noqa: E402
from ws_manager import manager  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    yield
    client.close()


app = FastAPI(title="LinguaConnect API", lifespan=lifespan)


@app.get("/api/")
async def root():
    return {"message": "LinguaConnect API"}


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        user_id = decode_token(token)
    except PyJWTError:
        await websocket.close(code=4001)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keepalive: client may send pings; we just echo acks.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)


for router in (auth_router, users_router, chats_router, moments_router, ai_router):
    app.include_router(router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
