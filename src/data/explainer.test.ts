import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTextExplainer, cleanEmoji, countSpecFrom, normalizeAiExplainer, normalizeScene } from './explainer';

test('maths scenes keep numbers small enough to draw', () => {
  assert.deepEqual(countSpecFrom({ op: 'add', a: 3, b: 2, emoji: '🥭' }), { op: 'add', a: 3, b: 2, emoji: '🥭', stage: 'equation' });
  assert.equal(countSpecFrom({ op: 'add', a: 15, b: 9, emoji: '🥭' }), null);
  assert.deepEqual(countSpecFrom({ op: 'sub', a: 7, b: 3, emoji: '🎈' })?.op, 'sub');
  assert.equal(countSpecFrom({ op: 'sub', a: 3, b: 5 }), null);
  assert.deepEqual(countSpecFrom({ op: 'groups', a: 3, b: 4, emoji: '🍪' }), { op: 'groups', groups: 3, each: 4, emoji: '🍪', stage: 'equation' });
  assert.deepEqual(countSpecFrom({ op: 'hop', a: 4, b: 3 }), { op: 'hop', from: 4, by: 3 });
  assert.equal(countSpecFrom({ op: 'divide', a: 6, b: 2 }), null);
});

test('emoji fields hold emoji, not words', () => {
  assert.equal(cleanEmoji('🌧️'), '🌧️');
  assert.equal(cleanEmoji('rain', '⭐'), '⭐');
  assert.equal(cleanEmoji('వాన', '⭐'), '⭐');
});

test('each template needs what it draws, otherwise the scene is dropped', () => {
  assert.equal(normalizeScene({ kind: 'cycle', title: 't', say: 's', items: [{ emoji: '☀️', label: 'Sun' }, { emoji: '☁️', label: 'Cloud' }] }), null);
  const cycle = normalizeScene({ kind: 'cycle', title: 'Water cycle', say: 'Water goes round.', items: [{ emoji: '☀️', label: 'Sun heats' }, { emoji: '☁️', label: 'Clouds' }, { emoji: '🌧️', label: 'Rain' }] });
  assert.equal(cycle?.visual.kind, 'cycle');
  const sort = normalizeScene({
    kind: 'sort',
    title: 'Living or not',
    say: 'Sort them.',
    example: true,
    items: [
      { emoji: '🐄', label: 'Cow', group: 'Living' },
      { emoji: '🪨', label: 'Stone', group: 'Non-living' },
      { emoji: '🌳', label: 'Tree', group: 'Living' },
    ],
  });
  assert.equal(sort?.visual.kind, 'sort');
  assert.equal(sort?.example, true);
  if (sort?.visual.kind === 'sort') assert.deepEqual(sort.visual.groups.map((g) => g.items.length), [2, 1]);
  assert.equal(normalizeScene({ kind: 'video', title: 't', say: 's' }), null);
  assert.equal(normalizeScene({ kind: 'fact', title: 't', say: '' }), null);
});

test('a weak AI explainer falls back to the text-only one; checks need the answer among options', () => {
  const reading = {
    chapterTitle: 'Plants',
    summary: 'Plants make food from sunlight.',
    keyPoints: ['Roots take water.', 'Leaves make food.'],
    keyVocabulary: [{ word: 'root', meaning: 'the part under the soil' }],
    paragraphs: ['Plants have roots, stems and leaves.'],
    comprehensionQuiz: [{ question: 'Which part takes water?', options: ['Root', 'Leaf'], correctOptionIndex: 0 }],
  };
  const text = buildTextExplainer(reading);
  assert.equal(text.source, 'text');
  assert.ok(text.scenes.length >= 4);
  assert.deepEqual(text.check[0], { question: 'Which part takes water?', options: ['Root', 'Leaf'], answer: 'Root' });
  assert.equal(normalizeAiExplainer({ scenes: [{ kind: 'fact', title: 'a', say: 'b' }] }, reading, text), text);
  const ai = normalizeAiExplainer(
    {
      scenes: [
        { kind: 'fact', title: 'Plants', say: 'Plants make food.', emoji: '🌱' },
        { kind: 'parts', title: 'Parts', say: 'A plant has parts.', items: [{ emoji: '🌱', label: 'Plant' }, { emoji: '🟫', label: 'Root' }, { emoji: '🍃', label: 'Leaf' }] },
        { kind: 'count', title: 'Count leaves', say: 'Count the leaves.', op: 'count', a: 5, emoji: '🍃', example: true },
      ],
      check: [
        { question: 'Q1', options: ['A', 'B', 'C'], answer: 'B' },
        { question: 'Q2', options: ['A', 'B'], answer: 'Z' },
      ],
    },
    reading,
    text
  );
  assert.equal(ai.source, 'ai');
  assert.equal(ai.scenes.length, 3);
  assert.equal(ai.check.length, 1);
});
