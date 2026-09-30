// Sends a signed-in student's activity (readings, games, word practice) to
// the server (POST /api/student/activity) and folds the server's record back
// into this browser. The server record is the source of truth that teachers
// see on the class dashboard; this browser keeps a queue so nothing is lost
// offline or when a request fails, and replays it later (the server ignores
// a reading it has already stored).
import { firebaseAuth } from './firebase';
import { offlineStorage } from './offlineStorage';
import { getLabProgress, LabProgress } from './learnPlayProgress';

export type StudentActivity =
  | {
      type: 'reading';
      id: string;
      storyId: string;
      storyTitle: string;
      subject?: string;
      language: string;
      accuracyRate: number;
      wpm: number;
      durationSeconds: number;
      wordsRead: number;
      totalWords: number;
      starsEarned: number;
      struggledWords: string[];
      day?: string;
    }
  | { type: 'game'; chapterId: string; subject?: string; score: number; total: number; stars: number; day?: string }
  | { type: 'word'; word: string; language: string; accuracy: number; day?: string };

export interface ServerStudent {
  id: string;
  name: string;
  grade: string;
  rollNumber: string;
  avatar: string;
  stars: number;
  streakDays: number;
  lastActiveDate: string;
  completedStoryIds: string[];
  totalMinutesRead: number;
  overallAccuracy: number;
  averageWPM: number;
  sessionsCount: number;
  labProgress: Record<string, { stars: number; bestScore: number; total: number; plays: number }>;
  wordsPracticed: number;
  dailyActivity: Record<string, string[]>;
}

const QUEUE_KEY = 'ps_activity_queue_v1';
export const STUDENT_UPDATED_EVENT = 'pathana:student-updated';

export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Queued = { studentId: string; activity: StudentActivity; tries: number };

function readQueue(): Queued[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}
function writeQueue(q: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-300)));
  } catch {
    // Storage full: the newest activity is still applied locally.
  }
}

// The Firebase user of a class + roll number login is `student_<id>`.
function signedInStudentId(): string | null {
  const uid = firebaseAuth?.currentUser?.uid || '';
  return uid.startsWith('student_') ? uid.slice('student_'.length) : null;
}

async function authorizedFetch(url: string, init: RequestInit = {}) {
  await firebaseAuth?.authStateReady?.().catch(() => undefined);
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('not signed in');
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

/** Fold the server's record into the local student (server wins on totals). */
export function applyServerStudent(server: ServerStudent) {
  const local = offlineStorage.getCurrentStudent();
  if (local.id !== server.id) return;
  const today = localDay();
  const todays = (server.dailyActivity?.[today] || []).filter((a) => !a.startsWith('word_'));
  offlineStorage.updateCurrentStudent({
    stars: server.stars,
    streakDays: server.streakDays,
    lastActiveDate: server.lastActiveDate,
    completedStoryIds: Array.from(new Set([...(local.completedStoryIds || []), ...(server.completedStoryIds || [])])),
    totalMinutesRead: server.totalMinutesRead,
    overallAccuracy: server.overallAccuracy,
    averageWPM: server.averageWPM,
    ...(todays.length > (local.dailyCertificateDate === today ? local.dailyCertificatesEarned || 0 : 0)
      ? { dailyCertificateDate: today, dailyCertificatesEarned: todays.length }
      : {}),
  });
  // Learn & Play stars earned on another device.
  try {
    const key = `ps_learnplay_${server.id}`;
    const lab: Record<string, LabProgress> = getLabProgress(server.id);
    let changed = false;
    for (const [chapterId, p] of Object.entries(server.labProgress || {})) {
      const mine = lab[chapterId];
      if (!mine || (p.stars || 0) > (mine.stars || 0)) {
        lab[chapterId] = {
          learned: true,
          readAloud: mine?.readAloud || false,
          bestScore: Math.max(mine?.bestScore || 0, p.bestScore || 0),
          total: p.total || mine?.total || 0,
          stars: Math.max(mine?.stars || 0, p.stars || 0),
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
    }
    if (changed) localStorage.setItem(key, JSON.stringify(lab));
  } catch {
    // Local progress stays as it was.
  }
  window.dispatchEvent(new CustomEvent(STUDENT_UPDATED_EVENT));
}

let flushing: Promise<void> | null = null;

export const progressSync = {
  /** Queue an activity for the signed-in student and try to send it now. */
  record(activity: StudentActivity) {
    const studentId = signedInStudentId() || offlineStorage.getCurrentStudentId();
    if (!studentId || studentId === 'guest') return;
    writeQueue([...readQueue(), { studentId, activity: { ...activity, day: activity.day || localDay() }, tries: 0 }]);
    void this.flush();
  },

  flush(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      const me = signedInStudentId();
      if (!me || typeof navigator !== 'undefined' && navigator.onLine === false) return;
      let queue = readQueue();
      let latest: ServerStudent | null = null;
      for (const item of [...queue]) {
        if (item.studentId !== me) continue; // another child's, sent when they sign in
        try {
          const res = await authorizedFetch('/api/student/activity', { method: 'POST', body: JSON.stringify(item.activity) });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.student) latest = data.student;
            queue = queue.filter((q) => q !== item);
          } else if (res.status === 429 || res.status >= 500) {
            item.tries += 1;
            break; // try again later
          } else {
            queue = queue.filter((q) => q !== item); // rejected as invalid: don't retry forever
          }
        } catch {
          break; // offline
        }
        writeQueue(queue);
      }
      writeQueue(queue.filter((q) => q.tries < 20));
      if (latest) applyServerStudent(latest);
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  },

  /** Send anything queued, then load the student's record from the server. */
  async refresh(): Promise<ServerStudent | null> {
    if (!signedInStudentId()) return null;
    await this.flush();
    try {
      const res = await authorizedFetch('/api/student/me');
      if (!res.ok) return null;
      const data = await res.json();
      if (data.student) applyServerStudent(data.student);
      return data.student || null;
    } catch {
      return null;
    }
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void progressSync.flush());
}
