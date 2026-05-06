import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-biometrico")

    # Azure Face API
    AZURE_FACE_API_KEY      = os.getenv("AZURE_FACE_API_KEY", "")
    AZURE_FACE_ENDPOINT     = os.getenv("AZURE_FACE_ENDPOINT", "")
    FACE_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.6"))

    # Azure Fingerprint / Custom Vision (placeholder — configurable later)
    AZURE_FP_API_KEY        = os.getenv("AZURE_FP_API_KEY", "")
    AZURE_FP_ENDPOINT       = os.getenv("AZURE_FP_ENDPOINT", "")
    FP_CONFIDENCE_THRESHOLD = float(os.getenv("FP_CONFIDENCE_THRESHOLD", "0.7"))

    # AWS Rekognition
    AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION            = os.getenv("AWS_REGION", "us-east-1")

    # Set to "mock" to skip real Azure/AWS calls during development
    BIOMETRIC_MODE = os.getenv("BIOMETRIC_MODE", "mock")   # "mock" | "azure" | "aws"

    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
