import numpy as np
from typing import Dict, List, Tuple, Optional

class SimilarityService:
    # Hitung bobot dinamis berdasarkan ketersediaan dan kualitas embeddings
    @staticmethod
    def compute_dynamic_weights(embeddings1: Dict, embeddings2: Dict) -> Dict[str, float]:
        weights = {
            "image": 0.4,
            "clip_text": 0.3, 
            "sentence_text": 0.3
        }
        
        # Jika kedua item memiliki gambar, prioritaskan gambar
        if "image" in embeddings1 and "image" in embeddings2:
            weights["image"] = 0.5
            weights["clip_text"] = 0.25
            weights["sentence_text"] = 0.25
        else:
            # Jika tidak ada gambar, prioritaskan text
            weights["clip_text"] = 0.5
            weights["sentence_text"] = 0.5
            weights["image"] = 0.0
        
        # Jika nama item sangat mirip (memiliki kesamaan > 0.8), beri bobot lebih ke teks
        if "clip_text" in embeddings1 and "clip_text" in embeddings2:
            text_similarity = SimilarityService.cosine_similarity(
                embeddings1["clip_text"], 
                embeddings2["clip_text"]
            )
            
            if text_similarity > 0.8:
                # Dengan kesamaan teks tinggi, teks lebih penting
                weights["clip_text"] += 0.1
                weights["sentence_text"] += 0.1
                
                if weights["image"] > 0.2:
                    weights["image"] -= 0.2
        
        # Pastikan jumlah bobot adalah 1.0
        total = sum(weights.values())
        return {k: v/total for k, v in weights.items()}
    
    
    # Calculate cosine similarity between two vectors
    @staticmethod
    def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        dot_product = np.dot(vec1, vec2)
        norm_a = np.linalg.norm(vec1)
        norm_b = np.linalg.norm(vec2)
        
        if norm_a == 0 or norm_b == 0:
            return 0
        
        return dot_product / (norm_a * norm_b)
    
    # Hitung similarity dengan bobot yang bisa dikonfigurasi
    @staticmethod
    def calculate_hybrid_similarity(item1: Dict, item2: Dict, weights: Optional[Dict] = None) -> Dict:
        # Jika bobot tidak disediakan, gunakan fungsi bobot dinamis
        if weights is None:
            weights = SimilarityService.compute_dynamic_weights(item1, item2)
        
        scores = {}
        used_weights = {}
        
        # Hitung similarity untuk setiap tipe embedding
        for emb_type, weight in weights.items():
            if emb_type in item1 and emb_type in item2:
                scores[emb_type] = SimilarityService.cosine_similarity(
                    item1[emb_type], 
                    item2[emb_type]
                )
                used_weights[emb_type] = weight
        
        # Hitung weighted average
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
    def rank_matches(query_item: Dict, candidates: Dict[str, Dict], threshold: float = 0.75, max_results: int = 10) ->List[Dict]:
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