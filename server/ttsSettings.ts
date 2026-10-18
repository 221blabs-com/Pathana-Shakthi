// How text is sent to Sarvam TTS. A tapped word (one word, no spaces) is
// spoken on its own, where the model has no sentence around it to settle the
// sound (server/pronunciationCheck.ts measures every word spoken and heard back).

export interface TtsRequestSettings {
  text: string;
  pace: number;
  /** Not sent: Sarvam's own default keeps the natural Indian voice. */
  temperature?: number;
}

// Sarvam's default temperature for every clip, sentences and lone words
// alike, as on the other branches. A teacher testing on 4 Oct found the voice
// much worse with our own temperatures (0.55 for sentences, 0.01 for a lone
// word: measured slightly more exact, but flat and robotic to listen to).
// Kept from the measurements: a lone word ends with a full stop ("పిల్లి."),
// which only gives it a normal falling end, and the pronunciation dictionary
// (server/pronunciationDictionary.ts) for the few words Sarvam says wrongly.
// Bump when these settings change, so cached clips made the old way are not
// replayed (server memory cache and the browser's Cache Storage).
export const TTS_SETTINGS_VERSION = 4;

const FULL_STOP: Record<string, string> = { "te-IN": ".", "hi-IN": "।", "en-IN": "." };

export function isSingleWord(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !/\s/.test(trimmed);
}

/** Ends a lone word like a sentence ("పిల్లి" -> "పిల్లి."), unless it already ends with punctuation. */
export function withFullStop(word: string, languageCode: string): string {
  const trimmed = word.trim();
  if (/[\p{P}]$/u.test(trimmed)) return trimmed;
  return trimmed + (FULL_STOP[languageCode] || ".");
}

export function ttsRequestSettings(text: string, languageCode: string, pace: number): TtsRequestSettings {
  if (!isSingleWord(text)) return { text, pace };
  return { text: withFullStop(text, languageCode), pace };
}
