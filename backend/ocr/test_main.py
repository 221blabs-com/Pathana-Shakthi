"""Unit tests for the Docling OCR service's pure logic.

Deliberately avoids anything that needs Docling's layout model (no
DocumentConverter.convert() calls) so these run offline and fast, including
in network-restricted environments — build_chapters/picture_to_payload are
exercised directly against hand-built DoclingDocument objects instead.

Run with: python3 -m unittest backend/ocr/test_main.py -v
(from the backend/ocr directory, or with backend/ocr on PYTHONPATH)
"""

import io
import time
import unittest

from PIL import Image

import main
from docling_core.types.doc import DoclingDocument, ImageRef
from docling_core.types.doc.document import DocItemLabel


def make_test_image(color=(80, 130, 200), size=(100, 80)):
    return Image.new("RGB", size, color=color)


class ResolveLangsTests(unittest.TestCase):
    def test_known_languages(self):
        self.assertEqual(main.resolve_langs("telugu"), ["tel"])
        self.assertEqual(main.resolve_langs("hindi"), ["hin"])
        self.assertEqual(main.resolve_langs("english"), ["eng"])

    def test_auto_and_unknown_fall_back_to_all_three(self):
        self.assertEqual(main.resolve_langs("auto"), ["tel", "hin", "eng"])
        self.assertEqual(main.resolve_langs("nonsense"), ["tel", "hin", "eng"])
        self.assertEqual(main.resolve_langs(""), ["tel", "hin", "eng"])
        self.assertEqual(main.resolve_langs(None), ["tel", "hin", "eng"])

    def test_case_and_whitespace_insensitive(self):
        self.assertEqual(main.resolve_langs("  Telugu  "), ["tel"])
        self.assertEqual(main.resolve_langs("HINDI"), ["hin"])


class BuildChaptersTests(unittest.TestCase):
    def test_headings_split_into_separate_chapters(self):
        doc = DoclingDocument(name="Test")
        doc.add_heading("Chapter 1: The Farmer and the Well", level=1)
        doc.add_text(
            label=DocItemLabel.TEXT,
            text="Once upon a time there lived a farmer.",
        )
        doc.add_text(
            label=DocItemLabel.TEXT,
            text="He worked hard every day.",
        )
        doc.add_heading("Chapter 2: The Clever Crow", level=1)
        doc.add_text(
            label=DocItemLabel.TEXT,
            text="A thirsty crow found a pot.",
        )

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0]["heading"], "Chapter 1: The Farmer and the Well")
        self.assertEqual(
            chapters[0]["paragraphs"],
            [
                "Once upon a time there lived a farmer.",
                "He worked hard every day.",
            ],
        )
        self.assertEqual(chapters[0]["images"], [])
        self.assertEqual(chapters[1]["heading"], "Chapter 2: The Clever Crow")
        self.assertEqual(chapters[1]["paragraphs"], ["A thirsty crow found a pot."])

    def test_paragraph_with_no_heading_becomes_untitled_section(self):
        doc = DoclingDocument(name="Test")
        doc.add_text(label=DocItemLabel.TEXT, text="Fill in the blanks below.")

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0]["heading"], "Untitled Section")
        self.assertEqual(chapters[0]["paragraphs"], ["Fill in the blanks below."])

    def test_trailing_paragraph_after_last_heading_is_not_dropped(self):
        doc = DoclingDocument(name="Test")
        doc.add_heading("Chapter 2: The Clever Crow", level=1)
        doc.add_text(label=DocItemLabel.TEXT, text="A thirsty crow found a pot.")
        # No new heading follows — this must fold into chapter 2, not vanish.
        doc.add_text(label=DocItemLabel.TEXT, text="Fill in the blanks below.")

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(
            chapters[0]["paragraphs"],
            ["A thirsty crow found a pot.", "Fill in the blanks below."],
        )

    def test_heading_with_no_content_is_dropped_not_emitted_empty(self):
        doc = DoclingDocument(name="Test")
        doc.add_heading("Running Header", level=1)
        doc.add_heading("Chapter 1: Real Chapter", level=1)
        doc.add_text(label=DocItemLabel.TEXT, text="Real content here.")

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0]["heading"], "Chapter 1: Real Chapter")

    def test_picture_extracted_with_caption_and_attributed_to_chapter(self):
        doc = DoclingDocument(name="Test")
        doc.add_heading("Chapter 2: The Clever Crow", level=1)
        doc.add_text(label=DocItemLabel.TEXT, text="A thirsty crow found a pot.")

        image_ref = ImageRef.from_pil(make_test_image(), dpi=72)
        caption_item = doc.add_text(
            label=DocItemLabel.CAPTION, text="A crow standing by a pot"
        )
        doc.add_picture(image=image_ref, caption=caption_item)

        doc.add_text(label=DocItemLabel.TEXT, text="The crow dropped pebbles in.")

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        images = chapters[0]["images"]
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]["caption"], "A crow standing by a pot")
        self.assertEqual(images[0]["mimeType"], "image/png")
        self.assertTrue(len(images[0]["base64"]) > 0)
        # Image must sit between its surrounding paragraphs, not reorder them.
        self.assertEqual(
            chapters[0]["paragraphs"],
            ["A thirsty crow found a pot.", "The crow dropped pebbles in."],
        )

    def test_picture_alone_with_no_paragraphs_still_starts_a_chapter(self):
        doc = DoclingDocument(name="Test")
        image_ref = ImageRef.from_pil(make_test_image(), dpi=72)
        doc.add_picture(image=image_ref)

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0]["heading"], "Untitled Section")
        self.assertEqual(len(chapters[0]["images"]), 1)

    def test_empty_document_produces_no_chapters(self):
        doc = DoclingDocument(name="Empty")
        chapters = main.build_chapters(doc)
        self.assertEqual(chapters, [])


class PictureToPayloadTests(unittest.TestCase):
    def test_picture_without_image_data_returns_none(self):
        doc = DoclingDocument(name="Test")
        # A picture item with no image payload attached at all.
        picture_item = doc.add_picture(image=None)
        result = main.picture_to_payload(picture_item, doc)
        self.assertIsNone(result)

    def test_picture_base64_round_trips_to_a_valid_png(self):
        doc = DoclingDocument(name="Test")
        image_ref = ImageRef.from_pil(make_test_image(size=(64, 48)), dpi=72)
        picture_item = doc.add_picture(image=image_ref)

        payload = main.picture_to_payload(picture_item, doc)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["mimeType"], "image/png")
        import base64 as b64

        decoded = b64.b64decode(payload["base64"])
        round_tripped = Image.open(io.BytesIO(decoded))
        self.assertEqual(round_tripped.format, "PNG")


class OcrJobLifecycleTests(unittest.TestCase):
    def setUp(self):
        main.ocr_jobs.clear()

    def tearDown(self):
        main.ocr_jobs.clear()

    def test_create_job_starts_queued(self):
        job = main.create_ocr_job("book.pdf")
        self.assertEqual(job["status"], "queued")
        self.assertEqual(job["progress"], 0)
        self.assertEqual(job["filename"], "book.pdf")
        self.assertIn(job["job_id"], main.ocr_jobs)

    def test_update_job_merges_fields(self):
        job = main.create_ocr_job("book.pdf")
        main.update_ocr_job(job["job_id"], status="processing", progress=42)
        self.assertEqual(main.ocr_jobs[job["job_id"]]["status"], "processing")
        self.assertEqual(main.ocr_jobs[job["job_id"]]["progress"], 42)

    def test_update_unknown_job_is_a_no_op(self):
        # Must not raise even if the job id doesn't exist (e.g. already
        # cleaned up by TTL while a background thread was still working).
        main.update_ocr_job("does-not-exist", status="completed")

    def test_cleanup_removes_only_expired_jobs(self):
        fresh = main.create_ocr_job("fresh.pdf")
        stale = main.create_ocr_job("stale.pdf")
        main.ocr_jobs[stale["job_id"]]["created_at"] = (
            time.time() - main.OCR_JOB_TTL_SECONDS - 60
        )

        main.cleanup_old_ocr_jobs()

        self.assertIn(fresh["job_id"], main.ocr_jobs)
        self.assertNotIn(stale["job_id"], main.ocr_jobs)


if __name__ == "__main__":
    unittest.main()
