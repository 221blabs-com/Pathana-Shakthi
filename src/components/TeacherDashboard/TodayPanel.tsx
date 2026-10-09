import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, Printer, RefreshCw } from 'lucide-react';
import { backendApi, TodayClass, WorkAssignment } from '../../services/backendApi';
import { localDay } from '../../services/progressSync';
import { LEVEL_INFO } from '../../data/readingLevels';
import { AssignWorkModal } from './SupportBoard';
import { printHtml } from '../../services/printWorkbook';
import { MitraPromptCard } from './MitraAgent';

// "Today": Plan the Day for every class the teacher has (multi-grade rooms see
// all their classes on one screen) — today's goals and how far each child
// got, what needs the teacher, what to teach each reading-level group from
// the class's own chapters, and the competencies to focus on.

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function printDayPlan(day: string, classes: TodayClass[]) {
  const body = classes
    .map((c) => {
      const groups = c.groups
        .map((g) => `<li><b>${LEVEL_INFO[g.level].icon} ${LEVEL_INFO[g.level].name} (${g.studentIds.length})</b> — ${esc(g.plan)}</li>`)
        .join('');
      const focus = c.focus.map((f) => `<li><b>${f.icon} ${esc(f.short)}</b> (${f.notAchieved} not yet) — ${esc(f.idea)}</li>`).join('');
      const next = c.nextChapters.map((n) => `<li>${esc(n.bookTitle)}: <b>${esc(n.chapterTitle)}</b></li>`).join('');
      const rows = c.children
        .map(
          (k) =>
            `<tr><td>${esc(k.rollNumber)}</td><td>${esc(k.name)}</td><td>${LEVEL_INFO[k.readingLevel || 'developing'].icon}</td>${c.goals
              .map(() => '<td></td>')
              .join('')}<td>${k.openQuestions ? '🙋' : ''}</td></tr>`
        )
        .join('');
      return `<section><h2>${esc(c.grade)} · ${c.counts.children} children</h2>
<h3>Teach today</h3><ul>${groups || '<li>No children yet.</li>'}</ul>
${next ? `<h3>Next chapters</h3><ul>${next}</ul>` : ''}
${focus ? `<h3>Focus competencies</h3><ul>${focus}</ul>` : ''}
<h3>Today's checklist</h3><table><thead><tr><th>Roll</th><th>Name</th><th>Level</th>${c.goals
        .map((g) => `<th>${g.icon} ${esc(g.name)}</th>`)
        .join('')}<th>Help</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    })
    .join('');
  printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Day plan ${esc(day)}</title>
<style>body{font-family:'Noto Sans',sans-serif;margin:18px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:15px;margin:16px 0 4px;border-bottom:2px solid #e7e5e4}h3{font-size:12px;margin:8px 0 2px}ul{margin:0;padding-left:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6d3d1;padding:3px 5px;height:16px}th{font-size:10px;background:#f5f5f4}section{break-inside:avoid-page}</style></head>
<body><h1>📅 Day plan · ${esc(new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }))}</h1><p>Pathana Shakthi</p>${body}</body></html>`);
}

const ClassToday: React.FC<{ data: TodayClass; onOpenClass?: (grade: string) => void }> = ({ data, onOpenClass }) => {
  const [assign, setAssign] = useState<{ title: string; ids: string[]; work: WorkAssignment | null } | null>(null);
  const [showChildren, setShowChildren] = useState(false);
  const byId = new Map(data.children.map((c) => [c.id, c]));
  return (
    <div className="today-class rounded-2xl border border-stone-200 bg-white p-4" data-grade={data.grade}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-stone-900">{data.grade}</h3>
          <p className="text-[11px] text-stone-500">
            {data.counts.activeToday} of {data.counts.children} children practised today
          </p>
        </div>
        {onOpenClass && (
          <button type="button" onClick={() => onOpenClass(data.grade)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-black text-stone-700 hover:border-sky-300">
            Open class dashboard →
          </button>
        )}
      </div>

      {/* Needs you */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => onOpenClass?.(data.grade)}
          className={`rounded-xl p-2 ${data.counts.openQuestions ? 'bg-rose-50 text-rose-900 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-500'}`}
        >
          <span className="block text-lg">🙋</span>
          <span className="block text-sm font-black">{data.counts.openQuestions}</span>
          <span className="block text-[10px] font-bold">questions waiting</span>
        </button>
        <div className={`rounded-xl p-2 ${data.counts.pendingWork ? 'bg-amber-50 text-amber-900' : 'bg-stone-50 text-stone-500'}`}>
          <span className="block text-lg">📌</span>
          <span className="block text-sm font-black">{data.counts.pendingWork}</span>
          <span className="block text-[10px] font-bold">work not done yet</span>
        </div>
        <div className={`rounded-xl p-2 ${data.counts.awayThreeDays ? 'bg-sky-50 text-sky-900' : 'bg-stone-50 text-stone-500'}`}>
          <span className="block text-lg">🏠</span>
          <span className="block text-sm font-black">{data.counts.awayThreeDays}</span>
          <span className="block text-[10px] font-bold">not practised 3+ days</span>
        </div>
      </div>

      {/* Today's goals */}
      <p className="mb-1 mt-4 text-xs font-black uppercase tracking-wide text-stone-600">🎯 Today's goals for every child</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.goals.map((g) => (
          <div key={g.id} className="today-goal rounded-xl bg-stone-50 p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800">
                {g.icon} {g.name}
              </span>
              <span className="font-black text-stone-600">
                {g.done}/{g.total}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-stone-200">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setShowChildren((v) => !v)} className="mt-2 text-[11px] font-black text-sky-700">
        {showChildren ? 'Hide' : 'Show'} each child's checklist
      </button>
      {showChildren && (
        <div className="mt-2 overflow-x-auto">
          <table className="today-checklist w-full min-w-[420px] text-xs">
            <thead className="text-[10px] text-stone-500">
              <tr>
                <th className="px-2 py-1 text-left">Child</th>
                {data.goals.map((g) => (
                  <th key={g.id} className="px-1 py-1" title={g.name}>
                    {g.icon}
                  </th>
                ))}
                <th className="px-1 py-1">🙋</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.children.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-2 py-1 font-bold text-stone-800">
                    {LEVEL_INFO[c.readingLevel || 'developing'].icon} {c.name}
                    {c.daysAway === null ? <span className="ml-1 text-[10px] text-stone-400">never</span> : c.daysAway >= 3 ? <span className="ml-1 text-[10px] text-sky-600">{c.daysAway}d away</span> : null}
                  </td>
                  {data.goals.map((g) => (
                    <td key={g.id} className="px-1 py-1 text-center">
                      {c.done[g.id] ? '✅' : '·'}
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">{c.openQuestions ? c.openQuestions : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Teach today, per reading-level group */}
      <p className="mb-1 mt-4 text-xs font-black uppercase tracking-wide text-stone-600">👩‍🏫 Teach today</p>
      {data.nextChapters.length > 0 && (
        <p className="mb-2 text-[11px] text-stone-600">
          Next chapters: {data.nextChapters.map((n) => `${n.chapterTitle} (${n.bookTitle}, read by ${n.readBy})`).join(' · ')}
        </p>
      )}
      <div className="space-y-2">
        {data.groups.map((g) => (
          <div key={g.level} className="today-group rounded-xl border border-stone-100 bg-stone-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black text-stone-900">
                {LEVEL_INFO[g.level].icon} {LEVEL_INFO[g.level].name} · {g.studentIds.length}
                <span className="ml-1 font-semibold text-stone-500">
                  ({g.studentIds.map((id) => byId.get(id)?.name.split(' ')[0]).filter(Boolean).slice(0, 6).join(', ')}
                  {g.studentIds.length > 6 ? '…' : ''})
                </span>
              </p>
              <button
                type="button"
                onClick={() => setAssign({ title: `${data.grade} · ${LEVEL_INFO[g.level].name}`, ids: g.studentIds, work: g.work })}
                className="today-give rounded-lg border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-black text-sky-800 hover:bg-sky-50"
              >
                📌 Give {g.work ? g.work.title : 'work'}
              </button>
            </div>
            <p className="mt-1 text-xs text-stone-700">{g.plan}</p>
          </div>
        ))}
        {data.groups.length === 0 && <p className="text-xs text-stone-500">No children in this class yet.</p>}
      </div>

      {data.focus.length > 0 && (
        <>
          <p className="mb-1 mt-4 text-xs font-black uppercase tracking-wide text-stone-600">🧭 Focus competencies</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.focus.map((f) => (
              <div key={f.id} className="today-focus rounded-xl border border-amber-100 bg-amber-50/60 p-2.5">
                <p className="text-xs font-black text-stone-900">
                  {f.icon} {f.short} <span className="font-semibold text-stone-500">· {f.notAchieved} not there yet</span>
                </p>
                {f.idea && <p className="mt-0.5 text-[11px] text-stone-700">💡 {f.idea}</p>}
                {f.practice && (
                  <button
                    type="button"
                    onClick={() =>
                      setAssign({
                        title: `${data.grade} · ${f.short}`,
                        ids: data.children.map((c) => c.id),
                        work: f.practice,
                      })
                    }
                    className="mt-1 rounded-lg border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-black text-amber-900"
                  >
                    📌 Give {f.practice.title}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {assign && (
          <AssignWorkModal
            key="today-assign"
            grade={data.grade}
            title={assign.title}
            students={assign.ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c))}
            initialWork={assign.work}
            onClose={() => setAssign(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export const TodayPanel: React.FC<{ grades: string[]; defaultGrade: string; onOpenClass?: (grade: string) => void }> = ({ grades, defaultGrade, onOpenClass }) => {
  const options = grades.length ? grades : [defaultGrade];
  const [picked, setPicked] = useState<string[]>(() => (options.length <= 3 ? options : [defaultGrade]));
  const [data, setData] = useState<{ day: string; classes: TodayClass[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The teacher's classes arrive after the first render.
    setPicked((p) => (grades.length && p.every((g) => !grades.includes(g)) ? (grades.length <= 3 ? grades : [grades.includes(defaultGrade) ? defaultGrade : grades[0]]) : p));
  }, [grades, defaultGrade]);

  const load = useCallback(async () => {
    if (!picked.length) return;
    setLoading(true);
    setError('');
    try {
      setData(await backendApi.teacherToday(picked, localDay()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not plan the day.');
    } finally {
      setLoading(false);
    }
  }, [picked]);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (g: string) => setPicked((p) => (p.includes(g) ? (p.length > 1 ? p.filter((x) => x !== g) : p) : [...p, g].slice(-6)));
  const day = data?.day || localDay();
  return (
    <section id="today-panel" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-amber-50 to-sky-50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-stone-900">
              📅 Today · {new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <p className="text-xs text-stone-600">Your day plan for each class: goals, who needs you, and what to teach each group.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-500">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            {data && (
              <button
                type="button"
                id="btn-print-day-plan"
                onClick={() => printDayPlan(day, data.classes)}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700"
              >
                <Printer className="h-3.5 w-3.5" /> Print day plan
              </button>
            )}
          </div>
        </div>
        {options.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Classes">
            {options.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggle(g)}
                aria-pressed={picked.includes(g)}
                className={`today-class-chip rounded-full border px-3 py-1 text-xs font-black ${picked.includes(g) ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
              >
                {g}
              </button>
            ))}
            <span className="self-center text-[10px] text-stone-500">Pick the classes in your room (multi-grade)</span>
          </div>
        )}
      </div>
      <MitraPromptCard
        suggestions={[
          `What should I do in ${picked.join(' and ')} today?`,
          'Who needs help? Prepare answers for their questions.',
          'Give each reading group practice for its weakest area.',
        ]}
      />
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Planning your day…
        </p>
      )}
      {data && (
        <div className={`grid gap-4 ${data.classes.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {data.classes.map((c) => (
            <ClassToday key={c.grade} data={c} onOpenClass={onOpenClass} />
          ))}
        </div>
      )}
    </section>
  );
};
