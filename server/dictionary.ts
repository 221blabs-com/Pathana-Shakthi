// Oxford Dictionaries API (https://developer.oxforddictionaries.com, paid
// app_id/app_key) for the student Word Dictionary: confirms a word is an
// Oxford headword and returns its definition. Without OXFORD_APP_ID /
// OXFORD_APP_KEY nothing is looked up, and the dictionary shows only its
// built-in list (src/data/dictionary.ts). Results, including "not a word",
// are cached in Firestore (dictionaryCache) so each word costs one call.
import { Router } from "express";
import { getFirebaseAdmin, isFirebaseAdminConfigured } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireProfile } from "./firebaseRoutes";
import { rateLimit } from "./security";

export interface DictionaryEntry {
  word: string; // the headword (e.g. "mango" for "mangoes")
  partOfSpeech: string;
  definition: string;
  example?: string;
  phonetic?: string;
  source: "oxford";
}

const OXFORD_BASE = (process.env.OXFORD_API_BASE || "https://od-api.oxforddictionaries.com/api/v2").replace(/\/$/, "");
export const oxfordConfigured = () => Boolean(process.env.OXFORD_APP_ID && process.env.OXFORD_APP_KEY);

/** First sense of an Oxford /entries response, or null when it has none. */
export function parseOxfordEntry(json: any): DictionaryEntry | null {
  for (const result of Array.isArray(json?.results) ? json.results : []) {
    for (const lexical of Array.isArray(result?.lexicalEntries) ? result.lexicalEntries : []) {
      for (const entry of Array.isArray(lexical?.entries) ? lexical.entries : []) {
        const phonetic = (entry?.pronunciations || []).find((p: any) => p?.phoneticSpelling)?.phoneticSpelling;
        for (const sense of Array.isArray(entry?.senses) ? entry.senses : []) {
          const definition = String(sense?.definitions?.[0] || sense?.shortDefinitions?.[0] || "").trim();
          if (!definition) continue;
          return {
            word: String(result?.word || result?.id || "").trim(),
            partOfSpeech: String(lexical?.lexicalCategory?.text || "").toLowerCase(),
            definition: definition.charAt(0).toUpperCase() + definition.slice(1),
            example: String(sense?.examples?.[0]?.text || "").trim() || undefined,
            phonetic: phonetic ? String(phonetic) : undefined,
            source: "oxford",
          };
        }
      }
    }
  }
  return null;
}

/** The headword an inflected form belongs to, from an Oxford /lemmas response. */
export function parseOxfordLemma(json: any): string | null {
  const id = json?.results?.[0]?.lexicalEntries?.[0]?.inflectionOf?.[0]?.id;
  return id ? String(id) : null;
}

async function oxfordGet(path: string): Promise<any | null> {
  const response = await fetch(`${OXFORD_BASE}${path}`, {
    headers: { app_id: String(process.env.OXFORD_APP_ID), app_key: String(process.env.OXFORD_APP_KEY), Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Oxford API HTTP ${response.status}`);
  return response.json();
}

async function lookupOxford(word: string): Promise<DictionaryEntry | null> {
  const id = encodeURIComponent(word.toLowerCase());
  const entry = await oxfordGet(`/entries/en-gb/${id}?fields=definitions,examples,pronunciations&strictMatch=false`);
  const parsed = entry ? parseOxfordEntry(entry) : null;
  if (parsed) return parsed;
  // "mangoes" is not an entry of its own; its lemma "mango" is.
  const lemma = parseOxfordLemma(await oxfordGet(`/lemmas/en-gb/${id}`));
  if (!lemma || lemma.toLowerCase() === word.toLowerCase()) return null;
  const lemmaEntry = await oxfordGet(`/entries/en-gb/${encodeURIComponent(lemma)}?fields=definitions,examples,pronunciations&strictMatch=false`);
  return lemmaEntry ? parseOxfordEntry(lemmaEntry) : null;
}

const memory = new Map<string, DictionaryEntry | null>();
const NOT_A_WORD_TTL_MS = 7 * 24 * 3_600_000;

async function cachedLookup(word: string): Promise<DictionaryEntry | null> {
  const key = word.toLowerCase();
  if (memory.has(key)) return memory.get(key)!;
  const ref = isFirebaseAdminConfigured() ? getFirebaseAdmin().db.collection("dictionaryCache").doc(`en_${key}`.slice(0, 200)) : null;
  if (ref) {
    const snap = await ref.get();
    if (snap.exists) {
      const entry = (snap.get("entry") as DictionaryEntry | null) || null;
      if (entry || Date.now() - Date.parse(snap.get("at") || "") < NOT_A_WORD_TTL_MS) {
        memory.set(key, entry);
        return entry;
      }
    }
  }
  const entry = await lookupOxford(word);
  memory.set(key, entry);
  if (memory.size > 5000) memory.delete(memory.keys().next().value as string);
  await ref?.set({ entry, source: "oxford", at: new Date().toISOString() }).catch(() => undefined);
  return entry;
}

const router = Router();

/* POST /api/dictionary/lookup  { words: ["tavern", "mangoes"] }
   -> { oxford: true, entries: { tavern: {...}, mangoes: {...} | null } } */
router.post(
  "/dictionary/lookup",
  requireFirebaseUser,
  requireProfile,
  rateLimit("dictionary", 40, 60_000),
  async (req: AuthenticatedRequest, res) => {
    const words: string[] = Array.from(
      new Set<string>(
        (Array.isArray(req.body?.words) ? req.body.words : [])
          .map((w: unknown) => String(w || "").trim())
          .filter((w: string) => /^[A-Za-z][A-Za-z'-]{0,39}$/.test(w))
      )
    ).slice(0, 40);
    if (!oxfordConfigured()) return res.json({ oxford: false, entries: {} });
    const entries: Record<string, DictionaryEntry | null> = {};
    try {
      await Promise.all(
        words.map(async (w) => {
          entries[w] = await cachedLookup(w).catch((error) => {
            console.warn(`[DICTIONARY] ${w}: ${error?.message || error}`);
            return null;
          });
        })
      );
      return res.json({ oxford: true, entries });
    } catch (error: any) {
      console.error("Dictionary lookup error:", error?.message || error);
      return res.status(502).json({ oxford: true, entries: {}, error: "The dictionary is not reachable right now." });
    }
  }
);

export default router;
