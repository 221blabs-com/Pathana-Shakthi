import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2, Printer, Sparkles } from 'lucide-react';
import { backendApi, RegisterStudent } from '../../services/backendApi';
import { PublishedReadingSummary } from '../../types';
import { ALL_GRADES } from '../../data/grades';
import { localDay } from '../../services/progressSync';
import { downloadCsv } from '../../services/csv';
import { printDocument, printHtml } from '../../services/printWorkbook';
import {
  AssessmentEntry,
  AssessmentRound,
  MATHS_LEVEL_INFO,
  MATHS_LEVELS,
  READING_LEVEL_INFO,
  READING_LEVELS,
  ROUNDS,
  absentStreak,
  academicYear,
  levelChange,
  levelCounts,
  monthRegister,
  periodPlan,
} from '../../data/registers';

// The teacher's records in one place (src/data/registers.ts): the daily
// attendance register, the FLN assessment rounds (pre-filled from the app,
// confirmed by the teacher) and period plans that follow the SCERT steps.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const TABLE_CSS = `<style>table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #a8a29e;padding:2px 4px;text-align:center}td.l{text-align:left}th{background:#f5f5f4}</style>`;

type View = 'attendance' | 'assessment' | 'plan';

export const RegistersPanel: React.FC<{ grade: string; onSelectGrade: (grade: string) => void }> = ({ grade, onSelectGrade }) => {
  const [view, setView] = useState<View>('attendance');
  return (
    <section id="registers-panel" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-amber-50 to-emerald-50 p-4">
        <h2 className="text-xl font-black text-stone-900">🗂️ Registers and plans</h2>
        <p className="text-xs text-stone-600">Attendance, FLN assessment rounds and period plans — filled in from what your class does in the app, for you to check.</p>
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
              ['attendance', '🗓️ Attendance'],
              ['assessment', '📊 FLN assessment'],
              ['plan', '🗒️ Period plan'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              id={`registers-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`rounded-xl px-3 py-2 text-sm font-black ${view === id ? 'bg-emerald-600 text-white shadow' : 'border border-stone-200 bg-white text-stone-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'attendance' && <AttendanceView grade={grade} />}
      {view === 'assessment' && <AssessmentView grade={grade} />}
      {view === 'plan' && <PeriodPlanView grade={grade} />}
    </section>
  );
};

/* ------------------------------ attendance ------------------------------ */

const AttendanceView: React.FC<{ grade: string }> = ({ grade }) => {
  const [day, setDay] = useState(localDay());
  const [students, setStudents] = useState<RegisterStudent[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [usedApp, setUsedApp] = useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(localDay().slice(0, 7));
  const [register, setRegister] = useState<ReturnType<typeof monthRegister> | null>(null);
  const [followUp, setFollowUp] = useState<RegisterStudent[]>([]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    backendApi.registers
      .attendance(grade, day)
      .then((r) => {
        if (cancelled) return;
        setStudents(r.students);
        setUsedApp(new Set(r.suggested));
        // Not marked yet: everyone starts present; the teacher taps who is away.
        setPresent(new Set(r.record ? r.record.present : r.students.map((s) => s.id)));
        setSavedAt(r.record?.markedAt || null);
        setDirty(false);
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not load attendance.'));
    return () => {
      cancelled = true;
    };
  }, [grade, day]);

  const loadMonth = async () => {
    setError(null);
    try {
      const r = await backendApi.registers.attendanceMonth(grade, month);
      setRegister(monthRegister(month, r.students, r.records));
      setFollowUp(absentStreak(r.records, r.students) as RegisterStudent[]);
    } catch (e: any) {
      setError(e?.message || 'Could not load the register.');
    }
  };
  useEffect(() => {
    setRegister(null);
  }, [grade, month]);

  const toggle = (id: string) => {
    setPresent((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await backendApi.registers.saveAttendance(grade, day, [...present]);
      setSavedAt(new Date().toISOString());
      setDirty(false);
      if (register && day.startsWith(month)) void loadMonth();
    } catch (e: any) {
      setError(e?.message || 'Could not save attendance.');
    } finally {
      setBusy(false);
    }
  };

  const printRegister = () => {
    if (!register) return;
    const head = `<tr><th>Roll</th><th>Name</th>${register.days.map((d) => `<th>${esc(d.slice(8))}</th>`).join('')}<th>Present</th><th>%</th></tr>`;
    const rows = register.rows
      .map(
        (r) =>
          `<tr><td>${esc(r.child.rollNumber)}</td><td class="l">${esc(r.child.name)}</td>${r.marks.map((m) => `<td>${m}</td>`).join('')}<td>${r.present}/${r.workingDays}</td><td>${r.percent ?? ''}</td></tr>`
      )
      .join('');
    const totals = `<tr><th colspan="2">Present</th>${register.totals.map((t) => `<th>${t.present}</th>`).join('')}<th colspan="2"></th></tr>`;
    printHtml(
      printDocument(
        `Attendance ${grade} ${month}`,
        `${TABLE_CSS}<h1>🗓️ Attendance register — ${esc(grade)} — ${esc(month)}</h1><p class="meta">Pathana Shakthi · ${register.days.length} working days</p><table>${head}${rows}${totals}</table><p class="name" style="margin-top:24px">Teacher's signature: ____________________ &nbsp; Headmaster: ____________________</p>`
      )
    );
  };

  const csv = () => {
    if (!register) return;
    downloadCsv(`attendance-${grade.replace(/\s+/g, '')}-${month}.csv`, [
      ['Roll', 'Name', ...register.days, 'Present', 'Working days', '%'],
      ...register.rows.map((r) => [r.child.rollNumber, r.child.name, ...r.marks, r.present, r.workingDays, r.percent ?? '']),
    ]);
  };

  const absentCount = students.length - students.filter((s) => present.has(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4" id="attendance-day">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-black text-stone-900">Today's attendance</h3>
          <input
            type="date"
            value={day}
            max={localDay()}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
            aria-label="Day"
          />
          <span className="text-xs font-bold text-stone-500">
            {students.length - absentCount} present · {absentCount} absent
            {savedAt && !dirty ? ' · saved ✓' : dirty ? ' · not saved yet' : ' · not marked yet'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">Tap a child who is away. 📱 = used the app on this day.</p>
        {students.length === 0 ? (
          <p className="mt-3 text-xs text-stone-500">No children in {grade} yet — add them under Students & roll numbers.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {students.map((s) => {
              const here = present.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={here}
                  className={`attendance-child flex items-center gap-2 rounded-xl border-2 px-2 py-2 text-left text-sm font-bold ${
                    here ? 'border-emerald-300 bg-emerald-50 text-stone-900' : 'border-rose-300 bg-rose-50 text-rose-700'
                  }`}
                >
                  <span className="w-6 text-center text-xs text-stone-500">{s.rollNumber}</span>
                  <span aria-hidden className="hidden sm:inline">
                    {s.avatar}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {usedApp.has(s.id) && <span title="Used the app on this day">📱</span>}
                  <span className="text-xs font-black">{here ? 'P' : 'A'}</span>
                </button>
              );
            })}
          </div>
        )}
        {students.length > 0 && (
          <button
            type="button"
            id="btn-attendance-save"
            disabled={busy}
            onClick={save}
            className="btn-3d mt-3 inline-flex items-center gap-2 bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save attendance
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4" id="attendance-month">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-stone-900">Monthly register</h3>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1 text-sm" aria-label="Month" />
          <button type="button" id="btn-attendance-month" onClick={loadMonth} className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-black text-stone-700 hover:bg-stone-50">
            Show
          </button>
          {register && register.days.length > 0 && (
            <>
              <button type="button" onClick={printRegister} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-black text-stone-700">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button type="button" onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-black text-stone-700">
                <Download className="h-3.5 w-3.5" /> Excel
              </button>
            </>
          )}
        </div>
        {register && register.days.length === 0 && <p className="mt-2 text-xs text-stone-500">No attendance was marked in {month}.</p>}
        {register && register.days.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="bg-stone-50">
                  <th className="px-1 py-1 text-left">Roll</th>
                  <th className="px-1 py-1 text-left">Name</th>
                  {register.days.map((d) => (
                    <th key={d} className="px-1 py-1">
                      {d.slice(8)}
                    </th>
                  ))}
                  <th className="px-1 py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {register.rows.map((r) => (
                  <tr key={r.child.id} className="border-t border-stone-100">
                    <td className="px-1 py-1">{r.child.rollNumber}</td>
                    <td className="whitespace-nowrap px-1 py-1 font-bold">{r.child.name}</td>
                    {r.marks.map((m, i) => (
                      <td key={i} className={`px-1 py-1 text-center font-black ${m === 'A' ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {m}
                      </td>
                    ))}
                    <td className={`px-1 py-1 text-center font-black ${(r.percent ?? 100) < 75 ? 'text-rose-600' : 'text-stone-700'}`}>{r.percent ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {followUp.length > 0 && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
            Away the last 3 days attendance was taken: {followUp.map((c) => c.name).join(', ')} — a home visit or a call may help.
          </p>
        )}
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
    </div>
  );
};

/* ---------------------------- FLN assessment ---------------------------- */

type Loaded = Awaited<ReturnType<typeof backendApi.registers.assessments>>;

const AssessmentView: React.FC<{ grade: string }> = ({ grade }) => {
  const [year] = useState(academicYear(localDay()));
  const [round, setRound] = useState<AssessmentRound>('baseline');
  const [data, setData] = useState<Loaded | null>(null);
  const [entries, setEntries] = useState<Record<string, AssessmentEntry>>({});
  const [fromApp, setFromApp] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState('English');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    backendApi.registers
      .assessments(grade, year)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load assessments.'));
    return () => {
      cancelled = true;
    };
  }, [grade, year]);

  // A saved round shows what was saved; a new one starts from the app's suggestions.
  useEffect(() => {
    if (!data) return;
    const saved = data.rounds[round];
    if (saved) {
      setEntries(saved.entries);
      setFromApp(new Set());
      if (saved.language) setLanguage(saved.language);
    } else {
      setEntries(Object.fromEntries(data.students.map((s) => [s.id, { ...(data.suggested[s.id] || {}) }])));
      setFromApp(new Set(data.students.filter((s) => Object.keys(data.suggested[s.id] || {}).length).map((s) => s.id)));
    }
    setSavedNote('');
  }, [data, round]);

  const set = (id: string, patch: Partial<AssessmentEntry>) => {
    setEntries((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
    setFromApp((f) => {
      const next = new Set(f);
      next.delete(id);
      return next;
    });
    setSavedNote('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await backendApi.registers.saveAssessment(grade, round, year, language, entries);
      setSavedNote(`Saved ${r.saved} children ✓`);
      setFromApp(new Set());
      setData((d) => (d ? { ...d, rounds: { ...d.rounds, [round]: { entries, language, savedAt: new Date().toISOString() } } } : d));
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => levelCounts(entries), [entries]);
  const earlier = data ? ROUNDS.slice(0, ROUNDS.findIndex((r) => r.id === round)).filter((r) => data.rounds[r.id]) : [];
  const roundName = ROUNDS.find((r) => r.id === round)!.name;

  const rowsForExport = () =>
    (data?.students || []).map((s) => {
      const e = entries[s.id] || {};
      return [s.rollNumber, s.name, e.absent ? 'Absent' : '', e.reading || '', e.wcpm ?? '', e.comprehension ?? '', e.maths || '', e.note || ''];
    });
  const csv = () =>
    downloadCsv(`fln-${round}-${grade.replace(/\s+/g, '')}-${year}.csv`, [
      ['Roll', 'Name', 'Absent', `Reading level (${language})`, 'Words correct per minute', 'Comprehension (of 3)', 'Maths level', 'Note'],
      ...rowsForExport(),
    ]);
  const print = () =>
    printHtml(
      printDocument(
        `FLN ${roundName} ${grade}`,
        `${TABLE_CSS}<h1>📊 FLN ${esc(roundName)} — ${esc(grade)} — ${esc(year)}</h1><p class="meta">Pathana Shakthi · reading in ${esc(language)} · for the teacher's records</p><table><tr><th>Roll</th><th>Name</th><th>Absent</th><th>Reading level</th><th>WCPM</th><th>Comprehension /3</th><th>Maths level</th><th>Note</th></tr>${rowsForExport()
          .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 1 || i === 7 ? 'l' : ''}">${esc(c)}</td>`).join('')}</tr>`)
          .join('')}</table><p class="meta" style="margin-top:12px">Reading: ${READING_LEVELS.map((l) => `${l} ${counts.reading[l]}`).join(' · ')} &nbsp; Maths: ${MATHS_LEVELS.map((l) => `${l} ${counts.maths[l]}`).join(' · ')}</p><p class="name" style="margin-top:24px">Teacher's signature: ____________________</p>`
      )
    );

  if (error) return <p className="text-sm font-bold text-rose-700">{error}</p>;
  if (!data)
    return (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );

  return (
    <div className="space-y-4" id="assessment-view">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {ROUNDS.map((r) => (
            <button
              key={r.id}
              type="button"
              id={`round-${r.id}`}
              onClick={() => setRound(r.id)}
              className={`rounded-xl px-3 py-2 text-sm font-black ${round === r.id ? 'bg-sky-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
            >
              {r.name} {data.rounds[r.id] ? '✓' : ''}
            </button>
          ))}
          <span className="text-xs text-stone-500">{year} · {ROUNDS.find((r) => r.id === round)!.when}</span>
        </div>
        <p className="mt-2 text-[11px] text-stone-500">
          <Sparkles className="inline h-3 w-3" /> marks values the app suggests from what the child did in it (reading aloud, practice, quizzes, maths games). Listen to each child read and change
          anything that is not right, then save. This is for your records and the export; the official sheet may ask for more.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="font-bold text-stone-700">
            Reading language{' '}
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1">
              {['English', 'Telugu', 'Hindi', 'Urdu'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setEntries(Object.fromEntries(data.students.map((s) => [s.id, { ...(data.suggested[s.id] || {}) }])));
              setFromApp(new Set(data.students.map((s) => s.id)));
            }}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1 font-black text-stone-700"
          >
            ✨ Fill all from the app
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-2 py-2">Roll</th>
              <th className="px-2 py-2">Child</th>
              <th className="px-2 py-2">Reading level</th>
              <th className="px-2 py-2">WCPM</th>
              <th className="px-2 py-2">Compr. /3</th>
              <th className="px-2 py-2">Maths level</th>
              <th className="px-2 py-2">Away</th>
              {earlier.length > 0 && <th className="px-2 py-2">Since {earlier[0].name}</th>}
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => {
              const e = entries[s.id] || {};
              const change = earlier.length ? levelChange(data.rounds[earlier[0].id]?.entries[s.id], e) : null;
              return (
                <tr key={s.id} className={`assessment-row border-t border-stone-100 ${e.absent ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-1.5">{s.rollNumber}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-bold">
                    {s.name} {fromApp.has(s.id) && <Sparkles className="inline h-3 w-3 text-amber-500" aria-label="suggested by the app" />}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={e.reading || ''}
                      onChange={(ev) => set(s.id, { reading: (ev.target.value || undefined) as AssessmentEntry['reading'] })}
                      className="rounded-lg border border-stone-200 px-1 py-1"
                      title={e.reading ? READING_LEVEL_INFO[e.reading] : ''}
                    >
                      <option value="">—</option>
                      {READING_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {READING_LEVEL_INFO[l].split(' — ')[0]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={250}
                      value={e.wcpm ?? ''}
                      onChange={(ev) => set(s.id, { wcpm: ev.target.value === '' ? undefined : Number(ev.target.value) })}
                      className="w-16 rounded-lg border border-stone-200 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      max={3}
                      value={e.comprehension ?? ''}
                      onChange={(ev) => set(s.id, { comprehension: ev.target.value === '' ? undefined : Number(ev.target.value) })}
                      className="w-12 rounded-lg border border-stone-200 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={e.maths || ''}
                      onChange={(ev) => set(s.id, { maths: (ev.target.value || undefined) as AssessmentEntry['maths'] })}
                      className="rounded-lg border border-stone-200 px-1 py-1"
                    >
                      <option value="">—</option>
                      {MATHS_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {MATHS_LEVEL_INFO[l].split(' — ')[0]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={Boolean(e.absent)} onChange={(ev) => set(s.id, { absent: ev.target.checked || undefined })} aria-label={`${s.name} was away`} />
                  </td>
                  {earlier.length > 0 && (
                    <td className={`px-2 py-1.5 text-center font-black ${change === null ? 'text-stone-300' : change > 0 ? 'text-emerald-700' : change < 0 ? 'text-rose-600' : 'text-stone-500'}`}>
                      {change === null ? '—' : change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${-change}` : '='}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" id="btn-assessment-save" disabled={busy} onClick={save} className="btn-3d inline-flex items-center gap-2 bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save {roundName}
        </button>
        <button type="button" onClick={print} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700">
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button type="button" onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700">
          <Download className="h-3.5 w-3.5" /> Excel
        </button>
        {savedNote && <span className="text-xs font-black text-emerald-700">{savedNote}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2" id="assessment-summary">
        <LevelBars title={`Reading — ${roundName}`} counts={counts.reading} info={READING_LEVEL_INFO} total={counts.assessed} />
        <LevelBars title={`Maths — ${roundName}`} counts={counts.maths} info={MATHS_LEVEL_INFO} total={counts.assessed} />
      </div>
    </div>
  );
};

const LevelBars: React.FC<{ title: string; counts: Record<string, number>; info: Record<string, string>; total: number }> = ({ title, counts, info, total }) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-3">
    <p className="mb-2 text-xs font-black text-stone-800">{title}</p>
    <ul className="space-y-1.5">
      {Object.entries(counts).map(([level, n]) => (
        <li key={level} className="text-[11px]">
          <div className="flex justify-between">
            <span className="font-bold text-stone-700">{info[level].split(' — ')[0]}</span>
            <span className="text-stone-500">{n}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-sky-500" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

/* ------------------------------ period plan ------------------------------ */

const PeriodPlanView: React.FC<{ grade: string }> = ({ grade }) => {
  const [readings, setReadings] = useState<PublishedReadingSummary[]>([]);
  const [readingId, setReadingId] = useState('');
  const [plan, setPlan] = useState<ReturnType<typeof periodPlan> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPlan(null);
    backendApi.readings
      .list(grade)
      .then((r) => {
        if (cancelled) return;
        setReadings(r.readings || []);
        setReadingId(r.readings?.[0]?.id || '');
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not load chapters.'));
    return () => {
      cancelled = true;
    };
  }, [grade]);

  useEffect(() => {
    if (!readingId) return;
    let cancelled = false;
    setError(null);
    backendApi.readings
      .get(readingId)
      .then(({ reading: r }) => {
        if (cancelled) return;
        setPlan(
          periodPlan({
            chapterTitle: r.chapterTitle,
            subject: r.subject,
            language: r.language,
            paragraphs: r.paragraphs || [],
            keyVocabulary: r.keyVocabulary || [],
            keyPoints: r.keyPoints || [],
            questions: (r.comprehensionQuiz || []).map((q) => q.question),
          })
        );
      })
      .catch((e) => !cancelled && setError(e?.message || 'Could not open this chapter.'));
    return () => {
      cancelled = true;
    };
  }, [readingId]);

  const print = () =>
    plan &&
    printHtml(
      printDocument(
        `Period plan ${plan.title}`,
        `<h1>🗒️ Period plan — ${esc(plan.title)}</h1><p class="meta">Pathana Shakthi · ${esc(grade)} · ${esc(plan.subject)} · ${
          plan.source === 'scert' ? 'steps as in the SCERT Tholimettu period plans' : 'a suggested sequence'
        }</p><p class="name">Date: ___________ &nbsp; Period: ______</p>${plan.steps
          .map((s, i) => `<h2>${i + 1}. ${esc(s.step)} <span class="meta">(${s.minutes} min)</span></h2><ul>${s.do.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`)
          .join('')}<h2>✍️ Reflection</h2><div class="line"></div><div class="line"></div>`
      )
    );

  return (
    <div className="space-y-4" id="period-plan-view">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        {readings.length === 0 ? (
          <p className="text-xs text-stone-500">No chapters are published for {grade} yet — upload a textbook first.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select value={readingId} onChange={(e) => setReadingId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-stone-200 px-2 py-2 text-sm" aria-label="Chapter">
              {readings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.subject} · {r.bookTitle} · {r.chapterTitle}
                </option>
              ))}
            </select>
            {plan && (
              <button type="button" id="btn-plan-print" onClick={print} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {plan && (
        <div className="space-y-2" id="period-plan">
          <p className="text-[11px] text-stone-500">
            {plan.source === 'scert'
              ? `Steps as in the SCERT Tholimettu period plans for ${plan.subject}, filled with this chapter.`
              : 'The SCERT period steps for this subject were not available, so this is a suggested sequence — adapt it to your plan.'}{' '}
            About {plan.steps.reduce((n, s) => n + s.minutes, 0)} minutes.
          </p>
          {plan.steps.map((s, i) => (
            <div key={s.step} className="rounded-2xl border border-stone-200 bg-white p-3">
              <p className="text-sm font-black text-stone-900">
                {i + 1}. {s.step} <span className="text-xs font-bold text-stone-500">· {s.minutes} min</span>
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
                {s.do.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
