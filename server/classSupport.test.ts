import test from "node:test";
import assert from "node:assert/strict";
import { supportFor } from "./classSupport";

const today = "2026-10-09";
const child = { id: "s1", name: "Ravi Kumar" };

test("an open help request puts the child in Need Help with the question", () => {
  const r = supportFor({ ...child, sessionsCount: 5, overallAccuracy: 92 }, [
    { readingId: "r1", chapterTitle: "Let's Be Friends", needHelp: true, helpQuestion: "What is cordial?", updatedAt: "2026-10-09T08:00:00Z" },
  ], today);
  assert.equal(r.status, "need_help");
  assert.deepEqual(r.questions.map((q) => q.question), ["What is cordial?"]);
  assert.match(r.reasons[0], /Let's Be Friends/);
});

test("an answered request no longer counts", () => {
  const r = supportFor({ ...child, sessionsCount: 5, overallAccuracy: 92, readingLevel: "proficient" }, [
    { readingId: "r1", chapterTitle: "A", needHelp: true, resolved: true, outcomes: [2, 2], updatedAt: "2026-10-09T08:00:00Z" },
  ], today);
  assert.equal(r.status, "very_good");
  assert.equal(r.questions.length, 0);
});

test("low accuracy or 'not yet' outcomes mean Need Help", () => {
  assert.equal(supportFor({ ...child, sessionsCount: 3, overallAccuracy: 40 }, [], today).status, "need_help");
  assert.equal(supportFor({ ...child, sessionsCount: 1, overallAccuracy: 40 }, [], today).status, "go_ahead"); // one reading is not enough
  const r = supportFor({ ...child, sessionsCount: 3, overallAccuracy: 75 }, [
    { readingId: "r2", chapterTitle: "Plants", outcomes: [0, 0, 1], updatedAt: "2026-10-08T08:00:00Z" },
  ], today);
  assert.equal(r.status, "need_help");
  assert.match(r.reasons.join(" "), /not yet/);
});

test("strong readers are Very Good unless their last workbook was weak", () => {
  assert.equal(supportFor({ ...child, sessionsCount: 4, overallAccuracy: 90 }, [], today).status, "very_good");
  assert.equal(
    supportFor({ ...child, sessionsCount: 4, overallAccuracy: 90 }, [{ readingId: "r", outcomes: [1, 1], updatedAt: "x" }], today).status,
    "go_ahead"
  );
});

test("a child who has not started is Go Ahead with a plain reason", () => {
  const r = supportFor(child, [], today);
  assert.equal(r.status, "go_ahead");
  assert.deepEqual(r.reasons, ["Has not started reading yet"]);
});
