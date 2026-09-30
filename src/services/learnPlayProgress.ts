// Per-student Learn & Play progress, kept in this browser like the rest of
// the student's offline progress (offlineStorage). Stars earned in games are
// also added to the student's star total.
import { offlineStorage } from './offlineStorage';

export interface LabProgress {
  learned: boolean;
  bestScore: number;
  total: number;
  stars: number; // 0-3 for this chapter
  readAloud: boolean;
  updatedAt: string;
}

const key = (studentId: string) => `ps_learnplay_${studentId}`;

export function getLabProgress(studentId: string): Record<string, LabProgress> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(studentId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function save(studentId: string, all: Record<string, LabProgress>) {
  try {
    localStorage.setItem(key(studentId), JSON.stringify(all));
  } catch {
    // Storage full or blocked: progress just isn't remembered.
  }
}

const blank = (): LabProgress => ({
  learned: false,
  bestScore: 0,
  total: 0,
  stars: 0,
  readAloud: false,
  updatedAt: new Date().toISOString(),
});

export function starsForScore(score: number, total: number): number {
  if (total <= 0) return 0;
  const ratio = score / total;
  return ratio >= 0.99 ? 3 : ratio >= 0.6 ? 2 : score > 0 ? 1 : 0;
}

export function markLearned(studentId: string, chapterId: string) {
  const all = getLabProgress(studentId);
  all[chapterId] = { ...(all[chapterId] || blank()), learned: true, updatedAt: new Date().toISOString() };
  save(studentId, all);
}

export function markReadAloud(studentId: string, chapterId: string) {
  const all = getLabProgress(studentId);
  all[chapterId] = { ...(all[chapterId] || blank()), readAloud: true, updatedAt: new Date().toISOString() };
  save(studentId, all);
}

// Records a game result; returns how many NEW stars were earned (only an
// improvement on the chapter's best counts, so replaying can't farm stars).
export function recordGame(studentId: string, chapterId: string, score: number, total: number): number {
  const all = getLabProgress(studentId);
  const previous = all[chapterId] || blank();
  const stars = starsForScore(score, total);
  const gained = Math.max(0, stars - previous.stars);
  all[chapterId] = {
    ...previous,
    bestScore: Math.max(previous.bestScore, score),
    total,
    stars: Math.max(previous.stars, stars),
    updatedAt: new Date().toISOString(),
  };
  save(studentId, all);
  if (gained > 0) {
    const student = offlineStorage.getCurrentStudent();
    if (student.id === studentId) {
      offlineStorage.updateCurrentStudent({ stars: (student.stars || 0) + gained * 5 });
    }
  }
  return gained;
}
