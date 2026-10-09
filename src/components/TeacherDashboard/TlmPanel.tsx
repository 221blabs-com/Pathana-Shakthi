import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { backendApi } from '../../services/backendApi';
import { PublishedReadingSummary } from '../../types';
import { printHtml, workbookHtml } from '../../services/printWorkbook';
import {
  alphabetChartHtml,
  chapterReaderHtml,
  clockFaceHtml,
  factCardsHtml,
  hundredChartHtml,
  numberCardsHtml,
  questionCardsHtml,
  readingCardsHtml,
  wordCardsHtml,
} from '../../services/tlm';
import { mathsLimitForGrade } from '../../data/learnPlay';
import { ALL_GRADES } from '../../data/grades';
import { LEVEL_INFO } from '../../data/readingLevels';
import { wordsPerPageForGrade } from '../../services/publishedReadingToStory';

// Printable Teaching-Learning Materials: from any published chapter of the
// class (the chapter as a big-print reader, word cards, reading cards per
// reading level, question cards, the workbook as a worksheet with or without
// answers) and a foundational kit (numbers, maths facts, clock, alphabets).

const gradeNum = (g: string) => Number(String(g).replace(/\D+/g, '')) || 1;

const Btn: React.FC<{ onClick: () => void; busy?: boolean; children: React.ReactNode; id?: string }> = ({ onClick, busy, children, id }) => (
  <button
    type="button"
    id={id}
    onClick={onClick}
    disabled={busy}
    className="tlm-button inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-800 shadow-xs hover:border-sky-300 disabled:opacity-60"
  >
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 text-stone-500" />}
    {children}
  </button>
);

export const TlmPanel: React.FC<{ grade: string; onSelectGrade: (g: string) => void }> = ({ grade, onSelectGrade }) => {
  const [readings, setReadings] = useState<PublishedReadingSummary[]>([]);
  const [readingId, setReadingId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setReadings([]);
    setReadingId('');
    backendApi.readings
      .list(grade)
      .then((r) => {
        if (cancelled) return;
        const list = (r.readings || []).sort((a, b) => (a.bookTitle || '').localeCompare(b.bookTitle || '') || (a.chapterOrder ?? 1e9) - (b.chapterOrder ?? 1e9));
        setReadings(list);
        setReadingId(list[0]?.id || '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [grade]);

  const books = useMemo(() => {
    const map = new Map<string, PublishedReadingSummary[]>();
    for (const r of readings) map.set(r.bookTitle || r.subject, [...(map.get(r.bookTitle || r.subject) || []), r]);
    return [...map.entries()];
  }, [readings]);
  const chosen = readings.find((r) => r.id === readingId);

  const run = async (key: string, make: () => Promise<string>) => {
    setBusy(key);
    setError('');
    try {
      printHtml(await make());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make this material.');
    } finally {
      setBusy('');
    }
  };
  const reading = () => backendApi.readings.get(readingId).then((r) => r.reading);
  const n = gradeNum(grade);
  const limit = mathsLimitForGrade(grade);
  const base = wordsPerPageForGrade(grade);

  return (
    <section id="tlm-panel" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4">
        <h2 className="text-xl font-black text-stone-900">🖨️ Teaching materials (TLM)</h2>
        <p className="text-xs text-stone-600">Print cards, charts and worksheets for your classroom — made from your class's own chapters.</p>
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
      </div>
      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-black text-stone-900">📘 From a chapter</h3>
        {readings.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">No chapters are published for {grade} yet — upload a textbook first.</p>
        ) : (
          <>
            <select
              id="tlm-chapter"
              value={readingId}
              onChange={(e) => setReadingId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm sm:w-auto"
            >
              {books.map(([book, list]) => (
                <optgroup key={book} label={book}>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.chapterTitle}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {chosen && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn id="tlm-reader" busy={busy === 'reader'} onClick={() => run('reader', async () => {
                  const r = await reading();
                  return chapterReaderHtml(r.chapterTitle, r.paragraphs, `${r.bookTitle} · ${grade}`);
                })}>
                  📖 Chapter (big print)
                </Btn>
                <Btn id="tlm-words" busy={busy === 'words'} onClick={() => run('words', async () => {
                  const r = await reading();
                  if (!r.keyVocabulary?.length) throw new Error('This chapter has no word list yet.');
                  return wordCardsHtml(r.chapterTitle, r.keyVocabulary);
                })}>
                  🃏 Word cards
                </Btn>
                {(['beginner', 'developing', 'proficient'] as const).map((level) => (
                  <Btn key={level} busy={busy === `cards-${level}`} onClick={() => run(`cards-${level}`, async () => {
                    const r = await reading();
                    const words = Math.max(6, Math.round(base * (level === 'beginner' ? 0.6 : level === 'proficient' ? 1.4 : 1)));
                    return readingCardsHtml(`${r.chapterTitle} · ${LEVEL_INFO[level].name}`, r.paragraphs, words);
                  })}>
                    {LEVEL_INFO[level].icon} Reading cards · {LEVEL_INFO[level].name}
                  </Btn>
                ))}
                <Btn busy={busy === 'questions'} onClick={() => run('questions', async () => {
                  const r = await reading();
                  const qs = (r.comprehensionQuiz || []).map((q) => ({ question: q.question, options: q.options }));
                  if (!qs.length) throw new Error('This chapter has no questions yet ("Fix questions" in Published books).');
                  return questionCardsHtml(r.chapterTitle, qs);
                })}>
                  ❓ Question cards
                </Btn>
                <Btn id="tlm-worksheet" busy={busy === 'worksheet'} onClick={() => run('worksheet', async () => {
                  const { workbook } = await backendApi.readings.workbook(readingId);
                  return workbookHtml(chosen.chapterTitle, workbook, { className: grade });
                })}>
                  📝 Worksheet
                </Btn>
                <Btn busy={busy === 'answers'} onClick={() => run('answers', async () => {
                  const { workbook } = await backendApi.readings.workbook(readingId);
                  return workbookHtml(`${chosen.chapterTitle} · answer key`, workbook, { className: grade, withAnswers: true });
                })}>
                  🔑 Worksheet with answers
                </Btn>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-black text-stone-900">🔢 Foundational kit (FLN)</h3>
        <p className="text-[11px] text-stone-500">Numbers and facts are sized for {grade} (sums up to {limit}).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => run('n0', async () => numberCardsHtml(0, 10))}>🔟 Number cards 0-10</Btn>
          <Btn onClick={() => run('n11', async () => numberCardsHtml(11, 20))}>Number cards 11-20</Btn>
          <Btn id="tlm-hundred" onClick={() => run('h', async () => hundredChartHtml())}>💯 1-100 chart</Btn>
          <Btn onClick={() => run('add', async () => factCardsHtml('+', limit))}>➕ Addition cards</Btn>
          <Btn onClick={() => run('sub', async () => factCardsHtml('-', limit))}>➖ Subtraction cards</Btn>
          {n >= 3 && <Btn onClick={() => run('mul', async () => factCardsHtml('×', 10))}>✖️ Times-table cards</Btn>}
          <Btn onClick={() => run('clock', async () => clockFaceHtml())}>🕒 Clock face</Btn>
          <Btn onClick={() => run('en', async () => alphabetChartHtml('English'))}>🔤 English alphabet</Btn>
          <Btn id="tlm-telugu" onClick={() => run('te', async () => alphabetChartHtml('Telugu'))}>అ Telugu అక్షరమాల</Btn>
          <Btn onClick={() => run('hi', async () => alphabetChartHtml('Hindi'))}>अ Hindi वर्णमाला</Btn>
        </div>
      </div>
    </section>
  );
};
