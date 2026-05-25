import os
import uuid
import base64
import io
from PIL import Image
from flask import current_app

class ImageHandler:
    """Utility to handle image processing and storage."""
    
    @staticmethod
    def delete_image(url: str):
        """
        Deletes a physical image file from the static folder given its public URL.
        """
        if not url or not url.startswith("/api/candidatos/static/"):
            return
        
        try:
            # Extract folder and filename from URL: /api/candidatos/static/uploads/filename.webp
            parts = url.split("/")
            if len(parts) < 3:
                return
            
            filename = parts[-1]
            folder = parts[-2]
            
            static_dir = os.path.join(current_app.root_path, "static", folder)
            filepath = os.path.join(static_dir, filename)
            
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"File deleted: {filepath}")
        except Exception as e:
            print(f"Error deleting image: {e}")

    @staticmethod
    def save_base64_as_webp(base64_str: str, folder: str = "uploads") -> str:
        """
        Converts a base64 image string to WEBP format and saves it to the static folder.
        Returns the public URL path.
        """
        try:
            # 1. Clean the base64 string
            if "base64," in base64_str:
                base64_str = base64_str.split("base64,")[1]
            
            # 2. Decode the image
            img_data = base64.b64decode(base64_str)

            # Security: Check size (5MB limit)
            MAX_FILE_SIZE = 5 * 1024 * 1024
            if len(img_data) > MAX_FILE_SIZE:
                print("Image blocked: File exceeds 5MB limit.")
                return None

            img = Image.open(io.BytesIO(img_data))
            
            # Security: Validate format
            if img.format not in ["JPEG", "JPG", "PNG"]:
                print(f"Format {img.format} not allowed for security.")
                return None
            
            # Security: Re-encoding effectively strips malware/metadata
            # 3. Prepare storage path
            # We save in app/static/uploads
            static_dir = os.path.join(current_app.root_path, "static", folder)
            if not os.path.exists(static_dir):
                os.makedirs(static_dir)
            
            # 4. Generate unique filename
            filename = f"{uuid.uuid4().hex}.webp"
            filepath = os.path.join(static_dir, filename)
            
            # 5. Convert and Save as WebP
            # If image has alpha channel (RGBA), it handles it correctly in WebP
            img.save(filepath, "WEBP", quality=85)
            
            # 6. Return the URL (accessible via the gateway/proxy)
            # Assuming the gateway proxies /api/candidatos/static/ to ms_candidatos
            return f"/api/candidatos/static/{folder}/{filename}"
            
        except Exception as e:
            print(f"Error processing image: {e}")
            return None
