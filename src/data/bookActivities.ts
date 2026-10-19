// The textbook's own exercises, as interactive activities. A published
// chapter's exercises (Match the following, Fill in the blanks, Tick the
// right answer, True or false, Put in order, Look at the picture and talk,
// Read aloud, Write…) used to reach the child as plain paragraphs. Here they
// keep the book's own instruction and items, become a game each, and can use
// the book's own pictures (by image id). Same pattern as the workbook and the
// explainer: a text-only version (exercise blocks found by their heading) is
// always available; one AI request turns the chapter into structured
// activities, checked here against the chapter text so nothing invented
// reaches a child. Shared by the browser and server.ts; unit tested.

export const BOOK_ACTIVITIES_VERSION = 1;

export type BookActivityKind = 'match' | 'fill' | 'choose' | 'truefalse' | 'order' | 'picture' | 'say' | 'write';

export interface ActivitySide {
  text?: string;
  emoji?: string;
  /** An image of the published reading (publishedReadings/{id}/images/{pictureId}). */
  pictureId?: string;
}

export interface ActivityItem {
  prompt: string;
  /** fill / choose: the right option; truefalse: 'true' | 'false'; picture: a model answer ('' when open). */
  answer: string;
  options?: string[];
  emoji?: string;
  pictureId?: string;
}

export interface BookActivity {
  id: string;
  kind: BookActivityKind;
  /** The book's own instruction, as printed. */
  instruction: string;
  page?: number | null;
  pairs?: { left: ActivitySide; right: ActivitySide }[];
  items?: ActivityItem[];
  /** order: the right order. */
  sequence?: string[];
  /** say / write: the lines to read or the prompts to write about. */
  lines?: string[];
}

export interface BookActivities {
  version: number;
  source: 'ai' | 'text';
  activities: BookActivity[];
}

export const KIND_LABEL: Record<BookActivityKind, { emoji: string; label: string }> = {
  match: { emoji: '🔗', label: 'Match' },
  fill: { emoji: '✏️', label: 'Fill in' },
  choose: { emoji: '☑️', label: 'Choose' },
  truefalse: { emoji: '✅', label: 'True or false' },
  order: { emoji: '🔢', label: 'Put in order' },
  picture: { emoji: '🖼️', label: 'Picture talk' },
  say: { emoji: '🎤', label: 'Read aloud' },
  write: { emoji: '📝', label: 'Write' },
};

/** Activities that give a score (the others are done / not done). */
export const SCORED_KINDS: BookActivityKind[] = ['match', 'fill', 'choose', 'truefalse', 'order'];

type ReadingLike = {
  chapterTitle?: string;
  language?: string;
  grade?: string;
  subject?: string;
  paragraphs?: string[];
  paragraphPages?: (number | null)[];
};

export type PictureRef = { id: string; caption?: string; pageNumber?: number | null };

const clean = (v: unknown, max = 300) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordsOf = (s: string) => norm(s).split(' ').filter((w) => w.length > 1);

/** Share (0-1) of a line's words that appear in the chapter text. */
export function textOverlap(line: string, chapterText: string): number {
  const words = wordsOf(line);
  if (!words.length) return 0;
  const text = ` ${norm(chapterText)} `;
  return words.filter((w) => text.includes(` ${w} `) || text.includes(w)).length / words.length;
}

/* ------------------------- Text-only (no AI) version ------------------------- */

// An exercise heading in English, Telugu or Hindi textbooks.
const EXERCISE_HEAD =
  /^(\d+[.)]\s*)?(exercises?|activity|activities|let us|let's|match|fill|tick|circle|colou?r|answer|write|read|say|recite|talk|look|listen|draw|trace|choose|put|arrange|true|complete|find|join|underline|ఈ\s|జతపరచ|ఖాళీ|సరైన|చదవండి|రాయండి|మాట్లాడ|గీయండి|వరుస|मिलान|मिलाइए|रिक्त|सही|पढ़ो|पढ़िए|लिखो|लिखिए|बताओ|बताइए|चित्र)/i;

/** An exercise's heading/instruction ("Match the following", "Fill in the blanks", Telugu/Hindi too). */
export const isExerciseHeading = (text: string) => EXERCISE_HEAD.test(text.trim()) && text.trim().split(/\s+/).length <= 25;

const kindOfHeading = (heading: string): BookActivityKind =>
  /match|join|జత|मिला/i.test(heading)
    ? 'match'
    : /read|say|recite|listen|చదవ|पढ़/i.test(heading)
    ? 'say'
    : /look|picture|talk|చిత్ర|మాట్లాడ|चित्र|बता/i.test(heading)
    ? 'picture'
    : 'write';

/**
 * Exercise blocks found by their heading: the heading is the instruction and
 * the short paragraphs after it are its items. Without answers they become
 * read-aloud, picture-talk or writing activities; a "Match" block whose lines
 * look like "word - word" becomes a matching game.
 */
export function buildTextActivities(reading: ReadingLike): BookActivities {
  const paragraphs = (reading.paragraphs || []).map((p) => clean(p, 600)).filter(Boolean);
  const pages = reading.paragraphPages || [];
  const activities: BookActivity[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const head = paragraphs[i];
    if (!EXERCISE_HEAD.test(head) || head.split(' ').length > 25) continue;
    const lines: string[] = [];
    let j = i + 1;
    for (; j < paragraphs.length && lines.length < 8; j++) {
      const p = paragraphs[j];
      if (EXERCISE_HEAD.test(p) && p.split(' ').length <= 25) break;
      if (p.split(' ').length > 40) break;
      lines.push(...p.split(/\n/).map((l) => clean(l, 200)).filter(Boolean));
    }
    let kind = kindOfHeading(head);
    const activity: BookActivity = { id: `t${activities.length + 1}`, kind, instruction: head, page: pages[i] ?? null };
    if (kind === 'match') {
      const pairs = lines
        .map((l) => l.split(/\s+[-–—:=]\s+|\s{3,}|\t/))
        .filter((parts) => parts.length === 2 && parts[0] && parts[1])
        .map(([l, r]) => ({ left: { text: clean(l, 60) }, right: { text: clean(r, 60) } }));
      if (pairs.length >= 2) activity.pairs = pairs.slice(0, 8);
      else kind = activity.kind = 'write';
    }
    if (kind !== 'match') {
      if (!lines.length) {
        if (kind === 'say' || kind === 'write') continue;
        activity.items = [{ prompt: head, answer: '' }];
      } else if (kind === 'picture') activity.items = lines.map((l) => ({ prompt: l, answer: '' }));
      else activity.lines = lines;
    }
    activities.push(activity);
    i = j - 1;
  }
  return { version: BOOK_ACTIVITIES_VERSION, source: 'text', activities: activities.slice(0, 12) };
}

/* ------------------------------ AI version ------------------------------ */

const SIDE_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' }, emoji: { type: 'string' }, picture: { type: 'string' } },
} as const;

export const BOOK_ACTIVITIES_SCHEMA = {
  type: 'object',
  properties: {
    activities: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['match', 'fill', 'choose', 'truefalse', 'order', 'picture', 'say', 'write'] },
          instruction: { type: 'string' },
          paragraph: { type: 'integer' },
          pairs: { type: 'array', maxItems: 8, items: { type: 'object', properties: { left: SIDE_SCHEMA, right: SIDE_SCHEMA }, required: ['left', 'right'] } },
          items: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                answer: { type: 'string' },
                options: { type: 'array', maxItems: 4, items: { type: 'string' } },
                emoji: { type: 'string' },
                picture: { type: 'string' },
              },
              required: ['prompt', 'answer'],
            },
          },
          sequence: { type: 'array', maxItems: 8, items: { type: 'string' } },
          lines: { type: 'array', maxItems: 8, items: { type: 'string' } },
        },
        required: ['kind', 'instruction'],
      },
    },
  },
  required: ['activities'],
} as const;

const pictureTag = (i: number) => `P${i + 1}`;

export function buildBookActivitiesPrompt(reading: ReadingLike, pictures: PictureRef[] = []): string {
  const paragraphs = (reading.paragraphs || []).map((p, i) => `[${i}] ${clean(p, 500)}`).join('\n').slice(0, 9000);
  const pics = pictures.length
    ? pictures.map((p, i) => `${pictureTag(i)}: ${clean(p.caption, 120) || 'a picture'}${p.pageNumber ? ` (page ${p.pageNumber})` : ''}`).join('\n')
    : '(none)';
  return `This is a ${reading.grade || 'primary'} ${reading.subject || ''} textbook chapter from a Telangana government school book: "${clean(reading.chapterTitle, 120)}". Paragraphs are numbered.

"""
${paragraphs}
"""

Pictures of this chapter (use their tags):
${pics}

Find EVERY exercise or activity printed in this chapter (e.g. "Match the following", "Fill in the blanks", "Tick the correct answer", "True or false", "Put in order", "Look at the picture and talk", "Read aloud", "Recite the poem", "Answer these questions", "Write…") and turn each into one interactive activity for a child. Rules:
- instruction: the exercise's instruction EXACTLY as printed, in its own language and script. paragraph: the number of the paragraph where it starts.
- Use only items printed in the chapter. Never invent an exercise the chapter does not have.
- kind "match": pairs in the CORRECT matching (left with its right). A side is text, and/or an emoji, and/or a picture tag (P1…) when the book matches with a picture.
- kind "fill": items with prompt = the sentence with "_____" for the blank, answer = the missing word (from the chapter), options = the answer plus 2-3 wrong words (from the exercise's word box if it has one).
- kind "choose": prompt = the question, options = the printed choices, answer = the right one (must be one of the options).
- kind "truefalse": prompt = the statement, answer = "true" or "false" according to the chapter.
- kind "order": sequence = the steps/words/sentences in the RIGHT order.
- kind "picture": items with prompt = the question about the picture, answer = a short model answer from the chapter ("" if open), picture = the tag or emoji = a fitting emoji.
- kind "say": lines to read aloud or recite (e.g. the poem lines). kind "write": lines = the questions/prompts to write about (questions whose answers are in the chapter can instead be "choose"/"fill" only if the book prints choices or blanks).
- If the chapter has no exercises at all, return an empty list.
Return JSON only.`;
}

const cleanEmoji = (v: unknown) => {
  const s = clean(v, 16);
  return /\p{Extended_Pictographic}/u.test(s) ? s : '';
};

/** Checks the AI's activities against the chapter; anything unusable is dropped. */
export function normalizeAiActivities(raw: any, reading: ReadingLike, pictures: PictureRef[] = [], fallback?: BookActivities): BookActivities {
  const chapter = (reading.paragraphs || []).join(' \n ');
  const pages = reading.paragraphPages || [];
  const pictureOf = (tag: unknown) => {
    const m = /^P(\d+)$/i.exec(clean(tag, 6));
    const p = m ? pictures[Number(m[1]) - 1] : undefined;
    return p?.id;
  };
  const side = (s: any): ActivitySide | null => {
    const out: ActivitySide = {};
    const text = clean(s?.text, 80);
    const emoji = cleanEmoji(s?.emoji);
    const pictureId = pictureOf(s?.picture);
    if (text) out.text = text;
    if (emoji) out.emoji = emoji;
    if (pictureId) out.pictureId = pictureId;
    return out.text || out.emoji || out.pictureId ? out : null;
  };
  const inChapter = (s: string, min = 0.6) => textOverlap(s, chapter) >= min;
  const activities: BookActivity[] = [];
  for (const a of Array.isArray(raw?.activities) ? raw.activities : []) {
    const kind = a?.kind as BookActivityKind;
    if (!KIND_LABEL[kind]) continue;
    const instruction = clean(a?.instruction, 200);
    // The instruction must be the book's own (most of its words are in the chapter).
    if (!instruction || !inChapter(instruction, 0.5)) continue;
    const para = Number.isInteger(a?.paragraph) ? a.paragraph : -1;
    const activity: BookActivity = { id: `a${activities.length + 1}`, kind, instruction, page: para >= 0 ? pages[para] ?? null : null };
    if (kind === 'match') {
      const seenL = new Set<string>();
      const seenR = new Set<string>();
      const pairs = (Array.isArray(a?.pairs) ? a.pairs : [])
        .map((p: any) => ({ left: side(p?.left), right: side(p?.right) }))
        .filter((p: { left: ActivitySide | null; right: ActivitySide | null }) => {
          if (!p.left || !p.right) return false;
          // Each pair must come from the book: a text side printed in the chapter, or a picture of it.
          const fromBook = [p.left, p.right].some((s) => (s.text && inChapter(s.text, 0.6)) || s.pictureId);
          const keyL = JSON.stringify(p.left);
          const keyR = JSON.stringify(p.right);
          if (!fromBook || seenL.has(keyL) || seenR.has(keyR)) return false;
          seenL.add(keyL);
          seenR.add(keyR);
          return true;
        });
      if (pairs.length < 2) continue;
      activity.pairs = pairs.slice(0, 8);
    } else if (kind === 'order') {
      const sequence = Array.from(new Set((Array.isArray(a?.sequence) ? a.sequence : []).map((s: unknown) => clean(s, 160)).filter(Boolean))) as string[];
      if (sequence.length < 3 || sequence.filter((s) => inChapter(s, 0.6)).length < sequence.length * 0.7) continue;
      activity.sequence = sequence.slice(0, 8);
    } else if (kind === 'say' || kind === 'write') {
      const lines = (Array.isArray(a?.lines) ? a.lines : []).map((l: unknown) => clean(l, 240)).filter(Boolean);
      const keep = kind === 'say' ? lines.filter((l: string) => inChapter(l, 0.7)) : lines.filter((l: string) => inChapter(l, 0.4));
      if (!keep.length) continue;
      activity.lines = keep.slice(0, 8);
    } else {
      const raws = Array.isArray(a?.items) ? a.items : [];
      const answers = raws.map((it: any) => clean(it?.answer, 60)).filter(Boolean);
      const items: ActivityItem[] = [];
      for (const it of raws) {
        const prompt = clean(it?.prompt, 300);
        const answer = clean(it?.answer, 120);
        const emoji = cleanEmoji(it?.emoji);
        const pictureId = pictureOf(it?.picture);
        if (!prompt) continue;
        if (kind === 'fill') {
          const blanked = prompt.replace(/_{2,}|\.{3,}|…+/g, '_____');
          if ((blanked.match(/_____/g) || []).length !== 1 || !answer || !inChapter(answer, 1)) continue;
          let options = Array.from(new Set([answer, ...(Array.isArray(it?.options) ? it.options : []).map((o: unknown) => clean(o, 60))].filter(Boolean))) as string[];
          // No word box: the other blanks' answers are the wrong options.
          if (options.length < 3) options = Array.from(new Set([...options, ...answers])).slice(0, 4);
          if (options.length < 2) continue;
          items.push({ prompt: blanked, answer, options: options.slice(0, 4), ...(emoji && { emoji }), ...(pictureId && { pictureId }) });
        } else if (kind === 'choose') {
          const options = Array.from(new Set((Array.isArray(it?.options) ? it.options : []).map((o: unknown) => clean(o, 80)).filter(Boolean))) as string[];
          if (options.length < 2 || !options.includes(answer)) continue;
          items.push({ prompt, answer, options: options.slice(0, 4), ...(emoji && { emoji }), ...(pictureId && { pictureId }) });
        } else if (kind === 'truefalse') {
          const a2 = answer.toLowerCase();
          const value = /^(true|yes|correct|right|సరి|ఒప్పు|सही|हाँ)/.test(a2) ? 'true' : /^(false|no|wrong|తప్పు|गलत|नहीं)/.test(a2) ? 'false' : '';
          if (!value || !inChapter(prompt, 0.4)) continue;
          items.push({ prompt, answer: value });
        } else if (kind === 'picture') {
          if (!pictureId && !emoji) continue;
          items.push({ prompt, answer, ...(emoji && { emoji }), ...(pictureId && { pictureId }) });
        }
      }
      if (!items.length) continue;
      activity.items = items.slice(0, 8);
    }
    activities.push(activity);
  }
  if (!activities.length && fallback) return fallback;
  return { version: BOOK_ACTIVITIES_VERSION, source: 'ai', activities: activities.slice(0, 12) };
}

/* ------------------------------ Scoring ------------------------------ */

/** How many points an activity is out of (0 for done / not-done activities). */
export function activityTotal(a: BookActivity): number {
  switch (a.kind) {
    case 'match':
      return a.pairs?.length || 0;
    case 'order':
      return 1;
    case 'fill':
    case 'choose':
    case 'truefalse':
      return a.items?.length || 0;
    default:
      return 0;
  }
}

/** The chapter id book activities are recorded under (progressSync game ids are lower case). */
export const bookActivitiesGameId = (readingId: string) => `book-${readingId.toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 60);
