FROM python:3.11-slim

# libgomp1: OpenMP runtime used by torch/opencv/numpy's compiled kernels.
# Tesseract is no longer installed here — OCR runs on EasyOCR now (see
# backend/ocr/main.py and CLAUDE.md), which needs no system OCR binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/ocr/requirements.txt .

# CPU-only torch/torchvision FIRST, as their own install step: plain
# `pip install torch` (which easyocr, in requirements.txt, would otherwise
# pull in transitively) resolves to a CUDA build on Linux and drags in
# several GB of unused nvidia-* CUDA runtime packages — wasted space on a
# CPU-only host like Render. Installing the CPU wheel here first means
# easyocr's unpinned `torch` requirement is already satisfied by the time
# requirements.txt is processed, so pip never reaches for the CUDA one.
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ocr/ .

# Render injects PORT at runtime; 8001 is only the local-dev default.
ENV PORT=8001
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
