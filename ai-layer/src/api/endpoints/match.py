from fastapi import APIRouter, HTTPException, Depends
from src.core.schemas.request import InstantMatchRequest, BatchMatchRequest, BackgroundMatchRequest
from src.core.schemas.response import APIResponse, MatchResult, BatchMatchResult
from src.core.services.matching_service import MatchingService

router = APIRouter(prefix="/match", tags=["match"])

# Perform instant matching for a new item against existing items
@router.post("/instant", response_model=APIResponse)
async def instant_match(request: InstantMatchRequest):
    try:
        matching_service = MatchingService()
        
        # Validate collection
        if request.collection not in ["lost_items", "found_items"]:
            raise ValueError("Collection must be either 'lost_items' or 'found_items'")
        
        # Perform matching
        match_result = matching_service.instant_match(
            item_data=request.dict(),
            collection=request.collection
        )
        
        return {
            "success": True,
            "message": "Instant matching completed successfully",
            "data": match_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Process batch matching for multiple items
@router.post("/batch", response_model=APIResponse)
async def batch_match(request: BatchMatchRequest):
    try:
        matching_service = MatchingService()
        results = []
        
        for item in request.items:
            # Validate collection
            if item.collection not in ["lost_items", "found_items"]:
                raise ValueError(f"Collection must be either 'lost_items' or 'found_items' for item {item.item_id}")
            
            # Perform matching for each item
            match_result = matching_service.instant_match(
                item_data=item.dict(),
                collection=item.collection,
                threshold=request.threshold
            )
            results.append(match_result)
        
        return {
            "success": True,
            "message": "Batch matching completed successfully",
            "data": {
                "results": results,
                "total_processed": len(results),
                "threshold": request.threshold
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Trigger background matching process for all active items
@router.post("/background", response_model=APIResponse)
async def background_match(request: BackgroundMatchRequest):
    try:
        # In a real implementation, this would:
        # 1. Queue a background job
        # 2. Return immediately with a job ID
        # 3. The job would process all items in the background
        
        # For this example, we'll just return a mock response
        return {
            "success": True,
            "message": "Background matching job scheduled successfully",
            "data": {
                "job_id": "bg_match_123456",
                "threshold": request.threshold,
                "limit": request.limit,
                "estimated_items": 50  # Mock value
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))