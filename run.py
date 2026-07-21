#!/usr/bin/env python3
import os
import sys
import subprocess
import time
import webbrowser
import socket
from pathlib import Path

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def main():
    print("=" * 60)
    print("      ROOMAN AI RESUME SCREENING AGENT - BOOTSTRAP")
    print("=" * 60)

    # 1. Resolve paths
    base_dir = Path(__file__).resolve().parent
    venv_dir = base_dir / "venv"
    venv_python = venv_dir / "bin" / "python"
    
    if not venv_dir.exists() or not venv_python.exists():
        print(f"Virtual environment not found at {venv_dir}.")
        print("Setting up virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
        print("Installing dependencies...")
        subprocess.run([str(venv_dir / "bin" / "pip"), "install", "-r", "requirements.txt"], check=True)
        print("Setup complete.")

    # 2. Check if port 8000 is in use
    port = 8000
    if is_port_in_use(port):
        print(f"Warning: Port {port} is already in use. The app might fail to start if another instance is running.")
        print("Please terminate any process running on port 8000.")

    # 3. Check for API key (Inform the user if they'd like to configure it)
    env_file = base_dir / ".env"
    if not env_file.exists():
        print("\nNotice: '.env' file not found in project root.")
        print("The agent will default to 'Local Heuristic Mode (TF-IDF Cosine Similarity)'.")
        print("If you wish to use the advanced 'Cognitive LLM Mode (Gemini)',")
        print("create a '.env' file in the project root containing:")
        print("  GEMINI_API_KEY=your_actual_api_key_here")
    else:
        # Check if key is defined
        has_key = False
        with open(env_file, "r") as f:
            for line in f:
                if line.strip().startswith("GEMINI_API_KEY=") and len(line.strip().split("=", 1)[1]) > 5:
                    has_key = True
                    break
        if has_key:
            print("\nFound GEMINI_API_KEY in .env. Initializing in Cognitive LLM Mode.")
        else:
            print("\nGEMINI_API_KEY not configured in .env. Initializing in Local Heuristic Mode.")

    print("\nStarting FastAPI web server...")
    
    # Start uvicorn in a subprocess
    server_process = None
    try:
        cmd = [
            str(venv_python), 
            "-m", "uvicorn", 
            "main:app", 
            "--host", "127.0.0.1", 
            "--port", str(port),
            "--log-level", "info"
        ]
        
        server_process = subprocess.Popen(cmd, cwd=str(base_dir))
        
        # Give the server a couple seconds to start up
        print("Waiting for server to spin up...")
        time.sleep(2.5)
        
        # 4. Open browser
        url = f"http://127.0.0.1:{port}"
        print(f"Launching web interface at: {url}")
        webbrowser.open(url)
        
        print("\nServer is running. Press Ctrl+C to terminate.")
        # Keep waiting on the process
        server_process.wait()
        
    except KeyboardInterrupt:
        print("\nShutting down server...")
        if server_process:
            server_process.terminate()
            server_process.wait()
        print("Clean exit. Goodbye!")
    except Exception as e:
        print(f"An error occurred: {e}")
        if server_process:
            server_process.kill()

if __name__ == "__main__":
    main()
