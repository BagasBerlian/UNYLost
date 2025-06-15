import os
import io
import mimetypes
from typing import Optional, List, Dict
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload
from googleapiclient.errors import HttpError
from PIL import Image
from loguru import logger

class GoogleDriveService:
    """Service untuk mengelola upload gambar ke Google Drive"""
    
    def __init__(self, credentials_path: str = "firebase_key/serviceAccountKey.json", 
                 folder_id: Optional[str] = None):
        self.credentials_path = credentials_path
        self.folder_id = folder_id or os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        self.service = None
        self._connected = False
        
        try:
            self._initialize_drive()
        except Exception as e:
            logger.error(f"❌ Google Drive initialization failed: {str(e)}")
    
    def _initialize_drive(self):
        """Initialize Google Drive service"""
        try:
            if not os.path.exists(self.credentials_path):
                raise FileNotFoundError(f"Credentials file not found: {self.credentials_path}")
            
            # Setup credentials
            scopes = ['https://www.googleapis.com/auth/drive']
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path, 
                scopes=scopes
            )
            
            # Build service
            self.service = build('drive', 'v3', credentials=credentials)
            self._connected = True
            
            logger.info("✅ Google Drive service connected")
            
            # Test connection
            self._test_connection()
            
        except Exception as e:
            logger.error(f"❌ Google Drive initialization error: {str(e)}")
            self._connected = False
            raise
    
    def _test_connection(self):
        """Test Google Drive connection"""
        try:
            # Test dengan list files
            results = self.service.files().list(pageSize=1).execute()
            logger.info("🔍 Google Drive connection test successful")
            return True
        except Exception as e:
            logger.warning(f"⚠️  Google Drive connection test warning: {str(e)}")
            return False
    
    def is_connected(self) -> bool:
        """Check if Google Drive is connected"""
        return self._connected and self.service is not None
    
    def upload_image(self, image_data: bytes, filename: str, 
                    image_format: str = "JPEG") -> Optional[str]:
        """Upload image bytes ke Google Drive"""
        if not self.is_connected():
            logger.error("❌ Google Drive not connected")
            return None
        
        try:
            # Optimize image untuk storage
            optimized_data = self._optimize_image(image_data, image_format)
            
            # Setup file metadata
            file_metadata = {
                'name': filename,
                'parents': [self.folder_id] if self.folder_id else []
            }
            
            # Determine MIME type
            mime_type = f"image/{image_format.lower()}"
            
            # Upload file
            media = MediaIoBaseUpload(
                io.BytesIO(optimized_data),
                mimetype=mime_type,
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name,webViewLink'
            ).execute()
            
            file_id = file.get('id')
            
            # Make file publicly accessible
            self._make_public(file_id)
            
            # Generate direct download link
            direct_link = f"https://drive.google.com/uc?id={file_id}&export=download"
            
            logger.info(f"✅ Image uploaded to Drive: {filename} (ID: {file_id})")
            return direct_link
            
        except HttpError as e:
            logger.error(f"❌ Google Drive HTTP error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"❌ Error uploading image: {str(e)}")
            return None
    
    def upload_pil_image(self, pil_image: Image.Image, filename: str,
                        format: str = "JPEG", quality: int = 85) -> Optional[str]:
        """Upload PIL Image ke Google Drive"""
        if not self.is_connected():
            logger.error("❌ Google Drive not connected")
            return None
        
        try:
            # Convert PIL image to bytes
            buffer = io.BytesIO()
            
            # Convert to RGB if necessary for JPEG
            if format.upper() == "JPEG" and pil_image.mode in ("RGBA", "P"):
                pil_image = pil_image.convert("RGB")
            
            pil_image.save(buffer, format=format, quality=quality, optimize=True)
            image_data = buffer.getvalue()
            
            return self.upload_image(image_data, filename, format)
            
        except Exception as e:
            logger.error(f"❌ Error uploading PIL image: {str(e)}")
            return None
    
    def _optimize_image(self, image_data: bytes, format: str = "JPEG") -> bytes:
        """Optimize image untuk mengurangi ukuran file"""
        try:
            # Load image
            image = Image.open(io.BytesIO(image_data))
            
            # Resize jika terlalu besar (max 1920x1920)
            max_size = 1920
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                logger.info(f"🔄 Image resized to {new_size}")
            
            # Convert untuk JPEG
            if format.upper() == "JPEG" and image.mode in ("RGBA", "P"):
                # Convert dengan background putih
                rgb_image = Image.new("RGB", image.size, (255, 255, 255))
                if image.mode == "P":
                    image = image.convert("RGBA")
                rgb_image.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
                image = rgb_image
            
            # Save dengan optimasi
            buffer = io.BytesIO()
            save_kwargs = {"format": format, "optimize": True}
            
            if format.upper() == "JPEG":
                save_kwargs["quality"] = 85
            elif format.upper() == "PNG":
                save_kwargs["compress_level"] = 6
            
            image.save(buffer, **save_kwargs)
            optimized_data = buffer.getvalue()
            
            # Log compression ratio
            original_size = len(image_data)
            optimized_size = len(optimized_data)
            ratio = (original_size - optimized_size) / original_size * 100
            logger.info(f"📈 Image optimized: {original_size//1024}KB → {optimized_size//1024}KB (-{ratio:.1f}%)")
            
            return optimized_data
            
        except Exception as e:
            logger.warning(f"⚠️  Image optimization failed, using original: {str(e)}")
            return image_data
    
    def _make_public(self, file_id: str):
        """Make file publicly accessible"""
        try:
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            
            self.service.permissions().create(
                fileId=file_id,
                body=permission
            ).execute()
            
            logger.debug(f"📋 File {file_id} made public")
            
        except Exception as e:
            logger.warning(f"⚠️  Could not make file public: {str(e)}")
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file dari Google Drive"""
        if not self.is_connected():
            logger.error("❌ Google Drive not connected")
            return False
        
        try:
            self.service.files().delete(fileId=file_id).execute()
            logger.info(f"🗑️  File deleted: {file_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error deleting file {file_id}: {str(e)}")
            return False
    
    def get_file_info(self, file_id: str) -> Optional[Dict]:
        """Get informasi file dari Google Drive"""
        if not self.is_connected():
            logger.error("❌ Google Drive not connected")
            return None
        
        try:
            file_info = self.service.files().get(
                fileId=file_id,
                fields="id,name,size,createdTime,mimeType,webViewLink"
            ).execute()
            
            return file_info
            
        except Exception as e:
            logger.error(f"❌ Error getting file info {file_id}: {str(e)}")
            return None
    
    def list_files(self, limit: int = 100) -> List[Dict]:
        """List files di folder UNY Lost"""
        if not self.is_connected():
            logger.error("❌ Google Drive not connected")
            return []
        
        try:
            query = ""
            if self.folder_id:
                query = f"'{self.folder_id}' in parents"
            
            results = self.service.files().list(
                q=query,
                pageSize=limit,
                fields="files(id,name,size,createdTime,mimeType)"
            ).execute()
            
            files = results.get('files', [])
            logger.info(f"📂 Found {len(files)} files in Drive")
            return files
            
        except Exception as e:
            logger.error(f"❌ Error listing files: {str(e)}")
            return []
    
    def get_folder_stats(self) -> Dict:
        """Get statistik folder Google Drive"""
        if not self.is_connected():
            return {"connected": False}
        
        try:
            files = self.list_files(limit=1000)
            
            total_files = len(files)
            total_size = 0
            file_types = {}
            
            for file in files:
                # Size
                size = int(file.get('size', 0))
                total_size += size
                
                # Type
                mime_type = file.get('mimeType', 'unknown')
                file_types[mime_type] = file_types.get(mime_type, 0) + 1
            
            stats = {
                "connected": True,
                "total_files": total_files,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_types": file_types,
                "folder_id": self.folder_id
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error getting folder stats: {str(e)}")
            return {"connected": True, "error": str(e)}

# Utility functions
def extract_file_id_from_url(drive_url: str) -> Optional[str]:
    """Extract file ID dari Google Drive URL"""
    try:
        if "drive.google.com/uc?id=" in drive_url:
            return drive_url.split("id=")[1].split("&")[0]
        elif "drive.google.com/file/d/" in drive_url:
            return drive_url.split("/d/")[1].split("/")[0]
        else:
            return None
    except:
        return None

def generate_drive_preview_url(file_id: str) -> str:
    """Generate preview URL untuk Google Drive file"""
    return f"https://drive.google.com/file/d/{file_id}/view"

def generate_drive_download_url(file_id: str) -> str:
    """Generate direct download URL untuk Google Drive file"""
    return f"https://drive.google.com/uc?id={file_id}&export=download"