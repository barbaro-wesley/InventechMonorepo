import asyncio
import logging
import os
import signal
import sys

from dotenv import load_dotenv

from internal.config import load
from internal.db import DB
from internal.processor import Processor
from internal.storage import StorageClient
from internal.watcher import DirectoryWatcher

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


async def run() -> None:
    load_dotenv()
    cfg = load()

    if not os.path.isdir(cfg.sftp_scan_base_dir):
        logger.error("SFTP scan base dir does not exist: %s", cfg.sftp_scan_base_dir)
        sys.exit(1)

    logger.info("Connecting to PostgreSQL...")
    db = await DB.connect(cfg)
    logger.info("Connected to PostgreSQL")

    logger.info("Connecting to MinIO: %s", cfg.minio_endpoint)
    storage = StorageClient(cfg)
    await storage.ensure_bucket()
    logger.info("Connected to MinIO (bucket: %s)", cfg.minio_bucket)

    processor = Processor(cfg, db, storage)
    loop = asyncio.get_event_loop()

    watcher = DirectoryWatcher(cfg.sftp_scan_base_dir, processor.handle_new_file)
    watcher.start(loop)

    stop_event = asyncio.Event()

    def _on_signal() -> None:
        logger.info("Shutdown signal received")
        stop_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _on_signal)

    logger.info(
        "OCR Worker started — watching: %s (max_concurrent=%d)",
        cfg.sftp_scan_base_dir,
        cfg.max_concurrent,
    )

    await stop_event.wait()

    logger.info("Shutting down...")
    watcher.stop()
    processor.close()
    storage.close()
    await db.close()
    logger.info("Shutdown complete")


if __name__ == "__main__":
    asyncio.run(run())
