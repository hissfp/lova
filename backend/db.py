import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

users_col = db["users"]
conversations_col = db["conversations"]
messages_col = db["messages"]
moments_col = db["moments"]
comments_col = db["comments"]


async def ensure_indexes():
    await users_col.create_index("email", unique=True)
    await messages_col.create_index([("conversation_id", 1), ("created_at", 1)])
    await conversations_col.create_index("participant_ids")
    await moments_col.create_index([("created_at", -1)])
    await comments_col.create_index([("moment_id", 1), ("created_at", 1)])
