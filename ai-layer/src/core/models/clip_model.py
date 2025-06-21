import torch
from PIL import Image
import numpy as np
from transformers import CLIPProcessor, CLIPModel
from src.utils.image_processing import process_image_with_object_detection
from src.utils.augmentation import generate_augmented_images


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
        
    def get_image_embedding(self, image):
        try:
            if isinstance(image, str):
                image = Image.open(image).convert('RGB')
            elif isinstance(image, bytes):
                image = Image.open(BytesIO(image)).convert('RGB')
            
            # Gunakan preprocessing dengan deteksi objek
            processed_image = process_image_with_object_detection(image)
            
            # Lanjutkan dengan pembuatan embeddings seperti biasa
            inputs = self.processor(images=processed_image, return_tensors="pt").to(self.device)
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
            # Preprocessing teks untuk memastikan konsistensi
            if isinstance(text, str):
                # Batasi panjang teks untuk konsistensi
                max_tokens = 77  # Batas token CLIP
                tokens = text.split()
                if len(tokens) > max_tokens:
                    text = " ".join(tokens[:max_tokens])
                
            # Proses dengan CLIP model
            inputs = self.processor(text=text, return_tensors="pt", padding=True, truncation=True, max_length=77).to(self.device)
            with torch.no_grad():
                text_features = self.model.get_text_features(**inputs)
            
            # Normalize features
            text_embedding = text_features / text_features.norm(dim=1, keepdim=True)
            return text_embedding.cpu().numpy()[0]
        
        except Exception as e:
            print(f"Error generating text embedding: {e}")
            # Return zero vector dengan dimensi yang benar jika error
            return np.zeros(512)  # CLIP biasanya menghasilkan vektor 512 dimensi
        
    # Hasilkan embedding dengan augmentasi dan rata-rata hasilnya
    def get_image_embedding_with_augmentation(self, image, num_augmentations=3):
        try:
            if isinstance(image, str):
                image = Image.open(image).convert('RGB')
            elif isinstance(image, bytes):
                image = Image.open(BytesIO(image)).convert('RGB')
                        # Import fungsi augmentasi    
            
            # Hasilkan beberapa versi augmentasi
            augmented_images = generate_augmented_images(image, num_augmentations)
            all_embeddings = []
            
            # Hasilkan embedding untuk setiap versi
            for aug_image in augmented_images:
                # Preprocess
                processed_image = process_image_with_object_detection(aug_image)
                
                # Generate embedding
                inputs = self.processor(images=processed_image, return_tensors="pt").to(self.device)
                with torch.no_grad():
                    image_features = self.model.get_image_features(**inputs)
                
                # Normalize
                embedding = image_features / image_features.norm(dim=1, keepdim=True)
                all_embeddings.append(embedding.cpu().numpy()[0])
            
            # Rata-rata semua embeddings untuk mendapatkan representasi robust
            avg_embedding = np.mean(all_embeddings, axis=0)
            
            # Normalize hasil akhir
            avg_embedding = avg_embedding / np.linalg.norm(avg_embedding)
            
            return avg_embedding
            
        except Exception as e:
            print(f"Error generating image embedding with augmentation: {e}")
            raise
        
    # Calculate cosine similarity between two embeddings
    def calculate_similarity(self, embedding1, embedding2):
        return np.dot(embedding1, embedding2)