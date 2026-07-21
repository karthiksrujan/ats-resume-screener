import os
import shutil
from pathlib import Path
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.config import UPLOAD_DIR, SAMPLE_DATA_DIR
from backend.parser import parse_resume
from backend.screener import screen_resume, HAS_GEMINI
from backend.generator import generate_ats_pdf, generate_ats_docx

app = FastAPI(title="Rooman AI Resume Screener API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve Frontend static assets
# Check if frontend directory exists, if not we will create it next
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
FRONTEND_DIR.mkdir(exist_ok=True)

# Mount the static directory
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
def read_root():
    """Serves the main single-page application dashboard."""
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend index.html not found.")
    return FileResponse(index_path)

@app.get("/api/config")
def get_api_config():
    """Returns the backend configuration status (e.g., if Gemini LLM is active)."""
    return {
        "has_gemini": HAS_GEMINI,
        "mode": "Cognitive LLM Mode (Gemini)" if HAS_GEMINI else "Local Heuristic Mode (TF-IDF Fallback)"
    }

@app.get("/api/sample-jds")
def get_sample_jds():
    """Loads and returns the pre-configured sample Job Descriptions."""
    jd_dir = SAMPLE_DATA_DIR / "job_descriptions"
    if not jd_dir.exists():
        return {}
        
    jds = {}
    for path in jd_dir.glob("*.txt"):
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                jds[path.stem] = f.read().strip()
        except Exception as e:
            print(f"Error loading sample JD {path.name}: {e}")
            
    return jds

@app.post("/api/screen")
async def screen_resumes(
    jd: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Main upload endpoint. Saves files, parses them, screens each resume, 
    and returns a ranked list.
    """
    if not jd.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    if not files:
        raise HTTPException(status_code=400, detail="No resumes uploaded.")

    results = []
    
    # Process files
    for file in files:
        # Validate extension
        suffix = Path(file.filename).suffix.lower()
        if suffix not in [".pdf", ".docx", ".txt"]:
            # Skip unsupported formats
            continue
            
        # Safe save filepath
        temp_path = UPLOAD_DIR / file.filename
        
        try:
            # Write uploaded bytes to disk
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Parse text
            resume_text = parse_resume(temp_path)
            
            if not resume_text:
                continue
                
            # Run screening engine
            analysis = screen_resume(resume_text, jd)
            analysis["file_name"] = file.filename
            results.append(analysis)
            
        except Exception as e:
            print(f"Failed to process {file.filename}: {e}")
            # We continue processing other files even if one fails
            
        finally:
            # Clean up uploaded file
            if temp_path.exists():
                os.remove(temp_path)

    if not results:
        raise HTTPException(
            status_code=400, 
            detail="Could not process any of the uploaded resumes. Please ensure they are valid PDF, DOCX or TXT files."
        )

    # Rank candidates by total score descending
    results.sort(key=lambda x: x["scores"]["total_score"], reverse=True)
    
    return {
        "success": True,
        "count": len(results),
        "candidates": results
    }

@app.post("/api/generate-resume-pdf")
async def generate_resume_pdf(data: dict, background_tasks: BackgroundTasks):
    """Generates an ATS-compliant PDF resume from form data."""
    try:
        file_path = generate_ats_pdf(data)
        background_tasks.add_task(os.remove, file_path)
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@app.post("/api/generate-resume-docx")
async def generate_resume_docx(data: dict, background_tasks: BackgroundTasks):
    """Generates an ATS-compliant DOCX resume from form data."""
    try:
        file_path = generate_ats_docx(data)
        background_tasks.add_task(os.remove, file_path)
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate DOCX: {str(e)}")
