from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from src.database.firebase import FirebaseClient
import numpy as np

router = APIRouter(prefix="/firebase", tags=["firebase"])

class EmbeddingData(BaseModel):
    item_id: str
    collection_name: str
    metadata: Optional[Dict[str, Any]] = None
    embeddings: Dict[str, List[float]]

@router.post("/save", response_model=Dict)
async def save_embedding(data: EmbeddingData):
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_connected():
        raise HTTPException(status_code=503, detail="Firebase not connected")
    
    success = firebase_client.save_embedding(
        collection_name=data.collection_name,
        item_id=data.item_id,
        embeddings=data.embeddings,
        metadata=data.metadata
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save to Firebase")
    
    return {"success": True, "message": f"Embedding saved for {data.item_id}"}

@router.get("/get/{collection_name}/{item_id}", response_model=Dict)
async def get_embedding(collection_name: str, item_id: str):
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_connected():
        raise HTTPException(status_code=503, detail="Firebase not connected")
    
    try:
        # Get the embedding
        data = firebase_client.get_embedding(collection_name, item_id)
        
        if not data:
            raise HTTPException(status_code=404, detail=f"Embedding not found for {item_id}")
        
        # Convert numpy arrays to lists for JSON serialization
        if 'embeddings' in data:
            serializable_data = data.copy()
            for key, value in data['embeddings'].items():
                if isinstance(value, np.ndarray):
                    serializable_data['embeddings'][key] = value.tolist()
            return {"success": True, "data": serializable_data}
        
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = str(e) + "\n" + traceback.format_exc()
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Error retrieving embedding: {str(e)}")

@router.get("/list/{collection_name}", response_model=Dict)
async def list_embeddings(collection_name: str, limit: int = 50):
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_connected():
        raise HTTPException(status_code=503, detail="Firebase not connected")
    
    # Get embeddings
    data = firebase_client.get_all_embeddings(collection_name, limit)
    
    items = []
    for k, v in data.items():
        # Ekstrak metadata dari dokumen (tanpa embeddings)
        metadata = {key: value for key, value in v.items() if key != 'embeddings'}
        items.append({"id": k, "metadata": metadata})
    
    return {
        "success": True, 
        "count": len(data),
        "items": items
    }

@router.delete("/delete/{collection_name}/{item_id}", response_model=Dict)
async def delete_embedding(collection_name: str, item_id: str):
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_connected():
        raise HTTPException(status_code=503, detail="Firebase not connected")
    
    success = firebase_client.delete_embedding(collection_name, item_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete from Firebase")
    
    return {"success": True, "message": f"Embedding deleted for {item_id}"}

@router.delete("/reset/{collection_name}", response_model=Dict)
async def reset_collection(collection_name: str):
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_connected():
        raise HTTPException(status_code=503, detail="Firebase not connected")
    
    # Get all embeddings
    embeddings = firebase_client.get_all_embeddings(collection_name)
    
    # Delete each embedding
    deleted_count = 0
    for item_id in embeddings.keys():
        if firebase_client.delete_embedding(collection_name, item_id):
            deleted_count += 1
    
    return {
        "success": True, 
        "message": f"Reset collection {collection_name}", 
        "deleted_count": deleted_count
    }