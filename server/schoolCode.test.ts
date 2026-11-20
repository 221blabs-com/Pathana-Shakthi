import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchoolCode, normalizeSchoolCode, SCHOOL_CODE_LENGTH } from "./schoolCode";

test("generated codes are 6 characters with no look-alike letters", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateSchoolCode();
    assert.equal(code.length, SCHOOL_CODE_LENGTH);
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
    assert.equal(normalizeSchoolCode(code), code);
  }
});

test("normalize accepts lower case, spaces and dashes", () => {
  assert.equal(normalizeSchoolCode(" ab3-k9 p"), "AB3K9P");
  assert.equal(normalizeSchoolCode("5hdbmn"), "5HDBMN");
});

test("normalize rejects the wrong length and characters never used in codes", () => {
  assert.equal(normalizeSchoolCode(""), null);
  assert.equal(normalizeSchoolCode(undefined), null);
  assert.equal(normalizeSchoolCode("AB3K9"), null);
  assert.equal(normalizeSchoolCode("AB3K9PX"), null);
  assert.equal(normalizeSchoolCode("AB0K9P"), null); // 0
  assert.equal(normalizeSchoolCode("AB1K9P"), null); // 1
  assert.equal(normalizeSchoolCode("ABOK9P"), null); // O
  assert.equal(normalizeSchoolCode("AB$K9P"), null);
  assert.equal(normalizeSchoolCode({ toString: () => "AB3K9P" } as any), "AB3K9P");
});
