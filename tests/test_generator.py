import pytest
from pathlib import Path
from backend.generator import generate_ats_pdf, generate_ats_docx, generate_cover_letter_pdf

def test_generate_ats_pdf():
    resume_data = {
        "name": "Alexander Sterling",
        "email": "alex@example.com",
        "phone": "+1 555-0192",
        "location": "San Francisco, CA",
        "linkedin": "linkedin.com/in/alex",
        "summary": "Experienced Cloud Architect with 10 years experience.",
        "skills": "AWS, GCP, Docker, Kubernetes, Terraform",
        "experience": [
            {
                "title": "Lead Engineer",
                "company": "Tech Corp",
                "dates": "2020-Present",
                "location": "SF, CA",
                "description": "- Scaled microservices architecture.\n- Reduced infrastructure cost."
            }
        ],
        "education": [
            {
                "degree": "BS Computer Science",
                "school": "UC Berkeley",
                "dates": "2018",
                "location": "Berkeley, CA"
            }
        ]
    }
    
    result_path = generate_ats_pdf(resume_data)
    assert Path(result_path).exists()
    assert Path(result_path).stat().st_size > 0

def test_generate_ats_docx():
    resume_data = {
        "name": "Alexander Sterling",
        "email": "alex@example.com",
        "skills": "Python, FastAPI",
        "experience": [],
        "education": []
    }
    
    result_path = generate_ats_docx(resume_data)
    assert Path(result_path).exists()
    assert Path(result_path).stat().st_size > 0

def test_generate_cover_letter_pdf():
    cl_data = {
        "name": "Alexander Sterling",
        "email": "alex@example.com",
        "phone": "+1 555-0192",
        "text": "Dear Hiring Manager,\n\nI am writing to express my strong interest in the Cloud Architect position..."
    }
    result_path = generate_cover_letter_pdf(cl_data)
    assert Path(result_path).exists()
    assert Path(result_path).stat().st_size > 0
