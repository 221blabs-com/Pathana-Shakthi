// Sarvam pronunciation dictionary (bulbul:v3): before speaking, Sarvam swaps
// each listed word for a respelling that it pronounces better. Used for the
// words that came back wrong under every TTS setting in the 4 Oct
// pronunciation checks (server/pronunciationCheck.ts).
//
// Respellings are chosen by measurement, never by guess: each candidate is
// spoken in both voices, transcribed back by Sarvam STT (Gemini as second
// opinion) and compared with the ORIGINAL word (runRespellingExperiment);
// only candidates that clearly beat the plain word go into PRONUNCIATION_FIXES.
//
// A dictionary belongs to one Sarvam account, and each key may be a different
// account, so SarvamDictionaries keeps one dictionary per key (created, or
// updated in place when the fixes change) and the TTS route sends the dict_id
// of the key it is using.
//
// API (from Sarvam's official SDK): POST/PUT(?dict_id=) multipart "file" to
// /text-to-speech/pronunciation-dictionary -> { dictionary_id };
// GET /text-to-speech/pronunciation-dictionary/{dict_id}.
import { createHash } from "crypto";

export type Pronunciations = Record<string, Record<string, string>>;

/** Respellings measured to be heard back correctly more often than the word itself. */
export const PRONUNCIATION_FIXES: Pronunciations = {
  "en-IN": {},
  "hi-IN": {},
  "te-IN": {},
};

/** Candidates for the respelling experiment (first entry: the word as written). */
export const RESPELLING_CANDIDATES: Array<{ code: string; word: string; candidates: string[] }> = [
  { code: "en-IN", word: "ear", candidates: ["ear", "eer", "eear", "iyar"] },
  { code: "en-IN", word: "hand", candidates: ["hand", "haand", "hannd", "hend"] },
  { code: "en-IN", word: "bird", candidates: ["bird", "burd", "berd", "bhird"] },
  { code: "en-IN", word: "star", candidates: ["star", "staar", "sstar", "es-tar"] },
  { code: "en-IN", word: "green", candidates: ["green", "greeen", "grreen", "gareen"] },
  { code: "en-IN", word: "yellow", candidates: ["yellow", "yello", "yelloh", "yel-low"] },
  { code: "en-IN", word: "big", candidates: ["big", "bigg", "bihg", "bigue"] },
  { code: "en-IN", word: "sad", candidates: ["sad", "saad", "sadd", "saed"] },
  { code: "en-IN", word: "brave", candidates: ["brave", "brayv", "braive", "breyv"] },
  { code: "en-IN", word: "farmer", candidates: ["farmer", "faarmer", "far-mer", "farmur"] },
  { code: "en-IN", word: "important", candidates: ["important", "im-portant", "impor-tant", "importent"] },
  { code: "en-IN", word: "eat", candidates: ["eat", "eet", "eeat", "eatt"] },
  { code: "en-IN", word: "police", candidates: ["police", "poleece", "puleess", "po-lees"] },
  { code: "en-IN", word: "cube", candidates: ["cube", "kyoob", "kyube", "queube"] },
  { code: "en-IN", word: "den", candidates: ["den", "denn", "dhen", "d-en"] },
  { code: "en-IN", word: "whoosh", candidates: ["whoosh", "wooosh", "hwoosh", "whooosh"] },
  { code: "hi-IN", word: "पिता", candidates: ["पिता", "पि-ता", "पिताा", "पित्ता"] },
  { code: "hi-IN", word: "चाँद", candidates: ["चाँद", "चांद", "चाँद्", "चान्द"] },
  { code: "hi-IN", word: "हाथ", candidates: ["हाथ", "हाथ्", "हात्थ", "हाथ़"] },
  { code: "te-IN", word: "వాన", candidates: ["వాన", "వాన్న", "వా-న", "వానా"] },
];

const capitalize = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/** The JSON file Sarvam expects; English words also as "Word" and "WORD" (matching may be case-sensitive). */
export function dictionaryFile(fixes: Pronunciations = PRONUNCIATION_FIXES): { pronunciations: Pronunciations } {
  const pronunciations: Pronunciations = {};
  for (const [code, words] of Object.entries(fixes)) {
    const out: Record<string, string> = {};
    for (const [word, spoken] of Object.entries(words)) {
      out[word] = spoken;
      if (code === "en-IN") {
        out[capitalize(word)] = capitalize(spoken);
        out[word.toUpperCase()] = spoken.toUpperCase();
      }
    }
    if (Object.keys(out).length) pronunciations[code] = out;
  }
  return { pronunciations };
}

export function dictionaryHash(file = dictionaryFile()): string {
  return createHash("sha256").update(JSON.stringify(file)).digest("hex").slice(0, 16);
}

/** Never the key itself: a short hash, for remembering which dictionary belongs to which key. */
export function keyFingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

export interface DictionaryStore {
  load(): Promise<Record<string, { dictId: string; hash: string }>>;
  save(entries: Record<string, { dictId: string; hash: string }>): Promise<void>;
}

const BASE = "https://api.sarvam.ai/text-to-speech/pronunciation-dictionary";

export class SarvamDictionaries {
  private byKey = new Map<string, string>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /** dict_id to send with a TTS request made with this key, if its dictionary is ready. */
  dictIdFor(key: string): string | undefined {
    return this.byKey.get(keyFingerprint(key));
  }

  get ready(): number {
    return this.byKey.size;
  }

  /**
   * Makes sure every key has a dictionary with the current fixes: reuses it
   * when unchanged, updates it in place when the fixes changed (keeps the id),
   * creates it when missing. Returns one log line per key.
   */
  async ensure(keys: string[], store: DictionaryStore, file = dictionaryFile()): Promise<string[]> {
    const lines: string[] = [];
    const words = Object.values(file.pronunciations).reduce((n, w) => n + Object.keys(w).length, 0);
    if (words === 0) return ["no pronunciation fixes to upload"];
    const hash = dictionaryHash(file);
    const saved = await store.load().catch(() => ({} as Record<string, { dictId: string; hash: string }>));
    const next = { ...saved };
    for (const [index, key] of keys.entries()) {
      const fp = keyFingerprint(key);
      const label = `key ${index + 1} of ${keys.length} (…${key.slice(-4)})`;
      try {
        let dictId = saved[fp]?.dictId;
        if (dictId && saved[fp].hash === hash && (await this.exists(key, dictId))) {
          lines.push(`${label}: dictionary ${dictId} up to date (${words} entries)`);
        } else if (dictId && (await this.exists(key, dictId))) {
          await this.upload(key, file, dictId);
          lines.push(`${label}: dictionary ${dictId} updated (${words} entries)`);
        } else {
          dictId = await this.upload(key, file);
          lines.push(`${label}: dictionary ${dictId} created (${words} entries)`);
        }
        this.byKey.set(fp, dictId);
        next[fp] = { dictId, hash };
      } catch (error: any) {
        lines.push(`${label}: dictionary not available (${String(error?.message || error).slice(0, 120)})`);
      }
    }
    await store.save(next).catch(() => undefined);
    return lines;
  }

  private async exists(key: string, dictId: string): Promise<boolean> {
    const response = await this.fetchImpl(`${BASE}/${encodeURIComponent(dictId)}`, {
      headers: { "api-subscription-key": key },
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok;
  }

  private async upload(key: string, file: { pronunciations: Pronunciations }, dictId?: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([JSON.stringify(file)], { type: "application/json" }), "pronunciations.json");
    const response = await this.fetchImpl(dictId ? `${BASE}?dict_id=${encodeURIComponent(dictId)}` : BASE, {
      method: dictId ? "PUT" : "POST",
      headers: { "api-subscription-key": key },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${data?.error?.message || data?.message || data?.detail || ""}`);
    const id = data?.dictionary_id || data?.dict_id || dictId;
    if (!id) throw new Error("no dictionary_id in the answer");
    return id;
  }
}
