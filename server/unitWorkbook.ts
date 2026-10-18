// The unit workbook of a published chapter: Lesson → Fill in the blanks →
// Questions & Answers → Learning outcomes → What I learned (reflection) →
// Activity. A text-only version is always built from what publishing
// already stored (key points, vocabulary, objectives, discussion questions,
// the chapter's own sentences); an AI version (answers, an activity, better
// questions) replaces it when the AI is available, and is checked here so a
// broken answer never reaches a child.
import { buildFallbackQuiz, scriptLanguage } from "./textbookOcr";

export const WORKBOOK_VERSION = 1;

export interface WorkbookBlank {
  /** The sentence with "_____" where the word goes. */
  sentence: string;
  answer: string;
  options: string[];
}

export interface WorkbookQuestion {
  question: string;
  kind: "short" | "long" | "apply";
  /** A model answer for the child to check against (empty when unknown). */
  answer: string;
}

export interface UnitWorkbook {
  version: number;
  source: "ai" | "text";
  language: string;
  lesson: { points: string[]; words: { word: string; meaning: string }[] };
  blanks: WorkbookBlank[];
  questions: WorkbookQuestion[];
  /** "I can …" statements the child rates themselves on. */
  outcomes: string[];
  /** Reflection prompts, in the chapter's language. */
  reflection: string[];
  activity: { title: string; steps: string[]; materials: string[] };
}

type ReadingLike = {
  chapterTitle?: string;
  language?: string;
  subject?: string;
  grade?: string;
  paragraphs?: string[];
  summary?: string;
  keyPoints?: string[];
  importantConcepts?: string[];
  keyVocabulary?: { word?: string; meaning?: string }[];
  learningObjectives?: string[];
  discussionQuestions?: string[];
  teachingTips?: string[];
  comprehensionQuiz?: { question?: string; options?: string[]; correctOptionIndex?: number; explanation?: string }[];
};

const REFLECTION: Record<string, string[]> = {
  English: [
    "What did I understand from this lesson?",
    "What new thing did I learn?",
    "What was interesting? What was difficult?",
    "Where can I use this in my life?",
    "What can I do now that I could not do before?",
  ],
  Telugu: [
    "ఈ పాఠం నుండి నాకు ఏమి అర్థమైంది?",
    "నేను నేర్చుకున్న కొత్త విషయం ఏమిటి?",
    "ఏది ఆసక్తిగా ఉంది? ఏది కష్టంగా ఉంది?",
    "దీనిని నా జీవితంలో ఎక్కడ ఉపయోగించగలను?",
    "ఇంతకు ముందు చేయలేనిది ఇప్పుడు నేను ఏమి చేయగలను?",
  ],
  Hindi: [
    "इस पाठ से मुझे क्या समझ आया?",
    "मैंने कौन-सी नई बात सीखी?",
    "क्या रोचक लगा? क्या कठिन लगा?",
    "मैं इसे अपने जीवन में कहाँ उपयोग कर सकता/सकती हूँ?",
    "अब मैं क्या कर सकता/सकती हूँ जो पहले नहीं कर पाता/पाती था/थी?",
  ],
};

const ACTIVITY: Record<string, { title: string; steps: string[]; materials: string[] }> = {
  English: {
    title: "Draw and tell",
    steps: [
      "Draw one picture about this lesson.",
      "Write two sentences about your picture.",
      "Tell your picture to a friend or at home.",
    ],
    materials: ["Notebook", "Pencil or crayons"],
  },
  Telugu: {
    title: "బొమ్మ గీసి చెప్పు",
    steps: ["ఈ పాఠం గురించి ఒక బొమ్మ గీయి.", "నీ బొమ్మ గురించి రెండు వాక్యాలు రాయి.", "నీ బొమ్మ గురించి స్నేహితునికి లేదా ఇంట్లో చెప్పు."],
    materials: ["నోట్ పుస్తకం", "పెన్సిల్ లేదా రంగులు"],
  },
  Hindi: {
    title: "चित्र बनाओ और बताओ",
    steps: ["इस पाठ के बारे में एक चित्र बनाओ।", "अपने चित्र के बारे में दो वाक्य लिखो।", "अपना चित्र किसी दोस्त को या घर पर दिखाकर बताओ।"],
    materials: ["कॉपी", "पेंसिल या रंग"],
  },
};

const OUTCOME_PREFIX: Record<string, string> = { English: "I can", Telugu: "నేను", Hindi: "मैं" };

const clean = (v: unknown, max = 400) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const langOf = (reading: ReadingLike) => {
  const fromText = scriptLanguage((reading.paragraphs || []).join(" ").slice(0, 2000));
  const lang = fromText || reading.language || "English";
  return REFLECTION[lang] ? lang : "English";
};

/** "I can …" from a learning objective ("Students will be able to identify…" → "I can identify…"). */
export function toOutcome(objective: string, language: string): string {
  const text = clean(objective, 200).replace(/[.।]+$/, "");
  if (!text) return "";
  if (language !== "English") return text;
  const stripped = text
    .replace(/^(the\s+)?(students?|learners?|children|pupils?)\s+(will|should|can|must)\s+(be\s+able\s+to\s+)?/i, "")
    .replace(/^(to|be\s+able\s+to)\s+/i, "");
  if (/^i\s+can\b/i.test(stripped)) return stripped.replace(/^i\s+can/i, "I can");
  return `${OUTCOME_PREFIX.English} ${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
}

/** The workbook made only from what publishing stored: always available, no AI. */
export function buildTextWorkbook(reading: ReadingLike): UnitWorkbook {
  const language = langOf(reading);
  const points = [...(reading.keyPoints || []), ...(reading.importantConcepts || [])].map((p) => clean(p, 240)).filter(Boolean);
  if (!points.length && reading.summary) points.push(...String(reading.summary).split(/(?<=[.!?।])\s+/).map((s) => clean(s, 240)).filter(Boolean));
  const words = (reading.keyVocabulary || [])
    .map((v) => ({ word: clean(v.word, 40), meaning: clean(v.meaning, 160) }))
    .filter((v) => v.word && v.meaning)
    .slice(0, 8);
  const blanks: WorkbookBlank[] = buildFallbackQuiz(reading.paragraphs || [], language, 5).map((q) => {
    const match = q.question.match(/"([\s\S]*)"/);
    return { sentence: match ? match[1] : q.question, answer: q.options[q.correctOptionIndex], options: q.options };
  });
  const questions: WorkbookQuestion[] = [
    ...(reading.comprehensionQuiz || [])
      .filter((q) => Array.isArray(q.options) && typeof q.correctOptionIndex === "number" && q.options[q.correctOptionIndex])
      .slice(0, 3)
      .map((q) => ({ question: clean(q.question, 300), kind: "short" as const, answer: clean(q.options![q.correctOptionIndex!], 200) })),
    ...(reading.discussionQuestions || []).slice(0, 3).map((q) => ({ question: clean(q, 300), kind: "long" as const, answer: "" })),
  ].filter((q) => q.question);
  const outcomes = (reading.learningObjectives || []).map((o) => toOutcome(o, "English")).filter(Boolean).slice(0, 5);
  return {
    version: WORKBOOK_VERSION,
    source: "text",
    language,
    lesson: { points: points.slice(0, 6), words },
    blanks,
    questions,
    outcomes,
    reflection: REFLECTION[language],
    activity: ACTIVITY[language],
  };
}

export const WORKBOOK_SCHEMA = {
  type: "object",
  properties: {
    lessonPoints: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    blanks: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: { sentence: { type: "string" }, answer: { type: "string" }, wrong: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } } },
        required: ["sentence", "answer", "wrong"],
      },
    },
    questions: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: { question: { type: "string" }, kind: { type: "string", enum: ["short", "long", "apply"] }, answer: { type: "string" } },
        required: ["question", "kind", "answer"],
      },
    },
    outcomes: { type: "array", maxItems: 5, items: { type: "string" } },
    activity: {
      type: "object",
      properties: { title: { type: "string" }, steps: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } }, materials: { type: "array", maxItems: 5, items: { type: "string" } } },
      required: ["title", "steps", "materials"],
    },
  },
  required: ["lessonPoints", "blanks", "questions", "outcomes", "activity"],
} as const;

export function buildWorkbookPrompt(reading: ReadingLike): string {
  const language = langOf(reading);
  const text = (reading.paragraphs || []).join("\n").slice(0, 7000);
  return `You are preparing a one-page-per-section unit workbook for a ${reading.grade || "primary"} child in a Telangana government school, for this textbook chapter (${reading.subject || "school subject"}): "${clean(reading.chapterTitle, 120)}".

Chapter text:
"""
${text}
"""

Write everything in ${language}${language === "English" ? "" : ` (in ${language} script)`}, in very simple words for this class, and ONLY from the chapter text (never invent facts that are not in it).
- lessonPoints: 3-6 short sentences explaining the key ideas simply, in the order of the chapter.
- blanks: up to 5 fill-in-the-blank items. "sentence" is a sentence from or close to the chapter with exactly one "_____" where an important word goes; "answer" is that word exactly as it appears in the chapter; "wrong" is 3 other words of the same kind that are clearly wrong.
- questions: 4-6 questions with model answers: 2 "short" (one-line answer found in the text), 1-2 "long" (explain in 2-3 sentences), 1-2 "apply" (use the idea in the child's own life, e.g. at home or in the village). Answers must be correct according to the text.
- outcomes: 3-5 learning outcomes as "I can …" statements (in ${language}) that a child can tick for themselves, matching what this chapter teaches (knowledge, skill, understanding, real-life use).
- activity: one simple activity a child can do in class or at home with things available in a village (title, 2-5 steps, materials).
Return JSON only.`;
}

/** Checks the AI's workbook against the chapter; anything unusable falls back to the text-only part. */
export function normalizeAiWorkbook(raw: any, reading: ReadingLike, fallback: UnitWorkbook): UnitWorkbook {
  const language = fallback.language;
  const text = (reading.paragraphs || []).join(" ");
  const points = (Array.isArray(raw?.lessonPoints) ? raw.lessonPoints : []).map((p: unknown) => clean(p, 240)).filter(Boolean).slice(0, 6);
  const blanks: WorkbookBlank[] = (Array.isArray(raw?.blanks) ? raw.blanks : [])
    .map((b: any) => {
      const sentence = clean(b?.sentence, 300);
      const answer = clean(b?.answer, 40);
      const wrong = (Array.isArray(b?.wrong) ? b.wrong : []).map((w: unknown) => clean(w, 40)).filter((w: string) => w && w !== answer);
      if (!sentence.includes("_____") || (sentence.match(/_____/g) || []).length !== 1) return null;
      // The answer must really be a word of the chapter, so the child can find it there.
      if (!answer || !text.includes(answer) || wrong.length < 3) return null;
      const options = [answer, ...Array.from(new Set(wrong)).slice(0, 3)] as string[];
      if (options.length < 4) return null;
      return { sentence, answer, options: options.sort(() => Math.random() - 0.5) };
    })
    .filter(Boolean)
    .slice(0, 5) as WorkbookBlank[];
  const questions: WorkbookQuestion[] = (Array.isArray(raw?.questions) ? raw.questions : [])
    .map((q: any) => ({
      question: clean(q?.question, 300),
      kind: (["short", "long", "apply"].includes(q?.kind) ? q.kind : "short") as WorkbookQuestion["kind"],
      answer: clean(q?.answer, 500),
    }))
    .filter((q: WorkbookQuestion) => q.question && q.answer)
    .slice(0, 6);
  const outcomes = (Array.isArray(raw?.outcomes) ? raw.outcomes : []).map((o: unknown) => clean(o, 200)).filter(Boolean).slice(0, 5);
  const act = raw?.activity;
  const activity =
    act && clean(act.title, 80) && Array.isArray(act.steps) && act.steps.length >= 2
      ? {
          title: clean(act.title, 80),
          steps: act.steps.map((s: unknown) => clean(s, 200)).filter(Boolean).slice(0, 5),
          materials: (Array.isArray(act.materials) ? act.materials : []).map((m: unknown) => clean(m, 60)).filter(Boolean).slice(0, 5),
        }
      : fallback.activity;
  return {
    version: WORKBOOK_VERSION,
    source: "ai",
    language,
    lesson: { points: points.length >= 2 ? points : fallback.lesson.points, words: fallback.lesson.words },
    blanks: blanks.length >= 2 ? blanks : fallback.blanks,
    questions: questions.length >= 2 ? questions : fallback.questions,
    outcomes: outcomes.length >= 2 ? outcomes : fallback.outcomes,
    reflection: fallback.reflection,
    activity,
  };
}
