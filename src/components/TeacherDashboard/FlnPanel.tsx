import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Printer, Save } from 'lucide-react';
import { backendApi, ClassFlnChapter, ClassFlnChild } from '../../services/backendApi';
import { PublishedReadingSummary } from '../../types';
import { downloadCsv } from '../../services/csv';
import { printDocument, printHtml } from '../../services/printWorkbook';
import { FlnChips } from '../FlnCheckPanel';
import { FlnResult, WRITING_RUBRIC, answerScore, flnSummary, orfNorm } from '../../data/flnCheck';

// The teacher's view of the chapter FLN checks (server/flnRoutes.ts): every
// chapter's class summary, then every child's reading sentences, ORF against
// the government norm, comprehension answers (AI marks the teacher can change)
// and writing (marked by the teacher), with the words missed and the tries.

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const BAND = { meets: 'bg-emerald-100 text-emerald-800', approaching: 'bg-amber-100 text-amber-800', below: 'bg-rose-100 text-rose-800' } as const;

export const FlnPanel: React.FC<{ grade: string }> = ({ grade }) => {
  const [readings, setReadings] = useState<PublishedReadingSummary[]>([]);
  const [chapters, setChapters] = useState<ClassFlnChapter[]>([]);
  const [classSize, setClassSize] = useState(0);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = () => {
    setLoading(true);
    Promise.all([backendApi.readings.list(grade), backendApi.fln.classChapters(grade)])
      .then(([r, c]) => {
        setReadings(r.readings || []);
        setChapters(c.chapters);
        setClassSize(c.classSize);
      })
      .catch((e) => setError(e?.message || 'Could not load the reading checks.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setReadingId(null);
    setError(null);
    loadSummary();
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(chapters.map((c) => [c.readingId, c])), [chapters]);
  const reading = readings.find((r) => r.id === readingId);

  if (readingId) return <ChapterFln grade={grade} reading={reading} readingId={readingId} onBack={() => { setReadingId(null); loadSummary(); }} />;

  return (
    <section className="space-y-3" id="fln-panel">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <h3 className="text-base font-black text-stone-900">🧪 FLN checks by chapter</h3>
        <p className="text-xs text-stone-600">
          Each chapter's check: 📖 reading sentences · ⏱️ oral reading fluency (words correct per minute against the government norm) · ❓ reading comprehension (direct,
          indirect and open questions — AI marks you can change) · ✍️ writing about a picture (you mark it). Open a chapter to see every child's mistakes and tries.
        </p>
        <p className="mt-1 text-xs font-bold text-sky-900">
          ORF goal for {grade}: {orfNorm(grade, 'English').target} wpm ({orfNorm(grade, 'English').source})
          {orfNorm(grade, 'Telugu').target !== orfNorm(grade, 'English').target && ` · Telugu ${orfNorm(grade, 'Telugu').target} wpm (${orfNorm(grade, 'Telugu').source})`}
        </p>
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : readings.length === 0 ? (
        <p className="text-sm text-stone-500">No chapters are published for {grade} yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-3 py-2">Chapter</th>
                <th className="px-2 py-2">Checked</th>
                <th className="px-2 py-2">Median ORF</th>
                <th className="px-2 py-2">Meet norm</th>
                <th className="px-2 py-2">Comprehension</th>
                <th className="px-2 py-2">Writing marked</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => {
                const c = byId.get(r.id);
                return (
                  <tr key={r.id} className="fln-chapter-row cursor-pointer border-t border-stone-100 hover:bg-sky-50" onClick={() => setReadingId(r.id)}>
                    <td className="px-3 py-2 font-bold text-stone-900">
                      {r.chapterTitle}
                      <span className="block text-[10px] font-normal text-stone-500">
                        {r.subject} · {r.bookTitle}
                      </span>
                    </td>
                    <td className="px-2 py-2">{c ? `${c.checked}/${classSize}` : `0/${classSize}`}</td>
                    <td className="px-2 py-2">{c?.medianWcpm ?? '—'}</td>
                    <td className="px-2 py-2">{c?.meetsNorm !== null && c?.meetsNorm !== undefined ? `${c.meetsNorm}%` : '—'}</td>
                    <td className="px-2 py-2">{c?.comprehension !== null && c?.comprehension !== undefined ? `${c.comprehension}%` : '—'}</td>
                    <td className="px-2 py-2">{c ? `${c.writingMarked}/${c.writingDone}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ------------------------------ one chapter ------------------------------ */

const ChapterFln: React.FC<{ grade: string; readingId: string; reading?: PublishedReadingSummary; onBack: () => void }> = ({ grade, readingId, reading, onBack }) => {
  const [children, setChildren] = useState<ClassFlnChild[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    backendApi.fln
      .classChapter(grade, readingId)
      .then((r) => !cancelled && setChildren(r.children))
      .catch((e) => !cancelled && setError(e?.message || 'Could not load this chapter.'));
    return () => {
      cancelled = true;
    };
  }, [grade, readingId]);

  const update = (id: string, result: FlnResult) =>
    setChildren((list) => (list || []).map((c) => (c.id === id ? { ...c, result, summary: flnSummary(result) } : c)));

  const title = reading?.chapterTitle || children?.find((c) => c.result?.chapterTitle)?.result?.chapterTitle || 'Chapter';

  const csv = () =>
    children &&
    downloadCsv(`fln-${grade.replace(/\s+/g, '')}-${title.slice(0, 30).replace(/[^\w]+/g, '-')}.csv`, [
      ['Roll', 'Name', 'Sentences %', 'WCPM', 'ORF goal', 'ORF band', 'Comprehension', 'Writing /10', 'Missed words (ORF)'],
      ...children.map((c) => [
        c.rollNumber,
        c.name,
        c.summary.sentences ?? '',
        c.summary.wcpm ?? '',
        c.summary.target ?? '',
        c.summary.band ?? '',
        c.summary.comprehension ? `${c.summary.comprehension.score}/${c.summary.comprehension.max}` : '',
        c.summary.writing?.score ?? '',
        (c.result?.orf?.missed || []).join(' '),
      ]),
    ]);

  const printWriting = async () => {
    try {
      const [{ check }, imgs] = await Promise.all([backendApi.readings.flnCheck(readingId), backendApi.readings.images(readingId).catch(() => ({ images: [] as any[] }))]);
      const pic = check.writing.useChapterPicture ? imgs.images?.[0] : null;
      printHtml(
        printDocument(
          `Writing — ${title}`,
          `<h1>✍️ ${esc(title)}</h1><p class="name">Name: ______________________ &nbsp; Roll no: ______ &nbsp; Date: ___________</p>${
            pic ? `<img class="pic" src="data:${pic.mimeType};base64,${pic.base64}" alt="">` : ''
          }<ol>${check.writing.prompts.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>${'<div class="line"></div>'.repeat(10)}`
        )
      );
    } catch (e: any) {
      setError(e?.message || 'Could not print.');
    }
  };

  return (
    <section className="space-y-3" id="fln-chapter">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
          <ArrowLeft className="h-3.5 w-3.5" /> All chapters
        </button>
        <h3 className="min-w-0 flex-1 truncate text-base font-black text-stone-900">🧪 {title}</h3>
        <button type="button" onClick={printWriting} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
          <Printer className="h-3.5 w-3.5" /> Writing sheet
        </button>
        <button type="button" onClick={csv} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-black text-stone-700">
          <Download className="h-3.5 w-3.5" /> Excel
        </button>
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
      {!children ? (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <ul className="space-y-2">
          {children.map((c) => (
            <li key={c.id} className="fln-child rounded-2xl border border-stone-200 bg-white">
              <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left">
                <span className="w-6 text-xs text-stone-500">{c.rollNumber}</span>
                <span aria-hidden>{c.avatar}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-900">{c.name}</span>
                {c.result ? <FlnChips summary={c.summary} /> : <span className="text-[11px] text-stone-400">Not done yet</span>}
                {c.summary.band && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${BAND[c.summary.band]}`}>{c.summary.band === 'meets' ? 'meets norm' : c.summary.band}</span>}
              </button>
              {open === c.id && c.result && <ChildDetail grade={grade} studentId={c.id} readingId={readingId} result={c.result} onSaved={(r) => update(c.id, r)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/* ------------------------------ one child ------------------------------ */

const ChildDetail: React.FC<{ grade: string; studentId: string; readingId: string; result: FlnResult; onSaved: (r: FlnResult) => void }> = ({
  grade,
  studentId,
  readingId,
  result,
  onSaved,
}) => {
  const answers = result.comprehension?.answers || [];
  const [marks, setMarks] = useState<Record<string, number | null>>({});
  const [rubric, setRubric] = useState<Record<string, number>>({ ...(result.writing?.rubric || {}) } as Record<string, number>);
  const [note, setNote] = useState(result.writing?.note || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const body: Parameters<typeof backendApi.fln.mark>[3] = {};
      if (Object.keys(marks).length) body.answers = marks;
      if (result.writing || Object.keys(rubric).length || note) body.writing = { rubric, note };
      const r = await backendApi.fln.mark(grade, studentId, readingId, body);
      onSaved(r.result);
      setMarks({});
      setMsg('Saved ✓');
    } catch (e: any) {
      setMsg(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-stone-100 px-3 py-3 text-xs" id="fln-child-detail">
      {result.sentences?.length ? (
        <div>
          <p className="mb-1 font-black text-stone-700">📖 Reading sentences</p>
          <ul className="space-y-1">
            {result.sentences.map((s, i) => (
              <li key={i} className="rounded-lg bg-stone-50 px-2 py-1">
                <span className="font-bold text-stone-800">{s.text}</span> — <b>{s.accuracy}%</b> · tries {s.tries}
                {s.missed.length > 0 && <span className="text-rose-700"> · missed: {s.missed.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.orf && (
        <div>
          <p className="mb-1 font-black text-stone-700">⏱️ Oral reading fluency</p>
          <p className="rounded-lg bg-stone-50 px-2 py-1">
            <b>{result.orf.wcpm} words correct per minute</b> (goal {result.orf.target}, {result.orf.source}) · {result.orf.correct}/{result.orf.words} words right in{' '}
            {result.orf.seconds} s · {result.orf.accuracy}% · tries {result.orf.tries}
            {result.orf.missed.length > 0 && <span className="block text-rose-700">Missed: {result.orf.missed.join(', ')}</span>}
          </p>
        </div>
      )}
      {answers.length > 0 && (
        <div>
          <p className="mb-1 font-black text-stone-700">❓ Reading comprehension (tries {result.comprehension?.tries || 1}) — change any mark</p>
          <ul className="space-y-1">
            {answers.map((a, i) => {
              const current = String(i) in marks ? marks[String(i)] : (a.teacherScore ?? null);
              return (
                <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg bg-stone-50 px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <span className="mr-1 rounded bg-white px-1 text-[10px] font-black uppercase text-stone-500">{a.kind}</span>
                    <span className="font-bold text-stone-800">{a.question}</span>
                    {a.kind === 'open' ? (
                      <span className="block text-stone-700">
                        “{a.text || '—'}”
                        {typeof a.aiScore === 'number' && (
                          <span className="text-violet-700">
                            {' '}
                            · AI: {a.aiScore}/2{a.aiReason ? ` — ${a.aiReason}` : ''}
                          </span>
                        )}
                        {a.expected && <span className="block text-stone-500">A good answer: {a.expected}</span>}
                      </span>
                    ) : (
                      <span className={`block ${a.correct ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {a.correct ? 'Right on the first try' : `Right after ${a.tries ?? 2} tries`} · {a.options?.[a.chosen ?? 0]}
                      </span>
                    )}
                  </div>
                  <label className="flex items-center gap-1 font-bold text-stone-600">
                    Mark
                    <select
                      value={current === null ? '' : String(current)}
                      onChange={(e) => setMarks((m) => ({ ...m, [String(i)]: e.target.value === '' ? null : Number(e.target.value) }))}
                      className="rounded border border-stone-200 px-1 py-0.5"
                      aria-label={`Mark for question ${i + 1}`}
                    >
                      <option value="">{a.kind === 'open' ? `AI (${a.aiScore ?? '—'})` : `auto (${answerScore({ ...a, teacherScore: undefined }) ?? '—'})`}</option>
                      {Array.from({ length: a.max + 1 }, (_, n) => (
                        <option key={n} value={n}>
                          {n}/{a.max}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div>
        <p className="mb-1 font-black text-stone-700">✍️ Writing {result.writing?.done ? '(the child says it is written)' : '(not written yet)'} — your marks</p>
        <div className="flex flex-wrap gap-2">
          {WRITING_RUBRIC.map((r) => (
            <label key={r.key} className="flex items-center gap-1 rounded-lg bg-stone-50 px-2 py-1 font-bold text-stone-600">
              {r.label}
              <select
                value={rubric[r.key] ?? ''}
                onChange={(e) => setRubric((x) => ({ ...x, [r.key]: Number(e.target.value) }))}
                className="rounded border border-stone-200 px-1 py-0.5"
                aria-label={r.label}
              >
                <option value="" disabled>
                  —
                </option>
                {Array.from({ length: r.max + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}/{r.max}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for this child's writing (optional)" className="mt-2 w-full rounded-lg border border-stone-200 px-2 py-1" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy} onClick={save} className="btn-3d inline-flex items-center gap-1 bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-60" id="btn-fln-save-marks">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save marks
        </button>
        {msg && <span className="font-black text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
};
