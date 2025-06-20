from pydantic import BaseModel, Field
from typing import List, Optional

class TextEmbeddingRequest(BaseModel):
    text: str
    item_id: Optional[str] = None

class ImageEmbeddingRequest(BaseModel):
    image_url: str
    item_id: Optional[str] = None

class HybridEmbeddingRequest(BaseModel):
    text: str
    image_url: Optional[str] = None
    item_id: Optional[str] = None

class InstantMatchRequest(BaseModel):
    item_id: str
    item_name: str
    description: str
    image_urls: Optional[List[str]] = None
    collection: str = Field(..., description="Collection to match against ('lost_items' or 'found_items')")

class BatchMatchRequest(BaseModel):
    items: List[InstantMatchRequest]
    threshold: float = 0.75

class BackgroundMatchRequest(BaseModel):
    threshold: float = 0.75
    limit: int = 100