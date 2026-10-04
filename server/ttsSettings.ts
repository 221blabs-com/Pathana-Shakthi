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

// Lone words, per language. Measured on 4 Oct over every Telugu and Hindi
// dictionary word and 15 English ones, spoken twice and heard back by Sarvam
// STT: at temperature 0.55 (the sentence setting) the same word sometimes
// came out wrong (పిల్లి as పెళ్లి); a low temperature plus a full stop was
// heard back exactly most often for Hindi (93.5% vs 83.9%) and English
// (86.7% vs 76.7%).
export const WORD_SETTINGS: Record<string, { temperature: number; fullStop: boolean }> = {
  "hi-IN": { temperature: 0.2, fullStop: true },
  "en-IN": { temperature: 0.2, fullStop: true },
  "te-IN": { temperature: 0.2, fullStop: false },
};
const DEFAULT_WORD_SETTINGS = { temperature: 0.2, fullStop: true };
// Bump when these settings change, so cached clips made the old way are not
// replayed (server memory cache and the browser's Cache Storage).
export const TTS_SETTINGS_VERSION = 2;

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
  const word = WORD_SETTINGS[languageCode] || DEFAULT_WORD_SETTINGS;
  return {
    text: word.fullStop ? withFullStop(text, languageCode) : text.trim(),
    pace,
    temperature: word.temperature,
  };
}
