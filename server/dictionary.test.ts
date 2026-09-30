// Parsing of Oxford Dictionaries API v2 responses (no network).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseOxfordEntry, parseOxfordLemma } from "./dictionary";

describe("Oxford dictionary responses", () => {
  test("takes the first sense with a definition", () => {
    const entry = parseOxfordEntry({
      results: [
        {
          id: "tavern",
          word: "tavern",
          lexicalEntries: [
            {
              lexicalCategory: { id: "noun", text: "Noun" },
              entries: [
                {
                  pronunciations: [{ phoneticSpelling: "ˈtav(ə)n" }],
                  senses: [
                    { id: "x" },
                    { definitions: ["an inn or public house"], examples: [{ text: "a village tavern" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    assert.deepEqual(entry, {
      word: "tavern",
      partOfSpeech: "noun",
      definition: "An inn or public house",
      example: "a village tavern",
      phonetic: "ˈtav(ə)n",
      source: "oxford",
    });
  });

  test("no senses or an error body is not a word", () => {
    assert.equal(parseOxfordEntry({ results: [{ word: "x", lexicalEntries: [{ entries: [{ senses: [] }] }] }] }), null);
    assert.equal(parseOxfordEntry({ error: "No entry found" }), null);
    assert.equal(parseOxfordEntry(null), null);
  });

  test("an inflected form points to its headword", () => {
    assert.equal(
      parseOxfordLemma({ results: [{ lexicalEntries: [{ inflectionOf: [{ id: "mango", text: "mango" }] }] }] }),
      "mango"
    );
    assert.equal(parseOxfordLemma({ results: [] }), null);
  });
});
