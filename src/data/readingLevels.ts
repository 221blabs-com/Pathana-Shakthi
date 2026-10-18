// Reading levels inside one class (multi-level teaching): a Class 4 room has
// children who cannot read a word yet and children who read fluently. Each
// child gets a level from their own reading (accuracy and words per minute
// from the microphone) that the teacher can override; the reader adapts to
// it. Shared by the browser and the server (class dashboard, teacher
// override), so it stays pure.

export type ReadingLevel = 'beginner' | 'developing' | 'proficient';

export const READING_LEVELS: ReadingLevel[] = ['beginner', 'developing', 'proficient'];

export const LEVEL_INFO: Record<ReadingLevel, { icon: string; name: string; forTeacher: string; forChild: string }> = {
  beginner: {
    icon: '🌱',
    name: 'Beginner',
    forTeacher: 'Not reading yet or reading word by word: listen first, short pages, picture and sound support.',
    forChild: 'Listen first, then read with me!',
  },
  developing: {
    icon: '🌿',
    name: 'Developing',
    forTeacher: 'Reads simple sentences with some mistakes: regular pages, practice hard words.',
    forChild: 'Read each page aloud.',
  },
  proficient: {
    icon: '🌳',
    name: 'Proficient',
    forTeacher: 'Reads the class text accurately and fluently: longer pages, more questions and activities.',
    forChild: 'Great reader — longer pages for you!',
  },
};

const gradeNumber = (grade: string) => Number(String(grade).replace(/\D+/g, '')) || 1;

/**
 * Words correct per minute expected by the end of the year. Class 2-3 follow
 * the NIPUN Bharat ORF goals (Class 2: 45-60, Class 3: 60); the others are
 * set around them. Used only relative to the child's own speed.
 */
export function orfTargetWpm(grade: string): number {
  const n = gradeNumber(grade);
  if (n <= 1) return 25;
  if (n === 2) return 45;
  if (n === 3) return 60;
  if (n === 4) return 70;
  if (n === 5) return 80;
  if (n <= 8) return 90;
  return 100;
}

export interface ReadingRecord {
  sessionsCount?: number;
  overallAccuracy?: number;
  averageWPM?: number;
}

/** The level from the child's readings, or null before two readings. */
export function autoReadingLevel(record: ReadingRecord, grade: string): ReadingLevel | null {
  const sessions = Number(record.sessionsCount) || 0;
  if (sessions < 2) return null;
  const accuracy = Number(record.overallAccuracy) || 0;
  const wpm = Number(record.averageWPM) || 0;
  const target = orfTargetWpm(grade);
  if (accuracy < 50 || (wpm > 0 && wpm < target * 0.4)) return 'beginner';
  if (accuracy >= 85 && (wpm === 0 || wpm >= target * 0.8)) return 'proficient';
  return 'developing';
}

export const isReadingLevel = (v: unknown): v is ReadingLevel => READING_LEVELS.includes(v as ReadingLevel);

/** The teacher's choice when set, else the automatic level, else "developing". */
export function effectiveReadingLevel(record: ReadingRecord & { readingLevel?: string | null }, grade: string): ReadingLevel {
  if (isReadingLevel(record.readingLevel)) return record.readingLevel;
  return autoReadingLevel(record, grade) ?? 'developing';
}

/** How the reader adapts: page length and whether each page is heard first. */
export function readerSettingsFor(level: ReadingLevel): { wordsScale: number; listenFirst: boolean } {
  if (level === 'beginner') return { wordsScale: 0.6, listenFirst: true };
  if (level === 'proficient') return { wordsScale: 1.4, listenFirst: false };
  return { wordsScale: 1, listenFirst: false };
}

/** The level of a signed-in child (from the server record), "developing" until known. */
export const levelOfStudent = (student: { readingLevel?: string | null } | null | undefined): ReadingLevel =>
  isReadingLevel(student?.readingLevel) ? student!.readingLevel as ReadingLevel : 'developing';
