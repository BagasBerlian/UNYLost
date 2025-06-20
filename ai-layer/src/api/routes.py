from fastapi import APIRouter, Depends
from src.api.endpoints import embeddings, match
from src.core.services.cache_service import CacheService

router = APIRouter()

# Health check endpoint
@router.get("/health", tags=["health"])
async def health_check():
    cache_service = CacheService()
    redis_status = cache_service.get_redis_status()
    
    return {
        "status": "ok", 
        "service": "unylost-ai-layer",
        "redis": redis_status
    }

# Include endpoints from modules
router.include_router(embeddings.router)
router.include_router(match.router)