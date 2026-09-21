import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import firebaseRouter, {
  requireFirebaseUser,
  requireRole,
} from "./server/firebaseRoutes";
import {
  DetectedChapter,
  MAX_AI_ANALYZED_CHAPTERS,
  buildFallbackMetadata,
  chaptersFromDoclingResult,
  normalizeChapterResult,
} from "./server/textbookOcr";
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const OCR_SERVICE_URL =
  process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "qwen2.5:3b";
/* =========================================================
   MIDDLEWARE
\\\\========================================================= */
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
/*
 * IMPORTANT:
 * Firebase authentication, curriculum, lessons,
 * reading sessions and analytics are handled here.
 */
app.use("/api", firebaseRouter);
/* =========================================================
   AI CONFIGURATION
\\\\========================================================= */
/*
 * Ollama handles all text-generation tasks locally:
 *   - textbook analysis
 *   - Read-Along story generation
 *   - pronunciation evaluation
 *
 * Voice (TTS + STT) uses Sarvam's Bulbul v3 / Saaras v4 APIs — see the
 * /api/speech/synthesize and /api/speech/transcribe handlers below.
 */
function getOllamaUrl(endpoint: string): string {
  return `${OLLAMA_BASE_URL.replace(/\/$/, "")}${endpoint}`;
}
function extractJsonObject(text: string): any {
  const raw = String(text ?? "").trim();
  if (!raw) {
    throw new Error("Ollama returned empty generated text.");
  }
  // First try the response exactly as returned by Ollama.
  try {
    return JSON.parse(raw);
  } catch {
    // Continue with tolerant extraction below.
  }
  // Qwen sometimes wraps JSON in Markdown fences despite the instruction.
  const withoutFences = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFences);
  } catch {
    // Continue.
  }
  // Extract the largest JSON object from surrounding commentary.
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = withoutFences.slice(firstBrace, lastBrace + 1).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // A common model error is a trailing comma before } or ].
      const repaired = candidate
        .replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(repaired);
      } catch {
        // Fall through with a useful diagnostic.
      }
    }
  }
  const preview = raw.replace(/\s+/g, " ").slice(0, 1200);
  throw new Error(
    `Ollama returned invalid JSON. Response preview: ${preview}`
  );
}
async function generateWithOllama(
  prompt: string,
  options: {
    temperature?: number;
    numCtx?: number;
    timeoutMs?: number;
    keepAlive?: string;
    numPredict?: number;
    format?: any;
  } = {}
): Promise<{ text: string; model: string }> {
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;
  const response = await fetch(getOllamaUrl("/api/chat"), {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: options.format ?? "json",
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
      keep_alive: options.keepAlive ?? "10m",
      options: {
        temperature: options.temperature ?? 0.2,
        num_ctx: options.numCtx ?? 32768,
        ...(options.numPredict !== undefined
          ? { num_predict: options.numPredict }
          : {}),
      },
    }),
  });
  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}: ${rawText.slice(0, 1000)}`
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
    model: data?.model || OLLAMA_MODEL,
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
        error: `Ollama returned ${response.status}: ${rawText.slice(0, 500)}`,
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
/* =========================================================
   HELPERS
\\\\========================================================= */
function cleanBase64(data: string): string {
  if (!data) return "";
  const marker = "base64,";
  if (data.includes(marker)) {
    return data.split(marker)[1];
  }
  return data;
}
/* =========================================================
   TELEMETRY
\\\\========================================================= */
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
/* =========================================================
   HEALTH CHECK
\\\\========================================================= */
app.get("/api/server-health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Phatan Shakti Backend",
    uptimeSeconds: Math.floor(
      (Date.now() - startTime) / 1000
    ),
    timestamp: new Date().toISOString(),
    ocrService: OCR_SERVICE_URL,
  });
});
/* =========================================================
   SUPER ADMIN TELEMETRY
   Real Firebase-verified auth, not a client-side passkey — see
   SuperAdminPortalPage.tsx and server/firebaseRoutes.ts.
\\\\========================================================= */
app.get(
  "/api/superadmin/telemetry",
  requireFirebaseUser,
  requireRole(["superadmin"]),
  (_req, res) => {
    const uptime = Math.floor(
      (Date.now() - startTime) / 1000
    );
    res.json({
      serverStatus: "healthy",
      uptimeSeconds: uptime,
      ollamaModel: OLLAMA_MODEL,
      ollamaBaseUrl: OLLAMA_BASE_URL,
      ocrService: OCR_SERVICE_URL,
      ...telemetryStats,
      ollamaConfigured: true,
    });
  }
);
/* =========================================================
   OLLAMA HEALTH CHECK
\\\\========================================================= */
app.get("/api/ollama/health", async (_req, res) => {
  const health = await checkOllamaHealth();
  return res.status(health.reachable ? 200 : 503).json({
    success: health.reachable,
    ollama: health.reachable,
    serviceUrl: OLLAMA_BASE_URL,
    configuredModel: OLLAMA_MODEL,
    models: health.models || [],
    modelInstalled:
      health.models?.some(
        (name) =>
          name === OLLAMA_MODEL ||
          name.startsWith(`${OLLAMA_MODEL.split(":")[0]}:`)
      ) || false,
    error: health.error,
  });
});
/* =========================================================
   DOCLING OCR HEALTH CHECK
\\\\========================================================= */
app.get("/api/ocr/health", async (_req, res) => {
  try {
    const response = await fetch(
      `${OCR_SERVICE_URL}/`
    );
    const text = await response.text();
    return res.json({
      success: response.ok,
      docling: response.ok,
      serviceUrl: OCR_SERVICE_URL,
      response: text.slice(0, 500),
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      docling: false,
      serviceUrl: OCR_SERVICE_URL,
      error:
        error?.message ||
        "Docling OCR service is not reachable.",
    });
  }
});
/* =========================================================
   TEXTBOOK JOB PROCESSING
   Textbook analysis is intentionally asynchronous. A large PDF can
   take Docling + local Ollama several minutes. Keeping the browser
   request open for the whole operation causes fetch/network errors.
   The API now returns a job id immediately and the frontend polls it.
\\\\========================================================= */
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
    if (job.createdAt < cutoff) textbookJobs.delete(id);
  }
}
setInterval(cleanupOldTextbookJobs, 5 * 60 * 1000).unref();
function normalizeTextbookAnalysis(
  raw: any,
  extractedText: string
): any {
  const chapters = Array.isArray(raw?.chapters)
    ? raw.chapters
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
        ? raw.importantEducationalContext
        : [],
    teacherNotes: Array.isArray(raw?.teacherNotes)
      ? raw.teacherNotes
      : [],
  };
}
async function analyzeBookMetadata(
  fileName: string,
  extractedText: string
): Promise<any> {
  // Keep the metadata prompt deliberately small. On a 4 GB RTX 3050,
  // sending a large OCR document to Qwen can make Ollama spend several
  // minutes before returning response headers.
  const sample =
    extractedText.length <= 5000
      ? extractedText
      : `${extractedText.slice(0, 1750)}
...
${extractedText.slice(-1750)}`;
  const prompt = `
Identify basic educational metadata from this OCR sample.
File name:
${fileName || "Unknown textbook"}
OCR sample:
--- BEGIN ---
${sample}
--- END ---
Use only evidence in the OCR.
Return ONLY valid JSON:
{
  "subject": "string",
  "grade": "Class 1 | Class 2 | Class 3 | Class 4 | Class 5 | Unknown",
  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",
  "bookTitle": "string",
  "overallSummary": "short string"
}
`;
  const result = await generateWithOllama(prompt, {
    temperature: 0.05,
    numCtx: 4096,
    timeoutMs: 8 * 60 * 1000,
    keepAlive: "15m",
    numPredict: 350,
  });
  try {
    return extractJsonObject(result.text);
  } catch (firstError: any) {
    console.warn(
      "[QWEN] Metadata JSON was invalid. Retrying with compact output...",
      firstError?.message || firstError
    );
    const retryPrompt = `
Return ONLY valid JSON. No Markdown. No explanation.
File: ${fileName || "Unknown textbook"}
OCR sample:
${sample.slice(0, 3500)}
Return exactly:
{
  "subject": "string",
  "grade": "Class 1 | Class 2 | Class 3 | Class 4 | Class 5 | Unknown",
  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",
  "bookTitle": "string",
  "overallSummary": "short string"
}
`;
    const retry = await generateWithOllama(retryPrompt, {
      temperature: 0.05,
      numCtx: 4096,
      timeoutMs: 8 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 300,
    });
    return extractJsonObject(retry.text);
  }
}
function buildFallbackChapterResult(chunk: DetectedChapter): any {
  return normalizeChapterResult(
    {
      chapterNumber: chunk.chapterNumber,
      chapterTitle: chunk.chapterTitle,
      primaryTopic: chunk.chapterTitle,
      summary:
        chunk.paragraphs[0]?.slice(0, 280) ||
        `This section covers ${chunk.chapterTitle}.`,
      importantConcepts: [],
      keyVocabulary: [],
      learningObjectives: [],
      suggestedStoryThemes: [],
    },
    chunk
  );
}
async function analyzeChapterChunk(
  chunk: DetectedChapter
): Promise<any> {
  const chapterSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      primaryTopic: { type: "string" },
      summary: { type: "string" },
      importantConcepts: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      keyVocabulary: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            word: { type: "string" },
            meaning: { type: "string" },
            phonetic: { type: "string" },
          },
          required: ["word", "meaning", "phonetic"],
        },
      },
      learningObjectives: {
        type: "array",
        maxItems: 5,
        items: { type: "string" },
      },
      suggestedStoryThemes: {
        type: "array",
        maxItems: 5,
        items: { type: "string" },
      },
    },
    required: [
      "primaryTopic",
      "summary",
      "importantConcepts",
      "keyVocabulary",
      "learningObjectives",
      "suggestedStoryThemes",
    ],
  };
  const prompt = `
Analyze this textbook section for a primary-school educational platform.
Chapter/Section:
${chunk.chapterNumber} - ${chunk.chapterTitle}
OCR text:
--- BEGIN ---
${chunk.text.slice(0, 8500)}
--- END ---
Use ONLY information supported by the OCR text.
Return a complete JSON object matching the supplied schema.
Requirements:
- Write a useful 2-4 sentence child-friendly summary.
- Extract up to 6 important concepts.
- Extract up to 6 useful vocabulary words from the text.
- For each vocabulary word give a short meaning and phonetic pronunciation.
- Give up to 5 concrete learning objectives.
- Give up to 5 story themes that could be built from this section.
- Do not invent facts that are not supported by the OCR.
- Do not reproduce the OCR text.
- Keep strings concise.
- JSON ONLY.
`;
  try {
    const result = await generateWithOllama(prompt, {
      temperature: 0.08,
      numCtx: 4096,
      timeoutMs: 8 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 650,
      format: chapterSchema,
    });
    return normalizeChapterResult(
      extractJsonObject(result.text),
      chunk
    );
  } catch (firstError: any) {
    console.warn(
      `[QWEN] Invalid chapter JSON for ${chunk.chapterNumber}. Retrying with compact full-content schema...`,
      firstError?.message || firstError
    );
    const retryPrompt = `
Analyze this textbook section using ONLY the supplied text.
Section: ${chunk.chapterNumber} - ${chunk.chapterTitle}
Text:
${chunk.text.slice(0, 6000)}
Return ONLY valid JSON with exactly these fields:
{
  "primaryTopic": "short topic",
  "summary": "2 short sentences",
  "importantConcepts": ["up to 4 concepts"],
  "keyVocabulary": [
    {
      "word": "word from the text",
      "meaning": "short meaning",
      "phonetic": "short pronunciation"
    }
  ],
  "learningObjectives": ["up to 3 objectives"],
  "suggestedStoryThemes": ["up to 3 themes"]
}
Do not add commentary or Markdown.
`;
    try {
      const retry = await generateWithOllama(retryPrompt, {
        temperature: 0.05,
        numCtx: 4096,
        timeoutMs: 8 * 60 * 1000,
        keepAlive: "15m",
        numPredict: 450,
        format: {
          type: "object",
          additionalProperties: false,
          properties: {
            primaryTopic: { type: "string" },
            summary: { type: "string" },
            importantConcepts: {
              type: "array",
              maxItems: 4,
              items: { type: "string" },
            },
            keyVocabulary: {
              type: "array",
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  word: { type: "string" },
                  meaning: { type: "string" },
                  phonetic: { type: "string" },
                },
                required: ["word", "meaning", "phonetic"],
              },
            },
            learningObjectives: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
            suggestedStoryThemes: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
          },
          required: [
            "primaryTopic",
            "summary",
            "importantConcepts",
            "keyVocabulary",
            "learningObjectives",
            "suggestedStoryThemes",
          ],
        },
      });
      return normalizeChapterResult(
        extractJsonObject(retry.text),
        chunk
      );
    } catch (secondError: any) {
      console.warn(
        `[QWEN] Chapter analysis failed after retry for ${chunk.chapterNumber}. Returning OCR-backed fallback.`,
        secondError?.message || secondError
      );
      return buildFallbackChapterResult(chunk);
    }
  }
}
function combineTextbookAnalysis(
  metadata: any,
  chapters: any[],
  extractedText: string
): any {
  const first = chapters[0] || {};
  return normalizeTextbookAnalysis(
    {
      subject: metadata?.subject || "Unknown",
      grade: metadata?.grade || "Unknown",
      primaryLanguage: metadata?.primaryLanguage || "Unknown",
      bookTitle: metadata?.bookTitle || "",
      overallSummary:
        metadata?.overallSummary || first?.summary || "",
      chapters,
      importantEducationalContext: chapters
        .flatMap((chapter: any) => chapter?.importantConcepts || [])
        .slice(0, 12),
      teacherNotes: chapters
        .flatMap((chapter: any) => chapter?.learningObjectives || [])
        .slice(0, 10),
    },
    extractedText
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDoclingOcrJob(
  binaryData: Buffer,
  mimeType: string,
  fileName: string,
  jobId: string,
  language: string
): Promise<any> {
  const blob = new Blob([binaryData], {
    type: mimeType || "application/octet-stream",
  });

  const formData = new FormData();

  formData.append(
    "file",
    blob,
    fileName || "textbook.pdf"
  );
  // Which Tesseract language set Docling should OCR the page images with.
  // Telugu/Hindi textbook pages OCR as garbage (or empty) text under the
  // English-only language set, so the teacher's chosen textbook language
  // selects the right one (see backend/ocr/main.py's TESSERACT_LANG_MAP).
  formData.append("language", language);

  const createResponse = await fetch(
    `${OCR_SERVICE_URL}/ocr`,
    {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60 * 1000),
    }
  );

  const createRawText = await createResponse.text();

  if (!createResponse.ok) {
    throw new Error(
      `Docling OCR job creation returned ${createResponse.status}: ${createRawText.slice(
        0,
        1000
      )}`
    );
  }

  let createData: any;

  try {
    createData = JSON.parse(createRawText);
  } catch {
    throw new Error(
      "Docling OCR returned an invalid job-creation response."
    );
  }

  if (!createData?.success || !createData?.jobId) {
    throw new Error(
      createData?.error ||
        "Docling OCR did not return a job id."
    );
  }

  const doclingJobId = String(createData.jobId);

  updateJob(jobId, {
    status: "ocr",
    progress: 6,
    stageMessage:
      "Docling job started. Reading document pages...",
  });

  console.log(
    `[OCR] Job ${jobId}: Docling job ${doclingJobId} started.`
  );

  const startedAt = Date.now();
  // Docling's layout model + full-page OCR + picture extraction is heavier
  // per page than plain text recognition, so a 200-page textbook needs
  // real headroom here.
  const maxWaitMs = 90 * 60 * 1000;

  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(1000);

    const statusResponse = await fetch(
      `${OCR_SERVICE_URL}/ocr/status/${encodeURIComponent(
        doclingJobId
      )}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(30 * 1000),
      }
    );

    const statusRawText = await statusResponse.text();

    if (!statusResponse.ok) {
      throw new Error(
        `Docling OCR status returned ${statusResponse.status}: ${statusRawText.slice(
          0,
          1000
        )}`
      );
    }

    let statusData: any;

    try {
      statusData = JSON.parse(statusRawText);
    } catch {
      throw new Error(
        "Docling OCR returned an invalid status response."
      );
    }

    const ocrProgress = Number(
      statusData?.progress ?? 0
    );

    updateJob(jobId, {
      status: "ocr",
      progress: Math.max(
        7,
        Math.min(
          48,
          Math.round(
            7 + (ocrProgress / 100) * 41
          )
        )
      ),
      stageMessage:
        statusData?.stageMessage ||
        "Docling is processing the document...",
    });

    if (
      statusData?.status === "completed"
    ) {
      const chapterCount = Array.isArray(statusData?.chapters)
        ? statusData.chapters.length
        : 0;

      if (chapterCount === 0) {
        throw new Error(
          "Docling completed but returned no readable chapters."
        );
      }

      console.log(
        `[OCR] Job ${jobId}: Docling completed with ${chapterCount} chapters.`
      );

      return statusData;
    }

    if (
      statusData?.status === "failed"
    ) {
      throw new Error(
        statusData?.error ||
          "Docling OCR processing failed."
      );
    }

    if (
      statusData?.status === "lost"
    ) {
      throw new Error(
        statusData?.error ||
          "Docling OCR job was lost."
      );
    }
  }

  throw new Error(
    "Docling OCR took longer than 90 minutes. The OCR job was stopped by the backend."
  );
}

async function processTextbookJob(
  jobId: string,
  params: {
    fileData: string;
    mimeType: string;
    fileName: string;
    language: string;
  }
): Promise<void> {
  const { fileData, mimeType, fileName, language } = params;
  try {
    updateJob(jobId, {
      status: "ocr",
      progress: 5,
      stageMessage: "Reading every page with Docling...",
    });
    console.log(`[OCR] Job ${jobId}: Processing ${fileName}`);
    const binaryData = Buffer.from(
      cleanBase64(fileData),
      "base64"
    );

    updateJob(jobId, {
      status: "ocr",
      progress: 5,
      stageMessage:
        "Sending document to the asynchronous Docling OCR service...",
    });

    console.log(
      `[OCR] Job ${jobId}: Processing ${fileName}`
    );

    const ocrData = await runDoclingOcrJob(
      binaryData,
      mimeType,
      fileName,
      jobId,
      language
    );

    const chunks = chaptersFromDoclingResult(ocrData?.chapters);

    if (chunks.length === 0) {
      throw new Error(
        "Docling completed but no readable chapters were extracted from the document."
      );
    }

    // A single joined-up view of the whole book, used only as the Qwen
    // metadata prompt's sample and as the "full text" field for any
    // consumer that wants the entire extracted document at once. Every
    // chapter's own text/paragraphs/images (used everywhere else) come
    // straight from Docling's per-chapter structure, never from this join.
    const extractedText = chunks
      .map((chunk) => `${chunk.chapterTitle}\n\n${chunk.text}`)
      .join("\n\n\n");
    const imageCount = chunks.reduce(
      (sum, chunk) => sum + chunk.images.length,
      0
    );

    telemetryStats.totalOcrScans += 1;
    console.log(
      `[OCR] Job ${jobId}: ${chunks.length} Docling chapters, ${imageCount} images, ${extractedText.length} characters`
    );
    updateJob(jobId, {
      status: "ai",
      progress: 52,
      stageMessage: `OCR complete. Preparing ${chunks.length} textbook sections for Qwen...`,
    });
    let metadata: any;
    try {
      metadata = await analyzeBookMetadata(fileName, extractedText);
    } catch (metadataError: any) {
      // Ollama being unreachable must not throw away Docling's OCR results
      // (chapters/paragraphs/images already extracted successfully) — only
      // the AI-authored subject/grade/summary guess is lost, same principle
      // as buildFallbackChapterResult below for individual chapters.
      console.warn(
        `[QWEN] Job ${jobId}: book-metadata analysis failed (${
          metadataError?.message || metadataError
        }). Using a local fallback so OCR results are not lost.`
      );
      metadata = buildFallbackMetadata(fileName, chunks);
    }
    const chapters: any[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      updateJob(jobId, {
        status: "ai",
        progress: Math.max(
          58,
          Math.min(
            94,
            Math.round(
              58 + (index / Math.max(1, chunks.length)) * 36
            )
          )
        ),
        stageMessage:
          index < MAX_AI_ANALYZED_CHAPTERS
            ? `Qwen analyzing section ${index + 1} of ${chunks.length}...`
            : `Recording section ${index + 1} of ${chunks.length} (full text kept, AI summary skipped past ${MAX_AI_ANALYZED_CHAPTERS} sections)...`,
      });
      // Every detected chapter keeps its full OCR text and paragraphs
      // regardless of book length. Past this many chapters, skip the Ollama
      // round-trip (a 200-page book can legitimately detect 40+ sections,
      // and running a local LLM call for every single one would make a
      // large upload take unreasonably long) and use a lightweight local
      // summary instead, so nothing from the book goes missing — only the
      // AI-authored summary/vocabulary depth is bounded.
      const chapter =
        index < MAX_AI_ANALYZED_CHAPTERS
          ? await analyzeChapterChunk(chunks[index])
          : buildFallbackChapterResult(chunks[index]);
      chapters.push(chapter);
    }
    const analysis = combineTextbookAnalysis(
      metadata,
      chapters,
      extractedText
    );
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      stageMessage: "Textbook analysis completed.",
      result: {
        success: true,
        fileName: fileName || "textbook",
        ocr: {
          engine: "Docling",
          serviceUrl: OCR_SERVICE_URL,
          pages: typeof ocrData?.pages === "number" ? ocrData.pages : null,
          languagesUsed: Array.isArray(ocrData?.languagesUsed)
            ? ocrData.languagesUsed
            : [],
          characterCount: extractedText.length,
          extractedText,
          chunkCount: chunks.length,
          imageCount,
        },
        ai: {
          provider: "Ollama",
          model: OLLAMA_MODEL,
          serviceUrl: OLLAMA_BASE_URL,
        },
        analysis,
      },
    });
    console.log(
      `[QWEN] Job ${jobId}: Analysis completed successfully.`
    );
  } catch (error: any) {
    console.error(
      `[OCR/QWEN] Job ${jobId} failed:`,
      error
    );
    const message =
      error?.name === "TimeoutError"
        ? "The local Qwen model took too long to finish. Try again after Ollama is warm."
        : error?.message || "Failed to process textbook.";
    updateJob(jobId, {
      status: "failed",
      progress: 100,
      stageMessage: "Textbook processing failed.",
      error: message,
    });
  }
}
/* =========================================================
   TEXTBOOK OCR + OLLAMA EDUCATIONAL ANALYSIS
   POST returns immediately with a job id.
   GET /api/ocr/analyze-textbook/status/:jobId returns progress.
\\\\========================================================= */
// The Docling OCR service loads a separate Tesseract language set per
// script (see backend/ocr/main.py's TESSERACT_LANG_MAP). Telugu/Hindi
// pages OCR as empty or garbled text under the English-only set, so the
// teacher's chosen textbook language selects the right one.
const OCR_LANGUAGE_CODE_MAP: Record<string, string> = {
  Telugu: "telugu",
  Hindi: "hindi",
  English: "english",
};
app.post("/api/ocr/analyze-textbook", async (req, res) => {
  try {
    const { fileData, mimeType, fileName, language } = req.body;
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
    const ocrLanguageCode = OCR_LANGUAGE_CODE_MAP[language] || "english";
    const job = createJob(fileName || "textbook");
    console.log(
      `[OCR] Created textbook job ${job.id} for ${job.fileName} (language: ${ocrLanguageCode})`
    );
    // Do not await this. The browser gets the job id immediately.
    void processTextbookJob(job.id, {
      fileData,
      mimeType: safeMimeType,
      fileName: fileName || "textbook.pdf",
      language: ocrLanguageCode,
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
  "/api/ocr/analyze-textbook/status/:jobId",
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
/* =========================================================
   TEXTBOOK OCR + OLLAMA EDUCATIONAL ANALYSIS
   FLOW:
   Frontend
       â†“
   Node.js
       â†“
   Docling :8001
       â†“
   Chapters (headings, paragraphs, images)
       â†“
   Ollama / qwen2.5:3b
       â†“
   Educational context
\\\\========================================================= */
/* =========================================================
   READ-ALONG STORY GENERATION
\\\\========================================================= */
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
      const prompt = `
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
1. Write the story in ${targetLanguage}.
2. Structure the story into 4 to 6 sequential pages.
3. Each page must contain:
   - pageNumber
   - text
   - englishTranslation
   - transliteration
   - illustrationPrompt
   - suggestedSoundEffect
4. Include 3 comprehension questions.
5. Include 5-6 spotlight vocabulary words.
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
`;
      console.log(
        `[OLLAMA] Generating Read-Along story with ${OLLAMA_MODEL}...`
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
/* =========================================================
   AI PRONUNCIATION EVALUATION
\\\\========================================================= */
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
      const prompt = `
You are a supportive primary-school reading tutor.
Target sentence:
"${targetText}"
Recognized speech:
"${spokenText}"
Language:
${language}
Evaluate:
1. Approximate word accuracy percentage.
2. Matched words.
3. Missed words.
4. Mispronounced words.
5. Warm encouragement.
6. Encouragement in the native language.
7. A useful phonics tip.
8. Stars earned from 1 to 5.
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
`;
      console.log(
        `[OLLAMA] Evaluating pronunciation with ${OLLAMA_MODEL}...`
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
/* =========================================================
   SARVAM BULBUL V3 TEXT-TO-SPEECH
\\\\========================================================= */
app.post(
  "/api/speech/synthesize",
  async (req, res) => {
    try {
      const {
        text,
        language = "Telugu",
        voiceName = "Priya",
        style = "cheerful_teacher",
        pace = 1.0,
      } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({
          success: false,
          error: "Text is required for speech synthesis.",
        });
      }

      const apiKey = process.env.SARVAM_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "SARVAM_API_KEY is not configured in .env",
        });
      }

      const languageCodeMap: Record<string, string> = {
        Telugu: "te-IN",
        Hindi: "hi-IN",
        English: "en-IN",
      };

      // IMPORTANT: keep one real Sarvam speaker per visible voice name.
      // Do not remap different UI names to the same speaker by language.
      // This preserves distinct character identities across Telugu, Hindi and English.
      const speakerMap: Record<string, string> = {
        Priya: "priya",
        Shubh: "shubh",
        Neha: "neha",
        Ratan: "ratan",
        Ishita: "ishita",
        Suhani: "suhani",
      };

      const speaker = speakerMap[voiceName] || "priya";
      const languageCode = languageCodeMap[language] || "en-IN";

      const response = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model: "bulbul:v3",
          language_code: languageCode,
          speaker,
          pace: Math.max(0.5, Math.min(2.0, Number(pace) || 1.0)),
          temperature: 0.55,
          speech_sample_rate: 24000,
          ...(process.env.SARVAM_PRONUNCIATION_DICT_ID
            ? { dict_id: process.env.SARVAM_PRONUNCIATION_DICT_ID }
            : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Sarvam TTS Error:", data);
        return res.status(response.status).json({
          success: false,
          error:
            data?.error?.message ||
            data?.message ||
            "Sarvam TTS request failed.",
        });
      }

      const audioBase64 = data?.audios?.[0];
      if (!audioBase64) {
        return res.status(500).json({
          success: false,
          error: "Sarvam returned no audio.",
        });
      }

      res.json({
        success: true,
        audioBase64,
        mimeType: "audio/wav",
        sampleRate: 24000,
        voiceName,
        speaker,
        language,
        languageCode,
        style,
      });
    } catch (error: any) {
      console.error("Speech Synthesis Error:", error);
      res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to synthesize speech using Sarvam TTS.",
      });
    }
  }
);
/* =========================================================
   SARVAM SAARAS V4 SPEECH-TO-TEXT
\\\\========================================================= */
app.post(
  "/api/speech/transcribe",
  async (req, res) => {
    try {
      const {
        audioBase64,
        mimeType = "audio/webm",
        language = "Telugu",
      } = req.body;
      const normalizedMimeType =
        String(mimeType).split(";")[0].trim() || "audio/webm";

      if (!audioBase64 || typeof audioBase64 !== "string") {
        return res.status(400).json({
          success: false,
          error: "audioBase64 is required.",
        });
      }

      const apiKey = process.env.SARVAM_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "SARVAM_API_KEY is not configured in .env",
        });
      }

      const languageCodeMap: Record<string, string> = {
        Telugu: "te-IN",
        Hindi: "hi-IN",
        English: "en-IN",
      };
      const languageCode = languageCodeMap[language] || "en-IN";

      const buffer = Buffer.from(audioBase64, "base64");
      const form = new FormData();
      form.append(
        "file",
        new Blob([buffer], { type: normalizedMimeType }),
        "reading.webm"
      );
      form.append("model", "saaras:v4");
      form.append("mode", "transcribe");
      form.append("language_code", languageCode);

      const response = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": apiKey },
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Sarvam STT Error:", data);
        return res.status(response.status).json({
          success: false,
          error:
            data?.error?.message ||
            data?.message ||
            "Sarvam STT request failed.",
        });
      }

      res.json({
        success: true,
        transcript: data?.transcript || "",
        languageCode: data?.language_code || languageCode,
        languageProbability: data?.language_probability ?? null,
      });
    } catch (error: any) {
      console.error("Speech Transcription Error:", error);
      res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to transcribe speech using Sarvam STT.",
      });
    }
  }
);
/* =========================================================
   VITE / PRODUCTION
\\\\========================================================= */
async function startServer() {
  if (
    process.env.NODE_ENV !==
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
    app.get("*", (_req, res) => {
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
        "      PHATAN SHAKTI BACKEND"
      );
      console.log(
        "========================================"
      );
      console.log(
        `Frontend/Backend : http://localhost:${PORT}`
      );
      console.log(
        `Docling OCR      : ${OCR_SERVICE_URL}`
      );
      console.log(
        `Ollama           : ${OLLAMA_BASE_URL}`
      );
      console.log(
        `Ollama Model     : ${OLLAMA_MODEL}`
      );
      console.log(
        `Sarvam TTS/STT   : ${
          process.env.SARVAM_API_KEY ? "configured" : "SARVAM_API_KEY missing"
        }`
      );
      console.log(
        "Firebase routes   : /api/*"
      );
      console.log(
        "Textbook OCR      : /api/ocr/analyze-textbook"
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
