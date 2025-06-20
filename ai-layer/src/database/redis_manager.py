import redis
import json
import numpy as np
import time
import pickle
from src.config import redis_config

class RedisManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        self.redis_available = False
        self.client = None
        self.ttl = redis_config.REDIS_TTL
        self.max_retries = 3
        self.retry_delay = 2 
        
        self._connect_with_retry()
    
    def _connect_with_retry(self):
        for attempt in range(self.max_retries):
            try:
                self.client = redis.Redis(
                    host=redis_config.REDIS_HOST,
                    port=redis_config.REDIS_PORT,
                    password=redis_config.REDIS_PASSWORD,
                    db=redis_config.REDIS_DB,
                    decode_responses=False,  
                    socket_timeout=5,
                    socket_connect_timeout=5
                )
                
                # Test connection
                self.client.ping()
                self.redis_available = True
                print(f"Successfully connected to Redis at {redis_config.REDIS_HOST}:{redis_config.REDIS_PORT}")
                break
            except (redis.ConnectionError, redis.TimeoutError) as e:
                print(f"Redis connection attempt {attempt+1}/{self.max_retries} failed: {str(e)}")
                if attempt < self.max_retries - 1:
                    print(f"Retrying in {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                else:
                    print("Failed to connect to Redis after multiple attempts. Running in memory-only mode.")
    
    def reconnect(self):
        self._connect_with_retry()
        return self.redis_available
    
    def ping(self):
        if not self.redis_available:
            return False
        try:
            return self.client.ping()
        except Exception as e:
            print(f"Error connecting to Redis: {e}")
            self.redis_available = False
            return False
    
    def set(self, key, value, expire=True):
        if not self.redis_available:
            return False
            
        try:
            # Handle numpy arrays
            if isinstance(value, np.ndarray):
                # Serialize numpy array
                value = pickle.dumps(value)
            # Handle dictionaries and other objects
            elif not isinstance(value, (bytes, str)):
                value = json.dumps(value)
            
            self.client.set(key, value)
            if expire:
                self.client.expire(key, self.ttl)
            return True
        except redis.RedisError as e:
            print(f"Redis error when setting key: {e}")
            self.redis_available = False
            return False
        except Exception as e:
            print(f"Error setting Redis key: {e}")
            return False
    
    def get(self, key, as_numpy=False, shape=None, dtype=np.float32):
        if not self.redis_available:
            return None
            
        try:
            value = self.client.get(key)
            if value is None:
                return None
            
            if as_numpy:
                # Deserialize numpy array
                try:
                    return pickle.loads(value)
                except:
                    # Fallback to old method if pickle fails
                    array = np.frombuffer(value, dtype=dtype)
                    if shape:
                        return array.reshape(shape)
                    return array
            
            # Try to decode JSON
            try:
                return json.loads(value)
            except (TypeError, json.JSONDecodeError):
                # Return as is if not JSON
                return value
        except redis.RedisError as e:
            print(f"Redis error when getting key: {e}")
            self.redis_available = False
            return None
        except Exception as e:
            print(f"Error getting Redis key: {e}")
            return None
    
    def delete(self, key):
        if not self.redis_available:
            return False
            
        try:
            return self.client.delete(key)
        except redis.RedisError as e:
            print(f"Redis error when deleting key: {e}")
            self.redis_available = False
            return False
        except Exception as e:
            print(f"Error deleting Redis key: {e}")
            return False
    
    def flush_db(self):
        if not self.redis_available:
            return False
            
        try:
            self.client.flushdb()
            return True
        except Exception as e:
            print(f"Error flushing Redis database: {e}")
            return False
    
    def get_stats(self):
        if not self.redis_available:
            return {"status": "unavailable"}
            
        try:
            info = self.client.info()
            memory_used = info.get("used_memory_human", "unknown")
            uptime = info.get("uptime_in_seconds", 0)
            connected_clients = info.get("connected_clients", 0)
            
            return {
                "status": "available",
                "memory_used": memory_used,
                "uptime_seconds": uptime,
                "connected_clients": connected_clients,
                "database": redis_config.REDIS_DB
            }
        except Exception as e:
            print(f"Error getting Redis stats: {e}")
            return {"status": "error", "message": str(e)}