// Cloud (Gemini) fallback for the two local AI services: text generation
// normally served by Ollama, and textbook OCR normally served by the
// Docling/EasyOCR service (backend/ocr). Both local services need 1-3 GB of
// RAM, so on small hosts (e.g. Render's 512 MB free tier) they are asleep,
// crash-looping, or absent; this keeps the whole textbook pipeline working
// by producing exactly the shapes the local services would have returned.
//
// Every process.env read is lazy: server.ts calls dotenv.config() after its
// imports are evaluated, so module-level reads would miss a local .env.

import { cropPdfFigures, type FigureBox } from "./pdfFigures";
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

// Measured on scanned Telugu pages: 3.5-flash transcribes most faithfully
// but is often overloaded (503); 3.5-flash-lite is always available and
// fast but occasionally normalizes a colloquial spelling; 3.8-flash was
// almost always overloaded. The chain falls through on 503/404/429.
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
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
const OCR_CONCURRENCY = 3;
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
  firstPageNumber: number
): string {
  const languageName = LANGUAGE_NAMES[language] || "an Indian language";
  const range =
    pageCount === 1
      ? `page ${firstPageNumber}`
      : `pages ${firstPageNumber}-${firstPageNumber + pageCount - 1}`;
  return `You are a precise OCR engine for Indian primary-school textbooks.
The attached document is ${range} of a textbook (${pageCount} page${pageCount === 1 ? "" : "s"}). Its main language is ${languageName}; it may also contain English.

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

interface OcrChunk {
  firstPageNumber: number;
  pageCount: number;
  data: Buffer;
  mimeType: string;
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
            {
              inlineData: {
                mimeType: chunk.mimeType,
                data: chunk.data.toString("base64"),
              },
            },
            {
              text: buildOcrPrompt(
                language,
                chunk.pageCount,
                chunk.firstPageNumber
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
  let chunks: OcrChunk[];
  let pdf: PDFDocument | null = null;

  if (isPdf) {
    // A standalone copy: pdf-lib can misread a Buffer that is a view into
    // Node's shared allocation pool (non-zero byteOffset).
    pdf = await PDFDocument.load(new Uint8Array(binaryData), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    totalPages = pdf.getPageCount();
    if (totalPages === 0) {
      throw new Error("The uploaded PDF has no pages.");
    }
    try {
      imagesByPage = extractPdfImages(pdf);
    } catch (error: any) {
      console.warn(
        `[GEMINI-OCR] Picture extraction skipped: ${error?.message || error}`
      );
    }
    chunks = [];
    for (let start = 0; start < totalPages; start += PAGES_PER_REQUEST) {
      const indices = Array.from(
        { length: Math.min(PAGES_PER_REQUEST, totalPages - start) },
        (_, offset) => start + offset
      );
      chunks.push({
        firstPageNumber: start + 1,
        pageCount: indices.length,
        data: await pdfPagesToBuffer(pdf, indices),
        mimeType: "application/pdf",
      });
    }
  } else {
    chunks = [
      {
        firstPageNumber: 1,
        pageCount: 1,
        data: binaryData,
        mimeType: mimeType || "image/jpeg",
      },
    ];
  }

  let completedPages = 0;
  const failedPages: number[] = [];
  const modelsUsed = new Set<string>();
  onProgress(0, totalPages);

  const runChunk = async (chunk: OcrChunk): Promise<OcrPage[]> => {
    const tooBig = chunk.data.length > MAX_INLINE_REQUEST_BYTES;
    if (!tooBig) {
      try {
        const { pages, model } = await ocrChunkWithGemini(chunk, language);
        modelsUsed.add(model);
        completedPages += chunk.pageCount;
        onProgress(completedPages, totalPages);
        return pages;
      } catch (error: any) {
        if (chunk.pageCount === 1 || !pdf) {
          console.warn(
            `[GEMINI-OCR] Page ${chunk.firstPageNumber} failed: ${error?.message || error}`
          );
          failedPages.push(chunk.firstPageNumber);
          completedPages += 1;
          onProgress(completedPages, totalPages);
          return [];
        }
        console.warn(
          `[GEMINI-OCR] Pages ${chunk.firstPageNumber}-${chunk.firstPageNumber + chunk.pageCount - 1} failed (${error?.message || error}); retrying one page at a time.`
        );
      }
    } else if (chunk.pageCount === 1 || !pdf) {
      failedPages.push(chunk.firstPageNumber);
      completedPages += 1;
      onProgress(completedPages, totalPages);
      return [];
    }
    const singles: OcrPage[] = [];
    for (let offset = 0; offset < chunk.pageCount; offset++) {
      const pageIndex = chunk.firstPageNumber - 1 + offset;
      singles.push(
        ...(await runChunk({
          firstPageNumber: pageIndex + 1,
          pageCount: 1,
          data: await pdfPagesToBuffer(pdf!, [pageIndex]),
          mimeType: "application/pdf",
        }))
      );
    }
    return singles;
  };

  const pageGroups = await mapWithConcurrency(chunks, OCR_CONCURRENCY, runChunk);
  const pages = pageGroups.flat().sort((a, b) => a.pageNumber - b.pageNumber);

  if (failedPages.length >= totalPages) {
    throw new Error(
      "Gemini OCR could not read any page of this document. Check GEMINI_API_KEY and the server logs."
    );
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
        const cropped = await cropPdfFigures(new Uint8Array(binaryData), figures);
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
