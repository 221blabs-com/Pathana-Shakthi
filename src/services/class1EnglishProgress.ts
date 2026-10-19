// Per-child progress through "My English Book · Class 1", kept on the device
// like Learn & Play progress. Games also go through recordGame (stars only
// for improvements) and progressSync (teacher dashboards).
import { LessonStepId, UnitProgress, englishStepGameId } from '../data/class1English';
import { recordGame, starsForScore } from './learnPlayProgress';
import { offlineStorage } from './offlineStorage';
import { progressSync } from './progressSync';

const key = (studentId: string) => `ps_eng1_${studentId}`;

export function getEnglishProgress(studentId: string): Record<string, UnitProgress> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(studentId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function save(studentId: string, all: Record<string, UnitProgress>) {
  try {
    localStorage.setItem(key(studentId), JSON.stringify(all));
  } catch {
    // Storage full or blocked: progress just isn't remembered.
  }
}

/** Marks a step done; with a score, records the game. Returns new stars (0-3). */
export function completeStep(studentId: string, unitId: string, step: LessonStepId, score?: [number, number]): number {
  const all = getEnglishProgress(studentId);
  const p: UnitProgress = all[unitId] || { steps: {}, scores: {} };
  p.steps = { ...p.steps, [step]: true };
  let gained = 0;
  if (score) {
    const [got, total] = score;
    const best = p.scores[step];
    if (!best || got / Math.max(1, total) >= best[0] / Math.max(1, best[1])) p.scores = { ...p.scores, [step]: score };
    const chapterId = englishStepGameId(unitId, step);
    gained = recordGame(studentId, chapterId, got, total);
    offlineStorage.recordDailyActivity(`game_${chapterId}`);
    progressSync.record({ type: 'game', chapterId, subject: 'English', score: got, total, stars: starsForScore(got, total) });
  } else {
    // Steps without a score (picture talk, rhyme) still reach the teacher: an
    // entry with no stars marks the step done (see englishClassProgress).
    progressSync.record({ type: 'game', chapterId: englishStepGameId(unitId, step), subject: 'English', score: 1, total: 1, stars: 0 });
  }
  all[unitId] = p;
  save(studentId, all);
  return gained;
}
