import {
  PublishedReading,
  PublishedReadingImage,
  PublishedBookSummary,
  PublishedReadingSummary,
  ReadingSessionLog,
  TextbookChapterAnalysis,
  UserSession,
} from '../types';
import { firebaseAuth } from './firebase';

async function authHeaders(): Promise<Record<string, string>> {
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

export const backendApi = {
  me: () => apiFetch<{ session: UserSession }>('/api/auth/me'),

  curriculum: (grade?: string, subject?: string) => {
    const query = new URLSearchParams();
    if (grade) query.set('grade', grade);
    if (subject) query.set('subject', subject);
    return apiFetch<{ classes: unknown[]; lessons: unknown[] }>(`/api/curriculum?${query.toString()}`);
  },

  lesson: (lessonId: string) =>
    apiFetch<{ lesson: unknown; diagnostics: unknown }>('/api/lessons/' + encodeURIComponent(lessonId)),

  saveReadingSession: (session: ReadingSessionLog) =>
    apiFetch<{ success: boolean; id: string }>('/api/reading-sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),

  syncReadingSessions: (sessions: ReadingSessionLog[]) =>
    apiFetch<{ success: boolean; accepted: number; duplicates: number }>('/api/sync/reading-sessions', {
      method: 'POST',
      body: JSON.stringify({ sessions }),
    }),

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
