import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { Language } from '../../../types';
import { soundEffects } from '../../../services/soundEffects';
import { kidSpeech } from '../../../services/speechSynthesis';
import { Feedback, GameProps, RoundDots, shuffle } from '../ui';

// Build each word by tapping its letters (aksharas for Telugu/Hindi) in order.
export const WordBuildGame: React.FC<
  GameProps & { words: { word: string; tiles: string[]; emoji: string; meaning: string }[] }
> = ({ words, language, onFinish, onMascot }) => {
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);
  const [shake, setShake] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const word = words[round];
  // Tiles are identified by their position in the word; duplicates (T-R-E-E)
  // are interchangeable, so a tile is right if its letter matches the slot.
  const tiles = useMemo(() => shuffle(word.tiles.map((t, i) => ({ t, i }))), [word]);

  useEffect(() => {
    onMascot(`Build the word for ${word.emoji}! Tap the letters in order.`, 'happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const tap = (tileIndex: number) => {
    if (placed.includes(tileIndex) || feedback === 'correct') return;
    const slot = placed.length;
    if (word.tiles[tileIndex] === word.tiles[slot]) {
      soundEffects.playWordPop();
      kidSpeech.speakSlowWord(word.tiles[tileIndex], language as Language);
      const next = [...placed, tileIndex];
      setPlaced(next);
      if (next.length === word.tiles.length) {
        soundEffects.playCorrect();
        setFeedback('correct');
        onMascot(`${word.word}! (${word.meaning})`, 'cheer');
        // Say the finished word slowly, after the last letter's sound.
        window.setTimeout(() => kidSpeech.speakSlowWord(word.word, language as Language), 700);
        const nextResults = [...results, !missed];
        setResults(nextResults);
        window.setTimeout(() => {
          setFeedback(null);
          if (round + 1 >= words.length) {
            onFinish(nextResults.filter(Boolean).length, words.length);
            return;
          }
          setRound((r) => r + 1);
          setPlaced([]);
          setMissed(false);
        }, 1700);
      }
    } else {
      soundEffects.playTryAgain();
      setMissed(true);
      setShake(tileIndex);
      setFeedback('wrong');
      onMascot('Say the word slowly. Which sound comes next?', 'sad');
      window.setTimeout(() => {
        setShake(null);
        setFeedback(null);
      }, 800);
    }
  };

  return (
    <div className="relative">
      <Feedback state={feedback} />
      <div className="mb-3 flex items-center justify-between">
        <RoundDots total={words.length} current={round} results={results} />
        <span className="text-xs font-black text-stone-500">Word {round + 1} / {words.length}</span>
      </div>
      <motion.div key={round} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} className="mb-4 text-center">
        <div className="float-slow inline-block text-7xl sm:text-8xl">{word.emoji}</div>
        <p className="mt-1 text-sm font-bold text-stone-500">{word.meaning}</p>
      </motion.div>
      <LayoutGroup id={`word-${round}`}>
        <div className="mb-5 flex justify-center gap-2" id="word-slots">
          {word.tiles.map((_, slot) => {
            const tileIndex = placed[slot];
            return (
              <div key={slot} className="flex h-16 min-w-14 items-center justify-center rounded-2xl border-4 border-dashed border-violet-300 bg-violet-50 px-2 sm:h-20 sm:min-w-16">
                {tileIndex !== undefined && (
                  <motion.span layoutId={`tile-${round}-${tileIndex}`} className="text-3xl font-black text-violet-800 sm:text-4xl">
                    {word.tiles[tileIndex]}
                  </motion.span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {tiles
            .filter((tile) => !placed.includes(tile.i))
            .map((tile) => (
              <motion.button
                key={tile.i}
                layoutId={`tile-${round}-${tile.i}`}
                type="button"
                onClick={() => tap(tile.i)}
                animate={shake === tile.i ? { x: [0, -10, 10, -6, 0] } : {}}
                className="word-tile btn-3d h-16 min-w-16 bg-amber-300 px-3 text-3xl text-amber-950 sm:h-20 sm:min-w-20 sm:text-4xl"
              >
                {tile.t}
              </motion.button>
            ))}
        </div>
      </LayoutGroup>
    </div>
  );
};
