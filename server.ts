import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import firebaseRouter from "./server/firebaseRoutes";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser with 50MB limit for textbook PDF/image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Firebase Authentication, curriculum, lessons, reading sessions and analytics.
app.use("/api", firebaseRouter);

// Local Ollama configuration
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "qwen2.5:3b";

const OCR_SERVICE_URL =
  process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";

function cleanBase64(value: string): string {
  const text = String(value || "");
  return text.includes("base64,")
    ? text.split("base64,")[1]
    : text;
}

function extractJsonObject(value: string): any {
  const text = String(value || "").trim();

  try {
    return JSON.parse(text);
  } catch {
    // Continue below and recover JSON from markdown/code fences.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue to balanced-object extraction.
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Invalid JSON from the model.
    }
  }

  throw new Error("Ollama returned invalid JSON.");
}

async function generateWithOllama(
  prompt: string,
  options: {
    temperature?: number;
    numCtx?: number;
    numPredict?: number;
    timeoutMs?: number;
    keepAlive?: string;
  } = {}
): Promise<{ text: string }> {
  const response = await fetch(
    `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
        keep_alive: options.keepAlive || "15m",
        options: {
          temperature: options.temperature ?? 0.1,
          num_ctx: options.numCtx ?? 4096,
          num_predict: options.numPredict ?? 700,
        },
      }),
      signal: AbortSignal.timeout(
        options.timeoutMs ?? 5 * 60 * 1000
      ),
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}: ${raw.slice(0, 1000)}`
    );
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Ollama returned an invalid API response.");
  }

  if (typeof data?.response !== "string") {
    throw new Error("Ollama returned no generated response.");
  }

  return { text: data.response };
}

function normalizeStringArray(
  value: any,
  maxItems: number
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeVocabulary(value: any): Array<{
  word: string;
  meaning: string;
  phonetic: string;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      word: String(item?.word || "").trim(),
      meaning: String(item?.meaning || "").trim(),
      phonetic: String(
        item?.phonetic || item?.pronunciation || ""
      ).trim(),
    }))
    .filter((item) => item.word)
    .slice(0, 8);
}

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

async function runPaddleOcr(
  fileData: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const binaryData = Buffer.from(
    cleanBase64(fileData),
    "base64"
  );

  const formData = new FormData();

  formData.append(
    "file",
    new Blob([binaryData], {
      type:
        mimeType ||
        (fileName?.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "image/jpeg"),
    }),
    fileName || "textbook.pdf"
  );

  const createResponse = await fetch(
    `${OCR_SERVICE_URL.replace(/\/$/, "")}/ocr`,
    {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60 * 1000),
    }
  );

  const createRaw = await createResponse.text();

  if (!createResponse.ok) {
    throw new Error(
      `PaddleOCR returned ${createResponse.status}: ${createRaw.slice(0, 1000)}`
    );
  }

  let createData: any;
  try {
    createData = JSON.parse(createRaw);
  } catch {
    throw new Error("PaddleOCR returned invalid JSON.");
  }

  // Async PaddleOCR service returns a job id.
  const jobId =
    createData?.jobId ||
    createData?.job_id ||
    createData?.id;

  if (jobId) {
    const statusUrl =
      `${OCR_SERVICE_URL.replace(/\/$/, "")}/ocr/status/${encodeURIComponent(jobId)}`;

    const deadline = Date.now() + 20 * 60 * 1000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusResponse = await fetch(statusUrl, {
        signal: AbortSignal.timeout(30 * 1000),
      });

      const statusRaw = await statusResponse.text();

      if (!statusResponse.ok) {
        throw new Error(
          `PaddleOCR status returned ${statusResponse.status}: ${statusRaw.slice(0, 1000)}`
        );
      }

      let statusData: any;
      try {
        statusData = JSON.parse(statusRaw);
      } catch {
        throw new Error("PaddleOCR status returned invalid JSON.");
      }

      const status =
        statusData?.status ||
        statusData?.job?.status;

      if (
        status === "failed" ||
        status === "error"
      ) {
        throw new Error(
          statusData?.error ||
          statusData?.job?.error ||
          "PaddleOCR job failed."
        );
      }

      if (
        status === "completed" ||
        status === "done" ||
        status === "success"
      ) {
        const result =
          statusData?.result ||
          statusData?.job?.result ||
          statusData;

        const extracted =
          result?.text ||
          result?.extractedText ||
          result?.data?.text ||
          statusData?.text ||
          statusData?.extractedText;

        if (typeof extracted === "string") {
          return cleanOcrText(extracted);
        }

        if (Array.isArray(result?.pages)) {
          return cleanOcrText(
            result.pages
              .map(
                (page: any, index: number) =>
                  `--- PAGE ${index + 1} ---\n${page?.text || page?.extractedText || ""}`
              )
              .join("\n")
          );
        }

        throw new Error(
          "PaddleOCR completed but returned no extracted text."
        );
      }
    }

    throw new Error(
      "PaddleOCR job timed out after 20 minutes."
    );
  }

  // Compatibility with an older synchronous PaddleOCR response.
  const extracted =
    createData?.text ||
    createData?.extractedText ||
    createData?.data?.text;

  if (typeof extracted === "string") {
    return cleanOcrText(extracted);
  }

  if (Array.isArray(createData?.pages)) {
    return cleanOcrText(
      createData.pages
        .map(
          (page: any, index: number) =>
            `--- PAGE ${index + 1} ---\n${page?.text || page?.extractedText || ""}`
        )
        .join("\n")
    );
  }

  throw new Error(
    "PaddleOCR completed but no text was extracted."
  );
}

// Telemetry metrics
const startTime = Date.now();
const telemetryStats = {
  totalOcrScans: 42,
  totalStoriesGenerated: 68,
  totalReadingMinutes: 1840,
  totalSpeechEvaluations: 310,
  activeSchoolsCount: 3,
  totalStudentsRegistered: 148,
  totalFacultyMembers: 7,
  tokenConsumptionEstimate: 142050,
};

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// API: SuperAdmin Security Passkey Verification
app.post("/api/auth/superadmin-verify", (req, res) => {
  const { key, uriCode } = req.body;
  if (uriCode !== "superadmin221b") {
    return res.status(403).json({ error: "Access Denied. Invalid SuperAdmin security route." });
  }
  if (key === "shakthi_admin_2026" || key === "superadmin221b") {
    return res.json({
      success: true,
      message: "SuperAdmin authorization successful.",
      session: {
        id: "superadmin_root",
        name: "State System Director (SuperAdmin)",
        role: "superadmin",
        avatar: "🛡️",
        schoolId: "all",
        schoolName: "SCERT State Primary Literacy Mission",
        designation: "Chief Technology & Curriculum Administrator",
      },
    });
  }
  return res.status(401).json({ error: "Invalid SuperAdmin security key." });
});

// API: SuperAdmin Telemetry
app.get("/api/superadmin/telemetry", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    serverStatus: "healthy",
    uptimeSeconds: uptime,
    aiProvider: "Ollama",
    ollamaModel: OLLAMA_MODEL,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ocrProvider: "PaddleOCR",
    ocrServiceUrl: OCR_SERVICE_URL,
    ...telemetryStats,
  });
});


// API: OCR Textbook Analysis (PDF / Image)
// PDF/Image -> PaddleOCR -> OCR text -> Ollama Qwen 2.5 3B
app.post("/api/ocr/analyze-textbook", async (req, res) => {
  try {
    const {
      fileData,
      mimeType,
      fileName,
    } = req.body;

    if (!fileData) {
      return res.status(400).json({
        error: "No file data provided.",
      });
    }

    console.log(
      `[OCR] Starting textbook analysis for ${fileName || "textbook"}`
    );

    const extractedText = await runPaddleOcr(
      fileData,
      mimeType,
      fileName || "textbook.pdf"
    );

    if (!extractedText) {
      throw new Error(
        "PaddleOCR completed but no text was extracted."
      );
    }

    telemetryStats.totalOcrScans += 1;

    const textForModel =
      extractedText.length > 24000
        ? `${extractedText.slice(0, 12000)}\n\n[...middle of OCR text omitted for context limit...]\n\n${extractedText.slice(-12000)}`
        : extractedText;

    const prompt = `You are an expert primary school educational curriculum analyst specializing in Indian multilingual education (Telugu, Hindi, English) for Classes 1 to 5.

Analyze the OCR text extracted from a textbook.

Tasks:
1. Identify the Subject.
2. Identify the Grade/Class.
3. Identify Chapter Number if supported by the text.
4. Identify Chapter Title.
5. Identify the primary language.
6. Give a concise, child-friendly summary of 150-250 words.
7. Extract 5-8 key vocabulary words with simple meanings and phonetics.
8. Give 3 learning objectives.
9. Suggest 2 story themes.

Rules:
- Use ONLY information supported by the OCR text.
- Do not invent facts.
- Preserve Telugu, Hindi and English text when present.
- Ignore page numbers, repeated headers/footers, copyright notices and obvious OCR noise.
- Return ONLY valid JSON.

JSON schema:
{
  "subject": "string",
  "grade": "string",
  "chapterNumber": "string",
  "chapterTitle": "string",
  "primaryLanguage": "Telugu | Hindi | English | Bilingual | Unknown",
  "extractedText": "string",
  "summary": "string",
  "keyVocabulary": [
    {
      "word": "string",
      "meaning": "string",
      "phonetic": "string"
    }
  ],
  "learningObjectives": ["string", "string", "string"],
  "suggestedStoryThemes": ["string", "string"]
}

OCR TEXT:
---------------- BEGIN ----------------
${textForModel}
----------------- END -----------------
`;

    const generated = await generateWithOllama(
      prompt,
      {
        temperature: 0.1,
        numCtx: 4096,
        numPredict: 1000,
        timeoutMs: 5 * 60 * 1000,
        keepAlive: "15m",
      }
    );

    const parsedData = extractJsonObject(
      generated.text
    );

    const analysis = {
      subject: String(
        parsedData?.subject || "Unknown"
      ).trim(),

      grade: String(
        parsedData?.grade || "Unknown"
      ).trim(),

      chapterNumber: String(
        parsedData?.chapterNumber || "Unknown"
      ).trim(),

      chapterTitle: String(
        parsedData?.chapterTitle || "Untitled Chapter"
      ).trim(),

      primaryLanguage: String(
        parsedData?.primaryLanguage || "Unknown"
      ).trim(),

      extractedText,

      summary: String(
        parsedData?.summary || ""
      ).trim(),

      keyVocabulary: normalizeVocabulary(
        parsedData?.keyVocabulary
      ),

      learningObjectives: normalizeStringArray(
        parsedData?.learningObjectives,
        3
      ),

      suggestedStoryThemes: normalizeStringArray(
        parsedData?.suggestedStoryThemes,
        2
      ),
    };

    console.log(
      `[OLLAMA] Textbook analysis completed using ${OLLAMA_MODEL}.`
    );

    res.json({
      success: true,
      analysis,
      ai: {
        provider: "Ollama",
        model: OLLAMA_MODEL,
        serviceUrl: OLLAMA_BASE_URL,
      },
      ocr: {
        provider: "PaddleOCR",
        serviceUrl: OCR_SERVICE_URL,
        characterCount: extractedText.length,
      },
    });
  } catch (error: any) {
    console.error("OCR/Ollama Analysis Error:", error);

    res.status(500).json({
      error:
        error?.message ||
        "Failed to analyze textbook with PaddleOCR and Ollama.",
    });
  }
});

// API: Generate Read-Along Story from Chapter Summary / Concept
app.post("/api/stories/generate-from-summary", async (req, res) => {
  try {
    const {
      chapterTitle,
      subject,
      grade,
      summary,
      targetLanguage = "Telugu", // "Telugu" | "Hindi" | "English"
      difficulty = "Medium", // "Easy" | "Medium" | "Challenging"
      storyType = "Moral & Adventure",
    } = req.body;

    const prompt = `You are a beloved children's storybook author and literacy specialist for primary school children in rural India (like Google Read Along).
Create a joyful, high-engagement, decodable Read Along story based on this textbook chapter.

Textbook Details:
- Chapter Title: ${chapterTitle || "Village Learning"}
- Subject: ${subject || "General Knowledge"}
- Grade Level: ${grade || "Class 2"}
- Chapter Concept / Summary: ${summary || "Learning about friendship, nature, and community"}
- Target Story Language: ${targetLanguage} (Telugu / తెలుగు, Hindi / हिन्दी, or English)
- Difficulty Level: ${difficulty} (Easy = simple 3-5 word sentences; Medium = 6-9 word sentences; Challenging = rich vocabulary)
- Theme: ${storyType}

Guidelines:
1. Write the story in ${targetLanguage}. If Telugu or Hindi, use natural, authentic, and child-friendly phrasing with proper diacritics / matras / ottulu.
2. Structure the story into 4 to 6 sequential pages.
3. Each page must contain:
   - "pageNumber": integer (1 to 6)
   - "text": The main narrative sentence(s) in ${targetLanguage}
   - "englishTranslation": English meaning of the page
   - "transliteration": Romanized phonetic pronunciation guide (e.g. for Telugu/Hindi to help beginners)
   - "illustrationPrompt": Vivid description for rural Indian storybook illustration (e.g. a smiling boy flying a kite next to a banyan tree with peacocks)
   - "suggestedSoundEffect": Child-friendly sound prompt (e.g. birds chirping, rain pitter-patter, applause)
4. Include 3 interactive comprehension check questions at the end with multiple choice options and explanation in ${targetLanguage}.
5. Include 5-6 spotlight vocabulary words with meanings and fun child-friendly examples.

Respond ONLY in valid JSON matching this schema:
{
  "title": "string (Story title in ${targetLanguage})",
  "titleEnglish": "string (English title)",
  "language": "${targetLanguage}",
  "gradeLevel": "${grade || 'Class 2'}",
  "difficulty": "${difficulty}",
  "coverIllustrationPrompt": "string",
  "category": "${subject || 'Science & Nature'}",
  "moralOrTakeaway": "string",
  "pages": [
    {
      "pageNumber": 1,
      "text": "string (sentence in ${targetLanguage})",
      "englishTranslation": "string",
      "transliteration": "string",
      "illustrationPrompt": "string",
      "suggestedSoundEffect": "string"
    }
  ],
  "spotlightWords": [
    { "word": "string", "meaning": "string", "pronunciation": "string", "example": "string" }
  ],
  "comprehensionQuiz": [
    {
      "question": "string (question in ${targetLanguage})",
      "questionEnglish": "string",
      "options": ["string", "string", "string", "string"],
      "correctOptionIndex": 0,
      "explanation": "string"
    }
  ]
}`;

    const generated = await generateWithOllama(
      prompt,
      {
        temperature: 0.35,
        numCtx: 4096,
        numPredict: 1800,
        timeoutMs: 6 * 60 * 1000,
        keepAlive: "15m",
      }
    );

    const storyData = extractJsonObject(
      generated.text
    );

    res.json({
      success: true,
      story: storyData,
    });
  } catch (error: any) {
    console.error("Story Generation Error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate Read Along story from summary.",
    });
  }
});

// API: AI Pronunciation & Reading Diagnostic Evaluation
app.post("/api/speech/evaluate-pronunciation", async (req, res) => {
  try {
    const { targetText, spokenText, language = "Telugu" } = req.body;

    const prompt = `You are a supportive, warm primary school reading tutor for kids in rural India.
Target sentence that the child was reading: "${targetText}"
Recognized spoken text from child: "${spokenText}"
Language: ${language}

Evaluate the child's reading attempt:
1. Calculate approximate word accuracy percentage (0-100%).
2. Identify matched words, missed words, and mispronounced words.
3. Provide warm, encouraging praise in ${language} and in English suitable for a 6-9 year old child (e.g. "Super effort!", "శభాష్! చాలా బాగా చదివావు!").
4. Provide a helpful phonics tip if a specific letter or syllable was tricky.

Respond ONLY with JSON:
{
  "accuracyScore": 92,
  "wordsMatched": ["word1", "word2"],
  "wordsMissed": ["word3"],
  "encouragement": "string",
  "encouragementNative": "string",
  "phonicsTip": "string",
  "starsEarned": 3
}`;

    const generated = await generateWithOllama(
      prompt,
      {
        temperature: 0.1,
        numCtx: 4096,
        numPredict: 500,
        timeoutMs: 3 * 60 * 1000,
        keepAlive: "15m",
      }
    );

    const result = extractJsonObject(
      generated.text
    );
    res.json({ success: true, evaluation: result });
  } catch (error: any) {
    console.error("Speech Evaluation Error:", error);
    res.status(500).json({
      error: error.message || "Failed to evaluate speech attempt.",
    });
  }
});

// API: Sarvam Bulbul v3 multilingual TTS
app.post("/api/speech/synthesize", async (req, res) => {
  try {
    const {
      text,
      language = "Telugu",
      voiceName = "Priya",
      style = "cheerful_teacher",
      pace = 1.0,
    } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required for speech synthesis." });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "SARVAM_API_KEY is not configured in .env" });
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
      Priya: 'priya',
      Shubh: 'shubh',
      Neha: 'neha',
      Ratan: 'ratan',
      Ishita: 'ishita',
      Suhani: 'suhani',
    };

    const speaker = speakerMap[voiceName] || 'priya';
    const languageCode = languageCodeMap[language] || 'en-IN';

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
        error: data?.error?.message || data?.message || "Sarvam TTS request failed.",
      });
    }

    const audioBase64 = data?.audios?.[0];
    if (!audioBase64) {
      return res.status(500).json({ error: "Sarvam returned no audio." });
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
      error: error.message || "Failed to synthesize speech using Sarvam TTS.",
    });
  }
});

// API: Sarvam Saaras v4 multilingual STT for short reading attempts (<=30s)
app.post("/api/speech/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", language = "Telugu" } = req.body;
    const normalizedMimeType = String(mimeType).split(';')[0].trim() || 'audio/webm';

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "audioBase64 is required." });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "SARVAM_API_KEY is not configured in .env" });
    }

    const languageCodeMap: Record<string, string> = {
      Telugu: "te-IN",
      Hindi: "hi-IN",
      English: "en-IN",
    };
    const languageCode = languageCodeMap[language] || "en-IN";

    const buffer = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: normalizedMimeType }), "reading.webm");
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
        error: data?.error?.message || data?.message || "Sarvam STT request failed.",
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
      error: error.message || "Failed to transcribe speech using Sarvam STT.",
    });
  }
});

// Setup Vite or Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BoloRead server running on http://localhost:${PORT}`);
    console.log(`AI provider: Ollama (${OLLAMA_MODEL})`);
    console.log(`OCR provider: PaddleOCR (${OCR_SERVICE_URL})`);
    console.log("Firebase API routes: /api/*");
  });
}

startServer();
