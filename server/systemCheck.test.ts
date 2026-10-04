import test from "node:test";
import assert from "node:assert/strict";
import { normalizeForMatch, runSystemCheck, wordMatchPercent } from "./systemCheck";

test("wordMatchPercent ignores punctuation, case and Hindi spelling variants", () => {
  assert.equal(wordMatchPercent("The river flows.", "the river flows"), 100);
  assert.equal(wordMatchPercent("माँ", "मां।"), 100);
  assert.equal(wordMatchPercent("पेड़", "पेड"), 100);
  assert.equal(wordMatchPercent("a b c d", "a b"), 50);
  assert.equal(wordMatchPercent("", "anything"), 0);
  assert.deepEqual(normalizeForMatch("Hello, World!"), ["hello", "world"]);
});

test("runSystemCheck reports each service and never throws", async () => {
  const wav = Buffer.from("RIFFfakewav");
  const fakeFetch = (async (url: string, init: any) => {
    if (String(url).includes("text-to-speech")) {
      const body = JSON.parse(init.body);
      if (init.headers["api-subscription-key"] === "sk_dead") {
        return new Response(JSON.stringify({ error: { message: "Insufficient credits" } }), { status: 402 });
      }
      (fakeFetch as any).lastText = body.text;
      return new Response(JSON.stringify({ audios: [wav.toString("base64")] }), { status: 200 });
    }
    return new Response(JSON.stringify({ transcript: (fakeFetch as any).lastText }), { status: 200 });
  }) as any;
  const report = await runSystemCheck(
    {
      sarvamKeys: ["sk_dead", "sk_live"],
      geminiKeys: ["AQ.one"],
      firestorePing: async () => "ok",
      geminiPing: async () => "ok",
      geminiTranscribe: async () => "the river flows near the garden and the forest",
      fetchImpl: fakeFetch,
    },
    "test"
  );
  const dead = report.results.find((r) => r.name.includes("key 1 of 2"));
  assert.equal(dead?.status, "fail");
  assert.match(dead!.detail, /402/);
  assert.equal(report.results.find((r) => r.name.includes("key 2 of 2"))?.status, "pass");
  assert.ok(report.results.some((r) => r.group === "Voices" && r.status === "pass"));
  assert.ok(report.results.some((r) => r.group === "Reported words"));
  assert.equal(report.results.find((r) => r.group === "Fallbacks")?.status, "pass");
  assert.equal(report.summary.fail, 1);
});
