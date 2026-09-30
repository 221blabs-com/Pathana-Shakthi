import React, { useMemo, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { labChaptersFor, LabChapter } from '../../data/learnPlay';
import { getLabProgress } from '../../services/learnPlayProgress';
import { soundEffects } from '../../services/soundEffects';
import { Student } from '../../types';
import { MitraGuide } from './ui';

// A chapter card that tilts toward the pointer (3D) and lifts on hover.
const TiltCard: React.FC<{ chapter: LabChapter; stars: number; steps: number; onOpen: () => void }> = ({ chapter, stars, steps, onOpen }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 18 });
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || e.pointerType !== 'mouse') return;
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  };
  return (
    <div style={{ perspective: 900 }}>
      <motion.button
        ref={ref}
        type="button"
        onPointerMove={move}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
        onClick={() => {
          soundEffects.playWordPop();
          onOpen();
        }}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.97 }}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`lab-chapter-card card-3d relative w-full overflow-hidden bg-gradient-to-br ${chapter.gradient} p-4 text-left`}
        id={`lab-card-${chapter.id}`}
      >
        <span className="absolute -right-3 -top-4 text-7xl opacity-30" aria-hidden="true">
          {chapter.emoji}
        </span>
        <span className="float-slow relative inline-block text-5xl drop-shadow-[0_6px_0_rgba(0,0,0,0.12)]" style={{ transform: 'translateZ(40px)' }}>
          {chapter.emoji}
        </span>
        <h3 className="relative mt-2 text-lg font-black leading-tight text-stone-900">{chapter.title}</h3>
        <p className="relative mt-0.5 line-clamp-2 text-xs font-bold text-stone-800/75">{chapter.subtitle}</p>
        <div className="relative mt-3 flex items-center justify-between">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-stone-700">
            📖 🎮 🎤 · {steps}/3
          </span>
          <span className="text-lg font-black text-amber-500 drop-shadow" aria-label={`${stars} of 3 stars`}>
            {'★'.repeat(stars)}
            <span className="text-white/70">{'★'.repeat(3 - stars)}</span>
          </span>
        </div>
      </motion.button>
    </div>
  );
};

export const LearnPlayShelf: React.FC<{ subject: string; student: Student; onOpen: (chapterId: string) => void }> = ({
  subject,
  student,
  onOpen,
}) => {
  const chapters = labChaptersFor(subject, student.grade);
  const progress = useMemo(() => getLabProgress(student.id), [student.id, student.stars, student.completedStoryIds]);
  if (chapters.length === 0) return null;
  return (
    <section className="px-5 pt-5 sm:px-7 sm:pt-7" id="learn-play-shelf" aria-labelledby="learn-play-heading">
      <div className="rounded-[24px] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="learn-play-heading" className="text-lg font-black text-stone-900 sm:text-xl">
              🎮 Learn & Play
            </h2>
            <p className="text-xs font-semibold text-stone-500">Learn with pictures, play a game, then read aloud!</p>
          </div>
          <MitraGuide message="Pick a chapter — let's play!" size={48} side="right" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => {
            const p = progress[chapter.id];
            const steps =
              (p?.learned ? 1 : 0) + ((p?.stars || 0) > 0 ? 1 : 0) + (student.completedStoryIds?.includes(`lab_${chapter.id}`) ? 1 : 0);
            return <TiltCard key={chapter.id} chapter={chapter} stars={p?.stars || 0} steps={steps} onOpen={() => onOpen(chapter.id)} />;
          })}
        </div>
      </div>
    </section>
  );
};
