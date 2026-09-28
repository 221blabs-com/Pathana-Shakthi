import {
  PublishedReading,
  PublishedReadingImage,
  PublishedReadingSummary,
  ReadingSessionLog,
  TextbookChapterAnalysis,
  UserSession,
} from '../types';
import { firebaseAuth } from './firebase';

async function authHeaders(): Promise<Record<string, string>> {
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
        }),
      }),

    remove: (id: string) =>
      apiFetch<{ success: boolean }>('/api/readings/' + encodeURIComponent(id), {
        method: 'DELETE',
      }),
  },
};
