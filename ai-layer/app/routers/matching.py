"""
Updated Matching Router untuk UNY Lost AI Layer v2
Designed untuk integration dengan Backend Node.js
"""

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from PIL import Image
from io import BytesIO
import asyncio
from datetime import datetime
from loguru import logger
import requests

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

class BackgroundMatchRequest(BaseModel):
    limit: Optional[int] = Field(100, description="Maximum items to process")
    threshold: Optional[float] = Field(0.75, description="Minimum similarity threshold")

class SimilarityRequest(BaseModel):
    item1_id: str = Field(..., description="ID item pertama")
    item2_id: str = Field(..., description="ID item kedua")
    collection1: str = Field("found_items", description="Collection item pertama")
    collection2: str = Field("found_items", description="Collection item kedua")

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
        
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="AI models not loaded")
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        models = app_state.models
        firebase = app_state.firebase
        
        logger.info(f"🔄 Processing item: {item_request.item_name} (ID: {item_request.item_id})")
        
        # Load image dari URL jika ada
        image = None
        if item_request.image_url:
            try:
                image = await _load_image_from_url(item_request.image_url)
                logger.info(f"📷 Image loaded from URL: {item_request.image_url}")
            except Exception as e:
                logger.warning(f"⚠️  Could not load image from URL: {str(e)}")
        
        # Generate embeddings
        embeddings = {
            "item_id": item_request.item_id,
            "item_name": item_request.item_name,
            "description": item_request.description,
            "category": item_request.category,
            "image_url": item_request.image_url,
            "processed_at": datetime.now().isoformat(),
            "embedding_version": "clip_sentence_v2"
        }
        
        # Generate image embedding
        if image:
            try:
                embeddings['image_embedding'] = models.encode_image(image)
                logger.info("✅ Image embedding generated")
            except Exception as e:
                logger.error(f"❌ Error generating image embedding: {str(e)}")
        
        # Generate text embeddings
        if item_request.description:
            try:
                embeddings['text_clip_embedding'] = models.encode_text_clip(item_request.description)
                embeddings['text_sentence_embedding'] = models.encode_text_sentence(item_request.description)
                logger.info("✅ Text embeddings generated")
            except Exception as e:
                logger.error(f"❌ Error generating text embeddings: {str(e)}")
        
        if not any(key.endswith('_embedding') for key in embeddings.keys()):
            raise HTTPException(status_code=400, detail="Could not generate any embeddings")
        
        # Save embeddings ke Firebase
        success = firebase.save_item_embeddings(
            item_request.item_id, 
            embeddings, 
            item_request.collection
        )
        
        if not success:
            logger.warning(f"⚠️  Could not save embeddings to Firebase for {item_request.item_id}")
        
        # Find matches di collection yang berlawanan
        search_collection = "lost_items" if item_request.collection == "found_items" else "found_items"
        matches = await _find_matches_in_collection(
            embeddings, 
            search_collection, 
            firebase, 
            models, 
            item_request.threshold,
            item_request.max_results
        )
        
        # Save significant matches (background task)
        if matches:
            significant_matches = [m for m in matches if m['similarity_score'] >= 0.8]
            if significant_matches:
                background_tasks.add_task(
                    _save_matches_background, 
                    firebase, 
                    significant_matches, 
                    item_request.item_id,
                    search_collection
                )
        
        result = {
            "item_id": item_request.item_id,
            "embeddings_saved": success,
            "embeddings_generated": [k for k in embeddings.keys() if k.endswith('_embedding')],
            "matches": matches,
            "total_matches": len(matches),
            "search_collection": search_collection,
            "threshold_used": item_request.threshold,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"✅ Item processed: {item_request.item_id}, found {len(matches)} matches")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error processing item: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/background")
async def background_matching(request: Request, match_request: BackgroundMatchRequest):
    """
    Background matching service untuk semua lost items
    Dijalankan oleh cron job dari backend setiap 2 jam
    """
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="AI models not loaded")
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        models = app_state.models
        firebase = app_state.firebase
        
        logger.info("🔄 Starting background matching service...")
        
        # Get active lost items
        lost_items = firebase.search_items_by_status("active", "lost_items")
        
        if not lost_items:
            return {
                "status": "completed",
                "processed": 0,
                "matches_found": 0,
                "message": "No active lost items to process",
                "timestamp": datetime.now().isoformat()
            }
        
        # Get all found items untuk matching
        found_items = firebase.get_all_embeddings("found_items")
        
        if not found_items:
            return {
                "status": "completed", 
                "processed": 0,
                "matches_found": 0,
                "message": "No found items in database",
                "timestamp": datetime.now().isoformat()
            }
        
        processed_count = 0
        total_matches = 0
        
        # Process each lost item
        for lost_item in lost_items[:match_request.limit]:
            try:
                lost_id = lost_item['id']
                logger.info(f"🔍 Processing lost item: {lost_id}")
                
                # Calculate similarities dengan semua found items
                item_matches = []
                
                for found_id, found_data in found_items.items():
                    try:
                        similarity = models.hybrid_similarity(
                            query_image=lost_item.get('image_embedding'),
                            query_text_clip=lost_item.get('text_clip_embedding'), 
                            query_text_sentence=lost_item.get('text_sentence_embedding'),
                            candidate_image=found_data.get('image_embedding'),
                            candidate_text_clip=found_data.get('text_clip_embedding'),
                            candidate_text_sentence=found_data.get('text_sentence_embedding')
                        )
                        
                        if similarity >= match_request.threshold:
                            match_data = {
                                'lost_item_id': lost_id,
                                'found_item_id': found_id,
                                'similarity_score': similarity,
                                'lost_item_name': lost_item.get('item_name', ''),
                                'found_item_name': found_data.get('item_name', ''),
                                'match_type': _determine_match_type(lost_item, found_data, models),
                                'created_at': datetime.now().isoformat(),
                                'matching_version': 'clip_sentence_v2'
                            }
                            item_matches.append(match_data)
                            
                    except Exception as e:
                        logger.error(f"❌ Error matching {lost_id} with {found_id}: {str(e)}")
                        continue
                
                # Save matches jika ada
                if item_matches:
                    # Sort by similarity
                    item_matches.sort(key=lambda x: x['similarity_score'], reverse=True)
                    
                    # Save top matches
                    for match in item_matches[:5]:  # Simpan max 5 match terbaik
                        match_id = firebase.save_match_result(match)
                        if match_id:
                            total_matches += 1
                            logger.info(f"💫 Match saved: {match_id}")
                    
                    # Update lost item status
                    firebase.update_item_status(lost_id, "has_matches", "lost_items")
                
                processed_count += 1
                
                # Add delay untuk tidak overload system
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"❌ Error processing lost item {lost_item.get('id')}: {str(e)}")
                continue
        
        result = {
            "status": "completed",
            "processed": processed_count,
            "matches_found": total_matches,
            "threshold_used": match_request.threshold,
            "total_lost_items": len(lost_items),
            "total_found_items": len(found_items),
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"✅ Background matching completed: {result}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in background matching: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/similarity")
async def calculate_similarity(request: Request, similarity_request: SimilarityRequest):
    """Calculate similarity antara 2 specific items"""
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'models') or not app_state.models:
            raise HTTPException(status_code=503, detail="AI models not loaded")
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        models = app_state.models
        firebase = app_state.firebase
        
        # Get embeddings untuk kedua items
        item1_embeddings = firebase.get_item_embeddings(
            similarity_request.item1_id, 
            similarity_request.collection1
        )
        
        item2_embeddings = firebase.get_item_embeddings(
            similarity_request.item2_id,
            similarity_request.collection2
        )
        
        if not item1_embeddings:
            raise HTTPException(status_code=404, detail=f"Item {similarity_request.item1_id} not found")
        
        if not item2_embeddings:
            raise HTTPException(status_code=404, detail=f"Item {similarity_request.item2_id} not found")
        
        # Calculate various similarities
        similarities = {}
        
        # Image similarity
        if ('image_embedding' in item1_embeddings and 'image_embedding' in item2_embeddings):
            img_sim = models.calculate_similarity(
                item1_embeddings['image_embedding'],
                item2_embeddings['image_embedding']
            )
            similarities['image'] = round(img_sim, 4)
        
        # Text CLIP similarity
        if ('text_clip_embedding' in item1_embeddings and 'text_clip_embedding' in item2_embeddings):
            clip_sim = models.calculate_similarity(
                item1_embeddings['text_clip_embedding'],
                item2_embeddings['text_clip_embedding']
            )
            similarities['text_clip'] = round(clip_sim, 4)
        
        # Text Sentence similarity
        if ('text_sentence_embedding' in item1_embeddings and 'text_sentence_embedding' in item2_embeddings):
            sent_sim = models.calculate_similarity(
                item1_embeddings['text_sentence_embedding'],
                item2_embeddings['text_sentence_embedding']
            )
            similarities['text_sentence'] = round(sent_sim, 4)
        
        # Cross-modal similarities
        if ('image_embedding' in item1_embeddings and 'text_clip_embedding' in item2_embeddings):
            cross_sim1 = models.calculate_similarity(
                item1_embeddings['image_embedding'],
                item2_embeddings['text_clip_embedding']
            )
            similarities['image_to_text'] = round(cross_sim1, 4)
        
        if ('text_clip_embedding' in item1_embeddings and 'image_embedding' in item2_embeddings):
            cross_sim2 = models.calculate_similarity(
                item1_embeddings['text_clip_embedding'],
                item2_embeddings['image_embedding']
            )
            similarities['text_to_image'] = round(cross_sim2, 4)
        
        # Hybrid similarity
        hybrid_sim = models.hybrid_similarity(
            query_image=item1_embeddings.get('image_embedding'),
            query_text_clip=item1_embeddings.get('text_clip_embedding'),
            query_text_sentence=item1_embeddings.get('text_sentence_embedding'),
            candidate_image=item2_embeddings.get('image_embedding'),
            candidate_text_clip=item2_embeddings.get('text_clip_embedding'),
            candidate_text_sentence=item2_embeddings.get('text_sentence_embedding')
        )
        similarities['hybrid'] = round(hybrid_sim, 4)
        
        return {
            "item1": {
                "id": similarity_request.item1_id,
                "collection": similarity_request.collection1,
                "name": item1_embeddings.get('item_name', ''),
                "embeddings_available": list(k for k in item1_embeddings.keys() if k.endswith('_embedding'))
            },
            "item2": {
                "id": similarity_request.item2_id,
                "collection": similarity_request.collection2,
                "name": item2_embeddings.get('item_name', ''),
                "embeddings_available": list(k for k in item2_embeddings.keys() if k.endswith('_embedding'))
            },
            "similarities": similarities,
            "match_recommendation": {
                "is_match": hybrid_sim >= 0.75,
                "confidence": "high" if hybrid_sim >= 0.8 else "medium" if hybrid_sim >= 0.6 else "low",
                "best_match_type": max(similarities.items(), key=lambda x: x[1])[0] if similarities else None
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error calculating similarity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def matching_stats(request: Request):
    """Get matching service statistics"""
    try:
        app_state = request.app.state
        
        if not hasattr(app_state, 'firebase') or not app_state.firebase:
            raise HTTPException(status_code=503, detail="Firebase not available")
        
        firebase = app_state.firebase
        
        # Get recent matches
        recent_matches = firebase.get_recent_matches(limit=100)
        
        # Calculate stats
        stats = {
            "total_recent_matches": len(recent_matches),
            "match_types": {},
            "similarity_distribution": {
                "high (>0.8)": 0,
                "medium (0.6-0.8)": 0,
                "low (<0.6)": 0
            },
            "average_similarity": 0,
            "collections_stats": firebase.get_stats()
        }
        
        if recent_matches:
            similarities = []
            
            for match in recent_matches:
                # Match types
                match_type = match.get('match_type', 'unknown')
                stats["match_types"][match_type] = stats["match_types"].get(match_type, 0) + 1
                
                # Similarity distribution
                similarity = match.get('similarity_score', 0)
                if similarity:
                    similarities.append(similarity)
                    
                    if similarity > 0.8:
                        stats["similarity_distribution"]["high (>0.8)"] += 1
                    elif similarity >= 0.6:
                        stats["similarity_distribution"]["medium (0.6-0.8)"] += 1
                    else:
                        stats["similarity_distribution"]["low (<0.6)"] += 1
            
            # Average similarity
            if similarities:
                stats["average_similarity"] = round(sum(similarities) / len(similarities), 4)
        
        return {
            "matching_statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting matching stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions
async def _load_image_from_url(url: str) -> Image.Image:
    """Load image dari URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        image = Image.open(BytesIO(response.content)).convert("RGB")
        return image
        
    except Exception as e:
        logger.error(f"❌ Error loading image from URL {url}: {str(e)}")
        raise

async def _find_matches_in_collection(embeddings: Dict, collection: str, firebase, models, 
                                    threshold: float, max_results: int) -> List[Dict]:
    """Find matches dalam specific collection"""
    try:
        all_items = firebase.get_all_embeddings(collection)
        
        if not all_items:
            return []
        
        matches = []
        for item_id, item_embeddings in all_items.items():
            try:
                similarity = models.hybrid_similarity(
                    query_image=embeddings.get('image_embedding'),
                    query_text_clip=embeddings.get('text_clip_embedding'),
                    query_text_sentence=embeddings.get('text_sentence_embedding'),
                    candidate_image=item_embeddings.get('image_embedding'),
                    candidate_text_clip=item_embeddings.get('text_clip_embedding'),
                    candidate_text_sentence=item_embeddings.get('text_sentence_embedding')
                )
                
                if similarity >= threshold:
                    match_info = {
                        'item_id': item_id,
                        'similarity_score': round(similarity, 4),
                        'item_name': item_embeddings.get('item_name', ''),
                        'description': item_embeddings.get('description', ''),
                        'category': item_embeddings.get('category', ''),
                        'match_type': _determine_match_type(embeddings, item_embeddings, models)
                    }
                    matches.append(match_info)
                    
            except Exception as e:
                logger.error(f"❌ Error calculating similarity for {item_id}: {str(e)}")
                continue
        
        # Sort by similarity (descending)
        matches.sort(key=lambda x: x['similarity_score'], reverse=True)
        return matches[:max_results]
        
    except Exception as e:
        logger.error(f"❌ Error finding matches in collection {collection}: {str(e)}")
        return []

def _determine_match_type(embeddings1: Dict, embeddings2: Dict, models) -> str:
    """Determine type of match based on strongest similarity"""
    try:
        similarities = {}
        
        # Image similarity
        if ('image_embedding' in embeddings1 and 'image_embedding' in embeddings2):
            img_sim = models.calculate_similarity(
                embeddings1['image_embedding'],
                embeddings2['image_embedding']
            )
            similarities['image'] = img_sim
        
        # Text similarities
        if ('text_clip_embedding' in embeddings1 and 'text_clip_embedding' in embeddings2):
            clip_sim = models.calculate_similarity(
                embeddings1['text_clip_embedding'],
                embeddings2['text_clip_embedding']
            )
            similarities['text_clip'] = clip_sim
        
        if ('text_sentence_embedding' in embeddings1 and 'text_sentence_embedding' in embeddings2):
            sent_sim = models.calculate_similarity(
                embeddings1['text_sentence_embedding'],
                embeddings2['text_sentence_embedding']
            )
            similarities['text_semantic'] = sent_sim
        
        # Cross-modal
        if ('image_embedding' in embeddings1 and 'text_clip_embedding' in embeddings2):
            cross_sim = models.calculate_similarity(
                embeddings1['image_embedding'],
                embeddings2['text_clip_embedding']
            )
            similarities['cross_modal'] = cross_sim
        
        if not similarities:
            return "unknown"
        
        # Return strongest match type
        best_match = max(similarities.items(), key=lambda x: x[1])
        
        if best_match[1] > 0.8:
            return f"strong_{best_match[0]}"
        elif best_match[1] > 0.6:
            return best_match[0]
        else:
            return "weak_match"
            
    except Exception as e:
        logger.error(f"❌ Error determining match type: {str(e)}")
        return "error"

async def _save_matches_background(firebase, matches: List[Dict], item_id: str, collection: str):
    """Background task untuk save significant matches"""
    try:
        for match in matches:
            match_data = {
                **match,
                'source_item_id': item_id,
                'target_collection': collection,
                'match_source': 'process_item',
                'created_at': datetime.now().isoformat()
            }
            
            match_id = firebase.save_match_result(match_data)
            if match_id:
                logger.info(f"💫 Background match saved: {match_id}")
                
    except Exception as e:
        logger.error(f"❌ Error saving background matches: {str(e)}")