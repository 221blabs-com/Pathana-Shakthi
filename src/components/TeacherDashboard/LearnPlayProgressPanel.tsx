import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { backendApi, ClassStudentRow } from '../../services/backendApi';
import { labChaptersFor, subjectsForGrade } from '../../data/learnPlay';
import { VIZ } from './charts';

const GRADES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
const first = (name: string) => name.split(' ')[0];

// Which built-in Learn & Play chapters each class has finished: for every
// chapter written for this class, how many children won its game, their
// average best score, and who has not tried it yet.
export const LearnPlayProgressPanel: React.FC<{ grade: string; onSelectGrade: (grade: string) => void }> = ({ grade, onSelectGrade }) => {
  const [students, setStudents] = useState<ClassStudentRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setStudents(null);
    setError('');
    backendApi.classDashboard
      .overview(grade)
      .then((o) => live && setStudents(o.students))
      .catch((err) => live && setError(err instanceof Error ? err.message : 'Could not load progress.'));
    return () => {
      live = false;
    };
  }, [grade]);

  return (
    <section id="learnplay-progress" className="mb-8 overflow-hidden rounded-3xl border border-amber-200 bg-amber-50/30 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-amber-100 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-stone-900">Learn & Play progress</h2>
          <p className="text-xs text-stone-600">The built-in chapters written for {grade}, and how far the class has got.</p>
        </div>
        <div role="tablist" aria-label="Class" className="flex flex-wrap gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={g === grade}
              onClick={() => onSelectGrade(g)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black ${
                g === grade ? 'bg-amber-500 text-stone-950 shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">{error}</p>}
        {!students && !error && (
          <p className="flex items-center gap-2 text-xs font-bold text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {grade}…
          </p>
        )}
        {students && (
          <div className="grid gap-4 md:grid-cols-2">
            {subjectsForGrade(grade).map((subject) => {
              const chapters = labChaptersFor(subject, grade);
              if (!chapters.length) return null;
              return (
                <div key={subject} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <h3 className="text-sm font-black text-stone-900">{subject}</h3>
                  <ul className="mt-3 space-y-3">
                    {chapters.map((ch) => {
                      const done = students.filter((s) => (s.labProgress?.[ch.id]?.stars || 0) > 0);
                      const tried = students.filter((s) => s.labProgress?.[ch.id]);
                      const notYet = students.filter((s) => !s.labProgress?.[ch.id]);
                      const scores = tried
                        .map((s) => s.labProgress[ch.id])
                        .filter((p) => p.total > 0)
                        .map((p) => (p.bestScore / p.total) * 100);
                      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                      const share = students.length ? done.length / students.length : 0;
                      return (
                        <li key={ch.id} className="learnplay-progress-row" data-chapter={ch.id}>
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-bold text-stone-800">
                              {ch.emoji} {ch.title}
                            </span>
                            <span className="whitespace-nowrap font-black text-stone-900">
                              {done.length} of {students.length}
                              {avg !== null && <span className="ml-1.5 font-semibold text-stone-500">avg {avg}%</span>}
                            </span>
                          </div>
                          <div className="mt-1 h-2.5 w-full rounded-full bg-stone-100" title={`${done.length} of ${students.length} children won this game`}>
                            <div className="h-2.5 rounded-full" style={{ width: `${share * 100}%`, background: VIZ.series, minWidth: done.length ? 6 : 0 }} />
                          </div>
                          {notYet.length > 0 && notYet.length < students.length && (
                            <p className="mt-1 text-[10px] text-stone-500">
                              Not tried yet: {notYet.slice(0, 6).map((s) => first(s.name)).join(', ')}
                              {notYet.length > 6 ? ` +${notYet.length - 6}` : ''}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
