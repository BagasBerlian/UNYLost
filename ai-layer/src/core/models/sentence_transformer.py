import torch
import numpy as np
from sentence_transformers import SentenceTransformer

class SentenceTransformerModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SentenceTransformerModel, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.device = "cuda" if torch.cuda.is_available() else "cpu"
            cls._instance._load_model()
        return cls._instance
    
    # Load the Sentence Transformer model
    def _load_model(self):
        try:
            print(f"Loading Sentence Transformer model on {self.device}...")
            self.model = SentenceTransformer('all-MiniLM-L6-v2', device=self.device)
            print("Sentence Transformer model loaded successfully")
        except Exception as e:
            print(f"Error loading Sentence Transformer model: {e}")
            raise
    
    # Generate embedding for text using Sentence Transformer
    def get_text_embedding(self, text):
        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            embedding = embedding / np.linalg.norm(embedding)
            return embedding
        except Exception as e:
            print(f"Error generating text embedding: {e}")
            raise
    
    # Calculate cosine similarity between two embeddings
    def calculate_similarity(self, embedding1, embedding2):
        return np.dot(embedding1, embedding2)