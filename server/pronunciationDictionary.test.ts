import test from "node:test";
import assert from "node:assert/strict";
import { SarvamDictionaries, dictionaryFile, dictionaryHash, keyFingerprint } from "./pronunciationDictionary";

test("dictionary file has Sarvam's shape; English words also capitalised", () => {
  const file = dictionaryFile({ "en-IN": { hand: "haand" }, "hi-IN": { "हाथ": "हाथ्" }, "te-IN": {} });
  assert.deepEqual(file, {
    pronunciations: { "en-IN": { hand: "haand", Hand: "Haand", HAND: "HAAND" }, "hi-IN": { "हाथ": "हाथ्" } },
  });
  assert.notEqual(dictionaryHash(file), dictionaryHash(dictionaryFile({ "en-IN": { hand: "hannd" } })));
  assert.equal(keyFingerprint("sk_secret").includes("secret"), false);
});

function fakeSarvam() {
  const dicts = new Map<string, string>();
  let n = 0;
  const calls: string[] = [];
  const impl = (async (url: string, init: any = {}) => {
    const method = init.method || "GET";
    calls.push(`${method} ${url.replace("https://api.sarvam.ai/text-to-speech/pronunciation-dictionary", "")}`);
    if (method === "GET") {
      const id = decodeURIComponent(url.split("/").pop()!);
      return new Response("{}", { status: dicts.has(id) ? 200 : 404 });
    }
    const body = await (init.body.get("file") as Blob).text();
    if (method === "POST") {
      const id = `p_${++n}`;
      dicts.set(id, body);
      return new Response(JSON.stringify({ dictionary_id: id }), { status: 200 });
    }
    const id = new URL(url).searchParams.get("dict_id")!;
    dicts.set(id, body);
    return new Response(JSON.stringify({ dictionary_id: id }), { status: 200 });
  }) as any;
  return { impl, dicts, calls };
}

test("one dictionary per key: created once, reused, updated in place when the fixes change", async () => {
  const sarvam = fakeSarvam();
  let saved: any = {};
  const store = { load: async () => saved, save: async (e: any) => void (saved = e) };
  const fileA = dictionaryFile({ "en-IN": { hand: "haand" } });

  const first = new SarvamDictionaries(sarvam.impl);
  const lines = await first.ensure(["sk_one", "sk_two"], store, fileA);
  assert.match(lines[0], /created/);
  assert.equal(first.dictIdFor("sk_one"), "p_1");
  assert.equal(first.dictIdFor("sk_two"), "p_2");
  assert.equal(first.dictIdFor("sk_other"), undefined);

  // restart with the same fixes: nothing uploaded
  const second = new SarvamDictionaries(sarvam.impl);
  sarvam.calls.length = 0;
  assert.match((await second.ensure(["sk_one", "sk_two"], store, fileA))[0], /up to date/);
  assert.ok(sarvam.calls.every((c) => c.startsWith("GET")));

  // fixes changed: same ids, new content
  const fileB = dictionaryFile({ "en-IN": { hand: "hannd" } });
  const third = new SarvamDictionaries(sarvam.impl);
  assert.match((await third.ensure(["sk_one"], store, fileB))[0], /updated/);
  assert.equal(third.dictIdFor("sk_one"), "p_1");
  assert.match(sarvam.dicts.get("p_1")!, /hannd/);
});

test("a key that cannot make a dictionary is reported, and TTS goes on without one", async () => {
  const failing = (async () => new Response(JSON.stringify({ error: { message: "forbidden" } }), { status: 403 })) as any;
  const d = new SarvamDictionaries(failing);
  const lines = await d.ensure(["sk_x"], { load: async () => ({}), save: async () => {} }, dictionaryFile({ "en-IN": { a: "b" } }));
  assert.match(lines[0], /not available.*403/);
  assert.equal(d.dictIdFor("sk_x"), undefined);
  assert.deepEqual(await d.ensure(["sk_x"], { load: async () => ({}), save: async () => {} }, { pronunciations: {} }), ["no pronunciation fixes to upload"]);
});
