// Run with: npx tsx --test src/data/bookActivities.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { activityTotal, bookActivitiesGameId, buildTextActivities, normalizeAiActivities, textOverlap } from "./bookActivities";

const reading = {
  chapterTitle: "At the Farm",
  grade: "Class 1",
  language: "English",
  paragraphs: [
    "Ravi goes to the farm with his grandfather.",
    "The cow gives milk. The hen lays eggs. The dog guards the house.",
    "First Ravi feeds the hen. Then he gives water to the cow. At last he plays with the dog.",
    "Exercises",
    "Match the animal with what it gives.",
    "cow - milk",
    "hen - eggs",
    "Read aloud.",
    "The cow gives milk.",
    "Fill in the blanks.",
  ],
  paragraphPages: [1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
};
const pictures = [{ id: "imgCow", caption: "a cow", pageNumber: 2 }];

describe("text-only activities", () => {
  test("finds exercise blocks by heading", () => {
    const out = buildTextActivities(reading);
    assert.equal(out.source, "text");
    const match = out.activities.find((a) => a.kind === "match");
    assert.ok(match, JSON.stringify(out.activities));
    assert.deepEqual(match!.pairs, [
      { left: { text: "cow" }, right: { text: "milk" } },
      { left: { text: "hen" }, right: { text: "eggs" } },
    ]);
    assert.equal(match!.page, 2);
    const say = out.activities.find((a) => a.kind === "say");
    assert.deepEqual(say!.lines, ["The cow gives milk."]);
    // A heading with no items of its own is not an activity.
    assert.ok(!out.activities.some((a) => a.instruction === "Fill in the blanks."));
  });
});

describe("AI activities are checked against the chapter", () => {
  test("keeps the book's exercises, drops invented ones", () => {
    const raw = {
      activities: [
        { kind: "match", instruction: "Match the animal with what it gives.", paragraph: 4, pairs: [
          { left: { text: "cow", picture: "P1" }, right: { text: "milk" } },
          { left: { text: "hen", emoji: "🐔" }, right: { text: "eggs" } },
          { left: { text: "lion" }, right: { text: "roar" } },
        ] },
        { kind: "fill", instruction: "Fill in the blanks.", items: [
          { prompt: "The cow gives ____.", answer: "milk", options: ["milk", "eggs", "bread"] },
          { prompt: "The hen lays ......", answer: "eggs" },
          { prompt: "The dog eats ____.", answer: "bones" },
        ] },
        { kind: "choose", instruction: "Tick the right answer.", items: [{ prompt: "Who guards the house?", answer: "dog", options: ["cow", "dog", "hen"] }] },
        { kind: "truefalse", instruction: "Match the animal with what it gives.", items: [{ prompt: "The cow gives milk.", answer: "True" }, { prompt: "The hen lays eggs.", answer: "maybe" }] },
        { kind: "order", instruction: "Read aloud.", sequence: ["Ravi feeds the hen", "he gives water to the cow", "he plays with the dog"] },
        { kind: "write", instruction: "Write about your favourite planet in space.", lines: ["Which planet?"] },
        { kind: "picture", instruction: "Read aloud.", items: [{ prompt: "What is this?", answer: "a cow", picture: "P1" }, { prompt: "No picture", answer: "" }] },
      ],
    };
    const out = normalizeAiActivities(raw, reading, pictures);
    assert.equal(out.source, "ai");
    const kinds = out.activities.map((a) => a.kind);
    // "Tick the right answer." is not in the chapter, nor is the planet exercise.
    assert.deepEqual(kinds, ["match", "fill", "truefalse", "order", "picture"]);
    const match = out.activities[0];
    assert.equal(match.pairs!.length, 2);
    assert.equal(match.pairs![0].left.pictureId, "imgCow");
    assert.ok(!match.pairs!.some((p) => p.left.text === "lion"));
    assert.equal(match.page, 2);
    const fill = out.activities[1];
    assert.equal(fill.items!.length, 2);
    assert.equal(fill.items![0].prompt, "The cow gives _____.");
    assert.ok(fill.items![1].options!.includes("eggs") && fill.items![1].options!.includes("milk"));
    assert.equal(out.activities[2].items!.length, 1);
    assert.equal(out.activities[2].items![0].answer, "true");
    assert.equal(out.activities[4].items!.length, 1);
    assert.equal(activityTotal(fill), 2);
  });

  test("falls back to the text version when nothing usable came back", () => {
    const fallback = buildTextActivities(reading);
    assert.equal(normalizeAiActivities({ activities: [] }, reading, pictures, fallback), fallback);
    assert.equal(normalizeAiActivities(null, reading, pictures, fallback), fallback);
  });
});

describe("helpers", () => {
  test("text overlap and game ids", () => {
    assert.equal(textOverlap("The cow gives milk", "the cow gives milk every day"), 1);
    assert.equal(textOverlap("planet Mars", "the cow gives milk"), 0);
    assert.equal(bookActivitiesGameId("AbC12_xyZ"), "book-abc12xyz");
    assert.match(bookActivitiesGameId("x".repeat(80)), /^[a-z0-9-]{1,60}$/);
  });
});
