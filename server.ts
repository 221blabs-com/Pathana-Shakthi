import express from "express";

import path from "path";

import { createServer as createViteServer } from "vite";

import { GoogleGenAI, Modality } from "@google/genai";

import dotenv from "dotenv";

import firebaseRouter from "./server/firebaseRoutes";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);

const OCR\_SERVICE\_URL =

  process.env.OCR\_SERVICE\_URL || "http\://127.0.0.1:8001";

const OLLAMA\_BASE\_URL =

  process.env.OLLAMA\_BASE\_URL || "http\://127.0.0.1:11434";

const OLLAMA\_MODEL =

  process.env.OLLAMA\_MODEL || "llama3.1\:latest";

/\* =========================================================

   MIDDLEWARE

\========================================================= \*/

app.use(

  express.json({

    limit: "100mb",

  })

);

app.use(

  express.urlencoded({

    limit: "100mb",

    extended: true,

  })

);

/\*

 \* IMPORTANT:

 \* Firebase authentication, curriculum, lessons,

 \* reading sessions and analytics are handled here.

 \*/

app.use("/api", firebaseRouter);

/\* =========================================================

   AI CONFIGURATION

\========================================================= \*/

/\*

 \* Ollama handles all text-generation tasks locally:

 \*   - textbook analysis

 \*   - Read-Along story generation

 \*   - pronunciation evaluation

 \*

 \* Gemini is kept only for the existing TTS endpoint because

 \* llama3.1\:latest does not generate audio.

 \*/

function getGeminiClient(): GoogleGenAI {

  const apiKey = process.env.GEMINI\_API\_KEY?.trim();

  if (!apiKey) {

    throw new Error(

      "GEMINI\_API\_KEY is not configured. It is only required for the TTS endpoint."

    );

  }

  return new GoogleGenAI({

    apiKey,

    httpOptions: {

      headers: {

        "User-Agent": "aistudio-build",

      },

    },

  });

}

function getOllamaUrl(endpoint: string): string {

  return \`${OLLAMA\_BASE\_URL.replace(/**\\/* =========================================================
   TEXTBOOK JOB PROCESSING

   Pipeline:
   PDF/Image
      ↓
   PaddleOCR
      ↓
   Conservative OCR cleanup
      ↓
   Chapter / lesson detection
      ↓
   Manageable textbook chunks
      ↓
   Qwen 2.5 3B per chunk
      ↓
   Backend combines results
      ↓
   Existing TextbookAnalysis-compatible response

   The browser still receives a job id immediately and polls it.
========================================================= */

type TextbookJobStatus =
  | "queued"
  | "ocr"
  | "cleaning"
  | "detecting"
  | "ai"
  | "completed"
  | "failed";

interface TextbookJob {
  id: string;
  status: TextbookJobStatus;
  progress: number;
  stageMessage: string;
  fileName: string;
  createdAt: number;
  result?: any;
  error?: string;
}

interface TextbookChunk {
  chapterNumber: string;
  chapterTitle: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

interface ChapterAnalysis {
  chapterNumber: string;
  chapterTitle: string;
  primaryTopic: string;
  summary: string;
  importantConcepts: string[];
  keyVocabulary: Array<{
    word: string;
    meaning: string;
    phonetic: string;
  }>;
  learningObjectives: string[];
  suggestedStoryThemes: string[];
}

const textbookJobs = new Map<string, TextbookJob>();
const TEXTBOOK_JOB_TTL_MS = 30 * 60 * 1000;

function createJob(fileName: string): TextbookJob {
  const id = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const job: TextbookJob = {
    id,
    status: "queued",
    progress: 0,
    stageMessage: "Queued for OCR processing...",
    fileName,
    createdAt: Date.now(),
  };

  textbookJobs.set(id, job);
  return job;
}

function updateJob(
  jobId: string,
  patch: Partial<TextbookJob>
): TextbookJob | undefined {
  const job = textbookJobs.get(jobId);
  if (!job) return undefined;

  Object.assign(job, patch);
  return job;
}

function cleanupOldTextbookJobs() {
  const cutoff = Date.now() - TEXTBOOK_JOB_TTL_MS;

  for (const [id, job] of textbookJobs.entries()) {
    if (job.createdAt < cutoff) {
      textbookJobs.delete(id);
    }
  }
}

setInterval(cleanupOldTextbookJobs, 5 * 60 * 1000).unref();

function cleanOcrText(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeChapterLabel(
  value: string,
  fallback: number
): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) return `Chapter ${fallback}`;

  return text
    .replace(/^chapter\s*[:.\-]?\s*/i, "Chapter ")
    .trim();
}

function looksLikeChapterHeading(line: string): boolean {
  const value = line.replace(/\s+/g, " ").trim();

  if (!value || value.length > 160) return false;

  if (
    /^(chapter|unit|lesson|part|section)\s*[\dIVX]+(?:\s*[:.\-]\s*|\s+).+/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /^(chapter|unit|lesson|part|section)\s*[:.\-]?\s*\d+\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (
    /^(activity|poem|story|reading|exercise)\s*[\dIVX]+\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (/^\d{1,2}\s*[\).:-]\s+[A-Z][^\n]{2,120}$/.test(value)) {
    return true;
  }

  return false;
}

function extractChapterNumberAndTitle(
  heading: string,
  fallbackNumber: number
): { chapterNumber: string; chapterTitle: string } {
  const value = String(heading || "")
    .replace(/\s+/g, " ")
    .trim();

  const explicitMatch = value.match(
    /^(chapter|unit|lesson|part|section)\s*([0-9IVX]+)?\s*[:.\-]?\s*(.*)$/i
  );

  if (explicitMatch) {
    const label = explicitMatch[1];
    const number = explicitMatch[2] || String(fallbackNumber);
    const title =
      explicitMatch[3]?.trim() || `${label} ${number}`;

    return {
      chapterNumber: `${label} ${number}`,
      chapterTitle: title,
    };
  }

  const numberedMatch = value.match(
    /^(\d{1,2})\s*[\).:-]\s*(.+)$/
  );

  if (numberedMatch) {
    return {
      chapterNumber: `Chapter ${numberedMatch[1]}`,
      chapterTitle: numberedMatch[2].trim(),
    };
  }

  return {
    chapterNumber: `Chapter ${fallbackNumber}`,
    chapterTitle: value || `Chapter ${fallbackNumber}`,
  };
}

function detectTextbookChunks(
  cleanedText: string
): TextbookChunk[] {
  const lines = cleanedText.split("\n");

  const headings: Array<{
    lineIndex: number;
    chapterNumber: string;
    chapterTitle: string;
  }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!looksLikeChapterHeading(line)) continue;

    const parsed = extractChapterNumberAndTitle(
      line,
      headings.length + 1
    );

    headings.push({
      lineIndex: i,
      chapterNumber: normalizeChapterLabel(
        parsed.chapterNumber,
        headings.length + 1
      ),
      chapterTitle: parsed.chapterTitle,
    });
  }

  const chunks: TextbookChunk[] = [];

  if (headings.length > 0) {
    for (let i = 0; i < headings.length; i += 1) {
      const current = headings[i];
      const next = headings[i + 1];

      const sectionLines = lines.slice(
        current.lineIndex,
        next ? next.lineIndex : lines.length
      );

      const text = sectionLines.join("\n").trim();

      if (text.length < 80) continue;

      chunks.push({
        chapterNumber: current.chapterNumber,
        chapterTitle: current.chapterTitle,
        text,
        startIndex: current.lineIndex,
        endIndex: next
          ? next.lineIndex - 1
          : lines.length - 1,
      });
    }
  }

  if (chunks.length === 0) {
    const MAX_CHARS = 9000;
    const MIN_CHARS = 3500;

    let currentText = "";
    let chunkIndex = 1;
    let startLine = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const candidate = currentText
        ? `${currentText}\n${lines[i]}`
        : lines[i];

      if (
        candidate.length > MAX_CHARS &&
        currentText.length >= MIN_CHARS
      ) {
        chunks.push({
          chapterNumber: `Chapter ${chunkIndex}`,
          chapterTitle: `Textbook Section ${chunkIndex}`,
          text: currentText.trim(),
          startIndex: startLine,
          endIndex: i - 1,
        });

        chunkIndex += 1;
        currentText = lines[i];
        startLine = i;
      } else {
        currentText = candidate;
      }
    }

    if (currentText.trim()) {
      chunks.push({
        chapterNumber: `Chapter ${chunkIndex}`,
        chapterTitle: `Textbook Section ${chunkIndex}`,
        text: currentText.trim(),
        startIndex: startLine,
        endIndex: lines.length - 1,
      });
    }
  }

  return chunks
    .filter((chunk) => chunk.text.length >= 80)
    .slice(0, 20);
}

function cleanStringArray(
  value: any,
  maxItems: number
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeVocabulary(
  value: any
): Array<{
  word: string;
  meaning: string;
  phonetic: string;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          word: item.trim(),
          meaning: "",
          phonetic: "",
        };
      }

      return {
        word: String(item?.word || "").trim(),
        meaning: String(item?.meaning || "").trim(),
        phonetic: String(
          item?.phonetic ||
            item?.pronunciation ||
            ""
        ).trim(),
      };
    })
    .filter((item) => item.word)
    .slice(0, 8);
}

function normalizeChapterAnalysis(
  raw: any,
  chunk: TextbookChunk
): ChapterAnalysis {
  return {
    chapterNumber:
      String(
        raw?.chapterNumber || chunk.chapterNumber
      ).trim() || chunk.chapterNumber,

    chapterTitle:
      String(
        raw?.chapterTitle || chunk.chapterTitle
      ).trim() || chunk.chapterTitle,

    primaryTopic:
      String(raw?.primaryTopic || "").trim() ||
      chunk.chapterTitle,

    summary:
      String(raw?.summary || "").trim() ||
      "No summary was generated for this section.",

    importantConcepts: cleanStringArray(
      raw?.importantConcepts,
      5
    ),

    keyVocabulary: normalizeVocabulary(
      raw?.keyVocabulary
    ),

    learningObjectives: cleanStringArray(
      raw?.learningObjectives,
      4
    ),

    suggestedStoryThemes: cleanStringArray(
      raw?.suggestedStoryThemes,
      3
    ),
  };
}

function combineTextbookAnalysis(
  fileName: string,
  extractedText: string,
  chunks: TextbookChunk[],
  chapterAnalyses: ChapterAnalysis[],
  bookMetadata: {
    subject: string;
    grade: string;
    primaryLanguage: string;
    bookTitle: string;
    overallSummary: string;
    importantEducationalContext: string[];
    teacherNotes: string[];
  }
): any {
  const chapters = chapterAnalyses.map(
    (chapter, index) => ({
      ...chapter,
      chapterNumber:
        chapter.chapterNumber ||
        chunks[index]?.chapterNumber ||
        `Chapter ${index + 1}`,
      chapterTitle:
        chapter.chapterTitle ||
        chunks[index]?.chapterTitle ||
        `Chapter ${index + 1}`,
    })
  );

  const firstChapter = chapters[0] || {
    chapterNumber: "Chapter 1",
    chapterTitle:
      bookMetadata.bookTitle || "Textbook Analysis",
    summary:
      bookMetadata.overallSummary ||
      "No summary was generated.",
    keyVocabulary: [],
    learningObjectives: [],
    suggestedStoryThemes: [],
  };

  return {
    subject: bookMetadata.subject || "Unknown",
    grade: bookMetadata.grade || "Unknown",
    chapterNumber:
      firstChapter.chapterNumber || "Chapter 1",
    chapterTitle:
      firstChapter.chapterTitle ||
      bookMetadata.bookTitle ||
      "Textbook Analysis",
    primaryLanguage:
      bookMetadata.primaryLanguage || "Unknown",
    extractedText,

    summary:
      firstChapter.summary ||
      bookMetadata.overallSummary ||
      "No summary was generated.",

    keyVocabulary:
      Array.isArray(firstChapter.keyVocabulary)
        ? firstChapter.keyVocabulary.slice(0, 8)
        : [],

    learningObjectives:
      Array.isArray(firstChapter.learningObjectives)
        ? firstChapter.learningObjectives.slice(0, 5)
        : [],

    suggestedStoryThemes:
      Array.isArray(firstChapter.suggestedStoryThemes)
        ? firstChapter.suggestedStoryThemes.slice(0, 5)
        : [],

    bookTitle: bookMetadata.bookTitle || "",
    overallSummary: bookMetadata.overallSummary || "",
    chapters,

    importantEducationalContext:
      bookMetadata.importantEducationalContext,

    teacherNotes: bookMetadata.teacherNotes,

    processing: {
      strategy: "ocr-cleaning-chunked-qwen",
      model: OLLAMA_MODEL,
      chunkCount: chunks.length,
    },

    fileName,
  };
}

async function analyzeBookMetadata(
  fileName: string,
  extractedText: string
): Promise<{
  subject: string;
  grade: string;
  primaryLanguage: string;
  bookTitle: string;
  overallSummary: string;
  importantEducationalContext: string[];
  teacherNotes: string[];
}> {
  const sampleSize = 4500;

  const sample =
    extractedText.length <= sampleSize * 2
      ? extractedText
      : `${extractedText.slice(
          0,
          sampleSize
        )}\n\n[...middle omitted...]\n\n${extractedText.slice(
          -sampleSize
        )}`;

  const prompt = `
Identify high-level metadata for this primary-school textbook.

FILE: ${fileName || "Unknown textbook"}

TEXT SAMPLE:
---------------- BEGIN ----------------
${sample}
----------------- END -----------------

Rules:
- Use only information supported by the supplied text.
- Do not invent a subject, class, language, or title.
- Ignore publisher information, page numbers, copyright text and OCR noise.
- Keep the overall summary concise.
- Return ONLY valid JSON.

JSON:
{
  "subject": "string",
  "grade": "Class 1 | Class 2 | Class 3 | Class 4 | Class 5 | Unknown",
  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",
  "bookTitle": "string",
  "overallSummary": "string",
  "importantEducationalContext": ["string"],
  "teacherNotes": ["string"]
}
`;

  const result = await generateWithOllama(
    prompt,
    {
      temperature: 0.1,
      numCtx: 4096,
      timeoutMs: 3 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 350,
    }
  );

  const raw = extractJsonObject(result.text);

  return {
    subject: String(
      raw?.subject || "Unknown"
    ).trim(),

    grade: String(
      raw?.grade || "Unknown"
    ).trim(),

    primaryLanguage: String(
      raw?.primaryLanguage || "Unknown"
    ).trim(),

    bookTitle: String(
      raw?.bookTitle || ""
    ).trim(),

    overallSummary: String(
      raw?.overallSummary || ""
    ).trim(),

    importantEducationalContext:
      cleanStringArray(
        raw?.importantEducationalContext,
        6
      ),

    teacherNotes: cleanStringArray(
      raw?.teacherNotes,
      6
    ),
  };
}

async function analyzeChapterChunk(
  chunk: TextbookChunk,
  index: number,
  total: number
): Promise<ChapterAnalysis> {
  const prompt = `
You are an expert primary-school curriculum analyst for Indian education.

Analyze ONLY this textbook section.

SECTION:
${chunk.chapterNumber}
${chunk.chapterTitle}

TEXT:
---------------- BEGIN ----------------
${chunk.text}
----------------- END -----------------

Rules:
- Use only information supported by this section.
- Do not invent facts.
- Ignore page numbers, repeated headers/footers, copyright notices and OCR noise.
- Preserve the educational meaning of the source.
- Keep the summary concise and child-appropriate.
- Return at most 5 important concepts.
- Return at most 8 vocabulary words.
- Return at most 4 learning objectives.
- Return at most 3 story themes.
- Do not repeat the source text.
- Return ONLY valid JSON.

JSON:
{
  "chapterNumber": "${chunk.chapterNumber}",
  "chapterTitle": "${chunk.chapterTitle}",
  "primaryTopic": "string",
  "summary": "string",
  "importantConcepts": ["string"],
  "keyVocabulary": [
    {
      "word": "string",
      "meaning": "string",
      "phonetic": "string"
    }
  ],
  "learningObjectives": ["string"],
  "suggestedStoryThemes": ["string"]
}
`;

  console.log(
    `[OLLAMA] Chapter ${index + 1}/${total}: ${chunk.chapterNumber} - ${chunk.chapterTitle}`
  );

  const result = await generateWithOllama(
    prompt,
    {
      temperature: 0.1,
      numCtx: 4096,
      timeoutMs: 5 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 450,
    }
  );

  const raw = extractJsonObject(result.text);

  return normalizeChapterAnalysis(
    raw,
    chunk
  );
}

async function processTextbookJob(
  jobId: string,
  params: {
    fileData: string;
    mimeType: string;
    fileName: string;
  }
): Promise<void> {
  const {
    fileData,
    mimeType,
    fileName,
  } = params;

  try {
    updateJob(jobId, {
      status: "ocr",
      progress: 5,
      stageMessage:
        "Reading every page with PaddleOCR...",
    });

    console.log(
      `[OCR] Job ${jobId}: Processing ${fileName}`
    );

    console.log(
      `[OCR] Job ${jobId}: Sending document to PaddleOCR at ${OCR_SERVICE_URL}`
    );

    const binaryData = Buffer.from(
      cleanBase64(fileData),
      "base64"
    );

    const blob = new Blob(
      [binaryData],
      { type: mimeType }
    );

    const formData = new FormData();

    formData.append(
      "file",
      blob,
      fileName || "textbook.pdf"
    );

    const ocrResponse = await fetch(
      `${OCR_SERVICE_URL}/ocr`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(
          15 * 60 * 1000
        ),
      }
    );

    const ocrRawText =
      await ocrResponse.text();

    if (!ocrResponse.ok) {
      throw new Error(
        `PaddleOCR service returned ${ocrResponse.status}: ${ocrRawText.slice(
          0,
          1000
        )}`
      );
    }

    let ocrData: any;

    try {
      ocrData = JSON.parse(
        ocrRawText
      );
    } catch {
      throw new Error(
        "PaddleOCR returned an invalid JSON response."
      );
    }

    let extractedText = "";

    if (
      typeof ocrData.text ===
      "string"
    ) {
      extractedText =
        ocrData.text;
    } else if (
      typeof ocrData.extractedText ===
      "string"
    ) {
      extractedText =
        ocrData.extractedText;
    } else if (
      typeof ocrData.result?.text ===
      "string"
    ) {
      extractedText =
        ocrData.result.text;
    } else if (
      typeof ocrData.data?.text ===
      "string"
    ) {
      extractedText =
        ocrData.data.text;
    } else if (
      Array.isArray(
        ocrData.pages
      )
    ) {
      extractedText =
        ocrData.pages
          .map(
            (
              page: any,
              index: number
            ) => {
              const pageText =
                page?.text ||
                page?.extractedText ||
                "";

              return `\n--- PAGE ${
                index + 1
              } ---\n${pageText}`;
            }
          )
          .join("\n");
    }

    extractedText = String(
      extractedText || ""
    ).trim();

    if (!extractedText) {
      throw new Error(
        "PaddleOCR completed but no text was extracted from the document."
      );
    }

    telemetryStats.totalOcrScans += 1;

    console.log(
      `[OCR] Job ${jobId}: Extracted approximately ${extractedText.length} characters`
    );

    updateJob(jobId, {
      status: "cleaning",
      progress: 45,
      stageMessage:
        "Cleaning OCR text and removing obvious scan noise...",
    });

    const cleanedText =
      cleanOcrText(
        extractedText
      );

    console.log(
      `[OCR] Job ${jobId}: Cleaned text is approximately ${cleanedText.length} characters`
    );

    updateJob(jobId, {
      status: "detecting",
      progress: 50,
      stageMessage:
        "Detecting chapters and textbook sections...",
    });

    const chunks =
      detectTextbookChunks(
        cleanedText
      );

    if (chunks.length === 0) {
      throw new Error(
        "OCR text was extracted, but no usable textbook sections could be created."
      );
    }

    console.log(
      `[OCR] Job ${jobId}: Detected ${chunks.length} textbook section(s)`
    );

    updateJob(jobId, {
      status: "ai",
      progress: 55,
      stageMessage:
        `Textbook structure found. Qwen is analyzing ${chunks.length} section(s)...`,
    });

    const bookMetadata =
      await analyzeBookMetadata(
        fileName,
        cleanedText
      );

    const chapterAnalyses:
      ChapterAnalysis[] = [];

    // Sequential processing keeps the 4 GB GPU from running multiple
    // generations simultaneously. keep_alive keeps Qwen warm.
    for (
      let i = 0;
      i < chunks.length;
      i += 1
    ) {
      const chapter =
        await analyzeChapterChunk(
          chunks[i],
          i,
          chunks.length
        );

      chapterAnalyses.push(
        chapter
      );

      const chapterProgress =
        60 +
        Math.round(
          ((i + 1) /
            chunks.length) *
            35
        );

      updateJob(jobId, {
        status: "ai",
        progress: Math.min(
          95,
          chapterProgress
        ),
        stageMessage:
          `Qwen analyzed section ${
            i + 1
          } of ${chunks.length}...`,
      });
    }

    const analysis =
      combineTextbookAnalysis(
        fileName,
        extractedText,
        chunks,
        chapterAnalyses,
        bookMetadata
      );

    console.log(
      `[OLLAMA] Job ${jobId}: Chunked textbook analysis completed successfully.`
    );

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      stageMessage:
        "Textbook analysis completed.",
      result: {
        success: true,
        fileName:
          fileName || "textbook",

        ocr: {
          engine: "PaddleOCR",
          serviceUrl:
            OCR_SERVICE_URL,
          characterCount:
            extractedText.length,
          cleanedCharacterCount:
            cleanedText.length,
          extractedText,
        },

        ai: {
          provider: "Ollama",
          model: OLLAMA_MODEL,
          serviceUrl:
            OLLAMA_BASE_URL,
          strategy:
            "chunked-textbook-analysis",
          chunkCount:
            chunks.length,
        },

        analysis,
      },
    });
  } catch (error: any) {
    console.error(
      `[OCR/OLLAMA] Job ${jobId} failed:`,
      error
    );

    const message =
      error?.name === "TimeoutError"
        ? "The local AI took too long to finish. The job was stopped safely; try again after Ollama is warm."
        : error?.message ||
          "Failed to process textbook.";

    updateJob(jobId, {
      status: "failed",
      progress: 100,
      stageMessage:
        "Textbook processing failed.",
      error: message,
    });
  }
}

/* =========================================================
   TEXTBOOK OCR + OLLAMA EDUCATIONAL ANALYSIS

   POST returns immediately with a job id.
   GET /api/ocr/analyze-textbook/status/:jobId returns progress.
========================================================= */

app.post(
  "/api/ocr/analyze-textbook",
  async (req, res) => {
    try {
      const {
        fileData,
        mimeType,
        fileName,
      } = req.body;

      if (!fileData) {
        return res.status(400).json({
          success: false,
          error:
            "No file data provided.",
        });
      }

      const safeMimeType =
        mimeType ||
        (fileName
          ?.toLowerCase()
          .endsWith(".pdf")
          ? "application/pdf"
          : "image/jpeg");

      const base64Data =
        cleanBase64(
          fileData
        );

      if (!base64Data) {
        return res.status(400).json({
          success: false,
          error:
            "Uploaded file contains no usable data.",
        });
      }

      const job =
        createJob(
          fileName ||
            "textbook"
        );

      console.log(
        `[OCR] Created textbook job ${job.id} for ${job.fileName}`
      );

      void processTextbookJob(
        job.id,
        {
          fileData,
          mimeType:
            safeMimeType,
          fileName:
            fileName ||
            "textbook.pdf",
        }
      );

      return res
        .status(202)
        .json({
          success: true,
          jobId: job.id,
          status:
            job.status,
          progress:
            job.progress,
          stageMessage:
            job.stageMessage,
          fileName:
            job.fileName,
        });
    } catch (error: any) {
      console.error(
        "[OCR] Could not create textbook job:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error?.message ||
            "Could not start textbook processing.",
        });
    }
  }
);

app.get(
  "/api/ocr/analyze-textbook/status/:jobId",
  (req, res) => {
    const job =
      textbookJobs.get(
        req.params.jobId
      );

    if (!job) {
      return res
        .status(404)
        .json({
          success: false,
          status: "lost",
          recoverable: true,
          error:
            "This analysis job no longer exists on the backend. The server may have restarted while the job was running.",
        });
    }

    if (
      job.status ===
      "failed"
    ) {
      return res
        .status(200)
        .json({
          success: false,
          status:
            job.status,
          progress:
            job.progress,
          stageMessage:
            job.stageMessage,
          fileName:
            job.fileName,
          error:
            job.error,
        });
    }

    if (
      job.status ===
      "completed"
    ) {
      return res
        .status(200)
        .json({
          ...job.result,
          status:
            job.status,
          progress:
            job.progress,
          stageMessage:
            job.stageMessage,
          jobId: job.id,
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        jobId: job.id,
        status:
          job.status,
        progress:
          job.progress,
        stageMessage:
          job.stageMessage,
        fileName:
          job.fileName,
      });
  }
);

/**$/, "")}${endpoint}\`;

}

function extractJsonObject(text: string): any {

  const cleaned = String(text || "")

    .trim()

    .replace(/^\`\`\`json\s\*/i, "")

    .replace(/^\`\`\`\s\*/i, "")

    .replace(/\s\*\`\`\`$/i, "")

    .trim();

  try {

    return JSON.parse(cleaned);

  } catch {

    const firstBrace = cleaned.indexOf("{");

    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {

      try {

        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

      } catch {

        // Fall through.

      }

    }

    throw new Error("Ollama returned invalid JSON.");

  }

}

async function generateWithOllama(

  prompt: string,

  options: {

    temperature?: number;

    numCtx?: number;

    timeoutMs?: number;

    keepAlive?: string;

    numPredict?: number;

  } = {}

): Promise<{ text: string; model: string }> {

  const timeoutMs = options.timeoutMs ?? 10 \* 60 \* 1000;

  const response = await fetch(getOllamaUrl("/api/chat"), {

    method: "POST",

    signal: AbortSignal.timeout(timeoutMs),

    headers: {

      "Content-Type": "application/json",

    },

    body: JSON.stringify({

      model: OLLAMA\_MODEL,

      stream: false,

      format: "json",

      messages: [

        {

          role: "system",

          content:

            "You are a reliable educational AI assistant. Follow the user's requested JSON structure exactly. Return only valid JSON with no markdown fences or commentary.",

        },

        {

          role: "user",

          content: prompt,

        },

      ],

      keep\_alive: options.keepAlive ?? "10m",

      options: {

        temperature: options.temperature ?? 0.2,

        num\_ctx: options.numCtx ?? 32768,

        ...(options.numPredict !== undefined

          ? { num\_predict: options.numPredict }

          : {}),

      },

    }),

  });

  const rawText = await response.text();

  if (!response.ok) {

    throw new Error(

      \`Ollama returned ${response.status}: ${rawText.slice(0, 1000)}\`

    );

  }

  let data: any;

  try {

    data = JSON.parse(rawText);

  } catch {

    throw new Error("Ollama returned an invalid API response.");

  }

  const generatedText = data?.message?.content || data?.response || "";

  if (!generatedText) {

    throw new Error("Ollama returned no generated text.");

  }

  return {

    text: generatedText,

    model: data?.model || OLLAMA\_MODEL,

  };

}

async function checkOllamaHealth(): Promise<{

  reachable: boolean;

  models?: string[];

  error?: string;

}> {

  try {

    const response = await fetch(getOllamaUrl("/api/tags"));

    const rawText = await response.text();

    if (!response.ok) {

      return {

        reachable: false,

        error: \`Ollama returned ${response.status}: ${rawText.slice(0, 500)}\`,

      };

    }

    const data = JSON.parse(rawText);

    const models = Array.isArray(data?.models)

      ? data.models.map((model: any) => model?.name).filter(Boolean)

      : [];

    return {

      reachable: true,

      models,

    };

  } catch (error: any) {

    return {

      reachable: false,

      error: error?.message || "Ollama is not reachable.",

    };

  }

}

/\* =========================================================

   HELPERS

\========================================================= \*/

function cleanBase64(data: string): string {

  if (!data) return "";

  const marker = "base64,";

  if (data.includes(marker)) {

    return data.split(marker)[1];

  }

  return data;

}

/\* =========================================================

   TELEMETRY

\========================================================= \*/

const startTime = Date.now();

const telemetryStats = {

  totalOcrScans: 0,

  totalStoriesGenerated: 68,

  totalReadingMinutes: 1840,

  totalSpeechEvaluations: 310,

  activeSchoolsCount: 3,

  totalStudentsRegistered: 148,

  totalFacultyMembers: 7,

  tokenConsumptionEstimate: 142050,

};

/\* =========================================================

   HEALTH CHECK

\========================================================= \*/

app.get("/api/server-health", (\_req, res) => {

  res.json({

    status: "ok",

    service: "Phatan Shakti Backend",

    uptimeSeconds: Math.floor(

      (Date.now() - startTime) / 1000

    ),

    timestamp: new Date().toISOString(),

    ocrService: OCR\_SERVICE\_URL,

  });

});

/\* =========================================================

   SUPER ADMIN SECURITY

\========================================================= \*/

app.post("/api/auth/superadmin-verify", (req, res) => {

  const { key, uriCode } = req.body;

  if (uriCode !== "superadmin221b") {

    return res.status(403).json({

      error:

        "Access Denied. Invalid SuperAdmin security route.",

    });

  }

  if (

    key === "shakthi\_admin\_2026" ||

    key === "superadmin221b"

  ) {

    return res.json({

      success: true,

      message: "SuperAdmin authorization successful.",

      session: {

        id: "superadmin\_root",

        name: "State System Director (SuperAdmin)",

        role: "superadmin",

        avatar: "🛡️",

        schoolId: "all",

        schoolName:

          "SCERT State Primary Literacy Mission",

        designation:

          "Chief Technology & Curriculum Administrator",

      },

    });

  }

  return res.status(401).json({

    error: "Invalid SuperAdmin security key.",

  });

});

/\* =========================================================

   SUPER ADMIN TELEMETRY

\========================================================= \*/

app.get("/api/superadmin/telemetry", (\_req, res) => {

  const uptime = Math.floor(

    (Date.now() - startTime) / 1000

  );

  res.json({

    serverStatus: "healthy",

    uptimeSeconds: uptime,

    ollamaModel: OLLAMA\_MODEL,

    ollamaBaseUrl: OLLAMA\_BASE\_URL,

    paddleOcrService: OCR\_SERVICE\_URL,

    ...telemetryStats,

    ollamaConfigured: true,

  });

});

/\* =========================================================

   OLLAMA HEALTH CHECK

\========================================================= \*/

app.get("/api/ollama/health", async (\_req, res) => {

  const health = await checkOllamaHealth();

  return res.status(health.reachable ? 200 : 503).json({

    success: health.reachable,

    ollama: health.reachable,

    serviceUrl: OLLAMA\_BASE\_URL,

    configuredModel: OLLAMA\_MODEL,

    models: health.models || [],

    modelInstalled:

      health.models?.some(

        (name) =>

          name === OLLAMA\_MODEL ||

          name.startsWith(\`${OLLAMA\_MODEL.split(":")[0]}:\`)

      ) || false,

    error: health.error,

  });

});

/\* =========================================================

   PADDLEOCR HEALTH CHECK

\========================================================= \*/

app.get("/api/ocr/health", async (\_req, res) => {

  try {

    const response = await fetch(

      \`${OCR\_SERVICE\_URL}/\`

    );

    const text = await response.text();

    return res.json({

      success: response.ok,

      paddleOcr: response.ok,

      serviceUrl: OCR\_SERVICE\_URL,

      response: text.slice(0, 500),

    });

  } catch (error: any) {

    return res.status(503).json({

      success: false,

      paddleOcr: false,

      serviceUrl: OCR\_SERVICE\_URL,

      error:

        error?.message ||

        "PaddleOCR service is not reachable.",

    });

  }

});

/\* =========================================================

   TEXTBOOK JOB PROCESSING

   Textbook analysis is intentionally asynchronous. A large PDF can

   take PaddleOCR + local Ollama several minutes. Keeping the browser

   request open for the whole operation causes fetch/network errors.

   The API now returns a job id immediately and the frontend polls it.

\========================================================= \*/

type TextbookJobStatus =

  | "queued"

  | "ocr"

  | "ai"

  | "completed"

  | "failed";

interface TextbookJob {

  id: string;

  status: TextbookJobStatus;

  progress: number;

  stageMessage: string;

  fileName: string;

  createdAt: number;

  result?: any;

  error?: string;

}

const textbookJobs = new Map\<string, TextbookJob>();

const TEXTBOOK\_JOB\_TTL\_MS = 30 \* 60 \* 1000;

function createJob(fileName: string): TextbookJob {

  const id = \`ocr\_${Date.now()}\_${Math.random().toString(36).slice(2, 10)}\`;

  const job: TextbookJob = {

    id,

    status: "queued",

    progress: 0,

    stageMessage: "Queued for OCR processing...",

    fileName,

    createdAt: Date.now(),

  };

  textbookJobs.set(id, job);

  return job;

}

function updateJob(

  jobId: string,

  patch: Partial\<TextbookJob>

): TextbookJob | undefined {

  const job = textbookJobs.get(jobId);

  if (!job) return undefined;

  Object.assign(job, patch);

  return job;

}

function cleanupOldTextbookJobs() {

  const cutoff = Date.now() - TEXTBOOK\_JOB\_TTL\_MS;

  for (const [id, job] of textbookJobs.entries()) {

    if (job.createdAt < cutoff) textbookJobs.delete(id);

  }

}

setInterval(cleanupOldTextbookJobs, 5 \* 60 \* 1000).unref();

function normalizeTextbookAnalysis(

  raw: any,

  extractedText: string

): any {

  const chapters = Array.isArray(raw?.chapters)

    ? raw\.chapters

    : [];

  const firstChapter = chapters[0] || {};

  return {

    subject: raw?.subject || "Unknown",

    grade: raw?.grade || "Unknown",

    chapterNumber:

      firstChapter?.chapterNumber || "Chapter 1",

    chapterTitle:

      firstChapter?.chapterTitle ||

      raw?.bookTitle ||

      "Textbook Analysis",

    primaryLanguage:

      raw?.primaryLanguage || "Unknown",

    extractedText,

    summary:

      firstChapter?.summary ||

      raw?.overallSummary ||

      "No summary was generated.",

    keyVocabulary: Array.isArray(firstChapter?.keyVocabulary)

      ? firstChapter.keyVocabulary.slice(0, 8)

      : [],

    learningObjectives: Array.isArray(

      firstChapter?.learningObjectives

    )

      ? firstChapter.learningObjectives.slice(0, 5)

      : [],

    suggestedStoryThemes: Array.isArray(

      firstChapter?.suggestedStoryThemes

    )

      ? firstChapter.suggestedStoryThemes.slice(0, 5)

      : [],

    // Keep the richer textbook-level analysis available to future UI.

    bookTitle: raw?.bookTitle || "",

    overallSummary: raw?.overallSummary || "",

    chapters,

    importantEducationalContext:

      Array.isArray(raw?.importantEducationalContext)

        ? raw\.importantEducationalContext

        : [],

    teacherNotes: Array.isArray(raw?.teacherNotes)

      ? raw\.teacherNotes

      : [],

  };

}

async function processTextbookJob(

  jobId: string,

  params: {

    fileData: string;

    mimeType: string;

    fileName: string;

  }

): Promise\<void> {

  const { fileData, mimeType, fileName } = params;

  try {

    updateJob(jobId, {

      status: "ocr",

      progress: 5,

      stageMessage: "Reading every page with PaddleOCR...",

    });

    console.log(\`[OCR] Job ${jobId}: Processing ${fileName}\`);

    console.log(

      \`[OCR] Job ${jobId}: Sending document to PaddleOCR at ${OCR\_SERVICE\_URL}\`

    );

    const binaryData = Buffer.from(cleanBase64(fileData), "base64");

    const blob = new Blob([binaryData], { type: mimeType });

    const formData = new FormData();

    formData.append("file", blob, fileName || "textbook.pdf");

    const ocrResponse = await fetch(\`${OCR\_SERVICE\_URL}/ocr\`, {

      method: "POST",

      body: formData,

      signal: AbortSignal.timeout(15 \* 60 \* 1000),

    });

    const ocrRawText = await ocrResponse.text();

    if (!ocrResponse.ok) {

      throw new Error(

        \`PaddleOCR service returned ${ocrResponse.status}: ${ocrRawText.slice(0, 1000)}\`

      );

    }

    let ocrData: any;

    try {

      ocrData = JSON.parse(ocrRawText);

    } catch {

      throw new Error("PaddleOCR returned an invalid JSON response.");

    }

    let extractedText = "";

    if (typeof ocrData.text === "string") {

      extractedText = ocrData.text;

    } else if (typeof ocrData.extractedText === "string") {

      extractedText = ocrData.extractedText;

    } else if (typeof ocrData.result?.text === "string") {

      extractedText = ocrData.result.text;

    } else if (typeof ocrData.data?.text === "string") {

      extractedText = ocrData.data.text;

    } else if (Array.isArray(ocrData.pages)) {

      extractedText = ocrData.pages

        .map((page: any, index: number) => {

          const pageText =

            page?.text || page?.extractedText || "";

          return \`\n--- PAGE ${index + 1} ---\n${pageText}\`;

        })

        .join("\n");

    }

    extractedText = String(extractedText || "").trim();

    if (!extractedText) {

      throw new Error(

        "PaddleOCR completed but no text was extracted from the document."

      );

    }

    telemetryStats.totalOcrScans += 1;

    console.log(

      \`[OCR] Job ${jobId}: Extracted approximately ${extractedText.length} characters\`

    );

    updateJob(jobId, {

      status: "ai",

      progress: 55,

      stageMessage:

        "OCR complete. Llama is analyzing the textbook...",

    });

    /\*

     \* Keep the prompt compact. The old prompt asked for a very large

     \* nested response, which made an 8B local model spend too long

     \* generating JSON. We still provide the complete OCR text.

     \*/

    const prompt = \`

You are an expert primary-school curriculum analyst for Indian education.

Analyze the OCR text from this textbook and return concise, useful educational metadata.

FILE: ${fileName || "Unknown textbook"}

OCR TEXT:

\---------------- BEGIN ----------------

${extractedText}

\----------------- END -----------------

Rules:

\- Use only information supported by the OCR text.

\- Ignore page numbers, copyright notices, publisher details, repeated headers/footers and OCR noise.

\- Identify subject, class/grade, primary language, book title and important lessons/chapters.

\- Keep summaries concise.

\- Return at most 8 chapters.

\- For each chapter return at most 5 concepts, 8 vocabulary words, 4 objectives and 3 story themes.

\- Do not repeat the full OCR text in your response.

\- Return ONLY valid JSON.

JSON structure:

{

  "subject": "string",

  "grade": "Class 1 | Class 2 | Class 3 | Class 4 | Class 5 | Unknown",

  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",

  "bookTitle": "string",

  "overallSummary": "string",

  "chapters": [

    {

      "chapterNumber": "string",

      "chapterTitle": "string",

      "primaryTopic": "string",

      "summary": "string",

      "importantConcepts": ["string"],

      "keyVocabulary": [

        {"word":"string","meaning":"string","phonetic":"string"}

      ],

      "learningObjectives": ["string"],

      "suggestedStoryThemes": ["string"]

    }

  ],

  "importantEducationalContext": ["string"],

  "teacherNotes": ["string"]

}

\`;

    console.log(

      \`[OLLAMA] Job ${jobId}: Analyzing with ${OLLAMA\_MODEL}...\`

    );

    const ollamaResult = await generateWithOllama(prompt, {

      temperature: 0.1,

      numCtx: 8192,

      timeoutMs: 15 \* 60 \* 1000,

      keepAlive: "15m",

      numPredict: 900,

    });

    const rawAnalysis = extractJsonObject(ollamaResult.text);

    const analysis = normalizeTextbookAnalysis(

      rawAnalysis,

      extractedText

    );

    console.log(

      \`[OLLAMA] Job ${jobId}: Analysis completed successfully.\`

    );

    updateJob(jobId, {

      status: "completed",

      progress: 100,

      stageMessage: "Textbook analysis completed.",

      result: {

        success: true,

        fileName: fileName || "textbook",

        ocr: {

          engine: "PaddleOCR",

          serviceUrl: OCR\_SERVICE\_URL,

          characterCount: extractedText.length,

          extractedText,

        },

        ai: {

          provider: "Ollama",

          model: OLLAMA\_MODEL,

          serviceUrl: OLLAMA\_BASE\_URL,

        },

        analysis,

      },

    });

  } catch (error: any) {

    console.error(\`[OCR/OLLAMA] Job ${jobId} failed:\`, error);

    const message =

      error?.name === "TimeoutError"

        ? "The local AI took too long to finish. The job was stopped safely; try again after Ollama is warm."

        : error?.message || "Failed to process textbook.";

    updateJob(jobId, {

      status: "failed",

      progress: 100,

      stageMessage: "Textbook processing failed.",

      error: message,

    });

  }

}

/\* =========================================================

   TEXTBOOK OCR + OLLAMA EDUCATIONAL ANALYSIS

   POST returns immediately with a job id.

   GET /api/ocr/analyze-textbook/status/\:jobId returns progress.

\========================================================= \*/

app.post("/api/ocr/analyze-textbook", async (req, res) => {

  try {

    const { fileData, mimeType, fileName } = req.body;

    if (!fileData) {

      return res.status(400).json({

        success: false,

        error: "No file data provided.",

      });

    }

    const safeMimeType =

      mimeType ||

      (fileName?.toLowerCase().endsWith(".pdf")

        ? "application/pdf"

        : "image/jpeg");

    const base64Data = cleanBase64(fileData);

    if (!base64Data) {

      return res.status(400).json({

        success: false,

        error: "Uploaded file contains no usable data.",

      });

    }

    const job = createJob(fileName || "textbook");

    console.log(

      \`[OCR] Created textbook job ${job.id} for ${job.fileName}\`

    );

    // Do not await this. The browser gets the job id immediately.

    void processTextbookJob(job.id, {

      fileData,

      mimeType: safeMimeType,

      fileName: fileName || "textbook.pdf",

    });

    return res.status(202).json({

      success: true,

      jobId: job.id,

      status: job.status,

      progress: job.progress,

      stageMessage: job.stageMessage,

      fileName: job.fileName,

    });

  } catch (error: any) {

    console.error("[OCR] Could not create textbook job:", error);

    return res.status(500).json({

      success: false,

      error: error?.message || "Could not start textbook processing.",

    });

  }

});

app.get(

  "/api/ocr/analyze-textbook/status/\:jobId",

  (req, res) => {

    const job = textbookJobs.get(req.params.jobId);

    if (!job) {

      return res.status(404).json({

        success: false,

        status: "lost",

        recoverable: true,

        error:

          "This analysis job no longer exists on the backend. The server may have restarted while the job was running.",

      });

    }

    if (job.status === "failed") {

      return res.status(200).json({

        success: false,

        status: job.status,

        progress: job.progress,

        stageMessage: job.stageMessage,

        fileName: job.fileName,

        error: job.error,

      });

    }

    if (job.status === "completed") {

      return res.status(200).json({

        ...job.result,

        status: job.status,

        progress: job.progress,

        stageMessage: job.stageMessage,

        jobId: job.id,

      });

    }

    return res.status(200).json({

      success: true,

      jobId: job.id,

      status: job.status,

      progress: job.progress,

      stageMessage: job.stageMessage,

      fileName: job.fileName,

    });

  }

);

/\* =========================================================

   TEXTBOOK OCR + OLLAMA EDUCATIONAL ANALYSIS

   FLOW:

   Frontend

       ↓

   Node.js

       ↓

   PaddleOCR :8001

       ↓

   Extracted text

       ↓

   Ollama / llama3.1\:latest

       ↓

   Educational context

\========================================================= \*/



/\* =========================================================

   READ-ALONG STORY GENERATION

\========================================================= \*/

app.post(

  "/api/stories/generate-from-summary",

  async (req, res) => {

    try {

      const {

        chapterTitle,

        subject,

        grade,

        summary,

        targetLanguage = "Telugu",

        difficulty = "Medium",

        storyType = "Moral & Adventure",

      } = req.body;

      const prompt = \`

You are a beloved children's storybook author and

literacy specialist for primary school children in India.

Create a joyful, high-engagement Read-Along story based

on the textbook chapter below.

Textbook Details:

Chapter Title:

${chapterTitle || "Village Learning"}

Subject:

${subject || "General Knowledge"}

Grade:

${grade || "Class 2"}

Chapter Summary:

${summary || "Learning about friendship, nature, and community"}

Target Language:

${targetLanguage}

Difficulty:

${difficulty}

Theme:

${storyType}

Guidelines:

1\. Write the story in ${targetLanguage}.

2\. Structure the story into 4 to 6 sequential pages.

3\. Each page must contain:

   - pageNumber

   - text

   - englishTranslation

   - transliteration

   - illustrationPrompt

   - suggestedSoundEffect

4\. Include 3 comprehension questions.

5\. Include 5-6 spotlight vocabulary words.

Return ONLY valid JSON:

{

  "title": "string",

  "titleEnglish": "string",

  "language": "${targetLanguage}",

  "gradeLevel": "${grade || "Class 2"}",

  "difficulty": "${difficulty}",

  "coverIllustrationPrompt": "string",

  "category": "${subject || "Science & Nature"}",

  "moralOrTakeaway": "string",

  "pages": [

    {

      "pageNumber": 1,

      "text": "string",

      "englishTranslation": "string",

      "transliteration": "string",

      "illustrationPrompt": "string",

      "suggestedSoundEffect": "string"

    }

  ],

  "spotlightWords": [

    {

      "word": "string",

      "meaning": "string",

      "pronunciation": "string",

      "example": "string"

    }

  ],

  "comprehensionQuiz": [

    {

      "question": "string",

      "questionEnglish": "string",

      "options": [

        "string",

        "string",

        "string",

        "string"

      ],

      "correctOptionIndex": 0,

      "explanation": "string"

    }

  ]

}

\`;

      console.log(

        \`[OLLAMA] Generating Read-Along story with ${OLLAMA\_MODEL}...\`

      );

      const ollamaResult = await generateWithOllama(prompt, {

        temperature: 0.55,

        numCtx: 16384,

      });

      const storyData =

        extractJsonObject(ollamaResult.text);

      telemetryStats.totalStoriesGenerated += 1;

      return res.json({

        success: true,

        story: storyData,

      });

    } catch (error: any) {

      console.error(

        "Story Generation Error:",

        error

      );

      return res.status(500).json({

        success: false,

        error:

          error?.message ||

          "Failed to generate Read-Along story.",

      });

    }

  }

);

/\* =========================================================

   AI PRONUNCIATION EVALUATION

\========================================================= \*/

app.post(

  "/api/speech/evaluate-pronunciation",

  async (req, res) => {

    try {

      const {

        targetText,

        spokenText,

        language = "Telugu",

      } = req.body;

      if (!targetText || !spokenText) {

        return res.status(400).json({

          success: false,

          error:

            "targetText and spokenText are required.",

        });

      }

      const prompt = \`

You are a supportive primary-school reading tutor.

Target sentence:

"${targetText}"

Recognized speech:

"${spokenText}"

Language:

${language}

Evaluate:

1\. Approximate word accuracy percentage.

2\. Matched words.

3\. Missed words.

4\. Mispronounced words.

5\. Warm encouragement.

6\. Encouragement in the native language.

7\. A useful phonics tip.

8\. Stars earned from 1 to 5.

Return ONLY JSON:

{

  "accuracyScore": 92,

  "wordsMatched": [],

  "wordsMissed": [],

  "wordsMispronounced": [],

  "encouragement": "string",

  "encouragementNative": "string",

  "phonicsTip": "string",

  "starsEarned": 3

}

\`;

      console.log(

        \`[OLLAMA] Evaluating pronunciation with ${OLLAMA\_MODEL}...\`

      );

      const ollamaResult = await generateWithOllama(prompt, {

        temperature: 0.1,

        numCtx: 8192,

      });

      const result =

        extractJsonObject(ollamaResult.text);

      telemetryStats.totalSpeechEvaluations += 1;

      return res.json({

        success: true,

        evaluation: result,

      });

    } catch (error: any) {

      console.error(

        "Speech Evaluation Error:",

        error

      );

      return res.status(500).json({

        success: false,

        error:

          error?.message ||

          "Failed to evaluate speech attempt.",

      });

    }

  }

);

/\* =========================================================

   GEMINI TEXT-TO-SPEECH

\========================================================= \*/

app.post(

  "/api/speech/synthesize",

  async (req, res) => {

    try {

      const {

        text,

        language = "Telugu",

        voiceName = "Kore",

        style = "cheerful\_teacher",

      } = req.body;

      if (

        !text ||

        typeof text !== "string"

      ) {

        return res.status(400).json({

          success: false,

          error:

            "Text is required for speech synthesis.",

        });

      }

      const ai = getGeminiClient();

      let instruction =

        \`Say cheerfully and warmly for a primary school child in ${language}: ${text}\`;

      if (style === "slow\_phonics") {

        instruction =

          \`Pronounce extra clearly, slowly, syllable-by-syllable for a Class 1 child learning phonics in ${language}: ${text}\`;

      } else if (

        style === "gentle\_storyteller"

      ) {

        instruction =

          \`Narrate with expressive, gentle storybook warmth and child-friendly Indian cadence in ${language}: ${text}\`;

      }

      const response =

        await ai.models.generateContent({

          model:

            "gemini-3.1-flash-tts-preview",

          contents: [

            {

              parts: [

                {

                  text: instruction,

                },

              ],

            },

          ],

          config: {

            responseModalities: [

              Modality.AUDIO,

            ],

            speechConfig: {

              voiceConfig: {

                prebuiltVoiceConfig: {

                  voiceName:

                    voiceName || "Kore",

                },

              },

            },

          },

        });

      const candidate =

        response.candidates?.[0];

      const part =

        candidate?.content?.parts?.[0];

      const base64Audio =

        part?.inlineData?.data;

      const audioMimeType =

        part?.inlineData?.mimeType ||

        "audio/pcm;rate=24000";

      if (!base64Audio) {

        return res.status(500).json({

          success: false,

          error:

            "No audio stream returned from Gemini TTS.",

        });

      }

      return res.json({

        success: true,

        audioBase64: base64Audio,

        mimeType: audioMimeType,

        sampleRate: 24000,

        voiceName,

        language,

      });

    } catch (error: any) {

      console.error(

        "Speech Synthesis Error:",

        error

      );

      return res.status(500).json({

        success: false,

        error:

          error?.message ||

          "Failed to synthesize speech.",

      });

    }

  }

);

/\* =========================================================

   VITE / PRODUCTION

\========================================================= \*/

async function startServer() {

  if (

    process.env.NODE\_ENV !==

    "production"

  ) {

    const vite =

      await createViteServer({

        server: {

          middlewareMode: true,

        },

        appType: "spa",

      });

    app.use(vite.middlewares);

  } else {

    const distPath = path.join(

      process.cwd(),

      "dist"

    );

    app.use(

      express.static(distPath)

    );

    app.get("\*", (\_req, res) => {

      res.sendFile(

        path.join(

          distPath,

          "index.html"

        )

      );

    });

  }

  app.listen(

    PORT,

    "0.0.0.0",

    () => {

      console.log("");

      console.log(

        "========================================"

      );

      console.log(

        "      PHATAN SHAKTI BACKEND"

      );

      console.log(

        "========================================"

      );

      console.log(

        \`Frontend/Backend : http\://localhost:${PORT}\`

      );

      console.log(

        \`PaddleOCR        : ${OCR\_SERVICE\_URL}\`

      );

      console.log(

        \`Ollama           : ${OLLAMA\_BASE\_URL}\`

      );

      console.log(

        \`Ollama Model     : ${OLLAMA\_MODEL}\`

      );

      console.log(

        \`Ollama           : ${OLLAMA\_BASE\_URL}\`

      );

      console.log(

        \`Ollama Model     : ${OLLAMA\_MODEL}\`

      );

      console.log(

        "Firebase routes   : /api/\*"

      );

      console.log(

        "Textbook OCR      : /api/ocr/analyze-textbook"

      );

      console.log(

        "========================================"

      );

      console.log("");

    }

  );

}

startServer().catch((error) => {

  console.error(

    "Failed to start server:",

    error

  );

  process.exit(1);

});