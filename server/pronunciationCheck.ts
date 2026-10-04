// Pronunciation check: every word and line a child can hear (dictionary words
// and their sentences, Learn & Play cards, read-aloud lines and game words) is
// spoken by Sarvam TTS, transcribed back by Sarvam STT and compared with the
// text. When Sarvam's transcription disagrees, Gemini listens to the same clip
// as a second opinion, so a mishearing by one recognizer is not reported as a
// mispronunciation. "experiment" mode compares several TTS settings for lone
// words; "verify" mode checks everything with the settings in use.
import { DICTIONARY_WORDS } from "../src/data/dictionary";
import { LAB_CHAPTERS } from "../src/data/learnPlay";
import { speechLanguageCodeFor } from "./speechLanguage";
import { wordMatchPercent } from "./systemCheck";
import { isSingleWord, ttsRequestSettings, withFullStop } from "./ttsSettings";

export interface SpeechItem {
  text: string;
  code: string;
  source: string;
}

export interface TtsVariant {
  name: string;
  pace: number;
  temperature: number;
  fullStop: boolean;
}

export interface ItemResult {
  text: string;
  code: string;
  source: string;
  variant: string;
  speaker: string;
  trials: number;
  passes: number;
  heard: string[];
  geminiHeard?: string[];
}

export interface PronunciationReport {
  mode: "experiment" | "verify";
  startedAt: string;
  finishedAt: string;
  variants: Array<{ name: string; items: number; trials: number; passRate: number; byLanguage: Record<string, number> }>;
  results: ItemResult[];
}

// The voice-setup sample phrases (src/services/speechSynthesis.ts SARVAM_VOICES).
const VOICE_SAMPLES: Array<[string, string]> = [
  ["Telugu", "నమస్కారం పిల్లలూ! మనం కలిసి ఒక మంచి కథ చదువుదాం!"],
  ["Hindi", "नमस्ते बच्चों! चलो मिलकर एक अच्छी कहानी पढ़ते हैं!"],
  ["English", "Hello children! Let us read a wonderful story together!"],
  ["Telugu", "హాయ్ పిల్లలూ! ఈ రోజు మనం ఒక అద్భుతమైన కథను చదువుదాం!"],
  ["Hindi", "नमस्ते बच्चों! आज हम एक शानदार कहानी पढ़ेंगे!"],
  ["English", "Hi children! Today we are going to read an amazing story!"],
];

/** Every distinct word/line a child can hear, with the language Sarvam is asked for. */
export function allSpeechItems(): SpeechItem[] {
  const seen = new Set<string>();
  const items: SpeechItem[] = [];
  const add = (text: string | undefined, language: string, source: string) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean || !/[\p{L}]/u.test(clean)) return;
    const code = speechLanguageCodeFor(clean, language);
    const key = `${code}|${clean}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ text: clean, code, source });
  };
  for (const w of DICTIONARY_WORDS) {
    add(w.word, w.language, `dictionary word (${w.language})`);
    add(w.example, w.language, `dictionary sentence (${w.word})`);
  }
  for (const chapter of LAB_CHAPTERS) {
    for (const card of chapter.learn) {
      add(card.title, chapter.language, `Learn & Play ${chapter.id} card title`);
      add(card.text, chapter.language, `Learn & Play ${chapter.id} card`);
    }
    for (const line of chapter.readAloud) add(line, chapter.language, `Learn & Play ${chapter.id} read-aloud`);
    if (chapter.game.kind === "wordbuild") {
      for (const w of chapter.game.words) add(w.word, chapter.language, `Learn & Play ${chapter.id} game word`);
    }
  }
  for (const [language, phrase] of VOICE_SAMPLES) add(phrase, language, "voice setup sample");
  return items;
}

/** The lone words used to compare TTS settings: all Telugu/Hindi dictionary words plus English ones. */
export function experimentItems(englishCount = 15): SpeechItem[] {
  const words = allSpeechItems().filter((i) => i.source.startsWith("dictionary word") && isSingleWord(i.text));
  return [
    ...words.filter((i) => i.code !== "en-IN"),
    ...words.filter((i) => i.code === "en-IN").slice(0, englishCount),
  ];
}

/** Telugu lone words (dictionary + Learn & Play game words) for the second, Telugu-only comparison. */
export function teluguWordItems(): SpeechItem[] {
  return allSpeechItems().filter((i) => i.code === "te-IN" && isSingleWord(i.text));
}

export const TELUGU_VARIANTS: TtsVariant[] = [
  { name: "te: temp 0.55 (old)", pace: 0.8, temperature: 0.55, fullStop: false },
  { name: "te: temp 0.2", pace: 0.8, temperature: 0.2, fullStop: false },
  { name: "te: temp 0.2, full stop", pace: 0.8, temperature: 0.2, fullStop: true },
  { name: "te: temp 0.2, pace 1.0", pace: 1.0, temperature: 0.2, fullStop: false },
];

export const EXPERIMENT_VARIANTS: TtsVariant[] = [
  { name: "now: pace 0.8, temp 0.55", pace: 0.8, temperature: 0.55, fullStop: false },
  { name: "pace 0.8, temp 0.2", pace: 0.8, temperature: 0.2, fullStop: false },
  { name: "pace 0.8, temp 0.2, full stop", pace: 0.8, temperature: 0.2, fullStop: true },
  { name: "pace 1.0, temp 0.2, full stop", pace: 1.0, temperature: 0.2, fullStop: true },
];

export interface PronunciationDeps {
  sarvamKeys: string[];
  geminiTranscribe?: (wav: Buffer, languageName: string) => Promise<string>;
  fetchImpl?: typeof fetch;
  concurrency?: number;
  log?: (line: string) => void;
}

const LANGUAGE_NAME: Record<string, string> = { "te-IN": "Telugu", "hi-IN": "Hindi", "en-IN": "English" };

export async function runPronunciationCheck(
  mode: "experiment" | "verify",
  deps: PronunciationDeps,
  opts: { items?: SpeechItem[]; variants?: TtsVariant[]; wordTrials?: number; judgeWithGemini?: boolean } = {}
): Promise<PronunciationReport> {
  const doFetch = deps.fetchImpl || fetch;
  const log = deps.log || (() => undefined);
  const startedAt = new Date().toISOString();
  const items = opts.items || (mode === "experiment" ? experimentItems() : allSpeechItems());
  const wordTrials = opts.wordTrials ?? 2;
  // In verify mode the single "variant" is whatever the live route sends.
  const variants: Array<TtsVariant | null> = mode === "experiment" ? opts.variants || EXPERIMENT_VARIANTS : [null];
  let keyTurn = 0;
  const nextKey = () => deps.sarvamKeys[keyTurn++ % deps.sarvamKeys.length];

  const jobs: Array<() => Promise<ItemResult>> = [];
  for (const variant of variants) {
    for (const item of items) {
      // Lone words are checked in both voices when verifying; lines in the default one.
      const speakers = mode === "verify" && isSingleWord(item.text) ? ["priya", "shubh"] : ["priya"];
      for (const speaker of speakers) jobs.push(async () => {
        const trials = isSingleWord(item.text) ? wordTrials : 1;
        const heard: string[] = [];
        const geminiHeard: string[] = [];
        let passes = 0;
        for (let t = 0; t < trials; t++) {
          const request = variant
            ? {
                text: variant.fullStop && isSingleWord(item.text) ? withFullStop(item.text, item.code) : item.text,
                pace: isSingleWord(item.text) ? variant.pace : 1,
                temperature: variant.temperature,
              }
            : ttsRequestSettings(item.text, item.code, isSingleWord(item.text) ? 0.8 : 1);
          try {
            const audio = await withRetry(() => sarvamTts(doFetch, nextKey(), request.text, item.code, speaker, request.pace, request.temperature));
            const said = await withRetry(() => sarvamStt(doFetch, nextKey(), audio, item.code));
            heard.push(said);
            let ok = wordMatchPercent(item.text, said) >= (isSingleWord(item.text) ? 100 : 90);
            if (!ok && (opts.judgeWithGemini ?? mode === "verify") && deps.geminiTranscribe) {
              const second = await deps.geminiTranscribe(audio, LANGUAGE_NAME[item.code] || "English").catch(() => "");
              geminiHeard.push(second);
              ok = wordMatchPercent(item.text, second) >= (isSingleWord(item.text) ? 100 : 90);
            }
            if (ok) passes++;
          } catch (error: any) {
            heard.push(`(error: ${String(error?.message || error).slice(0, 80)})`);
          }
        }
        return {
          text: item.text,
          code: item.code,
          source: item.source,
          variant: variant?.name || "live settings",
          speaker,
          trials,
          passes,
          heard,
          ...(geminiHeard.length ? { geminiHeard } : {}),
        };
      });
    }
  }

  const results: ItemResult[] = [];
  let done = 0;
  const concurrency = Math.max(1, deps.concurrency ?? 3);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        results.push(await job());
        done++;
        if (done % 50 === 0) log(`[PRONUNCIATION] ${done}/${jobs.length} checked`);
      }
    })
  );

  const variantNames = [...new Set(results.map((r) => r.variant))];
  const summaries = variantNames.map((name) => {
    const rows = results.filter((r) => r.variant === name);
    const rate = (rs: ItemResult[]) => {
      const trials = rs.reduce((n, r) => n + r.trials, 0);
      return trials ? Math.round((rs.reduce((n, r) => n + r.passes, 0) / trials) * 1000) / 10 : 0;
    };
    const byLanguage: Record<string, number> = {};
    for (const code of ["te-IN", "hi-IN", "en-IN"]) {
      const rs = rows.filter((r) => r.code === code);
      if (rs.length) byLanguage[code] = rate(rs);
    }
    return { name, items: rows.length, trials: rows.reduce((n, r) => n + r.trials, 0), passRate: rate(rows), byLanguage };
  });
  return { mode, startedAt, finishedAt: new Date().toISOString(), variants: summaries, results };
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!/HTTP 429|HTTP 5\d\d|fetch failed|timeout/i.test(String(error?.message || error))) throw error;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function sarvamTts(doFetch: typeof fetch, key: string, text: string, code: string, speaker: string, pace: number, temperature: number): Promise<Buffer> {
  const response = await doFetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": key },
    body: JSON.stringify({ text, model: "bulbul:v3", language_code: code, speaker, pace, temperature, speech_sample_rate: 24000 }),
    signal: AbortSignal.timeout(30_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data?.audios?.[0]) throw new Error(`TTS HTTP ${response.status}: ${data?.error?.message || data?.message || "no audio"}`);
  return Buffer.from(data.audios[0], "base64");
}

async function sarvamStt(doFetch: typeof fetch, key: string, wav: Buffer, code: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "word.wav");
  form.append("model", "saaras:v4");
  form.append("mode", "transcribe");
  form.append("language_code", code);
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

/** One log line per variant, then the items that failed, for reading in Render logs. */
export function pronunciationLogLines(report: PronunciationReport): string[] {
  const lines = report.variants.map(
    (v) =>
      `[PRONUNCIATION] ${report.mode} · ${v.name}: ${v.passRate}% of ${v.trials} tries heard back exactly (${Object.entries(v.byLanguage)
        .map(([c, r]) => `${c} ${r}%`)
        .join(", ")})`
  );
  for (const r of report.results.filter((x) => x.passes < x.trials)) {
    lines.push(
      `[PRONUNCIATION] MISS ${r.variant} · ${r.speaker} · ${r.code} "${r.text}" ${r.passes}/${r.trials} · heard ${r.heard.map((h) => `"${h}"`).join(", ")}` +
        (r.geminiHeard ? ` · Gemini heard ${r.geminiHeard.map((h) => `"${h}"`).join(", ")}` : "") +
        ` · ${r.source}`
    );
  }
  return lines;
}
