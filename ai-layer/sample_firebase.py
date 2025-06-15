#!/usr/bin/env python3
"""
Populate Sample Data untuk UNY Lost AI Layer
Script untuk mengisi Firebase dengan sample data lost & found items
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
import uuid
from PIL import Image
import numpy as np

# Add app directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.firebase_client import FirebaseClient
from app.services.model_manager import ModelManager

# Sample data untuk testing
SAMPLE_LOST_ITEMS = [
    {
        "item_name": "Dompet Kulit Hitam",
        "description": "Dompet kulit hitam dengan kartu mahasiswa UNY, SIM, dan uang cash sekitar 100ribu",
        "category": "Dompet/Tas",
        "last_seen_location": "Kantin FMIPA",
        "date_lost": "2025-06-10",
        "reward": "50000",
        "owner_contact": "+6281234567890",
        "status": "active"
    },
    {
        "item_name": "Tas Laptop Adidas",
        "description": "Tas laptop warna biru merk Adidas, berisi laptop ASUS dan charger",
        "category": "Tas/Ransel",
        "last_seen_location": "Perpustakaan Pusat Lt.3",
        "date_lost": "2025-06-12",
        "reward": "100000",
        "owner_contact": "+6282345678901",
        "status": "active"
    },
    {
        "item_name": "Kunci Motor Honda",
        "description": "Kunci motor Honda Vario dengan gantungan doraemon biru",
        "category": "Kendaraan",
        "last_seen_location": "Parkiran Motor Gedung LPTIK",
        "date_lost": "2025-06-13",
        "reward": "25000",
        "owner_contact": "+6283456789012",
        "status": "active"
    },
    {
        "item_name": "HP Samsung Galaxy",
        "description": "Handphone Samsung Galaxy A54 warna hitam dengan case bening",
        "category": "Elektronik",
        "last_seen_location": "Ruang Kelas C102 FMIPA",
        "date_lost": "2025-06-14",
        "reward": "200000",
        "owner_contact": "+6284567890123",
        "status": "active"
    },
    {
        "item_name": "Jam Tangan Casio",
        "description": "Jam tangan Casio G-Shock warna hitam dengan tali karet",
        "category": "Aksesoris",
        "last_seen_location": "Lapangan Basket UNY",
        "date_lost": "2025-06-11",
        "reward": "75000",
        "owner_contact": "+6285678901234",
        "status": "active"
    }
]

SAMPLE_FOUND_ITEMS = [
    {
        "item_name": "Dompet Kulit Coklat",
        "description": "Dompet kulit berwarna coklat tua dengan kartu mahasiswa dan KTP",
        "category": "Dompet/Tas",
        "location_found": "Kantin FMIPA dekat kasir",
        "found_date": "2025-06-11",
        "found_time": "13:30",
        "finder_contact": "+6281111111111",
        "status": "available"
    },
    {
        "item_name": "Tas Ransel Hitam",
        "description": "Tas ransel warna hitam merk Eiger berisi buku dan alat tulis",
        "category": "Tas/Ransel", 
        "location_found": "Perpustakaan Pusat Lt.2",
        "found_date": "2025-06-12",
        "found_time": "16:45",
        "finder_contact": "+6282222222222",
        "status": "available"
    },
    {
        "item_name": "Kunci Motor Yamaha",
        "description": "Kunci motor Yamaha NMAX dengan gantungan karakter anime",
        "category": "Kendaraan",
        "location_found": "Parkiran Motor Gedung Rektorat",
        "found_date": "2025-06-13",
        "found_time": "10:15",
        "finder_contact": "+6283333333333",
        "status": "available"
    },
    {
        "item_name": "HP iPhone 12",
        "description": "iPhone 12 Pro warna biru dengan case transparan dan ring holder",
        "category": "Elektronik",
        "location_found": "Mushola UNY setelah sholat dzuhur",
        "found_date": "2025-06-14",
        "found_time": "12:45",
        "finder_contact": "+6284444444444",
        "status": "available"
    },
    {
        "item_name": "Kacamata Minus",
        "description": "Kacamata minus dengan frame hitam dan lensa anti radiasi",
        "category": "Aksesoris",
        "location_found": "Ruang Kuliah D201 FIS",
        "found_date": "2025-06-10",
        "found_time": "14:20",
        "finder_contact": "+6285555555555",
        "status": "available"
    }
]

async def create_dummy_image(color='blue', size=(224, 224)):
    """Create dummy image untuk testing"""
    image = Image.new('RGB', size, color=color)
    return image

async def populate_sample_data():
    """Main function untuk populate sample data"""
    print("🚀 Starting sample data population...")
    
    try:
        # Initialize services
        print("📊 Initializing Firebase client...")
        firebase = FirebaseClient()
        
        if not firebase.is_connected():
            print("❌ Firebase not connected. Check your serviceAccountKey.json")
            return False
        
        print("🤖 Initializing AI models...")
        model_manager = ModelManager()
        await model_manager.load_models()
        
        if not model_manager.models_loaded:
            print("❌ AI models not loaded properly")
            return False
        
        # Process Lost Items
        print("\n📱 Processing Lost Items...")
        for i, item in enumerate(SAMPLE_LOST_ITEMS):
            try:
                item_id = f"lost_{i+1}_{uuid.uuid4().hex[:8]}"
                print(f"  Processing: {item['item_name']}")
                
                # Generate embeddings for description
                embeddings = {
                    "text_clip_embedding": model_manager.encode_text_clip(item['description']),
                    "text_sentence_embedding": model_manager.encode_text_sentence(item['description']),
                    "item_name": item['item_name'],
                    "description": item['description'],
                    "category": item['category'],
                    "processed_at": datetime.now().isoformat()
                }
                
                # Optionally add image embedding (dummy image)
                if i % 2 == 0:  # Add image for some items
                    colors = ['blue', 'red', 'green', 'yellow', 'purple']
                    dummy_image = await create_dummy_image(color=colors[i % len(colors)])
                    embeddings['image_embedding'] = model_manager.encode_image(dummy_image)
                
                # Save to Firebase
                success = firebase.save_item_embeddings(item_id, embeddings, "lost_items")
                if success:
                    print(f"    ✅ Saved: {item_id}")
                else:
                    print(f"    ❌ Failed: {item_id}")
                    
            except Exception as e:
                print(f"    ❌ Error processing {item['item_name']}: {str(e)}")
        
        # Process Found Items
        print("\n🔍 Processing Found Items...")
        for i, item in enumerate(SAMPLE_FOUND_ITEMS):
            try:
                item_id = f"found_{i+1}_{uuid.uuid4().hex[:8]}"
                print(f"  Processing: {item['item_name']}")
                
                # Generate embeddings for description
                embeddings = {
                    "text_clip_embedding": model_manager.encode_text_clip(item['description']),
                    "text_sentence_embedding": model_manager.encode_text_sentence(item['description']),
                    "item_name": item['item_name'],
                    "description": item['description'],
                    "category": item['category'],
                    "processed_at": datetime.now().isoformat()
                }
                
                # Optionally add image embedding (dummy image)
                if i % 2 == 1:  # Add image for some items (different pattern than lost items)
                    colors = ['black', 'white', 'brown', 'gray', 'silver']
                    dummy_image = await create_dummy_image(color=colors[i % len(colors)])
                    embeddings['image_embedding'] = model_manager.encode_image(dummy_image)
                
                # Save to Firebase
                success = firebase.save_item_embeddings(item_id, embeddings, "found_items")
                if success:
                    print(f"    ✅ Saved: {item_id}")
                else:
                    print(f"    ❌ Failed: {item_id}")
                    
            except Exception as e:
                print(f"    ❌ Error processing {item['item_name']}: {str(e)}")
        
        # Cleanup
        model_manager.cleanup()
        
        print("\n📊 Sample data population completed!")
        print("🎯 Now you can test matching endpoints:")
        print("   - POST /match/instant")
        print("   - POST /match/background") 
        print("   - GET /match/stats")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during sample data population: {str(e)}")
        return False

async def check_existing_data():
    """Check apakah sudah ada data di Firebase"""
    try:
        firebase = FirebaseClient()
        
        if not firebase.is_connected():
            print("❌ Firebase not connected")
            return False
        
        lost_items = firebase.get_all_embeddings("lost_items")
        found_items = firebase.get_all_embeddings("found_items")
        
        print(f"📊 Current data in Firebase:")
        print(f"   Lost items: {len(lost_items)}")
        print(f"   Found items: {len(found_items)}")
        
        if len(lost_items) > 0 or len(found_items) > 0:
            response = input("\n⚠️  Firebase already has data. Overwrite? (y/N): ")
            return response.lower() in ['y', 'yes']
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking existing data: {str(e)}")
        return False

async def main():
    """Main entry point"""
    print("🔥 UNY Lost AI Layer - Sample Data Populator")
    print("=" * 50)
    
    # Check existing data
    if not await check_existing_data():
        print("Operation cancelled.")
        return
    
    # Populate sample data
    success = await populate_sample_data()
    
    if success:
        print("\n🎉 Sample data population successful!")
        print("\nNext steps:")
        print("1. Test instant matching: POST /match/instant")
        print("2. Test background matching: POST /match/background")
        print("3. Check health status: GET /health/status")
    else:
        print("\n❌ Sample data population failed!")

if __name__ == "__main__":
    asyncio.run(main())