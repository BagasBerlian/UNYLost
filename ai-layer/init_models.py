import os
import sys
import logging
import torch
import clip
from sentence_transformers import SentenceTransformer
import nltk
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("init_models")

def ensure_directories():
    """Pastikan semua direktori yang dibutuhkan tersedia"""
    directories = [
        "app/models",
        "app/embeddings", 
        "temp_images",
        "firebase_key",
        "logs"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"✓ Direktori {directory} tersedia")

def check_device():
    """Cek device yang tersedia (CPU/CUDA)"""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"🖥️  Device yang digunakan: {device}")
    
    if device == "cuda":
        gpu_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"🎮 GPU: {gpu_name} ({gpu_count} device)")
    else:
        logger.info("💻 Menggunakan CPU - untuk local development sudah cukup")
    
    return device

def init_clip_model(device):
    """Inisialisasi CLIP model untuk multimodal matching"""
    logger.info("🎯 Menginisialisasi CLIP model...")
    
    try:
        # Download CLIP model (ViT-B/32 - balance antara akurasi dan speed)
        model, preprocess = clip.load("ViT-B/32", device=device)
        
        # Test dengan dummy data
        from PIL import Image
        
        # Test image processing
        dummy_image = Image.new('RGB', (224, 224), color='white')
        image_input = preprocess(dummy_image).unsqueeze(0).to(device)
        
        # Test text processing  
        text_input = clip.tokenize(["test dompet hitam"]).to(device)
        
        with torch.no_grad():
            image_features = model.encode_image(image_input)
            text_features = model.encode_text(text_input)
            
        logger.info(f"✓ CLIP model berhasil dimuat")
        logger.info(f"  - Image features shape: {image_features.shape}")
        logger.info(f"  - Text features shape: {text_features.shape}")
        
        # Simpan info model
        torch.save({
            'model_name': 'ViT-B/32',
            'device': device,
            'feature_dim': image_features.shape[1]
        }, "app/models/clip_model_info.pth")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error inisialisasi CLIP: {str(e)}")
        return False

def init_sentence_transformer():
    """Inisialisasi Sentence Transformer untuk semantic text matching"""
    logger.info("📝 Menginisialisasi Sentence Transformer...")
    
    try:
        # Model yang bagus untuk bahasa Indonesia
        model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        
        # Download model
        model = SentenceTransformer(model_name)
        
        # Test dengan kalimat bahasa Indonesia
        test_sentences = [
            "dompet kulit hitam dengan kartu mahasiswa",
            "tas laptop warna biru merk adidas", 
            "kunci motor honda dengan gantungan doraemon"
        ]
        
        # Test encoding
        embeddings = model.encode(test_sentences)
        
        logger.info(f"✓ Sentence Transformer berhasil dimuat")
        logger.info(f"  - Model: {model_name}")
        logger.info(f"  - Embedding dimension: {embeddings.shape[1]}")
        logger.info(f"  - Test embeddings shape: {embeddings.shape}")
        
        # Simpan model info
        import json
        model_info = {
            'model_name': model_name,
            'embedding_dim': int(embeddings.shape[1]),
            'max_seq_length': model.max_seq_length
        }
        
        with open("app/models/sentence_transformer_info.json", "w") as f:
            json.dump(model_info, f, indent=2)
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Error inisialisasi Sentence Transformer: {str(e)}")
        return False

def init_nltk_data():
    """Download NLTK data yang dibutuhkan"""
    logger.info("📚 Mendownload NLTK data...")
    
    nltk_downloads = [
        'punkt',
        'stopwords', 
        'wordnet',
        'averaged_perceptron_tagger'
    ]
    
    for item in nltk_downloads:
        try:
            nltk.download(item, quiet=True)
            logger.info(f"✓ NLTK {item} downloaded")
        except:
            logger.warning(f"⚠️  NLTK {item} download failed (mungkin sudah ada)")

def check_firebase_key():
    """Cek apakah Firebase service account key tersedia"""
    key_path = "firebase_key/serviceAccountKey.json"
    
    if os.path.exists(key_path):
        logger.info("✓ Firebase service account key ditemukan")
        return True
    else:
        logger.warning("⚠️  Firebase service account key tidak ditemukan")
        logger.warning(f"   Letakkan file di: {key_path}")
        logger.warning("   Download dari: Firebase Console > Project Settings > Service Accounts")
        return False

def create_env_template():
    """Buat template file .env"""
    env_template = """# UNY Lost AI Layer Environment Variables

# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase_key/serviceAccountKey.json

# Backend Integration
BACKEND_URL=http://localhost:5000
WEBHOOK_SECRET=your_webhook_secret_here

# Google Drive (untuk storage gambar)
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id

# Model Settings
CLIP_MODEL=ViT-B/32
SENTENCE_MODEL=paraphrase-multilingual-MiniLM-L12-v2
DEFAULT_SIMILARITY_THRESHOLD=0.75

# Server Settings
HOST=127.0.0.1
PORT=8000
DEBUG=True
"""
    
    if not os.path.exists(".env"):
        with open(".env", "w") as f:
            f.write(env_template)
        logger.info("✓ Template .env file created")
    else:
        logger.info("✓ .env file sudah ada")

def main():
    """Main initialization process"""
    logger.info("🚀 Memulai inisialisasi UNY Lost AI Layer...")
    
    try:
        # 1. Setup directories
        ensure_directories()
        
        # 2. Check device
        device = check_device()
        
        # 3. Initialize models
        logger.info("\n📦 Mendownload dan menginisialisasi AI models...")
        
        clip_success = init_clip_model(device)
        sentence_success = init_sentence_transformer()
        
        # 4. Download NLTK data
        init_nltk_data()
        
        # 5. Check Firebase
        firebase_ready = check_firebase_key()
        
        # 6. Create .env template
        create_env_template()
        
        # Summary
        logger.info("\n📊 RINGKASAN INISIALISASI:")
        logger.info(f"✓ CLIP Model: {'✅ READY' if clip_success else '❌ FAILED'}")
        logger.info(f"✓ Sentence Transformer: {'✅ READY' if sentence_success else '❌ FAILED'}")
        logger.info(f"✓ Firebase Key: {'✅ READY' if firebase_ready else '⚠️  MISSING'}")
        logger.info(f"✓ Device: {device.upper()}")
        
        if clip_success and sentence_success:
            logger.info("\n🎉 INISIALISASI BERHASIL!")
            logger.info("   Anda sudah bisa menjalankan: python run.py")
            
            if not firebase_ready:
                logger.info("\n⚠️  CATATAN: Firebase service account key belum ada")
                logger.info("   AI matching tetap bisa jalan, tapi data tidak tersimpan")
                
        else:
            logger.error("\n❌ INISIALISASI GAGAL!")
            logger.error("   Cek koneksi internet dan jalankan ulang")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"❌ Error during initialization: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)