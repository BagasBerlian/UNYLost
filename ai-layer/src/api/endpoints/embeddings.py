from fastapi import APIRouter, HTTPException, Depends
from src.core.schemas.request import TextEmbeddingRequest, ImageEmbeddingRequest, HybridEmbeddingRequest
from src.core.schemas.response import APIResponse, EmbeddingResponse
from src.core.services.embedding_service import EmbeddingService
from src.utils.image_processing import load_image

router = APIRouter(prefix="/embeddings", tags=["embeddings"])

# Generate text embeddings using CLIP and Sentence Transformer models
@router.post("/text", response_model=APIResponse)
async def create_text_embedding(request: TextEmbeddingRequest):
    try:
        embedding_service = EmbeddingService()
        
        # Get CLIP text embedding
        clip_embedding = embedding_service.get_text_embedding_clip(
            request.text, 
            request.item_id
        )
        
        # Get Sentence Transformer embedding
        st_embedding = embedding_service.get_text_embedding_sentence(
            request.text, 
            request.item_id
        )
        
        return {
            "success": True,
            "message": "Text embeddings generated successfully",
            "data": {
                "clip_dimensions": clip_embedding.shape[0],
                "sentence_dimensions": st_embedding.shape[0],
                "item_id": request.item_id
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Generate image embedding using CLIP model
@router.post("/image", response_model=APIResponse)
async def create_image_embedding(request: ImageEmbeddingRequest):
    try:
        embedding_service = EmbeddingService()
        
        # Load image
        image = load_image(request.image_url)
        
        # Get image embedding
        embedding = embedding_service.get_image_embedding(
            image, 
            request.item_id
        )
        
        return {
            "success": True,
            "message": "Image embedding generated successfully",
            "data": {
                "dimensions": embedding.shape[0],
                "item_id": request.item_id
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Generate hybrid embeddings (text + optional image)
@router.post("/hybrid", response_model=APIResponse)
async def create_hybrid_embedding(request: HybridEmbeddingRequest):
    try:
        embedding_service = EmbeddingService()
        
        # Prepare response
        response_data = {
            "text_processed": True,
            "item_id": request.item_id
        }
        
        # Process text
        text_embeddings = {
            "clip_text": embedding_service.get_text_embedding_clip(
                request.text, 
                request.item_id
            ),
            "sentence_text": embedding_service.get_text_embedding_sentence(
                request.text, 
                request.item_id
            )
        }
        
        # Process image if provided
        if request.image_url:
            image = load_image(request.image_url)
            image_embedding = embedding_service.get_image_embedding(
                image, 
                request.item_id
            )
            response_data["image_processed"] = True
        
        return {
            "success": True,
            "message": "Hybrid embeddings generated successfully",
            "data": response_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))