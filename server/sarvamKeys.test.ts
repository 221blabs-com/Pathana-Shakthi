import test from "node:test";
import assert from "node:assert/strict";
import { SarvamKeyPool, parseSarvamKeys } from "./sarvamKeys";

test("parseSarvamKeys splits on commas/spaces and drops blanks and repeats", () => {
  assert.deepEqual(parseSarvamKeys(" sk_a, sk_b ;sk_c  sk_a,,"), ["sk_a", "sk_b", "sk_c"]);
  assert.deepEqual(parseSarvamKeys(undefined), []);
  assert.deepEqual(parseSarvamKeys("sk_only"), ["sk_only"]);
});

test("a key with no credits is skipped and the next key answers", () => {
  let now = 1000;
  const pool = new SarvamKeyPool(["sk_a", "sk_b", "sk_c"], 600_000, () => now);
  const first = pool.next()!;
  assert.equal(first.value, "sk_a");
  assert.deepEqual(pool.noteAccountProblem(first, 402, "Insufficient credits"), { accountProblem: true, wasNew: true });
  assert.equal(pool.next()!.value, "sk_b");
  // the working key stays in use
  assert.equal(pool.next()!.value, "sk_b");
  assert.equal(pool.availableCount(), 2);
  assert.equal(pool.blockedReason(), null);
});

test("rate limits and server errors do not block a key", () => {
  const pool = new SarvamKeyPool(["sk_a", "sk_b"], 600_000);
  const key = pool.next()!;
  assert.deepEqual(pool.noteAccountProblem(key, 429, "rate limited"), { accountProblem: false, wasNew: false });
  assert.deepEqual(pool.noteAccountProblem(key, 500, "oops"), { accountProblem: false, wasNew: false });
  assert.equal(pool.next()!.value, "sk_a");
});

test("all keys blocked gives a reason, and keys come back after the pause", () => {
  let now = 0;
  const pool = new SarvamKeyPool(["sk_a", "sk_b"], 1000, () => now);
  pool.noteAccountProblem(pool.next()!, 402, "Insufficient credits");
  const second = pool.noteAccountProblem(pool.next()!, 403, "Invalid key");
  assert.equal(second.wasNew, true);
  assert.equal(pool.next(), null);
  assert.match(pool.blockedReason()!, /Insufficient credits \(HTTP 402\); Invalid key \(HTTP 403\)/);
  now = 1500;
  assert.ok(pool.next());
  assert.equal(pool.blockedReason(), null);
});

test("a repeated failure on an already-blocked key is not new", () => {
  const pool = new SarvamKeyPool(["sk_a"], 1000, () => 0);
  const key = pool.next()!;
  assert.equal(pool.noteAccountProblem(key, 402, "x").wasNew, true);
  assert.equal(pool.noteAccountProblem(key, 402, "x").wasNew, false);
});

test("labels never contain the whole key", () => {
  const pool = new SarvamKeyPool(["sk_test_fakekeyAbCd"], 1000);
  assert.equal(pool.label(0), "key 1 of 1 (…AbCd)");
  assert.equal(new SarvamKeyPool([], 1000).blockedReason(), null);
});
