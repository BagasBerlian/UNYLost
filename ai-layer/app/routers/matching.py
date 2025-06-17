from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from PIL import Image
from io import BytesIO
import asyncio
from datetime import datetime
from loguru import logger
import requests
import numpy as np
import json

# Pydantic models untuk request validation
class ProcessItemRequest(BaseModel):
    item_id: str = Field(..., description="Unique item ID dari backend")
    item_name: str = Field(..., description="Nama barang")
    description: str = Field("", description="Deskripsi barang")
    category: str = Field("", description="Kategori barang")
    image_url: Optional[str] = Field(None, description="URL gambar dari Google Drive")
    collection: str = Field("found_items", description="Collection type (found_items/lost_items)")
    threshold: Optional[float] = Field(0.75, description="Minimum similarity threshold")
    max_results: Optional[int] = Field(10, description="Maximum number of results")

    @validator('threshold')
    def validate_threshold(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('Threshold must be between 0.0 and 1.0')
        return v

    @validator('collection')
    def validate_collection(cls, v):
        if v not in ['found_items', 'lost_items']:
            raise ValueError('Collection must be found_items or lost_items')
        return v

class BackgroundMatchRequest(BaseModel):
    limit: Optional[int] = Field(100, description="Maximum items to process")
    threshold: Optional[float] = Field(0.75, description="Minimum similarity threshold")

    @validator('limit')
    def validate_limit(cls, v):
        if not 1 <= v <= 500:
            raise ValueError('Limit must be between 1 and 500')
        return v

class SimilarityRequest(BaseModel):
    item1_id: str = Field(..., description="ID item pertama")
    item2_id: str = Field(..., description="ID item kedua")
    collection1: str = Field("found_items", description="Collection item pertama")
    collection2: str = Field("lost_items", description="Collection item kedua")

class MatchResult(BaseModel):
    item_id: str
    item_name: str
    description: str
    category: str
    similarity: float
    location: Optional[str] = None
    date: Optional[str] = None
    confidence: str

router = APIRouter()

@router.post("/process-item")
async def process_item_for_matching(
    request: Request,
    background_tasks: BackgroundTasks,
    item_request: ProcessItemRequest
):
    """
    Process item dari backend dan generate embeddings + find matches
    Endpoint utama untuk integration dengan Backend Node.js
    """
    try:
        app_state = request.app.state
        
        # Check if models are loaded
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="AI models not loaded")
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        models = app_state.models
        firebase = app_state.firebase
        
        logger.info(f"Processing {item_request.collection} item: {item_request.item_id}")
        
        # Generate embeddings untuk item baru
        embeddings = await generate_item_embeddings(
            models, 
            item_request.item_name,
            item_request.description,
            item_request.image_url
        )
        
        if not embeddings:
            raise HTTPException(status_code=500, detail="Failed to generate embeddings")
        
        # Save embeddings ke Firebase
        item_data = {
            "item_id": item_request.item_id,
            "item_name": item_request.item_name,
            "description": item_request.description,
            "category": item_request.category,
            "image_url": item_request.image_url,
            "text_embedding": embeddings["text"].tolist(),
            "image_embedding": embeddings["image"].tolist() if embeddings["image"] is not None else None,
            "processed_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        # Save to Firebase
        firebase.collection(item_request.collection).document(item_request.item_id).set(item_data)
        logger.info(f"Saved embeddings for item {item_request.item_id}")
        
        # Find matches dengan collection yang berlawanan
        target_collection = "lost_items" if item_request.collection == "found_items" else "found_items"
        
        matches = await find_similar_items(
            firebase,
            embeddings,
            target_collection,
            item_request.threshold,
            item_request.max_results,
            exclude_item_id=item_request.item_id
        )
        
        logger.info(f"Found {len(matches)} matches for item {item_request.item_id}")
        
        # Process matches untuk response
        processed_matches = []
        for match in matches:
            match_result = MatchResult(
                item_id=match["item_id"],
                item_name=match["item_name"],
                description=match["description"][:100] + "..." if len(match["description"]) > 100 else match["description"],
                category=match.get("category", ""),
                similarity=round(match["similarity"], 3),
                location=match.get("location", ""),
                date=match.get("date", ""),
                confidence=get_confidence_level(match["similarity"])
            )
            processed_matches.append(match_result.dict())
        
        # Background task: notify backend about high similarity matches
        if processed_matches:
            background_tasks.add_task(
                notify_backend_matches,
                item_request.item_id,
                item_request.collection,
                processed_matches
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Item processed successfully",
                "data": {
                    "item_id": item_request.item_id,
                    "processed_at": datetime.now().isoformat(),
                    "embeddings_generated": True,
                    "matches_found": len(processed_matches)
                },
                "matches": processed_matches,
                "processing_info": {
                    "text_embedding_size": len(embeddings["text"]),
                    "image_embedding_size": len(embeddings["image"]) if embeddings["image"] is not None else 0,
                    "target_collection": target_collection,
                    "threshold_used": item_request.threshold
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Error processing item {item_request.item_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@router.post("/background")
async def background_matching(
    request: Request,
    background_request: BackgroundMatchRequest
):
    """
    Background matching untuk semua active items
    Dijalankan secara periodik oleh cron job dari backend
    """
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="AI models not loaded")
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        firebase = app_state.firebase
        models = app_state.models
        
        logger.info(f"Starting background matching with limit {background_request.limit}")
        
        processed_items = 0
        new_matches = 0
        
        # Process found items untuk match dengan lost items
        found_items = get_unprocessed_items(firebase, "found_items", background_request.limit // 2)
        for item in found_items:
            try:
                # Generate embeddings jika belum ada
                if not item.get("text_embedding") or not item.get("image_embedding"):
                    embeddings = await generate_item_embeddings(
                        models,
                        item["item_name"],
                        item["description"],
                        item.get("image_url")
                    )
                    
                    # Update embeddings di Firebase
                    firebase.collection("found_items").document(item["item_id"]).update({
                        "text_embedding": embeddings["text"].tolist(),
                        "image_embedding": embeddings["image"].tolist() if embeddings["image"] is not None else None,
                        "processed_at": datetime.now().isoformat()
                    })
                else:
                    embeddings = {
                        "text": np.array(item["text_embedding"]),
                        "image": np.array(item["image_embedding"]) if item.get("image_embedding") else None
                    }
                
                # Find matches
                matches = await find_similar_items(
                    firebase,
                    embeddings,
                    "lost_items",
                    background_request.threshold,
                    10,
                    exclude_item_id=item["item_id"]
                )
                
                if matches:
                    new_matches += len(matches)
                    # Save matches ke Firebase
                    await save_background_matches(firebase, item["item_id"], "found_items", matches)
                
                processed_items += 1
                
            except Exception as e:
                logger.error(f"Error processing found item {item.get('item_id')}: {str(e)}")
                continue
        
        # Process lost items untuk match dengan found items  
        lost_items = get_unprocessed_items(firebase, "lost_items", background_request.limit // 2)
        for item in lost_items:
            try:
                # Generate embeddings jika belum ada
                if not item.get("text_embedding"):
                    embeddings = await generate_item_embeddings(
                        models,
                        item["item_name"],
                        item["description"],
                        item.get("image_url")
                    )
                    
                    # Update embeddings di Firebase
                    firebase.collection("lost_items").document(item["item_id"]).update({
                        "text_embedding": embeddings["text"].tolist(),
                        "image_embedding": embeddings["image"].tolist() if embeddings["image"] is not None else None,
                        "processed_at": datetime.now().isoformat()
                    })
                else:
                    embeddings = {
                        "text": np.array(item["text_embedding"]),
                        "image": np.array(item["image_embedding"]) if item.get("image_embedding") else None
                    }
                
                # Find matches
                matches = await find_similar_items(
                    firebase,
                    embeddings,
                    "found_items",
                    background_request.threshold,
                    10,
                    exclude_item_id=item["item_id"]
                )
                
                if matches:
                    new_matches += len(matches)
                    # Save matches ke Firebase
                    await save_background_matches(firebase, item["item_id"], "lost_items", matches)
                
                processed_items += 1
                
            except Exception as e:
                logger.error(f"Error processing lost item {item.get('item_id')}: {str(e)}")
                continue
        
        logger.info(f"Background matching completed. Processed: {processed_items}, New matches: {new_matches}")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Background matching completed",
                "processed_items": processed_items,
                "new_matches": new_matches,
                "threshold_used": background_request.threshold,
                "completed_at": datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Error in background matching: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Background matching failed: {str(e)}")

@router.post("/similarity")
async def calculate_similarity(
    request: Request,
    similarity_request: SimilarityRequest
):
    """
    Calculate similarity antara dua items
    """
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        firebase = app_state.firebase
        
        # Get item embeddings dari Firebase
        item1_doc = firebase.collection(similarity_request.collection1).document(similarity_request.item1_id).get()
        item2_doc = firebase.collection(similarity_request.collection2).document(similarity_request.item2_id).get()
        
        if not item1_doc.exists or not item2_doc.exists:
            raise HTTPException(status_code=404, detail="One or both items not found")
        
        item1_data = item1_doc.to_dict()
        item2_data = item2_doc.to_dict()
        
        # Calculate similarity
        similarity_score = calculate_combined_similarity(
            item1_data.get("text_embedding", []),
            item1_data.get("image_embedding", []),
            item2_data.get("text_embedding", []),
            item2_data.get("image_embedding", [])
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "similarity": round(similarity_score, 3),
                "confidence": get_confidence_level(similarity_score),
                "items": {
                    "item1": {
                        "id": similarity_request.item1_id,
                        "name": item1_data.get("item_name", ""),
                        "collection": similarity_request.collection1
                    },
                    "item2": {
                        "id": similarity_request.item2_id,
                        "name": item2_data.get("item_name", ""),
                        "collection": similarity_request.collection2
                    }
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Error calculating similarity: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Similarity calculation failed: {str(e)}")

# Helper functions

async def generate_item_embeddings(models, item_name, description, image_url=None):
    """Generate embeddings untuk item"""
    try:
        # Text embedding
        text_input = f"{item_name}. {description}".strip()
        text_embedding = models.encode_text(text_input)
        
        # Image embedding
        image_embedding = None
        if image_url:
            try:
                image_embedding = await models.encode_image_from_url(image_url)
            except Exception as e:
                logger.warning(f"Failed to encode image from URL {image_url}: {str(e)}")
        
        return {
            "text": text_embedding,
            "image": image_embedding
        }
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return None

async def find_similar_items(firebase, embeddings, target_collection, threshold, max_results, exclude_item_id=None):
    """Find similar items dalam target collection"""
    try:
        # Get all items dari target collection
        items_ref = firebase.collection(target_collection)
        query = items_ref.where("status", "==", "active")
        
        docs = query.stream()
        
        similarities = []
        
        for doc in docs:
            doc_data = doc.to_dict()
            item_id = doc_data.get("item_id")
            
            # Skip item yang sama
            if item_id == exclude_item_id:
                continue
            
            # Calculate similarity
            target_text_embedding = doc_data.get("text_embedding", [])
            target_image_embedding = doc_data.get("image_embedding", [])
            
            if not target_text_embedding:
                continue
            
            similarity = calculate_combined_similarity(
                embeddings["text"],
                embeddings["image"],
                np.array(target_text_embedding),
                np.array(target_image_embedding) if target_image_embedding else None
            )
            
            if similarity >= threshold:
                similarities.append({
                    **doc_data,
                    "similarity": similarity
                })
        
        # Sort by similarity dan limit results
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        return similarities[:max_results]
        
    except Exception as e:
        logger.error(f"Error finding similar items: {str(e)}")
        return []

def calculate_combined_similarity(text_emb1, image_emb1, text_emb2, image_emb2):
    """Calculate combined similarity dari text dan image embeddings"""
    try:
        # Text similarity (always available)
        text_sim = cosine_similarity(np.array(text_emb1), np.array(text_emb2))
        
        # Image similarity (optional)
        if image_emb1 is not None and image_emb2 is not None:
            image_sim = cosine_similarity(np.array(image_emb1), np.array(image_emb2))
            # Weighted combination: 60% text, 40% image
            combined_sim = 0.6 * text_sim + 0.4 * image_sim
        else:
            # Only text similarity
            combined_sim = text_sim
        
        return float(combined_sim)
        
    except Exception as e:
        logger.error(f"Error calculating combined similarity: {str(e)}")
        return 0.0

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity antara dua vectors"""
    try:
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
        
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {str(e)}")
        return 0.0

def get_confidence_level(similarity):
    """Get confidence level berdasarkan similarity score"""
    if similarity >= 0.9:
        return "Very High"
    elif similarity >= 0.8:
        return "High"
    elif similarity >= 0.7:
        return "Medium"
    elif similarity >= 0.6:
        return "Low"
    else:
        return "Very Low"

def get_unprocessed_items(firebase, collection_name, limit):
    """Get items yang belum diproses atau perlu di-reprocess"""
    try:
        # Get items yang belum ada embeddings atau sudah lama tidak diproses
        items_ref = firebase.collection(collection_name)
        query = items_ref.where("status", "==", "active").limit(limit)
        
        docs = query.stream()
        items = []
        
        for doc in docs:
            doc_data = doc.to_dict()
            
            # Include items yang belum ada text_embedding
            if not doc_data.get("text_embedding"):
                items.append(doc_data)
                continue
            
            # Include items yang sudah lama tidak diproses (>24 jam)
            processed_at = doc_data.get("processed_at")
            if processed_at:
                try:
                    processed_time = datetime.fromisoformat(processed_at.replace("Z", "+00:00"))
                    if (datetime.now() - processed_time).total_seconds() > 86400:  # 24 hours
                        items.append(doc_data)
                except:
                    items.append(doc_data)
            else:
                items.append(doc_data)
        
        return items
        
    except Exception as e:
        logger.error(f"Error getting unprocessed items: {str(e)}")
        return []

async def save_background_matches(firebase, item_id, collection, matches):
    """Save background matches ke Firebase"""
    try:
        match_data = {
            "item_id": item_id,
            "collection": collection,
            "matches": matches,
            "created_at": datetime.now().isoformat(),
            "processed": False
        }
        
        # Save ke matches collection
        firebase.collection("matches").add(match_data)
        logger.info(f"Saved {len(matches)} background matches for item {item_id}")
        
    except Exception as e:
        logger.error(f"Error saving background matches: {str(e)}")

async def notify_backend_matches(item_id, collection, matches):
    """Notify backend tentang matches yang ditemukan"""
    try:
        # Filter high similarity matches (>= 0.8)
        high_sim_matches = [m for m in matches if m["similarity"] >= 0.8]
        
        if not high_sim_matches:
            return
        
        # Send notification ke backend
        backend_url = "http://localhost:3000/api/matches/ai-notification"
        payload = {
            "item_id": item_id,
            "collection": collection,
            "matches": high_sim_matches,
            "timestamp": datetime.now().isoformat()
        }
        
        response = requests.post(backend_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"Successfully notified backend about {len(high_sim_matches)} high similarity matches")
        else:
            logger.warning(f"Backend notification failed with status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error notifying backend: {str(e)}")

# Export router
__all__ = ["router"]