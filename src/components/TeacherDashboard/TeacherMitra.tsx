import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { backendApi } from '../../services/backendApi';

// "Ask Shakthi Mitra" for teachers, inside the dashboard: answers from the
// class's own data (levels, reading, support groups, competencies, chapters).

const STARTERS = [
  'Who needs my help most today, and what should I do with each?',
  'Plan a 40-minute lesson for my three reading-level groups.',
  'Give me a classroom activity for the weakest competency.',
  'How do I help children who cannot read yet?',
];

export const TeacherMitra: React.FC<{ grades: string[]; defaultGrade: string }> = ({ grades, defaultGrade }) => {
  const options = grades.length ? grades : [defaultGrade];
  const [grade, setGrade] = useState(options.includes(defaultGrade) ? defaultGrade : options[0]);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<{ q: string; a: string }[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!options.includes(grade)) setGrade(options.includes(defaultGrade) ? defaultGrade : options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join(','), defaultGrade]);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest' }), [turns.length]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setQuestion('');
    try {
      const res = await backendApi.support.ask(grade, text, turns.slice(-3));
      setTurns((t) => [...t, { q: text, a: res.answer }]);
      setFollowUps(res.followUps);
    } catch (err) {
      setQuestion(text);
      setError(err instanceof Error ? err.message : 'Could not answer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="teacher-mitra" className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <img src="/shakthi-face-256.png" alt="" className="h-11 w-11 rounded-full bg-white object-contain p-0.5 shadow" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-black text-stone-900">
            Ask Shakthi Mitra <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </p>
          <p className="text-[11px] text-stone-600">Your AI teaching assistant — it knows your class's levels, reading, questions and competencies.</p>
        </div>
        {options.length > 1 && (
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setTurns([]);
              setFollowUps([]);
            }}
            className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-bold"
            aria-label="Class"
          >
            {options.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        )}
      </div>

      {turns.length > 0 && (
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {turns.map((t, i) => (
            <div key={i} className="space-y-1.5">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">{t.q}</p>
              <div className="teacher-mitra-answer max-w-[95%] whitespace-pre-line rounded-2xl bg-white px-3 py-2 text-xs leading-relaxed text-stone-800 ring-1 ring-violet-100">{t.a}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(turns.length ? followUps : STARTERS).map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => ask(s)}
            className="teacher-mitra-suggestion rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-left text-[11px] font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          id="teacher-mitra-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={`Ask about ${grade}…`}
          className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy || question.trim().length < 3} className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {busy && <p className="mt-1 text-[11px] font-bold text-violet-700">Shakthi Mitra is looking at your class…</p>}
      {error && <p className="mt-1 text-[11px] font-bold text-rose-700">{error}</p>}
    </div>
  );
};
