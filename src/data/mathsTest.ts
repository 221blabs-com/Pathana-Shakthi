// A maths chapter's test and questions & answers, made from the chapter itself
// (no AI): the sums, products, shares, fractions, amounts, times, lengths,
// patterns, place values, graphs and shapes the chapter works
// (mathsScenesFromText), first the chapter's own example, then new ones of the
// same kind and size, then the chapter's own quiz questions. Every question has
// four options and a worked answer, so the same list serves the test (one at a
// time, first try counted) and the Q&A view (answers shown on tap). Seeded by
// the reading id, so the printed sheet matches the screen.

import { columnSteps, isMathsReading, mathsScenesFromText, shapeCorners, ShapeName } from './mathsScenes';
import { seeded } from './practice';
import { mathsLimitForGrade } from './learnPlay';

export type MathsTestLang = 'English' | 'Telugu' | 'Hindi';
export type MathsQuestionKind =
  | 'sum'
  | 'difference'
  | 'product'
  | 'share'
  | 'fraction'
  | 'money'
  | 'time'
  | 'length'
  | 'pattern'
  | 'place'
  | 'graph'
  | 'shape'
  | 'chapter';

export interface MathsQuestion {
  kind: MathsQuestionKind;
  prompt: string;
  answer: string;
  /** Four choices, the answer among them. */
  options: string[];
  /** The worked answer, shown after the question is solved and in Q&A. */
  explain: string;
  /** The chapter's own example (the rest are new ones like it). */
  fromChapter?: boolean;
}

export interface MathsTest {
  language: MathsTestLang;
  questions: MathsQuestion[];
}

export interface MathsReadingLike {
  id: string;
  grade?: string;
  subject?: string;
  language?: string;
  chapterTitle?: string;
  paragraphs?: string[];
  keyPoints?: string[];
  comprehensionQuiz?: { question: string; options: string[]; correctOptionIndex: number; explanation?: string }[];
}

export const MATHS_KIND_ICONS: Record<MathsQuestionKind, string> = {
  sum: '➕',
  difference: '➖',
  product: '✖️',
  share: '➗',
  fraction: '🍕',
  money: '💰',
  time: '🕒',
  length: '📏',
  pattern: '🔢',
  place: '🧮',
  graph: '📈',
  shape: '🔺',
  chapter: '📖',
};

const T = {
  fraction: { English: 'Which fraction is equal to {f}?', Telugu: '{f} కు సమానమైన భిన్నం ఏది?', Hindi: '{f} के बराबर भिन्न कौन-सी है?' },
  money: {
    English: 'You have ₹{a}. You spend ₹{b}. How much is left?',
    Telugu: 'నీ దగ్గర ₹{a} ఉన్నాయి. ₹{b} ఖర్చు చేశావు. ఎంత మిగిలింది?',
    Hindi: 'तुम्हारे पास ₹{a} हैं। ₹{b} खर्च किए। कितने बचे?',
  },
  time: { English: 'What time is it {m} minutes after {t}?', Telugu: '{t} తర్వాత {m} నిమిషాలకు సమయం ఎంత?', Hindi: '{t} के {m} मिनट बाद क्या समय होगा?' },
  length: {
    English: 'A ribbon is {a} cm long. Another is {b} cm longer. How long is it?',
    Telugu: 'ఒక రిబ్బన్ పొడవు {a} సెం.మీ. ఇంకొకటి {b} సెం.మీ. ఎక్కువ. దాని పొడవు ఎంత?',
    Hindi: 'एक रिबन {a} सेमी लंबा है। दूसरा {b} सेमी ज़्यादा लंबा है। वह कितना लंबा है?',
  },
  pattern: { English: 'What comes next? {s}', Telugu: 'తర్వాత వచ్చే సంఖ్య ఏది? {s}', Hindi: 'आगे कौन-सी संख्या आएगी? {s}' },
  place: { English: 'What is the place value of {d} in {n}?', Telugu: '{n} లో {d} స్థాన విలువ ఎంత?', Hindi: '{n} में {d} का स्थानीय मान क्या है?' },
  graph: { English: 'If y = {e}, what is y when x = {x}?', Telugu: 'y = {e} అయితే, x = {x} అయినప్పుడు y ఎంత?', Hindi: 'यदि y = {e} है, तो x = {x} होने पर y कितना है?' },
  shape: { English: 'How many corners does a {s} have?', Telugu: '{s}కు ఎన్ని మూలలు ఉంటాయి?', Hindi: '{s} के कितने कोने होते हैं?' },
  because: { English: 'because', Telugu: 'ఎందుకంటే', Hindi: 'क्योंकि' },
  carry: { English: 'carry', Telugu: 'తీసుకెళ్ళు', Hindi: 'हासिल' },
  borrow: { English: 'borrow', Telugu: 'అప్పు', Hindi: 'उधार' },
  times: { English: 'times', Telugu: 'సార్లు', Hindi: 'बार' },
  left: { English: 'left', Telugu: 'మిగిలింది', Hindi: 'बचा' },
  corners: { English: 'corners', Telugu: 'మూలలు', Hindi: 'कोने' },
  each: { English: 'each time', Telugu: 'ప్రతిసారి', Hindi: 'हर बार' },
} as const;

const PLACES: Record<MathsTestLang, string[]> = {
  English: ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands'],
  Telugu: ['ఒకట్లు', 'పదులు', 'వందలు', 'వేలు', 'పదివేలు'],
  Hindi: ['इकाई', 'दहाई', 'सैकड़ा', 'हज़ार', 'दस हज़ार'],
};

const SHAPES: Record<MathsTestLang, Partial<Record<ShapeName, string>>> = {
  English: { triangle: 'triangle', square: 'square', rectangle: 'rectangle', pentagon: 'pentagon', hexagon: 'hexagon' },
  Telugu: { triangle: 'త్రిభుజం', square: 'చతురస్రం', rectangle: 'దీర్ఘచతురస్రం', pentagon: 'పంచభుజి', hexagon: 'షడ్భుజి' },
  Hindi: { triangle: 'त्रिभुज', square: 'वर्ग', rectangle: 'आयत', pentagon: 'पंचभुज', hexagon: 'षट्भुज' },
};

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

export function mathsTestLanguage(r: MathsReadingLike): MathsTestLang {
  const text = `${r.language || ''} ${(r.paragraphs || []).join(' ').slice(0, 400)}`;
  if (/telugu|[ఀ-౿]/i.test(text)) return 'Telugu';
  if (/hindi|[ऀ-ॿ]/i.test(text)) return 'Hindi';
  return 'English';
}

const shuffle = <T,>(items: T[], rand: () => number): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Four different whole-number choices near the answer, never negative, shuffled. */
export function numberOptions(answer: number, rand: () => number, format: (n: number) => string = String): string[] {
  const set = new Set<number>([answer]);
  const near = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2, answer - 2, answer + 100, answer - 100];
  // A digit swap is the classic slip (54 for 45).
  if (answer >= 10 && answer < 100 && answer % 11 !== 0) near.unshift(Number(String(answer).split('').reverse().join('')));
  for (const n of shuffle(near, rand)) {
    if (set.size >= 4) break;
    if (n >= 0 && Number.isInteger(n)) set.add(n);
  }
  for (let k = 3; set.size < 4; k++) set.add(answer + k);
  return shuffle([...set], rand).map(format);
}

const ofDigits = (n: number, rand: () => number) => {
  const d = String(Math.max(1, Math.abs(n))).length;
  const lo = d === 1 ? 2 : 10 ** (d - 1);
  return lo + Math.floor(rand() * (10 ** d - 1 - lo + 1));
};
const between = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

function columnExplain(op: 'add' | 'sub', a: number, b: number, lang: MathsTestLang): string {
  const steps = columnSteps(op, a, b);
  const lines = steps.map((s, i) => {
    const place = PLACES[lang][i] || `10^${i}`;
    if (op === 'add') {
      const carryIn = i > 0 ? steps[i - 1].carry : 0;
      const total = s.a + s.b + carryIn;
      return `${place}: ${s.a} + ${s.b}${carryIn ? ` + ${carryIn}` : ''} = ${total}${s.carry ? ` → ${s.result}, ${T.carry[lang]} 1` : ''}`;
    }
    const top = s.top ?? s.a;
    return `${place}: ${s.carry ? `(${T.borrow[lang]}) ` : ''}${top} − ${s.b} = ${s.result}`;
  });
  return `${lines.join(' · ')} ⇒ ${op === 'add' ? a + b : a - b}`;
}

const sumQ = (a: number, b: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion => ({
  kind: 'sum',
  prompt: `${a} + ${b} = ?`,
  answer: String(a + b),
  options: numberOptions(a + b, rand),
  explain: a + b <= 20 && b <= 10 ? `${a} → ${Array.from({ length: b }, (_, k) => a + k + 1).join(', ')} ⇒ ${a + b}` : columnExplain('add', a, b, lang),
  fromChapter,
});
const diffQ = (a: number, b: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion => ({
  kind: 'difference',
  prompt: `${a} − ${b} = ?`,
  answer: String(a - b),
  options: numberOptions(a - b, rand),
  explain: a <= 20 ? `${a} → ${Array.from({ length: b }, (_, k) => a - k - 1).join(', ')} ⇒ ${a - b}` : columnExplain('sub', a, b, lang),
  fromChapter,
});
const productQ = (a: number, b: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion => ({
  kind: 'product',
  prompt: `${a} × ${b} = ?`,
  answer: String(a * b),
  options: numberOptions(a * b, rand),
  explain: a <= 6 ? `${Array.from({ length: a }, () => b).join(' + ')} (${b} × ${a} ${T.times[lang]}) = ${a * b}` : `${a} × ${b} = ${a * b}`,
  fromChapter,
});
const shareQ = (a: number, b: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion => {
  const q = Math.floor(a / b);
  const r = a % b;
  const answer = r ? `${q} r ${r}` : String(q);
  const options = r
    ? shuffle([answer, `${q + 1} r ${r}`, `${q} r ${r + 1 < b ? r + 1 : Math.max(0, r - 1)}`, `${Math.max(0, q - 1)} r ${r}`], rand)
    : numberOptions(q, rand);
  return {
    kind: 'share',
    prompt: `${a} ÷ ${b} = ?`,
    answer,
    options: [...new Set(options)].length === 4 ? options : numberOptions(q, rand).map((o) => (r ? `${o} r ${r}` : o)),
    explain: `${a} ÷ ${b} = ${answer}, ${T.because[lang]} ${b} × ${q}${r ? ` + ${r}` : ''} = ${a}`,
    fromChapter,
  };
};

function fractionQ(a: number, b: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const k = between(2, 3, rand);
  const answer = `${a * k}/${b * k}`;
  const wrong = [`${a + 1}/${b}`, `${a}/${b + 1}`, `${b}/${a}`, `${a * k}/${b * k + 1}`, `${a + k}/${b + k}`].filter((w) => {
    const [x, y] = w.split('/').map(Number);
    return y > 0 && x * b !== y * a;
  });
  return {
    kind: 'fraction',
    prompt: fill(T.fraction[lang], { f: `${a}/${b}` }),
    answer,
    options: shuffle([answer, ...[...new Set(wrong)].slice(0, 3)], rand),
    explain: `${a}/${b} = (${a} × ${k}) / (${b} × ${k}) = ${answer}`,
    fromChapter,
  };
}

function moneyQ(total: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const a = Math.max(10, total);
  // Spend a real part of it (₹50 − ₹2 is no test).
  const b = between(Math.max(1, Math.ceil(a * 0.2)), Math.max(1, a - 1), rand);
  return {
    kind: 'money',
    prompt: fill(T.money[lang], { a, b }),
    answer: `₹${a - b}`,
    options: numberOptions(a - b, rand, (n) => `₹${n}`),
    explain: `₹${a} − ₹${b} = ₹${a - b} ${T.left[lang]}`,
    fromChapter,
  };
}

const clock = (mins: number) => {
  const m = ((mins % 720) + 720) % 720;
  const h = Math.floor(m / 60) || 12;
  return `${h}:${String(m % 60).padStart(2, '0')}`;
};
function timeQ(h: number, mm: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const add = [15, 30, 45][Math.floor(rand() * 3)];
  const start = (h % 12) * 60 + mm;
  const answer = clock(start + add);
  const wrong = [clock(start + add + 15), clock(start + add - 15), clock(start + add + 60)].filter((w) => w !== answer);
  return {
    kind: 'time',
    prompt: fill(T.time[lang], { m: add, t: clock(start) }),
    answer,
    options: shuffle([answer, ...[...new Set(wrong)].slice(0, 3)], rand),
    explain: `${clock(start)} + ${add} min = ${answer}`,
    fromChapter,
  };
}

function lengthQ(len: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const a = Math.max(2, Math.round(len));
  const b = between(2, 9, rand);
  return {
    kind: 'length',
    prompt: fill(T.length[lang], { a, b }),
    answer: `${a + b} cm`,
    options: numberOptions(a + b, rand, (n) => `${n} cm`),
    explain: `${a} cm + ${b} cm = ${a + b} cm`,
    fromChapter,
  };
}

function patternQ(start: number, step: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const seq = Array.from({ length: 4 }, (_, k) => start + k * step);
  const next = start + 4 * step;
  return {
    kind: 'pattern',
    prompt: fill(T.pattern[lang], { s: `${seq.join(', ')}, ?` }),
    answer: String(next),
    options: shuffle([...new Set([next, next + step, next - 1, next + 1, seq[3]])].slice(0, 4), rand).map(String),
    explain: `${step > 0 ? '+' : ''}${step} ${T.each[lang]}: ${seq[3]} ${step >= 0 ? '+' : '−'} ${Math.abs(step)} = ${next}`,
    fromChapter,
  };
}

function placeQ(n: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const digits = String(n).split('').map(Number);
  // Ask about a non-zero digit that is not in the ones place.
  const candidates = digits.map((d, i) => ({ d, p: digits.length - 1 - i })).filter((x) => x.d > 0 && x.p > 0);
  const pick = candidates[Math.floor(rand() * candidates.length)] || { d: digits[0], p: digits.length - 1 };
  const value = pick.d * 10 ** pick.p;
  const wrong = [pick.d, pick.d * 10 ** (pick.p + 1), pick.p > 1 ? pick.d * 10 ** (pick.p - 1) : pick.d * 10 ** (pick.p + 2), value + 1].filter((w) => w !== value);
  return {
    kind: 'place',
    prompt: fill(T.place[lang], { d: pick.d, n }),
    answer: String(value),
    options: shuffle([value, ...[...new Set(wrong)].slice(0, 3)], rand).map(String),
    explain: `${pick.d} → ${PLACES[lang][pick.p] || ''}: ${pick.d} × ${10 ** pick.p} = ${value}`,
    fromChapter,
  };
}

function graphQ(m: number, c: number, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion {
  const x = between(1, 5, rand);
  const y = m * x + c;
  const e = `${m === 1 ? '' : m === -1 ? '−' : m}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)}`;
  return {
    kind: 'graph',
    prompt: fill(T.graph[lang], { e, x }),
    answer: String(y),
    options: shuffle([...new Set([y, y + m, y - m, m * x, y + 1, y - 1])].slice(0, 4), rand).map(String),
    explain: `y = ${m} × ${x} ${c >= 0 ? '+' : '−'} ${Math.abs(c)} = ${y}`,
    fromChapter,
  };
}

function shapeQ(shape: ShapeName, rand: () => number, lang: MathsTestLang, fromChapter = false): MathsQuestion | null {
  const name = SHAPES[lang][shape];
  if (!name) return null;
  const n = shapeCorners(shape);
  return {
    kind: 'shape',
    prompt: fill(T.shape[lang], { s: name }),
    answer: String(n),
    options: shuffle([...new Set([n, n + 1, n - 1, n + 2])], rand).map(String),
    explain: `${name}: ${n} ${T.corners[lang]}`,
    fromChapter,
  };
}

const splitSentences = (paragraphs: string[]) =>
  paragraphs.flatMap((p) => p.split(/(?<=[.!?।॥])\s+|\n+/)).map((s) => s.trim()).filter(Boolean);

/** Questions like the scene the chapter worked: its own example first, then `extra` new ones. */
function questionsFor(scene: ReturnType<typeof mathsScenesFromText>[number], rand: () => number, lang: MathsTestLang, extra: number): MathsQuestion[] {
  const v = scene.visual as any;
  const out: (MathsQuestion | null)[] = [];
  const kinds = (fromChapter: boolean): MathsQuestion | null => {
    const pick = <N,>(own: N, fresh: () => N) => (fromChapter ? own : fresh());
    switch (v.kind) {
      case 'count':
      case 'column': {
        if (v.op === 'groups') return null;
        let a = pick(v.a, () => ofDigits(v.a, rand));
        let b = pick(v.b, () => ofDigits(v.b, rand));
        if (v.op === 'sub') {
          if (b > a) [a, b] = [b, a];
          if (a === b) a += 1;
          return diffQ(a, b, rand, lang, fromChapter);
        }
        return sumQ(a, b, rand, lang, fromChapter);
      }
      case 'array':
        return productQ(pick(v.rows, () => between(2, Math.min(10, v.rows + 3), rand)), pick(v.cols, () => between(2, Math.min(10, v.cols + 3), rand)), rand, lang, fromChapter);
      case 'share': {
        if (fromChapter) return shareQ(v.total, v.groups, rand, lang, true);
        const g = between(2, Math.max(2, Math.min(10, v.groups + 1)), rand);
        return shareQ(g * between(2, 9, rand), g, rand, lang);
      }
      case 'fraction': {
        if (fromChapter) return fractionQ(v.num, v.den, rand, lang, true);
        const b = between(3, 9, rand);
        return fractionQ(between(1, b - 1, rand), b, rand, lang);
      }
      case 'money':
        return moneyQ(pick(v.amount, () => between(20, Math.max(30, v.amount), rand)), rand, lang, fromChapter);
      case 'clock':
        return timeQ(pick(v.hour, () => between(1, 12, rand)), pick(v.minute, () => [0, 15, 30, 45][Math.floor(rand() * 4)]), rand, lang, fromChapter);
      case 'measure':
        return lengthQ(pick(v.length, () => between(3, 15, rand)), rand, lang, fromChapter);
      case 'numberline':
        return patternQ(pick(v.start, () => between(1, 20, rand)), pick(v.step, () => between(2, 10, rand)), rand, lang, fromChapter);
      case 'placevalue':
        return placeQ(pick(v.n, () => ofDigits(v.n, rand)), rand, lang, fromChapter);
      case 'graph':
        return graphQ(pick(v.slope, () => between(1, 4, rand)), pick(v.intercept, () => between(0, 6, rand)), rand, lang, fromChapter);
      case 'shape':
        return shapeQ(fromChapter ? v.shape : (['triangle', 'square', 'pentagon', 'hexagon'] as ShapeName[])[Math.floor(rand() * 4)], rand, lang, fromChapter);
      default:
        return null;
    }
  };
  out.push(kinds(true));
  for (let k = 0; k < extra; k++) out.push(kinds(false));
  return out.filter((q): q is MathsQuestion => Boolean(q));
}

/** Class-level sums for when a chapter writes out too few of its own. */
function gradePractice(grade: string, rand: () => number, lang: MathsTestLang, n: number): MathsQuestion[] {
  const limit = mathsLimitForGrade(grade);
  const g = Number((grade.match(/\d+/) || ['3'])[0]);
  const out: MathsQuestion[] = [];
  for (let k = 0; out.length < n && k < n * 3; k++) {
    const kind = g <= 2 ? k % 2 : k % 4;
    if (kind === 0) {
      const a = between(1, Math.max(2, Math.floor(limit / 2)), rand);
      out.push(sumQ(a, between(1, Math.max(1, limit - a), rand), rand, lang));
    } else if (kind === 1) {
      const a = between(3, limit, rand);
      out.push(diffQ(a, between(1, a - 1, rand), rand, lang));
    } else if (kind === 2) out.push(productQ(between(2, 9, rand), between(2, 9, rand), rand, lang));
    else {
      const b = between(2, 9, rand);
      out.push(shareQ(b * between(2, 9, rand), b, rand, lang));
    }
  }
  return out;
}

/** The chapter's test: its own examples, new ones like them, its quiz, filled to `min` with class-level sums. */
export function buildMathsTest(reading: MathsReadingLike, opts: { min?: number; max?: number } = {}): MathsTest {
  const min = opts.min ?? 6;
  const max = opts.max ?? 10;
  const rand = seeded(`maths-test:${reading.id}`);
  const language = mathsTestLanguage(reading);
  const sentences = [...(reading.keyPoints || []), ...splitSentences(reading.paragraphs || [])];
  const scenes = mathsScenesFromText(sentences, 6);
  const extra = scenes.length <= 2 ? 2 : 1;
  const fromText = scenes.flatMap((s) => questionsFor(s, rand, language, extra));
  const quiz: MathsQuestion[] = (reading.comprehensionQuiz || [])
    .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2 && q.options[q.correctOptionIndex])
    .slice(0, 3)
    .map((q) => ({
      kind: 'chapter' as const,
      prompt: q.question,
      answer: q.options[q.correctOptionIndex],
      options: q.options,
      explain: q.explanation || q.options[q.correctOptionIndex],
      fromChapter: true,
    }));
  const seen = new Set<string>();
  let questions = [...fromText, ...quiz].filter((q) => !seen.has(q.prompt) && seen.add(q.prompt) && new Set(q.options).size === q.options.length);
  if (questions.length < min) {
    const fill = gradePractice(reading.grade || 'Class 3', rand, language, (min - questions.length) * 2).filter((q) => !seen.has(q.prompt) && seen.add(q.prompt));
    questions = [...questions, ...fill.slice(0, min - questions.length)];
  }
  return { language, questions: questions.slice(0, max) };
}

/** Right on the first try, out of the questions answered. */
export function mathsTestScore(questions: MathsQuestion[], firstTry: Record<number, boolean>) {
  const answered = Object.keys(firstTry).length;
  const right = Object.values(firstTry).filter(Boolean).length;
  return { right, answered, total: questions.length };
}

/** First tries per kind of question (the chapter's own quiz questions are left out), for the teacher's numeracy competencies. */
export function mathsTestResults(questions: MathsQuestion[], firstTry: Record<number, boolean>): Partial<Record<MathsQuestionKind, { right: number; total: number }>> {
  const out: Partial<Record<MathsQuestionKind, { right: number; total: number }>> = {};
  questions.forEach((q, i) => {
    if (q.kind === 'chapter' || !(i in firstTry)) return;
    const r = (out[q.kind] ||= { right: 0, total: 0 });
    r.total += 1;
    if (firstTry[i]) r.right += 1;
  });
  return out;
}

/** Which kinds of maths test question show each numeracy competency (src/data/competencies.ts). */
export const MATHS_TEST_COMPETENCY_KINDS: Record<string, MathsQuestionKind[]> = {
  'num-operations': ['sum', 'difference', 'product', 'share'],
  'num-number-sense': ['pattern', 'place', 'graph'],
  'num-shapes': ['shape'],
  'num-measurement': ['time', 'length', 'money'],
  'num-fractions': ['fraction'],
};
export const MATHS_TEST_KINDS: MathsQuestionKind[] = ['sum', 'difference', 'product', 'share', 'fraction', 'money', 'time', 'length', 'pattern', 'place', 'graph', 'shape'];

/** Maths chapters skip read-aloud: their main action is the test. */
export const usesMathsTest = (r: { subject?: string }) => isMathsReading(r);
