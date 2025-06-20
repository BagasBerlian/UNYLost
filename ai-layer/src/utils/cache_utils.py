import hashlib
import json

# Generate a deterministic cache key from data
def generate_cache_key(prefix: str, data: dict) -> str:
    serialized = json.dumps(data, sort_keys=True)
    hash_value = hashlib.md5(serialized.encode()).hexdigest()
    return f"{prefix}:{hash_value}"