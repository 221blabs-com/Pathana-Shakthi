import test from "node:test";
import assert from "node:assert/strict";
import { buildDayPlan, DayChild, DayReading, goalsDone, nextChapters } from "./dayPlan";

const day = "2026-10-09";
const kid = (id: string, extra: Partial<DayChild> = {}): DayChild => ({
  id,
  name: `Child ${id}`,
  avatar: "🧒",
  rollNumber: id,
  readingLevel: "developing",
  dailyActivity: {},
  completedStoryIds: [],
  lastActiveDate: "",
  openQuestions: 0,
  pendingWork: 0,
  units: [],
  ...extra,
});
const reading = (id: string, order: number, book = "b1"): DayReading => ({
  id,
  bookKey: book,
  bookTitle: book === "b1" ? "English Reader" : "Maths",
  chapterTitle: `Chapter ${id}`,
  chapterOrder: order,
  subject: "English",
});

test("today's goals come from the day's activity markers and workbooks", () => {
  const c = kid("1", {
    dailyActivity: { [day]: ["read_reading_r1", "words_2026-10-09", "game_maths-adding"], "2026-10-08": ["unit_r1"] },
    units: [{ readingId: "r1", day: "2026-10-08" }],
  });
  assert.deepEqual(goalsDone(c, day), { read: true, workbook: false, words: true, play: true });
  assert.equal(goalsDone({ ...c, units: [{ readingId: "r1", day }] }, day).workbook, true);
});

test("the next chapter of each book is the first one most children have not read", () => {
  const kids = [kid("1", { completedStoryIds: ["reading_r1"] }), kid("2", { completedStoryIds: ["reading_r1", "reading_r2"] }), kid("3")];
  const next = nextChapters([reading("r2", 2), reading("r1", 1), reading("r3", 3), reading("m1", 1, "b2")], kids);
  assert.deepEqual(next.map((n) => n.readingId), ["r2", "m1"]);
  assert.equal(next[0].readBy, 1);
});

test("a day plan per level group, with counts and the class's weakest competencies", () => {
  const kids = [
    kid("1", { readingLevel: "beginner", openQuestions: 1, lastActiveDate: "2026-10-01" }),
    kid("2", { readingLevel: "proficient", pendingWork: 2, lastActiveDate: day, dailyActivity: { [day]: ["read_x"] } }),
    kid("3"),
  ];
  const plan = buildDayPlan({
    grade: "Class 3",
    day,
    children: kids,
    readings: [reading("r1", 1)],
    competencies: [
      { id: "lit-orf", icon: "🏃", short: "Fluency", idea: "Echo reading", practice: null },
      { id: "num-operations", icon: "➕", short: "Operations", idea: "Story sums", practice: { kind: "lab", id: "maths-adding", title: "Adding" } },
      { id: "lit-decoding", icon: "🔤", short: "Decoding", idea: "", practice: null },
    ],
    statuses: {
      "1": { "lit-orf": "beginning", "num-operations": "beginning", "lit-decoding": "achieved" },
      "2": { "lit-orf": "achieved", "num-operations": "beginning", "lit-decoding": "achieved" },
      "3": { "lit-orf": "developing", "num-operations": "developing", "lit-decoding": "achieved" },
    },
  });
  assert.deepEqual(plan.counts, { children: 3, activeToday: 1, openQuestions: 1, childrenWithQuestions: 1, pendingWork: 2, awayThreeDays: 2 });
  assert.equal(plan.goals.find((g) => g.id === "read")?.done, 1);
  assert.deepEqual(plan.groups.map((g) => g.level), ["beginner", "developing", "proficient"]);
  assert.equal(plan.groups[0].work?.kind, "reading");
  assert.equal(plan.groups[2].work?.kind, "workbook");
  assert.match(plan.groups[0].plan, /Chapter r1/);
  // Decoding is achieved by everyone, so it is not a focus.
  assert.deepEqual(plan.focus.map((f) => f.id), ["num-operations", "lit-orf"]);
});

test("without published chapters the groups get the focus practice", () => {
  const plan = buildDayPlan({
    grade: "Class 1",
    day,
    children: [kid("1", { readingLevel: "beginner" })],
    readings: [],
    competencies: [{ id: "num-number-sense", icon: "🔢", short: "Numbers", idea: "", practice: { kind: "lab", id: "maths-counting", title: "Let Us Count" } }],
    statuses: { "1": { "num-number-sense": "beginning" } },
  });
  assert.equal(plan.nextChapters.length, 0);
  assert.deepEqual(plan.groups[0].work, { kind: "lab", id: "maths-counting", title: "Let Us Count" });
});
