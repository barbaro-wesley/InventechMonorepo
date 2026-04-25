FROM python:3.12-slim AS base

# System deps: tesseract + portuguese language pack only — no extras
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-por \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Run as non-root for security
RUN useradd -r -u 1001 -s /bin/false appuser \
    && chown -R appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LOG_LEVEL=INFO

CMD ["python", "main.py"]
