import test from "node:test";
import assert from "node:assert/strict";
import { buildClassReport, periodDays } from "./classReport";

test("periods end on the given day", () => {
  assert.deepEqual(periodDays("2026-10-09", "day"), ["2026-10-09"]);
  const week = periodDays("2026-10-09", "week");
  assert.equal(week.length, 7);
  assert.equal(week[0], "2026-10-03");
  assert.equal(periodDays("2026-10-09", "month")[0], "2026-09-10");
});

test("a week's report: reading vs last week, workbooks, follow-up and priorities", () => {
  const r = buildClassReport({
    grade: "Class 3",
    day: "2026-10-09",
    period: "week",
    children: [
      { id: "a", name: "Asha", readingLevel: "developing", overallAccuracy: 70, sessionsCount: 4, dailyActivity: { "2026-10-08": ["read_x"] } },
      { id: "b", name: "Bala", readingLevel: "beginner", overallAccuracy: 40, sessionsCount: 3, dailyActivity: {} },
    ],
    sessions: [
      { studentId: "a", storyTitle: "The Crow", accuracyRate: 80, wpm: 50, durationSeconds: 120, day: "2026-10-08" },
      { studentId: "a", storyTitle: "The Crow", accuracyRate: 70, wpm: 40, durationSeconds: 60, day: "2026-10-01" },
      { studentId: "b", storyTitle: "Rain", accuracyRate: 30, wpm: 20, durationSeconds: 60, day: "2026-09-30" },
      { studentId: "b", storyTitle: "Rain", accuracyRate: 50, wpm: 22, durationSeconds: 60, day: "2026-10-07" },
    ],
    units: [
      { studentId: "a", chapterTitle: "The Crow", day: "2026-10-08", done: true },
      { studentId: "b", chapterTitle: "Rain", day: "2026-10-07", needHelp: true, resolved: true },
      { studentId: "b", chapterTitle: "Sun", day: "2026-10-09", needHelp: true },
    ],
    messages: [{ studentId: "b", createdAt: "2026-10-05T09:00:00Z", assign: { kind: "lab", title: "Adding" }, seenAt: "2026-10-05T10:00:00Z", doneAt: "2026-10-06T10:00:00Z" }],
    competencies: [
      { short: "Fluency", icon: "🏃", achieved: 0, total: 2 },
      { short: "Decoding", icon: "🔤", achieved: 1, total: 2 },
      { short: "Shapes", icon: "🔺", achieved: 2, total: 2 },
    ],
  });
  assert.equal(r.from, "2026-10-03");
  assert.equal(r.reading.sessions, 2);
  assert.equal(r.reading.accuracy, 65); // (80 + 50) / 2
  assert.equal(r.reading.prevAccuracy, 50); // (70 + 30) / 2
  assert.equal(r.reading.minutes, 3);
  assert.equal(r.activeChildren, 2); // Bala read on 7 Oct (session) even with no marker
  assert.deepEqual(r.workbooks, { worked: 3, finished: 1, helpAsked: 2, helpAnswered: 1 });
  assert.deepEqual(r.work, { messages: 1, given: 1, done: 1, seen: 1 });
  assert.deepEqual(r.followUps[0], { studentId: "b", name: "Bala", given: 1, done: 1, accuracyBefore: 30, accuracyAfter: 50, improved: true });
  assert.equal(r.attention[0].name, "Bala");
  assert.match(r.priorities[0], /1 waiting question/);
  assert.ok(r.priorities.some((p) => /Fluency/.test(p)) && r.priorities.some((p) => /Decoding/.test(p)));
  assert.ok(!r.priorities.some((p) => /Shapes/.test(p)));
});
