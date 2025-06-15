import os
import torch
import clip
import numpy as np
from sentence_transformers import SentenceTransformer
from PIL import Image
from loguru import logger
from typing import List, Dict, Tuple, Optional, Union, Any
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
import json
import pickle
from datetime import datetime
import gc
import warnings

# Suppress warnings untuk cleaner output
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

class ModelManager:
    """
    Manager untuk semua AI models yang digunakan dalam UNY Lost
    Handles CLIP + Sentence Transformer dengan memory optimization
    """
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.clip_model = None
        self.clip_preprocess = None
        self.sentence_model = None
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        # Model status tracking
        self.clip_ready = False
        self.sentence_ready = False
        self.models_loaded = False
        
        # Feature dimensions (will be updated after loading)
        self.clip_dim = 512  # ViT-B/32 default
        self.sentence_dim = 384  # MiniLM default
        
        # Model configurations
        self.clip_model_name = "ViT-B/32"
        self.sentence_model_name = "paraphrase-multilingual-MiniLM-L12-v2"
        
        # Performance settings
        self.max_batch_size = 32
        self.similarity_cache = {}
        self.cache_max_size = 1000
        
        # Memory management
        self.memory_threshold = 0.85  # 85% memory usage threshold
        
        logger.info(f"🖥️  ModelManager initialized on {self.device}")
        logger.info(f"📊 Available memory: {self._get_memory_info()}")
    
    async def load_models(self):
        """Load semua models secara async dengan error handling"""
        try:
            logger.info("🤖 Starting model loading process...")
            
            # Load models secara parallel untuk efficiency
            tasks = [
                asyncio.create_task(self._load_clip()),
                asyncio.create_task(self._load_sentence_transformer())
            ]
            
            # Execute dengan proper error handling
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check results dan log status
            success_count = 0
            for i, result in enumerate(results):
                model_name = ["CLIP", "Sentence Transformer"][i]
                if isinstance(result, Exception):
                    logger.error(f"❌ Error loading {model_name}: {result}")
                else:
                    success_count += 1
                    logger.info(f"✅ {model_name} loaded successfully")
            
            # Update overall status
            self.models_loaded = (success_count == 2)
            
            if self.models_loaded:
                logger.info("🎉 All models loaded successfully!")
                await self._validate_models()
                return True
            else:
                logger.error(f"❌ Failed to load {2 - success_count} models")
                return False
                
        except Exception as e:
            logger.error(f"❌ Critical error during model loading: {str(e)}")
            return False
    
    async def _load_clip(self):
        """Load CLIP model dengan memory optimization"""
        def load_clip_sync():
            try:
                logger.info(f"🎯 Loading CLIP model: {self.clip_model_name}")
                
                # Load model dengan proper device handling
                model, preprocess = clip.load(self.clip_model_name, device=self.device)
                model.eval()
                
                # Set to inference mode untuk memory efficiency
                if hasattr(model, 'train'):
                    model.train(False)
                
                # Disable gradients untuk inference
                for param in model.parameters():
                    param.requires_grad = False
                
                return model, preprocess
                
            except Exception as e:
                logger.error(f"Error in CLIP loading: {e}")
                raise
        
        loop = asyncio.get_event_loop()
        try:
            # Load model dalam executor untuk non-blocking
            self.clip_model, self.clip_preprocess = await loop.run_in_executor(
                self.executor, load_clip_sync
            )
            
            # Update feature dimension dengan test
            with torch.no_grad():
                dummy_text = clip.tokenize(["test"]).to(self.device)
                features = self.clip_model.encode_text(dummy_text)
                self.clip_dim = features.shape[1]
            
            self.clip_ready = True
            logger.info(f"✅ CLIP model loaded (dim: {self.clip_dim}, device: {self.device})")
            
            # Save model info untuk debugging
            self._save_model_info("clip", {
                "model_name": self.clip_model_name,
                "device": self.device,
                "dimension": self.clip_dim,
                "loaded_at": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Failed to load CLIP: {str(e)}")
            self.clip_ready = False
            raise
    
    async def _load_sentence_transformer(self):
        """Load Sentence Transformer dengan optimization"""
        def load_sentence_sync():
            try:
                logger.info(f"📝 Loading Sentence Transformer: {self.sentence_model_name}")
                
                # Load model dengan device specification
                model = SentenceTransformer(self.sentence_model_name, device=self.device)
                
                # Set to evaluation mode
                model.eval()
                
                return model
                
            except Exception as e:
                logger.error(f"Error in Sentence Transformer loading: {e}")
                raise
        
        loop = asyncio.get_event_loop()
        try:
            # Load model dalam executor
            self.sentence_model = await loop.run_in_executor(
                self.executor, load_sentence_sync
            )
            
            # Update feature dimension dengan test
            test_embedding = self.sentence_model.encode(["test"], show_progress_bar=False)
            self.sentence_dim = test_embedding.shape[1]
            
            self.sentence_ready = True
            logger.info(f"✅ Sentence Transformer loaded (dim: {self.sentence_dim})")
            
            # Save model info
            self._save_model_info("sentence_transformer", {
                "model_name": self.sentence_model_name,
                "device": self.device,
                "dimension": self.sentence_dim,
                "max_seq_length": self.sentence_model.max_seq_length,
                "loaded_at": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Failed to load Sentence Transformer: {str(e)}")
            self.sentence_ready = False
            raise
    
    async def _validate_models(self):
        """Validate loaded models dengan functional tests"""
        try:
            logger.info("🔍 Validating loaded models...")
            
            validation_results = {}
            
            # Test CLIP model
            if self.clip_ready:
                try:
                    # Test image encoding
                    dummy_image = Image.new('RGB', (224, 224), color='blue')
                    img_embedding = self.encode_image(dummy_image)
                    
                    # Test text encoding
                    text_embedding = self.encode_text_clip("test dompet biru")
                    
                    # Test similarity calculation
                    similarity = self.calculate_similarity(img_embedding, text_embedding)
                    
                    validation_results["clip"] = {
                        "status": "validated",
                        "image_shape": img_embedding.shape,
                        "text_shape": text_embedding.shape,
                        "cross_modal_similarity": float(similarity)
                    }
                    
                except Exception as e:
                    validation_results["clip"] = {"status": "validation_failed", "error": str(e)}
            
            # Test Sentence Transformer
            if self.sentence_ready:
                try:
                    # Test semantic encoding
                    sentences = ["tas laptop hitam", "ransel komputer gelap"]
                    embeddings = self.encode_text_batch_sentence(sentences)
                    
                    # Test semantic similarity
                    sim = self.calculate_similarity(embeddings[0], embeddings[1])
                    
                    validation_results["sentence_transformer"] = {
                        "status": "validated",
                        "embedding_shape": embeddings[0].shape,
                        "semantic_similarity": float(sim)
                    }
                    
                except Exception as e:
                    validation_results["sentence_transformer"] = {"status": "validation_failed", "error": str(e)}
            
            # Log validation results
            for model, result in validation_results.items():
                if result.get("status") == "validated":
                    logger.info(f"✅ {model.upper()} validation passed")
                else:
                    logger.error(f"❌ {model.upper()} validation failed: {result.get('error')}")
            
            # Save validation results
            self._save_model_info("validation", validation_results)
            
        except Exception as e:
            logger.error(f"❌ Model validation error: {str(e)}")
    
    def encode_image(self, image: Union[Image.Image, str, np.ndarray]) -> np.ndarray:
        """
        Encode image menggunakan CLIP dengan error handling dan optimization
        
        Args:
            image: PIL Image, file path, atau numpy array
            
        Returns:
            np.ndarray: Normalized image embedding
        """
        if not self.clip_ready:
            raise RuntimeError("CLIP model not loaded. Run load_models() first.")
        
        try:
            # Handle different input types
            if isinstance(image, str):
                if os.path.exists(image):
                    image = Image.open(image).convert("RGB")
                else:
                    raise ValueError(f"Image file not found: {image}")
                    
            elif isinstance(image, np.ndarray):
                image = Image.fromarray(image).convert("RGB")
                
            elif not isinstance(image, Image.Image):
                raise ValueError("Image must be PIL Image, file path, or numpy array")
            
            # Preprocess image
            image_input = self.clip_preprocess(image).unsqueeze(0).to(self.device)
            
            # Generate embedding dengan memory optimization
            with torch.no_grad():
                image_features = self.clip_model.encode_image(image_input)
                
                # L2 normalize untuk consistent similarity calculation
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                
                # Convert to numpy dan cleanup GPU memory
                result = image_features.cpu().numpy().flatten()
                
                # Clear intermediate tensors
                del image_input, image_features
                if self.device == "cuda":
                    torch.cuda.empty_cache()
                
            return result.astype(np.float32)  # Use float32 untuk memory efficiency
            
        except Exception as e:
            logger.error(f"Error encoding image: {str(e)}")
            raise
    
    def encode_text_clip(self, text: str) -> np.ndarray:
        """
        Encode text menggunakan CLIP untuk cross-modal matching
        
        Args:
            text: Input text string
            
        Returns:
            np.ndarray: Normalized text embedding
        """
        if not self.clip_ready:
            raise RuntimeError("CLIP model not loaded. Run load_models() first.")
        
        try:
            # Preprocess text (CLIP has built-in text preprocessing)
            text_input = clip.tokenize([text], truncate=True).to(self.device)
            
            # Generate embedding
            with torch.no_grad():
                text_features = self.clip_model.encode_text(text_input)
                
                # L2 normalize
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                
                # Convert to numpy
                result = text_features.cpu().numpy().flatten()
                
                # Cleanup
                del text_input, text_features
                if self.device == "cuda":
                    torch.cuda.empty_cache()
                
            return result.astype(np.float32)
            
        except Exception as e:
            logger.error(f"Error encoding text with CLIP: {str(e)}")
            raise
    
    def encode_text_sentence(self, text: str) -> np.ndarray:
        """
        Encode text menggunakan Sentence Transformer untuk semantic matching
        
        Args:
            text: Input text string
            
        Returns:
            np.ndarray: Sentence embedding
        """
        if not self.sentence_ready:
            raise RuntimeError("Sentence Transformer model not loaded. Run load_models() first.")
        
        try:
            # Generate embedding dengan optimization
            embedding = self.sentence_model.encode(
                [text], 
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True  # Built-in normalization
            )
            
            return embedding.flatten().astype(np.float32)
            
        except Exception as e:
            logger.error(f"Error encoding text with Sentence Transformer: {str(e)}")
            raise
    
    def encode_text_batch_sentence(self, texts: List[str]) -> List[np.ndarray]:
        """
        Batch encode multiple texts untuk efficiency
        
        Args:
            texts: List of text strings
            
        Returns:
            List[np.ndarray]: List of embeddings
        """
        if not self.sentence_ready:
            raise RuntimeError("Sentence Transformer model not loaded. Run load_models() first.")
        
        try:
            # Process dalam batches untuk memory efficiency
            all_embeddings = []
            
            for i in range(0, len(texts), self.max_batch_size):
                batch = texts[i:i + self.max_batch_size]
                
                batch_embeddings = self.sentence_model.encode(
                    batch,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True
                )
                
                # Convert each embedding to float32
                for embedding in batch_embeddings:
                    all_embeddings.append(embedding.astype(np.float32))
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Error in batch text encoding: {str(e)}")
            raise
    
    def encode_multimodal(self, image: Optional[Image.Image] = None, text: Optional[str] = None) -> Dict[str, Any]:
        """
        Encode image dan text secara bersamaan untuk hybrid matching
        
        Args:
            image: PIL Image (optional)
            text: Text string (optional)
            
        Returns:
            Dict containing all generated embeddings
        """
        if not image and not text:
            raise ValueError("At least image or text must be provided")
        
        result = {
            "timestamp": datetime.now().isoformat(),
            "embeddings_generated": []
        }
        
        try:
            # Image encoding
            if image:
                result['image_embedding'] = self.encode_image(image)
                result['image_dim'] = self.clip_dim
                result['embeddings_generated'].append('image')
            
            # Text encoding (both CLIP and Sentence Transformer)
            if text:
                # CLIP text encoding untuk cross-modal matching
                result['text_clip_embedding'] = self.encode_text_clip(text)
                result['clip_dim'] = self.clip_dim
                result['embeddings_generated'].append('text_clip')
                
                # Sentence Transformer untuk semantic text matching
                result['text_sentence_embedding'] = self.encode_text_sentence(text)
                result['sentence_dim'] = self.sentence_dim
                result['embeddings_generated'].append('text_sentence')
            
            logger.debug(f"Multimodal encoding complete: {result['embeddings_generated']}")
            return result
            
        except Exception as e:
            logger.error(f"Error in multimodal encoding: {str(e)}")
            raise
    
    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Calculate cosine similarity antara 2 embeddings dengan caching
        
        Args:
            embedding1, embedding2: Numpy arrays of embeddings
            
        Returns:
            float: Cosine similarity score (0-1)
        """
        try:
            # Create cache key (simplified hash untuk performance)
            cache_key = f"{hash(embedding1.tobytes())}-{hash(embedding2.tobytes())}"
            
            # Check cache
            if cache_key in self.similarity_cache:
                return self.similarity_cache[cache_key]
            
            # Ensure embeddings are normalized
            norm1 = np.linalg.norm(embedding1)
            norm2 = np.linalg.norm(embedding2)
            
            if norm1 == 0 or norm2 == 0:
                logger.warning("Zero norm embedding detected")
                return 0.0
            
            embedding1_norm = embedding1 / norm1
            embedding2_norm = embedding2 / norm2
            
            # Calculate cosine similarity
            similarity = float(np.dot(embedding1_norm, embedding2_norm))
            
            # Clamp to [0, 1] range untuk safety
            similarity = max(0.0, min(1.0, similarity))
            
            # Cache result (with size limit)
            if len(self.similarity_cache) < self.cache_max_size:
                self.similarity_cache[cache_key] = similarity
            
            return similarity
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            return 0.0
    
    def find_most_similar(self, query_embedding: np.ndarray, candidates: List[np.ndarray], 
                         threshold: float = 0.7) -> List[Tuple[int, float]]:
        """
        Find most similar embeddings dari candidate list
        
        Args:
            query_embedding: Query embedding
            candidates: List of candidate embeddings
            threshold: Minimum similarity threshold
            
        Returns:
            List of (index, similarity) tuples, sorted by similarity desc
        """
        try:
            similarities = []
            
            for i, candidate in enumerate(candidates):
                similarity = self.calculate_similarity(query_embedding, candidate)
                if similarity >= threshold:
                    similarities.append((i, similarity))
            
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            logger.debug(f"Found {len(similarities)} matches above threshold {threshold}")
            return similarities
            
        except Exception as e:
            logger.error(f"Error finding similar embeddings: {str(e)}")
            return []
    
    def cross_modal_search(self, image_embedding: np.ndarray, text_embeddings: List[np.ndarray],
                          threshold: float = 0.7) -> List[Tuple[int, float]]:
        """
        Cross-modal search: find text matches using image embedding
        
        Args:
            image_embedding: CLIP image embedding
            text_embeddings: List of CLIP text embeddings
            threshold: Minimum similarity threshold
            
        Returns:
            List of (index, similarity) tuples
        """
        return self.find_most_similar(image_embedding, text_embeddings, threshold)
    
    def hybrid_similarity(self, 
                         query_image: Optional[np.ndarray] = None, 
                         query_text_clip: Optional[np.ndarray] = None,
                         query_text_sentence: Optional[np.ndarray] = None, 
                         candidate_image: Optional[np.ndarray] = None,
                         candidate_text_clip: Optional[np.ndarray] = None, 
                         candidate_text_sentence: Optional[np.ndarray] = None,
                         image_weight: float = 0.4, 
                         text_clip_weight: float = 0.3, 
                         text_sentence_weight: float = 0.3) -> float:
        """
        Calculate weighted hybrid similarity dengan multiple modalities
        
        Args:
            query_*, candidate_*: Various embeddings (optional)
            *_weight: Weights for different similarity types
            
        Returns:
            float: Weighted average similarity score
        """
        try:
            total_weight = 0
            total_similarity = 0
            similarities_used = []
            
            # Same-modal similarities
            
            # 1. Image-to-image similarity (CLIP visual)
            if query_image is not None and candidate_image is not None:
                img_sim = self.calculate_similarity(query_image, candidate_image)
                total_similarity += img_sim * image_weight
                total_weight += image_weight
                similarities_used.append(f"image: {img_sim:.3f}")
            
            # 2. Text-to-text similarity (CLIP semantic)
            if query_text_clip is not None and candidate_text_clip is not None:
                text_clip_sim = self.calculate_similarity(query_text_clip, candidate_text_clip)
                total_similarity += text_clip_sim * text_clip_weight
                total_weight += text_clip_weight
                similarities_used.append(f"text_clip: {text_clip_sim:.3f}")
            
            # 3. Text-to-text similarity (Sentence Transformer semantic)
            if query_text_sentence is not None and candidate_text_sentence is not None:
                text_sent_sim = self.calculate_similarity(query_text_sentence, candidate_text_sentence)
                total_similarity += text_sent_sim * text_sentence_weight
                total_weight += text_sentence_weight
                similarities_used.append(f"text_semantic: {text_sent_sim:.3f}")
            
            # Cross-modal similarities (CLIP space only)
            
            # 4. Image query vs Text candidate (cross-modal)
            if query_image is not None and candidate_text_clip is not None:
                cross_sim1 = self.calculate_similarity(query_image, candidate_text_clip)
                total_similarity += cross_sim1 * text_clip_weight
                total_weight += text_clip_weight
                similarities_used.append(f"image_to_text: {cross_sim1:.3f}")
            
            # 5. Text query vs Image candidate (cross-modal)
            if query_text_clip is not None and candidate_image is not None:
                cross_sim2 = self.calculate_similarity(query_text_clip, candidate_image)
                total_similarity += cross_sim2 * image_weight
                total_weight += image_weight
                similarities_used.append(f"text_to_image: {cross_sim2:.3f}")
            
            # Calculate weighted average
            if total_weight > 0:
                final_similarity = total_similarity / total_weight
                logger.debug(f"Hybrid similarity: {final_similarity:.3f} from {similarities_used}")
                return final_similarity
            else:
                logger.warning("No valid embedding pairs found for similarity calculation")
                return 0.0
                
        except Exception as e:
            logger.error(f"Error calculating hybrid similarity: {str(e)}")
            return 0.0
    
    def batch_hybrid_similarity(self, query_embeddings: Dict, candidate_list: List[Dict],
                               **similarity_kwargs) -> List[float]:
        """
        Batch calculate hybrid similarities untuk efficiency
        
        Args:
            query_embeddings: Dict containing query embeddings
            candidate_list: List of dicts containing candidate embeddings
            **similarity_kwargs: Arguments for hybrid_similarity
            
        Returns:
            List of similarity scores
        """
        try:
            similarities = []
            
            for candidate in candidate_list:
                similarity = self.hybrid_similarity(
                    query_image=query_embeddings.get('image_embedding'),
                    query_text_clip=query_embeddings.get('text_clip_embedding'),
                    query_text_sentence=query_embeddings.get('text_sentence_embedding'),
                    candidate_image=candidate.get('image_embedding'),
                    candidate_text_clip=candidate.get('text_clip_embedding'),
                    candidate_text_sentence=candidate.get('text_sentence_embedding'),
                    **similarity_kwargs
                )
                similarities.append(similarity)
            
            return similarities
            
        except Exception as e:
            logger.error(f"Error in batch hybrid similarity: {str(e)}")
            return [0.0] * len(candidate_list)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get comprehensive information about loaded models"""
        try:
            memory_info = self._get_memory_info()
            
            info = {
                "device": self.device,
                "models_loaded": self.models_loaded,
                "clip": {
                    "ready": self.clip_ready,
                    "model_name": self.clip_model_name,
                    "dimension": self.clip_dim,
                    "device": self.device
                },
                "sentence_transformer": {
                    "ready": self.sentence_ready,
                    "model_name": self.sentence_model_name,
                    "dimension": self.sentence_dim,
                    "max_seq_length": getattr(self.sentence_model, 'max_seq_length', 'unknown') if self.sentence_ready else 'unknown'
                },
                "performance": {
                    "max_batch_size": self.max_batch_size,
                    "cache_size": len(self.similarity_cache),
                    "cache_max_size": self.cache_max_size
                },
                "memory": memory_info,
                "timestamp": datetime.now().isoformat()
            }
            
            # Add model file info if available
            model_files_info = self._get_model_files_info()
            if model_files_info:
                info["model_files"] = model_files_info
            
            return info
            
        except Exception as e:
            logger.error(f"Error getting model info: {str(e)}")
            return {"error": str(e)}
    
    def clear_cache(self):
        """Clear similarity cache untuk memory management"""
        try:
            cache_size = len(self.similarity_cache)
            self.similarity_cache.clear()
            
            # Force garbage collection
            gc.collect()
            
            logger.info(f"🧹 Cache cleared: {cache_size} entries removed")
            
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
    
    def optimize_memory(self):
        """Optimize memory usage"""
        try:
            # Clear cache if getting too large
            if len(self.similarity_cache) > self.cache_max_size * 0.8:
                self.clear_cache()
            
            # Force garbage collection
            gc.collect()
            
            # Clear GPU cache if using CUDA
            if self.device == "cuda" and torch.cuda.is_available():
                torch.cuda.empty_cache()
                
            memory_info = self._get_memory_info()
            logger.info(f"🔧 Memory optimized: {memory_info}")
            
        except Exception as e:
            logger.error(f"Error optimizing memory: {str(e)}")
    
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check untuk monitoring"""
        try:
            health = {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "models": {
                    "clip": {"status": "ready" if self.clip_ready else "not_ready"},
                    "sentence_transformer": {"status": "ready" if self.sentence_ready else "not_ready"}
                },
                "memory": self._get_memory_info(),
                "performance": {
                    "cache_usage": f"{len(self.similarity_cache)}/{self.cache_max_size}",
                    "device": self.device
                },
                "issues": []
            }
            
            # Check for potential issues
            if not self.models_loaded:
                health["status"] = "degraded"
                health["issues"].append("Not all models loaded")
            
            memory_info = health["memory"]
            if "percent" in memory_info and memory_info["percent"] > 90:
                health["status"] = "degraded"
                health["issues"].append("High memory usage")
            
            if len(self.similarity_cache) >= self.cache_max_size:
                health["issues"].append("Cache full")
            
            return health
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def cleanup(self):
        """Cleanup resources saat shutdown"""
        try:
            logger.info("🔄 Cleaning up ModelManager...")
            
            # Clear cache
            self.clear_cache()
            
            # Delete models
            if self.clip_model:
                del self.clip_model
                del self.clip_preprocess
                self.clip_model = None
                self.clip_preprocess = None
                self.clip_ready = False
                
            if self.sentence_model:
                del self.sentence_model
                self.sentence_model = None
                self.sentence_ready = False
            
            # Shutdown executor
            if self.executor:
                self.executor.shutdown(wait=True)
            
            # Clear GPU memory
            if self.device == "cuda" and torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            # Force garbage collection
            gc.collect()
            
            self.models_loaded = False
            logger.info("✅ ModelManager cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")
    
    # Private helper methods
    
    def _get_memory_info(self) -> Dict[str, Any]:
        """Get current memory usage information"""
        try:
            memory_info = {}
            
            if self.device == "cuda" and torch.cuda.is_available():
                # GPU memory info
                memory_info.update({
                    "gpu_allocated": f"{torch.cuda.memory_allocated() / 1024**3:.2f} GB",
                    "gpu_reserved": f"{torch.cuda.memory_reserved() / 1024**3:.2f} GB",
                    "gpu_total": f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB"
                })
            
            # System memory info (if psutil available)
            try:
                import psutil
                memory = psutil.virtual_memory()
                memory_info.update({
                    "system_total": f"{memory.total / 1024**3:.2f} GB",
                    "system_available": f"{memory.available / 1024**3:.2f} GB",
                    "system_used": f"{memory.used / 1024**3:.2f} GB",
                    "percent": memory.percent
                })
            except ImportError:
                memory_info["note"] = "psutil not available for system memory info"
            
            return memory_info
            
        except Exception as e:
            return {"error": str(e)}
    
    def _save_model_info(self, model_type: str, info: Dict[str, Any]):
        """Save model information to file untuk debugging"""
        try:
            os.makedirs("app/models", exist_ok=True)
            
            info_file = f"app/models/{model_type}_info.json"
            with open(info_file, 'w') as f:
                json.dump(info, f, indent=2, default=str)
                
            logger.debug(f"Model info saved: {info_file}")
            
        except Exception as e:
            logger.warning(f"Could not save model info: {str(e)}")
    
    def _get_model_files_info(self) -> Dict[str, Any]:
        """Get information about model files"""
        try:
            model_files = {}
            model_dir = "app/models"
            
            if os.path.exists(model_dir):
                for file in os.listdir(model_dir):
                    if file.endswith(('.json', '.pth', '.pkl')):
                        file_path = os.path.join(model_dir, file)
                        stat = os.stat(file_path)
                        model_files[file] = {
                            "size_mb": round(stat.st_size / (1024 * 1024), 2),
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                        }
            
            return model_files
            
        except Exception as e:
            logger.warning(f"Could not get model files info: {str(e)}")
            return {}
    
    def _check_memory_usage(self) -> bool:
        """Check if memory usage is within acceptable limits"""
        try:
            if self.device == "cuda" and torch.cuda.is_available():
                # Check GPU memory
                allocated = torch.cuda.memory_allocated()
                total = torch.cuda.get_device_properties(0).total_memory
                usage_ratio = allocated / total
                
                if usage_ratio > self.memory_threshold:
                    logger.warning(f"High GPU memory usage: {usage_ratio:.2%}")
                    return False
            
            # Check system memory if available
            try:
                import psutil
                memory = psutil.virtual_memory()
                if memory.percent > (self.memory_threshold * 100):
                    logger.warning(f"High system memory usage: {memory.percent:.1f}%")
                    return False
            except ImportError:
                pass
            
            return True
            
        except Exception as e:
            logger.warning(f"Could not check memory usage: {str(e)}")
            return True
    
    def get_embedding_stats(self, embeddings: List[np.ndarray]) -> Dict[str, Any]:
        """Get statistical information about embeddings"""
        try:
            if not embeddings:
                return {"error": "No embeddings provided"}
            
            # Convert to numpy array untuk statistical analysis
            embedding_matrix = np.array(embeddings)
            
            stats = {
                "count": len(embeddings),
                "dimension": embeddings[0].shape[0],
                "mean_norm": float(np.mean([np.linalg.norm(emb) for emb in embeddings])),
                "std_norm": float(np.std([np.linalg.norm(emb) for emb in embeddings])),
                "min_norm": float(np.min([np.linalg.norm(emb) for emb in embeddings])),
                "max_norm": float(np.max([np.linalg.norm(emb) for emb in embeddings]))
            }
            
            # Calculate pairwise similarities untuk distribution analysis
            if len(embeddings) > 1 and len(embeddings) <= 100:  # Limit untuk performance
                similarities = []
                for i in range(len(embeddings)):
                    for j in range(i + 1, len(embeddings)):
                        sim = self.calculate_similarity(embeddings[i], embeddings[j])
                        similarities.append(sim)
                
                if similarities:
                    stats["similarity_stats"] = {
                        "mean": float(np.mean(similarities)),
                        "std": float(np.std(similarities)),
                        "min": float(np.min(similarities)),
                        "max": float(np.max(similarities))
                    }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating embedding stats: {str(e)}")
            return {"error": str(e)}
    
    def create_embedding_index(self, embeddings: List[np.ndarray], 
                             metadata: List[Dict] = None) -> Dict[str, Any]:
        """
        Create an efficient index untuk fast similarity search
        Useful untuk large-scale matching operations
        """
        try:
            if not embeddings:
                return {"error": "No embeddings provided"}
            
            # Convert embeddings to matrix
            embedding_matrix = np.array(embeddings).astype(np.float32)
            
            # Normalize embeddings untuk cosine similarity
            norms = np.linalg.norm(embedding_matrix, axis=1, keepdims=True)
            normalized_matrix = embedding_matrix / np.maximum(norms, 1e-8)
            
            index = {
                "embeddings": normalized_matrix,
                "metadata": metadata or [{}] * len(embeddings),
                "dimension": embedding_matrix.shape[1],
                "count": len(embeddings),
                "created_at": datetime.now().isoformat(),
                "stats": self.get_embedding_stats(embeddings)
            }
            
            logger.info(f"Created embedding index: {len(embeddings)} embeddings, dim {embedding_matrix.shape[1]}")
            return index
            
        except Exception as e:
            logger.error(f"Error creating embedding index: {str(e)}")
            return {"error": str(e)}
    
    def search_embedding_index(self, query_embedding: np.ndarray, 
                             index: Dict[str, Any],
                             top_k: int = 10,
                             threshold: float = 0.0) -> List[Dict[str, Any]]:
        """
        Search dalam embedding index untuk fast similarity search
        
        Args:
            query_embedding: Query embedding
            index: Embedding index dari create_embedding_index
            top_k: Number of top results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of matches dengan similarity scores dan metadata
        """
        try:
            if "embeddings" not in index:
                return []
            
            # Normalize query embedding
            query_norm = np.linalg.norm(query_embedding)
            if query_norm == 0:
                return []
            
            normalized_query = query_embedding / query_norm
            
            # Efficient batch similarity calculation using matrix multiplication
            embeddings_matrix = index["embeddings"]
            similarities = np.dot(embeddings_matrix, normalized_query)
            
            # Find indices above threshold
            valid_indices = np.where(similarities >= threshold)[0]
            
            if len(valid_indices) == 0:
                return []
            
            # Get top-k indices
            valid_similarities = similarities[valid_indices]
            top_indices = valid_indices[np.argsort(valid_similarities)[::-1][:top_k]]
            
            # Prepare results
            results = []
            for idx in top_indices:
                result = {
                    "index": int(idx),
                    "similarity": float(similarities[idx]),
                    "metadata": index["metadata"][idx] if idx < len(index["metadata"]) else {}
                }
                results.append(result)
            
            logger.debug(f"Index search found {len(results)} matches above threshold {threshold}")
            return results
            
        except Exception as e:
            logger.error(f"Error searching embedding index: {str(e)}")
            return []
    
    def benchmark_performance(self, num_samples: int = 100) -> Dict[str, Any]:
        """
        Benchmark model performance untuk optimization
        
        Args:
            num_samples: Number of samples untuk testing
            
        Returns:
            Dict dengan performance metrics
        """
        try:
            import time
            
            results = {
                "timestamp": datetime.now().isoformat(),
                "num_samples": num_samples,
                "device": self.device,
                "benchmarks": {}
            }
            
            # Test image encoding performance
            if self.clip_ready:
                logger.info("Benchmarking image encoding...")
                dummy_image = Image.new('RGB', (224, 224), color='red')
                
                start_time = time.time()
                for _ in range(num_samples):
                    self.encode_image(dummy_image)
                end_time = time.time()
                
                results["benchmarks"]["image_encoding"] = {
                    "total_time": end_time - start_time,
                    "avg_time_per_sample": (end_time - start_time) / num_samples,
                    "samples_per_second": num_samples / (end_time - start_time)
                }
            
            # Test text encoding performance (CLIP)
            if self.clip_ready:
                logger.info("Benchmarking CLIP text encoding...")
                test_text = "dompet kulit hitam dengan kartu mahasiswa"
                
                start_time = time.time()
                for _ in range(num_samples):
                    self.encode_text_clip(test_text)
                end_time = time.time()
                
                results["benchmarks"]["text_clip_encoding"] = {
                    "total_time": end_time - start_time,
                    "avg_time_per_sample": (end_time - start_time) / num_samples,
                    "samples_per_second": num_samples / (end_time - start_time)
                }
            
            # Test text encoding performance (Sentence Transformer)
            if self.sentence_ready:
                logger.info("Benchmarking Sentence Transformer encoding...")
                test_text = "tas laptop warna biru merk adidas"
                
                start_time = time.time()
                for _ in range(num_samples):
                    self.encode_text_sentence(test_text)
                end_time = time.time()
                
                results["benchmarks"]["text_sentence_encoding"] = {
                    "total_time": end_time - start_time,
                    "avg_time_per_sample": (end_time - start_time) / num_samples,
                    "samples_per_second": num_samples / (end_time - start_time)
                }
            
            # Test similarity calculation performance
            if self.clip_ready:
                logger.info("Benchmarking similarity calculation...")
                emb1 = np.random.random(self.clip_dim).astype(np.float32)
                emb2 = np.random.random(self.clip_dim).astype(np.float32)
                
                start_time = time.time()
                for _ in range(num_samples * 10):  # Similarity is much faster
                    self.calculate_similarity(emb1, emb2)
                end_time = time.time()
                
                results["benchmarks"]["similarity_calculation"] = {
                    "total_time": end_time - start_time,
                    "avg_time_per_sample": (end_time - start_time) / (num_samples * 10),
                    "samples_per_second": (num_samples * 10) / (end_time - start_time)
                }
            
            logger.info("Performance benchmarking completed")
            return results
            
        except Exception as e:
            logger.error(f"Error during performance benchmarking: {str(e)}")
            return {"error": str(e)}
    
    def export_embeddings(self, embeddings_dict: Dict[str, Dict], 
                         output_file: str = "embeddings_export.pkl") -> bool:
        """
        Export embeddings to file untuk backup atau analysis
        
        Args:
            embeddings_dict: Dict containing embeddings dan metadata
            output_file: Output file path
            
        Returns:
            bool: Success status
        """
        try:
            os.makedirs("app/embeddings", exist_ok=True)
            output_path = os.path.join("app/embeddings", output_file)
            
            # Prepare export data
            export_data = {
                "timestamp": datetime.now().isoformat(),
                "model_info": {
                    "clip_model": self.clip_model_name,
                    "clip_dim": self.clip_dim,
                    "sentence_model": self.sentence_model_name,
                    "sentence_dim": self.sentence_dim
                },
                "embeddings": embeddings_dict,
                "count": len(embeddings_dict)
            }
            
            # Save to pickle file
            with open(output_path, 'wb') as f:
                pickle.dump(export_data, f)
            
            file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
            logger.info(f"✅ Exported {len(embeddings_dict)} embeddings to {output_path} ({file_size:.2f} MB)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error exporting embeddings: {str(e)}")
            return False
    
    def import_embeddings(self, input_file: str = "embeddings_export.pkl") -> Optional[Dict]:
        """
        Import embeddings from file
        
        Args:
            input_file: Input file path
            
        Returns:
            Dict containing imported embeddings atau None jika gagal
        """
        try:
            input_path = os.path.join("app/embeddings", input_file)
            
            if not os.path.exists(input_path):
                logger.error(f"Import file not found: {input_path}")
                return None
            
            # Load from pickle file
            with open(input_path, 'rb') as f:
                import_data = pickle.load(f)
            
            # Validate import data
            if "embeddings" not in import_data:
                logger.error("Invalid import file format")
                return None
            
            embeddings_count = len(import_data["embeddings"])
            logger.info(f"✅ Imported {embeddings_count} embeddings from {input_path}")
            
            return import_data
            
        except Exception as e:
            logger.error(f"Error importing embeddings: {str(e)}")
            return None
    
    def __repr__(self) -> str:
        """String representation untuk debugging"""
        return (f"ModelManager(device={self.device}, "
                f"clip_ready={self.clip_ready}, "
                f"sentence_ready={self.sentence_ready}, "
                f"models_loaded={self.models_loaded})")
    
    def __del__(self):
        """Destructor untuk automatic cleanup"""
        try:
            if hasattr(self, 'models_loaded') and self.models_loaded:
                self.cleanup()
        except:
            pass  # Ignore errors during destruction