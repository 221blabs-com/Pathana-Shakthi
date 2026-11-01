import React, { useState } from 'react';
import { ExternalLink, Printer } from 'lucide-react';
import { HANDBOOK, HandbookBlock, HandbookSection } from '../../data/teacherHandbook';
import { TEACHER_OPEN_EVENT } from '../../services/teacherAgent';
import { printDocument, printHtml } from '../../services/printWorkbook';
import { askMitra } from './MitraAgent';

// The Teacher Handbook (src/data/teacherHandbook.ts): what the curriculum asks
// for and how each part of the app carries it out, with buttons that open
// that part and questions for Shakthi Mitra.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const blockHtml = (b: HandbookBlock) =>
  b.kind === 'p'
    ? `<p>${esc(b.text)}</p>`
    : b.kind === 'note'
      ? `<p class="meta">ℹ️ ${esc(b.text)}</p>`
      : b.kind === 'list'
        ? `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`
        : `<table><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;

const sectionHtml = (s: HandbookSection) => `<h2>${esc(s.icon)} ${esc(s.title)}</h2><p class="meta">${esc(s.summary)}</p>${s.blocks.map(blockHtml).join('')}<p class="meta">Source: ${esc(s.source)}</p>`;

const Block: React.FC<{ b: HandbookBlock }> = ({ b }) => {
  if (b.kind === 'p') return <p className="text-sm text-stone-700">{b.text}</p>;
  if (b.kind === 'note') return <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">ℹ️ {b.text}</p>;
  if (b.kind === 'list') {
    const Tag = b.ordered ? 'ol' : 'ul';
    return (
      <Tag className={`space-y-1 pl-5 text-sm text-stone-700 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
        {b.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </Tag>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-stone-50 text-left">
          <tr>
            {b.head.map((h) => (
              <th key={h} className="px-2 py-1.5 font-black text-stone-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-100">
              {r.map((c, k) => (
                <td key={k} className={`px-2 py-1.5 ${k === 0 ? 'font-bold text-stone-800' : 'text-stone-700'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const HandbookPanel: React.FC<{ grade: string }> = ({ grade }) => {
  const [id, setId] = useState(HANDBOOK[0].id);
  const s = HANDBOOK.find((x) => x.id === id) || HANDBOOK[0];

  const open = (screen: string) => window.dispatchEvent(new CustomEvent(TEACHER_OPEN_EVENT, { detail: { screen, grade } }));
  const printAll = () =>
    printHtml(
      printDocument(
        'Teacher Handbook',
        `<style>table{border-collapse:collapse;width:100%;font-size:12px;margin:6px 0}th,td{border:1px solid #d6d3d1;padding:3px 6px;text-align:left}</style><h1>📖 Teacher Handbook — Pathana Shakthi</h1><p class="meta">Summaries of public sources and how the app carries them out; not the official SCERT handbook text.</p>${HANDBOOK.map(sectionHtml).join('')}`
      )
    );

  return (
    <section className="space-y-4" id="handbook-panel">
      <div className="flex flex-wrap items-start gap-2 rounded-2xl border border-stone-200 bg-gradient-to-r from-violet-50 to-sky-50 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-stone-900">📖 Teacher Handbook</h2>
          <p className="text-xs text-stone-600">
            What the curriculum asks for, and where to do it in the app. Built from summaries of public sources (NIPUN Bharat, Tholimettu, SCERT circulars, SCF 2011) — not the official
            handbook text.
          </p>
        </div>
        <button type="button" onClick={printAll} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700" id="btn-handbook-print">
          <Printer className="h-3.5 w-3.5" /> Print handbook
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" aria-label="Handbook sections">
          {HANDBOOK.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-current={x.id === id}
              className={`handbook-toc shrink-0 rounded-xl px-3 py-2 text-left text-xs font-black lg:text-sm ${x.id === id ? 'bg-violet-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
            >
              {x.icon} {x.title}
            </button>
          ))}
        </nav>
        <article className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4" id="handbook-section">
          <h3 className="text-lg font-black text-stone-900">
            {s.icon} {s.title}
          </h3>
          <p className="text-sm font-bold text-stone-500">{s.summary}</p>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
          {(s.open?.length || s.ask?.length) && (
            <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
              {s.open?.map((o) => (
                <button key={o.screen + o.label} type="button" onClick={() => open(o.screen)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">
                  <ExternalLink className="h-3.5 w-3.5" /> {o.label}
                </button>
              ))}
              {s.ask?.map((q) => (
                <button key={q} type="button" onClick={() => askMitra(q)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-left text-xs font-black text-amber-900">
                  🐯 {q}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-stone-400">Source: {s.source}</p>
        </article>
      </div>
    </section>
  );
};
