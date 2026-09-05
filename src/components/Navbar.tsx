import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, UserSession, AppViewRoute } from '../types';
import { soundEffects } from '../services/soundEffects';
import { PathanaShakthiLogo } from './PathanaShakthiLogo';

import {
  Home,
  BookOpen,
  GraduationCap,
  School,
  Star,
  Flame,
  Wifi,
  Volume2,
  VolumeX,
  LogOut,
  LogIn,
  Mic,
} from 'lucide-react';

interface NavbarProps {
  currentRoute: AppViewRoute;
  onNavigate: (route: AppViewRoute) => void;
  session: UserSession | null;
  student: Student;
  onOpenOfflineModal: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  session,
  student,
  onOpenOfflineModal,
  onOpenProfile,
  onLogout,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundEffects.getMuted());
  const [isVisible, setIsVisible] = React.useState(true);

  // ============================================================
  // SCROLL BEHAVIOUR
  // ============================================================
  React.useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateNavbar = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      // Always show at the top.
      if (currentScrollY <= 30) {
        setIsVisible(true);
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      // Ignore tiny movements.
      if (Math.abs(delta) > 10) {
        setIsVisible(delta < 0);
        lastScrollY = currentScrollY;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // ============================================================
  // ACTIONS
  // ============================================================
  const handleToggleMute = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);

    if (!muted) {
      soundEffects.playWordPop();
    }
  };

  const handleNavigate = (route: AppViewRoute) => {
    soundEffects.playPageTurn();
    onNavigate(route);
  };

  // ============================================================
  // NAVIGATION
  // ============================================================
  const navLinks: {
    id: AppViewRoute;
    label: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'landing',
      label: 'Home',
      icon: Home,
    },
    {
      id: 'student_library',
      label: 'Student Portal',
      icon: BookOpen,
    },
    {
      id: 'voice_setup',
      label: 'Voice Setup',
      icon: Mic,
    },
    {
      id: 'faculty_dashboard',
      label: 'Faculty Room',
      icon: GraduationCap,
    },
    {
      id: 'school_admin',
      label: 'School Admin',
      icon: School,
    },
  ];

  const isStudentPage = currentRoute === 'student_library';

  return (
    /*
     * IMPORTANT:
     * This wrapper reserves the navbar's space in the document.
     * The actual island is animated inside it.
     */
    <div
      id="app-navbar"
      className="
        relative
        z-40
        h-[92px]
        sm:h-[96px]
        pointer-events-none
      "
    >
      <motion.header
        initial={false}
        animate={{
          y: isVisible ? 0 : -115,
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.985,
        }}
        transition={{
          y: {
            type: 'spring',
            stiffness: 300,
            damping: 32,
            mass: 0.8,
          },
          opacity: {
            duration: 0.18,
            ease: 'easeOut',
          },
          scale: {
            duration: 0.25,
            ease: [0.22, 1, 0.36, 1],
          },
        }}
        className="
          pointer-events-auto
          absolute
          top-3
          left-3
          right-3
          sm:left-5
          sm:right-5
          lg:left-8
          lg:right-8
        "
      >
        <div
          className={`
            relative
            max-w-[1400px]
            mx-auto
            overflow-hidden
            rounded-[20px]
            border
            bg-[#fdfcf7]/95
            backdrop-blur-xl
            shadow-[0_8px_28px_rgba(60,45,20,0.09)]
            transition-colors
            duration-300
            ${
              isStudentPage
                ? 'border-amber-200/80'
                : 'border-[#e6e1d5]'
            }
          `}
        >
          {/* Top colour accent */}
          <div
            className={`
              absolute
              top-0
              left-0
              right-0
              h-[2px]
              ${
                isStudentPage
                  ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-purple-400'
                  : 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400'
              }
            `}
          />

          <div className="px-3 sm:px-4 lg:px-5 py-2">
            <div className="flex items-center justify-between gap-3">

              {/* ==================================================
                  BRAND
              ================================================== */}
              <motion.button
                type="button"
                onClick={() => handleNavigate('landing')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 24,
                }}
                className="
                  flex
                  items-center
                  shrink-0
                  p-0
                  border-0
                  bg-transparent
                  cursor-pointer
                "
              >
                <PathanaShakthiLogo
                  size="md"
                  showSubtitle={false}
                />
              </motion.button>

              {/* ==================================================
                  DESKTOP NAV
              ================================================== */}
              <nav
                className="
                  hidden
                  lg:flex
                  items-center
                  gap-0.5
                  p-1
                  rounded-[17px]
                  bg-[#f3f0e8]
                  border
                  border-[#e5e0d4]
                  flex-1
                  max-w-[850px]
                  mx-3
                "
              >
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.id;
                  const isStudent = item.id === 'student_library';

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 25,
                      }}
                      className={`
                        relative
                        flex-1
                        flex
                        items-center
                        justify-center
                        gap-1.5
                        px-2.5
                        py-1.5
                        rounded-xl
                        text-[12px]
                        font-bold
                        whitespace-nowrap
                        cursor-pointer
                        transition-colors
                        ${
                          isActive
                            ? 'text-stone-950'
                            : isStudent
                              ? 'text-purple-700 hover:text-purple-900'
                              : 'text-stone-600 hover:text-stone-900'
                        }
                      `}
                      id={`nav-link-${item.id}`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="navbar-active-pill"
                          className={`
                            absolute
                            inset-0
                            rounded-xl
                            ${
                              isStudent
                                ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300'
                                : 'bg-gradient-to-r from-amber-400 to-orange-400'
                            }
                            shadow-sm
                          `}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 35,
                          }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 shrink-0" />

                        <span>{item.label}</span>

                        {isStudent && !isActive && (
                          <span className="text-[8px] text-amber-500">
                            ✦
                          </span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </nav>

              {/* ==================================================
                  RIGHT CONTROLS
              ================================================== */}
              <div className="flex items-center gap-1.5 shrink-0">

                {/* Offline */}
                <motion.button
                  type="button"
                  onClick={onOpenOfflineModal}
                  id="btn-navbar-offline-status"
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 25,
                  }}
                  className="
                    flex
                    items-center
                    gap-1.5
                    px-2.5
                    py-1.5
                    rounded-xl
                    bg-emerald-50
                    hover:bg-emerald-100
                    border
                    border-emerald-200
                    text-emerald-950
                    text-xs
                    font-bold
                    transition-colors
                    cursor-pointer
                  "
                  title="Rural Offline Status & Sync"
                >
                  <span className="relative flex w-2 h-2">
                    <span className="absolute w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                  </span>

                  <span className="hidden sm:inline">
                    Offline Ready
                  </span>

                  <Wifi className="w-3.5 h-3.5" />
                </motion.button>

                {/* Sound */}
                <motion.button
                  type="button"
                  onClick={handleToggleMute}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 25,
                  }}
                  className="
                    p-2
                    rounded-xl
                    bg-[#f4f1e8]
                    hover:bg-[#e9e5db]
                    border
                    border-[#e4dfd4]
                    text-stone-700
                    cursor-pointer
                    transition-colors
                  "
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  <AnimatePresence
                    mode="wait"
                    initial={false}
                  >
                    {isMuted ? (
                      <motion.div
                        key="muted"
                        initial={{
                          opacity: 0,
                          scale: 0.7,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.7,
                        }}
                      >
                        <VolumeX className="w-4 h-4 text-stone-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="volume"
                        initial={{
                          opacity: 0,
                          scale: 0.7,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.7,
                        }}
                      >
                        <Volume2 className="w-4 h-4 text-amber-700" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Student stats */}
                {isStudentPage && (
                  <div className="hidden md:flex items-center gap-1.5">

                    <div
                      className="
                        flex
                        items-center
                        gap-1
                        px-2.5
                        py-1.5
                        rounded-xl
                        bg-gradient-to-br
                        from-amber-50
                        to-yellow-100
                        border
                        border-amber-200
                        text-amber-800
                        text-xs
                        font-black
                      "
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {student.stars}
                    </div>

                    <div
                      className="
                        flex
                        items-center
                        gap-1
                        px-2.5
                        py-1.5
                        rounded-xl
                        bg-gradient-to-br
                        from-orange-50
                        to-rose-100
                        border
                        border-orange-200
                        text-orange-800
                        text-xs
                        font-black
                      "
                    >
                      <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-500" />
                      {student.streakDays}d
                    </div>

                  </div>
                )}

                {/* ==================================================
                    SESSION
                ================================================== */}
                {session ? (
                  <div className="flex items-center gap-1.5">

                    {/* Profile */}
                    <motion.button
                      type="button"
                      onClick={onOpenProfile}
                      id="btn-navbar-student-profile"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 25,
                      }}
                      className="
                        flex
                        items-center
                        gap-1.5
                        p-1
                        sm:pr-2.5
                        rounded-xl
                        bg-[#f4f1e8]
                        hover:bg-[#e9e5db]
                        border
                        border-[#e4dfd4]
                        cursor-pointer
                        transition-colors
                      "
                      title="View Profile & Reading Progress"
                    >
                      <div className="text-lg">
                        {session.avatar || student.avatar}
                      </div>

                      <div className="hidden sm:block text-left">
                        <p className="text-xs font-black text-stone-800 leading-none">
                          {session.name.split(' ')[0]}
                        </p>

                        <span className="text-[9px] font-bold text-amber-700 uppercase">
                          {session.role}
                        </span>
                      </div>
                    </motion.button>

                    {/* Logout */}
                    <motion.button
                      type="button"
                      onClick={onLogout}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 25,
                      }}
                      className="
                        p-2
                        rounded-xl
                        bg-rose-50
                        hover:bg-rose-100
                        border
                        border-rose-200
                        text-rose-700
                        cursor-pointer
                        transition-colors
                      "
                      title="Sign Out of Session"
                      id="btn-navbar-logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </motion.button>

                  </div>
                ) : (

                  /* ==================================================
                     SIGN IN
                  ================================================== */
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      onNavigate('login');
                    }}
                    id="btn-navbar-login"
                    className="
                      group
                      relative
                      flex
                      items-center
                      gap-1.5
                      px-3.5
                      py-2
                      rounded-xl
                      bg-gradient-to-r
                      from-amber-400
                      to-orange-400
                      hover:from-amber-300
                      hover:to-orange-300
                      text-stone-950
                      font-black
                      text-xs
                      border
                      border-amber-500/40
                      shadow-sm
                      hover:shadow-md
                      cursor-pointer
                      transition-all
                      duration-200
                      ease-out
                      hover:-translate-y-0.5
                      active:translate-y-0
                      active:scale-[0.97]
                    "
                  >
                    <span
                      className="
                        pointer-events-none
                        absolute
                        inset-0
                        rounded-xl
                        opacity-0
                        group-hover:opacity-100
                        bg-gradient-to-r
                        from-white/20
                        via-transparent
                        to-white/20
                        transition-opacity
                        duration-200
                      "
                    />

                    <span className="relative z-10 flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      <span>Sign In</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* ======================================================
                MOBILE NAV
            ====================================================== */}
            <div className="lg:hidden mt-1.5 pt-1.5 border-t border-[#e8e4d8]">
              <nav className="flex items-center justify-center gap-1 overflow-x-auto">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.id;
                  const isStudent = item.id === 'student_library';

                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        relative
                        flex
                        items-center
                        gap-1
                        px-2.5
                        py-1
                        rounded-lg
                        text-[11px]
                        font-bold
                        whitespace-nowrap
                        cursor-pointer
                        ${
                          isActive
                            ? 'text-stone-950'
                            : isStudent
                              ? 'text-purple-700'
                              : 'text-stone-600'
                        }
                      `}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="mobile-navbar-active-pill"
                          className="
                            absolute
                            inset-0
                            rounded-lg
                            bg-gradient-to-r
                            from-amber-400
                            to-orange-400
                          "
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        <span>{item.label}</span>

                        {isStudent && !isActive && (
                          <span className="text-[8px] text-amber-500">
                            ✦
                          </span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </motion.header>
    </div>
  );
};