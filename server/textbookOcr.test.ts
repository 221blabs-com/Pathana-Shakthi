// Unit tests for server/textbookOcr.ts — pure logic, no server/network
// needed. Run with: npx tsx --test server/textbookOcr.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { speechLanguageCodeFor } from "./speechLanguage";
import { figureCropRect, isBlank } from "./pdfFigures";
import {
  applyChapterRefinements,
  buildFallbackQuiz,
  joinPageBreakParagraphs,
  splitLongChapter,
  maxChapterWordsForGrade,
  cleanBookChapters,
  collapseLetterSpacing,
  isDecorativeParagraph,
  scriptLanguage,
  cleanOcrText,
  extractChapterNumberAndTitle,
  chaptersFromDoclingResult,
  normalizeChapterResult,
  buildFallbackMetadata,
  buildChapterBatches,
  matchChapterBatchResults,
  stripClosingRemarkQuestions,
  applyBookStructure,
  buildBookOutline,
  CHAPTER_BATCH_MAX_CHAPTERS,
  CHAPTER_BATCH_MAX_CHARS,
  MAX_DETECTED_CHAPTERS,
  DetectedChapter,
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

function table(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    markdown: "| Item | Count |\n|------|-------|\n| Apples | 5 |",
    pageNumber: 4,
    caption: "Fruit count",
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

  test("maps tables through, trimmed", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 1",
        paragraphs: ["Some text."],
        images: [],
        tables: [table({ markdown: "  | A | B |\n|---|---|\n| 1 | 2 |  " })],
      },
    ]);
    assert.equal(chunks[0].tables.length, 1);
    assert.equal(chunks[0].tables[0].markdown, "| A | B |\n|---|---|\n| 1 | 2 |");
    assert.equal(chunks[0].tables[0].caption, "Fruit count");
    assert.equal(chunks[0].tables[0].pageNumber, 4);
  });

  test("a chapter with only a table and no paragraphs/images is kept", () => {
    const chunks = chaptersFromDoclingResult([
      { heading: "Data Page", paragraphs: [], images: [], tables: [table()] },
    ]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].tables.length, 1);
  });

  test("filters out a table with no usable markdown", () => {
    const chunks = chaptersFromDoclingResult([
      {
        heading: "Chapter 1",
        paragraphs: ["Some text."],
        images: [],
        tables: [table({ markdown: "" }), table({ markdown: "   " }), table()],
      },
    ]);
    assert.equal(chunks[0].tables.length, 1);
  });

  test("a chapter with neither paragraphs, images, nor tables is still dropped", () => {
    const chunks = chaptersFromDoclingResult([
      { heading: "Running Header", paragraphs: [], images: [], tables: [] },
    ]);
    assert.deepEqual(chunks, []);
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
    tables: [table()],
    pageNumber: 2,
  };

  test("text/paragraphs/images/tables/pageNumber always come from fallback, never from AI output", () => {
    const result = normalizeChapterResult(
      {
        chapterNumber: "AI Chapter",
        chapterTitle: "AI Title",
        text: "AI should not override this",
        paragraphs: ["AI paragraph"],
        images: [],
        tables: [],
        pageNumber: 999,
        summary: "AI summary",
      },
      fallback
    );
    assert.equal(result.text, fallback.text);
    assert.deepEqual(result.paragraphs, fallback.paragraphs);
    assert.deepEqual(result.images, fallback.images);
    assert.deepEqual(result.tables, fallback.tables);
    assert.equal(result.pageNumber, fallback.pageNumber);
    // The chapter's number/title were already decided by the book-structure
    // pass (they're on the fallback); the analysis only adds insights.
    assert.equal(result.chapterNumber, fallback.chapterNumber);
    assert.equal(result.chapterTitle, fallback.chapterTitle);
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

function chapter(overrides: Partial<DetectedChapter> = {}): DetectedChapter {
  return {
    chapterNumber: "Chapter 1",
    chapterTitle: "Untitled",
    text: "",
    paragraphs: [],
    images: [],
    tables: [],
    pageNumber: null,
    ...overrides,
  };
}

describe("buildChapterBatches", () => {
  test("groups short chapters together up to the chapter-count cap", () => {
    const chunks = Array.from({ length: 9 }, (_, i) =>
      chapter({ chapterNumber: `Chapter ${i}`, text: "short" })
    );
    const batches = buildChapterBatches(chunks);
    // 9 short chapters, cap of CHAPTER_BATCH_MAX_CHAPTERS per batch.
    const expectedBatchCount = Math.ceil(9 / CHAPTER_BATCH_MAX_CHAPTERS);
    assert.equal(batches.length, expectedBatchCount);
    assert.equal(
      batches.reduce((sum, batch) => sum + batch.length, 0),
      9
    );
    for (const batch of batches) {
      assert.ok(batch.length <= CHAPTER_BATCH_MAX_CHAPTERS);
    }
  });

  test("splits a batch early once the combined character budget is exceeded", () => {
    const big = "x".repeat(6000);
    const chunks = [
      chapter({ chapterNumber: "A", text: big }),
      chapter({ chapterNumber: "B", text: big }),
      chapter({ chapterNumber: "C", text: big }),
    ];
    const batches = buildChapterBatches(chunks);
    // Two of these already exceed CHAPTER_BATCH_MAX_CHARS together, so no
    // batch should end up holding all three.
    assert.ok(batches.length >= 2);
    for (const batch of batches) {
      const total = batch.reduce(
        (sum, c) => sum + Math.min(c.text.length, 6000),
        0
      );
      assert.ok(
        batch.length === 1 || total <= CHAPTER_BATCH_MAX_CHARS
      );
    }
  });

  test("a single oversized chapter still gets its own batch, never dropped", () => {
    const chunks = [chapter({ text: "x".repeat(50000) })];
    const batches = buildChapterBatches(chunks);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 1);
  });

  test("empty input produces no batches", () => {
    assert.deepEqual(buildChapterBatches([]), []);
  });

  test("preserves chapter order across batches", () => {
    const chunks = Array.from({ length: 7 }, (_, i) =>
      chapter({ chapterNumber: `Chapter ${i}`, text: "short" })
    );
    const batches = buildChapterBatches(chunks);
    const flattened = batches.flat().map((c) => c.chapterNumber);
    assert.deepEqual(
      flattened,
      chunks.map((c) => c.chapterNumber)
    );
  });
});

describe("matchChapterBatchResults", () => {
  const fallbackResult = (chunk: DetectedChapter) => ({
    chapterNumber: chunk.chapterNumber,
    isFallback: true,
  });

  test("matches items back to chapters by chapterIndex, not array position", () => {
    const batch = [
      chapter({ chapterNumber: "A", text: "a" }),
      chapter({ chapterNumber: "B", text: "b" }),
    ];
    // Items arrive out of order — must still map to the right chapter.
    const items = [
      { chapterIndex: 1, summary: "summary for B" },
      { chapterIndex: 0, summary: "summary for A" },
    ];
    const result = matchChapterBatchResults(batch, items, fallbackResult);
    assert.equal(result[0].summary, "summary for A");
    assert.equal(result[1].summary, "summary for B");
  });

  test("a missing chapterIndex falls back per-chapter, not for the whole batch", () => {
    const batch = [
      chapter({ chapterNumber: "A", text: "a" }),
      chapter({ chapterNumber: "B", text: "b" }),
    ];
    const items = [{ chapterIndex: 0, summary: "summary for A" }];
    const result = matchChapterBatchResults(batch, items, fallbackResult);
    assert.equal(result[0].summary, "summary for A");
    assert.deepEqual(result[1], { chapterNumber: "B", isFallback: true });
  });

  test("a non-array items value falls back for every chapter", () => {
    const batch = [chapter({ chapterNumber: "A" })];
    const result = matchChapterBatchResults(
      batch,
      undefined as any,
      fallbackResult
    );
    assert.deepEqual(result, [{ chapterNumber: "A", isFallback: true }]);
  });

  test("a duplicated chapterIndex uses the first match", () => {
    const batch = [chapter({ chapterNumber: "A" })];
    const items = [
      { chapterIndex: 0, summary: "first" },
      { chapterIndex: 0, summary: "second" },
    ];
    const result = matchChapterBatchResults(batch, items, fallbackResult);
    assert.equal(result[0].summary, "first");
  });
});

describe("stripClosingRemarkQuestions", () => {
  test("keeps real comprehension questions about the text", () => {
    const questions = [
      { question: "What did the crow find near the tree?" },
      { question: "Why did the farmer wake up early?" },
    ];
    assert.deepEqual(stripClosingRemarkQuestions(questions), questions);
  });

  test("drops a closing remark disguised as a question", () => {
    const questions = [
      { question: "What did the crow find near the tree?" },
      { question: "Shall we read another one?" },
      { question: "Did you enjoy this story?" },
    ];
    const result = stripClosingRemarkQuestions(questions);
    assert.equal(result.length, 1);
    assert.equal(result[0].question, "What did the crow find near the tree?");
  });

  test("drops entries with no question text", () => {
    const result = stripClosingRemarkQuestions([
      { question: "" },
      { question: undefined as any },
      { question: "A real question about the passage?" },
    ]);
    assert.equal(result.length, 1);
  });

  test("handles non-array input gracefully", () => {
    assert.deepEqual(stripClosingRemarkQuestions(undefined as any), []);
    assert.deepEqual(stripClosingRemarkQuestions(null as any), []);
  });
});


describe("applyBookStructure", () => {
  const sec = (title: string, paragraphs: string[], page = 1): DetectedChapter => ({
    chapterNumber: "",
    chapterTitle: title,
    text: paragraphs.join("\n\n"),
    paragraphs,
    images: [],
    tables: [],
    pageNumber: page,
  });
  const raw = [
    sec("Telugu Reader Class 3", ["Government of Telangana"], 1), // 0 cover
    sec("Contents", ["1. Pond ... 3", "2. Parrot ... 5"], 2), // 1 contents
    sec("పాఠం 1: చెరువు", ["p1", "p2"], 3), // 2
    sec("అభ్యాసాలు", ["q1"], 4), // 3 exercises of lesson 1
    sec("పాఠం 2: చిలుక", ["p3"], 5), // 4
    sec("కొత్త పదాలు", ["w1"], 6), // 5 forgotten by the plan
  ];

  test("merges sub-sections into their chapter and skips front matter", () => {
    const { chapters, skippedSections } = applyBookStructure(raw, [
      { chapterNumber: "", title: "Cover", subject: "Telugu", kind: "front_matter", startSection: 0, endSection: 0 },
      { chapterNumber: "", title: "Contents", subject: "Telugu", kind: "contents", startSection: 1, endSection: 1 },
      { chapterNumber: "పాఠం 1", title: "చెరువు", subject: "Telugu", kind: "lesson", startSection: 2, endSection: 3 },
      { chapterNumber: "పాఠం 2", title: "చిలుక", subject: "Telugu", kind: "lesson", startSection: 4, endSection: 4 },
    ]);
    assert.deepEqual(skippedSections, [0, 1]);
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].chapterNumber, "పాఠం 1");
    assert.equal(chapters[0].chapterTitle, "చెరువు");
    assert.deepEqual(chapters[0].paragraphs, ["p1", "p2", "అభ్యాసాలు", "q1"]);
    assert.equal(chapters[0].subject, "Telugu");
    // Section 5 was not in any range: appended to the chapter before it, never dropped.
    assert.deepEqual(chapters[1].paragraphs, ["p3", "కొత్త పదాలు", "w1"]);
  });

  test("clamps out-of-range and overlapping plans and drops unknown subjects", () => {
    const { chapters } = applyBookStructure(raw, [
      { chapterNumber: "Chapter 1", title: "All", subject: "Poetry", kind: "lesson", startSection: -3, endSection: 99 },
      { chapterNumber: "Chapter 2", title: "Dup", subject: "Telugu", kind: "lesson", startSection: 2, endSection: 4 },
    ]);
    assert.equal(chapters.length, 1);
    assert.equal(chapters[0].subject, undefined);
    // 8 paragraphs from all six sections + the 5 merged-in sub-headings.
    assert.equal(chapters[0].paragraphs.length, 13);
  });

  test("falls back to the raw sections when the plan is empty or skips everything", () => {
    assert.equal(applyBookStructure(raw, []).chapters, raw);
    const allSkipped = applyBookStructure(raw, [
      { chapterNumber: "", title: "x", subject: "Telugu", kind: "index", startSection: 0, endSection: 5 },
    ]);
    assert.equal(allSkipped.chapters, raw);
  });

  test("buildBookOutline lists every section with its index and page", () => {
    const outline = buildBookOutline(raw).split("\n");
    assert.equal(outline.length, raw.length);
    assert.match(outline[2], /^\[2\] p\.3 "పాఠం 1: చెరువు"/);
  });
});

describe("speechLanguageCodeFor", () => {
  test("uses the text's script, not the story language", () => {
    assert.equal(speechLanguageCodeFor("Hello", "Telugu"), "en-IN");
    assert.equal(speechLanguageCodeFor("చెరువు", "English"), "te-IN");
    assert.equal(speechLanguageCodeFor("पानी", "Telugu"), "hi-IN");
  });

  test("an Indic script wins over embedded English words", () => {
    assert.equal(speechLanguageCodeFor("నా school చాలా పెద్దది", "English"), "te-IN");
  });

  test("mixed Telugu+Hindi keeps the requested one, else the majority", () => {
    assert.equal(speechLanguageCodeFor("చెరువు पानी", "Hindi"), "hi-IN");
    assert.equal(speechLanguageCodeFor("చెరువు పాట पा", "English"), "te-IN");
  });

  test("digits/punctuation only fall back to the requested language", () => {
    assert.equal(speechLanguageCodeFor("1, 2, 3!", "Hindi"), "hi-IN");
    assert.equal(speechLanguageCodeFor("…", "Unknown"), "en-IN");
  });
});

const makeChapter = (title: string, paragraphs: string[], extra: Record<string, unknown> = {}) => ({
  chapterNumber: "",
  chapterTitle: title,
  text: paragraphs.join("\n\n"),
  paragraphs,
  images: [],
  tables: [],
  pageNumber: 1,
  kind: "poem",
  ...extra,
});

describe("book cleanup (rules)", () => {
  test("collapses letter-spaced capitals only", () => {
    assert.equal(collapseLetterSpacing("9 P O E M S"), "9 POEMS");
    assert.equal(collapseLetterSpacing("— U N F I N I S H E D —"), "— UNFINISHED —");
    assert.equal(collapseLetterSpacing("a b c d e"), "a b c d e");
    assert.equal(collapseLetterSpacing("2 + 3 = 5"), "2 + 3 = 5");
  });

  test("recognises decorations, counters, labels, page numbers and links", () => {
    for (const junk of [
      "9 P O E M S", "11 POEMS", "1 POEM", "0 3", "12", "— U N F I N I S H E D —", "— UNFINISHED —",
      "HINDI / URDU · LOVE", "ENGLISH · THE SELF",
      "https://verses-in-motion.vercel.app · pranaytadakamalla.vercel.app/writing",
    ]) assert.equal(isDecorativeParagraph(junk), true, junk);
  });

  test("keeps real text, including short lines, maths and Indic text", () => {
    for (const real of [
      "I want you.\nThat is my sweetest tragedy.", "2 + 3 = 5", "a b c d e",
      "ఒక పాత్రతో వర్ణించలేము...", "पल पल", "Rain or sky, rise and reach.", "Who am I",
    ]) assert.equal(isDecorativeParagraph(real), false, real);
  });

  test("detects language from the script", () => {
    assert.equal(scriptLanguage("ఆమె కళ్లలో మాటలుండేవి"), "Telugu");
    assert.equal(scriptLanguage("मिलो या न मिलो"), "Hindi");
    assert.equal(scriptLanguage("Woh ladki ek khwab thi"), "English");
    assert.equal(scriptLanguage("123"), null);
  });

  test("cleanBookChapters removes junk and repeated labels, sets language", () => {
    const { chapters, removedParagraphs } = cleanBookChapters([
      makeChapter("Love", ["First glances, quiet devotion.", "9 P O E M S"]),
      makeChapter("Pal Pal", ["Moment by moment", "Pal pal mere chain ko", "HINDI / URDU LOVE"]),
      makeChapter("Jo Socha", ["जो सोचा था, वो बन न सका", "HINDI / URDU LOVE"]),
      makeChapter("Page", ["0 3"]),
    ]);
    assert.equal(removedParagraphs, 4);
    assert.equal(chapters.length, 3); // the page-number-only chapter is gone
    assert.deepEqual(chapters[0].paragraphs, ["First glances, quiet devotion."]);
    assert.deepEqual(chapters[1].paragraphs, ["Moment by moment", "Pal pal mere chain ko"]);
    assert.equal(chapters[2].language, "Hindi");
  });

  test("strips a marker or label glued onto a stanza as its own line", () => {
    const { chapters } = cleanBookChapters([
      makeChapter("The Kite", ["We flew a kite up to the sky,\nAnd then the string...\n— U N F I N I S H E D —"]),
    ]);
    assert.deepEqual(chapters[0].paragraphs, ["We flew a kite up to the sky,\nAnd then the string..."]);
  });
});

describe("applyBookStructure parts", () => {
  test("a section_divider names the part of the chapters after it", () => {
    const sec = (title: string, text: string) => makeChapter(title, [text]);
    const { chapters } = applyBookStructure(
      [sec("01 Nature", "Rain, rivers and sky. 3 POEMS"), sec("Little Raindrop", "Little raindrop"), sec("02 Friends", "2 POEMS"), sec("My Best Friend", "My best friend")],
      [
        { chapterNumber: "", title: "Nature", subject: "English", kind: "section_divider", startSection: 0, endSection: 0 },
        { chapterNumber: "1", title: "Little Raindrop", subject: "English", kind: "poem", startSection: 1, endSection: 1 },
        { chapterNumber: "", title: "Friends", subject: "English", kind: "section_divider", startSection: 2, endSection: 2 },
        { chapterNumber: "2", title: "My Best Friend", subject: "English", kind: "poem", startSection: 3, endSection: 3 },
      ]
    );
    assert.deepEqual(chapters.map((c) => [c.chapterTitle, c.part]), [["Little Raindrop", "Nature"], ["My Best Friend", "Friends"]]);
  });
});

describe("applyChapterRefinements (AI verdicts)", () => {
  const book = [
    makeChapter("Love", ["First glances, quiet devotion."], { chapterNumber: "Chapter 1" }),
    makeChapter("She Shines", ["She shines like the moon."], { chapterNumber: "Chapter 2" }),
    makeChapter("Woh Ladki", ["That girl", "Woh ladki ek khwab thi"], { chapterNumber: "Chapter 3" }),
    makeChapter("Longing", ["Waiting and remembering."], { chapterNumber: "Chapter 4" }),
    makeChapter("తను", ["ఒక పాత్రతో వర్ణించలేము", "ABOUT", "Poems by the author."], { chapterNumber: "Chapter 5" }),
  ];

  test("drops section pages, sets parts and subtitles, removes non-body lines, renumbers", () => {
    const { chapters, droppedChapters, removedParagraphs } = applyChapterRefinements(book, [
      { chapterIndex: 0, kind: "section_divider", title: "Love" },
      { chapterIndex: 2, kind: "poem", title: "Woh Ladki", subtitle: "That girl", removeParagraphs: [0] },
      { chapterIndex: 3, kind: "section_divider", title: "Longing" },
      { chapterIndex: 4, kind: "poem", removeParagraphs: [1, 2, 99] },
    ]);
    assert.equal(droppedChapters, 2);
    assert.equal(removedParagraphs, 3);
    assert.deepEqual(chapters.map((c) => [c.chapterNumber, c.chapterTitle, c.part]), [
      ["Chapter 1", "She Shines", "Love"],
      ["Chapter 2", "Woh Ladki", "Love"],
      ["Chapter 3", "తను", "Longing"],
    ]);
    assert.equal(chapters[1].subtitle, "That girl");
    assert.deepEqual(chapters[1].paragraphs, ["Woh ladki ek khwab thi"]);
    assert.deepEqual(chapters[2].paragraphs, ["ఒక పాత్రతో వర్ణించలేము"]);
    assert.equal(chapters[2].language, "Telugu");
  });

  test("front matter in the middle of the book is treated as a section page", () => {
    const { chapters } = applyChapterRefinements(book, [
      { chapterIndex: 3, kind: "front_matter", title: "Tribute" },
    ]);
    assert.deepEqual(chapters.map((c) => [c.chapterTitle, c.part]).slice(-1), [["తను", "Tribute"]]);
  });

  test("never empties a chapter and ignores a verdict that would drop everything", () => {
    const one = applyChapterRefinements([book[1]], [{ chapterIndex: 0, removeParagraphs: [0] }]);
    assert.deepEqual(one.chapters[0].paragraphs, ["She shines like the moon."]);
    const all = applyChapterRefinements([book[0]], [{ chapterIndex: 0, kind: "back_matter" }]);
    assert.equal(all.chapters.length, 1);
  });
});


describe("figureCropRect", () => {
  test("maps a 0-1000 box to padded pixels", () => {
    assert.deepEqual(figureCropRect([100, 200, 500, 800], 1000, 2000), { x: 192, y: 192, w: 616, h: 816 });
  });
  test("rejects whole-page boxes, tiny boxes and bad input", () => {
    assert.equal(figureCropRect([0, 0, 1000, 1000], 1000, 1400), null);
    assert.equal(figureCropRect([100, 100, 120, 120], 1000, 1400), null);
    assert.equal(figureCropRect([500, 500, 100, 100], 1000, 1400), null);
    assert.equal(figureCropRect([1, 2, 3], 1000, 1400), null);
  });
});

describe("page breaks and long chapters", () => {
  test("joins a sentence split across a page break", () => {
    const r = joinPageBreakParagraphs(
      ["They sealed off the gate to the sea a", "and everything returned to normal.", "Next paragraph."],
      [2, 3, 3]
    );
    assert.deepEqual(r.paragraphs, ["They sealed off the gate to the sea a and everything returned to normal.", "Next paragraph."]);
    assert.deepEqual(r.pages, [2, 3]);
  });

  test("keeps finished sentences, poem lines, same-page and unknown-page paragraphs apart", () => {
    const r = joinPageBreakParagraphs(
      ["The end.", "and then", "Twinkle twinkle little star", "How I wonder", "no page", "still none"],
      [1, 2, 2, 3, null, null]
    );
    assert.equal(r.paragraphs.length, 6);
  });

  test("short chapters are not split", () => {
    const chapter = { chapterTitle: "Short", paragraphs: ["one two three"], paragraphPages: [1] };
    assert.deepEqual(splitLongChapter(chapter, 250), [chapter]);
  });

  test("splits a long chapter at page boundaries and keeps pictures with their page", () => {
    const para = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const chapter = {
      chapterTitle: "I Sell my Dreams",
      paragraphs: [para(120), para(120), para(120), para(120), para(120), para(120)],
      paragraphPages: [2, 2, 3, 3, 4, 4],
      images: [{ pageNumber: 4, base64: "x" }, { pageNumber: null, base64: "y" }],
      tables: [{ pageNumber: 3, markdown: "|a|" }],
    };
    const parts = splitLongChapter(chapter, 250);
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.map((p) => p.paragraphPages), [[2, 2], [3, 3], [4, 4]]);
    assert.equal(parts[0].chapterTitle, "I Sell my Dreams (Part 1 of 3)");
    assert.deepEqual(parts[2].images.map((i) => i.base64), ["x"]);
    assert.deepEqual(parts[0].images.map((i) => i.base64), ["y"]);
    assert.equal(parts[1].tables.length, 1);
    assert.equal(parts.flatMap((p) => p.paragraphs).length, 6);
  });

  test("a short tail joins the previous part", () => {
    const para = (n: number) => Array.from({ length: n }, () => "w").join(" ");
    const parts = splitLongChapter({ chapterTitle: "T", paragraphs: [para(240), para(240), para(30)], paragraphPages: [1, 2, 3] }, 250);
    assert.equal(parts.length, 2);
    assert.equal(parts[1].paragraphs.length, 2);
  });

  test("word budget grows with the class", () => {
    assert.ok(maxChapterWordsForGrade("Class 1") < maxChapterWordsForGrade("Class 5"));
  });
});

describe("blank picture crops", () => {
  test("an all-white crop is blank, a drawn one is not", () => {
    const white = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    assert.equal(isBlank(white), true);
    const drawn = white.slice();
    for (let i = 0; i < drawn.length / 4; i += 1) {
      if (i % 10 === 0) drawn.set([20, 30, 40, 255], i * 4);
    }
    assert.equal(isBlank(drawn), false);
  });

  test("a whole page with two lines of text is not blank at the page threshold", () => {
    // 0.3% ink: blank by the picture-crop rule, text by the whole-page rule.
    const page = new Uint8ClampedArray(1000 * 100 * 4).fill(255);
    for (let i = 0; i < 300; i += 1) page.set([0, 0, 0, 255], i * 333 * 4);
    assert.equal(isBlank(page), true);
    assert.equal(isBlank(page, 1, 0.0002), false);
    assert.equal(isBlank(new Uint8ClampedArray(1000 * 100 * 4).fill(255), 1, 0.0002), true);
  });
});

test("buildFallbackQuiz makes fill-in-the-missing-word questions from the chapter's own sentences", () => {
  const paragraphs = [
    "She shines brightly like the moon among the stars.",
    "Her laughter carries softly across the quiet village.",
    "Every evening the children gather near the river.",
    "The farmer plants mango seeds in the garden.",
  ];
  const quiz = buildFallbackQuiz(paragraphs, "English");
  assert.equal(quiz.length, 3);
  for (const q of quiz) {
    assert.match(q.question, /^Fill in the missing word: ".*_____.*"$/);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map((o) => o.toLowerCase())).size, 4);
    const answer = q.options[q.correctOptionIndex];
    // the right word really is the blank in a real sentence of the chapter
    assert.ok(paragraphs.some((p) => p.replace(answer, "_____") === q.question.slice(q.question.indexOf('"') + 1, -1)));
    // wrong options are chapter words that are not in that sentence
    const sentence = q.question.toLowerCase();
    for (const [i, o] of q.options.entries()) if (i !== q.correctOptionIndex) assert.ok(!sentence.includes(o.toLowerCase()));
  }
  assert.notEqual(quiz[0].correctOptionIndex, quiz[1].correctOptionIndex);
});

test("buildFallbackQuiz writes Hindi and Telugu questions in their own script", () => {
  const hindi = buildFallbackQuiz(
    ["मेरी माँ मुझे रोज़ कहानी सुनाती है।", "बगीचे में सुंदर फूल खिलते हैं।", "बच्चे नदी के किनारे खेलते हैं।", "किसान खेत में मेहनत करता है।"],
    "Hindi"
  );
  assert.ok(hindi.length >= 1);
  assert.ok(hindi.every((q) => q.question.startsWith("खाली जगह में सही शब्द चुनो:") && scriptLanguage(q.question) === "Hindi"));
  const telugu = buildFallbackQuiz(
    ["పిల్లి పాలు తాగుతుంది ప్రతి రోజు.", "తోటలో అందమైన పువ్వులు పూస్తాయి ఉదయం.", "పిల్లలు నది ఒడ్డున ఆడుకుంటారు సంతోషంగా.", "రైతు పొలంలో కష్టపడి పని చేస్తాడు."],
    "Telugu"
  );
  assert.ok(telugu.length >= 1);
  assert.ok(telugu.every((q) => scriptLanguage(q.question) === "Telugu" && q.options.every((o) => scriptLanguage(o) === "Telugu")));
});

test("buildFallbackQuiz returns nothing rather than a bad question when the chapter is too short", () => {
  assert.deepEqual(buildFallbackQuiz(["Hello there."], "English"), []);
});

test("splitLongChapter gives each part its share of the reading time", () => {
  const page = (n: number, words: number) => Array.from({ length: words }, () => "word").join(" ");
  const paragraphs = [page(1, 200), page(2, 200), page(3, 200), page(4, 200)];
  const parts = splitLongChapter(
    { chapterTitle: "Story", paragraphs, paragraphPages: [1, 2, 3, 4], estimatedReadingMinutes: 40 },
    250
  );
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.map((p) => p.estimatedReadingMinutes), [10, 10, 10, 10]);
  // no reading time stays no reading time
  const none = splitLongChapter({ chapterTitle: "Story", paragraphs, paragraphPages: [1, 2, 3, 4] as (number | null)[], estimatedReadingMinutes: null as number | null }, 250);
  assert.ok(none.every((p) => p.estimatedReadingMinutes === null));
});
