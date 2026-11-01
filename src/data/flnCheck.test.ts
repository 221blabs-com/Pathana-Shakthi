import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTextFlnCheck,
  cleanAnswers,
  cleanOrf,
  cleanSentences,
  classChapterFln,
  comprehensionScore,
  flnSummary,
  normalizeAiFlnCheck,
  orfBand,
  orfNorm,
  passageClozeQuestions,
  pickPassage,
  pickSentences,
  splitSentences,
  wordsCorrectPerMinute,
} from './flnCheck';

const crow = [
  'It was a hot summer day. A crow was very thirsty. He flew here and there looking for water.',
  'At last he saw a pot under a tree. There was only a little water at the bottom of the pot.',
  'The crow dropped small stones into the pot one by one. The water came up slowly. The clever crow drank the water and flew away happily.',
];

describe('ORF norms', () => {
  test('government numbers where they exist, the app goal elsewhere', () => {
    assert.deepEqual(orfNorm('Class 2', 'English'), { target: 45, range: [45, 60], source: 'NIPUN Bharat, Class 2', govt: true });
    assert.equal(orfNorm('Class 3', 'Hindi').target, 60);
    assert.equal(orfNorm('Class 1', 'Telugu').target, 20);
    assert.equal(orfNorm('Class 2', 'Telugu').source, 'Tholimettu (Telangana) Telugu goal');
    const c5 = orfNorm('Class 5', 'English');
    assert.equal(c5.govt, false);
    assert.match(c5.source, /app goal/);
  });

  test('bands and words correct per minute', () => {
    const norm = orfNorm('Class 2', 'English');
    assert.equal(orfBand(50, norm), 'meets');
    assert.equal(orfBand(30, norm), 'approaching');
    assert.equal(orfBand(10, norm), 'below');
    assert.equal(wordsCorrectPerMinute(40, 60), 40);
    assert.equal(wordsCorrectPerMinute(30, 30), 60);
    assert.equal(wordsCorrectPerMinute(10, 1), 120); // at least 5 s counted
    assert.equal(wordsCorrectPerMinute(0, 30), 0);
  });
});

describe('picking the text', () => {
  test('sentences split at . ! ? and the Indian danda, poems at line breaks', () => {
    assert.deepEqual(splitSentences('A cat. A dog! Why? రాముడు వచ్చాడు। सीता आई॥'), ['A cat.', 'A dog!', 'Why?', 'రాముడు వచ్చాడు।', 'सीता आई॥']);
    assert.deepEqual(splitSentences('Twinkle twinkle little star\nHow I wonder what you are'), ['Twinkle twinkle little star', 'How I wonder what you are']);
  });

  test('reading sentences: the right length for the class, different, spread out', () => {
    const s = pickSentences(crow, 'Class 1');
    assert.equal(s.length, 3);
    assert.equal(new Set(s).size, 3);
    for (const x of s) assert.ok(x.split(' ').length <= 10, x);
    assert.equal(s[0], 'It was a hot summer day.');
  });

  test('ORF passage: whole sentences, about the class length', () => {
    const p1 = pickPassage(crow, 'Class 1');
    const p5 = pickPassage(crow, 'Class 5');
    assert.ok(p1.split(' ').length >= 30 && p1.endsWith('.'));
    assert.ok(p5.split(' ').length > p1.split(' ').length);
  });

  test('direct questions from the passage, answer among the options', () => {
    const qs = passageClozeQuestions(pickPassage(crow, 'Class 3'), 2);
    assert.equal(qs.length, 2);
    for (const q of qs) {
      assert.equal(q.kind, 'direct');
      assert.match(q.question, /_____/);
      assert.equal(q.options!.length, 3);
      assert.equal(new Set(q.options).size, 3);
      assert.ok(q.answer! >= 0 && q.answer! < 3);
    }
  });
});

describe('the check', () => {
  const reading = { grade: 'Class 2', language: 'English', chapterTitle: 'The Thirsty Crow', paragraphs: crow, discussionQuestions: ['What would you do if you were thirsty?'] };

  test('text version: sentences, passage, direct + open questions, a writing task', () => {
    const c = buildTextFlnCheck(reading);
    assert.equal(c.source, 'text');
    assert.equal(c.sentences.length, 3);
    assert.ok(c.passage.length > 50);
    assert.deepEqual(c.questions.map((q) => q.kind), ['direct', 'direct', 'open']);
    assert.equal(c.questions[2].question, 'What would you do if you were thirsty?');
    assert.equal(c.writing.prompts[1], 'Write the names of 3 things you see.');
    const te = buildTextFlnCheck({ ...reading, language: 'Telugu', discussionQuestions: [] });
    assert.match(te.questions.at(-1)!.question, /[ఀ-౿]/);
  });

  test('AI version: a direct answer must be in the passage; too few good questions keeps the text version', () => {
    const base = buildTextFlnCheck(reading);
    const ai = normalizeAiFlnCheck(
      {
        direct: [
          { question: 'Where did the crow see the pot?', options: ['under a tree', 'on a roof', 'in a house'], answer: 0 },
          { question: 'What did the crow drop?', options: ['leaves', 'small stones', 'sticks'], answer: 1 },
          { question: 'Made up?', options: ['a lion', 'a tiger', 'a bear'], answer: 0 },
        ],
        indirect: [{ question: 'Why did the water come up?', options: ['The stones filled the pot', 'It rained', 'The crow cried'], answer: 0 }],
        open: [{ question: 'When have you been clever?', expected: 'a real example from their life' }],
      },
      base
    );
    assert.equal(ai.source, 'ai');
    assert.deepEqual(ai.questions.map((q) => q.kind), ['direct', 'direct', 'indirect', 'open']);
    assert.equal(normalizeAiFlnCheck({ direct: [{ question: 'x?', options: ['a', 'a', 'b'], answer: 0 }], indirect: [], open: [] }, base), base);
  });
});

describe('results', () => {
  test('cleaning what the browser sends', () => {
    assert.deepEqual(cleanSentences([{ text: ' The crow. ', accuracy: 140, tries: 0, missed: ['crow', 7] }]), [{ text: 'The crow.', accuracy: 100, tries: 1, missed: ['crow', '7'] }]);
    const orf = cleanOrf({ words: 50, correct: 60, seconds: 60, missed: ['pot'] }, 'Class 2', 'English')!;
    assert.equal(orf.correct, 50);
    assert.equal(orf.wcpm, 50);
    assert.equal(orf.band, 'meets');
    assert.equal(orf.target, 45);
    assert.equal(cleanOrf({ words: 0, seconds: 10 }, 'Class 2'), null);
    const answers = cleanAnswers([
      { kind: 'direct', question: 'Q1', options: ['a', 'b', 'c'], chosen: 1, correct: true, tries: 2 },
      { kind: 'open', question: 'Q2', text: 'I share water', aiScore: 2 },
      { kind: 'weird', question: '' },
    ]);
    assert.equal(answers.length, 2);
    assert.equal(answers[1].max, 2);
    assert.equal((answers[1] as any).aiScore, undefined); // AI marks come from the server only
  });

  test('scores: the teacher wins, then AI for open answers, then right/wrong', () => {
    const r = comprehensionScore([
      { kind: 'direct', question: 'a', correct: true, max: 1 },
      { kind: 'indirect', question: 'b', correct: false, teacherScore: 1, max: 1 },
      { kind: 'open', question: 'c', aiScore: 1, max: 2 },
      { kind: 'open', question: 'd', max: 2 },
    ]);
    assert.deepEqual(r, { score: 3, max: 4, unmarked: 1 });
    const s = flnSummary({ readingId: 'r', sentences: [{ text: 'a', accuracy: 80, tries: 1, missed: [] }, { text: 'b', accuracy: 100, tries: 2, missed: [] }], writing: { done: true, max: 10 } });
    assert.equal(s.sentences, 90);
    assert.deepEqual(s.writing, { score: null, done: true });
    assert.equal(s.wcpm, null);
  });
});

test('class summary per chapter: median ORF, share meeting the norm, comprehension, writing', () => {
  const orf = (wcpm: number) => cleanOrf({ words: 60, correct: wcpm, seconds: 60 }, 'Class 2', 'English')!;
  const rows = classChapterFln([
    { readingId: 'r1', chapterTitle: 'Crow', orf: orf(30), comprehension: { tries: 1, answers: [{ kind: 'direct', question: 'a', correct: true, max: 1 }] } },
    { readingId: 'r1', chapterTitle: 'Crow', orf: orf(50), writing: { done: true, teacherScore: 8, max: 10 } },
    { readingId: 'r1', chapterTitle: 'Crow', orf: orf(46), comprehension: { tries: 1, answers: [{ kind: 'direct', question: 'a', correct: false, max: 1 }] } },
    { readingId: 'r2', chapterTitle: 'Cat', writing: { done: true, max: 10 } },
  ]);
  assert.deepEqual(rows[0], { readingId: 'r1', chapterTitle: 'Crow', checked: 3, medianWcpm: 46, meetsNorm: 67, comprehension: 50, writingDone: 1, writingMarked: 1 });
  assert.deepEqual(rows[1], { readingId: 'r2', chapterTitle: 'Cat', checked: 1, medianWcpm: null, meetsNorm: null, comprehension: null, writingDone: 1, writingMarked: 0 });
});
