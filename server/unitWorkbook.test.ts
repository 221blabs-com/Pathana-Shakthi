// Run with: npx tsx --test server/unitWorkbook.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTextWorkbook, normalizeAiWorkbook, toOutcome } from "./unitWorkbook";

const reading = {
  chapterTitle: "The Thirsty Crow",
  language: "English",
  grade: "Class 3",
  paragraphs: [
    "A thirsty crow flew over the village looking for water.",
    "He found a pitcher in the garden, but the water was very low.",
    "The clever crow dropped small pebbles into the pitcher one by one.",
    "Slowly the water rose up and the crow drank happily.",
  ],
  keyPoints: ["The crow was thirsty.", "He used pebbles to raise the water."],
  keyVocabulary: [{ word: "pitcher", meaning: "a pot for water" }, { word: "pebbles", meaning: "small stones" }],
  learningObjectives: ["Students will be able to retell the story in their own words.", "Identify how the crow solved his problem."],
  discussionQuestions: ["What would you do if you were the crow?"],
  comprehensionQuiz: [{ question: "Where did the crow find the pitcher?", options: ["In the garden", "On a tree", "In a shop"], correctOptionIndex: 0 }],
};

test("text workbook: every section from the stored chapter, no AI", () => {
  const wb = buildTextWorkbook(reading);
  assert.equal(wb.source, "text");
  assert.equal(wb.language, "English");
  assert.deepEqual(wb.lesson.points, ["The crow was thirsty.", "He used pebbles to raise the water."]);
  assert.equal(wb.lesson.words.length, 2);
  assert.ok(wb.blanks.length >= 1, "fill in the blanks from the chapter's own sentences");
  for (const b of wb.blanks) {
    assert.equal((b.sentence.match(/_____/g) || []).length, 1, b.sentence);
    assert.ok(b.options.includes(b.answer));
    assert.ok(reading.paragraphs.join(" ").includes(b.answer));
  }
  assert.deepEqual(wb.questions[0], { question: "Where did the crow find the pitcher?", kind: "short", answer: "In the garden" });
  assert.equal(wb.questions[1].kind, "long");
  assert.deepEqual(wb.outcomes, ["I can retell the story in their own words", "I can identify how the crow solved his problem"]);
  assert.equal(wb.reflection.length, 5);
  assert.ok(wb.activity.steps.length >= 2);
});

test("Telugu chapters get Telugu reflection prompts and activity", () => {
  const wb = buildTextWorkbook({ paragraphs: ["కాకి నీళ్ల కోసం వెతికింది. కుండలో రాళ్లు వేసింది. నీళ్లు పైకి వచ్చాయి."], language: "English" });
  assert.equal(wb.language, "Telugu");
  assert.match(wb.reflection[0], /పాఠం/);
  assert.match(wb.activity.title, /బొమ్మ/);
});

test("AI workbook: answers must come from the chapter; broken parts fall back", () => {
  const fallback = buildTextWorkbook(reading);
  const wb = normalizeAiWorkbook(
    {
      lessonPoints: ["A crow was thirsty.", "It found a pitcher.", "Pebbles made the water rise."],
      blanks: [
        { sentence: "The crow dropped small _____ into the pitcher.", answer: "pebbles", wrong: ["leaves", "sticks", "seeds"] },
        { sentence: "The crow was very _____.", answer: "hungry", wrong: ["sad", "tall", "old"] }, // not in the text
        { sentence: "No blank here.", answer: "crow", wrong: ["a", "b", "c"] },
        { sentence: "He found a _____ in the garden.", answer: "pitcher", wrong: ["cup", "box", "bag"] },
      ],
      questions: [
        { question: "Why did the crow drop pebbles?", kind: "short", answer: "To make the water rise." },
        { question: "How do you save water at home?", kind: "apply", answer: "Close the tap." },
        { question: "Empty answer", kind: "long", answer: "" },
      ],
      outcomes: ["I can retell the story.", "I can explain how pebbles raise water."],
      activity: { title: "Pebble test", steps: ["Take a glass of water.", "Drop pebbles in it."], materials: ["glass", "pebbles"] },
    },
    reading,
    fallback
  );
  assert.equal(wb.source, "ai");
  assert.deepEqual(wb.blanks.map((b) => b.answer), ["pebbles", "pitcher"]);
  assert.ok(wb.blanks.every((b) => b.options.length === 4 && b.options.includes(b.answer)));
  assert.equal(wb.questions.length, 2);
  assert.equal(wb.activity.title, "Pebble test");
  // Too little usable AI output keeps the text-only section.
  const poor = normalizeAiWorkbook({ lessonPoints: [], blanks: [], questions: [], outcomes: [] }, reading, fallback);
  assert.deepEqual(poor.blanks, fallback.blanks);
  assert.deepEqual(poor.lesson.points, fallback.lesson.points);
  assert.deepEqual(poor.activity, fallback.activity);
});

test("objectives become 'I can' statements", () => {
  assert.equal(toOutcome("Students will be able to count objects up to 20.", "English"), "I can count objects up to 20");
  assert.equal(toOutcome("Learners should identify plant parts", "English"), "I can identify plant parts");
  assert.equal(toOutcome("I can read the poem.", "English"), "I can read the poem");
});
