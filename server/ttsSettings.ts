// How text is sent to Sarvam TTS. A tapped word (one word, no spaces) is
// spoken on its own, where the model has no sentence around it to settle the
// sound; it gets its own settings, chosen by measuring every dictionary word
// spoken and heard back (server/pronunciationCheck.ts).

export interface TtsRequestSettings {
  text: string;
  pace: number;
  temperature: number;
}

export const SENTENCE_TEMPERATURE = 0.55;
export const WORD_TEMPERATURE = 0.55;
export const WORD_ADD_FULL_STOP = false;
// Bump when these settings change, so cached clips made the old way are not
// replayed (server memory cache and the browser's Cache Storage).
export const TTS_SETTINGS_VERSION = 1;

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
  if (!isSingleWord(text)) return { text, pace, temperature: SENTENCE_TEMPERATURE };
  return {
    text: WORD_ADD_FULL_STOP ? withFullStop(text, languageCode) : text.trim(),
    pace,
    temperature: WORD_TEMPERATURE,
  };
}
