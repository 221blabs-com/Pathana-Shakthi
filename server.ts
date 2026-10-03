import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import firebaseRouter, {
  optionalFirebaseUser,
  requireFirebaseUser,
  requireProfile,
  requireRole,
  AuthenticatedRequest,
} from "./server/firebaseRoutes";
import { cleanTableMarkdown, stripUnreadableGlyphs } from "./src/services/publishedReadingToStory";
import studentRouter from "./server/studentRoutes";
import classRouter, { createClassPlanRouter } from "./server/classRoutes";
import schoolRouter from "./server/schoolRoutes";
import dictionaryRouter from "./server/dictionary";
import { createTutorRouter } from "./server/tutorRoutes";
import { rateLimit, securityHeaders } from "./server/security";
import { getFirebaseAdmin } from "./server/firebaseAdmin";
import type { DocumentSnapshot, Query as FirestoreQuery } from "firebase-admin/firestore";
import {
  DetectedChapter,
  DetectedChapterTable,
  MAX_AI_ANALYZED_CHAPTERS,
  buildChapterBatches,
  buildFallbackMetadata,
  BOOK_SUBJECTS,
  BookChapterPlan,
  applyBookStructure,
  applyChapterRefinements,
  buildRefinementOutline,
  cleanBookChapters,
  pagesOf,
  scriptLanguage,
  type ChapterRefinement,
  buildBookOutline,
  chaptersFromDoclingResult,
  matchChapterBatchResults,
  normalizeChapterResult,
  stripClosingRemarkQuestions,
  joinPageBreakParagraphs,
  splitLongChapter,
  maxChapterWordsForGrade,
} from "./server/textbookOcr";
import { speechLanguageCodeFor } from "./server/speechLanguage";
import {
  generateJsonWithGemini,
  geminiOcrModels,
  geminiTextModels,
  isGeminiConfigured,
  providerMode,
  runGeminiOcr,
  synthesizeSpeechWithGemini,
  transcribeAudioWithGemini,
} from "./server/geminiAi";

// SPEECH_PROVIDER: "auto" (default) = Sarvam first, Gemini when Sarvam fails
// (no credits, outage, missing key); "sarvam" = never Gemini; "gemini" = skip Sarvam.
function speechProviderMode(): "auto" | "sarvam" | "gemini" {
  const value = String(process.env.SPEECH_PROVIDER || "").trim().toLowerCase();
  return value === "sarvam" || value === "gemini" ? value : "auto";
}
dotenv.config();
// A misconfigured or unreachable Google credential (e.g. Firestore's gRPC
// client failing to resolve Application Default Credentials) can throw
// inside firebase-admin's/google-gax's internal machinery as an unhandled
// promise rejection, outside any route's own try/catch — Node's default
// behavior is to crash the entire process on that, taking down every
// connected user for one bad request. Log it and stay up instead; a route
// that genuinely needs Firebase and can't reach it already returns a clean
// 401/503 via requireFirebaseUser's own try/catch — this is a backstop for
// failures that happen outside that promise chain, not a replacement for it.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
// Same reasoning as above, for the synchronous-throw counterpart. Logging
// and continuing (rather than exiting) is deliberate: nothing in front of
// this process restarts it automatically in this app's deployment model
// (plain `node dist/server.cjs`), so exiting here means real downtime for
// every user until someone notices and restarts it by hand.
process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});
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
// Behind Render's proxy: req.ip must be the client, not the proxy, for the
// per-client rate limits in server/security.ts.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
// Request bodies are small except for uploads: a textbook PDF (OCR), a
// published book's images, and recorded audio. Everything else gets 1 MB so
// a client can't make the server buffer huge JSON on any route.
const largeJson = express.json({ limit: "100mb" });
const audioJson = express.json({ limit: "15mb" });
const smallJson = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  const p = req.path;
  if (p === "/api/ocr/analyze-textbook" || p.startsWith("/api/readings/publish")) return largeJson(req, res, next);
  if (p.startsWith("/api/speech/")) return audioJson(req, res, next);
  return smallJson(req, res, next);
});
app.use(express.urlencoded({ limit: "1mb", extended: true }));
// A generous overall ceiling per client; tighter limits sit on the costly
// routes (OCR, AI, speech, login).
app.use("/api", rateLimit("api", 600, 60_000));
app.use("/api", firebaseRouter);
app.use("/api", studentRouter);
app.use("/api", classRouter);
app.use("/api", dictionaryRouter);
// generateWithOllama is a hoisted function declaration further down.
app.use("/api", createTutorRouter((prompt, options) => generateWithOllama(prompt, options as TextGenerationOptions)));
app.use("/api", schoolRouter);
app.use("/api", createClassPlanRouter((prompt, options) => generateWithOllama(prompt, options as TextGenerationOptions)));
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
const AI_SYSTEM_INSTRUCTION =
  "You are a reliable educational AI assistant. Follow the user's requested JSON structure exactly. Return only valid JSON with no markdown fences or commentary.";

type TextGenerationOptions = {
  temperature?: number;
  numCtx?: number;
  timeoutMs?: number;
  keepAlive?: string;
  numPredict?: number;
  format?: any;
  /** Someone is waiting on screen (tutor, class plan): fail fast on quota. */
  interactive?: boolean;
};

// After Ollama fails once, skip it for a while instead of paying its
// connection/timeout cost on every one of a textbook's batch calls.
const OLLAMA_COOLDOWN_MS = 5 * 60 * 1000;
let ollamaCooldownUntil = 0;
// Until the first generation runs, report the engine that will actually be
// used (Gemini when AI_TEXT_PROVIDER=gemini), not always the Ollama model.
let lastTextModelUsed =
  providerMode(process.env.AI_TEXT_PROVIDER) === "gemini" && isGeminiConfigured()
    ? geminiTextModels()[0]
    : OLLAMA_MODEL;

// AI_TEXT_PROVIDER: "auto" (default) = Ollama first, Gemini when Ollama
// fails; "local" = Ollama only; "gemini" = Gemini only.
async function generateWithOllama(
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<{ text: string; model: string }> {
  const mode = providerMode(process.env.AI_TEXT_PROVIDER);
  const geminiReady = isGeminiConfigured();
  const useOllamaFirst =
    mode === "local" ||
    (mode === "auto" && (!geminiReady || Date.now() >= ollamaCooldownUntil));

  if (useOllamaFirst) {
    try {
      const result = await callOllamaChat(prompt, options);
      lastTextModelUsed = result.model;
      return result;
    } catch (error: any) {
      if (mode === "local" || !geminiReady) throw error;
      ollamaCooldownUntil = Date.now() + OLLAMA_COOLDOWN_MS;
      console.warn(
        `[AI] Ollama failed (${String(error?.message || error).slice(0, 200)}). Using Gemini for the next ${OLLAMA_COOLDOWN_MS / 60000} minutes.`
      );
    }
  }

  const result = await generateJsonWithGemini(prompt, {
    systemInstruction: AI_SYSTEM_INSTRUCTION,
    temperature: options.temperature,
    jsonSchema: typeof options.format === "object" ? options.format : undefined,
    ...(options.interactive ? { interactive: true, timeoutMs: Math.min(options.timeoutMs ?? 30_000, 45_000) } : {}),
  });
  lastTextModelUsed = result.model;
  return result;
}

async function callOllamaChat(
  prompt: string,
  options: TextGenerationOptions
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
          content: AI_SYSTEM_INSTRUCTION,
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
// Counted since this server process started (in-memory, reset on restart).
const telemetryStats = {
  totalOcrScans: 0,
  totalStoriesGenerated: 0,
  totalSpeechEvaluations: 0,
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
  async (_req, res) => {
    // Real counts from Firestore; null when Firestore can't be reached,
    // never a made-up number.
    let publishedReadings: number | null = null;
    const publishedByLanguage: Record<string, number> = {};
    let facultyAccounts: number | null = null;
    let schoolsWithAccounts: number | null = null;
    try {
      const { db } = getFirebaseAdmin();
      const [readingsSnap, usersSnap] = await Promise.all([
        db.collection(READINGS_COLLECTION).select("language").get(),
        db.collection("users").select("role", "schoolId").get(),
      ]);
      publishedReadings = readingsSnap.size;
      readingsSnap.forEach((d) => {
        const language = String(d.get("language") || "Other");
        publishedByLanguage[language] = (publishedByLanguage[language] || 0) + 1;
      });
      const users = usersSnap.docs.map((d) => d.data());
      facultyAccounts = users.filter((u) => u.role === "faculty").length;
      schoolsWithAccounts = new Set(
        users.map((u) => u.schoolId).filter((id) => id && id !== "all")
      ).size;
    } catch (error: any) {
      console.warn("[TELEMETRY] Firestore counts unavailable:", error?.message || error);
    }
    res.json({
      serverStatus: "healthy",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      providers: {
        ocr: providerMode(process.env.OCR_PROVIDER),
        text: providerMode(process.env.AI_TEXT_PROVIDER),
        speech: speechProviderMode(),
      },
      geminiConfigured: isGeminiConfigured(),
      sarvamConfigured: Boolean(process.env.SARVAM_API_KEY),
      geminiTextModels: geminiTextModels(),
      geminiOcrModels: geminiOcrModels(),
      lastTextModelUsed,
      ...telemetryStats,
      publishedReadings,
      publishedByLanguage,
      facultyAccounts,
      schoolsWithAccounts,
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
app.get("/api/ai/providers", (_req, res) => {
  res.json({
    geminiConfigured: isGeminiConfigured(),
    ocrProvider: providerMode(process.env.OCR_PROVIDER),
    textProvider: providerMode(process.env.AI_TEXT_PROVIDER),
    geminiTextModels: geminiTextModels(),
    geminiOcrModels: geminiOcrModels(),
    ollamaCoolingDown: Date.now() < ollamaCooldownUntil,
    lastTextModelUsed,
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
// Reads the whole book's outline and returns its real chapters (see
// applyBookStructure in server/textbookOcr.ts) plus book-level metadata.
async function structureBookWithAi(
  fileName: string,
  sections: DetectedChapter[],
  teacherLanguage: string
): Promise<{
  plan: BookChapterPlan[];
  bookTitle: string;
  grade: string;
  primaryLanguage: string;
  overallSummary: string;
}> {
  const outline = buildBookOutline(sections, sections.length > 120 ? 90 : 160);
  const prompt = `
You are organising a scanned school textbook into its real chapters for a primary-school reading app.
File name: ${fileName || "textbook"}
Teacher-selected main language: ${teacherLanguage}

Below is every section the OCR detected, in page order: [index] page "printed heading" (size): text preview.
Headings come from the layout detector, so they include sub-headings (exercises, new words, activities, stanza titles), running titles, cover and contents pages.
--- OUTLINE ---
${outline}
--- END ---

Group the sections into the book's REAL units a child would read as one chapter:
- A lesson/story/poem and all its sub-sections (exercises, activities, new words, questions) form ONE chapter.
- A poetry book: each poem is its own chapter.
- Mark cover/title page, preface, foreword, acknowledgements, table of contents, syllabus and index pages with kind "front_matter", "contents", "index" or "back_matter" so they are not shown to students.
- A page that only introduces a unit/part/section of the book (its name, a one-line tagline, a count like "9 POEMS") is kind "section_divider", never a lesson or poem.
- Every section index from 0 to ${sections.length - 1} must fall in exactly one range; ranges are contiguous and in order.
- "subject" must be one of: ${BOOK_SUBJECTS.join(", ")} (a language reader/poems book is its language: Telugu, Hindi or English; EVS/environment/science -> Science; history/civics/geography -> Social; mathematics -> Maths). Integrated textbooks can have different subjects per chapter.
- "chapterNumber": the printed lesson number if any (e.g. "పాఠం 3", "Lesson 2", "पाठ 4"), else "Chapter N" counting only real chapters.
- "title": the chapter's real title, without the number.
Also give: bookTitle, grade ("Class 1".."Class 5" or "Unknown"), primaryLanguage (Telugu | Hindi | English | Bilingual), overallSummary (2-3 sentences about the whole book).
Return ONLY JSON.
`;
  const schema = {
    type: "object",
    properties: {
      bookTitle: { type: "string" },
      grade: { type: "string" },
      primaryLanguage: { type: "string" },
      overallSummary: { type: "string" },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chapterNumber: { type: "string" },
            title: { type: "string" },
            subject: { type: "string", enum: BOOK_SUBJECTS },
            kind: {
              type: "string",
              enum: ["lesson", "story", "poem", "exercise", "section_divider", "front_matter", "contents", "index", "back_matter"],
            },
            startSection: { type: "integer" },
            endSection: { type: "integer" },
          },
          required: ["chapterNumber", "title", "subject", "kind", "startSection", "endSection"],
        },
      },
    },
    required: ["bookTitle", "grade", "primaryLanguage", "overallSummary", "chapters"],
  };
  const result = await generateWithOllama(prompt, {
    temperature: 0.05,
    numCtx: 16384,
    timeoutMs: 8 * 60 * 1000,
    keepAlive: "15m",
    format: schema,
  });
  const parsed = extractJsonObject(result.text);
  const plan: BookChapterPlan[] = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  if (plan.length === 0) throw new Error("Book-structure analysis returned no chapters.");
  return {
    plan,
    bookTitle: String(parsed?.bookTitle || ""),
    grade: String(parsed?.grade || "Unknown"),
    primaryLanguage: String(parsed?.primaryLanguage || "Unknown"),
    overallSummary: String(parsed?.overallSummary || ""),
  };
}

// Second AI look at the book, after chapters are known: which "chapters"
// are really section title pages or back matter, which paragraphs are not
// text a child reads aloud (labels, notes, a title's translation, credits),
// and each chapter's clean title/subtitle. ~40 chapters per request (one
// request for most books); a failed request leaves those chapters as the
// rule-based cleanup left them.
async function refineBookWithAi(chapters: DetectedChapter[]): Promise<ChapterRefinement[]> {
  const CHUNK = 40;
  const refinements: ChapterRefinement[] = [];
  for (let offset = 0; offset < chapters.length; offset += CHUNK) {
    const slice = chapters.slice(offset, offset + CHUNK);
    const prompt = `
You are cleaning up a scanned book's chapters for a primary-school read-aloud app. A child reads every paragraph aloud and is scored word by word, so anything that is not the chapter's real body text must be removed.

Chapters, in order: [chapterIndex] "title" kind, then each paragraph as (paragraphIndex) text (previews may be cut with …):
--- CHAPTERS ---
${buildRefinementOutline(slice)}
--- END ---

For EVERY chapter return:
- chapterIndex: as given.
- kind: "section_divider" if it is only a section/unit title page (a name, a tagline, a count of poems/lessons) rather than a real piece to read; "back_matter" for about-the-author/credits/links pages; "front_matter" for cover/preface; otherwise poem, story, lesson or exercise.
- title: the clean title in its own language (drop page numbers, and drop an English translation that was appended to it).
- subtitle: a translation or tagline of the title if the chapter has one (e.g. "That girl", "Moment by moment"), else "".
- script: "romanized_hindi" if the body is Hindi/Urdu written in Latin letters (e.g. "Woh ladki ek khwab thi"), "romanized_telugu" for Telugu in Latin letters, "english" for English, "native" for text already in Telugu or Devanagari script.
- removeParagraphs: indices of paragraphs that are NOT body text: the title's translation/tagline (put it in subtitle instead), section or category labels, counters, page numbers, "unfinished"/editor notes, "about"/credits/links sections, running headers. Keep every line of the actual poem/story/lesson, even short ones. [] if nothing to remove.
Return ONLY JSON.
`;
    const schema = {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              chapterIndex: { type: "integer" },
              script: { type: "string", enum: ["native", "english", "romanized_hindi", "romanized_telugu"] },
              kind: {
                type: "string",
                enum: ["poem", "story", "lesson", "exercise", "section_divider", "front_matter", "back_matter"],
              },
              title: { type: "string" },
              subtitle: { type: "string" },
              removeParagraphs: { type: "array", items: { type: "integer" } },
            },
            required: ["chapterIndex", "script", "kind", "title", "subtitle", "removeParagraphs"],
          },
        },
      },
      required: ["chapters"],
    };
    try {
      const result = await generateWithOllama(prompt, {
        temperature: 0.05,
        numCtx: 16384,
        timeoutMs: 6 * 60 * 1000,
        keepAlive: "15m",
        format: schema,
      });
      const parsed = extractJsonObject(result.text);
      for (const r of Array.isArray(parsed?.chapters) ? parsed.chapters : []) {
        if (Number.isInteger(r?.chapterIndex) && r.chapterIndex >= 0 && r.chapterIndex < slice.length) {
          refinements.push({ ...r, chapterIndex: r.chapterIndex + offset });
        }
      }
    } catch (error: any) {
      console.warn(
        `[AI] Book refinement failed for chapters ${offset + 1}-${offset + slice.length}: ${error?.message || error}`
      );
    }
  }
  return refinements;
}

// Hindi/Telugu printed in Latin letters is rewritten in its own script
// (transliterated, never translated): children learn to read the real
// script, and speech recognition for Hindi/Telugu answers in that script, so
// Latin text could never be matched word for word. Up to 8 chapters per
// request; a chapter whose result does not line up is left as it was.
async function transliterateChapters(chapters: DetectedChapter[]): Promise<number> {
  // Also chapters whose text is already Devanagari/Telugu but whose title is
  // still in Latin letters ("Milo Ya Na Milo").
  const textLanguage = (c: DetectedChapter) => scriptLanguage(c.paragraphs.join(" "));
  for (const c of chapters) {
    const lang = textLanguage(c);
    if (!c.romanizedLanguage && (lang === "Hindi" || lang === "Telugu") && scriptLanguage(c.chapterTitle) === "English") {
      c.romanizedLanguage = lang;
    }
  }
  const todo = chapters.filter(
    (c) => c.romanizedLanguage && (textLanguage(c) === "English" || scriptLanguage(c.chapterTitle) === "English")
  );
  // Models sometimes emit a CJK full stop for the danda.
  const tidy = (text: string) => text.replace(/。/g, "।").trim();
  let converted = 0;
  for (let offset = 0; offset < todo.length; offset += 8) {
    const batch = todo.slice(offset, offset + 8);
    const prompt = `
Rewrite each text below in its native script: Hindi/Urdu in Devanagari, Telugu in Telugu script.
TRANSLITERATE, do not translate: keep every word, line break (\\n), punctuation mark and paragraph exactly; only change the letters.
Use standard spellings a school book would print (Hindi: है, नहीं, ज़िंदगी, मोहब्बत; nukta where standard).
The "title" MUST be rewritten in the native script as well, even when the paragraphs already are (e.g. "Milo Ya Na Milo" -> "मिलो या न मिलो").
Paragraphs already in the native script are returned unchanged.
Return the same number of paragraphs for each chapter, in order.
${JSON.stringify(
      batch.map((c, i) => ({ id: i, language: c.romanizedLanguage, title: c.chapterTitle, paragraphs: c.paragraphs })),
      null,
      1
    )}
Return ONLY JSON: {"chapters":[{"id":0,"title":"...","paragraphs":["..."]}]}
`;
    const schema = {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              title: { type: "string" },
              paragraphs: { type: "array", items: { type: "string" } },
            },
            required: ["id", "title", "paragraphs"],
          },
        },
      },
      required: ["chapters"],
    };
    try {
      const result = await generateWithOllama(prompt, {
        temperature: 0,
        numCtx: 16384,
        timeoutMs: 6 * 60 * 1000,
        keepAlive: "15m",
        numPredict: 8000,
        format: schema,
      });
      for (const item of extractJsonObject(result.text)?.chapters || []) {
        const chapter = batch[Number(item?.id)];
        const paragraphs: string[] = Array.isArray(item?.paragraphs) ? item.paragraphs.map((p: any) => tidy(String(p))) : [];
        if (!chapter || paragraphs.length !== chapter.paragraphs.length) continue;
        if (!paragraphs.every((p) => scriptLanguage(p) === chapter.romanizedLanguage)) continue;
        const title = tidy(String(item?.title || ""));
        const titleChanged = Boolean(title) && scriptLanguage(title) === chapter.romanizedLanguage && title !== chapter.chapterTitle;
        const textChanged = paragraphs.join("\n") !== chapter.paragraphs.join("\n");
        if (!titleChanged && !textChanged) continue;
        if (!chapter.subtitle) chapter.subtitle = chapter.chapterTitle;
        if (titleChanged) chapter.chapterTitle = title;
        chapter.paragraphs = paragraphs;
        chapter.text = paragraphs.join("\n\n");
        chapter.language = chapter.romanizedLanguage;
        // A Hindi poem filed under the English tile belongs under Hindi.
        if (chapter.subject === "English") chapter.subject = chapter.romanizedLanguage;
        converted += 1;
      }
    } catch (error: any) {
      console.warn(`[AI] Transliteration failed for ${batch.length} chapters: ${error?.message || error}`);
    }
  }
  return converted;
}

// Rules first (always), then the AI refinement on top.
async function cleanUpBookChapters(
  chapters: DetectedChapter[],
  logPrefix: string
): Promise<{ chapters: DetectedChapter[]; aiRefined: boolean }> {
  const ruled = cleanBookChapters(chapters);
  const refinements = await refineBookWithAi(ruled.chapters);
  const refined = applyChapterRefinements(ruled.chapters, refinements);
  const transliterated = await transliterateChapters(refined.chapters);
  if (transliterated > 0) console.log(`[AI] ${logPrefix}: ${transliterated} chapters rewritten from Latin letters into their own script.`);
  console.log(
    `[AI] ${logPrefix}: cleanup ${chapters.length} -> ${refined.chapters.length} chapters ` +
      `(rules removed ${ruled.removedParagraphs} lines; AI dropped ${refined.droppedChapters} section/back pages ` +
      `and ${refined.removedParagraphs} non-body lines; ${refinements.length}/${ruled.chapters.length} chapters refined).`
  );
  return { chapters: refined.chapters, aiRefined: refinements.length > 0 };
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
// Deeper per-chapter analysis fields, shared by the single-chapter and
// batched analysis schemas (see normalizeChapterResult for the output).
const DEEP_ANALYSIS_PROPERTIES = {
  keyPoints: { type: "array", maxItems: 6, items: { type: "string" } },
  themes: { type: "array", maxItems: 4, items: { type: "string" } },
  moralOrMessage: { type: "string" },
  difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
  teachingTips: { type: "array", maxItems: 4, items: { type: "string" } },
  discussionQuestions: { type: "array", maxItems: 4, items: { type: "string" } },
};
const DEEP_ANALYSIS_REQUIRED = Object.keys(DEEP_ANALYSIS_PROPERTIES);
const DEEP_ANALYSIS_INSTRUCTIONS = `- keyPoints: up to 6 short points covering what the chapter actually says, in order.
- themes: up to 4 one-to-three word themes.
- moralOrMessage: the chapter's message or moral in one sentence ("" if it has none, e.g. a maths exercise).
- difficulty: Easy, Medium or Hard for a primary-school child reading it aloud.
- teachingTips: up to 4 practical tips (in English) for the teacher teaching this chapter.
- discussionQuestions: up to 4 open questions to discuss after reading, answerable from the text.
- Write summary, keyPoints, moralOrMessage and discussionQuestions in the chapter's own language.`;

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
      ...DEEP_ANALYSIS_PROPERTIES,
    },
    required: [
      "primaryTopic",
      "summary",
      "importantConcepts",
      "keyVocabulary",
      "learningObjectives",
      "suggestedStoryThemes",
      ...DEEP_ANALYSIS_REQUIRED,
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
${DEEP_ANALYSIS_INSTRUCTIONS}
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
      numPredict: 1200,
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
async function analyzeChapterBatch(
  batch: DetectedChapter[]
): Promise<any[]> {
  if (batch.length === 1) {
    return [await analyzeChapterChunk(batch[0])];
  }
  // More chapters sharing one call means less excerpt per chapter, same
  // principle as the single-chapter path's 8500-char cap — this only bounds
  // what the AI summary sees, never the chapter's real stored text.
  const perChapterCharBudget =
    batch.length <= 2 ? 5500 : batch.length === 3 ? 4000 : 3200;
  const chapterItemSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      chapterIndex: { type: "integer" },
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
      ...DEEP_ANALYSIS_PROPERTIES,
    },
    required: [
      ...DEEP_ANALYSIS_REQUIRED,
      "chapterIndex",
      "primaryTopic",
      "summary",
      "importantConcepts",
      "keyVocabulary",
      "learningObjectives",
      "suggestedStoryThemes",
    ],
  };
  const promptChapters = batch
    .map(
      (chunk, index) => `--- CHAPTER ${index} ---
${chunk.chapterNumber} - ${chunk.chapterTitle}
OCR text:
${chunk.text.slice(0, perChapterCharBudget)}
--- END CHAPTER ${index} ---`
    )
    .join("\n\n");
  const prompt = `
Analyze these ${batch.length} textbook sections for a primary-school educational platform.
${promptChapters}
Use ONLY information supported by each chapter's own OCR text — never mix facts between chapters.
Return a JSON object with a "chapters" array containing exactly ${batch.length} entries, one per chapter above, each tagged with the matching "chapterIndex" (0 to ${batch.length - 1}).
For each chapter:
- Write a useful 2-4 sentence child-friendly summary.
- Extract up to 6 important concepts.
- Extract up to 6 useful vocabulary words, each with a short meaning and phonetic pronunciation.
- Give up to 5 concrete learning objectives.
- Give up to 5 story themes that could be built from this section.
${DEEP_ANALYSIS_INSTRUCTIONS}
- Do not invent facts that are not supported by that chapter's OCR text.
- Do not reproduce the OCR text.
- Keep strings concise.
- JSON ONLY.
`;
  try {
    const result = await generateWithOllama(prompt, {
      temperature: 0.08,
      numCtx: 8192,
      timeoutMs: 10 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 1200 * batch.length,
      format: {
        type: "object",
        additionalProperties: false,
        properties: {
          chapters: {
            type: "array",
            items: chapterItemSchema,
          },
        },
        required: ["chapters"],
      },
    });
    const parsed = extractJsonObject(result.text);
    const items: any[] = Array.isArray(parsed?.chapters)
      ? parsed.chapters
      : [];
    return matchChapterBatchResults(batch, items, buildFallbackChapterResult);
  } catch (error: any) {
    console.warn(
      `[QWEN] Batch chapter analysis failed for ${batch.length} chapters starting at ${batch[0]?.chapterNumber}. Returning OCR-backed fallback for all of them.`,
      error?.message || error
    );
    return batch.map((chunk) => buildFallbackChapterResult(chunk));
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

// Statuses a hosted OCR service returns while it is asleep, waking up, or
// briefly overloaded (Render's free tier spins services down after 15 idle
// minutes and answers 429/502/503 until the container is back).
const TRANSIENT_OCR_STATUSES = new Set([429, 502, 503, 504]);

async function waitForOcrServiceAwake(
  jobId: string,
  maxWaitMs = 3 * 60 * 1000
): Promise<void> {
  const startedAt = Date.now();
  let delayMs = 2000;
  let lastProblem = "";
  let refusedCount = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const response = await fetch(`${OCR_SERVICE_URL}/`, {
        method: "GET",
        signal: AbortSignal.timeout(30 * 1000),
      });
      if (response.ok) return;
      lastProblem = `HTTP ${response.status}`;
      if (!TRANSIENT_OCR_STATUSES.has(response.status)) break;
    } catch (error: any) {
      lastProblem = error?.cause?.code || error?.message || String(error);
      // Nothing listening at all (not a sleeping host, which still answers
      // 429/503): don't wait out the full cold-start window.
      if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/.test(lastProblem) && ++refusedCount >= 3) {
        break;
      }
    }

    updateJob(jobId, {
      status: "ocr",
      progress: 3,
      stageMessage:
        "Waking up the OCR service (can take up to a minute after it has been idle)...",
    });
    console.log(
      `[OCR] Job ${jobId}: OCR service not ready (${lastProblem}), retrying in ${delayMs}ms.`
    );
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 15000);
  }

  throw new Error(
    `OCR service at ${OCR_SERVICE_URL} did not become ready (${lastProblem || "timed out"}).`
  );
}

async function runDoclingOcrJob(
  binaryData: Buffer,
  mimeType: string,
  fileName: string,
  jobId: string,
  language: string,
  maxWakeWaitMs: number
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
  // Selects the EasyOCR language group (backend/ocr/main.py's
  // EASYOCR_LANG_GROUPS); Telugu/Hindi pages OCR as garbage under English-only.
  formData.append("language", language);

  await waitForOcrServiceAwake(jobId, maxWakeWaitMs);

  let createResponse!: Response;
  let createRawText = "";

  for (let attempt = 1; attempt <= 4; attempt++) {
    createResponse = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60 * 1000),
    });
    createRawText = await createResponse.text();

    if (!TRANSIENT_OCR_STATUSES.has(createResponse.status) || attempt === 4) {
      break;
    }
    console.log(
      `[OCR] Job ${jobId}: job creation got ${createResponse.status}, retry ${attempt}/3.`
    );
    await sleep(5000 * attempt);
  }

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
  let consecutiveTransientFailures = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(consecutiveTransientFailures > 0 ? 5000 : 2000);

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

    if (
      TRANSIENT_OCR_STATUSES.has(statusResponse.status) &&
      ++consecutiveTransientFailures <= 12
    ) {
      continue;
    }

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

// OCR_PROVIDER: "auto" (default) = local Docling service first, Gemini when
// it is unreachable, crashes, or reads nothing; "local" = Docling only;
// "gemini" = Gemini only (for hosts too small to run the Docling service).
async function runOcrWithFallback(
  jobId: string,
  binaryData: Buffer,
  mimeType: string,
  fileName: string,
  language: string
): Promise<any> {
  const mode = providerMode(process.env.OCR_PROVIDER);
  const geminiReady = isGeminiConfigured();

  if (mode === "gemini" && !geminiReady) {
    throw new Error(
      "OCR_PROVIDER is set to gemini but GEMINI_API_KEY is not configured."
    );
  }

  if (mode !== "gemini") {
    try {
      return await runDoclingOcrJob(
        binaryData,
        mimeType,
        fileName,
        jobId,
        language,
        // With a fallback available, don't make the teacher wait out a
        // long cold start before switching.
        geminiReady && mode === "auto" ? 90 * 1000 : 3 * 60 * 1000
      );
    } catch (error: any) {
      if (mode === "local" || !geminiReady) throw error;
      console.warn(
        `[OCR] Job ${jobId}: local OCR service failed (${String(error?.message || error).slice(0, 300)}). Falling back to Gemini OCR.`
      );
    }
  }

  updateJob(jobId, {
    status: "ocr",
    progress: 6,
    stageMessage: "Reading pages with Gemini OCR...",
  });
  const result = await runGeminiOcr(
    binaryData,
    mimeType,
    fileName,
    language,
    (completedPages, totalPages) => {
      updateJob(jobId, {
        status: "ocr",
        progress: Math.round(7 + (completedPages / Math.max(totalPages, 1)) * 41),
        stageMessage: `Gemini OCR read ${completedPages} of ${totalPages} page${totalPages === 1 ? "" : "s"}...`,
      });
    }
  );
  console.log(
    `[OCR] Job ${jobId}: Gemini OCR (${result.model}) read ${result.pages} pages into ${result.chapters.length} sections` +
      (result.failedPages.length
        ? `; unreadable pages: ${result.failedPages.join(", ")}`
        : ".")
  );
  return result;
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
      stageMessage: "Starting OCR...",
    });
    console.log(`[OCR] Job ${jobId}: Processing ${fileName}`);
    const binaryData = Buffer.from(
      cleanBase64(fileData),
      "base64"
    );

    const ocrData = await runOcrWithFallback(
      jobId,
      binaryData,
      mimeType,
      fileName,
      language
    );
    const ocrEngine =
      ocrData?.engine === "gemini" ? `Gemini (${ocrData.model})` : "Docling";

    const rawSections = chaptersFromDoclingResult(ocrData?.chapters);

    if (rawSections.length === 0) {
      throw new Error(
        "OCR completed but no readable text was extracted from the document."
      );
    }

    // AI pass: turn raw heading-by-heading sections into the book's real
    // chapters (merging sub-sections, dropping cover/contents/index pages)
    // and label each chapter's subject. Falls back to the raw sections.
    let chunks = rawSections;
    let bookStructure: Awaited<ReturnType<typeof structureBookWithAi>> | null = null;
    let skippedSectionCount = 0;
    if (rawSections.length > 1) {
      updateJob(jobId, {
        status: "ai",
        progress: 50,
        stageMessage: `AI is reading the book's ${rawSections.length} sections to find its real chapters and subjects...`,
      });
      try {
        bookStructure = await structureBookWithAi(
          fileName,
          rawSections,
          { telugu: "Telugu", hindi: "Hindi", english: "English" }[language] || "Unknown"
        );
        const applied = applyBookStructure(rawSections, bookStructure.plan);
        chunks = applied.chapters;
        skippedSectionCount = applied.skippedSections.length;
        console.log(
          `[AI] Job ${jobId}: book structure ${rawSections.length} raw sections -> ${chunks.length} chapters (${skippedSectionCount} front/back-matter sections skipped).`
        );
      } catch (structureError: any) {
        console.warn(
          `[AI] Job ${jobId}: book-structure pass failed (${structureError?.message || structureError}); using raw OCR sections.`
        );
      }
    }

    updateJob(jobId, {
      status: "ai",
      progress: 55,
      stageMessage: `Cleaning up ${chunks.length} chapters: removing page labels, section pages and notes...`,
    });
    chunks = (await cleanUpBookChapters(chunks, `Job ${jobId}`)).chapters;

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
      stageMessage: `OCR complete. Preparing ${chunks.length} textbook sections for AI analysis...`,
    });
    let metadata: any;
    try {
      if (bookStructure) {
        const subjectCounts = new Map<string, number>();
        chunks.forEach((chunk) => {
          if (chunk.subject) subjectCounts.set(chunk.subject, (subjectCounts.get(chunk.subject) || 0) + 1);
        });
        const mainSubject = [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        metadata = {
          subject: mainSubject || "Unknown",
          grade: bookStructure.grade,
          primaryLanguage: bookStructure.primaryLanguage,
          bookTitle: bookStructure.bookTitle || fileName,
          overallSummary: bookStructure.overallSummary,
        };
      } else {
        metadata = await analyzeBookMetadata(fileName, extractedText);
      }
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
    // Every detected chapter keeps its full OCR text and paragraphs
    // regardless of book length. Past MAX_AI_ANALYZED_CHAPTERS, skip the
    // Ollama round-trip entirely (a 200-page book can legitimately detect
    // 40+ sections) and use a lightweight local summary instead, so nothing
    // from the book goes missing — only the AI-authored summary/vocabulary
    // depth is bounded. The chapters that DO get analyzed are grouped into
    // batches (see buildChapterBatches/analyzeChapterBatch) so a large
    // textbook doesn't pay one Ollama round-trip per chapter.
    const chaptersForAi = chunks.slice(0, MAX_AI_ANALYZED_CHAPTERS);
    const chaptersPastLimit = chunks.slice(MAX_AI_ANALYZED_CHAPTERS);
    const batches = buildChapterBatches(chaptersForAi);
    let analyzedCount = 0;
    for (const batch of batches) {
      updateJob(jobId, {
        status: "ai",
        progress: Math.max(
          58,
          Math.min(
            94,
            Math.round(
              58 + (analyzedCount / Math.max(1, chunks.length)) * 36
            )
          )
        ),
        stageMessage: `AI analyzing sections ${analyzedCount + 1}-${
          analyzedCount + batch.length
        } of ${chunks.length}...`,
      });
      const batchResults = await analyzeChapterBatch(batch);
      chapters.push(...batchResults);
      analyzedCount += batch.length;
    }
    if (chaptersPastLimit.length > 0) {
      updateJob(jobId, {
        status: "ai",
        progress: 94,
        stageMessage: `Recording remaining ${chaptersPastLimit.length} sections (full text kept, AI summary skipped past ${MAX_AI_ANALYZED_CHAPTERS} sections)...`,
      });
      chapters.push(
        ...chaptersPastLimit.map((chunk) => buildFallbackChapterResult(chunk))
      );
    }
    const analysis = {
      ...combineTextbookAnalysis(metadata, chapters, extractedText),
      rawSectionCount: rawSections.length,
      skippedSectionCount,
      aiStructured: Boolean(bookStructure),
    };
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      stageMessage: "Textbook analysis completed.",
      result: {
        success: true,
        fileName: fileName || "textbook",
        ocr: {
          engine: ocrEngine,
          serviceUrl:
            ocrData?.engine === "gemini" ? "gemini" : OCR_SERVICE_URL,
          pages: typeof ocrData?.pages === "number" ? ocrData.pages : null,
          languagesUsed: Array.isArray(ocrData?.languagesUsed)
            ? ocrData.languagesUsed
            : [],
          failedPages: Array.isArray(ocrData?.failedPages)
            ? ocrData.failedPages
            : [],
          characterCount: extractedText.length,
          extractedText,
          chunkCount: chunks.length,
          imageCount,
        },
        ai: {
          provider: /^gemini/i.test(lastTextModelUsed) ? "Gemini" : "Ollama",
          model: lastTextModelUsed,
          serviceUrl: /^gemini/i.test(lastTextModelUsed)
            ? "gemini"
            : OLLAMA_BASE_URL,
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
// The Docling OCR service loads a separate EasyOCR language group per
// script (see backend/ocr/main.py's EASYOCR_LANG_GROUPS). Telugu/Hindi
// pages OCR as empty or garbled text under the English-only set, so the
// teacher's chosen textbook language selects the right one.
const OCR_LANGUAGE_CODE_MAP: Record<string, string> = {
  Telugu: "telugu",
  Hindi: "hindi",
  English: "english",
};
app.post(
  "/api/ocr/analyze-textbook",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  rateLimit("ocr", 8, 10 * 60_000),
  async (req, res) => {
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
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
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
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  rateLimit("story-ai", 10, 60_000),
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
   PUBLISHED READINGS
   A teacher-published textbook chapter: the REAL OCR'd paragraphs, images,
   and tables a student reads, persisted server-side (Firestore) so it
   survives across devices/browsers and can be filtered by grade — unlike
   the AI-invented stories above, which only ever exist in the browser's
   localStorage and are shown to every student regardless of grade.
   Ollama's role here is narrow and grounded: generate a comprehension quiz
   FROM the real paragraphs, never invent new narrative content.
\\\\========================================================= */
const READINGS_COLLECTION = "publishedReadings";
const VALID_GRADES = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
];

const QUIZ_VERSION = 2;

const SCRIPT_OF: Record<string, string> = {
  Telugu: "Telugu script (తెలుగు లిపి)",
  Hindi: "Devanagari script (देवनागरी)",
  English: "English",
};

type QuizQuestion = {
  question: string;
  questionEnglish?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};

function cleanQuizQuestions(raw: any[]): QuizQuestion[] {
  return stripClosingRemarkQuestions(Array.isArray(raw) ? raw : [])
    .map((q: any) => ({
      question: String(q?.question || "").trim(),
      // Firestore rejects undefined values, so omit the field when absent.
      ...(q?.questionEnglish ? { questionEnglish: String(q.questionEnglish).trim() } : {}),
      options: Array.isArray(q?.options) ? q.options.slice(0, 4).map((o: any) => String(o).trim()) : [],
      correctOptionIndex:
        Number.isInteger(q?.correctOptionIndex) && q.correctOptionIndex >= 0 && q.correctOptionIndex < 4
          ? q.correctOptionIndex
          : -1,
      explanation: String(q?.explanation || "").trim(),
    }))
    .filter(
      (q) =>
        q.question &&
        q.options.length === 4 &&
        new Set(q.options.map((o: string) => o.toLowerCase())).size === 4 &&
        q.correctOptionIndex >= 0
    );
}

// Comprehension questions grounded in the chapter's real text, in the
// chapter's own language and script. Two passes: write 5 candidates under
// strict rules, then a checker re-reads the passage and keeps, fixes or
// drops each one (a real published quiz once asked "Whose role in the film
// Missamma…" with the actress and her character both among the options).
async function generateQuizFromRealText(
  paragraphs: string[],
  chapterTitle: string,
  language: string
): Promise<QuizQuestion[]> {
  const text = paragraphs.join("\n\n").slice(0, 6000);
  const lang = SCRIPT_OF[language] ? language : "English";
  const script = SCRIPT_OF[lang];
  const questionSchema = {
    type: "object",
    properties: {
      question: { type: "string" },
      questionEnglish: { type: "string" },
      options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
      correctOptionIndex: { type: "integer" },
      explanation: { type: "string" },
    },
    required: ["question", "questionEnglish", "options", "correctOptionIndex", "explanation"],
  };
  const candidatesSchema = {
    type: "object",
    properties: { questions: { type: "array", minItems: 3, maxItems: 5, items: questionSchema } },
    required: ["questions"],
  };
  const prompt = `
Write reading-comprehension questions for a primary-school child about this chapter.
Chapter: ${chapterTitle}
Passage:
--- BEGIN ---
${text}
--- END ---
Write 5 questions. Each has 4 different options and exactly one correct option (correctOptionIndex, 0-based).

LANGUAGE: write "question", every option and "explanation" in ${lang}, in ${script}. Put an English translation of the question in "questionEnglish".${
    lang !== "English" ? ` Do not write the question or options in English or in Latin letters.` : ""
  }

QUALITY RULES:
- Ask about something the passage clearly states: a person, action, reason, place, feeling or meaning. Use ONLY the passage; never add outside facts.
- Exactly one option must be correct according to the passage, and a careful reader must agree it is the only right one.
- Word the question so it can only be understood one way. Name who you mean ("What role did Savitri play in Missamma?" — never a vague "Whose role…").
- All 4 options must be the same kind of thing (all character names, or all places, or all actions). Never mix e.g. an actress's name with the names of the characters she played.
- Wrong options must be believable but clearly wrong according to the passage.
- Mix question types: a detail (who/what/where), a reason (why), and the meaning or feeling of the passage.
- Put the correct answer in different positions across questions.
- Never write a closing or meta remark as a question ("shall we read another story?").
Return ONLY JSON.
`;
  const first = await generateWithOllama(prompt, {
    temperature: 0.25,
    numCtx: 6144,
    timeoutMs: 5 * 60 * 1000,
    keepAlive: "15m",
    numPredict: 1600,
    format: candidatesSchema,
  });
  const candidates = cleanQuizQuestions(extractJsonObject(first.text)?.questions);
  if (candidates.length === 0) return [];

  const reviewSchema = {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            verdict: { type: "string", enum: ["keep", "fix", "drop"] },
            reason: { type: "string" },
            fixed: questionSchema,
          },
          required: ["index", "verdict", "reason"],
        },
      },
    },
    required: ["reviews"],
  };
  const reviewPrompt = `
You are checking a reading quiz for primary-school children against its passage. Be strict.
Passage:
--- BEGIN ---
${text}
--- END ---
Questions (JSON, correctOptionIndex is 0-based):
${JSON.stringify(candidates.map((q, index) => ({ index, ...q })), null, 1)}

For each question decide:
- "keep": the question has one clear meaning, the marked option is correct according to the passage, no other option could also be argued correct, all options are the same kind of thing, and it is written in ${lang} (${script}).
- "fix": it can be repaired — give the corrected full question in "fixed" (same rules, in ${lang} with questionEnglish in English).
- "drop": the passage does not support a clear answer.
Say why in "reason". Return ONLY JSON.
`;
  let reviewed: QuizQuestion[] = [];
  try {
    const review = await generateWithOllama(reviewPrompt, {
      temperature: 0,
      numCtx: 8192,
      timeoutMs: 5 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 2000,
      format: reviewSchema,
    });
    const reviews: any[] = extractJsonObject(review.text)?.reviews || [];
    const byIndex = new Map(reviews.map((r) => [Number(r?.index), r]));
    for (const [index, candidate] of candidates.entries()) {
      const r = byIndex.get(index);
      if (!r || r.verdict === "keep") {
        reviewed.push(candidate);
      } else if (r.verdict === "fix") {
        const [fixed] = cleanQuizQuestions([r.fixed]);
        if (fixed) reviewed.push(fixed);
      }
    }
    const dropped = candidates.length - reviewed.length;
    if (dropped > 0) console.log(`[AI] Quiz check for "${chapterTitle}": ${dropped} of ${candidates.length} questions dropped.`);
  } catch (error: any) {
    console.warn(`[AI] Quiz check failed for "${chapterTitle}" (${error?.message || error}); using unchecked questions.`);
    reviewed = candidates;
  }
  // Wrong-script questions are useless to a Telugu/Hindi reader.
  const inScript = reviewed.filter((q) => lang === "English" || scriptLanguage(q.question) === lang);
  return (inScript.length >= 3 ? inScript : reviewed).slice(0, 3);
}

class PublishValidationError extends Error {}

const stringArray = (value: any, max: number): string[] =>
  Array.isArray(value)
    ? value.map((v: any) => String(v ?? "").trim()).filter(Boolean).slice(0, max)
    : [];

// Validates one chapter, generates its quiz from the real paragraphs, and
// writes the reading doc (+ image subcollection). Shared by single-chapter
// and whole-book publishing.
async function savePublishedChapter(
  req: AuthenticatedRequest,
  input: any,
  book: { bookId: string; chapterOrder: number; chapterCount: number } | null
): Promise<{ id: string; quizGenerated: boolean }> {
  const {
    grade,
    subject,
    language,
    bookTitle,
    chapterNumber,
    chapterTitle,
    paragraphs,
    images,
    tables,
    primaryTopic,
    summary,
    importantConcepts,
    keyVocabulary,
    learningObjectives,
  } = input || {};

  if (!VALID_GRADES.includes(grade)) {
    throw new PublishValidationError(`grade must be one of: ${VALID_GRADES.join(", ")}`);
  }
  if (
    !chapterTitle ||
    !Array.isArray(paragraphs) ||
    paragraphs.filter((p: any) => String(p || "").trim()).length === 0
  ) {
    throw new PublishValidationError(
      "chapterTitle and at least one non-empty paragraph are required."
    );
  }

  const inputPages: any[] = Array.isArray(input?.paragraphPages) ? input.paragraphPages : [];
  const kept = paragraphs
    .map((p: any, i: number) => ({
      // Undecodable font glyphs (■■■■) can't be read aloud; never store them.
      text: stripUnreadableGlyphs(String(p || "")).trim(),
      page: typeof inputPages[i] === "number" ? inputPages[i] : null,
    }))
    .filter((p: { text: string }) => p.text);
  const joined = joinPageBreakParagraphs(
    kept.map((p: { text: string }) => p.text),
    kept.map((p: { page: number | null }) => p.page)
  );
  const cleanParagraphs: string[] = joined.paragraphs;
  const paragraphPages: (number | null)[] = joined.pages;
  const cleanTables: DetectedChapterTable[] = (Array.isArray(tables) ? tables : [])
    .filter((t: any) => typeof t?.markdown === "string" && t.markdown.trim())
    .map((t: any) => ({
      markdown: cleanTableMarkdown(String(t.markdown).trim()),
      pageNumber: typeof t.pageNumber === "number" ? t.pageNumber : null,
      caption: String(t?.caption || ""),
    }))
    .filter((t: DetectedChapterTable) => t.markdown);
  const cleanImages = (Array.isArray(images) ? images : []).filter(
    (img: any) => typeof img?.base64 === "string" && img.base64
  );

  let quiz: Awaited<ReturnType<typeof generateQuizFromRealText>> = [];
  try {
    quiz = await generateQuizFromRealText(
      cleanParagraphs,
      chapterTitle,
      scriptLanguage(cleanParagraphs.join(" ")) || language || "English"
    );
  } catch (quizError: any) {
    // An AI failure must not block publishing real, already-OCR'd content.
    console.warn(
      "[AI] Quiz generation failed for a published reading. Publishing without a quiz.",
      quizError?.message || quizError
    );
  }

  const { db } = getFirebaseAdmin();
  const ref = db.collection(READINGS_COLLECTION).doc();
  const doc = {
    schoolId: req.appUser?.schoolId || null,
    teacherId: req.firebaseUser.uid,
    teacherName: req.appUser?.name || null,
    grade,
    subject: String(subject || "General"),
    // The chapter's own script decides (a Telugu poem in a book uploaded as
    // "English" must be listened to in Telugu); the upload language is only
    // the fallback for text with no letters.
    language: scriptLanguage(cleanParagraphs.join(" ")) || String(language || "English"),
    part: String(input?.part || ""),
    subtitle: String(input?.subtitle || ""),
    paragraphPages,
    bookTitle: String(bookTitle || "Textbook"),
    chapterNumber: String(chapterNumber || ""),
    chapterTitle: String(chapterTitle),
    paragraphs: cleanParagraphs,
    tables: cleanTables,
    primaryTopic: String(primaryTopic || ""),
    summary: String(summary || ""),
    importantConcepts: stringArray(importantConcepts, 6),
    keyVocabulary: Array.isArray(keyVocabulary)
      ? keyVocabulary.slice(0, 8).map((v: any) => ({
          word: String(v?.word || ""),
          meaning: String(v?.meaning || ""),
          phonetic: String(v?.phonetic || ""),
        }))
      : [],
    learningObjectives: stringArray(learningObjectives, 5),
    keyPoints: stringArray(input?.keyPoints, 8),
    themes: stringArray(input?.themes, 5),
    moralOrMessage: String(input?.moralOrMessage || ""),
    difficulty: ["Easy", "Medium", "Hard"].includes(input?.difficulty) ? input.difficulty : "",
    discussionQuestions: stringArray(input?.discussionQuestions, 5),
    kind: String(input?.kind || "lesson"),
    estimatedReadingMinutes: Number(input?.estimatedReadingMinutes) || null,
    // Whole-book publishing: which book this chapter belongs to and where.
    bookId: book?.bookId || null,
    chapterOrder: book ? book.chapterOrder : null,
    chapterCount: book ? book.chapterCount : null,
    comprehensionQuiz: quiz,
    quizVersion: quiz.length > 0 ? QUIZ_VERSION : 0,
    imageCount: cleanImages.length,
    createdAt: new Date().toISOString(),
  };

  await ref.set(doc);

  // Images live in a subcollection, one document each — a chapter with
  // several compressed JPEGs could otherwise approach Firestore's 1 MiB
  // document limit, and students only fetch them when they open a reading.
  if (cleanImages.length > 0) {
    const writer = db.bulkWriter();
    for (const img of cleanImages) {
      writer.set(ref.collection("images").doc(randomUUID()), {
        base64: img.base64,
        mimeType: img.mimeType || "image/jpeg",
        pageNumber: typeof img.pageNumber === "number" ? img.pageNumber : null,
        caption: String(img?.caption || ""),
      });
    }
    await writer.close();
  }

  return { id: ref.id, quizGenerated: quiz.length > 0 };
}

app.post(
  "/api/readings/publish",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  rateLimit("publish", 20, 60_000),
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await savePublishedChapter(req, req.body, null);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof PublishValidationError) {
        return res.status(400).json({ success: false, error: error.message });
      }
      console.error("Publish Reading Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to publish reading.",
      });
    }
  }
);

// Publishes every chapter of an analysed book at once, in reading order, so
// students see the whole book (Subject -> Book -> Chapter 1..N) instead of
// one loose chapter at a time.
app.post(
  "/api/readings/publish-book",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  rateLimit("publish", 20, 60_000),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { grade, language, bookTitle, chapters } = req.body || {};
      if (!VALID_GRADES.includes(grade)) {
        return res.status(400).json({
          success: false,
          error: `grade must be one of: ${VALID_GRADES.join(", ")}`,
        });
      }
      // Sentences split by a page break are joined, then a chapter too long
      // for one sitting in this class becomes parts at printed-page
      // boundaries (an 11-page story used to be one 150-page reading).
      const maxWords = maxChapterWordsForGrade(grade);
      const publishable = (Array.isArray(chapters) ? chapters : [])
        .filter(
          (c: any) =>
            c?.chapterTitle &&
            Array.isArray(c?.paragraphs) &&
            c.paragraphs.some((p: any) => String(p || "").trim())
        )
        .flatMap((c: any) => {
          const joined = joinPageBreakParagraphs(
            c.paragraphs.map((p: any) => String(p || "")),
            c.paragraphs.map((_: any, i: number) => (typeof c.paragraphPages?.[i] === "number" ? c.paragraphPages[i] : null))
          );
          return splitLongChapter({ ...c, paragraphs: joined.paragraphs, paragraphPages: joined.pages }, maxWords);
        });
      if (publishable.length === 0) {
        return res.status(400).json({ success: false, error: "No chapters with text to publish." });
      }

      const bookId = randomUUID();
      const results: Array<{ id: string; quizGenerated: boolean } | { error: string }> =
        new Array(publishable.length);
      let next = 0;
      // A few chapters at a time: each one waits on its quiz generation.
      await Promise.all(
        Array.from({ length: Math.min(2, publishable.length) }, async () => {
          while (next < publishable.length) {
            const index = next++;
            try {
              results[index] = await savePublishedChapter(
                req,
                { ...publishable[index], grade, bookTitle, language: publishable[index].language || language },
                { bookId, chapterOrder: index + 1, chapterCount: publishable.length }
              );
            } catch (error: any) {
              console.error(`Publish Book chapter ${index + 1} failed:`, error?.message || error);
              results[index] = { error: error?.message || "Failed to publish chapter." };
            }
          }
        })
      );
      const published = results.filter((r) => "id" in r).length;
      const withoutQuiz = results.filter((r) => "id" in r && !r.quizGenerated).length;
      console.log(`[PUBLISH] Book "${bookTitle}" (${grade}): ${published}/${publishable.length} chapters published as ${bookId}` + (withoutQuiz ? `, ${withoutQuiz} without a quiz.` : "."));
      return res.status(published > 0 ? 200 : 500).json({
        success: published > 0,
        bookId,
        published,
        withoutQuiz,
        total: publishable.length,
        results,
      });
    } catch (error: any) {
      console.error("Publish Book Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to publish book." });
    }
  }
);

// Students only ever see their own class's readings.
function studentMayRead(req: AuthenticatedRequest, reading: any): boolean {
  if (req.appUser?.role !== "student") return true;
  if (reading?.grade !== req.appUser.grade) return false;
  return !reading?.schoolId || !req.appUser.schoolId || reading.schoolId === req.appUser.schoolId;
}

app.get(
  "/api/readings",
  requireFirebaseUser,
  requireProfile,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      const grade =
        req.appUser?.role === "student"
          ? String(req.appUser.grade || "none")
          : typeof req.query.grade === "string"
          ? req.query.grade
          : undefined;
      const subject =
        typeof req.query.subject === "string" ? req.query.subject : undefined;

      let query: FirestoreQuery = db.collection(READINGS_COLLECTION);
      if (grade) query = query.where("grade", "==", grade);
      if (subject) query = query.where("subject", "==", subject);
      // Scope to the requesting user's own school when known, so one
      // school's published readings never leak into another's library.
      const schoolId = req.appUser?.schoolId;
      if (schoolId) query = query.where("schoolId", "==", schoolId);

      const snap = await query.limit(200).get();
      const readings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      return res.json({
        success: true,
        readings: readings.map((r: any) => ({
          id: r.id,
          grade: r.grade,
          subject: r.subject,
          language: r.language,
          bookTitle: r.bookTitle,
          chapterNumber: r.chapterNumber,
          chapterTitle: r.chapterTitle,
          summary: r.summary,
          imageCount: r.imageCount || 0,
          teacherName: r.teacherName,
          createdAt: r.createdAt,
          bookId: r.bookId || null,
          chapterOrder: r.chapterOrder ?? null,
          chapterCount: r.chapterCount ?? null,
          kind: r.kind || "lesson",
          difficulty: r.difficulty || "",
          estimatedReadingMinutes: r.estimatedReadingMinutes ?? null,
          part: r.part || "",
          subtitle: r.subtitle || "",
          // A few words per chapter for the student's Word Dictionary.
          keyVocabulary: (Array.isArray(r.keyVocabulary) ? r.keyVocabulary : [])
            .slice(0, 8)
            .map((v: any) => ({ word: String(v?.word || ""), meaning: String(v?.meaning || "") }))
            .filter((v: { word: string }) => v.word),
        })),
      });
    } catch (error: any) {
      console.error("List Readings Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to list published readings.",
      });
    }
  }
);

app.get(
  "/api/readings/:id",
  requireFirebaseUser,
  requireProfile,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      const snap = await db.collection(READINGS_COLLECTION).doc(req.params.id).get();
      if (!snap.exists || !studentMayRead(req, snap.data())) {
        return res.status(404).json({ success: false, error: "Reading not found." });
      }
      return res.json({ success: true, reading: { id: snap.id, ...snap.data() } });
    } catch (error: any) {
      console.error("Get Reading Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to load reading.",
      });
    }
  }
);

app.get(
  "/api/readings/:id/images",
  requireFirebaseUser,
  requireProfile,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      if (req.appUser?.role === "student") {
        const reading = await db.collection(READINGS_COLLECTION).doc(req.params.id).get();
        if (!reading.exists || !studentMayRead(req, reading.data())) {
          return res.status(404).json({ success: false, error: "Reading not found." });
        }
      }
      const snap = await db
        .collection(READINGS_COLLECTION)
        .doc(req.params.id)
        .collection("images")
        .get();
      return res.json({
        success: true,
        images: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    } catch (error: any) {
      console.error("Get Reading Images Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to load reading images.",
      });
    }
  }
);

app.delete(
  "/api/readings/:id",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      const ref = db.collection(READINGS_COLLECTION).doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, error: "Reading not found." });
      }
      const data = snap.data();
      const role = req.appUser?.role;
      const isOwner = data?.teacherId === req.firebaseUser.uid;
      if (!isOwner && role !== "admin" && role !== "superadmin") {
        return res.status(403).json({
          success: false,
          error: "Only the publishing teacher or a school admin can remove this reading.",
        });
      }

      const imagesSnap = await ref.collection("images").get();
      const writer = db.bulkWriter();
      imagesSnap.docs.forEach((d) => writer.delete(d.ref));
      await writer.close();
      await ref.delete();

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Reading Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to remove reading.",
      });
    }
  }
);

// Removes every chapter of a published book (e.g. before re-publishing a
// corrected scan), with the same permission rule as single deletes.
app.delete(
  "/api/readings/book/:bookId",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      const snap = await db
        .collection(READINGS_COLLECTION)
        .where("bookId", "==", req.params.bookId)
        .get();
      if (snap.empty) {
        return res.status(404).json({ success: false, error: "Book not found." });
      }
      const role = req.appUser?.role;
      const allowed = snap.docs.every(
        (d) => d.get("teacherId") === req.firebaseUser.uid || role === "admin" || role === "superadmin"
      );
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: "Only the publishing teacher or a school admin can remove this book.",
        });
      }
      const writer = db.bulkWriter();
      for (const d of snap.docs) {
        const images = await d.ref.collection("images").get();
        images.docs.forEach((img) => writer.delete(img.ref));
        writer.delete(d.ref);
      }
      await writer.close();
      return res.json({ success: true, deleted: snap.size });
    } catch (error: any) {
      console.error("Delete Book Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to remove book." });
    }
  }
);

/* ---------------------------------------------------------------
   Teacher management of published books: list what I published, move a
   book to another class, add the comprehension questions that could not
   be generated at publish time (AI quota/overload), delete. A "book key"
   is the bookId, or "reading:<id>" for an older single-chapter publish.
---------------------------------------------------------------- */
// A chapter's quiz needs (re)making when it has none, was made before the
// checked two-pass generator, or is in a different script than the text.
function quizIsStale(d: DocumentSnapshot): boolean {
  const quiz = d.get("comprehensionQuiz");
  if (!Array.isArray(quiz) || quiz.length === 0) return true;
  if ((Number(d.get("quizVersion")) || 0) < QUIZ_VERSION) return true;
  const language = String(d.get("language") || "");
  return (language === "Telugu" || language === "Hindi") && scriptLanguage(String(quiz[0]?.question || "")) !== language;
}

async function readingsForBookKey(key: string) {
  const { db } = getFirebaseAdmin();
  if (key.startsWith("reading:")) {
    const snap = await db.collection(READINGS_COLLECTION).doc(key.slice("reading:".length)).get();
    return snap.exists ? [snap] : [];
  }
  const snap = await db.collection(READINGS_COLLECTION).where("bookId", "==", key).get();
  return snap.docs;
}

function canManageReadings(req: AuthenticatedRequest, docs: DocumentSnapshot[]) {
  const role = req.appUser?.role;
  if (role === "superadmin") return true;
  if (role === "admin") {
    const schoolId = req.appUser?.schoolId;
    return !schoolId || docs.every((d) => !d.get("schoolId") || d.get("schoolId") === schoolId);
  }
  return docs.every((d) => d.get("teacherId") === req.firebaseUser.uid);
}

app.get(
  "/api/readings/books/mine",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { db } = getFirebaseAdmin();
      const role = req.appUser?.role;
      let query: FirestoreQuery = db.collection(READINGS_COLLECTION);
      if (role === "faculty") {
        query = query.where("teacherId", "==", req.firebaseUser.uid);
      } else if (role === "admin" && req.appUser?.schoolId) {
        query = query.where("schoolId", "==", req.appUser.schoolId);
      }
      const snap = await query.limit(1000).get();
      const books = new Map<string, any>();
      for (const d of snap.docs) {
        const r = d.data();
        const key = r.bookId || `reading:${d.id}`;
        let book = books.get(key);
        if (!book) {
          book = {
            key,
            bookTitle: r.bookTitle || "Textbook",
            grades: new Set<string>(),
            subjects: new Set<string>(),
            chapterCount: 0,
            missingQuiz: 0,
            staleQuiz: 0,
            teacherName: r.teacherName || null,
            createdAt: r.createdAt || "",
          };
          books.set(key, book);
        }
        book.chapterCount += 1;
        book.grades.add(r.grade);
        book.subjects.add(r.subject);
        if (!Array.isArray(r.comprehensionQuiz) || r.comprehensionQuiz.length === 0) book.missingQuiz += 1;
        if (quizIsStale(d)) book.staleQuiz += 1;
        if ((r.createdAt || "") > book.createdAt) book.createdAt = r.createdAt;
      }
      const list = [...books.values()]
        .map((b) => ({ ...b, grades: [...b.grades].sort(), subjects: [...b.subjects].sort() }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.json({ success: true, books: list });
    } catch (error: any) {
      console.error("List My Books Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to list books." });
    }
  }
);

app.patch(
  "/api/readings/books/:key",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const grade = req.body?.grade;
      if (!VALID_GRADES.includes(grade)) {
        return res.status(400).json({ success: false, error: `grade must be one of: ${VALID_GRADES.join(", ")}` });
      }
      const docs = await readingsForBookKey(req.params.key);
      if (docs.length === 0) return res.status(404).json({ success: false, error: "Book not found." });
      if (!canManageReadings(req, docs)) {
        return res.status(403).json({ success: false, error: "Only the publishing teacher or a school admin can change this book." });
      }
      const { db } = getFirebaseAdmin();
      const batch = db.batch();
      docs.forEach((d) => batch.update(d.ref, { grade }));
      await batch.commit();
      console.log(`[PUBLISH] Book ${req.params.key}: moved ${docs.length} chapters to ${grade}.`);
      return res.json({ success: true, updated: docs.length, grade });
    } catch (error: any) {
      console.error("Move Book Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to move book." });
    }
  }
);

app.post(
  "/api/readings/books/:key/fill-quizzes",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const docs = await readingsForBookKey(req.params.key);
      if (docs.length === 0) return res.status(404).json({ success: false, error: "Book not found." });
      if (!canManageReadings(req, docs)) {
        return res.status(403).json({ success: false, error: "Only the publishing teacher or a school admin can change this book." });
      }
      // mode "stale" (default) also remakes quizzes from the older unchecked
      // generator or in the wrong script; "missing" only fills empty ones.
      const mode = req.body?.mode === "missing" ? "missing" : "stale";
      const missing = docs.filter((d) => {
        const quiz = d.get("comprehensionQuiz");
        return mode === "stale" ? quizIsStale(d) : !Array.isArray(quiz) || quiz.length === 0;
      });
      let filled = 0;
      let lastError = "";
      // One chapter at a time: this runs exactly when the AI is short on
      // quota, and the model chain waits out per-minute limits in between.
      for (const d of missing) {
        try {
          const quiz = await generateQuizFromRealText(
            (d.get("paragraphs") || []) as string[],
            String(d.get("chapterTitle") || ""),
            scriptLanguage(((d.get("paragraphs") || []) as string[]).join(" ")) || String(d.get("language") || "English")
          );
          if (quiz.length > 0) {
            await d.ref.update({ comprehensionQuiz: quiz, quizVersion: QUIZ_VERSION });
            filled += 1;
          }
        } catch (error: any) {
          lastError = String(error?.message || error).slice(0, 300);
          // Out of daily quota: every further call would fail the same way.
          if (/over its quota|PerDay|daily/i.test(lastError)) break;
        }
      }
      console.log(`[AI] Book ${req.params.key}: filled ${filled}/${missing.length} missing quizzes.`);
      return res.json({
        success: true,
        missing: missing.length,
        filled,
        stillMissing: missing.length - filled,
        ...(filled < missing.length && lastError ? { error: lastError } : {}),
      });
    } catch (error: any) {
      console.error("Fill Quizzes Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to add questions." });
    }
  }
);

// Re-runs the cleanup pipeline (rules + AI refinement) over an already
// published book: drops section title pages and back matter, strips labels
// and notes from the text, sets parts/subtitles/languages, renumbers, and
// fills in deep analysis for chapters that were published without it (the
// AI was over quota). Chapters keep their ids, so student progress stays.
app.post(
  "/api/readings/books/:key/clean",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const docs = await readingsForBookKey(req.params.key);
      if (docs.length === 0) return res.status(404).json({ success: false, error: "Book not found." });
      if (!canManageReadings(req, docs)) {
        return res.status(403).json({ success: false, error: "Only the publishing teacher or a school admin can change this book." });
      }
      const ordered = [...docs].sort(
        (a, b) => (Number(a.get("chapterOrder")) || 0) - (Number(b.get("chapterOrder")) || 0)
      );
      const asChapters = ordered.map((d) => {
        const paragraphs = ((d.get("paragraphs") || []) as string[]).map(String);
        return {
          sourceId: d.id,
          chapterNumber: String(d.get("chapterNumber") || ""),
          chapterTitle: String(d.get("chapterTitle") || ""),
          text: paragraphs.join("\n\n"),
          paragraphs,
          paragraphPages: (d.get("paragraphPages") || []) as (number | null)[],
          images: [],
          tables: (d.get("tables") || []) as DetectedChapterTable[],
          pageNumber: null,
          subject: String(d.get("subject") || ""),
          kind: String(d.get("kind") || "lesson"),
          part: String(d.get("part") || "") || undefined,
          subtitle: String(d.get("subtitle") || "") || undefined,
          language: String(d.get("language") || "") || undefined,
        } as DetectedChapter & { sourceId: string };
      });
      const { chapters: cleaned } = await cleanUpBookChapters(asChapters, `Book ${req.params.key}`);
      const keptIds = new Set(cleaned.map((c: any) => c.sourceId));

      // Chapters published without deep analysis get it now (batched).
      const needAnalysis = cleaned.filter((c: any) => {
        const doc = ordered.find((d) => d.id === c.sourceId);
        return !((doc?.get("keyPoints") || []) as unknown[]).length;
      });
      const analysed = new Map<string, any>();
      for (const batch of buildChapterBatches(needAnalysis)) {
        const results = await analyzeChapterBatch(batch);
        results.forEach((result: any, i: number) => {
          if (Array.isArray(result?.keyPoints) && result.keyPoints.length > 0) {
            analysed.set((batch[i] as any).sourceId, result);
          }
        });
      }

      const { db } = getFirebaseAdmin();
      const writer = db.bulkWriter();
      cleaned.forEach((chapter: any, index: number) => {
        const doc = ordered.find((d) => d.id === chapter.sourceId)!;
        const update: Record<string, unknown> = {
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.chapterTitle,
          paragraphs: chapter.paragraphs,
          paragraphPages: pagesOf(chapter),
          kind: chapter.kind || "lesson",
          subject: chapter.subject || doc.get("subject") || "",
          part: chapter.part || "",
          subtitle: chapter.subtitle || "",
          language: chapter.language || doc.get("language") || "English",
          estimatedReadingMinutes: Math.max(1, Math.round(chapter.text.split(/\s+/).filter(Boolean).length / 40)),
        };
        if (doc.get("bookId")) {
          update.chapterOrder = index + 1;
          update.chapterCount = cleaned.length;
        }
        const a = analysed.get(chapter.sourceId);
        if (a) {
          Object.assign(update, {
            summary: a.summary,
            primaryTopic: a.primaryTopic || doc.get("primaryTopic") || "",
            importantConcepts: a.importantConcepts,
            keyVocabulary: a.keyVocabulary,
            learningObjectives: a.learningObjectives,
            keyPoints: a.keyPoints,
            themes: a.themes,
            moralOrMessage: a.moralOrMessage,
            difficulty: a.difficulty,
            discussionQuestions: a.discussionQuestions,
          });
        }
        writer.update(doc.ref, update);
      });
      let removed = 0;
      for (const d of ordered) {
        if (keptIds.has(d.id)) continue;
        const images = await d.ref.collection("images").get();
        images.docs.forEach((img) => writer.delete(img.ref));
        writer.delete(d.ref);
        removed += 1;
      }
      await writer.close();
      const parts = [...new Set(cleaned.map((c) => c.part).filter(Boolean))];
      console.log(
        `[PUBLISH] Book ${req.params.key}: cleaned ${ordered.length} -> ${cleaned.length} chapters, ` +
          `${removed} removed, ${analysed.size} re-analysed, parts: ${parts.join(", ") || "none"}.`
      );
      return res.json({
        success: true,
        before: ordered.length,
        after: cleaned.length,
        removed,
        reanalysed: analysed.size,
        parts,
      });
    } catch (error: any) {
      console.error("Clean Book Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to clean up the book." });
    }
  }
);

app.delete(
  "/api/readings/books/:key",
  requireFirebaseUser,
  requireRole(["faculty", "admin", "superadmin"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const docs = await readingsForBookKey(req.params.key);
      if (docs.length === 0) return res.status(404).json({ success: false, error: "Book not found." });
      if (!canManageReadings(req, docs)) {
        return res.status(403).json({ success: false, error: "Only the publishing teacher or a school admin can remove this book." });
      }
      const { db } = getFirebaseAdmin();
      const writer = db.bulkWriter();
      for (const d of docs) {
        const images = await d.ref.collection("images").get();
        images.docs.forEach((img) => writer.delete(img.ref));
        writer.delete(d.ref);
      }
      await writer.close();
      console.log(`[PUBLISH] Book ${req.params.key}: deleted ${docs.length} chapters.`);
      return res.json({ success: true, deleted: docs.length });
    } catch (error: any) {
      console.error("Delete Book Error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to remove book." });
    }
  }
);

/* =========================================================
   AI PRONUNCIATION EVALUATION
\\\\========================================================= */
app.post(
  "/api/speech/evaluate-pronunciation",
  optionalFirebaseUser,
  rateLimit("pronunciation", 30, 60_000),
  async (req, res) => {
    try {
      const {
        targetText,
        spokenText,
        language = "English",
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
6. The same encouragement written in ${language === "English" ? "Telugu" : language} (the child's home language).
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
// Sarvam TTS gate: at most SARVAM_TTS_CONCURRENCY calls at once; a
// rate-limit answer pauses Sarvam (15 s, doubling to 2 min) so one busy
// moment doesn't turn into dozens of refused calls. Prefetches never wait.
const SARVAM_MAX_CONCURRENT = Number(process.env.SARVAM_TTS_CONCURRENCY || 3);
let sarvamActive = 0;
let sarvamPausedUntil = 0;
let sarvamPauseMs = 15_000;
async function acquireSarvamSlot(isPrefetch: boolean): Promise<boolean> {
  const deadline = Date.now() + (isPrefetch ? 0 : 4_000);
  for (;;) {
    const now = Date.now();
    if (now >= sarvamPausedUntil && sarvamActive < (isPrefetch ? 1 : SARVAM_MAX_CONCURRENT)) {
      sarvamActive += 1;
      return true;
    }
    if (now >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
function releaseSarvamSlot() {
  sarvamActive = Math.max(0, sarvamActive - 1);
}
function sarvamRateLimited() {
  if (Date.now() < sarvamPausedUntil) return;
  sarvamPausedUntil = Date.now() + sarvamPauseMs;
  console.warn(`[TTS] Sarvam rate limit reached; pausing Sarvam for ${sarvamPauseMs / 1000}s.`);
  sarvamPauseMs = Math.min(sarvamPauseMs * 2, 120_000);
}
function sarvamSucceeded() {
  sarvamPauseMs = 15_000;
}

// Account problems (no credits, invalid or revoked key) fail every Sarvam
// call the same way, for text-to-speech and speech-to-text alike. After one
// such answer, Sarvam is skipped for 10 minutes and the fallbacks answer at
// once, instead of every word paying a failed round trip first.
const SARVAM_ACCOUNT_PAUSE_MS = 10 * 60_000;
let sarvamAccountBlockedUntil = 0;
let sarvamAccountReason = "";
function sarvamAccountBlocked(): string | null {
  return Date.now() < sarvamAccountBlockedUntil ? sarvamAccountReason : null;
}
function noteSarvamAccountProblem(status: number, message: string): boolean {
  if (status !== 401 && status !== 402 && status !== 403) return false;
  if (Date.now() >= sarvamAccountBlockedUntil) {
    console.warn(
      `[SARVAM] ${message} (HTTP ${status}). Using the fallback voices for ${SARVAM_ACCOUNT_PAUSE_MS / 60_000} min; top up or fix the key at dashboard.sarvam.ai.`
    );
  }
  sarvamAccountBlockedUntil = Date.now() + SARVAM_ACCOUNT_PAUSE_MS;
  sarvamAccountReason = `Sarvam unavailable: ${message}`;
  return true;
}

// One line per minute when no voice service can answer, not a stack trace
// per word (the browser then speaks with the device voice).
let lastVoiceOutageLog = 0;
function logVoiceOutage(message: string) {
  if (Date.now() - lastVoiceOutageLog < 60_000) return;
  lastVoiceOutageLog = Date.now();
  console.warn(`[TTS] No cloud voice available (${message.slice(0, 160)}); the device voice is used meanwhile.`);
}

// In-memory LRU of synthesized clips (base64 WAV), bounded by size.
const TTS_CACHE_MAX_BYTES = Number(process.env.TTS_CACHE_MB || 64) * 1024 * 1024;
const ttsCache = new Map<string, any>();
const ttsInFlight = new Map<string, Promise<any>>();
let ttsCacheBytes = 0;
function ttsCacheGet(key: string) {
  const hit = ttsCache.get(key);
  if (!hit) return null;
  ttsCache.delete(key);
  ttsCache.set(key, hit); // most recently used last
  return hit;
}
function ttsCachePut(key: string, value: any) {
  if (ttsCache.has(key) || !value?.audioBase64) return;
  const size = String(value.audioBase64).length + key.length;
  if (size > TTS_CACHE_MAX_BYTES / 8) return;
  ttsCache.set(key, value);
  ttsCacheBytes += size;
  for (const [k, v] of ttsCache) {
    if (ttsCacheBytes <= TTS_CACHE_MAX_BYTES) break;
    ttsCache.delete(k);
    ttsCacheBytes -= String(v.audioBase64).length + k.length;
  }
}
app.post(
  "/api/speech/synthesize",
  optionalFirebaseUser,
  rateLimit("tts", 300, 60_000),
  async (req, res) => {
    try {
      const {
        text,
        language = "English",
        voiceName = "Priya",
        style = "cheerful_teacher",
        pace = 1.0,
        prefetch = false,
      } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({
          success: false,
          error: "Text is required for speech synthesis.",
        });
      }

      const apiKey = process.env.SARVAM_API_KEY;
      const speechMode = speechProviderMode();

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
      const languageCode = speechLanguageCodeFor(text, language);

      // Every clip is cached by what it sounds like, so a line or word that
      // was said once (flashcards, UI phrases, a book page) plays instantly
      // for every other child; identical requests in flight share one call.
      const paceValue = Math.max(0.5, Math.min(2.0, Number(pace) || 1.0));
      const cacheKey = `${speaker}|${languageCode}|${paceValue}|${text.slice(0, 2500)}`;
      const cached = ttsCacheGet(cacheKey);
      if (cached) return res.json({ ...cached, style, cached: true });

      const synthesize = async () => {
        let audioBase64 = "";
        let provider = "sarvam";
        let sarvamError = "";

        const accountBlocked = sarvamAccountBlocked();
        if (speechMode !== "gemini" && apiKey && accountBlocked) {
          sarvamError = accountBlocked;
        } else if (speechMode !== "gemini" && apiKey) {
          // Never burst Sarvam: a few calls at a time, and after a rate-limit
          // answer, pause it for a while. Prefetches give way first.
          const slot = await acquireSarvamSlot(prefetch === true);
          if (!slot) {
            sarvamError = "Sarvam is busy (rate limited)";
          } else try {
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
              signal: AbortSignal.timeout(30 * 1000),
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data?.audios?.[0]) {
              audioBase64 = data.audios[0];
              sarvamSucceeded();
            } else {
              sarvamError =
                data?.error?.message || data?.message || `Sarvam TTS HTTP ${response.status}`;
              if (response.status === 429 || data?.error?.code === "rate_limit_exceeded_error") {
                sarvamRateLimited();
              } else if (!noteSarvamAccountProblem(response.status, sarvamError)) {
                console.error("Sarvam TTS Error:", response.status, sarvamError);
              }
            }
          } catch (error: any) {
            sarvamError = error?.message || String(error);
            console.error("Sarvam TTS request failed:", sarvamError);
          } finally {
            releaseSarvamSlot();
          }
        } else if (speechMode !== "gemini") {
          sarvamError = "SARVAM_API_KEY is not configured.";
        }

        if (!audioBase64) {
          // Background prefetches never use the (small, daily) Gemini quota;
          // only a clip a child is actually waiting for falls back to it.
          if (speechMode === "sarvam" || !isGeminiConfigured() || prefetch === true) {
            throw Object.assign(new Error(sarvamError || "Speech synthesis is not configured."), { status: 502 });
          }
          let gemini: Awaited<ReturnType<typeof synthesizeSpeechWithGemini>>;
          try {
            gemini = await synthesizeSpeechWithGemini(text.slice(0, 2500), speaker);
          } catch (geminiError: any) {
            const message = String(geminiError?.message || geminiError);
            logVoiceOutage(`${sarvamError || "Sarvam not used"}; Gemini: ${/quota|429|RESOURCE_EXHAUSTED/i.test(message) ? "quota reached" : message}`);
            throw Object.assign(new Error("No cloud voice is available right now."), { status: 502 });
          }
          audioBase64 = gemini.wavBase64;
          provider = gemini.model;
          console.log(
            `[TTS] Gemini fallback (${gemini.model}) for ${languageCode}` +
              (sarvamError ? ` after Sarvam error: ${sarvamError}` : "")
          );
        }

        return {
          success: true,
          audioBase64,
          mimeType: "audio/wav",
          sampleRate: 24000,
          voiceName,
          speaker,
          language,
          languageCode,
          style,
          provider,
        };
      };
      // A prefetch never falls back to Gemini, so a clip a child is waiting
      // for must not share (and inherit the failure of) a prefetch request.
      const flightKey = prefetch === true ? `${cacheKey}|prefetch` : cacheKey;
      let pending = ttsInFlight.get(flightKey) || (prefetch === true ? ttsInFlight.get(cacheKey) : undefined);
      if (!pending) {
        pending = synthesize().finally(() => ttsInFlight.delete(flightKey));
        ttsInFlight.set(flightKey, pending);
      }
      try {
        const result = await pending;
        ttsCachePut(cacheKey, result);
        return res.json({ ...result, style });
      } catch (error: any) {
        // A skipped prefetch is not an error: nothing to send, the clip is
        // made when the child actually needs it.
        if (error?.status === 502 && prefetch === true) return res.status(204).end();
        if (error?.status === 502) return res.status(502).json({ success: false, error: error.message });
        throw error;
      }
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
  optionalFirebaseUser,
  rateLimit("stt", 45, 60_000),
  async (req, res) => {
    try {
      const {
        audioBase64,
        mimeType = "audio/webm",
        language = "English",
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
      const speechMode = speechProviderMode();

      const languageCodeMap: Record<string, string> = {
        Telugu: "te-IN",
        Hindi: "hi-IN",
        English: "en-IN",
      };
      const languageCode = languageCodeMap[language] || "en-IN";
      const buffer = Buffer.from(audioBase64, "base64");
      const sizeKb = Math.round(buffer.length / 1024);

      let sarvamError = "";
      const accountBlocked = sarvamAccountBlocked();
      if (speechMode !== "gemini" && apiKey && accountBlocked) {
        sarvamError = accountBlocked;
      } else if (speechMode !== "gemini" && apiKey) {
        try {
          const form = new FormData();
          form.append(
            "file",
            new Blob([buffer], { type: normalizedMimeType }),
            "reading.webm"
          );
          form.append("model", "saaras:v4");
          form.append("mode", "transcribe");
          form.append("language_code", languageCode);

          const startedAt = Date.now();
          const response = await fetch("https://api.sarvam.ai/speech-to-text", {
            method: "POST",
            headers: { "api-subscription-key": apiKey },
            body: form,
            signal: AbortSignal.timeout(30 * 1000),
          });
          const data = await response.json().catch(() => ({}));
          console.log(
            `[STT] sarvam ${languageCode} ${sizeKb}KB -> HTTP ${response.status}, ` +
              `${String(data?.transcript || "").length} transcript chars, ${Date.now() - startedAt}ms`
          );
          if (response.ok) {
            return res.json({
              success: true,
              transcript: data?.transcript || "",
              languageCode: data?.language_code || languageCode,
              languageProbability: data?.language_probability ?? null,
              provider: "sarvam",
            });
          }
          sarvamError =
            data?.error?.message || data?.message || `Sarvam STT HTTP ${response.status}`;
          if (!noteSarvamAccountProblem(response.status, sarvamError)) {
            console.error("Sarvam STT Error:", data);
          }
        } catch (error: any) {
          sarvamError = error?.message || String(error);
          console.error("Sarvam STT request failed:", sarvamError);
        }
      } else if (speechMode !== "gemini") {
        sarvamError = "SARVAM_API_KEY is not configured.";
      }

      if (speechMode === "sarvam" || !isGeminiConfigured()) {
        return res.status(502).json({
          success: false,
          error: sarvamError || "Speech recognition is not configured.",
        });
      }

      const startedAt = Date.now();
      let gemini: Awaited<ReturnType<typeof transcribeAudioWithGemini>>;
      try {
        gemini = await transcribeAudioWithGemini(
          buffer,
          normalizedMimeType,
          ["Telugu", "Hindi", "English"].includes(language) ? language : "English"
        );
      } catch (geminiError: any) {
        console.warn(
          `[STT] No speech service could listen (${sarvamError || "Sarvam not used"}; Gemini: ${String(geminiError?.message || geminiError).slice(0, 120)})`
        );
        return res.status(502).json({
          success: false,
          error: "We couldn't listen to your reading just now. Please try again in a moment.",
        });
      }
      console.log(
        `[STT] ${gemini.model} ${languageCode} ${sizeKb}KB -> ${gemini.transcript.length} transcript chars, ${Date.now() - startedAt}ms` +
          (sarvamError ? ` (Sarvam failed: ${sarvamError})` : "")
      );
      res.json({
        success: true,
        transcript: gemini.transcript,
        languageCode,
        languageProbability: null,
        provider: gemini.model,
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
      // With a provider set to "gemini" the local service is never called,
      // so don't print its address as if it were in use.
      const ocrMode = providerMode(process.env.OCR_PROVIDER);
      const textMode = providerMode(process.env.AI_TEXT_PROVIDER);
      console.log(
        `Docling OCR      : ${ocrMode === "gemini" ? "not used (OCR_PROVIDER=gemini)" : OCR_SERVICE_URL}`
      );
      console.log(
        `Ollama           : ${textMode === "gemini" ? "not used (AI_TEXT_PROVIDER=gemini)" : `${OLLAMA_BASE_URL} (${OLLAMA_MODEL})`}`
      );
      console.log(
        `Sarvam TTS/STT   : ${
          process.env.SARVAM_API_KEY ? "configured" : "SARVAM_API_KEY missing"
        }`
      );
      console.log(
        `Gemini fallback  : ${
          isGeminiConfigured()
            ? `configured (text: ${geminiTextModels().join(" > ")}; OCR: ${geminiOcrModels().join(" > ")})`
            : "GEMINI_API_KEY missing"
        }`
      );
      console.log(
        `Providers        : OCR=${ocrMode}, text AI=${textMode}`
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
