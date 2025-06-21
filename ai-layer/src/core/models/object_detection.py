import cv2
import numpy as np
import tensorflow as tf
from PIL import Image
from io import BytesIO

class ObjectDetector:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ObjectDetector, cls).__new__(cls)
            cls._instance.model = None
            cls._instance._load_model()
        return cls._instance
    
    # Load MobileNet SSD model for object detection
    def _load_model(self):
        try:
            print("Loading object detection model...")
            # Use TensorFlow's saved model format
            self.model = tf.saved_model.load("models/efficientdet_d0_coco17")
            print("Object detection model loaded successfully")
        except Exception as e:
            print(f"Error loading object detection model: {e}")
            # Fallback to using TF Hub model
            try:
                import tensorflow_hub as hub
                self.model = hub.load("https://tfhub.dev/tensorflow/efficientdet/d0/1")
                print("Loaded EfficientDet D0 from TF Hub")
            except Exception as hub_e:
                print(f"Error loading TF Hub model: {hub_e}")
                self.model = None
    
    # Detect objects in the given image
    def detect_objects(self, image, threshold=0.3):
        if self.model is None:
            print("Warning: Object detection model not loaded. Skipping detection.")
            return None, None
        
        if isinstance(image, Image.Image):
            # Convert PIL Image to numpy array
            img_array = np.array(image.convert("RGB"))
        else:
            img_array = np.array(image)
        
        # Convert to RGB if it's BGR (from OpenCV)
        if img_array.shape[-1] == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
        
        # Get image dimensions
        height, width, _ = img_array.shape
        
        # Prepare input for model
        input_tensor = tf.convert_to_tensor(img_array)
        input_tensor = input_tensor[tf.newaxis, ...]
        
        # Run inference
        try:
            result = self.model(input_tensor)
            
            # Process results
            boxes = result["detection_boxes"][0].numpy()
            scores = result["detection_scores"][0].numpy()
            classes = result["detection_classes"][0].numpy().astype(np.int32)
            
            # Filter by threshold
            valid_indices = scores >= threshold
            valid_boxes = boxes[valid_indices]
            valid_scores = scores[valid_indices]
            valid_classes = classes[valid_indices]
            
            # Convert normalized coordinates to pixel coordinates
            boxes_pixels = []
            for box in valid_boxes:
                ymin, xmin, ymax, xmax = box
                boxes_pixels.append([
                    int(xmin * width),
                    int(ymin * height),
                    int(xmax * width),
                    int(ymax * height)
                ])
            
            return boxes_pixels, valid_scores
            
        except Exception as e:
            print(f"Error running object detection: {e}")
            return None, None
    
    # Crop the main object from the image
    def crop_main_object(self, image):
        boxes, scores = self.detect_objects(image)
        
        if boxes is None or len(boxes) == 0:
            # Return original image if no objects detected
            return image
        
        # Get box with highest confidence
        best_box = boxes[np.argmax(scores)]
        xmin, ymin, xmax, ymax = best_box
        
        # Crop the image
        if isinstance(image, Image.Image):
            cropped = image.crop((xmin, ymin, xmax, ymax))
        else:
            cropped = image[ymin:ymax, xmin:xmax]
            cropped = Image.fromarray(cropped)
        
        # Ensure minimum size
        if cropped.width < 50 or cropped.height < 50:
            return image
        
        return cropped