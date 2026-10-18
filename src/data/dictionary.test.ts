// Run with: npx tsx --test src/data/dictionary.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARY_WORDS, dictionaryFor } from "./dictionary";

test("every word is listed once per language and every Telugu/Hindi word has a sentence", () => {
  const seen = new Set<string>();
  for (const w of DICTIONARY_WORDS) {
    const key = `${w.language}|${w.word.toLowerCase()}`;
    assert.ok(!seen.has(key), `duplicate ${key}`);
    seen.add(key);
    assert.ok(w.meaning && w.emoji && w.category, key);
    if (w.language !== "English") {
      assert.ok(w.sounds, `${key} has no sounds`);
      assert.ok(w.example && w.example.includes(w.word.slice(0, 2)), `${key} has no sentence using it`);
    }
  }
});

test("Class 6-10 words reach only the older classes", () => {
  const words = (language: "English" | "Telugu" | "Hindi", grade: string) => dictionaryFor(language, grade).map((w) => w.word);
  for (const language of ["English", "Telugu", "Hindi"] as const) {
    const high = DICTIONARY_WORDS.filter((w) => w.language === language && w.grades[0] >= 6);
    assert.ok(high.length >= 10, `${language}: ${high.length} Class 6-10 words`);
    assert.ok(!high.some((w) => words(language, "Class 5").includes(w.word)), `${language}: none in Class 5`);
    assert.ok(high.every((w) => words(language, "Class 10").includes(w.word)), `${language}: all in Class 10`);
  }
  assert.ok(words("English", "Class 9").includes("probability"));
  assert.ok(!words("English", "Class 8").includes("probability"));
  assert.ok(words("English", "Class 6").includes("cat"), "older classes still see the easy words");
});
