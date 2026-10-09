import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, Mic, MicOff, Plus, Send, Sparkles, Square, Volume2, X } from 'lucide-react';
import { AgentAction, AgentStepEvent, confirmAgentAction, runTeacherAgent, runUiAction } from '../../services/teacherAgent';
import { firebaseAuth } from '../../services/firebase';
import { kidSpeech } from '../../services/speechSynthesis';

// Shakthi Mitra for teachers — an agent, not just a chat: it looks things up
// with tools (each step is shown as it happens), prepares actions the teacher
// confirms (give work, answer a child, move a child's level, unlock chapters)
// and gives buttons to print materials or open a screen. The conversation is
// kept on this device per teacher.

type ActionState = { status: 'waiting' | 'running' | 'done' | 'declined' | 'error'; message?: string };
interface MitraTurn {
  id: string;
  question: string;
  steps: AgentStepEvent[];
  actions: AgentAction[];
  actionState: Record<string, ActionState>;
  answer: string;
  followUps: string[];
  error?: string;
  busy?: boolean;
}

const STARTERS = [
  'What should I do in class today?',
  'Who needs help? Prepare answers for their questions.',
  'Give each reading group practice for its weakest area.',
  "How did my class do this week, and what's next?",
  'Print word cards for our next English chapter.',
];

const STEP_ICON: Record<string, string> = { read: '🔎', action: '📝', ui: '🖨️', answer: '💬', open_screen: '🔗', play_explainer: '🎬' };

/** Small markdown: **bold**, *italic*, `code`; lines stay lines. */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={i}>{part.slice(2, -2)}</b>;
    if (/^`[^`]+`$/.test(part)) return <span key={i}>{part.slice(1, -1)}</span>;
    if (/^\*[^*]+\*$/.test(part)) return <i key={i}>{part.slice(1, -1)}</i>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
const plain = (text: string) => text.replace(/\*\*|`|^- /gm, '').replace(/\*([^*]+)\*/g, '$1');
const storeKey = () => `ps_mitra_agent_${firebaseAuth?.currentUser?.uid || 'me'}`;
const loadTurns = (): MitraTurn[] => {
  try {
    const turns = JSON.parse(localStorage.getItem(storeKey()) || '[]') as MitraTurn[];
    // Suggestions expire on the server; old unconfirmed cards are shown as such.
    return turns.map((t) => ({ ...t, busy: false }));
  } catch {
    return [];
  }
};

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: any) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
const SpeechRecognitionCtor: (new () => SpeechRec) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;

const ActionCard: React.FC<{ action: AgentAction; state: ActionState; onConfirm: () => void; onDecline: () => void }> = ({ action, state, onConfirm, onDecline }) => {
  const ui = action.kind === 'ui';
  return (
    <div
      className={`mitra-action rounded-xl border p-2.5 ${
        state.status === 'done' ? 'border-emerald-300 bg-emerald-50' : state.status === 'declined' ? 'border-stone-200 bg-stone-50 opacity-60' : ui ? 'border-sky-200 bg-sky-50' : 'border-amber-300 bg-amber-50'
      }`}
      data-tool={action.tool}
    >
      <p className="text-xs font-bold text-stone-900">
        {ui ? '' : '📝 '}
        {action.label}
      </p>
      {state.status === 'done' && (
        <p className="mitra-action-done mt-1 flex items-center gap-1 text-[11px] font-black text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> {state.message || 'Done'}
        </p>
      )}
      {state.status === 'error' && <p className="mt-1 text-[11px] font-bold text-rose-700">{state.message}</p>}
      {state.status === 'declined' && <p className="mt-1 text-[11px] text-stone-500">Not done.</p>}
      {(state.status === 'waiting' || state.status === 'running' || state.status === 'error') && (
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={state.status === 'running'}
            className={`mitra-confirm inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[11px] font-black text-white disabled:opacity-60 ${ui ? 'bg-sky-600' : 'bg-emerald-600'}`}
          >
            {state.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
            {ui ? (action.tool === 'open_screen' ? 'Open' : action.tool === 'play_explainer' ? 'Play' : 'Print') : 'Confirm'}
          </button>
          {!ui && (
            <button type="button" onClick={onDecline} className="rounded-lg border border-stone-200 bg-white px-3 py-1 text-[11px] font-bold text-stone-600">
              Not now
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const MitraAgent: React.FC<{ variant?: 'panel' | 'drawer'; onClose?: () => void; contextHint?: string; initialQuestion?: { text: string; n: number } | null }> = ({
  variant = 'panel',
  onClose,
  contextHint,
  initialQuestion,
}) => {
  const [turns, setTurns] = useState<MitraTurn[]>(loadTurns);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.busy);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey(), JSON.stringify(turns.slice(-20)));
    } catch {
      // storage full: the chat simply is not kept
    }
  }, [turns]);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), [turns]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = (id: string, fn: (t: MitraTurn) => MitraTurn) => setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const id = `${Date.now()}`;
    const history = turns
      .slice(-4)
      .flatMap((t) => [
        { role: 'teacher' as const, text: t.question },
        { role: 'mitra' as const, text: [t.answer, ...t.actions.map((a) => `(prepared: ${a.label} — ${t.actionState[a.id]?.status || 'waiting'})`)].join(' ') },
      ]);
    const fullQuestion = contextHint && turns.length === 0 ? `${question}\n(I am looking at: ${contextHint})` : question;
    setTurns((all) => [...all, { id, question, steps: [], actions: [], actionState: {}, answer: '', followUps: [], busy: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runTeacherAgent(
        fullQuestion,
        history,
        (event) => {
          if (event.type === 'step') patch(id, (t) => ({ ...t, steps: [...t.steps.filter((s) => s.n !== event.step.n), event.step] }));
          else if (event.type === 'proposal')
            patch(id, (t) => ({ ...t, actions: [...t.actions, event.action], actionState: { ...t.actionState, [event.action.id]: { status: 'waiting' } } }));
          else if (event.type === 'answer') patch(id, (t) => ({ ...t, answer: event.answer, followUps: event.followUps }));
          else if (event.type === 'error') patch(id, (t) => ({ ...t, error: event.error }));
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') patch(id, (t) => ({ ...t, error: err instanceof Error ? err.message : 'Shakthi Mitra could not answer.' }));
    } finally {
      patch(id, (t) => ({ ...t, busy: false, answer: t.answer || (t.error ? '' : 'Stopped.') }));
      abortRef.current = null;
    }
  };

  // A question handed over from a prompt card elsewhere on the page.
  useEffect(() => {
    if (initialQuestion?.text) void ask(initialQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion?.n]);

  const act = async (turnId: string, action: AgentAction) => {
    patch(turnId, (t) => ({ ...t, actionState: { ...t.actionState, [action.id]: { status: 'running' } } }));
    try {
      const message = action.kind === 'ui' ? await runUiAction(action) : await confirmAgentAction(action.id);
      patch(turnId, (t) => ({ ...t, actionState: { ...t.actionState, [action.id]: { status: action.kind === 'ui' ? 'waiting' : 'done', message } } }));
      if (action.kind === 'ui' && action.tool === 'open_screen' && variant === 'drawer') onClose?.();
    } catch (err) {
      patch(turnId, (t) => ({ ...t, actionState: { ...t.actionState, [action.id]: { status: 'error', message: err instanceof Error ? err.message : 'Could not do that.' } } }));
    }
  };

  const toggleMic = () => {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.onresult = (e: any) => setInput(Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(' '));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const hear = (text: string) => {
    kidSpeech.stop();
    void kidSpeech.speakText(plain(text), 'English').catch(() => undefined);
  };

  const shell =
    variant === 'drawer'
      ? 'flex h-full flex-col bg-gradient-to-b from-violet-50 to-white'
      : 'flex max-h-[640px] min-h-[260px] flex-col rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white';

  return (
    <div id={variant === 'drawer' ? 'mitra-agent-drawer-body' : 'mitra-agent'} className={shell}>
      <div className="flex items-center gap-3 border-b border-violet-100 px-4 py-3">
        <img src="/shakthi-face-256.png" alt="" className="h-11 w-11 rounded-full bg-white object-contain p-0.5 shadow" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-black text-stone-900">
            Shakthi Mitra <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Agent</span>
          </p>
          <p className="text-[11px] text-stone-600">Looks at your classes, plans, and prepares work for you to confirm.</p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={() => !busy && setTurns([])} title="New conversation" className="rounded-lg border border-violet-200 bg-white p-1.5 text-violet-700 disabled:opacity-40" disabled={busy}>
            <Plus className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-stone-200 bg-white p-1.5">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <p className="rounded-2xl bg-white px-3 py-2 text-xs text-stone-700 ring-1 ring-violet-100">
            Namaste! I can check how your children are doing, plan your day, answer children's questions, give work to groups, move children between reading levels and print teaching materials. Ask me anything — I'll show you each step, and nothing changes until you tap <b>Confirm</b>.
          </p>
        )}
        {turns.map((t) => (
          <div key={t.id} className="mitra-turn space-y-2">
            <p className="ml-auto w-fit max-w-[88%] rounded-2xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">{t.question}</p>
            {t.steps.length > 0 && (
              <ol className="mitra-steps space-y-1 border-l-2 border-violet-200 pl-3">
                {t.steps.map((s) => (
                  <li key={s.n} className="mitra-step text-[11px] text-stone-600">
                    <span className="mr-1">{STEP_ICON[s.tool] || STEP_ICON[s.kind] || '•'}</span>
                    <span className="font-bold text-stone-800">{s.summary}</span>
                    {s.thought && <span className="block pl-5 italic text-stone-400">{s.thought}</span>}
                  </li>
                ))}
              </ol>
            )}
            {t.busy && (
              <p className="flex items-center gap-2 text-[11px] font-bold text-violet-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.steps.length ? 'Working…' : 'Thinking…'}
                <button type="button" onClick={() => abortRef.current?.abort()} className="ml-1 inline-flex items-center gap-0.5 rounded border border-violet-200 px-1.5 py-0.5 text-[10px]">
                  <Square className="h-2.5 w-2.5" /> Stop
                </button>
              </p>
            )}
            {t.answer && (
              <div className="mitra-answer relative max-w-[96%] rounded-2xl bg-white px-3 py-2 pr-9 text-xs leading-relaxed text-stone-800 ring-1 ring-violet-100">
                {t.answer.split('\n').map((line, i) =>
                  /^\s*[-•]\s+/.test(line) ? (
                    <p key={i} className="flex gap-1.5 pl-1">
                      <span className="text-violet-500">•</span>
                      <span>{renderInline(line.replace(/^\s*[-•]\s+/, ''))}</span>
                    </p>
                  ) : line.trim() ? (
                    <p key={i}>{renderInline(line)}</p>
                  ) : (
                    <div key={i} className="h-1.5" />
                  )
                )}
                <button type="button" onClick={() => hear(t.answer)} aria-label="Read aloud" className="absolute right-2 top-2 text-violet-600">
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {t.actions.length > 0 && (
              <div className="space-y-1.5">
                {t.actions.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    state={t.actionState[a.id] || { status: 'waiting' }}
                    onConfirm={() => act(t.id, a)}
                    onDecline={() => patch(t.id, (x) => ({ ...x, actionState: { ...x.actionState, [a.id]: { status: 'declined' } } }))}
                  />
                ))}
              </div>
            )}
            {t.error && <p className="text-[11px] font-bold text-rose-700">{t.error}</p>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-violet-100 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(turns.length && turns[turns.length - 1].followUps.length ? turns[turns.length - 1].followUps : turns.length ? [] : STARTERS).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => ask(s)}
              className="mitra-suggestion rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-left text-[11px] font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          {SpeechRecognitionCtor && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? 'Stop listening' : 'Speak your question'}
              className={`rounded-xl border px-2.5 ${listening ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600' : 'border-violet-200 bg-white text-violet-700'}`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <input
            id={variant === 'drawer' ? 'mitra-agent-input-drawer' : 'mitra-agent-input'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={800}
            placeholder="Ask or tell Shakthi Mitra what to do…"
            className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy || input.trim().length < 2} className="inline-flex items-center rounded-xl bg-violet-600 px-3 py-2 text-white disabled:opacity-50" aria-label="Send">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export const MITRA_ASK_EVENT = 'pathana:mitra-ask';
/** Open Shakthi Mitra's drawer, optionally asking a question straight away. */
export function askMitra(question?: string) {
  window.dispatchEvent(new CustomEvent(MITRA_ASK_EVENT, { detail: { question: question || '' } }));
}

/** The floating 🐯 button on every teacher screen, opening Shakthi Mitra in a side drawer. */
export const MitraAgentLauncher: React.FC<{ contextHint?: string }> = ({ contextHint }) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = String((e as CustomEvent<{ question?: string }>).detail?.question || '');
      setOpen(true);
      if (text) setQuestion((q) => ({ text, n: (q?.n || 0) + 1 }));
    };
    window.addEventListener(MITRA_ASK_EVENT, onAsk);
    return () => window.removeEventListener(MITRA_ASK_EVENT, onAsk);
  }, []);
  return (
    <>
      {!open && (
        <motion.button
          type="button"
          id="btn-mitra-agent"
          onClick={() => setOpen(true)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border-2 border-violet-300 bg-white py-1.5 pl-1.5 pr-4 shadow-xl hover:shadow-2xl"
        >
          <img src="/shakthi-face-256.png" alt="" className="h-11 w-11 rounded-full bg-violet-50 object-contain" />
          <span className="text-left">
            <span className="block text-sm font-black text-stone-900">Shakthi Mitra</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-700">
              <Sparkles className="h-3 w-3" /> AI agent
            </span>
          </span>
        </motion.button>
      )}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] flex justify-end bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              id="mitra-agent-drawer"
              role="dialog"
              aria-label="Shakthi Mitra"
              initial={{ x: 40 }}
              animate={{ x: 0 }}
              exit={{ x: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-md shadow-2xl"
            >
              <MitraAgent variant="drawer" onClose={() => setOpen(false)} contextHint={contextHint} initialQuestion={question} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/** A small card on a dashboard screen: starter questions that open Shakthi Mitra and ask. */
export const MitraPromptCard: React.FC<{ suggestions: string[] }> = ({ suggestions }) => (
  <div id="mitra-prompt-card" className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-3">
    <img src="/shakthi-face-256.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5 shadow" />
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-sm font-black text-stone-900">
        Ask Shakthi Mitra <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Agent</span>
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => askMitra(s)} className="mitra-prompt rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-left text-[11px] font-bold text-violet-800 hover:bg-violet-50">
            {s}
          </button>
        ))}
      </div>
    </div>
    <button type="button" onClick={() => askMitra()} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white">
      Open chat
    </button>
  </div>
);
