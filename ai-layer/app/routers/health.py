"""
Health Check Router untuk UNY Lost AI Layer
Monitoring status model, Firebase, dan Google Drive
"""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any
import torch
from datetime import datetime
import os
from loguru import logger

# Import psutil dengan error handling
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not available - system monitoring disabled")

router = APIRouter()

@router.get("/status")
async def health_status(request: Request):
    """Comprehensive health check untuk semua services"""
    try:
        app_state = request.app.state
        
        # Model status
        models_status = {}
        if hasattr(app_state, 'models') and app_state.models:
            models_status = {
                "clip_ready": app_state.models.clip_ready,
                "sentence_transformer_ready": app_state.models.sentence_ready,
                "device": app_state.models.device,
                "clip_dimension": app_state.models.clip_dim,
                "sentence_dimension": app_state.models.sentence_dim
            }
        else:
            models_status = {"error": "Models not loaded"}
        
        # Firebase status
        firebase_status = {}
        if hasattr(app_state, 'firebase') and app_state.firebase:
            firebase_status = {
                "connected": app_state.firebase.is_connected(),
                "stats": app_state.firebase.get_stats()
            }
        else:
            firebase_status = {"error": "Firebase not initialized"}
        
        # System resources (dengan psutil check)
        system_status = {}
        if PSUTIL_AVAILABLE:
            try:
                system_status = {
                    "cpu_percent": psutil.cpu_percent(interval=1),
                    "memory_percent": psutil.virtual_memory().percent,
                    "disk_percent": psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:').percent
                }
            except Exception as e:
                system_status = {"error": f"System monitoring error: {str(e)}"}
        else:
            system_status = {"note": "System monitoring not available (psutil not installed)"}
        
        # GPU status (jika available)
        gpu_status = {}
        if torch.cuda.is_available():
            try:
                gpu_status = {
                    "gpu_available": True,
                    "gpu_count": torch.cuda.device_count(),
                    "gpu_name": torch.cuda.get_device_name(0),
                    "memory_allocated_gb": round(torch.cuda.memory_allocated() / 1024**3, 2),
                    "memory_reserved_gb": round(torch.cuda.memory_reserved() / 1024**3, 2)
                }
            except Exception as e:
                gpu_status = {"gpu_available": True, "error": str(e)}
        else:
            gpu_status = {"gpu_available": False, "mode": "CPU"}
        
        # Overall health score
        health_score = 100
        
        # Deduct points for issues
        if not models_status.get("clip_ready", False):
            health_score -= 30
        if not models_status.get("sentence_transformer_ready", False):
            health_score -= 30
        if not firebase_status.get("connected", False):
            health_score -= 20
        if system_status.get("memory_percent", 0) > 90:
            health_score -= 10
        if system_status.get("cpu_percent", 0) > 90:
            health_score -= 10
        
        # Determine status
        if health_score >= 90:
            status = "healthy"
        elif health_score >= 70:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return {
            "status": status,
            "health_score": health_score,
            "timestamp": datetime.now().isoformat(),
            "models": models_status,
            "firebase": firebase_status,
            "system": system_status,
            "gpu": gpu_status,
            "uptime": "running"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in health check: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

@router.get("/models")
async def models_status(request: Request):
    """Detailed status untuk AI models"""
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="Models not loaded")
        
        models = app_state.models
        
        # Test model functionality
        test_results = {}
        
        # Test CLIP model
        if models.clip_ready:
            try:
                from PIL import Image
                import numpy as np
                
                # Test image encoding
                dummy_image = Image.new('RGB', (224, 224), color='red')
                img_embedding = models.encode_image(dummy_image)
                
                # Test text encoding
                text_embedding = models.encode_text_clip("test dompet hitam")
                
                test_results["clip"] = {
                    "status": "working",
                    "image_embedding_shape": img_embedding.shape,
                    "text_embedding_shape": text_embedding.shape,
                    "similarity_test": float(models.calculate_similarity(img_embedding, text_embedding))
                }
            except Exception as e:
                test_results["clip"] = {"status": "error", "error": str(e)}
        else:
            test_results["clip"] = {"status": "not_loaded"}
        
        # Test Sentence Transformer
        if models.sentence_ready:
            try:
                embedding = models.encode_text_sentence("tas laptop warna hitam")
                test_results["sentence_transformer"] = {
                    "status": "working",
                    "embedding_shape": embedding.shape,
                    "sample_values": embedding[:3].tolist()
                }
            except Exception as e:
                test_results["sentence_transformer"] = {"status": "error", "error": str(e)}
        else:
            test_results["sentence_transformer"] = {"status": "not_loaded"}
        
        return {
            "models_info": models.get_model_info(),
            "functionality_tests": test_results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking models status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/firebase")
async def firebase_status(request: Request):
    """Detailed status untuk Firebase connection"""
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not initialized")
        
        firebase = app_state.firebase
        
        # Basic connection test
        connected = firebase.is_connected()
        
        if not connected:
            return {
                "connected": False,
                "error": "Firebase connection failed",
                "timestamp": datetime.now().isoformat()
            }
        
        # Get detailed stats
        stats = firebase.get_stats()
        
        # Test operations
        test_results = {}
        try:
            # Test read operation
            found_items = firebase.search_items_by_status("available", "found_items")
            test_results["read_found_items"] = {"status": "success", "count": len(found_items)}
            
            lost_items = firebase.search_items_by_status("active", "lost_items")
            test_results["read_lost_items"] = {"status": "success", "count": len(lost_items)}
            
        except Exception as e:
            test_results["read_operations"] = {"status": "error", "error": str(e)}
        
        return {
            "connected": connected,
            "stats": stats,
            "test_results": test_results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking Firebase status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system")
async def system_status():
    """System resources dan performance metrics"""
    try:
        result = {
            "timestamp": datetime.now().isoformat(),
            "psutil_available": PSUTIL_AVAILABLE
        }
        
        if PSUTIL_AVAILABLE:
            # CPU info
            cpu_info = {
                "percent": psutil.cpu_percent(interval=1),
                "count": psutil.cpu_count(),
                "frequency": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
            }
            
            # Memory info
            memory = psutil.virtual_memory()
            memory_info = {
                "total_gb": round(memory.total / 1024**3, 2),
                "available_gb": round(memory.available / 1024**3, 2),
                "used_gb": round(memory.used / 1024**3, 2),
                "percent": memory.percent
            }
            
            # Disk info
            disk_path = '/' if os.name != 'nt' else 'C:'
            disk = psutil.disk_usage(disk_path)
            disk_info = {
                "total_gb": round(disk.total / 1024**3, 2),
                "used_gb": round(disk.used / 1024**3, 2),
                "free_gb": round(disk.free / 1024**3, 2),
                "percent": round((disk.used / disk.total) * 100, 2)
            }
            
            # Process info
            process = psutil.Process()
            process_info = {
                "pid": process.pid,
                "memory_mb": round(process.memory_info().rss / 1024**2, 2),
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "create_time": datetime.fromtimestamp(process.create_time()).isoformat()
            }
            
            result.update({
                "cpu": cpu_info,
                "memory": memory_info,
                "disk": disk_info,
                "process": process_info
            })
        else:
            result["note"] = "Install psutil untuk detailed system monitoring: pip install psutil"
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting system status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ping")
async def ping():
    """Simple ping untuk uptime monitoring"""
    return {
        "status": "alive",
        "message": "UNY Lost AI Layer is running",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    }