import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTextExercises, exerciseItemCount, normalizeAiExercises, rhymeKey } from './workbookExercises';
import { DICTIONARY_WORDS } from './dictionary';

const englishLesson = {
  id: 'r1',
  chapterTitle: 'The Rain',
  subject: 'English',
  imageCount: 2,
  paragraphs: [
    'Ravi saw the rain from the train. The cat sat on a mat near the door.',
    'A dog ran to the tree. The goat ate green grass in the park.',
    'Then Ravi and Sita play in the rain. The sun is hot and bright.',
  ],
  keyVocabulary: [
    { word: 'rain', meaning: 'water falling from clouds' },
    { word: 'train', meaning: 'a long vehicle on rails' },
    { word: 'goat', meaning: 'a farm animal with horns' },
  ],
  discussionQuestions: ['Do you like the rain? Why?'],
};

test('an English lesson gets every SCERT section from its own text', () => {
  const ex = buildTextExercises(englishLesson, DICTIONARY_WORDS);
  assert.equal(ex.match.length, 3);
  assert.deepEqual(ex.match[0], { left: 'rain', right: 'water falling from clouds' });
  // rhymes: answer shares the ending, the wrong options do not
  assert.ok(ex.rhymes.length >= 1);
  for (const r of ex.rhymes) {
    assert.equal(rhymeKey(r.prompt), rhymeKey(r.answer));
    assert.ok(r.options.includes(r.answer) && r.options.length === 3);
    assert.equal(r.options.filter((o) => rhymeKey(o) === rhymeKey(r.prompt)).length, 1);
  }
  // naming words: names and dictionary things, every answer a word of its sentence
  assert.ok(ex.grammar && ex.grammar.items.length >= 2);
  for (const item of ex.grammar!.items) for (const a of item.answers) assert.ok(item.sentence.includes(a), `${a} in ${item.sentence}`);
  assert.deepEqual(ex.grammar!.items[0].answers, ['Ravi', 'rain']); // a name at the start of a sentence too
  assert.equal(ex.grammar!.lenient, true);
  assert.ok(ex.rhymes.some((r) => r.prompt === 'rain' && r.answer === 'train'));
  // conventions: the right sentence is among the options with two broken copies
  assert.equal(ex.conventions.length, 2);
  for (const c of ex.conventions) {
    assert.ok(c.options.includes(c.answer) && new Set(c.options).size === 3);
    assert.match(c.answer, /^[A-Z].*[.!?]$/);
  }
  assert.equal(ex.writing.length, 3); // picture, own words, dialogue
  assert.match(ex.writing[1], /"The Rain"/);
  assert.ok(ex.oral.includes('Do you like the rain? Why?'));
  assert.ok(ex.jumbles.length >= 2);
  for (const j of ex.jumbles) {
    assert.deepEqual([...j.tiles].sort(), j.word.split('').sort());
    assert.notEqual(j.tiles.join(''), j.word);
  }
  assert.equal(ex.problems.length, 0);
  assert.ok(exerciseItemCount(ex) >= 10);
  // the same chapter always gets the same set (the printed sheet matches the screen)
  assert.deepEqual(buildTextExercises(englishLesson, DICTIONARY_WORDS), ex);
});

test('a Telugu lesson: jumbles by aksharas, full-stop conventions, no English-only sections', () => {
  const ex = buildTextExercises(
    { id: 't1', chapterTitle: 'వాన', subject: 'Telugu', paragraphs: ['వాన బాగా కురిసింది ఈ రోజు. పిల్లలు ఆనందంగా ఆడుకున్నారు బయట.'], keyVocabulary: [{ word: 'పిల్లలు', meaning: 'children' }] },
    DICTIONARY_WORDS
  );
  assert.equal(ex.rhymes.length, 0);
  assert.equal(ex.grammar, null);
  assert.ok(ex.conventions.length >= 1);
  assert.ok(ex.conventions[0].options.some((o) => !/[.!?।]$/.test(o)));
  assert.match(ex.writing[0], /వాక్యాలు/);
  assert.deepEqual(ex.jumbles[0].tiles.slice().sort(), ['పి', 'ల్ల', 'లు'].sort());
});

test('a maths chapter gets "Try these" sums of the same size, worked correctly', () => {
  const ex = buildTextExercises(
    { id: 'm1', chapterTitle: 'Addition', subject: 'Mathematics', paragraphs: ['Add 478 + 256 = 734.', 'Take away: 503 - 168 = 335.', 'There are 4 × 3 = 12 chairs.'] },
    DICTIONARY_WORDS
  );
  assert.ok(ex.problems.length >= 4);
  for (const p of ex.problems) {
    const m = p.question.match(/^(\d+) ([+−×÷]) (\d+) = \?$/)!;
    const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
    const want = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    assert.equal(Number(p.answer), want, p.question);
    if (op === '+') assert.ok(a >= 100 && a <= 999, p.question);
  }
  assert.equal(ex.grammar, null);
  assert.equal(ex.mindMap, null);
  assert.equal(ex.jumbles.length, 0);
});

test('AI exercises are checked against the chapter; a bad section keeps the text one', () => {
  const fallback = buildTextExercises(englishLesson, DICTIONARY_WORDS);
  const ai = normalizeAiExercises(
    {
      match: [
        { left: 'rain', right: 'water from clouds' },
        { left: 'train', right: 'runs on rails' },
        { left: 'goat', right: 'gives milk' },
      ],
      grammar: {
        title: 'Action words',
        instruction: 'Tap the action words.',
        items: [
          { sentence: 'A dog ran to the tree.', answers: ['ran'] },
          { sentence: 'The goat ate green grass in the park.', answers: ['ate'] },
          { sentence: 'Ravi sings.', answers: ['dances'] }, // not in the sentence: dropped
        ],
      },
      classify: { heads: ['Animals', 'Weather'], items: [{ word: 'cat', head: 'Animals' }, { word: 'dog', head: 'Animals' }, { word: 'rain', head: 'Weather' }, { word: 'sun', head: 'Weather' }, { word: 'x', head: 'Food' }] },
      rhymes: [{ word: 'cat', answer: 'dog', wrong: ['sun', 'tree'] }], // not a rhyme
      problems: [{ question: '2 + 2', answer: '4' }],
      writing: ['Write about a rainy day.', 'Write a letter to Ravi.'],
    },
    englishLesson,
    fallback
  );
  assert.equal(ai.match[0].right, 'water from clouds');
  assert.equal(ai.grammar?.title, 'Action words');
  assert.equal(ai.grammar?.items.length, 2);
  assert.deepEqual(ai.classify?.heads, ['Animals', 'Weather']);
  assert.equal(ai.classify?.items.length, 4);
  assert.deepEqual(ai.rhymes, fallback.rhymes);
  assert.deepEqual(ai.problems, []); // not a maths chapter
  assert.deepEqual(ai.writing, ['Write about a rainy day.', 'Write a letter to Ravi.']);
  assert.deepEqual(ai.oral, fallback.oral);
  assert.deepEqual(normalizeAiExercises(null, englishLesson, fallback), fallback);
});

test('exercise scores count first tries per section and ticked notebook work', async () => {
  const { scoreExercises } = await import('./workbookExercises');
  const ex = buildTextExercises(englishLesson, DICTIONARY_WORDS);
  const s = scoreExercises(ex, {
    'match:0': { solved: true, firstTry: true },
    'match:1': { solved: true, firstTry: false },
    'jumbles:0': { solved: true },
    'writing:1': { done: true },
    'oral:0': { done: true },
    'oral:9': { done: true }, // not in this workbook
  });
  assert.deepEqual(s.sections.match, [1, 3]);
  assert.deepEqual(s.sections.jumbles, [1, ex.jumbles.length]);
  assert.equal(s.right, 2);
  assert.equal(s.total, exerciseItemCount(ex));
  assert.equal(s.writingDone, 1);
  assert.equal(s.oralDone, 1);
});
