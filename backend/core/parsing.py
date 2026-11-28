import io
import os
import shutil
import subprocess
import zipfile
import pymupdf as fitz  # type: ignore[import-untyped]
from docx import Document


OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "eng")
OCR_DPI = 200

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
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages_text = []

    try:
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            text = page.get_text().strip()

            # OCR only when a page looks scanned, or when it contains image
            # regions that may hold text. PyMuPDF's partial OCR keeps existing
            # selectable text and OCRs regions that do not already contain it.
            if page.get_images():
                ocr_text = _ocr_pdf_page(page)
                if len(ocr_text) > len(text):
                    text = ocr_text

            if text:
                pages_text.append(text)
    finally:
        doc.close()

    return "\n\n".join(pages_text)

def _extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs_text = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs_text.append(text)

    # DOCX is a ZIP package; reading its media parts also covers floating images
    # and images in headers/footers that python-docx's inline_shapes omits.
    image_text = []
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as package:
        image_parts = [
            name for name in package.namelist()
            if name.startswith("word/media/")
            and os.path.splitext(name)[1].lower() in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}
        ]

        if image_parts:
            _ensure_ocr_available()
        for image_index, name in enumerate(image_parts, start=1):
            try:
                text = _ocr_docx_image(package.read(name))
            except Exception as exc:
                raise ValueError(
                    f"OCR failed for an embedded DOCX image ({image_index}). "
                    f"Check that Tesseract and the '{OCR_LANGUAGE}' language data are installed."
                ) from exc
            if text:
                image_text.append(f"[Text from embedded image {image_index}]\n{text}")

    return "\n\n".join(paragraphs_text + image_text)


def _ocr_pdf_page(page: fitz.Page) -> str:
    _ensure_ocr_available()
    try:
        text_page = page.get_textpage_ocr(
            language=OCR_LANGUAGE,
            dpi=OCR_DPI,
            full=False,
        )
        return page.get_text(textpage=text_page).strip()
    except Exception as exc:
        raise ValueError(
            "OCR failed for a PDF page. Check that Tesseract and "
            f"the '{OCR_LANGUAGE}' language data are installed."
        ) from exc


def _ensure_ocr_available() -> None:
    if shutil.which("tesseract") is None:
        raise ValueError(
            "OCR is required for this document, but Tesseract is not installed "
            "or is not available on PATH. See docs/RAG.md for setup instructions."
        )


def _ocr_docx_image(image_bytes: bytes) -> str:
    try:
        result = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", OCR_LANGUAGE, "--psm", "6"],
            input=image_bytes,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ValueError("OCR timed out while processing an embedded image.") from exc
    except OSError as exc:
        raise ValueError("Could not start the Tesseract OCR engine.") from exc

    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(detail or "Tesseract could not process an embedded image.")
    return result.stdout.decode("utf-8", errors="replace").strip()
