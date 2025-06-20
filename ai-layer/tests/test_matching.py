import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_embedding_generation():
    # Test text embedding
    text_data = {
        "text": "Laptop ASUS ROG dengan stiker kampus",
        "item_id": "test_item_1"
    }
    response = requests.post(f"{BASE_URL}/embeddings/text", json=text_data)
    assert response.status_code == 200
    assert response.json()["success"] == True
    
    # Test image embedding
    image_data = {
        "image_url": "https://images.unsplash.com/photo-1588702547923-7093a6c3ba33",
        "item_id": "test_item_1"
    }
    response = requests.post(f"{BASE_URL}/embeddings/image", json=image_data)
    assert response.status_code == 200
    assert response.json()["success"] == True

def test_matching():
    # Create a lost item
    lost_item = {
        "item_id": "lost_test_1",
        "item_name": "Laptop Asus ROG",
        "description": "Laptop gaming warna hitam dengan stiker kampus",
        "image_urls": ["https://images.unsplash.com/photo-1588702547923-7093a6c3ba33"],
        "collection": "found_items"
    }
    response = requests.post(f"{BASE_URL}/match/instant", json=lost_item)
    assert response.status_code == 200
    assert "matches" in response.json()["data"]

if __name__ == "__main__":
    print("Running tests...")
    test_health()
    print("✅ Health check passed")
    test_embedding_generation()
    print("✅ Embedding generation passed")
    test_matching()
    print("✅ Matching passed")
    print("All tests passed!")