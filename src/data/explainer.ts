// Animated explainers for textbook chapters: a short series of scenes, each
// with a narration line and one visual from a fixed set of animation
// templates the app knows how to draw (counting / adding / taking away /
// groups / number line for maths; fact, word, compare, cycle, steps, parts,
// sort and before→after for EVS, science and language). The AI fills the
// templates from the chapter's own text with real-life examples; this file
// checks what it wrote (anything the app can't draw is dropped) and builds a
// text-only explainer from the chapter's key points when the AI is not
// available. Shared by the server (making/checking) and the browser
// (playing), so it stays pure.
import type { CountSpec } from './learnPlay';

export const EXPLAINER_VERSION = 1;

export interface ExplainerItem {
  emoji: string;
  label: string;
}

export type ExplainerVisual =
  | { kind: 'count'; spec: CountSpec }
  | { kind: 'fact'; emoji: string }
  | { kind: 'word'; word: string; emoji: string; meaning: string }
  | { kind: 'compare'; left: ExplainerItem; right: ExplainerItem }
  | { kind: 'cycle'; steps: ExplainerItem[] }
  | { kind: 'sequence'; steps: ExplainerItem[] }
  | { kind: 'parts'; center: ExplainerItem; parts: ExplainerItem[] }
  | { kind: 'sort'; groups: { label: string; items: ExplainerItem[] }[] }
  | { kind: 'change'; before: ExplainerItem; after: ExplainerItem; how: string };

export interface ExplainerScene {
  title: string;
  /** Narration, in the chapter's language and script. */
  say: string;
  visual: ExplainerVisual;
  /** A real-life example (shown with a 🏡 badge). */
  example?: boolean;
}

export interface ExplainerCheck {
  question: string;
  options: string[];
  answer: string;
}

export interface ChapterExplainer {
  version: number;
  source: 'ai' | 'text';
  language: string;
  title: string;
  scenes: ExplainerScene[];
  check: ExplainerCheck[];
}

/** The JSON shape asked from the model: flat, so any JSON-schema model can follow it. */
export const EXPLAINER_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          title: { type: 'string' },
          say: { type: 'string' },
          example: { type: 'boolean' },
          emoji: { type: 'string' },
          word: { type: 'string' },
          meaning: { type: 'string' },
          op: { type: 'string' },
          a: { type: 'number' },
          b: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { emoji: { type: 'string' }, label: { type: 'string' }, group: { type: 'string' } },
              required: ['emoji', 'label'],
            },
          },
        },
        required: ['kind', 'title', 'say'],
      },
    },
    check: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' } },
        required: ['question', 'options', 'answer'],
      },
    },
  },
  required: ['scenes', 'check'],
};

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
  comprehensionQuiz?: { question?: string; options?: string[]; correctOptionIndex?: number }[];
};

const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** One emoji (or a short symbol); anything wordy is not an emoji. */
export function cleanEmoji(v: unknown, fallback = '⭐'): string {
  const s = String(v ?? '').trim();
  if (!s || s.length > 8 || /[A-Za-z0-9ऀ-ॿఀ-౿]/.test(s)) return fallback;
  return Array.from(s).slice(0, 3).join('');
}

const int = (v: unknown) => Math.round(Number(v));
const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

function item(raw: any, fallbackEmoji = '⭐'): ExplainerItem | null {
  const label = clean(raw?.label, 40);
  if (!label) return null;
  return { emoji: cleanEmoji(raw?.emoji, fallbackEmoji), label };
}

/** A maths counting animation the app can draw, or null (numbers kept small). */
export function countSpecFrom(raw: any): CountSpec | null {
  const op = String(raw?.op || raw?.kind || '').toLowerCase();
  const emoji = cleanEmoji(raw?.emoji, '🍎');
  const a = int(raw?.a);
  const b = int(raw?.b);
  if (op === 'add' || op === '+' || op === 'addition') {
    return inRange(a, 1, 10) && inRange(b, 1, 10) && a + b <= 20 ? { op: 'add', a, b, emoji, stage: 'equation' } : null;
  }
  if (op === 'sub' || op === 'subtract' || op === '-' || op === 'subtraction') {
    return inRange(a, 2, 20) && inRange(b, 1, a - 1) ? { op: 'sub', a, b, emoji, stage: 'equation' } : null;
  }
  if (op === 'count') return inRange(a, 1, 20) ? { op: 'count', n: a, emoji } : null;
  if (op === 'groups' || op === 'multiply' || op === '×' || op === 'x') {
    return inRange(a, 2, 5) && inRange(b, 2, 5) ? { op: 'groups', groups: a, each: b, emoji, stage: 'equation' } : null;
  }
  if (op === 'hop' || op === 'numberline') return inRange(a, 0, 15) && inRange(b, -10, 10) && b !== 0 && inRange(a + b, 0, 20) ? { op: 'hop', from: a, by: b } : null;
  return null;
}

/** Turn one scene from the model into a scene the app can draw, or null. */
export function normalizeScene(raw: any): ExplainerScene | null {
  const title = clean(raw?.title, 60);
  const say = clean(raw?.say, 260);
  if (!say) return null;
  const kind = String(raw?.kind || '').toLowerCase();
  const items = (Array.isArray(raw?.items) ? raw.items : []).map((x: any) => ({ it: item(x), group: clean(x?.group, 30) })).filter((x: any) => x.it);
  const its = items.map((x: any) => x.it as ExplainerItem);
  let visual: ExplainerVisual | null = null;
  switch (kind) {
    case 'count': {
      const spec = countSpecFrom(raw);
      if (spec) visual = { kind: 'count', spec };
      break;
    }
    case 'fact':
      visual = { kind: 'fact', emoji: cleanEmoji(raw?.emoji, '💡') };
      break;
    case 'word': {
      const word = clean(raw?.word, 30);
      if (word) visual = { kind: 'word', word, emoji: cleanEmoji(raw?.emoji, '🔤'), meaning: clean(raw?.meaning, 80) };
      break;
    }
    case 'compare':
      if (its.length >= 2) visual = { kind: 'compare', left: its[0], right: its[1] };
      break;
    case 'cycle':
      if (its.length >= 3) visual = { kind: 'cycle', steps: its.slice(0, 6) };
      break;
    case 'sequence':
    case 'steps':
      if (its.length >= 2) visual = { kind: 'sequence', steps: its.slice(0, 6) };
      break;
    case 'parts':
      if (its.length >= 3) visual = { kind: 'parts', center: its[0], parts: its.slice(1, 7) };
      break;
    case 'sort': {
      const names = Array.from(new Set(items.map((x: any) => x.group).filter(Boolean))).slice(0, 2) as string[];
      if (names.length === 2) {
        const groups = names.map((label) => ({ label, items: items.filter((x: any) => x.group === label).map((x: any) => x.it).slice(0, 5) }));
        if (groups.every((g) => g.items.length >= 1)) visual = { kind: 'sort', groups };
      }
      break;
    }
    case 'change':
      if (its.length >= 2) visual = { kind: 'change', before: its[0], after: its[1], how: clean(raw?.meaning || raw?.word, 60) };
      break;
  }
  if (!visual) return null;
  return { title: title || say.split(/[.!?।]/)[0].slice(0, 60), say, visual, ...(raw?.example ? { example: true } : {}) };
}

function normalizeChecks(raw: unknown): ExplainerCheck[] {
  return (Array.isArray(raw) ? raw : [])
    .map((c: any) => {
      const question = clean(c?.question, 160);
      const options = Array.from(new Set((Array.isArray(c?.options) ? c.options : []).map((o: unknown) => clean(o, 50)).filter(Boolean))).slice(0, 4) as string[];
      const answer = clean(c?.answer, 50);
      return question && options.length >= 2 && options.includes(answer) ? { question, options, answer } : null;
    })
    .filter((c): c is ExplainerCheck => Boolean(c))
    .slice(0, 3);
}

const scriptLanguage = (text: string, fallback = 'English') => (/[ఀ-౿]/.test(text) ? 'Telugu' : /[ऀ-ॿ]/.test(text) ? 'Hindi' : fallback);

/** A plain explainer from what publishing stored: summary, key points, words, quiz. */
export function buildTextExplainer(reading: ReadingLike): ChapterExplainer {
  const text = (reading.paragraphs || []).join(' ');
  const language = scriptLanguage(text, reading.language || 'English');
  const scenes: ExplainerScene[] = [];
  if (reading.summary) scenes.push({ title: clean(reading.chapterTitle, 60) || 'This chapter', say: clean(reading.summary, 260), visual: { kind: 'fact', emoji: '📘' } });
  const points = [...(reading.keyPoints || []), ...(reading.importantConcepts || [])].map((p) => clean(p, 240)).filter(Boolean);
  for (const p of points.slice(0, 4)) scenes.push({ title: p.split(/[.!?।]/)[0].slice(0, 60), say: p, visual: { kind: 'fact', emoji: '💡' } });
  for (const v of (reading.keyVocabulary || []).slice(0, 3)) {
    const word = clean(v.word, 30);
    if (word) scenes.push({ title: word, say: v.meaning ? `${word}: ${clean(v.meaning, 200)}` : word, visual: { kind: 'word', word, emoji: '🔤', meaning: clean(v.meaning, 80) } });
  }
  if (!scenes.length) {
    const first = (reading.paragraphs || []).map((p) => clean(p, 240)).filter(Boolean).slice(0, 3);
    for (const p of first) scenes.push({ title: p.split(/[.!?।]/)[0].slice(0, 60), say: p, visual: { kind: 'fact', emoji: '📖' } });
  }
  const check = (reading.comprehensionQuiz || [])
    .map((q) => {
      const options = (q.options || []).map((o) => clean(o, 50)).filter(Boolean);
      const answer = options[q.correctOptionIndex ?? -1];
      return q.question && answer ? { question: clean(q.question, 160), options, answer } : null;
    })
    .filter((c): c is ExplainerCheck => Boolean(c))
    .slice(0, 2);
  return { version: EXPLAINER_VERSION, source: 'text', language, title: clean(reading.chapterTitle, 80), scenes, check };
}

/** Check the model's explainer; too few drawable scenes → the text-only one. */
export function normalizeAiExplainer(raw: any, reading: ReadingLike, fallback: ChapterExplainer): ChapterExplainer {
  const scenes = (Array.isArray(raw?.scenes) ? raw.scenes : []).map(normalizeScene).filter((s: ExplainerScene | null): s is ExplainerScene => Boolean(s)).slice(0, 9);
  if (scenes.length < 3) return fallback;
  const check = normalizeChecks(raw?.check);
  return {
    version: EXPLAINER_VERSION,
    source: 'ai',
    language: fallback.language,
    title: fallback.title,
    scenes,
    check: check.length ? check : fallback.check,
  };
}

export function buildExplainerPrompt(reading: ReadingLike): string {
  const text = (reading.paragraphs || []).join('\n').slice(0, 6000);
  const language = scriptLanguage(text, reading.language || 'English');
  return `You make a short animated explainer of a school textbook chapter for ${reading.grade || 'primary'} children in Telangana, India. The app draws each scene from a fixed template — choose the template ("kind") that best SHOWS the idea:

- "count": maths with small numbers. "op" = add | sub | count | groups | hop, "a" and "b" numbers, "emoji" = the thing being counted. add: a+b ≤ 20 (a,b 1-10). sub: a ≤ 20, b < a. count: a = how many (1-20). groups: a groups of b (2-5 each). hop: number line from a, b steps (+/-).
- "fact": one idea with one big "emoji".
- "word": a new word: "word", "emoji", "meaning" (simple).
- "compare": two things side by side: items[0], items[1] (emoji + label).
- "cycle": 3-6 steps that go round (water cycle, life cycle): items in order.
- "sequence": 2-6 steps or story events in order: items.
- "parts": a whole and its parts: items[0] = the whole, the rest = its parts (plant: root, stem, leaf).
- "sort": things in two groups: items with "group" set to one of exactly two group names (living / non-living).
- "change": before → after: items[0] before, items[1] after, "meaning" = what makes it change (heat, rain…).

Rules:
- 5 to 8 scenes that follow the chapter: what it is about, the key ideas, and at least 2-3 REAL-LIFE EXAMPLES from a child's life in a Telangana village or town (market, farm, home, school, festival) — mark them "example": true. For maths, show the method with several DIFFERENT examples (different numbers and things), each as a "count" scene.
- "say" = what the narrator says: 1-2 short, simple sentences in ${language}${language === 'English' ? '' : ` (${language} script)`}. "title" = 2-5 words. Labels: 1-3 words, in ${language}.
- Only facts from the chapter (examples may be new but must be correct). Real emoji only.
- Then "check": 2 easy questions about the chapter, 3 options each, "answer" = the right option exactly.

Chapter: ${reading.chapterTitle || ''} (${reading.subject || ''})
${reading.summary ? `Summary: ${reading.summary}\n` : ''}Text:
${text}`;
}
