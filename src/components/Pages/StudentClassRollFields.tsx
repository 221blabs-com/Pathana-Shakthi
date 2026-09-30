import React from 'react';
import { motion } from 'motion/react';
import { Hash } from 'lucide-react';

const CLASSES = [
  { grade: 'Class 1', short: '1', emoji: '🐣', color: 'from-amber-300 to-orange-400' },
  { grade: 'Class 2', short: '2', emoji: '🐰', color: 'from-lime-300 to-emerald-400' },
  { grade: 'Class 3', short: '3', emoji: '🦊', color: 'from-sky-300 to-blue-400' },
  { grade: 'Class 4', short: '4', emoji: '🐘', color: 'from-violet-300 to-purple-400' },
  { grade: 'Class 5', short: '5', emoji: '🦁', color: 'from-rose-300 to-pink-400' },
];

// Student sign-in fields: tap your class, type your roll number. Big targets
// and no ID card needed, so a Class 1 child can do it alone.
export const StudentClassRollFields: React.FC<{
  grade: string;
  rollNumber: string;
  onGradeChange: (grade: string) => void;
  onRollChange: (roll: string) => void;
}> = ({ grade, rollNumber, onGradeChange, onRollChange }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <img src="/shakthi-face-256.png" alt="" className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-0.5 shadow" />
      <p className="text-xs font-bold text-amber-900 sm:text-sm">
        Hi! I am Shakthi Mitra. Tap your class, then type your roll number.
      </p>
    </div>

    <div>
      <p className="text-xs font-black uppercase tracking-wide text-stone-600">Your class</p>
      <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Your class">
        {CLASSES.map((c) => {
          const active = grade === c.grade;
          return (
            <motion.button
              key={c.grade}
              type="button"
              role="radio"
              aria-checked={active}
              data-grade={c.grade}
              whileTap={{ scale: 0.92 }}
              onClick={() => onGradeChange(c.grade)}
              className={`class-tile relative flex flex-col items-center justify-center rounded-2xl border-2 py-2.5 transition-all ${
                active
                  ? `border-transparent bg-gradient-to-b ${c.color} text-white shadow-lg ring-4 ring-orange-200`
                  : 'border-stone-200 bg-white text-stone-700 hover:border-orange-300'
              }`}
            >
              <span className="text-2xl leading-none sm:text-3xl" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-80">Class</span>
              <span className="text-lg font-black leading-none">{c.short}</span>
            </motion.button>
          );
        })}
      </div>
    </div>

    <div>
      <label htmlFor="student-roll-input" className="text-xs font-black uppercase tracking-wide text-stone-600">
        Roll number
      </label>
      <div className="relative mt-2">
        <Hash className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          id="student-roll-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={rollNumber}
          onChange={(e) => onRollChange(e.target.value)}
          placeholder="e.g. 7"
          autoComplete="off"
          className="w-full rounded-2xl border-2 border-stone-200 bg-white py-3 pl-11 pr-4 text-2xl font-black tracking-widest text-stone-900 outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
        />
      </div>
      <p className="mt-2 text-[11px] text-stone-500">Don't know your roll number? Ask your teacher.</p>
    </div>
  </div>
);
