from fastapi import APIRouter, Depends
from src.api.endpoints import embeddings, match, firebase_admin
from src.core.services.cache_service import CacheService
from src.database.firebase import FirebaseClient

router = APIRouter()

# Health check endpoint
@router.get("/health", tags=["health"])
async def health_check():
    from src.database.firebase import FirebaseClient
    from src.core.services.cache_service import CacheService
    
    firebase_client = FirebaseClient()
    cache_service = CacheService()
    redis_status = cache_service.get_redis_status()
    
    return {
        "status": "ok", 
        "service": "unylost-ai-layer",
        "redis": redis_status,
        "firebase": {
            "connected": firebase_client.is_connected()
        }
    }
    
@router.get("/firebase-status", tags=["health"])
async def firebase_status():
    firebase_client = FirebaseClient()
    
    return {
        "connected": firebase_client.is_connected(),
        "collections": ["lost_items", "found_items"] if firebase_client.is_connected() else []
    }

router.include_router(embeddings.router)
router.include_router(match.router)
router.include_router(firebase_admin.router)