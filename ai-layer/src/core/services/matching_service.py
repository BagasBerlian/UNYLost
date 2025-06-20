import numpy as np
from src.core.services.embedding_service import EmbeddingService

class MatchingService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
    
    # Calculate cosine similarity between two embeddings
    def calculate_similarity(self, embedding1, embedding2):
        return np.dot(embedding1, embedding2)
    
    # Calculate hybrid similarity score using multiple embedding types
    def calculate_hybrid_similarity(self, embeddings1, embeddings2):
        weights = {
            "image": 0.4,
            "clip_text": 0.3,
            "sentence_text": 0.3
        }
        
        total_similarity = 0.0
        used_weights = 0.0
        
        if "image" in embeddings1 and "image" in embeddings2:
            image_similarity = self.calculate_similarity(
                embeddings1["image"], 
                embeddings2["image"]
            )
            total_similarity += weights["image"] * image_similarity
            used_weights += weights["image"]
        
        # CLIP text similarity
        if "clip_text" in embeddings1 and "clip_text" in embeddings2:
            clip_text_similarity = self.calculate_similarity(
                embeddings1["clip_text"], 
                embeddings2["clip_text"]
            )
            total_similarity += weights["clip_text"] * clip_text_similarity
            used_weights += weights["clip_text"]
        
        # Sentence Transformer text similarity
        if "sentence_text" in embeddings1 and "sentence_text" in embeddings2:
            sentence_text_similarity = self.calculate_similarity(
                embeddings1["sentence_text"], 
                embeddings2["sentence_text"]
            )
            total_similarity += weights["sentence_text"] * sentence_text_similarity
            used_weights += weights["sentence_text"]
        
        # Normalize the total similarity score
        if used_weights > 0:
            total_similarity /= used_weights
        
        return total_similarity
    
    # Find matches for an item from a list of candidates
    def find_matches(self, embeddings, candidate_embeddings, threshold=0.75):
        matches = []
        
        for candidate_id, candidate_emb in candidate_embeddings.items():
            similarity = self.calculate_hybrid_similarity(embeddings, candidate_emb)
            
            if similarity >= threshold:
                matches.append({
                    "id": candidate_id,
                    "similarity": round(float(similarity), 4), 
                    "match_type": "hybrid"
                })
        
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        return matches
    
    # Perform instant matching for a new item
    def instant_match(self, item_data, collection, threshold=0.75):
        embeddings = {}
        
        if "item_name" in item_data and "description" in item_data:
            # Combine name and description for text embeddings
            text = f"{item_data['item_name']} {item_data['description']}"
            
            embeddings["clip_text"] = self.embedding_service.get_text_embedding_clip(text, item_data.get("item_id"))
            embeddings["sentence_text"] = self.embedding_service.get_text_embedding_sentence(text, item_data.get("item_id"))
        
        if "image_urls" in item_data and item_data["image_urls"] and len(item_data["image_urls"]) > 0:
            try:
                # For now, just use the first image
                image_url = item_data["image_urls"][0]
                from src.utils.image_processing import load_image
                
                # Load the image
                image = load_image(image_url)
                
                # Get embedding
                embeddings["image"] = self.embedding_service.get_image_embedding(image, item_data.get("item_id"))
            except Exception as e:
                print(f"Warning: Failed to process image URL {item_data['image_urls'][0]}: {str(e)}")
                print("Continuing with text-only matching")
        
        # For a real implementation, here you would:
        # 1. Query a database like Firebase for candidate embeddings
        # 2. Compare the new item's embeddings with candidates
        
        # For this example, we'll use a mock collection of candidate embeddings
        mock_candidates = self._get_mock_candidates(collection)
        
        # Find matches
        matches = self.find_matches(embeddings, mock_candidates, threshold)
        
        return {
            "item_id": item_data.get("item_id", "unknown"),
            "matches": matches,
            "total_matches": len(matches),
            "has_high_similarity": any(m["similarity"] > 0.85 for m in matches)
        }
    
    # Generate mock candidate embeddings for testing
    def _get_mock_candidates(self, collection):
        # In a real implementation, this would fetch from a database
        
        if collection == "lost_items":
            # Mock found items for matching with a lost item
            return {
                "found_001": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384),
                    "image": np.random.rand(512)
                },
                "found_002": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384)
                    # No image for this one
                },
                "found_003": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384),
                    "image": np.random.rand(512)
                }
            }
        else:  
            return {
                "lost_001": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384),
                    "image": np.random.rand(512)
                },
                "lost_002": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384)
                    # No image for this one
                },
                "lost_003": {
                    "clip_text": np.random.rand(512),
                    "sentence_text": np.random.rand(384),
                    "image": np.random.rand(512)
                }
            }