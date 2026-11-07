import React from 'react';
import { soundEffects } from '../services/soundEffects';
import { ChapterAction, chapterPlan } from '../data/chapterActions';
import { t, UiLang, UiKey } from '../data/uiStrings';
import { openExplainer } from './ExplainerPlayer';
import { loadPracticeDone, openPractice } from './PracticePanel';
import { openFlnCheck } from './FlnCheckPanel';
import { loadWorkbookState, openWorkbook } from './UnitWorkbookPanel';
import { openMathsTest } from './MathsTestPanel';

// The small buttons beside a chapter in a book's chapter list (subject page).
// Which ones a chapter gets comes from chapterPlan (src/data/chapterActions.ts):
// maths chapters get Watch · Q&A · Workbook, the rest Watch · Practice ·
// Reading check · Workbook. Stacked on phones so the title keeps its room.

export interface ChapterRef {
  id: string;
  chapterTitle: string;
  subject?: string;
}

const STYLE: Record<ChapterAction, { icon: string; label: UiKey; className: string; aria: string }> = {
  watch: { icon: '🎬', label: 'watch', className: 'chapter-explainer text-sky-800 hover:bg-sky-50', aria: 'Animated lesson' },
  qa: { icon: '❓', label: 'mathsQaShort', className: 'chapter-maths-qa text-emerald-800 hover:bg-emerald-50', aria: 'Questions and answers' },
  practice: { icon: '🎯', label: 'practice', className: 'chapter-practice text-violet-800 hover:bg-violet-50', aria: 'Practice' },
  fln: { icon: '🧪', label: 'fln', className: 'chapter-fln text-sky-800 hover:bg-sky-50', aria: 'Reading check' },
  workbook: { icon: '📝', label: 'workbook', className: 'chapter-workbook text-amber-800 hover:bg-amber-50', aria: 'Workbook' },
};

function run(action: ChapterAction, chapter: ChapterRef) {
  const target = { readingId: chapter.id, chapterTitle: chapter.chapterTitle, subject: chapter.subject };
  if (action === 'watch') openExplainer({ readingId: chapter.id, chapterTitle: chapter.chapterTitle });
  else if (action === 'qa') openMathsTest({ ...target, mode: 'qa' });
  else if (action === 'practice') openPractice(target);
  else if (action === 'fln') openFlnCheck(target);
  else openWorkbook(target);
}

export const ChapterActionButtons: React.FC<{ chapter: ChapterRef; studentId: string; lang: UiLang; locked?: boolean }> = ({ chapter, studentId, lang, locked }) => {
  const { actions } = chapterPlan(chapter);
  const icon = (a: ChapterAction) => {
    if (a === 'practice' && loadPracticeDone(studentId, chapter.id)) return '🏅';
    if (a === 'workbook' && loadWorkbookState(studentId, chapter.id)?.done) return '✅';
    return STYLE[a].icon;
  };
  return (
    <div className="flex w-11 shrink-0 flex-col border-l border-stone-100 sm:w-auto sm:flex-row sm:border-l-0">
      {actions.map((a, i) => (
        <button
          key={a}
          type="button"
          disabled={locked}
          className={`${STYLE[a].className} flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-black disabled:opacity-40 sm:w-16 sm:border-l sm:border-stone-100 ${
            i > 0 ? 'border-t border-stone-100 sm:border-t-0' : ''
          }`}
          aria-label={`${STYLE[a].aria}: ${chapter.chapterTitle}`}
          onClick={() => {
            soundEffects.playWordPop();
            run(a, chapter);
          }}
        >
          <span className="text-lg" aria-hidden>
            {icon(a)}
          </span>
          <span className="hidden sm:block">{t(lang, STYLE[a].label)}</span>
        </button>
      ))}
    </div>
  );
};
