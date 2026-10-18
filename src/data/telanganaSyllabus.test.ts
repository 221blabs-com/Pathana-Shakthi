// Run with: npx tsx --test src/data/telanganaSyllabus.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TELANGANA_SYLLABUS, syllabusFor, syllabusLabIds, syllabusTitleKey } from "./telanganaSyllabus";
import { LAB_CHAPTERS, labCardsFor, labChapterById, labChaptersFor } from "./learnPlay";

const HIGH = [6, 7, 8, 9, 10];

test("Classes 6-10 have a textbook syllabus for every subject tile", () => {
  for (const n of HIGH) {
    for (const subject of ["English", "Maths", "Science", "Social", "Hindi", "Telugu"]) {
      const books = syllabusFor(`Class ${n}`, subject);
      assert.ok(books.length >= 1, `Class ${n} ${subject}`);
      for (const book of books) {
        const chapters = book.units.flatMap((u) => u.chapters);
        assert.ok(chapters.length >= 3, `Class ${n} ${subject} ${book.book}`);
        for (const c of chapters) assert.ok(c.title.trim().length > 1, `Class ${n} ${subject}`);
      }
    }
  }
  assert.deepEqual(syllabusFor("Class 5", "Maths"), [], "no syllabus below Class 6");
});

test("every syllabus lab exists as a simulation chapter, and every simulation chapter is used", () => {
  const used = new Set<string>();
  for (const n of HIGH) for (const id of syllabusLabIds(`Class ${n}`)) used.add(id);
  for (const id of used) {
    const lab = labChapterById(id);
    assert.ok(lab, `missing lab ${id}`);
    assert.equal(lab!.game.kind, "sim", id);
  }
  for (const c of LAB_CHAPTERS.filter((c) => c.game.kind === "sim")) assert.ok(used.has(c.id), `unused lab ${c.id}`);
  for (const [n, books] of Object.entries(TELANGANA_SYLLABUS)) {
    for (const b of books) {
      for (const u of b.units) {
        for (const c of u.chapters) {
          if (c.labId) assert.equal(labChapterById(c.labId)!.subject, b.subject, `Class ${n}: ${c.title}`);
        }
      }
    }
  }
});

test("a lab shows only in the classes whose syllabus teaches it, with enough cards", () => {
  const ids = (subject: string, grade: string) => labChaptersFor(subject, grade).map((c) => c.id);
  assert.ok(ids("Science", "Class 9").includes("hs-refraction"));
  assert.ok(!ids("Science", "Class 9").includes("hs-lens"));
  assert.ok(ids("Science", "Class 10").includes("hs-lens"));
  assert.ok(ids("Maths", "Class 6").includes("hs-integers"));
  assert.ok(!ids("Maths", "Class 10").includes("hs-integers"));
  assert.ok(!ids("Science", "Class 5").some((id) => id.startsWith("hs-")), "no labs below Class 6");
  for (const n of HIGH) {
    for (const id of syllabusLabIds(`Class ${n}`)) {
      const cards = labCardsFor(labChapterById(id)!, `Class ${n}`);
      assert.ok(cards.length >= 3, `Class ${n} ${id}: ${cards.length} cards`);
      assert.ok(cards.every((c) => c.sim), `Class ${n} ${id}: every card has a simulation`);
    }
  }
  const circuit = labChapterById("hs-circuits")!;
  assert.ok(!labCardsFor(circuit, "Class 6").some((c) => /Ohm/.test(c.title)), "Class 6 does not get Ohm's law");
  assert.ok(labCardsFor(circuit, "Class 10").some((c) => /Ohm/.test(c.title)));
});

test("title keys match OCR chapter titles loosely", () => {
  assert.equal(syllabusTitleKey("Chapter 3: Playing with Magnets"), syllabusTitleKey("Playing with Magnets"));
  assert.equal(syllabusTitleKey("Motion (Part 2 of 3)"), syllabusTitleKey("Motion"));
  assert.notEqual(syllabusTitleKey("Integers"), syllabusTitleKey("Fractions"));
});
