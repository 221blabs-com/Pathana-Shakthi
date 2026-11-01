import React, { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrowLeft, Printer, Search } from 'lucide-react';
import { TLM_LIBRARY, TlmArea, TlmItem, tlmsFor } from '../../data/tlmLibrary';
import { COMPETENCIES } from '../../data/competencies';
import { LEVEL_INFO } from '../../data/readingLevels';
import { printDocument, printHtml } from '../../services/printWorkbook';
import { TlmPicture } from './TlmPicture';
import { askMitra } from './MitraAgent';

// The TLM library (src/data/tlmLibrary.ts): every material with a picture,
// what it teaches, how to make and use it, and how to adapt it for each
// reading level — filtered to the class, subject area or competency.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const gradeNum = (g: string) => Number(String(g).replace(/\D+/g, '')) || 1;
const AREAS: TlmArea[] = ['Literacy', 'Numeracy', 'EVS'];
const compName = (id: string) => COMPETENCIES.find((c) => c.id === id)?.short || id;

/** One TLM as a printable teacher card (picture, make, use, levels). */
export function tlmCardHtml(t: TlmItem): string {
  const svg = renderToStaticMarkup(<TlmPicture kind={t.picture} title={t.name} />);
  const list = (items: string[]) => `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
  return `<section class="wb"><h1>🧰 ${esc(t.name)}</h1><p class="meta">Classes ${t.grades[0]}–${t.grades[1]} · ${esc(t.area)} · builds: ${t.competencies.map(compName).map(esc).join(', ')}</p>
<div style="width:220px;margin:10px 0">${svg}</div>
<h2>What children learn</h2><p>${esc(t.learning)}</p>
<h2>Materials</h2><ul>${t.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
<h2>How to make it</h2>${list(t.make)}<h2>How to use it in class</h2>${list(t.use)}
<h2>For each reading level</h2><ul><li><b>🌱 Beginner:</b> ${esc(t.levels.beginner)}</li><li><b>🌿 Developing:</b> ${esc(t.levels.developing)}</li><li><b>🌳 Proficient:</b> ${esc(t.levels.proficient)}</li></ul>
<h2>What to look for</h2><p>${esc(t.check)}</p></section>`;
}

export const TlmLibrary: React.FC<{ grade: string }> = ({ grade }) => {
  const [area, setArea] = useState<TlmArea | ''>('');
  const [competency, setCompetency] = useState('');
  const [query, setQuery] = useState('');
  const [allClasses, setAllClasses] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = tlmsFor({ grade: allClasses ? undefined : grade, competency: competency || undefined, query });
    return area ? list.filter((t) => t.area === area) : list;
  }, [grade, area, competency, query, allClasses]);

  const comps = useMemo(() => [...new Set(TLM_LIBRARY.flatMap((t) => t.competencies))].map((id) => ({ id, name: compName(id) })), []);
  const open = TLM_LIBRARY.find((t) => t.id === openId);

  if (open) {
    return (
      <section className="space-y-4" id="tlm-detail">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpenId(null)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
            <ArrowLeft className="h-3.5 w-3.5" /> TLM library
          </button>
          <button
            type="button"
            onClick={() => printHtml(printDocument(open.name, tlmCardHtml(open)))}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700"
            id="btn-tlm-print"
          >
            <Printer className="h-3.5 w-3.5" /> Print this card
          </button>
          <button
            type="button"
            onClick={() => askMitra(`How can I use the "${open.name}" TLM with my ${grade} class this week? Which children and which chapter?`)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900"
          >
            🐯 Ask Mitra how to use it
          </button>
        </div>
        <div className="grid gap-4 rounded-3xl border border-stone-200 bg-white p-4 md:grid-cols-[260px_1fr]">
          <TlmPicture kind={open.picture} title={open.name} className="w-full max-w-[260px]" />
          <div className="space-y-2">
            <h2 className="text-xl font-black text-stone-900">{open.name}</h2>
            <p className="text-xs font-bold text-stone-500">
              Classes {open.grades[0]}–{open.grades[1]} · {open.area}
            </p>
            <div className="flex flex-wrap gap-1">
              {open.competencies.map((c) => (
                <span key={c} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-black text-sky-800">
                  {compName(c)}
                </span>
              ))}
            </div>
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">🎯 {open.learning}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Block title="🧺 Materials">
            <ul className="list-disc space-y-0.5 pl-5">
              {open.materials.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Block>
          <Block title="✂️ How to make it">
            <ol className="list-decimal space-y-0.5 pl-5">
              {open.make.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </Block>
          <Block title="👩‍🏫 How to use it in class">
            <ol className="list-decimal space-y-0.5 pl-5">
              {open.use.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </Block>
          <Block title="🧭 For each reading level">
            <ul className="space-y-1">
              {(['beginner', 'developing', 'proficient'] as const).map((l) => (
                <li key={l}>
                  <b>
                    {LEVEL_INFO[l].icon} {LEVEL_INFO[l].name}:
                  </b>{' '}
                  {open.levels[l]}
                </li>
              ))}
            </ul>
          </Block>
          <Block title="👀 What to look for">{open.check}</Block>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" id="tlm-library">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-stone-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: fractions, phonics, story, time…" className="w-full text-sm outline-none" aria-label="Search TLMs" />
        </label>
        <select value={competency} onChange={(e) => setCompetency(e.target.value)} className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold" aria-label="Competency">
          <option value="">All competencies</option>
          {comps.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs font-bold text-stone-600">
          <input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} /> All classes
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['', ...AREAS] as const).map((a) => (
          <button
            key={a || 'all'}
            type="button"
            onClick={() => setArea(a)}
            className={`rounded-full border px-3 py-1 text-xs font-black ${area === a ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
          >
            {a || 'All'}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">No TLM matches {allClasses ? '' : `for ${grade} `}— try another word or tick "All classes".</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="tlm-card flex gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left hover:border-sky-300" data-id={t.id}>
              <TlmPicture kind={t.picture} title={t.name} className="h-20 w-28 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-black text-stone-900">{t.name}</span>
                <span className="block text-[11px] text-stone-500">
                  Classes {t.grades[0]}–{t.grades[1]} · {t.area}
                </span>
                <span className="mt-1 line-clamp-3 block text-[11px] text-stone-600">{t.learning}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {!allClasses && gradeNum(grade) > 5 && (
        <p className="text-[11px] text-stone-500">The library is built for the foundational and primary classes; tick "All classes" to see every material.</p>
      )}
    </section>
  );
};

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-3 text-sm text-stone-700">
    <p className="mb-1 text-sm font-black text-stone-900">{title}</p>
    {children}
  </div>
);
