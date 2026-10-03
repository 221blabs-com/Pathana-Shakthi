// Cloud (Gemini) fallback for the two local AI services: text generation
// normally served by Ollama, and textbook OCR normally served by the
// Docling/EasyOCR service (backend/ocr). Both local services need 1-3 GB of
// RAM, so on small hosts (e.g. Render's 512 MB free tier) they are asleep,
// crash-looping, or absent; this keeps the whole textbook pipeline working
// by producing exactly the shapes the local services would have returned.
//
// Every process.env read is lazy: server.ts calls dotenv.config() after its
// imports are evaluated, so module-level reads would miss a local .env.

import { cropPdfFigures, openPdfPageRenderer, type FigureBox, type PdfPageRenderer } from "./pdfFigures";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";
import {
  DetectedChapterImage,
  OcrPage,
  doclingChaptersFromOcrPages,
} from "./textbookOcr";

// Each model has its own free-tier quota and its own "high demand" spells,
// so a longer chain keeps a book moving. Measured 30 Sep on the same scanned
// page: 3.6-flash exact in ~5 s; flash-lite-latest exact in ~11 s;
// 3.5-flash-lite exact but 26 s (overloaded) — it had carried most of a
// 154-page book that took 17 min to read; 3.5-flash faithful but its ~20
// requests/day free quota runs out early; 3-flash-preview and 3.8-flash
// often answer 503. The chain falls through on 503/404/429.
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

// A model that just answered "high demand" is skipped for a minute, so a
// 50-request textbook doesn't pay its 503 round-trips on every page batch.
const OVERLOAD_COOLDOWN_MS = 60 * 1000;
const modelCooldownUntil = new Map<string, number>();

function orderByAvailability(models: string[]): string[] {
  const now = Date.now();
  const ready = models.filter((model) => (modelCooldownUntil.get(model) || 0) <= now);
  const cooling = models.filter((model) => !ready.includes(model));
  return [...ready, ...cooling];
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export type AiProviderMode = "auto" | "local" | "gemini";

export function providerMode(envValue: string | undefined): AiProviderMode {
  const value = String(envValue || "").trim().toLowerCase();
  return value === "local" || value === "gemini" ? value : "auto";
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function parseModelChain(envValue: string | undefined): string[] {
  const models = String(envValue || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
}

export function geminiTextModels(): string[] {
  return parseModelChain(process.env.GEMINI_MODEL);
}

export function geminiOcrModels(): string[] {
  return parseModelChain(
    process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL
  );
}

let client: GoogleGenAI | null = null;
let clientKey = "";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set, so the Gemini fallback is unavailable."
    );
  }
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error: any): number {
  const status = Number(error?.status ?? error?.code);
  return Number.isFinite(status) ? status : 0;
}

function isNetworkError(error: any): boolean {
  return (
    error?.name === "TypeError" ||
    /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(
      String(error?.message || "")
    )
  );
}

// "Please retry in 37.5s" / "retryDelay": "37s" in a 429 body.
function retryDelayFromError(error: any): number | null {
  const match = String(error?.message || "").match(
    /retry(?:Delay"?:\s*"?| in )(\d+(?:\.\d+)?)s/i
  );
  return match ? Math.min(Number(match[1]) * 1000, 60_000) : null;
}

interface GenerateArgs {
  contents: any;
  config: Record<string, any>;
}

// How long to skip a model that refused: a daily quota won't reset soon, a
// per-minute quota says when to retry, and overload is usually brief.
function cooldownAfterRefusal(status: number, message: string): number | null {
  if (status === 429) {
    if (/PerDay/i.test(message)) return 60 * 60 * 1000;
    return retryDelayFromError({ message }) ?? 60 * 1000;
  }
  if (status === 503) return OVERLOAD_COOLDOWN_MS;
  if (status === 404) return 60 * 60 * 1000;
  return null;
}

// Tries each available model in order. A refusal (quota 429, overload 503,
// retired 404) puts that model on cooldown and moves straight to the next
// model, which has its own quota; other transient errors (500/502/504,
// network) get one quick retry on the same model. If every model is
// cooling down from a short per-minute limit or brief overload, waits for the
// soonest one (up to 4 times) rather than failing: on the free tier a whole
// book easily bursts past 15 requests/minute, and a short wait beats a
// chapter published without its quiz.
async function generateWithModelChain(
  models: string[],
  args: GenerateArgs,
  timeoutMs: number
): Promise<{ text: string; model: string; finishReason: string }> {
  let lastError: any = new Error(
    "Every Gemini model is over its quota or unavailable. On the free tier this is usually the daily request limit — enable billing for the Gemini API key's project."
  );
  const MAX_ROUNDS = 5;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const ready = orderByAvailability(models).filter(
      (model) => (modelCooldownUntil.get(model) || 0) <= Date.now()
    );
    for (const model of ready) {
      const result = await tryModel(model);
      if (result) return result;
    }
    if (round === MAX_ROUNDS) break;
    const shortWaits = models
      .map((model) => (modelCooldownUntil.get(model) || 0) - Date.now())
      .filter((wait) => wait > 0 && wait <= 65 * 1000);
    if (shortWaits.length === 0) break;
    await sleep(Math.min(...shortWaits));
  }
  throw lastError;

  async function tryModel(
    model: string
  ): Promise<{ text: string; model: string; finishReason: string } | null> {
    let config = { ...args.config };
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await getClient().models.generateContent({
          model,
          contents: args.contents,
          config: { ...config, abortSignal: AbortSignal.timeout(timeoutMs) },
        });
        const finishReason = String(
          response.candidates?.[0]?.finishReason || ""
        );
        const text = response.text || "";
        if (!text.trim()) {
          throw Object.assign(
            new Error(
              `Gemini ${model} returned no text (finishReason: ${finishReason || "unknown"}).`
            ),
            { status: finishReason === "MAX_TOKENS" ? 0 : 500 }
          );
        }
        return { text, model, finishReason };
      } catch (error: any) {
        lastError = error;
        const status = errorStatus(error);
        const message = String(error?.message || "");
        // Some models reject a config field another model accepts
        // (thinking level, a JSON-schema keyword); retry once without it.
        if (status === 400 && (config.thinkingConfig || config.responseJsonSchema)) {
          const { thinkingConfig, responseJsonSchema, ...rest } = config;
          config = rest;
          continue;
        }
        const cooldown = cooldownAfterRefusal(status, message);
        if (cooldown !== null) {
          modelCooldownUntil.set(model, Date.now() + cooldown);
          console.warn(
            `[GEMINI] ${model} refused (${status}${/PerDay/i.test(message) ? ", daily quota reached" : ""}); skipping it for ${Math.round(cooldown / 1000)}s.`
          );
          return null;
        }
        if (!RETRYABLE_STATUSES.has(status) && !isNetworkError(error)) {
          throw error;
        }
        if (attempt < 3) await sleep(2000 * attempt);
      }
    }
    return null;
  }
}

// Low thinking keeps latency reasonable for structured extraction; models
// that do not support thinkingLevel get it stripped on the 400 retry above.
const LOW_THINKING = { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };

export async function generateJsonWithGemini(
  prompt: string,
  options: {
    systemInstruction: string;
    temperature?: number;
    timeoutMs?: number;
    jsonSchema?: any;
  }
): Promise<{ text: string; model: string }> {
  const { text, model } = await generateWithModelChain(
    geminiTextModels(),
    {
      contents: prompt,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.2,
        responseMimeType: "application/json",
        ...(options.jsonSchema && typeof options.jsonSchema === "object"
          ? { responseJsonSchema: options.jsonSchema }
          : {}),
        ...LOW_THINKING,
      },
    },
    options.timeoutMs ?? 3 * 60 * 1000
  );
  return { text, model };
}

/* =========================================================
   OCR
\\\\========================================================= */

const LANGUAGE_NAMES: Record<string, string> = {
  telugu: "Telugu",
  hindi: "Hindi",
  english: "English",
};

// Telugu and Kannada letters look alike; models occasionally emit a Kannada
// code point inside a Telugu word.
const SCRIPT_RULES: Record<string, string> = {
  telugu:
    "- Write Telugu only with Telugu Unicode characters (U+0C00-U+0C7F); never substitute look-alike Kannada letters.",
  hindi:
    "- Write Hindi only with Devanagari Unicode characters (U+0900-U+097F).",
};

const LANGUAGES_USED: Record<string, string[]> = {
  telugu: ["te", "en"],
  hindi: ["hi", "en"],
  english: ["en"],
};

// Dense Telugu/Hindi pages cost far more output tokens per page than
// English; 4 pages per request stays well inside the output limit while
// keeping a 200-page textbook to ~50 requests.
const PAGES_PER_REQUEST = 4;
const MAX_INLINE_REQUEST_BYTES = 18 * 1024 * 1024;
const OCR_CONCURRENCY = 4;
// Pages that come back without text get one retry as a rendered image; a
// book where most pages are empty is not worth re-reading page by page.
const MAX_RESCUED_PAGES = 60;
const MIN_BOOK_TEXT_CHARS = 40;

class BlankPageInRun extends Error {
  constructor() {
    super("A blank page inside this run of pages.");
  }
}
// Firestore documents are capped at 1 MiB; published images are stored
// base64-encoded (4/3 expansion) one per document.
const MAX_EXTRACTED_IMAGE_BYTES = 700 * 1024;
const MIN_EXTRACTED_IMAGE_SIDE = 150;

const OCR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pageIndex: { type: Type.INTEGER },
          blocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: {
                  type: Type.STRING,
                  enum: [
                    "chapter_heading",
                    "subheading",
                    "paragraph",
                    "table",
                    "caption",
                    "figure",
                  ],
                },
                text: { type: Type.STRING },
                box: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              },
              required: ["kind", "text"],
            },
          },
        },
        required: ["pageIndex", "blocks"],
      },
    },
  },
  required: ["pages"],
};

function buildOcrPrompt(
  language: string,
  pageCount: number,
  firstPageNumber: number,
  asImages = false
): string {
  const languageName = LANGUAGE_NAMES[language] || "an Indian language";
  const range =
    pageCount === 1
      ? `page ${firstPageNumber}`
      : `pages ${firstPageNumber}-${firstPageNumber + pageCount - 1}`;
  const attached = asImages
    ? pageCount === 1
      ? `The attached image is ${range} of a textbook.`
      : `The ${pageCount} attached images are ${range} of a textbook, in order (image 1 = pageIndex 1).`
    : `The attached document is ${range} of a textbook (${pageCount} page${pageCount === 1 ? "" : "s"}).`;
  return `You are a precise OCR engine for Indian primary-school textbooks.
${attached} Its main language is ${languageName}; it may also contain English.

Transcribe ALL readable printed text exactly as printed, in its original script.
- Never translate, transliterate, summarize, or add words.
- Copy spelling and grammar character-for-character, including colloquial, dialect, or non-standard forms; never "fix" or modernize a word into what you expect it to be.
${SCRIPT_RULES[language] || ""}
- Read the text visually from the rendered page. Some Indian-language PDFs use legacy fonts whose embedded text layer is garbage; if an embedded text layer disagrees with what is visibly printed, trust what is visible.
- Skip running headers/footers, page numbers, watermarks, and purely decorative text.

Return one entry per page with "pageIndex" (1 = first page of this attachment) and its "blocks" in reading order:
- "chapter_heading": a title that starts a new lesson, chapter, unit, poem, or story (include its number, e.g. "పాఠం 3: ...").
- "subheading": a heading inside a lesson (exercises, new words, activities).
- "paragraph": body text, one block per paragraph; for poems, one block per stanza with "\\n" between lines.
- "table": a table as a GitHub-flavored markdown pipe table with a header row and a |---| separator row.
- "caption": the caption printed with a picture.
- "figure": each picture, photo, illustration or diagram on the page (not decorative borders or icons): "text" = a short plain description of what it shows in the book's language, "box" = its position as [ymin, xmin, ymax, xmax] on a 0-1000 scale of the page.
A page with no readable text gets an empty "blocks" array. Include every page.`;
}

interface OcrPart {
  mimeType: string;
  data: Buffer;
}

// A run of consecutive pages sent in one request: either one small PDF cut
// out of the book, or one rendered JPEG per page.
interface OcrChunk {
  firstPageNumber: number;
  pageCount: number;
  parts: OcrPart[];
}

export function parseOcrPagesResponse(
  text: string,
  firstPageNumber: number,
  pageCount: number
): OcrPage[] {
  const parsed = JSON.parse(text);
  const rawPages: any[] = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const pages: OcrPage[] = [];
  rawPages.forEach((raw, position) => {
    const index = Number.isInteger(raw?.pageIndex) ? raw.pageIndex : position + 1;
    const clamped = Math.min(Math.max(index, 1), pageCount);
    pages.push({
      pageNumber: firstPageNumber + clamped - 1,
      blocks: (Array.isArray(raw?.blocks) ? raw.blocks : [])
        .map((block: any) => ({
          kind: String(block?.kind || "paragraph"),
          text: String(block?.text || ""),
          ...(Array.isArray(block?.box) ? { box: block.box.map(Number) } : {}),
        }))
        .filter((block: { text: string }) => block.text.trim()),
    });
  });
  return pages;
}

async function ocrChunkWithGemini(
  chunk: OcrChunk,
  language: string
): Promise<{ pages: OcrPage[]; model: string }> {
  const { text, model, finishReason } = await generateWithModelChain(
    geminiOcrModels(),
    {
      contents: [
        {
          role: "user",
          parts: [
            ...chunk.parts.map((part) => ({
              inlineData: { mimeType: part.mimeType, data: part.data.toString("base64") },
            })),
            {
              text: buildOcrPrompt(
                language,
                chunk.pageCount,
                chunk.firstPageNumber,
                chunk.parts.length > 0 && chunk.parts[0].mimeType.startsWith("image/") && chunk.pageCount > 0 && chunk.parts.length === chunk.pageCount
              ),
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: OCR_RESPONSE_SCHEMA,
        maxOutputTokens: 65536,
        ...LOW_THINKING,
      },
    },
    5 * 60 * 1000
  );
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      `Gemini output was cut off for pages ${chunk.firstPageNumber}-${chunk.firstPageNumber + chunk.pageCount - 1}.`
    );
  }
  return {
    pages: parseOcrPagesResponse(text, chunk.firstPageNumber, chunk.pageCount),
    model,
  };
}

async function pdfPagesToBuffer(
  source: PDFDocument,
  pageIndices: number[]
): Promise<Buffer> {
  const target = await PDFDocument.create();
  const copied = await target.copyPages(source, pageIndices);
  copied.forEach((page) => target.addPage(page));
  return Buffer.from(await target.save());
}

function isDctOnly(filter: unknown): boolean {
  if (filter instanceof PDFName) return filter === PDFName.of("DCTDecode");
  if (filter instanceof PDFArray) {
    return filter.size() === 1 && filter.get(0) === PDFName.of("DCTDecode");
  }
  return false;
}

// Embedded JPEG illustrations are copied out byte-for-byte (a JPEG stream
// inside a PDF is a complete JPEG file), so no image library is needed.
// Scanned textbooks are skipped entirely: there every page is one big scan,
// and "extracting" it would just duplicate the transcribed text as a photo.
export function extractPdfImages(
  pdf: PDFDocument
): Map<number, DetectedChapterImage[]> {
  const byPage = new Map<number, DetectedChapterImage[]>();
  const pages = pdf.getPages();
  const refUsage = new Map<string, number>();
  const candidates: Array<{
    pageNumber: number;
    ref: string;
    bytes: Uint8Array;
    width: number;
    height: number;
    coversPage: boolean;
  }> = [];
  let pagesWithSingleFullImage = 0;

  pages.forEach((page, pageIndex) => {
    const xObjects = page.node
      .Resources()
      ?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xObjects) return;
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pageAspect = pageWidth / Math.max(pageHeight, 1);
    let largeImagesOnPage = 0;
    let fullPageImagesOnPage = 0;
    for (const [, value] of xObjects.entries()) {
      const ref = value instanceof PDFRef ? value : null;
      const stream = ref ? pdf.context.lookup(ref) : value;
      if (!(stream instanceof PDFRawStream)) continue;
      const dict = stream.dict;
      if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
      const width = dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
      const height = dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
      if (width < MIN_EXTRACTED_IMAGE_SIDE || height < MIN_EXTRACTED_IMAGE_SIDE) continue;
      largeImagesOnPage += 1;
      const coversPage =
        Math.abs(width / height - pageAspect) / pageAspect < 0.04;
      if (coversPage) fullPageImagesOnPage += 1;
      const refKey = ref ? ref.toString() : `inline-${pageIndex}-${candidates.length}`;
      refUsage.set(refKey, (refUsage.get(refKey) || 0) + 1);
      const colorSpace = dict.get(PDFName.of("ColorSpace"));
      if (
        !isDctOnly(dict.get(PDFName.of("Filter"))) ||
        colorSpace === PDFName.of("DeviceCMYK") ||
        stream.contents.length > MAX_EXTRACTED_IMAGE_BYTES
      ) {
        continue;
      }
      candidates.push({
        pageNumber: pageIndex + 1,
        ref: refKey,
        bytes: stream.contents,
        width,
        height,
        coversPage,
      });
    }
    if (largeImagesOnPage === 1 && fullPageImagesOnPage === 1) {
      pagesWithSingleFullImage += 1;
    }
  });

  if (pages.length > 0 && pagesWithSingleFullImage / pages.length >= 0.5) {
    return byPage;
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    // Logos/backgrounds repeated across many pages are not illustrations.
    if ((refUsage.get(candidate.ref) || 0) > 2 || seen.has(candidate.ref)) continue;
    if (candidate.coversPage) continue;
    seen.add(candidate.ref);
    const list = byPage.get(candidate.pageNumber) || [];
    list.push({
      base64: Buffer.from(candidate.bytes).toString("base64"),
      mimeType: "image/jpeg",
      pageNumber: candidate.pageNumber,
      caption: "",
    });
    byPage.set(candidate.pageNumber, list);
  }
  return byPage;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export interface GeminiOcrResult {
  success: true;
  engine: "gemini";
  model: string;
  filename: string;
  pages: number;
  languagesUsed: string[];
  failedPages: number[];
  chapters: any[];
}

export async function runGeminiOcr(
  binaryData: Buffer,
  mimeType: string,
  fileName: string,
  language: string,
  onProgress: (completedPages: number, totalPages: number) => void
): Promise<GeminiOcrResult> {
  const isPdf =
    mimeType === "application/pdf" || /\.pdf$/i.test(fileName || "");
  let totalPages = 1;
  let imagesByPage = new Map<number, DetectedChapterImage[]>();
  let pdf: PDFDocument | null = null;
  let renderer: PdfPageRenderer | null = null;
  const pdfBytes = () => new Uint8Array(binaryData);
  const getRenderer = async () => (renderer ??= await openPdfPageRenderer(pdfBytes()));

  if (isPdf) {
    try {
      // A standalone copy: pdf-lib can misread a Buffer that is a view into
      // Node's shared allocation pool (non-zero byteOffset).
      pdf = await PDFDocument.load(pdfBytes(), {
        ignoreEncryption: true,
        updateMetadata: false,
        throwOnInvalidObject: false,
      });
      totalPages = pdf.getPageCount();
      // Proves the page tree can be copied before relying on it.
      if (totalPages > 0) await pdfPagesToBuffer(pdf, [0]);
    } catch (error: any) {
      // Damaged files (broken cross-reference table, wrong stream lengths)
      // that pdf-lib cannot split are still readable by pdf.js: their pages
      // are rendered and sent as images instead.
      console.warn(
        `[GEMINI-OCR] pdf-lib could not split ${fileName} (${error?.message || error}); rendering its pages instead.`
      );
      pdf = null;
      try {
        totalPages = (await getRenderer()).numPages;
      } catch (renderError: any) {
        console.warn(`[GEMINI-OCR] pdf.js could not open ${fileName} either: ${renderError?.message || renderError}`);
        throw new Error(
          "This PDF file is damaged and could not be opened. Open it on your computer and save or print it again as a new PDF, then upload that copy."
        );
      }
    }
    if (totalPages === 0) {
      throw new Error("The uploaded PDF has no pages.");
    }
    if (pdf) {
      try {
        imagesByPage = extractPdfImages(pdf);
      } catch (error: any) {
        console.warn(
          `[GEMINI-OCR] Picture extraction skipped: ${error?.message || error}`
        );
      }
    }
  }

  // One request's worth of pages, built only when it is about to be sent.
  const renderedPages = async (pageNumbers: number[]): Promise<{ parts: OcrPart[]; blank: number[] }> => {
    const r = await getRenderer();
    const parts: OcrPart[] = [];
    const blank: number[] = [];
    for (const n of pageNumbers) {
      const jpeg = await r.renderPageJpeg(n);
      if (jpeg) parts.push({ mimeType: "image/jpeg", data: jpeg });
      else blank.push(n);
    }
    return { parts, blank };
  };
  const loadChunk = async (firstPageNumber: number, pageCount: number): Promise<OcrChunk | null> => {
    if (!isPdf) {
      return { firstPageNumber: 1, pageCount: 1, parts: [{ mimeType: mimeType || "image/jpeg", data: binaryData }] };
    }
    const numbers = Array.from({ length: pageCount }, (_, i) => firstPageNumber + i);
    if (pdf) {
      try {
        return {
          firstPageNumber,
          pageCount,
          parts: [{ mimeType: "application/pdf", data: await pdfPagesToBuffer(pdf, numbers.map((n) => n - 1)) }],
        };
      } catch (error: any) {
        // One damaged page should not cost its neighbours: render this run.
        console.warn(
          `[GEMINI-OCR] pdf-lib could not copy pages ${firstPageNumber}-${firstPageNumber + pageCount - 1} (${error?.message || error}); rendering them instead.`
        );
      }
    }
    // Images are numbered by position, so a blank page in the middle of a
    // run would shift the rest: blank runs are sent page by page instead.
    const { parts, blank } = await renderedPages(numbers);
    if (blank.length === pageCount) return null;
    if (blank.length > 0) throw new BlankPageInRun();
    return { firstPageNumber, pageCount, parts };
  };

  const chunkStarts: Array<{ firstPageNumber: number; pageCount: number }> = [];
  for (let start = 1; start <= totalPages; start += PAGES_PER_REQUEST) {
    chunkStarts.push({ firstPageNumber: start, pageCount: Math.min(PAGES_PER_REQUEST, totalPages - start + 1) });
  }

  let completedPages = 0;
  const failedPages: number[] = [];
  const modelsUsed = new Set<string>();
  onProgress(0, totalPages);
  const done = (pageCount: number) => {
    completedPages += pageCount;
    onProgress(Math.min(completedPages, totalPages), totalPages);
  };

  const runChunk = async (range: { firstPageNumber: number; pageCount: number }): Promise<OcrPage[]> => {
    const { firstPageNumber, pageCount } = range;
    const label = pageCount === 1 ? `Page ${firstPageNumber}` : `Pages ${firstPageNumber}-${firstPageNumber + pageCount - 1}`;
    let chunk: OcrChunk | null = null;
    let splitError: unknown = null;
    try {
      chunk = await loadChunk(firstPageNumber, pageCount);
      if (!chunk) {
        // Every page rendered blank: nothing to read.
        done(pageCount);
        return [];
      }
      const size = chunk.parts.reduce((sum, part) => sum + part.data.length, 0);
      if (size > MAX_INLINE_REQUEST_BYTES) throw new Error(`${label} are too large for one request (${Math.round(size / 1048576)} MB).`);
      const { pages, model } = await ocrChunkWithGemini(chunk, language);
      modelsUsed.add(model);
      done(pageCount);
      return pages;
    } catch (error: any) {
      splitError = error;
    }
    if (pageCount === 1 || !isPdf) {
      console.warn(`[GEMINI-OCR] ${label} failed: ${(splitError as any)?.message || splitError}`);
      failedPages.push(firstPageNumber);
      done(1);
      return [];
    }
    if (!(splitError instanceof BlankPageInRun)) {
      console.warn(
        `[GEMINI-OCR] ${label} failed (${(splitError as any)?.message || splitError}); retrying one page at a time.`
      );
    }
    const singles: OcrPage[] = [];
    for (let offset = 0; offset < pageCount; offset++) {
      singles.push(...(await runChunk({ firstPageNumber: firstPageNumber + offset, pageCount: 1 })));
    }
    return singles;
  };

  try {
    const pageGroups = await mapWithConcurrency(chunkStarts, OCR_CONCURRENCY, runChunk);
    let pages = pageGroups.flat().sort((a, b) => a.pageNumber - b.pageNumber);

    if (failedPages.length >= totalPages) {
      throw new Error(
        "Gemini OCR could not read any page of this document. Check GEMINI_API_KEY and the server logs."
      );
    }

    // A page cut out with pdf-lib can come back with no text when the copy
    // lost its content (damaged resources) or its text layer misled the
    // model. Those pages get one more try as a rendered image; pages that
    // render blank are genuinely empty and are skipped.
    if (pdf) {
      const failed = new Set(failedPages);
      const empty = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
        (n) => !failed.has(n) && !pages.some((p) => p.pageNumber === n && p.blocks.some((b) => b.kind !== "figure" && b.text.trim()))
      );
      if (empty.length > 0 && empty.length <= MAX_RESCUED_PAGES) {
        try {
          await getRenderer();
          const rescued = (
            await mapWithConcurrency(empty, OCR_CONCURRENCY, async (n): Promise<OcrPage[]> => {
              try {
                const { parts } = await renderedPages([n]);
                if (!parts.length) return [];
                const { pages: read, model } = await ocrChunkWithGemini({ firstPageNumber: n, pageCount: 1, parts }, language);
                modelsUsed.add(model);
                return read;
              } catch (error: any) {
                console.warn(`[GEMINI-OCR] Page ${n} image retry failed: ${error?.message || error}`);
                return [];
              }
            })
          ).flat();
          const withText = rescued.filter((p) => p.blocks.some((b) => b.kind !== "figure" && b.text.trim()));
          if (withText.length) {
            const replaced = new Set(withText.map((p) => p.pageNumber));
            pages = [...pages.filter((p) => !replaced.has(p.pageNumber)), ...withText].sort((a, b) => a.pageNumber - b.pageNumber);
          }
          console.log(`[GEMINI-OCR] ${empty.length} page(s) came back without text; ${withText.length} read from rendered images.`);
        } catch (error: any) {
          console.warn(`[GEMINI-OCR] Image retry of empty pages skipped: ${error?.message || error}`);
        }
      }
    }

    // Pictures on pages with no embedded JPEG to copy (scanned pages, vector
    // drawings) are cut out of the rendered page at the boxes Gemini reported.
    if (isPdf) {
      const figures: FigureBox[] = [];
      for (const page of pages) {
        if ((imagesByPage.get(page.pageNumber) || []).length > 0) continue;
        for (const block of page.blocks) {
          if (block.kind === "figure" && Array.isArray(block.box)) {
            figures.push({ pageNumber: page.pageNumber, box: block.box, description: block.text });
          }
        }
      }
      if (figures.length > 0) {
        try {
          const cropped = await cropPdfFigures(pdfBytes(), figures);
          let count = 0;
          for (const [pageNumber, images] of cropped) {
            imagesByPage.set(pageNumber, [...(imagesByPage.get(pageNumber) || []), ...images]);
            count += images.length;
          }
          console.log(`[GEMINI-OCR] Cropped ${count} of ${figures.length} pictures out of rendered pages.`);
        } catch (error: any) {
          console.warn(`[GEMINI-OCR] Picture cropping skipped: ${error?.message || error}`);
        }
      }
    }

    // Read-along needs words: a "book" of a few stray characters (85 pages
    // once came back as 20) is reported, not published as an empty chapter.
    const textChars = pages.reduce(
      (sum, p) => sum + p.blocks.filter((b) => b.kind !== "figure").reduce((n, b) => n + b.text.trim().length, 0),
      0
    );
    if (textChars < MIN_BOOK_TEXT_CHARS) {
      console.warn(`[GEMINI-OCR] ${fileName}: only ${textChars} characters of text in ${totalPages} page(s).`);
      throw new Error(
        `Almost no readable text was found in this file (${totalPages} page${totalPages === 1 ? "" : "s"}). If it is a scan, check that the pages are clear and upright; if it is a picture book, there is nothing for children to read aloud.`
      );
    }

    const chapters = doclingChaptersFromOcrPages(pages, imagesByPage);
    return {
      success: true,
      engine: "gemini",
      model: [...modelsUsed].join(", ") || geminiOcrModels()[0],
      filename: fileName,
      pages: totalPages,
      languagesUsed: LANGUAGES_USED[language] || ["en"],
      failedPages: failedPages.sort((a, b) => a - b),
      chapters,
    };
  } finally {
    await (renderer as PdfPageRenderer | null)?.destroy().catch(() => undefined);
  }
}

/* =========================================================
   VOICE (fallback for Sarvam STT/TTS)
\\\\========================================================= */

// Lite first: measured on browser-recorded webm/opus it transcribes Telugu
// and English word-for-word in ~1-4 s, and its free-tier quota is far larger.
export function geminiSttModels(): string[] {
  return process.env.GEMINI_STT_MODEL
    ? parseModelChain(process.env.GEMINI_STT_MODEL)
    : ["gemini-3.5-flash-lite", "gemini-3.5-flash"];
}

export function geminiTtsModels(): string[] {
  return process.env.GEMINI_TTS_MODEL
    ? parseModelChain(process.env.GEMINI_TTS_MODEL)
    : ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"];
}

export async function transcribeAudioWithGemini(
  audio: Buffer,
  mimeType: string,
  languageName: string
): Promise<{ transcript: string; model: string }> {
  const { text, model } = await generateWithModelChain(
    geminiSttModels(),
    {
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: audio.toString("base64") } },
            {
              text: `A primary-school child is reading aloud in ${languageName}. Transcribe exactly the words spoken, in ${languageName} script (English words in Latin script), including mispronounced or repeated words as heard. Do not correct, translate, or complete the sentence. Output only the transcript. If no words are spoken, output exactly: <silence>`,
            },
          ],
        },
      ],
      config: { temperature: 0 },
    },
    60 * 1000
  );
  const transcript = text.trim() === "<silence>" ? "" : text.trim();
  return { transcript, model };
}

// Sarvam speaker names -> Gemini prebuilt voices of the same gender.
const GEMINI_VOICE_FOR_SPEAKER: Record<string, string> = {
  priya: "Kore",
  neha: "Aoede",
  ishita: "Leda",
  suhani: "Zephyr",
  shubh: "Puck",
  ratan: "Charon",
};

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesizeSpeechWithGemini(
  text: string,
  speaker: string
): Promise<{ wavBase64: string; model: string }> {
  let lastError: any;
  for (const model of orderByAvailability(geminiTtsModels())) {
    if ((modelCooldownUntil.get(model) || 0) > Date.now()) continue;
    try {
      const response = await getClient().models.generateContent({
        model,
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: GEMINI_VOICE_FOR_SPEAKER[speaker] || "Kore",
              },
            },
          },
          abortSignal: AbortSignal.timeout(60 * 1000),
        },
      });
      const part = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p?.inlineData?.data
      );
      if (!part?.inlineData?.data) throw new Error(`${model} returned no audio.`);
      const audio = Buffer.from(part.inlineData.data, "base64");
      if (audio.subarray(0, 4).toString() === "RIFF") {
        return { wavBase64: audio.toString("base64"), model };
      }
      // Raw 16-bit PCM, e.g. "audio/L16;codec=pcm;rate=24000".
      const rate = Number(String(part.inlineData.mimeType || "").match(/rate=(\d+)/)?.[1]) || 24000;
      return { wavBase64: pcmToWav(audio, rate).toString("base64"), model };
    } catch (error: any) {
      lastError = error;
      const cooldown = cooldownAfterRefusal(errorStatus(error), String(error?.message || ""));
      if (cooldown !== null) modelCooldownUntil.set(model, Date.now() + cooldown);
      console.warn(`[GEMINI-TTS] ${model} failed: ${String(error?.message || error).slice(0, 160)}`);
    }
  }
  throw lastError || new Error("No Gemini TTS model is available.");
}
