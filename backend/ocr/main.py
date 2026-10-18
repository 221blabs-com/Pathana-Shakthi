import base64
import io
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from docling.datamodel.accelerator_options import AcceleratorDevice
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import (
    EasyOcrOptions,
    OcrMode,
    PdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DoclingDocument, PictureItem, TableItem
from docling_core.types.doc.labels import DocItemLabel


app = FastAPI(
    title="Phatan Shakti OCR Service (Docling)",
    version="5.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EasyOCR recognition networks are trained per script, and a Reader can only
# combine languages that share one recognizer: English can join any single
# Indic language, but two Indic scripts cannot be requested together in one
# Reader (EasyOCR raises ValueError — Telugu's recognizer has no Devanagari
# glyphs and vice versa). So unlike the old Tesseract setup, which could OCR
# tel+hin+eng in a single combined pass, each language group below is its own
# Reader/model. The teacher's language picker in the upload UI (see
# TextbookOCRModal.tsx) normally selects one of "telugu"/"hindi"/"english" up
# front, which stays a single fast pass. "auto" (no selection, or a document
# of unknown/mixed language) has no single EasyOCR pass that covers both
# Telugu and Hindi, so it runs both language groups and keeps whichever
# extracted more text — slower, but only on that fallback path.
EASYOCR_LANG_GROUPS: dict[str, list[list[str]]] = {
    "telugu": [["te", "en"]],
    "hindi": [["hi", "en"]],
    "english": [["en"]],
    "auto": [["te", "en"], ["hi", "en"]],
}
DEFAULT_LANG_GROUPS: list[list[str]] = EASYOCR_LANG_GROUPS["auto"]

# Body-text labels worth keeping as readable paragraphs. Captions are
# collected separately (attached to their picture, via caption_text), and
# structural noise (page headers/footers, footnotes, formulas, form
# fields...) is intentionally left out of the plain paragraph stream. Tables
# are handled separately below (see TableItem branch in build_chapters) —
# not dropped, despite do_table_structure being what actually computes them.
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


def resolve_lang_groups(language: str) -> list[list[str]]:
    key = (language or "auto").strip().lower()
    return EASYOCR_LANG_GROUPS.get(key, DEFAULT_LANG_GROUPS)


def get_converter(langs: list[str]) -> DocumentConverter:
    """Return a cached Docling DocumentConverter for the requested EasyOCR
    language group, building it lazily on first use. Building a converter
    loads the layout model, the table-structure model, and EasyOCR's
    detector + recognizer weights (downloaded once, then cached — see
    CLAUDE.md), so this is done once per distinct language group and reused,
    not per request.
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

    # Render is CPU-only in this deployment (Render has no GPU). Setting the
    # device here (rather than EasyOcrOptions' own deprecated `use_gpu`
    # field) is the current, non-deprecated way to ask Docling for this —
    # it also skips a CUDA/MPS probe Docling would otherwise do per model load.
    pipeline_options.accelerator_options.device = AcceleratorDevice.CPU

    # IMPORTANT: force full-page OCR rather than trusting a PDF's embedded
    # text layer. Many Telugu/Hindi textbook PDFs are produced from legacy
    # DTP fonts that remap glyphs to arbitrary Unicode code points — simply
    # reading the embedded text back out produces confident-looking garbage,
    # not real Telugu/Hindi, because no OCR ever actually ran. Rendering
    # every page as an image and recognizing it sidesteps that entirely, at
    # the cost of being slower than trusting embedded text when it happens
    # to be genuine Unicode. OcrMode.FULL_PAGE is the engine-agnostic way to
    # ask for this (force_full_page_ocr=True is Tesseract-only and
    # deprecated in favor of this).
    ocr_options = EasyOcrOptions(
        lang=langs,
        mode=OcrMode.FULL_PAGE,
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
        "ocrEngine": "easyocr",
        "pdf_support": True,
        "async_jobs": True,
        "supportedLanguages": sorted(EASYOCR_LANG_GROUPS.keys()),
        "loadedLanguageSets": sorted(str(k) for k in _converters.keys()),
    }


# Extracted textbook pictures are photographs/illustrations, not line art —
# JPEG at this quality is visually indistinguishable at reading-app display
# sizes but a fraction of PNG's size, and these images now get persisted
# (see server.ts's published-reading pipeline) instead of only flashing past
# a teacher once, so payload size actually matters.
PICTURE_JPEG_QUALITY = 82
# Longest-side cap in pixels. A picture Docling extracts from a full-page
# scan can be large enough that no reading-app UI ever displays it at full
# resolution; downscaling before encoding cuts both the base64 payload and
# whatever eventually stores it, with no visible quality loss on screen.
PICTURE_MAX_DIMENSION = 1600


def picture_to_payload(item: PictureItem, doc: DoclingDocument) -> Optional[dict]:
    try:
        image = item.get_image(doc)
    except Exception:
        image = None

    if image is None:
        return None

    rgb_image = image.convert("RGB")
    if max(rgb_image.size) > PICTURE_MAX_DIMENSION:
        rgb_image.thumbnail(
            (PICTURE_MAX_DIMENSION, PICTURE_MAX_DIMENSION)
        )

    buf = io.BytesIO()
    rgb_image.save(buf, format="JPEG", quality=PICTURE_JPEG_QUALITY, optimize=True)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")

    page_no = item.prov[0].page_no if item.prov else None
    caption = ""
    try:
        caption = item.caption_text(doc) or ""
    except Exception:
        caption = ""

    return {
        "base64": encoded,
        "mimeType": "image/jpeg",
        "pageNumber": page_no,
        "caption": caption.strip(),
    }


def table_to_payload(item: TableItem, doc: DoclingDocument) -> Optional[dict]:
    try:
        markdown = item.export_to_markdown(doc).strip()
    except Exception:
        markdown = ""

    if not markdown:
        return None

    page_no = item.prov[0].page_no if item.prov else None
    caption = ""
    try:
        caption = item.caption_text(doc) or ""
    except Exception:
        caption = ""

    return {
        "markdown": markdown,
        "pageNumber": page_no,
        "caption": caption.strip(),
    }


def build_chapters(doc: DoclingDocument) -> list[dict]:
    """Walk the document in reading order and group it into chapters: each
    heading (section header / title) starts a new chapter, and every
    paragraph, picture, or table encountered before the next heading belongs
    to it. A document with no detected headings at all (a single
    photographed page, a short worksheet) becomes one "Untitled Section"
    chapter rather than being discarded.
    """
    chapters: list[dict] = []
    current: Optional[dict] = None

    def new_chapter(heading_text: str, page_no) -> dict:
        return {
            "heading": heading_text or "Untitled Section",
            "pageNumber": page_no,
            "paragraphs": [],
            "images": [],
            "tables": [],
        }

    def has_content(chapter: dict) -> bool:
        return bool(
            chapter["paragraphs"] or chapter["images"] or chapter["tables"]
        )

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

        if isinstance(item, TableItem):
            table = table_to_payload(item, doc)
            if table:
                if current is None:
                    current = new_chapter("Untitled Section", page_no)
                current["tables"].append(table)
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


def _chapters_text_volume(chapters: list[dict]) -> int:
    """A cheap richness score for comparing two OCR passes of the same
    document under different language groups: total recognized characters
    across paragraphs and table cells. Used only to pick the better of the
    two passes 'auto' mode runs — not a quality metric in any other sense.
    """
    total = 0
    for chapter in chapters:
        total += sum(len(p) for p in chapter.get("paragraphs", []))
        total += sum(len(t.get("markdown", "")) for t in chapter.get("tables", []))
    return total


def _run_single_pass(
    contents: bytes, filename: str, langs: list[str]
) -> tuple[list[dict], Optional[int]]:
    converter = get_converter(langs)
    source = DocumentStream(name=filename, stream=io.BytesIO(contents))
    result = converter.convert(source)
    doc = result.document
    chapters = build_chapters(doc)
    page_count = len(doc.pages) if hasattr(doc, "pages") else None
    return chapters, page_count


def run_docling_job(
    job_id: str,
    contents: bytes,
    filename: str,
    lang_groups: list[list[str]],
):
    try:
        best_chapters: list[dict] = []
        best_langs: list[str] = lang_groups[0]
        best_page_count: Optional[int] = None

        for pass_index, langs in enumerate(lang_groups):
            update_ocr_job(
                job_id,
                status="processing",
                progress=5,
                stage_message=(
                    f"Loading Docling pipeline ({'+'.join(langs)})..."
                    if len(lang_groups) == 1
                    else f"Loading Docling pipeline ({'+'.join(langs)}, "
                    f"attempt {pass_index + 1}/{len(lang_groups)})..."
                ),
            )

            update_ocr_job(
                job_id,
                status="processing",
                progress=15,
                stage_message="Docling is reading pages (layout + OCR + tables)...",
            )

            chapters, page_count = _run_single_pass(contents, filename, langs)

            # Multiple passes only happen for "auto" (no single EasyOCR
            # Reader can cover more than one Indic script at once — see
            # EASYOCR_LANG_GROUPS above). Keep whichever pass actually
            # recognized more text; an empty/near-empty result means that
            # pass's script didn't match the document.
            if _chapters_text_volume(chapters) >= _chapters_text_volume(
                best_chapters
            ):
                best_chapters = chapters
                best_langs = langs
                best_page_count = page_count

        if not best_chapters:
            raise RuntimeError(
                "Docling completed but no readable text or images were found."
            )

        update_ocr_job(
            job_id,
            status="processing",
            progress=80,
            stage_message="Grouping recognized text into chapters and paragraphs...",
        )

        response = {
            "success": True,
            "filename": filename,
            "pages": best_page_count,
            "chapters": best_chapters,
            "languagesUsed": best_langs,
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
            f"({len(best_chapters)} chapters, languages {'+'.join(best_langs)})."
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
        lang_groups = resolve_lang_groups(language)

        job = create_ocr_job(filename)

        print("")
        print("=" * 60)
        print("OCR JOB CREATED (Docling + EasyOCR)")
        print(f"Job: {job['job_id']}")
        print(f"File: {filename}")
        print(f"Size: {len(contents)} bytes")
        print(f"Language groups: {[('+'.join(g)) for g in lang_groups]}")
        print("=" * 60)

        ocr_executor.submit(
            run_docling_job,
            job["job_id"],
            contents,
            filename,
            lang_groups,
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
