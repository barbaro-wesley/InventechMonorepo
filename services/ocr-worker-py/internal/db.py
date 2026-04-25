import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import asyncpg

from .config import Config

logger = logging.getLogger(__name__)


@dataclass
class Printer:
    id: str
    company_id: str
    name: str
    sftp_directory: str


@dataclass
class Scan:
    id: str
    company_id: str
    printer_id: str
    file_name: str
    stored_key: str
    bucket: str
    mime_type: str
    size_bytes: int
    status: str
    scanned_at: datetime


@dataclass
class ScanMetadata:
    id: str
    scan_id: str
    ocr_status: str
    paciente: Optional[str]
    cpf: Optional[str]
    prontuario: Optional[str]
    numero_atendimento: Optional[str]
    extracted_at: Optional[datetime]


class DB:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    @classmethod
    async def connect(cls, cfg: Config) -> "DB":
        pool = await asyncpg.create_pool(
            cfg.postgres_dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        # Verify connection
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        logger.info("Database pool created (min=2, max=10)")
        return cls(pool)

    async def close(self) -> None:
        await self._pool.close()

    async def find_printer_by_sftp_directory(self, sftp_directory: str) -> Optional[Printer]:
        row = await self._pool.fetchrow(
            """
            SELECT id, company_id, name, sftp_directory
            FROM printers
            WHERE sftp_directory = $1
              AND is_active = true
              AND deleted_at IS NULL
            LIMIT 1
            """,
            sftp_directory,
        )
        if not row:
            return None
        return Printer(
            id=row["id"],
            company_id=row["company_id"],
            name=row["name"],
            sftp_directory=row["sftp_directory"],
        )

    async def insert_scan(self, scan: Scan) -> None:
        await self._pool.execute(
            """
            INSERT INTO scans
              (id, company_id, printer_id, file_name, stored_key,
               bucket, mime_type, size_bytes, status, scanned_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            scan.id,
            scan.company_id,
            scan.printer_id,
            scan.file_name,
            scan.stored_key,
            scan.bucket,
            scan.mime_type,
            scan.size_bytes,
            scan.status,
            scan.scanned_at,
        )

    async def update_scan_status(
        self,
        scan_id: str,
        status: str,
        stored_key: str = "",
        processed_at: Optional[datetime] = None,
        error_msg: Optional[str] = None,
    ) -> None:
        await self._pool.execute(
            """
            UPDATE scans
            SET status = $2, stored_key = $3, processed_at = $4, error_msg = $5
            WHERE id = $1
            """,
            scan_id,
            status,
            stored_key,
            processed_at,
            error_msg,
        )

    async def insert_scan_metadata(self, metadata: ScanMetadata) -> None:
        await self._pool.execute(
            """
            INSERT INTO scan_metadata
              (id, scan_id, ocr_status, paciente, cpf,
               prontuario, numero_atendimento, extracted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            metadata.id,
            metadata.scan_id,
            metadata.ocr_status,
            metadata.paciente,
            metadata.cpf,
            metadata.prontuario,
            metadata.numero_atendimento,
            metadata.extracted_at,
        )
