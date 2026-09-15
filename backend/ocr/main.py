from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from PIL import Image
import pymupdf
import io
import numpy as np


app = FastAPI(
    title="Phatan Shakti OCR Service",
    version="2.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# PaddleOCR
# =========================================================

print("Loading PaddleOCR model...")

ocr = PaddleOCR(
    lang="en",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle",
)

print("PaddleOCR model loaded successfully.")


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "service": "Phatan Shakti OCR",
        "status": "running",
        "ocr": "PaddleOCR",
        "pdf_support": True,
    }


# =========================================================
# RUN OCR ON ONE IMAGE
# =========================================================

def run_ocr_on_image(image: Image.Image):
    """
    Run PaddleOCR on a single PIL image.
    """

    image = image.convert("RGB")

    image_array = np.array(image)

    results = ocr.predict(image_array)

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


# =========================================================
# PROCESS IMAGE FILE
# =========================================================

def process_image(contents: bytes):

    image = Image.open(
        io.BytesIO(contents)
    ).convert("RGB")

    lines, text = run_ocr_on_image(image)

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


# =========================================================
# PROCESS PDF FILE
# =========================================================

def process_pdf(contents: bytes):

    pdf = pymupdf.open(
        stream=contents,
        filetype="pdf",
    )

    page_results = []

    all_text = []
    all_lines = []

    total_pages = len(pdf)

    print(f"PDF contains {total_pages} pages.")

    for page_index in range(total_pages):

        page_number = page_index + 1

        print(
            f"Processing PDF page {page_number}/{total_pages}..."
        )

        page = pdf[page_index]

        # -------------------------------------------------
        # Render PDF page at 150 DPI
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Run PaddleOCR
        # -------------------------------------------------

        lines, text = run_ocr_on_image(image)

        page_text = "\n".join(text)

        page_results.append(
            {
                "page": page_number,
                "text": page_text,
                "lines": lines,
            }
        )

        # Add page marker so Gemini knows where content came from
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

    pdf.close()

    return {
        "pages": total_pages,
        "page_results": page_results,
        "text": "\n".join(all_text),
        "lines": all_lines,
    }


# =========================================================
# OCR ENDPOINT
# =========================================================

@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...)
):

    try:

        # -------------------------------------------------
        # Read uploaded file
        # -------------------------------------------------

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

        print("")
        print("=" * 60)
        print("OCR REQUEST")
        print(f"File: {filename}")
        print(f"Type: {mime_type}")
        print(f"Size: {len(contents)} bytes")
        print("=" * 60)

        # -------------------------------------------------
        # PDF
        # -------------------------------------------------

        is_pdf = (
            mime_type == "application/pdf"
            or extension == "pdf"
        )

        if is_pdf:

            result = process_pdf(contents)

        # -------------------------------------------------
        # IMAGE
        # -------------------------------------------------

        else:

            result = process_image(contents)

        # -------------------------------------------------
        # Return response
        # -------------------------------------------------

        return {
            "success": True,
            "filename": filename,
            "mimeType": mime_type,
            "pages": result["pages"],
            "text": result["text"],
            "lines": result["lines"],
            "pageResults": result["page_results"],
            "line_count": len(result["lines"]),
        }

    except Exception as e:

        print("")
        print("OCR ERROR:")
        print(str(e))

        return {
            "success": False,
            "filename": file.filename,
            "error": str(e),
        }