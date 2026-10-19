import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPETENCIES, competenciesFor, competencyLabs, competencyStatus, practiceFor } from './competencies';

const byId = (id: string) => COMPETENCIES.find((c) => c.id === id)!;

test('each class gets the competencies that apply to it', () => {
  const c1 = competenciesFor('Class 1').map((c) => c.id);
  assert.ok(c1.includes('lit-phonics') && c1.includes('num-number-sense') && c1.includes('evs'));
  assert.ok(!c1.includes('num-fractions') && !c1.includes('sub-maths'));
  const c5 = competenciesFor('Class 5').map((c) => c.id);
  assert.ok(c5.includes('num-fractions') && !c5.includes('lit-phonics'));
  const c8 = competenciesFor('Class 8').map((c) => c.id);
  assert.ok(c8.includes('sub-science') && !c8.includes('num-operations'));
  // Every lab named in the framework exists.
  for (const c of COMPETENCIES) for (const g of [1, 3, 5]) competencyLabs(c, `Class ${g}`);
});

test('decoding and ORF from read-aloud accuracy and speed', () => {
  assert.equal(competencyStatus(byId('lit-decoding'), {}, 'Class 3'), 'not_started');
  assert.equal(competencyStatus(byId('lit-decoding'), { sessionsCount: 3, overallAccuracy: 80 }, 'Class 3'), 'achieved');
  assert.equal(competencyStatus(byId('lit-decoding'), { sessionsCount: 3, overallAccuracy: 55 }, 'Class 3'), 'developing');
  // Class 3 goal is 60 wcpm: 70 wpm × 90% = 63 achieved; 50 × 80% = 40 (67%) developing; 30 × 60% = 18 beginning.
  assert.equal(competencyStatus(byId('lit-orf'), { sessionsCount: 3, overallAccuracy: 90, averageWPM: 70 }, 'Class 3'), 'achieved');
  assert.equal(competencyStatus(byId('lit-orf'), { sessionsCount: 3, overallAccuracy: 80, averageWPM: 50 }, 'Class 3'), 'developing');
  assert.equal(competencyStatus(byId('lit-orf'), { sessionsCount: 3, overallAccuracy: 60, averageWPM: 30 }, 'Class 3'), 'beginning');
});

test('comprehension combines quizzes and workbook questions', () => {
  const c = byId('lit-comprehension');
  assert.equal(competencyStatus(c, { quizCorrect: 4, quizTotal: 6, units: [{ questionsKnown: 4, questionsTotal: 4 }] }, 'Class 4'), 'achieved');
  assert.equal(competencyStatus(c, { quizCorrect: 1, quizTotal: 3 }, 'Class 4'), 'beginning');
});

test('lab-measured competencies need every lab at 2+ stars', () => {
  const ops = byId('num-operations');
  const labs = competencyLabs(ops, 'Class 2'); // adding, takeaway, numberline
  assert.deepEqual(labs.sort(), ['maths-adding', 'maths-numberline', 'maths-takeaway']);
  const all2 = Object.fromEntries(labs.map((id) => [id, { stars: 2 }]));
  assert.equal(competencyStatus(ops, { labProgress: all2 }, 'Class 2'), 'achieved');
  assert.equal(competencyStatus(ops, { labProgress: { 'maths-adding': { stars: 3 }, 'maths-takeaway': { stars: 1 } } }, 'Class 2'), 'developing');
  assert.equal(competencyStatus(ops, { labProgress: { 'maths-adding': { stars: 0 } } }, 'Class 2'), 'beginning');
  // The weakest lab is suggested.
  assert.equal(practiceFor(ops, 'Class 2', { 'maths-adding': { stars: 3 }, 'maths-takeaway': { stars: 1 }, 'maths-numberline': { stars: 2 } })?.id, 'maths-takeaway');
});

test('workbooks feed vocabulary and reflection', () => {
  const units = [
    { blanksCorrect: 4, blanksTotal: 4, done: true },
    { blanksCorrect: 3, blanksTotal: 4, done: true },
    { blanksCorrect: 4, blanksTotal: 4, done: true },
  ];
  assert.equal(competencyStatus(byId('lit-vocab'), { units }, 'Class 5'), 'achieved');
  assert.equal(competencyStatus(byId('lit-reflection'), { units }, 'Class 5'), 'achieved');
  assert.equal(competencyStatus(byId('lit-reflection'), { units: [{ done: false }] }, 'Class 5'), 'beginning');
});

test('chapter practice is evidence for phonics, vocabulary, comprehension and decoding', () => {
  const get = (id: string) => COMPETENCIES.find((c) => c.id === id)!;
  const practice = {
    first_sound: { right: 4, total: 4 },
    missing_letter: { right: 3, total: 4 },
    picture_word: { right: 6, total: 7 },
    word_order: { right: 1, total: 4 },
    listen_choose: { right: 5, total: 5 },
  };
  assert.equal(competencyStatus(get('lit-phonics'), { practice }, 'Class 1'), 'achieved');
  assert.equal(competencyStatus(get('lit-phonics'), { practice: { first_sound: { right: 1, total: 4 } } }, 'Class 1'), 'beginning');
  assert.equal(competencyStatus(get('lit-vocab'), { practice }, 'Class 1'), 'achieved'); // 6 of 7, 80%+ over 6+ items
  assert.equal(competencyStatus(get('lit-vocab'), { practice: { picture_word: { right: 2, total: 3 } } }, 'Class 1'), 'developing');
  assert.equal(competencyStatus(get('lit-comprehension'), { practice }, 'Class 1'), 'beginning');
  // Hearing words is a start on decoding; only reading aloud can reach "achieved".
  assert.equal(competencyStatus(get('lit-decoding'), { practice }, 'Class 1'), 'developing');
  assert.equal(competencyStatus(get('lit-decoding'), {}, 'Class 1'), 'not_started');
  // Phonics applies to Class 1-3 even where no phonics lab is available.
  assert.ok(competenciesFor('Class 3').some((c) => c.id === 'lit-phonics'));
});
