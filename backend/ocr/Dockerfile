FROM python:3.11-slim

# Tesseract + the three language packs this app supports. Docling's own
# layout model comes down separately on first run (see CLAUDE.md) — that
# needs a real internet connection to huggingface.co, not this image build.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-tel \
    tesseract-ocr-hin \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/ocr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ocr/ .

# Render injects PORT at runtime; 8001 is only the local-dev default.
ENV PORT=8001
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
