import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Printer, Sparkles } from 'lucide-react';
import { backendApi } from '../../services/backendApi';
import { ALL_GRADES } from '../../data/grades';
import { localDay } from '../../services/progressSync';
import { printDocument, printHtml } from '../../services/printWorkbook';
import { hubSubjectForReading } from '../../services/publishedReadingToStory';
import { labChaptersFor, subjectsForGrade } from '../../data/learnPlay';
import { syllabusFor } from '../../data/telanganaSyllabus';
import { academicYear } from '../../data/registers';
import {
  MapRow,
  MapReading,
  Pace,
  PlanEntry,
  PlanUpdate,
  SubjectMap,
  academicMonths,
  buildCurriculumMap,
  monthName,
  outcomeRows,
  planByMonth,
  spreadOverYear,
} from '../../data/curriculumMap';

// The class's curriculum for the year (src/data/curriculumMap.ts): every
// chapter per subject — SCERT textbook chapters, published books, Learn &
// Play labs — with the teacher's month plan, "taught", what the class did,
// and how children rate themselves on each chapter's learning outcomes.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const PACE: Record<Pace, { label: string; cls: string }> = {
  taught: { label: '✓ Taught', cls: 'bg-emerald-100 text-emerald-800' },
  now: { label: 'This month', cls: 'bg-amber-100 text-amber-800' },
  late: { label: 'Behind plan', cls: 'bg-rose-100 text-rose-700' },
  later: { label: 'Later', cls: 'bg-stone-100 text-stone-600' },
  unplanned: { label: 'No month yet', cls: 'bg-stone-100 text-stone-500' },
};

type Loaded = Awaited<ReturnType<typeof backendApi.curriculumMap.get>>;
type View = 'map' | 'outcomes';

export const CurriculumPanel: React.FC<{ grade: string; onSelectGrade: (grade: string) => void }> = ({ grade, onSelectGrade }) => {
  const today = localDay();
  const year = academicYear(today);
  const months = academicMonths(year);
  const [view, setView] = useState<View>('map');
  const [data, setData] = useState<Loaded | null>(null);
  const [plan, setPlan] = useState<Record<string, PlanEntry>>({});
  const [subject, setSubject] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    backendApi.curriculumMap
      .get(grade, year)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setPlan(d.plan || {});
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not load the curriculum.'));
    return () => {
      cancelled = true;
    };
  }, [grade, year]);

  // Readings land on their Subject Hub tile, the same way students see them.
  const readings: MapReading[] = useMemo(
    () => (data?.readings || []).map((r) => ({ ...r, subject: hubSubjectForReading(r.subject, r.language) || r.subject || 'English' })),
    [data]
  );

  const map: SubjectMap[] = useMemo(() => {
    if (!data) return [];
    const base = subjectsForGrade(grade) as string[];
    const subjects = [...base, ...readings.map((r) => r.subject).filter((s) => !base.includes(s))].filter((s, i, a) => a.indexOf(s) === i);
    return buildCurriculumMap({
      subjects,
      syllabus: subjects.flatMap((s) => syllabusFor(grade, s)),
      readings,
      labs: subjects.flatMap((s) => labChaptersFor(s, grade).map((l) => ({ id: l.id, title: l.title, subject: l.subject, emoji: l.emoji }))),
      stats: data.stats,
      labStats: data.labStats,
      plan,
      today,
    });
  }, [data, readings, plan, grade, today]);

  useEffect(() => {
    if (map.length && !map.some((s) => s.subject === subject)) setSubject(map[0].subject);
  }, [map, subject]);

  const save = async (entries: Record<string, PlanUpdate>) => {
    const before = plan;
    setPlan((p) => {
      const next = { ...p };
      for (const [key, change] of Object.entries(entries)) {
        const entry: PlanEntry = { ...(next[key] || {}) };
        for (const [field, value] of Object.entries(change) as [keyof PlanEntry, string | null][]) {
          if (value === null) delete entry[field];
          else entry[field] = value;
        }
        next[key] = entry;
      }
      return next;
    });
    setSaving(true);
    setError(null);
    try {
      await backendApi.curriculumMap.savePlan(grade, year, entries);
    } catch (e: any) {
      setPlan(before);
      setError(e?.message || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };

  const current = map.find((s) => s.subject === subject);

  const planRest = () => {
    if (!current) return;
    const keys = current.rows.filter((r) => r.pace === 'unplanned').map((r) => r.key);
    if (!keys.length) return;
    const spread = spreadOverYear(keys, today);
    void save(Object.fromEntries(Object.entries(spread).map(([k, month]) => [k, { month }])));
  };

  const printPlan = () => {
    const byMonth = planByMonth(map, year);
    const cell = (rows: MapRow[]) =>
      rows.length
        ? `<ul>${rows.map((r) => `<li>${r.pace === 'taught' ? '✓ ' : ''}<b>${esc(r.subject)}</b> · ${esc(r.title)}</li>`).join('')}</ul>`
        : '<span class="meta">—</span>';
    printHtml(
      printDocument(
        `Year plan ${grade} ${year}`,
        `<style>table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #a8a29e;padding:4px 6px;vertical-align:top;text-align:left}ul{margin:0;padding-left:16px}</style><h1>🗺️ Year plan — ${esc(grade)} — ${esc(year)}</h1><p class="meta">Pathana Shakthi · ✓ = taught · ${map
          .map((s) => `${esc(s.subject)} ${s.taught}/${s.total}`)
          .join(' · ')}</p><table><tr><th style="width:90px">Month</th><th>Chapters</th></tr>${byMonth
          .map((m) => `<tr><td>${m.month ? esc(monthName(m.month)) : 'Not planned yet'}</td><td>${cell(m.rows)}</td></tr>`)
          .join('')}</table><p class="name" style="margin-top:24px">Teacher's signature: ____________________ &nbsp; Headmaster: ____________________</p>`
      )
    );
  };

  return (
    <section id="curriculum-panel" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-4">
        <h2 className="text-xl font-black text-stone-900">🗺️ Curriculum map</h2>
        <p className="text-xs text-stone-600">
          Every chapter of the year per subject — {gradeNum(grade) >= 6 ? 'the SCERT Telangana textbook chapters, ' : ''}your published books and the Learn & Play
          chapters — with your month plan, what the class did and how children rate their learning outcomes.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onSelectGrade(g)}
              className={`rounded-full border px-3 py-1 text-xs font-black ${g === grade ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {(
            [
              ['map', '🗺️ Year map'],
              ['outcomes', '🎯 Learning outcomes'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              id={`curriculum-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`rounded-xl px-3 py-2 text-sm font-black ${view === id ? 'bg-sky-600 text-white shadow' : 'border border-stone-200 bg-white text-stone-700'}`}
            >
              {label}
            </button>
          ))}
          {map.length > 0 && (
            <button type="button" id="btn-print-year-plan" onClick={printPlan} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700">
              <Printer className="h-3.5 w-3.5" /> Print year plan
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" id="curriculum-subjects">
          {map.map((s) => (
            <button
              key={s.subject}
              type="button"
              onClick={() => setSubject(s.subject)}
              className={`curriculum-subject rounded-2xl border-2 p-3 text-left ${s.subject === subject ? 'border-sky-500 bg-sky-50' : 'border-stone-200 bg-white'}`}
            >
              <p className="text-sm font-black text-stone-900">{s.subject}</p>
              <p className="text-[11px] text-stone-500">
                {s.taught}/{s.total} taught
              </p>
              <div className="mt-1 h-1.5 rounded-full bg-stone-100">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${s.total ? (s.taught / s.total) * 100 : 0}%` }} />
              </div>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-bold">
                {s.late > 0 && <span className="text-rose-600">{s.late} behind</span>}
                {s.now > 0 && <span className="text-amber-700">{s.now} this month</span>}
                {s.unplanned > 0 && <span className="text-stone-500">{s.unplanned} no month</span>}
              </p>
            </button>
          ))}
        </div>
      )}

      {data && view === 'map' && current && (
        <YearMap subject={current} months={months} classSize={data.classSize} saving={saving} today={today} onSave={save} onPlanRest={planRest} />
      )}
      {data && view === 'outcomes' && <OutcomesView grade={grade} map={map} readings={readings} subject={subject} />}
    </section>
  );
};

const gradeNum = (grade: string) => Number(String(grade).replace(/\D+/g, '')) || 1;

/* ------------------------------ year map ------------------------------ */

const YearMap: React.FC<{
  subject: SubjectMap;
  months: string[];
  classSize: number;
  saving: boolean;
  today: string;
  onSave: (entries: Record<string, PlanUpdate>) => void;
  onPlanRest: () => void;
}> = ({ subject, months, classSize, saving, today, onSave, onPlanRest }) => {
  const groups = subject.rows.reduce<{ group: string; rows: MapRow[] }[]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last.group === r.group) last.rows.push(r);
    else acc.push({ group: r.group, rows: [r] });
    return acc;
  }, []);
  return (
    <div className="space-y-3" id="curriculum-map">
      <div className="flex flex-wrap items-center gap-2">
        {subject.unplanned > 0 && (
          <button type="button" id="btn-plan-rest" onClick={onPlanRest} className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white">
            <Sparkles className="h-3.5 w-3.5" /> Spread the {subject.unplanned} unplanned chapters over the months left
          </button>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>
      {groups.map((g) => (
        <div key={g.group} className="rounded-2xl border border-stone-200 bg-white">
          <p className="border-b border-stone-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-stone-500">{g.group}</p>
          <ul className="divide-y divide-stone-100">
            {g.rows.map((r) => (
              <li key={r.key} className="curriculum-row flex flex-wrap items-center gap-2 px-3 py-2" data-key={r.key}>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-bold text-stone-900">
                    {r.no && <span className="mr-1 text-stone-400">{r.no}.</span>}
                    {r.emoji && <span className="mr-1">{r.emoji}</span>}
                    {r.title}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    {r.readingId ? '📘 published' : r.source === 'syllabus' ? 'not published yet' : ''}
                    {r.labId && ' · 🎮 lab'}
                    {r.stats && (
                      <>
                        {' · '}📖 read {r.stats.readBy}/{classSize}
                        {r.stats.accuracy !== null && ` (${r.stats.accuracy}%)`}
                        {r.stats.workbooks > 0 && ` · 📝 ${r.stats.workbooksDone}/${r.stats.workbooks} workbooks`}
                        {r.stats.practiceShare !== null && ` · 🎯 ${Math.round(r.stats.practiceShare * 100)}%`}
                      </>
                    )}
                    {r.lab && r.lab.played > 0 && ` · 🎮 played ${r.lab.played}, ⭐⭐ ${r.lab.mastered}`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${PACE[r.pace].cls}`}>
                  {r.pace === 'taught' && r.plan.taughtOn ? `✓ ${r.plan.taughtOn.slice(8)} ${monthName(r.plan.taughtOn).split(' ')[0]}` : PACE[r.pace].label}
                </span>
                <select
                  aria-label={`Month for ${r.title}`}
                  value={r.plan.month || ''}
                  onChange={(e) => onSave({ [r.key]: { month: e.target.value || null } })}
                  className="rounded-lg border border-stone-200 px-1 py-1 text-xs"
                >
                  <option value="">Month…</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthName(m)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-pressed={Boolean(r.plan.taughtOn)}
                  onClick={() => onSave({ [r.key]: { taughtOn: r.plan.taughtOn ? null : today } })}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black ${r.plan.taughtOn ? 'bg-emerald-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
                >
                  <Check className="h-3.5 w-3.5" /> Taught
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------ outcomes ------------------------------ */

const OutcomesView: React.FC<{ grade: string; map: SubjectMap[]; readings: MapReading[]; subject: string }> = ({ grade, map, readings, subject }) => {
  const rows = useMemo(() => outcomeRows(map, readings).filter((r) => r.subject === subject), [map, readings, subject]);
  const chapters = useMemo(() => {
    const out = new Map<string, { title: string; rows: typeof rows; needHelp: string[] }>();
    const statsOf = new Map(map.flatMap((s) => s.rows).filter((r) => r.readingId).map((r) => [r.readingId!, r.stats]));
    for (const r of rows) {
      if (!out.has(r.readingId)) out.set(r.readingId, { title: r.chapter, rows: [], needHelp: statsOf.get(r.readingId)?.needHelp || [] });
      out.get(r.readingId)!.rows.push(r);
    }
    return [...out.entries()].sort((a, b) => Math.min(...a[1].rows.map((r) => r.canShare)) - Math.min(...b[1].rows.map((r) => r.canShare)));
  }, [rows, map]);
  const [sent, setSent] = useState<Record<string, string>>({});

  const giveAgain = async (readingId: string, title: string, ids: string[]) => {
    try {
      const r = await backendApi.support.assign(grade, {
        studentIds: ids,
        text: `Let's do the workbook of "${title}" again. Look at the "I can…" step carefully.`,
        assign: { kind: 'workbook', id: readingId, title },
      });
      setSent((s) => ({ ...s, [readingId]: `Sent to ${r.sent} ✓` }));
    } catch (e: any) {
      setSent((s) => ({ ...s, [readingId]: e?.message || 'Could not send.' }));
    }
  };

  if (!rows.length)
    return (
      <p className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600" id="outcomes-empty">
        No learning outcomes rated in {subject} yet. They appear here when children finish the 🎯 "I can…" step of a chapter's 📝 workbook.
      </p>
    );

  return (
    <div className="space-y-3" id="outcomes-view">
      <p className="text-[11px] text-stone-500">
        How children rate themselves on each chapter's learning outcomes: 🟢 I can · 🟡 a little · 🔴 not yet. Under half "I can" is marked to reteach.
      </p>
      {chapters.map(([readingId, ch]) => (
        <div key={readingId} className="outcome-chapter rounded-2xl border border-stone-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-black text-stone-900">{ch.title}</p>
            {ch.needHelp.length > 0 && !sent[readingId] && (
              <button
                type="button"
                onClick={() => giveAgain(readingId, ch.title, ch.needHelp)}
                className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-black text-sky-800"
              >
                📌 Give the workbook again to {ch.needHelp.length} {ch.needHelp.length === 1 ? 'child' : 'children'}
              </button>
            )}
            {sent[readingId] && <span className="text-xs font-black text-emerald-700">{sent[readingId]}</span>}
          </div>
          <ul className="mt-2 space-y-2">
            {ch.rows.map((o) => (
              <li key={o.outcome} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className={`font-bold ${o.weak ? 'text-rose-700' : 'text-stone-700'}`}>
                    {o.weak && '⚠️ '}
                    {o.outcome}
                  </span>
                  <span className="whitespace-nowrap text-stone-500">
                    {Math.round(o.canShare * 100)}% · {o.rated}
                  </span>
                </div>
                <div className="mt-0.5 flex h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="bg-emerald-500" style={{ width: `${(o.count.can / o.rated) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(o.count.partly / o.rated) * 100}%` }} />
                  <div className="bg-rose-400" style={{ width: `${(o.count.notYet / o.rated) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
