import io
import logging
from typing import Protocol

import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)


class OCREngine(Protocol):
    """Interface so the engine can be swapped (pytesseract → easyocr/paddleocr) without touching processor.py."""

    def process_bytes(self, image_bytes: bytes) -> str: ...
    def close(self) -> None: ...


class TesseractEngine:
    """
    OCR engine backed by Tesseract via pytesseract.
    Images are processed entirely in memory from PNG bytes.
    """

    def __init__(self, lang: str = "por") -> None:
        self._lang = lang
        self._verify()

    def _verify(self) -> None:
        try:
            pytesseract.get_tesseract_version()
        except Exception as exc:
            raise RuntimeError(
                f"Tesseract not found. Install it and add to PATH: {exc}"
            ) from exc

    def process_bytes(self, image_bytes: bytes) -> str:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(img, lang=self._lang)
            return text.strip()
        except Exception as exc:
            logger.warning("Tesseract OCR failed: %s", exc)
            return ""

    def close(self) -> None:
        pass


def build_engine(lang: str = "por") -> TesseractEngine:
    return TesseractEngine(lang=lang)
