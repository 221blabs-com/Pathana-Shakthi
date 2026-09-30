// Picks the TTS language from the text's own script. Sarvam rejects text with
// no characters of the requested language ("Text must contain at least one
// character from the allowed languages"), e.g. an English word tapped inside
// a Telugu story, which used to fall through to the much slower Gemini voice.
const TELUGU = /[ఀ-౿]/g;
const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN = /[A-Za-z]/g;

const LANGUAGE_CODES: Record<string, string> = {
  Telugu: "te-IN",
  Hindi: "hi-IN",
  English: "en-IN",
};

export function speechLanguageCodeFor(text: string, requestedLanguage: string): string {
  const requested = LANGUAGE_CODES[requestedLanguage] || "en-IN";
  const telugu = (text.match(TELUGU) || []).length;
  const hindi = (text.match(DEVANAGARI) || []).length;
  // Indic voices read embedded English words fine, so any Indic script wins.
  if (telugu || hindi) {
    if (telugu && hindi) {
      if (requested === "te-IN" || requested === "hi-IN") return requested;
    }
    return telugu >= hindi ? "te-IN" : "hi-IN";
  }
  if ((text.match(LATIN) || []).length > 0) return "en-IN";
  return requested;
}
