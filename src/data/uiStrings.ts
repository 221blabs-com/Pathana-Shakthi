// Easy mode for children who can't read yet (or read little): the words of
// the child-facing screens in English, Telugu and Hindi, plus who gets easy
// mode. Every label here is also spoken aloud, so keep each one short,
// simple and in the words a Class 1 child hears at home and school.
// Shared by the browser and the server (unit tested: every key in all three).

export type UiLang = 'English' | 'Telugu' | 'Hindi';
export const UI_LANGS: UiLang[] = ['English', 'Telugu', 'Hindi'];
export const isUiLang = (x: unknown): x is UiLang => UI_LANGS.includes(x as UiLang);

/** How each language is shown on its own button: a letter and its own name. */
export const UI_LANG_INFO: Record<UiLang, { letter: string; name: string }> = {
  English: { letter: 'A', name: 'English' },
  Telugu: { letter: 'అ', name: 'తెలుగు' },
  Hindi: { letter: 'अ', name: 'हिंदी' },
};

const S = {
  hello: { English: 'Hi, {name}!', Telugu: 'నమస్తే, {name}!', Hindi: 'नमस्ते, {name}!' },
  homeGuide: {
    English: 'Tap a picture to start.',
    Telugu: 'మొదలుపెట్టడానికి ఒక బొమ్మను నొక్కు.',
    Hindi: 'शुरू करने के लिए एक चित्र दबाओ।',
  },
  whatToday: { English: 'What shall we learn today?', Telugu: 'ఈ రోజు ఏమి నేర్చుకుందాం?', Hindi: 'आज हम क्या सीखें?' },
  subject_English: { English: 'English', Telugu: 'ఇంగ్లీష్', Hindi: 'अंग्रेज़ी' },
  subject_Maths: { English: 'Maths', Telugu: 'గణితం', Hindi: 'गणित' },
  subject_Science: { English: 'Science', Telugu: 'సైన్స్', Hindi: 'विज्ञान' },
  subject_Social: { English: 'Social', Telugu: 'సాంఘిక శాస్త్రం', Hindi: 'सामाजिक अध्ययन' },
  subject_Hindi: { English: 'Hindi', Telugu: 'హిందీ', Hindi: 'हिंदी' },
  subject_Telugu: { English: 'Telugu', Telugu: 'తెలుగు', Hindi: 'तेलुगु' },
  words: { English: 'Words', Telugu: 'పదాలు', Hindi: 'शब्द' },
  wordsSay: { English: 'Learn new words', Telugu: 'కొత్త పదాలు నేర్చుకో', Hindi: 'नए शब्द सीखो' },
  myStars: { English: 'My stars', Telugu: 'నా నక్షత్రాలు', Hindi: 'मेरे सितारे' },
  starsSay: { English: 'You have {n} stars!', Telugu: 'నీ దగ్గర {n} నక్షత్రాలు ఉన్నాయి!', Hindi: 'तुम्हारे पास {n} सितारे हैं!' },
  streak: { English: 'Days in a row', Telugu: 'వరుస రోజులు', Hindi: 'लगातार दिन' },
  streakSay: {
    English: 'You learned {n} days in a row!',
    Telugu: 'నువ్వు వరుసగా {n} రోజులు నేర్చుకున్నావు!',
    Hindi: 'तुमने लगातार {n} दिन सीखा!',
  },
  easyMode: { English: 'Easy mode', Telugu: 'సులభ విధానం', Hindi: 'आसान तरीका' },
  easyOn: {
    English: 'Easy mode is on: big pictures, and I will talk to you.',
    Telugu: 'సులభ విధానం ఆన్: పెద్ద బొమ్మలు, నేను నీతో మాట్లాడతాను.',
    Hindi: 'आसान तरीका चालू: बड़े चित्र, और मैं तुमसे बात करूँगी।',
  },
  easyOff: { English: 'All features', Telugu: 'అన్ని సదుపాయాలు', Hindi: 'सभी सुविधाएँ' },
  easyOffSay: {
    English: 'Now you see everything, with more to read.',
    Telugu: 'ఇప్పుడు అన్నీ కనిపిస్తాయి, చదవడానికి ఎక్కువ ఉంటుంది.',
    Hindi: 'अब सब कुछ दिखेगा, पढ़ने को ज़्यादा होगा।',
  },
  language: { English: 'Language', Telugu: 'భాష', Hindi: 'भाषा' },
  langChosen: {
    English: 'Now we will talk in English.',
    Telugu: 'ఇకపై తెలుగులో మాట్లాడదాం.',
    Hindi: 'अब हम हिंदी में बात करेंगे।',
  },
  sayAgain: { English: 'Say it again', Telugu: 'మళ్ళీ చెప్పు', Hindi: 'फिर से बोलो' },
  teacherWork: { English: 'From your teacher', Telugu: 'నీ టీచర్ నుండి', Hindi: 'तुम्हारी टीचर से' },
  // Subject page
  subjectGuide: {
    English: 'Tap the green button to read. Tap the film to watch the lesson. Tap the pencil for your workbook.',
    Telugu: 'చదవడానికి ఆకుపచ్చ బటన్ నొక్కు. పాఠం చూడడానికి సినిమా బొమ్మ నొక్కు. వర్క్‌బుక్ కోసం పెన్సిల్ నొక్కు.',
    Hindi: 'पढ़ने के लिए हरा बटन दबाओ। पाठ देखने के लिए फ़िल्म वाला चित्र दबाओ। कार्यपुस्तिका के लिए पेंसिल दबाओ।',
  },
  books: { English: 'My books', Telugu: 'నా పుస్తకాలు', Hindi: 'मेरी किताबें' },
  learnPlay: { English: 'Learn and play', Telugu: 'నేర్చుకో, ఆడుకో', Hindi: 'सीखो और खेलो' },
  learnPlaySay: {
    English: 'Learn with pictures, then play a game.',
    Telugu: 'బొమ్మలతో నేర్చుకో, తర్వాత ఆట ఆడు.',
    Hindi: 'चित्रों से सीखो, फिर खेल खेलो।',
  },
  start: { English: 'Start', Telugu: 'మొదలుపెట్టు', Hindi: 'शुरू करो' },
  continue: { English: 'Continue', Telugu: 'కొనసాగించు', Hindi: 'आगे पढ़ो' },
  readAgain: { English: 'Read again', Telugu: 'మళ్ళీ చదువు', Hindi: 'फिर से पढ़ो' },
  chapters: { English: 'Chapters', Telugu: 'పాఠాలు', Hindi: 'पाठ' },
  watch: { English: 'Watch', Telugu: 'చూడు', Hindi: 'देखो' },
  workbook: { English: 'Workbook', Telugu: 'వర్క్‌బుక్', Hindi: 'कार्यपुस्तिका' },
  back: { English: 'Back', Telugu: 'వెనక్కి', Hindi: 'वापस' },
  home: { English: 'Home', Telugu: 'హోమ్', Hindi: 'होम' },
  noBooks: {
    English: 'No books yet. Try learn and play!',
    Telugu: 'ఇంకా పుస్తకాలు లేవు. నేర్చుకో, ఆడుకో ప్రయత్నించు!',
    Hindi: 'अभी कोई किताब नहीं है। सीखो और खेलो आज़माओ!',
  },
  saveOffline: { English: 'Keep on phone', Telugu: 'ఫోన్‌లో దాచు', Hindi: 'फ़ोन में रखो' },
  onDevice: { English: 'On this phone', Telugu: 'ఈ ఫోన్‌లో ఉంది', Hindi: 'इस फ़ोन में है' },
  // Sign-in
  tapClass: { English: 'Hi! First, tap your class.', Telugu: 'నమస్తే! ముందు నీ తరగతిని నొక్కు.', Hindi: 'नमस्ते! पहले अपनी कक्षा दबाओ।' },
  tapName: { English: 'Now find your name and tap it.', Telugu: 'ఇప్పుడు నీ పేరు వెతికి నొక్కు.', Hindi: 'अब अपना नाम ढूँढो और दबाओ।' },
  classN: { English: 'Class {n}', Telugu: '{n}వ తరగతి', Hindi: 'कक्षा {n}' },
  isThisYou: {
    English: '{name}, is this you? Tap the button below.',
    Telugu: '{name}, ఇది నువ్వేనా? కింద ఉన్న బటన్ నొక్కు.',
    Hindi: '{name}, क्या यह तुम हो? नीचे वाला बटन दबाओ।',
  },
  chooseLanguage: { English: 'Choose your language', Telugu: 'నీ భాష ఎంచుకో', Hindi: 'अपनी भाषा चुनो' },
  // Reader
  readerGuide: {
    English: 'First listen. Then tap the microphone and read.',
    Telugu: 'ముందు విను. తర్వాత మైక్ నొక్కి చదువు.',
    Hindi: 'पहले सुनो। फिर माइक दबाकर पढ़ो।',
  },
  listen: { English: 'Listen', Telugu: 'విను', Hindi: 'सुनो' },
  nowYouRead: { English: 'Now you read', Telugu: 'ఇప్పుడు నువ్వు చదువు', Hindi: 'अब तुम पढ़ो' },
  next: { English: 'Next', Telugu: 'తర్వాత', Hindi: 'आगे' },
} satisfies Record<string, Record<UiLang, string>>;

export type UiKey = keyof typeof S;
export const UI_STRINGS: Record<UiKey, Record<UiLang, string>> = S;

/** A label in the child's language, with {name}/{n} filled in. */
export function t(lang: UiLang | undefined, key: UiKey, vars: Record<string, string | number> = {}): string {
  const text = UI_STRINGS[key][isUiLang(lang) ? lang : 'English'] || UI_STRINGS[key].English;
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

export const subjectLabel = (lang: UiLang | undefined, subject: string): string =>
  `subject_${subject}` in UI_STRINGS ? t(lang, `subject_${subject}` as UiKey) : subject;

export type EasySetting = 'on' | 'off';
export const isEasySetting = (x: unknown): x is EasySetting => x === 'on' || x === 'off';

const gradeNumber = (grade: string) => Number(String(grade || '').replace(/\D+/g, '')) || 0;

/**
 * Easy mode (pictures + voice first): what the child or teacher chose, else
 * on for Class 1-2 and for beginner readers of any class.
 */
export function easyModeOn(student: { grade?: string; readingLevel?: string; easyMode?: string | null } | null | undefined): boolean {
  if (!student) return false;
  if (student.easyMode === 'on') return true;
  if (student.easyMode === 'off') return false;
  const g = gradeNumber(student.grade || '');
  return (g > 0 && g <= 2) || student.readingLevel === 'beginner';
}

// The sign-in screen talks before anyone is signed in, while the voice API is
// for signed-in users (it spends Sarvam credits). These sign-in sentences, in
// any of the three languages, are the only text spoken without an account.
const PUBLIC_KEYS: UiKey[] = ['tapClass', 'tapName', 'classN', 'isThisYou', 'langChosen', 'chooseLanguage'];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PUBLIC_PATTERNS: RegExp[] = PUBLIC_KEYS.flatMap((key) =>
  UI_LANGS.map(
    (lang) =>
      new RegExp(
        `^${escapeRe(UI_STRINGS[key][lang].trim())
          .replace(/\\\{n\\\}/g, '\\d{1,2}')
          .replace(/\\\{name\\\}/g, "[\\p{L}\\p{M}' .-]{1,30}")}[.।]?$`,
        'u'
      )
  )
);

/** Is this one of the sign-in sentences (or two of them joined)? */
export function isPublicSpeech(text: unknown): boolean {
  const s = String(text ?? '').trim();
  if (!s || s.length > 200) return false;
  const one = (x: string) => PUBLIC_PATTERNS.some((re) => re.test(x));
  if (one(s)) return true;
  // Two sentences joined ("Class 5. Now find your name and tap it."); each
  // sentence may itself be several ("Hi! First, tap your class.").
  const parts = s.split(/(?<=[.!?।])\s+/);
  if (parts.length > 6) return false;
  for (let k = 1; k < parts.length; k++) {
    if (one(parts.slice(0, k).join(' ')) && one(parts.slice(k).join(' '))) return true;
  }
  return false;
}
