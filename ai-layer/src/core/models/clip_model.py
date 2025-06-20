import torch
from PIL import Image
import numpy as np
from transformers import CLIPProcessor, CLIPModel

class ClipModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ClipModel, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.processor = None
            cls._instance.device = "cuda" if torch.cuda.is_available() else "cpu"
            cls._instance._load_model()
        return cls._instance
    
    # Load Model and Processor
    def _load_model(self):
        try:
            print(f"Loading CLIP model on {self.device}...")
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(self.device)
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            print("CLIP model loaded successfully")
        except Exception as e:
            print(f"Error loading CLIP model: {e}")
            raise
        
    # Generate embedding for an image using CLIP
    def get_image_embedding(self, image):
        try:
            if isinstance(image, str):
                image = Image.open(image).convert('RGB')
            elif isinstance(image, bytes):
                image = Image.open(BytesIO(image)).convert('RGB')
            
            inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
            
            # Normalize features
            image_embedding = image_features / image_features.norm(dim=1, keepdim=True)
            return image_embedding.cpu().numpy()[0]
        
        except Exception as e:
            print(f"Error generating image embedding: {e}")
            raise
    
    # Generate embedding for text using CLIP
    def get_text_embedding(self, text):
        try:
            inputs = self.processor(text=text, return_tensors="pt", padding=True).to(self.device)
            with torch.no_grad():
                text_features = self.model.get_text_features(**inputs)
            
            # Normalize features
            text_embedding = text_features / text_features.norm(dim=1, keepdim=True)
            return text_embedding.cpu().numpy()[0]
        
        except Exception as e:
            print(f"Error generating text embedding: {e}")
            raise
        
    # Calculate cosine similarity between two embeddings
    def calculate_similarity(self, embedding1, embedding2):
        return np.dot(embedding1, embedding2)