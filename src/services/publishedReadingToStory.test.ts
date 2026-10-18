// Unit tests for publishedReadingToStory — pure logic, no server/network
// needed. Run with: npx tsx --test src/services/publishedReadingToStory.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  scaledWordsPerPage,
  bookContextFor,
  cleanTableMarkdown,
  dropDuplicatePublishes,
  stripUnreadableGlyphs,
  groupReadingsIntoBooks,
  hubSubjectForReading,
  nextChapterOf,
  paginateParagraphs,
  publishedReadingToStory,
  wordsPerPageForGrade,
} from "./publishedReadingToStory";
import { PublishedReading, PublishedReadingImage, PublishedReadingSummary } from "../types";

function reading(overrides: Partial<PublishedReading> = {}): PublishedReading {
  return {
    id: "reading_1",
    teacherId: "teacher_1",
    grade: "Class 3",
    subject: "EVS",
    language: "Telugu",
    bookTitle: "EVS Reader",
    chapterNumber: "Chapter 3",
    chapterTitle: "The Village Pond",
    paragraphs: [
      "The pond sits at the edge of our village.",
      "Ducks swim in it every single morning.",
      "Children run to the water after school.",
      "Grandmother washes clothes near the steps.",
    ],
    tables: [],
    primaryTopic: "Water",
    summary: "A chapter about the village pond.",
    importantConcepts: [],
    keyVocabulary: [{ word: "చెరువు", meaning: "pond", phonetic: "cherువu" }],
    learningObjectives: [],
    comprehensionQuiz: [
      {
        question: "What is this chapter about?",
        options: ["Pond", "Mountain", "Desert", "Ocean"],
        correctOptionIndex: 0,
        explanation: "The chapter is about a village pond.",
      },
    ],
    imageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function image(overrides: Partial<PublishedReadingImage> = {}): PublishedReadingImage {
  return {
    id: "img_1",
    base64: "aGVsbG8=",
    mimeType: "image/jpeg",
    pageNumber: 3,
    caption: "The pond",
    ...overrides,
  };
}

describe("publishedReadingToStory", () => {
  test("one reader page per paragraph, never merged", () => {
    const story = publishedReadingToStory(reading(), []);
    assert.equal(story.pages.length, 4);
    assert.equal(story.pages[0].text, "The pond sits at the edge of our village.");
    assert.equal(story.pages[3].text, "Grandmother washes clothes near the steps.");
  });

  test("each reader page carries its printed textbook page", () => {
    const story = publishedReadingToStory(reading({ paragraphPages: [3, 3, 4, 4] }), []);
    assert.deepEqual(story.pages.map((p) => p.sourcePage), [3, 3, 4, 4]);
  });

  test("pictures and tables land on the page their printed page's text is on", () => {
    const story = publishedReadingToStory(
      reading({
        paragraphPages: [3, 3, 4, 5],
        tables: [{ markdown: "| A |\n|---|\n| 1 |", pageNumber: 5, caption: "" }],
      }),
      [image({ id: "p4", pageNumber: 4 }), image({ id: "p3", pageNumber: 3, base64: "cDM=" })]
    );
    assert.equal(story.pages[2].imageBase64, "aGVsbG8="); // page-4 picture on the page-4 text
    assert.equal(story.pages[0].imageBase64, "cDM=");
    assert.ok(story.pages[3].tableMarkdown);
  });

  test("a second picture from the same page gets its own page right after, not at the end", () => {
    const story = publishedReadingToStory(
      reading({ paragraphPages: [3, 4, 4, 4] }),
      [image({ id: "a", pageNumber: 3, base64: "YQ==" }), image({ id: "b", pageNumber: 3, base64: "Yg==", caption: "Second" })]
    );
    assert.equal(story.pages.length, 5);
    assert.equal(story.pages[0].imageBase64, "YQ==");
    assert.equal(story.pages[1].imageBase64, "Yg==");
    assert.equal(story.pages[1].text, "Second");
    assert.deepEqual(story.pages.map((p) => p.pageNumber), [1, 2, 3, 4, 5]);
  });

  test("a reading with no paragraphs still produces one page", () => {
    const story = publishedReadingToStory(reading({ paragraphs: [] }), []);
    assert.equal(story.pages.length, 1);
    assert.equal(story.pages[0].text, "A chapter about the village pond.");
  });

  test("attaches images to pages by index when there are enough pages", () => {
    const images = [image({ id: "a" }), image({ id: "b" })];
    const story = publishedReadingToStory(reading(), images);
    assert.equal(story.pages.length, 4);
    assert.equal(story.pages[0].imageBase64, images[0].base64);
    assert.equal(story.pages[1].imageBase64, images[1].base64);
  });

  test("never drops an image that has no page to attach to — gets its own page", () => {
    // 1 paragraph -> 1 page, but 3 images.
    const images = [image({ id: "a" }), image({ id: "b" }), image({ id: "c" })];
    const story = publishedReadingToStory(
      reading({ paragraphs: ["Only paragraph."] }),
      images
    );
    assert.equal(story.pages.length, 3);
    assert.equal(story.pages[0].imageBase64, images[0].base64);
    assert.equal(story.pages[1].imageBase64, images[1].base64);
    assert.equal(story.pages[1].text, images[1].caption);
    assert.equal(story.pages[2].imageBase64, images[2].base64);
  });

  test("never drops a table that has no page to attach to — gets its own page", () => {
    const story = publishedReadingToStory(
      reading({
        paragraphs: ["Only paragraph."],
        tables: [
          { markdown: "| A | B |\n|---|---|\n| 1 | 2 |", pageNumber: 1, caption: "Table 1" },
          { markdown: "| C | D |\n|---|---|\n| 3 | 4 |", pageNumber: 2, caption: "Table 2" },
        ],
      }),
      []
    );
    assert.equal(story.pages.length, 2);
    assert.equal(story.pages[0].tableMarkdown, "| A | B |\n|---|---|\n| 1 | 2 |");
    assert.equal(story.pages[1].tableMarkdown, "| C | D |\n|---|---|\n| 3 | 4 |");
    assert.equal(story.pages[1].text, "Table 2");
  });

  test("page numbers stay sequential across attached + leftover pages", () => {
    const images = [image({ id: "a" }), image({ id: "b" }), image({ id: "c" })];
    const story = publishedReadingToStory(
      reading({ paragraphs: ["Only paragraph."] }),
      images
    );
    assert.deepEqual(
      story.pages.map((p) => p.pageNumber),
      [1, 2, 3]
    );
  });

  test("marks the story as a real textbook reading with the source id", () => {
    const story = publishedReadingToStory(reading(), []);
    assert.equal(story.isTextbookReading, true);
    assert.equal(story.sourceReadingId, "reading_1");
    assert.equal(story.isCustomGenerated, false);
    assert.equal(story.sourceChapter, "Chapter 3 The Village Pond");
  });

  test("carries grade/subject/language/quiz/vocabulary straight through", () => {
    const r = reading();
    const story = publishedReadingToStory(r, []);
    assert.equal(story.gradeLevel, r.grade);
    assert.equal(story.category, r.subject);
    assert.equal(story.language, r.language);
    assert.deepEqual(story.comprehensionQuiz, r.comprehensionQuiz);
    assert.equal(story.spotlightWords[0].word, r.keyVocabulary[0].word);
  });
});

describe("paginateParagraphs", () => {
  const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

  test("younger grades get shorter pages", () => {
    assert.equal(wordsPerPageForGrade("Class 1"), 15);
    assert.equal(wordsPerPageForGrade("Class 3"), 20);
    assert.equal(wordsPerPageForGrade("Class 6"), 32);
    assert.equal(wordsPerPageForGrade("Class 10"), 40);
    assert.equal(wordsPerPageForGrade("Class 5"), 25);
  });

  test("splits a long paragraph at sentence ends, never exceeding the budget", () => {
    const long =
      "One two three four five six. Seven eight nine ten eleven twelve. " +
      "Thirteen fourteen fifteen sixteen. Seventeen eighteen nineteen twenty twentyone.";
    const pages = paginateParagraphs([long], 10);
    assert.ok(pages.length >= 2);
    for (const page of pages) assert.ok(words(page) <= 10, page);
    assert.equal(pages.join(" ").replace(/\s+/g, " "), long);
  });

  test("splits Telugu/Hindi sentences at the danda too", () => {
    const pages = paginateParagraphs(["एक दो तीन चार। पाँच छह सात आठ।"], 4);
    assert.deepEqual(pages, ["एक दो तीन चार।", "पाँच छह सात आठ।"]);
  });

  test("keeps a poem's line breaks when splitting it", () => {
    const poem = "Twinkle twinkle little star\nHow I wonder what you are\nUp above the world so high\nLike a diamond in the sky";
    const pages = paginateParagraphs([poem], 12);
    assert.deepEqual(pages, [
      "Twinkle twinkle little star\nHow I wonder what you are",
      "Up above the world so high\nLike a diamond in the sky",
    ]);
  });

  test("breaks a single over-long sentence between words", () => {
    const sentence = Array.from({ length: 23 }, (_, i) => `w${i}`).join(" ");
    const pages = paginateParagraphs([sentence], 10);
    assert.deepEqual(pages.map(words), [10, 10, 3]);
  });

  test("a blank line inside a block starts a new page (two stanzas)", () => {
    assert.deepEqual(paginateParagraphs(["Line one\nLine two\n\nLine three\nLine four"], 20), [
      "Line one\nLine two",
      "Line three\nLine four",
    ]);
  });

  test("drops empty paragraphs", () => {
    assert.deepEqual(paginateParagraphs(["", "  ", "Hello there."], 10), ["Hello there."]);
  });
});

describe("book context + nextChapterOf", () => {
  const book = {
    bookId: "book_1",
    bookTitle: "EVS Reader",
    chapters: [
      { id: "reading_0", title: "Our Home", number: "1" },
      { id: "reading_1", title: "The Village Pond", number: "2" },
      { id: "reading_2", title: "Trees Around Us", number: "3" },
    ],
  };

  test("carries the book's chapter list onto the story", () => {
    const story = publishedReadingToStory(reading(), [], book);
    assert.equal(story.bookId, "book_1");
    assert.equal(story.bookTitle, "EVS Reader");
    assert.deepEqual(story.bookChapters, book.chapters);
  });

  test("nextChapterOf returns the following chapter", () => {
    const story = publishedReadingToStory(reading(), [], book);
    assert.deepEqual(nextChapterOf(story), book.chapters[2]);
  });

  test("nextChapterOf is null on the last chapter or without a book", () => {
    const last = publishedReadingToStory(reading({ id: "reading_2" }), [], book);
    assert.equal(nextChapterOf(last), null);
    assert.equal(nextChapterOf(publishedReadingToStory(reading(), [])), null);
    assert.equal(nextChapterOf(null), null);
  });
});

describe("groupReadingsIntoBooks", () => {
  const summary = (overrides: Partial<PublishedReadingSummary>): PublishedReadingSummary => ({
    id: "r",
    grade: "Class 5",
    subject: "Telugu",
    language: "Telugu",
    bookTitle: "Telugu Reader",
    chapterNumber: "",
    chapterTitle: "",
    summary: "",
    imageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  test("groups by bookId and orders chapters by chapterOrder", () => {
    const books = groupReadingsIntoBooks([
      summary({ id: "c2", bookId: "b1", chapterOrder: 1, chapterTitle: "Two" }),
      summary({ id: "c1", bookId: "b1", chapterOrder: 0, chapterTitle: "One" }),
      summary({ id: "x", bookId: "b2", bookTitle: "Other", chapterOrder: 0, createdAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    assert.equal(books.length, 2);
    assert.equal(books[0].bookId, "b2"); // newest book first
    assert.deepEqual(books[1].chapters.map((c) => c.id), ["c1", "c2"]);
  });

  test("older publishes without bookId group by title and sort by chapter number", () => {
    const books = groupReadingsIntoBooks([
      summary({ id: "c10", chapterNumber: "Chapter 10" }),
      summary({ id: "c2", chapterNumber: "Chapter 2" }),
      summary({ id: "c3", chapterNumber: "3", bookTitle: "telugu reader " }),
    ]);
    assert.equal(books.length, 1);
    assert.deepEqual(books[0].chapters.map((c) => c.id), ["c2", "c3", "c10"]);
  });

  test("bookContextFor lists the chapters in order for next-chapter navigation", () => {
    const [book] = groupReadingsIntoBooks([
      summary({ id: "b", bookId: "k", chapterOrder: 1, chapterTitle: "B", chapterNumber: "2" }),
      summary({ id: "a", bookId: "k", chapterOrder: 0, chapterTitle: "A", chapterNumber: "1" }),
    ]);
    assert.deepEqual(bookContextFor(book), {
      bookId: "k",
      bookTitle: "Telugu Reader",
      chapters: [
        { id: "a", title: "A", number: "1" },
        { id: "b", title: "B", number: "2" },
      ],
    });
  });
});

describe("hubSubjectForReading", () => {
  test("keeps an exact hub subject", () => {
    assert.equal(hubSubjectForReading("Science", "English"), "Science");
    assert.equal(hubSubjectForReading("telugu", "Telugu"), "Telugu");
  });

  test("maps AI-detected subject labels onto hub tiles", () => {
    assert.equal(hubSubjectForReading("Environmental Studies (EVS)", "English"), "Science");
    assert.equal(hubSubjectForReading("Mathematics", "Hindi"), "Maths");
    assert.equal(hubSubjectForReading("Telugu Reader", "Telugu"), "Telugu");
    assert.equal(hubSubjectForReading("Social Studies", "English"), "Social");
  });

  test("falls back to the reading's language for non-subject labels", () => {
    assert.equal(hubSubjectForReading("Poetry", "Telugu"), "Telugu");
    assert.equal(hubSubjectForReading("Poetry", "English"), "English");
  });

  test("returns null when neither subject nor language maps to a tile", () => {
    assert.equal(hubSubjectForReading("Poetry", "Bilingual"), null);
  });
});

test('the same chapter published twice is shown once (whole-book copy wins, then newest)', () => {
  const base = { grade: 'Class 5', subject: 'English', language: 'English', bookTitle: 'Class IV English – "What Is a Tree?"', chapterNumber: '', chapterTitle: 'TLMs for What Is a Tree?', imageCount: 0 } as any;
  const inBook = { ...base, id: 'a', bookId: 'book-1', chapterOrder: 1, createdAt: '2026-10-02T07:08:22Z' };
  const single = { ...base, id: 'b', bookId: null, createdAt: '2026-10-02T07:10:00Z' };
  const other = { ...base, id: 'c', bookId: null, chapterTitle: 'Another chapter', createdAt: '2026-10-02T07:11:00Z' };
  const books = groupReadingsIntoBooks([inBook, single, other]);
  const ids = books.flatMap((b) => b.chapters.map((c) => c.id)).sort();
  assert.deepEqual(ids, ['a', 'c']);
  // Two full books with the same chapter: the newer publish wins.
  const newer = { ...inBook, id: 'd', bookId: 'book-2', createdAt: '2026-10-03T00:00:00Z' };
  assert.deepEqual(dropDuplicatePublishes([inBook, newer]).map((r) => r.id), ['d']);
  // Repeated chapter titles inside one book are kept.
  const twin = { ...inBook, id: 'e', chapterOrder: 2 };
  assert.deepEqual(dropDuplicatePublishes([inBook, twin]).map((r) => r.id), ['a', 'e']);
});

test('undecodable font glyphs (black boxes) never reach the reader', () => {
  const table = "| Part | Telugu meaning | What students say |\n|---|---|---|\n| Roots | ■■■■■■ | These are roots. |\n| Trunk | ■■■■■ / ■■■■■■ ■■■■■ | This is the trunk. |";
  assert.equal(
    cleanTableMarkdown(table),
    "| Part | What students say |\n| --- | --- |\n| Roots | These are roots. |\n| Trunk | This is the trunk. |"
  );
  // A partly readable column stays, with a dash where text was lost.
  assert.equal(
    cleanTableMarkdown("| A | B |\n|---|---|\n| x | ■■ |\n| y | yes |"),
    "| A | B |\n| --- | --- |\n| x | — |\n| y | yes |"
  );
  assert.equal(cleanTableMarkdown("| A |\n|---|\n| ■■ |"), "");
  assert.equal(cleanTableMarkdown("| A |\n|---|\n| ok |"), "| A |\n|---|\n| ok |");
  assert.equal(stripUnreadableGlyphs("Roots ■■■■ are here"), "Roots are here");
  assert.equal(stripUnreadableGlyphs("■■■■ / ■■■"), "");
  assert.equal(stripUnreadableGlyphs("పిల్లి పాలు తాగుతుంది."), "పిల్లి పాలు తాగుతుంది.");
  const story = publishedReadingToStory(
    reading({ grade: "Class 5", paragraphs: ["■■■■", "The tree gives us shade."], paragraphPages: [3, 4], tables: [{ markdown: table, pageNumber: 4, caption: "" }] } as any),
    []
  );
  assert.ok(story.pages.every((p) => !/■/.test(p.text) && !/■/.test(p.tableMarkdown || "")));
  assert.equal(story.pages[0].text, "The tree gives us shade.");
});

test('reading levels change page length within one read-aloud attempt', () => {
  assert.equal(scaledWordsPerPage(15, 1), 15);
  assert.equal(scaledWordsPerPage(15, 0.6), 9); // Class 1 beginner
  assert.equal(scaledWordsPerPage(10, 0.4), 6); // never under 6 words
  assert.equal(scaledWordsPerPage(25, 1.4), 35); // Class 5 fluent reader
  assert.equal(scaledWordsPerPage(40, 1.4), 40); // never past one attempt
});
