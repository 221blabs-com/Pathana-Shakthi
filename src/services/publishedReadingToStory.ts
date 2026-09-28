// Converts a server-persisted PublishedReading (real OCR'd textbook
// paragraphs/images/tables a teacher published) into the Story shape the
// existing ReadAlongReader/StudentLibraryPage UI already knows how to show.
// Reusing Story instead of building a second reader component means the
// reading gets grade filtering, offline caching, and the reader's whole
// mic/voice/quiz flow for free.
import {
  PublishedReading,
  PublishedReadingImage,
  Story,
  StoryPage,
} from '../types';

// Readable chunk size per page for a young reader — matches roughly what
// AI-generated stories already put on one page.
const PARAGRAPHS_PER_PAGE = 3;

export function publishedReadingToStory(
  reading: PublishedReading,
  images: PublishedReadingImage[]
): Story {
  const paragraphGroups: string[][] = [];
  for (let i = 0; i < reading.paragraphs.length; i += PARAGRAPHS_PER_PAGE) {
    paragraphGroups.push(reading.paragraphs.slice(i, i + PARAGRAPHS_PER_PAGE));
  }
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
    titleEnglish: reading.chapterTitle,
    language: reading.language,
    gradeLevel: reading.grade,
    difficulty: 'Medium',
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
  };
}
