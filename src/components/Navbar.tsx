import React from 'react';
import { motion } from 'motion/react';

import {
  Student,
  UserSession,
  AppViewRoute,
} from '../types';

import { soundEffects } from '../services/soundEffects';
import { PathanaShakthiLogo } from './PathanaShakthiLogo';
import LetterSwap from './LetterSwap';

import {
  Home,
  BookOpen,
  Mic,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserPlus,
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
  onLogout,
}) => {
  // ============================================================
  // STATE
  // ============================================================

  const [isVisible, setIsVisible] =
    React.useState(true);

  const [isCollapsed, setIsCollapsed] =
    React.useState(true);

  const [isSidebarHovered, setIsSidebarHovered] =
    React.useState(false);

  const isSidebarExpanded =
    !isCollapsed || isSidebarHovered;

  // ============================================================
  // AUTHENTICATED AREA
  //
  // Landing and login remain with the top navbar.
  // Logged-in application pages use the sidebar.
  // ============================================================

  const isAuthenticatedArea =
    Boolean(session) &&
    currentRoute !== 'landing' &&
    currentRoute !== 'login';

  // ============================================================
  // TOP NAVBAR SCROLL BEHAVIOUR
  // ============================================================

  React.useEffect(() => {
    if (isAuthenticatedArea) {
      setIsVisible(true);
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateNavbar = () => {
      const currentScrollY =
        window.scrollY;

      const delta =
        currentScrollY - lastScrollY;

      if (currentScrollY <= 30) {
        setIsVisible(true);

        lastScrollY = currentScrollY;
        ticking = false;

        return;
      }

      if (Math.abs(delta) > 10) {
        setIsVisible(delta < 0);

        lastScrollY = currentScrollY;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(
          updateNavbar
        );

        ticking = true;
      }
    };

    window.addEventListener(
      'scroll',
      handleScroll,
      {
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        'scroll',
        handleScroll
      );
    };
  }, [isAuthenticatedArea]);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const handleNavigate = (
    route: AppViewRoute
  ) => {
    soundEffects.playPageTurn();
    onNavigate(route);
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    soundEffects.playWordPop();
    onLogout();
  };

  // ============================================================
  // SIDEBAR LINKS
  // ============================================================

  const sideLinks = [
    {
      id: 'home',
      label: 'Home',
      route: 'landing' as AppViewRoute,
      icon: Home,
    },
    {
      id: 'student-portal',
      label: 'Student Portal',
      route: 'student_library' as AppViewRoute,
      icon: BookOpen,
    },
    {
      id: 'voice-setup',
      label: 'Voice Setup',
      route: 'voice_setup' as AppViewRoute,
      icon: Mic,
    },
  ];

  // ============================================================
  // ============================================================
  // LOGGED-IN SIDEBAR
  // ============================================================
  // ============================================================

  if (isAuthenticatedArea) {
    return (
      <motion.aside
        initial={{
          x: -260,
        }}
        animate={{
          x: 0,
        }}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 30,
          mass: 0.8,
        }}
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          max-w-[86vw]

          ${
            isSidebarExpanded
              ? 'w-[260px]'
              : 'w-[76px]'
          }

          flex
          flex-col

          overflow-visible

          bg-[#fdfcf7]

          border-r
          border-[#e5e0d4]

          shadow-[8px_0_35px_rgba(60,45,20,0.08)]

          transition-[width]
          duration-300
          ease-out
        `}
      >
        {/* Mobile backdrop — closes the expanded rail when tapped */}
        {isSidebarExpanded && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 -z-10 bg-black/10 md:hidden cursor-default"
            onClick={() => {
              setIsCollapsed(true);
              setIsSidebarHovered(false);
            }}
          />
        )}

        {/* ====================================================
            TOP ACCENT
        ==================================================== */}

        <div
          className="
            absolute
            top-0
            left-0
            right-0
            h-[3px]

            bg-gradient-to-r
            from-amber-400
            via-orange-400
            to-rose-400
          "
        />

        {/* ====================================================
            BRAND
        ==================================================== */}

        <div
          className="
            px-3
            pt-5
            pb-5

            border-b
            border-[#e8e4d8]
          "
        >
          <button
            type="button"
            onClick={() =>
              handleNavigate('landing')
            }
            className={`
              w-full

              flex
              items-center

              ${
                isSidebarExpanded
                  ? 'gap-3'
                  : 'justify-center'
              }

              p-0

              border-0
              bg-transparent

              cursor-pointer
              text-left

              transition-all
              duration-300
            `}
            aria-label="Pathana Shakthi"
          >
            {/* ==================================================
                MASCOT
            ================================================== */}

            <div
              className="
                relative

                w-[46px]
                h-[46px]

                shrink-0

                overflow-hidden
              "
            >
              <div
                className="
                  absolute

                  left-0
                  top-1/2

                  -translate-y-1/2
                "
              >
                <PathanaShakthiLogo
                  size="md"
                  showSubtitle={false}
                />
              </div>
            </div>

            {/* ==================================================
                SIDEBAR LETTER SWAP

                Default:
                పఠన శక్తి

                Hover:
                Pathana Shakthi
            ================================================== */}

            {isSidebarExpanded && (
              <div
                className="
                  min-w-0
                  flex-1

                  overflow-visible
                "
              >
                <LetterSwap
                  frontText="పఠన శక్తి"
                  backText="Pathana Shakthi"

                  staggerInterval={0.035}

                  duration={0.55}

                  flipDirection="top"

                  blur={false}

                  className="
                    w-max
                    max-w-none

                    whitespace-nowrap
                    overflow-visible

                    text-[20px]

                    font-black

                    leading-none
                  "

                  frontFaceClassName="
                    whitespace-nowrap
                    overflow-visible

                    text-[#ea5425]

                    [font-family:'Nirmala_UI','Noto_Sans_Telugu',sans-serif]
                  "

                  backFaceClassName="
                    whitespace-nowrap
                    overflow-visible

                    text-stone-800
                  "
                />
              </div>
            )}
          </button>
        </div>

        {/* ====================================================
            USER INFORMATION
        ==================================================== */}

        {isSidebarExpanded && (
          <div
            className="
              px-4
              py-4
            "
          >
            <div
              className="
                flex
                items-center
                gap-3

                px-3
                py-3

                rounded-xl

                bg-orange-50

                border
                border-orange-100
              "
            >
              {/* AVATAR */}

              <div
                className="
                  w-9
                  h-9

                  rounded-lg

                  bg-white

                  flex
                  items-center
                  justify-center

                  text-lg

                  shrink-0
                "
              >
                {session?.avatar ||
                  student?.avatar ||
                  '👤'}
              </div>

              {/* USER DETAILS */}

              <div className="min-w-0">
                <p
                  className="
                    text-[9px]

                    font-black

                    uppercase

                    tracking-[0.12em]

                    text-orange-500
                  "
                >
                  {session?.role ||
                    'User'}
                </p>

                <p
                  className="
                    text-sm

                    font-black

                    text-stone-800

                    truncate
                  "
                >
                  {session?.name ||
                    'Welcome'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            SIDEBAR NAVIGATION
        ==================================================== */}

        <nav
          aria-label="Authenticated navigation"
          className="
            flex-1

            px-3
            py-2

            space-y-1
          "
        >
          {sideLinks.map(
            (item) => {
              const Icon = item.icon;

              const isActive =
                currentRoute ===
                item.route;

              return (
                <motion.button
                  key={item.id}

                  type="button"

                  onClick={() =>
                    handleNavigate(
                      item.route
                    )
                  }

                  whileHover={{
                    x: isSidebarExpanded
                      ? 3
                      : 0,
                  }}

                  whileTap={{
                    scale: 0.97,
                  }}

                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 25,
                  }}

                  className={`
                    group
                    relative

                    w-full

                    flex
                    items-center

                    ${
                      isSidebarExpanded
                        ? 'gap-3'
                        : 'justify-center'
                    }

                    px-3
                    py-3

                    rounded-xl

                    text-sm
                    font-bold

                    text-left

                    cursor-pointer

                    transition-colors
                    duration-200

                    ${
                      isActive
                        ? 'text-stone-950'
                        : 'text-stone-600 hover:text-stone-950'
                    }
                  `}

                  title={
                    isCollapsed
                      ? item.label
                      : undefined
                  }
                >
                  {/* ACTIVE BACKGROUND */}

                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"

                      className="
                        absolute
                        inset-0

                        rounded-xl

                        bg-gradient-to-r
                        from-amber-400
                        to-orange-400

                        shadow-sm
                      "

                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 30,
                      }}
                    />
                  )}

                  {/* HOVER BACKGROUND */}

                  {!isActive && (
                    <span
                      className="
                        absolute
                        inset-0

                        rounded-xl

                        bg-orange-50

                        opacity-0

                        group-hover:opacity-100

                        transition-opacity
                        duration-200
                      "
                    />
                  )}

                  {/* ICON */}

                  <span
                    className="
                      relative
                      z-10

                      flex
                      items-center
                      justify-center

                      w-8
                      h-8

                      rounded-lg

                      shrink-0
                    "
                  >
                    <Icon
                      className={`
                        w-[18px]
                        h-[18px]

                        ${
                          isActive
                            ? 'text-stone-950'
                            : 'text-[#ea5425]'
                        }
                      `}
                    />
                  </span>

                  {/* LABEL */}

                  {isSidebarExpanded && (
                    <span
                      className="
                        relative
                        z-10

                        whitespace-nowrap
                      "
                    >
                      {item.label}
                    </span>
                  )}
                </motion.button>
              );
            }
          )}
        </nav>

        {/* ====================================================
            LOGOUT
        ==================================================== */}

        <div
          className="
            px-3
            py-4

            border-t
            border-[#e8e4d8]
          "
        >
          <motion.button
            type="button"

            onClick={handleLogout}

            whileHover={{
              x: isSidebarExpanded
                ? 3
                : 0,
            }}

            whileTap={{
              scale: 0.97,
            }}

            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 25,
            }}

            className={`
              group
              relative

              w-full

              flex
              items-center

              ${
                isSidebarExpanded
                  ? 'gap-3'
                  : 'justify-center'
              }

              px-3
              py-3

              rounded-xl

              text-sm
              font-bold

              text-stone-600

              hover:text-rose-700

              cursor-pointer

              transition-colors
              duration-200
            `}

            title={
              !isSidebarExpanded
                ? 'Logout'
                : undefined
            }
          >
            {/* HOVER BACKGROUND */}

            <span
              className="
                absolute
                inset-0

                rounded-xl

                bg-rose-50

                opacity-0

                group-hover:opacity-100

                transition-opacity
                duration-200
              "
            />

            {/* ICON */}

            <span
              className="
                relative
                z-10

                flex
                items-center
                justify-center

                w-8
                h-8

                rounded-lg

                shrink-0
              "
            >
              <LogOut
                className="
                  w-[18px]
                  h-[18px]

                  text-rose-600
                "
              />
            </span>

            {/* LABEL */}

            {isSidebarExpanded && (
              <span
                className="
                  relative
                  z-10

                  whitespace-nowrap
                "
              >
                Logout
              </span>
            )}
          </motion.button>
        </div>
      </motion.aside>
    );
  }

  // ============================================================
  // ============================================================
  // PUBLIC TOP NAVBAR
  // ============================================================
  // ============================================================

  return (
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
          y: isVisible
            ? 0
            : -115,

          opacity: isVisible
            ? 1
            : 0,

          scale: isVisible
            ? 1
            : 0.985,
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
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
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
          className="
            relative

            max-w-[1400px]
            mx-auto

            overflow-hidden

            rounded-[20px]

            border
            border-[#e6e1d5]

            bg-[#fdfcf7]/95

            backdrop-blur-xl

            shadow-[0_8px_28px_rgba(60,45,20,0.09)]
          "
        >
          {/* ==================================================
              TOP ACCENT
          ================================================== */}

          <div
            className="
              absolute

              top-0
              left-0
              right-0

              h-[2px]

              bg-gradient-to-r
              from-amber-400
              via-orange-400
              to-rose-400
            "
          />

          <div
            className="
              px-4
              sm:px-5
              lg:px-7

              py-2.5
            "
          >
            <div
              className="
                flex
                items-center
                justify-between

                gap-4
              "
            >
              {/* ==================================================
                  BRAND
              ================================================== */}

              <motion.button
                type="button"

                onClick={() =>
                  handleNavigate(
                    'landing'
                  )
                }

                whileHover={{
                  scale: 1.02,
                }}

                whileTap={{
                  scale: 0.97,
                }}

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

                aria-label="Pathana Shakthi"
              >
                {/* MASCOT */}

                <div
                  className="
                    relative

                    w-[52px]
                    h-[52px]

                    shrink-0

                    overflow-hidden
                  "
                >
                  <div
                    className="
                      absolute

                      left-0
                      top-1/2

                      -translate-y-1/2
                    "
                  >
                    <PathanaShakthiLogo
                      size="md"
                      showSubtitle={false}
                    />
                  </div>
                </div>

                {/* ==================================================
                    TOP LETTER SWAP
                ================================================== */}

                <div
                  className="
                    ml-2
                    sm:ml-2.5

                    overflow-visible
                  "
                >
                  <LetterSwap
                    frontText="పఠన శక్తి"
                    backText="Pathana Shakthi"

                    staggerInterval={0.035}

                    duration={0.55}

                    flipDirection="top"

                    blur={false}

                    className="
                      w-max
                      max-w-none

                      whitespace-nowrap
                      overflow-visible

                      text-[21px]
                      sm:text-[23px]
                      lg:text-[25px]

                      font-black

                      leading-none
                    "

                    frontFaceClassName="
                      whitespace-nowrap
                      overflow-visible

                      text-[#ea5425]

                      [font-family:'Nirmala_UI','Noto_Sans_Telugu',sans-serif]
                    "

                    backFaceClassName="
                      whitespace-nowrap
                      overflow-visible

                      text-stone-800
                    "
                  />
                </div>
              </motion.button>

              {/* ==================================================
                  SINGLE SIGNUP BUTTON
              ================================================== */}

              <motion.button
                type="button"

                onClick={() => {
                  soundEffects.playWordPop();
                  onNavigate('login');
                }}

                whileHover={{
                  y: -1,
                }}

                whileTap={{
                  scale: 0.97,
                }}

                transition={{
                  type: 'spring',
                  stiffness: 450,
                  damping: 25,
                }}

                id="btn-navbar-signup"

                className="
                  group
                  relative

                  flex
                  items-center
                  justify-center

                  gap-1.5

                  px-5
                  py-2.5

                  rounded-xl

                  bg-[#ea5425]

                  text-white

                  text-xs
                  font-black

                  border
                  border-[#ea5425]

                  shadow-sm

                  hover:shadow-md

                  cursor-pointer

                  transition-all
                  duration-200
                  ease-out

                  hover:bg-[#d9471d]

                  shrink-0
                "
              >
                {/* HOVER SHINE */}

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

                {/* CONTENT */}

                <span
                  className="
                    relative
                    z-10

                    flex
                    items-center

                    gap-1.5
                  "
                >
                  <UserPlus
                    className="
                      w-3.5
                      h-3.5
                    "
                  />

                  <span>
                    Login
                  </span>
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>
    </div>
  );
};

export default Navbar;