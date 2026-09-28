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
from docling_core.types.doc.document import DocItemLabel, TableCell, TableData


def make_test_image(color=(80, 130, 200), size=(100, 80)):
    return Image.new("RGB", size, color=color)


def make_test_table():
    cells = [
        TableCell(
            text="Item",
            start_row_offset_idx=0,
            end_row_offset_idx=1,
            start_col_offset_idx=0,
            end_col_offset_idx=1,
            row_span=1,
            col_span=1,
            column_header=True,
        ),
        TableCell(
            text="Count",
            start_row_offset_idx=0,
            end_row_offset_idx=1,
            start_col_offset_idx=1,
            end_col_offset_idx=2,
            row_span=1,
            col_span=1,
            column_header=True,
        ),
        TableCell(
            text="Apples",
            start_row_offset_idx=1,
            end_row_offset_idx=2,
            start_col_offset_idx=0,
            end_col_offset_idx=1,
            row_span=1,
            col_span=1,
        ),
        TableCell(
            text="5",
            start_row_offset_idx=1,
            end_row_offset_idx=2,
            start_col_offset_idx=1,
            end_col_offset_idx=2,
            row_span=1,
            col_span=1,
        ),
    ]
    return TableData(table_cells=cells, num_rows=2, num_cols=2)


class ResolveLangGroupsTests(unittest.TestCase):
    def test_known_languages_resolve_to_a_single_easyocr_group(self):
        # Each Indic language pairs with English — that's the only
        # combination a single EasyOCR Reader can recognize in one pass
        # (see EASYOCR_LANG_GROUPS's comment in main.py).
        self.assertEqual(main.resolve_lang_groups("telugu"), [["te", "en"]])
        self.assertEqual(main.resolve_lang_groups("hindi"), [["hi", "en"]])
        self.assertEqual(main.resolve_lang_groups("english"), [["en"]])

    def test_auto_and_unknown_fall_back_to_both_indic_groups(self):
        # "auto" can't run Telugu+Hindi in one EasyOCR pass (different
        # recognizer networks), so it tries both groups and the caller picks
        # the richer result — see run_docling_job.
        expected = [["te", "en"], ["hi", "en"]]
        self.assertEqual(main.resolve_lang_groups("auto"), expected)
        self.assertEqual(main.resolve_lang_groups("nonsense"), expected)
        self.assertEqual(main.resolve_lang_groups(""), expected)
        self.assertEqual(main.resolve_lang_groups(None), expected)

    def test_case_and_whitespace_insensitive(self):
        self.assertEqual(main.resolve_lang_groups("  Telugu  "), [["te", "en"]])
        self.assertEqual(main.resolve_lang_groups("HINDI"), [["hi", "en"]])


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
        self.assertEqual(images[0]["mimeType"], "image/jpeg")
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

    def test_table_extracted_as_markdown_and_attributed_to_chapter(self):
        # do_table_structure=True actually computes table cells in the real
        # pipeline (see get_converter) — this was previously thrown away
        # entirely because build_chapters had no branch for TableItem.
        doc = DoclingDocument(name="Test")
        doc.add_heading("Chapter 4: Fruit Count", level=1)
        doc.add_text(label=DocItemLabel.TEXT, text="Count the fruits below.")
        doc.add_table(data=make_test_table())
        doc.add_text(label=DocItemLabel.TEXT, text="Now answer the questions.")

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        tables = chapters[0]["tables"]
        self.assertEqual(len(tables), 1)
        self.assertIn("Apples", tables[0]["markdown"])
        self.assertIn("Count", tables[0]["markdown"])
        # Table must sit between its surrounding paragraphs, not reorder them.
        self.assertEqual(
            chapters[0]["paragraphs"],
            ["Count the fruits below.", "Now answer the questions."],
        )

    def test_table_alone_with_no_paragraphs_still_starts_a_chapter(self):
        doc = DoclingDocument(name="Test")
        doc.add_table(data=make_test_table())

        chapters = main.build_chapters(doc)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0]["heading"], "Untitled Section")
        self.assertEqual(len(chapters[0]["tables"]), 1)

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

    def test_picture_base64_round_trips_to_a_valid_jpeg(self):
        doc = DoclingDocument(name="Test")
        image_ref = ImageRef.from_pil(make_test_image(size=(64, 48)), dpi=72)
        picture_item = doc.add_picture(image=image_ref)

        payload = main.picture_to_payload(picture_item, doc)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["mimeType"], "image/jpeg")
        import base64 as b64

        decoded = b64.b64decode(payload["base64"])
        round_tripped = Image.open(io.BytesIO(decoded))
        self.assertEqual(round_tripped.format, "JPEG")
        self.assertEqual(round_tripped.size, (64, 48))

    def test_picture_larger_than_cap_is_downscaled(self):
        doc = DoclingDocument(name="Test")
        oversized = make_test_image(size=(3000, 2000))
        image_ref = ImageRef.from_pil(oversized, dpi=72)
        picture_item = doc.add_picture(image=image_ref)

        payload = main.picture_to_payload(picture_item, doc)

        import base64 as b64

        decoded = b64.b64decode(payload["base64"])
        round_tripped = Image.open(io.BytesIO(decoded))
        self.assertLessEqual(
            max(round_tripped.size), main.PICTURE_MAX_DIMENSION
        )
        # Aspect ratio preserved.
        self.assertAlmostEqual(
            oversized.size[0] / oversized.size[1],
            round_tripped.size[0] / round_tripped.size[1],
            places=2,
        )

    def test_picture_smaller_than_cap_is_not_upscaled(self):
        doc = DoclingDocument(name="Test")
        image_ref = ImageRef.from_pil(make_test_image(size=(64, 48)), dpi=72)
        picture_item = doc.add_picture(image=image_ref)

        payload = main.picture_to_payload(picture_item, doc)

        import base64 as b64

        decoded = b64.b64decode(payload["base64"])
        round_tripped = Image.open(io.BytesIO(decoded))
        self.assertEqual(round_tripped.size, (64, 48))


class TableToPayloadTests(unittest.TestCase):
    def test_table_without_cells_returns_none(self):
        doc = DoclingDocument(name="Test")
        empty_table = TableData(table_cells=[], num_rows=0, num_cols=0)
        table_item = doc.add_table(data=empty_table)

        result = main.table_to_payload(table_item, doc)

        self.assertIsNone(result)

    def test_table_markdown_contains_cell_text(self):
        doc = DoclingDocument(name="Test")
        table_item = doc.add_table(data=make_test_table())

        payload = main.table_to_payload(table_item, doc)

        self.assertIsNotNone(payload)
        self.assertIn("Item", payload["markdown"])
        self.assertIn("Apples", payload["markdown"])
        self.assertIn("5", payload["markdown"])


class ChaptersTextVolumeTests(unittest.TestCase):
    def test_counts_paragraph_and_table_characters(self):
        chapters = [
            {
                "paragraphs": ["abcde", "fg"],
                "images": [],
                "tables": [{"markdown": "12345"}],
            }
        ]
        self.assertEqual(main._chapters_text_volume(chapters), 12)

    def test_empty_chapters_score_zero(self):
        self.assertEqual(main._chapters_text_volume([]), 0)


class RunDoclingJobMultiPassTests(unittest.TestCase):
    """run_docling_job runs one pass per language group and keeps the
    richer result — this is how "auto" mode copes with EasyOCR being unable
    to combine Telugu and Hindi in a single Reader (see EASYOCR_LANG_GROUPS).
    Mocks _run_single_pass so this exercises the selection logic without
    needing a real Docling/EasyOCR conversion.
    """

    def setUp(self):
        main.ocr_jobs.clear()
        self._original_run_single_pass = main._run_single_pass

    def tearDown(self):
        main._run_single_pass = self._original_run_single_pass
        main.ocr_jobs.clear()

    def test_picks_the_language_group_with_more_recognized_text(self):
        job = main.create_ocr_job("book.pdf")

        sparse_chapters = [
            {"heading": "A", "paragraphs": ["x"], "images": [], "tables": []}
        ]
        rich_chapters = [
            {
                "heading": "B",
                "paragraphs": ["a real paragraph of recognized text"],
                "images": [],
                "tables": [],
            }
        ]

        def fake_run_single_pass(contents, filename, langs):
            if langs == ["te", "en"]:
                return sparse_chapters, 3
            return rich_chapters, 3

        main._run_single_pass = fake_run_single_pass

        main.run_docling_job(
            job["job_id"], b"fake-bytes", "book.pdf", [["te", "en"], ["hi", "en"]]
        )

        result = main.ocr_jobs[job["job_id"]]
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["result"]["chapters"], rich_chapters)
        self.assertEqual(result["result"]["languagesUsed"], ["hi", "en"])

    def test_single_language_group_runs_only_one_pass(self):
        job = main.create_ocr_job("book.pdf")
        calls = []

        def fake_run_single_pass(contents, filename, langs):
            calls.append(langs)
            return (
                [{"heading": "A", "paragraphs": ["x"], "images": [], "tables": []}],
                1,
            )

        main._run_single_pass = fake_run_single_pass

        main.run_docling_job(job["job_id"], b"fake-bytes", "book.pdf", [["en"]])

        self.assertEqual(calls, [["en"]])
        self.assertEqual(main.ocr_jobs[job["job_id"]]["status"], "completed")

    def test_all_passes_empty_marks_job_failed(self):
        job = main.create_ocr_job("book.pdf")

        def fake_run_single_pass(contents, filename, langs):
            return [], 1

        main._run_single_pass = fake_run_single_pass

        main.run_docling_job(job["job_id"], b"fake-bytes", "book.pdf", [["en"]])

        self.assertEqual(main.ocr_jobs[job["job_id"]]["status"], "failed")


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
