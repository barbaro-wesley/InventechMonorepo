import logging
from typing import Optional

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

MAX_PAGES = 20


class PDFReader:
    """
    Wraps PyMuPDF for in-memory page-level text extraction and image rendering.
    All rendering happens in memory — no temp files on disk.
    """

    def open(self, pdf_path: str) -> fitz.Document:
        return fitz.open(pdf_path)

    def page_count(self, doc: fitz.Document) -> int:
        return min(len(doc), MAX_PAGES)

    def extract_text_page(self, doc: fitz.Document, page_index: int) -> str:
        """
        Extracts the embedded text layer from a single page (0-based index).
        Returns empty string if the page has no text layer.
        """
        if page_index >= len(doc):
            return ""
        page = doc[page_index]
        text = page.get_text("text")
        return text.strip()

    def render_page_to_bytes(
        self, doc: fitz.Document, page_index: int, dpi: int = 300
    ) -> Optional[bytes]:
        """
        Renders a PDF page to PNG bytes in memory for OCR.
        Returns None if the page index is out of range.
        """
        if page_index >= len(doc):
            return None
        page = doc[page_index]
        # Scale factor: PDF default is 72 DPI
        scale = dpi / 72
        matrix = fitz.Matrix(scale, scale)
        pixmap = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB, alpha=False)
        return pixmap.tobytes("png")
