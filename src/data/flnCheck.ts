// The FLN check of a published chapter, in four parts a teacher asked for:
//   📖 Reading sentences  — a few sentences from the chapter, read aloud and checked word by word;
//   ⏱️ Oral reading fluency — a passage read for one minute: words correct per minute (WCPM)
//                             against the government norm for the class;
//   ❓ Reading comprehension — questions on that passage: direct (the answer is in the passage),
//                             indirect (worked out from it) and open (the child's own answer,
//                             marked by AI, changeable by the teacher);
//   ✍️ Writing             — a picture to write about on paper, marked by the teacher.
// Shared by the browser (the check) and the server (stored results, marks), so it stays
// pure (unit tested).
import { orfTargetWpm } from './readingLevels';

export const FLN_CHECK_VERSION = 1;

const gradeNum = (grade: string) => Number(String(grade || '').replace(/\D+/g, '')) || 1;
const clean = (v: unknown, max = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

/* ------------------------------ ORF norms ------------------------------ */

export interface OrfNorm {
  /** Words correct per minute the class should reach by the end of the year. */
  target: number;
  /** Where the number comes from, shown to the teacher. */
  source: string;
  /** True for a government norm, false for the app's own goal (no government number for that class). */
  govt: boolean;
  range?: [number, number];
}

/**
 * Government ORF norms:
 * - NIPUN Bharat (Ministry of Education, 2021), end-of-year goals in the language of instruction:
 *   Class 2 reads 45-60 words per minute correctly, Class 3 at least 60.
 * - Telangana Tholimettu (state FLN mission), Telugu: Class 1 20, Class 2 25 words per minute
 *   (from teacher-site summaries; the SCERT circular itself could not be opened, see
 *   curriculum-research/02-fln-classes-1-5.md).
 * Other classes have no published government number; the app's goal (readingLevels.ts) is used
 * and labelled as the app's.
 */
export function orfNorm(grade: string, language?: string): OrfNorm {
  const n = gradeNum(grade);
  if (language === 'Telugu' && n === 1) return { target: 20, source: 'Tholimettu (Telangana) Telugu goal', govt: true };
  if (language === 'Telugu' && n === 2) return { target: 25, source: 'Tholimettu (Telangana) Telugu goal', govt: true };
  if (n === 2) return { target: 45, range: [45, 60], source: 'NIPUN Bharat, Class 2', govt: true };
  if (n === 3) return { target: 60, source: 'NIPUN Bharat, Class 3', govt: true };
  return { target: orfTargetWpm(grade), source: 'app goal (no government number for this class)', govt: false };
}

export type OrfBand = 'below' | 'approaching' | 'meets';

/** Meets the norm, approaching it (half or more), or below half of it. */
export function orfBand(wcpm: number, norm: OrfNorm): OrfBand {
  if (wcpm >= norm.target) return 'meets';
  if (wcpm >= norm.target / 2) return 'approaching';
  return 'below';
}

/** Words correct per minute: correct words read, scaled to one minute. */
export function wordsCorrectPerMinute(correct: number, seconds: number): number {
  if (!correct || !seconds) return 0;
  return Math.round((correct * 60) / Math.max(seconds, 5));
}

/* --------------------------- picking the text --------------------------- */

/** Sentences of a text: ends at . ! ? । ॥ (or a line break, for poems). */
export function splitSentences(text: string): string[] {
  return String(text || '')
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?।॥]+[.!?।॥]+["'”’)]*|[^.!?।॥]+$/g) || [])
    .map((s) => clean(s))
    .filter((s) => words(s).length > 0);
}

const sentenceRange = (grade: string): [number, number] => {
  const n = gradeNum(grade);
  return n <= 2 ? [3, 10] : n <= 5 ? [4, 15] : [5, 22];
};

/** A few sentences from the chapter to read aloud: right length for the class, all different, spread through the chapter. */
export function pickSentences(paragraphs: string[], grade: string, count = 3): string[] {
  const [min, max] = sentenceRange(grade);
  const all = paragraphs.flatMap((p) => splitSentences(p));
  const fit = all.filter((s) => {
    const n = words(s).length;
    return n >= min && n <= max;
  });
  const pool = fit.length >= count ? fit : all.filter((s) => words(s).length <= max * 1.5);
  const unique = [...new Map(pool.map((s) => [s.toLowerCase(), s])).values()];
  if (unique.length <= count) return unique;
  // Evenly spaced through the chapter.
  return Array.from({ length: count }, (_, i) => unique[Math.floor((i * unique.length) / count)]);
}

/** How long the ORF passage is, in words (a fluent child reads it in about a minute). */
export function passageLength(grade: string): number {
  const n = gradeNum(grade);
  return [0, 30, 50, 70, 90, 110][n] ?? (n <= 8 ? 140 : 160);
}

/** The ORF passage: whole sentences from the start of the chapter's prose, about passageLength words. */
export function pickPassage(paragraphs: string[], grade: string): string {
  const want = passageLength(grade);
  const sentences = paragraphs.flatMap((p) => splitSentences(p));
  const out: string[] = [];
  let count = 0;
  for (const s of sentences) {
    if (count >= want) break;
    out.push(s);
    count += words(s).length;
  }
  return out.join(' ');
}

/* ------------------------------ questions ------------------------------ */

export type FlnQuestionKind = 'direct' | 'indirect' | 'open';

export interface FlnQuestion {
  kind: FlnQuestionKind;
  question: string;
  /** direct / indirect: 3-4 options and the right one. */
  options?: string[];
  answer?: number;
  /** open: what a good answer mentions (for the AI marker and the teacher). */
  expected?: string;
}

export interface FlnWritingTask {
  prompts: string[];
  /** Use the chapter's first picture when it has one. */
  useChapterPicture: boolean;
}

export interface FlnCheck {
  version: number;
  source: 'text' | 'ai';
  language: string;
  sentences: string[];
  passage: string;
  questions: FlnQuestion[];
  writing: FlnWritingTask;
}

const STOP = new Set(
  'the a an and or but to of in on at for with from by is are was were be been am it its this that these those he she they we you i his her their our my your me him them us as so not no yes do did does has have had will would can could there here then than'.split(
    ' '
  )
);

/** "The crow saw a ___ under the tree." — direct questions from the passage, no AI. */
export function passageClozeQuestions(passage: string, count = 2): FlnQuestion[] {
  const sentences = splitSentences(passage).filter((s) => words(s).length >= 4);
  const vocab = [...new Set(words(passage).map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, '')).filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase())))];
  const out: FlnQuestion[] = [];
  for (const s of sentences) {
    if (out.length >= count) break;
    const candidates = words(s)
      .map((w) => w.replace(/[^\p{L}\p{M}\p{N}]/gu, ''))
      .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
    const target = candidates.sort((a, b) => b.length - a.length)[0];
    if (!target) continue;
    const wrong = vocab.filter((w) => w.toLowerCase() !== target.toLowerCase() && !s.toLowerCase().includes(w.toLowerCase())).slice(0, 12);
    if (wrong.length < 2) continue;
    const picks = [wrong[(out.length * 3) % wrong.length], wrong[(out.length * 3 + 1) % wrong.length]].filter((w, i, a) => a.indexOf(w) === i);
    if (picks.length < 2) continue;
    const options = [target, ...picks];
    const shift = out.length % options.length;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    out.push({ kind: 'direct', question: s.replace(target, '_____'), options: rotated, answer: rotated.indexOf(target) });
  }
  return out;
}

const OPEN_TEMPLATES: Record<string, string[]> = {
  English: ['Tell in your own words what happened in this passage.', 'What did you learn from this passage?'],
  Telugu: ['ఈ భాగంలో ఏమి జరిగిందో మీ మాటల్లో చెప్పండి.', 'ఈ భాగం నుండి మీరు ఏమి నేర్చుకున్నారు?'],
  Hindi: ['इस अंश में क्या हुआ, अपने शब्दों में बताओ।', 'इस अंश से तुमने क्या सीखा?'],
};

const WRITING_PROMPTS: Record<string, { young: string[]; older: string[] }> = {
  English: {
    young: ['Look at the picture.', 'Write the names of 3 things you see.', 'Write one sentence about the picture.'],
    older: ['Look at the picture.', 'Describe the picture in 4-5 sentences.', 'Where is it? What things do you see? What is happening?'],
  },
  Telugu: {
    young: ['బొమ్మను చూడండి.', 'మీరు చూసిన 3 వస్తువుల పేర్లు రాయండి.', 'బొమ్మ గురించి ఒక వాక్యం రాయండి.'],
    older: ['బొమ్మను చూడండి.', 'బొమ్మ గురించి 4-5 వాక్యాలు రాయండి.', 'ఇది ఎక్కడ ఉంది? మీకు ఏమేమి కనిపిస్తున్నాయి? ఏమి జరుగుతోంది?'],
  },
  Hindi: {
    young: ['चित्र देखो।', 'जो 3 चीज़ें दिख रही हैं, उनके नाम लिखो।', 'चित्र के बारे में एक वाक्य लिखो।'],
    older: ['चित्र देखो।', 'चित्र के बारे में 4-5 वाक्य लिखो।', 'यह कहाँ है? तुम्हें क्या-क्या दिख रहा है? क्या हो रहा है?'],
  },
};

const langKey = (language: string) => (language === 'Telugu' || language === 'Hindi' ? language : 'English');

export interface FlnReadingLike {
  grade: string;
  language?: string;
  chapterTitle?: string;
  paragraphs?: string[];
  discussionQuestions?: string[];
}

/** The check made only from the chapter's own text: always available, no AI. */
export function buildTextFlnCheck(reading: FlnReadingLike): FlnCheck {
  const paragraphs = (reading.paragraphs || []).map((p) => String(p || ''));
  const language = langKey(reading.language || 'English');
  const passage = pickPassage(paragraphs, reading.grade);
  const open = (reading.discussionQuestions || []).map((q) => clean(q, 300)).filter(Boolean).slice(0, 1);
  return {
    version: FLN_CHECK_VERSION,
    source: 'text',
    language,
    sentences: pickSentences(paragraphs, reading.grade),
    passage,
    questions: [
      ...passageClozeQuestions(passage, 2),
      ...(open.length ? open : OPEN_TEMPLATES[language].slice(0, 1)).map((q) => ({ kind: 'open' as const, question: q })),
    ],
    writing: { prompts: WRITING_PROMPTS[language][gradeNum(reading.grade) <= 2 ? 'young' : 'older'], useChapterPicture: true },
  };
}

/* ------------------------------ AI version ------------------------------ */

export const FLN_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    direct: {
      type: 'array',
      items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' } }, required: ['question', 'options', 'answer'] },
    },
    indirect: {
      type: 'array',
      items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' } }, required: ['question', 'options', 'answer'] },
    },
    open: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, expected: { type: 'string' } }, required: ['question', 'expected'] } },
  },
  required: ['direct', 'indirect', 'open'],
};

export function buildFlnCheckPrompt(check: FlnCheck, grade: string, title = ''): string {
  return `You write reading comprehension questions for a ${grade} child in a Telangana government school.
Chapter: ${title || '(untitled)'}
The child has just read this passage aloud:
"""
${check.passage}
"""
Write, in ${check.language} and in ${check.language === 'English' ? 'English' : check.language + ' script'}:
- direct: 2 multiple-choice questions whose answer is written in the passage (the right option uses the passage's own words);
- indirect: 1 multiple-choice question the child answers by thinking about the passage (why, how, what might happen), with one clearly best answer;
- open: 1 question the child answers in their own words from what they learnt or their own life, with "expected": the points a good answer mentions (one short line, in English).
Rules: simple words for a ${grade} child; 3 options each, all of the same kind, only one correct; "answer" is the 0-based index of the correct option; never ask about page numbers or the book itself.`;
}

/** Keeps only well-formed AI questions; falls back to the text version's questions when too few survive. */
export function normalizeAiFlnCheck(raw: any, base: FlnCheck): FlnCheck {
  const passageLower = base.passage.toLowerCase();
  const mcq = (list: any, kind: 'direct' | 'indirect'): FlnQuestion[] =>
    (Array.isArray(list) ? list : [])
      .map((q: any) => {
        const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => clean(o, 120)).filter(Boolean);
        const answer = Number(q?.answer);
        const question = clean(q?.question, 300);
        if (!question || options.length < 3 || options.length > 4) return null;
        if (new Set(options.map((o: string) => o.toLowerCase())).size !== options.length) return null;
        if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
        // A direct question's answer must really be in the passage.
        if (kind === 'direct' && !passageLower.includes(options[answer].toLowerCase().replace(/[.!?।]+$/, ''))) return null;
        return { kind, question, options, answer } as FlnQuestion;
      })
      .filter((q: FlnQuestion | null): q is FlnQuestion => q !== null);
  const direct = mcq(raw?.direct, 'direct').slice(0, 2);
  const indirect = mcq(raw?.indirect, 'indirect').slice(0, 2);
  const open = (Array.isArray(raw?.open) ? raw.open : [])
    .map((q: any) => ({ kind: 'open' as const, question: clean(q?.question, 300), expected: clean(q?.expected, 300) }))
    .filter((q: FlnQuestion) => q.question)
    .slice(0, 1);
  if (direct.length + indirect.length < 2) return base;
  const baseOpen = base.questions.filter((q) => q.kind === 'open');
  return { ...base, source: 'ai', questions: [...direct, ...indirect, ...(open.length ? open : baseOpen)] };
}

/* ------------------------------ open answers ------------------------------ */

export const OPEN_EVAL_SCHEMA = {
  type: 'object',
  properties: { scores: { type: 'array', items: { type: 'object', properties: { score: { type: 'integer' }, reason: { type: 'string' } }, required: ['score', 'reason'] } } },
  required: ['scores'],
};

export function buildOpenEvalPrompt(passage: string, grade: string, items: { question: string; expected?: string; answer: string }[]): string {
  return `You mark a ${grade} child's answers in a Telangana government school. Be kind and fair: spelling, grammar and language mixing do not matter, only the idea.
Passage the child read:
"""
${passage}
"""
For each answer give score 2 (answers the question with a sensible idea), 1 (partly, or very short but on topic) or 0 (no answer, off topic or wrong), and a short reason in simple English for the teacher.
${items.map((it, i) => `${i + 1}. Question: ${it.question}\n   A good answer mentions: ${it.expected || '(the child\'s own sensible idea)'}\n   Child's answer: ${it.answer || '(no answer)'}`).join('\n')}
Return scores in the same order.`;
}

/* ------------------------------ results ------------------------------ */

export interface FlnSentenceResult {
  text: string;
  accuracy: number;
  tries: number;
  /** Words the child missed or read wrongly on the best try. */
  missed: string[];
}

export interface FlnOrfResult {
  words: number;
  correct: number;
  seconds: number;
  wcpm: number;
  accuracy: number;
  target: number;
  source: string;
  band: OrfBand;
  missed: string[];
  tries: number;
}

export interface FlnAnswer {
  kind: FlnQuestionKind;
  question: string;
  options?: string[];
  chosen?: number;
  correct?: boolean;
  /** Open answers: what the child said or typed. */
  text?: string;
  expected?: string;
  aiScore?: number;
  aiReason?: string;
  /** The teacher's mark, which always wins. */
  teacherScore?: number;
  max: number;
  /** Tries before the right option (multiple choice). */
  tries?: number;
}

export interface FlnWritingResult {
  /** The child says they wrote it on paper. */
  done: boolean;
  teacherScore?: number;
  rubric?: { ideas?: number; sentences?: number; conventions?: number };
  note?: string;
  max: number;
}

export interface FlnResult {
  readingId: string;
  chapterTitle?: string;
  language?: string;
  sentences?: FlnSentenceResult[];
  orf?: FlnOrfResult;
  comprehension?: { answers: FlnAnswer[]; tries: number };
  writing?: FlnWritingResult;
  updatedAt?: string;
}

export const WRITING_MAX = 10;
export const WRITING_RUBRIC: { key: 'ideas' | 'sentences' | 'conventions'; label: string; max: number }[] = [
  { key: 'ideas', label: 'Ideas — writes about what is in the picture', max: 4 },
  { key: 'sentences', label: 'Sentences — complete, in order', max: 3 },
  { key: 'conventions', label: 'Spelling, capital letters, full stops', max: 3 },
];

/** The mark an answer counts for: the teacher's, else the AI's (open), else right/wrong. */
export function answerScore(a: FlnAnswer): number | null {
  if (typeof a.teacherScore === 'number') return a.teacherScore;
  if (a.kind === 'open') return typeof a.aiScore === 'number' ? a.aiScore : null;
  return a.correct ? 1 : 0;
}

export function comprehensionScore(answers: FlnAnswer[]): { score: number; max: number; unmarked: number } {
  let score = 0;
  let max = 0;
  let unmarked = 0;
  for (const a of answers) {
    const s = answerScore(a);
    if (s === null) unmarked += 1;
    else {
      score += s;
      max += a.max;
    }
  }
  return { score, max, unmarked };
}

export function sentencesScore(list: FlnSentenceResult[]): number | null {
  return list.length ? Math.round(list.reduce((n, s) => n + s.accuracy, 0) / list.length) : null;
}

export interface FlnSummary {
  sentences: number | null;
  wcpm: number | null;
  band: OrfBand | null;
  target: number | null;
  comprehension: { score: number; max: number; unmarked: number } | null;
  writing: { score: number | null; done: boolean } | null;
}

export function flnSummary(r: FlnResult | undefined | null): FlnSummary {
  return {
    sentences: r?.sentences?.length ? sentencesScore(r.sentences) : null,
    wcpm: r?.orf ? r.orf.wcpm : null,
    band: r?.orf ? r.orf.band : null,
    target: r?.orf ? r.orf.target : null,
    comprehension: r?.comprehension?.answers?.length ? comprehensionScore(r.comprehension.answers) : null,
    writing: r?.writing ? { score: typeof r.writing.teacherScore === 'number' ? r.writing.teacherScore : null, done: r.writing.done } : null,
  };
}

/* --------------------- cleaning what the browser sends --------------------- */

const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : min;
};
const wordList = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map((w) => clean(w, 40))
    .filter(Boolean)
    .slice(0, 40);

export function cleanSentences(raw: unknown): FlnSentenceResult[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 6).map((s: any) => ({
    text: clean(s?.text, 300),
    accuracy: num(s?.accuracy, 0, 100),
    tries: num(s?.tries, 1, 10),
    missed: wordList(s?.missed),
  })).filter((s) => s.text);
}

export function cleanOrf(raw: any, grade: string, language?: string): FlnOrfResult | null {
  const wordsN = num(raw?.words, 0, 400);
  const correct = num(raw?.correct, 0, wordsN);
  const seconds = num(raw?.seconds, 0, 180);
  if (!wordsN || !seconds) return null;
  const norm = orfNorm(grade, language);
  const wcpm = wordsCorrectPerMinute(correct, seconds);
  return {
    words: wordsN,
    correct,
    seconds,
    wcpm,
    accuracy: Math.round((correct / wordsN) * 100),
    target: norm.target,
    source: norm.source,
    band: orfBand(wcpm, norm),
    missed: wordList(raw?.missed),
    tries: num(raw?.tries, 1, 10),
  };
}

export function cleanAnswers(raw: unknown): FlnAnswer[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 8).map((a: any) => {
    const kind: FlnQuestionKind = a?.kind === 'indirect' || a?.kind === 'open' ? a.kind : 'direct';
    const options = Array.isArray(a?.options) ? a.options.map((o: unknown) => clean(o, 120)).slice(0, 4) : undefined;
    return kind === 'open'
      ? { kind, question: clean(a?.question, 300), text: clean(a?.text, 600), expected: clean(a?.expected, 300) || undefined, max: 2 }
      : {
          kind,
          question: clean(a?.question, 300),
          options,
          chosen: Number.isInteger(a?.chosen) ? num(a.chosen, 0, 3) : undefined,
          correct: Boolean(a?.correct),
          tries: num(a?.tries, 1, 4),
          max: 1,
        };
  }).filter((a) => a.question);
}

export interface ClassChapterFln {
  readingId: string;
  chapterTitle: string;
  checked: number;
  medianWcpm: number | null;
  /** Share (%) of children with an ORF result who meet the norm. */
  meetsNorm: number | null;
  /** Class comprehension score as a percentage of the marked maximum. */
  comprehension: number | null;
  writingDone: number;
  writingMarked: number;
}

/** Every chapter's class summary of FLN checks (for the teacher's FLN view and the curriculum map). */
export function classChapterFln(results: FlnResult[]): ClassChapterFln[] {
  const chapters = new Map<string, { title: string; checked: number; wcpm: number[]; meets: number; comp: number; compMax: number; done: number; marked: number }>();
  for (const r of results) {
    const c = chapters.get(r.readingId) || { title: r.chapterTitle || '', checked: 0, wcpm: [], meets: 0, comp: 0, compMax: 0, done: 0, marked: 0 };
    const s = flnSummary(r);
    c.checked += 1;
    if (s.wcpm !== null) {
      c.wcpm.push(s.wcpm);
      if (s.band === 'meets') c.meets += 1;
    }
    if (s.comprehension) {
      c.comp += s.comprehension.score;
      c.compMax += s.comprehension.max;
    }
    if (s.writing?.done) c.done += 1;
    if (typeof s.writing?.score === 'number') c.marked += 1;
    chapters.set(r.readingId, c);
  }
  return [...chapters.entries()].map(([readingId, c]) => {
    const sorted = [...c.wcpm].sort((a, b) => a - b);
    return {
      readingId,
      chapterTitle: c.title,
      checked: c.checked,
      medianWcpm: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
      meetsNorm: sorted.length ? Math.round((c.meets / sorted.length) * 100) : null,
      comprehension: c.compMax ? Math.round((c.comp / c.compMax) * 100) : null,
      writingDone: c.done,
      writingMarked: c.marked,
    };
  });
}
