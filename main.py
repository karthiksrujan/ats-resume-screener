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
from backend.screener import screen_resume, HAS_GEMINI, genai
from backend.generator import generate_ats_pdf, generate_ats_docx, generate_cover_letter_pdf

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

def generate_heuristic_cover_letter(name: str, jd: str, resume_text: str) -> str:
    import re
    # Extract some details heuristically
    # Job Title extraction
    jd_lines = [l.strip() for l in jd.split('\n') if l.strip()]
    job_title = "Technical Role"
    for line in jd_lines[:3]:
        if "title:" in line.lower() or "role:" in line.lower() or "position:" in line.lower():
            job_title = line.split(":", 1)[1].strip()
            break
        if "engineer" in line.lower() or "developer" in line.lower() or "scientist" in line.lower() or "manager" in line.lower():
            job_title = line
            break
            
    # Contact info / company
    company_name = "your esteemed organization"
    for line in jd_lines[:5]:
        if "company:" in line.lower() or "organization:" in line.lower():
            company_name = line.split(":", 1)[1].strip()
            break
            
    # Skills extraction from resume
    from backend.screener import COMMON_SKILLS
    found_skills = []
    for skill in COMMON_SKILLS:
        if re.search(r'\b' + re.escape(skill) + r'\b', resume_text.lower()):
            found_skills.append(skill.title())
            
    skills_sentence = ""
    if found_skills:
        skills_sentence = f" Throughout my career, I have developed expertise in key technical areas including {', '.join(found_skills[:4])}."
        
    letter = f"""Dear Hiring Team,

I am writing to express my enthusiastic interest in the {job_title} position at {company_name}. With my background in engineering, software development, and technical problem solving, I am confident that I can bring valuable contributions to your team.

My technical background aligns well with the requirements outlined in the job description.{skills_sentence} I have a proven track record of analyzing technical requirements, designing reliable implementations, and collaborating with cross-functional teams to deploy high-quality software solutions.

I am particularly drawn to {company_name} because of your commitment to technical innovation and excellence. I am excited about the opportunity to apply my skills to help solve your complex technical challenges and contribute to your ongoing success.

Thank you for your time and consideration. I welcome the opportunity to discuss my qualifications in a formal interview.

Sincerely,
{name}"""
    return letter

@app.post("/api/generate-cover-letter")
def generate_cover_letter(payload: dict):
    """Generates a professional cover letter based on resume text and JD."""
    jd = payload.get("jd", "")
    resume_text = payload.get("resume_text", "")
    candidate_name = payload.get("candidate_name", "Candidate")
    
    if not jd.strip() or not resume_text.strip():
        raise HTTPException(status_code=400, detail="Job description and resume text are required.")
        
    if HAS_GEMINI:
        try:
            model = genai.GenerativeModel('gemini-2.0-flash')
            prompt = f"""
You are an expert career coach. Write a highly tailored, professional cover letter for a candidate applying to a job.
Align the candidate's skills and experiences from their resume to the requirements of the job description.

Job Description:
{jd}

Candidate's Resume:
{resume_text}

Guidelines:
1. Keep the cover letter professional, engaging, and to-the-point (3-4 paragraphs).
2. Avoid generic boilerplate templates. Make it read naturally and address key requirements in the JD.
3. Start directly with the date, greeting, and body. Do not include extra preambles.
4. If candidate contact info is not clear, use placeholders.
            """
            response = model.generate_content(prompt)
            return {"success": True, "cover_letter": response.text.strip()}
        except Exception as e:
            print(f"Gemini Cover Letter Generation failed: {e}")
            
    # Heuristic fallback cover letter generator
    cover_letter = generate_heuristic_cover_letter(candidate_name, jd, resume_text)
    return {"success": True, "cover_letter": cover_letter}

@app.post("/api/generate-cover-letter-pdf")
async def generate_cl_pdf(data: dict, background_tasks: BackgroundTasks):
    """Generates a professional PDF cover letter."""
    try:
        file_path = generate_cover_letter_pdf(data)
        background_tasks.add_task(os.remove, file_path)
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
