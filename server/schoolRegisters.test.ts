import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchoolRegisters, type RollupInput } from "./schoolRegisters";

const input: RollupInput = {
  month: "2026-10",
  year: "2026-27",
  today: "2026-10-20",
  grades: ["Class 2", "Class 6", "Class 9"],
  students: [
    { id: "a", grade: "Class 2", name: "Asha", rollNumber: "1" },
    { id: "b", grade: "Class 2", name: "Bala", rollNumber: "2" },
    { id: "c", grade: "Class 2", name: "Chinni", rollNumber: "3" },
    { id: "d", grade: "Class 2", name: "Divya", rollNumber: "4" },
    { id: "x", grade: "Class 6", name: "Xavier", rollNumber: "1" },
  ],
  attendance: [
    { grade: "Class 2", day: "2026-10-14", present: ["a", "b", "c", "d"] },
    { grade: "Class 2", day: "2026-10-15", present: ["a", "b", "c"] },
    { grade: "Class 2", day: "2026-10-16", present: ["a", "b"] },
    { grade: "Class 2", day: "2026-10-17", present: ["a", "b", "zz"] },
    { grade: "Class 2", day: "2026-09-30", present: [] },
  ],
  rounds: [
    { grade: "Class 2", round: "baseline", entries: { a: { reading: "letter", maths: "num1_9" }, b: { reading: "word" }, c: { reading: "paragraph" } } },
    { grade: "Class 2", round: "midline", entries: { a: { reading: "paragraph", maths: "addsub" }, b: { reading: "story" }, c: { reading: "word" }, d: { absent: true }, zz: { reading: "story" } } },
  ],
  plans: [{ grade: "Class 6", entries: { "syl:mathematics:0:1": { month: "2026-06", taughtOn: "2026-06-20" }, "syl:mathematics:0:2": { month: "2026-08" } } }],
  readings: [{ id: "r1", grade: "Class 2", bookTitle: "English Reader", chapterTitle: "The Crow", subject: "English", language: "English" }],
};

test("per class: attendance, the latest FLN round and movement since the one before", () => {
  const r = buildSchoolRegisters(input);
  const c2 = r.classes.find((c) => c.grade === "Class 2")!;
  assert.equal(c2.children, 4);
  // 4 days × 4 children = 16; present 4+3+2+2 = 11 (a child of another class never counts)
  assert.deepEqual(c2.attendance, { days: 4, percent: 69, below75: 2, awayLast3: ["Divya"] });
  assert.equal(c2.fln.round, "midline");
  assert.equal(c2.fln.since, "baseline");
  assert.equal(c2.fln.assessed, 3);
  assert.equal(c2.fln.readingWordPlus, 3);
  assert.equal(c2.fln.readingParagraphPlus, 2);
  assert.equal(c2.fln.readingStory, 1);
  assert.equal(c2.fln.mathsAddSubPlus, 1);
  assert.equal(c2.fln.movedUp, 2);
  assert.equal(c2.fln.movedDown, 1);
  assert.ok(c2.curriculum.total >= 1);
});

test("curriculum pace from the year plan; classes without children add nothing", () => {
  const r = buildSchoolRegisters(input);
  const c6 = r.classes.find((c) => c.grade === "Class 6")!;
  assert.equal(c6.curriculum.taught, 1);
  assert.equal(c6.curriculum.late, 1);
  assert.equal(c6.fln.round, null);
  assert.equal(c6.attendance.percent, null);
  assert.equal(r.totals.children, 5);
  assert.equal(r.totals.attendancePercent, 69);
  assert.equal(r.totals.assessed, 3);
});

test("notes say what needs the headmaster's attention", () => {
  const notes = buildSchoolRegisters(input).notes.join(" | ");
  assert.match(notes, /No attendance marked this month: Class 6\./);
  assert.match(notes, /Attendance under 75%: Class 2 \(69%\)/);
  assert.match(notes, /1 child has been away/);
  assert.match(notes, /No year plan yet: Class 2\./);
  assert.match(notes, /No FLN assessment saved this year: Class 6\./);
  assert.match(notes, /Chapters behind plan: Class 6 \(1\)/);
  assert.doesNotMatch(notes, /Class 9/);
});
