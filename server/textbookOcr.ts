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
  // Set by the AI book-structure pass (applyBookStructure): the Subject Hub
  // subject this chapter belongs to, and what kind of unit it is.
  subject?: string;
  kind?: string;
  // Set by the cleanup pass (cleanBookChapters / applyChapterRefinements):
  // the book part it sits under ("Love", "Unit 2"), a subtitle such as the
  // title's translation, and the language of its text (from its script).
  part?: string;
  subtitle?: string;
  language?: string;
  // The printed page each paragraph came from (same length as paragraphs),
  // so the reader can show "page 12" and put a picture next to its text.
  paragraphPages?: (number | null)[];
  // Set by the AI refinement pass when the text is Hindi/Telugu written in
  // Latin letters ("Woh ladki ek khwab thi"), to be converted to its script.
  romanizedLanguage?: "Hindi" | "Telugu";
}

// paragraphPages for a chapter, filled with the chapter's page if absent.
export function pagesOf(chapter: { paragraphs: string[]; paragraphPages?: (number | null)[]; pageNumber: number | null }): (number | null)[] {
  const pages = Array.isArray(chapter.paragraphPages) ? chapter.paragraphPages : [];
  return chapter.paragraphs.map((_, i) => (typeof pages[i] === "number" ? pages[i] : chapter.pageNumber ?? null));
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
    const rawPages: any[] = Array.isArray(raw?.paragraphPages) ? raw.paragraphPages : [];
    const chapterPage = typeof raw?.pageNumber === "number" ? raw.pageNumber : null;
    const withPages = (Array.isArray(raw?.paragraphs) ? raw.paragraphs : [])
      .map((paragraph: any, i: number) => ({
        text: cleanOcrText(String(paragraph || "")),
        page: typeof rawPages[i] === "number" ? rawPages[i] : chapterPage,
      }))
      .filter((p: { text: string }) => p.text);
    const paragraphs: string[] = withPages.map((p: { text: string }) => p.text);
    const paragraphPages: (number | null)[] = withPages.map((p: { page: number | null }) => p.page);
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
      paragraphPages,
      images,
      tables,
      pageNumber: chapterPage,
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
  // For "figure" blocks: [ymin, xmin, ymax, xmax] on a 0-1000 page grid.
  box?: number[];
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
    current = { heading, pageNumber, paragraphs: [], paragraphPages: [], images: [], tables: [] };
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
        case "figure":
          // A picture's description, not text to read; the picture itself
          // arrives through imagesByPage (copied or cropped from the PDF).
          break;
        default:
          if (!current) startChapter("", page.pageNumber);
          current.paragraphs.push(text);
          current.paragraphPages.push(page.pageNumber);
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
      current.paragraphPages.push(...captions.map(() => page.pageNumber));
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

// ---------- AI book structure ----------
// Raw OCR sections follow every printed heading ("Exercises", "New words",
// each poem stanza title...), so a 50-page book can come out as 40+ tiny
// "chapters" plus its cover, contents and index pages. An AI pass reads the
// whole outline and returns the book's real chapters as ranges of raw
// sections; applyBookStructure then merges those ranges. The subjects are
// the Subject Hub tiles students navigate by.
export const BOOK_SUBJECTS = ["English", "Maths", "Science", "Social", "Hindi", "Telugu"];
export const SKIPPED_CHAPTER_KINDS = ["front_matter", "contents", "index", "back_matter", "section_divider"];

export interface BookChapterPlan {
  chapterNumber: string;
  title: string;
  subject: string;
  kind: string;
  startSection: number;
  endSection: number;
}

// One line per raw section for the structure prompt. Only a preview of each
// section's text is sent: the AI needs headings and flow, not every word.
export function buildBookOutline(sections: DetectedChapter[], previewChars = 160): string {
  return sections
    .map((section, index) => {
      const preview = section.text.replace(/\s+/g, " ").slice(0, previewChars);
      const heading = [section.chapterNumber, section.chapterTitle].filter(Boolean).join(" - ");
      return `[${index}] p.${section.pageNumber ?? "?"} "${heading}" (${section.text.length} chars${
        section.tables.length ? `, ${section.tables.length} table` : ""
      }${section.images.length ? `, ${section.images.length} image` : ""}): ${preview}`;
    })
    .join("\n");
}

// Merges raw sections into the planned chapters. Robust to a sloppy plan:
// ranges are clamped and de-overlapped, and any lesson section the plan
// forgot is appended to the chapter before it (never silently dropped) —
// only sections before the first chapter or inside a skipped kind
// (cover/contents/index) are left out, and those are reported.
export function applyBookStructure(
  sections: DetectedChapter[],
  plan: BookChapterPlan[]
): { chapters: DetectedChapter[]; skippedSections: number[] } {
  const last = sections.length - 1;
  const cleaned = (Array.isArray(plan) ? plan : [])
    .map((entry) => ({
      ...entry,
      startSection: Math.max(0, Math.min(last, Math.floor(Number(entry?.startSection)))),
      endSection: Math.max(0, Math.min(last, Math.floor(Number(entry?.endSection)))),
      kind: String(entry?.kind || "lesson").toLowerCase(),
    }))
    .filter((entry) => Number.isFinite(entry.startSection) && Number.isFinite(entry.endSection))
    .map((entry) => ({ ...entry, endSection: Math.max(entry.startSection, entry.endSection) }))
    .sort((a, b) => a.startSection - b.startSection);

  if (sections.length === 0 || cleaned.length === 0) {
    return { chapters: sections, skippedSections: [] };
  }

  // owner[i] = index into cleaned of the planned unit section i belongs to.
  const owner: number[] = new Array(sections.length).fill(-1);
  cleaned.forEach((entry, planIndex) => {
    for (let i = entry.startSection; i <= entry.endSection; i++) {
      if (owner[i] === -1) owner[i] = planIndex;
    }
  });
  for (let i = 1; i < owner.length; i++) {
    if (owner[i] === -1 && owner[i - 1] !== -1) owner[i] = owner[i - 1];
  }

  const chapters: DetectedChapter[] = [];
  const skippedSections: number[] = [];
  const built = new Map<number, DetectedChapter>();
  // A section title page names the part the chapters after it belong to.
  let part = "";
  sections.forEach((section, i) => {
    const planIndex = owner[i];
    const entry = planIndex === -1 ? null : cleaned[planIndex];
    if (entry?.kind === "section_divider" && !built.has(planIndex)) {
      const name = extractChapterNumberAndTitle(String(entry.title || section.chapterTitle)).chapterTitle;
      if (name) part = name;
    }
    if (!entry || SKIPPED_CHAPTER_KINDS.includes(entry.kind)) {
      skippedSections.push(i);
      return;
    }
    let chapter = built.get(planIndex);
    if (!chapter) {
      const parsed = extractChapterNumberAndTitle(String(entry.title || section.chapterTitle));
      chapter = {
        chapterNumber: String(entry.chapterNumber || parsed.chapterNumber || `Chapter ${chapters.length + 1}`),
        chapterTitle: parsed.chapterTitle || section.chapterTitle,
        text: "",
        paragraphs: [],
        paragraphPages: [],
        images: [],
        tables: [],
        pageNumber: section.pageNumber,
        subject: BOOK_SUBJECTS.includes(entry.subject) ? entry.subject : undefined,
        kind: entry.kind,
        part: part || undefined,
      };
      built.set(planIndex, chapter);
      chapters.push(chapter);
    } else {
      // A merged-in sub-section keeps its printed heading as a paragraph.
      const heading = section.chapterTitle.trim();
      if (heading && !/^(Textbook )?Section \d+$/i.test(heading) && heading !== chapter.chapterTitle) {
        chapter.paragraphs.push(heading);
        chapter.paragraphPages!.push(section.pageNumber);
      }
    }
    chapter.paragraphPages!.push(...pagesOf(section));
    chapter.paragraphs.push(...section.paragraphs);
    chapter.images.push(...section.images);
    chapter.tables.push(...section.tables);
  });
  chapters.forEach((chapter) => {
    chapter.text = chapter.paragraphs.join("\n\n");
  });
  const nonEmpty = chapters.filter(
    (c) => c.paragraphs.length > 0 || c.images.length > 0 || c.tables.length > 0
  );
  return nonEmpty.length > 0
    ? { chapters: nonEmpty, skippedSections }
    : { chapters: sections, skippedSections: [] };
}

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

function stringList(value: any, max: number): string[] {
  return Array.isArray(value)
    ? value.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, max)
    : [];
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
    subject?: string;
    kind?: string;
    part?: string;
    subtitle?: string;
    language?: string;
    paragraphPages?: (number | null)[];
  }
): any {
  return {
    chapterNumber: fallback.chapterNumber || raw?.chapterNumber || "",
    chapterTitle: fallback.chapterTitle || raw?.chapterTitle || "",
    subject: fallback.subject || "",
    kind: fallback.kind || "lesson",
    part: fallback.part || "",
    subtitle: fallback.subtitle || "",
    language: fallback.language || "",
    // The chapter's real OCR text, images, and tables, always complete —
    // never truncated or dropped to save on AI cost. The summary/vocabulary
    // below may only have seen an excerpt of the text; this is what the
    // read-along reader and any "view full chapter" UI actually reads from.
    text: fallback.text,
    paragraphs: fallback.paragraphs,
    paragraphPages: pagesOf(fallback),
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
    // Deeper analysis (teacher view + student chapter intro).
    keyPoints: stringList(raw?.keyPoints, 8),
    themes: stringList(raw?.themes, 5),
    moralOrMessage: String(raw?.moralOrMessage || ""),
    difficulty: DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : "",
    teachingTips: stringList(raw?.teachingTips, 5),
    discussionQuestions: stringList(raw?.discussionQuestions, 5),
    estimatedReadingMinutes: Math.max(
      1,
      Math.round(fallback.text.split(/\s+/).filter(Boolean).length / 40)
    ),
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

/* ------------------------------------------------------------------
   Book cleanup: what OCR reads off a page is not all text a child should
   read aloud. Decorations ("9 P O E M S"), counters ("11 POEMS"), running
   labels ("ENGLISH · LONGING"), page numbers and URLs are removed by the
   rules below (no AI, so this always runs); section title pages, notes,
   translated subtitles and "About" pages need the AI refinement pass
   (applyChapterRefinements).
------------------------------------------------------------------- */

const LETTER_RUN = /(?:^|(?<=\s))((?:[A-Za-z]\s+){3,}[A-Za-z])(?=\s|$)/g;

// "9 P O E M S" -> "9 POEMS", "— U N F I N I S H E D —" -> "— UNFINISHED —".
// Only runs of 4+ single capital letters: "a b c" in an alphabet lesson and
// "2 + 3 = 5" in a maths one are left alone.
export function collapseLetterSpacing(text: string): string {
  return text.replace(LETTER_RUN, (run) =>
    /^[A-Z](\s+[A-Z])+$/.test(run) ? run.replace(/\s+/g, "") : run
  );
}

const hasLatin = (text: string) => /[A-Za-z]/.test(text);
const isAllCapsLabel = (text: string) => hasLatin(text) && !/[a-z]/.test(text);
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const lineKey = (text: string) => collapseLetterSpacing(text.trim()).toLowerCase().replace(/\s+/g, " ");
const URLISH = /^(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/i;

export function isDecorativeParagraph(paragraph: string): boolean {
  const text = collapseLetterSpacing(paragraph.trim());
  if (!text) return true;
  // Page numbers: "12", "0 3", "- 14 -".
  if (/^[\s\d.\-–—]+$/.test(text) && text.replace(/\D/g, "").length <= 4) return true;
  // Counters on section pages: "9 POEMS", "11 Poems", "1 POEM", "12 LESSONS".
  if (/^\d+\s+(poems?|chapters?|lessons?|stories|story|units?|pieces?)$/i.test(text)) return true;
  // Dash-wrapped caps markers: "— UNFINISHED —", "— END —".
  if (/^[—–\-~*•·]+\s*[A-Z][A-Z\s]{1,30}\s*[—–\-~*•·]+$/.test(text)) return true;
  // Category labels: "HINDI / URDU · LOVE", "ENGLISH · THE SELF".
  if (isAllCapsLabel(text) && wordCount(text) <= 8 && /[·•|]/.test(text)) return true;
  // Only links: "https://a.app · b.app/writing".
  const tokens = text.split(/\s+/).filter((t) => !/^[·•|,;\-–—]+$/.test(t));
  if (tokens.length > 0 && tokens.every((t) => URLISH.test(t.replace(/[.,;]$/, "")))) return true;
  return false;
}

// Short lines that repeat across 3+ chapters are running headers/footers
// (a book title at the foot of every page), and short ALL-CAPS lines that
// repeat across 2+ chapters are section labels. Returns normalized keys.
function repeatedBookLines(chapters: DetectedChapter[]): Set<string> {
  const seen = new Map<string, { chapters: Set<number>; caps: boolean }>();
  chapters.forEach((chapter, index) => {
    const candidates = new Set<string>();
    for (const paragraph of chapter.paragraphs) {
      candidates.add(paragraph);
      if (paragraph.includes("\n")) paragraph.split("\n").forEach((line) => candidates.add(line));
    }
    for (const paragraph of candidates) {
      const text = collapseLetterSpacing(paragraph.trim());
      if (!text || wordCount(text) > 8) continue;
      const key = lineKey(text);
      const entry = seen.get(key) || { chapters: new Set<number>(), caps: false };
      entry.chapters.add(index);
      entry.caps = entry.caps || isAllCapsLabel(text);
      seen.set(key, entry);
    }
  });
  const repeated = new Set<string>();
  for (const [key, entry] of seen) {
    if (entry.chapters.size >= 3 || (entry.caps && entry.chapters.size >= 2)) repeated.add(key);
  }
  return repeated;
}

export function scriptLanguage(text: string): "Telugu" | "Hindi" | "English" | null {
  const telugu = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  const hindi = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const total = telugu + hindi + latin;
  if (total === 0) return null;
  if (telugu >= hindi && telugu / total >= 0.3) return "Telugu";
  if (hindi / total >= 0.3) return "Hindi";
  return latin > 0 ? "English" : null;
}

// Rule-based cleanup of every chapter: drops decorative/label paragraphs,
// sets each chapter's language from its script, drops chapters left empty.
export function cleanBookChapters(chapters: DetectedChapter[]): {
  chapters: DetectedChapter[];
  removedParagraphs: number;
} {
  const repeated = repeatedBookLines(chapters);
  let removedParagraphs = 0;
  const cleaned: DetectedChapter[] = [];
  for (const chapter of chapters) {
    const isJunk = (text: string) => isDecorativeParagraph(text) || repeated.has(lineKey(text));
    const paragraphs: string[] = [];
    const paragraphPages: (number | null)[] = [];
    const sourcePages = pagesOf(chapter);
    for (const [index, paragraph] of chapter.paragraphs.entries()) {
      if (isJunk(paragraph)) {
        removedParagraphs += 1;
        continue;
      }
      // OCR often glues a page label or marker onto the last stanza as its
      // own line ("...And then the string...\n— U N F I N I S H E D —").
      const lines = paragraph.split("\n");
      const kept = lines.filter((line) => !line.trim() || !isJunk(line));
      removedParagraphs += lines.length - kept.length;
      // A CJK full stop in Devanagari text is an OCR/model slip for the danda.
      const joined = kept.join("\n").replace(/(?<=[\u0900-\u097F])\s*。/g, "।").trim();
      if (joined) {
        paragraphs.push(joined);
        paragraphPages.push(sourcePages[index]);
      }
    }
    if (paragraphs.length === 0 && chapter.images.length === 0 && chapter.tables.length === 0) continue;
    cleaned.push({
      ...chapter,
      paragraphs,
      paragraphPages,
      text: paragraphs.join("\n\n"),
      language: scriptLanguage(paragraphs.join(" ")) || chapter.language,
    });
  }
  return { chapters: cleaned, removedParagraphs };
}

export interface ChapterRefinement {
  chapterIndex: number;
  script?: string;
  kind?: string;
  title?: string;
  subtitle?: string;
  removeParagraphs?: number[];
}

// The AI refinement pass's input: each chapter's paragraphs, indexed and
// trimmed, so one request can cover ~40 chapters.
export function buildRefinementOutline(chapters: DetectedChapter[], previewChars = 110): string {
  return chapters
    .map((chapter, index) => {
      const lines = chapter.paragraphs.map((p, i) => {
        const flat = p.replace(/\s+/g, " ").trim();
        return `   (${i}) ${flat.length > previewChars ? `${flat.slice(0, previewChars)}…` : flat}`;
      });
      return `[${index}] "${chapter.chapterTitle}" kind=${chapter.kind || "lesson"}\n${lines.join("\n")}`;
    })
    .join("\n");
}

// Applies the AI's per-chapter verdicts: section title pages are dropped and
// become the "part" of the chapters after them; front/back matter is
// dropped; non-body paragraphs (labels, notes, translated subtitles, credits)
// are removed but a chapter never loses all its text; auto-numbered
// chapters ("Chapter 7") are renumbered after drops.
export function applyChapterRefinements(
  chapters: DetectedChapter[],
  refinements: ChapterRefinement[]
): { chapters: DetectedChapter[]; droppedChapters: number; removedParagraphs: number } {
  const byIndex = new Map<number, ChapterRefinement>();
  for (const r of refinements || []) {
    if (Number.isInteger(r?.chapterIndex) && r.chapterIndex >= 0 && r.chapterIndex < chapters.length) {
      byIndex.set(r.chapterIndex, r);
    }
  }
  let part = "";
  let droppedChapters = 0;
  let removedParagraphs = 0;
  const kept: DetectedChapter[] = [];
  chapters.forEach((chapter, index) => {
    const r = byIndex.get(index);
    let kind = r?.kind || chapter.kind;
    // "Front matter" after the content has started is a section title page
    // (a model once called a book's last section page "front_matter").
    if (kind === "front_matter" && kept.length > 0 && index < chapters.length - 1) {
      kind = "section_divider";
    }
    if (kind === "section_divider") {
      part = String(r?.title || chapter.chapterTitle || "").trim();
      droppedChapters += 1;
      return;
    }
    if (kind && SKIPPED_CHAPTER_KINDS.includes(kind)) {
      droppedChapters += 1;
      return;
    }
    const remove = new Set(
      (r?.removeParagraphs || []).filter((i) => Number.isInteger(i) && i >= 0 && i < chapter.paragraphs.length)
    );
    const sourcePages = pagesOf(chapter);
    let paragraphs = chapter.paragraphs.filter((_, i) => !remove.has(i));
    let paragraphPages = sourcePages.filter((_, i) => !remove.has(i));
    if (paragraphs.length === 0) {
      paragraphs = chapter.paragraphs;
      paragraphPages = sourcePages;
    } else {
      removedParagraphs += chapter.paragraphs.length - paragraphs.length;
    }
    const title = String(r?.title || "").trim();
    kept.push({
      ...chapter,
      kind: kind || chapter.kind,
      chapterTitle: title || chapter.chapterTitle,
      subtitle: String(r?.subtitle || chapter.subtitle || "").trim() || undefined,
      part: part || chapter.part,
      paragraphs,
      paragraphPages,
      romanizedLanguage:
        r?.script === "romanized_hindi" ? "Hindi" : r?.script === "romanized_telugu" ? "Telugu" : chapter.romanizedLanguage,
      text: paragraphs.join("\n\n"),
      language: scriptLanguage(paragraphs.join(" ")) || chapter.language,
    });
  });
  if (kept.length === 0) {
    return { chapters, droppedChapters: 0, removedParagraphs: 0 };
  }
  let counter = 0;
  for (const chapter of kept) {
    counter += 1;
    if (!chapter.chapterNumber || /^chapter\s+\d+$/i.test(chapter.chapterNumber)) {
      chapter.chapterNumber = `Chapter ${counter}`;
    }
  }
  return { chapters: kept, droppedChapters, removedParagraphs };
}

/* =========================================================
   PAGE BREAKS AND LONG CHAPTERS
\\\\========================================================= */

const SENTENCE_END = /[.!?।॥:;"”’)\]…]\s*$/;

// OCR returns each printed page separately, so a sentence that runs over a
// page break arrives as two paragraphs ("…sealed off the gate to the sea a" /
// "and everything returned to normal"). Join them back when the first has no
// sentence ending and the second starts with a lowercase letter on the next
// page. Poems (lines without full stops) usually start lines with capitals,
// and Indian scripts have no case, so neither is joined by mistake.
export function joinPageBreakParagraphs(
  paragraphs: string[],
  pages: (number | null)[]
): { paragraphs: string[]; pages: (number | null)[] } {
  const outText: string[] = [];
  const outPages: (number | null)[] = [];
  paragraphs.forEach((raw, i) => {
    const text = String(raw || "").trim();
    if (!text) return;
    const page = pages[i] ?? null;
    const last = outText.length - 1;
    const prevPage = last >= 0 ? outPages[last] : null;
    const continues =
      last >= 0 &&
      page !== null &&
      prevPage !== null &&
      page > prevPage &&
      page - prevPage <= 2 &&
      !SENTENCE_END.test(outText[last]) &&
      /^[a-z]/.test(text);
    if (continues) {
      outText[last] = `${outText[last]} ${text}`;
    } else {
      outText.push(text);
      outPages.push(page);
    }
  });
  return { paragraphs: outText, pages: outPages };
}

// How many words one chapter should hold for a class: about 15-25 reader
// pages (one read-aloud attempt each), so a chapter is one sitting.
export function maxChapterWordsForGrade(grade: string | undefined): number {
  const n = Number(String(grade || "").replace(/\D/g, "")) || 5;
  return n <= 1 ? 150 : n === 2 ? 250 : n === 3 ? 350 : n === 4 ? 450 : 550;
}


type SplittableChapter = {
  chapterTitle: string;
  paragraphs: string[];
  paragraphPages?: (number | null)[];
  images?: { pageNumber?: number | null }[];
  tables?: { pageNumber?: number | null }[];
};

// Splits a chapter longer than `maxWords` into parts at printed-page
// boundaries (paragraph boundaries when pages are unknown), titled
// "Title (Part 1 of 3)". Pictures and tables go with the part holding their
// printed page (unknown page: the first part). A short chapter is returned
// unchanged, and a short tail is folded into the previous part.
export function splitLongChapter<T extends SplittableChapter>(chapter: T, maxWords: number): T[] {
  const paragraphs = chapter.paragraphs.map((p) => String(p || "").trim());
  const pages = paragraphs.map((_, i) => chapter.paragraphPages?.[i] ?? null);
  const total = wordCount(paragraphs.join(" "));
  if (total <= maxWords * 1.3) return [chapter];

  // Units that must stay together: consecutive paragraphs of one printed page.
  const units: { indexes: number[]; words: number }[] = [];
  paragraphs.forEach((p, i) => {
    const last = units[units.length - 1];
    const samePage = last && pages[i] !== null && pages[last.indexes[last.indexes.length - 1]] === pages[i];
    if (samePage && last.words + wordCount(p) <= maxWords * 1.5) {
      last.indexes.push(i);
      last.words += wordCount(p);
    } else {
      units.push({ indexes: [i], words: wordCount(p) });
    }
  });

  const groups: number[][] = [];
  let current: number[] = [];
  let words = 0;
  for (const unit of units) {
    if (current.length && words + unit.words > maxWords) {
      groups.push(current);
      current = [];
      words = 0;
    }
    current.push(...unit.indexes);
    words += unit.words;
  }
  if (current.length) {
    if (groups.length && words < maxWords * 0.3) groups[groups.length - 1].push(...current);
    else groups.push(current);
  }
  if (groups.length < 2) return [chapter];

  const pageRange = (g: number[]) => {
    const known = g.map((i) => pages[i]).filter((p): p is number => p !== null);
    return known.length ? { min: Math.min(...known), max: Math.max(...known) } : null;
  };
  const ranges = groups.map(pageRange);
  const partFor = (page: number | null | undefined) => {
    if (page === null || page === undefined) return 0;
    const exact = ranges.findIndex((r) => r && page >= r.min && page <= r.max);
    if (exact >= 0) return exact;
    // A picture on a page with no text: the part just before that page.
    let best = 0;
    ranges.forEach((r, k) => {
      if (r && r.min <= page) best = k;
    });
    return best;
  };

  return groups.map((g, k) => ({
    ...chapter,
    chapterTitle: `${chapter.chapterTitle} (Part ${k + 1} of ${groups.length})`,
    paragraphs: g.map((i) => paragraphs[i]),
    paragraphPages: g.map((i) => pages[i]),
    images: (chapter.images || []).filter((img) => partFor(img?.pageNumber) === k),
    tables: (chapter.tables || []).filter((t) => partFor(t?.pageNumber) === k),
  }));
}

// Questions made from the chapter's own sentences, with no AI: "fill in the
// missing word". Used when the AI can't write comprehension questions (free
// Gemini quota used up, overload), so a published chapter is never left
// without questions. Each question blanks one content word of a real
// sentence; the 3 wrong options are other words from the same chapter, in
// the same script and of similar length, that are not in that sentence.
const CLOZE_STOPWORDS = new Set(
  (
    "the and that this with from have were they them their there what when where which while your yours " +
    "will would could should shall into onto over under about after before because been being does doing " +
    "very just than then also only some such each other more most much many like said says " +
    "है हैं था थी थे के की का में और से को ने पर यह वह ये वो तो भी ही एक नहीं मैं तुम हम आप क्या कोई कुछ " +
    "मेरा मेरी मेरे तेरा तेरी तेरे उसका उसकी उसके उनका उनकी उनके हमारा हमारी हमारे तुम्हारा तुम्हारी तुम्हारे " +
    "आपका आपकी आपके मैंने मुझे मुझको तुझे तुमने आपने आपको उसने उसको उन्हें इसे उसे जैसे कैसे क्यों कहाँ " +
    "మరియు ఒక ఈ ఆ లో కి కు నేను నువ్వు మనం అది ఇది అని కూడా ఉంది ఉన్న"
  ).split(/\s+/)
);
const CLOZE_PROMPT: Record<string, string> = {
  English: "Fill in the missing word:",
  Hindi: "खाली जगह में सही शब्द चुनो:",
  Telugu: "ఖాళీలో సరైన పదం ఎంచుకోండి:",
};
const CLOZE_EXPLAIN: Record<string, string> = {
  English: "The text says:",
  Hindi: "पाठ में लिखा है:",
  Telugu: "పాఠంలో ఇలా ఉంది:",
};
const BLANK = "_____";

const coreOf = (token: string) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
const isContentWord = (word: string) => {
  if (!/^[\p{L}\p{M}]+$/u.test(word)) return false;
  if (CLOZE_STOPWORDS.has(word.toLowerCase())) return false;
  return /[A-Za-z]/.test(word) ? word.length >= 4 : Array.from(word).length >= 3;
};

export function buildFallbackQuiz(
  paragraphs: string[],
  language: string,
  count = 3
): Array<{ question: string; questionEnglish: string; options: string[]; correctOptionIndex: number; explanation: string }> {
  const sentences = paragraphs
    .flatMap((p) => String(p || "").split(/\n+/))
    .flatMap((line) => line.split(/(?<=[.!?।॥])\s+/))
    .map((s) => s.trim())
    .filter((s) => {
      const words = s.split(/\s+/).length;
      return words >= 4 && words <= 30;
    });
  // Every content word of the chapter, first appearance first, for wrong options.
  const pool: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    for (const token of s.split(/\s+/)) {
      const word = coreOf(token);
      if (isContentWord(word) && !seen.has(word.toLowerCase())) {
        seen.add(word.toLowerCase());
        pool.push(word);
      }
    }
  }

  const candidates: Array<{ question: string; questionEnglish: string; answer: string; distractors: string[]; explanation: string }> = [];
  for (const sentence of sentences) {
    const tokens = sentence.split(/(\s+)/);
    const words = tokens.map(coreOf);
    const inSentence = new Set(words.map((w) => w.toLowerCase()));
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w.toLowerCase(), (counts.get(w.toLowerCase()) || 0) + 1);
    let answerAt = -1;
    for (const [i, w] of words.entries()) {
      if (!isContentWord(w) || counts.get(w.toLowerCase())! > 1) continue;
      if (answerAt < 0 || Array.from(w).length > Array.from(words[answerAt]).length) answerAt = i;
    }
    if (answerAt < 0) continue;
    const answer = words[answerAt];
    const script = scriptLanguage(answer);
    const length = Array.from(answer).length;
    const distractors = pool
      .filter((w) => !inSentence.has(w.toLowerCase()) && scriptLanguage(w) === script)
      .map((w, order) => ({ w, order, gap: Math.abs(Array.from(w).length - length) }))
      .sort((a, b) => a.gap - b.gap || a.order - b.order)
      .slice(0, 3)
      .map((d) => d.w);
    if (distractors.length < 3) continue;
    const lang = scriptLanguage(sentence) || (CLOZE_PROMPT[language] ? language : "English");
    const blanked = tokens.map((t, i) => (i === answerAt ? t.replace(answer, BLANK) : t)).join("");
    candidates.push({
      question: `${CLOZE_PROMPT[lang] || CLOZE_PROMPT.English} "${blanked}"`,
      questionEnglish: "Fill in the missing word.",
      answer,
      distractors,
      explanation: `${CLOZE_EXPLAIN[lang] || CLOZE_EXPLAIN.English} "${sentence}"`,
    });
  }
  // One question per answer word, spread over the chapter (beginning, middle, end).
  const answers = new Set<string>();
  const unique = candidates.filter((c) => !answers.has(c.answer.toLowerCase()) && answers.add(c.answer.toLowerCase()));
  const picked: typeof candidates = [];
  const n = Math.min(count, unique.length);
  for (let i = 0; i < n; i++) {
    const at = n === 1 ? 0 : Math.round((i * (unique.length - 1)) / (n - 1));
    if (!picked.includes(unique[at])) picked.push(unique[at]);
  }
  const positions = [2, 0, 3, 1];
  return picked.map((c, i) => {
    const correctOptionIndex = positions[i % positions.length];
    const options = [...c.distractors];
    options.splice(correctOptionIndex, 0, c.answer);
    return {
      question: c.question,
      questionEnglish: c.questionEnglish,
      options,
      correctOptionIndex,
      explanation: c.explanation,
    };
  });
}
