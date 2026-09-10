import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { motion } from 'motion/react';
import { gsap } from 'gsap';

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
    useState(true);

  const [isCollapsed, setIsCollapsed] =
    useState(true);

  const [isSidebarHovered, setIsSidebarHovered] =
    useState(false);

  const isSidebarExpanded =
    !isCollapsed || isSidebarHovered;

  // ============================================================
  // AUTHENTICATED AREA
  // ============================================================

  const isAuthenticatedArea =
    Boolean(session) &&
    currentRoute !== 'landing' &&
    currentRoute !== 'login';

  // ============================================================
  // PUBLIC NAVBAR SCROLL BEHAVIOUR
  // ============================================================

  useEffect(() => {
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
        onMouseEnter={() =>
          setIsSidebarHovered(true)
        }
        onMouseLeave={() =>
          setIsSidebarHovered(false)
        }
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
        {/* ====================================================
            MOBILE BACKDROP
        ==================================================== */}

        {isSidebarExpanded && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="
              fixed
              inset-0
              -z-10
              bg-black/10
              md:hidden
              cursor-default
            "
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
  // PUBLIC PILL NAV
  // ============================================================
  // ============================================================

  return (
    <PathanaShakthiPillNav
      isVisible={isVisible}
      onNavigate={handleNavigate}
    />
  );
};

// ============================================================
// ============================================================
// PATHANA SHAKTHI PILL NAV
// ============================================================
// ============================================================

interface PathanaShakthiPillNavProps {
  isVisible: boolean;
  onNavigate: (route: AppViewRoute) => void;
}

const PathanaShakthiPillNav: React.FC<
  PathanaShakthiPillNavProps
> = ({
  isVisible,
  onNavigate,
}) => {
  // ============================================================
  // REFS
  // ============================================================

  const brandRef =
    useRef<HTMLButtonElement | null>(null);

  const loginRef =
    useRef<HTMLButtonElement | null>(null);

  const loginCircleRef =
    useRef<HTMLSpanElement | null>(null);

  const loginTimelineRef =
    useRef<gsap.core.Timeline | null>(null);

  const loginTweenRef =
    useRef<gsap.core.Tween | null>(null);

  // ============================================================
  // LOGIN PILL GEOMETRY
  // ============================================================

  useEffect(() => {
    const layout = () => {
      const circle =
        loginCircleRef.current;

      const pill =
        loginRef.current;

      if (!circle || !pill) {
        return;
      }

      const rect =
        pill.getBoundingClientRect();

      const w =
        rect.width;

      const h =
        rect.height;

      // ========================================================
      // React Bits PillNav geometry
      // ========================================================

      const R =
        ((w * w) / 4 + h * h) /
        (2 * h);

      const D =
        Math.ceil(2 * R) + 2;

      const delta =
        Math.ceil(
          R -
            Math.sqrt(
              Math.max(
                0,
                R * R -
                  (w * w) / 4
              )
            )
        ) + 1;

      const originY =
        D - delta;

      circle.style.width =
        `${D}px`;

      circle.style.height =
        `${D}px`;

      circle.style.bottom =
        `-${delta}px`;

      gsap.set(
        circle,
        {
          xPercent: -50,
          scale: 0,
          transformOrigin:
            `50% ${originY}px`,
        }
      );

      // ========================================================
      // LABELS
      // ========================================================

      const label =
        pill.querySelector(
          '.pill-label'
        ) as HTMLElement | null;

      const hoverLabel =
        pill.querySelector(
          '.pill-label-hover'
        ) as HTMLElement | null;

      if (label) {
        gsap.set(
          label,
          {
            y: 0,
          }
        );
      }

      if (hoverLabel) {
        gsap.set(
          hoverLabel,
          {
            y: h + 12,
            opacity: 0,
          }
        );
      }

      // ========================================================
      // TIMELINE
      // ========================================================

      loginTimelineRef.current?.kill();

      const tl =
        gsap.timeline({
          paused: true,
        });

      tl.to(
        circle,
        {
          scale: 1.2,
          xPercent: -50,
          duration: 2,
          ease: 'power3.easeOut',
          overwrite: 'auto',
        },
        0
      );

      if (label) {
        tl.to(
          label,
          {
            y: -(h + 8),
            duration: 2,
            ease: 'power3.easeOut',
            overwrite: 'auto',
          },
          0
        );
      }

      if (hoverLabel) {
        gsap.set(
          hoverLabel,
          {
            y: Math.ceil(
              h + 100
            ),
            opacity: 0,
          }
        );

        tl.to(
          hoverLabel,
          {
            y: 0,
            opacity: 1,
            duration: 2,
            ease: 'power3.easeOut',
            overwrite: 'auto',
          },
          0
        );
      }

      loginTimelineRef.current =
        tl;
    };

    // Initial layout
    layout();

    // Resize
    const onResize =
      () => layout();

    window.addEventListener(
      'resize',
      onResize
    );

    // Fonts
    if (document.fonts?.ready) {
      document.fonts.ready
        .then(layout)
        .catch(() => {});
    }

    // ==========================================================
    // BRAND ENTRANCE
    // ==========================================================

    if (brandRef.current) {
      gsap.set(
        brandRef.current,
        {
          scale: 0,
        }
      );

      gsap.to(
        brandRef.current,
        {
          scale: 1,
          duration: 0.6,
          ease: 'power3.easeOut',
        }
      );
    }

    return () => {
      window.removeEventListener(
        'resize',
        onResize
      );

      loginTimelineRef.current?.kill();

      loginTweenRef.current?.kill();
    };
  }, []);

  // ============================================================
  // LOGIN HOVER ENTER
  // ============================================================

  const handleLoginEnter =
    () => {
      const tl =
        loginTimelineRef.current;

      if (!tl) {
        return;
      }

      loginTweenRef.current?.kill();

      loginTweenRef.current =
        tl.tweenTo(
          tl.duration(),
          {
            duration: 0.3,
            ease: 'power3.easeOut',
            overwrite: 'auto',
          }
        );
    };

  // ============================================================
  // LOGIN HOVER LEAVE
  // ============================================================

  const handleLoginLeave =
    () => {
      const tl =
        loginTimelineRef.current;

      if (!tl) {
        return;
      }

      loginTweenRef.current?.kill();

      loginTweenRef.current =
        tl.tweenTo(
          0,
          {
            duration: 0.2,
            ease: 'power3.easeOut',
            overwrite: 'auto',
          }
        );
    };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      id="app-navbar"

      className="
        relative
        z-40

        h-[104px]
        sm:h-[112px]

        pointer-events-none
      "
    >
      <motion.header
        initial={false}

        animate={{
          y:
            isVisible
              ? 0
              : -140,

          opacity:
            isVisible
              ? 1
              : 0,

          scale:
            isVisible
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

          top-4

          left-1/2
          -translate-x-1/2

          w-max

          max-w-[calc(100%-16px)]

          sm:max-w-[calc(100%-24px)]

          lg:max-w-none
        "
      >
        {/* ======================================================
            PILL NAV
        ====================================================== */}

        <nav
          aria-label="Primary"

          className="
            flex
            items-center

            w-max
            max-w-full

            box-border
          "
        >

          {/* ==================================================
              BRAND PILL
          ================================================== */}

          <button
            ref={brandRef}

            type="button"

            onClick={() =>
              onNavigate('landing')
            }

            className="
              relative

              flex
              items-center
              justify-start

              h-[72px]
              sm:h-[76px]

              /*
               * Wider horizontally
               */

              w-[360px]
              sm:w-[440px]
              lg:w-[500px]

              max-w-[calc(100vw-90px)]

              rounded-full

              bg-[#120F17]

              pl-2
              pr-7

              sm:pl-2.5
              sm:pr-8

              overflow-hidden

              cursor-pointer

              border-0

              shadow-[0_10px_30px_rgba(18,15,23,0.20)]

              transition-shadow
              duration-300

              hover:shadow-[0_14px_40px_rgba(18,15,23,0.27)]

              shrink-0
            "

            aria-label="Pathana Shakthi"
          >

            {/* ==================================================
                MASCOT

                No hover animation.
                Logo stays completely still.
            ================================================== */}

            <div
              className="
                relative

                w-[60px]
                h-[60px]

                sm:w-[64px]
                sm:h-[64px]

                shrink-0

                overflow-hidden
              "
            >
              <div
                className="
                  absolute

                  left-0

                  top-[45%]

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
                BRAND TEXT

                LetterSwap remains reactive.
            ================================================== */}

            <span
              className="
                ml-2
                sm:ml-3

                flex
                items-center

                overflow-visible

                shrink-0
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

                  text-[22px]
                  sm:text-[24px]
                  lg:text-[26px]

                  font-black

                  leading-none
                "

                frontFaceClassName="
                  whitespace-nowrap
                  overflow-visible

                  text-white

                  [font-family:'Nirmala_UI','Noto_Sans_Telugu',sans-serif]
                "

                backFaceClassName="
                  whitespace-nowrap
                  overflow-visible

                  text-white
                "
              />
            </span>

          </button>


          {/* ==================================================
              SPACE BETWEEN PILLS
          ================================================== */}

          <div
            className="
              w-3
              sm:w-4

              shrink-0
            "
          />


          {/* ==================================================
              LOGIN PILL
          ================================================== */}

          <button
            ref={loginRef}

            type="button"

            onClick={() => {
              soundEffects.playWordPop();
              onNavigate('login');
            }}

            onMouseEnter={
              handleLoginEnter
            }

            onMouseLeave={
              handleLoginLeave
            }

            id="btn-navbar-signup"

            className="
              relative

              inline-flex
              items-center
              justify-center

              h-[72px]
              sm:h-[76px]

              /*
               * Wider Login pill
               */

              px-9
              sm:px-10

              rounded-full

              box-border

              bg-[#fdfcf7]

              text-[#120F17]

              font-black

              text-[14px]
              sm:text-[15px]

              leading-none

              whitespace-nowrap

              cursor-pointer

              overflow-hidden

              border-0

              shadow-[0_10px_30px_rgba(18,15,23,0.12)]

              hover:shadow-[0_14px_34px_rgba(18,15,23,0.16)]

              shrink-0

              transition-shadow
              duration-200
            "
          >

            {/* ==================================================
                REACT BITS HOVER CIRCLE
            ================================================== */}

            <span
              ref={loginCircleRef}

              className="
                absolute

                left-1/2
                bottom-0

                rounded-full

                bg-[#ea5425]

                z-[1]

                block

                pointer-events-none

                will-change-transform
              "

              aria-hidden="true"
            />

            {/* ==================================================
                LABEL STACK
            ================================================== */}

            <span
              className="
                relative

                inline-block

                leading-none

                z-[2]
              "
            >

              {/* ==================================================
                  DEFAULT LABEL
              ================================================== */}

              <span
                className="
                  pill-label

                  relative

                  z-[2]

                  inline-flex
                  items-center

                  gap-2

                  text-[#120F17]
                "
              >
                <UserPlus
                  className="
                    w-[16px]
                    h-[16px]

                    shrink-0
                  "
                />

                <span>
                  Login
                </span>
              </span>


              {/* ==================================================
                  HOVER LABEL
              ================================================== */}

              <span
                className="
                  pill-label-hover

                  absolute

                  left-0
                  top-0

                  z-[3]

                  inline-flex
                  items-center

                  gap-2

                  text-white

                  whitespace-nowrap
                "

                aria-hidden="true"
              >
                <UserPlus
                  className="
                    w-[16px]
                    h-[16px]

                    shrink-0
                  "
                />

                <span>
                  Login
                </span>
              </span>

            </span>

          </button>

        </nav>
      </motion.header>
    </div>
  );
};

export default Navbar;