// Where a child stopped, for every story/textbook chapter (reader page and
// the scores of the pages already read) and every Learn & Play chapter (step
// and card). Kept on this device for each child and sent to the server
// (activity type "position", students/{id}.positions) so it survives a
// reload, works offline and follows the child to another device.
import { progressSync } from './progressSync';

export interface ResumePoint {
  /** Reader page index, or Learn & Play card index. */
  page: number;
  /** Pages (or cards) in the story/chapter when saved; a changed story starts again. */
  total: number;
  at: string;
  /** Learn & Play step: learn | play | read. */
  step?: string;
  /** Reader only, this device: per-page accuracy, correct words and pages that earned a star. */
  scores?: Record<number, number>;
  correct?: Record<number, number>;
  awarded?: number[];
  stars?: number;
}

export interface ServerPosition {
  page: number;
  total: number;
  at: string;
  step?: string;
}

const storeKey = (studentId: string) => `ps_resume_${studentId}`;

function readAll(studentId: string): Record<string, ResumePoint> {
  try {
    const data = JSON.parse(localStorage.getItem(storeKey(studentId)) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeAll(studentId: string, all: Record<string, ResumePoint>) {
  try {
    // Keep the 200 most recent places.
    const entries = Object.entries(all).sort((a, b) => (b[1].at || '').localeCompare(a[1].at || '')).slice(0, 200);
    localStorage.setItem(storeKey(studentId), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Storage full or blocked: the child simply starts at the beginning.
  }
}

/** Firestore field-safe key: story_<id> or lab_<id>. */
export const resumeKey = (kind: 'story' | 'lab', id: string) => `${kind}_${String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}`;

const syncTimers = new Map<string, number>();

export const resumePoints = {
  get(studentId: string | null | undefined, key: string): ResumePoint | null {
    if (!studentId || studentId === 'guest') return null;
    return readAll(studentId)[key] || null;
  },

  /** Save on this device now; tell the server a moment later (only the latest place is sent). */
  save(studentId: string | null | undefined, key: string, point: Omit<ResumePoint, 'at'>) {
    if (!studentId || studentId === 'guest') return;
    const all = readAll(studentId);
    const at = new Date().toISOString();
    all[key] = { ...point, at };
    writeAll(studentId, all);
    const timerKey = `${studentId}|${key}`;
    const old = syncTimers.get(timerKey);
    if (old) window.clearTimeout(old);
    syncTimers.set(
      timerKey,
      window.setTimeout(() => {
        syncTimers.delete(timerKey);
        progressSync.record({ type: 'position', key, page: point.page, total: point.total, ...(point.step ? { step: point.step } : {}) });
      }, 1500)
    );
  },

  /** The story or chapter is finished: forget the place here and on the server. */
  clear(studentId: string | null | undefined, key: string) {
    if (!studentId || studentId === 'guest') return;
    const all = readAll(studentId);
    if (!all[key]) return;
    delete all[key];
    writeAll(studentId, all);
    const timerKey = `${studentId}|${key}`;
    const old = syncTimers.get(timerKey);
    if (old) window.clearTimeout(old);
    progressSync.record({ type: 'position', key, page: 0, total: 0, done: true });
  },

  /** Places saved on another device (from the server record) fill in or replace older ones here. */
  mergeServer(studentId: string, positions: Record<string, ServerPosition> | undefined) {
    if (!positions) return;
    const all = readAll(studentId);
    let changed = false;
    for (const [key, p] of Object.entries(positions)) {
      const mine = all[key];
      if (!p || typeof p.page !== 'number') continue;
      if (!mine || (p.at || '') > (mine.at || '')) {
        // Scores from the other device are not known here; keep ours if the page is the same.
        all[key] = { ...(mine && mine.page === p.page ? mine : {}), page: p.page, total: p.total, step: p.step, at: p.at };
        changed = true;
      }
    }
    if (changed) writeAll(studentId, all);
  },
};
