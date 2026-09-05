import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';

import {
  ArrowRight,
  BookOpen,
  Heart,
  Mic,
  Sparkles,
  Star,
  Volume2,
  X,
  Zap,
} from 'lucide-react';

interface ShakthiMitraProps {
  isOpen: boolean;
  onToggle: () => void;
}

const floatingItems = [
  {
    icon: BookOpen,
    title: 'Read',
    subtitle: 'Stories',
    position: 'left-[3%] top-[24%]',
    accent: 'from-[#ff704f] to-[#ff9b54]',
    delay: 0,
  },

  {
    icon: Mic,
    title: 'Speak',
    subtitle: 'Clearly',
    position: 'left-[5%] bottom-[21%]',
    accent: 'from-[#8b7cf6] to-[#a78bfa]',
    delay: 0.12,
  },

  {
    icon: Zap,
    title: 'Learn',
    subtitle: 'New Words',
    position: 'right-[3%] top-[24%]',
    accent: 'from-[#39b88d] to-[#56d7a6]',
    delay: 0.24,
  },

  {
    icon: Heart,
    title: 'Build',
    subtitle: 'Confidence',
    position: 'right-[5%] bottom-[21%]',
    accent: 'from-[#ff5c8a] to-[#ff704f]',
    delay: 0.36,
  },
];

const sparklePositions = [
  {
    left: '12%',
    top: '13%',
    size: 'text-xl',
    delay: 0,
  },
  {
    left: '82%',
    top: '14%',
    size: 'text-lg',
    delay: 0.7,
  },
  {
    left: '20%',
    top: '77%',
    size: 'text-sm',
    delay: 1.2,
  },
  {
    left: '77%',
    top: '76%',
    size: 'text-xl',
    delay: 0.45,
  },
  {
    left: '48%',
    top: '7%',
    size: 'text-xs',
    delay: 1.4,
  },
];

export const ShakthiMitra: React.FC<
  ShakthiMitraProps
> = ({
  isOpen,
  onToggle,
}) => {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const [isHovered, setIsHovered] =
    useState(false);

  const [showWelcome, setShowWelcome] =
    useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, {
    stiffness: 180,
    damping: 22,
  });

  const smoothY = useSpring(mouseY, {
    stiffness: 180,
    damping: 22,
  });

  const rotateX = useTransform(
    smoothY,
    [-1, 1],
    [4, -4],
  );

  const rotateY = useTransform(
    smoothX,
    [-1, 1],
    [-4, 4],
  );

  const characterX = useTransform(
    smoothX,
    [-1, 1],
    [-7, 7],
  );

  const characterY = useTransform(
    smoothY,
    [-1, 1],
    [-5, 5],
  );

  useEffect(() => {
    const node =
      containerRef.current;

    if (!node) return;

    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      const rect =
        node.getBoundingClientRect();

      const x =
        ((event.clientX - rect.left) /
          rect.width -
          0.5) *
        2;

      const y =
        ((event.clientY - rect.top) /
          rect.height -
          0.5) *
        2;

      mouseX.set(x);
      mouseY.set(y);
    };

    const reset = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    node.addEventListener(
      'pointermove',
      handlePointerMove,
    );

    node.addEventListener(
      'pointerleave',
      reset,
    );

    return () => {
      node.removeEventListener(
        'pointermove',
        handlePointerMove,
      );

      node.removeEventListener(
        'pointerleave',
        reset,
      );
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (isOpen) {
      const timer =
        window.setTimeout(() => {
          setShowWelcome(true);
        }, 350);

      return () =>
        window.clearTimeout(timer);
    }

    setShowWelcome(false);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="
        relative
        flex
        h-full
        min-h-[390px]
        w-full
        items-center
        justify-center
        overflow-visible
      "
      onMouseEnter={() =>
        setIsHovered(true)
      }
      onMouseLeave={() =>
        setIsHovered(false)
      }
    >
      {/* =====================================================
          ATMOSPHERE
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          overflow-hidden
          rounded-[26px]
        "
      >
        {/* central orange aura */}

        <motion.div
          animate={{
            scale: isHovered
              ? [1, 1.14, 1]
              : [1, 1.07, 1],

            opacity: isHovered
              ? [0.28, 0.46, 0.28]
              : [0.18, 0.31, 0.18],
          }}
          transition={{
            duration: 3.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            left-1/2
            top-1/2
            h-72
            w-72
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-[#ff8a3d]/25
            blur-[75px]
          "
        />

        {/* purple drifting aura */}

        <motion.div
          animate={{
            x: [0, 35, 0],
            y: [0, -18, 0],
            opacity: [0.05, 0.18, 0.05],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            right-[-80px]
            top-[-80px]
            h-56
            w-56
            rounded-full
            bg-[#8b7cf6]/20
            blur-[75px]
          "
        />

        {/* green aura */}

        <motion.div
          animate={{
            x: [0, -25, 0],
            opacity: [0.04, 0.13, 0.04],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            bottom-[-80px]
            left-[-60px]
            h-48
            w-48
            rounded-full
            bg-[#39b88d]/15
            blur-[65px]
          "
        />

        {/* floor glow */}

        <div
          className="
            absolute
            bottom-[-100px]
            left-1/2
            h-64
            w-[420px]
            -translate-x-1/2
            rounded-full
            bg-[#ff704f]/12
            blur-[70px]
          "
        />
      </div>

      {/* =====================================================
          ORBITS
      ===================================================== */}

      <motion.div
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="
          pointer-events-none
          absolute
          left-1/2
          top-1/2
          h-[280px]
          w-[430px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-[50%]
          border
          border-white/[0.09]
        "
      />

      <motion.div
        animate={{
          rotate: -360,
        }}
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="
          pointer-events-none
          absolute
          left-1/2
          top-1/2
          h-[225px]
          w-[370px]
          -translate-x-1/2
          -translate-y-1/2
          rotate-[22deg]
          rounded-[50%]
          border
          border-[#ffb84d]/10
        "
      />

      {/* =====================================================
          FLOATING SPARKLES
      ===================================================== */}

      {sparklePositions.map(
        (
          sparkle,
          index,
        ) => (
          <motion.span
            key={index}
            animate={{
              opacity: [
                0.2,
                0.95,
                0.2,
              ],

              scale: [
                0.7,
                1.25,
                0.7,
              ],

              rotate: [
                0,
                20,
                0,
              ],
            }}
            transition={{
              duration:
                2.5 +
                index * 0.3,
              delay:
                sparkle.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`
              pointer-events-none
              absolute
              z-10
              ${sparkle.size}
              text-[#ffb84d]
            `}
            style={{
              left: sparkle.left,
              top: sparkle.top,
            }}
          >
            ✦
          </motion.span>
        ),
      )}

      {/* =====================================================
          FLOATING FEATURE CARDS
      ===================================================== */}

      <AnimatePresence>
        {isOpen &&
          floatingItems.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <motion.div
                  key={item.title}
                  initial={{
                    opacity: 0,
                    scale: 0.65,
                    y: 25,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: [0, -4, 0],
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.65,
                    y: 25,
                  }}
                  transition={{
                    opacity: {
                      duration: 0.3,
                      delay:
                        item.delay,
                    },

                    scale: {
                      type: 'spring',
                      stiffness: 260,
                      damping: 18,
                      delay:
                        item.delay,
                    },

                    y: {
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay:
                        item.delay,
                    },
                  }}
                  className={`
                    absolute
                    z-40
                    hidden
                    w-[108px]
                    rounded-2xl
                    border
                    border-white/[0.14]
                    bg-[#10131d]/80
                    p-2.5
                    shadow-[0_18px_45px_rgba(0,0,0,.28)]
                    backdrop-blur-xl
                    sm:block
                    ${item.position}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        grid
                        h-8
                        w-8
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

                      <p className="text-[8px] font-bold text-white/40">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            },
          )}
      </AnimatePresence>

      {/* =====================================================
          WELCOME SPEECH
      ===================================================== */}

      <AnimatePresence>
        {isOpen &&
          showWelcome && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.7,
                x: 20,
                y: 10,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.7,
                x: 20,
                y: 10,
              }}
              transition={{
                type: 'spring',
                stiffness: 250,
                damping: 18,
              }}
              className="
                absolute
                right-[1%]
                top-[3%]
                z-50
                hidden
                w-[185px]
                rounded-[20px]
                rounded-bl-md
                border
                border-black/[0.06]
                bg-white
                p-3.5
                shadow-[0_20px_55px_rgba(0,0,0,.18)]
                sm:block
              "
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">
                  👋
                </span>

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

              <p
                className="
                  mt-1.5
                  text-[12px]
                  font-bold
                  leading-5
                  text-[#17191f]
                "
              >
                Hi! Let's read,
                learn and grow
                together! ✨
              </p>

              <div
                className="
                  mt-2
                  flex
                  items-center
                  gap-1
                  text-[8px]
                  font-black
                  text-black/30
                "
              >
                <span className="text-[#39b88d]">
                  ●
                </span>

                Your reading buddy
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* =====================================================
          CHARACTER STAGE
      ===================================================== */}

      <motion.div
        style={{
          rotateX,
          rotateY,
        }}
        className="
          absolute
          left-1/2
          top-1/2
          z-20
          h-[300px]
          w-[265px]
          -translate-x-1/2
          -translate-y-1/2
        "
      >
        {/* character aura */}

        <motion.div
          animate={{
            scale: [
              0.92,
              1.08,
              0.92,
            ],

            opacity: [
              0.2,
              0.42,
              0.2,
          ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            left-1/2
            top-[47%]
            h-48
            w-48
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-[#ffb84d]/20
            blur-[45px]
          "
        />

        {/* portal ring */}

        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[57%]
            h-36
            w-56
            -translate-x-1/2
            -translate-y-1/2
            rounded-[50%]
            border-2
            border-[#ffb84d]/35
            shadow-[0_0_35px_rgba(255,184,77,.16)]
          "
        />

        {/* floor */}

        <motion.div
          animate={{
            scaleX: [
              1,
              0.88,
              1,
            ],

            opacity: [
              0.25,
              0.45,
              0.25,
            ],
          }}
          transition={{
            duration: 1.9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            bottom-2
            left-1/2
            h-5
            w-32
            -translate-x-1/2
            rounded-full
            bg-black/35
            blur-md
          "
        />

        {/* ===================================================
            CLOSED STATE
        =================================================== */}

        <AnimatePresence mode="wait">
          {!isOpen && (
            <motion.button
              key="closed"
              type="button"
              onClick={onToggle}
              initial={{
                opacity: 0,
                scale: 0.8,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
              }}
              whileHover={{
                scale: 1.07,
              }}
              whileTap={{
                scale: 0.95,
              }}
              className="
                absolute
                left-1/2
                top-1/2
                z-30
                h-[145px]
                w-[145px]
                -translate-x-1/2
                -translate-y-1/2
                cursor-pointer
                rounded-[34px]
                border-[3px]
                border-white
                bg-[#ff9d00]
                shadow-[0_20px_50px_rgba(255,157,0,.28)]
              "
              aria-label="Open Shakthi Mitra"
            >
              {/* animated inner glow */}

              <motion.div
                animate={{
                  opacity: [
                    0.05,
                    0.18,
                    0.05,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  inset-1
                  rounded-[30px]
                  bg-white
                "
              />

              {/* tiger */}

              <motion.div
                animate={{
                  y: [
                    0,
                    -5,
                    0,
                  ],

                  rotate: [
                    -1,
                    1,
                    -1,
                  ],
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
                  text-[74px]
                  leading-none
                "
              >
                🐯
              </motion.div>

              {/* label */}

              <motion.span
                animate={{
                  y: [
                    0,
                    -3,
                    0,
                  ],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  -bottom-10
                  left-1/2
                  -translate-x-1/2
                  whitespace-nowrap
                  rounded-full
                  border
                  border-white/80
                  bg-white/90
                  px-3
                  py-1.5
                  text-[9px]
                  font-black
                  text-[#55505a]
                  shadow-lg
                  backdrop-blur
                "
              >
                Tap Shakthi Mitra
                <span className="ml-1">
                  ✨
                </span>
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ===================================================
            OPEN STATE — FULL SVG CHARACTER
        =================================================== */}

        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="open-character"
              initial={{
                y: 130,
                scale: 0.58,
                opacity: 0,
                rotate: -4,
              }}
              animate={{
                y: 0,
                scale: 1,
                opacity: 1,
                rotate: 0,
              }}
              exit={{
                y: 120,
                scale: 0.6,
                opacity: 0,
                rotate: 4,
              }}
              transition={{
                type: 'spring',
                stiffness: 190,
                damping: 17,
                mass: 0.75,
              }}
              className="
                absolute
                bottom-0
                left-1/2
                z-30
                h-[290px]
                w-[245px]
                -translate-x-1/2
              "
            >
              {/* character shadow */}

              <motion.div
                animate={{
                  scaleX: [
                    1,
                    0.9,
                    1,
                  ],
                }}
                transition={{
                  duration: 1.7,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  bottom-1
                  left-1/2
                  z-0
                  h-5
                  w-32
                  -translate-x-1/2
                  rounded-full
                  bg-black/35
                  blur-md
                "
              />

              {/* =================================================
                  THE ORIGINAL SELF-CONTAINED SHAKTHI SVG
              ================================================= */}

              <motion.svg
                viewBox="0 0 420 500"
                className="
                  relative
                  z-10
                  h-full
                  w-full
                  overflow-visible
                  drop-shadow-[0_18px_18px_rgba(0,0,0,.28)]
                "
                role="img"
                aria-label="Shakthi Mitra tiger"
              >
                {/* tail */}

                <motion.g
                  animate={{
                    rotate: [
                      0,
                      7,
                      -6,
                      0,
                    ],
                  }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    transformOrigin:
                      '318px 355px',
                  }}
                >
                  <path
                    d="M312 350 C382 315 404 354 374 392 C358 411 336 404 342 385"
                    fill="none"
                    stroke="#E98A12"
                    strokeWidth="30"
                    strokeLinecap="round"
                  />

                  <path
                    d="M372 386 C387 378 394 366 389 351"
                    fill="none"
                    stroke="#60372C"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />
                </motion.g>

                {/* body */}

                <motion.g
                  animate={{
                    y: [
                      0,
                      -3,
                      0,
                    ],
                  }}
                  transition={{
                    duration: 1.7,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <ellipse
                    cx="210"
                    cy="345"
                    rx="112"
                    ry="126"
                    fill="#F59D18"
                  />

                  <ellipse
                    cx="210"
                    cy="363"
                    rx="62"
                    ry="91"
                    fill="#FFE0A3"
                  />

                  {/* stripes */}

                  <path
                    d="M108 318 Q135 330 150 350"
                    fill="none"
                    stroke="#663B2D"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  <path
                    d="M102 350 Q130 358 148 375"
                    fill="none"
                    stroke="#663B2D"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  <path
                    d="M312 318 Q285 330 270 350"
                    fill="none"
                    stroke="#663B2D"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  <path
                    d="M318 350 Q290 358 272 375"
                    fill="none"
                    stroke="#663B2D"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  {/* feet */}

                  <ellipse
                    cx="158"
                    cy="446"
                    rx="48"
                    ry="30"
                    fill="#E98A12"
                  />

                  <ellipse
                    cx="262"
                    cy="446"
                    rx="48"
                    ry="30"
                    fill="#E98A12"
                  />

                  <ellipse
                    cx="158"
                    cy="451"
                    rx="28"
                    ry="15"
                    fill="#FFD28A"
                  />

                  <ellipse
                    cx="262"
                    cy="451"
                    rx="28"
                    ry="15"
                    fill="#FFD28A"
                  />
                </motion.g>

                {/* waving paw */}

                <motion.g
                  animate={{
                    rotate: [
                      0,
                      13,
                      -9,
                      12,
                      0,
                    ],
                  }}
                  transition={{
                    duration: 1.15,
                    repeat: Infinity,
                    repeatDelay: 1.1,
                    ease: 'easeInOut',
                  }}
                  style={{
                    transformOrigin:
                      '118px 315px',
                  }}
                >
                  <ellipse
                    cx="112"
                    cy="326"
                    rx="39"
                    ry="70"
                    fill="#F59D18"
                    transform="rotate(-26 112 326)"
                  />

                  <circle
                    cx="86"
                    cy="267"
                    r="18"
                    fill="#F59D18"
                  />

                  <circle
                    cx="110"
                    cy="255"
                    r="18"
                    fill="#F59D18"
                  />

                  <circle
                    cx="134"
                    cy="264"
                    r="18"
                    fill="#F59D18"
                  />

                  <path
                    d="M78 271 L91 275"
                    stroke="#663B2D"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M103 259 L116 263"
                    stroke="#663B2D"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />

                  <path
                    d="M128 267 L140 270"
                    stroke="#663B2D"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </motion.g>

                {/* head */}

                <motion.g
                  animate={{
                    y: [
                      0,
                      -4,
                      0,
                    ],
                  }}
                  transition={{
                    duration: 1.7,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {/* ears */}

                  <circle
                    cx="128"
                    cy="108"
                    r="53"
                    fill="#F59D18"
                  />

                  <circle
                    cx="292"
                    cy="108"
                    r="53"
                    fill="#F59D18"
                  />

                  <circle
                    cx="128"
                    cy="108"
                    r="29"
                    fill="#F7A69C"
                  />

                  <circle
                    cx="292"
                    cy="108"
                    r="29"
                    fill="#F7A69C"
                  />

                  {/* head */}

                  <circle
                    cx="210"
                    cy="177"
                    r="116"
                    fill="#F59D18"
                  />

                  {/* forehead tuft */}

                  <path
                    d="M170 88 Q184 52 210 83 Q236 52 250 88 Q231 78 210 103 Q189 78 170 88Z"
                    fill="#C87516"
                  />

                  {/* cheek fur */}

                  <path
                    d="M115 205 Q95 225 121 231 Q103 245 134 244 Q125 262 151 252"
                    fill="#F59D18"
                  />

                  <path
                    d="M305 205 Q325 225 299 231 Q317 245 286 244 Q295 262 269 252"
                    fill="#F59D18"
                  />

                  {/* face */}

                  <ellipse
                    cx="210"
                    cy="202"
                    rx="79"
                    ry="75"
                    fill="#FFE0A3"
                  />

                  {/* stripes */}

                  <path
                    d="M186 86 L202 119"
                    stroke="#663B2D"
                    strokeWidth="15"
                    strokeLinecap="round"
                  />

                  <path
                    d="M234 86 L218 119"
                    stroke="#663B2D"
                    strokeWidth="15"
                    strokeLinecap="round"
                  />

                  <path
                    d="M115 172 L151 184"
                    stroke="#663B2D"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />

                  <path
                    d="M110 202 L147 205"
                    stroke="#663B2D"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />

                  <path
                    d="M305 172 L269 184"
                    stroke="#663B2D"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />

                  <path
                    d="M310 202 L273 205"
                    stroke="#663B2D"
                    strokeWidth="13"
                    strokeLinecap="round"
                  />

                  {/* eyes */}

                  <motion.ellipse
                    cx="169"
                    cy="171"
                    rx="10"
                    ry="18"
                    fill="#241B20"
                    animate={{
                      scaleY: [
                        1,
                        1,
                        0.08,
                        1,
                        1,
                      ],
                    }}
                    transition={{
                      duration: 4.2,
                      repeat: Infinity,
                      times: [
                        0,
                        0.82,
                        0.86,
                        0.9,
                        1,
                      ],
                    }}
                  />

                  <motion.ellipse
                    cx="251"
                    cy="171"
                    rx="10"
                    ry="18"
                    fill="#241B20"
                    animate={{
                      scaleY: [
                        1,
                        1,
                        0.08,
                        1,
                        1,
                      ],
                    }}
                    transition={{
                      duration: 4.2,
                      repeat: Infinity,
                      times: [
                        0,
                        0.82,
                        0.86,
                        0.9,
                        1,
                      ],
                    }}
                  />

                  {/* eye highlights */}

                  <circle
                    cx="172"
                    cy="166"
                    r="3.5"
                    fill="white"
                  />

                  <circle
                    cx="254"
                    cy="166"
                    r="3.5"
                    fill="white"
                  />

                  {/* muzzle */}

                  <ellipse
                    cx="210"
                    cy="221"
                    rx="52"
                    ry="41"
                    fill="#FFD0BF"
                  />

                  {/* nose */}

                  <path
                    d="M190 211 Q210 194 230 211 Q210 231 190 211Z"
                    fill="#2A2025"
                  />

                  {/* smile */}

                  <motion.path
                    d="M190 230 Q210 249 230 230"
                    fill="none"
                    stroke="#2A2025"
                    strokeWidth="7"
                    strokeLinecap="round"
                    animate={{
                      scaleX: [
                        1,
                        1.07,
                        1,
                      ],
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.g>

                {/* front paw */}

                <motion.g
                  animate={{
                    y: [
                      0,
                      -4,
                      0,
                    ],
                  }}
                  transition={{
                    duration: 1.7,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.1,
                  }}
                >
                  <ellipse
                    cx="286"
                    cy="348"
                    rx="40"
                    ry="70"
                    fill="#F59D18"
                    transform="rotate(22 286 348)"
                  />

                  <ellipse
                    cx="286"
                    cy="382"
                    rx="28"
                    ry="22"
                    fill="#FFD28A"
                  />
                </motion.g>
              </motion.svg>

              {/* character sparkles */}

              <motion.div
                animate={{
                  scale: [
                    0.8,
                    1.18,
                    0.8,
                  ],

                  rotate: [
                    0,
                    12,
                    0,
                  ],

                  x: [
                    0,
                    5,
                    0,
                  ],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  -right-1
                  top-4
                  z-20
                  text-[#ffb84d]
                "
              >
                <Sparkles className="h-8 w-8 fill-[#ffb84d]" />
              </motion.div>

              <motion.div
                animate={{
                  y: [
                    0,
                    -10,
                    0,
                  ],

                  opacity: [
                    0.2,
                    1,
                    0.2,
                  ],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  left-3
                  top-[45%]
                  z-20
                  text-[#8b7cf6]
                "
              >
                ✦
              </motion.div>

              <motion.div
                animate={{
                  y: [
                    0,
                    12,
                    0,
                  ],

                  opacity: [
                    0.2,
                    1,
                    0.2,
                  ],
                }}
                transition={{
                  duration: 2.7,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  right-1
                  top-[58%]
                  z-20
                  text-[#39b88d]
                "
              >
                ✦
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* =====================================================
          OPEN STATE ACTION BAR
      ===================================================== */}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 25,
            }}
            transition={{
              delay: 0.3,
            }}
            className="
              absolute
              bottom-[-4px]
              left-1/2
              z-[60]
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
                cursor-pointer
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
              {/* moving shine */}

              <motion.span
                animate={{
                  x: [
                    '-130%',
                    '150%',
                  ],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 1,
                  ease: 'easeInOut',
                }}
                className="
                  absolute
                  inset-y-0
                  w-16
                  -skew-x-12
                  bg-white/10
                  blur-sm
                "
              />

              <Volume2
                className="
                  relative
                  z-10
                  h-4
                  w-4
                  text-[#ffb84d]
                "
              />

              <span className="relative z-10">
                Hear Shakthi Mitra
              </span>

              <div className="relative z-10 flex h-4 items-end gap-0.5">
                {[0, 1, 2, 3].map(
                  (bar) => (
                    <motion.span
                      key={bar}
                      animate={{
                        height: [
                          5,
                          13,
                          7,
                          15,
                          5,
                        ],
                      }}
                      transition={{
                        duration:
                          0.65 +
                          bar * 0.1,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="
                        w-1
                        rounded-full
                        bg-[#ffb84d]
                      "
                    />
                  ),
                )}
              </div>

              <ArrowRight
                className="
                  relative
                  z-10
                  h-3.5
                  w-3.5
                  text-white/35
                "
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================
          CLOSED IDLE HINT
      ===================================================== */}

      {!isOpen && (
        <motion.div
          animate={{
            opacity: [
              0.25,
              0.7,
              0.25,
            ],
            y: [
              0,
              -3,
              0,
            ],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            pointer-events-none
            absolute
            bottom-[-2px]
            left-1/2
            z-30
            -translate-x-1/2
            whitespace-nowrap
            text-[9px]
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