// Run with: npx tsx --test src/data/learnPlay.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LAB_CHAPTERS,
  answerOptions,
  labChaptersFor,
  makeAdditionProblem,
  makeSubtractionProblem,
  mathsLimitForGrade,
} from "./learnPlay";

const GRADES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

describe("maths problems", () => {
  test("addition stays within the class limit with valid choices", () => {
    for (const grade of GRADES) {
      for (let i = 0; i < 300; i++) {
        const p = makeAdditionProblem(grade);
        assert.ok(p.a >= 1 && p.b >= 1, grade);
        assert.equal(p.answer, p.a + p.b);
        assert.ok(p.answer <= mathsLimitForGrade(grade), `${grade}: ${p.a}+${p.b}`);
        assert.equal(new Set(p.options).size, 3);
        assert.ok(p.options.includes(p.answer));
        assert.ok(p.options.every((o) => o >= 0));
      }
    }
  });

  test("subtraction never goes below zero and stays countable", () => {
    for (const grade of GRADES) {
      for (let i = 0; i < 300; i++) {
        const p = makeSubtractionProblem(grade);
        assert.ok(p.b >= 1 && p.b < p.a, `${p.a}-${p.b}`);
        assert.ok(p.a <= 20);
        assert.equal(p.answer, p.a - p.b);
        assert.ok(p.options.includes(p.answer) && p.options.every((o) => o >= 0));
      }
    }
  });

  test("answer choices for zero are still three non-negative numbers", () => {
    const options = answerOptions(0, () => 0.1);
    assert.equal(new Set(options).size, 3);
    assert.ok(options.includes(0) && options.every((o) => o >= 0));
  });
});

describe("chapters", () => {
  test("every subject tile has chapters, and every chapter is complete", () => {
    for (const subject of ["English", "Maths", "Science", "Social", "Hindi", "Telugu"]) {
      assert.ok(labChaptersFor(subject).length >= 1, subject);
    }
    const ids = new Set<string>();
    for (const c of LAB_CHAPTERS) {
      assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
      ids.add(c.id);
      assert.ok(c.learn.length >= 3 && c.readAloud.length >= 1, c.id);
      assert.equal(c.quiz.length, 3, c.id);
      for (const q of c.quiz) assert.ok(q.correctOptionIndex >= 0 && q.correctOptionIndex < q.options.length, c.id);
      if (c.game.kind === "wordbuild") {
        for (const w of c.game.words) assert.equal(w.tiles.join(""), w.word, `${c.id}: ${w.word}`);
      }
    }
  });
});
