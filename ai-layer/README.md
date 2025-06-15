# UNY Lost AI Layer

AI-powered matching service untuk sistem lost and found UNY menggunakan **CLIP + Sentence Transformer** untuk multimodal matching.

## 🎯 Features

- **🎯 CLIP Model**: Multimodal matching (image + text)
- **📝 Sentence Transformer**: Semantic text matching bahasa Indonesia
- **🔥 Firebase Integration**: Real-time data storage
- **📂 Google Drive Storage**: Image storage dengan optimasi
- **⚡ FastAPI**: High-performance async API
- **🔄 Background Matching**: Automated matching service
- **📊 Health Monitoring**: Comprehensive status monitoring

## 🏗️ Architecture

```
📱 Mobile App/Backend
    ↕️ HTTP API
🤖 AI Layer (FastAPI)
    ├── CLIP Model (Image + Text)
    ├── Sentence Transformer (Text Semantic)
    ├── Firebase (Embeddings Storage)
    └── Google Drive (Image Storage)
```

## 🚀 Installation & Setup

### 1. Clone & Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd ai-layer

# Buat virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
source venv/Scripts/activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Setup Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database
3. Download Service Account Key:
   - Project Settings → Service Accounts
   - Generate new private key
   - Save sebagai `firebase_key/serviceAccountKey.json`

### 3. Setup Google Drive (Optional)

1. Gunakan service account key yang sama
2. Buat folder di Google Drive untuk storage
3. Copy folder ID dan set di environment variable

### 4. Initialize Models

```bash
# Download dan setup AI models
python init_models.py
```

### 5. Run Application

```bash
# Development mode
python run.py

# Production mode
python run.py --prod --host 0.0.0.0 --port 8000

# Custom host/port
python run.py --host 127.0.0.1 --port 8080
```

## 📝 API Documentation

### Base URL

```
http://localhost:8000
```

### Health Check

```bash
GET /health/status       # Comprehensive health check
GET /health/models       # AI models status
GET /health/firebase     # Firebase connection status
GET /health/system       # System resources
GET /ping               # Simple ping
```

### Matching Services

```bash
POST /match/instant      # Instant matching untuk new items
POST /match/background   # Background matching service
POST /match/similarity   # Calculate similarity between items
GET  /match/stats       # Matching statistics
```

### Example: Instant Matching

```bash
curl -X POST "http://localhost:8000/match/instant" \
  -F "file=@image.jpg" \
  -F "item_name=Dompet Hitam" \
  -F "description=Dompet kulit hitam dengan kartu mahasiswa" \
  -F "category=Dompet/Tas" \
  -F "collection=found_items" \
  -F "threshold=0.75"
```

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase_key/serviceAccountKey.json

# Backend Integration
BACKEND_URL=http://localhost:5000
WEBHOOK_SECRET=your_webhook_secret

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_folder_id

# Model Settings
CLIP_MODEL=ViT-B/32
SENTENCE_MODEL=paraphrase-multilingual-MiniLM-L12-v2
DEFAULT_SIMILARITY_THRESHOLD=0.75

# Server Settings
HOST=127.0.0.1
PORT=8000
DEBUG=True
```

## 📊 Model Performance

### CLIP Model (ViT-B/32)

- **Dimension**: 512
- **Use Case**: Image encoding, cross-modal matching
- **Strengths**: Visual similarity, text-to-image search

### Sentence Transformer (Multilingual MiniLM)

- **Dimension**: 384
- **Use Case**: Semantic text matching
- **Strengths**: Bahasa Indonesia support, contextual understanding

### Hybrid Matching

- **Image Weight**: 40%
- **Text CLIP Weight**: 30%
- **Text Semantic Weight**: 30%
- **Cross-modal**: Automatic detection

## 🔄 Integration dengan Backend

### Webhook Flow

```
1. Backend → POST /match/instant (new found item)
2. AI Layer → Generate embeddings + find matches
3. AI Layer → Return matches to backend
4. Backend → Send WhatsApp notifications (if similarity > 75%)
```

### Background Service

```
1. Cron job → POST /match/background (every 2 hours)
2. AI Layer → Process all active lost items
3. AI Layer → Save matches to Firebase
4. Backend → Poll Firebase for new matches
5. Backend → Send notifications
```

## 📁 Project Structure

```
ai-layer/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── health.py              # Health check endpoints
│   │   └── matching.py            # Matching endpoints
│   └── services/
│       ├── __init__.py
│       ├── model_manager.py       # AI models management
│       ├── firebase_client.py     # Firebase operations
│       └── google_drive.py        # Google Drive storage
├── firebase_key/
│   └── serviceAccountKey.json     # Firebase credentials
├── temp_images/                   # Temporary image storage
├── logs/                          # Application logs
├── requirements.txt               # Python dependencies
├── init_models.py                 # Model initialization
├── run.py                         # Application runner
└── README.md
```

## 🐛 Troubleshooting

### Model Loading Issues

```bash
# Re-initialize models
python init_models.py

# Check CUDA availability
python -c "import torch; print(torch.cuda.is_available())"

# Clear cache
rm -rf app/models/*
python init_models.py
```

### Firebase Connection Issues

```bash
# Verify credentials file
ls -la firebase_key/serviceAccountKey.json

# Test connection
curl http://localhost:8000/health/firebase
```

### Performance Issues

```bash
# Check system resources
curl http://localhost:8000/health/system

# Monitor GPU usage
nvidia-smi  # If CUDA available

# Check memory usage
curl http://localhost:8000/health/status
```

## 📈 Monitoring & Logs

### Health Monitoring

- **Comprehensive**: `/health/status`
- **Models**: `/health/models`
- **Firebase**: `/health/firebase`
- **System**: `/health/system`

### Logging Levels

- **INFO**: General operations
- **WARNING**: Non-critical issues
- **ERROR**: Critical failures
- **DEBUG**: Detailed debugging info

## 🔧 Development

### Adding New Models

1. Update `model_manager.py`
2. Add loading logic in `_load_new_model()`
3. Implement encoding methods
4. Update health checks

### Adding New Endpoints

1. Create router in `app/routers/`
2. Add business logic in `app/services/`
3. Update `main.py` to include router
4. Add tests and documentation

## 📋 Requirements

### Minimum System Requirements

- **Python**: 3.8+
- **RAM**: 4GB (CPU mode), 8GB+ (GPU mode)
- **Storage**: 5GB for models
- **CPU**: 4 cores recommended

### Recommended for Production

- **RAM**: 16GB+
- **GPU**: NVIDIA with 6GB+ VRAM
- **Storage**: SSD recommended
- **Network**: Stable internet for model downloads

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📞 Support

- **Documentation**: Check `/docs` endpoint when running
- **Issues**: Create GitHub issue
- **Discord**: Join development server
