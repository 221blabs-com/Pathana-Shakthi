import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { backendApi, SupportBoard as SupportBoardData, SupportStatus, SupportStudent, WorkAssignment } from '../../services/backendApi';
import { PublishedReadingSummary } from '../../types';
import { labChaptersFor, subjectsForGrade } from '../../data/learnPlay';
import { LEVEL_INFO } from '../../data/readingLevels';

// Teacher Handbook mapping on the class dashboard:
// 🙋 Need Help / ✅ Go Ahead / ⭐ Very Good → a child → their question and
// work in an overlay → the teacher's answer and/or work to do, sent to the
// child's home screen. Work can also be given to a whole group at once.

const GROUPS: { status: SupportStatus; icon: string; name: string; tone: string; active: string }[] = [
  { status: 'need_help', icon: '🙋', name: 'Need Help', tone: 'border-rose-200 bg-rose-50 text-rose-900', active: 'border-rose-500 bg-rose-500 text-white' },
  { status: 'go_ahead', icon: '✅', name: 'Go Ahead', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900', active: 'border-emerald-600 bg-emerald-600 text-white' },
  { status: 'very_good', icon: '⭐', name: 'Very Good', tone: 'border-amber-200 bg-amber-50 text-amber-900', active: 'border-amber-500 bg-amber-400 text-amber-950' },
];

const QUICK_REPLIES = [
  'Very good question! Read the page again slowly and tap 🔊 on the words you do not know.',
  'Let us read this chapter together in class tomorrow.',
  'Look at the picture first, then read the sentence next to it.',
  'Well done for asking! Try the workbook once more — you can do it.',
];

const FACE = ['😟', '🙂', '😀'];
const ago = (iso?: string) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/** Choose a piece of work: a chapter to read, its workbook, a Learn & Play chapter or word practice. */
export const WorkPicker: React.FC<{ grade: string; value: WorkAssignment | null; onChange: (w: WorkAssignment | null) => void; suggestReadingId?: string }> = ({
  grade,
  value,
  onChange,
  suggestReadingId,
}) => {
  const [readings, setReadings] = useState<PublishedReadingSummary[]>([]);
  const [kind, setKind] = useState<WorkAssignment['kind'] | ''>(value?.kind || '');
  useEffect(() => {
    let cancelled = false;
    backendApi.readings
      .list(grade)
      .then((r) => !cancelled && setReadings(r.readings || []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [grade]);
  const labs = useMemo(() => subjectsForGrade(grade).flatMap((s) => labChaptersFor(s, grade)), [grade]);
  const books = useMemo(() => {
    const map = new Map<string, PublishedReadingSummary[]>();
    for (const r of readings) map.set(r.bookTitle || r.subject, [...(map.get(r.bookTitle || r.subject) || []), r]);
    for (const list of map.values()) list.sort((a, b) => (a.chapterOrder ?? 1e9) - (b.chapterOrder ?? 1e9));
    return [...map.entries()];
  }, [readings]);

  const pickKind = (k: WorkAssignment['kind'] | '') => {
    setKind(k);
    if (!k) return onChange(null);
    if (k === 'dictionary') return onChange({ kind: 'dictionary', id: 'dictionary', title: 'Word practice' });
    if ((k === 'reading' || k === 'workbook') && suggestReadingId) {
      const r = readings.find((x) => x.id === suggestReadingId);
      if (r) return onChange({ kind: k, id: r.id, title: r.chapterTitle });
    }
    onChange(null);
  };

  return (
    <div className="work-picker space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['', '— No work'],
            ['reading', '📘 Read a chapter'],
            ['workbook', '📝 Chapter workbook'],
            ['lab', '🎮 Learn & Play'],
            ['dictionary', '🔤 Word practice'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k || 'none'}
            type="button"
            onClick={() => pickKind(k)}
            className={`work-kind rounded-lg border px-2.5 py-1 text-[11px] font-black ${
              kind === k ? 'border-sky-500 bg-sky-500 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-sky-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {(kind === 'reading' || kind === 'workbook') && (
        <select
          className="work-item w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs"
          value={value?.kind === kind ? value.id : ''}
          onChange={(e) => {
            const r = readings.find((x) => x.id === e.target.value);
            onChange(r ? { kind, id: r.id, title: r.chapterTitle } : null);
          }}
        >
          <option value="">Choose a chapter…</option>
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
      )}
      {kind === 'lab' && (
        <select
          className="work-item w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs"
          value={value?.kind === 'lab' ? value.id : ''}
          onChange={(e) => {
            const c = labs.find((x) => x.id === e.target.value);
            onChange(c ? { kind: 'lab', id: c.id, title: c.title } : null);
          }}
        >
          <option value="">Choose a Learn & Play chapter…</option>
          {labs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.subject} · {c.title}
            </option>
          ))}
        </select>
      )}
      {(kind === 'reading' || kind === 'workbook') && readings.length === 0 && (
        <p className="text-[11px] text-stone-500">No chapters are published for {grade} yet.</p>
      )}
    </div>
  );
};

/** The child's screen over the dashboard: their question, work and the reply box. */
const StudentHelpOverlay: React.FC<{ grade: string; student: SupportStudent; onClose: () => void; onSent: () => void }> = ({ grade, student, onClose, onSent }) => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [text, setText] = useState('');
  const question = student.questions[questionIndex];
  const unit = (question && student.units.find((u) => u.readingId === question.readingId)) || student.latestUnit;
  const [work, setWork] = useState<WorkAssignment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setSending(true);
    setError('');
    try {
      await backendApi.support.reply(grade, student.id, {
        text: text.trim(),
        readingId: question?.readingId,
        chapterTitle: question?.chapterTitle,
        assign: work,
      });
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const level = LEVEL_INFO[student.readingLevel || 'developing'];
  return (
    <motion.div className="fixed inset-0 z-[85] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        id="student-help-overlay"
        role="dialog"
        aria-label={`Help ${student.name}`}
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-stone-50 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <span className="text-3xl">{student.avatar}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-stone-900">{student.name}</p>
            <p className="text-[11px] text-stone-500">
              {grade} · Roll {student.rollNumber} · {level.icon} {level.name} · {student.sessionsCount ? `${student.overallAccuracy}% correct, ${student.averageWPM} words/min` : 'no readings yet'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl border border-stone-200 bg-white p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {student.reasons.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {student.reasons.map((r) => (
                <li key={r} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 ring-1 ring-stone-200">
                  {r}
                </li>
              ))}
            </ul>
          )}

          {student.questions.length > 0 && (
            <div className="rounded-2xl border-2 border-rose-200 bg-white p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-rose-700">🙋 {student.name.split(' ')[0]} asked</p>
              <div className="space-y-2">
                {student.questions.map((q, i) => (
                  <button
                    key={q.readingId}
                    type="button"
                    onClick={() => setQuestionIndex(i)}
                    className={`help-question block w-full rounded-xl px-3 py-2 text-left ${i === questionIndex ? 'bg-rose-50 ring-2 ring-rose-300' : 'bg-stone-50'}`}
                  >
                    <span className="block text-sm font-bold text-stone-900">{q.question ? `“${q.question}”` : 'Needs help with this chapter (no question typed)'}</span>
                    <span className="text-[11px] text-stone-500">
                      📘 {q.chapterTitle || 'Chapter'} · {ago(q.at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {unit && (
            <div className="rounded-2xl border border-stone-200 bg-white p-3" id="help-unit">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-stone-600">📝 Workbook · {unit.chapterTitle}</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-stone-50 p-2">
                  <p className="text-stone-500">Blanks</p>
                  <p className="font-black text-stone-900">{unit.blanksTotal ? `${unit.blanksCorrect}/${unit.blanksTotal} first try` : '—'}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-2">
                  <p className="text-stone-500">Answers known</p>
                  <p className="font-black text-stone-900">{unit.questionsTotal ? `${unit.questionsKnown}/${unit.questionsTotal}` : '—'}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-2">
                  <p className="text-stone-500">I can…</p>
                  <p className="text-lg leading-none">{(unit.outcomes || []).map((o, i) => <span key={i}>{FACE[o] || '·'}</span>)}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-2">
                  <p className="text-stone-500">Felt</p>
                  <p className="font-black text-stone-900">{unit.reflection?.feeling ? { easy: '😀 easy', ok: '🙂 okay', hard: '😟 hard' }[unit.reflection.feeling] : '—'}</p>
                </div>
              </div>
              {unit.reflection?.note && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">✍️ “{unit.reflection.note}”</p>}
              {unit.teacherReply && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  ✓ Answered {ago(unit.teacherReply.at)}: “{unit.teacherReply.text}”
                </p>
              )}
            </div>
          )}

          {student.struggledWords.length > 0 && (
            <p className="text-xs text-stone-600">
              Hard words while reading: <b>{student.struggledWords.join(', ')}</b>
            </p>
          )}

          {student.messages.length > 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-3">
              <p className="mb-1 text-xs font-black uppercase tracking-wide text-stone-600">💬 Sent before</p>
              {student.messages.map((m) => (
                <p key={m.id} className="border-t border-stone-100 py-1.5 text-xs text-stone-700 first:border-t-0">
                  {m.text || '(work only)'} {m.assign && <span className="font-bold text-sky-700">· {m.assign.title}</span>}{' '}
                  <span className="text-stone-400">
                    · {ago(m.createdAt)} · {m.seenAt ? 'seen ✓' : 'not seen yet'}
                  </span>
                </p>
              ))}
            </div>
          )}

          <div className="rounded-2xl border-2 border-sky-200 bg-white p-3" id="help-reply">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-sky-800">Your answer / guidance</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="quick-reply rounded-lg bg-sky-50 px-2 py-1 text-left text-[11px] font-bold text-sky-800 hover:bg-sky-100">
                  {q.length > 48 ? `${q.slice(0, 46)}…` : q}
                </button>
              ))}
            </div>
            <textarea
              id="help-reply-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Write a short, simple answer. The child hears it read aloud."
              className="w-full rounded-xl border border-stone-200 p-2 text-sm"
            />
            <p className="mb-1 mt-2 text-[11px] font-black text-stone-600">Give practice (optional)</p>
            <WorkPicker grade={grade} value={work} onChange={setWork} suggestReadingId={question?.readingId} />
            {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3">
          {sent ? (
            <p className="flex items-center gap-2 text-sm font-black text-emerald-700" id="help-sent">
              <CheckCircle2 className="h-5 w-5" /> Sent to {student.name.split(' ')[0]}'s home screen
            </p>
          ) : (
            <button
              type="button"
              id="btn-help-send"
              disabled={sending || (!text.trim() && !work)}
              onClick={send}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to {student.name.split(' ')[0]}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/** Give the same work to several children (a group, or the ones ticked). */
export const AssignWorkModal: React.FC<{
  grade: string;
  title: string;
  students: { id: string; name: string; avatar: string }[];
  onClose: () => void;
  initialWork?: WorkAssignment | null;
  initialText?: string;
}> = ({ grade, title, students, onClose, initialWork = null, initialText = '' }) => {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(students.map((s) => s.id)));
  const [work, setWork] = useState<WorkAssignment | null>(initialWork);
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const send = async () => {
    setState('sending');
    setError('');
    try {
      const res = await backendApi.support.assign(grade, { studentIds: [...picked], text: text.trim(), assign: work });
      setState('sent');
      setError(`Sent to ${res.sent} ${res.sent === 1 ? 'child' : 'children'}.`);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not send.');
    }
  };
  return (
    <motion.div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        id="assign-work-modal"
        role="dialog"
        aria-label="Give work"
        initial={{ y: 30 }}
        animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-black text-stone-900">📌 Give work · {title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl border border-stone-200 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPicked((p) => {
                const next = new Set(p);
                if (next.has(s.id)) next.delete(s.id);
                else next.add(s.id);
                return next;
              })}
              className={`assign-child rounded-full border px-2 py-0.5 text-[11px] font-bold ${picked.has(s.id) ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-stone-200 text-stone-400 line-through'}`}
            >
              {s.avatar} {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <WorkPicker grade={grade} value={work} onChange={setWork} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="A short note (optional) — read aloud to each child"
          className="mt-2 w-full rounded-xl border border-stone-200 p-2 text-sm"
        />
        {error && <p className={`mt-1 text-xs font-bold ${state === 'sent' ? 'text-emerald-700' : 'text-rose-700'}`}>{error}</p>}
        <div className="mt-3 flex justify-end">
          {state === 'sent' ? (
            <button type="button" onClick={onClose} className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white">
              Done
            </button>
          ) : (
            <button
              type="button"
              id="btn-assign-send"
              disabled={state === 'sending' || picked.size === 0 || (!work && !text.trim())}
              onClick={send}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Give to {picked.size}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/** The progress board at the top of the class dashboard. */
export const SupportBoard: React.FC<{ grade: string }> = ({ grade }) => {
  const [data, setData] = useState<SupportBoardData | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [open, setOpen] = useState<SupportStudent | null>(null);
  const [assigning, setAssigning] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const d = await backendApi.support.board(grade);
      setData(d);
      setStatus((s) => s ?? (d.groups.need_help.length ? 'need_help' : 'go_ahead'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the class.');
    }
  }, [grade]);
  useEffect(() => {
    setData(null);
    setStatus(null);
    void load();
  }, [load]);

  const list = data && status ? data.groups[status] : [];
  const group = GROUPS.find((g) => g.status === status);
  return (
    <div id="support-board" className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-stone-900">Progress · who needs what today</h3>
          <p className="text-[11px] text-stone-500">From reading, workbooks and the children's own "I need help" requests.</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:text-stone-800">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 py-3 text-xs text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {GROUPS.map((g) => {
              const n = data.groups[g.status].length;
              const questions = data.groups[g.status].reduce((k, s) => k + s.questions.length, 0);
              return (
                <button
                  key={g.status}
                  type="button"
                  id={`support-${g.status}`}
                  onClick={() => setStatus(g.status)}
                  aria-pressed={status === g.status}
                  className={`support-group rounded-2xl border-2 px-2 py-3 text-center transition ${status === g.status ? g.active : g.tone}`}
                >
                  <span className="block text-2xl" aria-hidden>
                    {g.icon}
                  </span>
                  <span className="block text-sm font-black">{g.name}</span>
                  <span className="block text-[11px] font-bold opacity-80">
                    {n} {n === 1 ? 'child' : 'children'}
                    {questions > 0 ? ` · ${questions} question${questions === 1 ? '' : 's'}` : ''}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            {list.length === 0 ? (
              <p className="py-3 text-center text-xs text-stone-500">Nobody in this group right now.</p>
            ) : (
              <>
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    id="btn-assign-group"
                    onClick={() => setAssigning(true)}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-800 hover:bg-sky-100"
                  >
                    📌 Give work to this group
                  </button>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(s)}
                        className="support-student flex w-full items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-left hover:border-sky-300 hover:bg-white"
                      >
                        <span className="text-2xl">{s.avatar}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-stone-900">
                            {s.name} <span className="text-[11px] font-bold text-stone-400">#{s.rollNumber}</span>
                          </span>
                          {s.questions[0] && (
                            <span className="mt-0.5 block rounded-lg bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-900">
                              🙋 {s.questions[0].question ? `“${s.questions[0].question}”` : `Help with ${s.questions[0].chapterTitle}`}
                            </span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-stone-600">{s.reasons.slice(0, 2).join(' · ')}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {open && <StudentHelpOverlay key={open.id} grade={grade} student={open} onClose={() => setOpen(null)} onSent={load} />}
        {assigning && group && (
          <AssignWorkModal key="assign" grade={grade} title={`${group.icon} ${group.name}`} students={list} onClose={() => setAssigning(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
