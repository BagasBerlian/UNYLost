import numpy as np
from src.core.models.clip_model import ClipModel
from src.core.models.sentence_transformer import SentenceTransformerModel
from src.core.services.cache_service import CacheService

class EmbeddingService:
    def __init__(self):
        self.clip_model = ClipModel()
        self.sentence_transformer = SentenceTransformerModel()
        self.cache_service = CacheService()
    
    def get_image_embedding(self, image, item_id=None, use_augmentation=True):
        # Check cache if item_id is provided
        if item_id:
            cached_embedding = self.cache_service.get("img_emb", item_id, as_numpy=True)
            if cached_embedding is not None:
                print(f"Cache hit for image embedding: {item_id}")
                return cached_embedding
        
        # Generate embedding
        if use_augmentation:
            embedding = self.clip_model.get_image_embedding_with_augmentation(image)
        else:
            embedding = self.clip_model.get_image_embedding(image)
        
        # Cache if item_id is provided
        if item_id:
            self.cache_service.set("img_emb", item_id, embedding)
        
        return embedding
    
    def get_text_embedding_clip(self, text, item_id=None):
    # Check cache if item_id is provided
        if item_id:
            cached_embedding = self.cache_service.get("txt_clip_emb", item_id, as_numpy=True)
            if cached_embedding is not None:
                print(f"Cache hit for CLIP text embedding: {item_id}")
                return cached_embedding
        
        try:
            # Generate embedding
            embedding = self.clip_model.get_text_embedding(text)
            
            # Verify embedding dimensions
            if embedding.shape[0] != 512:
                print(f"Warning: Unexpected embedding dimension: {embedding.shape}")
                # Pad or truncate if needed
                if embedding.shape[0] < 512:
                    # Pad with zeros
                    padded = np.zeros(512)
                    padded[:embedding.shape[0]] = embedding
                    embedding = padded
                else:
                    # Truncate
                    embedding = embedding[:512]
            
            # Cache if item_id is provided
            if item_id:
                self.cache_service.set("txt_clip_emb", item_id, embedding)
            
            return embedding
        except Exception as e:
            print(f"Error in get_text_embedding_clip: {e}")
            # Return zeros array with correct dimension
            fallback = np.zeros(512)
            if item_id:
                self.cache_service.set("txt_clip_emb", item_id, fallback)
            return fallback
    
    def get_text_embedding_sentence(self, text, item_id=None):
        # Check cache if item_id is provided
        if item_id:
            cached_embedding = self.cache_service.get("txt_st_emb", item_id, as_numpy=True)
            if cached_embedding is not None:
                print(f"Cache hit for Sentence Transformer text embedding: {item_id}")
                return cached_embedding
        
        # Generate embedding
        embedding = self.sentence_transformer.get_text_embedding(text)
        
        # Cache if item_id is provided
        if item_id:
            self.cache_service.set("txt_st_emb", item_id, embedding)
        
        return embedding
    
    def get_hybrid_embedding(self, text, image=None, item_id=None):
        result = {
            "clip_text": self.get_text_embedding_clip(text, item_id),
            "sentence_text": self.get_text_embedding_sentence(text, item_id)
        }
        
        if image:
            result["image"] = self.get_image_embedding(image, item_id)
        
        return result
    
    def clear_cache_for_item(self, item_id):
        return self.cache_service.invalidate_item_cache(item_id)