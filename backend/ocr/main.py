import base64
import io
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    TesseractCliOcrOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DoclingDocument, PictureItem
from docling_core.types.doc.labels import DocItemLabel


app = FastAPI(
    title="Phatan Shakti OCR Service (Docling)",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tesseract uses 3-letter (ISO 639-2) language codes, not "te"/"hi"/"en".
# Passing all three languages together (the default) runs genuine combined
# recognition, not sequential fallback — Tesseract disambiguates script per
# glyph in a single pass, which matches SCERT textbooks that routinely mix
# English loanwords/captions into Telugu or Hindi body text on one page. A
# caller that knows a document is monolingual can still ask for just one
# language, which is faster and slightly more accurate for that case.
TESSERACT_LANG_MAP = {
    "telugu": ["tel"],
    "hindi": ["hin"],
    "english": ["eng"],
    "auto": ["tel", "hin", "eng"],
}
DEFAULT_LANGS = ["tel", "hin", "eng"]

# Body-text labels worth keeping as readable paragraphs. Captions are
# collected separately (attached to their picture, via caption_text), and
# structural noise (page headers/footers, footnotes, tables, formulas,
# form fields...) is intentionally left out of the plain paragraph stream.
PARAGRAPH_LABELS = {
    DocItemLabel.TEXT,
    DocItemLabel.PARAGRAPH,
    DocItemLabel.LIST_ITEM,
    DocItemLabel.HANDWRITTEN_TEXT,
}
HEADING_LABELS = {
    DocItemLabel.SECTION_HEADER,
    DocItemLabel.TITLE,
}

_converters: dict[tuple, DocumentConverter] = {}


def resolve_langs(language: str) -> list[str]:
    key = (language or "auto").strip().lower()
    return TESSERACT_LANG_MAP.get(key, DEFAULT_LANGS)


def get_converter(langs: list[str]) -> DocumentConverter:
    """Return a cached Docling DocumentConverter for the requested Tesseract
    language set, building it lazily on first use. Building a converter
    loads the layout + table-structure models, so this is done once per
    distinct language combination and reused, not per request.
    """
    key = tuple(langs)

    if key in _converters:
        return _converters[key]

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options.do_cell_matching = True

    # Pixel data for each detected picture, needed to export it as an image.
    pipeline_options.generate_picture_images = True

    # IMPORTANT: force full-page OCR rather than trusting a PDF's embedded
    # text layer. Many Telugu/Hindi textbook PDFs are produced from legacy
    # DTP fonts that remap glyphs to arbitrary Unicode code points — simply
    # reading the embedded text back out produces confident-looking garbage,
    # not real Telugu/Hindi, because no OCR ever actually ran. Rendering
    # every page as an image and recognizing it sidesteps that entirely, at
    # the cost of being slower than trusting embedded text when it happens
    # to be genuine Unicode.
    ocr_options = TesseractCliOcrOptions(
        lang=langs,
        force_full_page_ocr=True,
    )
    pipeline_options.ocr_options = ocr_options

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            InputFormat.IMAGE: PdfFormatOption(pipeline_options=pipeline_options),
        }
    )

    _converters[key] = converter
    return converter


ocr_jobs = {}
OCR_JOB_TTL_SECONDS = 60 * 60

# Docling's layout + OCR pipeline is heavier per page than raw text
# recognition. One worker keeps a large, image-heavy textbook from
# competing with another for the same CPU/GPU resources.
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
        "stage_message": "Queued for Docling processing...",
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
        "ocr": "Docling",
        "ocrEngine": "tesseract",
        "pdf_support": True,
        "async_jobs": True,
        "supportedLanguages": sorted(TESSERACT_LANG_MAP.keys()),
        "loadedLanguageSets": sorted(str(k) for k in _converters.keys()),
    }


def picture_to_payload(item: PictureItem, doc: DoclingDocument) -> Optional[dict]:
    try:
        image = item.get_image(doc)
    except Exception:
        image = None

    if image is None:
        return None

    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")

    page_no = item.prov[0].page_no if item.prov else None
    caption = ""
    try:
        caption = item.caption_text(doc) or ""
    except Exception:
        caption = ""

    return {
        "base64": encoded,
        "mimeType": "image/png",
        "pageNumber": page_no,
        "caption": caption.strip(),
    }


def build_chapters(doc: DoclingDocument) -> list[dict]:
    """Walk the document in reading order and group it into chapters: each
    heading (section header / title) starts a new chapter, and every
    paragraph or picture encountered before the next heading belongs to it.
    A document with no detected headings at all (a single photographed
    page, a short worksheet) becomes one "Untitled Section" chapter rather
    than being discarded.
    """
    chapters: list[dict] = []
    current: Optional[dict] = None

    def new_chapter(heading_text: str, page_no) -> dict:
        return {
            "heading": heading_text or "Untitled Section",
            "pageNumber": page_no,
            "paragraphs": [],
            "images": [],
        }

    def has_content(chapter: dict) -> bool:
        return bool(chapter["paragraphs"] or chapter["images"])

    for item, _level in doc.iterate_items():
        label = getattr(item, "label", None)
        page_no = item.prov[0].page_no if getattr(item, "prov", None) else None

        if label in HEADING_LABELS:
            heading_text = (getattr(item, "text", "") or "").strip()
            if not heading_text:
                continue
            if current is not None and has_content(current):
                chapters.append(current)
            current = new_chapter(heading_text, page_no)
            continue

        if isinstance(item, PictureItem):
            picture = picture_to_payload(item, doc)
            if picture:
                if current is None:
                    current = new_chapter("Untitled Section", page_no)
                current["images"].append(picture)
            continue

        if label in PARAGRAPH_LABELS:
            text = (getattr(item, "text", "") or "").strip()
            if not text:
                continue
            if current is None:
                current = new_chapter("Untitled Section", page_no)
            current["paragraphs"].append(text)

    if current is not None and has_content(current):
        chapters.append(current)

    return chapters


def run_docling_job(
    job_id: str,
    contents: bytes,
    filename: str,
    langs: list[str],
):
    try:
        update_ocr_job(
            job_id,
            status="processing",
            progress=5,
            stage_message=f"Loading Docling pipeline ({'+'.join(langs)})...",
        )

        converter = get_converter(langs)

        update_ocr_job(
            job_id,
            status="processing",
            progress=15,
            stage_message="Docling is reading pages (layout + OCR + tables)...",
        )

        source = DocumentStream(name=filename, stream=io.BytesIO(contents))
        result = converter.convert(source)
        doc = result.document

        update_ocr_job(
            job_id,
            status="processing",
            progress=80,
            stage_message="Grouping recognized text into chapters and paragraphs...",
        )

        chapters = build_chapters(doc)

        if not chapters:
            raise RuntimeError(
                "Docling completed but no readable text or images were found."
            )

        page_count = len(doc.pages) if hasattr(doc, "pages") else None

        response = {
            "success": True,
            "filename": filename,
            "pages": page_count,
            "chapters": chapters,
            "languagesUsed": langs,
        }

        update_ocr_job(
            job_id,
            status="completed",
            progress=100,
            stage_message="Docling processing completed.",
            result=response,
        )

        print(
            f"[OCR] Job {job_id}: completed successfully "
            f"({len(chapters)} chapters)."
        )

    except Exception as error:
        print("")
        print(f"[OCR] Job {job_id} ERROR:")
        print(str(error))

        update_ocr_job(
            job_id,
            status="failed",
            progress=100,
            stage_message="Docling processing failed.",
            error=str(error),
        )


@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    language: str = Form("auto"),
):
    try:
        contents = await file.read()

        if not contents:
            return {
                "success": False,
                "error": "Uploaded file is empty.",
            }

        filename = file.filename or "uploaded-file"
        langs = resolve_langs(language)

        job = create_ocr_job(filename)

        print("")
        print("=" * 60)
        print("OCR JOB CREATED (Docling)")
        print(f"Job: {job['job_id']}")
        print(f"File: {filename}")
        print(f"Size: {len(contents)} bytes")
        print(f"Languages: {'+'.join(langs)}")
        print("=" * 60)

        ocr_executor.submit(
            run_docling_job,
            job["job_id"],
            contents,
            filename,
            langs,
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
