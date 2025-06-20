import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.config import app_config
from src.api.routes import router as api_router

app = FastAPI(
    title=app_config.PROJECT_NAME,
    description="AI Layer for UNYLost - Embedding Generation and Item Matching",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=app_config.API_PREFIX)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=app_config.HOST,
        port=app_config.PORT,
        reload=True,
        log_level=app_config.LOG_LEVEL.lower()
    )