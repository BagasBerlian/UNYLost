from PIL import Image
import numpy as np
from io import BytesIO
import base64
import requests
from typing import Union, Tuple

def load_image(image_source: Union[str, bytes]) -> Image.Image:
    try:
        if isinstance(image_source, str):
            if image_source.startswith(('http://', 'https://')):
                try:
                    response = requests.get(image_source, timeout=10, stream=True)
                    response.raise_for_status()
                    img = Image.open(BytesIO(response.content))
                except requests.exceptions.RequestException as e:
                    print(f"Error downloading image from URL: {str(e)}")
                    raise ValueError(f"Failed to download image from URL: {str(e)}")
            elif image_source.startswith('data:image'):
                base64_data = image_source.split(',')[1]
                img = Image.open(BytesIO(base64.b64decode(base64_data)))
            else:
                try:
                    img = Image.open(image_source)
                except (FileNotFoundError, PermissionError) as e:
                    print(f"Error opening image file: {str(e)}")
                    raise ValueError(f"Failed to open image file: {str(e)}")
        elif isinstance(image_source, bytes):
            img = Image.open(BytesIO(image_source))
        else:
            raise ValueError("Unsupported image source type")
        
        return img.convert('RGB')
    
    except Exception as e:
        print(f"Error in load_image: {str(e)}")
        raise ValueError(f"Error loading image: {str(e)}")

# Resize an image to the specified size
def resize_image(image: Image.Image, size: Tuple[int, int] = (224, 224)) -> Image.Image:
    return image.resize(size, Image.LANCZOS)

# Normalize image pixel values to [0, 1]
def normalize_image(image_array: np.ndarray) -> np.ndarray:
    return image_array / 255.0