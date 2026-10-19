import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { CLASS1_ENGLISH_UNITS, LESSON_STEPS, englishClassProgress } from '../../data/class1English';
import { backendApi, ClassStudentRow } from '../../services/backendApi';

const first = (name: string) => name.split(' ')[0];

// Class 1 English progress for the teacher: each unit's reach and average
// score per step, a child × unit grid (steps done, tap for scores), who is
// stuck where, and "Give this unit" to the children who haven't finished it.
// Data: each child's server game records (eng1-<unit>-<step>).
export const EnglishClassProgressPanel: React.FC<{ grade?: string }> = ({ grade = 'Class 1' }) => {
  const [students, setStudents] = useState<ClassStudentRow[] | null>(null);
  const [error, setError] = useState('');
  const [cell, setCell] = useState<{ child: string; unit: string } | null>(null);
  const [sent, setSent] = useState<string>('');
  const [sending, setSending] = useState(false);

  const load = () => {
    setStudents(null);
    setError('');
    backendApi.classDashboard
      .overview(grade)
      .then((o) => setStudents(o.students))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load progress.'));
  };
  useEffect(load, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => (students ? englishClassProgress(students) : null), [students]);

  const give = async (unitId: string) => {
    if (!progress) return;
    const unit = CLASS1_ENGLISH_UNITS.find((u) => u.id === unitId)!;
    const ids = progress.children.filter((c) => c.units[unitId].steps < LESSON_STEPS.length).map((c) => c.id);
    if (!ids.length) return;
    setSending(true);
    try {
      const r = await backendApi.support.assign(grade, {
        studentIds: ids,
        text: `Please finish My English Book Unit ${unit.number}: ${unit.title}.`,
        assign: { kind: 'english1', id: unit.id, title: `My English Book · Unit ${unit.number}: ${unit.title}` },
      });
      setSent(`Unit ${unit.number} given to ${r.sent} children.`);
    } catch (err) {
      setSent(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const n = students?.length || 0;
  const detail = cell && progress ? progress.children.find((c) => c.id === cell.child) : null;
  const detailUnit = cell ? CLASS1_ENGLISH_UNITS.find((u) => u.id === cell.unit) : null;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6" id="eng1-class-progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black text-stone-900">📈 My English Book — {grade} progress</h2>
          <p className="text-sm text-stone-500">Steps done per unit ({LESSON_STEPS.map((s) => s.emoji).join(' ')}), scores of the games, and who needs help.</p>
        </div>
        <button type="button" onClick={load} className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-black text-stone-600">
          ↻ Refresh
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {!students && !error && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {sent && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{sent}</p>}
      {progress && n === 0 && <p className="mt-3 text-sm text-stone-500">No children in {grade} yet.</p>}
      {progress && n > 0 && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CLASS1_ENGLISH_UNITS.map((u, i) => {
              const p = progress.units[i];
              return (
                <div key={u.id} className="rounded-2xl border border-stone-200 p-3" data-unit={u.id}>
                  <p className="text-sm font-black text-stone-900">
                    {u.emoji} {u.number}. {u.title}
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100" title={`${p.finished} finished, ${p.started} started of ${n}`}>
                    <div className="relative h-full">
                      <div className="absolute inset-y-0 left-0 bg-amber-300" style={{ width: `${(p.started / n) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(p.finished / n) * 100}%` }} />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-stone-500">
                    ✅ {p.finished} finished · ▶ {p.started - p.finished} going · {n - p.started} not started
                  </p>
                  <p className="mt-1 text-[11px] text-stone-600">
                    {LESSON_STEPS.filter((s) => p.stepAverages[s.id] !== undefined)
                      .map((s) => `${s.emoji} ${p.stepAverages[s.id]}%`)
                      .join(' · ') || 'No scores yet'}
                  </p>
                  {p.finished < n && (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void give(u.id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" /> Give to {n - p.finished} not finished
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-stone-500">
                  <th className="py-1 pr-2">Child</th>
                  {CLASS1_ENGLISH_UNITS.map((u) => (
                    <th key={u.id} className="px-1 text-center" title={u.title}>
                      {u.emoji} {u.number}
                    </th>
                  ))}
                  <th className="pl-2">Needs help with</th>
                </tr>
              </thead>
              <tbody>
                {progress.children.map((c) => (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="py-1.5 pr-2 font-bold text-stone-800">{c.name}</td>
                    {CLASS1_ENGLISH_UNITS.map((u) => {
                      const steps = c.units[u.id].steps;
                      const scores = Object.values(c.units[u.id].scores) as number[];
                      const low = scores.some((x) => x < 50);
                      return (
                        <td key={u.id} className="px-1 text-center">
                          <button
                            type="button"
                            onClick={() => setCell({ child: c.id, unit: u.id })}
                            className={`w-full rounded-lg px-1 py-1 font-black ${
                              steps >= LESSON_STEPS.length ? 'bg-emerald-500 text-white' : steps > 0 ? (low ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900') : 'bg-stone-50 text-stone-300'
                            } ${c.current === u.id ? 'ring-2 ring-sky-400' : ''}`}
                            title={`${steps} of ${LESSON_STEPS.length} steps`}
                          >
                            {steps ? `${steps}/${LESSON_STEPS.length}` : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="pl-2 text-stone-600">{c.weak.slice(0, 2).join('; ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-stone-400">Green = unit finished · amber = going · red = a game under 50% · blue ring = the unit to work on next.</p>
          </div>

          {detail && detailUnit && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-black text-stone-900">
                  {first(detail.name)} · {detailUnit.emoji} Unit {detailUnit.number}: {detailUnit.title}
                </p>
                <button type="button" onClick={() => setCell(null)} className="text-xs font-black text-stone-500">
                  ✕
                </button>
              </div>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {LESSON_STEPS.map((s) => {
                  const done = !!students?.find((x) => x.id === detail.id)?.labProgress?.[`eng1-${detailUnit.id}-${s.id}`];
                  const score = detail.units[detailUnit.id].scores[s.id];
                  return (
                    <li key={s.id} className={done ? 'text-stone-800' : 'text-stone-400'}>
                      {done ? '✅' : '⬜'} {s.emoji} {s.label}
                      {score !== undefined && <b className={score < 50 ? 'text-rose-700' : 'text-emerald-700'}> · {score}%</b>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
};
