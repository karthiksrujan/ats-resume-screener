import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200

def test_get_api_config():
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "has_gemini" in data
    assert "mode" in data

def test_get_sample_jds():
    response = client.get("/api/sample-jds")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)

def test_generate_resume_pdf_api():
    payload = {
        "name": "Sarah Chen",
        "email": "sarah@example.com",
        "phone": "+1 555-0199",
        "location": "New York, NY",
        "summary": "Senior Architect",
        "skills": "React, TypeScript, Node.js",
        "experience": [],
        "education": []
    }
    response = client.post("/api/generate-resume-pdf", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
