// Maths animation templates for the animated lesson of an uploaded maths
// chapter (Class 1-10): number line jumps, place-value blocks, column
// addition/subtraction with carries and borrows, multiplication arrays,
// sharing (division), fractions, shapes (sides, corners, perimeter, area,
// angles), clock, money, ruler, bar graph and a straight-line graph.
// The AI picks a template and fills its numbers; this file checks them
// (anything the app can't draw well is dropped) and also finds these scenes
// in a chapter's own text when the AI is not available ("23 + 19 = 42",
// "₹ 75", "3/4", "5:30", "12 cm", "triangle"…). Pure, shared by the server
// and the browser.

export type ShapeName = 'triangle' | 'square' | 'rectangle' | 'circle' | 'pentagon' | 'hexagon' | 'angle';

export interface GraphBar {
  label: string;
  emoji: string;
  value: number;
}

export type MathsVisual =
  | { kind: 'numberline'; start: number; step: number; jumps: number }
  | { kind: 'placevalue'; n: number }
  | { kind: 'column'; op: 'add' | 'sub'; a: number; b: number }
  | { kind: 'array'; rows: number; cols: number; emoji: string }
  | { kind: 'share'; total: number; groups: number; emoji: string }
  | { kind: 'fraction'; num: number; den: number; shape: 'circle' | 'bar'; num2?: number; den2?: number }
  | { kind: 'shape'; shape: ShapeName; a?: number; b?: number }
  | { kind: 'clock'; hour: number; minute: number }
  | { kind: 'money'; amount: number }
  | { kind: 'measure'; length: number; emoji: string }
  | { kind: 'bars'; bars: GraphBar[] }
  | { kind: 'graph'; slope: number; intercept: number };

export const MATHS_KINDS = ['numberline', 'placevalue', 'column', 'array', 'share', 'fraction', 'shape', 'clock', 'money', 'measure', 'bars', 'graph'] as const;
export type MathsKind = (typeof MATHS_KINDS)[number];
export const isMathsKind = (k: string): k is MathsKind => (MATHS_KINDS as readonly string[]).includes(k);

const num = (v: unknown) => Number(v);
const int = (v: unknown) => Math.round(Number(v));
const isInt = (v: unknown) => Number.isFinite(Number(v)) && Number.isInteger(Number(v));
const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
function emojiOf(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  if (!s || s.length > 8 || /[A-Za-z0-9ऀ-ॿఀ-౿]/.test(s)) return fallback;
  return Array.from(s).slice(0, 3).join('');
}

const SHAPES: ShapeName[] = ['triangle', 'square', 'rectangle', 'circle', 'pentagon', 'hexagon', 'angle'];

/** Corners (and sides) of a polygon; 0 for a circle or an angle. */
export const shapeCorners = (s: ShapeName) => ({ triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, circle: 0, angle: 0 })[s];

export function angleKind(deg: number): 'acute' | 'right' | 'obtuse' | 'straight' {
  return deg < 90 ? 'acute' : deg === 90 ? 'right' : deg < 180 ? 'obtuse' : 'straight';
}

/** Perimeter and area of a square (side a) or rectangle (a × b), whole units. */
export function shapeMeasures(v: { shape: ShapeName; a?: number; b?: number }): { perimeter: number; area: number } | null {
  if (v.shape === 'square' && v.a) return { perimeter: 4 * v.a, area: v.a * v.a };
  if (v.shape === 'rectangle' && v.a && v.b) return { perimeter: 2 * (v.a + v.b), area: v.a * v.b };
  return null;
}

export interface ColumnStep {
  /** Digit of the top number in this column (0 when it has no digit here). */
  a: number;
  b: number;
  /** Subtraction: the top digit after borrowing, when it changed. */
  top?: number;
  /** The answer digit for this column. */
  result: number;
  /** Addition: 1 when this column carries into the next. Subtraction: 1 when this column borrowed. */
  carry: number;
}

/** Column addition/subtraction worked right to left: index 0 is the ones column. */
export function columnSteps(op: 'add' | 'sub', a: number, b: number): ColumnStep[] {
  const width = Math.max(String(a).length, String(b).length);
  const digit = (n: number, i: number) => Math.floor(n / 10 ** i) % 10;
  const steps: ColumnStep[] = [];
  let carry = 0;
  for (let i = 0; i < width; i++) {
    const da = digit(a, i);
    const db = digit(b, i);
    if (op === 'add') {
      const s = da + db + carry;
      carry = s >= 10 ? 1 : 0;
      steps.push({ a: da, b: db, result: s % 10, carry });
    } else {
      let top = da - carry;
      const borrow = top < db ? 1 : 0;
      top += borrow * 10;
      steps.push({ a: da, b: db, ...(top !== da ? { top } : {}), result: top - db, carry: borrow });
      carry = borrow;
    }
  }
  return steps;
}

/** Notes and coins for an amount, largest first (₹500 down to ₹1). */
export const MONEY_PIECES = [500, 200, 100, 50, 20, 10, 5, 2, 1];
export function moneyPieces(amount: number): number[] {
  const out: number[] = [];
  let left = Math.round(amount);
  for (const p of MONEY_PIECES) {
    while (left >= p) {
      out.push(p);
      left -= p;
    }
  }
  return out;
}

/** The points a number line passes: start, start+step, … */
export const numberlinePoints = (v: { start: number; step: number; jumps: number }) => Array.from({ length: v.jumps + 1 }, (_, k) => v.start + k * v.step);

/** Points of y = slope·x + intercept with whole x from -5 to 5 that fit on a ±10 grid. */
export function graphPoints(v: { slope: number; intercept: number }) {
  const pts: { x: number; y: number }[] = [];
  for (let x = -5; x <= 5; x++) {
    const y = Math.round((v.slope * x + v.intercept) * 100) / 100;
    if (y >= -10 && y <= 10) pts.push({ x, y });
  }
  return pts;
}

/** Turn the model's fields into a maths visual the app can draw, or null. */
export function mathsVisualFrom(kind: string, raw: any): MathsVisual | null {
  const a = num(raw?.a);
  const b = num(raw?.b);
  const c = num(raw?.c);
  const d = num(raw?.d);
  switch (kind) {
    case 'numberline': {
      const start = a;
      const step = b;
      const jumps = Number.isFinite(c) && c > 0 ? int(c) : 1;
      if (!isInt(start) || !isInt(step) || step === 0 || !inRange(jumps, 1, 10)) return null;
      const end = start + step * jumps;
      if (!inRange(start, -1000, 10000) || !inRange(end, -1000, 10000) || Math.abs(step) > 1000) return null;
      return { kind: 'numberline', start, step, jumps };
    }
    case 'placevalue':
      return isInt(a) && inRange(a, 1, 99999) ? { kind: 'placevalue', n: a } : null;
    case 'column': {
      const op = /sub|minus|-|−/.test(String(raw?.op || '').toLowerCase()) ? 'sub' : 'add';
      if (!isInt(a) || !isInt(b) || !inRange(a, 0, 99999) || !inRange(b, 0, 99999)) return null;
      if (op === 'sub' && b > a) return null;
      if (a < 10 && b < 10) return null; // one-digit sums are "count" scenes
      return { kind: 'column', op, a, b };
    }
    case 'array':
      return isInt(a) && isInt(b) && inRange(a, 1, 10) && inRange(b, 1, 12) && a * b >= 2 ? { kind: 'array', rows: a, cols: b, emoji: emojiOf(raw?.emoji, '🍎') } : null;
    case 'share':
      return isInt(a) && isInt(b) && inRange(b, 2, 10) && inRange(a, b, 60) ? { kind: 'share', total: a, groups: b, emoji: emojiOf(raw?.emoji, '🍬') } : null;
    case 'fraction': {
      const shape = String(raw?.shape || '').toLowerCase() === 'bar' ? 'bar' : 'circle';
      if (!isInt(a) || !isInt(b) || !inRange(b, 2, 12) || !inRange(a, 0, b)) return null;
      const second = isInt(c) && isInt(d) && inRange(d, 2, 12) && inRange(c, 0, d) ? { num2: c, den2: d } : {};
      return { kind: 'fraction', num: a, den: b, shape, ...second };
    }
    case 'shape': {
      const name = String(raw?.shape || raw?.word || '').toLowerCase().trim() as ShapeName;
      if (!SHAPES.includes(name)) return null;
      if (name === 'angle') return isInt(a) && inRange(a, 5, 180) ? { kind: 'shape', shape: 'angle', a } : null;
      if (name === 'square' && isInt(a) && inRange(a, 1, 10)) return { kind: 'shape', shape: 'square', a };
      if (name === 'rectangle' && isInt(a) && isInt(b) && inRange(a, 1, 12) && inRange(b, 1, 10)) return { kind: 'shape', shape: 'rectangle', a, b };
      return { kind: 'shape', shape: name };
    }
    case 'clock':
      return isInt(a) && isInt(b) && inRange(a, 1, 12) && inRange(b, 0, 59) ? { kind: 'clock', hour: a, minute: b } : null;
    case 'money':
      return isInt(a) && inRange(a, 1, 5000) && moneyPieces(a).length <= 14 ? { kind: 'money', amount: a } : null;
    case 'measure':
      return inRange(a, 0.5, 30) && Number.isInteger(a * 2) ? { kind: 'measure', length: a, emoji: emojiOf(raw?.emoji, '✏️') } : null;
    case 'bars': {
      const bars = (Array.isArray(raw?.items) ? raw.items : [])
        .map((x: any) => ({ label: clean(x?.label, 20), emoji: emojiOf(x?.emoji, '⬛'), value: num(x?.value) }))
        .filter((x: GraphBar) => x.label && isInt(x.value) && inRange(x.value, 0, 1000))
        .slice(0, 6);
      return bars.length >= 2 && bars.some((x: GraphBar) => x.value > 0) ? { kind: 'bars', bars } : null;
    }
    case 'graph': {
      const slope = Math.round(a * 2) / 2;
      if (!inRange(slope, -5, 5) || !isInt(b) || !inRange(b, -10, 10)) return null;
      return graphPoints({ slope, intercept: b }).length >= 3 ? { kind: 'graph', slope, intercept: b } : null;
    }
  }
  return null;
}

/** Plain words for what a maths scene shows (used as its title). */
export function mathsTitle(v: MathsVisual): string {
  switch (v.kind) {
    case 'numberline':
      return `${v.start} ${v.step > 0 ? '+' : '−'} ${Math.abs(v.step)} × ${v.jumps}`;
    case 'placevalue':
      return `Place value of ${v.n}`;
    case 'column':
      return `${v.a} ${v.op === 'add' ? '+' : '−'} ${v.b}`;
    case 'array':
      return `${v.rows} × ${v.cols}`;
    case 'share':
      return `${v.total} ÷ ${v.groups}`;
    case 'fraction':
      return v.den2 ? `${v.num}/${v.den} and ${v.num2}/${v.den2}` : `${v.num}/${v.den}`;
    case 'shape':
      return v.shape === 'angle' ? `An angle of ${v.a}°` : `A ${v.shape}`;
    case 'clock':
      return `${v.hour}:${String(v.minute).padStart(2, '0')}`;
    case 'money':
      return `₹${v.amount}`;
    case 'measure':
      return `${v.length} cm`;
    case 'bars':
      return 'Bar graph';
    case 'graph':
      return `y = ${v.slope === 1 ? '' : v.slope === -1 ? '−' : v.slope}x ${v.intercept < 0 ? '−' : '+'} ${Math.abs(v.intercept)}`;
  }
}

const SHAPE_WORDS: [ShapeName, RegExp][] = [
  ['rectangle', /\brectangles?\b|దీర్ఘ\s?చతురస్ర|आयत/i],
  ['triangle', /\btriangles?\b|త్రిభుజ|त्रिभुज/i],
  ['square', /\bsquares?\b(?!\s*(root|number|of))|చతురస్ర|वर्गाकार/i],
  ['circle', /\bcircles?\b|వృత్త|वृत्त/i],
  ['pentagon', /\bpentagons?\b|పంచభుజ|पंचभुज/i],
  ['hexagon', /\bhexagons?\b|షడ్భుజ|षट्भुज/i],
];
const PLACE_WORDS = /place value|hundreds|thousands|tens and ones|స్థాన\s?విలువ|వందలు|వేలు|स्थानीय मान|सैकड़|हज़ार|हजार/i;
const DIGITS = (s: string) =>
  s.replace(/[౦-౯]/g, (ch) => String(ch.charCodeAt(0) - 0x0c66)).replace(/[०-९]/g, (ch) => String(ch.charCodeAt(0) - 0x0966));

export interface FoundMathsScene {
  visual: MathsVisual | { kind: 'count'; op: 'add' | 'sub' | 'groups'; a: number; b: number };
  sentence: string;
}

/**
 * Maths scenes found in a chapter's own sentences, for the text-only lesson:
 * the sums, products, shares, fractions, amounts, times, lengths, shapes,
 * number patterns and place values it writes out. One scene per kind of idea
 * (a chapter full of sums gives at most two sum scenes), at most `max`.
 */
export function mathsScenesFromText(sentences: string[], max = 4): FoundMathsScene[] {
  const found: FoundMathsScene[] = [];
  const seen = new Set<string>();
  const perKind = new Map<string, number>();
  const add = (key: string, kind: string, scene: FoundMathsScene) => {
    if (seen.has(key) || (perKind.get(kind) || 0) >= (kind === 'sum' || kind === 'shape' ? 2 : 1)) return;
    seen.add(key);
    perKind.set(kind, (perKind.get(kind) || 0) + 1);
    found.push(scene);
  };
  for (const raw of sentences) {
    if (found.length >= max) break;
    const sentence = clean(raw, 260);
    const s = DIGITS(sentence).replace(/[−–]/g, '-');
    let m: RegExpMatchArray | null;
    // a + b, a - b (count scene for small numbers, column for bigger ones)
    if ((m = s.match(/(\d{1,5})\s*([+-])\s*(\d{1,5})\s*=/)) || (m = s.match(/(\d{1,5})\s*([+-])\s*(\d{1,5})\b/))) {
      const a = Number(m[1]);
      const b = Number(m[3]);
      const op = m[2] === '+' ? 'add' : 'sub';
      if (op === 'add' ? a + b <= 20 && a <= 10 && b <= 10 && a >= 1 && b >= 1 : a <= 20 && b >= 1 && b < a) {
        add(`c${op}${a},${b}`, 'sum', { visual: { kind: 'count', op, a, b }, sentence });
      } else {
        const v = mathsVisualFrom('column', { op, a, b });
        if (v) add(`col${op}${a},${b}`, 'sum', { visual: v, sentence });
      }
    }
    // a × b
    if ((m = s.match(/(\d{1,2})\s*[×xX*]\s*(\d{1,2})\b/))) {
      const v = mathsVisualFrom('array', { a: Number(m[1]), b: Number(m[2]) });
      if (v) add(`arr${m[1]},${m[2]}`, 'times', { visual: v, sentence });
    }
    // a ÷ b
    if ((m = s.match(/(\d{1,2})\s*÷\s*(\d{1,2})\b/))) {
      const v = mathsVisualFrom('share', { a: Number(m[1]), b: Number(m[2]) });
      if (v) add(`sh${m[1]},${m[2]}`, 'share', { visual: v, sentence });
    }
    // a/b as a fraction (a < b)
    if ((m = s.match(/(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/)) && Number(m[1]) < Number(m[2])) {
      const v = mathsVisualFrom('fraction', { a: Number(m[1]), b: Number(m[2]) });
      if (v) add(`fr${m[1]}/${m[2]}`, 'fraction', { visual: v, sentence });
    }
    // money
    if ((m = s.match(/(?:₹|Rs\.?|రూ\.?|रु\.?)\s*(\d{1,4})\b/i)) || (m = s.match(/\b(\d{1,4})\s*(?:rupees?|రూపాయ|रुपय|रुपए|रुपये)/i))) {
      const v = mathsVisualFrom('money', { a: Number(m[1]) });
      if (v) add(`m${m[1]}`, 'money', { visual: v, sentence });
    }
    // time
    if ((m = s.match(/\b(\d{1,2}):(\d{2})\b/)) || (m = s.match(/\b(\d{1,2})\s*o'?\s*clock\b/i))) {
      const v = mathsVisualFrom('clock', { a: Number(m[1]), b: m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0 });
      if (v) add(`t${m[1]}:${m[2] || 0}`, 'clock', { visual: v, sentence });
    }
    // length
    if ((m = s.match(/\b(\d{1,2}(?:\.5)?)\s*(?:cm|centimet|సెం\.?\s?మీ|सेमी|सेंटीमीटर)/i))) {
      const v = mathsVisualFrom('measure', { a: Number(m[1]) });
      if (v) add(`cm${m[1]}`, 'measure', { visual: v, sentence });
    }
    // a pattern: 4+ numbers in a row with the same difference
    if ((m = s.match(/(-?\d{1,4})(?:\s*,\s*(-?\d{1,4})){3,}/))) {
      const nums = m[0].split(',').map((x) => Number(x.trim()));
      const step = nums[1] - nums[0];
      if (step !== 0 && nums.every((x, i) => i === 0 || x - nums[i - 1] === step)) {
        const v = mathsVisualFrom('numberline', { a: nums[0], b: step, c: Math.min(nums.length - 1, 10) });
        if (v) add(`nl${nums[0]},${step}`, 'pattern', { visual: v, sentence });
      }
    }
    // place value
    if (PLACE_WORDS.test(s) && (m = s.match(/\b(\d{3,5})\b/))) {
      const v = mathsVisualFrom('placevalue', { a: Number(m[1]) });
      if (v) add(`pv${m[1]}`, 'place', { visual: v, sentence });
    }
    // y = mx + c
    if ((m = s.match(/y\s*=\s*(-?\d?)\s*x\s*([+-])\s*(\d{1,2})/i))) {
      const slope = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const v = mathsVisualFrom('graph', { a: slope, b: (m[2] === '-' ? -1 : 1) * Number(m[3]) });
      if (v) add(`g${slope},${m[3]}`, 'graph', { visual: v, sentence });
    }
    // shapes
    for (const [shape, re] of SHAPE_WORDS) {
      if (re.test(s)) {
        add(`s${shape}`, 'shape', { visual: { kind: 'shape', shape }, sentence });
        break;
      }
    }
  }
  return found.slice(0, max);
}

/** Is this reading a maths chapter? */
export const isMathsReading = (r: { subject?: string; chapterTitle?: string }) => /math|గణిత|गणित|arithmetic|geometry|algebra/i.test(`${r.subject || ''}`);
