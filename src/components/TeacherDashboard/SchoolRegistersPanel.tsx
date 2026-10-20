import React, { useEffect, useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { backendApi, ClassRegisterRollup, SchoolRegisters } from '../../services/backendApi';
import { localDay } from '../../services/progressSync';
import { downloadCsv } from '../../services/csv';
import { printDocument, printHtml } from '../../services/printWorkbook';
import { ROUNDS } from '../../data/registers';
import { monthName } from '../../data/curriculumMap';

// The headmaster's monthly roll-up of the teachers' registers
// (server/schoolRegisters.ts): attendance, the latest FLN round and the
// curriculum pace of every class, with notes and a printable report.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
const roundName = (id: string | null) => ROUNDS.find((r) => r.id === id)?.name || '—';

export const SchoolRegistersPanel: React.FC<{ onOpenClass?: (grade: string) => void }> = ({ onOpenClass }) => {
  const [month, setMonth] = useState(localDay().slice(0, 7));
  const [data, setData] = useState<SchoolRegisters | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    backendApi.school
      .registers(month)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load the registers.'));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const classes = (data?.classes || []).filter((c) => c.children > 0);

  const row = (c: ClassRegisterRollup) => [
    c.grade,
    c.children,
    c.attendance.percent === null ? '' : `${c.attendance.percent}%`,
    c.attendance.days,
    c.attendance.below75,
    roundName(c.fln.round),
    c.fln.assessed,
    pct(c.fln.readingWordPlus, c.fln.assessed),
    pct(c.fln.readingParagraphPlus, c.fln.assessed),
    pct(c.fln.mathsAddSubPlus, c.fln.assessed),
    c.fln.movedUp === null ? '' : `▲${c.fln.movedUp} ▼${c.fln.movedDown}`,
    `${c.curriculum.taught}/${c.curriculum.total}`,
    c.curriculum.late,
  ];
  const HEAD = ['Class', 'Children', 'Attendance', 'Days marked', 'Under 75%', 'FLN round', 'Assessed', 'Reads words+', 'Reads paragraph+', 'Maths + − or more', 'Level change', 'Chapters taught', 'Behind plan'];

  const csv = () => data && downloadCsv(`school-registers-${month}.csv`, [HEAD, ...classes.map(row)]);
  const print = () =>
    data &&
    printHtml(
      printDocument(
        `School report ${month}`,
        `<style>table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #a8a29e;padding:3px 5px;text-align:center}td:first-child{text-align:left;font-weight:700}th{background:#f5f5f4}</style><h1>🏫 ${esc(
          data.school.name || 'School'
        )} — monthly report</h1><p class="meta">Pathana Shakthi · ${esc(monthName(month))} · academic year ${esc(data.year)} · ${data.totals.children} children · attendance ${
          data.totals.attendancePercent === null ? '—' : `${data.totals.attendancePercent}%`
        } · ${data.totals.taught}/${data.totals.chapters} chapters taught</p>${
          data.notes.length ? `<h2>Needs attention</h2><ul>${data.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''
        }<h2>Classes</h2><table><tr>${HEAD.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${classes
          .map((c) => `<tr>${row(c).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
          .join('')}</table><p class="meta" style="margin-top:8px">FLN levels are from each class's latest saved round this year (teacher-confirmed). Reading: beginner → letters → words → paragraph → story.</p><p class="name" style="margin-top:28px">Headmaster's signature: ____________________ &nbsp; Date: ___________</p>`
      )
    );

  return (
    <section id="school-registers" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h2 className="text-lg font-black text-stone-900">🗂️ Registers & FLN — all classes</h2>
          <p className="text-xs text-stone-500">From what teachers mark in their Registers and Curriculum tabs.</p>
        </div>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1 text-sm" aria-label="Month" />
        {data && (
          <>
            <button type="button" id="btn-school-report-print" onClick={print} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
              <Printer className="h-3.5 w-3.5" /> Print report
            </button>
            <button type="button" onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" id="school-registers-totals">
            <Tile label="Attendance" value={data.totals.attendancePercent === null ? '—' : `${data.totals.attendancePercent}%`} hint={monthName(month)} />
            <Tile label="FLN assessed" value={`${data.totals.assessed}/${data.totals.children}`} hint="latest round per class" />
            <Tile label="Read a paragraph+" value={pct(data.totals.readingParagraphPlus, data.totals.assessed)} hint="of those assessed" />
            <Tile label="Chapters taught" value={`${data.totals.taught}/${data.totals.chapters}`} hint={`year ${data.year}`} />
          </div>

          {data.notes.length > 0 && (
            <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900" id="school-registers-notes">
              {data.notes.map((n) => (
                <li key={n}>🐯 {n}</li>
              ))}
            </ul>
          )}

          {classes.length === 0 ? (
            <p className="text-sm text-stone-500">No children in any class yet.</p>
          ) : (
            <div className="space-y-2" id="school-registers-classes">
              {classes.map((c) => (
                <div key={c.grade} className="school-class-row rounded-2xl border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-sm font-black text-stone-900">
                      {c.grade} <span className="text-xs font-bold text-stone-500">· {c.children} children</span>
                    </p>
                    {onOpenClass && (
                      <button type="button" onClick={() => onOpenClass(c.grade)} className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-black text-stone-700">
                        Open class
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                    <Cell title="🗓️ Attendance">
                      {c.attendance.days ? (
                        <>
                          <b className={(c.attendance.percent ?? 100) < 75 ? 'text-rose-700' : 'text-stone-900'}>{c.attendance.percent}%</b> over {c.attendance.days} days
                          {c.attendance.below75 > 0 && <> · {c.attendance.below75} under 75%</>}
                          {c.attendance.awayLast3.length > 0 && <div className="text-rose-700">Away 3 days: {c.attendance.awayLast3.join(', ')}</div>}
                        </>
                      ) : (
                        <span className="text-stone-400">Not marked this month</span>
                      )}
                    </Cell>
                    <Cell title={`📊 FLN · ${roundName(c.fln.round)}`}>
                      {c.fln.round ? (
                        <>
                          Words+ <b>{pct(c.fln.readingWordPlus, c.fln.assessed)}</b> · paragraph+ <b>{pct(c.fln.readingParagraphPlus, c.fln.assessed)}</b> · maths + − <b>{pct(c.fln.mathsAddSubPlus, c.fln.assessed)}</b>
                          <div className="text-stone-500">
                            {c.fln.assessed} assessed
                            {c.fln.since && ` · since ${roundName(c.fln.since)}: ▲${c.fln.movedUp} ▼${c.fln.movedDown}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-stone-400">No round saved this year</span>
                      )}
                    </Cell>
                    <Cell title="🗺️ Curriculum">
                      <b>
                        {c.curriculum.taught}/{c.curriculum.total}
                      </b>{' '}
                      taught
                      {c.curriculum.late > 0 && <span className="text-rose-700"> · {c.curriculum.late} behind plan</span>}
                      {c.curriculum.now > 0 && <span className="text-amber-700"> · {c.curriculum.now} this month</span>}
                      {c.curriculum.total > 0 && c.curriculum.unplanned === c.curriculum.total && <div className="text-stone-400">No year plan yet</div>}
                    </Cell>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

const Tile: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-stone-200 bg-white px-3 py-2">
    <p className="text-[11px] font-bold text-stone-500">{label}</p>
    <p className="text-xl font-black text-stone-900">{value}</p>
    <p className="text-[10px] text-stone-400">{hint}</p>
  </div>
);

const Cell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl bg-stone-50 px-2 py-1.5">
    <p className="mb-0.5 text-[11px] font-black text-stone-600">{title}</p>
    <div className="text-stone-700">{children}</div>
  </div>
);
