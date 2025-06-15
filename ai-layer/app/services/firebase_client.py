import os
import json
import numpy as np
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore
from loguru import logger

class FirebaseClient:
    """Client untuk berinteraksi dengan Firebase Firestore"""
    
    def __init__(self, credentials_path: str = "firebase_key/serviceAccountKey.json"):
        self.db = None
        self.credentials_path = credentials_path
        self._connected = False
        
        try:
            self._initialize_firebase()
        except Exception as e:
            logger.error(f"❌ Firebase initialization failed: {str(e)}")
    
    def _initialize_firebase(self):
        """Initialize Firebase connection"""
        try:
            # Check if already initialized
            if firebase_admin._apps:
                logger.info("🔥 Firebase sudah diinisialisasi sebelumnya")
                self.db = firestore.client()
                self._connected = True
                return
            
            # Check credentials file
            if not os.path.exists(self.credentials_path):
                raise FileNotFoundError(f"Firebase credentials not found: {self.credentials_path}")
            
            # Initialize Firebase
            cred = credentials.Certificate(self.credentials_path)
            firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            self._connected = True
            
            logger.info("✅ Firebase Firestore connected")
            
            # Test connection
            self._test_connection()
            
        except Exception as e:
            logger.error(f"❌ Firebase initialization error: {str(e)}")
            self._connected = False
            raise
    
    def _test_connection(self):
        """Test Firebase connection dengan dummy query"""
        try:
            # Try to access collections
            collections = list(self.db.collections())
            logger.info(f"🔍 Firebase collections found: {len(collections)}")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Firebase connection test warning: {str(e)}")
            return False
    
    def is_connected(self) -> bool:
        """Check if Firebase is connected"""
        return self._connected and self.db is not None
    
    def save_item_embeddings(self, item_id: str, embeddings: Dict, collection: str = "found_items") -> bool:
        """Simpan embeddings untuk item ke Firestore"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return False
        
        try:
            # Convert numpy arrays to lists for JSON serialization
            serialized_embeddings = {}
            for key, value in embeddings.items():
                if isinstance(value, np.ndarray):
                    serialized_embeddings[key] = value.tolist()
                else:
                    serialized_embeddings[key] = value
            
            # Add metadata
            data = {
                **serialized_embeddings,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "embedding_version": "clip_sentence_v1"
            }
            
            # Save to Firestore
            doc_ref = self.db.collection(collection).document(item_id)
            doc_ref.set(data, merge=True)
            
            logger.info(f"✅ Embeddings saved for item {item_id} in {collection}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error saving embeddings for {item_id}: {str(e)}")
            return False
    
    def get_item_embeddings(self, item_id: str, collection: str = "found_items") -> Optional[Dict]:
        """Ambil embeddings untuk item dari Firestore"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return None
        
        try:
            doc_ref = self.db.collection(collection).document(item_id)
            doc = doc_ref.get()
            
            if not doc.exists:
                logger.warning(f"⚠️  Document {item_id} not found in {collection}")
                return None
            
            data = doc.to_dict()
            
            # Convert lists back to numpy arrays
            embeddings = {}
            for key, value in data.items():
                if key.endswith('_embedding') and isinstance(value, list):
                    embeddings[key] = np.array(value)
                else:
                    embeddings[key] = value
            
            return embeddings
            
        except Exception as e:
            logger.error(f"❌ Error getting embeddings for {item_id}: {str(e)}")
            return None
    
    def get_all_embeddings(self, collection: str = "found_items", limit: Optional[int] = None) -> Dict[str, Dict]:
        """Ambil semua embeddings dari collection"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return {}
        
        try:
            query = self.db.collection(collection)
            if limit:
                query = query.limit(limit)
            
            docs = query.stream()
            all_embeddings = {}
            
            for doc in docs:
                doc_id = doc.id
                data = doc.to_dict()
                
                # Convert lists back to numpy arrays
                embeddings = {}
                for key, value in data.items():
                    if key.endswith('_embedding') and isinstance(value, list):
                        embeddings[key] = np.array(value)
                    else:
                        embeddings[key] = value
                
                all_embeddings[doc_id] = embeddings
            
            logger.info(f"📊 Retrieved {len(all_embeddings)} items from {collection}")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"❌ Error getting all embeddings from {collection}: {str(e)}")
            return {}
    
    def search_items_by_status(self, status: str = "available", collection: str = "found_items") -> List[Dict]:
        """Cari items berdasarkan status"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return []
        
        try:
            query = self.db.collection(collection).where("status", "==", status)
            docs = query.stream()
            
            items = []
            for doc in docs:
                item_data = doc.to_dict()
                item_data['id'] = doc.id
                
                # Convert embedding lists to numpy arrays
                for key, value in item_data.items():
                    if key.endswith('_embedding') and isinstance(value, list):
                        item_data[key] = np.array(value)
                
                items.append(item_data)
            
            logger.info(f"🔍 Found {len(items)} items with status '{status}' in {collection}")
            return items
            
        except Exception as e:
            logger.error(f"❌ Error searching items by status: {str(e)}")
            return []
    
    def update_item_status(self, item_id: str, status: str, collection: str = "found_items") -> bool:
        """Update status item"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return False
        
        try:
            doc_ref = self.db.collection(collection).document(item_id)
            doc_ref.update({
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"✅ Status updated for {item_id}: {status}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error updating status for {item_id}: {str(e)}")
            return False
    
    def save_match_result(self, match_data: Dict) -> Optional[str]:
        """Simpan hasil matching ke collection matches"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return None
        
        try:
            # Add timestamp
            match_data["created_at"] = datetime.now(timezone.utc).isoformat()
            match_data["match_version"] = "clip_sentence_v1"
            
            # Save to matches collection
            doc_ref = self.db.collection("matches").add(match_data)
            match_id = doc_ref[1].id
            
            logger.info(f"✅ Match result saved with ID: {match_id}")
            return match_id
            
        except Exception as e:
            logger.error(f"❌ Error saving match result: {str(e)}")
            return None
    
    def get_recent_matches(self, limit: int = 50) -> List[Dict]:
        """Ambil match results terbaru"""
        if not self.is_connected():
            logger.error("❌ Firebase not connected")
            return []
        
        try:
            query = (self.db.collection("matches")
                    .order_by("created_at", direction=firestore.Query.DESCENDING)
                    .limit(limit))
            
            docs = query.stream()
            matches = []
            
            for doc in docs:
                match_data = doc.to_dict()
                match_data['id'] = doc.id
                matches.append(match_data)
            
            logger.info(f"📊 Retrieved {len(matches)} recent matches")
            return matches
            
        except Exception as e:
            logger.error(f"❌ Error getting recent matches: {str(e)}")
            return []
    
    def get_stats(self) -> Dict:
        """Get Firebase statistics"""
        if not self.is_connected():
            return {"connected": False}
        
        try:
            stats = {"connected": True}
            
            # Count documents in each collection
            collections = ["found_items", "lost_items", "matches"]
            for collection in collections:
                try:
                    docs = list(self.db.collection(collection).limit(1000).stream())
                    stats[f"{collection}_count"] = len(docs)
                except:
                    stats[f"{collection}_count"] = "error"
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error getting Firebase stats: {str(e)}")
            return {"connected": True, "error": str(e)}