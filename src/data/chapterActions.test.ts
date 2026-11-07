import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterPlan } from './chapterActions';

test('maths chapters: a test instead of read-aloud, with Q&A, no reading check or phonics practice', () => {
  for (const subject of ['Maths', 'Mathematics', 'గణితం', 'गणित']) {
    const p = chapterPlan({ subject });
    assert.equal(p.primary, 'test', subject);
    assert.deepEqual(p.actions, ['watch', 'qa', 'workbook']);
  }
});

test('other subjects are read aloud, with practice and the reading check', () => {
  for (const subject of ['English', 'Telugu', 'Hindi', 'Science', 'Social', undefined]) {
    const p = chapterPlan({ subject });
    assert.equal(p.primary, 'read', String(subject));
    assert.deepEqual(p.actions, ['watch', 'practice', 'fln', 'workbook']);
  }
});
