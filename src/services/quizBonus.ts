// Bonus stars for a story's comprehension quiz: 5 per right answer plus 10
// for finishing, once per story per day (the server applies the same rule,
// see type "quiz" in server/studentRoutes.ts), so retaking a quiz can't farm
// stars and the quiz never promises stars the child won't get.
import { localDay } from './progressSync';

export const quizBonusStars = (correct: number, total: number) =>
  Math.max(0, Math.min(correct, total)) * 5 + 10;

const key = (studentId: string) => `ps_quiz_bonus_${studentId}`;

function read(studentId: string): Record<string, string[]> {
  try {
    const value = JSON.parse(localStorage.getItem(key(studentId)) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function quizBonusAvailable(studentId: string, storyId: string): boolean {
  return !(read(studentId)[localDay()] || []).includes(storyId);
}

export function markQuizBonus(studentId: string, storyId: string) {
  const today = localDay();
  try {
    // Only today's list is kept.
    localStorage.setItem(key(studentId), JSON.stringify({ [today]: [...(read(studentId)[today] || []), storyId] }));
  } catch {
    // The server still awards the bonus only once.
  }
}
