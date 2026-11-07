// What a child can do with a published chapter, per subject. Language,
// science and social chapters are read aloud (the reader listens) and have
// FLN practice and the reading check; maths chapters are not read aloud — their
// main action is the test, with questions & answers beside it.

import { isMathsReading } from './mathsScenes';

export type ChapterPrimary = 'read' | 'test';
export type ChapterAction = 'watch' | 'qa' | 'practice' | 'fln' | 'workbook';

export interface ChapterPlan {
  primary: ChapterPrimary;
  actions: ChapterAction[];
}

export function chapterPlan(chapter: { subject?: string }): ChapterPlan {
  if (isMathsReading(chapter)) return { primary: 'test', actions: ['watch', 'qa', 'workbook'] };
  return { primary: 'read', actions: ['watch', 'practice', 'fln', 'workbook'] };
}
