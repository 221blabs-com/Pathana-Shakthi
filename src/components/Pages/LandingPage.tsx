import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { animate, stagger } from 'animejs';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { PathanaShakthiLogo } from '../PathanaShakthiLogo';
import { ShakthiMitra } from '../home/ShakthiMitra';
import { kidSpeech } from '../../services/speechSynthesis';
import { soundEffects } from '../../services/soundEffects';
import ClickSpark from '../home/ClickSpark';

interface LandingPageProps {
  onNavigate: (route: string) => void;
}

type LanguageName = 'Telugu' | 'Hindi' | 'English';

const languages: LanguageName[] = ['Telugu', 'Hindi', 'English'];

const languageLabels: Record<LanguageName, string> = {
  Telugu: 'తెలుగు',
  Hindi: 'हिन्दी',
  English: 'English',
};

const samplePhrases: Record<
  LanguageName,
  { text: string; translit: string; meaning: string }
> = {
  Telugu: {
    text: 'నమస్కారం! నేను శక్తి మిత్రను. నాతో కలిసి రోజూ తెలుగు కథలు చదువుకుందాం!',
    translit:
      'Namaskaaram! Nenu Shakthi Mitranu. Naatho kalisi rooju Telugu kathalu chaduvukundaam!',
    meaning:
      'Hello! I am Shakthi Mitra. Let us read Telugu stories together every day!',
  },
  Hindi: {
    text: 'नमस्ते! मैं शक्ति मित्र हूँ। आओ मिलकर हर दिन प्यारी-प्यारी कहानियाँ पढ़ें!',
    translit:
      'Namaste! Main Shakti Mitra hoon. Aao milkar har din pyaari-pyaari kahaaniyaan padhein!',
    meaning:
      'Hello! I am Shakthi Mitra. Let us read lovely stories together every day!',
  },
  English: {
    text: 'Hello friends! I am Shakthi Mitra. Let us explore exciting stories and master reading fluency!',
    translit: 'Hello friends! I am Shakthi Mitra.',
    meaning:
      'Interactive read-along companion for Class 1 to 5 children.',
  },
};

const learningCards = [
  {
    icon: '📖',
    title: 'Read Along',
    label: '01 / STORY MODE',
    description:
      'Follow every word as it comes alive with synchronized highlighting and narration.',
    detail: 'Highlighted words + natural narration.',
    gradient: 'from-[#ffb84d] to-[#ff7657]',
    glow: 'bg-orange-300/40',
  },
  {
    icon: '🎙️',
    title: 'Speak & Practice',
    label: '02 / VOICE MODE',
    description:
      'Read aloud, practise pronunciation, and build confidence with child-friendly feedback.',
    detail: 'Voice practice + pronunciation feedback.',
    gradient: 'from-[#ff7d69] to-[#ff5c9a]',
    glow: 'bg-pink-300/35',
  },
  {
    icon: '🧠',
    title: 'Learn Words',
    label: '03 / DISCOVERY MODE',
    description:
      'Tap unfamiliar words, hear them spoken, and grow your vocabulary naturally.',
    detail: 'Discover + hear + remember.',
    gradient: 'from-[#8b7cf6] to-[#5e7bff]',
    glow: 'bg-violet-300/35',
  },
  {
    icon: '🏆',
    title: 'Grow Your Streak',
    label: '04 / PROGRESS MODE',
    description:
      'Keep reading, collect stars, build streaks, and make progress visible.',
    detail: 'Stars + streaks + visible progress.',
    gradient: 'from-[#46c79b] to-[#38a9c8]',
    glow: 'bg-emerald-300/35',
  },
];

const stats = [
  { value: '3', label: 'Languages', icon: Sparkles },
  { value: '1–5', label: 'Classes', icon: BookOpen },
];

const techPills = [
  'READ ALONG',
  'VOICE PRACTICE',
  'VOCABULARY DISCOVERY',
  'TELUGU • HINDI • ENGLISH',
  'CLASSES 1–5',
  'STREAKS & PROGRESS',
];

const HomeAtmosphere: React.FC = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 52 }, (_, id) => ({
        id,
        x: (id * 37.7 + 11) % 100,
        y: (id * 61.3 + 7) % 100,
        size: 1.5 + ((id * 17) % 8) / 2,
        delay: (id % 9) * 0.37,
        duration: 2.6 + (id % 7) * 0.45,
        opacity: 0.18 + ((id * 13) % 60) / 100,
      })),
    [],
  );

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const smoothX = useSpring(pointerX, {
    stiffness: 70,
    damping: 24,
    mass: 0.7,
  });
  const smoothY = useSpring(pointerY, {
    stiffness: 70,
    damping: 24,
    mass: 0.7,
  });

  const glowX = useTransform(smoothX, [-1, 1], ['20%', '80%']);
  const glowY = useTransform(smoothY, [-1, 1], ['20%', '75%']);
  const layerX = useTransform(smoothX, [-1, 1], [-18, 18]);
  const layerY = useTransform(smoothY, [-1, 1], [-12, 12]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 2);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    return () =>
      window.removeEventListener('pointermove', handlePointerMove);
  }, [pointerX, pointerY]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.09),transparent_42%),radial-gradient(circle_at_85%_45%,rgba(249,115,22,0.07),transparent_32%)]" />

      <motion.div
        style={{ left: glowX, top: glowY }}
        className="absolute h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/10 blur-[90px]"
      />

      <motion.div style={{ x: layerX, y: layerY }} className="absolute inset-0">
        {stars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              boxShadow: `0 0 ${star.size * 3}px rgba(245,158,11,0.42)`,
            }}
            animate={{
              opacity: [star.opacity * 0.35, star.opacity, star.opacity * 0.35],
              scale: [0.7, 1.25, 0.7],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>

      <motion.div
        style={{
          x: useTransform(smoothX, [-1, 1], [-8, 8]),
          y: useTransform(smoothY, [-1, 1], [-6, 6]),
        }}
        className="absolute left-[9%] top-[20%] h-24 w-24 rounded-full border border-amber-300/15"
      />

      <motion.div
        style={{
          x: useTransform(smoothX, [-1, 1], [10, -10]),
          y: useTransform(smoothY, [-1, 1], [7, -7]),
        }}
        className="absolute right-[12%] top-[28%] h-40 w-40 rounded-full border border-orange-300/10"
      />
    </div>
  );
};

const MagneticButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'dark';
  className?: string;
  disabled?: boolean;
}> = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}) => {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const sx = useSpring(x, { stiffness: 280, damping: 18 });
  const sy = useSpring(y, { stiffness: 280, damping: 18 });

  const handleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion) return;

    const rect = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 10);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 8);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const styles =
    variant === 'primary'
      ? 'bg-[#ff704f] text-white shadow-[0_16px_40px_rgba(255,112,79,0.28)] hover:bg-[#ff6240]'
      : variant === 'dark'
        ? 'bg-[#17191f] text-white shadow-[0_16px_40px_rgba(23,25,31,0.2)] hover:bg-[#242731]'
        : 'border border-white/[0.14] bg-white/[0.07] text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] hover:bg-white/[0.12]';

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={reducedMotion ? undefined : { x: sx, y: sy }}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      className={`group relative inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </motion.button>
  );
};

const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  const reducedMotion = useReducedMotion();
  const px = useMotionValue(50);
  const py = useMotionValue(50);

  const rx = useSpring(useTransform(py, [0, 100], [3, -3]), {
    stiffness: 220,
    damping: 24,
  });
  const ry = useSpring(useTransform(px, [0, 100], [-3, 3]), {
    stiffness: 220,
    damping: 24,
  });

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return;

    const rect = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - rect.left) / rect.width) * 100);
    py.set(((event.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <motion.div
      onPointerMove={move}
      onPointerLeave={() => {
        px.set(50);
        py.set(50);
      }}
      onClick={onClick}
      style={
        reducedMotion
          ? undefined
          : { rotateX: rx, rotateY: ry, transformPerspective: 1200 }
      }
      className={`group relative overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-24 rounded-full bg-[radial-gradient(circle,rgba(255,112,79,0.16),transparent_58%)] blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          left: useTransform(px, [0, 100], ['15%', '85%']),
          top: useTransform(py, [0, 100], ['15%', '85%']),
        }}
      />
      {children}
    </motion.div>
  );
};

const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{
      duration: 0.7,
      delay,
      ease: [0.22, 1, 0.36, 1],
    }}
    className={className}
  >
    {children}
  </motion.div>
);

const LearningCard: React.FC<{
  card: (typeof learningCards)[number];
  expanded: boolean;
  onToggle: () => void;
}> = ({ card, expanded, onToggle }) => {
  const reducedMotion = useReducedMotion();

  return (
    <SpotlightCard
      onClick={onToggle}
      className="h-full rounded-[28px] border border-black/[0.07] bg-white/75 p-6 shadow-[0_20px_60px_rgba(28,25,23,0.07)] backdrop-blur-xl"
    >
      <div
        className={`absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl ${card.glow}`}
      />
      <div
        className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${card.gradient}`}
      />

      <div className="relative z-10 flex h-full min-h-[300px] flex-col">
        <div className="flex items-start justify-between">
          <motion.div
            whileHover={
              reducedMotion ? undefined : { rotate: -6, scale: 1.08 }
            }
            className="grid h-14 w-14 place-items-center rounded-2xl border border-black/[0.05] bg-[#f8f6f1] text-3xl shadow-sm"
          >
            {card.icon}
          </motion.div>

          <span className="rounded-full bg-[#17191f]/[0.05] px-2.5 py-1 text-[9px] font-black tracking-[0.14em] text-black/45">
            {card.label}
          </span>
        </div>

        <div className="mt-8">
          <h3 className="text-2xl font-black tracking-tight text-[#17191f]">
            {card.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-black/55">
            {card.description}
          </p>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-2xl bg-[#f8f6f1] px-4 py-3 text-xs font-bold text-black/55">
                  ✦ {card.detail}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-auto flex items-center justify-between pt-8">
          <span className="text-xs font-black text-black/40">
            {expanded ? 'Collapse' : 'Explore feature'}
          </span>

          <motion.span
            animate={
              reducedMotion
                ? undefined
                : { x: expanded ? 4 : 0, rotate: expanded ? 90 : 0 }
            }
            className="grid h-9 w-9 place-items-center rounded-full bg-[#17191f] text-white shadow-lg"
          >
            <ArrowRight className="h-4 w-4" />
          </motion.span>
        </div>
      </div>
    </SpotlightCard>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const reducedMotion = useReducedMotion();

  const [activeLanguage, setActiveLanguage] =
    useState<LanguageName>('Telugu');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [isMascotOpen, setIsMascotOpen] = useState(false);

  const pageRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 22 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 22 });
  const heroX = useTransform(smoothX, [-1, 1], [-12, 12]);
  const heroY = useTransform(smoothY, [-1, 1], [-8, 8]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const onMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      mouseX.set((event.clientX / window.innerWidth - 0.5) * 2);
      mouseY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };

    page.addEventListener('pointermove', onMove);
    return () => page.removeEventListener('pointermove', onMove);
  }, [mouseX, mouseY, reducedMotion]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || reducedMotion) return;

    const targets = hero.querySelectorAll('[data-hero-reveal]');

    animate(targets, {
      opacity: [0, 1],
      translateY: [32, 0],
      duration: 850,
      delay: stagger(90),
      ease: 'out(4)',
    });

    return () => {
      targets.forEach((target) => {
        try {
          animate(target, {
            opacity: 1,
            translateY: 0,
            duration: 0,
          });
        } catch {
          // Animation cleanup.
        }
      });
    };
  }, [reducedMotion]);

  const handleNavigate = (route: string) => {
    soundEffects.playPageTurn();

    if (route === 'student_library') {
      soundEffects.playStarChime();
    }

    onNavigate(route);
  };

  const handleRoleLogin = (
    role: 'student' | 'faculty' | 'admin',
  ) => {
    soundEffects.playPageTurn();
    sessionStorage.setItem('pathanaShakthiLoginRole', role);
    onNavigate('login');
  };


  const handleLanguageChange = (language: LanguageName) => {
    if (language === activeLanguage) return;
    soundEffects.playWordPop();
    setActiveLanguage(language);
  };

  const activePhrase = useMemo(
    () => samplePhrases[activeLanguage],
    [activeLanguage],
  );

  return (
    <ClickSpark>
      <div
        ref={pageRef}
        className="min-h-screen overflow-hidden bg-[#f5f2ea] text-[#17191f]"
      >
      <style>{`
        .ps-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E");
        }

        .ps-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,.9), transparent 82%);
        }

        .ps-space {
          background:
            radial-gradient(circle at 68% 22%, rgba(255,112,79,.17), transparent 25%),
            radial-gradient(circle at 82% 34%, rgba(139,124,246,.20), transparent 28%),
            radial-gradient(circle at 40% 86%, rgba(255,184,77,.16), transparent 32%),
            linear-gradient(180deg, #050914 0%, #07101d 54%, #11101a 100%);
        }

        .ps-stars {
          background-image:
            radial-gradient(circle at 8% 20%, rgba(255,255,255,.9) 0 1px, transparent 2px),
            radial-gradient(circle at 18% 65%, rgba(255,184,77,.85) 0 1.5px, transparent 2.5px),
            radial-gradient(circle at 31% 13%, rgba(255,255,255,.75) 0 1px, transparent 2px),
            radial-gradient(circle at 47% 31%, rgba(139,124,246,.9) 0 1.5px, transparent 2.5px),
            radial-gradient(circle at 61% 14%, rgba(255,255,255,.8) 0 1px, transparent 2px),
            radial-gradient(circle at 74% 62%, rgba(255,184,77,.9) 0 1px, transparent 2px),
            radial-gradient(circle at 88% 20%, rgba(255,255,255,.8) 0 1px, transparent 2px),
            radial-gradient(circle at 93% 72%, rgba(139,124,246,.8) 0 1px, transparent 2px);
        }

        .ps-orbit {
          border: 1px solid rgba(255,255,255,.12);
          box-shadow: 0 0 50px rgba(255,112,79,.08);
        }

        .ps-glow-text {
          background: linear-gradient(100deg, #ff704f 0%, #ff9b54 42%, #8b7cf6 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .ps-marquee-viewport {
          width: 100%;
          overflow: hidden;
        }

        .ps-marquee-track {
          display: flex;
          width: max-content;
          transform: translate3d(0, 0, 0);
          animation: ps-marquee-scroll 72s linear infinite;
          will-change: transform;
        }

        .ps-marquee-sequence {
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 2rem;
          padding-left: 1.5rem;
          padding-right: 2rem;
          white-space: nowrap;
        }

        .ps-marquee-track:hover {
          animation-play-state: paused;
        }

        @keyframes ps-marquee-scroll {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ps-marquee-track {
            animation: none;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-0 ps-noise opacity-40" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[900px] ps-grid" />
      {/* =====================================================
          HERO
      ===================================================== */}
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden px-4 pb-20 pt-24 text-white sm:px-6 sm:pt-28 lg:px-8 lg:pb-28 lg:pt-32 ps-space"
      >
        <HomeAtmosphere />

        <div className="pointer-events-none absolute inset-0 z-0 ps-stars opacity-80" />

        <div className="pointer-events-none absolute left-1/2 top-[8%] z-0 h-[520px] w-[780px] -translate-x-1/2 rotate-[-12deg] rounded-full ps-orbit opacity-60" />

        <div className="pointer-events-none absolute left-[54%] top-[15%] z-0 h-[430px] w-[720px] -translate-x-1/2 rotate-[18deg] rounded-full border border-[#8b7cf6]/20" />

        <div className="pointer-events-none absolute right-[-100px] top-[12%] z-0 h-44 w-44 rounded-full bg-[#ffb84d]/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-[-120px] left-[42%] z-0 h-72 w-72 rounded-full bg-[#ff704f]/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-[-180px] z-0 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#ff704f]/12 blur-[120px]" />
        <div className="pointer-events-none absolute right-[-180px] top-[30%] z-0 h-[420px] w-[420px] rounded-full bg-[#8b7cf6]/12 blur-[110px]" />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
          <motion.div
            style={reducedMotion ? undefined : { x: heroX, y: heroY }}
            className="text-center lg:text-left"
          >
            <h1
              data-hero-reveal
              className="mt-7 text-[3.55rem] font-black leading-[.93] tracking-[-0.065em] sm:text-7xl lg:text-[6.25rem]"
            >
              Reading
              <br />
              <span className="ps-glow-text">just got</span>
              <br />
              <span className="relative inline-block">
                magical.
                <motion.span
                  animate={
                    reducedMotion
                      ? undefined
                      : { width: ['20%', '88%', '20%'] }
                  }
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute -bottom-1 left-0 h-2 rounded-full bg-[#ffb84d]/70"
                />
              </span>
            </h1>

            <p
              data-hero-reveal
              className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/60 sm:text-lg lg:mx-0"
            >
              <strong className="text-white">Pathana Shakthi</strong> turns reading practice into
              an interactive adventure — stories, voices, speaking practice, vocabulary discovery
              and progress students can see.
            </p>

            <div
              data-hero-reveal
              className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <MagneticButton onClick={() => handleRoleLogin('student')}>
                <BookOpen className="h-5 w-5" />
                Start Reading
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </MagneticButton>

            </div>

            <div
              data-hero-reveal
              className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs font-bold text-white/55 lg:justify-start"
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#39b88d]" />
                Class 1–5
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#ff9b54]" />
                3 Languages
              </span>

            </div>
          </motion.div>

          <Reveal className="relative">
            <div
              className="relative mx-auto min-h-[650px] w-full max-w-[560px] overflow-visible"
            >
              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute left-1/2 top-[38%] h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.10]"
                style={{
                  transform:
                    'translate(-50%, -50%) rotate(18deg) scaleY(.58)',
                }}
              />

              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute left-1/2 top-[38%] h-[445px] w-[445px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8b7cf6]/15"
                style={{
                  transform:
                    'translate(-50%, -50%) rotate(-24deg) scaleY(.48)',
                }}
              />

              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffb84d]/10"
                style={{
                  transform:
                    'translate(-50%, -50%) rotate(12deg) scaleY(.38)',
                }}
              />

              <motion.div
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        scale: [0.92, 1.08, 0.92],
                        opacity: [0.28, 0.48, 0.28],
                      }
                }
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute left-1/2 top-[38%] h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff704f]/20 blur-[85px]"
              />

              <motion.div
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        scale: [1, 1.15, 1],
                        opacity: [0.12, 0.28, 0.12],
                      }
                }
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}
                className="pointer-events-none absolute left-1/2 top-[38%] h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b7cf6]/25 blur-[70px]"
              />

              <motion.span
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : { y: [-8, 8, -8], rotate: [0, 12, 0], scale: [0.9, 1.1, 0.9] }
                }
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute left-[10%] top-[22%] text-2xl text-[#ff704f]/70"
              >
                ✦
              </motion.span>

              <motion.span
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : { y: [7, -7, 7], rotate: [0, -15, 0], scale: [1, 1.18, 1] }
                }
                transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute right-[9%] top-[25%] text-xl text-[#8b7cf6]/75"
              >
                ✦
              </motion.span>

              <motion.span
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : { y: [-5, 6, -5], scale: [0.8, 1.15, 0.8] }
                }
                transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute left-[17%] top-[48%] text-sm text-[#ffb84d]/85"
              >
                ✦
              </motion.span>

              <motion.span
                aria-hidden="true"
                animate={
                  reducedMotion
                    ? undefined
                    : { y: [5, -5, 5], scale: [0.9, 1.12, 0.9] }
                }
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute right-[17%] top-[49%] text-sm text-[#39b88d]/85"
              >
                ✦
              </motion.span>

              {/* Main mascot — intentionally no "Your reading buddy / READY" pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.72, y: 55 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 145,
                  damping: 17,
                  mass: 0.85,
                  delay: 0.12,
                }}
                className="absolute left-1/2 top-[7%] z-20 h-[430px] w-[430px] -translate-x-1/2"
              >
                <motion.div
                  aria-hidden="true"
                  animate={reducedMotion ? undefined : { rotate: -360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                  className="pointer-events-none absolute inset-[18px] rounded-full border border-dashed border-[#ffb84d]/20"
                />

                <motion.div
                  aria-hidden="true"
                  animate={
                    reducedMotion
                      ? undefined
                      : {
                          scale: [1, 1.035, 1],
                          opacity: [0.35, 0.65, 0.35],
                        }
                  }
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-[62px] rounded-full border border-[#ff704f]/10"
                />

                <motion.div
                  animate={
                    reducedMotion
                      ? undefined
                      : {
                          y: [-5, 5, -5],
                          rotate: [-0.7, 0.7, -0.7],
                        }
                  }
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex h-full w-full items-center justify-center"
                >
                  <ShakthiMitra
                    isOpen={isMascotOpen}
                    onToggle={() => {
                      soundEffects.playWordPop();
                      setIsMascotOpen((open) => !open);
                    }}
                  />
                </motion.div>
              </motion.div>

              <AnimatePresence mode="wait">
                {!isMascotOpen ? (
                  <motion.button
                    key="meet"
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      setIsMascotOpen(true);
                    }}
                    initial={{ opacity: 0, y: 12, scale: 0.88 }}
                    animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
                    exit={{ opacity: 0, scale: 0.82, y: 8 }}
                    transition={{
                      y: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                      opacity: { duration: 0.25 },
                      scale: { duration: 0.25 },
                    }}
                    whileHover={{ scale: 1.07, y: -5 }}
                    whileTap={{ scale: 0.92 }}
                    className="absolute bottom-[18%] left-1/2 z-40 -translate-x-1/2 cursor-pointer rounded-full border border-white/30 bg-white px-5 py-3 text-[10px] font-black text-[#17191f] shadow-[0_16px_45px_rgba(0,0,0,.28)]"
                  >
                    <span className="mr-1.5">✨</span>
                    Tap Shakthi Mitra
                    <span className="ml-1.5">🐯</span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="mitra-open"
                    initial={{ opacity: 0, y: 12, scale: 0.88 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 22,
                    }}
                    className="absolute bottom-[17%] left-1/2 z-40 -translate-x-1/2"
                  >
                    <div className="flex items-center gap-2 rounded-full border border-[#ffb84d]/20 bg-[#050914]/85 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
                      <span className="text-xs">✨</span>
                      <span className="text-[9px] font-black text-white/65">
                        Mitra is ready to help!
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playWordPop();
                          setIsMascotOpen(false);
                        }}
                        className="cursor-pointer rounded-full bg-white/10 px-2.5 py-1 text-[8px] font-black text-white/55 transition-colors hover:bg-white/15 hover:text-white"
                      >
                        CLOSE
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.55 }}
                className="absolute bottom-[7%] left-1/2 z-30 -translate-x-1/2"
              >
                <div className="flex rounded-full border border-white/10 bg-[#050914]/80 p-1 shadow-2xl backdrop-blur-xl">
                  {languages.map((language) => (
                    <motion.button
                      key={language}
                      type="button"
                      onClick={() => handleLanguageChange(language)}
                      whileTap={reducedMotion ? undefined : { scale: 0.92 }}
                      className={`relative cursor-pointer rounded-full px-4 py-2 text-[10px] font-black ${
                        activeLanguage === language
                          ? 'text-[#17191f]'
                          : 'text-white/35 hover:text-white/75'
                      }`}
                    >
                      {activeLanguage === language && (
                        <motion.span
                          layoutId="hero-language-pill"
                          className="absolute inset-0 rounded-full bg-white"
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative z-10">
                        {languageLabels[language]}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeLanguage}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.35 }}
                  className="absolute bottom-[-2%] left-1/2 z-30 w-[88%] -translate-x-1/2"
                >
                  <div className="relative rounded-[24px] border border-white/10 bg-[#050914]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,.32)] backdrop-blur-xl">
                    <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-[#050914]" />

                    <p className="relative text-center text-xs font-bold leading-6 text-white/80">
                      {activePhrase.text}
                    </p>

                    {activeLanguage !== 'English' && (
                      <p className="mt-1.5 text-center text-[9px] italic text-white/25">
                        {activePhrase.translit}
                      </p>
                    )}

                    <p className="mt-2 text-center text-[9px] font-semibold text-[#ff704f]">
                      {activePhrase.meaning}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

            </div>
          </Reveal>
        </div>

        <div className="relative z-10 mx-auto mt-16 grid max-w-3xl grid-cols-2 overflow-hidden rounded-2xl border border-white/[0.14] bg-white/[0.07] shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`flex items-center justify-center gap-2.5 px-3 py-4 sm:gap-3 sm:px-5 ${
                  index !== 0 ? 'border-l border-white/[0.10]' : ''
                }`}
              >
                <Icon className="h-4 w-4 text-[#ff704f]" />
                <div>
                  <span className="text-sm font-black text-white sm:text-base">
                    {stat.value}
                  </span>
                  <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-white/40 sm:text-[10px]">
                    {stat.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          MARQUEE
      ===================================================== */}
      <section
        className="relative overflow-hidden border-y border-black/[0.06] bg-[#17191f] py-4"
        aria-label="Pathana Shakthi highlights"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#17191f] to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#17191f] to-transparent"
          aria-hidden="true"
        />

        <div className="ps-marquee-viewport">
          <div className="ps-marquee-track">
            {[0, 1].map((sequence) => (
              <div
                key={sequence}
                className="ps-marquee-sequence"
                aria-hidden={sequence === 1}
              >
                {Array.from({ length: 8 }, (_, repeatIndex) => (
                  <React.Fragment key={`${sequence}-${repeatIndex}`}>
                    {techPills.map((pill, index) => (
                      <React.Fragment key={`${sequence}-${repeatIndex}-${pill}-${index}`}>
                        <span className="text-[10px] font-black tracking-[0.22em] text-white/55">
                          {pill}
                        </span>
                        <span className="text-[#ff704f]" aria-hidden="true">
                          ✦
                        </span>
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          LEARNING EXPERIENCE
      ===================================================== */}
      <section className="relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#ff704f]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#d94f35]">
              <Sparkles className="h-3.5 w-3.5" />
              More than reading
            </span>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              A reading app that
              <span className="ps-glow-text"> reacts.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-black/50 sm:text-base">
              Every interaction gives students a tiny moment of feedback — movement, sound,
              progress, discovery and reward.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {learningCards.map((card, index) => (
              <Reveal key={card.title} delay={index * 0.06} className="h-full">
                <LearningCard
                  card={card}
                  expanded={expandedCard === index}
                  onToggle={() =>
                    setExpandedCard((current) =>
                      current === index ? null : index,
                    )
                  }
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          TECHNOLOGY
      ===================================================== */}
      <section className="relative px-4 pt-8 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal className="text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f35]">
              Built for real classrooms
            </span>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Powerful technology.
              <br />
              <span className="text-black/35">Simple experience.</span>
            </h2>
          </Reveal>

          <div className="mx-auto mt-12 grid w-full max-w-[1200px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
  {[
    {
      icon: Mic,
      title: 'Speech Practice',
      sub: 'Voice-first learning',
      color: 'text-[#ff704f]',
    },
    {
      icon: BrainCircuit,
      title: 'Smart Learning',
      sub: 'Vocabulary discovery',
      color: 'text-[#8b7cf6]',
    },
    {
      icon: Sparkles,
      title: '3 Languages',
      sub: 'Telugu • Hindi • English',
      color: 'text-[#ffb84d]',
    },
  ].map((item, index) => {
    const Icon = item.icon;

    return (
      <Reveal key={item.title} delay={index * 0.05}>
        <motion.div
          whileHover={reducedMotion ? undefined : { y: -8, scale: 1.02 }}
          className="group relative overflow-hidden rounded-[24px] border border-black/[0.07] bg-white/70 p-6 shadow-[0_18px_50px_rgba(30,25,20,0.05)] backdrop-blur"
        >
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#ff704f]/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />

          <Icon className={`relative h-7 w-7 ${item.color}`} />

          <p className="relative mt-5 text-sm font-black">
            {item.title}
          </p>

          <p className="relative mt-1 text-xs font-semibold text-black/35">
            {item.sub}
          </p>
        </motion.div>
      </Reveal>
    );
  })}
</div>
        </div>
      </section>

      {/* =====================================================
          ROLE GATEWAY
      ===================================================== */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[34px] bg-[#17191f] px-6 py-12 shadow-[0_35px_100px_rgba(20,20,20,0.18)] sm:px-10 lg:px-14 lg:py-16">
            <div className="absolute -right-24 -top-40 h-[430px] w-[430px] rounded-full bg-[#ff704f]/15 blur-[100px]" />
            <div className="absolute -bottom-40 -left-20 h-[380px] w-[380px] rounded-full bg-[#8b7cf6]/15 blur-[100px]" />

            <div className="relative z-10">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffb84d]">
                  <Sparkles className="h-4 w-4" />
                  Choose your adventure
                </span>

                <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">
                  One platform.
                  <br />
                  <span className="text-white/35">Three ways in.</span>
                </h2>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/40">
                  Students explore stories, teachers manage learning, and school admins support
                  the whole classroom.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    loginRole: 'student' as const,
                    title: "I'm a Student",
                    sub: 'Explore stories & earn stars',
                    icon: BookOpen,
                    active: true,
                  },
                  {
                    loginRole: 'faculty' as const,
                    title: "I'm a Teacher",
                    sub: 'Create & manage learning',
                    icon: GraduationCap,
                    active: false,
                  },
                  {
                    loginRole: 'admin' as const,
                    title: 'School Admin',
                    sub: 'Support the whole classroom',
                    icon: ShieldCheck,
                    active: false,
                  },
                ].map((role) => {
                  const Icon = role.icon;

                  return (
                    <motion.button
                      key={role.loginRole}
                      type="button"
                      onClick={() => handleRoleLogin(role.loginRole)}
                      whileHover={
                        reducedMotion ? undefined : { y: -7, scale: 1.015 }
                      }
                      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                      className={`group relative cursor-pointer overflow-hidden rounded-[24px] p-5 text-left ${
                        role.active
                          ? 'bg-[#ff704f] text-white shadow-[0_20px_50px_rgba(255,112,79,0.2)]'
                          : 'border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`grid h-11 w-11 place-items-center rounded-xl ${
                            role.active ? 'bg-white/15' : 'bg-white/[0.07]'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </div>

                      <h3 className="mt-6 text-lg font-black">{role.title}</h3>

                      <p
                        className={`mt-1 text-xs font-semibold ${
                          role.active ? 'text-white/65' : 'text-white/35'
                        }`}
                      >
                        {role.sub}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}
      <footer className="border-t border-black/[0.07] bg-[#eeebe3] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-xs text-black/40 sm:flex-row">
          <div className="flex items-center gap-3">
            <PathanaShakthiLogo size="sm" showSubtitle={false} />
            <span>— Interactive Multilingual Read-Along Companion</span>
          </div>

          <div className="flex items-center gap-2 font-black">
            <span>Telugu</span>
            <span>•</span>
            <span>Hindi</span>
            <span>•</span>
            <span>English</span>
          </div>
        </div>
      </footer>
      </div>
    </ClickSpark>
  );
};