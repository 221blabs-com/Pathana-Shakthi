import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CLASS1_ENGLISH_UNITS, LESSON_STEPS, unitStepsDone } from '../../data/class1English';
import { getEnglishProgress } from '../../services/class1EnglishProgress';
import { soundEffects } from '../../services/soundEffects';
import { Student } from '../../types';

// The door to "My English Book · Class 1" on a Class 1 child's English page.
export const EnglishCourseBanner: React.FC<{ student: Student; onOpen: () => void }> = ({ student, onOpen }) => {
  const { done, total } = useMemo(() => {
    const progress = getEnglishProgress(student.id);
    return {
      done: CLASS1_ENGLISH_UNITS.reduce((sum, u) => sum + unitStepsDone(progress[u.id]), 0),
      total: CLASS1_ENGLISH_UNITS.length * LESSON_STEPS.length,
    };
  }, [student.id]);
  return (
    <section className="px-5 pt-5 sm:px-7 sm:pt-7">
      <motion.button
        type="button"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          soundEffects.playWordPop();
          onOpen();
        }}
        id="btn-open-english-course"
        className="card-3d relative w-full overflow-hidden bg-gradient-to-br from-amber-300 via-rose-300 to-sky-300 p-5 text-left"
      >
        <span className="absolute -right-3 -top-6 text-[8rem] opacity-25" aria-hidden="true">
          🔤
        </span>
        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-black text-stone-700">Class 1</span>
        <h2 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">📘 My English Book</h2>
        <p className="mt-1 text-sm font-bold text-stone-800">Pictures, stories, rhymes, letter sounds, writing and reading — 8 units.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/70">
            <div className="h-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-stone-800">{done === 0 ? 'Start ▶' : 'Continue ▶'}</span>
        </div>
      </motion.button>
    </section>
  );
};
