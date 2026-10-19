// Textbook processing and publishing one short request at a time, for hosts
// where a request is small and short-lived and nothing is kept between
// requests (Vercel: 4.5 MB per request/response, 300 s per function). The
// browser keeps the book and drives it, server routes in server.ts
// ("TEXTBOOK OCR, ONE STEP PER REQUEST"):
//   1. the PDF is cut into few-page pieces here (pdf-lib) and each piece is
//      read on the server (/api/ocr/steps/pages): its text and pictures;
//   2. the page text goes back with every picture replaced by a short
//      reference ("ref:12"), so the AI steps stay small: structure ->
//      cleanup -> analyze (one batch per request) -> finish;
//   3. the references are swapped back for the pictures here.
// Publishing works the same way: prepare, then each chapter's text (its quiz
// is written on the server), then its pictures a few at a time.
import type { TextbookAnalysis, TextbookChapterAnalysis, TextbookChapterImage } from '../types';
import { authHeaders } from './backendApi';

// Under Vercel's 4.5 MB request limit, with room for headers.
const MAX_PIECE_BYTES = 4_000_000;
const MAX_JSON_BYTES = 4_300_000;
const PAGES_PER_PIECE = 4;
const PIECE_CONCURRENCY = 3;
const IMAGE_BATCH_BYTES = 3_000_000;
// A picture on this many pages is a logo or page decoration, not content.
const REPEATED_IMAGE_PAGES = 3;

export interface StepProgress {
  progress: number;
  stage: string;
}
type OnProgress = (update: StepProgress) => void;

class StepError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A sleeping, restarting or briefly overloaded server answers 429/502/503/504
// or drops the connection: wait and send the same step again.
async function sendStep<T>(url: string, body: BodyInit, contentType: string, onRetry?: (attempt: number) => void): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      onRetry?.(attempt);
      await sleep(Math.min(20_000, 3000 * 2 ** (attempt - 1)));
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': contentType, ...(await authHeaders()) },
        body,
      });
    } catch (error: any) {
      lastError = new StepError(error?.message || 'The server could not be reached.', 0);
      continue;
    }
    if ([429, 502, 503, 504].includes(response.status)) {
      lastError = new StepError(`The server is busy (HTTP ${response.status}).`, response.status);
      continue;
    }
    if (response.status === 413) {
      throw new StepError('This part of the book is too large to send in one request.', 413);
    }
    const data: any = await response.json().catch(() => null);
    if (!data) {
      lastError = new StepError(`The server returned an invalid response (HTTP ${response.status}).`, response.status);
      continue;
    }
    if (!response.ok || data.success === false) {
      throw new StepError(data.error || `Request failed (HTTP ${response.status}).`, response.status);
    }
    return data as T;
  }
  throw lastError || new Error('The server could not be reached.');
}

function sendJson<T>(url: string, payload: unknown, onRetry?: (attempt: number) => void): Promise<T> {
  const json = JSON.stringify(payload);
  if (new Blob([json]).size > MAX_JSON_BYTES) {
    throw new Error('This book is too large to process in one go. Split the PDF into two or three parts and upload each one.');
  }
  return sendStep<T>(url, json, 'application/json', onRetry);
}

/** Whether this server wants textbooks processed step by step. */
export async function textbookStepsEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/ocr/steps/config', { headers: await authHeaders(), cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data?.stepwise);
  } catch {
    return false;
  }
}

/* ------------------------------ reading ------------------------------ */

interface OcrBlock {
  kind: string;
  text: string;
  box?: number[];
}
interface OcrPage {
  pageNumber: number;
  blocks: OcrBlock[];
}
interface PiecesResponse {
  totalPages: number;
  pages: OcrPage[];
  images: TextbookChapterImage[];
  droppedImages: number;
  failedPages: number[];
  models: string[];
}

const isPdfFile = (fileName: string, mimeType: string) => mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);

const DAMAGED_PDF =
  'This PDF file is damaged and could not be opened. Open it on your computer and save or print it again as a new PDF, then upload that copy.';

interface PieceSource {
  totalPages: number | null;
  /** The bytes of pages [first, first+count) as one small PDF. */
  piece(first: number, count: number): Promise<Uint8Array>;
}

async function openPieceSource(bytes: Uint8Array, fileName: string, mimeType: string): Promise<PieceSource> {
  if (!isPdfFile(fileName, mimeType)) {
    return { totalPages: 1, piece: async () => bytes };
  }
  const { PDFDocument } = await import('pdf-lib');
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const totalPages = pdf.getPageCount();
    if (totalPages === 0) throw new Error('The uploaded PDF has no pages.');
    const piece = async (first: number, count: number) => {
      const target = await PDFDocument.create();
      const pages = await target.copyPages(pdf, Array.from({ length: count }, (_, i) => first - 1 + i));
      pages.forEach((page) => target.addPage(page));
      return target.save();
    };
    // Proves the page tree can be copied before relying on it.
    await piece(1, 1);
    return { totalPages, piece };
  } catch (error: any) {
    if (/no pages/.test(String(error?.message))) throw error;
    // pdf-lib can't split some damaged files; the server's pdf.js can still
    // read a small one whole.
    if (bytes.length <= MAX_PIECE_BYTES) return { totalPages: null, piece: async () => bytes };
    throw new Error(DAMAGED_PDF);
  }
}

export interface StepsAnalysisResult {
  analysis: TextbookAnalysis;
  ocr: { engine: string; failedPages: number[] };
}

export async function analyzeTextbookInSteps(
  file: Blob,
  fileName: string,
  mimeType: string,
  language: string,
  onProgress: OnProgress
): Promise<StepsAnalysisResult> {
  onProgress({ progress: 2, stage: 'Opening the book...' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const source = await openPieceSource(bytes, fileName, mimeType);
  const pieceMime = isPdfFile(fileName, mimeType) ? 'application/pdf' : mimeType || 'image/jpeg';
  if (!isPdfFile(fileName, mimeType) && bytes.length > MAX_PIECE_BYTES) {
    throw new Error('This picture is too large to send. Use a smaller photo, or a PDF of the book.');
  }

  const pages: OcrPage[] = [];
  const images: TextbookChapterImage[] = [];
  const failedPages: number[] = [];
  const models = new Set<string>();
  let droppedImages = 0;
  let totalPages = source.totalPages ?? 0;
  let donePages = 0;
  const report = (stage?: string) =>
    onProgress({
      progress: Math.round(4 + (donePages / Math.max(totalPages, 1)) * 44),
      stage: stage || `Reading pages: ${donePages} of ${totalPages || '?'} done...`,
    });

  const readPiece = async (first: number, count: number): Promise<void> => {
    let data: Uint8Array;
    try {
      data = await source.piece(first, count);
    } catch {
      data = new Uint8Array();
    }
    if (data.length > MAX_PIECE_BYTES || data.length === 0) {
      if (count > 1) {
        for (let n = first; n < first + count; n++) await readPiece(n, 1);
        return;
      }
      console.warn(`[OCR steps] page ${first} is ${Math.round(data.length / 1e6)} MB, too large to send.`);
      failedPages.push(first);
      donePages += 1;
      report();
      return;
    }
    const query = new URLSearchParams({ firstPage: String(first), language, fileName });
    try {
      const result = await sendStep<PiecesResponse>(
        `/api/ocr/steps/pages?${query}`,
        new Blob([data], { type: pieceMime }),
        pieceMime,
        (attempt) => report(`Reading pages ${first}-${first + count - 1}: the server is busy, trying again (${attempt})...`)
      );
      if (!source.totalPages) totalPages = result.totalPages;
      pages.push(...result.pages);
      images.push(...result.images);
      failedPages.push(...result.failedPages);
      result.models.forEach((m) => models.add(m));
      droppedImages += result.droppedImages || 0;
      donePages += source.totalPages ? count : result.totalPages;
      report();
    } catch (error: any) {
      // Signed out / not allowed: every other page would fail the same way.
      if (error instanceof StepError && [401, 403].includes(error.status)) throw error;
      // A whole file that could not be split: nothing smaller to try.
      if (!source.totalPages) throw error;
      if (count > 1) {
        for (let n = first; n < first + count; n++) await readPiece(n, 1);
        return;
      }
      console.warn(`[OCR steps] page ${first} failed: ${error?.message || error}`);
      failedPages.push(first);
      donePages += 1;
      report();
    }
  };

  report('Reading pages...');
  if (!source.totalPages) {
    await readPiece(1, 1);
  } else {
    const starts: number[] = [];
    for (let first = 1; first <= totalPages; first += PAGES_PER_PIECE) starts.push(first);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PIECE_CONCURRENCY, starts.length) }, async () => {
        while (next < starts.length) {
          const first = starts[next++];
          await readPiece(first, Math.min(PAGES_PER_PIECE, totalPages - first + 1));
        }
      })
    );
  }
  if (pages.length === 0) {
    throw new Error('No page of this document could be read. Check the file and try again.');
  }
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  failedPages.sort((a, b) => a - b);
  if (droppedImages) console.warn(`[OCR steps] ${droppedImages} picture(s) were too large to bring back.`);

  // Pictures stay here; the AI steps get a short reference to each.
  const pagesOfPicture = new Map<string, Set<number>>();
  images.forEach((img) => {
    const set = pagesOfPicture.get(img.base64) || new Set<number>();
    set.add(Number(img.pageNumber));
    pagesOfPicture.set(img.base64, set);
  });
  const pictures = new Map<string, TextbookChapterImage>();
  const imageRefs = images
    .filter((img) => (pagesOfPicture.get(img.base64)?.size || 0) < REPEATED_IMAGE_PAGES)
    .map((img, i) => {
      const ref = `ref:${i}`;
      pictures.set(ref, img);
      return { ref, pageNumber: img.pageNumber, mimeType: img.mimeType };
    });

  const retry = (what: string) => (attempt: number) =>
    onProgress({ progress: 50, stage: `${what}: the server is busy, trying again (${attempt})...` });

  onProgress({ progress: 50, stage: `AI is reading the book's ${pages.length} pages to find its real chapters and subjects...` });
  const structured = await sendJson<{
    chapters: any[];
    bookStructure: any;
    rawSectionCount: number;
    skippedSectionCount: number;
  }>('/api/ocr/steps/structure', { fileName, language, pages, images: imageRefs }, retry('Finding chapters'));

  onProgress({ progress: 55, stage: `Cleaning up ${structured.chapters.length} chapters: removing page labels, section pages and notes...` });
  const { chapters } = await sendJson<{ chapters: any[] }>(
    '/api/ocr/steps/cleanup',
    { chapters: structured.chapters },
    retry('Cleaning up')
  );

  const results: any[] = [];
  let batchCount = 1;
  for (let batch = 0; batch < batchCount; batch++) {
    onProgress({
      progress: Math.round(58 + (batch / Math.max(batchCount, 1)) * 36),
      stage: `AI analyzing chapters (part ${batch + 1} of ${batchCount === 1 && batch === 0 ? '…' : batchCount})...`,
    });
    const step = await sendJson<{ batchCount: number; results: any[] }>(
      '/api/ocr/steps/analyze',
      { chapters, batch },
      retry('Analyzing chapters')
    );
    batchCount = step.batchCount;
    results.push(...step.results);
  }

  onProgress({ progress: 96, stage: 'Putting the book together...' });
  const finished = await sendJson<{ analysis: TextbookAnalysis; ocr: { engine: string; failedPages: number[] } }>(
    '/api/ocr/steps/finish',
    {
      fileName,
      language,
      chapters,
      results,
      bookStructure: structured.bookStructure,
      rawSectionCount: structured.rawSectionCount,
      skippedSectionCount: structured.skippedSectionCount,
      failedPages,
      totalPages,
      models: [...models],
    },
    retry('Finishing')
  );

  const analysis = finished.analysis;
  analysis.chapters = (analysis.chapters || []).map((chapter: TextbookChapterAnalysis) => ({
    ...chapter,
    images: (chapter.images || [])
      .map((img) => {
        const picture = pictures.get(img.base64);
        return picture ? { ...picture, caption: img.caption || picture.caption } : img;
      })
      .filter((img) => img.base64 && !img.base64.startsWith('ref:')),
  }));
  return { analysis, ocr: { engine: finished.ocr?.engine || 'Gemini', failedPages } };
}

/* ----------------------------- publishing ----------------------------- */

/** Sends a published chapter's pictures a few at a time. */
export async function addReadingImages(readingId: string, images: TextbookChapterImage[]): Promise<number> {
  let added = 0;
  let batch: TextbookChapterImage[] = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const result = await sendJson<{ added: number }>(`/api/readings/${encodeURIComponent(readingId)}/images`, { images: batch });
    added += result.added;
    batch = [];
    size = 0;
  };
  for (const img of images) {
    if (!img?.base64 || img.base64.startsWith('ref:')) continue;
    if (size + img.base64.length > IMAGE_BATCH_BYTES) await flush();
    batch.push(img);
    size += img.base64.length;
  }
  await flush();
  return added;
}

export interface BookPublishResult {
  success: boolean;
  bookId: string;
  published: number;
  withoutQuiz: number;
  total: number;
  results: Array<{ id?: string; quizGenerated?: boolean; error?: string }>;
}

export async function publishBookInSteps(
  chapters: Array<TextbookChapterAnalysis & { subject: string }>,
  grade: string,
  language: string,
  bookTitle: string,
  onProgress?: (done: number, total: number) => void
): Promise<BookPublishResult> {
  // Pictures stay here while the server splits long chapters into parts.
  const pictures = new Map<string, TextbookChapterImage>();
  const withRefs = chapters.map((chapter, c) => ({
    ...chapter,
    images: (chapter.images || []).map((img, i) => {
      const ref = `ref:${c}:${i}`;
      pictures.set(ref, img);
      return { ...img, base64: ref };
    }),
  }));
  const prepared = await sendJson<{ bookId: string; chapters: any[] }>('/api/readings/publish-book/prepare', {
    grade,
    chapters: withRefs,
  });
  const total = prepared.chapters.length;
  const results: BookPublishResult['results'] = new Array(total);
  let next = 0;
  let done = 0;
  onProgress?.(0, total);
  // Two at a time: each chapter waits on its quiz being written.
  await Promise.all(
    Array.from({ length: Math.min(2, total) }, async () => {
      while (next < total) {
        const index = next++;
        const chapter = prepared.chapters[index];
        try {
          const saved = await sendJson<{ id: string; quizGenerated: boolean }>('/api/readings/publish-book/chapter', {
            bookId: prepared.bookId,
            grade,
            language,
            bookTitle,
            chapterOrder: index + 1,
            chapterCount: total,
            chapter: { ...chapter, images: [] },
          });
          const chapterPictures = (Array.isArray(chapter.images) ? chapter.images : [])
            .map((img: any) => {
              const picture = pictures.get(img?.base64);
              return picture ? { ...picture, pageNumber: img.pageNumber ?? picture.pageNumber, caption: img.caption || picture.caption } : null;
            })
            .filter(Boolean) as TextbookChapterImage[];
          try {
            await addReadingImages(saved.id, chapterPictures);
          } catch (error: any) {
            // The text is published; a picture upload failing must not hide that.
            console.warn(`Pictures for chapter ${index + 1} could not be added:`, error?.message || error);
          }
          results[index] = { id: saved.id, quizGenerated: saved.quizGenerated };
        } catch (error: any) {
          results[index] = { error: error?.message || 'Failed to publish chapter.' };
        }
        done += 1;
        onProgress?.(done, total);
      }
    })
  );
  const published = results.filter((r) => r?.id).length;
  if (published === 0) {
    throw new Error(results.find((r) => r?.error)?.error || 'No chapter could be published.');
  }
  return {
    success: true,
    bookId: prepared.bookId,
    published,
    withoutQuiz: results.filter((r) => r?.id && !r.quizGenerated).length,
    total,
    results,
  };
}
