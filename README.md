# Rooman AI — Resume Screening Agent (Selection Round Submission)

An elegant, end-to-end recruitment screening system that parses multiple resumes in varying formats (`.pdf`, `.docx`, `.txt`), matches them against a target Job Description using custom NLP text similarity or advanced Gemini LLM evaluation, and outputs a ranked, structured candidate shortlist.

This agent is built as a hybrid application, providing both a **Command-Line Interface (CLI)** and a high-fidelity, interactive **Glassmorphic Web Dashboard**.

---

## 🌟 Key Features

* **Multi-Format Parsing**: Extracts text from PDF, DOCX, and TXT files natively.
* **Dual Screening Modes**:
  * **Cognitive LLM Mode (Gemini)**: Uses `gemini-1.5-flash` to evaluate candidate fits dynamically across 4 dimensions: Technical Skills, Experience Relevance, Education Fit, and Soft Skills. Extracts contact details, strengths, gaps, and generates candidate-specific interview questions.
  * **Local Heuristic Mode (TF-IDF & Cosine Similarity)**: Works out-of-the-box using a pure-Python TF-IDF and Cosine Similarity vector engine, allowing full evaluation without any internet access or API credentials.
* **Ranked Outputs**: Orders candidates descending by match score and groups them into 4 fit tiers (*Highly Recommended*, *Good Fit*, *Borderline*, *Not Recommended*).
* **CLI & Web Dashboard**: Run evaluations via simple terminal scripts or explore candidates in a gorgeous, fully animated glassmorphic dashboard.
* **Export Shortlists**: Download evaluation shortlists instantly as CSV or JSON files.

---

## 🛠️ Installation & Setup

Ensure you have **Python 3.10+** and **pip** installed.

### 1. Clone & Initialize
Open your terminal and navigate to the project directory:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment (Optional for Cognitive Mode)
Create a `.env` file in the project root:
```bash
echo "GEMINI_API_KEY=your_actual_api_key_here" > .env
```
> **Note**: If the `.env` file is absent or `GEMINI_API_KEY` is not provided, the agent automatically falls back to **Local Heuristic Mode** and runs using local NLP cosine similarities.

---

## 🚀 How to Run the Agent

### Method A: Web UI Dashboard (Recommended)
Launch the FastAPI backend server and automatically open the Web UI in your default browser by running:
```bash
python run.py
```
If your browser does not open automatically, visit: [http://127.0.0.1:8000](http://127.0.0.1:8000)

**Using the Web UI**:
1. Select a quick template Job Description (e.g. Software Engineer, Data Scientist, Product Manager) or paste your own.
2. Drag and drop or browse the resumes under `sample_data/resumes/` to load them into the queue.
3. Click **Run Screen Pipeline**.
4. Review the candidate list. Click any card to slide open the detail inspection drawer showing metric graphs, strengths, gaps, and interview questions.
5. Click **Export CSV** or **Export JSON** to save the shortlist.

### Method B: Command Line Interface (CLI)
You can run the screening pipeline directly inside your terminal using `cli.py`:
```bash
python cli.py --jd sample_data/job_descriptions/software_engineer.txt --resumes sample_data/resumes/ --output shortlist.csv
```
This prints a beautiful formatted ASCII grid showing the ranked candidates directly on your terminal and saves the shortlist to `shortlist.csv`.

---

## 📐 Scoring Method & NLP Similarity Details

The agent applies two different mathematical methodologies depending on the execution mode:

### 1. Local Heuristic Mode (TF-IDF & Cosine Similarity)
* **Tokenization**: Resumes and the Job Description are lowercased, stripped of non-alphanumeric characters, and split into individual word tokens.
* **Stopwords Filtering**: Common English grammatical stopwords (e.g., *the, is, an, which*) are filtered out using an optimized local stopwords set.
* **TF-IDF Vectorization**: A term-frequency and inverse-document-frequency matrix is generated in pure Python:
  $$\text{TF}(t, d) = \text{Count}(t \text{ in } d)$$
  $$\text{IDF}(t) = \log\left(\frac{N}{\text{DF}(t)}\right) + 1$$
* **Cosine Similarity**: The cosine angle between the JD vector $\vec{A}$ and candidate vector $\vec{B}$ is computed:
  $$\text{Cosine Similarity} = \frac{\vec{A} \cdot \vec{B}}{\|\vec{A}\| \|\vec{B}\|}$$
* **Score Scaling**: Since standard document cosine similarities range between $0.05$ and $0.33$, we apply a scaling factor of $300.0$ to map matches realistically onto a $0-100\%$ scale:
  $$\text{Match Score} = \min(100.0, \text{Cosine Similarity} \times 300.0)$$

### 2. Cognitive LLM Mode (Gemini)
* When a `GEMINI_API_KEY` is configured, the agent constructs an evaluation instruction set detailing strict parameter boundaries.
* The model returns a structured JSON payload scoring candidates $0-100$ on 4 parameters: Technical Skills, Experience, Education, and Soft Skills.
* The final weighted average calculates the candidate's **Suite Score**.

---

## ⚖️ Design Choices & Tradeoffs

### 1. Pure-Python TF-IDF Engine vs. Heavy Libraries (Scikit-Learn/NLTK)
* **Choice**: We implemented the TF-IDF and Cosine Similarity calculation in pure Python using standard library math.
* **Tradeoff**: Avoided introducing massive dependencies like `numpy`, `scipy`, or `scikit-learn` which take minutes to download and can fail on host systems due to wheel compilation issues. The pure-Python implementation executes in milliseconds and is 100% reliable out-of-the-box.

### 2. File Extractor Parsing Heuristics
* **Choice**: Natively parsing DOCX (via `python-docx`), PDF (via `pypdf`), and plain text.
* **Tradeoff**: Opted for lightweight parsers rather than full OCR engines like Tesseract, meaning scanned image-only PDF resumes won't extract text. However, 99% of digital resumes are exported as text-based PDFs/Word docs, keeping operations fast and simple.

---

## 📂 Deliverables Included

1. **Job Descriptions (`sample_data/job_descriptions/`)**:
   * `software_engineer.txt`
   * `data_scientist.txt`
   * `product_manager.txt`
2. **Sample Resumes (`sample_data/resumes/`)**:
   * 12 distinct mock resumes representing highly qualified, moderately qualified, borderline, and unrelated profiles in PDF, DOCX, and TXT formats.
3. **Ranked Output (`shortlist.csv`)**:
   * A pre-generated ranked CSV file from our validation runs.
