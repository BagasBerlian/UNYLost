import numpy as np
from src.core.services.embedding_service import EmbeddingService
from src.database.firebase import FirebaseClient
from src.core.services.cache_service import CacheService
from src.utils.text_processing import combine_item_text, preprocess_text
from src.core.services.similarity_service import SimilarityService


class MatchingService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.firebase_client = FirebaseClient()
        self.cache_service = CacheService()
    
    def calculate_similarity(self, embedding1, embedding2):
        try:
            if len(embedding1) != len(embedding2):
                print(f"Warning: Dimension mismatch. Embedding1: {len(embedding1)}, Embedding2: {len(embedding2)}")
                return 0.0
            
            return np.dot(embedding1, embedding2)
        except Exception as e:
            print(f"Error calculating similarity: {e}")
            return 0.0
    
    def calculate_hybrid_similarity(self, embeddings1, embeddings2):
        try:
            # Gunakan fungsi pembobotan dinamis
            result = SimilarityService.calculate_hybrid_similarity(embeddings1, embeddings2)
            return result["total"]
        except Exception as e:
            print(f"Error calculating hybrid similarity: {e}")
            return 0.0
    
    def find_matches(self, item_embeddings, candidate_embeddings, threshold=0.6):
        matches = []
        
        print(f"Looking for matches among {len(candidate_embeddings)} candidates")
        print(f"Item embeddings keys: {item_embeddings.keys()}")
        
        for candidate_id, candidate_data in candidate_embeddings.items():
            try:
                # Skip jika membandingkan dengan diri sendiri
                if candidate_id == item_embeddings.get('item_id'):
                    print(f"Skipping self-match with {candidate_id}")
                    continue
                    
                # Extract embeddings dari data kandidat
                candidate_emb = {}
                
                # Handle different data structures
                if 'embeddings' in candidate_data:
                    candidate_emb = candidate_data['embeddings']
                else:
                    # Try to use the data directly if no embeddings key
                    for key in ['clip_text', 'sentence_text', 'image']:
                        if key in candidate_data:
                            candidate_emb[key] = candidate_data[key]
                
                # Tambahkan debug untuk lihat kandidat
                print(f"Candidate {candidate_id} has embedding keys: {candidate_emb.keys()}")
                
                # Skip if no embeddings found
                if not candidate_emb:
                    print(f"Warning: No embeddings found for candidate {candidate_id}")
                    continue
                
                # Check if embeddings are compatible
                compatible_keys = [k for k in item_embeddings.keys() if k in candidate_emb.keys() and k not in ['item_id']]
                print(f"Compatible embedding keys: {compatible_keys}")
                
                if not compatible_keys:
                    print(f"No compatible embeddings between item and candidate {candidate_id}")
                    continue
                    
                # Calculate similarity with all available embeddings
                similarity_components = {}
                for key in compatible_keys:
                    if key in ['clip_text', 'sentence_text', 'image']:
                        try:
                            sim = self.calculate_similarity(item_embeddings[key], candidate_emb[key])
                            similarity_components[key] = sim
                            print(f"Similarity for {key}: {sim}")
                        except Exception as e:
                            print(f"Error calculating similarity for {key}: {e}")
                
                # Calculate average similarity
                if similarity_components:
                    avg_similarity = sum(similarity_components.values()) / len(similarity_components)
                    print(f"Average similarity with {candidate_id}: {avg_similarity}")
                    
                    if avg_similarity >= threshold:
                        matches.append({
                            "id": candidate_id,
                            "similarity": round(float(avg_similarity), 4),
                            "match_type": "hybrid" if len(similarity_components) > 1 else list(similarity_components.keys())[0]
                        })
                
            except Exception as e:
                print(f"Error processing candidate {candidate_id}: {e}")
                continue
        
        # Sort matches by similarity score (descending)
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        print(f"Found {len(matches)} matches above threshold {threshold}")
        
        return matches
    
    def instant_match(self, item_data, collection, threshold=5):
        try:
            cache_key = f"match:{item_data['item_id']}:{collection}"
            cached_result = self.cache_service.get(cache_key, item_data['item_id'])
            
            if cached_result:
                print(f"Cache hit for match result: {item_data['item_id']}")
                return cached_result
            
            item_embeddings = {}
            
            # Generate text embeddings
            try:
                if "item_name" in item_data and "description" in item_data:
                    text = combine_item_text(
                        item_data.get('item_name', ''), 
                        item_data.get('description', ''), 
                        with_synonyms=True
                    )
                    
                    item_embeddings["clip_text"] = self.embedding_service.get_text_embedding_clip(text, item_data.get("item_id"))
                    item_embeddings["sentence_text"] = self.embedding_service.get_text_embedding_sentence(text, item_data.get("item_id"))
            except Exception as e:
                print(f"Error generating text embeddings: {e}")
                # Continue with empty text embeddings
            
            # Generate image embeddings
            try:
                if "image_urls" in item_data and item_data["image_urls"]:
                    for idx, image_url in enumerate(item_data["image_urls"]):
                        try:
                            print(f"Processing image {idx+1}/{len(item_data['image_urls'])}: {image_url}")
                            from src.utils.image_processing import load_image
                            
                            image = load_image(image_url)
                            
                            if idx == 0:  # Use only first image for now
                                item_embeddings["image"] = self.embedding_service.get_image_embedding(image, item_data.get("item_id"))
                                break
                        except Exception as img_err:
                            print(f"Error processing image {idx+1}: {img_err}")
                            continue
            except Exception as e:
                print(f"Error in image embedding process: {e}")
                # Continue without image embeddings
            
            # Save to Firebase - handle potential errors
            try:
                # Set item_id in embeddings for reference
                item_embeddings["item_id"] = item_data["item_id"]
                
                firebase_collection = "lost_items" if collection == "found_items" else "found_items"
                metadata = {
                    "name": item_data.get("item_name", ""),
                    "description": item_data.get("description", ""),
                    "collection": collection,
                    "image_urls": item_data.get("image_urls", [])
                }
                
                self.firebase_client.save_embedding(
                    collection_name=firebase_collection,
                    item_id=item_data["item_id"],
                    embeddings=item_embeddings,
                    metadata=metadata
                )
            except Exception as firebase_err:
                print(f"Error saving to Firebase: {firebase_err}")
            
            # Get candidates for matching
            target_collection = "found_items" if collection == "lost_items" else "lost_items"
            candidates = {}
            
            try:
                candidates = self.firebase_client.get_all_embeddings(target_collection)
                print(f"Found {len(candidates)} candidates in {target_collection}")
            except Exception as e:
                print(f"Error getting candidates: {e}")
                # Use empty candidates if error
            
            if not candidates:
                print("No candidates found, using mock data")
                candidates = self._get_mock_candidates(collection)
            
            # Find matches
            matches = []
            try:
                matches = self.find_matches(item_embeddings, candidates, threshold)
            except Exception as match_err:
                print(f"Error in finding matches: {match_err}")
                # Return empty matches if error
            
            result = {
                "item_id": item_data.get("item_id", "unknown"),
                "matches": matches,
                "total_matches": len(matches),
                "has_high_similarity": any(m["similarity"] > 0.85 for m in matches)
            }
            
            # Cache the result
            self.cache_service.set(cache_key, item_data['item_id'], result)
            
            return result
        except Exception as e:
            print(f"Unexpected error in instant_match: {e}")
            # Return a safe fallback
            return {
                "item_id": item_data.get("item_id", "unknown"),
                "matches": [],
                "total_matches": 0,
                "has_high_similarity": False,
                "error": str(e)
            }
    
    
    def _get_mock_candidates(self, collection):
        mock_data = {}
        
        if collection == "lost_items":
            for i in range(1, 4):
                item_id = f"found_{i:03d}"
                mock_data[item_id] = {
                    'item_id': item_id,
                    'embeddings': {
                        "clip_text": np.random.rand(512),
                        "sentence_text": np.random.rand(384)
                    },
                    'metadata': {
                        'name': f"Mock Found Item {i}",
                        'description': f"This is a mock found item for testing {i}"
                    }
                }
                
                if i % 2 == 0:  
                    mock_data[item_id]['embeddings']["image"] = np.random.rand(512)
        else:  
            for i in range(1, 4):
                item_id = f"lost_{i:03d}"
                mock_data[item_id] = {
                    'item_id': item_id,
                    'embeddings': {
                        "clip_text": np.random.rand(512),
                        "sentence_text": np.random.rand(384)
                    },
                    'metadata': {
                        'name': f"Mock Lost Item {i}",
                        'description': f"This is a mock lost item for testing {i}"
                    }
                }
                
                if i % 2 == 0:  
                    mock_data[item_id]['embeddings']["image"] = np.random.rand(512)
        
        return mock_data