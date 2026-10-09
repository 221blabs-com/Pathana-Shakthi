import React, { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { backendApi, ClassReport } from '../../services/backendApi';
import { localDay } from '../../services/progressSync';
import { printHtml } from '../../services/printWorkbook';

// Teacher reflection & reporting: the class's day / week / month — what was
// read and how reading changed, workbooks and help, the work given and
// whether children did it and improved, who needs attention, and what to
// prioritise next. Printable for the school's monitoring file.

type Period = 'day' | 'week' | 'month';
const LABEL: Record<Period, string> = { day: 'Today', week: 'This week', month: 'This month' };
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function change(now: number | null, before: number | null) {
  if (now === null || before === null) return '';
  const d = now - before;
  return d === 0 ? 'same as before' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} points vs the period before`;
}

function printReport(r: ClassReport) {
  const li = (xs: string[]) => xs.map((x) => `<li>${esc(x)}</li>`).join('');
  printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.grade)} report</title>
<style>body{font-family:'Noto Sans',sans-serif;margin:18px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:14px 0 4px;border-bottom:2px solid #e7e5e4}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6d3d1;padding:3px 6px;text-align:left}th{background:#f5f5f4;font-size:10px}ul{margin:0;padding-left:18px}</style></head><body>
<h1>${esc(r.grade)} — ${esc(LABEL[r.period])} (${fmt(r.from)}${r.from !== r.to ? ` – ${fmt(r.to)}` : ''})</h1><p>Pathana Shakthi · class report</p>
<h2>Reading</h2><p>${r.reading.sessions} readings by ${r.reading.readers} children · ${r.reading.minutes} minutes · accuracy ${r.reading.accuracy ?? '—'}% ${esc(change(r.reading.accuracy, r.reading.prevAccuracy))} · ${r.reading.wpm ?? '—'} words/min · ${r.activeChildren} of ${r.totalChildren} children practised</p>
${r.reading.chapters.length ? `<p>Read: ${r.reading.chapters.map((c) => `${esc(c.title)} (${c.times})`).join(', ')}</p>` : ''}
<h2>Workbooks and help</h2><p>${r.workbooks.worked} workbooks worked on, ${r.workbooks.finished} finished · ${r.workbooks.helpAsked} help requests, ${r.workbooks.helpAnswered} answered</p>
<h2>Work given and follow-up</h2><p>${r.work.given} pieces of work given, ${r.work.done} done · ${r.work.seen} of ${r.work.messages} messages seen</p>
${r.followUps.length ? `<table><tr><th>Child</th><th>Work given</th><th>Done</th><th>Accuracy before</th><th>After</th><th>Improved</th></tr>${r.followUps.map((f) => `<tr><td>${esc(f.name)}</td><td>${f.given}</td><td>${f.done}</td><td>${f.accuracyBefore ?? '—'}</td><td>${f.accuracyAfter ?? '—'}</td><td>${f.improved === null ? '—' : f.improved ? 'Yes' : 'Not yet'}</td></tr>`).join('')}</table>` : ''}
<h2>Competencies (now)</h2><p>${r.competencies.map((c) => `${c.icon} ${esc(c.short)} ${c.achieved}/${c.total}`).join(' · ')}</p>
<h2>Needs attention</h2><ul>${li(r.attention.map((a) => `${a.name}: ${a.reasons.join(', ')}`)) || '<li>Nobody — well done!</li>'}</ul>
<h2>Priorities next</h2><ul>${li(r.priorities) || '<li>Keep going as planned.</li>'}</ul>
<p style="margin-top:24px">Teacher's signature: ____________________ &nbsp; Headmaster: ____________________</p></body></html>`);
}

export const ReportPanel: React.FC<{ grade: string }> = ({ grade }) => {
  const [period, setPeriod] = useState<Period>('week');
  const [report, setReport] = useState<ClassReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError('');
    backendApi.support
      .report(grade, period, localDay())
      .then((r) => !cancelled && setReport(r))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the report.'));
    return () => {
      cancelled = true;
    };
  }, [grade, period]);

  const r = report;
  return (
    <div id="report-panel" className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-stone-900">📋 Report · what happened and what next</h3>
          <p className="text-[11px] text-stone-500">For your reflection and the school's monitoring file.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`report-period rounded-lg border px-2.5 py-1 text-[11px] font-black ${period === p ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-700'}`}
            >
              {LABEL[p]}
            </button>
          ))}
          {r && (
            <button type="button" id="btn-print-report" onClick={() => printReport(r)} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
      {!r && !error && (
        <p className="flex items-center gap-2 py-3 text-xs text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {r && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-stone-50 p-2.5">
              <p className="text-[10px] font-bold text-stone-500">Children practised</p>
              <p className="text-lg font-black text-stone-900">
                {r.activeChildren}/{r.totalChildren}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5">
              <p className="text-[10px] font-bold text-stone-500">Readings · minutes</p>
              <p className="text-lg font-black text-stone-900">
                {r.reading.sessions} · {r.reading.minutes}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5">
              <p className="text-[10px] font-bold text-stone-500">Reading accuracy</p>
              <p className="text-lg font-black text-stone-900">{r.reading.accuracy === null ? '—' : `${r.reading.accuracy}%`}</p>
              <p className="text-[10px] text-stone-500">{change(r.reading.accuracy, r.reading.prevAccuracy)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5">
              <p className="text-[10px] font-bold text-stone-500">Workbooks · help</p>
              <p className="text-lg font-black text-stone-900">
                {r.workbooks.finished}/{r.workbooks.worked} · {r.workbooks.helpAnswered}/{r.workbooks.helpAsked}
              </p>
              <p className="text-[10px] text-stone-500">finished · questions answered</p>
            </div>
          </div>

          {r.period !== 'day' && (
            <div className="flex h-16 items-end gap-1" aria-label="Children practising per day">
              {r.perDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-0.5" title={`${fmt(d.day)}: ${d.active} children, ${d.readings} readings`}>
                  <div className="w-full rounded-t bg-sky-400" style={{ height: `${r.totalChildren ? Math.max(2, (d.active / r.totalChildren) * 52) : 2}px` }} />
                  {r.period === 'week' && <span className="text-[9px] text-stone-400">{fmt(d.day)}</span>}
                </div>
              ))}
            </div>
          )}

          {r.reading.chapters.length > 0 && (
            <p className="text-xs text-stone-700">
              📖 <b>Read:</b> {r.reading.chapters.map((c) => `${c.title} (${c.times})`).join(' · ')}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-stone-100 p-3">
              <p className="mb-1 text-xs font-black text-stone-800">
                📌 Work given: {r.work.given} · done {r.work.done}
              </p>
              {r.followUps.length === 0 ? (
                <p className="text-[11px] text-stone-500">No work given in this period.</p>
              ) : (
                <ul className="space-y-1">
                  {r.followUps.map((f) => (
                    <li key={f.studentId} className="report-followup text-[11px] text-stone-700">
                      <b>{f.name}</b>: {f.done}/{f.given} done
                      {f.accuracyBefore !== null && f.accuracyAfter !== null && (
                        <>
                          {' '}
                          · reading {f.accuracyBefore}% → {f.accuracyAfter}% {f.improved ? '✅ improved' : '⏳ not yet'}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-stone-100 p-3">
              <p className="mb-1 text-xs font-black text-stone-800">👀 Needs attention</p>
              {r.attention.length === 0 ? (
                <p className="text-[11px] text-stone-500">Nobody — well done!</p>
              ) : (
                <ul className="space-y-1">
                  {r.attention.slice(0, 8).map((a) => (
                    <li key={a.studentId} className="text-[11px] text-stone-700">
                      <b>{a.name}</b>: {a.reasons.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3" id="report-priorities">
            <p className="mb-1 text-xs font-black text-stone-800">⭐ Priorities next</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-stone-700">
              {(r.priorities.length ? r.priorities : ['Keep going as planned.']).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
