import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, Printer } from 'lucide-react';
import { backendApi, ClassCompetencies } from '../../services/backendApi';
import { CompetencyStatus, practiceFor, STATUS_INFO } from '../../data/competencies';
import { LEVEL_INFO } from '../../data/readingLevels';
import { AssignWorkModal } from './SupportBoard';
import { printHtml } from '../../services/printWorkbook';

// Competency tracking (FLN/ORF for Class 1-5, SCERT subject outcomes for
// Class 6-10): every child × every competency of the class, measured from the
// app; tap a competency for what it means, how it is measured, a classroom
// idea and "give practice" to the children who have not achieved it yet.

const ORDER: CompetencyStatus[] = ['achieved', 'developing', 'beginning', 'not_started'];
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function printCompetencies(grade: string, data: ClassCompetencies) {
  const head = data.competencies.map((c) => `<th title="${esc(c.name)}">${c.icon}<br>${esc(c.short)}</th>`).join('');
  const rows = data.students
    .map(
      (s) =>
        `<tr><td>${esc(s.rollNumber)}</td><td>${esc(s.name)}</td><td>${LEVEL_INFO[s.readingLevel || 'developing'].name}</td>${data.competencies
          .map((c) => `<td class="c">${STATUS_INFO[s.status[c.id]].icon}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const legend = ORDER.map((k) => `${STATUS_INFO[k].icon} ${STATUS_INFO[k].name}`).join(' &nbsp; ');
  const key = data.competencies.map((c) => `<li><b>${c.icon} ${esc(c.name)}</b> — ${esc(c.framework)}. ${esc(c.measured)}</li>`).join('');
  printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(grade)} competencies</title>
<style>body{font-family:'Noto Sans',sans-serif;margin:18px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d6d3d1;padding:3px 5px}th{font-size:10px;background:#f5f5f4}td.c{text-align:center}h1{font-size:18px;margin:0}ul{padding-left:18px}li{margin:2px 0}</style></head><body>
<h1>${esc(grade)} — competency record</h1><p>Pathana Shakthi · ${new Date().toLocaleDateString('en-IN')} · ${legend}</p>
<table><thead><tr><th>Roll</th><th>Name</th><th>Level</th>${head}</tr></thead><tbody>${rows}</tbody></table>
<h2 style="font-size:14px">Competencies</h2><ul>${key}</ul></body></html>`);
};

export const CompetencyPanel: React.FC<{ grade: string }> = ({ grade }) => {
  const [data, setData] = useState<ClassCompetencies | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setSelected(null);
    backendApi.support
      .competencies(grade)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load competencies.'));
    return () => {
      cancelled = true;
    };
  }, [grade]);

  const competency = data?.competencies.find((c) => c.id === selected) || null;
  const notYet = useMemo(
    () => (data && competency ? data.students.filter((s) => s.status[competency.id] !== 'achieved') : []),
    [data, competency]
  );

  const print = () => data && printCompetencies(grade, data);

  return (
    <div id="competency-panel" className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-stone-900">Competencies (FLN · ORF · learning outcomes)</h3>
          <p className="text-[11px] text-stone-500">
            Measured from reading, quizzes, workbooks, word practice and Learn & Play. Tap a competency for details and practice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-stone-500 sm:inline">
            {ORDER.map((k) => `${STATUS_INFO[k].icon} ${STATUS_INFO[k].name}`).join('  ')}
          </span>
          {data && (
            <button type="button" id="btn-print-competencies" onClick={print} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-sky-300">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 py-3 text-xs text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {data && (
        <>
          {/* Class summary: one bar per competency */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.competencies.map((c) => {
              const counts = data.summary[c.id];
              const total = data.students.length || 1;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(selected === c.id ? null : c.id)}
                  aria-pressed={selected === c.id}
                  className={`competency-tile rounded-xl border p-2.5 text-left transition ${selected === c.id ? 'border-sky-500 bg-sky-50' : 'border-stone-200 hover:border-sky-300'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-stone-900">
                      {c.icon} {c.short}
                    </span>
                    <span className="text-[10px] font-bold text-stone-500">
                      {counts.achieved}/{data.students.length} achieved
                    </span>
                  </span>
                  <span className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                    {ORDER.map((k) => (
                      <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_INFO[k].color }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {competency && (
            <div id="competency-detail" className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <p className="text-sm font-black text-stone-900">
                {competency.icon} {competency.name}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-600">
                <b>Framework:</b> {competency.framework}
              </p>
              <p className="text-[11px] text-stone-600">
                <b>How it is measured:</b> {competency.measured}
              </p>
              {competency.idea && (
                <p className="mt-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-stone-700">
                  💡 <b>In class:</b> {competency.idea}
                </p>
              )}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['beginning', 'developing', 'not_started', 'achieved'] as CompetencyStatus[]).map((k) => {
                  const kids = data.students.filter((s) => s.status[competency.id] === k);
                  if (!kids.length) return null;
                  return (
                    <div key={k} className="rounded-lg bg-white p-2">
                      <p className="text-[11px] font-black text-stone-700">
                        {STATUS_INFO[k].icon} {STATUS_INFO[k].name} · {kids.length}
                      </p>
                      <p className="text-[11px] text-stone-600">{kids.map((s) => s.name.split(' ')[0]).join(', ')}</p>
                    </div>
                  );
                })}
              </div>
              {notYet.length > 0 && (
                <button
                  type="button"
                  id="btn-competency-practice"
                  onClick={() => setAssigning(true)}
                  className="mt-2 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-[11px] font-black text-sky-800 hover:bg-sky-100"
                >
                  📌 Give practice to the {notYet.length} not achieved yet
                </button>
              )}
            </div>
          )}

          {/* Child × competency grid */}
          <div className="mt-3 overflow-x-auto">
            <table id="competency-grid" className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-stone-50 text-[10px] text-stone-500">
                <tr>
                  <th className="px-2 py-2 font-black uppercase">Student</th>
                  {data.competencies.map((c) => (
                    <th key={c.id} className="px-1 py-2 text-center font-black" title={c.name}>
                      <span className="block text-sm">{c.icon}</span>
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.students.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-bold text-stone-800">
                      {s.avatar} {s.name}
                    </td>
                    {data.competencies.map((c) => (
                      <td key={c.id} className="px-1 py-1.5 text-center" title={`${c.short}: ${STATUS_INFO[s.status[c.id]].name}`}>
                        {STATUS_INFO[s.status[c.id]].icon}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <AnimatePresence>
        {assigning && competency && data && (
          <AssignWorkModal
            key="competency-assign"
            grade={grade}
            title={`${competency.icon} ${competency.short}`}
            students={notYet}
            initialWork={practiceFor(competency, grade)}
            onClose={() => setAssigning(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
