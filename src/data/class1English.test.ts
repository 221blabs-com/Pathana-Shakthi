// Run with: npx tsx --test src/data/class1English.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CLASS1_ENGLISH_UNITS,
  LESSON_STEPS,
  beginningSoundRounds,
  lettersInOrder,
  missingLetterRounds,
  nextStep,
  periodPlanFor,
  sightWordRounds,
  sightWordsUpTo,
  unitUnlocked,
  englishClassProgress,
  englishStepGameId,
} from "./class1English";

describe("Class 1 English course content", () => {
  test("8 units numbered 1-8 with unique ids", () => {
    assert.equal(CLASS1_ENGLISH_UNITS.length, 8);
    assert.deepEqual(CLASS1_ENGLISH_UNITS.map((u) => u.number), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(new Set(CLASS1_ENGLISH_UNITS.map((u) => u.id)).size, 8);
  });

  test("all 26 letters taught exactly once", () => {
    const letters = lettersInOrder().map((l) => l.letter);
    assert.equal(letters.length, 26);
    assert.deepEqual([...letters].sort().join(""), "abcdefghijklmnopqrstuvwxyz");
  });

  test("each letter's picture words start (or end) with it", () => {
    for (const l of lettersInOrder()) {
      for (const w of l.words) {
        const ok = l.position === "end" ? w.word.endsWith(l.letter) : w.word.startsWith(l.letter);
        assert.ok(ok, `${l.letter}: ${w.word}`);
        assert.ok(w.emoji, w.word);
      }
    }
  });

  test("every unit has complete content", () => {
    for (const u of CLASS1_ENGLISH_UNITS) {
      assert.ok(u.pictureTalk.items.length >= 5, u.id);
      assert.ok(u.pictureTalk.prompts.length >= 3, u.id);
      assert.ok(u.story.lines.length >= 5, u.id);
      assert.ok(u.rhyme.lines.length >= 4, u.id);
      assert.ok(u.sightWords.length >= 3, u.id);
      assert.ok(u.readAloud.length >= 3, u.id);
      assert.ok(u.outcomes.length >= 3, u.id);
      assert.ok(u.draw.prompt && u.draw.starter, u.id);
      for (const lq of u.story.questions) {
        assert.ok(lq.answer >= 0 && lq.answer < lq.options.length, `${u.id}: ${lq.question}`);
      }
      for (const qz of u.quiz) {
        assert.ok(qz.correctOptionIndex >= 0 && qz.correctOptionIndex < qz.options.length, `${u.id}: ${qz.question}`);
      }
    }
  });

  test("sight words are cumulative and unique across the course", () => {
    const all = sightWordsUpTo(8).map((w) => w.toLowerCase());
    assert.equal(new Set(all).size, all.length);
    assert.equal(sightWordsUpTo(1).length, CLASS1_ENGLISH_UNITS[0].sightWords.length);
  });
});

describe("practice rounds", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  test("beginning-sound rounds have one right picture and distinct options", () => {
    for (const u of CLASS1_ENGLISH_UNITS) {
      for (let k = 0; k < 20; k++) {
        const rounds = beginningSoundRounds(u, random);
        assert.equal(rounds.length, u.letters.length * 2);
        for (const r of rounds) {
          assert.equal(r.options.length, 3, `${u.id}: ${r.prompt}`);
          assert.equal(new Set(r.options.map((o) => o.word)).size, 3);
          const letter = r.prompt.match(/“(.)”/)![1];
          const end = r.prompt.includes("ends");
          const matches = r.options.filter((o) => (end ? o.word.endsWith(letter) : o.word.startsWith(letter)));
          assert.equal(matches.length, 1, `${u.id}: ${r.prompt} ${r.options.map((o) => o.word)}`);
          assert.equal(r.options[r.answer], matches[0]);
        }
      }
    }
  });

  test("sight-word and missing-letter rounds have the answer among 3 distinct options", () => {
    for (const u of CLASS1_ENGLISH_UNITS) {
      for (const r of sightWordRounds(u, random)) {
        assert.equal(new Set(r.options).size, 3);
        assert.equal(r.options[r.answer], r.say);
      }
      for (const r of missingLetterRounds(u, random)) {
        assert.equal(new Set(r.options).size, 3);
        assert.equal(r.masked.replace("_", r.options[r.answer]), r.word.word);
      }
    }
  });
});

describe("teacher plan and progress", () => {
  test("period plans are 40-minute periods numbered from 1", () => {
    for (const u of CLASS1_ENGLISH_UNITS) {
      const plan = periodPlanFor(u);
      assert.equal(plan.length, 6 + u.letters.length, u.id);
      plan.forEach((p, i) => {
        assert.equal(p.period, i + 1);
        assert.equal(p.steps.reduce((s, x) => s + x.minutes, 0), 40, `${u.id} period ${p.period}`);
      });
    }
  });

  test("next step and unlocking", () => {
    assert.equal(nextStep(undefined), "talk");
    assert.equal(nextStep({ steps: { talk: true, listen: true }, scores: {} }), "rhyme");
    const all = Object.fromEntries(LESSON_STEPS.map((s) => [s.id, true]));
    assert.equal(nextStep({ steps: all, scores: {} }), "talk");
    assert.equal(unitUnlocked(1, {}), true);
    assert.equal(unitUnlocked(2, {}), false);
    assert.equal(unitUnlocked(2, { "e1-family": { steps: { talk: true, listen: true, rhyme: true, sounds: true }, scores: {} } }), true);
  });
});

describe("class progress for the teacher", () => {
  test("steps, scores, current unit and weak spots from server game records", () => {
    const done = (id: string) => ({ [englishStepGameId("e1-family", id as any)]: { stars: 0, bestScore: 1, total: 1, plays: 1 } });
    const students = [
      {
        id: "a",
        name: "Arjun",
        labProgress: {
          ...done("talk"),
          ...done("rhyme"),
          [englishStepGameId("e1-family", "listen")]: { stars: 3, bestScore: 3, total: 3, plays: 1 },
          [englishStepGameId("e1-family", "sounds")]: { stars: 1, bestScore: 2, total: 6, plays: 2 },
        },
      },
      { id: "b", name: "Bindu", labProgress: {} },
    ];
    const p = englishClassProgress(students);
    const arjun = p.children[0];
    assert.equal(arjun.units["e1-family"].steps, 4);
    assert.deepEqual(arjun.units["e1-family"].scores, { listen: 100, sounds: 33 });
    assert.deepEqual(arjun.weak, ["My Family · Sounds"]);
    assert.equal(arjun.current, "e1-family");
    assert.equal(p.units[0].started, 1);
    assert.equal(p.units[0].finished, 0);
    assert.equal(p.units[0].stepAverages.listen, 100);
    assert.equal(p.children[1].current, "e1-family");
  });
});
