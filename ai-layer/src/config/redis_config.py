import os
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_TTL = int(os.getenv("REDIS_TTL", 3600))
REDIS_DB = int(os.getenv("REDIS_DB", 0))