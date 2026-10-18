import { GradeLevel } from '../types';

// Telangana State Board: primary school (Class 1-5) and high school
// (Class 6-10). Every class picker in the app uses this list.
export const ALL_GRADES: GradeLevel[] = [
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

export const gradeNum = (grade: string | undefined): number => Number(String(grade || '').replace(/\D/g, '')) || 1;

/** Class 6-10 (high school) get the Telangana syllabus panel and the simulation labs. */
export const isHighSchool = (grade: string | undefined): boolean => gradeNum(grade) >= 6;
