import asyncio
import logging
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx

from .config import Config
from .db import DB, Scan, ScanMetadata
from .extractor import Extractor, ExtractedData
from .ocr.engine import build_engine, OCREngine
from .ocr.pdf import PDFReader
from .storage import StorageClient

logger = logging.getLogger(__name__)

_ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"}

_MIME_MAP = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}


def _detect_mime(file_name: str) -> str:
    return _MIME_MAP.get(Path(file_name).suffix.lower(), "application/octet-stream")


def _is_safe_path(base_dir: str, path: str) -> bool:
    """Rejects path traversal attempts."""
    base = os.path.realpath(base_dir)
    target = os.path.realpath(path)
    return target.startswith(base + os.sep) or target == base


class Processor:
    def __init__(self, cfg: Config, db: DB, storage: StorageClient) -> None:
        self._cfg = cfg
        self._db = db
        self._storage = storage
        self._extractor = Extractor()
        self._pdf_reader = PDFReader()
        self._ocr_engine: OCREngine = build_engine(cfg.ocr_lang)
        # Limits how many PDFs are processed at the same time
        self._sem = asyncio.Semaphore(cfg.max_concurrent)
        self._in_progress: set[str] = set()
        self._lock = asyncio.Lock()

    def close(self) -> None:
        self._ocr_engine.close()

    async def handle_new_file(self, file_path: str) -> None:
        ext = Path(file_path).suffix.lower()
        if ext not in _ALLOWED_EXTENSIONS:
            return

        # Security: block path traversal
        if not _is_safe_path(self._cfg.sftp_scan_base_dir, file_path):
            logger.warning("Blocked path traversal attempt: %s", file_path)
            return

        async with self._lock:
            if file_path in self._in_progress:
                logger.debug("Already in progress, skipping: %s", file_path)
                return
            self._in_progress.add(file_path)

        try:
            logger.info("New file detected: %s", file_path)

            if not await self._wait_stable(file_path, timeout=30):
                logger.warning("File did not stabilize in time, skipping: %s", file_path)
                return

            try:
                file_size = os.path.getsize(file_path)
            except OSError:
                logger.warning("File disappeared before processing: %s", file_path)
                return

            if file_size > self._cfg.max_file_size_bytes:
                logger.warning(
                    "File exceeds size limit (%d bytes), skipping: %s", file_size, file_path
                )
                return

            async with self._sem:
                await self._process(file_path, file_size)

        except Exception:
            logger.exception("Unexpected error processing %s", file_path)
        finally:
            async with self._lock:
                self._in_progress.discard(file_path)

    async def _wait_stable(self, file_path: str, timeout: int = 30) -> bool:
        """Waits until the file size stops changing, meaning the SFTP upload is complete."""
        deadline = time.monotonic() + timeout
        prev_size = -1

        while time.monotonic() < deadline:
            try:
                size = os.path.getsize(file_path)
            except FileNotFoundError:
                return False
            if size == prev_size and size > 0:
                return True
            prev_size = size
            await asyncio.sleep(3)

        return False

    async def _process(self, file_path: str, file_size: int) -> None:
        sftp_dir = Path(file_path).parent.name
        file_name = Path(file_path).name
        scan_id = str(uuid.uuid4())
        mime_type = _detect_mime(file_name)
        now = datetime.utcnow()

        printer = await self._db.find_printer_by_sftp_directory(sftp_dir)
        if not printer:
            logger.warning("No printer found for SFTP directory: %s", sftp_dir)
            await self._move_to_error(file_path)
            return

        scan = Scan(
            id=scan_id,
            company_id=printer.company_id,
            printer_id=printer.id,
            file_name=file_name,
            stored_key="",
            bucket=self._storage.get_bucket(),
            mime_type=mime_type,
            size_bytes=file_size,
            status="PENDING",
            scanned_at=now,
        )
        await self._db.insert_scan(scan)

        # CPU-bound: run in thread pool so the event loop stays free
        loop = asyncio.get_event_loop()
        extracted: ExtractedData = await loop.run_in_executor(
            None, self._extract_sync, file_path, file_name
        )

        ocr_status = "SUCCESS" if extracted.has_patient_data else "FAILED"
        stored_key = f"{printer.company_id}/{printer.id}/{scan_id}/{file_name}"

        try:
            await self._storage.upload_file(stored_key, file_path, mime_type)
        except Exception as exc:
            logger.error("MinIO upload failed for %s: %s", file_name, exc)
            processed_at = datetime.utcnow()
            await self._db.update_scan_status(
                scan_id, "ERROR", "", processed_at, str(exc)
            )
            await self._move_to_error(file_path)
            return

        processed_at = datetime.utcnow()
        await self._db.update_scan_status(scan_id, "PROCESSED", stored_key, processed_at)
        await self._db.insert_scan_metadata(
            ScanMetadata(
                id=str(uuid.uuid4()),
                scan_id=scan_id,
                ocr_status=ocr_status,
                paciente=extracted.paciente,
                cpf=extracted.cpf,
                prontuario=extracted.prontuario,
                numero_atendimento=extracted.numero_atendimento,
                extracted_at=processed_at,
            )
        )

        try:
            os.remove(file_path)
        except OSError as exc:
            logger.warning("Could not delete local file %s: %s", file_path, exc)

        logger.info(
            "Processed: %s [ocr=%s, printer=%s]", file_name, ocr_status, printer.name
        )
        await self._notify_api(scan_id, printer.company_id, "PROCESSED")

    def _extract_sync(self, file_path: str, file_name: str) -> ExtractedData:
        """
        Opens the PDF and iterates page by page.
        For each page: tries native text first, falls back to OCR.
        Stops as soon as patient data (Paciente field) is found — remaining pages are skipped.
        """
        result = ExtractedData()

        try:
            doc = self._pdf_reader.open(file_path)
        except Exception as exc:
            logger.error("[%s] Failed to open PDF: %s", file_name, exc)
            return result

        try:
            total = self._pdf_reader.page_count(doc)

            for idx in range(total):
                page_num = idx + 1  # 1-based for logging

                # ── 1. Native text layer ──────────────────────────────────────
                text = self._pdf_reader.extract_text_page(doc, idx)
                if text:
                    found = self._extractor.extract_into(result, text)
                    logger.debug(
                        "[%s] page %d: direct text (%d chars), paciente=%s",
                        file_name, page_num, len(text), result.paciente is not None,
                    )
                    if found:
                        logger.info(
                            "[%s] patient found on page %d via text — stopping",
                            file_name, page_num,
                        )
                        return result
                    # Page has text but no patient data — skip OCR for this page
                    continue

                # ── 2. OCR fallback (page has no text layer) ─────────────────
                logger.debug("[%s] page %d: no embedded text, running OCR", file_name, page_num)
                image_bytes = self._pdf_reader.render_page_to_bytes(doc, idx, dpi=self._cfg.ocr_dpi)
                if image_bytes is None:
                    break

                ocr_text = self._ocr_engine.process_bytes(image_bytes)
                if not ocr_text:
                    continue

                found = self._extractor.extract_into(result, ocr_text)
                logger.debug(
                    "[%s] page %d: OCR (%d chars), paciente=%s",
                    file_name, page_num, len(ocr_text), result.paciente is not None,
                )
                if found:
                    logger.info(
                        "[%s] patient found on page %d via OCR — stopping",
                        file_name, page_num,
                    )
                    return result

        finally:
            doc.close()

        return result

    async def _notify_api(self, scan_id: str, company_id: str, status: str) -> None:
        if not self._cfg.webhook_url or not self._cfg.webhook_secret:
            return
        payload = {"scanId": scan_id, "companyId": company_id, "status": status}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    self._cfg.webhook_url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-webhook-secret": self._cfg.webhook_secret,
                    },
                )
            if resp.status_code >= 300:
                logger.warning(
                    "Webhook returned %d for scan %s", resp.status_code, scan_id
                )
            else:
                logger.info("Webhook: notified for scan %s [%s]", scan_id, status)
        except Exception as exc:
            # Webhook failures never interrupt the main flow
            logger.warning("Webhook request failed for scan %s: %s", scan_id, exc)

    async def _move_to_error(self, file_path: str) -> None:
        error_dir = Path(file_path).parent.parent / "_error"
        error_dir.mkdir(parents=True, exist_ok=True)
        dest = error_dir / Path(file_path).name
        try:
            os.rename(file_path, str(dest))
            logger.info("Moved to error dir: %s", dest)
        except OSError as exc:
            logger.error("Could not move file to error dir: %s", exc)
