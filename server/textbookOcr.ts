// Pure, side-effect-free logic for turning a Docling OCR job result into
// the chapter/paragraph/image shape the rest of the textbook-analysis
// pipeline expects. Deliberately has no dependency on Express, fetch, or
// Ollama, so it can be unit tested directly (see textbookOcr.test.ts)
// without spinning up the server or any external service.

// Sanitizes a single Docling-provided text fragment (a heading or a
// paragraph): trims stray whitespace Tesseract can leave behind without
// touching the paragraph boundaries Docling already resolved structurally.
export function cleanOcrText(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractChapterNumberAndTitle(
  heading: string
): { chapterNumber: string; chapterTitle: string } {
  const value = heading.trim().replace(/\s+/g, " ");
  const match = value.match(
    // The lookahead keeps "Poems & Verses" or "Stories" whole instead of
    // reading "Poem"/"Stor" as a label and leaving "s & Verses" as the title.
    /^(chapter|unit|lesson|part|section|activity|poem|story|reading|exercise)(?=[\s\d:.\-]|$)\s*[:.**\-**]?\s*(\d+)?\s*[:.**\-**]?\s*(.*)$/i
  );
  if (match) {
    const kind = match[1];
    const number = match[2] ? `${kind} ${match[2]}` : kind;
    const title = match[3]?.trim() || value;
    return {
      chapterNumber: number,
      chapterTitle: title,
    };
  }
  // Telugu/Hindi lesson words, only when followed by a number: "కథ" alone
  // could just be the first word of a title.
  const indic = value.match(
    /^(పాఠం|పాఠము|పద్యం|अध्याय|पाठ|कविता)\s*(\d{1,3})\s*[:.\-)]?\s*(.*)$/
  );
  if (indic) {
    return {
      chapterNumber: `${indic[1]} ${indic[2]}`,
      chapterTitle: indic[3]?.trim() || value,
    };
  }
  const numbered = value.match(/^(\d{1,2})[.)\-:]\s*(.+)$/);
  if (numbered) {
    return {
      chapterNumber: `Chapter ${numbered[1]}`,
      chapterTitle: numbered[2].trim(),
    };
  }
  return {
    chapterNumber: "",
    chapterTitle: value,
  };
}

// A single picture Docling extracted from the document, attributed to
// whichever chapter it visually fell under.
export interface DetectedChapterImage {
  base64: string;
  mimeType: string;
  pageNumber: number | null;
  caption: string;
}

// A table Docling's table-structure model recognized, exported as markdown
// (see backend/ocr/main.py's table_to_payload) rather than as raw grid
// cells — a markdown table is directly usable both for display and as
// Ollama prompt context, without a separate rendering step.
export interface DetectedChapterTable {
  markdown: string;
  pageNumber: number | null;
  caption: string;
}

// A chapter/section detected by Docling's layout model: its heading, its
// full raw body (for the read-along reader / any future full-text use),
// that body pre-split into paragraphs, and any pictures/tables Docling
// extracted under it. This is independent of how much of the chapter later
// gets sent to Ollama for a summary — a chapter's paragraphs, images, and
// tables are never truncated or dropped for AI-cost reasons, only its AI
// summary excerpt is bounded (see analyzeChapterChunk in server.ts).
export interface DetectedChapter {
  chapterNumber: string;
  chapterTitle: string;
  text: string;
  paragraphs: string[];
  images: DetectedChapterImage[];
  tables: DetectedChapterTable[];
  pageNumber: number | null;
}

// Large textbooks (SCERT readers routinely run 100-200+ pages across many
// short chapters/poems/exercises) can trigger far more sections than a
// small pamphlet. This is a safety ceiling against a mis-scanned document
// producing an unreasonable number of sections, not a realistic per-book
// expectation.
export const MAX_DETECTED_CHAPTERS = 80;
// Every detected chapter (up to MAX_DETECTED_CHAPTERS) is always returned
// with its full text, paragraphs, and images. Only the Ollama-generated
// summary / vocabulary / concepts are capped past this many chapters, to
// keep a large multi-subject textbook from taking hours of local LLM calls.
export const MAX_AI_ANALYZED_CHAPTERS = 40;

// Docling already does the hard part — layout-model-based heading
// detection, paragraph grouping, and picture extraction, all in reading
// order (see backend/ocr/main.py's build_chapters). This just reshapes its
// {heading, pageNumber, paragraphs, images} chapters into the
// DetectedChapter shape the rest of this pipeline (normalizeChapterResult,
// analyzeChapterChunk, buildFallbackChapterResult) already expects.
export function chaptersFromDoclingResult(
  doclingChapters: any[]
): DetectedChapter[] {
  const chapters: DetectedChapter[] = [];
  for (const raw of Array.isArray(doclingChapters) ? doclingChapters : []) {
    const heading = cleanOcrText(String(raw?.heading || ""));
    const paragraphs = (Array.isArray(raw?.paragraphs) ? raw.paragraphs : [])
      .map((paragraph: any) => cleanOcrText(String(paragraph || "")))
      .filter(Boolean);
    const images: DetectedChapterImage[] = (
      Array.isArray(raw?.images) ? raw.images : []
    )
      .filter((image: any) => typeof image?.base64 === "string" && image.base64)
      .map((image: any) => ({
        base64: image.base64,
        mimeType: image.mimeType || "image/png",
        pageNumber:
          typeof image.pageNumber === "number" ? image.pageNumber : null,
        caption: cleanOcrText(String(image?.caption || "")),
      }));
    const tables: DetectedChapterTable[] = (
      Array.isArray(raw?.tables) ? raw.tables : []
    )
      .filter((table: any) => typeof table?.markdown === "string" && table.markdown.trim())
      .map((table: any) => ({
        markdown: String(table.markdown).trim(),
        pageNumber:
          typeof table.pageNumber === "number" ? table.pageNumber : null,
        caption: cleanOcrText(String(table?.caption || "")),
      }));
    // A heading with no paragraphs, images, or tables is layout noise (an
    // empty running header Docling still labeled a section header, etc.).
    if (paragraphs.length === 0 && images.length === 0 && tables.length === 0) {
      continue;
    }
    const parsed = extractChapterNumberAndTitle(
      heading || `Textbook Section ${chapters.length + 1}`
    );
    chapters.push({
      chapterNumber:
        parsed.chapterNumber || `Section ${chapters.length + 1}`,
      chapterTitle:
        parsed.chapterTitle || `Textbook Section ${chapters.length + 1}`,
      text: paragraphs.join("\n\n"),
      paragraphs,
      images,
      tables,
      pageNumber:
        typeof raw?.pageNumber === "number" ? raw.pageNumber : null,
    });
    if (chapters.length >= MAX_DETECTED_CHAPTERS) {
      break;
    }
  }
  return chapters;
}

// One page of the Gemini OCR fallback (server/geminiAi.ts): its text blocks
// in reading order, each labeled by kind.
export interface OcrPageBlock {
  kind: string;
  text: string;
}

export interface OcrPage {
  pageNumber: number;
  blocks: OcrPageBlock[];
}

// Builds the same {heading, pageNumber, paragraphs, images, tables} chapter
// list backend/ocr's build_chapters produces, so Gemini OCR output flows
// through chaptersFromDoclingResult and the rest of the pipeline unchanged.
// Nothing transcribed is dropped: sub-headings and unmatched captions stay
// as paragraphs, and content before the first heading gets its own section.
export function doclingChaptersFromOcrPages(
  pages: OcrPage[],
  imagesByPage: Map<number, DetectedChapterImage[]> = new Map()
): any[] {
  const chapters: any[] = [];
  let current: any = null;
  const startChapter = (heading: string, pageNumber: number) => {
    current = { heading, pageNumber, paragraphs: [], images: [], tables: [] };
    chapters.push(current);
  };
  const isEmpty = (chapter: any) =>
    chapter.paragraphs.length === 0 &&
    chapter.tables.length === 0 &&
    chapter.images.length === 0;

  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const pageImages = (imagesByPage.get(page.pageNumber) || []).map(
      (image) => ({ ...image })
    );
    let imagesPlaced = pageImages.length === 0;
    const captions: string[] = [];
    const placeImages = () => {
      if (imagesPlaced) return;
      if (!current) startChapter("", page.pageNumber);
      current.images.push(...pageImages);
      imagesPlaced = true;
    };

    for (const block of page.blocks) {
      const text = String(block?.text || "").trim();
      if (!text) continue;
      switch (block.kind) {
        case "chapter_heading":
          // "Lesson 3" and "The Clever Crow" printed as two heading lines.
          if (current && current.heading && isEmpty(current) && current.pageNumber === page.pageNumber) {
            current.heading = `${current.heading} ${text}`;
          } else {
            startChapter(text, page.pageNumber);
          }
          // A page's pictures belong to the lesson that starts on it.
          placeImages();
          break;
        case "table":
          if (!current) startChapter("", page.pageNumber);
          current.tables.push({ markdown: text, pageNumber: page.pageNumber, caption: "" });
          break;
        case "caption":
          captions.push(text);
          break;
        default:
          if (!current) startChapter("", page.pageNumber);
          current.paragraphs.push(text);
      }
    }

    placeImages();
    for (const image of pageImages) {
      if (captions.length === 0) break;
      image.caption = captions.shift();
    }
    if (captions.length > 0) {
      if (!current) startChapter("", page.pageNumber);
      current.paragraphs.push(...captions);
    }
  }
  return chapters;
}

// Used when Ollama is unreachable (not just returning bad JSON — a network
// failure throws all the way out of analyzeBookMetadata, since only its
// JSON-parsing step has its own retry/catch). Without this, the whole
// textbook job would fail and the Docling OCR results — chapters,
// paragraphs, and images that already finished successfully — would be
// thrown away along with the failed metadata step. This keeps the same
// "nothing goes missing" guarantee buildFallbackChapterResult gives
// per-chapter, just at the book level.
export function buildFallbackMetadata(
  fileName: string,
  chunks: DetectedChapter[]
): any {
  const first = chunks[0];
  return {
    subject: "Unknown",
    grade: "Unknown",
    primaryLanguage: "Unknown",
    bookTitle: fileName || first?.chapterTitle || "Textbook",
    overallSummary: first?.paragraphs?.[0]?.slice(0, 280) || "",
  };
}

// Grouping several short chapters into one Ollama call (see
// analyzeChapterBatch in server.ts) cuts wall-clock time on large
// textbooks: a fixed per-call cost (prompt processing + generation
// warm-up) is paid ceil(N/batchSize) times instead of N times for the same
// total content. Kept small so a single garbled batch response only
// affects a few chapters, and so a batch's combined OCR excerpt still fits
// comfortably in one generation.
export const CHAPTER_BATCH_MAX_CHAPTERS = 4;
export const CHAPTER_BATCH_MAX_CHARS = 9000;

export function buildChapterBatches(
  chunks: DetectedChapter[]
): DetectedChapter[][] {
  const batches: DetectedChapter[][] = [];
  let current: DetectedChapter[] = [];
  let currentChars = 0;
  for (const chunk of chunks) {
    const estimatedChars = Math.min(chunk.text.length, 6000);
    if (
      current.length > 0 &&
      (current.length >= CHAPTER_BATCH_MAX_CHAPTERS ||
        currentChars + estimatedChars > CHAPTER_BATCH_MAX_CHARS)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(chunk);
    currentChars += estimatedChars;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

// Matches a batched Ollama response's items back to the chapters that were
// sent, by "chapterIndex" rather than array position — a model that drops,
// reorders, or duplicates an entry must not silently mislabel a different
// chapter's analysis. Anything missing degrades to the same OCR-backed
// fallback a fully failed call would use, per-chapter (buildFallbackResult
// is injected rather than imported to keep this module free of the
// Ollama-calling code around analyzeChapterChunk/analyzeChapterBatch).
export function matchChapterBatchResults(
  batch: DetectedChapter[],
  items: any[],
  buildFallbackResult: (chunk: DetectedChapter) => any
): any[] {
  return batch.map((chunk, index) => {
    const match = Array.isArray(items)
      ? items.find((item) => Number(item?.chapterIndex) === index)
      : undefined;
    return match
      ? normalizeChapterResult(match, chunk)
      : buildFallbackResult(chunk);
  });
}

export function normalizeChapterResult(
  raw: any,
  fallback: {
    chapterNumber: string;
    chapterTitle: string;
    text: string;
    paragraphs: string[];
    images: DetectedChapterImage[];
    tables: DetectedChapterTable[];
    pageNumber: number | null;
  }
): any {
  return {
    chapterNumber: raw?.chapterNumber || fallback.chapterNumber,
    chapterTitle: raw?.chapterTitle || fallback.chapterTitle,
    // The chapter's real OCR text, images, and tables, always complete —
    // never truncated or dropped to save on AI cost. The summary/vocabulary
    // below may only have seen an excerpt of the text; this is what the
    // read-along reader and any "view full chapter" UI actually reads from.
    text: fallback.text,
    paragraphs: fallback.paragraphs,
    images: fallback.images,
    tables: fallback.tables,
    pageNumber: fallback.pageNumber,
    primaryTopic: raw?.primaryTopic || "",
    summary: raw?.summary || "No summary generated.",
    importantConcepts: Array.isArray(raw?.importantConcepts)
      ? raw.importantConcepts.slice(0, 6)
      : [],
    keyVocabulary: Array.isArray(raw?.keyVocabulary)
      ? raw.keyVocabulary.slice(0, 8).map((item: any) => ({
          word: String(item?.word || ""),
          meaning: String(item?.meaning || ""),
          phonetic: String(item?.phonetic || ""),
        }))
      : [],
    learningObjectives: Array.isArray(raw?.learningObjectives)
      ? raw.learningObjectives.slice(0, 5)
      : [],
    suggestedStoryThemes: Array.isArray(raw?.suggestedStoryThemes)
      ? raw.suggestedStoryThemes.slice(0, 5)
      : [],
  };
}

// Safety net for comprehension-quiz generation (see generateQuizFromRealText
// in server.ts): a local model asked for "comprehension questions" will
// sometimes produce a closing/meta remark disguised as one — "shall we read
// another one?", "did you enjoy this story?" — instead of a real question
// about the text. Those break a quiz UI that expects every entry to be
// answerable from the passage, so filter them out even though the prompt
// already instructs the model not to generate them.
const CLOSING_REMARK_QUESTION_PATTERN =
  /read (one|another) more|read.*again|shall we (read|continue)|want to (read|continue)|did you (enjoy|like)|ready for (the )?next|let'?s (read|continue)/i;

export function stripClosingRemarkQuestions<T extends { question?: string }>(
  questions: T[]
): T[] {
  return (Array.isArray(questions) ? questions : []).filter(
    (q) => q?.question && !CLOSING_REMARK_QUESTION_PATTERN.test(String(q.question))
  );
}
