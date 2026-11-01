// The SCERT textbook exercise sections of a chapter's workbook, after the
// pattern of the Telangana SCERT books' end-of-lesson exercises:
// Comprehension (answer the questions — the workbook's Q&A — and Match the
// following), Vocabulary (rhyming words, a mind map, words under heads),
// Grammar (e.g. naming words), Conventions of writing (capital letters, full
// stops), Writing (describe the picture, write in your own words, a
// dialogue), Oral skills, and Fun with words (jumbled words) — or "Try these"
// sums for a maths chapter.
//
// buildTextExercises makes them from the chapter alone (its words, its
// sentences, its vocabulary and the built-in dictionary), no AI; the AI
// workbook may bring better ones, which normalizeAiExercises checks against
// the chapter (an answer must be in the sentence, a head must be one of the
// heads…) before any of them replaces the text version. Pure; shared by the
// server (making) and the browser (doing, printing).
import { aksharas, chapterWords, seeded, shuffle } from './practice';
import { isMathsReading, mathsScenesFromText } from './mathsScenes';
import type { DictionaryWord } from './dictionary';

export type ExLang = 'English' | 'Telugu' | 'Hindi';

export interface McqItem {
  prompt: string;
  answer: string;
  options: string[];
}

export interface WorkbookExercises {
  /** Comprehension B: match the following (right side is shown shuffled). */
  match: { left: string; right: string }[];
  /** Vocabulary: which word rhymes with … (English). */
  rhymes: McqItem[];
  /** Vocabulary: a mind map around one idea (the child adds more on paper). */
  mindMap: { center: string; words: string[] } | null;
  /** Vocabulary: put the words under the right heads. */
  classify: { heads: string[]; items: { word: string; head: string }[] } | null;
  /** Grammar: tap the … words in each sentence. Lenient (made without AI from a
   * small word list): only the listed words are asked for, other taps are not wrong. */
  grammar: { title: string; instruction: string; items: { sentence: string; answers: string[] }[]; lenient?: boolean } | null;
  /** Conventions of writing: which sentence is written correctly. */
  conventions: McqItem[];
  /** Writing, done in the notebook (the teacher marks it). */
  writing: string[];
  /** Oral skills: say it aloud / talk with a partner. */
  oral: string[];
  /** Fun with words: put the letters in order. */
  jumbles: { word: string; tiles: string[]; hint: string }[];
  /** Maths: try these (a number answer). */
  problems: { question: string; answer: string }[];
}

export const EMPTY_EXERCISES: WorkbookExercises = {
  match: [],
  rhymes: [],
  mindMap: null,
  classify: null,
  grammar: null,
  conventions: [],
  writing: [],
  oral: [],
  jumbles: [],
  problems: [],
};

type ReadingLike = {
  id?: string;
  chapterTitle?: string;
  language?: string;
  subject?: string;
  grade?: string;
  paragraphs?: string[];
  keyPoints?: string[];
  keyVocabulary?: { word?: string; meaning?: string }[];
  discussionQuestions?: string[];
  imageCount?: number;
};

const clean = (v: unknown, max = 300) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const stripPunct = (t: string) => t.replace(/[\p{P}\p{S}]+/gu, '');

export const exLanguage = (reading: ReadingLike): ExLang => {
  const text = (reading.paragraphs || []).join(' ').slice(0, 3000);
  if (/[ఀ-౿]/.test(text)) return 'Telugu';
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi';
  return reading.language === 'Telugu' || reading.language === 'Hindi' ? reading.language : 'English';
};

/** A language lesson (English / Telugu / Hindi book) gets grammar, rhymes and conventions. */
export const isLanguageSubject = (reading: ReadingLike) => /english|telugu|hindi|తెలుగు|हिंदी|हिन्दी/i.test(reading.subject || '');

const T = {
  pictureWriting: {
    English: 'Look at the picture in the lesson. Describe it in 4-5 sentences.',
    Telugu: 'పాఠంలోని బొమ్మను చూడు. దాని గురించి 4-5 వాక్యాలు రాయి.',
    Hindi: 'पाठ का चित्र देखो। उसके बारे में 4-5 वाक्य लिखो।',
  },
  ownWords: {
    English: 'Write 4-5 sentences about "{title}" in your own words.',
    Telugu: '"{title}" గురించి నీ సొంత మాటల్లో 4-5 వాక్యాలు రాయి.',
    Hindi: '"{title}" के बारे में अपने शब्दों में 4-5 वाक्य लिखो।',
  },
  dialogue: {
    English: 'Write a short dialogue (4-6 lines) between two people from the lesson.',
    Telugu: 'పాఠంలోని ఇద్దరి మధ్య ఒక చిన్న సంభాషణ (4-6 వాక్యాలు) రాయి.',
    Hindi: 'पाठ के दो पात्रों के बीच एक छोटा संवाद (4-6 पंक्तियाँ) लिखो।',
  },
  mathsWriting: {
    English: 'Write how you solved one sum from this lesson, step by step.',
    Telugu: 'ఈ పాఠంలోని ఒక లెక్కను నువ్వు ఎలా చేశావో దశలవారీగా రాయి.',
    Hindi: 'इस पाठ का एक सवाल तुमने कैसे हल किया, कदम-कदम पर लिखो।',
  },
  tellFriend: {
    English: 'Tell the lesson to a friend in your own words.',
    Telugu: 'పాఠాన్ని నీ సొంత మాటల్లో నీ స్నేహితునికి చెప్పు.',
    Hindi: 'पाठ को अपने शब्दों में अपने दोस्त को सुनाओ।',
  },
  readAloud: {
    English: 'Read your favourite part of the lesson aloud, with feeling.',
    Telugu: 'పాఠంలో నీకు నచ్చిన భాగాన్ని భావంతో బిగ్గరగా చదువు.',
    Hindi: 'पाठ का अपना पसंदीदा हिस्सा भाव के साथ ज़ोर से पढ़ो।',
  },
  explainSum: {
    English: 'Explain to your partner how to do one sum from this lesson.',
    Telugu: 'ఈ పాఠంలోని ఒక లెక్క ఎలా చేయాలో నీ జతకు వివరించు.',
    Hindi: 'इस पाठ का एक सवाल कैसे करते हैं, अपने साथी को समझाओ।',
  },
  conventions: {
    English: 'Which sentence is written correctly, with a capital letter and a full stop?',
    Telugu: 'సరిగ్గా రాసిన వాక్యం ఏది (చివర పూర్తి విరామంతో)?',
    Hindi: 'कौन-सा वाक्य सही लिखा है (पूर्ण विराम के साथ)?',
  },
} as const;

/** Words that sound alike at the end ("rain" / "train"): the last vowel group and what follows. */
export function rhymeKey(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? m[0] : '';
}
// Spelled alike but said differently, or too small to practise.
const RHYME_SKIP = new Set(['the', 'are', 'was', 'were', 'one', 'done', 'gone', 'some', 'come', 'have', 'give', 'live', 'there', 'where', 'here', 'were', 'they', 'what', 'who', 'you', 'your', 'said', 'does', 'any', 'many', 'very', 'only', 'into']);

/** Match the following from the key words and their meanings. */
function matchFrom(reading: ReadingLike): WorkbookExercises['match'] {
  const seen = new Set<string>();
  return (reading.keyVocabulary || [])
    .map((v) => ({ left: clean(v.word, 40), right: clean(v.meaning, 90) }))
    .filter((p) => p.left && p.right && !seen.has(p.right) && seen.add(p.right))
    .slice(0, 5);
}

function rhymesFrom(words: string[], rand: () => number): McqItem[] {
  const usable = words.filter((w) => w.length >= 3 && !RHYME_SKIP.has(w) && rhymeKey(w).length >= 2);
  const groups = new Map<string, string[]>();
  for (const w of usable) groups.set(rhymeKey(w), [...(groups.get(rhymeKey(w)) || []), w]);
  const out: McqItem[] = [];
  for (const [key, group] of groups) {
    if (out.length >= 3) break;
    const pair = group.slice(1).find((g) => g !== group[0]);
    if (!pair) continue;
    const wrong = shuffle(
      usable.filter((w) => rhymeKey(w) !== key && w.slice(-1) !== pair.slice(-1)),
      rand
    ).slice(0, 2);
    if (wrong.length < 2) continue;
    out.push({ prompt: group[0], answer: pair, options: shuffle([pair, ...wrong], rand) });
  }
  return out;
}

const HEAD_NAMES: Record<string, string> = { Actions: 'Action words', Describing: 'Describing words', Colours: 'Colours', 'My Body': 'Body parts' };
const NOT_NAMING = new Set(['Actions', 'Describing', 'Feelings', 'Colours']);

/** The chapter's words that are in the dictionary, with their dictionary category. */
function dictionaryHits(paragraphs: string[], language: ExLang, dictionary: DictionaryWord[]) {
  const text = paragraphs.join(' ');
  const tokens = new Set(text.split(/\s+/).map((t) => stripPunct(t)).map((t) => (language === 'English' ? t.toLowerCase() : t)));
  return dictionary.filter((d) => d.language === language && tokens.has(language === 'English' ? d.word.toLowerCase() : d.word));
}

function classifyFrom(hits: DictionaryWord[], rand: () => number): WorkbookExercises['classify'] {
  const byCat = new Map<string, string[]>();
  for (const h of hits) byCat.set(h.category, Array.from(new Set([...(byCat.get(h.category) || []), h.word])));
  const cats = [...byCat.entries()].filter(([, w]) => w.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 3);
  if (cats.length < 2) return null;
  const heads = cats.map(([c]) => HEAD_NAMES[c] || c);
  const items = shuffle(
    cats.flatMap(([c, w], i) => w.slice(0, 4).map((word) => ({ word, head: heads[i] }))),
    rand
  );
  return { heads, items };
}

/** English naming words: dictionary things/animals/places… and the chapter's names
 * (words written with a capital letter in the middle of a sentence). */
function grammarFrom(paragraphs: string[], hits: DictionaryWord[]): WorkbookExercises['grammar'] {
  const nouns = new Set(hits.filter((h) => !NOT_NAMING.has(h.category)).map((h) => h.word.toLowerCase()));
  const sentences = sentencesOf(paragraphs);
  const names = new Set<string>();
  for (const s of sentences) s.split(/\s+/).slice(1).map(stripPunct).forEach((w) => /^[A-Z][a-z]+$/.test(w) && names.add(w));
  const items: { sentence: string; answers: string[] }[] = [];
  for (const sentence of sentences) {
    if (items.length >= 3) break;
    const words = sentence.split(/\s+/);
    if (words.length < 4 || words.length > 14) continue;
    const answers = words.map(stripPunct).filter((w) => w && (nouns.has(w.toLowerCase()) || names.has(w)));
    if (answers.length >= 1 && answers.length <= 4) items.push({ sentence, answers: Array.from(new Set(answers)) });
  }
  return items.length >= 2
    ? { title: 'Naming words', instruction: 'Find the naming words — names of people, animals, places and things. Tap them.', items, lenient: true }
    : null;
}

function sentencesOf(paragraphs: string[]): string[] {
  return paragraphs
    .flatMap((p) => String(p || '').split(/\n+|(?<=[.!?।॥])\s+/))
    .map((s) => clean(s, 200))
    .filter(Boolean);
}

/** "Which is written correctly": the sentence, and the same with its marks missing. */
function conventionsFrom(paragraphs: string[], language: ExLang, rand: () => number): McqItem[] {
  const out: McqItem[] = [];
  for (const s of sentencesOf(paragraphs)) {
    if (out.length >= 2) break;
    const words = s.split(/\s+/).length;
    if (words < 4 || words > 10) continue;
    const end = s.slice(-1);
    if (!/[.!?।]/.test(end)) continue;
    const body = s.slice(0, -1).trim();
    let wrong: string[];
    if (language === 'English') {
      if (!/^[A-Z]/.test(s) || /["“”]/.test(s)) continue;
      const lower = body.charAt(0).toLowerCase() + body.slice(1);
      wrong = [lower, `${lower}${end}`];
    } else {
      wrong = [body, `${body}${end === '?' ? '।' : '?'}`];
      if (end === '.' && language === 'Hindi') wrong[1] = `${body},`;
    }
    const options = Array.from(new Set([s, ...wrong]));
    if (options.length === 3) out.push({ prompt: T.conventions[language], answer: s, options: shuffle(options, rand) });
  }
  return out;
}

function jumblesFrom(reading: ReadingLike, language: ExLang, words: string[], rand: () => number): WorkbookExercises['jumbles'] {
  const meaning = new Map((reading.keyVocabulary || []).map((v) => [clean(v.word, 40), clean(v.meaning, 90)]));
  const ok = (w: string) => {
    const n = language === 'English' ? w.length : aksharas(w).length;
    return !/\s/.test(w) && (language === 'English' ? /^[A-Za-z]+$/.test(w) && n >= 4 && n <= 9 : n >= 3 && n <= 6);
  };
  const candidates = Array.from(new Set([...meaning.keys(), ...words.slice(0, 30)])).filter(ok);
  return candidates.slice(0, 3).map((word) => {
    const pieces = language === 'English' ? word.toLowerCase().split('') : aksharas(word);
    let tiles = shuffle(pieces, rand);
    for (let k = 0; k < 5 && tiles.join('') === pieces.join(''); k++) tiles = shuffle(pieces, rand);
    if (tiles.join('') === pieces.join('')) tiles = [...pieces.slice(1), pieces[0]];
    return { word: language === 'English' ? word.toLowerCase() : word, tiles, hint: meaning.get(word) || '' };
  });
}

/** "Try these": new sums like the ones the maths chapter works, with the same number of digits. */
function problemsFrom(reading: ReadingLike, rand: () => number): WorkbookExercises['problems'] {
  const sentences = [...(reading.keyPoints || []), ...sentencesOf(reading.paragraphs || [])];
  const found = mathsScenesFromText(sentences, 6);
  const out: WorkbookExercises['problems'] = [];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const ofDigits = (n: number) => {
    const d = String(Math.max(1, n)).length;
    return between(d === 1 ? 2 : 10 ** (d - 1), 10 ** d - 1);
  };
  for (const f of found) {
    const v = f.visual as any;
    for (let k = 0; k < 2 && out.length < 6; k++) {
      if (v.kind === 'column' || (v.kind === 'count' && v.op !== 'groups')) {
        let a = ofDigits(v.a);
        let b = ofDigits(v.b);
        if (v.op === 'sub' && b > a) [a, b] = [b, a];
        if (v.op === 'sub' && a === b) a += 1;
        out.push(v.op === 'sub' ? { question: `${a} − ${b} = ?`, answer: String(a - b) } : { question: `${a} + ${b} = ?`, answer: String(a + b) });
      } else if (v.kind === 'array') {
        const a = between(2, Math.max(2, Math.min(10, v.rows + 2)));
        const b = between(2, Math.max(2, Math.min(10, v.cols + 2)));
        out.push({ question: `${a} × ${b} = ?`, answer: String(a * b) });
      } else if (v.kind === 'share') {
        const g = between(2, Math.max(2, Math.min(10, v.groups + 1)));
        const each = between(2, 9);
        out.push({ question: `${g * each} ÷ ${g} = ?`, answer: String(each) });
      } else break;
    }
  }
  const seen = new Set<string>();
  return out.filter((p) => !seen.has(p.question) && seen.add(p.question));
}

/** Every exercise section that can be made from the chapter itself (no AI). */
export function buildTextExercises(reading: ReadingLike, dictionary: DictionaryWord[] = []): WorkbookExercises {
  const language = exLanguage(reading);
  const paragraphs = reading.paragraphs || [];
  const rand = seeded(`${reading.id || ''}|${reading.chapterTitle || ''}|ex`);
  const words = chapterWords(paragraphs, language);
  const maths = isMathsReading(reading);
  const lang = isLanguageSubject(reading) || (!maths && !reading.subject);
  const hits = dictionaryHits(paragraphs, language, dictionary);
  const match = matchFrom(reading);
  const classify = maths ? null : classifyFrom(hits, rand);
  const title = clean(reading.chapterTitle, 60).replace(/\s*\(Part \d+ of \d+\)$/, '');
  const mindWords = Array.from(new Set([...match.map((m) => m.left), ...(classify?.items.map((i) => i.word) || [])])).slice(0, 6);
  const writing = maths
    ? [T.mathsWriting[language]]
    : [
        ...((reading.imageCount || 0) > 0 ? [T.pictureWriting[language]] : []),
        T.ownWords[language].replace('{title}', title),
        ...(lang ? [T.dialogue[language]] : []),
      ];
  const discussion = (reading.discussionQuestions || []).map((q) => clean(q, 200)).filter(Boolean);
  const oral = maths ? [T.explainSum[language]] : [T.tellFriend[language], ...(discussion[0] ? [discussion[0]] : []), ...(lang ? [T.readAloud[language]] : [])];
  return {
    match: match.length >= 3 ? match : [],
    rhymes: lang && language === 'English' ? rhymesFrom(words, rand) : [],
    mindMap: !maths && title && mindWords.length >= 3 ? { center: title, words: mindWords } : null,
    classify,
    grammar: lang && language === 'English' ? grammarFrom(paragraphs, hits) : null,
    conventions: lang ? conventionsFrom(paragraphs, language, rand) : [],
    writing,
    oral: oral.slice(0, 3),
    jumbles: maths ? [] : jumblesFrom(reading, language, words, rand),
    problems: maths ? problemsFrom(reading, rand) : [],
  };
}

/** The JSON asked from the AI (part of the workbook schema). */
export const EXERCISES_SCHEMA = {
  type: 'object',
  properties: {
    match: { type: 'array', maxItems: 5, items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } }, required: ['left', 'right'] } },
    rhymes: { type: 'array', maxItems: 3, items: { type: 'object', properties: { word: { type: 'string' }, answer: { type: 'string' }, wrong: { type: 'array', items: { type: 'string' } } }, required: ['word', 'answer', 'wrong'] } },
    mindMap: { type: 'object', properties: { center: { type: 'string' }, words: { type: 'array', maxItems: 6, items: { type: 'string' } } } },
    classify: {
      type: 'object',
      properties: {
        heads: { type: 'array', maxItems: 3, items: { type: 'string' } },
        items: { type: 'array', maxItems: 10, items: { type: 'object', properties: { word: { type: 'string' }, head: { type: 'string' } }, required: ['word', 'head'] } },
      },
    },
    grammar: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        instruction: { type: 'string' },
        items: { type: 'array', maxItems: 4, items: { type: 'object', properties: { sentence: { type: 'string' }, answers: { type: 'array', items: { type: 'string' } } }, required: ['sentence', 'answers'] } },
      },
    },
    writing: { type: 'array', maxItems: 3, items: { type: 'string' } },
    oral: { type: 'array', maxItems: 3, items: { type: 'string' } },
    problems: { type: 'array', maxItems: 6, items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] } },
  },
} as const;

export function exercisesPromptLines(reading: ReadingLike): string {
  const maths = isMathsReading(reading);
  const language = exLanguage(reading);
  return `- exercises: the end-of-lesson exercises of a Telangana SCERT textbook, made from THIS chapter:
  - match: 3-5 "match the following" pairs (a word, name or idea from the chapter on the left; its meaning, description or answer on the right).
${maths ? '' : `  - mindMap: a centre idea from the chapter and 4-6 words connected to it.
  - classify: 2-3 heads and 6-10 words of the chapter, each under exactly one head (e.g. naming / action / describing words, living / non-living, sounds of animals).
`}${isLanguageSubject(reading) ? `  - grammar: the grammar point this lesson practises for this class (naming words, action words, describing words, opposites, plurals, tenses, ${language === 'English' ? 'articles' : 'లింగం/వచనం or लिंग/वचन'}…): a short title, the instruction to the child, and 3-4 sentences from the chapter, each with "answers" = the words in that sentence the child should tap (copied exactly).
${language === 'English' ? '  - rhymes: up to 3 items: "word" from the chapter, "answer" = a word that rhymes with it, "wrong" = 2 words that do not rhyme.\n' : ''}` : ''}  - writing: 2-3 writing tasks for the notebook${maths ? ' (explain a method, write a word problem from daily life)' : ' (describe a picture of the lesson in 4-5 sentences, write in your own words, a letter / dialogue / story ending)'}.
  - oral: 2-3 speaking tasks (talk with a partner, tell, act out, explain).
${maths ? '  - problems: 4-6 "Try these" problems like the chapter\'s, each with its exact answer as a number.\n' : ''}`;
}

/** Check the AI's exercises against the chapter; each bad section keeps the text version. */
export function normalizeAiExercises(raw: any, reading: ReadingLike, fallback: WorkbookExercises): WorkbookExercises {
  if (!raw || typeof raw !== 'object') return fallback;
  const text = (reading.paragraphs || []).join(' ');
  const language = exLanguage(reading);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  const matchSeen = new Set<string>();
  const match = arr(raw.match)
    .map((p: any) => ({ left: clean(p?.left, 60), right: clean(p?.right, 100) }))
    .filter((p) => p.left && p.right && p.left !== p.right && !matchSeen.has(p.right) && matchSeen.add(p.right))
    .slice(0, 5);

  const rhymes = arr(raw.rhymes)
    .map((r: any) => {
      const word = clean(r?.word, 30).toLowerCase();
      const answer = clean(r?.answer, 30).toLowerCase();
      const wrong = arr(r?.wrong).map((w) => clean(w, 30).toLowerCase()).filter((w) => w && w !== answer && rhymeKey(w) !== rhymeKey(word));
      if (language !== 'English' || !word || !answer || word === answer || rhymeKey(word) !== rhymeKey(answer) || wrong.length < 2) return null;
      return { prompt: word, answer, options: [answer, ...wrong.slice(0, 2)].sort() };
    })
    .filter(Boolean) as McqItem[];

  const mm = raw.mindMap;
  const mindWords = Array.from(new Set(arr(mm?.words).map((w) => clean(w, 30)).filter(Boolean))).slice(0, 6) as string[];
  const mindMap = clean(mm?.center, 40) && mindWords.length >= 3 ? { center: clean(mm.center, 40), words: mindWords } : null;

  const heads = Array.from(new Set(arr(raw.classify?.heads).map((h) => clean(h, 30)).filter(Boolean))).slice(0, 3) as string[];
  const classItems = arr(raw.classify?.items)
    .map((i: any) => ({ word: clean(i?.word, 30), head: clean(i?.head, 30) }))
    .filter((i) => i.word && heads.includes(i.head))
    .slice(0, 10);
  const classify = heads.length >= 2 && classItems.length >= 4 && heads.every((h) => classItems.some((i) => i.head === h)) ? { heads, items: classItems } : null;

  const g = raw.grammar;
  const gItems = arr(g?.items)
    .map((i: any) => {
      const sentence = clean(i?.sentence, 200);
      const tokens = new Set(sentence.split(/\s+/).map(stripPunct));
      const answers = Array.from(new Set(arr(i?.answers).map((a) => stripPunct(clean(a, 30))).filter(Boolean))) as string[];
      return sentence && answers.length >= 1 && answers.length < tokens.size && answers.every((a) => tokens.has(a)) ? { sentence, answers } : null;
    })
    .filter(Boolean)
    .slice(0, 4) as { sentence: string; answers: string[] }[];
  const grammar = clean(g?.title, 40) && clean(g?.instruction, 160) && gItems.length >= 2 ? { title: clean(g.title, 40), instruction: clean(g.instruction, 160), items: gItems } : null;

  const writing = arr(raw.writing).map((w) => clean(w, 240)).filter(Boolean).slice(0, 3);
  const oral = arr(raw.oral).map((w) => clean(w, 240)).filter(Boolean).slice(0, 3);
  const problems = arr(raw.problems)
    .map((p: any) => ({ question: clean(p?.question, 200), answer: clean(p?.answer, 20).replace(/[,\s]/g, '') }))
    .filter((p) => p.question && /^-?\d+(\.\d+)?$/.test(p.answer))
    .slice(0, 6);

  // Only words of the chapter count as chapter vocabulary in a match.
  const matchOk = match.length >= 3 && match.filter((m) => text.includes(m.left)).length >= 2;
  return {
    match: matchOk ? match : fallback.match,
    rhymes: rhymes.length >= 2 ? rhymes : fallback.rhymes,
    mindMap: mindMap || fallback.mindMap,
    classify: classify || fallback.classify,
    grammar: grammar || fallback.grammar,
    conventions: fallback.conventions,
    writing: writing.length >= 2 ? writing : fallback.writing,
    oral: oral.length >= 2 ? oral : fallback.oral,
    jumbles: fallback.jumbles,
    problems: isMathsReading(reading) && problems.length >= 3 ? problems : fallback.problems,
  };
}

/** How many of the checkable items a workbook's exercises have (match pairs, rhymes, classify words, grammar sentences, conventions, jumbles, problems). */
export function exerciseItemCount(ex: WorkbookExercises | undefined | null): number {
  if (!ex) return 0;
  return ex.match.length + ex.rhymes.length + (ex.classify?.items.length || 0) + (ex.grammar?.items.length || 0) + ex.conventions.length + ex.jumbles.length + ex.problems.length;
}

export const EXERCISE_SECTION_NAMES = ['match', 'rhymes', 'classify', 'grammar', 'conventions', 'jumbles', 'problems'] as const;
export type ExerciseSection = (typeof EXERCISE_SECTION_NAMES)[number];
export interface ExerciseAnswer {
  solved?: boolean;
  /** false once the child got it wrong; right on the first try only while still true. */
  firstTry?: boolean;
  picked?: string;
  taps?: string[];
  placed?: number[];
  typed?: string;
  checks?: number;
  done?: boolean;
}

const sectionSize = (ex: WorkbookExercises, s: ExerciseSection) =>
  s === 'classify' ? ex.classify?.items.length || 0 : s === 'grammar' ? ex.grammar?.items.length || 0 : (ex[s] as unknown[]).length;

/** Checkable items right on the first try, per section, plus notebook tasks ticked. Keys are `${section}:${index}`. */
export function scoreExercises(ex: WorkbookExercises | undefined | null, answers: Record<string, ExerciseAnswer>) {
  const sections: Record<string, [number, number]> = {};
  let right = 0;
  let total = 0;
  if (!ex) return { right, total, sections, writingDone: 0, oralDone: 0 };
  for (const s of EXERCISE_SECTION_NAMES) {
    const n = sectionSize(ex, s);
    if (!n) continue;
    let r = 0;
    for (let i = 0; i < n; i++) {
      const a = answers[`${s}:${i}`];
      if (a?.solved && a.firstTry !== false) r++;
    }
    sections[s] = [r, n];
    right += r;
    total += n;
  }
  const doneOf = (kind: 'writing' | 'oral', n: number) => Array.from({ length: n }, (_, i) => answers[`${kind}:${i}`]?.done).filter(Boolean).length;
  return { right, total, sections, writingDone: doneOf('writing', ex.writing.length), oralDone: doneOf('oral', ex.oral.length) };
}
