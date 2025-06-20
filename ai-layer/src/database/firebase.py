import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import numpy as np
import json
import os
from pathlib import Path

class FirebaseClient:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseClient, cls).__new__(cls)
            cls._instance.app = None
            cls._instance.db = None
            cls._instance._initialize_firebase()
        return cls._instance
    
    def _initialize_firebase(self):
        try:
            firebase_config_path = Path(__file__).parent.parent.parent / "config" / "serviceAccountKey.json"
            
            if not firebase_config_path.exists():
                print(f"Error: Firebase config file not found at {firebase_config_path}")
                return
            
            cred = credentials.Certificate(str(firebase_config_path))
            
            self.app = firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Firebase connection initialized successfully")
        except Exception as e:
            print(f"Error initializing Firebase: {e}")
            self.app = None
            self.db = None
    
    def is_connected(self):
        return self.db is not None
    
    def save_embedding(self, collection_name, item_id, embeddings, metadata=None):
        if not self.db:
            print("Firebase not initialized")
            return False
        
        serializable_embeddings = {}
        
        for key, value in embeddings.items():
            if isinstance(value, np.ndarray):
                serializable_embeddings[key] = value.tolist()
            else:
                serializable_embeddings[key] = value
        
        document_data = {
            'item_id': item_id,
            'embeddings': serializable_embeddings,
            'created_at': firestore.SERVER_TIMESTAMP
        }
        
        if metadata and isinstance(metadata, dict):
            document_data.update(metadata)
        
        try:
            self.db.collection(collection_name).document(item_id).set(document_data)
            print(f"Successfully saved embeddings for {item_id} to {collection_name}")
            return True
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            return False
    
    def get_embedding(self, collection_name, item_id):
        if not self.db:
            print("Firebase not initialized")
            return None
        
        try:
            print(f"Trying to retrieve document: {collection_name}/{item_id}")
            doc = self.db.collection(collection_name).document(item_id).get()
            
            if not doc.exists:
                print(f"No embedding found for {item_id} in {collection_name}")
                return None
            
            print(f"Document found for {item_id}")
            data = doc.to_dict()
            
            # Debug output
            print(f"Document data keys: {data.keys() if data else 'None'}")
            
            # Convert back to numpy arrays if embeddings exist
            if data and 'embeddings' in data:
                for key, value in data['embeddings'].items():
                    if isinstance(value, list):
                        data['embeddings'][key] = np.array(value)
            
            return data
        except Exception as e:
            print(f"Error retrieving from Firebase: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_all_embeddings(self, collection_name, limit=100):
        if not self.db:
            print("Firebase not initialized")
            return {}
        
        try:
            docs = self.db.collection(collection_name).limit(limit).stream()
            
            result = {}
            for doc in docs:
                data = doc.to_dict()
                item_id = data.get('item_id', doc.id)
                
                if 'embeddings' in data:
                    for key, value in data['embeddings'].items():
                        if isinstance(value, list):
                            data['embeddings'][key] = np.array(value)
                
                result[item_id] = data
            
            return result
        except Exception as e:
            print(f"Error retrieving from Firebase: {e}")
            return {}
    
    def delete_embedding(self, collection_name, item_id):
        if not self.db:
            print("Firebase not initialized")
            return False
        
        try:
            self.db.collection(collection_name).document(item_id).delete()
            print(f"Successfully deleted embedding for {item_id} from {collection_name}")
            return True
        except Exception as e:
            print(f"Error deleting from Firebase: {e}")
            return False
    
    def search_embeddings(self, collection_name, filters=None, limit=50):
        if not self.db:
            print("Firebase not initialized")
            return {}
        
        try:
            query = self.db.collection(collection_name)
            
            if filters and isinstance(filters, dict):
                for field, value in filters.items():
                    if isinstance(value, dict) and 'operator' in value and 'value' in value:
                        op = value['operator']
                        val = value['value']
                        
                        if op == '==':
                            query = query.where(field, '==', val)
                        elif op == '>':
                            query = query.where(field, '>', val)
                        elif op == '<':
                            query = query.where(field, '<', val)
                        elif op == '>=':
                            query = query.where(field, '>=', val)
                        elif op == '<=':
                            query = query.where(field, '<=', val)
                    else:
                        # Default to equality
                        query = query.where(field, '==', value)
            
            query = query.limit(limit)
            docs = query.stream()
            
            result = {}
            for doc in docs:
                data = doc.to_dict()
                item_id = data.get('item_id', doc.id)
                
                if 'embeddings' in data:
                    for key, value in data['embeddings'].items():
                        if isinstance(value, list):
                            data['embeddings'][key] = np.array(value)
                
                result[item_id] = data
            
            return result
        except Exception as e:
            print(f"Error searching in Firebase: {e}")
            return {}