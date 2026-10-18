import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { t, UI_LANG_INFO, UI_LANGS, UiLang } from '../../data/uiStrings';
import { say } from '../../services/kidPrefs';

// Small pieces of easy mode: a 🔊 button that says a label, Shakthi Mitra
// saying what to do on a screen (once when it opens, again on a tap), and
// the three-language switch. Labels are spoken in the child's language.

/** A round 🔊 button that says `text` (never opens what it sits on). */
export const SayButton: React.FC<{ text: string; lang: UiLang; className?: string; label?: string }> = ({ text, lang, className = '', label }) => {
  const [talking, setTalking] = useState(false);
  return (
    <button
      type="button"
      aria-label={label || `Hear: ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        setTalking(true);
        say(text, lang, () => setTalking(false));
        window.setTimeout(() => setTalking(false), 6000);
      }}
      className={`say-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-base shadow ring-1 ring-stone-200 transition-transform active:scale-90 ${
        talking ? 'animate-pulse ring-2 ring-sky-400' : ''
      } ${className}`}
    >
      🔊
    </button>
  );
};

const lastSpoken = new Map<string, number>();

/**
 * Say a screen's instruction once when it opens (not again within 90 s, so
 * going back and forth doesn't repeat it); `delay` lets a tapped label finish.
 */
export function useVoiceGuide(key: string, text: string, lang: UiLang, enabled: boolean, delay = 1200) {
  useEffect(() => {
    if (!enabled || !text) return;
    const id = `${key}:${lang}`;
    if (Date.now() - (lastSpoken.get(id) || 0) < 90_000) return;
    const timer = window.setTimeout(() => {
      lastSpoken.set(id, Date.now());
      say(text, lang);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [key, text, lang, enabled, delay]);
}

/** Shakthi Mitra with what to do here; tap to hear it again. */
export const MitraSays: React.FC<{ text: string; lang: UiLang; title?: string; id?: string }> = ({ text, lang, title, id }) => {
  const [talking, setTalking] = useState(false);
  const timer = useRef<number | null>(null);
  const speak = () => {
    setTalking(true);
    say(text, lang, () => setTalking(false));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTalking(false), 8000);
  };
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  return (
    <button
      type="button"
      id={id}
      onClick={speak}
      className="mitra-says flex w-full items-center gap-3 rounded-3xl border-2 border-amber-200 bg-amber-50 p-3 text-left active:scale-[0.99]"
    >
      <motion.img
        src="/shakthi-face-256.png"
        alt=""
        animate={talking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ repeat: talking ? Infinity : 0, duration: 0.6 }}
        className="h-14 w-14 shrink-0 rounded-full bg-white object-contain p-0.5 shadow"
      />
      <span className="min-w-0 flex-1">
        {title && <span className="block text-lg font-black leading-tight text-stone-900">{title}</span>}
        <span className="block text-sm font-bold text-amber-900">{text}</span>
      </span>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow ${talking ? 'animate-pulse' : ''}`} aria-label={t(lang, 'sayAgain')}>
        🔊
      </span>
    </button>
  );
};

/** English / తెలుగు / हिंदी — each button in its own script, so no reading of English is needed. */
export const LanguageSwitch: React.FC<{ lang: UiLang; onChange: (lang: UiLang) => void; dark?: boolean; id?: string }> = ({ lang, onChange, dark, id }) => (
  <div id={id} role="radiogroup" aria-label={t(lang, 'language')} className="ui-language-switch flex gap-1.5">
    {UI_LANGS.map((l) => {
      const active = l === lang;
      return (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={active}
          data-lang={l}
          onClick={() => onChange(l)}
          className={`flex min-w-[52px] flex-col items-center rounded-2xl border-2 px-2 py-1 transition-all active:scale-95 ${
            active
              ? 'border-amber-400 bg-amber-400 text-amber-950 shadow'
              : dark
                ? 'border-white/15 bg-white/5 text-white hover:border-amber-300'
                : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300'
          }`}
        >
          <span className="text-lg font-black leading-none">{UI_LANG_INFO[l].letter}</span>
          <span className="text-[10px] font-black leading-tight">{UI_LANG_INFO[l].name}</span>
        </button>
      );
    })}
  </div>
);
