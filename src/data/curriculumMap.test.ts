import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  academicMonths,
  buildCurriculumMap,
  chapterStats,
  cleanPlanUpdate,
  labStats,
  matchByTitle,
  outcomeRows,
  paceOf,
  planByMonth,
  spreadOverYear,
  type MapReading,
} from './curriculumMap';
import { syllabusFor } from './telanganaSyllabus';

const readings: MapReading[] = [
  { id: 'rInt', bookKey: 'b1', bookTitle: 'Mathematics', chapterTitle: 'Chapter 6: Integers', chapterOrder: 6, subject: 'Maths', outcomes: ['I can add integers', 'I can show integers on a number line'] },
  { id: 'rExtra', bookKey: 'b1', bookTitle: 'Mathematics', chapterTitle: 'Bridge Course: Numbers', chapterOrder: 0, subject: 'Maths' },
  { id: 'rEng', bookKey: 'b2', bookTitle: 'English Reader', chapterTitle: 'The Thirsty Crow', chapterOrder: 1, subject: 'English', outcomes: ['I can retell the story'] },
];

describe('the map', () => {
  test('title matching: exact first, then one containing the other', () => {
    assert.equal(matchByTitle('Integers', readings)?.id, 'rInt');
    assert.equal(matchByTitle('Fractions and Decimals', readings), null);
    assert.equal(matchByTitle('Bridge Course', readings)?.id, 'rExtra');
  });

  test('Class 6 maths: syllabus chapters in order, the published one linked, extra publishes kept', () => {
    const map = buildCurriculumMap({
      subjects: ['English', 'Maths', 'Science'],
      syllabus: syllabusFor('Class 6', 'Maths'),
      readings,
      labs: [{ id: 'hs-integers', title: 'Integers lab', subject: 'Maths' }, { id: 'lab-shapes', title: 'Shapes', subject: 'Maths' }],
      plan: { 'reading:rExtra': { month: '2026-07' } },
      today: '2026-10-20',
    });
    assert.deepEqual(map.map((s) => s.subject), ['English', 'Maths']);
    const maths = map[1];
    const integers = maths.rows.find((r) => r.title === 'Integers')!;
    assert.equal(integers.readingId, 'rInt');
    assert.equal(integers.labId, 'hs-integers');
    assert.equal(maths.rows[0].title, 'Knowing Our Numbers');
    assert.ok(maths.rows.some((r) => r.key === 'reading:rExtra' && r.pace === 'late'));
    // the lab already in the syllabus is not listed again; the other one is
    assert.equal(maths.rows.filter((r) => r.labId === 'hs-integers').length, 1);
    assert.ok(maths.rows.some((r) => r.key === 'lab:lab-shapes' && r.group === 'Learn & Play'));
    assert.equal(maths.late, 1);
    assert.equal(maths.unplanned, maths.total - 1);
    assert.ok(maths.rows.every((r) => /^[A-Za-z0-9:_-]+$/.test(r.key)));
    assert.equal(new Set(maths.rows.map((r) => r.key)).size, maths.rows.length);
  });

  test('pace from the plan and today', () => {
    assert.equal(paceOf({ taughtOn: '2026-09-01', month: '2026-12' }, '2026-10-20'), 'taught');
    assert.equal(paceOf({ month: '2026-09' }, '2026-10-20'), 'late');
    assert.equal(paceOf({ month: '2026-10' }, '2026-10-20'), 'now');
    assert.equal(paceOf({ month: '2027-01' }, '2026-10-20'), 'later');
    assert.equal(paceOf({}, '2026-10-20'), 'unplanned');
  });
});

describe('the year', () => {
  test('teaching months run June to April', () => {
    const m = academicMonths('2026-27');
    assert.equal(m.length, 11);
    assert.equal(m[0], '2026-06');
    assert.equal(m[6], '2026-12');
    assert.equal(m.at(-1), '2027-04');
  });

  test('chapters are spread over the months left, in order', () => {
    const plan = spreadOverYear(['a', 'b', 'c', 'd', 'e', 'f', 'g'], '2026-10-20');
    assert.equal(plan.a, '2026-10');
    assert.equal(plan.g, '2027-04');
    const months = Object.values(plan);
    assert.deepEqual([...months].sort(), months);
    // after April everything goes in the last month rather than nowhere
    assert.deepEqual(spreadOverYear(['a'], '2027-05-10'), { a: '2027-04' });
  });

  test('year plan by month, with the not-yet-planned at the end', () => {
    const map = buildCurriculumMap({
      subjects: ['English'],
      syllabus: [],
      readings,
      labs: [],
      plan: { 'reading:rEng': { month: '2026-11' } },
      today: '2026-10-20',
    });
    const byMonth = planByMonth(map, '2026-27');
    assert.equal(byMonth.find((m) => m.month === '2026-11')!.rows[0].title, 'The Thirsty Crow');
    assert.equal(byMonth.at(-1)!.month, '');
  });

  test('plan updates from the browser are cleaned', () => {
    assert.deepEqual(
      cleanPlanUpdate(
        {
          'reading:rEng': { month: '2026-11', taughtOn: null },
          'syl:mathematics:0:6': { month: '2030-01', taughtOn: '2026-10-20' },
          'bad key.with.dots': { month: '2026-11' },
          'lab:x': 'nonsense',
        },
        '2026-27'
      ),
      { 'reading:rEng': { month: '2026-11', taughtOn: null }, 'syl:mathematics:0:6': { taughtOn: '2026-10-20' } }
    );
  });
});

describe('what the class did', () => {
  const children = [
    { id: 'a', completedStoryIds: ['reading_rEng'], labProgress: { 'lab-shapes': { stars: 3 } } },
    { id: 'b', completedStoryIds: ['reading_rEng', 'reading_rInt'], labProgress: { 'lab-shapes': { stars: 1 } } },
    { id: 'c' },
  ];
  const stats = chapterStats({
    readings: [{ id: 'rEng', outcomeCount: 1 }, { id: 'rInt', outcomeCount: 2 }],
    children,
    sessions: [
      { studentId: 'a', storyId: 'reading_rEng', accuracyRate: 90 },
      { studentId: 'b', storyId: 'reading_rEng', accuracyRate: 70 },
      { studentId: 'zz', storyId: 'reading_rEng', accuracyRate: 0 },
    ],
    units: [
      { studentId: 'a', readingId: 'rInt', outcomes: [2, 2], done: true },
      { studentId: 'b', readingId: 'rInt', outcomes: [0, 1] },
      { studentId: 'c', readingId: 'rInt', outcomes: [0, 0, 2] },
    ],
    practice: [{ studentId: 'a', readingId: 'rEng', right: 6, total: 8 }],
  });

  test('per chapter: who read it, accuracy, workbooks, outcomes, practice', () => {
    assert.equal(stats.rEng.readBy, 2);
    assert.equal(stats.rEng.accuracy, 80);
    assert.equal(stats.rEng.practiceShare, 0.75);
    assert.equal(stats.rInt.workbooks, 3);
    assert.equal(stats.rInt.workbooksDone, 1);
    assert.deepEqual(stats.rInt.outcomes, [
      { can: 1, partly: 0, notYet: 2 },
      { can: 1, partly: 1, notYet: 1 },
    ]);
    // ratings past the chapter's outcomes are ignored
    assert.deepEqual(stats.rInt.needHelp, ['b', 'c']);
  });

  test('outcome rows: weakest first, flagged under half "I can"', () => {
    const map = buildCurriculumMap({ subjects: ['English', 'Maths'], syllabus: [], readings, labs: [], stats, today: '2026-10-20' });
    const rows = outcomeRows(map, readings);
    assert.deepEqual(
      rows.map((r) => [r.outcome, r.rated, r.weak]),
      [
        ['I can add integers', 3, true],
        ['I can show integers on a number line', 3, true],
      ]
    );
  });

  test('lab stats: played and 2+ stars', () => {
    assert.deepEqual(labStats(children, ['lab-shapes', 'lab-none']), {
      'lab-shapes': { played: 2, mastered: 1 },
      'lab-none': { played: 0, mastered: 0 },
    });
  });
});
