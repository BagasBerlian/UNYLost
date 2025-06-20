import numpy as np
from typing import Dict, List, Tuple

class SimilarityService:
    # Calculate cosine similarity between two vectors
    @staticmethod
    def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        dot_product = np.dot(vec1, vec2)
        norm_a = np.linalg.norm(vec1)
        norm_b = np.linalg.norm(vec2)
        
        if norm_a == 0 or norm_b == 0:
            return 0
        
        return dot_product / (norm_a * norm_b)
    
    # Calculate similarity with configurable weights
    @staticmethod
    def calculate_hybrid_similarity(item1: Dict, item2: Dict, weights: Dict = None) -> Dict:
        if weights is None:
            weights = {
                "image": 0.4,
                "clip_text": 0.3, 
                "sentence_text": 0.3
            }
        
        scores = {}
        used_weights = {}
        
        # Calculate similarity for each embedding type
        for emb_type, weight in weights.items():
            if emb_type in item1 and emb_type in item2:
                scores[emb_type] = SimilarityService.cosine_similarity(
                    item1[emb_type], 
                    item2[emb_type]
                )
                used_weights[emb_type] = weight
        
        # Calculate weighted average
        if not scores:
            return {"total": 0.0, "components": {}}
        
        total_weight = sum(used_weights.values())
        total_score = sum(score * used_weights[emb_type] for emb_type, score in scores.items()) / total_weight
        
        return {
            "total": total_score,
            "components": scores,
            "weights_used": used_weights
        }
    
    # Find and rank matches by similarity
    @staticmethod
    def rank_matches(query_item: Dict, candidates: Dict[str, Dict], 
                     threshold: float = 0.75, max_results: int = 10) -> List[Dict]:
        matches = []
        
        for candidate_id, candidate in candidates.items():
            similarity = SimilarityService.calculate_hybrid_similarity(query_item, candidate)
            
            if similarity["total"] >= threshold:
                matches.append({
                    "id": candidate_id,
                    "similarity": round(float(similarity["total"]), 4),
                    "component_scores": {k: round(float(v), 4) for k, v in similarity["components"].items()},
                    "match_type": "hybrid" if len(similarity["components"]) > 1 else list(similarity["components"].keys())[0]
                })
        
        # Sort by similarity (descending)
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        # Limit results
        return matches[:max_results]