import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Send, Sparkles, Volume2, X } from 'lucide-react';
import { Language } from '../types';
import { backendApi } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';

export type TutorContext = {
  kind: 'reading' | 'word' | 'lesson' | 'chapter' | 'home';
  title?: string;
  text?: string;
  word?: string;
  language?: Language;
};

type Turn = { from: 'child' | 'mitra'; text: string };

const scriptOf = (t: string): Language => (/[ఀ-౿]/.test(t) ? 'Telugu' : /[ऀ-ॿ]/.test(t) ? 'Hindi' : 'English');

// The longest few words on screen: the ones worth asking about.
function hardestWords(text = '', n = 2): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:"'“”‘’()।॥—–-]+/g, ''))
    .filter((w) => w.length > 3);
  return Array.from(new Set(words)).sort((a, b) => b.length - a.length).slice(0, n);
}

function suggestionsFor(ctx: TutorContext): string[] {
  if (ctx.kind === 'word' && ctx.word) {
    return [`What does "${ctx.word}" mean?`, `Use "${ctx.word}" in a sentence`, `How do I say "${ctx.word}"?`];
  }
  const [a, b] = hardestWords(ctx.text);
  if (ctx.kind === 'reading') {
    return [
      'Explain this page simply',
      ...(a ? [`What does "${a}" mean?`] : []),
      ...(b ? [`Help me say "${b}"`] : []),
      'Quiz me on this page',
    ];
  }
  if (ctx.kind === 'chapter') {
    return ['Explain this chapter simply', 'What are the key ideas?', 'Give me an example', 'Quiz me on this chapter'];
  }
  if (ctx.kind === 'lesson') {
    return ['Explain this card', 'Give me another example', ...(a ? [`What does "${a}" mean?`] : []), 'Quiz me on this'];
  }
  return ['Give me a new word to learn', 'Tell me a fun fact', 'How can I read better?'];
}

// "Ask Shakthi Mitra": the AI tutor, one tap away on the reader, Learn & Play
// and the dictionary. Suggested questions come from what is on screen, so a
// child who can't type yet can still ask; every answer is read aloud.
export const AskMitra: React.FC<{ context: TutorContext; className?: string; openSignal?: number }> = ({ context, className = '', openSignal = 0 }) => {
  const [open, setOpen] = useState(false);
  // A page can open the tutor itself (e.g. "Ask Mitra" next to a syllabus chapter).
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => suggestionsFor(context), [context.kind, context.text, context.word]);

  // A new page / card / word starts a fresh conversation.
  useEffect(() => {
    setTurns([]);
    setFollowUps([]);
  }, [context.kind, context.text, context.word]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const speak = (text: string) => {
    kidSpeech.stop();
    void kidSpeech.speakText(text, scriptOf(text)).catch(() => undefined);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    soundEffects.playWordPop();
    setInput('');
    setTurns((t) => [...t, { from: 'child', text: q }]);
    setFollowUps([]);
    setBusy(true);
    try {
      const reply = await backendApi.tutor.ask({
        question: q,
        context: {
          kind: context.kind,
          title: context.title,
          text: context.text?.slice(0, 2500),
          word: context.word,
          language: context.language,
        },
      });
      setTurns((t) => [...t, { from: 'mitra', text: reply.answer }]);
      setFollowUps(reply.followUps || []);
      speak(reply.answer);
    } catch (err) {
      setTurns((t) => [
        ...t,
        { from: 'mitra', text: err instanceof Error ? err.message : 'Oops! Please ask me again.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const chips = turns.length ? followUps : suggestions;

  return (
    <>
      <motion.button
        id="btn-ask-mitra"
        type="button"
        onClick={() => {
          soundEffects.playWordPop();
          setOpen(true);
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-24 right-3 z-[60] flex items-center gap-2 rounded-full border-2 border-amber-300 bg-white p-1 shadow-xl sm:bottom-6 sm:right-4 sm:py-1.5 sm:pl-1.5 sm:pr-4 ${className}`}
        aria-label="Ask Shakthi Mitra"
      >
        <img src="/shakthi-face-256.png" alt="" className="h-11 w-11 rounded-full bg-amber-50 object-contain sm:h-10 sm:w-10" />
        {/* On phones only the round face shows, so it doesn't cover the page. */}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-black text-stone-900">Ask Mitra</span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600">
            <Sparkles className="h-3 w-3" /> AI tutor
          </span>
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              id="ask-mitra-panel"
              role="dialog"
              aria-label="Ask Shakthi Mitra"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center gap-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-violet-50 px-4 py-3">
                <img src="/shakthi-face-256.png" alt="" className="h-12 w-12 rounded-full bg-white object-contain p-0.5 shadow" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black text-stone-900">Ask Shakthi Mitra</p>
                  <p className="flex items-center gap-1 text-[11px] font-bold text-violet-700">
                    <Sparkles className="h-3 w-3" /> Your AI reading tutor
                    {context.title ? <span className="truncate text-stone-500"> · {context.title}</span> : null}
                  </p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-xl border border-stone-200 bg-white p-2">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div ref={listRef} className="min-h-[140px] flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {turns.length === 0 && (
                  <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Hi! I can explain words, help you say them, and ask you fun questions. Tap a question below or type your own.
                  </p>
                )}
                {turns.map((t, i) => (
                  <div key={i} className={`flex ${t.from === 'child' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`ask-mitra-${t.from} max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        t.from === 'child' ? 'bg-sky-500 font-bold text-white' : 'bg-stone-100 font-semibold text-stone-800'
                      }`}
                    >
                      {t.text}
                      {t.from === 'mitra' && (
                        <button type="button" onClick={() => speak(t.text)} aria-label="Hear it again" className="ml-2 inline-flex align-middle text-sky-700">
                          <Volume2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <p className="flex items-center gap-2 text-xs font-bold text-stone-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Mitra is thinking…
                  </p>
                )}
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-stone-100 px-4 pt-3">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => void ask(c)}
                      className="ask-mitra-chip rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="flex items-center gap-2 px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(input);
                }}
              >
                <input
                  id="ask-mitra-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 300))}
                  placeholder="Type your question…"
                  className="min-w-0 flex-1 rounded-2xl border-2 border-stone-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Ask" className="btn-3d bg-violet-500 p-2.5 text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
