import os
import re
import json
import math
from typing import Dict, Any, List, Tuple
from pathlib import Path
from backend.config import GEMINI_API_KEY

# Try importing generativeai, catch error if not configured
try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        HAS_GEMINI = True
    else:
        HAS_GEMINI = False
except ImportError:
    HAS_GEMINI = False

# Stopwords for TF-IDF fallback
STOPWORDS = {
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", 
    "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", 
    "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", 
    "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", 
    "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", 
    "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", 
    "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", 
    "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", 
    "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", 
    "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", 
    "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", 
    "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
}

# Common skills for fallback regex extraction
COMMON_SKILLS = [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "ruby", "rust", "php",
    "fastapi", "django", "flask", "spring", "react", "angular", "vue", "node", "express",
    "postgresql", "mysql", "sqlite", "mongodb", "redis", "cassandra", "dynamodb",
    "aws", "gcp", "azure", "docker", "kubernetes", "git", "github", "ci/cd", "jenkins",
    "machine learning", "deep learning", "pytorch", "tensorflow", "pandas", "numpy", 
    "scikit-learn", "scrum", "agile", "jira", "tableau", "mixpanel", "sql", "excel",
    "product strategy", "product roadmap", "user research", "market analysis",
    "html", "css", "rest apis", "graphql", "system design", "microservices"
]

def clean_and_tokenize(text: str) -> List[str]:
    """Lowercase, strip non-alphanumeric, and split text into tokens, removing stopwords."""
    text = text.lower()
    # Replace non-alphanumeric chars with spaces
    text = re.sub(r'[^a-z0-9\s-]', ' ', text)
    tokens = text.split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]

def calculate_cosine_similarity(text1: str, text2: str) -> float:
    """Calculate Cosine Similarity using TF-IDF representation of texts (Pure Python)."""
    tokens1 = clean_and_tokenize(text1)
    tokens2 = clean_and_tokenize(text2)
    
    if not tokens1 or not tokens2:
        return 0.0
        
    # Vocabulary
    vocab = set(tokens1 + tokens2)
    
    # Term Frequencies
    tf1 = {word: tokens1.count(word) for word in vocab}
    tf2 = {word: tokens2.count(word) for word in vocab}
    
    # Document Frequencies (here we only have 2 documents in our corpus)
    df = {}
    for word in vocab:
        count = 0
        if word in tokens1: count += 1
        if word in tokens2: count += 1
        df[word] = count
        
    # TF-IDF vectors
    # Using log(2/df) + 1 for IDF
    idf = {word: math.log(2.0 / df[word]) + 1.0 for word in vocab}
    
    vec1 = [tf1[word] * idf[word] for word in vocab]
    vec2 = [tf2[word] * idf[word] for word in vocab]
    
    # Compute dot product
    dot_product = sum(v1 * v2 for v1, v2 in zip(vec1, vec2))
    
    # Compute magnitudes
    mag1 = math.sqrt(sum(v ** 2 for v in vec1))
    mag2 = math.sqrt(sum(v ** 2 for v in vec2))
    
    if mag1 == 0 or mag2 == 0:
        return 0.0
        
    return dot_product / (mag1 * mag2)

def fallback_parser_extractor(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Extracts structured fields from resume text and computes similarity using TF-IDF.
    Acts as a robust local fallback when LLM keys are absent.
    """
    # 1. Score Candidate using cosine similarity scaled to 0-100
    similarity = calculate_cosine_similarity(jd_text, resume_text)
    match_score = min(100.0, round(similarity * 300.0, 1))
    
    # 2. Extract Candidate Name (heuristically, look at the first few lines)
    lines = [line.strip() for line in resume_text.split('\n') if line.strip()]
    candidate_name = "Unknown Candidate"
    for line in lines[:5]:
        if "candidate:" in line.lower():
            candidate_name = line.split(":", 1)[1].strip()
            break
        # Match common name patterns or just pick the first short line that isn't email/phone
        if not re.search(r'@|\+1|\d{3,}', line) and len(line) < 30 and not line.lower().startswith("resume"):
            candidate_name = line
            break
            
    # 3. Extract contact info using RegEx
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', resume_text)
    candidate_email = email_match.group(0) if email_match else "N/A"
    
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', resume_text)
    candidate_phone = phone_match.group(0) if phone_match else "N/A"
    
    # 4. Extract Skills (Check intersection with predefined common skills)
    resume_lower = resume_text.lower()
    extracted_skills = []
    for skill in COMMON_SKILLS:
        # Use word boundaries for skills
        if re.search(r'\b' + re.escape(skill) + r'\b', resume_lower):
            extracted_skills.append(skill.title())
            
    # 5. Extract Education (Regex heuristics)
    education_lines = []
    in_edu_section = False
    for line in resume_text.split('\n'):
        line_lower = line.lower()
        if "education" in line_lower:
            in_edu_section = True
            continue
        if in_edu_section:
            if any(h in line_lower for h in ["experience", "skills", "history", "projects", "employment"]):
                break
            if line.strip():
                education_lines.append(line.strip())
    education = " | ".join(education_lines[:2]) if education_lines else "Education section parsed, refer to resume."
    
    # 6. Experience Years estimation
    years = 1.0
    year_matches = re.findall(r'(\d+)\s+years?', resume_lower)
    if year_matches:
        years = float(max(int(y) for y in year_matches))
    else:
        # Heuristic from date ranges (e.g. 2020 - 2024)
        dates = re.findall(r'\b(20\d{2})\b', resume_text)
        if len(dates) >= 2:
            years = float(max(1, int(dates[0]) - int(dates[-1])))

    # 7. Formulate feedback
    jd_skills = [s.title() for s in COMMON_SKILLS if re.search(r'\b' + re.escape(s) + r'\b', jd_text.lower())]
    matched_skills = [s for s in extracted_skills if s in jd_skills]
    missing_skills = [s for s in jd_skills if s not in extracted_skills]
    
    strengths = [f"Strong match for skills: {', '.join(matched_skills[:4])}"] if matched_skills else ["Text matches some JD terms."]
    gaps = [f"Missing key JD skills: {', '.join(missing_skills[:4])}"] if missing_skills else ["No major skill gaps identified."]
    
    # 8. Cybersecurity Domain Credential Boosting
    is_security_jd = any(k in jd_text.lower() for k in ["security", "cyber", "soc", "siem", "vulnerability", "firewall", "incident"])
    sec_boost_applied = False
    found_sec_keywords = []
    if is_security_jd:
        security_keywords = ["ceh", "ethical hacker", "ethical hacking", "security+", "cyber security", "cybersecurity", "information security", "comptia", "penetration", "soc analyst"]
        found_sec_keywords = list(set([k for k in security_keywords if k in resume_text.lower()]))
        if found_sec_keywords:
            boost = min(40.0, len(found_sec_keywords) * 15.0)
            match_score = min(100.0, match_score + boost)
            sec_boost_applied = True
            if "Ceh" not in strengths:
                strengths.append(f"Holds active security credentials: {', '.join([k.upper() for k in found_sec_keywords])}")

    # Recommendations & Rating tiers
    if match_score >= 80:
        tier = "Highly Recommended"
        recommendation = "Highly qualified candidate. Recommend immediate technical interview."
    elif match_score >= 50:
        tier = "Good Fit"
        recommendation = "Qualified candidate. Proceed to recruiter screen."
        if sec_boost_applied:
            recommendation = f"Good Fit. Candidate has active security credentials ({', '.join([k.upper() for k in found_sec_keywords])}) matching the cybersecurity role, though primary experience is in Full Stack development."
    elif match_score >= 25:
        tier = "Borderline"
        recommendation = "Partial match. Hold for review against other candidates."
        if sec_boost_applied:
            recommendation = f"Borderline. Candidate has security certifications ({', '.join([k.upper() for k in found_sec_keywords])}) but their overall experience is developer-focused."
    else:
        tier = "Not Recommended"
        recommendation = "Low keyword match. Recommend rejection."

    scores = {
        "technical_skills": min(100, int(match_score * 1.1)),
        "experience_relevance": min(100, int(match_score * 1.0)),
        "education_fit": 70 if "degree" in education.lower() or "bs" in education.lower() or "ms" in education.lower() or "mca" in education.lower() or "bca" in education.lower() else 50,
        "soft_skills": 70,
        "total_score": match_score
    }

    interview_questions = [
        f"Can you explain your experience working with {matched_skills[0]}?" if matched_skills else "Can you describe a challenging engineering project you worked on?",
        "Can you walk us through a recent project listed on your resume?",
        "What are your expectations for this role?"
    ]

    return {
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "candidate_phone": candidate_phone,
        "skills_extracted": extracted_skills[:12],
        "matched_keywords": matched_skills,
        "missing_keywords": missing_skills,
        "experience_years": years,
        "education_extracted": education or "Not Specified",
        "scores": scores,
        "justification": recommendation,
        "strengths": strengths,
        "gaps": gaps,
        "interview_questions": interview_questions,
        "tier": tier,
        "mode": "Local Heuristic Mode (TF-IDF)"
    }

def screen_resume_llm(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Screens resume using Gemini API and parses structured details.
    """
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""
You are an expert technical recruiter. Screen the candidate's resume against the Job Description (JD).
Evaluate the candidate in detail.

Job Description:
{jd_text}

Resume:
{resume_text}

You must return your output ONLY as a JSON object matching the schema below. Do not include markdown code block formatting (like ```json) in your raw response, return only the raw string.
Your JSON object must strictly match this structure:
{{
  "candidate_name": "Full Name of Candidate (default: 'Unknown')",
  "candidate_email": "Email address (default: 'N/A')",
  "candidate_phone": "Phone number (default: 'N/A')",
  "skills_extracted": ["List", "of", "top", "skills", "found"],
  "matched_keywords": ["list", "of", "skills", "matching", "the", "JD"],
  "missing_keywords": ["list", "of", "essential", "skills", "missing", "from", "the", "JD"],
  "experience_years": 4.5, // Estimated years of relevant experience as a float
  "education_extracted": "Highest degree and school",
  "scores": {{
    "technical_skills": 85, // Integer 0-100
    "experience_relevance": 90, // Integer 0-100
    "education_fit": 80, // Integer 0-100
    "soft_skills": 75, // Integer 0-100
    "total_score": 82.5 // Weighted average of the above scores as a float
  }},
  "justification": "A paragraph explaining the scoring, fit, and rationale.",
  "strengths": ["Strength 1", "Strength 2"],
  "gaps": ["Gap 1 or missing skill/experience", "Gap 2"],
  "interview_questions": ["Tailored Question 1 based on gaps", "Tailored Question 2"],
  "tier": "Highly Recommended" // Choose exactly one: "Highly Recommended", "Good Fit", "Borderline", "Not Recommended"
}}
"""

    response = model.generate_content(prompt)
    response_text = response.text.strip()
    
    # Strip markdown block code format if Gemini included it
    if response_text.startswith("```"):
        # Remove first line
        lines = response_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        response_text = "\n".join(lines).strip()
        
    try:
        data = json.loads(response_text)
        data["mode"] = "Cognitive LLM Mode (Gemini)"
        
        # Ensure matched and missing keywords exist
        if "matched_keywords" not in data or "missing_keywords" not in data:
            extracted = [s.lower() for s in data.get("skills_extracted", [])]
            jd_skills = [s.lower() for s in COMMON_SKILLS if re.search(r'\b' + re.escape(s) + r'\b', jd_text.lower())]
            data["matched_keywords"] = [s.title() for s in extracted if s in jd_skills]
            data["missing_keywords"] = [s.title() for s in jd_skills if s not in extracted]
            
        return data
    except Exception as e:
        # Fallback to local regex/TF-IDF parser if JSON parsing fails
        print(f"JSON parsing error from LLM response: {e}. Falling back to TF-IDF parser.")
        print(f"Raw Response: {response_text}")
        return fallback_parser_extractor(resume_text, jd_text)

def screen_resume(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Entry point for screening a single resume. Dispatches to LLM mode if
    Gemini is available, otherwise uses the local TF-IDF matcher.
    """
    if HAS_GEMINI:
        try:
            return screen_resume_llm(resume_text, jd_text)
        except Exception as e:
            print(f"Gemini API call failed ({e}). Falling back to local TF-IDF matcher.")
            return fallback_parser_extractor(resume_text, jd_text)
    else:
        return fallback_parser_extractor(resume_text, jd_text)
