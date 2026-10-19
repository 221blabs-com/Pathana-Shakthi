import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Eraser, Play, Volume2 } from 'lucide-react';
import {
  ChoiceRound,
  EnglishUnit,
  MissingLetterRound,
  PictureWord,
  beginningSoundRounds,
  missingLetterRounds,
  sightWordRounds,
} from '../../data/class1English';
import { kidSpeech } from '../../services/speechSynthesis';
import { soundEffects } from '../../services/soundEffects';
import { ChunkyButton, Feedback, RoundDots } from '../learnplay/ui';
import { SayIt } from '../learnplay/SayIt';

type Mascot = (text: string, mood?: 'happy' | 'cheer' | 'think' | 'sad') => void;

/** Speak and wait until the clip ends (or a word-count timeout, so a silent device never hangs). */
export function speakAndWait(text: string): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, 2500 + text.split(/\s+/).length * 650);
    void kidSpeech.speakText(text, 'English', { onEnd: finish, onError: finish }).catch(finish);
  });
}

const say = (text: string) => {
  void kidSpeech.speakText(text, 'English').catch(() => undefined);
};
const sayWord = (word: string) => {
  soundEffects.playWordPop();
  kidSpeech.speakSlowWord(word, 'English');
};

const PictureTile: React.FC<{ item: PictureWord; onTap: () => void; state?: 'seen' | 'right' | 'wrong' | 'idle'; showWord?: boolean; size?: 'md' | 'lg' }> = ({
  item,
  onTap,
  state = 'idle',
  showWord = true,
  size = 'md',
}) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.9 }}
    animate={state === 'wrong' ? { x: [0, -8, 8, -5, 0] } : state === 'right' ? { scale: [1, 1.12, 1] } : {}}
    onClick={onTap}
    className={`btn-3d flex flex-col items-center justify-center border-2 bg-white px-2 py-3 ${
      state === 'right' ? 'border-emerald-400 bg-emerald-50' : state === 'wrong' ? 'border-rose-300 bg-rose-50' : state === 'seen' ? 'border-sky-300 bg-sky-50' : 'border-stone-200'
    }`}
    aria-label={item.word}
  >
    <span className={size === 'lg' ? 'text-6xl sm:text-7xl' : 'text-5xl'} aria-hidden="true">
      {item.emoji}
    </span>
    {showWord && <span className="mt-1 text-base font-black text-stone-800 sm:text-lg">{item.word}</span>}
  </motion.button>
);

/* ----------------------------- 1. Picture talk ----------------------------- */

export const PictureTalkStep: React.FC<{ unit: EnglishUnit; onDone: () => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const items = unit.pictureTalk.items;
  useEffect(() => {
    onMascot('Tap each picture to hear its name. Then talk about it!', 'happy');
    say(`Look at the picture. ${unit.pictureTalk.scene}. Tap each one to hear its name.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);
  const tap = (item: PictureWord) => {
    sayWord(item.word);
    const next = new Set(seen).add(item.word);
    setSeen(next);
    if (next.size === items.length) onMascot('You named them all! Now answer the questions out loud.', 'cheer');
  };
  return (
    <div>
      <div className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-sky-100 via-amber-50 to-emerald-100 p-4">
        <p className="mb-3 text-center text-sm font-black text-stone-600">🖼️ {unit.pictureTalk.scene}</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <PictureTile key={item.word} item={item} size="lg" state={seen.has(item.word) ? 'seen' : 'idle'} onTap={() => tap(item)} />
          ))}
        </div>
      </div>
      <h3 className="mt-5 text-lg font-black text-stone-900">💬 Let’s talk</h3>
      <ul className="mt-2 space-y-2">
        {unit.pictureTalk.prompts.map((p) => (
          <li key={p}>
            <button type="button" onClick={() => say(p)} className="flex w-full items-center gap-2 rounded-2xl border-2 border-stone-200 bg-white px-3 py-2 text-left text-base font-bold text-stone-800 hover:border-amber-300">
              <Volume2 className="h-5 w-5 shrink-0 text-sky-600" /> {p}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end">
        <ChunkyButton color="emerald" onClick={onDone} id="eng1-talk-done">
          {seen.size >= Math.min(4, items.length) ? 'I talked about it! ✓' : `Tap ${Math.min(4, items.length) - seen.size} more, or go on →`}
        </ChunkyButton>
      </div>
    </div>
  );
};

/* ------------------------------ 2. Listen ------------------------------ */

export const ListenStep: React.FC<{ unit: EnglishUnit; onDone: (score: number, total: number) => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  const [line, setLine] = useState(-1);
  const [heard, setHeard] = useState(false);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const playing = useRef(false);
  const questions = unit.story.questions;

  useEffect(() => {
    onMascot(`Listen to the story "${unit.story.title}".`, 'happy');
    return () => {
      playing.current = false;
      kidSpeech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);

  const play = async () => {
    if (playing.current) return;
    playing.current = true;
    for (let i = 0; i < unit.story.lines.length && playing.current; i++) {
      setLine(i);
      await speakAndWait(unit.story.lines[i]);
    }
    playing.current = false;
    setLine(-1);
    setHeard(true);
    onMascot('Now answer: tap the right picture!', 'cheer');
    say(questions[0].question);
  };

  const answer = (i: number) => {
    if (picked !== null) return;
    const q = questions[round];
    const right = i === q.answer;
    setPicked(i);
    right ? soundEffects.playCorrect() : soundEffects.playTryAgain();
    onMascot(right ? 'Yes! Well listened!' : `It was ${q.options[q.answer].word}.`, right ? 'cheer' : 'think');
    const next = [...results, right];
    window.setTimeout(() => {
      setResults(next);
      setPicked(null);
      if (round + 1 < questions.length) {
        setRound(round + 1);
        say(questions[round + 1].question);
      } else {
        onDone(next.filter(Boolean).length, questions.length);
      }
    }, 1300);
  };

  return (
    <div>
      <div className="rounded-3xl border-2 border-sky-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-black text-stone-900">👂 {unit.story.title}</h3>
          <ChunkyButton color="sky" onClick={() => void play()} id="eng1-play-story">
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-4 w-4" /> {heard ? 'Hear again' : 'Play story'}
            </span>
          </ChunkyButton>
        </div>
        <div className="mt-3 space-y-1.5">
          {unit.story.lines.map((l, i) => (
            <p
              key={l}
              className={`rounded-xl px-2 py-1 text-lg font-bold transition-all sm:text-xl ${
                line === i ? 'scale-[1.02] bg-amber-100 text-stone-900' : heard ? 'text-stone-700' : 'text-stone-300'
              }`}
            >
              {l}
            </p>
          ))}
        </div>
      </div>
      {heard && round < questions.length && (
        <div className="relative mt-5 rounded-3xl border-2 border-amber-200 bg-amber-50 p-4">
          <Feedback state={picked === null ? null : picked === questions[round].answer ? 'correct' : 'wrong'} />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => say(questions[round].question)} className="flex items-center gap-2 text-left text-lg font-black text-stone-900">
              <Volume2 className="h-5 w-5 text-sky-600" /> {questions[round].question}
            </button>
            <RoundDots total={questions.length} current={round} results={results} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {questions[round].options.map((o, i) => (
              <PictureTile
                key={o.word}
                item={o}
                state={picked === null ? 'idle' : i === questions[round].answer ? 'right' : i === picked ? 'wrong' : 'idle'}
                onTap={() => answer(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------ 3. Rhyme ------------------------------ */

export const RhymeStep: React.FC<{ unit: EnglishUnit; onDone: () => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  const [line, setLine] = useState(-1);
  const [sung, setSung] = useState(false);
  const playing = useRef(false);
  useEffect(() => {
    onMascot(`Let’s sing "${unit.rhyme.title}"! ${unit.rhyme.action}`, 'happy');
    return () => {
      playing.current = false;
      kidSpeech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);
  const sing = async () => {
    if (playing.current) return;
    playing.current = true;
    for (let i = 0; i < unit.rhyme.lines.length && playing.current; i++) {
      setLine(i);
      await speakAndWait(unit.rhyme.lines[i]);
    }
    playing.current = false;
    setLine(-1);
    setSung(true);
    onMascot('Now you say a line! Tap the microphone.', 'cheer');
  };
  return (
    <div>
      <div className="rounded-3xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-stone-900">🎵 {unit.rhyme.title}</h3>
          <ChunkyButton color="rose" onClick={() => void sing()} id="eng1-sing">
            {sung ? '🎵 Sing again' : '🎵 Sing along'}
          </ChunkyButton>
        </div>
        <p className="mt-1 text-sm font-bold text-pink-700">🙌 {unit.rhyme.action}</p>
        <div className="mt-3 space-y-1.5">
          {unit.rhyme.lines.map((l, i) => (
            <motion.p
              key={l}
              animate={line === i ? { scale: [1, 1.04, 1] } : {}}
              transition={{ repeat: line === i ? Infinity : 0, duration: 0.8 }}
              className={`rounded-xl px-2 py-1 text-xl font-black sm:text-2xl ${line === i ? 'bg-pink-200 text-stone-900' : 'text-stone-700'}`}
            >
              {l}
            </motion.p>
          ))}
        </div>
      </div>
      {sung && (
        <div className="mt-5 rounded-3xl border-2 border-violet-200 bg-white p-4">
          <p className="mb-2 text-sm font-black text-violet-700">🎤 Say the first line</p>
          <SayIt text={unit.rhyme.lines[0]} language="English" size="md" onMascot={onMascot} />
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <ChunkyButton color="emerald" onClick={onDone} id="eng1-rhyme-done">
          I sang it! ✓
        </ChunkyButton>
      </div>
    </div>
  );
};

/* ------------------------- Picture / word quiz rounds ------------------------- */

function useRounds<T>(rounds: T[], onDone: (score: number, total: number) => void) {
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number, answer: number, next?: () => void) => {
    if (picked !== null) return;
    const right = i === answer;
    setPicked(i);
    right ? soundEffects.playCorrect() : soundEffects.playTryAgain();
    const all = [...results, right];
    window.setTimeout(() => {
      setResults(all);
      setPicked(null);
      if (round + 1 < rounds.length) {
        setRound(round + 1);
        next?.();
      } else onDone(all.filter(Boolean).length, rounds.length);
    }, 1100);
  };
  return { round, results, picked, pick };
}

/* ------------------------------ 4. Sounds ------------------------------ */

export const SoundsStep: React.FC<{ unit: EnglishUnit; onDone: (score: number, total: number) => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  const [phase, setPhase] = useState<'learn' | 'game'>('learn');
  const [letterIndex, setLetterIndex] = useState(0);
  const rounds = useMemo<ChoiceRound<PictureWord>[]>(() => beginningSoundRounds(unit), [unit]);
  const { round, results, picked, pick } = useRounds(rounds, onDone);
  const lesson = unit.letters[letterIndex];

  useEffect(() => {
    if (phase !== 'learn') return;
    const l = unit.letters[letterIndex];
    say(`This is ${l.letter.toUpperCase()}. ${l.sound.split(' — ')[0]}. ${l.words.map((w) => w.word).join(', ')}.`);
    onMascot(`Say it with me: ${l.sound}`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, letterIndex, unit.id]);

  useEffect(() => {
    if (phase === 'game') say(rounds[round].say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'learn') {
    return (
      <div>
        <div className="flex gap-2">
          {unit.letters.map((l, i) => (
            <button
              key={l.letter}
              type="button"
              onClick={() => setLetterIndex(i)}
              className={`rounded-2xl px-4 py-2 text-2xl font-black ${i === letterIndex ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-500'}`}
            >
              {l.letter.toUpperCase()}
              {l.letter}
            </button>
          ))}
        </div>
        <motion.div key={lesson.letter} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} className="mt-4 rounded-3xl border-2 border-amber-200 bg-white p-5 text-center">
          <button type="button" onClick={() => say(lesson.sound.split(' — ')[0])} className="font-black leading-none text-stone-900" style={{ fontSize: '7rem' }}>
            {lesson.letter.toUpperCase()}
            <span className="text-amber-500">{lesson.letter}</span>
          </button>
          <p className="mt-2 text-lg font-bold text-stone-700">🔊 {lesson.sound}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {lesson.words.map((w) => (
              <PictureTile key={w.word} item={w} onTap={() => sayWord(w.word)} />
            ))}
          </div>
        </motion.div>
        <div className="mt-5 flex justify-end gap-2">
          {letterIndex + 1 < unit.letters.length ? (
            <ChunkyButton color="sky" onClick={() => setLetterIndex(letterIndex + 1)}>
              Next letter →
            </ChunkyButton>
          ) : (
            <ChunkyButton color="emerald" onClick={() => setPhase('game')} id="eng1-sounds-game">
              🎮 Play: find the sound
            </ChunkyButton>
          )}
        </div>
      </div>
    );
  }

  const r = rounds[round];
  return (
    <div className="relative rounded-3xl border-2 border-amber-200 bg-amber-50 p-4">
      <Feedback state={picked === null ? null : picked === r.answer ? 'correct' : 'wrong'} />
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => say(r.say)} className="flex items-center gap-2 text-left text-lg font-black text-stone-900">
          <Volume2 className="h-5 w-5 text-sky-600" /> {r.prompt}
        </button>
        <RoundDots total={rounds.length} current={round} results={results} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {r.options.map((o, i) => (
          <PictureTile
            key={o.word}
            item={o}
            showWord={picked !== null}
            state={picked === null ? 'idle' : i === r.answer ? 'right' : i === picked ? 'wrong' : 'idle'}
            onTap={() => pick(i, r.answer, () => window.setTimeout(() => say(rounds[round + 1].say), 50))}
          />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------ 5. Trace ------------------------------ */

// The child draws over a big light-grey letter. Coverage = share of the
// letter's ink the strokes passed over; strokes far off the letter don't count.
const TraceCanvas: React.FC<{ glyph: string; onPassed: () => void }> = ({ glyph, onPassed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Uint8ClampedArray | null>(null);
  const covered = useRef<Set<number>>(new Set());
  const total = useRef(1);
  // Stroke samples on / off the letter: scribbling over the whole box is not tracing.
  const samples = useRef({ on: 0, all: 0 });
  const [offTrack, setOffTrack] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [coverage, setCoverage] = useState(0);
  const passed = useRef(false);
  const SIZE = 260;
  const CELL = 6;

  const reset = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#e7e5e4';
    ctx.font = `900 ${SIZE * 0.78}px "Andika", "Noto Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, SIZE / 2, SIZE / 2 + 8);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    maskRef.current = data;
    // Count the letter's cells once.
    let cells = 0;
    for (let y = 0; y < SIZE; y += CELL) for (let x = 0; x < SIZE; x += CELL) if (data[(y * SIZE + x) * 4 + 3] > 0) cells++;
    total.current = Math.max(1, cells);
    covered.current = new Set();
    samples.current = { on: 0, all: 0 };
    setOffTrack(false);
    setCoverage(0);
    passed.current = false;
    // Start dot.
    ctx.fillStyle = '#f59e0b';
  };

  useEffect(reset, [glyph]);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  const mark = (x: number, y: number) => {
    const data = maskRef.current;
    if (!data) return;
    const near = (px: number, py: number) => {
      const cx = Math.max(0, Math.min(SIZE - 1, Math.round(px)));
      const cy = Math.max(0, Math.min(SIZE - 1, Math.round(py)));
      return data[(cy * SIZE + cx) * 4 + 3] > 0;
    };
    samples.current.all += 1;
    if ([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].some(([dx, dy]) => near(x + dx, y + dy))) samples.current.on += 1;
    const onShare = samples.current.on / samples.current.all;
    for (let dy = -14; dy <= 14; dy += CELL) {
      for (let dx = -14; dx <= 14; dx += CELL) {
        const cx = Math.round((x + dx) / CELL) * CELL;
        const cy = Math.round((y + dy) / CELL) * CELL;
        if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) continue;
        if (data[(cy * SIZE + cx) * 4 + 3] > 0) covered.current.add(cy * SIZE + cx);
      }
    }
    const c = covered.current.size / total.current;
    setCoverage(c);
    // Enough of the letter is covered, but mostly by strokes off it.
    setOffTrack(c >= 0.6 && onShare < 0.55);
    if (c >= 0.6 && onShare >= 0.55 && !passed.current) {
      passed.current = true;
      soundEffects.playCorrect();
      onPassed();
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(e);
    if (ctx && last.current) {
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
    mark(p.x, p.y);
  };

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="touch-none rounded-3xl border-4 border-dashed border-amber-300 bg-white"
        style={{ width: SIZE, height: SIZE, maxWidth: '80vw', maxHeight: '80vw' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          mark(last.current.x, last.current.y);
        }}
        onPointerMove={move}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
        aria-label={`Trace the letter ${glyph}`}
      />
      <div className="mt-2 flex items-center gap-3">
        <div className="h-3 w-40 overflow-hidden rounded-full bg-stone-200">
          <div className={`h-full ${coverage >= 0.6 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, Math.round((coverage / 0.6) * 100))}%` }} />
        </div>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-black text-stone-600 shadow">
          <Eraser className="h-4 w-4" /> Clear
        </button>
      </div>
      {offTrack && <p className="mt-2 text-sm font-black text-amber-700">Stay on the grey letter! Tap Clear and try again.</p>}
    </div>
  );
};

export const TraceStep: React.FC<{ unit: EnglishUnit; onDone: (score: number, total: number) => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  const glyphs = useMemo(() => unit.letters.flatMap((l) => [l.letter.toUpperCase(), l.letter]), [unit]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const glyph = glyphs[index];
  useEffect(() => {
    onMascot(`Trace the letter ${glyph} with your finger.`, 'happy');
    say(`Trace ${glyph === glyph.toUpperCase() ? 'capital' : 'small'} ${glyph}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, unit.id]);
  const next = (ok: boolean) => {
    const all = [...done];
    all[index] = ok;
    setDone(all);
    if (index + 1 < glyphs.length) setIndex(index + 1);
    else onDone(all.filter(Boolean).length, glyphs.length);
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-black text-stone-900">
          ✍️ {glyph === glyph.toUpperCase() ? 'Capital' : 'Small'} <span className="text-3xl text-violet-600">{glyph}</span>
        </p>
        <RoundDots total={glyphs.length} current={index} results={done.slice(0, index)} />
      </div>
      <TraceCanvas
        key={`${unit.id}-${index}`}
        glyph={glyph}
        onPassed={() => {
          onMascot('Beautiful writing! ⭐', 'cheer');
          window.setTimeout(() => next(true), 700);
        }}
      />
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={() => next(false)} className="text-sm font-black text-stone-500 underline">
          Skip this letter →
        </button>
      </div>
    </div>
  );
};

/* ------------------------------ 6. Words ------------------------------ */

export const WordsStep: React.FC<{ unit: EnglishUnit; onDone: (score: number, total: number) => void; onMascot: Mascot }> = ({ unit, onDone, onMascot }) => {
  type R = { kind: 'sight'; r: ChoiceRound<string> } | { kind: 'missing'; r: MissingLetterRound };
  const rounds = useMemo<R[]>(
    () => [...sightWordRounds(unit).map((r) => ({ kind: 'sight' as const, r })), ...missingLetterRounds(unit).map((r) => ({ kind: 'missing' as const, r }))],
    [unit]
  );
  const { round, results, picked, pick } = useRounds(rounds, onDone);
  const current = rounds[round];
  const prompt = (c: R) => (c.kind === 'sight' ? `Find the word: ${c.r.say}` : `Which letter is missing? ${c.r.word.word}`);
  useEffect(() => {
    onMascot('Listen, then tap the right answer!', 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);
  useEffect(() => {
    say(prompt(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const answer = current.r.answer;
  return (
    <div className="relative rounded-3xl border-2 border-violet-200 bg-violet-50 p-4">
      <Feedback state={picked === null ? null : picked === answer ? 'correct' : 'wrong'} />
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => say(prompt(current))} className="flex items-center gap-2 text-left text-lg font-black text-stone-900">
          <Volume2 className="h-5 w-5 text-sky-600" /> {current.kind === 'sight' ? 'Tap the word you hear' : 'Fill in the missing letter'}
        </button>
        <RoundDots total={rounds.length} current={round} results={results} />
      </div>
      {current.kind === 'missing' && (
        <div className="mt-3 flex items-center justify-center gap-4">
          <span className="text-7xl">{current.r.word.emoji}</span>
          <span className="text-5xl font-black tracking-widest text-stone-900">
            {picked !== null ? current.r.word.word : current.r.masked.replace('_', '＿')}
          </span>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {current.r.options.map((o, i) => (
          <motion.button
            key={o}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => pick(i, answer)}
            className={`btn-3d border-2 bg-white py-5 text-4xl font-black ${
              picked === null ? 'border-stone-200 text-stone-900' : i === answer ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : i === picked ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-200 text-stone-400'
            }`}
          >
            {o}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
