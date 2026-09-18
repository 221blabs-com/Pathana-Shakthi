from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from PIL import Image
import pymupdf
import io
import numpy as np
import uuid
import time
from concurrent.futures import ThreadPoolExecutor


app = FastAPI(
    title="Phatan Shakti OCR Service",
    version="3.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pathana Sakthi reads Telugu, Hindi and English textbooks, and PaddleOCR
# loads one recognition model per script — the English model returns empty
# or garbled text on Telugu/Hindi pages. Engines are created lazily (on
# first request for that language) and cached, so a language nobody scans
# never pays the model-load cost, and the service still starts even if one
# language's model can't be downloaded/loaded in this environment.
SUPPORTED_OCR_LANGUAGES = {
    "en": "en",
    "te": "te",
    # PaddleOCR's Hindi recognition model lives under the "devanagari"
    # script family (shared with Marathi/Nepali), not a literal "hi" code.
    "hi": "devanagari",
}
DEFAULT_OCR_LANGUAGE = "en"
_ocr_engines: dict[str, PaddleOCR] = {}


def get_ocr_engine(language: str) -> tuple[PaddleOCR, str]:
    """Return a cached PaddleOCR engine for the requested language, loading
    it on first use. Falls back to English if the language is unknown or
    its model fails to load, so one bad language never breaks OCR outright.
    """
    requested = SUPPORTED_OCR_LANGUAGES.get(
        (language or DEFAULT_OCR_LANGUAGE).strip().lower(),
        None,
    )
    effective = requested or SUPPORTED_OCR_LANGUAGES[DEFAULT_OCR_LANGUAGE]

    if effective in _ocr_engines:
        return _ocr_engines[effective], effective

    print(f"[OCR] Loading PaddleOCR model for lang='{effective}'...")
    try:
        engine = PaddleOCR(
            lang=effective,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            engine="paddle",
        )
    except Exception as error:
        if effective == SUPPORTED_OCR_LANGUAGES[DEFAULT_OCR_LANGUAGE]:
            raise
        print(
            f"[OCR] Failed to load '{effective}' model, "
            f"falling back to English: {error}"
        )
        return get_ocr_engine(DEFAULT_OCR_LANGUAGE)

    _ocr_engines[effective] = engine
    print(f"[OCR] PaddleOCR model for lang='{effective}' loaded successfully.")
    return engine, effective


# Warm the English engine at startup so the first request of the service's
# life isn't the one paying the model-load cost. This is best-effort: if the
# model can't be loaded right now (no network route to the model hoster, a
# cold cache, a transient outage), the service still starts so callers get
# a clear "OCR not ready" error from the request itself instead of the
# whole process refusing to boot. Each request retries the load lazily via
# get_ocr_engine().
print("Loading default PaddleOCR model...")
try:
    get_ocr_engine(DEFAULT_OCR_LANGUAGE)
    print("Default PaddleOCR model loaded successfully.")
except Exception as error:
    print(
        "[OCR] Could not preload the default PaddleOCR model at startup "
        f"(will retry on first request): {error}"
    )

ocr_jobs = {}
OCR_JOB_TTL_SECONDS = 60 * 60

# OCR is GPU/CPU intensive. One worker keeps multiple large PDFs from
# competing for the same PaddleOCR resources.
ocr_executor = ThreadPoolExecutor(max_workers=1)


def cleanup_old_ocr_jobs():
    cutoff = time.time() - OCR_JOB_TTL_SECONDS
    for job_id, job in list(ocr_jobs.items()):
        if job.get("created_at", 0) < cutoff:
            ocr_jobs.pop(job_id, None)


def create_ocr_job(filename: str) -> dict:
    cleanup_old_ocr_jobs()
    job_id = f"ocr_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
    job = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "stage_message": "Queued for PaddleOCR processing...",
        "filename": filename,
        "created_at": time.time(),
        "result": None,
        "error": None,
    }
    ocr_jobs[job_id] = job
    return job


def update_ocr_job(job_id: str, **updates):
    job = ocr_jobs.get(job_id)
    if job:
        job.update(updates)


@app.get("/")
def root():
    return {
        "service": "Phatan Shakti OCR",
        "status": "running",
        "ocr": "PaddleOCR",
        "pdf_support": True,
        "async_jobs": True,
        "supportedLanguages": sorted(SUPPORTED_OCR_LANGUAGES.keys()),
        "loadedLanguages": sorted(_ocr_engines.keys()),
    }


def run_ocr_on_image(image: Image.Image, language: str = DEFAULT_OCR_LANGUAGE):
    engine, _effective_language = get_ocr_engine(language)
    image = image.convert("RGB")
    image_array = np.array(image)
    results = engine.predict(image_array)

    extracted_lines = []
    full_text = []

    for result in results:
        data = result.json

        if callable(data):
            data = data()

        if not isinstance(data, dict):
            continue

        res_data = data.get("res", {})

        if not isinstance(res_data, dict):
            continue

        rec_texts = res_data.get("rec_texts", [])
        rec_scores = res_data.get("rec_scores", [])

        for index, text in enumerate(rec_texts):
            if text is None:
                continue

            text = str(text).strip()

            if not text:
                continue

            confidence = None

            if index < len(rec_scores):
                try:
                    confidence = float(rec_scores[index])
                except Exception:
                    confidence = None

            extracted_lines.append(
                {
                    "text": text,
                    "confidence": confidence,
                }
            )

            full_text.append(text)

    return extracted_lines, full_text


def process_image(contents: bytes, language: str = DEFAULT_OCR_LANGUAGE):
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    lines, text = run_ocr_on_image(image, language)

    return {
        "pages": 1,
        "page_results": [
            {
                "page": 1,
                "text": "\n".join(text),
                "lines": lines,
            }
        ],
        "text": "\n".join(text),
        "lines": lines,
    }


def process_pdf(contents: bytes, job_id: str = None, language: str = DEFAULT_OCR_LANGUAGE):
    pdf = pymupdf.open(
        stream=contents,
        filetype="pdf",
    )

    page_results = []
    all_text = []
    all_lines = []

    total_pages = len(pdf)

    print(f"[OCR] PDF contains {total_pages} pages.")

    for page_index in range(total_pages):
        page_number = page_index + 1

        if job_id:
            progress = max(
                2,
                min(
                    95,
                    round((page_number / max(1, total_pages)) * 95),
                ),
            )
            update_ocr_job(
                job_id,
                status="processing",
                progress=progress,
                stage_message=(
                    f"PaddleOCR processing page "
                    f"{page_number} of {total_pages}..."
                ),
            )

        print(
            f"[OCR] Processing PDF page "
            f"{page_number}/{total_pages}..."
        )

        page = pdf[page_index]

        matrix = pymupdf.Matrix(
            150 / 72,
            150 / 72,
        )

        pix = page.get_pixmap(
            matrix=matrix,
            alpha=False,
        )

        image = Image.frombytes(
            "RGB",
            [pix.width, pix.height],
            pix.samples,
        )

        lines, text = run_ocr_on_image(image, language)

        page_text = "\n".join(text)

        page_results.append(
            {
                "page": page_number,
                "text": page_text,
                "lines": lines,
            }
        )

        if page_text.strip():
            all_text.append(
                f"\n--- PAGE {page_number} ---\n"
                f"{page_text}"
            )

        for line in lines:
            all_lines.append(
                {
                    "page": page_number,
                    "text": line["text"],
                    "confidence": line["confidence"],
                }
            )

        # Release the rendered page image/pix before the next page.
        del image
        del pix

    pdf.close()

    return {
        "pages": total_pages,
        "page_results": page_results,
        "text": "\n".join(all_text),
        "lines": all_lines,
    }


def run_ocr_job(
    job_id: str,
    contents: bytes,
    filename: str,
    mime_type: str,
    is_pdf: bool,
    language: str = DEFAULT_OCR_LANGUAGE,
):
    try:
        update_ocr_job(
            job_id,
            status="processing",
            progress=1,
            stage_message="Starting PaddleOCR...",
        )

        if is_pdf:
            result = process_pdf(contents, job_id=job_id, language=language)
        else:
            update_ocr_job(
                job_id,
                status="processing",
                progress=50,
                stage_message="Running PaddleOCR on image...",
            )
            result = process_image(contents, language=language)

        if not result.get("text", "").strip():
            raise RuntimeError(
                "PaddleOCR completed but no text was extracted."
            )

        response = {
            "success": True,
            "filename": filename,
            "mimeType": mime_type,
            "pages": result["pages"],
            "text": result["text"],
            "lines": result["lines"],
            "pageResults": result["page_results"],
            "line_count": len(result["lines"]),
        }

        update_ocr_job(
            job_id,
            status="completed",
            progress=100,
            stage_message="PaddleOCR processing completed.",
            result=response,
        )

        print(
            f"[OCR] Job {job_id}: completed successfully."
        )

    except Exception as error:
        print("")
        print(f"[OCR] Job {job_id} ERROR:")
        print(str(error))

        update_ocr_job(
            job_id,
            status="failed",
            progress=100,
            stage_message="PaddleOCR processing failed.",
            error=str(error),
        )


@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    language: str = Form(DEFAULT_OCR_LANGUAGE),
):
    try:
        contents = await file.read()

        if not contents:
            return {
                "success": False,
                "error": "Uploaded file is empty.",
            }

        filename = file.filename or "uploaded-file"

        mime_type = (
            file.content_type or ""
        ).lower()

        extension = ""
        if "." in filename:
            extension = (
                filename
                .rsplit(".", 1)[1]
                .lower()
            )

        is_pdf = (
            mime_type == "application/pdf"
            or extension == "pdf"
        )

        job = create_ocr_job(filename)

        print("")
        print("=" * 60)
        print("OCR JOB CREATED")
        print(f"Job: {job['job_id']}")
        print(f"File: {filename}")
        print(f"Type: {mime_type}")
        print(f"Size: {len(contents)} bytes")
        print(f"Language: {language}")
        print("=" * 60)

        ocr_executor.submit(
            run_ocr_job,
            job["job_id"],
            contents,
            filename,
            mime_type,
            is_pdf,
            language,
        )

        return {
            "success": True,
            "jobId": job["job_id"],
            "status": job["status"],
            "progress": job["progress"],
            "stageMessage": job["stage_message"],
            "filename": filename,
        }

    except Exception as error:
        print("")
        print("OCR JOB CREATION ERROR:")
        print(str(error))

        return {
            "success": False,
            "error": str(error),
        }


@app.get("/ocr/status/{job_id}")
def get_ocr_status(job_id: str):
    cleanup_old_ocr_jobs()

    job = ocr_jobs.get(job_id)

    if not job:
        return {
            "success": False,
            "status": "lost",
            "jobId": job_id,
            "recoverable": True,
            "error": (
                "OCR job no longer exists. "
                "The OCR service may have restarted."
            ),
        }

    if job["status"] == "failed":
        return {
            "success": False,
            "status": "failed",
            "jobId": job_id,
            "progress": job["progress"],
            "stageMessage": job["stage_message"],
            "filename": job["filename"],
            "error": job["error"],
        }

    if job["status"] == "completed":
        response = dict(job["result"] or {})
        response.update(
            {
                "success": True,
                "status": "completed",
                "jobId": job_id,
                "progress": 100,
                "stageMessage": job["stage_message"],
            }
        )
        return response

    return {
        "success": True,
        "status": job["status"],
        "jobId": job_id,
        "progress": job["progress"],
        "stageMessage": job["stage_message"],
        "filename": job["filename"],
    }
