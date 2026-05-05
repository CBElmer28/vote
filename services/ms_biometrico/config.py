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

    # Set to "mock" to skip real Azure calls during development
    BIOMETRIC_MODE = os.getenv("BIOMETRIC_MODE", "mock")   # "mock" | "azure"

    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
