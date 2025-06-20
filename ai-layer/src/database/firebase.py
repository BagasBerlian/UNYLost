import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import numpy as np
import json


class FirebaseClient:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseClient, cls).__new__(cls)
            cls._instance._initialize_firebase()
        return cls._instance
    
    def _initialize_firebase(self):
        try:
            firebase_config_path = Path(__file__).parent.parent.parent / "config" / "serviceAccountKey.json"
            cred = credentials.Certificate(firebase_config_path)
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Firebase connection initialized successfully")
        except Exception as e:
            print(f"Error initializing Firebase: {e}")
            self.db = None
    
    def save_embedding(self, collection, item_id, embeddings):
        if not self.db:
            print("Firebase not initialized")
            return False
        
        # Convert numpy arrays to lists for JSON serialization
        serializable_embeddings = {}
        for key, value in embeddings.items():
            if isinstance(value, np.ndarray):
                serializable_embeddings[key] = value.tolist()
            else:
                serializable_embeddings[key] = value
        
        # Add metadata
        serializable_embeddings['item_id'] = item_id
        serializable_embeddings['created_at'] = firestore.SERVER_TIMESTAMP
        
        try:
            self.db.collection(collection).document(item_id).set(serializable_embeddings)
            return True
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            return False
    
    def get_embeddings(self, collection, item_id=None):
        if not self.db:
            print("Firebase not initialized")
            return {}
        
        try:
            if item_id:
                # Get specific item
                doc = self.db.collection(collection).document(item_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    # Convert lists back to numpy arrays
                    for key in ['clip_text', 'sentence_text', 'image']:
                        if key in data and isinstance(data[key], list):
                            data[key] = np.array(data[key])
                    return {item_id: data}
                return {}
            else:
                # Get all items
                docs = self.db.collection(collection).stream()
                result = {}
                for doc in docs:
                    data = doc.to_dict()
                    # Convert lists back to numpy arrays
                    for key in ['clip_text', 'sentence_text', 'image']:
                        if key in data and isinstance(data[key], list):
                            data[key] = np.array(data[key])
                    result[doc.id] = data
                return result
        except Exception as e:
            print(f"Error retrieving from Firebase: {e}")
            return {}