import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    postgres_dsn: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_use_ssl: bool
    minio_bucket: str
    sftp_scan_base_dir: str
    ocr_lang: str
    ocr_dpi: int
    webhook_url: str
    webhook_secret: str
    max_concurrent: int
    max_file_size_bytes: int


def load() -> Config:
    return Config(
        postgres_dsn=_require("POSTGRES_DSN"),
        minio_endpoint=_require("MINIO_ENDPOINT"),
        minio_access_key=_require("MINIO_ACCESS_KEY"),
        minio_secret_key=_require("MINIO_SECRET_KEY"),
        minio_use_ssl=_env_bool("MINIO_USE_SSL", False),
        minio_bucket=_env("MINIO_BUCKET", "scans"),
        sftp_scan_base_dir=_env("SFTP_SCAN_BASE_DIR", "/srv/scans/incoming"),
        ocr_lang=_env("OCR_LANG", "por"),
        ocr_dpi=_env_int("OCR_DPI", 300),
        webhook_url=_env("SCAN_WEBHOOK_URL", ""),
        webhook_secret=_env("SCAN_WEBHOOK_SECRET", ""),
        max_concurrent=_env_int("MAX_CONCURRENT", 5),
        max_file_size_bytes=_env_int("MAX_FILE_SIZE_MB", 50) * 1024 * 1024,
    )


def _require(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Required environment variable not set: {key}")
    return value


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _env_bool(key: str, default: bool) -> bool:
    value = os.environ.get(key)
    if value is None:
        return default
    return value.lower() in ("true", "1")


def _env_int(key: str, default: int) -> int:
    value = os.environ.get(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default
