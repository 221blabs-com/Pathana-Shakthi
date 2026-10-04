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

// Speech recognition writes spoken numbers as digits ("five" -> "5",
// "twenty eight" -> "28") and picks one of several sound-alike English words
// ("eye" -> "I"). A child who read the word correctly must not be marked wrong,
// so both sides are compared in one form.
const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TE_NUMBERS = ['సున్నా', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది', 'పది'];
const HI_NUMBERS = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस'];
const EN_SAME_SOUND: Record<string, string> = {
  i: 'eye', to: 'two', too: 'two', for: 'four', ate: 'eight', won: 'one', see: 'sea', here: 'hear',
  write: 'right', know: 'no', knew: 'new', buy: 'by', bye: 'by', meat: 'meet', flour: 'flower',
  tale: 'tail', son: 'sun', their: 'there', theyre: 'there', hole: 'whole', wood: 'would',
  colour: 'color', colourful: 'colorful', favourite: 'favorite', grey: 'gray',
};

function englishNumber(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? EN_ONES[n % 10] : '');
  return n === 100 ? 'onehundred' : String(n);
}

/** One spelling per spoken word: digits as words, English sound-alikes merged. */
export function canonicalWord(word: string, language: string): string {
  const w = String(word || '').normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '');
  if (/^\d+$/.test(w)) {
    const n = Number(w);
    if (language === 'Telugu' && TE_NUMBERS[n]) return TE_NUMBERS[n];
    if (language === 'Hindi' && HI_NUMBERS[n]) return HI_NUMBERS[n];
    return englishNumber(n);
  }
  if (language === 'English') return EN_SAME_SOUND[w] || w;
  if (language === 'Hindi' && w === 'पाँच') return 'पांच';
  return w;
}
