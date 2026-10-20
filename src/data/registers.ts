// A government primary teacher's records, kept by the app: the daily
// attendance register, FLN assessment rounds (baseline / midline / endline,
// pre-filled from what children did in the app, confirmed by the teacher) and
// period plans that follow the SCERT period steps. Shared by the browser and
// the server, so it stays pure (unit tested).
//
// The official Telangana record formats (FLN baseline sheet, primary
// registers) could not be read when this was written (see
// curriculum-research/05-teacher-workflow.md); the levels below are the
// widely used reading/maths level ladders, and every record says it is for
// the teacher's own records and export.
import { orfTargetWpm } from './readingLevels';

/* ------------------------------ attendance ------------------------------ */

export interface RegisterChild {
  id: string;
  name: string;
  rollNumber: string;
}

/** Children who used the app on a day (from their dailyActivity markers): a suggestion, never the record. */
export function suggestPresent(children: { id: string; dailyActivity?: Record<string, unknown[]> }[], day: string): string[] {
  return children.filter((c) => (c.dailyActivity?.[day] || []).length > 0).map((c) => c.id);
}

export interface MonthRegister {
  month: string;
  days: string[];
  rows: { child: RegisterChild; marks: ('P' | 'A' | '')[]; present: number; workingDays: number; percent: number | null }[];
  totals: { day: string; present: number; absent: number }[];
}

/** The month's register: one row per child, one column per day attendance was taken. */
export function monthRegister(month: string, children: RegisterChild[], records: Record<string, string[]>): MonthRegister {
  const days = Object.keys(records)
    .filter((d) => d.startsWith(month))
    .sort();
  const byRoll = [...children].sort(
    (a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name)
  );
  const rows = byRoll.map((child) => {
    const marks = days.map((d) => (records[d].includes(child.id) ? 'P' : 'A') as 'P' | 'A');
    const present = marks.filter((m) => m === 'P').length;
    return { child, marks, present, workingDays: days.length, percent: days.length ? Math.round((present / days.length) * 100) : null };
  });
  const totals = days.map((day) => {
    const present = byRoll.filter((c) => records[day].includes(c.id)).length;
    return { day, present, absent: byRoll.length - present };
  });
  return { month, days, rows, totals };
}

/** Children absent on each of the last `n` days attendance was taken (follow-up list). */
export function absentStreak(records: Record<string, string[]>, children: RegisterChild[], n = 3): RegisterChild[] {
  const last = Object.keys(records).sort().slice(-n);
  if (last.length < n) return [];
  return children.filter((c) => last.every((d) => !records[d].includes(c.id)));
}

/* --------------------------- FLN assessment rounds --------------------------- */

export type AssessmentRound = 'baseline' | 'midline' | 'endline';
export const ROUNDS: { id: AssessmentRound; name: string; when: string }[] = [
  { id: 'baseline', name: 'Baseline', when: 'start of the year (June)' },
  { id: 'midline', name: 'Midline', when: 'middle of the year (November)' },
  { id: 'endline', name: 'Endline', when: 'end of the year (February-March)' },
];

export const READING_LEVELS = ['beginner', 'letter', 'word', 'paragraph', 'story'] as const;
export type ReadingLevelMark = (typeof READING_LEVELS)[number];
export const READING_LEVEL_INFO: Record<ReadingLevelMark, string> = {
  beginner: 'Beginner — cannot yet read letters',
  letter: 'Letters — reads letters / aksharas',
  word: 'Words — reads simple words',
  paragraph: 'Paragraph — reads short sentences and a paragraph',
  story: 'Story — reads a story fluently with understanding',
};

export const MATHS_LEVELS = ['beginner', 'num1_9', 'num10_99', 'addsub', 'muldiv'] as const;
export type MathsLevelMark = (typeof MATHS_LEVELS)[number];
export const MATHS_LEVEL_INFO: Record<MathsLevelMark, string> = {
  beginner: 'Beginner — cannot yet recognise numbers 1-9',
  num1_9: 'Numbers 1-9 — recognises and counts',
  num10_99: 'Numbers 10-99 — recognises and compares',
  addsub: 'Addition and subtraction',
  muldiv: 'Multiplication and division',
};

export interface AssessmentEntry {
  reading?: ReadingLevelMark;
  /** Words correct per minute in a short passage. */
  wcpm?: number;
  /** Comprehension questions right (of 3). */
  comprehension?: number;
  maths?: MathsLevelMark;
  absent?: boolean;
  note?: string;
}

/** Clean one entry from the browser (unknown values dropped, numbers clamped). */
export function cleanEntry(raw: any): AssessmentEntry {
  const out: AssessmentEntry = {};
  if (READING_LEVELS.includes(raw?.reading)) out.reading = raw.reading;
  if (MATHS_LEVELS.includes(raw?.maths)) out.maths = raw.maths;
  const wcpm = Number(raw?.wcpm);
  if (raw?.wcpm !== '' && raw?.wcpm != null && Number.isFinite(wcpm)) out.wcpm = Math.max(0, Math.min(250, Math.round(wcpm)));
  const comp = Number(raw?.comprehension);
  if (raw?.comprehension !== '' && raw?.comprehension != null && Number.isFinite(comp)) out.comprehension = Math.max(0, Math.min(3, Math.round(comp)));
  if (raw?.absent) out.absent = true;
  const note = String(raw?.note || '').trim().slice(0, 200);
  if (note) out.note = note;
  return out;
}

export interface EvidenceForAssessment {
  sessionsCount?: number;
  overallAccuracy?: number;
  averageWPM?: number;
  practice?: Record<string, { right?: number; total?: number }>;
  quizCorrect?: number;
  quizTotal?: number;
  /** Competency statuses (src/data/competencies.ts), for maths. */
  numeracy?: { numberSense?: string; operations?: string };
}

const share = (r?: { right?: number; total?: number }) => (r && Number(r.total) ? (Number(r.right) || 0) / Number(r.total) : null);

/** What the app suggests for a child, from what they did in it; the teacher confirms or changes it. */
export function suggestEntry(e: EvidenceForAssessment, grade: string): AssessmentEntry {
  const out: AssessmentEntry = {};
  const sessions = Number(e.sessionsCount) || 0;
  const accuracy = Number(e.overallAccuracy) || 0;
  if (sessions > 0) {
    const wcpm = Math.round(((Number(e.averageWPM) || 0) * accuracy) / 100);
    out.wcpm = wcpm;
    out.reading =
      accuracy >= 75 && wcpm >= orfTargetWpm(grade) * 0.8 ? 'story' : accuracy >= 60 ? 'paragraph' : accuracy >= 40 ? 'word' : 'letter';
  } else {
    const sounds = share({
      right: (Number(e.practice?.first_sound?.right) || 0) + (Number(e.practice?.missing_letter?.right) || 0),
      total: (Number(e.practice?.first_sound?.total) || 0) + (Number(e.practice?.missing_letter?.total) || 0),
    });
    const listen = share(e.practice?.listen_choose);
    if (listen !== null && listen >= 0.75) out.reading = 'word';
    else if (sounds !== null) out.reading = sounds >= 0.5 ? 'letter' : 'beginner';
  }
  const quiz = Number(e.quizTotal) ? (Number(e.quizCorrect) || 0) / Number(e.quizTotal) : null;
  if (quiz !== null) out.comprehension = Math.round(quiz * 3);
  const ops = e.numeracy?.operations;
  const sense = e.numeracy?.numberSense;
  if (ops === 'achieved') out.maths = 'addsub';
  else if (sense === 'achieved') out.maths = 'num10_99';
  else if (sense === 'developing' || ops === 'developing') out.maths = 'num1_9';
  else if (sense === 'beginning') out.maths = 'beginner';
  return out;
}

/** How many children are at each level in a round (absent children left out). */
export function levelCounts(entries: Record<string, AssessmentEntry>): {
  reading: Record<ReadingLevelMark, number>;
  maths: Record<MathsLevelMark, number>;
  assessed: number;
} {
  const reading = Object.fromEntries(READING_LEVELS.map((l) => [l, 0])) as Record<ReadingLevelMark, number>;
  const maths = Object.fromEntries(MATHS_LEVELS.map((l) => [l, 0])) as Record<MathsLevelMark, number>;
  let assessed = 0;
  for (const e of Object.values(entries)) {
    if (e.absent) continue;
    if (e.reading || e.maths) assessed += 1;
    if (e.reading) reading[e.reading] += 1;
    if (e.maths) maths[e.maths] += 1;
  }
  return { reading, maths, assessed };
}

/** Children who moved up (or down) a reading level between two rounds. */
export function levelChange(before: AssessmentEntry | undefined, after: AssessmentEntry | undefined): number | null {
  if (!before?.reading || !after?.reading) return null;
  return READING_LEVELS.indexOf(after.reading) - READING_LEVELS.indexOf(before.reading);
}

/** The academic year a day falls in: June-May ("2026-27"). */
export function academicYear(day: string): string {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/* ------------------------------ period plans ------------------------------ */

export interface PeriodStep {
  step: string;
  minutes: number;
  /** What the teacher does, filled with the chapter's own words where possible. */
  do: string[];
}

export interface PeriodPlan {
  title: string;
  subject: string;
  /** Whether the steps are SCERT's (English, Telugu/Hindi) or a suggested sequence. */
  source: 'scert' | 'suggested';
  steps: PeriodStep[];
}

export interface PeriodSource {
  chapterTitle: string;
  subject: string;
  language?: string;
  paragraphs: string[];
  keyVocabulary?: { word?: string; meaning?: string }[];
  keyPoints?: string[];
  questions?: string[];
}

const firstSentences = (paragraphs: string[], n: number) =>
  paragraphs
    .join(' ')
    .split(/(?<=[.!?।॥])\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(' ');

/** A ~45-minute period for a chapter. English and Telugu/Hindi follow the SCERT
 * Tholimettu period steps; other subjects get a clearly marked suggested sequence. */
export function periodPlan(src: PeriodSource): PeriodPlan {
  const words = (src.keyVocabulary || []).map((v) => String(v?.word || '').trim()).filter(Boolean).slice(0, 5);
  const wordList = words.length ? words.join(', ') : 'the new words of the page';
  const text = firstSentences(src.paragraphs, 3);
  const qs = (src.questions || []).slice(0, 3);
  const points = (src.keyPoints || []).slice(0, 3);
  const isLanguage = ['English', 'Telugu', 'Hindi'].includes(src.subject);
  if (src.subject === 'English') {
    return {
      title: src.chapterTitle,
      subject: src.subject,
      source: 'scert',
      steps: [
        { step: 'Face-sheet activities', minutes: 5, do: ['Show the chapter picture; children say what they see, in any language.', `Bring out the words: ${wordList}.`] },
        { step: 'Listening text and activities', minutes: 7, do: ['Read the text aloud twice (or play the animated lesson 🎬).', 'Ask: who? where? what happened?'] },
        {
          step: 'Reading the text',
          minutes: 15,
          do: [
            'Picture interaction: talk about the picture next to the text.',
            'Individual reading: each child reads silently / points to words.',
            'Collaborative reading: pairs read to each other.',
            `Model reading: you read with expression: "${text}"`,
          ],
        },
        {
          step: 'Post-reading activities',
          minutes: 10,
          do: [...(qs.length ? qs.map((q) => `Ask: ${q}`) : ['Ask 2-3 questions about the text.']), 'Practice: 🎯 FLN practice sheet or the app practice for this chapter.'],
        },
        { step: 'Editing', minutes: 5, do: ['Children write 2 sentences about the text; correct capital letters, full stops and spellings together.'] },
      ],
    };
  }
  if (src.subject === 'Telugu' || src.subject === 'Hindi' || (isLanguage && src.language !== 'English')) {
    return {
      title: src.chapterTitle,
      subject: src.subject,
      source: 'scert',
      steps: [
        { step: 'Oral language development', minutes: 7, do: ['Talk about the picture and the children\'s own experience of the topic.', 'Sing or recite a related song/rhyme.'] },
        { step: 'Introduction of keywords', minutes: 6, do: [`Write the keywords on the board: ${wordList}.`, 'Children say each word, find its letters, and use it in a sentence.'] },
        { step: 'Reading activities', minutes: 12, do: [`Model reading: "${text}"`, 'Shared reading: the class reads with you.', 'Individual reading: children read in turn; beginners read the keywords.'] },
        { step: 'Comprehension activities', minutes: 8, do: qs.length ? qs.map((q) => `Ask: ${q}`) : ['Ask who/what/where/why questions about the text.'] },
        { step: 'Practice / writing', minutes: 8, do: ['Children write the keywords and one sentence.', 'Practice: 🎯 FLN practice sheet (missing letter, words in order).'] },
        { step: 'Story time', minutes: 4, do: ['Tell or read a short story connected to the lesson.'] },
      ],
    };
  }
  return {
    title: src.chapterTitle,
    subject: src.subject,
    source: 'suggested',
    steps: [
      { step: 'Warm-up with real things', minutes: 5, do: ['Start from what children see around them (objects, the school ground, home).'] },
      { step: 'New idea with TLM', minutes: 12, do: [...(points.length ? points : ['Explain the main idea with real objects or a drawing.']), 'Play the animated lesson 🎬 if a screen is available.'] },
      { step: 'Guided practice', minutes: 10, do: ['Solve or discuss two examples together; children explain how.'] },
      { step: 'Individual practice', minutes: 10, do: qs.length ? qs.map((q) => `Children answer: ${q}`) : ['Children do 3 questions on their own; walk around and help.'] },
      { step: 'Check and close', minutes: 8, do: ['Ask 2 children to tell what they learned.', 'Note who needs help tomorrow.'] },
    ],
  };
}
