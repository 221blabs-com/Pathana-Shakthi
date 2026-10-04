// A spelling-insensitive key for Telugu/Hindi words, so two spellings of the
// same spoken word compare equal: చెయ్యి / చేయి (doubled consonant, long/short
// vowel), वाना-style lengthened endings, माँ / मां, पेड़ / पेड. Used by the
// read-aloud matcher (a child is not marked wrong because speech recognition
// chose the other spelling) and by the pronunciation check ("close" vs
// "wrong"). English words are only lower-cased and stripped of punctuation.

const VIRAMA = /[్्]/; // Telugu ్, Devanagari ्

const LONG_TO_SHORT: Record<string, string> = {
  // Telugu vowel signs and letters
  'ా': '', // ా -> inherent a
  'ీ': 'ి', // ీ -> ి
  'ూ': 'ు', // ూ -> ు
  'ే': 'ె', // ే -> ె
  'ో': 'ొ', // ో -> ొ
  'ఆ': 'అ', // ఆ -> అ
  'ఈ': 'ఇ', // ఈ -> ఇ
  'ఊ': 'ఉ', // ఊ -> ఉ
  'ఏ': 'ఎ', // ఏ -> ఎ
  'ఓ': 'ఒ', // ఓ -> ఒ
  // Devanagari
  'ा': '', // ा -> inherent a
  'ी': 'ि', // ी -> ि
  'ू': 'ु', // ू -> ु
  'आ': 'अ', // आ -> अ
  'ई': 'इ', // ई -> इ
  'ऊ': 'उ', // ऊ -> उ
  'ँ': 'ं', // chandrabindu -> anusvara
};

export function phoneticKey(word: string): string {
  let s = String(word || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[़‌‍]/g, '')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
  s = Array.from(s)
    .map((ch) => (ch in LONG_TO_SHORT ? LONG_TO_SHORT[ch] : ch))
    .join('');
  // doubled consonant (C + virama + C) -> C
  const chars = Array.from(s);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (VIRAMA.test(chars[i]) && chars[i + 1] && chars[i + 1] === chars[i - 1]) {
      i++; // skip the virama and the repeated consonant
      continue;
    }
    out.push(chars[i]);
  }
  return out.join('');
}

/** Same word, allowing only spelling / vowel-length differences (Indic scripts). */
export function samePhoneticWord(a: string, b: string): boolean {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  return ka.length >= 2 && ka === kb;
}
