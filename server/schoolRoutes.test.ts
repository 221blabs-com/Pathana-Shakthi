import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchoolOverview, cleanGrades, cleanPersonName, cleanRollNumber, nextRollNumber, tempPassword } from "./schoolRoutes";

test("names: letters in any script, no markup or digits", () => {
  assert.equal(cleanPersonName("  Ravi   Teja "), "Ravi Teja");
  assert.equal(cleanPersonName("రవి తేజ"), "రవి తేజ");
  assert.equal(cleanPersonName("राम कुमार"), "राम कुमार");
  assert.equal(cleanPersonName("K. O'Neil-Rao"), "K. O'Neil-Rao");
  assert.equal(cleanPersonName("<b>x</b>"), null);
  assert.equal(cleanPersonName("Ravi 2"), null);
  assert.equal(cleanPersonName("A"), null);
});

test("roll numbers: 1-9999, leading zeros dropped, next free roll", () => {
  assert.equal(cleanRollNumber("007"), "7");
  assert.equal(cleanRollNumber("0"), null);
  assert.equal(cleanRollNumber("12345"), null);
  assert.equal(cleanRollNumber("4a"), null);
  assert.equal(nextRollNumber([]), "1");
  assert.equal(nextRollNumber(["1", "2", "4"]), "3");
  assert.equal(nextRollNumber(["2", "3"]), "1");
  assert.equal(nextRollNumber(["1", "2", "3", "17"]), "4");
});

test("grades and temporary passwords", () => {
  assert.deepEqual(cleanGrades(["Class 3", "Class 9", "Class 1"]), ["Class 1", "Class 3"]);
  assert.deepEqual(cleanGrades("Class 1"), []);
  const pw = tempPassword();
  assert.match(pw, /^[a-zA-Z2-9]{5}-[a-zA-Z2-9]{5}$/);
  assert.doesNotMatch(pw, /[0O1lI]/);
  assert.notEqual(tempPassword(), pw);
});

test("school overview: per-class numbers, teachers and notes from real records only", () => {
  const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const o = buildSchoolOverview({
    days,
    students: [
      { id: "a", name: "Asha R", grade: "Class 1", lastActiveDate: "2026-10-13", overallAccuracy: 80, sessionsCount: 3, stars: 5 },
      { id: "b", name: "Bala K", grade: "Class 1", lastActiveDate: "2026-10-01", overallAccuracy: 40, sessionsCount: 1 },
      { id: "c", name: "Chitra", grade: "Class 2", lastActiveDate: "", sessionsCount: 0 },
      { id: "d", name: "Gone", grade: "Class 2", active: false, sessionsCount: 9, overallAccuracy: 10 },
    ],
    sessions: [
      { studentId: "a", gradeLevel: "Class 1", day: "2026-10-13", accuracyRate: 80 },
      { studentId: "a", gradeLevel: "Class 1", date: "2026-10-12T05:00:00Z", accuracyRate: 85 },
      { studentId: "b", gradeLevel: "Class 1", day: "2026-09-01", accuracyRate: 40 },
    ],
    readings: [
      { grade: "Class 1", bookId: "b1", teacherId: "t1", createdAt: "2026-10-02" },
      { grade: "Class 1", bookId: "b1", teacherId: "t1", createdAt: "2026-10-03" },
      { grade: "Class 1", bookTitle: "Old single chapter", teacherId: "t1", createdAt: "2026-09-01" },
    ],
    teachers: [
      { uid: "t1", name: "Shailaja", grades: ["Class 1"], active: true },
      { uid: "t2", name: "Anand", grades: ["Class 2"], active: false },
    ],
  });
  assert.equal(o.totals.students, 3, "inactive students are not counted");
  assert.equal(o.totals.readings14d, 2);
  assert.equal(o.totals.readingsTotal, 3);
  assert.equal(o.totals.books, 2);
  assert.equal(o.totals.teachers, 1);
  assert.equal(o.totals.averageAccuracy, 60);
  const c1 = o.classes.find((c) => c.grade === "Class 1")!;
  assert.deepEqual(
    { students: c1.students, active: c1.activeThisWeek, readings: c1.readings14d, acc: c1.averageAccuracy, help: c1.needHelp, books: c1.books, chapters: c1.chapters, teachers: c1.teachers },
    { students: 2, active: 1, readings: 2, acc: 60, help: 1, books: 2, chapters: 3, teachers: ["Shailaja"] }
  );
  const c2 = o.classes.find((c) => c.grade === "Class 2")!;
  assert.equal(c2.averageAccuracy, null);
  assert.deepEqual(c2.teachers, [], "a deactivated teacher is not a class teacher");
  assert.equal(o.daily.find((d) => d.day === "2026-10-13")!.readers, 1);
  assert.equal(o.teachers.find((t) => t.uid === "t1")!.lastPublishedAt, "2026-10-03");
  const notes = o.insights.map((i) => i.text).join(" | ");
  assert.match(notes, /Class 2 has no published book/);
  assert.match(notes, /No child in Class 2 practised/);
  assert.match(notes, /Class 2 has no class teacher/);
  assert.match(notes, /1 child reads below 50%/);
  assert.match(notes, /Shailaja has published the most: 2 books, 3 chapters/);
});
