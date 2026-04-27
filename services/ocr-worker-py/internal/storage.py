import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from minio import Minio
from minio.error import S3Error

from .config import Config

logger = logging.getLogger(__name__)


class StorageClient:
    def __init__(self, cfg: Config) -> None:
        self._client = Minio(
            cfg.minio_endpoint,
            access_key=cfg.minio_access_key,
            secret_key=cfg.minio_secret_key,
            secure=cfg.minio_use_ssl,
        )
        self._bucket = cfg.minio_bucket
        # Dedicated thread pool for blocking MinIO SDK calls
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="minio")

    def get_bucket(self) -> str:
        return self._bucket

    async def upload_file(
        self,
        key: str,
        file_path: str,
        content_type: str,
    ) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            self._executor,
            self._upload_sync,
            key,
            file_path,
            content_type,
        )

    def _upload_sync(self, key: str, file_path: str, content_type: str) -> None:
        self._client.fput_object(
            self._bucket,
            key,
            file_path,
            content_type=content_type,
        )
        logger.debug("Uploaded to MinIO: %s", key)

    async def ensure_bucket(self) -> None:
        loop = asyncio.get_event_loop()
        exists = await loop.run_in_executor(
            self._executor,
            self._client.bucket_exists,
            self._bucket,
        )
        if not exists:
            await loop.run_in_executor(
                self._executor,
                lambda: self._client.make_bucket(self._bucket),
            )
            logger.info("Created bucket: %s", self._bucket)

    def close(self) -> None:
        self._executor.shutdown(wait=False)
