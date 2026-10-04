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
import { phoneticKey } from "../src/services/phonetic";

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
  /** Text added after a lone word ("." "," "!"); overrides fullStop. */
  ending?: string;
}

export interface ItemResult {
  text: string;
  code: string;
  source: string;
  variant: string;
  speaker: string;
  trials: number;
  passes: number;
  /** Tries heard as the same word with only a spelling/vowel-length difference. */
  close: number;
  heard: string[];
  geminiHeard?: string[];
}

export interface PronunciationReport {
  mode: "experiment" | "verify";
  startedAt: string;
  finishedAt: string;
  variants: Array<{ name: string; items: number; trials: number; passRate: number; closeRate: number; byLanguage: Record<string, number> }>;
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

// Telugu words that came back wrong under every setting in the first two
// comparisons, plus పిల్లి and అమ్మ as controls.
export const TELUGU_PROBLEM_WORDS = ["చేప", "ఆట", "పువ్వు", "వాన", "నాన్న", "అక్క", "అన్న", "పండు", "ఇల్లు", "ఆవు", "చెయ్యి", "గురువు", "కలము", "పిల్లి", "అమ్మ"];

export const TELUGU_ENDING_VARIANTS: TtsVariant[] = [
  { name: "te-word: temp 0.2, no ending", pace: 0.8, temperature: 0.2, fullStop: false, ending: "" },
  { name: "te-word: temp 0.2, full stop", pace: 0.8, temperature: 0.2, fullStop: true, ending: "." },
  { name: "te-word: temp 0.2, comma", pace: 0.8, temperature: 0.2, fullStop: false, ending: "," },
  { name: "te-word: temp 0.2, !", pace: 0.8, temperature: 0.2, fullStop: false, ending: "!" },
  { name: "te-word: temp 0.01, no ending", pace: 0.8, temperature: 0.01, fullStop: false, ending: "" },
  { name: "te-word: temp 0.01, full stop", pace: 0.8, temperature: 0.01, fullStop: true, ending: "." },
];

// English lone words both recognizers misheard in the 4 Oct verification,
// plus river / garden / eye as controls.
export const ENGLISH_PROBLEM_WORDS = ["important", "Police", "ear", "hand", "big", "bird", "dog", "eat", "star", "rain", "water", "cat", "cow", "river", "garden", "eye"];

export const ENGLISH_ENDING_VARIANTS: TtsVariant[] = [
  { name: "en-word: temp 0.01, full stop (now)", pace: 0.8, temperature: 0.01, fullStop: true, ending: "." },
  { name: "en-word: temp 0.01, no ending", pace: 0.8, temperature: 0.01, fullStop: false, ending: "" },
  { name: "en-word: temp 0.2, no ending", pace: 0.8, temperature: 0.2, fullStop: false, ending: "" },
  { name: "en-word: temp 0.55, no ending (old)", pace: 0.8, temperature: 0.55, fullStop: false, ending: "" },
  { name: "en-word: temp 0.2, !", pace: 0.8, temperature: 0.2, fullStop: false, ending: "!" },
  { name: "en-word: temp 0.01, full stop, pace 1.0", pace: 1.0, temperature: 0.01, fullStop: true, ending: "." },
];

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
  /** The pronunciation dictionary of a key (server/pronunciationDictionary.ts), if any. */
  dictIdFor?: (key: string) => string | undefined;
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
        let close = 0;
        for (let t = 0; t < trials; t++) {
          const request = variant
            ? {
                text: !isSingleWord(item.text)
                  ? item.text
                  : variant.ending !== undefined
                    ? item.text + variant.ending
                    : variant.fullStop
                      ? withFullStop(item.text, item.code)
                      : item.text,
                pace: isSingleWord(item.text) ? variant.pace : 1,
                temperature: variant.temperature,
              }
            : ttsRequestSettings(item.text, item.code, isSingleWord(item.text) ? 0.8 : 1);
          try {
            const key = nextKey();
            // verify mode = what children hear, so the key's pronunciation dictionary applies
            const dictId = variant ? undefined : deps.dictIdFor?.(key);
            const audio = await withRetry(() => sarvamTts(doFetch, key, request.text, item.code, speaker, request.pace, request.temperature, dictId));
            const said = await withRetry(() => sarvamStt(doFetch, nextKey(), audio, item.code));
            heard.push(said);
            let ok = wordMatchPercent(item.text, said) >= (isSingleWord(item.text) ? 100 : 90);
            if (!ok && (opts.judgeWithGemini ?? mode === "verify") && deps.geminiTranscribe) {
              const second = await deps.geminiTranscribe(audio, LANGUAGE_NAME[item.code] || "English").catch(() => "");
              geminiHeard.push(second);
              ok = wordMatchPercent(item.text, second) >= (isSingleWord(item.text) ? 100 : 90);
            }
            if (ok) passes++;
            else if (phoneticKey(item.text) === phoneticKey(said) && phoneticKey(said).length >= 2) close++;
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
          close,
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
    const trials = rows.reduce((n, r) => n + r.trials, 0);
    const closeRate = trials ? Math.round((rows.reduce((n, r) => n + r.passes + r.close, 0) / trials) * 1000) / 10 : 0;
    return { name, items: rows.length, trials, passRate: rate(rows), closeRate, byLanguage };
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

async function sarvamTts(
  doFetch: typeof fetch,
  key: string,
  text: string,
  code: string,
  speaker: string,
  pace: number,
  temperature: number,
  dictId?: string
): Promise<Buffer> {
  const response = await doFetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": key },
    body: JSON.stringify({
      text,
      model: "bulbul:v3",
      language_code: code,
      speaker,
      pace,
      temperature,
      speech_sample_rate: 24000,
      ...(dictId ? { dict_id: dictId } : {}),
    }),
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
      `[PRONUNCIATION] ${report.mode} · ${v.name}: ${v.passRate}% of ${v.trials} tries heard back exactly, ${v.closeRate}% exactly or as another spelling (${Object.entries(v.byLanguage)
        .map(([c, r]) => `${c} ${r}%`)
        .join(", ")})`
  );
  for (const r of report.results.filter((x) => x.passes < x.trials)) {
    lines.push(
      `[PRONUNCIATION] MISS ${r.variant} · ${r.speaker} · ${r.code} "${r.text}" ${r.passes}/${r.trials}${r.close ? ` (+${r.close} other spelling)` : ""} · heard ${r.heard.map((h) => `"${h}"`).join(", ")}` +
        (r.geminiHeard ? ` · Gemini heard ${r.geminiHeard.map((h) => `"${h}"`).join(", ")}` : "") +
        ` · ${r.source}`
    );
  }
  return lines;
}


export interface RespellingResult {
  word: string;
  code: string;
  candidate: string;
  speaker: string;
  tries: number;
  passes: number;
  heard: string[];
}

/** Same spoken word: exact, another spelling (పిలి / పిల్లి) or a digit / sound-alike. */
function heardAs(word: string, heard: string): boolean {
  return wordMatchPercent(word, heard) === 100 || (phoneticKey(heard).length >= 2 && phoneticKey(word) === phoneticKey(heard));
}

/**
 * Speaks each respelling candidate the way a tapped word is spoken
 * (temperature 0.01, full stop, slow pace) in both voices and checks whether
 * the ORIGINAL word is heard back; Gemini gives a second opinion on misses.
 */
export async function runRespellingExperiment(
  deps: PronunciationDeps,
  candidates: Array<{ code: string; word: string; candidates: string[] }>,
  tries = 3
): Promise<{ results: RespellingResult[]; lines: string[] }> {
  const doFetch = deps.fetchImpl || fetch;
  let keyTurn = 0;
  const nextKey = () => deps.sarvamKeys[keyTurn++ % deps.sarvamKeys.length];
  const jobs: Array<() => Promise<RespellingResult>> = [];
  for (const entry of candidates) {
    for (const candidate of entry.candidates) {
      for (const speaker of ["priya", "shubh"]) {
        jobs.push(async () => {
          const heard: string[] = [];
          let passes = 0;
          for (let t = 0; t < tries; t++) {
            try {
              const audio = await withRetry(() =>
                sarvamTts(doFetch, nextKey(), withFullStop(candidate, entry.code), entry.code, speaker, 0.8, 0.01)
              );
              let said = await withRetry(() => sarvamStt(doFetch, nextKey(), audio, entry.code));
              let ok = heardAs(entry.word, said);
              if (!ok && deps.geminiTranscribe) {
                const second = await deps.geminiTranscribe(audio, LANGUAGE_NAME[entry.code] || "English").catch(() => "");
                if (heardAs(entry.word, second)) {
                  ok = true;
                  said = `${said} / Gemini: ${second}`;
                }
              }
              heard.push(said);
              if (ok) passes++;
            } catch (error: any) {
              heard.push(`(error: ${String(error?.message || error).slice(0, 60)})`);
            }
          }
          return { word: entry.word, code: entry.code, candidate, speaker, tries, passes, heard };
        });
      }
    }
  }
  const results: RespellingResult[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, deps.concurrency ?? 3) }, async () => {
      while (cursor < jobs.length) results.push(await jobs[cursor++]());
    })
  );
  const lines: string[] = [];
  for (const entry of candidates) {
    const rows = entry.candidates.map((candidate) => {
      const rs = results.filter((r) => r.word === entry.word && r.candidate === candidate);
      const passes = rs.reduce((n, r) => n + r.passes, 0);
      const total = rs.reduce((n, r) => n + r.tries, 0);
      const heard = rs.flatMap((r) => r.heard.map((h) => `${r.speaker[0]}:${h}`)).join(" | ");
      return { candidate, passes, total, heard };
    });
    const best = [...rows].sort((a, b) => b.passes - a.passes)[0];
    lines.push(
      `[RESPELL] ${entry.code} "${entry.word}": ` +
        rows.map((r) => `"${r.candidate}" ${r.passes}/${r.total}`).join(", ") +
        ` -> best "${best.candidate}"`
    );
    for (const r of rows) lines.push(`[RESPELL]   ${entry.word} as "${r.candidate}" heard: ${r.heard}`);
  }
  return { results, lines };
}


/**
 * Confirms each dictionary entry through the live path: the ORIGINAL word
 * spoken with and without the key's dictionary (both voices, `tries` each),
 * plus every sentence a child can hear that contains the word, with the
 * dictionary. An entry that does not help, or that breaks a sentence, should
 * be removed from PRONUNCIATION_FIXES.
 */
export async function runDictionaryConfirm(
  deps: PronunciationDeps,
  fixes: Record<string, Record<string, string>>,
  tries = 4
): Promise<string[]> {
  const doFetch = deps.fetchImpl || fetch;
  const keys = deps.sarvamKeys.filter((k) => deps.dictIdFor?.(k));
  if (!keys.length) return ["[DICT-CHECK] no key has a pronunciation dictionary"];
  let turn = 0;
  const nextKey = () => keys[turn++ % keys.length];
  const lines: string[] = [];
  const sentences = allSpeechItems().filter((i) => !isSingleWord(i.text));
  for (const [code, words] of Object.entries(fixes)) {
    for (const word of Object.keys(words)) {
      const score: Record<string, { passes: number; heard: string[] }> = { without: { passes: 0, heard: [] }, with: { passes: 0, heard: [] } };
      for (const mode of ["without", "with"] as const) {
        for (const speaker of ["priya", "shubh"]) {
          for (let t = 0; t < tries; t++) {
            const key = nextKey();
            try {
              const audio = await withRetry(() =>
                sarvamTts(doFetch, key, withFullStop(word, code), code, speaker, 0.8, 0.01, mode === "with" ? deps.dictIdFor?.(key) : undefined)
              );
              let said = await withRetry(() => sarvamStt(doFetch, key, audio, code));
              let ok = heardAs(word, said);
              if (!ok && deps.geminiTranscribe) {
                const second = await deps.geminiTranscribe(audio, LANGUAGE_NAME[code] || "English").catch(() => "");
                if (heardAs(word, second)) {
                  ok = true;
                  said = `${said} / Gemini: ${second}`;
                }
              }
              score[mode].heard.push(`${speaker[0]}:${said}`);
              if (ok) score[mode].passes++;
            } catch (error: any) {
              score[mode].heard.push(`(error: ${String(error?.message || error).slice(0, 50)})`);
            }
          }
        }
      }
      const total = tries * 2;
      lines.push(
        `[DICT-CHECK] ${code} "${word}" -> "${words[word]}": without ${score.without.passes}/${total}, with ${score.with.passes}/${total}` +
          ` · with heard: ${score.with.heard.join(" | ")}`
      );
      const pattern = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "iu");
      for (const sentence of sentences.filter((i) => i.code === code && pattern.test(i.text))) {
        const key = nextKey();
        try {
          const audio = await withRetry(() =>
            sarvamTts(doFetch, key, sentence.text, code, "priya", 1, 0.55, deps.dictIdFor?.(key))
          );
          const said = await withRetry(() => sarvamStt(doFetch, key, audio, code));
          const match = wordMatchPercent(sentence.text, said);
          lines.push(`[DICT-CHECK]   sentence ${match >= 90 ? "ok" : "MISS"} ${match}%: "${sentence.text}" heard "${said}"`);
        } catch (error: any) {
          lines.push(`[DICT-CHECK]   sentence error: "${sentence.text}" (${String(error?.message || error).slice(0, 60)})`);
        }
      }
    }
  }
  return lines;
}
