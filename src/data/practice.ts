// FLN practice for a published chapter: the short exercises SCERT/NIPUN
// Bharat foundational workbooks use (match the picture to the word, listen
// and choose, first sound, missing letter, put the words in order, word and
// meaning), made from the chapter's own words with no AI, so they are
// instant, work offline and are the same set every time (the printed
// worksheet matches what the child played). Shared by the browser and tests.
import type { DictionaryWord } from './dictionary';

export type PracticeKind = 'picture_word' | 'listen_choose' | 'first_sound' | 'missing_letter' | 'word_order' | 'word_meaning';
type Lang = 'English' | 'Telugu' | 'Hindi';

export interface PracticeItem {
  kind: PracticeKind;
  /** The word the item is about (heard with 🔊). */
  word: string;
  /** A picture for the word, when the dictionary has one. */
  emoji?: string;
  /** What is shown for missing letter: the word with a gap ("m _ n g o"). */
  display?: string;
  options: string[];
  answer: string;
}

export interface PracticeSet {
  language: Lang;
  items: PracticeItem[];
}

/** Each kind, the competency it is evidence for (src/data/competencies.ts), and its icon. */
export const PRACTICE_KINDS: Record<PracticeKind, { icon: string; name: string; competency: string }> = {
  picture_word: { icon: '🖼️', name: 'Picture and word', competency: 'lit-vocab' },
  listen_choose: { icon: '👂', name: 'Listen and choose', competency: 'lit-decoding' },
  first_sound: { icon: '🔤', name: 'First sound', competency: 'lit-phonics' },
  missing_letter: { icon: '🧩', name: 'Missing letter', competency: 'lit-phonics' },
  word_order: { icon: '🔀', name: 'Words in order', competency: 'lit-comprehension' },
  word_meaning: { icon: '📖', name: 'Word and meaning', competency: 'lit-vocab' },
};

export const PRACTICE_KIND_LIST = Object.keys(PRACTICE_KINDS) as PracticeKind[];

const VIRAMA = '్्';

/** A word's letters as a child sees them: English letters, or Telugu/Hindi
 * aksharas (a consonant with its vowel sign, conjuncts kept together). */
export function aksharas(word: string): string[] {
  return word.match(new RegExp(`(?:\\p{L}\\p{M}*[${VIRAMA}]\\u200C?)*\\p{L}\\p{M}*|\\S`, 'gu')) || [];
}

export function scriptOf(text: string): Lang {
  if (/[ఀ-౿]/.test(text)) return 'Telugu';
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi';
  return 'English';
}

const ENGLISH_STOP = new Set(
  'the and are was were for with that this they them then than there their what when where which who whom whose why how you your yours our ours his her hers its its' .split(' ').concat(
    'from into onto have has had not but all any can could would should will shall may might must did does done been being very also just only some such each other more most much many few'.split(' '),
    'said says she him himself herself itself let lets one two out off over under upon about after before again here now yes no too'.split(' ')
  )
);
const LETTERS = { English: /^[a-z]+$/, Telugu: /^[ఀ-౿‌‍]+$/, Hindi: /^[ऀ-ॿ‌‍]+$/ };

// A small seeded random generator, so a chapter always gets the same set.
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const pick = <T,>(items: T[], n: number, rand: () => number) => shuffle(items, rand).slice(0, n);

const clean = (token: string) => token.replace(/[\p{P}\p{S}\d]+/gu, '').trim();

/** The chapter's practice words: real words of its language, most used first. */
export function chapterWords(paragraphs: string[], language: Lang): string[] {
  const counts = new Map<string, number>();
  for (const token of paragraphs.join(' ').split(/\s+/)) {
    let w = clean(token);
    if (language === 'English') w = w.toLowerCase();
    if (!w || !LETTERS[language].test(w)) continue;
    const n = aksharas(w).length;
    if (language === 'English' ? w.length < 3 || w.length > 9 || ENGLISH_STOP.has(w) : n < 2 || n > 6) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
}

/** Short sentences of the chapter for "put the words in order". */
export function orderSentences(paragraphs: string[], maxWords: number): string[][] {
  const out: string[][] = [];
  for (const sentence of paragraphs.join(' ').split(/(?<=[.!?।॥])\s+|\n+/)) {
    const words = sentence.split(/\s+/).map(clean).filter(Boolean);
    if (words.length < 3 || words.length > maxWords) continue;
    // Every word different, so there is only one right order.
    if (new Set(words.map((w) => w.toLowerCase())).size !== words.length) continue;
    out.push(words);
  }
  return out;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const base = (akshara: string) => [...akshara][0];

/** How many of each kind a class gets: picture/sound work for the youngest,
 * sentences and meanings as children grow. */
export function practicePlan(grade: string): Record<PracticeKind, number> {
  const n = Number(String(grade).replace(/\D+/g, '')) || 1;
  if (n <= 2) return { picture_word: 3, listen_choose: 3, first_sound: 2, missing_letter: 2, word_order: 1, word_meaning: 0 };
  if (n <= 5) return { picture_word: 2, listen_choose: 2, first_sound: 1, missing_letter: 2, word_order: 2, word_meaning: 2 };
  return { picture_word: 1, listen_choose: 1, first_sound: 0, missing_letter: 1, word_order: 2, word_meaning: 3 };
}

export interface PracticeSource {
  id: string;
  grade: string;
  paragraphs: string[];
  language?: string;
  keyVocabulary?: { word?: string; meaning?: string }[];
}

export function buildPractice(reading: PracticeSource, dictionary: DictionaryWord[]): PracticeSet {
  const paragraphs = (reading.paragraphs || []).map(String);
  const language = scriptOf(paragraphs.join(' '));
  const rand = seeded(reading.id);
  const plan = practicePlan(reading.grade);
  const n = Number(String(reading.grade).replace(/\D+/g, '')) || 1;
  const words = chapterWords(paragraphs, language);
  const byKind: Record<PracticeKind, PracticeItem[]> = {
    picture_word: [], listen_choose: [], first_sound: [], missing_letter: [], word_order: [], word_meaning: [],
  };
  const used = new Set<string>();
  const fresh = (list: string[]) => list.filter((w) => !used.has(w));

  // Picture words: chapter words the dictionary has a picture for.
  const dict = dictionary.filter((d) => d.language === language && d.emoji);
  const key = (w: string) => (language === 'English' ? w.toLowerCase() : w);
  const dictByWord = new Map(dict.map((d) => [key(d.word), d]));
  const pictured = words
    .map((w) => dictByWord.get(w) || (language === 'English' && w.endsWith('s') ? dictByWord.get(w.slice(0, -1)) : undefined))
    .filter((d): d is DictionaryWord => Boolean(d))
    .filter((d, i, all) => all.findIndex((x) => x.word === d.word) === i);
  for (const d of pick(pictured, plan.picture_word, rand)) {
    // Wrong options: other pictured words, chapter ones first.
    const others = pictured.filter((x) => x.word !== d.word && x.emoji !== d.emoji).map((x) => x.word);
    const extra = dict.filter((x) => x.word !== d.word && x.emoji !== d.emoji && !others.includes(x.word)).map((x) => x.word);
    const wrong = [...pick(others, 2, rand), ...pick(extra, 2, rand)].slice(0, 2);
    if (wrong.length < 2) continue;
    byKind.picture_word.push({ kind: 'picture_word', word: d.word, emoji: d.emoji, options: shuffle([d.word, ...wrong], rand), answer: d.word });
    used.add(key(d.word));
  }

  const emojiOf = (w: string) => dictByWord.get(w)?.emoji;

  // Listen and choose: hear a chapter word, tap it among two others.
  for (const w of pick(fresh(words.slice(0, 40)), plan.listen_choose, rand)) {
    const first = aksharas(w)[0];
    const similar = words.filter((x) => x !== w && aksharas(x)[0] === first);
    const rest = words.filter((x) => x !== w && !similar.includes(x));
    const wrong = [...pick(similar, 1, rand), ...pick(rest, 2, rand)].slice(0, 2);
    if (wrong.length < 2) continue;
    byKind.listen_choose.push({ kind: 'listen_choose', word: w, options: shuffle([w, ...wrong], rand), answer: w });
    used.add(w);
  }

  // First sound: the letter a word starts with (Telugu/Hindi: its base letter).
  const firstLetter = (w: string) => (language === 'English' ? w[0] : base(aksharas(w)[0]));
  const initials = [...new Set(words.map(firstLetter))];
  for (const w of pick(fresh(words.slice(0, 40)), plan.first_sound, rand)) {
    const answer = firstLetter(w);
    const wrong = pick(initials.filter((x) => x !== answer), 2, rand);
    if (wrong.length < 2) continue;
    // The word is heard (and its picture shown), never written: that would give the answer away.
    byKind.first_sound.push({ kind: 'first_sound', word: w, emoji: emojiOf(w), options: shuffle([answer, ...wrong], rand), answer });
    used.add(w);
  }

  // Missing letter: a middle letter is blanked. Wrong options must not make
  // another real word: in English a vowel is offered against consonants (and
  // the reverse); in Telugu/Hindi only aksharas of another base letter.
  const pool = [...new Set(words.flatMap(aksharas))];
  for (const w of pick(fresh(words.filter((x) => aksharas(x).length >= 3)), plan.missing_letter, rand)) {
    const parts = aksharas(w);
    const at = 1 + Math.floor(rand() * (parts.length - 2));
    const answer = parts[at];
    const candidates =
      language === 'English'
        ? 'abcdefghijklmnopqrstuvwxyz'.split('').filter((l) => VOWELS.has(l) !== VOWELS.has(answer))
        : pool.filter((a) => base(a) !== base(answer) && /\p{L}/u.test(a));
    const wrong = pick(candidates, 2, rand);
    if (wrong.length < 2) continue;
    const display = parts.map((p, i) => (i === at ? '_' : p)).join(language === 'English' ? ' ' : '');
    byKind.missing_letter.push({ kind: 'missing_letter', word: w, emoji: emojiOf(w), display, options: shuffle([answer, ...wrong], rand), answer });
    used.add(w);
  }

  // Words in order: a short sentence of the chapter, mixed up.
  const sentences = orderSentences(paragraphs, n <= 2 ? 4 : n <= 5 ? 6 : 8);
  for (const s of pick(sentences, plan.word_order, rand)) {
    let mixed = shuffle(s, rand);
    for (let tries = 0; mixed.join(' ') === s.join(' ') && tries < 5; tries++) mixed = shuffle(s, rand);
    if (mixed.join(' ') === s.join(' ')) mixed = [...s].reverse();
    byKind.word_order.push({ kind: 'word_order', word: s.join(' '), options: mixed, answer: s.join(' ') });
  }

  // Word and meaning: the chapter's key vocabulary.
  const vocab = (reading.keyVocabulary || [])
    .map((v) => ({ word: String(v?.word || '').trim(), meaning: String(v?.meaning || '').trim() }))
    .filter((v) => v.word && v.meaning && v.meaning.length <= 90)
    .filter((v, i, all) => all.findIndex((x) => x.word === v.word || x.meaning === v.meaning) === i);
  if (vocab.length >= 3) {
    for (const v of pick(vocab, plan.word_meaning, rand)) {
      const wrong = pick(vocab.filter((x) => x.word !== v.word).map((x) => x.meaning), 2, rand);
      byKind.word_meaning.push({ kind: 'word_meaning', word: v.word, options: shuffle([v.meaning, ...wrong], rand), answer: v.meaning });
    }
  }

  // One of each kind in turn, so a child never does six of the same in a row.
  const items: PracticeItem[] = [];
  for (let round = 0; items.length < PRACTICE_KIND_LIST.reduce((sum, k) => sum + byKind[k].length, 0); round++) {
    for (const k of PRACTICE_KIND_LIST) if (byKind[k][round]) items.push(byKind[k][round]);
  }
  return { language, items };
}

export type PracticeResults = Partial<Record<PracticeKind, { right: number; total: number }>>;

/** First-try results per kind, from the answers a child gave (item index → right first time). */
export function practiceResults(items: PracticeItem[], firstTry: Record<number, boolean>): PracticeResults {
  const out: PracticeResults = {};
  items.forEach((item, i) => {
    if (!(i in firstTry)) return;
    const r = (out[item.kind] ||= { right: 0, total: 0 });
    r.total += 1;
    if (firstTry[i]) r.right += 1;
  });
  return out;
}
