// Unit tests for server/textbookOcr.ts — pure logic, no server/network
// needed. Run with: npx tsx --test server/textbookOcr.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cleanOcrText,
  extractChapterNumberAndTitle,
  chaptersFromDoclingResult,
  normalizeChapterResult,
  buildFallbackMetadata,
  MAX_DETECTED_CHAPTERS,
} from "./textbookOcr";

describe("cleanOcrText", () => {
  test("trims and collapses runs of spaces/tabs", () => {
    assert.equal(cleanOcrText("  hello   world  "), "hello world");
  });

  test("collapses more than two consecutive blank lines to one", () => {
    assert.equal(cleanOcrText("a\n\n\n\n\nb"), "a\n\nb");
  });

  test("strips carriage returns", () => {
    assert.equal(cleanOcrText("a\r\nb"), "a\nb");
  });

  test("handles null/undefined/non-string input without throwing", () => {
    assert.equal(cleanOcrText(undefined as any), "");
    assert.equal(cleanOcrText(null as any), "");
  });
});

describe("extractChapterNumberAndTitle", () => {
  test("parses 'Chapter N: Title' headings", () => {
    const result = extractChapterNumberAndTitle(
      "Chapter 3: The Clever Crow"
    );
    assert.equal(result.chapterNumber, "Chapter 3");
    assert.equal(result.chapterTitle, "The Clever Crow");
  });

  test("parses 'Unit'/'Lesson'/'Poem' style headings, preserving heading case", () => {
    assert.deepEqual(extractChapterNumberAndTitle("Unit 5 - Water Cycle"), {
      chapterNumber: "Unit 5",
      chapterTitle: "Water Cycle",
    });
    assert.deepEqual(extractChapterNumberAndTitle("Poem: The Butterfly"), {
      chapterNumber: "Poem",
      chapterTitle: "The Butterfly",
    });
  });

  test("parses bare numbered headings like '3. The Farmer'", () => {
    assert.deepEqual(extractChapterNumberAndTitle("3. The Farmer"), {
      chapterNumber: "Chapter 3",
      chapterTitle: "The Farmer",
    });
  });

  test("falls back to empty chapterNumber for an unstructured heading", () => {
    assert.deepEqual(extractChapterNumberAndTitle("Water Cycle"), {
      chapterNumber: "",
      chapterTitle: "Water Cycle",
    });
  });
});

function image(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    base64: "aGVsbG8=",
    mimeType: "image/png",
    pageNumber: 3,
    caption: "A crow standing by a pot",
    ...overrides,
  };
}

describe("chaptersFromDoclingResult", () => {
  test("maps heading + paragraphs + images into DetectedChapter[]", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 2: The Clever Crow",
        pageNumber: 3,
        paragraphs: ["A thirsty crow found a pot.", "  It dropped pebbles.  "],
        images: [image()],
      },
    ]);

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].chapterNumber, "Chapter 2");
    assert.equal(chunks[0].chapterTitle, "The Clever Crow");
    assert.deepEqual(chunks[0].paragraphs, [
      "A thirsty crow found a pot.",
      "It dropped pebbles.",
    ]);
    assert.equal(chunks[0].text, "A thirsty crow found a pot.\n\nIt dropped pebbles.");
    assert.equal(chunks[0].images.length, 1);
    assert.equal(chunks[0].images[0].caption, "A crow standing by a pot");
    assert.equal(chunks[0].pageNumber, 3);
  });

  test("drops a chapter with no paragraphs and no images (layout noise)", () => {
    const chunks = chaptersFromDoclingResult([
      { heading: "Running Header", pageNumber: 1, paragraphs: [], images: [] },
      {
        heading: "Chapter 1: Real Chapter",
        pageNumber: 2,
        paragraphs: ["Real content."],
        images: [],
      },
    ]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].chapterTitle, "Real Chapter");
  });

  test("a chapter with only images and no paragraphs is kept", () => {
    const chunks = chaptersFromDoclingResult([
      { heading: "Diagram Page", pageNumber: 1, paragraphs: [], images: [image()] },
    ]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].paragraphs.length, 0);
    assert.equal(chunks[0].images.length, 1);
  });

  test("filters out an image with no usable base64", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 1",
        paragraphs: ["Some text."],
        images: [image({ base64: "" }), image({ base64: undefined }), image()],
      },
    ]);
    assert.equal(chunks[0].images.length, 1);
  });

  test("defaults a missing mimeType/caption/pageNumber safely", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 1",
        paragraphs: ["Some text."],
        images: [{ base64: "aGVsbG8=" }],
      },
    ]);
    const img = chunks[0].images[0];
    assert.equal(img.mimeType, "image/png");
    assert.equal(img.caption, "");
    assert.equal(img.pageNumber, null);
  });

  test("handles non-array / malformed input gracefully", () => {
    assert.deepEqual(chaptersFromDoclingResult(null as any), []);
    assert.deepEqual(chaptersFromDoclingResult(undefined as any), []);
    assert.deepEqual(chaptersFromDoclingResult([null, undefined, {}] as any), []);
  });

  test("caps chapters at MAX_DETECTED_CHAPTERS", () => {
    const many = Array.from({ length: MAX_DETECTED_CHAPTERS + 20 }, (_, i) => ({
      heading: `Chapter ${i + 1}`,
      paragraphs: [`Body text for section ${i + 1}.`],
      images: [],
    }));
    const chunks = chaptersFromDoclingResult(many);
    assert.equal(chunks.length, MAX_DETECTED_CHAPTERS);
  });
});

describe("buildFallbackMetadata", () => {
  test("uses the file name and first chapter's opening text when Ollama is unreachable", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 1: The Farmer and the Well",
        paragraphs: ["Once upon a time there lived a farmer."],
        images: [],
      },
    ]);
    const metadata = buildFallbackMetadata("textbook.pdf", chunks);
    assert.equal(metadata.subject, "Unknown");
    assert.equal(metadata.grade, "Unknown");
    assert.equal(metadata.primaryLanguage, "Unknown");
    assert.equal(metadata.bookTitle, "textbook.pdf");
    assert.equal(metadata.overallSummary, "Once upon a time there lived a farmer.");
  });

  test("falls back to the first chapter title when no file name is given", () => {
    const chunks = chaptersFromDoclingResult([
      { heading: "Chapter 1: Real Chapter", paragraphs: ["Text."], images: [] },
    ]);
    const metadata = buildFallbackMetadata("", chunks);
    assert.equal(metadata.bookTitle, "Real Chapter");
  });

  test("never throws on an empty chunk list", () => {
    const metadata = buildFallbackMetadata("book.pdf", []);
    assert.equal(metadata.bookTitle, "book.pdf");
    assert.equal(metadata.overallSummary, "");
  });
});

describe("normalizeChapterResult", () => {
  const fallback = {
    chapterNumber: "Chapter 1",
    chapterTitle: "The Farmer",
    text: "Full OCR text.",
    paragraphs: ["Full OCR text."],
    images: [image()],
    pageNumber: 2,
  };

  test("text/paragraphs/images/pageNumber always come from fallback, never from AI output", () => {
    const result = normalizeChapterResult(
      {
        chapterNumber: "AI Chapter",
        chapterTitle: "AI Title",
        text: "AI should not override this",
        paragraphs: ["AI paragraph"],
        images: [],
        pageNumber: 999,
        summary: "AI summary",
      },
      fallback
    );
    assert.equal(result.text, fallback.text);
    assert.deepEqual(result.paragraphs, fallback.paragraphs);
    assert.deepEqual(result.images, fallback.images);
    assert.equal(result.pageNumber, fallback.pageNumber);
    // chapterNumber/chapterTitle/summary DO come from the AI when present.
    assert.equal(result.chapterNumber, "AI Chapter");
    assert.equal(result.summary, "AI summary");
  });

  test("falls back to fallback chapterNumber/chapterTitle when AI gives none", () => {
    const result = normalizeChapterResult({}, fallback);
    assert.equal(result.chapterNumber, fallback.chapterNumber);
    assert.equal(result.chapterTitle, fallback.chapterTitle);
    assert.equal(result.summary, "No summary generated.");
    assert.deepEqual(result.importantConcepts, []);
    assert.deepEqual(result.keyVocabulary, []);
  });

  test("caps and reshapes keyVocabulary/importantConcepts/objectives/themes", () => {
    const result = normalizeChapterResult(
      {
        importantConcepts: Array.from({ length: 10 }, (_, i) => `c${i}`),
        keyVocabulary: Array.from({ length: 10 }, (_, i) => ({
          word: `w${i}`,
          meaning: `m${i}`,
          phonetic: `p${i}`,
        })),
        learningObjectives: Array.from({ length: 10 }, (_, i) => `o${i}`),
        suggestedStoryThemes: Array.from({ length: 10 }, (_, i) => `t${i}`),
      },
      fallback
    );
    assert.equal(result.importantConcepts.length, 6);
    assert.equal(result.keyVocabulary.length, 8);
    assert.equal(result.learningObjectives.length, 5);
    assert.equal(result.suggestedStoryThemes.length, 5);
    assert.deepEqual(Object.keys(result.keyVocabulary[0]), [
      "word",
      "meaning",
      "phonetic",
    ]);
  });

  test("malformed AI vocabulary items are coerced to strings, not dropped", () => {
    const result = normalizeChapterResult(
      { keyVocabulary: [{ word: 123, meaning: null }] },
      fallback
    );
    assert.deepEqual(result.keyVocabulary, [
      { word: "123", meaning: "", phonetic: "" },
    ]);
  });
});
