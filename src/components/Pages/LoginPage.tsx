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
    setIsSubmitting(true);

    // Small delay makes the interaction feel intentional
    // without changing the existing authentication logic.
    window.setTimeout(() => {
      if (selectedRole === 'student') {
        const session =
          authService.loginAsStudent(
            selectedStudentId
          );

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
            password || 'password',
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
            emailOrRoll ||
              'admin@school.gov.in',
            password || 'admin123',
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

        bg-[#f7f5ef]

        text-stone-900

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
      {/* ========================================================
          REACTIVE BACKGROUND
      ======================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          overflow-hidden
        "
        aria-hidden="true"
      >
        <motion.div
          animate={{
            x: [0, 25, 0],
            y: [0, -18, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            -top-32
            -left-32

            h-72
            w-72

            rounded-full

            bg-orange-300/20

            blur-3xl
          "
        />

        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="
            absolute
            top-1/3
            -right-32

            h-80
            w-80

            rounded-full

            bg-violet-300/15

            blur-3xl
          "
        />

        <motion.div
          animate={{
            opacity: [0.2, 0.45, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="
            absolute
            bottom-0
            left-1/3

            h-56
            w-56

            rounded-full

            bg-amber-200/20

            blur-3xl
          "
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
            mb-7
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
              mb-3
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

              bg-white/70

              px-3
              py-1

              text-[9px]
              font-black
              uppercase
              tracking-[0.16em]

              text-orange-600

              shadow-sm
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

              text-2xl
              sm:text-3xl

              font-black

              tracking-[-0.04em]

              text-stone-900
            "
          >
            Sign In to Your Workspace
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
            Choose your school role to
            continue your reading adventure,
            classroom workspace, or school
            administration.
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
          <div
            className="
              relative
              overflow-hidden

              rounded-[28px]

              border
              border-white

              bg-white/90

              shadow-[0_25px_80px_rgba(60,45,20,0.12)]

              backdrop-blur-xl
            "
          >
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
                  border-stone-200

                  bg-stone-100/80

                  p-1.5
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

                            rounded-xl

                            px-2
                            py-2.5
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

                                rounded-xl

                                bg-amber-400

                                shadow-sm
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

                      <motion.div
                        layout
                        className="
                          flex
                          items-center
                          gap-3

                          rounded-2xl

                          border
                          border-amber-200

                          bg-gradient-to-r
                          from-amber-50
                          to-orange-50

                          p-3
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
                      </motion.div>

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

                    bg-amber-500

                    py-3.5
                    px-4

                    text-sm

                    font-black

                    text-stone-950

                    shadow-[0_8px_24px_rgba(245,158,11,0.22)]

                    hover:bg-amber-400

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
