import redis
import json
import numpy as np
from src.config import redis_config

class RedisClient:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
            cls._instance.client = redis.Redis(
                host=redis_config.REDIS_HOST,
                port=redis_config.REDIS_PORT,
                password=redis_config.REDIS_PASSWORD,
                decode_responses=False  # Keep binary for numpy arrays
            )
            cls._instance.ttl = redis_config.REDIS_TTL
        return cls._instance
    
    # Test connection to Redis
    def ping(self):
        try:
            return self.client.ping()
        except Exception as e:
            print(f"Error connecting to Redis: {e}")
            return False
    
    # Set a key-value pair in Redis
    def set(self, key, value, expire=True):
        try:
            if isinstance(value, np.ndarray):
                value = value.tobytes()
            elif not isinstance(value, (bytes, str)):
                value = json.dumps(value)
            
            self.client.set(key, value)
            if expire:
                self.client.expire(key, self.ttl)
            return True
        except Exception as e:
            print(f"Error setting Redis key: {e}")
            return False
    
    # Get a value from Redis
    def get(self, key, as_numpy=False, shape=None, dtype=np.float32):
        try:
            value = self.client.get(key)
            if value is None:
                return None
            
            if as_numpy and shape:
                array = np.frombuffer(value, dtype=dtype)
                return array.reshape(shape)
            
            try:
                return json.loads(value)
            except (TypeError, json.JSONDecodeError):
                return value
        except Exception as e:
            print(f"Error getting Redis key: {e}")
            return None
    
    # Delete a key from Redis
    def delete(self, key):
        try:
            return self.client.delete(key)
        except Exception as e:
            print(f"Error deleting Redis key: {e}")
            return False