import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Language } from '../../types';
import { speechRecognition, SpeechMatchResult } from '../../services/speechRecognition';
import { kidSpeech } from '../../services/speechSynthesis';
import { soundEffects } from '../../services/soundEffects';

export const PASS_ACCURACY = 60;

const clean = (word: string) => word.replace(/[.,!?;:"'“”‘’()।॥—–-]+/g, '').trim();

// Text a child listens to and then says aloud. Every word can be tapped to
// hear it slowly; the microphone scores the attempt word by word. `onUnlock`
// fires once the child passes (PASS_ACCURACY) or has tried twice, so a hard
// line or a broken microphone never traps them.
export const SayIt: React.FC<{
  text: string;
  language: Language;
  onUnlock?: (passed: boolean, accuracy: number) => void;
  onMascot?: (message: string, mood?: 'happy' | 'cheer' | 'think' | 'sad') => void;
  size?: 'md' | 'lg';
  id?: string;
}> = ({ text, language, onUnlock, onMascot, size = 'lg', id }) => {
  const words = text.split(/\s+/).filter(Boolean);
  const [statuses, setStatuses] = useState<Array<'pending' | 'correct' | 'wrong'>>([]);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const attempts = useRef(0);
  const unlocked = useRef(false);

  useEffect(() => {
    // Every word here can be tapped: have its slow clip ready.
    kidSpeech.prefetch(text, language);
    kidSpeech.prefetchWords(text, language);
  }, [text, language]);

  useEffect(() => {
    setStatuses([]);
    setResult(null);
    setMessage('');
    attempts.current = 0;
    unlocked.current = false;
    return () => speechRecognition.cancel(false);
  }, [text]);

  const unlock = (passed: boolean, accuracy: number) => {
    if (unlocked.current) return;
    unlocked.current = true;
    onUnlock?.(passed, accuracy);
  };

  const finishAttempt = (accuracy: number | null, error?: string) => {
    attempts.current += 1;
    if (accuracy !== null && accuracy >= PASS_ACCURACY) {
      soundEffects.playCorrect();
      setMessage(`Great! ${accuracy}% ⭐`);
      onMascot?.('Wonderful reading! ⭐', 'cheer');
      unlock(true, accuracy);
      return;
    }
    soundEffects.playTryAgain();
    const hint = error || (accuracy !== null ? `${accuracy}% — tap the red words to hear them slowly, then try again!` : 'Try again!');
    setMessage(hint);
    onMascot?.(accuracy !== null ? 'Listen to the red words and say it again!' : 'Let us try once more!', 'think');
    if (attempts.current >= 2) unlock(false, accuracy ?? 0);
  };

  const start = () => {
    if (phase === 'processing') return;
    if (phase === 'recording') {
      speechRecognition.stopListening();
      return;
    }
    kidSpeech.stop();
    setMessage('');
    setStatuses([]);
    onMascot?.('I am listening… say it!', 'happy');
    void speechRecognition.startListening(
      language,
      text,
      (res: SpeechMatchResult) => {
        setStatuses(res.wordStatuses);
        if (!res.isComplete) return;
        const accuracy = Math.round(res.accuracy);
        setResult(accuracy);
        finishAttempt(accuracy);
      },
      (err) => {
        setPhase('idle');
        finishAttempt(null, err || 'The microphone could not hear you. Try again!');
      },
      undefined,
      {
        maxDurationMs: 20000,
        silenceTimeoutMs: 3500,
        interimIntervalMs: 4000,
        stopWhenAllMatched: true,
        onPhase: (p) => setPhase(p),
      }
    );
  };

  const big = size === 'lg';
  return (
    <div id={id}>
      <div className="flex flex-wrap gap-2">
        {words.map((word, i) => {
          const status = statuses[i];
          return (
            <motion.button
              key={`${word}-${i}`}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                soundEffects.playWordPop();
                kidSpeech.speakSlowWord(clean(word) || word, language);
              }}
              title="Tap to hear it slowly"
              className={`say-word rounded-2xl border-2 px-2.5 py-1 font-black transition-colors ${
                big ? 'text-xl sm:text-3xl' : 'text-lg sm:text-2xl'
              } ${
                status === 'correct'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : status === 'wrong'
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-transparent bg-stone-50 text-stone-800 hover:border-amber-300 hover:bg-amber-50'
              }`}
            >
              {word}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            soundEffects.playWordPop();
            void kidSpeech.speakText(text, language).catch(() => undefined);
          }}
          className="btn-3d inline-flex items-center gap-2 border-2 border-stone-200 bg-white px-4 py-2.5 text-base text-stone-800"
        >
          <Volume2 className="h-5 w-5 text-sky-600" /> Listen
        </button>
        <button
          type="button"
          onClick={start}
          disabled={phase === 'processing'}
          className={`btn-say-it btn-3d inline-flex items-center gap-2 px-4 py-2.5 text-base text-white ${
            phase === 'recording' ? 'bg-rose-500' : 'bg-violet-500'
          }`}
        >
          {phase === 'recording' ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {phase === 'recording' ? 'Listening… tap to stop' : phase === 'processing' ? 'Checking…' : result !== null ? 'Say it again' : 'Say it'}
        </button>
        {message && (
          <span role="status" className={`text-sm font-black ${result !== null && result >= PASS_ACCURACY ? 'text-emerald-600' : 'text-amber-700'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
};
