import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import firebaseRouter from "./server/firebaseRoutes";
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
 * Gemini is kept only for the existing TTS endpoint because
 * qwen2.5:3b does not generate audio.
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. It is only required for the TTS endpoint."
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
   SUPER ADMIN SECURITY
\\\\========================================================= */
app.post("/api/auth/superadmin-verify", (req, res) => {
  const { key, uriCode } = req.body;
  if (uriCode !== "superadmin221b") {
    return res.status(403).json({
      error:
        "Access Denied. Invalid SuperAdmin security route.",
    });
  }
  const configuredKey = process.env.SUPERADMIN_ACCESS_KEY;
  if (!configuredKey) {
    return res.status(503).json({ error: "SuperAdmin access is not configured on this server." });
  }
  if (typeof key === "string" && key.length > 0 && key === configuredKey) {
    return res.json({
      success: true,
      message: "SuperAdmin authorization successful.",
      session: {
        id: "superadmin_root",
        name: "State System Director (SuperAdmin)",
        role: "superadmin",
        avatar: "ðŸ›¡ï¸",
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
/* =========================================================
   SUPER ADMIN TELEMETRY
\\\\========================================================= */
app.get("/api/superadmin/telemetry", (_req, res) => {
  const uptime = Math.floor(
    (Date.now() - startTime) / 1000
  );
  res.json({
    serverStatus: "healthy",
    uptimeSeconds: uptime,
    ollamaModel: OLLAMA_MODEL,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    paddleOcrService: OCR_SERVICE_URL,
    ...telemetryStats,
    ollamaConfigured: true,
  });
});
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
   PADDLEOCR HEALTH CHECK
\\\\========================================================= */
app.get("/api/ocr/health", async (_req, res) => {
  try {
    const response = await fetch(
      `${OCR_SERVICE_URL}/`
    );
    const text = await response.text();
    return res.json({
      success: response.ok,
      paddleOcr: response.ok,
      serviceUrl: OCR_SERVICE_URL,
      response: text.slice(0, 500),
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      paddleOcr: false,
      serviceUrl: OCR_SERVICE_URL,
      error:
        error?.message ||
        "PaddleOCR service is not reachable.",
    });
  }
});
/* =========================================================
   TEXTBOOK JOB PROCESSING
   Textbook analysis is intentionally asynchronous. A large PDF can
   take PaddleOCR + local Ollama several minutes. Keeping the browser
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
    aiFallback: raw?.aiFallback === true,
    analysisMode: raw?.analysisMode === "ocr" ? "ocr" : "ai",
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
function cleanOcrText(text: string): string {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
type TextbookLanguage = "English" | "Hindi" | "Telugu";
function keepTextbookLanguage(text: string, language: TextbookLanguage): string {
  const scriptPattern = language === "Hindi"
    ? /[^\u0900-\u097f\s]/gu
    : language === "Telugu"
      ? /[^\u0c00-\u0c7f\s]/gu
      : /[^A-Za-z\s]/gu;
  return String(text || "")
    .split(/(---\s*PAGE\s+\d+\s*---)/gi)
    .map((part) => /^---\s*PAGE\s+\d+\s*---$/i.test(part)
      ? part
      : part.replace(scriptPattern, " ").replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const COMMON_ENGLISH_WORDS = new Set((
  "a about after again all along also am an and animal animals are around as asked at away " +
  "back be because been before began being big bird birds book boy bring came can cannot " +
  "children city come could day did different do does down each earth eat elephant enough " +
  "even every family far find first five for found four from friend friends frog get girl " +
  "give go good got great green ground grow had hand hands happy hard has have he head " +
  "help her here high him his home house how I if in into is it its just keep kind knew " +
  "know land large last learn leave left let life like little live lived long look looked " +
  " made make man many may me more morning most mother mountain move much must my name " +
  "near need never new next night no not now of off old on once one only open or other " +
  "our out over own page people place play point put ran read river road room run said " +
  "same saw say school see seen set she should show small so some something soon started " +
  "story such sun take tell than that the their them then there these they thing think " +
  "this those thought three through time to together too tree true two under up us use " +
  "very village walk walked walking want was water way we well went were what when where " +
  "which while white who why will with woman work world would write year you young " +
  "forest flowers flower grass beautiful happily suddenly carefully outside inside another " +
  "because everybody everyone everything morning afternoon sunshine sunlight children " +
  "farmer farmers rabbit rabbits turtle tortoise butterfly butterflies garden animals " +
  "running jumping playing reading helping kindness important wonderful little elephant"
).split(/\s+/));
const ENGLISH_JOINER_WORDS = new Set("a an and are as at be because but by for from had has have he her him his if in into is it its of on or our she that the their them then there they this to was we were when where which who will with you".split(/\s+/));
function repairJoinedEnglishWords(text: string): string {
  return String(text || "").replace(/[A-Za-z]{10,}/g, (original) => {
    const token = original.toLowerCase();
    if (token.length > 28) return original;
    const best: Array<string[] | null> = Array(token.length + 1).fill(null);
    best[token.length] = [];
    for (let start = token.length - 1; start >= 0; start -= 1) {
      for (let end = start + 2; end <= Math.min(token.length, start + 14); end += 1) {
        const word = token.slice(start, end);
        const tail = best[end];
        if (!COMMON_ENGLISH_WORDS.has(word) || !tail) continue;
        const candidate = [word, ...tail];
        if (!best[start] || candidate.length < best[start]!.length) best[start] = candidate;
      }
    }
    const parts = best[0];
    if (!parts || parts.length < 2 || parts.join("").length / token.length < 0.9) return original;
    const hasJoiner = parts.some((part) => ENGLISH_JOINER_WORDS.has(part));
    if (!hasJoiner && parts.some((part) => part.length < 4)) return original;
    if (/^[A-Z]/.test(original)) parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
    return parts.join(" ");
  });
}
function filterStudentContentPages(text: string, language: TextbookLanguage): string {
  const wordPattern = language === "Hindi"
    ? /[\u0900-\u097f]+/gu
    : language === "Telugu"
      ? /[\u0c00-\u0c7f]+/gu
      : /[A-Za-z]+/g;
  const markerPattern = /^---\s*PAGE\s+\d+\s*---/i;
  const pages = String(text || "").split(/(?=---\s*PAGE\s+\d+\s*---)/i);
  const kept = pages.filter((page) => {
    const marker = page.match(markerPattern)?.[0] || "";
    const body = (marker ? page.slice(marker.length) : page).trim();
    if (!body) return false;

    const adminHeading = /(?:copyright|all rights reserved|isbn|published by|printed by)|^\s*(?:contents|table of contents|index|glossary|summary|answer key|answers|acknowledgements?|acknowledgments?|bibliography|references|about the author|publisher'?s note)\b/im;
    const devanagariAdmin = /(?:विषय.?सूची|अनुक्रमणिका|लेखक परिचय)/.test(body);
    const teluguAdmin = /(?:విషయ.?సూచిక|సూచిక|రచయిత పరిచయం)/.test(body);
    if (adminHeading.test(body) || devanagariAdmin || teluguAdmin) return false;

    const spacingRepairedBody = language === "English" ? repairJoinedEnglishWords(body) : body;
    const tokens = spacingRepairedBody.match(wordPattern) || [];
    const meaningfulTokens = tokens.filter((word) => word.length > 1);
    const letterCount = meaningfulTokens.reduce((sum, word) => sum + word.length, 0);
    // Covers, publisher pages, scan noise and page-number-only sheets tend to
    // be short or consist mostly of isolated OCR characters. Keep real lesson
    // text, including shorter poems when they have a clear lesson heading.
    const lessonHeading = /\b(?:chapter|unit|lesson|poem|story)\b/i.test(body) ||
      /(?:अध्याय|पाठ|कविता|कहानी|యూనిట్|పాఠం|కథ|కవిత)/.test(body);
    const minimumWords = lessonHeading ? 4 : 8;
    if (meaningfulTokens.length < minimumWords || letterCount < (lessonHeading ? 16 : 32)) return false;
    if (tokens.length && meaningfulTokens.length / tokens.length < 0.65) return false;

    // Drop worksheet-only pages while retaining story pages that have a few
    // follow-up questions at the end.
    const lines = spacingRepairedBody.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const promptLines = lines.filter((line) =>
      /^(?:\d+[.)]?\s*)?(?:answer|choose|circle|fill|match|write|tick|complete|true or false)\b/i.test(line)
    ).length;
    const proseLines = lines.filter((line) => (line.match(wordPattern) || []).length >= 7).length;
    if (promptLines >= 3 && proseLines < 2) return false;
    const normalizedBody = body.replace(/\s+/g, " ");
    const activityCues = (normalizedBody.match(/\b(?:draw and do|listen and think|individual|appreciation work|conceptual|project work|group work|skills|colour|color)\b/gi) || []).length;
    const storyCues = (normalizedBody.match(/\b(?:once|lived|story|tale|one day|because|therefore|for example|means|is called|are called)\b/gi) || []).length;
    if (activityCues >= 3 && storyCues < 2) return false;
    return true;
  });
  const pageFilteredText = cleanOcrText(kept.join("\n\n"));
  return language === "English" ? repairJoinedEnglishWords(pageFilteredText) : pageFilteredText;
}
function detectTextbookLanguage(text: string): TextbookLanguage {
  const hindi = (text.match(/[\u0900-\u097F]/g) || []).length;
  const telugu = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (hindi > 20 && hindi >= telugu * 1.4 && hindi >= latin * 0.55) return "Hindi";
  if (telugu > 20 && telugu >= hindi * 1.4 && telugu >= latin * 0.55) return "Telugu";
  return "English";
}
function resolveTextbookLanguage(text: string, requested: string): TextbookLanguage {
  if (requested === "English" || requested === "Hindi" || requested === "Telugu") return requested;
  return detectTextbookLanguage(text);
}
function removePublisherFrontMatter(text: string): string {
  const publisherLine = /\b(?:copyright|all rights reserved|isbn(?:-\d+)?|published by|publisher|printed (?:by|at)|first edition|reprint|illustrated by|illustrations? by|designed by|www\.|https?:\/\/|e-?mail|mrp|price:|personalised children'?s books|personalized children'?s books|free children'?s books|share our books|support our mission|friends and family to support our mission|intended to impart a message of importance)\b|\b[a-z0-9-]+\.(?:com|org|in|net)\b|\bby\s+(?:[A-Z]\.\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b|\u092a\u094d\u0930\u0915\u093e\u0936\u0915|\u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924|\u092e\u0941\u0926\u094d\u0930\u093f\u0924|\u0938\u0930\u094d\u0935\u093e\u0927\u093f\u0915\u093e\u0930|\u0c2a\u0c4d\u0c30\u0c1a\u0c41\u0c30\u0c23|\u0c2e\u0c41\u0c26\u0c4d\u0c30\u0c23|\u00a9|\u00ae|\u2122/i;
  const pageChunks = String(text || "").split(/(?=---\s*PAGE\s+\d+\s*---)/i);
  const kept: string[] = [];
  for (const chunk of pageChunks) {
    const marker = chunk.match(/^---\s*PAGE\s+(\d+)\s*---/i)?.[0] || "";
    const body = marker ? chunk.slice(marker.length) : chunk;
    const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
    const usefulLines = lines.filter((line) => !publisherLine.test(line));
    const pageNumber = Number(chunk.match(/^---\s*PAGE\s+(\d+)\s*---/i)?.[1] || 0);
    const hasLessonHeading = /\b(?:chapter|unit|lesson|part|section|activity|poem|story|reading|exercise)\s*\d*\b/i.test(body) || /(?:\u0905\u0927\u094d\u092f\u093e\u092f|\u092a\u093e\u0920|\u0915\u0935\u093f\u0924\u093e|\u0915\u0939\u093e\u0928\u0940|\u0907\u0915\u093e\u0908|\u0905\u092d\u094d\u092f\u093e\u0938|\u0c05\u0c27\u0c4d\u0c2f\u0c3e\u0c2f\u0c02|\u0c2a\u0c3e\u0c20\u0c02|\u0c15\u0c25|\u0c15\u0c35\u0c3f\u0c24|\u0c2f\u0c42\u0c28\u0c3f\u0c1f|\u0c05\u0c2d\u0c4d\u0c2f\u0c3e\u0c38\u0c02)/i.test(body);
    const hasPublisherSignal = lines.some((line) => publisherLine.test(line));
    const bodyText = usefulLines.join(" ");
    const languageLetters = (bodyText.match(/[\p{L}\p{M}]/gu) || []).length;
    const hasStrongPublisherSignal = lines.some((line) =>
      /\b(?:copyright|all rights reserved|isbn(?:-\d+)?|published by|publisher|printed (?:by|at)|illustrated by|illustrations? by|designed by|intended to impart a message|dear supporter|thank you for downloading|share our books|support our mission|make a donation|donation on patreon|free book project|about the author|publisher'?s note)\b/i.test(line) ||
      /\u092a\u094d\u0930\u0915\u093e\u0936\u0915|\u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924|\u092e\u0941\u0926\u094d\u0930\u093f\u0924|\u0938\u0930\u094d\u0935\u093e\u0927\u093f\u0915\u093e\u0930|\u0c2a\u0c4d\u0c30\u0c1a\u0c41\u0c30\u0c23|\u0c2e\u0c41\u0c26\u0c4d\u0c30\u0c23/i.test(line)
    );
    // Contents pages often have many numbered story titles on one page. This
    // works for continuations too, where the heading only appears on page 2.
    const numberedEntries = body.match(/(?:^|[\s|])(?:\(\s*)?\d{1,3}(?:\s*\))?[.)]?\s+/g) || [];
    const hasContentsHeading = /\b(?:contents|table of contents)\b|\u0935\u093f\u0937\u092f(?:\s*[-:]?\s*\u0938\u0942\u091a\u0940)?/i.test(body);
    const monthEntries = (body.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|spet(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi) || []).length;
    const isContentsPage = (numberedEntries.length >= 8 && monthEntries >= 4) ||
      (hasContentsHeading && numberedEntries.length >= 2);
    const hasBackMatterHeading = lines.some((line) =>
      /^\s*(?:index|glossary|answer key|answers|acknowledgements?|acknowledgments?|bibliography|references|about the author|publisher'?s note)\s*[:.]?\s*$/i.test(line)
    );
    if (isContentsPage || (hasBackMatterHeading && !hasLessonHeading)) continue;

    // A publisher URL or watermark can appear in the footer of every page.
    // Only discard a page as front matter when removing publisher lines leaves
    // little actual text; substantive story pages remain even with that footer.
    const isEarlyPage = pageNumber > 0 && pageNumber <= 8;
    if (isEarlyPage && hasStrongPublisherSignal && !hasLessonHeading) continue;
    if (isEarlyPage && hasPublisherSignal && !hasLessonHeading && languageLetters < 140) continue;
    const cleanedBody = usefulLines.join("\n").trim();
    if (cleanedBody) kept.push(`${marker}${marker ? "\n" : ""}${cleanedBody}`);
  }
  return cleanOcrText(kept.join("\n\n"));
}
function languageOutputInstruction(language: TextbookLanguage): string {
  if (language === "Hindi") return "Write every generated field (summary, vocabulary meanings, objectives, themes, and metadata) in natural, age-appropriate Hindi using Devanagari. Keep source textbook terms and names in Hindi script when present. Do not translate the textbook into English.";
  if (language === "Telugu") return "Write every generated field (summary, vocabulary meanings, objectives, themes, and metadata) in natural, age-appropriate Telugu using Telugu script. Keep source textbook terms and names in Telugu script when present. Do not translate the textbook into English.";
  return "Write every generated field in clear, age-appropriate English. Do not translate the textbook into another language.";
}
function extractTextExcerpt(text: string, maxLength = 480): string {
  const normalized = cleanOcrText(text)
    .replace(/---\s*PAGE\s+\d+\s*---/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  const sentenceEnd = Math.max(
    normalized.lastIndexOf(". ", maxLength),
    normalized.lastIndexOf("। ", maxLength),
    normalized.lastIndexOf("! ", maxLength),
    normalized.lastIndexOf("? ", maxLength)
  );
  const end = sentenceEnd > maxLength * 0.55 ? sentenceEnd + 1 : maxLength;
  return `${normalized.slice(0, end).trimEnd()}…`;
}
function inferTextbookMetadata(
  fileName: string,
  text: string,
  language: TextbookLanguage
): any {
  const title = path.basename(fileName || "Textbook", path.extname(fileName || ""))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sample = `${fileName} ${text.slice(0, 5000)}`.toLowerCase();
  let subject = language === "English" ? "English Reader" : `${language} Reader`;
  if (/\b(math|mathematics|arithmetic|geometry)\b|\u0917\u0923\u093f\u0924|\u0c17\u0c23\u0c3f\u0c24/.test(sample)) {
    subject = "Mathematics";
  } else if (/\b(science|biology|physics|chemistry|environmental studies|\bevs\b)\b|\u0935\u093f\u091c\u094d\u091e\u093e\u0928|\u0c35\u0c3f\u0c1c\u0c4d\u0c1e\u0c3e\u0c28/.test(sample)) {
    subject = "Science";
  } else if (/\b(history|geography|civics|social studies)\b|\u0907\u0924\u093f\u0939\u093e\u0938|\u0c1a\u0c30\u0c3f\u0c24\u0c4d\u0c30/.test(sample)) {
    subject = "Social Studies";
  }
  const gradeMatch = sample.match(/\b(?:class|grade|standard|std\.?)\s*([1-5])\b|\u0915\u0915\u094d\u0937\u093e\s*([1-5])/i);
  const gradeNumber = gradeMatch?.[1] || gradeMatch?.[2];
  return {
    subject,
    grade: gradeNumber ? `Class ${gradeNumber}` : "Unknown",
    primaryLanguage: language,
    bookTitle: title || "Textbook",
    overallSummary: "Lesson text was extracted and grouped using OCR. Summaries are source text excerpts.",
    aiFallback: false,
    analysisMode: "ocr",
  };
}
function isOllamaUnavailable(error: any): boolean {
  const diagnostic = `${error?.message || ""} ${error?.cause?.code || ""} ${error?.cause?.message || ""}`;
  return /ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|Ollama returned 404/i.test(diagnostic);
}
function extractChapterNumberAndTitle(
  heading: string
): { chapterNumber: string; chapterTitle: string } {
  const value = heading.trim().replace(/\s+/g, " ");
  const match = value.match(
    /^(chapter|unit|lesson|part|section|activity|poem|story|reading|exercise)\s*[:.**\-**]?\s*(\d+)?\s*[:.**\-**]?\s*(.*)$/i
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
  const numbered = value.match(/^\(?([0-9]{1,3})\)?[.)\-:]?\s+(.+)$/);
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
function looksLikeChapterHeading(line: string): boolean {
  const value = line.trim().replace(/\s+/g, " ");
  if (value.length < 3 || value.length > 90 || value.split(/\s+/).length > 8) {
    return false;
  }
  const englishPrefix = value.match(/^(chapter|unit|lesson|part|section|poem|story)\b/i)?.[1];
  if (englishPrefix) {
    const title = value.slice(englishPrefix.length).trim();
    if (/^(?:and|to|of|over|up|down|in|on|with|for|the)\b/i.test(title)) return false;
    if (englishPrefix.toLowerCase() === "part" && value.split(/\s+/).length > 5) return false;
  }
  return (
    /^(chapter|unit|lesson|part|section|poem|story)\b/i.test(
      value
    ) ||
    /^(?:\u0905\u0927\u094d\u092f\u093e\u092f|\u092a\u093e\u0920|\u0915\u0935\u093f\u0924\u093e|\u0915\u0939\u093e\u0928\u0940|\u0907\u0915\u093e\u0908|\u0c05\u0c27\u0c4d\u0c2f\u0c3e\u0c2f\u0c02|\u0c2a\u0c3e\u0c20\u0c02|\u0c15\u0c25|\u0c15\u0c35\u0c3f\u0c24|\u0c2f\u0c42\u0c28\u0c3f\u0c1f)/.test(value)
  );
}
type TocChapter = { title: string; printedPage: number; chapterNumber?: number };
function getMarkedOcrPages(text: string): Array<{ pageNumber: number; text: string }> {
  const matches = Array.from(String(text || "").matchAll(/---\s*PAGE\s+(\d+)\s*---\s*([\s\S]*?)(?=---\s*PAGE\s+\d+\s*---|$)/gi));
  return matches.map((match) => ({ pageNumber: Number(match[1]), text: match[2].trim() }));
}
function inferPrintedPageOffset(text: string): { offset: number | null; samples: number } {
  const offsets: number[] = [];
  for (const page of getMarkedOcrPages(text)) {
    const lines = page.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    // Textbooks commonly place the printed page number beneath a running
    // header. Search the first few lines before checking the footer.
    const headerNumber = lines.slice(0, 5).find((line) => /^\|?\s*\d{1,3}\s*\|?$/.test(line));
    if (headerNumber) {
      const printedPage = Number(headerNumber.replace(/\D/g, ""));
      const offset = page.pageNumber - printedPage;
      if (printedPage > 0 && offset >= 0 && offset <= 50) offsets.push(offset);
      continue;
    }
    const footer = lines.slice(-3).reverse().find((line) => /^\|?\s*\d{1,3}\s*\|?$/.test(line));
    if (!footer) continue;
    const printedPage = Number(footer.replace(/\D/g, ""));
    const offset = page.pageNumber - printedPage;
    if (printedPage > 0 && offset >= 0 && offset <= 50) offsets.push(offset);
  }
  if (!offsets.length) return { offset: null, samples: 0 };
  offsets.sort((a, b) => a - b);
  return { offset: offsets[Math.floor(offsets.length / 2)], samples: offsets.length };
}
function matchText(value: string, language: TextbookLanguage): string {
  const charPattern = language === "Hindi"
    ? /[^\u0900-\u097f\s]/gu
    : language === "Telugu"
      ? /[^\u0c00-\u0c7f\s]/gu
      : /[^A-Za-z\s]/gu;
  return value.replace(charPattern, " ").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}
function extractTocChapters(text: string, language: TextbookLanguage): TocChapter[] {
  const entries: TocChapter[] = [];
  const seen = new Set<number>();
  const monthPattern = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|spet(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
  for (const page of getMarkedOcrPages(text)) {
    const rawLines = page.text.split(/\n+/).map((line) => line.replace(/[|]/g, " ").trim()).filter(Boolean);
    const header = rawLines.some((line) =>
      /\b(?:contents|table of contents|index)\b/i.test(line) ||
      /(?:विषय.?सूची|अनुक्रमणिका|విషయ.?సూచిక|సూచిక)/.test(line)
    );
    // Some contents pages have no heading at all (this textbook calls it
    // "ix"). Their numbered lesson entries and month/page pairs identify them.
    const entryStarts = rawLines.filter((line) => /^\s*\d{1,2}\s*[.)]\s*\S/.test(line)).length;
    if (!header && entryStarts < 4) continue;
    for (let i = 0; i < rawLines.length; i += 1) {
      const start = rawLines[i].match(/^\s*(\d{1,2})\s*[.)]\s*(.*)$/);
      if (!start) continue;
      const chapterNumber = Number(start[1]);
      const titleLines = [start[2]];
      let printedPage = 0;
      const startMonth = start[2].match(monthPattern);
      if (startMonth) {
        titleLines[0] = start[2].slice(0, startMonth.index).trim();
        const trailingNumber = start[2].slice((startMonth.index || 0) + startMonth[0].length).match(/\b(\d{1,3})\s*$/);
        if (trailingNumber) printedPage = Number(trailingNumber[1]);
      }
      let end = i + 1;
      for (; end < rawLines.length; end += 1) {
        if (printedPage) break;
        if (/^\s*\d{1,2}\s*[.)]\s*\S/.test(rawLines[end])) break;
        const line = rawLines[end];
        if (startMonth && /^\d{1,3}$/.test(line)) {
          printedPage = Number(line);
          break;
        }
        const month = line.match(monthPattern);
        if (month) {
          const beforeMonth = line.slice(0, month.index).trim();
          if (beforeMonth) titleLines.push(beforeMonth);
          const afterMonth = line.slice((month.index || 0) + month[0].length).trim();
          const pageMatch = afterMonth.match(/\b(\d{1,3})\s*$/);
          if (pageMatch) printedPage = Number(pageMatch[1]);
          else if (end + 1 < rawLines.length && /^\d{1,3}$/.test(rawLines[end + 1])) {
            printedPage = Number(rawLines[end + 1]);
            end += 1;
          }
          break;
        }
        titleLines.push(line);
      }
      i = end - 1;
      const title = titleLines.join(" ").replace(/^[\d.)\s|–—-]+/, "").replace(/[.·…|\s]+$/, "").trim();
      const normalizedTitle = matchText(title, language);
      const words = normalizedTitle.split(" ").filter(Boolean);
      if (!printedPage || normalizedTitle.length < 4 || words.length > 12 || chapterNumber < 1) continue;
      if (/^(chapter|unit|lesson|part|poem|story|section)$/.test(normalizedTitle)) continue;
      if (/^(contents|table of contents|index|summary|glossary|references|answers?)$/i.test(normalizedTitle)) continue;
      if (seen.has(chapterNumber)) continue;
      seen.add(chapterNumber);
      entries.push({ title, printedPage, chapterNumber });
    }
  }
  return entries;
}
function chunksFromToc(text: string, toc: TocChapter[], language: TextbookLanguage, printedOffset: number | null) {
  const pages = getMarkedOcrPages(text);
  if (!toc.length || pages.length < 2) return [] as Array<{ chapterNumber: string; chapterTitle: string; text: string }>;
  const stopWords = new Set(language === "English" ? "a an and for from in of the to with".split(" ") : []);
  const mapped: Array<{ title: string; printedPage: number; pageNumber: number; score: number }> = [];
  for (const entry of toc) {
    const titleText = matchText(entry.title, language);
    const titleWords = titleText.split(" ").filter((word) => word.length > 1 && !stopWords.has(word));
    if (!titleWords.length) continue;
    let best: { pageNumber: number; score: number } | null = null;
    for (const page of pages) {
      const opening = matchText(page.text, language).split(" ").slice(0, 70).join(" ");
      const exact = opening.includes(titleText);
      const overlap = titleWords.filter((word) => opening.includes(word)).length / titleWords.length;
      const score = exact ? 1 : overlap;
      if (score >= (titleWords.length === 1 ? 1 : 0.7) && (!best || score > best.score)) {
        best = { pageNumber: page.pageNumber, score };
      }
    }
    if (best) mapped.push({ ...entry, ...best });
  }
  mapped.sort((a, b) => a.pageNumber - b.pageNumber);
  const offsets = mapped.map((entry) => entry.pageNumber - entry.printedPage).sort((a, b) => a - b);
  const offset = offsets.length ? offsets[Math.floor(offsets.length / 2)] : null;
  const byTitle = new Map(mapped.map((entry) => [matchText(entry.title, language), entry]));
  const ordered = toc.map((entry) => {
    const matched = byTitle.get(matchText(entry.title, language));
    const estimated = printedOffset != null
      ? entry.printedPage + printedOffset
      : offset != null && offsets.length >= 3
        ? entry.printedPage + offset
        : null;
    const nextPageAtOrAfterEstimate = estimated == null
      ? undefined
      : pages.find((page) => page.pageNumber >= estimated)?.pageNumber;
    const pageNumber = nextPageAtOrAfterEstimate ?? matched?.pageNumber;
    return pageNumber == null ? null : { ...entry, pageNumber };
  }).filter((entry): entry is TocChapter & { pageNumber: number } => entry !== null);
  ordered.sort((a, b) => a.pageNumber - b.pageNumber);
  const unique = ordered.filter((entry, index) => index === 0 || entry.pageNumber !== ordered[index - 1].pageNumber);
  return unique.map((entry, index) => {
    const endPage = unique[index + 1]?.pageNumber ?? Number.POSITIVE_INFINITY;
    const chapterPages = pages.filter((page) => page.pageNumber >= entry.pageNumber && page.pageNumber < endPage);
    const displayTitle = entry.title
      .replace(/^(?:chapter|unit|lesson|part|section|poem|story)\s+\d+\s*[:.)-]?\s*/i, "")
      .replace(/^(?:अध्याय|पाठ|కథ|పాఠం)\s*\d+\s*/, "");
    return {
      chapterNumber: `Chapter ${entry.chapterNumber ?? index + 1}`,
      chapterTitle: keepTextbookLanguage(displayTitle || entry.title, language).replace(/\s+/g, " ").trim(),
      text: chapterPages.map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`).join("\n\n"),
    };
  }).filter((chapter) => (chapter.text.match(/[\p{L}]/gu) || []).length >= 30);
}
function detectTextbookChunks(
  text: string,
  toc: TocChapter[] = [],
  language: TextbookLanguage = "English",
  printedOffset: number | null = null
): Array<{
  chapterNumber: string;
  chapterTitle: string;
  text: string;
}> {
  const tocChunks = chunksFromToc(text, toc, language, printedOffset);
  if (tocChunks.length) return tocChunks.slice(0, 100);
  const cleaned = cleanOcrText(text).replace(/---\s*PAGE\s+\d+\s*---/gi, "\n");
  const rawLines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    lines.push(rawLines[index]);
  }
  const headingIndexes: number[] = [];
  const duplicateHeadingIndexes = new Set<number>();
  const seenHeadings = new Set<string>();
  for (let i = 0; i < lines.length; i += 1) {
    const headingKey = lines[i].toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (looksLikeChapterHeading(lines[i])) {
      if (seenHeadings.has(headingKey)) duplicateHeadingIndexes.add(i);
      else {
        headingIndexes.push(i);
        seenHeadings.add(headingKey);
      }
    }
  }
  // Numbered contents entries and exercises are not chapter boundaries. If
  // the document has no explicit lesson headings, publish it as one lesson
  // and let the student reader paginate the content by word count.
  if (headingIndexes.length === 0) {
    return [{
      chapterNumber: "Chapter 1",
      chapterTitle: lines.find((line) => line.length >= 8 && line.length <= 140) || "Textbook Section",
      text: cleaned,
    }];
  }
  const sections: Array<{
    chapterNumber: string;
    chapterTitle: string;
    text: string;
  }> = [];
  for (let i = 0; i < headingIndexes.length; i += 1) {
    const startLine = headingIndexes[i];
    const endLine =
      i + 1 < headingIndexes.length
        ? headingIndexes[i + 1]
        : lines.length;
    let heading = lines[startLine];
    let bodyStartLine = startLine + 1;
    if (/^(chapter|unit|lesson|part|section|poem|story)$/i.test(heading) && lines[bodyStartLine] && !looksLikeChapterHeading(lines[bodyStartLine])) {
      heading = `${heading} ${lines[bodyStartLine]}`;
      bodyStartLine += 1;
    }
    const body = lines
      .slice(bodyStartLine, endLine)
      .filter((_, offset) => !duplicateHeadingIndexes.has(bodyStartLine + offset))
      .join("\n")
      .trim();
    if (body.length < 40) {
      continue;
    }
    const parsed = extractChapterNumberAndTitle(heading);
    const hasNumberedHeading = /\b\d+\b/.test(heading);
    const chapterNumber = hasNumberedHeading
      ? parsed.chapterNumber
      : `Chapter ${sections.length + 1}`;
    const fullText = `${heading}\n\n${body}`;
    sections.push({
      chapterNumber,
      chapterTitle: parsed.chapterTitle || `Textbook Section ${sections.length + 1}`,
      text: fullText,
    });
  }
  if (sections.length > 0) {
    return sections.slice(0, 100);
  }
  return [{ chapterNumber: "Chapter 1", chapterTitle: "Textbook Section", text: cleaned }];
}
function normalizeChapterResult(
  raw: any,
  fallback: {
    chapterNumber: string;
    chapterTitle: string;
  }
): any {
  return {
    chapterNumber: raw?.chapterNumber || fallback.chapterNumber,
    chapterTitle: raw?.chapterTitle || fallback.chapterTitle,
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
    aiFallback: raw?.aiFallback === true,
  };
}
async function analyzeBookMetadata(
  fileName: string,
  extractedText: string,
  sourceLanguage: TextbookLanguage
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
Required output language: ${sourceLanguage}.
${languageOutputInstruction(sourceLanguage)}
Use only evidence in the OCR.
Ignore publisher introductions, copyright and ISBN pages, table of contents, forewords, author biographies, and marketing copy. Base the summary and educational details only on the actual textbook lesson or story.
Return ONLY valid JSON:
{
  "subject": "string",
  "grade": "Class 1 | Class 2 | Class 3 | Class 4 | Class 5 | Unknown",
  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",
  "bookTitle": "string",
  "overallSummary": "short string"
}
`;
  let result: { text: string; model: string };
  try {
    result = await generateWithOllama(prompt, {
      temperature: 0.05,
      numCtx: 4096,
      timeoutMs: 8 * 60 * 1000,
      keepAlive: "15m",
      numPredict: 350,
    });
  } catch (error: any) {
    if (!isOllamaUnavailable(error)) throw error;
    console.warn(`[QWEN] Ollama is unavailable at ${OLLAMA_BASE_URL}; keeping OCR output and using text excerpts.`);
    const firstContentLine = extractedText
      .replace(/---\s*PAGE\s+\d+\s*---/gi, "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length >= 8) || "";
    return {
      subject: "Textbook",
      grade: "Unknown",
      primaryLanguage: sourceLanguage,
      bookTitle: firstContentLine,
      overallSummary: extractTextExcerpt(extractedText),
      aiFallback: true,
    };
  }
  try {
    return { ...extractJsonObject(result.text), primaryLanguage: sourceLanguage };
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
Required output language: ${sourceLanguage}.
${languageOutputInstruction(sourceLanguage)}
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
    return { ...extractJsonObject(retry.text), primaryLanguage: sourceLanguage };
  }
}
async function analyzeChapterChunk(
  chunk: {
    chapterNumber: string;
    chapterTitle: string;
    text: string;
  },
  sourceLanguage: TextbookLanguage
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
- Ignore publisher introductions, copyright and ISBN material, contents pages, author biographies, and marketing copy. Analyze only the actual lesson or story.
- Do not reproduce the OCR text.
- Keep strings concise.
- Write all generated text in ${sourceLanguage}. ${languageOutputInstruction(sourceLanguage)}
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
      {
        chapterNumber: chunk.chapterNumber,
        chapterTitle: chunk.chapterTitle,
      }
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
Required output language: ${sourceLanguage}. ${languageOutputInstruction(sourceLanguage)}
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
        {
          chapterNumber: chunk.chapterNumber,
          chapterTitle: chunk.chapterTitle,
        }
      );
    } catch (secondError: any) {
      console.warn(
        `[QWEN] Chapter analysis failed after retry for ${chunk.chapterNumber}. Returning OCR-backed fallback.`,
        secondError?.message || secondError
      );
      return normalizeChapterResult(
        {
          chapterNumber: chunk.chapterNumber,
          chapterTitle: chunk.chapterTitle,
          primaryTopic: chunk.chapterTitle,
          summary: extractTextExcerpt(chunk.text),
          aiFallback: true,
          importantConcepts: [],
          keyVocabulary: [],
          learningObjectives: [],
          suggestedStoryThemes: [],
        },
        {
          chapterNumber: chunk.chapterNumber,
          chapterTitle: chunk.chapterTitle,
        }
      );
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
      analysisMode: metadata?.analysisMode || "ai",
      overallSummary:
        metadata?.overallSummary || first?.summary || "",
      aiFallback: metadata?.aiFallback === true || chapters.some((chapter: any) => chapter?.aiFallback === true),
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

async function runPaddleOcrJob(
  binaryData: Buffer,
  mimeType: string,
  fileName: string,
  jobId: string,
  sourceLanguage: TextbookLanguage
): Promise<any> {
  const binaryArrayBuffer = binaryData.buffer.slice(
    binaryData.byteOffset,
    binaryData.byteOffset + binaryData.byteLength
  ) as ArrayBuffer;

  const blob = new Blob([binaryArrayBuffer], {
    type: mimeType || "application/octet-stream",
  });

  const formData = new FormData();

  formData.append(
    "file",
    blob,
    fileName || "textbook.pdf"
  );
  formData.append("source_language", sourceLanguage);

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
      `PaddleOCR job creation returned ${createResponse.status}: ${createRawText.slice(
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
      "PaddleOCR returned an invalid job-creation response."
    );
  }

  if (!createData?.success || !createData?.jobId) {
    throw new Error(
      createData?.error ||
      "PaddleOCR did not return a job id."
    );
  }

  const paddleJobId = String(createData.jobId);

  updateJob(jobId, {
    status: "ocr",
    progress: 6,
    stageMessage:
      "PaddleOCR job started. Reading document pages...",
  });

  console.log(
    `[OCR] Job ${jobId}: PaddleOCR job ${paddleJobId} started.`
  );

  const startedAt = Date.now();
  const maxWaitMs = 45 * 60 * 1000;

  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(1000);

    let statusResponse: Response | null = null;
    let statusRawText = "";

    try {
      statusResponse = await fetch(
        `${OCR_SERVICE_URL}/ocr/status/${encodeURIComponent(
          paddleJobId
        )}`,
        {
          method: "GET",
          signal: AbortSignal.timeout(30 * 1000),
        }
      );

      statusRawText = await statusResponse.text();

      if (!statusResponse.ok) {
        console.warn(
          `[OCR] Job ${jobId}: PaddleOCR status returned ${statusResponse.status}. Retrying...`
        );
        continue;
      }
    } catch (error: any) {
      console.warn(
        `[OCR] Job ${jobId}: Temporary status connection error: ${error?.message || error
        }. Retrying...`
      );
      continue;
    }

    let statusData: any;

    try {
      statusData = JSON.parse(statusRawText);
    } catch {
      console.warn(
        `[OCR] Job ${jobId}: Invalid PaddleOCR status response. Retrying...`
      );
      continue;
    }

    const ocrProgress = Number(
      statusData?.progress ?? 0
    );

    updateJob(jobId, {
      status:
        statusData?.status === "completed"
          ? "ocr"
          : "ocr",
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
        "PaddleOCR is processing the document...",
    });

    if (
      statusData?.status === "completed"
    ) {
      const extractedText = String(
        statusData?.text ||
        statusData?.extractedText ||
        statusData?.result?.text ||
        ""
      );

      if (!extractedText.trim()) {
        throw new Error(
          "PaddleOCR completed but returned no extracted text."
        );
      }

      console.log(
        `[OCR] Job ${jobId}: PaddleOCR completed with ${extractedText.length} characters.`
      );

      return statusData;
    }

    if (
      statusData?.status === "failed"
    ) {
      throw new Error(
        statusData?.error ||
        "PaddleOCR processing failed."
      );
    }

    if (
      statusData?.status === "lost"
    ) {
      throw new Error(
        statusData?.error ||
        "PaddleOCR job was lost."
      );
    }
  }

  throw new Error(
    "PaddleOCR took longer than 45 minutes. The OCR job was stopped by the backend."
  );
}

async function processTextbookJob(
  jobId: string,
  params: {
    fileData: string;
    mimeType: string;
    fileName: string;
    sourceLanguage: string;
  }
): Promise<void> {
  const { fileData, mimeType, fileName, sourceLanguage: requestedLanguage } = params;
  try {
    updateJob(jobId, {
      status: "ocr",
      progress: 5,
      stageMessage: "Reading every page with PaddleOCR...",
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
        "Sending document to the asynchronous PaddleOCR service...",
    });

    console.log(
      `[OCR] Job ${jobId}: Processing ${fileName}`
    );

    const ocrData = await runPaddleOcrJob(
      binaryData,
      mimeType,
      fileName,
      jobId,
      requestedLanguage === "Hindi" || requestedLanguage === "Telugu"
        ? requestedLanguage
        : "English"
    );

    let extractedText = "";

    if (typeof ocrData?.text === "string") {
      extractedText = ocrData.text;
    } else if (
      typeof ocrData?.extractedText === "string"
    ) {
      extractedText = ocrData.extractedText;
    } else if (
      typeof ocrData?.result?.text === "string"
    ) {
      extractedText = ocrData.result.text;
    } else if (
      typeof ocrData?.data?.text === "string"
    ) {
      extractedText = ocrData.data.text;
    } else if (Array.isArray(ocrData?.pages)) {
      extractedText = ocrData.pages
        .map((page: any, index: number) => {
          const pageText =
            page?.text ||
            page?.extractedText ||
            "";
          return `\n--- PAGE ${index + 1} ---\n${pageText}`;
        })
        .join("\n");
    }

    const rawOcrText = extractedText;
    const sourceLanguage = resolveTextbookLanguage(rawOcrText, requestedLanguage);
    const tocChapters = extractTocChapters(rawOcrText, sourceLanguage);
    const printedPageOffset = inferPrintedPageOffset(rawOcrText);
    console.log(`[OCR] Job ${jobId}: ${tocChapters.length} contents entries; printed-page offset ${printedPageOffset.offset ?? "unknown"} from ${printedPageOffset.samples} page footers.`);
    extractedText = removePublisherFrontMatter(extractedText);

    if (!extractedText) {
      throw new Error(
        "No lesson text was found after removing publisher and front-matter pages. Upload pages that contain the textbook lesson."
      );
    }

    extractedText = filterStudentContentPages(extractedText, sourceLanguage);
    extractedText = keepTextbookLanguage(extractedText, sourceLanguage);
    if (!extractedText) {
      throw new Error("No student-readable story or lesson pages were found. Check the selected textbook language and uploaded pages.");
    }
    telemetryStats.totalOcrScans += 1;
    const chunks = detectTextbookChunks(extractedText, tocChapters, sourceLanguage, printedPageOffset.offset);
    console.log(
      `[OCR] Job ${jobId}: ${extractedText.length} characters, ${chunks.length} lesson sections`
    );
    updateJob(jobId, {
      status: "ocr",
      progress: 52,
      stageMessage: `OCR complete. Organizing ${chunks.length} lesson sections...`,
    });
    const metadata = inferTextbookMetadata(
      fileName,
      extractedText,
      sourceLanguage
    );
    const chapters: any[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      updateJob(jobId, {
        status: "ocr",
        progress: Math.max(
          58,
          Math.min(
            94,
            Math.round(
              58 + (index / Math.max(1, chunks.length)) * 36
            )
          )
        ),
        stageMessage: `Preparing lesson ${index + 1} of ${chunks.length} from extracted text...`,
      });
      const chapter = normalizeChapterResult({
        ...chunks[index],
        primaryTopic: chunks[index].chapterTitle,
        summary: extractTextExcerpt(chunks[index].text),
        aiFallback: false,
      }, chunks[index]);
      chapters.push({ ...chapter, sourceText: chunks[index].text });
    }
    const analysis = combineTextbookAnalysis(
      metadata,
      chapters,
      extractedText
    );
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      stageMessage: "OCR completed. Lessons were organized from the extracted textbook text.",
      result: {
        success: true,
        fileName: fileName || "textbook",
        ocr: {
          engine: "PaddleOCR",
          serviceUrl: OCR_SERVICE_URL,
          characterCount: extractedText.length,
          extractedText,
          chunkCount: chunks.length,
        },
        ai: {
          provider: "Disabled for textbook analysis",
          model: null,
          serviceUrl: null,
          available: false,
        },
        analysis,
      },
    });
    console.log(
      `[OCR] Job ${jobId}: Textbook lessons organized successfully.`
    );
  } catch (error: any) {
    console.error(
      `[OCR] Job ${jobId} failed:`,
      error
    );
    const message = error?.message || "Failed to process textbook.";
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
app.post("/api/ocr/analyze-textbook", async (req, res) => {
  try {
    const { fileData, mimeType, fileName, sourceLanguage = "Auto" } = req.body;
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
      `[OCR] Created textbook job ${job.id} for ${job.fileName}`
    );
    // Do not await this. The browser gets the job id immediately.
    void processTextbookJob(job.id, {
      fileData,
      mimeType: safeMimeType,
      fileName: fileName || "textbook.pdf",
      sourceLanguage: ["Auto", "English", "Hindi", "Telugu"].includes(sourceLanguage) ? sourceLanguage : "Auto",
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
   PaddleOCR :8001
       â†“
   Extracted text
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
4. Include exactly 3 comprehension questions.
   Each question MUST test understanding of specific events, characters,
   or details from the story text above (e.g. "what did X do", "why did Y
   happen", "where/when did Z take place"). Every question must have 4
   distinct, plausible options and exactly one correct answer.
   NEVER include a closing/meta remark disguised as a question — do not
   ask things like "would you like to read another story?", "shall we
   read one more?", or any prompt about continuing/finishing the
   activity. Those are not comprehension questions and break the reading
   app's "Next Question" flow, which expects every entry to be a real,
   answerable question about the story.
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

      // Safety net beyond the prompt instruction above: if the model still
      // generates a closing/meta remark disguised as a question (e.g. "shall
      // we read one more story?"), strip it out here so it never reaches the
      // reading app's quiz UI, which expects every entry to be a real,
      // answerable comprehension question with a working "Next Question" flow.
      if (Array.isArray(storyData?.comprehensionQuiz)) {
        const closingRemarkPattern =
          /read (one|another) more|read.*again|inka\s*vokati|chaduvudhama|shall we (read|continue)|want to (read|continue)/i;
        storyData.comprehensionQuiz = storyData.comprehensionQuiz.filter(
          (q: any) => q?.question && !closingRemarkPattern.test(String(q.question))
        );
      }

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
   SARVAM SPEECH-TO-TEXT (Reading Aloud microphone capture)
   NOTE: this route was missing from server.ts, so the client's
   fetch('/api/speech/transcribe') hit Express's default HTML 404
   page instead of JSON, and response.json() threw
   "Unexpected token '<' is not valid JSON" — the exact STT/mic
   failure reported in QA. Restored from the last known-good build.
========================================================= */
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
        console.error("SARVAM_API_KEY is not configured.");
        return res.status(500).json({
          success: false,
          error: "Sarvam API key is not configured.",
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

      const sttResponse = await fetch(
        "https://api.sarvam.ai/speech-to-text",
        {
          method: "POST",
          headers: { "api-subscription-key": apiKey },
          body: form,
        }
      );

      const data = await sttResponse.json();

      if (!sttResponse.ok) {
        console.error("Sarvam STT Error:", data);
        return res.status(sttResponse.status).json({
          success: false,
          error:
            data?.error?.message ||
            data?.message ||
            "Sarvam STT request failed.",
        });
      }

      return res.json({
        success: true,
        transcript: data?.transcript || "",
        languageCode: data?.language_code || languageCode,
        languageProbability: data?.language_probability ?? null,
      });
    } catch (error: any) {
      console.error("Speech Transcription Error:", error);
      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to transcribe speech using Sarvam STT.",
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
   SARVAM TEXT-TO-SPEECH
========================================================= */
app.post(
  "/api/speech/synthesize",
  async (req, res) => {
    try {
      const {
        text,
        language = "Telugu",
        voiceName = "shubh",
        style = "cheerful_teacher",
        pace: requestedPace,
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

      const sarvamApiKey =
        process.env.SARVAM_API_KEY;

      if (!sarvamApiKey) {
        console.error(
          "SARVAM_API_KEY is not configured."
        );

        return res.status(500).json({
          success: false,
          error:
            "Sarvam API key is not configured.",
        });
      }

      /*
       * Convert the application's language names
       * into Sarvam's required BCP-47 language codes.
       */
      const languageMap: Record<
        string,
        string
      > = {
        Telugu: "te-IN",
        telugu: "te-IN",

        Hindi: "hi-IN",
        hindi: "hi-IN",

        English: "en-IN",
        english: "en-IN",

        Tamil: "ta-IN",
        tamil: "ta-IN",

        Kannada: "kn-IN",
        kannada: "kn-IN",

        Malayalam: "ml-IN",
        malayalam: "ml-IN",

        Bengali: "bn-IN",
        bengali: "bn-IN",

        Marathi: "mr-IN",
        marathi: "mr-IN",

        Gujarati: "gu-IN",
        gujarati: "gu-IN",

        Punjabi: "pa-IN",
        punjabi: "pa-IN",

        Odia: "od-IN",
        odia: "od-IN",
      };

      const languageCode =
        languageMap[language] ||
        languageMap[
        String(language).toLowerCase()
        ] ||
        "en-IN";

      /*
       * Sarvam Bulbul v3 supports lowercase
       * speaker names.
       *
       * Your old Gemini voice names such as
       * "Kore" are not valid Sarvam speakers.
       */
      const speakerMap: Record<
        string,
        string
      > = {
        shubh: "shubh",
        aditya: "aditya",
        ritu: "ritu",
        priya: "priya",
        neha: "neha",
        rahul: "rahul",
        pooja: "pooja",
        rohan: "rohan",
        simran: "simran",
        kavya: "kavya",
        amit: "amit",
        dev: "dev",
        ishita: "ishita",
        shreya: "shreya",
        roopa: "roopa",
        tanya: "tanya",
        shruti: "shruti",
        suhani: "suhani",
        kavitha: "kavitha",
      };

      const requestedSpeaker =
        typeof voiceName === "string"
          ? voiceName.toLowerCase()
          : "shubh";

      const speaker =
        speakerMap[requestedSpeaker] ||
        "shubh";

      /*
       * Reverted (again): an earlier version of this route always forced
       * pace=1.0 to Sarvam and had the client stretch the audio afterwards
       * via AudioBufferSourceNode.playbackRate. That was worse than the
       * problem it tried to solve — naive client-side playbackRate shifts
       * PITCH along with speed, making the same voice sound like a
       * different person (deeper/more male-sounding when slowed down,
       * higher/chipmunk-like when sped up) at every single non-1.0 speed.
       * That's a bigger, more constant problem than the handful of
       * individual words Sarvam mispronounces at non-1.0 paces. So: pass
       * the user's requested speed straight through to Sarvam again, and
       * let its own model handle the pace change (it keeps voice identity
       * intact, which is the priority). Known problem words are handled
       * per-word in speechSynthesis.ts (FORCE_NATURAL_PACE_WORDS forces
       * just that one word to 1.0x; TTS_PRONUNCIATION_FIXES respells a
       * word's synthesis input) rather than by fighting the pace parameter
       * for every word in the app.
       */
      const parsedPace =
        typeof requestedPace === "number"
          ? requestedPace
          : parseFloat(requestedPace);
      const pace = Number.isNaN(parsedPace)
        ? 1.0
        : Math.min(1.3, Math.max(0.6, parsedPace));

      /*
       * Sarvam Bulbul v3 supports up to
       * 2500 characters per REST request.
       */
      if (text.length > 2500) {
        return res.status(400).json({
          success: false,
          error:
            "Text is too long for Sarvam TTS. Maximum 2500 characters per request.",
        });
      }

      console.log(
        `[SARVAM TTS] ${languageCode} | ${speaker} | ${style} | synthesizing at ${pace}x`
      );

      const sarvamResponse =
        await fetch(
          "https://api.sarvam.ai/text-to-speech",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "api-subscription-key":
                sarvamApiKey,
            },
            body: JSON.stringify({
              text,
              model: "bulbul:v3",
              language_code:
                languageCode,
              speaker,
              pace,
              speech_sample_rate: 24000,
              output_audio_codec: "wav",
            }),
          }
        );

      if (!sarvamResponse.ok) {
        const errorText =
          await sarvamResponse.text();

        console.error(
          "[SARVAM TTS] API Error:",
          sarvamResponse.status,
          errorText
        );

        return res.status(
          sarvamResponse.status
        ).json({
          success: false,
          error:
            `Sarvam TTS API error (${sarvamResponse.status}).`,
          details: errorText,
        });
      }

      const data =
        await sarvamResponse.json();

      const base64Audio =
        data?.audios?.[0];

      if (!base64Audio) {
        console.error(
          "[SARVAM TTS] No audio returned:",
          data
        );

        return res.status(500).json({
          success: false,
          error:
            "No audio returned from Sarvam TTS.",
        });
      }

      console.log(
        "[SARVAM TTS] Audio generated successfully."
      );

      /*
       * Keep the response format compatible
       * with the existing frontend.
       */
      return res.json({
        success: true,
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        sampleRate: 24000,
        voiceName: speaker,
        language,
        languageCode,
        provider: "sarvam",
      });
    } catch (error: any) {
      console.error(
        "Sarvam Speech Synthesis Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to synthesize speech with Sarvam.",
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use((req, res, next) => {
      // Do not let Vite handle API requests.
      // Express/Firebase routes must handle /api/*.
      if (req.path.startsWith("/api/")) {
        return next();
      }

      return vite.middlewares(req, res, next);
    });
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
        `PaddleOCR        : ${OCR_SERVICE_URL}`
      );
      console.log(
        `Ollama           : ${OLLAMA_BASE_URL}`
      );
      console.log(
        `Ollama Model     : ${OLLAMA_MODEL}`
      );
      console.log(
        `Ollama           : ${OLLAMA_BASE_URL}`
      );
      console.log(
        `Ollama Model     : ${OLLAMA_MODEL}`
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
