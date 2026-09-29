// Unit tests for publishedReadingToStory — pure logic, no server/network
// needed. Run with: npx tsx --test src/services/publishedReadingToStory.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hubSubjectForReading, publishedReadingToStory } from "./publishedReadingToStory";
import { PublishedReading, PublishedReadingImage } from "../types";

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
    paragraphs: ["Para one.", "Para two.", "Para three.", "Para four."],
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
  test("groups paragraphs into pages of 3", () => {
    const story = publishedReadingToStory(reading(), []);
    // 4 paragraphs -> [3, 1] -> 2 pages.
    assert.equal(story.pages.length, 2);
    assert.equal(story.pages[0].text, "Para one.\n\nPara two.\n\nPara three.");
    assert.equal(story.pages[1].text, "Para four.");
  });

  test("a reading with no paragraphs still produces one page", () => {
    const story = publishedReadingToStory(reading({ paragraphs: [] }), []);
    assert.equal(story.pages.length, 1);
    assert.equal(story.pages[0].text, "A chapter about the village pond.");
  });

  test("attaches images to pages by index when there are enough pages", () => {
    const images = [image({ id: "a" }), image({ id: "b" })];
    const story = publishedReadingToStory(reading(), images);
    assert.equal(story.pages.length, 2);
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
