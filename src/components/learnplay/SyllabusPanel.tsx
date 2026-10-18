import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { PublishedReadingSummary, Student } from '../../types';
import { SYLLABUS_SOURCE, SyllabusChapter, syllabusFor, syllabusTitleKey } from '../../data/telanganaSyllabus';
import { labChapterById } from '../../data/learnPlay';
import { getLabProgress } from '../../services/learnPlayProgress';
import { soundEffects } from '../../services/soundEffects';

/** The published chapter (if any) whose title matches a syllabus chapter. */
export function matchReading(chapter: SyllabusChapter, readings: PublishedReadingSummary[]): PublishedReadingSummary | null {
  const key = syllabusTitleKey(chapter.title);
  if (!key) return null;
  const scored = readings
    .map((r) => {
      const rk = syllabusTitleKey(r.chapterTitle);
      const exact = rk === key;
      const near = !exact && rk.length >= 6 && key.length >= 6 && (rk.includes(key) || key.includes(rk));
      return { r, score: exact ? 2 : near ? 1 : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.r.chapterOrder ?? 1e9) - (b.r.chapterOrder ?? 1e9));
  return scored[0]?.r ?? null;
}

// "Your Telangana syllabus" on a Class 6-10 subject page: the textbook's units
// and chapters, each linked to its simulation lab and/or the chapter the
// teacher published, and an "Ask Mitra" button for every chapter.
export const SyllabusPanel: React.FC<{
  subject: string;
  student: Student;
  readings: PublishedReadingSummary[];
  onOpenLab?: (labId: string) => void;
  onOpenReading: (readingId: string) => void;
  onAskMitra: (chapterTitle: string, book: string) => void;
}> = ({ subject, student, readings, onOpenLab, onOpenReading, onAskMitra }) => {
  const books = useMemo(() => syllabusFor(student.grade, subject), [student.grade, subject]);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const progress = useMemo(() => getLabProgress(student.id), [student.id, student.stars]);
  if (!books.length) return null;
  const totalChapters = books.reduce((n, b) => n + b.units.reduce((m, u) => m + u.chapters.length, 0), 0);
  const labCount = books.reduce((n, b) => n + b.units.reduce((m, u) => m + u.chapters.filter((c) => c.labId).length, 0), 0);
  return (
    <section className="px-5 pt-5 sm:px-7 sm:pt-7" id="syllabus-panel" aria-labelledby="syllabus-heading">
      <div className="rounded-[24px] border-2 border-sky-200 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="syllabus-heading" className="text-lg font-black text-stone-900 sm:text-xl">
              🗺️ Your {student.grade} syllabus
            </h2>
            <p className="text-xs font-semibold text-stone-500">
              {SYLLABUS_SOURCE} · {totalChapters} chapters · {labCount} with an interactive lab 🎮
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {books.map((book) => (
            <div key={book.book} className="rounded-2xl border border-sky-100 bg-white">
              {books.length > 1 && <h3 className="px-4 pt-3 text-sm font-black text-sky-800">📗 {book.book}</h3>}
              {book.units.map((unit, ui) => {
                const key = `${book.book}|${unit.name}`;
                const single = book.units.length === 1;
                const open = single || openUnit === key || (openUnit === null && ui === 0);
                return (
                  <div key={key} className="border-b border-stone-100 last:border-b-0">
                    {!single && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playWordPop();
                          setOpenUnit(open ? '' : key);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                        aria-expanded={open}
                      >
                        <span className="text-sm font-black text-stone-800">{unit.name}</span>
                        <span className="flex items-center gap-2 text-[11px] font-bold text-stone-400">
                          {unit.chapters.length} chapters
                          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                    )}
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.ol
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden px-2 pb-2"
                        >
                          {unit.chapters.map((chapter) => {
                            const lab = chapter.labId ? labChapterById(chapter.labId) : undefined;
                            const reading = matchReading(chapter, readings);
                            const stars = lab ? progress[lab.id]?.stars || 0 : 0;
                            const read = reading ? student.completedStoryIds?.includes(`reading_${reading.id}`) : false;
                            return (
                              <li key={`${chapter.no}-${chapter.title}`} className="syllabus-chapter flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 hover:bg-stone-50">
                                <span className="flex min-w-0 flex-1 basis-[12rem] items-center gap-2">
                                  <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 px-1.5 text-[11px] font-black text-sky-800">
                                    {chapter.no}
                                  </span>
                                  <span className="min-w-0 text-sm font-bold text-stone-800">{chapter.title}</span>
                                </span>
                                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                  {lab && onOpenLab && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenLab(lab.id)}
                                      className="syllabus-lab btn-3d bg-amber-400 px-2.5 py-1 text-xs text-amber-950"
                                      title={lab.title}
                                    >
                                      🎮 Lab {stars > 0 && <span className="text-amber-800">{'★'.repeat(stars)}</span>}
                                    </button>
                                  )}
                                  {reading && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenReading(reading.id)}
                                      className="syllabus-read btn-3d bg-emerald-500 px-2.5 py-1 text-xs text-white"
                                    >
                                      📘 Read {read && '✓'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onAskMitra(chapter.title, book.book)}
                                    className="syllabus-ask rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 hover:bg-violet-100"
                                  >
                                    🐯 Ask
                                  </button>
                                </span>
                              </li>
                            );
                          })}
                        </motion.ol>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-stone-400">
          📘 Read appears when your teacher publishes that chapter from the textbook.
        </p>
      </div>
    </section>
  );
};
