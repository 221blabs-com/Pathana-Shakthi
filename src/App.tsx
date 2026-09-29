import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  Story,
  Student,
  ReadingSessionLog,
  UserSession,
  AppViewRoute,
} from './types';

import { DEFAULT_STORIES } from './data/defaultStories';
import { offlineStorage } from './services/offlineStorage';
import { networkSyncToastService } from './services/networkSyncToastService';
import {
  authService,
  SUPERADMIN_URI_CODE,
} from './services/authService';

import { soundEffects } from './services/soundEffects';

// Components & Full Pages
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/Pages/LandingPage';
import { StudentLibraryPage } from './components/Pages/StudentLibraryPage';
import { SubjectStoriesPage } from './components/Pages/SubjectStoriesPage';
import { FacultyPortalPage } from './components/Pages/FacultyPortalPage';
import { SchoolAdminPage } from './components/Pages/SchoolAdminPage';
import { SuperAdminPortalPage } from './components/Pages/SuperAdminPortalPage';
import { LoginPage } from './components/Pages/LoginPage';
import { ReadAlongReader } from './components/ReadAlongReader';
import { VoiceSetupPage } from './components/Pages/VoiceSetupPage';

// Shared Modals
import { ComprehensionModal } from './components/ComprehensionModal';
import { RewardChestModal } from './components/RewardChestModal';
import { ReadingCertificateModal } from './components/ReadingCertificateModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { NetworkRetryToast } from './components/NetworkRetryToast';

export default function App() {

  // ============================================================
  // NAVIGATION & ROUTE STATE
  // ============================================================

  const [currentRoute, setCurrentRoute] =
    useState<AppViewRoute>('landing');

  const [
    selectedSubjectPage,
    setSelectedSubjectPage,
  ] = useState<string | null>(null);

  const [session, setSession] =
    useState<UserSession | null>(
      authService.getSession(),
    );

  // ============================================================
  // CORE DATA STATE
  // ============================================================

  const [stories, setStories] =
    useState<Story[]>([]);

  const [activeStory, setActiveStory] =
    useState<Story | null>(null);

  const [currentStudent, setCurrentStudent] =
    useState<Student>(
      offlineStorage.getCurrentStudent(),
    );

  const [studentsList, setStudentsList] =
    useState<Student[]>(
      offlineStorage.getStudents(),
    );

  const [readingLogs, setReadingLogs] =
    useState<ReadingSessionLog[]>(
      offlineStorage.getReadingLogs(),
    );

  // ============================================================
  // MODALS
  // ============================================================

  const [showQuizModal, setShowQuizModal] =
    useState(false);

  const [showRewardModal, setShowRewardModal] =
    useState(false);

  const [showCertificateModal, setShowCertificateModal] =
    useState(false);

  const [
    certificateBlockedMessage,
    setCertificateBlockedMessage,
  ] = useState<string | null>(null);

  const [showOfflineModal, setShowOfflineModal] =
    useState(false);

  const [showProfileModal, setShowProfileModal] =
    useState(false);

  // ============================================================
  // SESSION STATS
  // ============================================================

  const [lastSessionStats, setLastSessionStats] =
    useState<{
      durationSeconds: number;
      wordsRead: number;
      totalWords: number;
      accuracy: number;
      wpm: number;
      starsEarned: number;
      struggledWords: string[];
      storyTitle: string;
    } | null>(null);

  // ============================================================
  // INITIAL ROUTE PARSER
  // ============================================================

  useEffect(() => {

    const parseUrlRoute = () => {

      const rawPath =
        window.location.pathname;

      const path =
        rawPath.toLowerCase();

      // Super Admin
      if (path.includes(SUPERADMIN_URI_CODE)) {

        setCurrentRoute('superadmin');

        return;
      }

      // Subject Stories
      if (
        path.includes('/student/subject/')
      ) {

        const subjectPart =
          rawPath
            .split('/student/subject/')[1]
            ?.split('/')[0] ?? '';

        setSelectedSubjectPage(
          subjectPart
            ? decodeURIComponent(subjectPart)
            : null,
        );

        setCurrentRoute(
          'student_library',
        );

        return;
      }

      // Student Library
      if (
        path.includes('/student') ||
        path.includes('/library')
      ) {

        setSelectedSubjectPage(null);

        setCurrentRoute(
          'student_library',
        );

        return;
      }

      // Voice Setup
      if (
        path.includes('/voice-setup') ||
        path.includes('/setup') ||
        path.includes('/mic')
      ) {

        setCurrentRoute(
          'voice_setup',
        );

        return;
      }

      // Faculty
      if (
        path.includes('/faculty') ||
        path.includes('/teacher')
      ) {

        setCurrentRoute(
          'faculty_dashboard',
        );

        return;
      }

      // School Admin
      if (path.includes('/admin')) {

        setCurrentRoute(
          'school_admin',
        );

        return;
      }

      // Login
      if (path.includes('/login')) {

        setCurrentRoute('login');

        return;
      }

      // Default
      setCurrentRoute('landing');
    };

    parseUrlRoute();

    const handlePopState = () => {
      parseUrlRoute();
    };

    window.addEventListener(
      'popstate',
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState,
      );
    };

  }, []);

  // ============================================================
  // INITIALIZE STORIES + AUTH
  // ============================================================

  useEffect(() => {

    const saved =
      offlineStorage.getStories();

    if (saved.length > 0) {

      setStories(saved);

    } else {

      offlineStorage.saveStories(
        DEFAULT_STORIES,
      );

      setStories(
        DEFAULT_STORIES,
      );
    }

    const unsubAuth =
      authService.subscribe(
        (newSession) => {

          setSession(newSession);

          if (
            newSession &&
            newSession.role === 'student'
          ) {

            const student =
              offlineStorage
                .getStudents()
                .find(
                  (s) =>
                    s.id ===
                    newSession.id,
                );

            if (student) {

              offlineStorage.setCurrentStudentId(
                student.id,
              );

              setCurrentStudent(
                student,
              );
            }
          }
        },
      );

    return () => unsubAuth();

  }, []);

  // ============================================================
  // GENERAL ROUTER
  // ============================================================

  const navigateTo =
    useCallback(
      (
        route:
          | AppViewRoute
          | string,
      ) => {

        soundEffects.playPageTurn();

        const target =
          route as AppViewRoute;

        setCurrentRoute(target);

        if (
          target ===
          'student_library'
        ) {

          setSelectedSubjectPage(
            null,
          );
        }

        let path = '/';

        if (
          target ===
          'superadmin'
        ) {

          path =
            `/${SUPERADMIN_URI_CODE}`;

        } else if (
          target ===
          'student_library'
        ) {

          path = '/student';

        } else if (
          target ===
          'voice_setup'
        ) {

          path = '/voice-setup';

        } else if (
          target ===
          'faculty_dashboard'
        ) {

          path = '/faculty';

        } else if (
          target ===
          'school_admin'
        ) {

          path = '/admin';

        } else if (
          target === 'login'
        ) {

          path = '/login';

        } else if (
          target === 'reader'
        ) {

          path = activeStory
            ? `/reader/${activeStory.id}`
            : '/reader';
        }

        if (
          window.location.pathname !==
          path
        ) {

          window.history.pushState(
            {},
            '',
            path,
          );
        }

        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant',
        });
      },
      [activeStory],
    );

  // ============================================================
  // ROUTE SCROLL RESET
  // ============================================================

  useEffect(() => {

    if (
      typeof window !==
      'undefined'
    ) {

      if (
        'scrollRestoration' in
        window.history
      ) {

        window.history.scrollRestoration =
          'manual';
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant',
      });
    }

  }, [currentRoute]);

  // ============================================================
  // REFRESH STUDENT STATE
  // ============================================================

  const refreshStudentState =
    () => {

      setCurrentStudent(
        offlineStorage.getCurrentStudent(),
      );

      setStudentsList(
        offlineStorage.getStudents(),
      );

      setReadingLogs(
        offlineStorage.getReadingLogs(),
      );

      setStories(
        offlineStorage.getStories(),
      );
    };

  // ============================================================
  // TOGGLE OFFLINE STORY
  // ============================================================

  const handleToggleOffline =
    (storyId: string) => {

      const story =
        stories.find(
          (s) =>
            s.id === storyId,
        );

      if (!story) return;

      offlineStorage.toggleStoryOffline(
        storyId,
      );

      const updated =
        offlineStorage.getStories();

      setStories(updated);

      soundEffects.playWordPop();

      const isNowOffline =
        updated.find(
          (s) =>
            s.id === storyId,
        )?.isDownloadedOffline;

      if (isNowOffline) {

        networkSyncToastService.notifySuccess(
          `"${story.title}" Ready Offline`,
          `Story and decodable audio are available for offline practice.`,
          'కథ ఆఫ్‌లైన్ లో భద్రపరచబడింది',
        );
      }
    };

  // ============================================================
  // OPEN STORY READER
  // ============================================================

  const handleSelectStory =
    (story: Story) => {

      soundEffects.playStarChime();

      setActiveStory(story);

      setCurrentRoute(
        'reader',
      );

      if (
        window.location.pathname !==
        `/reader/${story.id}`
      ) {

        window.history.pushState(
          {},
          '',
          `/reader/${story.id}`,
        );
      }
    };

  // ============================================================
  // OPEN SUBJECT PAGE
  // ============================================================

  const handleOpenSubject =
    (subject: string) => {

      const cleanSubject =
        subject.trim();

      if (!cleanSubject) return;

      soundEffects.playPageTurn();

      setSelectedSubjectPage(
        cleanSubject,
      );

      setCurrentRoute(
        'student_library',
      );

      const path =
        `/student/subject/${encodeURIComponent(
          cleanSubject,
        )}`;

      if (
        window.location.pathname !==
        path
      ) {

        window.history.pushState(
          {},
          '',
          path,
        );
      }

      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant',
      });
    };

  // ============================================================
  // OPEN VOICE SETUP
  // ============================================================

  const handleOpenVoiceSetup =
    (story?: Story) => {

      soundEffects.playPageTurn();

      if (story) {
        setActiveStory(story);
      }

      navigateTo(
        'voice_setup',
      );
    };

  // ============================================================
  // STORY COMPLETION
  // ============================================================

  const handleStoryComplete =
    (stats: {
      durationSeconds: number;
      wordsRead: number;
      totalWords: number;
      accuracy: number;
      wpm: number;
      starsEarned: number;
      struggledWords: string[];
    }) => {

      if (!activeStory) return;

      const newLog:
        ReadingSessionLog = {
        id: `log_${Date.now()}`,
        studentId:
          currentStudent.id,
        storyId:
          activeStory.id,
        storyTitle:
          activeStory.title,
        language:
          activeStory.language,
        gradeLevel:
          activeStory.gradeLevel,
        date:
          new Date().toISOString(),
        durationSeconds:
          stats.durationSeconds,
        wordsRead:
          stats.wordsRead,
        totalWords:
          stats.totalWords,
        accuracyRate:
          stats.accuracy,
        wpm:
          stats.wpm,
        starsEarned:
          stats.starsEarned,
        struggledWords:
          stats.struggledWords,
        synced: false,
      };

      offlineStorage.saveReadingSession(
        newLog,
      );

      refreshStudentState();

      setLastSessionStats({
        ...stats,
        storyTitle:
          activeStory.title,
      });

      if (
        activeStory
          .comprehensionQuiz
          ?.length > 0
      ) {

        setShowQuizModal(
          true,
        );

      } else {

        setShowRewardModal(
          true,
        );
      }
    };

  // ============================================================
  // QUIZ FINISH
  // ============================================================

  const handleQuizFinish =
    (
      _score: number,
      _total: number,
    ) => {

      setShowQuizModal(false);

      refreshStudentState();

      setShowRewardModal(true);
    };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout =
    () => {

      authService.logout();

      setSession(null);

      soundEffects.playWordPop();

      navigateTo(
        'landing',
      );
    };

  // ============================================================
  // ADD CUSTOM STORY
  // ============================================================

  const handleAddCustomStory =
    (story: Story) => {

      offlineStorage.addCustomStory(
        story,
      );

      setStories(
        offlineStorage.getStories(),
      );

      soundEffects.playStarChime();
    };

  // ============================================================
  // SUBJECT PAGE NAVIGATION
  //
  // The normal Navbar remains visible on the subject page.
  // Its existing sidebar receives the subject selector.
  // ============================================================

  const isSubjectStoriesPage =
    currentRoute ===
      'student_library' &&
    selectedSubjectPage !==
      null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-amber-200">

      {/* ========================================================
          GLOBAL NAVBAR

          The existing sidebar stays visible on SubjectStoriesPage.
          Subject selection is embedded inside the same sidebar.
          There is NO separate Subjects navbar on the page.
          ======================================================== */}

      {currentRoute !== 'reader' && (
        <Navbar
            currentRoute={
              currentRoute
            }
            onNavigate={
              navigateTo
            }
            session={session}
            student={
              currentStudent
            }
            onOpenOfflineModal={() =>
              setShowOfflineModal(
                true,
              )
            }
            onOpenProfile={() =>
              setShowProfileModal(
                true,
              )
            }
            onLogout={
              handleLogout
            }
            showSubjects={
              isSubjectStoriesPage
            }
            selectedSubject={
              selectedSubjectPage
            }
            onSelectSubject={
              handleOpenSubject
            }
        />
      )}

      {/* ========================================================
          PRIMARY PAGE ROUTER
          ======================================================== */}

      <main className="flex-1 flex flex-col">

        {/* ======================================================
            LANDING PAGE
            ====================================================== */}

        {currentRoute ===
          'landing' && (
          <LandingPage
            onNavigate={
              navigateTo
            }
          />
        )}

        {/* ======================================================
            STUDENT LIBRARY
            ====================================================== */}

        {currentRoute ===
          'student_library' && (

          selectedSubjectPage ? (

            <SubjectStoriesPage
              subject={
                selectedSubjectPage
              }

              stories={stories}

              student={
                currentStudent
              }

              onSelectStory={
                handleSelectStory
              }

              onOpenVoiceSetup={
                handleOpenVoiceSetup
              }

              onToggleOffline={
                handleToggleOffline
              }

              /*
               * Normal back button.
               */
              onBack={() => {

                soundEffects.playPageTurn();

                setSelectedSubjectPage(
                  null,
                );

                window.history.pushState(
                  {},
                  '',
                  '/student',
                );

                window.scrollTo({
                  top: 0,
                  left: 0,
                  behavior:
                    'instant',
                });
              }}

            />

          ) : (

            <StudentLibraryPage
              stories={stories}
              student={
                currentStudent
              }

              onSelectStory={
                handleSelectStory
              }

              onOpenVoiceSetup={
                handleOpenVoiceSetup
              }

              onToggleOffline={
                handleToggleOffline
              }

              onOpenRewardChest={() =>
                setShowRewardModal(
                  true,
                )
              }

              onOpenCertificateModal={() =>
                setShowCertificateModal(
                  true,
                )
              }

              onOpenOfflineModal={() =>
                setShowOfflineModal(
                  true,
                )
              }

              onOpenProfile={() =>
                setShowProfileModal(
                  true,
                )
              }

              onRefreshStudent={
                refreshStudentState
              }

              onOpenSubject={
                handleOpenSubject
              }
            />

          )
        )}

        {/* ======================================================
            VOICE SETUP
            ====================================================== */}

        {currentRoute ===
          'voice_setup' && (

          <VoiceSetupPage
            student={
              currentStudent
            }

            pendingStory={
              activeStory
            }

            stories={stories}

            onStartReading={
              handleSelectStory
            }

            onNavigateBack={() =>
              navigateTo(
                'student_library',
              )
            }

            onPronunciationComplete={({
              language,
              accuracy,
              speedWPM,
              fluency,
            }) => {

              const current =
                offlineStorage.getCurrentStudent();

              const previous =
                current
                  .pronunciationMetrics?.[
                  language
                ];

              const updatedMetrics = {
                ...(current.pronunciationMetrics ||
                  {}),

                [language]: {
                  accuracy,
                  speedWPM,
                  fluency,
                  attempts:
                    (previous?.attempts ||
                      0) + 1,
                  lastUpdated:
                    new Date().toISOString(),
                },
              };

              const newAverageWpm =
                Math.round(
                  (
                    current.averageWPM +
                    speedWPM
                  ) / 2,
                );

              const newOverallAccuracy =
                Math.round(
                  (
                    current.overallAccuracy +
                    accuracy
                  ) / 2,
                );

              const starsForAttempt =
                accuracy >= 70
                  ? 2
                  : 0;

              const updatedStudent =
                offlineStorage.updateCurrentStudent(
                  {
                    pronunciationMetrics:
                      updatedMetrics,

                    languageProficiency:
                      {
                        ...current.languageProficiency,
                        [language]:
                          accuracy,
                      },

                    averageWPM:
                      newAverageWpm,

                    overallAccuracy:
                      newOverallAccuracy,

                    stars:
                      current.stars +
                      starsForAttempt,
                  },
                );

              setCurrentStudent(
                updatedStudent,
              );

              setStudentsList(
                offlineStorage.getStudents(),
              );
            }}
          />
        )}

        {/* ======================================================
            FACULTY
            ====================================================== */}

        {currentRoute ===
          'faculty_dashboard' && (

          <FacultyPortalPage
            students={
              studentsList
            }

            readingLogs={
              readingLogs
            }

            stories={stories}

            onAddStory={
              handleAddCustomStory
            }

            onSelectStudent={(
              std,
            ) => {

              offlineStorage.setCurrentStudentId(
                std.id,
              );

              setCurrentStudent(
                std,
              );

              setShowProfileModal(
                true,
              );
            }}

            onOpenSyncModal={() =>
              setShowOfflineModal(
                true,
              )
            }

            onNavigate={
              navigateTo
            }
          />
        )}

        {/* ======================================================
            SCHOOL ADMIN
            ====================================================== */}

        {currentRoute ===
          'school_admin' && (

          <SchoolAdminPage
            onNavigate={
              navigateTo
            }
          />
        )}

        {/* ======================================================
            SUPER ADMIN
            ====================================================== */}

        {currentRoute ===
          'superadmin' && (

          <SuperAdminPortalPage
            onNavigate={
              navigateTo
            }
          />
        )}

        {/* ======================================================
            LOGIN
            ====================================================== */}

        {currentRoute ===
          'login' && (

          <LoginPage
            onLoginSuccess={(
              newSession,
            ) => {

              setSession(
                newSession,
              );

              refreshStudentState();
            }}

            onNavigate={
              navigateTo
            }
          />
        )}

        {/* ======================================================
            READER
            ====================================================== */}

        {currentRoute ===
          'reader' &&
          activeStory && (

          <ReadAlongReader
            story={
              activeStory
            }

            onClose={() =>
              navigateTo(
                'student_library',
              )
            }

            onComplete={
              handleStoryComplete
            }
          />
        )}

      </main>

      {/* ========================================================
          COMPREHENSION QUIZ
          ======================================================== */}

      {showQuizModal &&
        activeStory && (

          <ComprehensionModal
            isOpen={
              showQuizModal
            }

            onClose={() =>
              setShowQuizModal(
                false,
              )
            }

            questions={
              activeStory.comprehensionQuiz
            }

            storyTitle={
              activeStory.title
            }

            language={
              activeStory.language
            }

            onFinishQuiz={
              handleQuizFinish
            }
          />
        )}

      {/* ========================================================
          REWARD CHEST
          ======================================================== */}

      {showRewardModal && (

        <RewardChestModal
          isOpen={
            showRewardModal
          }

          onClose={() =>
            setShowRewardModal(
              false,
            )
          }

          student={
            currentStudent
          }

          lastSessionStats={
            lastSessionStats
          }

          onOpenCertificates={() => {

            if (
              lastSessionStats &&
              lastSessionStats.accuracy <
                70
            ) {

              setShowRewardModal(
                false,
              );

              setCertificateBlockedMessage(
                `Almost there! This story was read at ${lastSessionStats.accuracy}% accuracy — read it again at 70% or higher to earn the certificate.`,
              );

              return;
            }

            setShowRewardModal(
              false,
            );

            setShowCertificateModal(
              true,
            );
          }}
        />
      )}

      {/* ========================================================
          CERTIFICATE BLOCKED
          ======================================================== */}

      {certificateBlockedMessage && (

        <div
          id="certificate-blocked-toast"
          className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >

          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-[#e8e4d8] text-center">

            <p className="text-sm font-bold text-stone-800">
              {
                certificateBlockedMessage
              }
            </p>

            <button
              type="button"
              onClick={() =>
                setCertificateBlockedMessage(
                  null,
                )
              }
              className="mt-4 bg-[#2d2d2d] hover:bg-black text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl"
            >
              Okay, I'll try again
            </button>

          </div>

        </div>
      )}

      {/* ========================================================
          CERTIFICATE
          ======================================================== */}

      {showCertificateModal && (

        <ReadingCertificateModal
          isOpen={
            showCertificateModal
          }

          onClose={() =>
            setShowCertificateModal(
              false,
            )
          }

          student={
            currentStudent
          }

          storiesReadCount={
            currentStudent
              .completedStoryIds
              .length
          }
        />
      )}

      {/* ========================================================
          OFFLINE SYNC
          ======================================================== */}

      {showOfflineModal && (

        <OfflineSyncModal
          isOpen={
            showOfflineModal
          }

          onClose={() =>
            setShowOfflineModal(
              false,
            )
          }

          stories={stories}

          onSyncComplete={
            refreshStudentState
          }
        />
      )}

      {/* ========================================================
          STUDENT PROFILE
          ======================================================== */}

      {showProfileModal && (

        <StudentProfileModal
          isOpen={
            showProfileModal
          }

          onClose={() =>
            setShowProfileModal(
              false,
            )
          }

          student={
            currentStudent
          }

          onUpdateStudent={(
            updated,
          ) => {

            setCurrentStudent(
              updated,
            );

            refreshStudentState();
          }}

          onSelectAnotherStudent={(
            id,
          ) => {

            offlineStorage.setCurrentStudentId(
              id,
            );

            refreshStudentState();
          }}

          availableStudents={
            studentsList
          }
        />
      )}

      {/* ========================================================
          GLOBAL NETWORK TOAST
          ======================================================== */}

      <NetworkRetryToast />

    </div>
  );
}