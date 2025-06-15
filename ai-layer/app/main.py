import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from loguru import logger
import torch

# Add app directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import routers
from app.routers import matching, health
from app.services.model_manager import ModelManager
from app.services.firebase_client import FirebaseClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Global model manager
model_manager = None
firebase_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    global model_manager, firebase_client
    
    logger.info("🚀 Starting UNY Lost AI Layer...")
    
    try:
        # Initialize Firebase client
        logger.info("📊 Initializing Firebase client...")
        firebase_client = FirebaseClient()
        app.state.firebase = firebase_client
        
        # Initialize AI models
        logger.info("🤖 Loading AI models...")
        model_manager = ModelManager()
        await model_manager.load_models()
        app.state.models = model_manager
        
        # Check model status
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"🖥️  Device: {device}")
        logger.info(f"🎯 CLIP Model: {'✅ Loaded' if model_manager.clip_ready else '❌ Failed'}")
        logger.info(f"📝 Sentence Transformer: {'✅ Loaded' if model_manager.sentence_ready else '❌ Failed'}")
        
        if not (model_manager.clip_ready and model_manager.sentence_ready):
            logger.error("❌ Gagal load model! Jalankan: python init_models.py")
            raise RuntimeError("Models not loaded properly")
            
        logger.info("✅ UNY Lost AI Layer siap!")
        
    except Exception as e:
        logger.error(f"❌ Error during startup: {str(e)}")
        raise
    
    yield  # Application is running
    
    # Cleanup
    logger.info("🔄 Shutting down UNY Lost AI Layer...")
    if model_manager:
        model_manager.cleanup()
    logger.info("✅ Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="UNY Lost AI Layer",
    description="AI-powered matching service untuk sistem lost and found UNY",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000", "*"],  # Backend Node.js
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(matching.router, prefix="/match", tags=["AI Matching"])

@app.get("/")
async def root():
    """Root endpoint dengan informasi API"""
    global model_manager
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    return {
        "app": "UNY Lost AI Layer",
        "version": "2.0.0",
        "status": "running",
        "device": device,
        "models": {
            "clip": model_manager.clip_ready if model_manager else False,
            "sentence_transformer": model_manager.sentence_ready if model_manager else False
        },
        "endpoints": {
            "health": "/health/status",
            "instant_match": "/match/instant",
            "background_match": "/match/background", 
            "similarity": "/match/similarity",
            "docs": "/docs"
        },
        "description": "AI matching service dengan CLIP + Sentence Transformer untuk UNY Lost & Found system"
    }

@app.get("/status")
async def get_status():
    """Status endpoint untuk monitoring"""
    global model_manager, firebase_client
    
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Check models
        models_status = {
            "clip_ready": model_manager.clip_ready if model_manager else False,
            "sentence_ready": model_manager.sentence_ready if model_manager else False,
            "device": device
        }
        
        # Check Firebase
        firebase_status = {
            "connected": firebase_client.is_connected() if firebase_client else False,
            "collections": ["found_items", "lost_items"] if firebase_client else []
        }
        
        # Overall health
        is_healthy = (
            models_status["clip_ready"] and 
            models_status["sentence_ready"] and
            firebase_status["connected"]
        )
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "models": models_status,
            "firebase": firebase_status,
            "memory_usage": {
                "allocated": f"{torch.cuda.memory_allocated() / 1024**3:.2f} GB" if torch.cuda.is_available() else "N/A",
                "cached": f"{torch.cuda.memory_reserved() / 1024**3:.2f} GB" if torch.cuda.is_available() else "N/A"
            } if torch.cuda.is_available() else {"note": "CPU mode"}
        }
        
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "Terjadi kesalahan pada AI Layer. Silakan coba lagi.",
            "detail": str(exc) if hasattr(app, 'debug') and app.debug else None
        }
    )

# HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP error",
            "message": exc.detail,
            "status_code": exc.status_code
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )