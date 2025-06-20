import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")
ENV = os.getenv("ENV", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

API_PREFIX = "/api"
PROJECT_NAME = "UNYLost AI Layer"