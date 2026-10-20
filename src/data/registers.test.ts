import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  absentStreak,
  academicYear,
  cleanEntry,
  levelChange,
  levelCounts,
  monthRegister,
  periodPlan,
  suggestEntry,
  suggestPresent,
} from './registers';

const kids = [
  { id: 'a', name: 'Arjun', rollNumber: '2' },
  { id: 'b', name: 'Bhavya', rollNumber: '1' },
  { id: 'c', name: 'Charan', rollNumber: '3' },
];

describe('attendance', () => {
  test('suggests the children who used the app that day', () => {
    assert.deepEqual(
      suggestPresent([{ id: 'a', dailyActivity: { '2026-10-19': ['read_x'] } }, { id: 'b', dailyActivity: { '2026-10-18': ['read_y'] } }, { id: 'c' }], '2026-10-19'),
      ['a']
    );
  });

  test('month register: rows by roll number, P/A per day, totals and percent', () => {
    const reg = monthRegister('2026-10', kids, { '2026-10-01': ['a', 'b'], '2026-10-02': ['b'], '2026-09-30': ['a'] });
    assert.deepEqual(reg.days, ['2026-10-01', '2026-10-02']);
    assert.deepEqual(reg.rows.map((r) => r.child.id), ['b', 'a', 'c']);
    assert.deepEqual(reg.rows[1].marks, ['P', 'A']);
    assert.equal(reg.rows[0].percent, 100);
    assert.equal(reg.rows[2].percent, 0);
    assert.deepEqual(reg.totals, [
      { day: '2026-10-01', present: 2, absent: 1 },
      { day: '2026-10-02', present: 1, absent: 2 },
    ]);
    assert.equal(monthRegister('2026-11', kids, {}).rows[0].percent, null);
  });

  test('children away on each of the last three days', () => {
    const records = { '2026-10-01': ['a'], '2026-10-02': ['b'], '2026-10-03': ['b'], '2026-10-04': ['b'] };
    assert.deepEqual(absentStreak(records, kids).map((c) => c.id), ['a', 'c']);
    assert.deepEqual(absentStreak({ '2026-10-01': [] }, kids), []);
  });
});

describe('FLN assessment rounds', () => {
  test('entries from the browser are cleaned', () => {
    assert.deepEqual(cleanEntry({ reading: 'word', maths: 'nonsense', wcpm: '31.6', comprehension: 9, note: '  ok  ', extra: 1 }), {
      reading: 'word',
      wcpm: 32,
      comprehension: 3,
      note: 'ok',
    });
    assert.deepEqual(cleanEntry({ wcpm: '', comprehension: null }), {});
  });

  test('suggestions come from reading aloud, practice, quizzes and numeracy', () => {
    const fluent = suggestEntry({ sessionsCount: 4, overallAccuracy: 90, averageWPM: 70, quizCorrect: 5, quizTotal: 6, numeracy: { operations: 'achieved' } }, 'Class 3');
    assert.equal(fluent.reading, 'story');
    assert.equal(fluent.wcpm, 63);
    assert.equal(fluent.comprehension, 3);
    assert.equal(fluent.maths, 'addsub');
    assert.equal(suggestEntry({ sessionsCount: 2, overallAccuracy: 45, averageWPM: 20 }, 'Class 2').reading, 'word');
    // No reading aloud yet: practice tells letters from beginners.
    assert.equal(suggestEntry({ practice: { first_sound: { right: 3, total: 4 } } }, 'Class 1').reading, 'letter');
    assert.equal(suggestEntry({ practice: { first_sound: { right: 0, total: 4 } } }, 'Class 1').reading, 'beginner');
    assert.deepEqual(suggestEntry({}, 'Class 1'), {});
  });

  test('level counts and movement between rounds', () => {
    const counts = levelCounts({ a: { reading: 'word', maths: 'num1_9' }, b: { reading: 'word' }, c: { absent: true, reading: 'story' } });
    assert.equal(counts.reading.word, 2);
    assert.equal(counts.reading.story, 0);
    assert.equal(counts.maths.num1_9, 1);
    assert.equal(counts.assessed, 2);
    assert.equal(levelChange({ reading: 'letter' }, { reading: 'paragraph' }), 2);
    assert.equal(levelChange({}, { reading: 'word' }), null);
  });

  test('academic year runs June to May', () => {
    assert.equal(academicYear('2026-10-19'), '2026-27');
    assert.equal(academicYear('2027-03-05'), '2026-27');
    assert.equal(academicYear('2027-06-01'), '2027-28');
  });
});

describe('period plans', () => {
  const src = {
    chapterTitle: 'The Thirsty Crow',
    subject: 'English',
    paragraphs: ['The crow was thirsty. It saw a pot. It dropped stones. The water came up.'],
    keyVocabulary: [{ word: 'thirsty' }, { word: 'pot' }],
    questions: ['Why was the crow happy?'],
  };

  test('English follows the SCERT period steps, filled with the chapter', () => {
    const plan = periodPlan(src);
    assert.equal(plan.source, 'scert');
    assert.deepEqual(plan.steps.map((s) => s.step), ['Face-sheet activities', 'Listening text and activities', 'Reading the text', 'Post-reading activities', 'Editing']);
    assert.ok(plan.steps[0].do.join(' ').includes('thirsty, pot'));
    assert.ok(plan.steps[2].do.join(' ').includes('The crow was thirsty. It saw a pot. It dropped stones.'));
    assert.ok(plan.steps[3].do.some((d) => d.includes('Why was the crow happy?')));
    assert.equal(plan.steps.reduce((n, s) => n + s.minutes, 0), 42);
  });

  test('Telugu follows its own steps; other subjects are marked as a suggestion', () => {
    const te = periodPlan({ ...src, subject: 'Telugu', language: 'Telugu' });
    assert.equal(te.source, 'scert');
    assert.equal(te.steps[0].step, 'Oral language development');
    assert.equal(te.steps.at(-1)!.step, 'Story time');
    const maths = periodPlan({ ...src, subject: 'Maths' });
    assert.equal(maths.source, 'suggested');
    assert.ok(maths.steps.length >= 4);
  });
});
