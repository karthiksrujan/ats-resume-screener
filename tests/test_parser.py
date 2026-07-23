import pytest
from pathlib import Path
from backend.parser import parse_resume

def test_parse_txt_file(tmp_path):
    txt_file = tmp_path / "sample_resume.txt"
    content = "John Doe\nSoftware Engineer with 5 years experience in Python and FastAPI."
    txt_file.write_text(content, encoding="utf-8")
    
    extracted = parse_resume(str(txt_file))
    assert "John Doe" in extracted
    assert "Software Engineer" in extracted
    assert "Python" in extracted

def test_parse_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        parse_resume("nonexistent_resume.pdf")
