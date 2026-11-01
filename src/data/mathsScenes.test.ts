import test from 'node:test';
import assert from 'node:assert/strict';
import { columnSteps, graphPoints, mathsScenesFromText, mathsVisualFrom, moneyPieces, numberlinePoints, shapeMeasures, angleKind, isMathsReading } from './mathsScenes';
import { buildTextExplainer, explainerUpToDate, normalizeScene, EXPLAINER_VERSION } from './explainer';

test('column addition carries and column subtraction borrows, digit by digit', () => {
  // 478 + 256 = 734: 8+6=14 (carry), 7+5+1=13 (carry), 4+2+1=7
  assert.deepEqual(columnSteps('add', 478, 256), [
    { a: 8, b: 6, result: 4, carry: 1 },
    { a: 7, b: 5, result: 3, carry: 1 },
    { a: 4, b: 2, result: 7, carry: 0 },
  ]);
  // 503 - 168 = 335: 3<8 borrow → 13-8=5; 0-1 → borrow → 9-6=3; 5-1=4-1=3
  const sub = columnSteps('sub', 503, 168);
  assert.deepEqual(sub.map((s) => s.result).reverse().join(''), '335');
  assert.deepEqual(sub.map((s) => s.top), [13, 9, 4]);
  assert.deepEqual(sub.map((s) => s.carry), [1, 1, 0]);
  // a final carry makes the answer one digit longer
  const big = columnSteps('add', 95, 17);
  assert.equal(big[big.length - 1].carry, 1);
  // every answer matches ordinary arithmetic
  for (const [a, b] of [[9999, 1], [1000, 999], [4321, 1234], [70, 35]]) {
    const add = columnSteps('add', a, b);
    const addN = add.reduce((n, s, i) => n + s.result * 10 ** i, 0) + add[add.length - 1].carry * 10 ** add.length;
    assert.equal(addN, a + b);
    const subN = columnSteps('sub', a, b).reduce((n, s, i) => n + s.result * 10 ** i, 0);
    assert.equal(subN, a - b);
  }
});

test('money, number line, graph and shape helpers', () => {
  assert.deepEqual(moneyPieces(785), [500, 200, 50, 20, 10, 5]);
  assert.equal(moneyPieces(1999).reduce((a, b) => a + b, 0), 1999);
  assert.deepEqual(numberlinePoints({ start: -3, step: 2, jumps: 4 }), [-3, -1, 1, 3, 5]);
  assert.deepEqual(graphPoints({ slope: 2, intercept: 3 }).map((p) => p.x), [-5, -4, -3, -2, -1, 0, 1, 2, 3]);
  assert.deepEqual(shapeMeasures({ shape: 'rectangle', a: 5, b: 3 }), { perimeter: 16, area: 15 });
  assert.deepEqual(shapeMeasures({ shape: 'square', a: 4 }), { perimeter: 16, area: 16 });
  assert.equal(angleKind(90), 'right');
  assert.equal(angleKind(120), 'obtuse');
  assert.ok(isMathsReading({ subject: 'Mathematics' }) && isMathsReading({ subject: 'గణితం' }) && !isMathsReading({ subject: 'Science' }));
});

test('maths scenes from the model are checked: impossible numbers are dropped', () => {
  assert.deepEqual(mathsVisualFrom('column', { op: 'sub', a: 503, b: 168 }), { kind: 'column', op: 'sub', a: 503, b: 168 });
  assert.equal(mathsVisualFrom('column', { op: 'sub', a: 100, b: 168 }), null); // negative answer
  assert.equal(mathsVisualFrom('column', { op: 'add', a: 3, b: 4 }), null); // a "count" scene
  assert.equal(mathsVisualFrom('array', { a: 4, b: 3, emoji: 'mango' })?.kind, 'array');
  assert.equal((mathsVisualFrom('array', { a: 4, b: 3, emoji: 'mango' }) as any).emoji, '🍎');
  assert.equal(mathsVisualFrom('array', { a: 14, b: 3 }), null);
  assert.deepEqual(mathsVisualFrom('share', { a: 13, b: 4, emoji: '🍬' }), { kind: 'share', total: 13, groups: 4, emoji: '🍬' });
  assert.deepEqual(mathsVisualFrom('fraction', { a: 3, b: 4, c: 6, d: 8, shape: 'bar' }), { kind: 'fraction', num: 3, den: 4, shape: 'bar', num2: 6, den2: 8 });
  assert.equal(mathsVisualFrom('fraction', { a: 5, b: 4 }), null);
  assert.deepEqual(mathsVisualFrom('shape', { shape: 'Rectangle', a: 5, b: 3 }), { kind: 'shape', shape: 'rectangle', a: 5, b: 3 });
  assert.deepEqual(mathsVisualFrom('shape', { shape: 'angle', a: 60 }), { kind: 'shape', shape: 'angle', a: 60 });
  assert.equal(mathsVisualFrom('shape', { shape: 'star' }), null);
  assert.deepEqual(mathsVisualFrom('clock', { a: 3, b: 30 }), { kind: 'clock', hour: 3, minute: 30 });
  assert.equal(mathsVisualFrom('clock', { a: 13, b: 0 }), null);
  assert.equal(mathsVisualFrom('money', { a: 4999 }), null); // too many notes and coins to show
  assert.equal(mathsVisualFrom('measure', { a: 7.5 })?.kind, 'measure');
  assert.equal(mathsVisualFrom('measure', { a: 7.3 }), null);
  assert.equal(mathsVisualFrom('numberline', { a: 0, b: 5, c: 6 })?.kind, 'numberline');
  assert.equal(mathsVisualFrom('numberline', { a: 0, b: 0, c: 6 }), null);
  assert.equal(mathsVisualFrom('bars', { items: [{ label: 'Mon', value: 4 }, { label: 'Tue', value: 7, emoji: '🌧️' }] })?.kind, 'bars');
  assert.equal(mathsVisualFrom('bars', { items: [{ label: 'Mon', value: 4 }] }), null);
  assert.deepEqual(mathsVisualFrom('graph', { a: 2, b: 3 }), { kind: 'graph', slope: 2, intercept: 3 });
  // through the scene normalizer, with a title made from the numbers
  const scene = normalizeScene({ kind: 'column', title: '', say: 'Add the ones first.', op: 'add', a: 478, b: 256 });
  assert.equal(scene?.visual.kind, 'column');
  assert.equal(scene?.title, '478 + 256');
});

test("a maths chapter's own text becomes animated scenes without AI", () => {
  const found = mathsScenesFromText([
    'Ravi had 4 mangoes and got 3 more: 4 + 3 = 7.',
    'Add 478 + 256 = 734 by adding the ones first.',
    'There are 4 rows of 3 chairs, 4 × 3 = 12.',
    'Share 12 ÷ 4 laddus equally.',
    'Sita ate 1/4 of the roti.',
  ], 6);
  assert.deepEqual(found.map((f) => f.visual.kind), ['count', 'column', 'array', 'share', 'fraction']);
  assert.equal(found[0].sentence, 'Ravi had 4 mangoes and got 3 more: 4 + 3 = 7.');
  const more = mathsScenesFromText(['A pen costs ₹ 15.', 'School starts at 9:30.', 'The pencil is 12 cm long.', 'Count 5, 10, 15, 20, 25.', 'A triangle has three sides.'], 6);
  assert.deepEqual(more.map((f) => f.visual.kind), ['money', 'clock', 'measure', 'numberline', 'shape']);
  // Telugu digits and words
  const te = mathsScenesFromText(['౨౫ + ౧౮ = ౪౩', 'త్రిభుజానికి మూడు భుజాలు.']);
  assert.deepEqual(te.map((f) => f.visual), [{ kind: 'column', op: 'add', a: 25, b: 18 }, { kind: 'shape', shape: 'triangle' }]);
  // a date or a page reference is not a fraction; at most two sum scenes
  assert.equal(mathsScenesFromText(['Page 12/04/2024']).length, 0);
  assert.equal(mathsScenesFromText(['12 + 30 = 42', '45 + 13 = 58', '61 + 20 = 81']).length, 2);
});

test('text-only lesson of a maths chapter animates; old explainers of other subjects stay', () => {
  const ex = buildTextExplainer({
    chapterTitle: 'Addition',
    subject: 'Mathematics',
    summary: 'We add bigger numbers.',
    keyPoints: ['Add the ones first, then the tens.'],
    paragraphs: ['Ramu sold 245 + 132 = 377 coconuts.\nA kite costs ₹ 25.'],
  });
  const kinds = ex.scenes.map((s) => s.visual.kind);
  assert.ok(kinds.includes('column') && kinds.includes('money'), kinds.join());
  assert.equal(ex.scenes.find((s) => s.visual.kind === 'column')?.say, 'Ramu sold 245 + 132 = 377 coconuts.');
  // a science chapter never gets maths scenes from its numbers
  const sci = buildTextExplainer({ chapterTitle: 'Water', subject: 'Science', summary: 'Water.', paragraphs: ['Water boils at 100 + 0 degrees.'] });
  assert.ok(sci.scenes.every((s) => s.visual.kind === 'fact' || s.visual.kind === 'word'));
  assert.equal(explainerUpToDate({ version: 1 }, { subject: 'Science' }), true);
  assert.equal(explainerUpToDate({ version: 1 }, { subject: 'Maths' }), false);
  assert.equal(explainerUpToDate({ version: EXPLAINER_VERSION }, { subject: 'Maths' }), true);
  assert.equal(explainerUpToDate(undefined, { subject: 'Maths' }), false);
});
