import base64
import io
import shutil
import subprocess
import unittest
from unittest.mock import patch

import pymupdf
from docx import Document

from core import parsing


# Small valid PNG used to create scanned-page and embedded-DOCX-image fixtures.
PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS4kAAAAASUVORK5CYII="
)
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def make_pdf(*, image: bool, text: str = "") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    if image:
        page.insert_image(pymupdf.Rect(72, 100, 300, 300), stream=PIXEL_PNG)
    result = doc.tobytes()
    doc.close()
    return result


def make_text_png(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=500, height=180)
    page.insert_text((25, 100), text, fontsize=36)
    result = page.get_pixmap(dpi=200).tobytes("png")
    doc.close()
    return result


def make_docx(*, image: bool, text: str = "", image_bytes: bytes = PIXEL_PNG) -> bytes:
    doc = Document()
    if text:
        doc.add_paragraph(text)
    if image:
        doc.add_picture(io.BytesIO(image_bytes))
    output = io.BytesIO()
    doc.save(output)
    return output.getvalue()


class TestOCRDocumentParsing(unittest.TestCase):
    def test_pdf_image_page_uses_ocr_and_preserves_extracted_text(self):
        with patch.object(parsing, "_ocr_pdf_page", return_value="Scanned receipt total 42") as ocr:
            result = parsing.extract_text(make_pdf(image=True), "application/pdf")

        self.assertIn("Scanned receipt total 42", result)
        ocr.assert_called_once()

    def test_text_only_pdf_does_not_require_ocr(self):
        source = make_pdf(image=False, text="Selectable document text")
        with patch.object(parsing, "_ocr_pdf_page", side_effect=AssertionError("OCR should not run")):
            result = parsing.extract_text(source, "application/pdf")

        self.assertEqual(result, "Selectable document text")

    def test_docx_embedded_image_text_is_added_after_paragraphs(self):
        source = make_docx(image=True, text="Document heading")
        with patch.object(parsing.shutil, "which", return_value="/usr/bin/tesseract"):
            with patch.object(parsing, "_ocr_docx_image", return_value="Scanned form number 123") as ocr:
                result = parsing.extract_text(source, DOCX_MIME)

        self.assertLess(result.index("Document heading"), result.index("Scanned form number 123"))
        ocr.assert_called_once_with(PIXEL_PNG)

    def test_docx_without_images_does_not_require_ocr(self):
        source = make_docx(image=False, text="Ordinary DOCX paragraph")
        with patch.object(parsing, "_ensure_ocr_available", side_effect=AssertionError("OCR should not run")):
            result = parsing.extract_text(source, DOCX_MIME)

        self.assertEqual(result, "Ordinary DOCX paragraph")

    def test_image_pdf_reports_missing_tesseract(self):
        with patch.object(parsing.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ValueError, "Tesseract is not installed"):
                parsing.extract_text(make_pdf(image=True), "application/pdf")

    def test_docx_image_reports_missing_tesseract(self):
        with patch.object(parsing.shutil, "which", return_value=None):
            with self.assertRaisesRegex(ValueError, "Tesseract is not installed"):
                parsing.extract_text(make_docx(image=True), DOCX_MIME)

    def test_docx_ocr_sends_image_bytes_to_tesseract_and_returns_text(self):
        completed = subprocess.CompletedProcess(
            args=["tesseract"], returncode=0, stdout=b"Recognized words\n", stderr=b""
        )
        with patch.object(parsing.shutil, "which", return_value="/usr/bin/tesseract"):
            with patch.object(parsing.subprocess, "run", return_value=completed) as run:
                result = parsing._ocr_docx_image(PIXEL_PNG)

        self.assertEqual(result, "Recognized words")
        self.assertEqual(run.call_args.kwargs["input"], PIXEL_PNG)
        self.assertEqual(run.call_args.kwargs["timeout"], 30)

    def test_docx_ocr_reports_tesseract_failure(self):
        completed = subprocess.CompletedProcess(
            args=["tesseract"], returncode=1, stdout=b"", stderr=b"unsupported image"
        )
        with patch.object(parsing.shutil, "which", return_value="/usr/bin/tesseract"):
            with patch.object(parsing.subprocess, "run", return_value=completed):
                with self.assertRaisesRegex(ValueError, "unsupported image"):
                    parsing._ocr_docx_image(PIXEL_PNG)

    @unittest.skipUnless(shutil.which("tesseract"), "Requires Tesseract OCR")
    def test_real_pdf_ocr_recognizes_text_from_scanned_page(self):
        scan = make_text_png("INVOICE 4287")
        doc = pymupdf.open()
        page = doc.new_page(width=500, height=180)
        page.insert_image(page.rect, stream=scan)
        source = doc.tobytes()
        doc.close()

        result = parsing.extract_text(source, "application/pdf")

        self.assertIn("4287", result)

    @unittest.skipUnless(shutil.which("tesseract"), "Requires Tesseract OCR")
    def test_real_docx_ocr_recognizes_text_from_embedded_image(self):
        source = make_docx(image=True, image_bytes=make_text_png("INVOICE 4287"))

        result = parsing.extract_text(source, DOCX_MIME)

        self.assertIn("4287", result)


if __name__ == "__main__":
    unittest.main()
