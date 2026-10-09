import {
  PublishedReading,
  PublishedReadingImage,
  PublishedBookSummary,
  PublishedReadingSummary,
  TextbookChapterAnalysis,
  UnitWorkbook,
  UserSession,
} from '../types';
import { firebaseAuth } from './firebase';
import type { ReadingLevel } from '../data/readingLevels';
import type { Competency, CompetencyStatus } from '../data/competencies';

export async function authHeaders(): Promise<Record<string, string>> {
  // Right after a page load Firebase is still restoring the signed-in user;
  // without waiting, the first requests go out with no token (401).
  await firebaseAuth?.authStateReady?.().catch(() => undefined);
  const user = firebaseAuth?.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const auth = await authHeaders();
  Object.entries(auth).forEach(([key, value]) => headers.set(key, value));

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data as T;
}

export interface ClassStudentRow {
  id: string;
  name: string;
  grade: string;
  rollNumber: string;
  avatar: string;
  stars: number;
  streakDays: number;
  lastActiveDate: string;
  totalMinutesRead: number;
  overallAccuracy: number;
  averageWPM: number;
  sessionsCount: number;
  wordsPracticed: number;
  gamesCompleted: number;
  labProgress: Record<string, { stars: number; bestScore: number; total: number; plays: number; subject?: string }>;
  struggledWords: { word: string; count: number }[];
  /** Level the reader uses, and the teacher's choice (null = automatic). */
  readingLevel?: ReadingLevel;
  readingLevelSet?: ReadingLevel | null;
}

export type SupportStatus = 'need_help' | 'go_ahead' | 'very_good';

export interface WorkAssignment {
  kind: 'reading' | 'workbook' | 'lab' | 'dictionary';
  id: string;
  title: string;
}

export interface UnitResponseSummary {
  readingId: string;
  chapterTitle?: string;
  subject?: string;
  step?: string;
  blanksCorrect?: number;
  blanksTotal?: number;
  questionsKnown?: number;
  questionsTotal?: number;
  outcomes?: number[];
  reflection?: { feeling?: string; note?: string };
  needHelp?: boolean;
  helpQuestion?: string;
  resolved?: boolean;
  teacherReply?: { text: string; at: string; by?: string } | null;
  activityDone?: boolean;
  done?: boolean;
  updatedAt?: string;
}

export interface SupportStudent {
  id: string;
  name: string;
  avatar: string;
  rollNumber: string;
  readingLevel: ReadingLevel;
  overallAccuracy: number;
  averageWPM: number;
  sessionsCount: number;
  lastActiveDate: string;
  stars: number;
  struggledWords: string[];
  status: SupportStatus;
  reasons: string[];
  questions: { readingId: string; chapterTitle: string; question: string; at: string }[];
  latestUnit: UnitResponseSummary | null;
  units: UnitResponseSummary[];
  messages: { id: string; text: string; assign: WorkAssignment | null; createdAt: string; seenAt: string | null; teacherName?: string }[];
}

export interface ClassCompetencies {
  grade: string;
  competencies: (Competency & { labs: string[]; idea: string })[];
  students: {
    id: string;
    name: string;
    avatar: string;
    rollNumber: string;
    readingLevel: ReadingLevel;
    labProgress: Record<string, { stars?: number }>;
    status: Record<string, CompetencyStatus>;
  }[];
  summary: Record<string, Record<CompetencyStatus, number>>;
}

export type TodayGoalId = 'read' | 'workbook' | 'words' | 'play';
export interface TodayClass {
  grade: string;
  day: string;
  counts: { children: number; activeToday: number; openQuestions: number; childrenWithQuestions: number; pendingWork: number; awayThreeDays: number };
  goals: { id: TodayGoalId; icon: string; name: string; done: number; total: number }[];
  children: {
    id: string;
    name: string;
    avatar: string;
    rollNumber: string;
    readingLevel: ReadingLevel;
    done: Record<TodayGoalId, boolean>;
    doneCount: number;
    openQuestions: number;
    pendingWork: number;
    daysAway: number | null;
  }[];
  nextChapters: { readingId: string; bookTitle: string; chapterTitle: string; subject: string; readBy: number }[];
  groups: { level: ReadingLevel; studentIds: string[]; plan: string; work: WorkAssignment | null }[];
  focus: { id: string; icon: string; short: string; idea: string; practice: WorkAssignment | null; notAchieved: number; beginning: number }[];
}

export interface ClassReport {
  grade: string;
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  reading: { sessions: number; readers: number; minutes: number; accuracy: number | null; prevAccuracy: number | null; wpm: number | null; chapters: { title: string; times: number }[] };
  activeChildren: number;
  totalChildren: number;
  perDay: { day: string; readings: number; active: number }[];
  workbooks: { worked: number; finished: number; helpAsked: number; helpAnswered: number };
  work: { messages: number; given: number; done: number; seen: number };
  followUps: { studentId: string; name: string; given: number; done: number; accuracyBefore: number | null; accuracyAfter: number | null; improved: boolean | null }[];
  attention: { studentId: string; name: string; reasons: string[] }[];
  competencies: { short: string; icon: string; achieved: number; total: number }[];
  priorities: string[];
}

export interface SupportBoard {
  grade: string;
  groups: Record<SupportStatus, SupportStudent[]>;
}

export interface TeacherMessage {
  id: string;
  text: string;
  assign: WorkAssignment | null;
  teacherName: string;
  chapterTitle: string | null;
  createdAt: string;
  seenAt: string | null;
  doneAt: string | null;
}

export interface ClassOverview {
  grade: string;
  totals: {
    students: number;
    activeThisWeek: number;
    sessions: number;
    minutes: number;
    averageAccuracy: number | null;
    averageWPM: number | null;
    stars: number;
    gamesCompleted: number;
    wordsPracticed: number;
  };
  daily: { day: string; sessions: number; readers: number; accuracy: number | null }[];
  subjects: { subject: string; sessions: number; accuracy: number }[];
  bands: { band: string; students: number }[];
  levels?: { level: ReadingLevel; students: number }[];
  struggledWords: { word: string; count: number }[];
  students: ClassStudentRow[];
  insights: { tone: 'cheer' | 'think' | 'happy'; text: string }[];
}

export interface ClassStudentDetail {
  student: ClassStudentRow;
  sessions: {
    date: string;
    storyTitle: string;
    subject: string;
    language: string;
    accuracyRate: number;
    wpm: number;
    durationSeconds: number;
    starsEarned: number;
    struggledWords: string[];
  }[];
  words: { word: string; language: string; accuracy: number; date: string }[];
  accuracyTrend: { date: string; accuracy: number }[];
  averageAccuracy: number;
}

export interface ClassPlan {
  summary: string;
  actions: { title: string; detail: string; students: string[] }[];
  wordsToPractise: string[];
  generatedAt: string;
}

export interface RosterStudent {
  id: string;
  name: string;
  grade?: string;
  rollNumber: string;
  avatar: string;
  active: boolean;
  lastActiveDate: string;
  sessionsCount: number;
}

export interface SchoolTeacher {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  designation: string;
  grades: string[];
  active: boolean;
  lastSignInAt: string | null;
  books?: number;
  chapters?: number;
  lastPublishedAt?: string | null;
}

export interface SchoolOverview {
  school: { id: string; name: string; code: string; district: string; state: string; board: string; headmasterName: string };
  totals: {
    students: number;
    activeThisWeek: number;
    readings14d: number;
    readingsTotal: number;
    averageAccuracy: number | null;
    minutes: number;
    stars: number;
    books: number;
    chapters: number;
    teachers: number;
  };
  daily: { day: string; sessions: number; readers: number }[];
  classes: {
    grade: string;
    students: number;
    activeThisWeek: number;
    readings14d: number;
    averageAccuracy: number | null;
    needHelp: number;
    books: number;
    chapters: number;
    teachers: string[];
  }[];
  teachers: SchoolTeacher[];
  insights: { tone: 'cheer' | 'think' | 'happy'; text: string }[];
}

export interface OxfordEntry {
  word: string;
  partOfSpeech: string;
  definition: string;
  example?: string;
  phonetic?: string;
  source: 'oxford';
}

export interface TutorReply {
  answer: string;
  followUps: string[];
}

export const backendApi = {
  dictionary: {
    lookup: (words: string[]) =>
      apiFetch<{ oxford: boolean; entries: Record<string, OxfordEntry | null> }>('/api/dictionary/lookup', {
        method: 'POST',
        body: JSON.stringify({ words }),
      }),
  },
  tutor: {
    ask: (payload: { question: string; context?: { kind: string; title?: string; text?: string; word?: string; language?: string } }) =>
      apiFetch<TutorReply>('/api/tutor/ask', { method: 'POST', body: JSON.stringify(payload) }),
  },
  classDashboard: {
    overview: (grade: string) => apiFetch<ClassOverview>(`/api/class/${encodeURIComponent(grade)}/overview`),
    student: (grade: string, id: string) =>
      apiFetch<ClassStudentDetail>(`/api/class/${encodeURIComponent(grade)}/students/${encodeURIComponent(id)}`),
  },

  // The teacher's support loop: Need Help / Go Ahead / Very Good, answers and work.
  support: {
    board: (grade: string) => apiFetch<SupportBoard>(`/api/class/${encodeURIComponent(grade)}/support`),
    reply: (grade: string, studentId: string, body: { text: string; readingId?: string; chapterTitle?: string; assign?: WorkAssignment | null }) =>
      apiFetch<{ ok: boolean }>(`/api/class/${encodeURIComponent(grade)}/support/${encodeURIComponent(studentId)}/reply`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    report: (grade: string, period: 'day' | 'week' | 'month', day: string) =>
      apiFetch<ClassReport>(`/api/class/${encodeURIComponent(grade)}/report?period=${period}&day=${encodeURIComponent(day)}`),
    competencies: (grade: string) => apiFetch<ClassCompetencies>(`/api/class/${encodeURIComponent(grade)}/competencies`),
    assign: (grade: string, body: { studentIds: string[]; text: string; assign: WorkAssignment | null }) =>
      apiFetch<{ ok: boolean; sent: number }>(`/api/class/${encodeURIComponent(grade)}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  },

  // Plan the Day for one or more classes (multi-grade), on the teacher's own day.
  teacherToday: (grades: string[], day: string) =>
    apiFetch<{ day: string; classes: TodayClass[] }>(
      `/api/teacher/today?grades=${encodeURIComponent(grades.join(','))}&day=${encodeURIComponent(day)}`
    ),

  classSettings: {
    get: (grade: string) => apiFetch<{ unlockInOrder: boolean }>(`/api/class/${encodeURIComponent(grade)}/settings`),
    set: (grade: string, change: { unlockInOrder: boolean }) =>
      apiFetch<{ unlockInOrder: boolean }>(`/api/class/${encodeURIComponent(grade)}/settings`, { method: 'PATCH', body: JSON.stringify(change) }),
    mine: () => apiFetch<{ unlockInOrder: boolean }>('/api/student/class-settings'),
  },

  studentMessages: {
    list: () => apiFetch<{ messages: TeacherMessage[] }>('/api/student/messages'),
    mark: (id: string, change: { seen?: boolean; done?: boolean }) =>
      apiFetch<{ ok: boolean }>(`/api/student/messages/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(change) }),
  },

  classPlan: (grade: string, refresh = false) =>
    apiFetch<ClassPlan>(`/api/class/${encodeURIComponent(grade)}/plan`, { method: 'POST', body: JSON.stringify({ refresh }) }),
  school: {
    overview: () => apiFetch<SchoolOverview>('/api/school/overview'),
    myClasses: () => apiFetch<{ grades: string[] }>('/api/school/my-classes'),
    roster: (grade: string) =>
      apiFetch<{ grade: string; students: RosterStudent[]; nextRoll: string }>(`/api/school/students?grade=${encodeURIComponent(grade)}`),
    addStudent: (input: { grade: string; name: string; rollNumber: string; avatar: string }) =>
      apiFetch<{ student: RosterStudent }>('/api/school/students', { method: 'POST', body: JSON.stringify(input) }),
    updateStudent: (
      id: string,
      changes: Partial<{ name: string; grade: string; rollNumber: string; avatar: string; active: boolean; readingLevel: ReadingLevel | 'auto' }>
    ) =>
      apiFetch<{ student: RosterStudent }>(`/api/school/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    addTeacher: (input: { name: string; email: string; grades: string[]; designation?: string }) =>
      apiFetch<{ teacher: SchoolTeacher; temporaryPassword: string }>('/api/school/teachers', { method: 'POST', body: JSON.stringify(input) }),
    updateTeacher: (uid: string, changes: Partial<{ grades: string[]; active: boolean; resetPassword: boolean }>) =>
      apiFetch<{ teacher: SchoolTeacher | null; temporaryPassword: string | null }>(`/api/school/teachers/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      }),
  },

  me: () => apiFetch<{ session: UserSession }>('/api/auth/me'),

  curriculum: (grade?: string, subject?: string) => {
    const query = new URLSearchParams();
    if (grade) query.set('grade', grade);
    if (subject) query.set('subject', subject);
    return apiFetch<{ classes: unknown[]; lessons: unknown[] }>(`/api/curriculum?${query.toString()}`);
  },

  lesson: (lessonId: string) =>
    apiFetch<{ lesson: unknown; diagnostics: unknown }>('/api/lessons/' + encodeURIComponent(lessonId)),

  readings: {
    // Real OCR'd textbook chapters a teacher has published — see
    // PublishedReading. Distinct from the AI-generated Story[] the app also
    // keeps in localStorage.
    list: (grade?: string, subject?: string) => {
      const query = new URLSearchParams();
      if (grade) query.set('grade', grade);
      if (subject) query.set('subject', subject);
      return apiFetch<{ success: boolean; readings: PublishedReadingSummary[] }>(
        `/api/readings?${query.toString()}`
      );
    },

    get: (id: string) =>
      apiFetch<{ success: boolean; reading: PublishedReading }>(
        '/api/readings/' + encodeURIComponent(id)
      ),

    images: (id: string) =>
      apiFetch<{ success: boolean; images: PublishedReadingImage[] }>(
        '/api/readings/' + encodeURIComponent(id) + '/images'
      ),

    // The chapter's unit workbook (blanks, questions, outcomes, reflection, activity).
    workbook: (id: string) =>
      apiFetch<{ success: boolean; workbook: UnitWorkbook }>(
        '/api/readings/' + encodeURIComponent(id) + '/workbook'
      ),

    // Publishes every chapter of an analysed book in reading order; each
    // chapter carries its own subject.
    publishBook: (
      chapters: Array<TextbookChapterAnalysis & { subject: string }>,
      grade: string,
      language: string,
      bookTitle: string
    ) =>
      apiFetch<{
        success: boolean;
        bookId: string;
        published: number;
        withoutQuiz?: number;
        total: number;
        results: Array<{ id?: string; quizGenerated?: boolean; error?: string }>;
      }>('/api/readings/publish-book', {
        method: 'POST',
        body: JSON.stringify({ grade, language, bookTitle, chapters }),
      }),

    myBooks: () =>
      apiFetch<{ success: boolean; books: PublishedBookSummary[] }>('/api/readings/books/mine'),

    moveBook: (key: string, grade: string) =>
      apiFetch<{ success: boolean; updated: number; grade: string }>(
        '/api/readings/books/' + encodeURIComponent(key),
        { method: 'PATCH', body: JSON.stringify({ grade }) }
      ),

    fillQuizzes: (key: string, mode: 'stale' | 'missing' = 'stale') =>
      apiFetch<{ success: boolean; missing: number; filled: number; stillMissing: number; error?: string }>(
        '/api/readings/books/' + encodeURIComponent(key) + '/fill-quizzes',
        { method: 'POST', body: JSON.stringify({ mode }) }
      ),

    cleanBook: (key: string) =>
      apiFetch<{ success: boolean; before: number; after: number; removed: number; reanalysed: number; parts: string[] }>(
        '/api/readings/books/' + encodeURIComponent(key) + '/clean',
        { method: 'POST' }
      ),

    deleteBook: (key: string) =>
      apiFetch<{ success: boolean; deleted: number }>('/api/readings/books/' + encodeURIComponent(key), {
        method: 'DELETE',
      }),

    removeBook: (bookId: string) =>
      apiFetch<{ success: boolean; deleted: number }>('/api/readings/book/' + encodeURIComponent(bookId), {
        method: 'DELETE',
      }),

    publish: (chapter: TextbookChapterAnalysis, grade: string, subject: string, language: string, bookTitle: string) =>
      apiFetch<{ success: boolean; id: string; quizGenerated: boolean }>('/api/readings/publish', {
        method: 'POST',
        body: JSON.stringify({
          grade,
          subject,
          language,
          bookTitle,
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.chapterTitle,
          paragraphs: chapter.paragraphs,
          images: chapter.images,
          tables: chapter.tables,
          primaryTopic: chapter.primaryTopic,
          summary: chapter.summary,
          importantConcepts: chapter.importantConcepts,
          keyVocabulary: chapter.keyVocabulary,
          learningObjectives: chapter.learningObjectives,
          keyPoints: chapter.keyPoints,
          themes: chapter.themes,
          moralOrMessage: chapter.moralOrMessage,
          difficulty: chapter.difficulty,
          discussionQuestions: chapter.discussionQuestions,
          kind: chapter.kind,
          estimatedReadingMinutes: chapter.estimatedReadingMinutes,
        }),
      }),

    remove: (id: string) =>
      apiFetch<{ success: boolean }>('/api/readings/' + encodeURIComponent(id), {
        method: 'DELETE',
      }),
  },
};
