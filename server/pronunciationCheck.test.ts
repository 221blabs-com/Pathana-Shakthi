import test from "node:test";
import assert from "node:assert/strict";
import { allSpeechItems, experimentItems, pronunciationLogLines, runPronunciationCheck } from "./pronunciationCheck";
import { isSingleWord, ttsRequestSettings, withFullStop } from "./ttsSettings";

test("every dictionary word, sentence and Learn & Play line is checked once, in its own script's language", () => {
  const items = allSpeechItems();
  assert.ok(items.length > 300, `only ${items.length} items`);
  assert.ok(items.some((i) => i.text === "పిల్లి" && i.code === "te-IN"));
  assert.ok(items.some((i) => i.text === "माँ" && i.code === "hi-IN"));
  assert.ok(items.some((i) => i.source.includes("read-aloud")));
  assert.equal(new Set(items.map((i) => `${i.code}|${i.text}`)).size, items.length);
  const exp = experimentItems(5);
  assert.ok(exp.every((i) => isSingleWord(i.text)));
  assert.equal(exp.filter((i) => i.code === "en-IN").length, 5);
});

test("lone words can end with the script's full stop; sentences are left alone", () => {
  assert.equal(withFullStop("పిల్లి", "te-IN"), "పిల్లి.");
  assert.equal(withFullStop("माँ", "hi-IN"), "माँ।");
  assert.equal(withFullStop("river.", "en-IN"), "river.");
  assert.equal(ttsRequestSettings("The cat sat.", "en-IN", 1).text, "The cat sat.");
});

test("a mispronounced word is reported with what was heard, and Gemini can overrule a mishearing", async () => {
  const fakeFetch = (async (url: string, init: any) => {
    if (String(url).includes("text-to-speech")) {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ audios: [Buffer.from(body.text).toString("base64")] }), { status: 200 });
    }
    const said = Buffer.from(await (init.body.get("file") as Blob).arrayBuffer()).toString();
    return new Response(JSON.stringify({ transcript: said.startsWith("పిల్లి") ? "పెళ్లి" : said }), { status: 200 });
  }) as any;
  const items = [
    { text: "పిల్లి", code: "te-IN", source: "dictionary word (Telugu)" },
    { text: "माँ", code: "hi-IN", source: "dictionary word (Hindi)" },
  ];
  const exp = await runPronunciationCheck("experiment", { sarvamKeys: ["k1", "k2"], fetchImpl: fakeFetch }, { items, wordTrials: 2 });
  assert.equal(exp.variants.length, 4);
  assert.equal(exp.variants[0].byLanguage["hi-IN"], 100);
  assert.equal(exp.variants[0].byLanguage["te-IN"], 0);
  assert.ok(pronunciationLogLines(exp).some((l) => l.includes("MISS") && l.includes("పెళ్లి")));

  const verified = await runPronunciationCheck(
    "verify",
    { sarvamKeys: ["k1"], fetchImpl: fakeFetch, geminiTranscribe: async () => "పిల్లి" },
    { items, wordTrials: 1 }
  );
  // both voices for lone words; Gemini's second opinion turns the Telugu miss into a pass
  assert.equal(verified.results.length, 4);
  assert.ok(verified.results.every((r) => r.passes === r.trials));
});
