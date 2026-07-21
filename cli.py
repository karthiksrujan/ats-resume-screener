#!/usr/bin/env python3
import os
import sys
import argparse
import csv
import json
from pathlib import Path
from tabulate import tabulate

# Add current directory to path to allow importing backend module
sys.path.append(str(Path(__file__).resolve().parent))

from backend.parser import parse_resume
from backend.screener import screen_resume

def main():
    parser = argparse.ArgumentParser(description="Rooman AI Resume Screening Agent (CLI)")
    parser.add_argument(
        "--jd", "-j",
        required=True,
        help="Path to the Job Description text file."
    )
    parser.add_argument(
        "--resumes", "-r",
        required=True,
        help="Path to the directory containing candidate resumes."
    )
    parser.add_argument(
        "--output", "-o",
        default="shortlist.csv",
        help="Path to save the ranked candidate CSV shortlist (default: shortlist.csv)."
    )
    args = parser.parse_args()

    # 1. Resolve paths
    jd_path = Path(args.jd)
    resumes_dir = Path(args.resumes)
    output_path = Path(args.output)

    if not jd_path.exists():
        print(f"Error: Job Description file not found at '{jd_path}'", file=sys.stderr)
        sys.exit(1)
    if not resumes_dir.exists() or not resumes_dir.is_dir():
        print(f"Error: Resumes directory not found at '{resumes_dir}'", file=sys.stderr)
        sys.exit(1)

    print("=" * 60)
    print("        ROOMAN AI RESUME SCREENING AGENT - RUNNING")
    print("=" * 60)

    # 2. Read Job Description
    try:
        with open(jd_path, "r", encoding="utf-8", errors="ignore") as f:
            jd_text = f.read().strip()
        print(f"Loaded Job Description: {jd_path.name} ({len(jd_text)} chars)")
    except Exception as e:
        print(f"Error reading JD: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. Read and process resumes
    resume_files = []
    for ext in ["*.pdf", "*.docx", "*.txt"]:
        resume_files.extend(list(resumes_dir.glob(ext)))
        
    if not resume_files:
        print(f"No resumes found in '{resumes_dir}' matching *.pdf, *.docx, or *.txt", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(resume_files)} resumes. Commencing screening pipeline...")

    results = []
    for i, file_path in enumerate(resume_files, 1):
        print(f"[{i}/{len(resume_files)}] Processing {file_path.name}...")
        try:
            resume_text = parse_resume(file_path)
            if not resume_text:
                print(f"  Warning: No text could be extracted from {file_path.name}. Skipping.", file=sys.stderr)
                continue
                
            # Perform screening
            eval_result = screen_resume(resume_text, jd_text)
            eval_result["file_name"] = file_path.name
            results.append(eval_result)
        except Exception as e:
            print(f"  Error screening {file_path.name}: {e}", file=sys.stderr)

    if not results:
        print("Error: No resumes were successfully screened.", file=sys.stderr)
        sys.exit(1)

    # 4. Rank candidates by total score descending
    results.sort(key=lambda x: x["scores"]["total_score"], reverse=True)

    # 5. Display ranked table
    print("\n" + "=" * 60)
    print("                     RANKED CANDIDATES")
    print("=" * 60)
    
    table_data = []
    for rank, cand in enumerate(results, 1):
        table_data.append([
            rank,
            cand["candidate_name"],
            cand["tier"],
            f"{cand['scores']['total_score']}%",
            f"{cand['experience_years']} yrs",
            cand["candidate_email"],
            cand["mode"]
        ])
        
    headers = ["Rank", "Name", "Fit Tier", "Match Score", "Experience", "Email", "Engine Mode"]
    print(tabulate(table_data, headers=headers, tablefmt="grid"))

    # 6. Save output to CSV
    try:
        with open(output_path, "w", newline="", encoding="utf-8") as csvfile:
            fieldnames = [
                "Rank", "Name", "Fit Tier", "Match Score", "Experience Years", 
                "Email", "Phone", "Education", "Skills", "Justification", 
                "Engine Mode", "File Name"
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for rank, cand in enumerate(results, 1):
                writer.writerow({
                    "Rank": rank,
                    "Name": cand["candidate_name"],
                    "Fit Tier": cand["tier"],
                    "Match Score": cand["scores"]["total_score"],
                    "Experience Years": cand["experience_years"],
                    "Email": cand["candidate_email"],
                    "Phone": cand["candidate_phone"],
                    "Education": cand["education_extracted"],
                    "Skills": ", ".join(cand["skills_extracted"]),
                    "Justification": cand["justification"],
                    "Engine Mode": cand["mode"],
                    "File Name": cand["file_name"]
                })
        print(f"\nSuccessfully saved shortlist to '{output_path}'")
    except Exception as e:
        print(f"Error saving CSV: {e}", file=sys.stderr)

    # 7. Print top recommendation
    top_cand = results[0]
    print("\n" + "*" * 60)
    print(f"TOP CANDIDATE RECOMMENDATION: {top_cand['candidate_name'].upper()}")
    print(f"Score: {top_cand['scores']['total_score']}% | Tier: {top_cand['tier']}")
    print(f"Justification: {top_cand['justification']}")
    print("*" * 60)

if __name__ == "__main__":
    main()
