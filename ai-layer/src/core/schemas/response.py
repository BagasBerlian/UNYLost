from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class EmbeddingResponse(BaseModel):
    success: bool
    embedding_type: str
    item_id: Optional[str] = None
    dimensions: Optional[int] = None
    cached: bool = False

class MatchItem(BaseModel):
    id: str
    similarity: float
    match_type: str

class MatchResult(BaseModel):
    item_id: str
    matches: List[MatchItem]
    total_matches: int
    has_high_similarity: bool

class BatchMatchResult(BaseModel):
    results: List[MatchResult]
    total_processed: int
    threshold: float

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None