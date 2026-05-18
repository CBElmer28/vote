import io
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Allowed MIME types
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_and_sanitize_image(image_bytes: bytes) -> bytes | None:
    """
    Validates that the bytes are a valid image, checks size, 
    and sanitizes it by re-saving it to strip metadata/malware.
    """
    if not image_bytes:
        return None

    # 1. Check size
    if len(image_bytes) > MAX_FILE_SIZE:
        logger.warning("Image upload blocked: File too large")
        return None

    try:
        # 2. Open image with Pillow (this validates the format/magic numbers)
        img = Image.open(io.BytesIO(image_bytes))
        
        # Check if format is allowed
        if img.format.lower() not in ALLOWED_EXTENSIONS:
            logger.warning(f"Image upload blocked: Unsupported format {img.format}")
            return None

        # 3. Sanitize: Re-save the image to a new bytes buffer.
        # This process strips EXIF metadata and ensures the structure is clean.
        output = io.BytesIO()
        
        # We convert to RGB to ensure no weird color profiles or hidden data in alpha channels
        # (unless it's a PNG/GIF where we might want to keep it, but for biometric/profile photos RGB is safer)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        img.save(output, format="JPEG", quality=90)
        sanitized_bytes = output.getvalue()
        
        logger.info("Image sanitized successfully")
        return sanitized_bytes

    except Exception as e:
        logger.error(f"Image validation failed: {str(e)}")
        return None
