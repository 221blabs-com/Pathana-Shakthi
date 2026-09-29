import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { UserRole, UserSession } from '../../types';
import { authService } from '../../services/authService';
import { firebaseAuthService } from '../../services/firebaseAuthService';
import { firebaseAuth } from '../../services/firebase';
import { signInAnonymously, signOut } from 'firebase/auth';
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
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ScanLine,
  CreditCard,
  CheckCircle2,
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
    description: 'Sign in with your student ID',
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

/*
|--------------------------------------------------------------------------
| TEMPORARY DEVELOPMENT STUDENT
|--------------------------------------------------------------------------
| This is intentionally kept here only while backend authentication
| is being developed.
|
| Student:
| Name:       Arjun Kumar
| Roll Number: PS20260017
| Class:      5
| Section:    A
|
| Later this will be replaced by the backend authentication flow.
|--------------------------------------------------------------------------
*/

const DEMO_STUDENT = {
  id: 'PS20260017',
  name: 'Arjun Kumar',
  rollNumber: 'PS20260017',
  grade: 'Class 5' as UserSession['grade'],
  section: 'A',
  avatar: '👦',
  schoolId: 'school_telangana_ktr',
  schoolName: 'ZPHS Kothur',
};

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigate,
}) => {
  const [selectedRole, setSelectedRole] =
    useState<UserRole>('student');

  const [studentId, setStudentId] =
    useState<string>('');

  const [password, setPassword] =
    useState<string>('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [studentFound, setStudentFound] =
    useState(false);

  const [isScanning, setIsScanning] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | LANDING PAGE ROLE HANDOFF
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | ROLE CONFIG
  |--------------------------------------------------------------------------
  */

  const selectedRoleConfig =
    ROLE_CONFIGS.find(
      (role) =>
        role.id === selectedRole
    ) || ROLE_CONFIGS[0];

  /*
  |--------------------------------------------------------------------------
  | ROLE CHANGE
  |--------------------------------------------------------------------------
  */

  const handleRoleChange = (
    role: UserRole
  ) => {
    if (role === selectedRole) {
      return;
    }

    soundEffects.playWordPop();

    setSelectedRole(role);
    setErrorMsg(null);
    setStudentFound(false);
    setStudentId('');
    setPassword('');
  };

  /*
  |--------------------------------------------------------------------------
  | STUDENT ID CHANGE
  |--------------------------------------------------------------------------
  */

  const handleStudentIdChange = (
    value: string
  ) => {
    const normalizedValue =
      value.toUpperCase().trim();

    setStudentId(normalizedValue);
    setErrorMsg(null);

    if (
      normalizedValue ===
      DEMO_STUDENT.rollNumber
    ) {
      setStudentFound(true);
    } else {
      setStudentFound(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SCAN ID CARD
  |--------------------------------------------------------------------------
  |
  | Uses the browser BarcodeDetector API when available.
  | For development, if the browser does not support camera
  | barcode scanning, the user can simply enter:
  |
  | PS20260017
  |
  |--------------------------------------------------------------------------
  */

  const handleScanIdCard = async () => {
    setErrorMsg(null);

    if (
      !('BarcodeDetector' in window)
    ) {
      setErrorMsg(
        'Barcode scanning is not supported by this browser yet. Please enter PS20260017 manually for now.'
      );

      return;
    }

    try {
      setIsScanning(true);

      const BarcodeDetectorClass =
        (
          window as Window &
            typeof globalThis & {
              BarcodeDetector?: new (options?: {
                formats?: string[];
              }) => {
                detect: (
                  source: ImageBitmapSource
                ) => Promise<
                  Array<{
                    rawValue?: string;
                  }>
                >;
              };
            }
        ).BarcodeDetector;

      if (!BarcodeDetectorClass) {
        throw new Error(
          'Barcode scanner is not available.'
        );
      }

      const detector =
        new BarcodeDetectorClass({
          formats: [
            'code_128',
            'code_39',
            'ean_13',
            'ean_8',
            'qr_code',
          ],
        });

      /*
       * Camera scanning will be connected properly
       * when the ID-card backend is implemented.
       *
       * For now we keep the button functional and
       * guide the developer to use the demo ID.
       */

      await new Promise((resolve) =>
        window.setTimeout(resolve, 700)
      );

      setStudentId(
        DEMO_STUDENT.rollNumber
      );

      setStudentFound(true);

      soundEffects.playWordPop();
    } catch (error) {
      console.error(
        'ID card scanning failed:',
        error
      );

      setErrorMsg(
        'Unable to start the ID card scanner. Please enter the student ID manually.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  const handleLoginSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMsg(null);

    soundEffects.playWordPop();

    /*
    |--------------------------------------------------------------------------
    | STUDENT
    |--------------------------------------------------------------------------
    */

    if (selectedRole === 'student') {
      const normalizedStudentId =
        studentId.trim().toUpperCase();

      if (!normalizedStudentId) {
        setErrorMsg(
          'Please enter your Student ID or Roll Number.'
        );

        return;
      }

      if (
        normalizedStudentId !==
        DEMO_STUDENT.rollNumber
      ) {
        setStudentFound(false);

        setErrorMsg(
          'Student ID or Roll Number was not found. Please check it or scan the ID card again.'
        );

        return;
      }

      setIsSubmitting(true);

      try {
        /*
         * TEMPORARY DEVELOPMENT ACCESS
         *
         * No Firebase request.
         * No backend authentication.
         *
         * This lets us work on the Student Library first.
         */

        // The demo login skips the student-session backend, but published
        // textbook readings (/api/readings) still need a Firebase ID token,
        // so hold an anonymous Firebase session. Best-effort: without it the
        // library still works, just without teacher-published readings.
        if (firebaseAuth) {
          try {
            if (firebaseAuth.currentUser && !firebaseAuth.currentUser.isAnonymous) {
              await signOut(firebaseAuth);
            }
            if (!firebaseAuth.currentUser) {
              await signInAnonymously(firebaseAuth);
            }
          } catch (anonError) {
            console.warn('Anonymous Firebase sign-in for the demo student failed:', anonError);
          }
        }

        const session: UserSession = {
          id: DEMO_STUDENT.id,
          name: DEMO_STUDENT.name,
          role: 'student',
          rollNumber:
            DEMO_STUDENT.rollNumber,
          avatar: DEMO_STUDENT.avatar,
          schoolId:
            DEMO_STUDENT.schoolId,
          schoolName:
            DEMO_STUDENT.schoolName,
          grade: DEMO_STUDENT.grade,
          createdAt:
            new Date().toISOString(),
        };

        /*
         * Save the temporary local session.
         *
         * The backend/Firebase authentication
         * can replace this later.
         */

        authService.saveSession(session);

        soundEffects.playStarChime();

        onLoginSuccess(session);

        onNavigate(
          'student_library'
        );

        return;
      } catch (error) {
        console.error(
          'Student login failed:',
          error
        );

        setErrorMsg(
          'Unable to enter the Student Library. Please try again.'
        );

        setIsSubmitting(false);

        return;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | FACULTY
    |--------------------------------------------------------------------------
    */

    if (selectedRole === 'faculty') {
      if (!password.trim()) {
        setErrorMsg(
          'Password is required. Please enter your password.'
        );

        return;
      }

      setIsSubmitting(true);

      try {
        const faculty =
          REAL_FACULTY_MEMBERS[0];

        if (!faculty) {
          throw new Error(
            'Faculty account could not be found.'
          );
        }

        const session =
          await firebaseAuthService.loginWithPassword(
            faculty.email,
            password,
            'faculty'
          );

        authService.saveSession(
          session
        );

        soundEffects.playStarChime();

        onLoginSuccess(session);

        onNavigate(
          'faculty_dashboard'
        );

        return;
      } catch (error) {
        console.error(
          'Faculty login failed:',
          error
        );

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to sign in as faculty.'
        );

        setIsSubmitting(false);

        return;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN
    |--------------------------------------------------------------------------
    */

    if (selectedRole === 'admin') {
      if (!password.trim()) {
        setErrorMsg(
          'Password is required. Please enter your password.'
        );

        return;
      }

      setIsSubmitting(true);

      try {
        const session =
          await firebaseAuthService.loginWithPassword(
            'headmaster.kothur@tg.gov.in',
            password,
            'admin'
          );

        authService.saveSession(
          session
        );

        soundEffects.playStarChime();

        onLoginSuccess(session);

        onNavigate(
          'school_admin'
        );

        return;
      } catch (error) {
        console.error(
          'Admin login failed:',
          error
        );

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to sign in as administrator.'
        );

        setIsSubmitting(false);

        return;
      }
    }
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

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
      {/* BACKGROUND */}

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

      {/* MAIN */}

      <div
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-5xl
        "
      >
        {/* LOGO */}

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
              className="h-3 w-3"
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

        {/* LOGIN CARD */}

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
            {/* TOP ACCENT */}

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
              {/* ROLE SELECTOR */}

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

              {/* ACTIVE ROLE HEADER */}

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

              {/* ERROR */}

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

              {/* FORM */}

              <form
                onSubmit={
                  handleLoginSubmit
                }
                className="space-y-5"
              >
                <AnimatePresence
                  mode="wait"
                >
                  {/* STUDENT */}

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
                      className="space-y-5"
                    >
                      {/* INTRO */}

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
                          Student ID / Roll Number
                        </label>

                        <p
                          className="
                            mt-1
                            text-[10px]
                            sm:text-xs
                            text-stone-400
                          "
                        >
                          Enter your student ID or
                          scan the barcode on your
                          student ID card.
                        </p>
                      </div>

                      {/* ID INPUT + SCAN */}

                      <div
                        className="
                          flex
                          flex-col
                          sm:flex-row
                          gap-2
                        "
                      >
                        <div
                          className="
                            relative
                            flex-1
                          "
                        >
                          <CreditCard
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
                            type="text"
                            value={
                              studentId
                            }
                            onChange={(e) =>
                              handleStudentIdChange(
                                e.target.value
                              )
                            }
                            placeholder="e.g. PS20260017"
                            autoComplete="off"
                            spellCheck={false}
                            className="
                              w-full
                              rounded-xl
                              border
                              border-stone-200
                              bg-white
                              py-3
                              pl-10
                              pr-4
                              text-sm
                              font-semibold
                              tracking-wide
                              text-stone-900
                              outline-none
                              transition-all
                              focus:border-orange-400
                              focus:ring-4
                              focus:ring-orange-100
                            "
                          />
                        </div>

                        <motion.button
                          type="button"
                          onClick={
                            handleScanIdCard
                          }
                          disabled={
                            isScanning
                          }
                          whileHover={{
                            y: -1,
                          }}
                          whileTap={{
                            scale: 0.97,
                          }}
                          className="
                            inline-flex
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            border
                            border-violet-200
                            bg-violet-50
                            px-4
                            py-3
                            text-xs
                            font-black
                            text-violet-700
                            transition-all
                            hover:border-violet-300
                            hover:bg-violet-100
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                            sm:min-w-[150px]
                          "
                        >
                          {isScanning ? (
                            <>
                              <Loader2
                                className="
                                  h-4
                                  w-4
                                  animate-spin
                                "
                              />

                              Scanning...
                            </>
                          ) : (
                            <>
                              <ScanLine
                                className="
                                  h-4
                                  w-4
                                "
                              />

                              Scan ID Card
                            </>
                          )}
                        </motion.button>
                      </div>

                      {/* STUDENT FOUND */}

                      <AnimatePresence>
                        {studentFound && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              y: 8,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            exit={{
                              opacity: 0,
                              y: -8,
                            }}
                            className="
                              overflow-hidden
                              rounded-2xl
                              border
                              border-emerald-200
                              bg-emerald-50
                              p-4
                            "
                          >
                            <div
                              className="
                                flex
                                items-center
                                gap-3
                              "
                            >
                              <div
                                className="
                                  flex
                                  h-12
                                  w-12
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-xl
                                  border
                                  border-emerald-200
                                  bg-white
                                  text-2xl
                                  shadow-sm
                                "
                              >
                                {
                                  DEMO_STUDENT.avatar
                                }
                              </div>

                              <div
                                className="
                                  min-w-0
                                  flex-1
                                "
                              >
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                  "
                                >
                                  <p
                                    className="
                                      text-sm
                                      font-black
                                      text-stone-900
                                    "
                                  >
                                    {
                                      DEMO_STUDENT.name
                                    }
                                  </p>

                                  <CheckCircle2
                                    className="
                                      h-4
                                      w-4
                                      text-emerald-600
                                    "
                                  />
                                </div>

                                <p
                                  className="
                                    mt-1
                                    text-[10px]
                                    text-stone-500
                                  "
                                >
                                  {
                                    DEMO_STUDENT.grade
                                  }{' '}
                                  • Section{' '}
                                  {
                                    DEMO_STUDENT.section
                                  }{' '}
                                  •{' '}
                                  {
                                    DEMO_STUDENT.rollNumber
                                  }
                                </p>
                              </div>

                              <span
                                className="
                                  hidden
                                  sm:inline-flex
                                  rounded-full
                                  bg-emerald-100
                                  px-2.5
                                  py-1
                                  text-[9px]
                                  font-black
                                  text-emerald-700
                                "
                              >
                                Student Found
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* ID CARD INFORMATION */}

                      <div
                        className="
                          flex
                          items-center
                          gap-3
                          rounded-2xl
                          border
                          border-stone-200
                          bg-stone-50
                          p-4
                        "
                      >
                        <div
                          className="
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-white
                            text-violet-600
                            shadow-sm
                            ring-1
                            ring-stone-200
                          "
                        >
                          <CreditCard
                            className="h-5 w-5"
                          />
                        </div>

                        <div>
                          <p
                            className="
                              text-xs
                              font-black
                              text-stone-800
                            "
                          >
                            Student ID Card
                          </p>

                          <p
                            className="
                              mt-1
                              text-[10px]
                              leading-5
                              text-stone-500
                            "
                          >
                            Your school ID card barcode
                            can be scanned to find your
                            student profile automatically.
                          </p>
                        </div>
                      </div>

                      {/* DEVELOPMENT HINT */}

                      <div
                        className="
                          rounded-xl
                          border
                          border-amber-200
                          bg-amber-50
                          px-3
                          py-2.5
                          text-[10px]
                          text-amber-800
                        "
                      >
                        <span className="font-black">
                          Development access:
                        </span>{' '}
                        PS20260017
                      </div>
                    </motion.div>
                  )}

                  {/* FACULTY */}

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
                              className="h-4 w-4"
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
                              Enter your faculty
                              access PIN to
                              continue.
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

                  {/* ADMIN */}

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
                              className="h-4 w-4"
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
                            placeholder="Enter admin password"
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

                {/* SUBMIT */}

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

                        Entering...
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

              {/* SECURITY / BACK */}

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

        {/* ROLE HINT */}

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
