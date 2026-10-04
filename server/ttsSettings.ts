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

// Lone words (a tapped word, a flashcard word). Chosen by measurement on
// 4 Oct, each word spoken by Sarvam and heard back by Sarvam STT:
// - every Telugu/Hindi dictionary word + 15 English ones, 2 tries each:
//   temperature 0.55 (the sentence setting) 82.2% exact; 0.2 + a full stop
//   86.8% (Hindi 83.9% -> 93.5%, English 76.7% -> 86.7%). At 0.55 the same
//   word could come out differently each time (పిల్లి once as పెళ్లి).
// - the 15 Telugu words that failed under every setting, 4 tries each:
//   0.01 + full stop 73.3% exact / 88.3% exact-or-other-spelling, best of
//   six endings (none, ".", ",", "!" at 0.2 and 0.01).
// A near-zero temperature also makes every tap of a word sound the same.
export const WORD_SETTINGS: Record<string, { temperature: number; fullStop: boolean }> = {
  "te-IN": { temperature: 0.01, fullStop: true },
  "hi-IN": { temperature: 0.01, fullStop: true },
  "en-IN": { temperature: 0.01, fullStop: true },
};
const DEFAULT_WORD_SETTINGS = { temperature: 0.01, fullStop: true };
// Bump when these settings change, so cached clips made the old way are not
// replayed (server memory cache and the browser's Cache Storage).
export const TTS_SETTINGS_VERSION = 3;

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
