from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import numpy as np
import cv2
from io import BytesIO
import base64
import requests
from typing import Union, Tuple, List

def load_image(image_source: Union[str, bytes]) -> Image.Image:
    try:
        if isinstance(image_source, str):
            if image_source.startswith(('http://', 'https://')):
                print(f"Loading image from URL: {image_source}")
                
                try:
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                    
                    # Khusus untuk URL Google Drive
                    if "drive.google.com" in image_source and "export=view" in image_source:
                        print("Detected Google Drive URL, using special handling")
                        # Ubah URL untuk mendapatkan akses langsung
                        file_id = image_source.split("id=")[1].split("&")[0]
                        direct_url = f"https://drive.google.com/uc?id={file_id}&export=download"
                        response = requests.get(direct_url, timeout=30, headers=headers)
                    else:
                        response = requests.get(image_source, timeout=30, headers=headers)
                    
                    response.raise_for_status()
                    img = Image.open(BytesIO(response.content))
                    print(f"Successfully loaded image with size: {img.size}")
                    return img.convert('RGB')
                except Exception as e:
                    print(f"Error downloading image from URL: {str(e)}")
                    # Return placeholder gray image
                    return Image.new('RGB', (224, 224), color=(128, 128, 128))
    except Exception as e:
        print(f"Critical error in load_image: {str(e)}")
        return Image.new('RGB', (224, 224), color=(128, 128, 128))

# Tingkatkan kontras dan ketajaman gambar
def enhance_image(image: Image.Image) -> Image.Image:
    # Konversi ke RGB jika bukan
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Tingkatkan kontras
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)  # Faktor peningkatan kontras
    
    # Tingkatkan ketajaman
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(1.3)  # Faktor peningkatan ketajaman
    
    return image

# Terapkan koreksi warna untuk normalisasi gambar
def apply_color_correction(image: Image.Image) -> Image.Image:
    # Auto-level untuk meratakan distribusi warna
    image = ImageOps.autocontrast(image, cutoff=2)
    
    # Koreksi kecerahan
    enhancer = ImageEnhance.Brightness(image)
    image = enhancer.enhance(1.1)  # Sedikit tingkatkan kecerahan
    
    return image

# Kurangi noise latar belakang dengan smooth filtering
def remove_background_noise(image: Image.Image) -> Image.Image:
    # Terapkan median filter untuk mengurangi noise
    image = image.filter(ImageFilter.MedianFilter(size=3))
    return image

# Pipeline preprocessing gambar yang lebih komprehensif
def preprocess_image(image: Image.Image, target_size: Tuple[int, int] = (224, 224)) -> Image.Image:
    # Langkah 1: Resize gambar dengan kualitas tinggi
    image = image.resize(target_size, Image.LANCZOS)
    
    # Langkah 2: Tingkatkan kontras dan ketajaman
    image = enhance_image(image)
    
    # Langkah 3: Koreksi warna
    image = apply_color_correction(image)
    
    # Langkah 4: Kurangi noise
    image = remove_background_noise(image)
    
    return image

# Pipeline preprocessing gambar yang lengkap untuk model
def advanced_preprocess_image(image: Image.Image, target_size: Tuple[int, int] = (224, 224)) -> np.ndarray:
    # Langkah 1: Resize gambar dengan kualitas tinggi
    image = image.resize(target_size, Image.LANCZOS)
    
    # Langkah 2: Tingkatkan kontras dengan adaptive histogram equalization
    image = adaptive_histogram_equalization(image)
    
    # Langkah 3: Enhance dan reduce noise
    image = enhance_image(image)
    image = remove_background_noise(image)
    
    # Langkah 4: Convert to numpy array
    image_array = np.array(image)
    
    # Langkah 5: Normalisasi untuk model
    normalized = normalize_for_model(image_array)
    
    return normalized

# Normalisasi nilai piksel dengan metode yang lebih robust
def normalize_image(image_array: np.ndarray) -> np.ndarray:
    # Normalisasi ke [0, 1]
    normalized = image_array.astype(np.float32) / 255.0
    
    # Standardisasi dengan mean dan std 
    # (Sesuai dengan preprocessing yang digunakan saat training CLIP)
    mean = np.array([0.48145466, 0.4578275, 0.40821073])
    std = np.array([0.26862954, 0.26130258, 0.27577711])
    
    # Terapkan normalisasi per channel
    normalized = (normalized - mean.reshape(1, 1, 3)) / std.reshape(1, 1, 3)
    
    return normalized

# Pipeline preprocessing gambar dengan deteksi objek
def process_image_with_object_detection(image: Image.Image, target_size: Tuple[int, int] = (224, 224)) -> Image.Image:
    try:
        # Import object detector
        from src.core.models.object_detection import ObjectDetector
        detector = ObjectDetector()
        
        # Crop to main object if possible
        cropped_image = detector.crop_main_object(image)
        
        # Continue with normal preprocessing
        processed_image = preprocess_image(cropped_image, target_size)
        
        return processed_image
    except Exception as e:
        print(f"Error in object detection preprocessing: {e}")
        # Fallback to normal preprocessing if object detection fails
        return preprocess_image(image, target_size)

# Terapkan adaptive histogram equalization untuk meningkatkan kontras lokal
def adaptive_histogram_equalization(image: Image.Image) -> Image.Image:
    # Convert PIL to OpenCV
    img_array = np.array(image)
    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    # Convert to LAB color space
    lab = cv2.cvtColor(img_array, cv2.COLOR_BGR2LAB)
    
    # Split LAB channels
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE to L channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    
    # Merge channels back
    limg = cv2.merge((cl, a, b))
    
    # Convert back to RGB
    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB)
    
    # Convert back to PIL
    return Image.fromarray(enhanced)


# Normalisasi sesuai dengan ekspektasi model CLIP
def normalize_for_model(image_array: np.ndarray) -> np.ndarray:
    # Normalisasi ke [0, 1]
    normalized = image_array.astype(np.float32) / 255.0
    
    # Standardisasi dengan mean dan std yang digunakan CLIP
    mean = np.array([0.48145466, 0.4578275, 0.40821073])
    std = np.array([0.26862954, 0.26130258, 0.27577711])
    
    # Terapkan normalisasi per channel (untuk format HWC)
    normalized = (normalized - mean) / std
    
    return normalized