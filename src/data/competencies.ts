// Competencies a teacher tracks, aligned to Foundational Literacy and
// Numeracy (NIPUN Bharat, NEP 2020; Telangana's FLN programme) for Class 1-5
// and to the SCERT Telangana subject learning outcomes for Class 6-10. Each
// one is measured from what children actually do in the app (read-aloud
// accuracy and speed, quiz and workbook answers, word practice, Learn & Play
// stars), so the teacher never has to type marks in. Shared by the browser
// and the server, so it stays pure.
import { labChaptersFor, labChapterById } from './learnPlay';
import { orfTargetWpm } from './readingLevels';

export type CompetencyStatus = 'not_started' | 'beginning' | 'developing' | 'achieved';
export type CompetencyArea = 'Literacy' | 'Numeracy' | 'EVS' | 'Maths' | 'Science' | 'Social';

export interface Competency {
  id: string;
  area: CompetencyArea;
  icon: string;
  name: string;
  short: string;
  /** Which framework goal it maps to. */
  framework: string;
  /** How the app measures it, in plain words for the teacher. */
  measured: string;
  grades: [number, number];
  /** Learn & Play chapters that practise it (measured by their stars). */
  labs?: string[];
  /** Lab subjects whose chapters for the class practise it (Class 6-10, EVS). */
  labSubjects?: string[];
}

export const COMPETENCIES: Competency[] = [
  {
    id: 'lit-decoding',
    area: 'Literacy',
    icon: '🔤',
    name: 'Reads words correctly (decoding)',
    short: 'Decoding',
    framework: 'NIPUN Bharat literacy: decoding and word recognition',
    measured: 'Share of words read correctly aloud (75%+ achieved, 50%+ developing).',
    grades: [1, 10],
  },
  {
    id: 'lit-orf',
    area: 'Literacy',
    icon: '🏃',
    name: 'Reads aloud with fluency (ORF)',
    short: 'Fluency (ORF)',
    framework: 'NIPUN Bharat Oral Reading Fluency goal (Class 2: 45-60, Class 3: 60 words correct per minute)',
    measured: 'Words correct per minute (speed × accuracy) against the class goal (100% achieved, 60%+ developing).',
    grades: [1, 10],
  },
  {
    id: 'lit-vocab',
    area: 'Literacy',
    icon: '📖',
    name: 'Knows the meaning of words (vocabulary)',
    short: 'Vocabulary',
    framework: 'NIPUN Bharat literacy: vocabulary',
    measured: 'Dictionary word practice and fill-in-the-blank answers in chapter workbooks.',
    grades: [1, 10],
  },
  {
    id: 'lit-comprehension',
    area: 'Literacy',
    icon: '💡',
    name: 'Understands what is read (comprehension)',
    short: 'Comprehension',
    framework: 'NIPUN Bharat literacy: reading comprehension',
    measured: 'Right answers in chapter quizzes and workbook questions (75%+ achieved, 50%+ developing).',
    grades: [1, 10],
  },
  {
    id: 'lit-reflection',
    area: 'Literacy',
    icon: '✍️',
    name: 'Reflects on learning and writes about it',
    short: 'Reflection',
    framework: 'NEP 2020: self-assessment and reflection; NIPUN Bharat: writing',
    measured: 'Chapter workbooks finished with the "What I learned" page (3 achieved, 1 developing).',
    grades: [1, 10],
  },
  {
    id: 'lit-phonics',
    area: 'Literacy',
    icon: '🔊',
    name: 'Builds words from sounds (phonics)',
    short: 'Phonics',
    framework: 'NIPUN Bharat literacy: phonological awareness',
    measured: 'Stars in the word-building and rhyme games.',
    grades: [1, 3],
    labs: ['english-words', 'english-rhymes', 'telugu-words', 'hindi-words'],
  },
  {
    id: 'num-number-sense',
    area: 'Numeracy',
    icon: '🔢',
    name: 'Counts and understands numbers',
    short: 'Number sense',
    framework: 'NIPUN Bharat numeracy: pre-number concepts and numbers up to 99/999',
    measured: 'Stars in counting and number-line games.',
    grades: [1, 5],
    labs: ['maths-counting', 'maths-numberline'],
  },
  {
    id: 'num-operations',
    area: 'Numeracy',
    icon: '➕',
    name: 'Adds, subtracts and multiplies',
    short: 'Operations',
    framework: 'NIPUN Bharat numeracy: addition, subtraction, multiplication',
    measured: 'Stars in adding, taking away, number line and groups-of games.',
    grades: [1, 5],
    labs: ['maths-adding', 'maths-takeaway', 'maths-numberline', 'maths-multiply'],
  },
  {
    id: 'num-shapes',
    area: 'Numeracy',
    icon: '🔺',
    name: 'Knows shapes and space',
    short: 'Shapes',
    framework: 'NIPUN Bharat numeracy: shapes and spatial understanding',
    measured: 'Stars in the shapes game.',
    grades: [1, 5],
    labs: ['maths-shapes'],
  },
  {
    id: 'num-measurement',
    area: 'Numeracy',
    icon: '🕒',
    name: 'Measures and tells the time',
    short: 'Measurement',
    framework: 'NIPUN Bharat numeracy: measurement and time',
    measured: 'Stars in the clock game.',
    grades: [2, 5],
    labs: ['maths-clock'],
  },
  {
    id: 'num-fractions',
    area: 'Numeracy',
    icon: '🍕',
    name: 'Understands halves and quarters',
    short: 'Fractions',
    framework: 'SCERT Telangana Class 3-5 learning outcome: fractions',
    measured: 'Stars in the fractions game.',
    grades: [3, 5],
    labs: ['maths-fractions'],
  },
  {
    id: 'evs',
    area: 'EVS',
    icon: '🌱',
    name: 'Understands the world around (EVS)',
    short: 'EVS',
    framework: 'SCERT Telangana EVS learning outcomes (Class 1-5)',
    measured: 'Stars in the Science and Social chapters of Learn & Play for the class.',
    grades: [1, 5],
    labSubjects: ['Science', 'Social'],
  },
  {
    id: 'sub-maths',
    area: 'Maths',
    icon: '📐',
    name: 'Maths concepts of the class syllabus',
    short: 'Maths',
    framework: 'SCERT Telangana Mathematics learning outcomes (Class 6-10)',
    measured: 'Stars in the maths simulation labs named in the class syllabus.',
    grades: [6, 10],
    labSubjects: ['Maths'],
  },
  {
    id: 'sub-science',
    area: 'Science',
    icon: '🔬',
    name: 'Science concepts of the class syllabus',
    short: 'Science',
    framework: 'SCERT Telangana Science learning outcomes (Class 6-10)',
    measured: 'Stars in the science simulation labs named in the class syllabus.',
    grades: [6, 10],
    labSubjects: ['Science'],
  },
  {
    id: 'sub-social',
    area: 'Social',
    icon: '🌏',
    name: 'Social studies concepts of the class syllabus',
    short: 'Social',
    framework: 'SCERT Telangana Social Studies learning outcomes (Class 6-10)',
    measured: 'Stars in the social studies labs named in the class syllabus.',
    grades: [6, 10],
    labSubjects: ['Social'],
  },
];

export const STATUS_INFO: Record<CompetencyStatus, { icon: string; name: string; color: string }> = {
  not_started: { icon: '⚪', name: 'Not started', color: '#d6d3d1' },
  beginning: { icon: '🔴', name: 'Beginning', color: '#f87171' },
  developing: { icon: '🟡', name: 'Developing', color: '#facc15' },
  achieved: { icon: '🟢', name: 'Achieved', color: '#22c55e' },
};

const gradeNum = (grade: string) => Number(String(grade).replace(/\D+/g, '')) || 1;

/** Learn & Play chapters (available to this class) that practise a competency. */
export function competencyLabs(c: Competency, grade: string): string[] {
  const n = gradeNum(grade);
  const ids = new Set<string>();
  for (const id of c.labs || []) {
    const lab = labChapterById(id);
    if (lab && n >= lab.grades[0] && n <= lab.grades[1]) ids.add(id);
  }
  for (const subject of c.labSubjects || []) for (const lab of labChaptersFor(subject, grade)) ids.add(lab.id);
  return [...ids];
}

/** The competencies that apply to a class (lab-measured ones only when the class has those labs). */
export function competenciesFor(grade: string): Competency[] {
  const n = gradeNum(grade);
  return COMPETENCIES.filter(
    (c) => n >= c.grades[0] && n <= c.grades[1] && (!(c.labs || c.labSubjects) || competencyLabs(c, grade).length > 0)
  );
}

export interface CompetencyEvidence {
  sessionsCount?: number;
  overallAccuracy?: number;
  averageWPM?: number;
  wordsPracticed?: number;
  quizCorrect?: number;
  quizTotal?: number;
  labProgress?: Record<string, { stars?: number }>;
  units?: { blanksCorrect?: number; blanksTotal?: number; questionsKnown?: number; questionsTotal?: number; done?: boolean }[];
}

function labStatus(labs: string[], progress: CompetencyEvidence['labProgress'] = {}): CompetencyStatus {
  if (!labs.length) return 'not_started';
  const stars = labs.map((id) => Number(progress?.[id]?.stars) || 0);
  if (!labs.some((id) => progress?.[id])) return 'not_started';
  if (stars.every((s) => s >= 2)) return 'achieved';
  if (stars.filter((s) => s >= 1).length * 2 >= labs.length) return 'developing';
  return 'beginning';
}

/** One child's status on one competency. */
export function competencyStatus(c: Competency, e: CompetencyEvidence, grade: string): CompetencyStatus {
  const sessions = Number(e.sessionsCount) || 0;
  const accuracy = Number(e.overallAccuracy) || 0;
  const units = e.units || [];
  switch (c.id) {
    case 'lit-decoding':
      if (!sessions) return 'not_started';
      if (accuracy >= 75 && sessions >= 2) return 'achieved';
      return accuracy >= 50 ? 'developing' : 'beginning';
    case 'lit-orf': {
      const wpm = Number(e.averageWPM) || 0;
      if (!sessions || !wpm) return 'not_started';
      const wcpm = (wpm * accuracy) / 100;
      const target = orfTargetWpm(grade);
      if (wcpm >= target && sessions >= 2) return 'achieved';
      return wcpm >= target * 0.6 ? 'developing' : 'beginning';
    }
    case 'lit-vocab': {
      const words = Number(e.wordsPracticed) || 0;
      const blanksTotal = units.reduce((n, u) => n + (Number(u.blanksTotal) || 0), 0);
      const blanksRight = units.reduce((n, u) => n + (Number(u.blanksCorrect) || 0), 0);
      const share = blanksTotal ? blanksRight / blanksTotal : null;
      if (!words && share === null) return 'not_started';
      if ((words >= 20 && (share === null || share >= 0.7)) || (share !== null && share >= 0.8 && blanksTotal >= 6)) return 'achieved';
      if (words >= 5 || (share !== null && share >= 0.5)) return 'developing';
      return 'beginning';
    }
    case 'lit-comprehension': {
      const right = (Number(e.quizCorrect) || 0) + units.reduce((n, u) => n + (Number(u.questionsKnown) || 0), 0);
      const total = (Number(e.quizTotal) || 0) + units.reduce((n, u) => n + (Number(u.questionsTotal) || 0), 0);
      if (!total) return 'not_started';
      const share = right / total;
      if (share >= 0.75 && total >= 5) return 'achieved';
      return share >= 0.5 ? 'developing' : 'beginning';
    }
    case 'lit-reflection': {
      if (!units.length) return 'not_started';
      const done = units.filter((u) => u.done).length;
      if (done >= 3) return 'achieved';
      return done >= 1 ? 'developing' : 'beginning';
    }
    default:
      return labStatus(competencyLabs(c, grade), e.labProgress);
  }
}

export interface PracticeSuggestion {
  kind: 'reading' | 'workbook' | 'lab' | 'dictionary';
  id: string;
  title: string;
}

/** Practice to give a child (or group) who has not achieved a competency yet. */
export function practiceFor(c: Competency, grade: string, progress: CompetencyEvidence['labProgress'] = {}): PracticeSuggestion | null {
  const labs = competencyLabs(c, grade);
  if (labs.length) {
    // The weakest lab first.
    const id = [...labs].sort((a, b) => (Number(progress?.[a]?.stars) || 0) - (Number(progress?.[b]?.stars) || 0))[0];
    const lab = labChapterById(id);
    return lab ? { kind: 'lab', id: lab.id, title: lab.title } : null;
  }
  if (c.id === 'lit-vocab' || c.id === 'lit-decoding') return { kind: 'dictionary', id: 'dictionary', title: 'Word practice' };
  return null; // reading-based ones: the teacher picks a chapter
}

/** What a teacher can do in class for a competency (remediation ideas). */
export const CLASSROOM_IDEAS: Record<string, string> = {
  'lit-decoding': 'Word cards from the chapter: children read 5 words a day to a partner; beginners listen first, then say each word.',
  'lit-orf': 'Echo reading: you read a line, the group reads it back; then a 1-minute timed read of a page twice a week.',
  'lit-vocab': 'Word wall of the chapter words with pictures; play "show me" — say a word, children point or act it out.',
  'lit-comprehension': 'After each page ask: who? where? what happened? why? Let children answer in their home language first.',
  'lit-reflection': 'End the period with "one thing I learned" — children say it aloud, then draw or write it.',
  'lit-phonics': 'Sound games: clap syllables, find words that start with the same sound, make rhymes with the class name list.',
  'num-number-sense': 'Count real things (stones, sticks, seeds) in groups of ten; a number line on the floor to hop on.',
  'num-operations': 'Story sums with objects: "3 mangoes and 2 more" — act it out, then write it; ask children to make their own.',
  'num-shapes': 'Shape hunt in the classroom and school ground; make shapes with sticks and string.',
  'num-measurement': 'Paper clock for the class timetable; measure the bench with hand spans and then with a ruler.',
  'num-fractions': 'Fold paper and share rotis/fruit into halves and quarters; colour the parts.',
  evs: 'Take the class outside: observe plants, animals and helpers near school; children draw and tell what they saw.',
  'sub-maths': 'Pair work on the lab: one child moves the sliders, the other predicts the answer first, then swap.',
  'sub-science': 'Do the simulation together, then the real activity from the textbook with simple materials.',
  'sub-social': 'Use the globe/timeline lab on the projector or phone, then a map or timeline drawing in notebooks.',
};
