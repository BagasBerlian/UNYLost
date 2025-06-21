import numpy as np
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import random
from typing import List, Tuple


# Flip gambar secara horizontal
def horizontal_flip(image: Image.Image) -> Image.Image:
    return ImageOps.mirror(image)

# Sesuaikan brightness gambar dengan faktor random dalam range
def adjust_brightness(image: Image.Image, factor_range=(0.8, 1.2)) -> Image.Image:
    factor = random.uniform(*factor_range)
    enhancer = ImageEnhance.Brightness(image)
    return enhancer.enhance(factor)

# Sesuaikan contrast gambar dengan faktor random dalam range
def adjust_contrast(image: Image.Image, factor_range=(0.8, 1.2)) -> Image.Image:
    factor = random.uniform(*factor_range)
    enhancer = ImageEnhance.Contrast(image)
    return enhancer.enhance(factor)


# Rotasi gambar dengan sudut random dalam range
def rotate_image(image: Image.Image, angle_range=(-15, 15)) -> Image.Image:
    angle = random.uniform(*angle_range)
    return image.rotate(angle, Image.BICUBIC, expand=False)


# Terapkan augmentasi acak pada gambar
def apply_random_augmentation(image: Image.Image) -> Image.Image:
    # Copy gambar untuk menghindari modifikasi in-place
    img = image.copy()
    
    # Daftar augmentasi yang mungkin
    augmentations = [
        horizontal_flip,
        adjust_brightness,
        adjust_contrast,
        rotate_image
    ]
    
    # Pilih 1-2 augmentasi acak
    num_augmentations = random.randint(1, 2)
    selected_augmentations = random.sample(augmentations, num_augmentations)
    
    # Terapkan augmentasi yang dipilih
    for augmentation in selected_augmentations:
        img = augmentation(img)
    
    return img

# Hasilkan beberapa versi augmentasi dari gambar
def generate_augmented_images(image: Image.Image, num_augmentations: int = 3) -> List[Image.Image]:
    augmented_images = [image]  # Selalu sertakan gambar asli
    
    for _ in range(num_augmentations):
        augmented = apply_random_augmentation(image)
        augmented_images.append(augmented)
    
    return augmented_images