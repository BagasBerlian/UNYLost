from src.database.redis_manager import RedisManager
import hashlib
import json

class CacheService:
    def __init__(self):
        self.redis_manager = RedisManager()
    
    def get_cache_key(self, key_type, identifier):
        return f"{key_type}:{identifier}"
    
    def generate_hash_key(self, data):
        serialized = json.dumps(data, sort_keys=True)
        return hashlib.md5(serialized.encode()).hexdigest()
    
    def get(self, key_type, identifier, **kwargs):
        key = self.get_cache_key(key_type, identifier)
        return self.redis_manager.get(key, **kwargs)
    
    def set(self, key_type, identifier, value, expire=True):
        key = self.get_cache_key(key_type, identifier)
        return self.redis_manager.set(key, value, expire)
    
    def delete(self, key_type, identifier):
        key = self.get_cache_key(key_type, identifier)
        return self.redis_manager.delete(key)
    
    def invalidate_item_cache(self, item_id):
        keys_to_delete = [
            self.get_cache_key("img_emb", item_id),
            self.get_cache_key("txt_clip_emb", item_id),
            self.get_cache_key("txt_st_emb", item_id)
        ]
        
        for key in keys_to_delete:
            self.redis_manager.delete(key)
            
    def cache_match_result(self, query, result, expire_time=1800):
        # Generate a hash key from the query
        hash_key = self.generate_hash_key(query)
        key = self.get_cache_key("match", hash_key)
        
        # Set custom expiration time for match results (default 30 minutes)
        success = self.redis_manager.set(key, result, True)
        if success:
            self.redis_manager.client.expire(key, expire_time)
        return success
    
    def get_cached_match(self, query):
        hash_key = self.generate_hash_key(query)
        key = self.get_cache_key("match", hash_key)
        return self.redis_manager.get(key)
    
    def get_redis_status(self):
        return {
            "connected": self.redis_manager.ping(),
            "stats": self.redis_manager.get_stats() if self.redis_manager.ping() else None
        }