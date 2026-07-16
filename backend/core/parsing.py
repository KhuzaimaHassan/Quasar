import io
import fitz  # PyMuPDF
from docx import Document

def extract_text(file_bytes: bytes, mime_type: str) -> str:
    """
    Extracts text from a given file's bytes based on its mime type.
    Returns the text with double newlines between pages/paragraphs to preserve structure.
    """
    if mime_type == "application/pdf":
        return _extract_text_from_pdf(file_bytes)
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported mime type for parsing: {mime_type}")

def _extract_text_from_pdf(file_bytes: bytes) -> str:
    # Open the PDF from a bytes stream
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages_text = []
    
    for page in doc:
        text = page.get_text()
        if text:
            pages_text.append(text.strip())
            
    doc.close()
    
    # Join pages with double newlines
    return "\n\n".join(pages_text)

def _extract_text_from_docx(file_bytes: bytes) -> str:
    # Open the DOCX from a bytes stream
    doc = Document(io.BytesIO(file_bytes))
    paragraphs_text = []
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs_text.append(text)
            
    # Join paragraphs with double newlines
    return "\n\n".join(paragraphs_text)
