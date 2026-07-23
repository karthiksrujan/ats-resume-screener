import pytest
from backend.screener import screen_resume, calculate_cosine_similarity, clean_and_tokenize

def test_tokenize():
    text = "We are seeking a Senior Fullstack Developer proficient in Python and React."
    tokens = clean_and_tokenize(text)
    assert len(tokens) > 0
    assert "python" in tokens
    assert "react" in tokens

def test_cosine_similarity():
    jd = "Python FastAPI Backend Developer with PostgreSQL and Docker knowledge."
    resume_good = "Senior Python Developer skilled in FastAPI, PostgreSQL, Docker containers, and REST APIs."
    resume_poor = "Sales Manager with 10 years experience in retail store management and marketing."
    
    score_good = calculate_cosine_similarity(jd, resume_good)
    score_poor = calculate_cosine_similarity(jd, resume_poor)
    
    assert score_good > score_poor
    assert score_good > 0.3

def test_screen_resume_cybersecurity_boost():
    soc_jd = "SOC Analyst Intern required. Must monitor security events, analyze logs, and understand ethical hacking concepts."
    ceh_resume = "M. Karthik Srujan. Certified Ethical Hacker (CEH) with experience in Cyber Security and network penetration testing."
    
    result = screen_resume(ceh_resume, soc_jd)
    
    assert result["candidate_name"] is not None
    assert result["scores"]["total_score"] >= 40.0
    assert result["tier"] in ["Good Fit", "Highly Recommended", "Borderline"]
    assert "matched_keywords" in result
    assert "missing_keywords" in result
