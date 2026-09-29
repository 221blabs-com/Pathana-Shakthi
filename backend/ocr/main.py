from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pymupdf
import io
import os
import shutil
import unicodedata
import numpy as np
import uuid
import time
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

# Tesseract otherwise spawns several OpenMP threads per call, which fights with
# our own page-level parallelism. Must be set before any Tesseract call.
os.environ.setdefault("OMP_THREAD_LIMIT", "1")

try:
    import pytesseract
except ImportError:  # service still starts; Telugu falls back to PaddleOCR
    pytesseract = None


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

SUPPORTED_LANGUAGES = {"English", "Hindi", "Telugu"}

# ---------------------------------------------------------------------------
# Engine configuration
#
#   English -> PaddleOCR   (unchanged)
#   Hindi   -> PaddleOCR   (unchanged)
#   Telugu  -> Tesseract   (PaddleOCR's Telugu model is weak on conjuncts)
#
# Override per language with env vars, e.g.  OCR_ENGINE_TELUGU=paddle
# Override per request with the optional `engine` form field
# ("auto" | "paddle" | "tesseract") to compare both on the same file.
# ---------------------------------------------------------------------------

OCR_LANGUAGE_CODES = {
    "english": "en",
    "hindi": "hi",
    "telugu": "te",
}

TESSERACT_LANGS = {
    # First entry is required; the rest are optional and only used if the
    # traineddata file is installed. "+eng" handles English words/numbers
    # that appear inside Telugu and Hindi textbooks.
    "english": ["eng"],
    "hindi": ["hin", "eng"],
    "telugu": ["tel", "eng"],
}

DEFAULT_ENGINES = {
    "english": "paddle",
    "hindi": "paddle",
    "telugu": "tesseract",
}

ENGINE_DPI = {
    "paddle": 240,
    "tesseract": 300,
}


def env_flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Number of pages Tesseract OCRs in parallel (Tesseract is single-threaded per
# page). Leave one core free for the API server.
TESSERACT_WORKERS = int(
    os.environ.get("TESSERACT_WORKERS", max(1, (os.cpu_count() or 2) - 1))
)

ocr_models = {}


def get_ocr(language: str = "English"):
    language_code = OCR_LANGUAGE_CODES.get(str(language).lower(), "en")
    if language_code not in ocr_models:
        print(f"Loading PaddleOCR {language_code} recognition model...")
        ocr_models[language_code] = PaddleOCR(
            lang=language_code,
            use_doc_orientation_classify=env_flag("PADDLE_DOC_ORIENTATION", True),
            use_doc_unwarping=False,
            use_textline_orientation=env_flag("PADDLE_TEXTLINE_ORIENTATION", True),
            engine="paddle",
        )
        print(f"PaddleOCR {language_code} model loaded successfully.")
    return ocr_models[language_code]


# ---------------------------------------------------------------------------
# Tesseract setup
# ---------------------------------------------------------------------------

_tesseract_configured = False
_tesseract_langs_cache = None


def configure_tesseract():
    """Locate the Tesseract binary once (PATH, TESSERACT_CMD, or the default
    Windows install locations)."""
    global _tesseract_configured
    if _tesseract_configured or pytesseract is None:
        return
    _tesseract_configured = True

    cmd = os.environ.get("TESSERACT_CMD") or shutil.which("tesseract")
    if not cmd:
        for candidate in (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ):
            if os.path.exists(candidate):
                cmd = candidate
                break
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd
        print(f"[OCR] Tesseract binary: {cmd}")


def get_tesseract_languages() -> set:
    global _tesseract_langs_cache
    if _tesseract_langs_cache is None:
        configure_tesseract()
        try:
            _tesseract_langs_cache = set(pytesseract.get_languages(config=""))
            print(f"[OCR] Tesseract languages installed: {sorted(_tesseract_langs_cache)}")
        except Exception as error:
            print(f"[OCR] Tesseract not available: {error}")
            _tesseract_langs_cache = set()
    return _tesseract_langs_cache


def tesseract_lang_string(language: str):
    """Return e.g. 'tel+eng', or None if the primary language pack is missing."""
    if pytesseract is None:
        return None
    wanted = TESSERACT_LANGS.get(str(language).lower())
    if not wanted:
        return None
    installed = get_tesseract_languages()
    if wanted[0] not in installed:
        return None
    return "+".join(code for code in wanted if code in installed)


def tesseract_ready(language: str) -> bool:
    return tesseract_lang_string(language) is not None


def resolve_engine(language: str, requested: str = "auto") -> str:
    requested = (requested or "auto").lower()
    key = str(language).lower()

    if requested in {"paddle", "tesseract"}:
        engine = requested
    else:
        engine = os.environ.get(
            f"OCR_ENGINE_{key.upper()}", DEFAULT_ENGINES.get(key, "paddle")
        ).lower()
        if engine not in {"paddle", "tesseract"}:
            engine = DEFAULT_ENGINES.get(key, "paddle")

    if engine == "tesseract" and not tesseract_ready(language):
        print(
            f"[OCR] Tesseract is not ready for {language} "
            "(binary or language data missing). Falling back to PaddleOCR."
        )
        return "paddle"
    return engine


ocr_jobs = {}
OCR_JOB_TTL_SECONDS = 60 * 60

# OCR is GPU/CPU intensive. One worker keeps multiple large PDFs from
# competing for the same OCR resources.
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
        "stage_message": "Queued for OCR processing...",
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
        "ocr": "PaddleOCR + Tesseract",
        "pdf_support": True,
        "async_jobs": True,
        "engines": {
            "english": resolve_engine("English"),
            "hindi": resolve_engine("Hindi"),
            "telugu": resolve_engine("Telugu"),
        },
        "tesseract_ready": {
            "english": tesseract_ready("English"),
            "hindi": tesseract_ready("Hindi"),
            "telugu": tesseract_ready("Telugu"),
        },
    }


# ---------------------------------------------------------------------------
# Native text-layer quality check
#
# Many Indian textbooks are typeset in legacy (non-Unicode) fonts. Their PDFs
# contain a text layer, but it is garbage such as "n_Ûq+<äq". We must detect
# that and OCR the page instead of trusting the text layer.
# ---------------------------------------------------------------------------

SCRIPT_RANGES = {
    "telugu": (0x0C00, 0x0C7F),
    "hindi": (0x0900, 0x097F),
}


def document_native_text_usable(page_texts, language: str) -> bool:
    """Decide ONCE per document whether the embedded text layer is real.

    This keeps the original fast behaviour (one decision, no per-page OCR) and
    only rejects a text layer that is legacy-font garbage such as "n_Ûq+<äq".
    English is always accepted; Telugu/Hindi must contain a reasonable share of
    characters from their own script.
    """
    chars = [c for c in "\n".join(page_texts) if not c.isspace() and not c.isdigit()]
    total = len(chars)

    if total <= 100:  # same threshold as the original code
        return False

    script = SCRIPT_RANGES.get(str(language).lower())
    if script is None:
        return True

    lo, hi = script
    in_script = sum(1 for c in chars if lo <= ord(c) <= hi)
    ascii_alpha = sum(1 for c in chars if c.isascii() and c.isalpha())
    non_ascii = sum(1 for c in chars if ord(c) > 127)

    # Lenient: mixed-language textbooks contain lots of English and numbers.
    real_native_script = in_script / total >= 0.25
    # A fully English book uploaded under a Telugu/Hindi label.
    real_english_doc = ascii_alpha / total >= 0.8 and non_ascii / total < 0.02
    return real_native_script or real_english_doc


def is_blank_image(image: Image.Image) -> bool:
    """Skip OCR on empty pages (cheap: works on a tiny thumbnail)."""
    thumb = np.asarray(image.convert("L").resize((160, 224)))
    return float(thumb.std()) < 3.0


# ---------------------------------------------------------------------------
# OCR engines
# ---------------------------------------------------------------------------

def run_paddle_ocr(image: Image.Image, language: str = "English"):
    image = image.convert("RGB")
    # Mild contrast and edge enhancement helps with faint textbook scans while
    # retaining the original glyph shapes and colors expected by PaddleOCR.
    enhanced = ImageOps.autocontrast(image.convert("L"))
    enhanced = ImageEnhance.Contrast(enhanced).enhance(1.15)
    enhanced = enhanced.filter(ImageFilter.UnsharpMask(radius=1.0, percent=115, threshold=3))
    image_array = np.array(enhanced.convert("RGB"))
    results = get_ocr(language).predict(image_array)

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


def run_tesseract_ocr(image: Image.Image, language: str = "English"):
    lang = tesseract_lang_string(language)
    if not lang:
        raise RuntimeError(f"Tesseract language data for {language} is not installed.")

    # Tesseract does best on clean grayscale. Heavy sharpening tends to break
    # thin Telugu/Devanagari strokes, so only normalise contrast here.
    gray = ImageOps.autocontrast(image.convert("L"))

    data = pytesseract.image_to_data(
        gray,
        lang=lang,
        config="--oem 1 --psm 3 -c preserve_interword_spaces=1",
        output_type=pytesseract.Output.DICT,
    )

    groups = {}
    order = []

    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        if not word:
            continue

        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0

        key = (
            data["page_num"][i],
            data["block_num"][i],
            data["par_num"][i],
            data["line_num"][i],
        )
        if key not in groups:
            groups[key] = {"words": [], "confs": []}
            order.append(key)

        groups[key]["words"].append(word)
        if conf >= 0:
            groups[key]["confs"].append(conf / 100.0)

    extracted_lines = []
    full_text = []

    for key in order:
        text = unicodedata.normalize("NFC", " ".join(groups[key]["words"])).strip()
        if not text:
            continue
        confs = groups[key]["confs"]
        confidence = (sum(confs) / len(confs)) if confs else None
        extracted_lines.append({"text": text, "confidence": confidence})
        full_text.append(text)

    return extracted_lines, full_text


def run_ocr(image: Image.Image, language: str, engine: str):
    """Run the chosen engine. Only Tesseract falls back to Paddle (if it fails
    or finds nothing); Paddle never triggers a second OCR pass, so English and
    Hindi cost exactly one engine run per page.
    Returns (lines, text, engine_used)."""
    if engine == "tesseract":
        try:
            lines, text = run_tesseract_ocr(image, language)
            if text:
                return lines, text, "tesseract"
            print("[OCR] Tesseract returned no text; trying PaddleOCR...")
        except Exception as error:
            print(f"[OCR] Tesseract failed ({error}); trying PaddleOCR...")

    lines, text = run_paddle_ocr(image, language)
    return lines, text, "paddle"


def render_pdf_page(page, dpi: int) -> Image.Image:
    matrix = pymupdf.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    del pix
    return image


# ---------------------------------------------------------------------------
# Image / PDF processing
# ---------------------------------------------------------------------------

def process_image(contents: bytes, language: str = "English", engine: str = "auto"):
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    chosen = resolve_engine(language, engine)
    lines, text, used = run_ocr(image, language, chosen)

    return {
        "pages": 1,
        "page_results": [
            {
                "page": 1,
                "text": "\n".join(text),
                "lines": lines,
                "source": used,
            }
        ],
        "text": "\n".join(text),
        "lines": lines,
        "engines": [used],
    }


def assemble_pdf_result(per_page):
    """per_page: list of (lines, source); lines = [{"text", "confidence"}]."""
    page_results, all_text, all_lines = [], [], []
    sources = set()

    for index, (lines, source) in enumerate(per_page):
        page_number = index + 1
        page_text = "\n".join(l["text"] for l in lines)
        sources.add(source)

        page_results.append(
            {"page": page_number, "text": page_text, "lines": lines, "source": source}
        )
        if page_text.strip():
            all_text.append(f"\n--- PAGE {page_number} ---\n{page_text}")
        for line in lines:
            all_lines.append(
                {
                    "page": page_number,
                    "text": line["text"],
                    "confidence": line["confidence"],
                }
            )

    return {
        "pages": len(per_page),
        "page_results": page_results,
        "text": "\n".join(all_text),
        "lines": all_lines,
        "engines": sorted(sources - {"blank"}) or ["blank"],
    }


def ocr_pdf_pages(pdf, language: str, engine: str, job_id, total_pages: int):
    """OCR every page. Tesseract runs several pages in parallel; Paddle runs
    sequentially (it is already multi-threaded / GPU-bound)."""
    dpi = ENGINE_DPI[engine]
    per_page = [None] * total_pages
    completed = 0

    def report(page_number: int, source: str):
        nonlocal completed
        completed += 1
        print(f"[OCR] Page {page_number}/{total_pages}: {source}")
        if job_id:
            update_ocr_job(
                job_id,
                status="processing",
                progress=max(30, min(95, 30 + round(completed / total_pages * 65))),
                stage_message=f"OCR page {completed} of {total_pages} ({engine})...",
            )

    parallel = engine == "tesseract" and TESSERACT_WORKERS > 1 and total_pages > 1

    if not parallel:
        for index in range(total_pages):
            image = render_pdf_page(pdf[index], dpi)
            if is_blank_image(image):
                per_page[index] = ([], "blank")
            else:
                lines, _, source = run_ocr(image, language, engine)
                per_page[index] = (lines, source)
            del image
            report(index + 1, per_page[index][1])
        return per_page

    print(f"[OCR] Tesseract running {TESSERACT_WORKERS} pages in parallel.")

    with ThreadPoolExecutor(max_workers=TESSERACT_WORKERS) as pool:
        pending = {}
        max_in_flight = TESSERACT_WORKERS * 2  # bounds RAM: pages are big bitmaps

        def collect(done):
            for future in done:
                index = pending.pop(future)
                lines, _ = future.result()
                per_page[index] = (lines, "tesseract")
                report(index + 1, "tesseract")

        for index in range(total_pages):
            # Rendering stays on this thread (PyMuPDF documents are not
            # thread-safe); only the slow OCR call is parallelised.
            image = render_pdf_page(pdf[index], dpi)
            if is_blank_image(image):
                per_page[index] = ([], "blank")
                report(index + 1, "blank")
            else:
                pending[pool.submit(run_tesseract_ocr, image, language)] = index
            del image

            while len(pending) >= max_in_flight:
                collect(wait(list(pending), return_when=FIRST_COMPLETED).done)

        while pending:
            collect(wait(list(pending), return_when=FIRST_COMPLETED).done)

    return per_page


def process_pdf(
    contents: bytes,
    job_id: str = None,
    language: str = "English",
    engine: str = "auto",
):
    pdf = pymupdf.open(stream=contents, filetype="pdf")
    total_pages = len(pdf)

    print(f"[OCR] PDF contains {total_pages} pages. Language: {language}.")
    print("[OCR] Checking for native PDF text first...")

    # ---------------------------------------------------------
    # FAST PATH (same as the original): read the embedded text.
    # ---------------------------------------------------------
    native_pages = []
    for page_index in range(total_pages):
        native = pdf[page_index].get_text("text", sort=True)
        native_pages.append([l.strip() for l in native.splitlines() if l.strip()])

        if job_id and (page_index % 10 == 0 or page_index == total_pages - 1):
            update_ocr_job(
                job_id,
                status="processing",
                progress=max(2, round((page_index + 1) / total_pages * 30)),
                stage_message=(
                    f"Extracting native PDF text from page "
                    f"{page_index + 1} of {total_pages}..."
                ),
            )

    if document_native_text_usable(["\n".join(p) for p in native_pages], language):
        print("[OCR] Usable native text found. OCR not required for this PDF.")
        pdf.close()
        return assemble_pdf_result(
            [
                ([{"text": l, "confidence": 1.0} for l in lines], "native")
                for lines in native_pages
            ]
        )

    # ---------------------------------------------------------
    # FALLBACK: scanned PDF, or legacy-font garbage text layer.
    # ---------------------------------------------------------
    chosen_engine = resolve_engine(language, engine)
    print(f"[OCR] No usable native text. Running OCR with {chosen_engine}...")

    per_page = ocr_pdf_pages(pdf, language, chosen_engine, job_id, total_pages)
    pdf.close()
    return assemble_pdf_result(per_page)


def run_ocr_job(
    job_id: str,
    contents: bytes,
    filename: str,
    mime_type: str,
    is_pdf: bool,
    language: str,
    engine: str,
):
    try:
        update_ocr_job(
            job_id,
            status="processing",
            progress=1,
            stage_message="Starting OCR...",
        )

        if is_pdf:
            result = process_pdf(contents, job_id=job_id, language=language, engine=engine)
        else:
            update_ocr_job(
                job_id,
                status="processing",
                progress=50,
                stage_message="Running OCR on image...",
            )
            result = process_image(contents, language=language, engine=engine)

        if not result.get("text", "").strip():
            raise RuntimeError("OCR completed but no text was extracted.")

        response = {
            "success": True,
            "filename": filename,
            "mimeType": mime_type,
            "pages": result["pages"],
            "text": result["text"],
            "lines": result["lines"],
            "pageResults": result["page_results"],
            "line_count": len(result["lines"]),
            "engines": result.get("engines", []),
        }

        update_ocr_job(
            job_id,
            status="completed",
            progress=100,
            stage_message="OCR processing completed.",
            result=response,
        )

        print(f"[OCR] Job {job_id}: completed successfully.")

    except Exception as error:
        print("")
        print(f"[OCR] Job {job_id} ERROR:")
        print(str(error))

        update_ocr_job(
            job_id,
            status="failed",
            progress=100,
            stage_message="OCR processing failed.",
            error=str(error),
        )


@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    source_language: str = Form("English"),
    engine: str = Form("auto"),
):
    try:
        contents = await file.read()

        if not contents:
            return {
                "success": False,
                "error": "Uploaded file is empty.",
            }

        filename = file.filename or "uploaded-file"
        mime_type = (file.content_type or "").lower()

        extension = ""
        if "." in filename:
            extension = filename.rsplit(".", 1)[1].lower()

        is_pdf = mime_type == "application/pdf" or extension == "pdf"

        language = source_language if source_language in SUPPORTED_LANGUAGES else "English"
        engine = engine.lower() if engine.lower() in {"auto", "paddle", "tesseract"} else "auto"

        job = create_ocr_job(filename)

        print("")
        print("=" * 60)
        print("OCR JOB CREATED")
        print(f"Job: {job['job_id']}")
        print(f"File: {filename}")
        print(f"Type: {mime_type}")
        print(f"Size: {len(contents)} bytes")
        print(f"Language: {language}   Engine: {engine}")
        print("=" * 60)

        ocr_executor.submit(
            run_ocr_job,
            job["job_id"],
            contents,
            filename,
            mime_type,
            is_pdf,
            language,
            engine,
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