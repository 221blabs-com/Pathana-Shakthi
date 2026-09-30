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

// Splits a chapter's paragraphs into reader pages of at most maxWords words:
// short paragraphs share a page, long ones break at sentence ends (or poem
// line breaks), and a single over-long sentence breaks between words.
export function paginateParagraphs(paragraphs: string[], maxWords: number): string[] {
  const pieces: string[] = [];
  for (const paragraph of paragraphs.map((p) => p.trim()).filter(Boolean)) {
    if (countWords(paragraph) <= maxWords) {
      pieces.push(paragraph);
      continue;
    }
    const sentences = paragraph
      .split(/(?<=[.!?।॥])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    let chunk = '';
    const flush = () => {
      if (chunk) pieces.push(chunk);
      chunk = '';
    };
    for (const sentence of sentences) {
      if (countWords(sentence) > maxWords) {
        flush();
        const words = sentence.split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length; i += maxWords) {
          pieces.push(words.slice(i, i + maxWords).join(' '));
        }
        continue;
      }
      const joined = chunk ? `${chunk}${paragraph.includes('\n') ? '\n' : ' '}${sentence}` : sentence;
      if (countWords(joined) > maxWords) {
        flush();
        chunk = sentence;
      } else {
        chunk = joined;
      }
    }
    flush();
  }
  const pages: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const joined = current ? `${current}\n\n${piece}` : piece;
    if (current && countWords(joined) > maxWords) {
      pages.push(current);
      current = piece;
    } else {
      current = joined;
    }
  }
  if (current) pages.push(current);
  return pages;
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
  const paragraphGroups: string[][] = paginateParagraphs(
    reading.paragraphs,
    wordsPerPageForGrade(reading.grade)
  ).map((page) => [page]);
  if (paragraphGroups.length === 0) {
    paragraphGroups.push([reading.summary || reading.chapterTitle]);
  }

  const tables = reading.tables || [];
  const pages: StoryPage[] = paragraphGroups.map((group, index) => {
    const image = index < images.length ? images[index] : undefined;
    const table = index < tables.length ? tables[index] : undefined;
    return {
      pageNumber: index + 1,
      text: group.join('\n\n'),
      englishTranslation: '',
      transliteration: '',
      illustrationPrompt: reading.chapterTitle,
      imageBase64: image?.base64,
      imageMimeType: image?.mimeType,
      imageCaption: image?.caption,
      tableMarkdown: table?.markdown,
      tableCaption: table?.caption,
    };
  });

  // Never drop an image or table just because there weren't enough text
  // pages to carry it — every picture/table the teacher published stays
  // reachable, on its own page if needed (same "nothing goes missing"
  // principle the OCR pipeline itself follows).
  let nextPageNumber = pages.length + 1;
  for (let i = pages.length; i < images.length; i += 1) {
    const image = images[i];
    pages.push({
      pageNumber: nextPageNumber,
      text: image.caption || reading.chapterTitle,
      englishTranslation: '',
      transliteration: '',
      illustrationPrompt: reading.chapterTitle,
      imageBase64: image.base64,
      imageMimeType: image.mimeType,
      imageCaption: image.caption,
    });
    nextPageNumber += 1;
  }
  for (let i = paragraphGroups.length; i < tables.length; i += 1) {
    const table = tables[i];
    pages.push({
      pageNumber: nextPageNumber,
      text: table.caption || `${reading.chapterTitle} — Table`,
      englishTranslation: '',
      transliteration: '',
      illustrationPrompt: reading.chapterTitle,
      tableMarkdown: table.markdown,
      tableCaption: table.caption,
    });
    nextPageNumber += 1;
  }

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
