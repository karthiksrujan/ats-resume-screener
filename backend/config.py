import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# App configurations
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

# Gemini configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Sample data path
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
UPLOAD_DIR = BASE_DIR / "uploads"

# Ensure upload directory exists
UPLOAD_DIR.mkdir(exist_ok=True)
