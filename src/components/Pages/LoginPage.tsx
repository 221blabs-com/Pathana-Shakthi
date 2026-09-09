import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { UserRole, UserSession } from '../../types';
import { authService } from '../../services/authService';
import { REAL_STUDENTS } from '../../data/studentsData';
import { REAL_FACULTY_MEMBERS } from '../../data/facultyData';
import { soundEffects } from '../../services/soundEffects';
import { PathanaShakthiLogo } from '../PathanaShakthiLogo';

import {
  User,
  GraduationCap,
  School,
  Lock,
  ArrowRight,
  Sparkles,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  onNavigate: (route: string) => void;
}

type RoleConfig = {
  id: UserRole;
  label: string;
  telugu: string;
  description: string;
  icon: React.ElementType;
};


/* ============================================================
   REACT BITS-STYLE MICRO COMPONENTS
   Spotlight Card • Tilted Card • Shiny Text
   These are kept local so LoginPage stays drop-in.
============================================================ */

const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    el.style.setProperty(
      '--spot-x',
      `${event.clientX - rect.left}px`,
    );
    el.style.setProperty(
      '--spot-y',
      `${event.clientY - rect.top}px`,
    );
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={`group/spotlight relative overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spotlight:opacity-100"
        style={{
          background:
            'radial-gradient(240px circle at var(--spot-x) var(--spot-y), rgba(251,146,60,0.16), transparent 68%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spotlight:opacity-100"
        style={{
          background:
            'radial-gradient(500px circle at var(--spot-x) var(--spot-y), rgba(255,255,255,0.28), transparent 48%)',
        }}
      />
      {children}
    </div>
  );
};

const TiltedCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    el.style.transform = `perspective(900px) rotateX(${(-y * 3).toFixed(
      2,
    )}deg) rotateY(${(x * 3).toFixed(2)}deg) translateY(-2px)`;
  };

  const reset = () => {
    if (ref.current) {
      ref.current.style.transform =
        'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
    }
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className={`transition-transform duration-200 ease-out ${className}`}
    >
      {children}
    </div>
  );
};

const ShinyText: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <span
    className={`bg-[length:220%_100%] bg-gradient-to-r from-stone-900 via-orange-500 to-stone-900 bg-clip-text text-transparent ${className}`}
    style={{
      animation: 'pathanaShakthiShine 4.5s linear infinite',
    }}
  >
    {children}
  </span>
);

const ROLE_CONFIGS: RoleConfig[] = [
  {
    id: 'student',
    label: 'Student',
    telugu: 'విద్యార్థి',
    description: 'Choose your reading profile',
    icon: User,
  },
  {
    id: 'faculty',
    label: 'Faculty',
    telugu: 'ఉపాధ్యాయులు',
    description: 'Enter your teacher PIN',
    icon: GraduationCap,
  },
  {
    id: 'admin',
    label: 'Admin',
    telugu: 'ప్రధానోపాధ్యాయులు',
    description: 'Manage your school',
    icon: School,
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigate,
}) => {
  // ============================================================
  // STATE
  // ============================================================

  const [selectedRole, setSelectedRole] =
    useState<UserRole>('student');

  const [selectedStudentId, setSelectedStudentId] =
    useState<string>(REAL_STUDENTS[0].id);

  const [emailOrRoll, setEmailOrRoll] =
    useState<string>('');

  const [password, setPassword] =
    useState<string>('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // ============================================================
  // LANDING-PAGE ROLE HANDOFF
  // ============================================================

  useEffect(() => {
    const pendingRole =
      sessionStorage.getItem(
        'pathanaShakthiLoginRole'
      );

    if (
      pendingRole === 'student' ||
      pendingRole === 'faculty' ||
      pendingRole === 'admin'
    ) {
      setSelectedRole(
        pendingRole as UserRole
      );

      sessionStorage.removeItem(
        'pathanaShakthiLoginRole'
      );
    }
  }, []);

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const selectedRoleConfig =
    useMemo(
      () =>
        ROLE_CONFIGS.find(
          (role) =>
            role.id === selectedRole
        ) || ROLE_CONFIGS[0],
      [selectedRole]
    );

  const selectedStudent = useMemo(
    () =>
      REAL_STUDENTS.find(
        (student) =>
          student.id === selectedStudentId
      ) || REAL_STUDENTS[0],
    [selectedStudentId]
  );

  // ============================================================
  // ROLE CHANGE
  // ============================================================

  const handleRoleChange = (
    role: UserRole
  ) => {
    if (role === selectedRole) return;

    soundEffects.playWordPop();

    setSelectedRole(role);
    setErrorMsg(null);
    setPassword('');

    // Keep student profile selection intact.
    // Reset credentials when switching between
    // faculty/admin so stale values aren't confusing.
    if (role === 'student') {
      setEmailOrRoll('');
    }

    if (role === 'faculty') {
      setEmailOrRoll(
        REAL_FACULTY_MEMBERS[0]?.id || ''
      );
    }

    if (role === 'admin') {
      setEmailOrRoll(
        'headmaster.kothur@tg.gov.in'
      );
    }
  };

  // ============================================================
  // STUDENT PROFILE
  // ============================================================

  const handleStudentQuickSelect = (
    studentId: string
  ) => {
    if (
      studentId === selectedStudentId
    ) {
      return;
    }

    soundEffects.playWordPop();

    setSelectedStudentId(studentId);
    setErrorMsg(null);
  };

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLoginSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (isSubmitting) return;

    setErrorMsg(null);
    soundEffects.playWordPop();

    // Students use profile-based login and do not need a password.
    // Faculty/Admin still require a password.
    if (selectedRole !== 'student' && !password.trim()) {
      setErrorMsg('Password is required. Please enter your password.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    // Small delay makes the interaction feel intentional
    // without changing the existing authentication logic.
    window.setTimeout(() => {
      if (selectedRole === 'student') {
        const student =
          REAL_STUDENTS.find(
            (s) => s.id === selectedStudentId
          );

        if (!student) {
          setErrorMsg('Student account could not be found.');
          setIsSubmitting(false);
          return;
        }

        const session: UserSession = {
          id: student.id,
          name: student.name,
          role: 'student',
          rollNumber: student.rollNumber,
          avatar: student.avatar,
          schoolId: 'school_telangana_ktr',
          schoolName: student.villageSchool,
          grade: student.grade,
          createdAt: new Date().toISOString(),
        };

        // Student authentication is intentionally passwordless.
        authService.saveSession(session);
        soundEffects.playStarChime();
        onLoginSuccess(session);
        onNavigate('student_library');

        return;
      }

      if (selectedRole === 'faculty') {
        const faculty =
          REAL_FACULTY_MEMBERS.find(
            (f) =>
              f.id === emailOrRoll
          ) ||
          REAL_FACULTY_MEMBERS[0];

        const res =
          authService.loginWithCredentials(
            faculty.email,
            password,
            'faculty'
          );

        if (
          res.success &&
          res.session
        ) {
          soundEffects.playStarChime();

          onLoginSuccess(
            res.session
          );

          onNavigate(
            'faculty_dashboard'
          );
        } else {
          setErrorMsg(
            res.error ||
              'Failed to login.'
          );

          setIsSubmitting(false);
        }

        return;
      }

      if (selectedRole === 'admin') {
        const res =
          authService.loginWithCredentials(
            emailOrRoll,
            password,
            'admin'
          );

        if (
          res.success &&
          res.session
        ) {
          soundEffects.playStarChime();

          onLoginSuccess(
            res.session
          );

          onNavigate(
            'school_admin'
          );
        } else {
          setErrorMsg(
            res.error ||
              'Failed to login as Administrator.'
          );

          setIsSubmitting(false);
        }

        return;
      }

      setIsSubmitting(false);
    }, 350);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="
        relative
        min-h-screen
        overflow-hidden

        bg-[#f6f3ec]

        text-stone-900
        selection:bg-orange-200
        selection:text-stone-900

        flex
        flex-col
        justify-center

        py-8
        sm:py-12

        px-4
        sm:px-6
        lg:px-8
      "
    >
      <style>{`
        @keyframes pathanaShakthiShine {
          0% { background-position: 120% 50%; }
          100% { background-position: -120% 50%; }
        }
      `}</style>

      {/* ========================================================
          PREMIUM REACTIVE BACKGROUND
      ======================================================== */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* soft warm paper wash */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.98),rgba(246,243,236,0.92)_48%,rgba(241,236,226,0.96))]" />

        {/* large, extremely soft color atmosphere */}
        <motion.div
          animate={{
            x: [0, 22, 0],
            y: [0, -14, 0],
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-orange-300/20 blur-[110px]"
        />

        <motion.div
          animate={{
            x: [0, -28, 0],
            y: [0, 18, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 17,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute -right-44 top-[18%] h-[34rem] w-[34rem] rounded-full bg-violet-300/14 blur-[120px]"
        />

        <motion.div
          animate={{
            opacity: [0.18, 0.32, 0.18],
            scale: [1, 1.12, 1],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-[-12rem] left-[28%] h-[28rem] w-[44rem] rounded-full bg-amber-200/20 blur-[110px]"
        />

        {/* elegant grid — deliberately very faint */}
        <div
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(120,100,70,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(120,100,70,0.045) 1px, transparent 1px)',
            backgroundSize: '42px 42px',
            maskImage:
              'radial-gradient(ellipse at center, black 0%, transparent 76%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 0%, transparent 76%)',
          }}
        />

        {/* tiny floating light particles */}
        <motion.div
          animate={{ y: [0, -18, 0], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-[14%] top-[24%] h-1.5 w-1.5 rounded-full bg-orange-400/45 blur-[1px]"
        />
        <motion.div
          animate={{ y: [0, 14, 0], opacity: [0.18, 0.42, 0.18] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute right-[18%] top-[31%] h-1 w-1 rounded-full bg-violet-400/45 blur-[1px]"
        />
        <motion.div
          animate={{ y: [0, -12, 0], opacity: [0.15, 0.38, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute left-[78%] bottom-[22%] h-1.5 w-1.5 rounded-full bg-amber-400/40 blur-[1px]"
        />
      </div>

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

      <div
        className="
          relative
          z-10

          mx-auto
          w-full
          max-w-5xl
        "
      >
        {/* ======================================================
            BRAND / HERO
        ====================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: -20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mx-auto
            mb-8
            max-w-xl

            text-center
          "
        >
          <motion.div
            whileHover={{
              scale: 1.04,
              y: -2,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 20,
            }}
            className="
              flex
              justify-center
              mb-4
            "
          >
            <PathanaShakthiLogo
              size="lg"
            />
          </motion.div>

          <div
            className="
              inline-flex
              items-center
              gap-1.5

              rounded-full

              border
              border-orange-200

              bg-white/80

              px-3.5
              py-1.5

              text-[9px]
              font-black
              uppercase
              tracking-[0.16em]

              text-orange-600

              shadow-[0_8px_24px_rgba(234,88,12,0.10)]
            "
          >
            <Sparkles
              className="
                h-3
                w-3
              "
            />

            Read • Practice • Grow
          </div>

          <h1
            className="
              mt-3

              text-3xl
              sm:text-4xl

              font-black

              tracking-[-0.055em]

              text-stone-900
            "
          >
            <ShinyText>Sign In to Your Workspace</ShinyText>
          </h1>

          <p
            className="
              mx-auto
              mt-2

              max-w-lg

              text-xs
              sm:text-sm

              leading-6

              text-stone-500
            "
          >
            One doorway for every learning journey —
            choose your role and step into your
            reading workspace.
          </p>
        </motion.div>

        {/* ======================================================
            LOGIN CARD
        ====================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 28,
            scale: 0.98,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.65,
            delay: 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mx-auto
            w-full
            max-w-3xl
          "
        >
          <TiltedCard>
            <SpotlightCard
              className="
                rounded-[30px]
                border border-white/80
                bg-white/[0.94]
                shadow-[0_30px_90px_rgba(60,45,20,0.15),0_8px_30px_rgba(60,45,20,0.05)]
                backdrop-blur-2xl
              "
            >
              <div className="relative">

            {/* Animated top accent */}

            <motion.div
              animate={{
                backgroundPosition: [
                  '0% 50%',
                  '100% 50%',
                  '0% 50%',
                ],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="
                absolute
                top-0
                left-0
                right-0

                h-1

                bg-[length:200%_100%]
                bg-gradient-to-r
                from-amber-400
                via-orange-400
                to-rose-400
              "
            />

            <div
              className="
                p-5
                sm:p-7
                lg:p-8
              "
            >
              {/* ==================================================
                  ROLE SELECTOR
              ================================================== */}

              <div
                className="
                  rounded-2xl

                  border
                  border-stone-200/80

                  bg-stone-100/70

                  p-1.5

                  shadow-inner
                "
              >
                <div
                  className="
                    grid
                    grid-cols-3

                    gap-1
                  "
                >
                  {ROLE_CONFIGS.map(
                    (role) => {
                      const Icon =
                        role.icon;

                      const active =
                        selectedRole ===
                        role.id;

                      return (
                        <motion.button
                          key={role.id}
                          type="button"
                          onClick={() =>
                            handleRoleChange(
                              role.id
                            )
                          }
                          whileHover={{
                            y: -1,
                          }}
                          whileTap={{
                            scale: 0.97,
                          }}
                          className="
                            relative

                            min-w-0

                            rounded-[14px]

                            px-2
                            py-3
                            sm:px-3

                            cursor-pointer
                          "
                        >
                          {active && (
                            <motion.div
                              layoutId="active-login-role"
                              transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 32,
                              }}
                              className="
                                absolute
                                inset-0

                                rounded-[14px]

                                bg-gradient-to-br
                                from-amber-300
                                via-amber-400
                                to-orange-400

                                shadow-[0_7px_20px_rgba(245,158,11,0.24)]
                              "
                            />
                          )}

                          <span
                            className="
                              relative
                              z-10

                              flex
                              flex-col
                              sm:flex-row

                              items-center
                              justify-center

                              gap-1.5
                            "
                          >
                            <Icon
                              className={`
                                h-4
                                w-4

                                shrink-0

                                ${
                                  active
                                    ? 'text-stone-950'
                                    : 'text-stone-500'
                                }
                              `}
                            />

                            <span
                              className="
                                min-w-0
                                text-center
                              "
                            >
                              <span
                                className={`
                                  block
                                  truncate

                                  text-[10px]
                                  sm:text-xs

                                  font-black

                                  ${
                                    active
                                      ? 'text-stone-950'
                                      : 'text-stone-600'
                                  }
                                `}
                              >
                                {role.label}
                              </span>

                              <span
                                className={`
                                  hidden
                                  sm:block

                                  text-[9px]

                                  ${
                                    active
                                      ? 'text-stone-800/70'
                                      : 'text-stone-400'
                                  }
                                `}
                              >
                                {role.telugu}
                              </span>
                            </span>
                          </span>
                        </motion.button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* ==================================================
                  ACTIVE ROLE HEADER
              ================================================== */}

              <AnimatePresence
                mode="wait"
              >
                <motion.div
                  key={selectedRole}
                  initial={{
                    opacity: 0,
                    x: 12,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: -12,
                  }}
                  transition={{
                    duration: 0.22,
                  }}
                  className="
                    mt-6
                    mb-5

                    flex
                    items-center
                    justify-between

                    gap-4
                  "
                >
                  <div>
                    <div
                      className="
                        flex
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className="
                          inline-flex
                          h-8
                          w-8

                          items-center
                          justify-center

                          rounded-xl

                          bg-orange-50

                          text-orange-500
                        "
                      >
                        {React.createElement(
                          selectedRoleConfig.icon,
                          {
                            className:
                              'h-4 w-4',
                          }
                        )}
                      </span>

                      <div>
                        <h2
                          className="
                            text-sm
                            sm:text-base

                            font-black

                            text-stone-900
                          "
                        >
                          {selectedRoleConfig.label}{' '}
                          Login
                        </h2>

                        <p
                          className="
                            text-[10px]
                            sm:text-xs

                            text-stone-500
                          "
                        >
                          {
                            selectedRoleConfig.description
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="
                      hidden
                      sm:flex

                      items-center
                      gap-1.5

                      rounded-full

                      bg-emerald-50

                      border
                      border-emerald-100

                      px-2.5
                      py-1

                      text-[9px]
                      font-black

                      text-emerald-700
                    "
                  >
                    <span
                      className="
                        h-1.5
                        w-1.5

                        rounded-full

                        bg-emerald-500
                      "
                    />

                    Ready
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* ==================================================
                  ERROR
              ================================================== */}

              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      height: 0,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      height: 'auto',
                    }}
                    exit={{
                      opacity: 0,
                      y: -8,
                      height: 0,
                    }}
                    className="
                      mb-4
                      overflow-hidden
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        gap-2

                        rounded-xl

                        border
                        border-rose-200

                        bg-rose-50

                        p-3

                        text-xs

                        text-rose-800
                      "
                    >
                      <AlertCircle
                        className="
                          mt-0.5
                          h-4
                          w-4
                          shrink-0
                          text-rose-600
                        "
                      />

                      <span>
                        {errorMsg}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ==================================================
                  FORM
              ================================================== */}

              <form
                onSubmit={
                  handleLoginSubmit
                }
                className="space-y-5"
              >
                <AnimatePresence
                  mode="wait"
                >
                  {/* =================================================
                      STUDENT
                  ================================================= */}

                  {selectedRole ===
                    'student' && (
                    <motion.div
                      key="student"
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -10,
                      }}
                      transition={{
                        duration: 0.25,
                      }}
                      className="space-y-4"
                    >
                      <div
                        className="
                          flex
                          items-end
                          justify-between
                          gap-3
                        "
                      >
                        <div>
                          <label
                            className="
                              block

                              text-xs

                              font-black
                              uppercase
                              tracking-wide

                              text-stone-600
                            "
                          >
                            Choose your profile
                          </label>

                          <p
                            className="
                              mt-1

                              text-[10px]

                              text-stone-400
                            "
                          >
                            Select the student
                            account you want
                            to enter.
                          </p>
                        </div>

                        <span
                          className="
                            hidden
                            sm:inline-flex

                            items-center
                            gap-1

                            text-[10px]
                            font-bold

                            text-orange-500
                          "
                        >
                          <Sparkles
                            className="
                              h-3
                              w-3
                            "
                          />
                          Pick & read
                        </span>
                      </div>

                      {/* SELECTED STUDENT PREVIEW */}

                      <SpotlightCard
                        className="
                          flex
                          items-center
                          gap-3

                          rounded-2xl

                          border
                          border-amber-200

                          bg-gradient-to-r
                          from-amber-50
                          via-orange-50
                          to-rose-50

                          p-3.5

                          shadow-[0_10px_28px_rgba(245,158,11,0.10)]
                        "
                      >
                        <motion.div
                          key={
                            selectedStudent.id
                          }
                          initial={{
                            scale: 0.7,
                            rotate: -8,
                          }}
                          animate={{
                            scale: 1,
                            rotate: 0,
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 20,
                          }}
                          className="
                            flex
                            h-11
                            w-11
                            shrink-0

                            items-center
                            justify-center

                            rounded-xl

                            border
                            border-amber-200

                            bg-white

                            text-2xl

                            shadow-sm
                          "
                        >
                          {
                            selectedStudent.avatar
                          }
                        </motion.div>

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <p
                            className="
                              truncate

                              text-sm

                              font-black

                              text-stone-900
                            "
                          >
                            {
                              selectedStudent.name
                            }
                          </p>

                          <p
                            className="
                              mt-0.5

                              text-[10px]

                              text-stone-500
                            "
                          >
                            {
                              selectedStudent.grade
                            }{' '}
                            •{' '}
                            {
                              selectedStudent.rollNumber
                            }
                          </p>
                        </div>

                        <Check
                          className="
                            h-4
                            w-4

                            shrink-0

                            text-amber-600
                          "
                        />
                      </SpotlightCard>

                      {/* PROFILE GRID */}

                      <div
                        className="
                          grid
                          grid-cols-1
                          sm:grid-cols-2

                          gap-2.5

                          max-h-64

                          overflow-y-auto

                          pr-1

                          scrollbar-thin
                        "
                      >
                        {REAL_STUDENTS.map(
                          (
                            student,
                            index
                          ) => {
                            const isSelected =
                              selectedStudentId ===
                              student.id;

                            return (
                              <motion.button
                                key={
                                  student.id
                                }
                                type="button"
                                onClick={() =>
                                  handleStudentQuickSelect(
                                    student.id
                                  )
                                }
                                initial={{
                                  opacity: 0,
                                  y: 8,
                                }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                }}
                                transition={{
                                  delay:
                                    index *
                                    0.025,
                                  duration:
                                    0.25,
                                }}
                                whileHover={{
                                  y: -2,
                                  scale: 1.01,
                                }}
                                whileTap={{
                                  scale: 0.98,
                                }}
                                className={`
                                  group

                                  relative

                                  overflow-hidden

                                  flex
                                  items-center
                                  gap-3

                                  rounded-2xl

                                  border

                                  p-3

                                  text-left

                                  cursor-pointer

                                  transition-colors

                                  ${
                                    isSelected
                                      ? 'border-amber-400 bg-amber-50 shadow-[0_8px_24px_rgba(245,158,11,0.12)]'
                                      : 'border-stone-200 bg-white hover:border-orange-200 hover:bg-orange-50/50'
                                  }
                                `}
                              >
                                {/* Spotlight-style hover */}

                                <span
                                  className="
                                    pointer-events-none

                                    absolute
                                    -top-12
                                    -right-12

                                    h-24
                                    w-24

                                    rounded-full

                                    bg-orange-300/20

                                    blur-2xl

                                    opacity-0

                                    transition-opacity
                                    duration-300

                                    group-hover:opacity-100
                                  "
                                />

                                <div
                                  className={`
                                    relative
                                    z-10

                                    flex
                                    h-10
                                    w-10
                                    shrink-0

                                    items-center
                                    justify-center

                                    rounded-full

                                    border

                                    text-xl

                                    ${
                                      isSelected
                                        ? 'border-amber-300 bg-amber-100'
                                        : 'border-stone-200 bg-stone-50'
                                    }
                                  `}
                                >
                                  {
                                    student.avatar
                                  }
                                </div>

                                <div
                                  className="
                                    relative
                                    z-10

                                    min-w-0
                                    flex-1
                                  "
                                >
                                  <p
                                    className="
                                      truncate

                                      text-xs

                                      font-black

                                      text-stone-900
                                    "
                                  >
                                    {
                                      student.name
                                    }
                                  </p>

                                  <p
                                    className="
                                      mt-0.5

                                      truncate

                                      text-[10px]

                                      text-stone-500
                                    "
                                  >
                                    {
                                      student.grade
                                    }{' '}
                                    •{' '}
                                    {
                                      student.rollNumber
                                    }
                                  </p>
                                </div>

                                <div
                                  className="
                                    relative
                                    z-10

                                    flex
                                    h-6
                                    w-6

                                    shrink-0

                                    items-center
                                    justify-center

                                    rounded-full
                                  "
                                >
                                  {isSelected ? (
                                    <Check
                                      className="
                                        h-4
                                        w-4

                                        text-amber-600
                                      "
                                    />
                                  ) : (
                                    <ChevronRight
                                      className="
                                        h-4
                                        w-4

                                        text-stone-300

                                        transition-transform
                                        group-hover:translate-x-0.5
                                        group-hover:text-orange-400
                                      "
                                    />
                                  )}
                                </div>
                              </motion.button>
                            );
                          }
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* =================================================
                      FACULTY
                  ================================================= */}

                  {selectedRole ===
                    'faculty' && (
                    <motion.div
                      key="faculty"
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -10,
                      }}
                      transition={{
                        duration: 0.25,
                      }}
                      className="space-y-4"
                    >
                      <div
                        className="
                          rounded-2xl

                          border
                          border-violet-100

                          bg-violet-50/70

                          p-4
                        "
                      >
                        <div
                          className="
                            flex
                            items-start
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-9
                              w-9
                              shrink-0

                              items-center
                              justify-center

                              rounded-xl

                              bg-white

                              text-violet-500

                              shadow-sm
                            "
                          >
                            <GraduationCap
                              className="
                                h-4
                                w-4
                              "
                            />
                          </div>

                          <div>
                            <p
                              className="
                                text-xs
                                font-black

                                text-violet-950
                              "
                            >
                              Welcome, teacher
                            </p>

                            <p
                              className="
                                mt-0.5

                                text-[10px]

                                leading-5

                                text-violet-800/70
                              "
                            >
                              Choose your faculty
                              profile and enter
                              your access PIN.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          className="
                            mb-1.5
                            block

                            text-xs

                            font-black
                            uppercase
                            tracking-wide

                            text-stone-600
                          "
                        >
                          Select Faculty Teacher
                        </label>

                        <div
                          className="
                            relative
                          "
                        >
                          <select
                            value={
                              emailOrRoll ||
                              REAL_FACULTY_MEMBERS[0]?.id ||
                              ''
                            }
                            onChange={(e) =>
                              setEmailOrRoll(
                                e.target.value
                              )
                            }
                            className="
                              w-full

                              appearance-none

                              rounded-xl

                              border
                              border-stone-200

                              bg-white

                              px-4
                              py-3
                              pr-10

                              text-xs
                              font-bold

                              text-stone-900

                              outline-none

                              transition-all

                              focus:border-orange-400
                              focus:ring-4
                              focus:ring-orange-100

                              cursor-pointer
                            "
                          >
                            {REAL_FACULTY_MEMBERS.map(
                              (fac) => (
                                <option
                                  key={fac.id}
                                  value={fac.id}
                                >
                                  {fac.name} —{' '}
                                  {
                                    fac.designation
                                  }
                                </option>
                              )
                            )}
                          </select>

                          <ChevronRight
                            className="
                              pointer-events-none

                              absolute
                              right-3
                              top-1/2

                              h-4
                              w-4

                              -translate-y-1/2

                              rotate-90

                              text-stone-400
                            "
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          className="
                            mb-1.5
                            block

                            text-xs

                            font-black
                            uppercase
                            tracking-wide

                            text-stone-600
                          "
                        >
                          Faculty Access PIN /
                          Password
                        </label>

                        <div
                          className="
                            relative
                          "
                        >
                          <Lock
                            className="
                              pointer-events-none

                              absolute
                              left-3
                              top-1/2

                              h-4
                              w-4

                              -translate-y-1/2

                              text-stone-400
                            "
                          />

                          <input
                            type={
                              showPassword
                                ? 'text'
                                : 'password'
                            }
                            placeholder="Enter teacher PIN"
                            value={password}
                            onChange={(e) =>
                              setPassword(
                                e.target.value
                              )
                            }
                            className="
                              w-full

                              rounded-xl

                              border
                              border-stone-200

                              bg-white

                              py-3
                              pl-10
                              pr-11

                              text-xs

                              text-stone-900

                              outline-none

                              transition-all

                              focus:border-orange-400
                              focus:ring-4
                              focus:ring-orange-100
                            "
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowPassword(
                                (current) =>
                                  !current
                              )
                            }
                            className="
                              absolute
                              right-2
                              top-1/2

                              flex
                              h-8
                              w-8

                              -translate-y-1/2

                              items-center
                              justify-center

                              rounded-lg

                              text-stone-400

                              hover:bg-stone-100
                              hover:text-stone-700

                              cursor-pointer
                            "
                            aria-label={
                              showPassword
                                ? 'Hide password'
                                : 'Show password'
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* =================================================
                      ADMIN
                  ================================================= */}

                  {selectedRole ===
                    'admin' && (
                    <motion.div
                      key="admin"
                      initial={{
                        opacity: 0,
                        y: 10,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -10,
                      }}
                      transition={{
                        duration: 0.25,
                      }}
                      className="space-y-4"
                    >
                      <div
                        className="
                          rounded-2xl

                          border
                          border-amber-200

                          bg-gradient-to-br
                          from-amber-50
                          to-orange-50

                          p-4
                        "
                      >
                        <div
                          className="
                            flex
                            items-start
                            gap-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-9
                              w-9
                              shrink-0

                              items-center
                              justify-center

                              rounded-xl

                              bg-white

                              text-amber-600

                              shadow-sm
                            "
                          >
                            <ShieldCheck
                              className="
                                h-4
                                w-4
                              "
                            />
                          </div>

                          <div>
                            <p
                              className="
                                text-xs
                                font-black

                                text-amber-950
                              "
                            >
                              ZPHS Kothur School
                              Administration
                            </p>

                            <p
                              className="
                                mt-0.5

                                text-[10px]

                                leading-5

                                text-amber-900/70
                              "
                            >
                              Manage students,
                              reading classrooms,
                              and multilingual
                              story libraries.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          className="
                            mb-1.5
                            block

                            text-xs

                            font-black
                            uppercase
                            tracking-wide

                            text-stone-600
                          "
                        >
                          Headmaster / Admin Email
                        </label>

                        <input
                          type="email"
                          value={
                            emailOrRoll ||
                            'headmaster.kothur@tg.gov.in'
                          }
                          onChange={(e) =>
                            setEmailOrRoll(
                              e.target.value
                            )
                          }
                          className="
                            w-full

                            rounded-xl

                            border
                            border-stone-200

                            bg-white

                            px-4
                            py-3

                            text-xs

                            text-stone-900

                            outline-none

                            transition-all

                            focus:border-orange-400
                            focus:ring-4
                            focus:ring-orange-100
                          "
                        />
                      </div>

                      <div>
                        <label
                          className="
                            mb-1.5
                            block

                            text-xs

                            font-black
                            uppercase
                            tracking-wide

                            text-stone-600
                          "
                        >
                          Admin Password
                        </label>

                        <div
                          className="
                            relative
                          "
                        >
                          <Lock
                            className="
                              pointer-events-none

                              absolute
                              left-3
                              top-1/2

                              h-4
                              w-4

                              -translate-y-1/2

                              text-stone-400
                            "
                          />

                          <input
                            type={
                              showPassword
                                ? 'text'
                                : 'password'
                            }
                            value={password}
                            onChange={(e) =>
                              setPassword(
                                e.target.value
                              )
                            }
                            className="
                              w-full

                              rounded-xl

                              border
                              border-stone-200

                              bg-white

                              py-3
                              pl-10
                              pr-11

                              text-xs

                              text-stone-900

                              outline-none

                              transition-all

                              focus:border-orange-400
                              focus:ring-4
                              focus:ring-orange-100
                            "
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowPassword(
                                (current) =>
                                  !current
                              )
                            }
                            className="
                              absolute
                              right-2
                              top-1/2

                              flex
                              h-8
                              w-8

                              -translate-y-1/2

                              items-center
                              justify-center

                              rounded-lg

                              text-stone-400

                              hover:bg-stone-100
                              hover:text-stone-700

                              cursor-pointer
                            "
                            aria-label={
                              showPassword
                                ? 'Hide password'
                                : 'Show password'
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ==================================================
                    SUBMIT
                ================================================== */}

                <motion.button
                  type="submit"

                  disabled={isSubmitting}

                  whileHover={
                    isSubmitting
                      ? {}
                      : {
                          y: -2,
                          scale: 1.01,
                        }
                  }

                  whileTap={
                    isSubmitting
                      ? {}
                      : {
                          scale: 0.98,
                        }
                  }

                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 24,
                  }}

                  className="
                    group

                    relative
                    overflow-hidden

                    w-full

                    flex
                    items-center
                    justify-center
                    gap-2

                    rounded-xl

                    bg-gradient-to-r
                    from-amber-400
                    via-orange-400
                    to-orange-500

                    py-3.5
                    px-4

                    text-sm

                    font-black

                    text-stone-950

                    shadow-[0_10px_30px_rgba(234,88,12,0.22)]

                    hover:from-amber-300
                    hover:via-orange-300
                    hover:to-orange-400

                    disabled:cursor-not-allowed
                    disabled:opacity-70

                    cursor-pointer

                    transition-colors
                  "

                  id="btn-login-submit"
                >
                  {/* Button shine */}

                  {!isSubmitting && (
                    <motion.span
                      animate={{
                        x: [
                          '-120%',
                          '120%',
                        ],
                      }}
                      transition={{
                        duration: 2.8,
                        repeat: Infinity,
                        repeatDelay: 2,
                        ease: 'easeInOut',
                      }}
                      className="
                        pointer-events-none

                        absolute
                        inset-y-0

                        w-1/3

                        -skew-x-12

                        bg-white/20

                        blur-sm
                      "
                    />
                  )}

                  <span
                    className="
                      relative
                      z-10

                      flex
                      items-center
                      justify-center
                      gap-2
                    "
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          className="
                            h-4
                            w-4

                            animate-spin
                          "
                        />

                        <span>
                          Entering...
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Enter{' '}
                          {selectedRole ===
                          'student'
                            ? 'Student Library'
                            : selectedRole ===
                              'faculty'
                            ? 'Faculty Room'
                            : 'Admin Portal'}
                        </span>

                        <ArrowRight
                          className="
                            h-4
                            w-4

                            transition-transform
                            duration-200

                            group-hover:translate-x-1
                          "
                        />
                      </>
                    )}
                  </span>
                </motion.button>
              </form>

              {/* ==================================================
                  SECURITY / BACK
              ================================================== */}

              <div
                className="
                  mt-5

                  flex
                  flex-col
                  sm:flex-row

                  items-center
                  justify-between

                  gap-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-1.5

                    text-[9px]

                    font-semibold

                    text-stone-400
                  "
                >
                  <ShieldCheck
                    className="
                      h-3.5
                      w-3.5

                      text-emerald-500
                    "
                  />

                  Secure school workspace
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onNavigate(
                      'landing'
                    )
                  }
                  className="
                    group

                    inline-flex
                    items-center
                    gap-1

                    text-xs

                    font-bold

                    text-stone-500

                    hover:text-stone-900

                    cursor-pointer

                    transition-colors
                  "
                >
                  ← Back to Main Home Page
                </button>
              </div>
            </div>
              </div>
            </SpotlightCard>
          </TiltedCard>
        </motion.div>

        {/* Mini trust strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.45 }}
          className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[9px] font-bold uppercase tracking-[0.16em] text-stone-400"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            School-ready
          </span>
          <span className="hidden h-3 w-px bg-stone-200 sm:block" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            Reading-first
          </span>
          <span className="hidden h-3 w-px bg-stone-200 sm:block" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Made for every learner
          </span>
        </motion.div>

        {/* ======================================================
            ROLE HINT
        ====================================================== */}

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.8,
            duration: 0.5,
          }}
          className="
            mx-auto
            mt-5

            flex
            max-w-2xl

            items-center
            justify-center
            gap-2

            text-center
          "
        >
          <Sparkles
            className="
              h-3
              w-3

              shrink-0

              text-orange-400
            "
          />

          <p
            className="
              text-[9px]
              sm:text-[10px]

              font-semibold

              text-stone-400
            "
          >
            Selected role:{' '}
            <span
              className="
                font-black
                text-stone-600
              "
            >
              {selectedRoleConfig.label}
            </span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;