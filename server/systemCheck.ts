// End-to-end health check of the live services a classroom depends on:
// Firestore, every Sarvam key, Sarvam voices in all three languages (each
// clip is transcribed back with Sarvam STT and compared with what was
// meant), the words teachers reported as mispronounced, every Gemini key and
// the Gemini speech-recognition fallback. Runs once per deploy and on demand
// from the SuperAdmin page; results are logged as [CHECK] lines.

import { ttsRequestSettings } from "./ttsSettings";
import { phoneticKey } from "../src/services/phonetic";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  group: string;
  name: string;
  status: CheckStatus;
  detail: string;
  ms: number;
}

export interface SystemCheckReport {
  startedAt: string;
  finishedAt: string;
  fingerprint: string;
  summary: { pass: number; warn: number; fail: number };
  results: CheckResult[];
}

// Spelling differences STT may return for the same sound: chandrabindu vs
// anusvara (माँ / मां), nukta (पेड़ / पेड), punctuation and case.
// Speech recognition writes numbers as digits ("five" -> "5"), American
// spellings ("colour" -> "color") and one of several sound-alike words; none
// of these is a pronunciation problem, so both sides are put in one form.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};
const SAME_SOUND: Record<string, string> = {
  i: "eye", colour: "color", colourful: "colorful", vapour: "vapor", favourite: "favorite",
  neighbour: "neighbor", behaviour: "behavior", centre: "center", metre: "meter", grey: "gray",
  "\u092F\u0939": "\u092F\u0947", // यह -> ये
  "\u0935\u0939": "\u0935\u094B", // वह -> वो
};

function canonicalWords(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = SAME_SOUND[words[i]] || words[i];
    const n = NUMBER_WORDS[w];
    if (n !== undefined) {
      // "twenty eight" -> 28
      const next = NUMBER_WORDS[words[i + 1]];
      if (n >= 20 && n % 10 === 0 && n < 100 && next !== undefined && next < 10) {
        out.push(String(n + next));
        i++;
      } else out.push(String(n));
      continue;
    }
    out.push(w);
  }
  return out;
}

export function normalizeForMatch(text: string): string[] {
  const words = String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\u0901/g, "\u0902")
    .replace(/\u093C/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return canonicalWords(words);
}

/**
 * Share (0-100) of the expected words that appear in the transcript. Speech
 * recognition sometimes joins two spoken words ("పిల్లిపాలు") or splits one;
 * those count as heard, since the voice said them correctly.
 */
export function wordMatchPercent(expected: string, transcript: string): number {
  const want = normalizeForMatch(expected);
  if (want.length === 0) return 0;
  const heard = normalizeForMatch(transcript);
  const pool = [...heard];
  // a split word: two heard tokens that make one expected word
  for (let i = 0; i + 1 < pool.length; i++) {
    const merged = pool[i] + pool[i + 1];
    if (want.includes(merged) && !want.includes(pool[i])) pool.splice(i, 2, merged);
  }
  let found = 0;
  for (let i = 0; i < want.length; i++) {
    const at = pool.indexOf(want[i]);
    if (at >= 0) {
      found++;
      pool.splice(at, 1);
      continue;
    }
    // joined words: one heard token that is this word and the next one or two
    for (const n of [2, 3]) {
      if (i + n > want.length) break;
      const joinedAt = pool.indexOf(want.slice(i, i + n).join(""));
      if (joinedAt >= 0) {
        found += n;
        pool.splice(joinedAt, 1);
        i += n - 1;
        break;
      }
    }
  }
  return Math.round((found / want.length) * 100);
}

export const VOICE_SAMPLES: Array<{ language: string; code: string; text: string }> = [
  { language: "English", code: "en-IN", text: "The river flows near the garden and the forest." },
  { language: "Telugu", code: "te-IN", text: "పిల్లి పాలు తాగుతుంది." },
  { language: "Hindi", code: "hi-IN", text: "मेरी माँ बहुत अच्छी है।" },
];

// Words teachers reported as sounding wrong, said at the slow tap pace.
export const PROBLEM_WORDS: Array<{ code: string; word: string }> = [
  { code: "hi-IN", word: "माँ" },
  { code: "hi-IN", word: "कुत्ता" },
  { code: "hi-IN", word: "पेड़" },
  { code: "hi-IN", word: "आँख" },
  { code: "te-IN", word: "పిల్లి" },
  { code: "en-IN", word: "river" },
  { code: "en-IN", word: "garden" },
  { code: "en-IN", word: "forest" },
];

export const VOICES = [
  { speaker: "priya", gender: "female" },
  { speaker: "shubh", gender: "male" },
];

// Which female voice speaks English most clearly (teachers said the female
// voice "is not proper"): each is spoken, transcribed back and scored.
export const ENGLISH_CLARITY_SENTENCES = [
  "The river flows near the garden and the forest.",
  "The thirsty crow dropped pebbles into the pot.",
  "My mother reads a story to me every night.",
];
export const FEMALE_SPEAKERS = ["priya", "neha", "ishita", "suhani"];

export interface SystemCheckDeps {
  sarvamKeys: string[];
  geminiKeys: string[];
  firestorePing: () => Promise<string>;
  geminiPing: (keyIndex: number) => Promise<string>;
  geminiTranscribe: (wav: Buffer, languageName: string) => Promise<string>;
  fetchImpl?: typeof fetch;
}

function keyLabel(keys: string[], index: number): string {
  return `key ${index + 1} of ${keys.length} (…${keys[index].slice(-4)})`;
}

export async function runSystemCheck(deps: SystemCheckDeps, fingerprint: string): Promise<SystemCheckReport> {
  const doFetch = deps.fetchImpl || fetch;
  const results: CheckResult[] = [];
  const startedAt = new Date().toISOString();

  const record = async (group: string, name: string, fn: () => Promise<{ status: CheckStatus; detail: string }>) => {
    const t = Date.now();
    try {
      const { status, detail } = await fn();
      results.push({ group, name, status, detail, ms: Date.now() - t });
    } catch (error: any) {
      results.push({ group, name, status: "fail", detail: String(error?.message || error).slice(0, 200), ms: Date.now() - t });
    }
  };

  await record("Database", "Firestore read", async () => ({ status: "pass", detail: await deps.firestorePing() }));

  // Which Sarvam keys answer at all; the first working one runs the voice checks.
  let sarvamKey = "";
  for (let i = 0; i < deps.sarvamKeys.length; i++) {
    await record("Sarvam keys", keyLabel(deps.sarvamKeys, i), async () => {
      const audio = await sarvamTts(doFetch, deps.sarvamKeys[i], "Hi", "en-IN", "priya", 1);
      if (!sarvamKey) sarvamKey = deps.sarvamKeys[i];
      return { status: "pass", detail: `answered (${Math.round(audio.length / 1024)} KB)` };
    });
  }
  if (deps.sarvamKeys.length === 0) {
    results.push({ group: "Sarvam keys", name: "SARVAM_API_KEY", status: "fail", detail: "not configured", ms: 0 });
  }

  const englishClips: Buffer[] = [];
  if (sarvamKey) {
    for (const sample of VOICE_SAMPLES) {
      for (const voice of VOICES) {
        for (const pace of [1, 0.8]) {
          await record("Voices", `${sample.language} ${voice.gender} (${voice.speaker}) pace ${pace}`, async () => {
            const audio = await sarvamTts(doFetch, sarvamKey, sample.text, sample.code, voice.speaker, pace);
            if (sample.code === "en-IN" && pace === 1) englishClips.push(audio);
            if (pace !== 1) return { status: "pass", detail: `audio ${Math.round(audio.length / 1024)} KB` };
            const heard = await sarvamStt(doFetch, sarvamKey, audio, sample.code);
            const match = wordMatchPercent(sample.text, heard);
            return {
              status: match >= 80 ? "pass" : match >= 50 ? "warn" : "fail",
              detail: `${match}% of words heard back: "${heard}"`,
            };
          });
        }
      }
    }
    for (const speaker of FEMALE_SPEAKERS) {
      await record("English female voices", speaker, async () => {
        const scores: number[] = [];
        const misheard: string[] = [];
        for (const sentence of ENGLISH_CLARITY_SENTENCES) {
          const audio = await sarvamTts(doFetch, sarvamKey, sentence, "en-IN", speaker, 1);
          const heard = await sarvamStt(doFetch, sarvamKey, audio, "en-IN");
          const score = wordMatchPercent(sentence, heard);
          scores.push(score);
          if (score < 100) misheard.push(`"${heard}"`);
        }
        const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return {
          status: average >= 90 ? "pass" : "warn",
          detail: `${average}% clear (${scores.join("/")})${misheard.length ? ` · heard ${misheard.join(", ")}` : ""}`,
        };
      });
    }
    for (const item of PROBLEM_WORDS) {
      await record("Reported words", `${item.word} (${item.code}, slow)`, async () => {
        const audio = await sarvamTts(doFetch, sarvamKey, item.word, item.code, "priya", 0.8);
        const heard = await sarvamStt(doFetch, sarvamKey, audio, item.code);
        const match = wordMatchPercent(item.word, heard);
        // పిలి for పిల్లి, వానా for వాన: the same word in another spelling.
        const sameWord = match === 100 || phoneticKey(item.word) === phoneticKey(heard);
        return {
          status: sameWord ? "pass" : "warn",
          detail: `heard back as "${heard}"${match < 100 && sameWord ? " (another spelling of the same word)" : ""}`,
        };
      });
    }
  }

  for (let i = 0; i < deps.geminiKeys.length; i++) {
    await record("Gemini keys", keyLabel(deps.geminiKeys, i), async () => ({ status: "pass", detail: await deps.geminiPing(i) }));
  }
  if (deps.geminiKeys.length === 0) {
    results.push({ group: "Gemini keys", name: "GEMINI_API_KEY", status: "fail", detail: "not configured", ms: 0 });
  }
  if (englishClips[0] && deps.geminiKeys.length > 0) {
    await record("Fallbacks", "Gemini speech recognition (English)", async () => {
      const heard = await deps.geminiTranscribe(englishClips[0], "English");
      const match = wordMatchPercent(VOICE_SAMPLES[0].text, heard);
      return { status: match >= 80 ? "pass" : "warn", detail: `${match}%: "${heard}"` };
    });
  }

  const summary = { pass: 0, warn: 0, fail: 0 };
  results.forEach((r) => summary[r.status]++);
  return { startedAt, finishedAt: new Date().toISOString(), fingerprint, summary, results };
}

async function sarvamTts(
  doFetch: typeof fetch,
  key: string,
  text: string,
  languageCode: string,
  speaker: string,
  pace: number
): Promise<Buffer> {
  const response = await doFetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": key },
    // The same text/temperature the live /api/speech/synthesize route sends.
    body: JSON.stringify({ ...ttsRequestSettings(text, languageCode, pace), model: "bulbul:v3", language_code: languageCode, speaker, speech_sample_rate: 24000 }),
    signal: AbortSignal.timeout(30_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data?.audios?.[0]) {
    throw new Error(`TTS HTTP ${response.status}: ${data?.error?.message || data?.message || "no audio"}`);
  }
  return Buffer.from(data.audios[0], "base64");
}

async function sarvamStt(doFetch: typeof fetch, key: string, wav: Buffer, languageCode: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "check.wav");
  form.append("model", "saaras:v4");
  form.append("mode", "transcribe");
  form.append("language_code", languageCode);
  const response = await doFetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`STT HTTP ${response.status}: ${data?.error?.message || data?.message || ""}`);
  return String(data?.transcript || "").trim();
}
