# Rooman AI — Resume Screening & ATS Builder Agent

An elegant, end-to-end cognitive recruitment system that parses resumes in varying formats (`.pdf`, `.docx`, `.txt`), screens them against job descriptions using advanced AI or local heuristics, and features a built-in single-column ATS resume compiler.

Designed with a premium, light-theme **Neumorphic (Soft UI) Dashboard** and accompanied by a terminal CLI.

---

## 🔗 Live Deployment Links

*   🌐 **Live Web Application**: [http://romanresume.kesug.com](http://romanresume.kesug.com)
*   ⚙️ **Python FastAPI API Server**: [https://ats-resume-screener-1-jqlc.onrender.com](https://ats-resume-screener-1-jqlc.onrender.com)

---

## 🌟 Key Features

*   🔎 **Dual-Mode Resume Screening**:
    *   **Cognitive LLM Mode (Gemini)**: Employs `gemini-2.0-flash` to evaluate candidate fits dynamically across 4 dimensions: Technical Skills, Experience Relevance, Education Fit, and Soft Skills. Extracts contact details, strengths, gaps, and generates candidate-specific interview questions.
    *   **Smart Local Heuristic Mode (TF-IDF)**: Computes word-frequency cosine similarities in pure Python.
*   🛡️ **Cybersecurity Domain Boosting**:
    *   Detects if the target Job Description is a cybersecurity or SOC role.
    *   Scans resumes for key credentials (like **CEH - Certified Ethical Hacker**, **ethical hacking**, or **Cyber Security** certs) and automatically applies a matching boost (e.g. elevating candidates from ~14% to **55.2% / Good Fit**), adding specific highlights to their profile summary.
*   📝 **ATS Resume Builder & Compiler**:
    *   Built-in form to fill out contact details, experience history, education, and skills.
    *   **Download ATS PDF**: Generates standard, single-column, helvetica-spaced PDFs using `reportlab` that are guaranteed to pass parsing tests.
    *   **Download ATS Word (DOCX)**: Generates structured Word documents using `python-docx`.
*   📌 **Custom JD Quick Templates**:
    *   Paste any job description and click **+ Save Current** to name and save it as a quick-selection button. Custom templates persist across browser restarts using local storage.
*   📊 **Ranked Shortlists & Exports**:
    *   Ranks candidates descending by suitability and exports lists instantly to CSV or JSON formats.

---

## 📂 Project Structure

```
├── backend/
│   ├── generator.py    # ReportLab & python-docx resume compilers
│   ├── parser.py       # PDF, DOCX, and TXT extractors
│   ├── screener.py     # Gemini & TF-IDF similarity vectors with domain boosting
│   └── config.py       # Temp folders and setup configurations
├── frontend/
│   ├── index.html      # Neumorphic HTML interface
│   ├── style.css       # Soft neumorphic beveled layouts
│   └── app.js          # Main SPA dashboard manager (AJAX, dynamic forms, exports)
├── sample_data/
│   ├── job_descriptions/
│   │   ├── software_engineer.txt
│   │   ├── data_scientist.txt
│   │   ├── product_manager.txt
│   │   └── soc_intern.txt   # Mock SOC Intern cybersecurity JD
│   └── resumes/
│       ├── Resume-M.-KARTHIK-SRUJAN-BrothersTech-1.pdf # Copied test resume
│       └── [12 other mock candidate resumes in .pdf, .docx, .txt]
├── cli.py              # Command-line screening entrypoint
├── main.py             # FastAPI backend API routes
├── run.py              # Single-command local launcher
├── Dockerfile          # Container configuration (exposed on port 8000, binds to $PORT)
└── requirements.txt    # Python dependencies
```

---

## 🛠️ Installation & Local Setup

### 1. Initialize Virtual Environment
Navigate to the project directory and install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)
Create a `.env` file in the project root:
```bash
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
```
> **Note**: If the `.env` file is missing or the key has exceeded its free-tier quota limits, the agent automatically falls back to **Smart Local Heuristic Mode (TF-IDF)**.

---

## 🚀 How to Run Locally

### Method A: Web UI Dashboard
Launch the local server and interface automatically:
```bash
python run.py
```
Or open: [http://127.0.0.1:8000](http://127.0.0.1:8000)

### Method B: Command Line Interface (CLI)
Screen files directly via CLI:
```bash
python cli.py --jd sample_data/job_descriptions/soc_intern.txt --resumes sample_data/resumes/ --output shortlist.csv
```

---

## 📐 Local Similarity Calculation
*   **Tokenization & Stopwords**: Cleans and filters common English stopwords.
*   **TF-IDF**: Extracts word weights dynamically.
*   **Cosine Similarity**: Computes the vector angle between the resume and the JD.
*   **Boosting Rules**: Checks for domain certifications (e.g. CEH) during security screenings to adjust metrics realistically.
