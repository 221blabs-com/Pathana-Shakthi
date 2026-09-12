import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  ArrowRight,
  BookOpen,
  Heart,
  Mic,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';

interface ShakthiMitraProps {
  isOpen: boolean;
  onToggle: () => void;
}

/* ================================================================
   SHAKTHI MITRA DIALOGUES

   6.5 seconds per dialogue.

   English → Telugu → Hindi → English → ...
================================================================ */

const dialogues = [
  {
    language: 'English',
    short: 'EN',
    messages: [
      "Hi! Let's read, learn and grow together! ✨",
      'Every new word you learn makes you stronger! 💪',
      'Ready for a little reading adventure? 📖'
    ],
  },
  {
    language: 'తెలుగు',
    short: 'తె',
    messages: [
      'హాయ్! మనం కలిసి చదువుకుందాం, నేర్చుకుందాం! ✨',
      'నువ్వు నేర్చుకునే ప్రతి కొత్త పదం నిన్ను మరింత బలంగా చేస్తుంది! 💪',
      'ఒక చిన్న చదువు సాహసానికి సిద్ధమా? 📖'
    ],
  },
  {
    language: 'हिन्दी',
    short: 'हि',
    messages: [
      'नमस्ते! आओ साथ में पढ़ें और सीखें! ✨',
      'तुम जो भी नया शब्द सीखते हो, वह तुम्हें और मजबूत बनाता है! 💪',
      'क्या तुम एक छोटी सी पढ़ाई की यात्रा के लिए तैयार हो? 📖'
    ],
  },
];

const DIALOGUE_INTERVAL = 6500;

/* ================================================================
   FEATURE CARDS
================================================================ */

const floatingItems = [
  {
    icon: BookOpen,
    title: 'Read',
    subtitle: 'Stories',
    side: 'left',
    vertical: 'top-[39%]',
    accent: 'from-[#ff704f] to-[#ff9b54]',
    delay: 0,
  },
  {
    icon: Mic,
    title: 'Speak',
    subtitle: 'Clearly',
    side: 'left',
    vertical: 'bottom-[8%]',
    accent: 'from-[#8b7cf6] to-[#a78bfa]',
    delay: 0.15,
  },
  {
    icon: Zap,
    title: 'Learn',
    subtitle: 'New Words',
    side: 'right',
    vertical: 'top-[39%]',
    accent: 'from-[#39b88d] to-[#56d7a6]',
    delay: 0.3,
  },
  {
    icon: Heart,
    title: 'Grow',
    subtitle: 'Confidence',
    side: 'right',
    vertical: 'bottom-[8%]',
    accent: 'from-[#ff5c8a] to-[#ff704f]',
    delay: 0.45,
  },
];

const sparkles = [
  { left: '9%', top: '18%', delay: 0 },
  { left: '91%', top: '18%', delay: 0.7 },
  { left: '12%', top: '74%', delay: 1.2 },
  { left: '88%', top: '74%', delay: 0.45 },
  { left: '50%', top: '8%', delay: 1.4 },
];

export const ShakthiMitra: React.FC<ShakthiMitraProps> = ({
  isOpen,
  onToggle,
}) => {
  const [languageIndex, setLanguageIndex] = useState(0);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);
  const [sparkleBurst, setSparkleBurst] = useState(0);

  const currentLanguage = dialogues[languageIndex];
  const currentMessage = currentLanguage.messages[dialogueIndex];

  /* ================================================================
     OPEN / CLOSE
  ================================================================= */

  useEffect(() => {
    if (!isOpen) {
      setLanguageIndex(0);
      setDialogueIndex(0);
      setShowDialogue(false);
      return;
    }

    setLanguageIndex(0);
    setDialogueIndex(0);

    const timer = window.setTimeout(() => {
      setShowDialogue(true);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  /* ================================================================
     DIALOGUE ENGINE

     Every 6.5 seconds the next message appears.

     English
       ↓
     Telugu
       ↓
     Hindi
       ↓
     English
       ↓
     ...
  ================================================================= */

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setInterval(() => {
      setSparkleBurst((value) => value + 1);

      setDialogueIndex((currentDialogue) => {
        const messages = dialogues[languageIndex].messages;

        if (currentDialogue < messages.length - 1) {
          return currentDialogue + 1;
        }

        setLanguageIndex((currentLanguageIndex) => {
          return (
            (currentLanguageIndex + 1) %
            dialogues.length
          );
        });

        return 0;
      });
    }, DIALOGUE_INTERVAL);

    return () => window.clearInterval(timer);
  }, [isOpen, languageIndex]);

  return (
    <div
      className="
        relative
        flex
        h-full
        min-h-[500px]
        w-full
        items-center
        justify-center
        overflow-visible
      "
    >
      {/* ==========================================================
          ATMOSPHERE
      ========================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-visible">
        <motion.div
          animate={{
            scale: isOpen
              ? [1, 1.16, 1]
              : [1, 1.07, 1],
            opacity: isOpen
              ? [0.16, 0.36, 0.16]
              : [0.08, 0.2, 0.08],
          }}
          transition={{
            duration: 3.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            left-1/2
            top-[55%]
            h-[350px]
            w-[350px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-[#ff8a3d]/25
            blur-[90px]
          "
        />

        <motion.div
          animate={{
            x: [0, 35, 0],
            y: [0, -20, 0],
            opacity: [0.03, 0.14, 0.03],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            right-[-100px]
            top-[-80px]
            h-64
            w-64
            rounded-full
            bg-[#8b7cf6]/20
            blur-[80px]
          "
        />

        <motion.div
          animate={{
            x: [0, -25, 0],
            opacity: [0.02, 0.11, 0.02],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            bottom-[-100px]
            left-[-80px]
            h-60
            w-60
            rounded-full
            bg-[#39b88d]/15
            blur-[75px]
          "
        />
      </div>

      {/* ==========================================================
          ORBITS
      ========================================================== */}

      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[56%]
          h-[350px]
          w-[560px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-[50%]
          border
          border-white/[0.08]
        "
      />

      <motion.div
        animate={{ rotate: -360 }}
        transition={{
          duration: 38,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[56%]
          h-[280px]
          w-[470px]
          -translate-x-1/2
          -translate-y-1/2
          rotate-[20deg]
          rounded-[50%]
          border
          border-[#ffb84d]/10
        "
      />

      {/* ==========================================================
          AMBIENT SPARKLES
      ========================================================== */}

      {sparkles.map((sparkle, index) => (
        <motion.span
          key={index}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [0.7, 1.25, 0.7],
            rotate: [0, 25, 0],
          }}
          transition={{
            duration: 2.4 + index * 0.25,
            delay: sparkle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            pointer-events-none
            absolute
            z-10
            text-[#ffb84d]
          "
          style={{
            left: sparkle.left,
            top: sparkle.top,
          }}
        >
          ✦
        </motion.span>
      ))}

      {/* ==========================================================
          DIALOGUE CHANGE SPARKLE
      ========================================================== */}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key={sparkleBurst}
            initial={{
              opacity: 0,
              scale: 0.4,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.4, 1.2, 1.5],
            }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
            }}
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[29%]
              z-[100]
              -translate-x-1/2
              text-[#ffb84d]
            "
          >
            <Sparkles className="h-8 w-8 fill-[#ffb84d]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================================
          FLOATING FEATURE CARDS

          These stay well outside the tiger's central zone.
      ========================================================== */}

      <AnimatePresence>
        {isOpen &&
          floatingItems.map((item) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{
                  opacity: 0,
                  scale: 0.65,
                  x:
                    item.side === 'left'
                      ? -45
                      : 45,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: 0,
                  y: [0, -5, 0],
                }}
                exit={{
                  opacity: 0,
                  scale: 0.65,
                  x:
                    item.side === 'left'
                      ? -45
                      : 45,
                  y: 20,
                }}
                transition={{
                  opacity: {
                    duration: 0.3,
                    delay: item.delay,
                  },
                  scale: {
                    type: 'spring',
                    stiffness: 240,
                    damping: 18,
                    delay: item.delay,
                  },
                  x: {
                    type: 'spring',
                    stiffness: 220,
                    damping: 18,
                    delay: item.delay,
                  },
                  y: {
                    duration: 3.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: item.delay,
                  },
                }}
                className={`
                  absolute
                  ${item.side === 'left'
                    ? 'left-[0%]'
                    : 'right-[0%]'}
                  ${item.vertical}
                  z-30
                  hidden
                  w-[126px]
                  rounded-[20px]
                  border
                  border-white/[0.13]
                  bg-[#10131d]/90
                  p-2.5
                  shadow-[0_20px_50px_rgba(0,0,0,.32)]
                  backdrop-blur-xl
                  sm:block
                `}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`
                      grid
                      h-9
                      w-9
                      shrink-0
                      place-items-center
                      rounded-xl
                      bg-gradient-to-br
                      ${item.accent}
                      text-white
                    `}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-white">
                      {item.title}
                    </p>

                    <p className="mt-0.5 text-[8px] font-bold text-white/40">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* ==========================================================
          REACTIVE SPEECH BUBBLE

          Higher than the tiger.
          Does NOT sit over the tiger's head.
      ========================================================== */}

      <AnimatePresence>
        {isOpen && showDialogue && (
          <motion.div
            key={`${languageIndex}-${dialogueIndex}`}
            initial={{
              opacity: 0,
              y: -15,
              scale: 0.88,
              rotate: -1,
            }}
            animate={{
              opacity: 1,
              y: [0, -4, 0],
              scale: 1,
              rotate: 0,
            }}
            exit={{
              opacity: 0,
              y: 8,
              scale: 0.94,
            }}
            transition={{
              opacity: {
                duration: 0.2,
              },
              scale: {
                type: 'spring',
                stiffness: 260,
                damping: 18,
              },
              y: {
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
            className="
              absolute
              left-1/2
              top-[9%]
              z-[90]
              w-[220px]
              -translate-x-1/2
            "
          >
            {/* Glow */}
            <motion.div
              animate={{
                opacity: [0.2, 0.45, 0.2],
                scale: [0.98, 1.03, 0.98],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="
                pointer-events-none
                absolute
                inset-[-9px]
                rounded-[32px]
                bg-gradient-to-r
                from-[#ff704f]/25
                via-[#ffb84d]/20
                to-[#8b7cf6]/25
                blur-xl
              "
            />

            {/* Bubble */}
            <div
              className="
                relative
                overflow-visible
                rounded-[28px]
                border
                border-white/80
                bg-gradient-to-br
                from-white
                via-[#fffaf3]
                to-[#f1ecff]
                px-4
                py-3.5
                shadow-[0_22px_55px_rgba(0,0,0,.2)]
              "
            >
              {/* Shine */}
              <motion.div
                animate={{
                  x: ['-120%', '160%'],
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  repeatDelay: 1.5,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  inset-y-0
                  left-0
                  w-12
                  -skew-x-12
                  bg-white/60
                  blur-md
                "
              />

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <motion.span
                    animate={{
                      rotate: [0, -8, 8, 0],
                    }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="text-sm"
                  >
                    🐯
                  </motion.span>

                  <span
                    className="
                      text-[9px]
                      font-black
                      uppercase
                      tracking-[0.14em]
                      text-[#ff704f]
                    "
                  >
                    Shakthi Mitra
                  </span>
                </div>

                {/* Language badge */}
                <motion.span
                  key={currentLanguage.short}
                  initial={{
                    opacity: 0,
                    scale: 0.6,
                    y: -4,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 16,
                  }}
                  className="
                    rounded-full
                    bg-[#17191f]
                    px-2.5
                    py-1
                    text-[8px]
                    font-black
                    text-white
                    shadow-sm
                  "
                >
                  {currentLanguage.short}
                </motion.span>
              </div>

              {/* Dialogue */}
              <div className="relative z-10 mt-2 min-h-[58px]">
                <p
                  className="
                    text-[12px]
                    font-bold
                    leading-5
                    text-[#17191f]
                  "
                >
                  {currentMessage}
                </p>
              </div>

              {/* Dialogue progress */}
              <div className="relative z-10 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {currentLanguage.messages.map((_, index) => (
                    <motion.span
                      key={index}
                      animate={{
                        width:
                          index === dialogueIndex
                            ? 12
                            : 4,
                        opacity:
                          index === dialogueIndex
                            ? 1
                            : 0.2,
                      }}
                      className="
                        h-1
                        rounded-full
                        bg-[#ff704f]
                      "
                    />
                  ))}
                </div>

                <span
                  className="
                    text-[7px]
                    font-black
                    uppercase
                    tracking-[0.1em]
                    text-black/25
                  "
                >
                  {dialogueIndex + 1}/
                  {currentLanguage.messages.length}
                </span>
              </div>

              {/* Status */}
              <div className="relative z-10 mt-2 flex items-center gap-1 text-[8px] font-black text-black/30">
                <motion.span
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                  }}
                  className="text-[#39b88d]"
                >
                  ●
                </motion.span>

                Your reading buddy
              </div>

              {/* Speech tail */}
              <motion.div
                animate={{
                  y: [0, 2, 0],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  bottom-[-12px]
                  left-1/2
                  h-6
                  w-6
                  -translate-x-1/2
                  rotate-45
                  border-b
                  border-r
                  border-white/80
                  bg-[#f8f4f4]
                "
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================================
          CENTRAL TIGER
      ========================================================== */}

      <div
        className="
          absolute
          left-1/2
          top-[54%]
          z-40
          h-[350px]
          w-[310px]
          -translate-x-1/2
          -translate-y-1/2
        "
      >
        {/* Tiger glow */}
        <motion.div
          animate={{
            scale: [0.9, 1.1, 0.9],
            opacity: [0.12, 0.32, 0.12],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[55%]
            h-60
            w-60
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-[#ffb84d]/25
            blur-[55px]
          "
        />

        {/* ========================================================
            CLOSED STATE
        ======================================================== */}

        <AnimatePresence mode="wait">
          {!isOpen && (
            <motion.button
              key="closed"
              type="button"
              onClick={onToggle}
              initial={{
                opacity: 0,
                scale: 0.65,
                y: 25,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.72,
                y: 30,
              }}
              whileHover={{
                scale: 1.07,
                y: -4,
              }}
              whileTap={{
                scale: 0.92,
              }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 18,
              }}
              className="
                absolute
                left-1/2
                top-1/2
                z-50
                h-[160px]
                w-[160px]
                -translate-x-1/2
                -translate-y-1/2
                cursor-pointer
                rounded-[36px]
                border-[3px]
                border-white
                bg-[#ff9d00]
                p-2
                shadow-[0_22px_55px_rgba(255,157,0,.32)]
                outline-none
                focus-visible:ring-4
                focus-visible:ring-[#ffb84d]/50
              "
              aria-label="Open Shakthi Mitra"
            >
              {/* Inner shine */}
              <motion.div
                animate={{
                  opacity: [0.05, 0.16, 0.05],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  inset-1
                  rounded-[32px]
                  bg-white
                "
              />

              {/* Face */}
              <motion.div
                animate={{
                  y: [0, -5, 0],
                  rotate: [-1, 1, -1],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  relative
                  z-10
                  flex
                  h-full
                  w-full
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-[30px]
                "
              >
                <img
                  src="/shakthi-face.png"
                  alt="Shakthi Mitra"
                  className="
                    h-[112%]
                    w-[112%]
                    object-contain
                    drop-shadow-[0_8px_10px_rgba(0,0,0,.18)]
                  "
                />
              </motion.div>

              {/* Sparkle */}
              <motion.span
                animate={{
                  scale: [1, 1.3, 1],
                  rotate: [0, 12, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  right-2
                  top-2
                  z-20
                  text-xl
                "
              >
                ✨
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ========================================================
            OPEN LOTTIE TIGER
        ======================================================== */}

        <AnimatePresence>
          {isOpen && (
            <motion.button
              key="open-character"
              type="button"
              onClick={onToggle}
              initial={{
                y: 180,
                scale: 0.42,
                opacity: 0,
                rotate: -5,
              }}
              animate={{
                y: 0,
                scale: 1,
                opacity: 1,
                rotate: 0,
              }}
              exit={{
                y: 160,
                scale: 0.45,
                opacity: 0,
                rotate: 5,
              }}
              transition={{
                type: 'spring',
                stiffness: 190,
                damping: 16,
                mass: 0.7,
              }}
              className="
                absolute
                bottom-0
                left-1/2
                z-50
                h-[350px]
                w-[310px]
                -translate-x-1/2
                cursor-pointer
                border-0
                bg-transparent
                p-0
                outline-none
              "
              aria-label="Close Shakthi Mitra"
            >
              {/* Pop flash */}
              <motion.div
                initial={{
                  scale: 0.2,
                  opacity: 0.85,
                }}
                animate={{
                  scale: [0.2, 1.3, 1],
                  opacity: [0.85, 0.25, 0],
                }}
                transition={{
                  duration: 0.65,
                  ease: 'easeOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  left-1/2
                  top-[48%]
                  z-0
                  h-48
                  w-48
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-full
                  bg-[#ffb84d]
                  blur-3xl
                "
              />

              {/* Floor shadow */}
              <motion.div
                animate={{
                  scaleX: [1, 0.84, 1],
                  opacity: [0.18, 0.36, 0.18],
                }}
                transition={{
                  duration: 1.7,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  bottom-1
                  left-1/2
                  z-0
                  h-5
                  w-36
                  -translate-x-1/2
                  rounded-full
                  bg-black/35
                  blur-md
                "
              />

              {/* ==================================================
                  ACTUAL JAStudio LOTTIE
              ================================================== */}

              <div
                className="
                  pointer-events-none
                  relative
                  z-10
                  h-full
                  w-full
                "
              >
                <DotLottieReact
                  src="/shakthi-mitra.lottie"
                  loop
                  autoplay
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                />
              </div>

              {/* Right sparkle */}
              <motion.div
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  rotate: [0, 15, 0],
                  x: [0, 5, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  right-0
                  top-8
                  z-20
                  text-[#ffb84d]
                "
              >
                <Sparkles className="h-8 w-8 fill-[#ffb84d]" />
              </motion.div>

              {/* Left sparkle */}
              <motion.div
                animate={{
                  y: [0, -9, 0],
                  opacity: [0.25, 1, 0.25],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  left-1
                  top-[46%]
                  z-20
                  text-[#8b7cf6]
                "
              >
                ✦
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ==========================================================
          HEAR SHAKTHI MITRA
      ========================================================== */}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.92,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 25,
              scale: 0.92,
            }}
            transition={{
              delay: 0.5,
              type: 'spring',
              stiffness: 220,
              damping: 18,
            }}
            className="
              absolute
              bottom-[-4px]
              left-1/2
              z-[80]
              w-[225px]
              -translate-x-1/2
            "
          >
            <motion.button
              type="button"
              whileHover={{
                scale: 1.025,
              }}
              whileTap={{
                scale: 0.97,
              }}
              className="
                relative
                flex
                w-full
                items-center
                justify-center
                gap-2
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-[#17191f]
                px-4
                py-3.5
                text-xs
                font-black
                text-white
                shadow-[0_18px_45px_rgba(0,0,0,.32)]
              "
            >
              <motion.span
                animate={{
                  x: ['-130%', '150%'],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 1,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  inset-y-0
                  w-16
                  -skew-x-12
                  bg-white/10
                  blur-sm
                "
              />

              <Volume2 className="relative z-10 h-4 w-4 text-[#ffb84d]" />

              <span className="relative z-10">
                Hear Shakthi Mitra
              </span>

              <div className="relative z-10 flex h-4 items-end gap-0.5">
                {[0, 1, 2, 3].map((bar) => (
                  <motion.span
                    key={bar}
                    animate={{
                      height: [5, 13, 7, 15, 5],
                    }}
                    transition={{
                      duration: 0.65 + bar * 0.1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="
                      w-1
                      rounded-full
                      bg-[#ffb84d]
                    "
                  />
                ))}
              </div>

              <ArrowRight className="relative z-10 h-3.5 w-3.5 text-white/35" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==========================================================
          CLOSED STATUS
      ========================================================== */}

      {!isOpen && (
        <motion.div
          animate={{
            opacity: [0.25, 0.7, 0.25],
            y: [0, -3, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            pointer-events-none
            absolute
            bottom-[-4px]
            left-1/2
            z-20
            -translate-x-1/2
            whitespace-nowrap
            text-[8px]
            font-black
            uppercase
            tracking-[0.18em]
            text-white/25
          "
        >
          Your reading buddy is waiting
        </motion.div>
      )}
    </div>
  );
};

export default ShakthiMitra;