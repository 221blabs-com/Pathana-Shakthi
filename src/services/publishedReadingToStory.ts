// Converts a server-persisted PublishedReading (real OCR'd textbook
// paragraphs/images/tables a teacher published) into the Story shape the
// existing ReadAlongReader/StudentLibraryPage UI already knows how to show.
// Reusing Story instead of building a second reader component means the
// reading gets grade filtering, offline caching, and the reader's whole
// mic/voice/quiz flow for free.
import {
  PublishedReading,
  PublishedReadingImage,
  PublishedReadingSummary,
  Story,
  StoryPage,
} from '../types';

// The subject tiles a student can open (StudentLibraryPage's Subject Hub).
export const HUB_SUBJECTS = ['English', 'Maths', 'Science', 'Social', 'Hindi', 'Telugu'] as const;
export type HubSubject = (typeof HUB_SUBJECTS)[number];

const SUBJECT_KEYWORDS: Array<[HubSubject, RegExp]> = [
  ['Maths', /math|arithmetic|number|గణిత|गणित/i],
  ['Science', /science|evs|environment|biology|physics|chemistry|పరిసర|विज्ञान|पर्यावरण/i],
  ['Social', /social|history|geography|civics|సాంఘిక|सामाजिक/i],
  ['Telugu', /telugu|తెలుగు/i],
  ['Hindi', /hindi|हिंदी|हिन्दी/i],
  ['English', /english/i],
];

// Maps whatever subject a reading was published with (an AI-detected label
// like "Poetry" or "Environmental Studies", or an older free-form value) to
// the Subject Hub tile it belongs under, falling back to its language so a
// "Poetry" reading in Telugu still appears under Telugu.
export function hubSubjectForReading(subject: string, language?: string): HubSubject | null {
  const exact = HUB_SUBJECTS.find((hub) => hub.toLowerCase() === String(subject || '').trim().toLowerCase());
  if (exact) return exact;
  for (const [hub, pattern] of SUBJECT_KEYWORDS) {
    if (pattern.test(subject || '')) return hub;
  }
  for (const [hub, pattern] of SUBJECT_KEYWORDS) {
    if ((hub === 'Telugu' || hub === 'Hindi' || hub === 'English') && pattern.test(language || '')) {
      return hub;
    }
  }
  return null;
}

// Words per reader page. One read-aloud attempt is capped at ~29 s (the
// speech-to-text limit), so a page must be readable in one breath at the
// grade's pace; younger children get shorter pages.
export function wordsPerPageForGrade(grade: string): number {
  if (grade === 'Class 1' || grade === 'Class 2') return 15;
  if (grade === 'Class 3') return 20;
  return 25;
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export interface ReaderPiece {
  text: string;
  paragraphIndex: number;
  sourcePage: number | null;
}

// Splits text longer than maxWords at sentence ends (or poem line breaks),
// and a single over-long sentence between words.
function splitLongParagraph(paragraph: string, maxWords: number): string[] {
  if (countWords(paragraph) <= maxWords) return [paragraph];
  const isPoem = paragraph.includes('\n');
  const sentences = paragraph
    .split(/(?<=[.!?।॥])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let chunk = '';
  const flush = () => {
    if (chunk) chunks.push(chunk);
    chunk = '';
  };
  for (const sentence of sentences) {
    if (countWords(sentence) > maxWords) {
      flush();
      const words = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
      }
      continue;
    }
    const joined = chunk ? `${chunk}${isPoem ? '\n' : ' '}${sentence}` : sentence;
    if (countWords(joined) > maxWords) {
      flush();
      chunk = sentence;
    } else {
      chunk = joined;
    }
  }
  flush();
  return chunks;
}

// One reader page per paragraph (a stanza stays a stanza, a textbook
// paragraph stays itself and paragraphs from different printed pages never
// share a reader page); a paragraph longer than one read-aloud attempt
// (maxWords) continues on the next reader page.
export function paragraphPieces(
  paragraphs: string[],
  maxWords: number,
  pages: (number | null)[] = []
): ReaderPiece[] {
  const pieces: ReaderPiece[] = [];
  paragraphs.forEach((raw, paragraphIndex) => {
    const sourcePage = typeof pages[paragraphIndex] === 'number' ? (pages[paragraphIndex] as number) : null;
    // A blank line inside an OCR block separates two paragraphs/stanzas.
    for (const paragraph of String(raw || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
      for (const text of splitLongParagraph(paragraph, maxWords)) {
        pieces.push({ text, paragraphIndex, sourcePage });
      }
    }
  });
  return pieces;
}

export function paginateParagraphs(paragraphs: string[], maxWords: number): string[] {
  return paragraphPieces(paragraphs, maxWords).map((piece) => piece.text);
}

// Which reader page an image/table from printed page `pageNumber` belongs
// on: the first reader page with text from that printed page, else the first
// one after it, else the last page. Without page numbers, by order.
export function targetPageIndex(
  pageNumber: number | null | undefined,
  sourcePages: (number | null | undefined)[],
  order: number
): number {
  const last = Math.max(0, sourcePages.length - 1);
  const known = sourcePages.some((p) => typeof p === 'number');
  if (typeof pageNumber !== 'number' || !known) return Math.min(order, last);
  const same = sourcePages.findIndex((p) => p === pageNumber);
  if (same >= 0) return same;
  const after = sourcePages.findIndex((p) => typeof p === 'number' && p > pageNumber);
  return after >= 0 ? after : last;
}

export interface BookContext {
  bookId: string;
  bookTitle: string;
  // The book's chapters in reading order (as the student sees them).
  chapters: Array<{ id: string; title: string; number: string }>;
}

export function publishedReadingToStory(
  reading: PublishedReading,
  images: PublishedReadingImage[],
  book?: BookContext
): Story {
  const pieces = paragraphPieces(
    reading.paragraphs,
    wordsPerPageForGrade(reading.grade),
    reading.paragraphPages || []
  );
  if (pieces.length === 0) {
    pieces.push({ text: reading.summary || reading.chapterTitle, paragraphIndex: 0, sourcePage: null });
  }

  const basePages: StoryPage[] = pieces.map((piece) => ({
    pageNumber: 0,
    text: piece.text,
    englishTranslation: '',
    transliteration: '',
    illustrationPrompt: reading.chapterTitle,
    sourcePage: piece.sourcePage,
  }));
  const sourcePages = basePages.map((page) => page.sourcePage);
  // Pages that could not take a picture/table because their slot was
  // already used get their own page right after, never at the very end and
  // never dropped (same "nothing goes missing" rule as the OCR pipeline).
  const extras = new Map<number, StoryPage[]>();
  const addExtra = (index: number, page: StoryPage) => {
    extras.set(index, [...(extras.get(index) || []), page]);
  };

  images.forEach((image, order) => {
    const index = targetPageIndex(image.pageNumber, sourcePages, order);
    const target = basePages[index];
    if (!target.imageBase64) {
      Object.assign(target, {
        imageBase64: image.base64,
        imageMimeType: image.mimeType,
        imageCaption: image.caption,
      });
    } else {
      addExtra(index, {
        pageNumber: 0,
        text: image.caption || reading.chapterTitle,
        englishTranslation: '',
        transliteration: '',
        illustrationPrompt: reading.chapterTitle,
        sourcePage: image.pageNumber ?? target.sourcePage,
        imageBase64: image.base64,
        imageMimeType: image.mimeType,
        imageCaption: image.caption,
      });
    }
  });

  (reading.tables || []).forEach((table, order) => {
    const index = targetPageIndex(table.pageNumber, sourcePages, order);
    const target = basePages[index];
    if (!target.tableMarkdown) {
      Object.assign(target, { tableMarkdown: table.markdown, tableCaption: table.caption });
    } else {
      addExtra(index, {
        pageNumber: 0,
        text: table.caption || `${reading.chapterTitle} — Table`,
        englishTranslation: '',
        transliteration: '',
        illustrationPrompt: reading.chapterTitle,
        sourcePage: table.pageNumber ?? target.sourcePage,
        tableMarkdown: table.markdown,
        tableCaption: table.caption,
      });
    }
  });

  const pages: StoryPage[] = [];
  basePages.forEach((page, index) => {
    pages.push(page, ...(extras.get(index) || []));
  });
  pages.forEach((page, index) => {
    page.pageNumber = index + 1;
  });

  return {
    id: `reading_${reading.id}`,
    title: reading.chapterTitle,
    titleEnglish: reading.subtitle || reading.part || reading.chapterTitle,
    language: reading.language,
    gradeLevel: reading.grade,
    category: reading.subject,
    coverEmoji: '📘',
    coverColor: '#f59e0b',
    moralOrTakeaway: reading.summary,
    pages,
    spotlightWords: reading.keyVocabulary.map((v) => ({
      word: v.word,
      meaning: v.meaning,
      phonetic: v.phonetic,
    })),
    comprehensionQuiz: reading.comprehensionQuiz,
    isCustomGenerated: false,
    isTextbookReading: true,
    sourceReadingId: reading.id,
    sourceChapter: `${reading.chapterNumber} ${reading.chapterTitle}`.trim(),
    createdDate: reading.createdAt,
    difficulty: (['Easy', 'Medium', 'Hard'] as const).includes(reading.difficulty as any)
      ? (reading.difficulty as Story['difficulty'])
      : 'Medium',
    ...(book
      ? {
          bookId: book.bookId,
          bookTitle: book.bookTitle,
          bookChapters: book.chapters,
        }
      : {}),
  };
}

// The chapter after `story` in its book, if any.
export function nextChapterOf(story: Story | null): { id: string; title: string; number: string } | null {
  if (!story?.bookChapters?.length || !story.sourceReadingId) return null;
  const index = story.bookChapters.findIndex((c) => c.id === story.sourceReadingId);
  return index >= 0 && index < story.bookChapters.length - 1 ? story.bookChapters[index + 1] : null;
}

export interface ReadingBook {
  key: string;
  bookId: string;
  bookTitle: string;
  chapters: PublishedReadingSummary[];
  latestCreatedAt: string;
}

const leadingNumber = (value: string) => {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
};

// Groups a flat list of published chapters into books: chapters published
// together share a bookId; older single-chapter publishes are grouped by
// book title. Chapters keep the book's reading order (chapterOrder, else
// the number in "Chapter 3", else publish time); newest books come first.
export function groupReadingsIntoBooks(readings: PublishedReadingSummary[]): ReadingBook[] {
  const books = new Map<string, ReadingBook>();
  for (const reading of readings) {
    const title = (reading.bookTitle || '').trim() || 'Textbook';
    const key = reading.bookId ? `id:${reading.bookId}` : `title:${title.toLowerCase()}`;
    let book = books.get(key);
    if (!book) {
      book = { key, bookId: reading.bookId || key, bookTitle: title, chapters: [], latestCreatedAt: '' };
      books.set(key, book);
    }
    book.chapters.push(reading);
    if ((reading.createdAt || '') > book.latestCreatedAt) book.latestCreatedAt = reading.createdAt || '';
  }
  for (const book of books.values()) {
    book.chapters.sort((a, b) => {
      const orderA = typeof a.chapterOrder === 'number' ? a.chapterOrder : Number.POSITIVE_INFINITY;
      const orderB = typeof b.chapterOrder === 'number' ? b.chapterOrder : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      const numberA = leadingNumber(a.chapterNumber);
      const numberB = leadingNumber(b.chapterNumber);
      if (numberA !== numberB) return numberA - numberB;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }
  return [...books.values()].sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt));
}

export function bookContextFor(book: ReadingBook): BookContext {
  return {
    bookId: book.bookId,
    bookTitle: book.bookTitle,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.chapterTitle,
      number: chapter.chapterNumber,
    })),
  };
}
