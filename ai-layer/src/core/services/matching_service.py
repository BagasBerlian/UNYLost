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
    
    def find_matches(self, item_embeddings, candidate_embeddings, threshold=0.75):
        matches = []
        
        for candidate_id, candidate_data in candidate_embeddings.items():
            try:
                # Extract embeddings from candidate data
                candidate_emb = {}
                
                # Handle different data structures
                if 'embeddings' in candidate_data:
                    candidate_emb = candidate_data['embeddings']
                else:
                    # Try to use the data directly if no embeddings key
                    for key in ['clip_text', 'sentence_text', 'image']:
                        if key in candidate_data:
                            candidate_emb[key] = candidate_data[key]
                
                # Skip if no embeddings found
                if not candidate_emb:
                    print(f"Warning: No embeddings found for candidate {candidate_id}")
                    continue
                
                similarity = self.calculate_hybrid_similarity(item_embeddings, candidate_emb)
                
                if similarity >= threshold:
                    matches.append({
                        "id": candidate_id,
                        "similarity": round(float(similarity), 4),
                        "match_type": "hybrid"
                    })
            except Exception as e:
                print(f"Error processing candidate {candidate_id}: {e}")
                continue
        
        # Sort matches by similarity score (descending)
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        return matches
    
    def instant_match(self, item_data, collection, threshold=0.75):
        cache_key = f"match:{item_data['item_id']}:{collection}"
        cached_result = self.cache_service.get(cache_key, item_data['item_id'])
        
        if cached_result:
            print(f"Cache hit for match result: {item_data['item_id']}")
            return cached_result
        
        item_embeddings = {}
        
        if "item_name" in item_data and "description" in item_data:
            # Preproses teks dengan lemmatization dan normalisasi
            text = combine_item_text(item_data['item_name'], item_data['description'], with_synonyms=True)
            
            item_embeddings["clip_text"] = self.embedding_service.get_text_embedding_clip(text, item_data.get("item_id"))
            item_embeddings["sentence_text"] = self.embedding_service.get_text_embedding_sentence(text, item_data.get("item_id"))
        
        if "image_urls" in item_data and item_data["image_urls"]:
            try:
                image_url = item_data["image_urls"][0]
                from src.utils.image_processing import load_image
                
                image = load_image(image_url)
                
                item_embeddings["image"] = self.embedding_service.get_image_embedding(image, item_data.get("item_id"))
            except Exception as e:
                print(f"Warning: Failed to process image URL {item_data['image_urls'][0]}: {str(e)}")
                print("Continuing with text-only matching")
        
        # Save embeddings to Firebase
        firebase_collection = "lost_items_embeddings" if collection == "found_items" else "found_items_embeddings"
        metadata = {
            "name": item_data.get("item_name", ""),
            "description": item_data.get("description", ""),
            "collection": collection,
            "image_urls": item_data.get("image_urls", [])
        }
        
        self.firebase_client.save_embedding(
            collection_name=firebase_collection.replace("_embeddings", ""),
            item_id=item_data["item_id"],
            embeddings=item_embeddings,
            metadata=metadata
        )
        
        target_collection = "found_items" if collection == "lost_items" else "lost_items"
        candidates = self.firebase_client.get_all_embeddings(target_collection)
        
        if not candidates:
            candidates = self._get_mock_candidates(collection)
        
        matches = self.find_matches(item_embeddings, candidates, threshold)
        
        result = {
            "item_id": item_data.get("item_id", "unknown"),
            "matches": matches,
            "total_matches": len(matches),
            "has_high_similarity": any(m["similarity"] > 0.85 for m in matches)
        }
        
        # Cache the result
        self.cache_service.set(cache_key, item_data['item_id'], result)
        
        return result
    
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