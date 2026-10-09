import test from 'node:test';
import assert from 'node:assert/strict';
import { autoReadingLevel, effectiveReadingLevel, orfTargetWpm, readerSettingsFor } from './readingLevels';

test('no level before two readings', () => {
  assert.equal(autoReadingLevel({ sessionsCount: 1, overallAccuracy: 20, averageWPM: 5 }, 'Class 3'), null);
  assert.equal(effectiveReadingLevel({ sessionsCount: 0 }, 'Class 3'), 'developing');
});

test('accuracy and speed against the class ORF goal', () => {
  assert.equal(orfTargetWpm('Class 3'), 60);
  // Low accuracy, or under 40% of the goal speed: beginner.
  assert.equal(autoReadingLevel({ sessionsCount: 4, overallAccuracy: 42, averageWPM: 50 }, 'Class 3'), 'beginner');
  assert.equal(autoReadingLevel({ sessionsCount: 4, overallAccuracy: 80, averageWPM: 20 }, 'Class 3'), 'beginner');
  // Accurate and near the goal: proficient.
  assert.equal(autoReadingLevel({ sessionsCount: 4, overallAccuracy: 90, averageWPM: 55 }, 'Class 3'), 'proficient');
  // Accurate but slow for Class 5, fine for Class 2.
  assert.equal(autoReadingLevel({ sessionsCount: 4, overallAccuracy: 90, averageWPM: 40 }, 'Class 5'), 'developing');
  assert.equal(autoReadingLevel({ sessionsCount: 4, overallAccuracy: 90, averageWPM: 40 }, 'Class 2'), 'proficient');
  // Speed unknown (0) does not make anyone a beginner.
  assert.equal(autoReadingLevel({ sessionsCount: 3, overallAccuracy: 70, averageWPM: 0 }, 'Class 4'), 'developing');
});

test("the teacher's choice wins", () => {
  const strong = { sessionsCount: 5, overallAccuracy: 95, averageWPM: 90 };
  assert.equal(effectiveReadingLevel({ ...strong, readingLevel: 'beginner' }, 'Class 4'), 'beginner');
  assert.equal(effectiveReadingLevel({ ...strong, readingLevel: 'nonsense' }, 'Class 4'), 'proficient');
});

test('beginners listen first with shorter pages', () => {
  assert.deepEqual(readerSettingsFor('beginner'), { wordsScale: 0.6, listenFirst: true });
  assert.equal(readerSettingsFor('proficient').wordsScale > 1, true);
});
