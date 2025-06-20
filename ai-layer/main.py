from src.main import app

if __name__ == "__main__":
    import uvicorn
    from src.config import app_config
    
    uvicorn.run(
        "src.main:app",
        host=app_config.HOST,
        port=app_config.PORT,
        reload=True,
        log_level=app_config.LOG_LEVEL.lower()
    )