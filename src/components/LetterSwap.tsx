import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface LetterSwapProps {
  frontText: string;
  backText: string;

  className?: string;
  frontFaceClassName?: string;
  backFaceClassName?: string;

  staggerInterval?: number;
  duration?: number;

  flipDirection?: 'top' | 'bottom';

  blur?: boolean;
  blurAmount?: number;

  respectReducedMotion?: boolean;
}

const splitGraphemes = (text: string): string[] => {
  if (
    typeof Intl !== 'undefined' &&
    'Segmenter' in Intl
  ) {
    const Segmenter = (
      Intl as typeof Intl & {
        Segmenter: new (
          locales?: string[],
          options?: {
            granularity: 'grapheme';
          }
        ) => {
          segment: (
            input: string
          ) => Iterable<{
            segment: string;
          }>;
        };
      }
    ).Segmenter;

    const segmenter = new Segmenter(
      undefined,
      {
        granularity: 'grapheme',
      }
    );

    return Array.from(
      segmenter.segment(text),
      (item) => item.segment
    );
  }

  return Array.from(text);
};

const LetterSwap: React.FC<LetterSwapProps> = ({
  frontText,
  backText,

  className = '',
  frontFaceClassName = '',
  backFaceClassName = '',

  staggerInterval = 0.035,
  duration = 0.55,

  flipDirection = 'top',

  blur = false,
  blurAmount = 3,

  respectReducedMotion = true,
}) => {
  const [isHovered, setIsHovered] =
    React.useState(false);

  const reducedMotion = useReducedMotion();

  const shouldReduceMotion =
    respectReducedMotion && reducedMotion;

  const frontLetters =
    React.useMemo(
      () => splitGraphemes(frontText),
      [frontText]
    );

  const backLetters =
    React.useMemo(
      () => splitGraphemes(backText),
      [backText]
    );

  const rotation =
    flipDirection === 'top'
      ? -90
      : 90;

  /*
   * We render both strings in their own absolute
   * layers and use a hidden sizing layer underneath.
   *
   * This makes the component occupy exactly the
   * width of the larger string at ALL times.
   */
  return (
    <span
      className={`
        relative
        inline-block
        align-middle
        whitespace-nowrap
        ${className}
      `}
      onMouseEnter={() =>
        setIsHovered(true)
      }
      onMouseLeave={() =>
        setIsHovered(false)
      }
      onFocus={() =>
        setIsHovered(true)
      }
      onBlur={() =>
        setIsHovered(false)
      }
      aria-label={backText}
    >
      {/* =====================================================
          INVISIBLE SIZING LAYER

          This determines the permanent width of the
          component using whichever language is wider.
      ===================================================== */}

      <span
        className="
          invisible
          inline-flex
          items-center
          whitespace-nowrap
          pointer-events-none
          select-none
        "
        aria-hidden="true"
      >
        <span className={backFaceClassName}>
          {backText}
        </span>
      </span>

      {/* =====================================================
          TELUGU — DEFAULT
      ===================================================== */}

      <span
        className="
          absolute
          inset-0
          flex
          items-center
          whitespace-nowrap
          pointer-events-none
        "
        aria-hidden={isHovered}
      >
        {frontLetters.map(
          (letter, index) => (
            <motion.span
              key={`front-${index}`}
              className={`
                inline-block
                whitespace-pre
                transform-gpu
                ${frontFaceClassName}
              `}
              initial={false}
              animate={{
                rotateX:
                  isHovered &&
                  !shouldReduceMotion
                    ? rotation
                    : 0,

                opacity:
                  isHovered &&
                  !shouldReduceMotion
                    ? 0
                    : 1,

                y:
                  isHovered &&
                  !shouldReduceMotion
                    ? flipDirection === 'top'
                      ? -3
                      : 3
                    : 0,

                filter:
                  blur &&
                  isHovered &&
                  !shouldReduceMotion
                    ? `blur(${blurAmount}px)`
                    : 'blur(0px)',
              }}
              transition={{
                duration,
                delay:
                  index * staggerInterval,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              style={{
                transformOrigin:
                  flipDirection === 'top'
                    ? 'center bottom'
                    : 'center top',

                backfaceVisibility:
                  'hidden',
              }}
            >
              {letter === ' '
                ? '\u00A0'
                : letter}
            </motion.span>
          )
        )}
      </span>

      {/* =====================================================
          ENGLISH — HOVER
      ===================================================== */}

      <span
        className="
          absolute
          inset-0
          flex
          items-center
          whitespace-nowrap
          pointer-events-none
        "
        aria-hidden={!isHovered}
      >
        {backLetters.map(
          (letter, index) => (
            <motion.span
              key={`back-${index}`}
              className={`
                inline-block
                whitespace-pre
                transform-gpu
                ${backFaceClassName}
              `}
              initial={false}
              animate={{
                rotateX:
                  isHovered &&
                  !shouldReduceMotion
                    ? 0
                    : -rotation,

                opacity:
                  isHovered &&
                  !shouldReduceMotion
                    ? 1
                    : 0,

                y:
                  isHovered &&
                  !shouldReduceMotion
                    ? 0
                    : flipDirection === 'top'
                      ? 3
                      : -3,

                filter:
                  blur &&
                  !isHovered
                    ? `blur(${blurAmount}px)`
                    : 'blur(0px)',
              }}
              transition={{
                duration,
                delay:
                  index * staggerInterval,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              style={{
                transformOrigin:
                  flipDirection === 'top'
                    ? 'center top'
                    : 'center bottom',

                backfaceVisibility:
                  'hidden',
              }}
            >
              {letter === ' '
                ? '\u00A0'
                : letter}
            </motion.span>
          )
        )}
      </span>
    </span>
  );
};

export default LetterSwap;