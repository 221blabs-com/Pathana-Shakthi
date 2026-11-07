import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMathsTest, mathsTestLanguage, mathsTestScore, numberOptions, usesMathsTest } from './mathsTest';
import { seeded } from './practice';

const evalArith = (prompt: string): number | null => {
  const m = prompt.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
};

test('a chapter with sums: its own example first, then new ones of the same size, all correct', () => {
  const t = buildMathsTest({
    id: 'r1',
    grade: 'Class 3',
    subject: 'Maths',
    paragraphs: ['Ravi had 478 marbles. He got 256 more. 478 + 256 = 734.', 'Sita had 503 beads and gave away 168. 503 - 168 = 335.'],
  });
  assert.equal(t.language, 'English');
  assert.ok(t.questions.length >= 6);
  assert.equal(t.questions[0].prompt, '478 + 256 = ?');
  assert.equal(t.questions[0].answer, '734');
  assert.equal(t.questions[0].fromChapter, true);
  assert.match(t.questions[0].explain, /carry 1/);
  for (const q of t.questions) {
    assert.equal(q.options.length, 4, q.prompt);
    assert.equal(new Set(q.options).size, 4, q.prompt);
    assert.ok(q.options.includes(q.answer), q.prompt);
    const v = evalArith(q.prompt);
    if (v !== null && Number.isInteger(v)) assert.equal(q.answer, String(v), q.prompt);
  }
  // New sums keep the chapter's size (three digits).
  const newSums = t.questions.filter((q) => q.kind === 'sum' && !q.fromChapter);
  assert.ok(newSums.length >= 1);
  for (const q of newSums) for (const n of q.prompt.match(/\d+/g)!) assert.equal(n.length, 3, q.prompt);
  assert.ok(t.questions.some((q) => q.kind === 'difference' && q.fromChapter && q.answer === '335'));
});

test('the same chapter always gets the same test (printed sheet matches the screen)', () => {
  const r = { id: 'r2', grade: 'Class 4', subject: 'Maths', paragraphs: ['4 × 3 = 12. 12 ÷ 4 = 3.'] };
  assert.deepEqual(buildMathsTest(r), buildMathsTest(r));
});

test('fractions, money, time, length, patterns, place value, graphs and shapes', () => {
  const t = buildMathsTest(
    {
      id: 'r3',
      grade: 'Class 5',
      subject: 'Mathematics',
      paragraphs: [
        'Half of the pizza is 1/2.',
        'Meena paid ₹50 for a book.',
        'School starts at 9:30.',
        'The pencil is 12 cm long.',
        'Count by fives: 5, 10, 15, 20, 25.',
        'In 4325 the digit 3 is in the hundreds place. Place value matters.',
      ],
    },
    { max: 20 }
  );
  const byKind = (k: string) => t.questions.filter((q) => q.kind === k);
  const frac = byKind('fraction')[0];
  const [n, d] = frac.answer.split('/').map(Number);
  assert.equal(n * 2, d, 'equal to 1/2');
  for (const o of frac.options.filter((o) => o !== frac.answer)) {
    const [x, y] = o.split('/').map(Number);
    assert.notEqual(x * 2, y, `wrong option ${o} is not equal to 1/2`);
  }
  assert.match(byKind('money')[0].prompt, /₹50/);
  assert.equal(byKind('money')[0].answer, `₹${50 - Number(byKind('money')[0].prompt.match(/spend ₹(\d+)/)![1])}`);
  assert.match(byKind('time')[0].prompt, /9:30/);
  assert.match(byKind('time')[0].answer, /^(9:45|10:00|10:15)$/);
  assert.equal(byKind('length')[0].answer.endsWith(' cm'), true);
  assert.equal(byKind('pattern')[0].answer, '25');
  const place = byKind('place')[0];
  assert.ok(['4000', '300', '20'].includes(place.answer), place.prompt);
});

test('Telugu chapter: Telugu wording, Telugu place names in the worked answer', () => {
  const t = buildMathsTest({ id: 'r4', grade: 'Class 3', subject: 'గణితం', paragraphs: ['రాము దగ్గర 345 పుస్తకాలు ఉన్నాయి. 345 + 278 = 623.', 'ఒక పెన్సిల్ పొడవు 10 సెం.మీ.'] });
  assert.equal(t.language, 'Telugu');
  assert.match(t.questions[0].explain, /ఒకట్లు/);
  assert.ok(t.questions.some((q) => /[ఀ-౿]/.test(q.prompt)), 'a word problem in Telugu');
});

test('too few sums in the chapter: filled with class-level sums; the chapter quiz is included', () => {
  const t = buildMathsTest({
    id: 'r5',
    grade: 'Class 1',
    subject: 'Maths',
    paragraphs: ['Numbers help us count things around us.'],
    comprehensionQuiz: [{ question: 'What do numbers help us do?', options: ['Count', 'Sing', 'Sleep'], correctOptionIndex: 0, explanation: 'Numbers help us count.' }],
  });
  assert.ok(t.questions.length >= 6);
  const quiz = t.questions.find((q) => q.kind === 'chapter')!;
  assert.equal(quiz.answer, 'Count');
  for (const q of t.questions.filter((q) => q.kind === 'sum')) assert.ok(Number(q.answer) <= 10, `Class 1 sums stay within 10: ${q.prompt}`);
});

test('number options: four different, never negative, include the answer', () => {
  const rand = seeded('x');
  for (const a of [0, 1, 5, 45, 99, 734]) {
    const o = numberOptions(a, rand);
    assert.equal(new Set(o).size, 4);
    assert.ok(o.includes(String(a)));
    assert.ok(o.every((x) => Number(x) >= 0));
  }
});

test('score counts first tries; maths chapters use the test, other subjects do not', () => {
  assert.deepEqual(mathsTestScore([{} as any, {} as any, {} as any], { 0: true, 1: false }), { right: 1, answered: 2, total: 3 });
  assert.equal(usesMathsTest({ subject: 'Maths' }), true);
  assert.equal(usesMathsTest({ subject: 'English' }), false);
  assert.equal(mathsTestLanguage({ id: 'x', paragraphs: ['राम के पास 5 आम हैं।'] }), 'Hindi');
});

test('every class: questions have four different options including the answer, and right arithmetic', () => {
  for (let g = 1; g <= 10; g++) {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const t = buildMathsTest({ id: `${seed}${g}`, grade: `Class ${g}`, subject: 'Maths', paragraphs: ['Let us learn.'] });
      assert.ok(t.questions.length >= 6, `Class ${g}`);
      for (const q of t.questions) {
        assert.equal(new Set(q.options).size, 4, `${g} ${q.prompt} ${q.options}`);
        assert.ok(q.options.includes(q.answer), `${g} ${q.prompt}`);
        const v = evalArith(q.prompt);
        if (v !== null && Number.isInteger(v)) assert.equal(q.answer, String(v), q.prompt);
        if (q.kind === 'share') assert.match(q.answer, /^\d+( r \d+)?$/);
      }
    }
  }
});
