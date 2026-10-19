import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  Story,
  Student,
  ReadingSessionLog,
  UserSession,
  AppViewRoute,
} from './types';

import {
  createBlankStudent,
  offlineStorage,
} from './services/offlineStorage';
import {
  progressSync,
  STUDENT_UPDATED_EVENT,
} from './services/progressSync';
import { networkSyncToastService } from './services/networkSyncToastService';
import {
  authService,
  SUPERADMIN_URI_CODE,
} from './services/authService';
import { firebaseAuthService } from './services/firebaseAuthService';
import { firebaseAuth } from './services/firebase';
import { soundEffects } from './services/soundEffects';

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
import { WordDictionaryPage } from './components/Pages/WordDictionaryPage';

import {
  markQuizBonus,
  quizBonusAvailable,
  quizBonusStars,
} from './services/quizBonus';
import { ComprehensionModal } from './components/ComprehensionModal';
import { RewardChestModal } from './components/RewardChestModal';
import {
  openWorkbook,
  UnitWorkbookHost,
} from './components/UnitWorkbookPanel';
import { ExplainerHost } from './components/ExplainerPlayer';
import {
  levelOfStudent,
  readerSettingsFor,
} from './data/readingLevels';
import { ReadingCertificateModal } from './components/ReadingCertificateModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { NetworkRetryToast } from './components/NetworkRetryToast';
import { backendApi } from './services/backendApi';
import {
  nextChapterOf,
  publishedReadingToStory,
} from './services/publishedReadingToStory';
import { LearnPlayPage } from './components/learnplay/LearnPlayPage';
import { labChapterById } from './data/learnPlay';
import { EnglishCoursePage } from './components/class1english/EnglishCoursePage';
import { BookActivitiesHost } from './components/BookActivitiesPanel';
import { OPEN_ENGLISH_COURSE_EVENT, englishUnitById } from './data/class1English';
import { completeStep } from './services/class1EnglishProgress';
import { HOME_PATHS, homeRouteFor } from './services/homeRoute';

export default function App() {
  // ============================================================
  // NAVIGATION & ROUTE STATE
  // ============================================================

  const [currentRoute, setCurrentRoute] =
    useState<AppViewRoute>('landing');

  const [selectedSubjectPage, setSelectedSubjectPage] =
    useState<string | null>(null);

  const [activeLabId, setActiveLabId] =
    useState<string | null>(null);

  // "My English Book · Class 1": null = the unit map.
  const [englishUnitId, setEnglishUnitId] =
    useState<string | null>(null);

  const [session, setSession] =
    useState<UserSession | null>(authService.getSession());

  // ============================================================
  // CORE DATA STATE
  // ============================================================

  const [stories, setStories] = useState<Story[]>([]);

  const [activeStory, setActiveStory] =
    useState<Story | null>(null);

  const [currentStudent, setCurrentStudent] =
    useState<Student>(offlineStorage.getCurrentStudent());

  const [studentsList, setStudentsList] =
    useState<Student[]>(offlineStorage.getStudents());

  const [readingLogs, setReadingLogs] =
    useState<ReadingSessionLog[]>(offlineStorage.getReadingLogs());

  // ============================================================
  // MODALS
  // ============================================================

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] =
    useState(false);

  const [certificateBlockedMessage, setCertificateBlockedMessage] =
    useState<string | null>(null);

  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ============================================================
  // SESSION STATS
  // ============================================================

  const [lastSessionStats, setLastSessionStats] = useState<{
    durationSeconds: number;
    wordsRead: number;
    totalWords: number;
    accuracy: number;
    wpm: number;
    starsEarned: number;
    struggledWords: string[];
    storyTitle: string;
  } | null>(null);

  const [isOpeningNextChapter, setIsOpeningNextChapter] =
    useState(false);

  // ============================================================
  // GENERAL ROUTER
  // ============================================================

  const navigateTo = useCallback(
    (route: AppViewRoute | string) => {
      soundEffects.playPageTurn();

      const signedIn = authService.getSession();

      const target =
        route === 'landing' && signedIn
          ? homeRouteFor(signedIn.role)
          : (route as AppViewRoute);

      setCurrentRoute(target);

      if (target === 'student_library') {
        setSelectedSubjectPage(null);
      }

      let path = '/';

      if (target === 'superadmin') {
        path = `/${SUPERADMIN_URI_CODE}`;
      } else if (target === 'student_library') {
        path = '/student';
      } else if (target === 'voice_setup') {
        path = '/voice-setup';
      } else if (target === 'faculty_dashboard') {
        path = '/faculty';
      } else if (target === 'school_admin') {
        path = '/admin';
      } else if (target === 'login') {
        path = '/login';
      } else if (target === 'dictionary') {
        path = '/dictionary';
      } else if (target === 'reader') {
        path = activeStory
          ? `/reader/${activeStory.id}`
          : '/reader';
      }

      if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
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
  // INITIAL ROUTE PARSER
  // ============================================================

  useEffect(() => {
    const parseUrlRoute = () => {
      const rawPath = window.location.pathname;
      const path = rawPath.toLowerCase();

      if (path.includes(SUPERADMIN_URI_CODE)) {
        setCurrentRoute('superadmin');
        return;
      }

      if (path.startsWith('/dictionary')) {
        setCurrentRoute('dictionary');
        return;
      }

      if (path.startsWith('/english1')) {
        const id = decodeURIComponent(
          rawPath.split('/english1')[1]?.split('/')[1] ?? '',
        );

        setEnglishUnitId(englishUnitById(id) ? id : null);
        setSelectedSubjectPage('English');
        setCurrentRoute('english_course');
        return;
      }

      if (path.startsWith('/learn/')) {
        const id = decodeURIComponent(
          rawPath.split('/learn/')[1]?.split('/')[0] ?? '',
        );

        const chapter = labChapterById(id);

        if (chapter) {
          setActiveLabId(chapter.id);
          setSelectedSubjectPage(chapter.subject);
          setCurrentRoute('learn_play');
          return;
        }
      }

      if (path.startsWith('/reader')) {
        setCurrentRoute('student_library');
        return;
      }

      if (path.includes('/student/subject/')) {
        const subjectPart =
          rawPath.split('/student/subject/')[1]?.split('/')[0] ?? '';

        setSelectedSubjectPage(
          subjectPart ? decodeURIComponent(subjectPart) : null,
        );

        setCurrentRoute('student_library');
        return;
      }

      if (path.includes('/student') || path.includes('/library')) {
        setSelectedSubjectPage(null);
        setCurrentRoute('student_library');
        return;
      }

      if (
        path.includes('/voice-setup') ||
        path.includes('/setup') ||
        path.includes('/mic')
      ) {
        setCurrentRoute('voice_setup');
        return;
      }

      if (path.includes('/faculty') || path.includes('/teacher')) {
        setCurrentRoute('faculty_dashboard');
        return;
      }

      if (path.includes('/admin')) {
        setCurrentRoute('school_admin');
        return;
      }

      if (path.includes('/login')) {
        setCurrentRoute('login');
        return;
      }

      const signedIn = authService.getSession();

      if (signedIn) {
        const home = homeRouteFor(signedIn.role);
        setCurrentRoute(home);
        window.history.replaceState({}, '', HOME_PATHS[home]);
        return;
      }

      setCurrentRoute('landing');
    };

    parseUrlRoute();

    const handlePopState = () => {
      parseUrlRoute();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // ============================================================
  // INITIALIZE STORIES + AUTH
  // ============================================================

  // navigateTo changes with every opened story; reading it through a ref keeps
  // this sign-in effect from re-running (and re-syncing the child) each time.
  const navigateToRef = useRef(navigateTo);
  navigateToRef.current = navigateTo;

  useEffect(() => {
    setStories(offlineStorage.getStories());

    const onSession = (newSession: UserSession | null) => {
      setSession(newSession);

      if (newSession && newSession.role === 'student') {
        const student = offlineStorage.signInStudent(
          createBlankStudent({
            id: newSession.id,
            name: newSession.name,
            grade: newSession.grade || 'Class 1',
            rollNumber: newSession.rollNumber,
            avatar: newSession.avatar,
            villageSchool: newSession.schoolName,
          }),
        );

        setCurrentStudent(student);
        setStudentsList(offlineStorage.getStudents());

        void (async () => {
          await firebaseAuth?.authStateReady?.().catch(() => undefined);

          const uid = firebaseAuth?.currentUser?.uid || '';

          if (!uid.startsWith('student_')) {
            authService.logout();
            void firebaseAuthService.logout();
            setSession(null);
            navigateToRef.current('login');
            return;
          }

          void progressSync.refresh();
        })();
      }
    };

    const unsubAuth = authService.subscribe(onSession);

    const unwatchTabs = authService.watchOtherTabs(() => {
      window.location.assign('/');
    });

    onSession(authService.getSession());

    const onStudentUpdated = () => {
      setCurrentStudent(offlineStorage.getCurrentStudent());
      setStudentsList(offlineStorage.getStudents());
    };

    window.addEventListener(STUDENT_UPDATED_EVENT, onStudentUpdated);

    return () => {
      unsubAuth();
      unwatchTabs();
      window.removeEventListener(
        STUDENT_UPDATED_EVENT,
        onStudentUpdated,
      );
    };
  }, []);

  // ============================================================
  // ROUTE SCROLL RESET
  // ============================================================

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
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

  const refreshStudentState = () => {
    setCurrentStudent(offlineStorage.getCurrentStudent());
    setStudentsList(offlineStorage.getStudents());
    setReadingLogs(offlineStorage.getReadingLogs());
    setStories(offlineStorage.getStories());
  };

  // ============================================================
  // TOGGLE OFFLINE STORY
  // ============================================================

  const handleToggleOffline = (storyId: string) => {
    const story = stories.find((s) => s.id === storyId);

    if (!story) return;

    offlineStorage.toggleStoryOffline(storyId);

    const updated = offlineStorage.getStories();
    setStories(updated);

    soundEffects.playWordPop();

    const isNowOffline = updated.find(
      (s) => s.id === storyId,
    )?.isDownloadedOffline;

    if (isNowOffline) {
      networkSyncToastService.notifySuccess(
        `"${story.title}" Ready Offline`,
        'Story and decodable audio are available for offline practice.',
        'కథ ఆఫ్‌లైన్ లో భద్రపరచబడింది',
      );
    }
  };

  // ============================================================
  // OPEN STORY READER
  // ============================================================

  const handleSelectStory = (story: Story) => {
    soundEffects.playStarChime();

    setActiveStory(story);
    setCurrentRoute('reader');

    if (window.location.pathname !== `/reader/${story.id}`) {
      window.history.pushState({}, '', `/reader/${story.id}`);
    }
  };

  // ============================================================
  // OPEN SUBJECT PAGE
  // ============================================================

  const handleOpenSubject = (subject: string) => {
    const cleanSubject = subject.trim();

    if (!cleanSubject) return;

    soundEffects.playPageTurn();

    setSelectedSubjectPage(cleanSubject);
    setCurrentRoute('student_library');

    const path = `/student/subject/${encodeURIComponent(cleanSubject)}`;

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
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

  const handleOpenVoiceSetup = (story?: Story) => {
    soundEffects.playPageTurn();

    if (story) {
      setActiveStory(story);
    }

    navigateTo('voice_setup');
  };

  // ============================================================
  // STORY COMPLETION
  // ============================================================

  const handleStoryComplete = (stats: {
    durationSeconds: number;
    wordsRead: number;
    totalWords: number;
    accuracy: number;
    wpm: number;
    starsEarned: number;
    struggledWords: string[];
  }) => {
    if (!activeStory) return;

    // A Class 1 English unit's reading: its Read step, scored by accuracy (out of 10).
    if (activeStory.id.startsWith('eng1_')) {
      completeStep(currentStudent.id, activeStory.id.slice('eng1_'.length), 'read', [Math.round(stats.accuracy / 10), 10]);
    }

    const newLog: ReadingSessionLog = {
      id: `log_${Date.now()}`,
      studentId: currentStudent.id,
      storyId: activeStory.id,
      storyTitle: activeStory.title,
      language: activeStory.language,
      gradeLevel: activeStory.gradeLevel,
      date: new Date().toISOString(),
      durationSeconds: stats.durationSeconds,
      wordsRead: stats.wordsRead,
      totalWords: stats.totalWords,
      accuracyRate: stats.accuracy,
      wpm: stats.wpm,
      starsEarned: stats.starsEarned,
      struggledWords: stats.struggledWords,
      synced: false,
    };

    offlineStorage.saveReadingSession(newLog);
    offlineStorage.recordDailyActivity(`read_${activeStory.id}`);

    progressSync.record({
      type: 'reading',
      id: newLog.id,
      storyId: activeStory.id,
      storyTitle: activeStory.title,
      subject: activeStory.category,
      language: activeStory.language,
      accuracyRate: stats.accuracy,
      wpm: stats.wpm,
      durationSeconds: stats.durationSeconds,
      wordsRead: stats.wordsRead,
      totalWords: stats.totalWords,
      starsEarned: stats.starsEarned,
      struggledWords: stats.struggledWords,
    });

    refreshStudentState();

    setLastSessionStats({
      ...stats,
      storyTitle: activeStory.title,
    });

    if (activeStory.comprehensionQuiz?.length > 0) {
      setShowQuizModal(true);
    } else {
      setShowRewardModal(true);
    }
  };

  // ============================================================
  // LEARN & PLAY
  // ============================================================

  const handleOpenLab = (chapterId: string) => {
    const chapter = labChapterById(chapterId);

    if (!chapter) return;

    setActiveLabId(chapter.id);
    setSelectedSubjectPage(chapter.subject);
    setCurrentRoute('learn_play');

    const path = `/learn/${encodeURIComponent(chapter.id)}`;

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  };

  // ============================================================
  // BACK TO LIBRARY / NEXT TEXTBOOK CHAPTER
  // ============================================================

  const handleOpenEnglishCourse = (unitId: string | null) => {
    setEnglishUnitId(unitId);
    setSelectedSubjectPage('English');
    setCurrentRoute('english_course');

    const path = unitId
      ? `/english1/${encodeURIComponent(unitId)}`
      : '/english1';

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  };

  // Work from the teacher ("My English Book" unit) opens the course.
  useEffect(() => {
    const open = (e: Event) => handleOpenEnglishCourse((e as CustomEvent<string | null>).detail || null);
    window.addEventListener(OPEN_ENGLISH_COURSE_EVENT, open);
    return () => window.removeEventListener(OPEN_ENGLISH_COURSE_EVENT, open);
  });

  const returnToLibrary = () => {
    setShowRewardModal(false);

    // A Class 1 English unit's reading returns to its unit.
    if (activeStory?.id.startsWith('eng1_')) {
      handleOpenEnglishCourse(activeStory.id.slice('eng1_'.length));
      return;
    }

    if (selectedSubjectPage) {
      handleOpenSubject(selectedSubjectPage);
    } else {
      navigateTo('student_library');
    }
  };

  const nextChapter = nextChapterOf(activeStory);

  const handleNextChapter = async () => {
    if (!activeStory || !nextChapter || isOpeningNextChapter) return;

    setIsOpeningNextChapter(true);

    try {
      const [readingResponse, imagesResponse] = await Promise.all([
        backendApi.readings.get(nextChapter.id),
        backendApi.readings.images(nextChapter.id),
      ]);

      const story = publishedReadingToStory(
        readingResponse.reading,
        imagesResponse.images || [],
        activeStory.bookId && activeStory.bookChapters
          ? {
              bookId: activeStory.bookId,
              bookTitle: activeStory.bookTitle || '',
              chapters: activeStory.bookChapters,
            }
          : undefined,
        readerSettingsFor(
          levelOfStudent(currentStudent),
        ).wordsScale,
      );

      setShowRewardModal(false);
      handleSelectStory(story);
    } catch (error) {
      console.error('Failed to open the next chapter:', error);
      returnToLibrary();
    } finally {
      setIsOpeningNextChapter(false);
    }
  };

  // ============================================================
  // QUIZ FINISH
  // ============================================================

  const handleQuizFinish = (score: number, total: number) => {
    if (
      activeStory &&
      total > 0 &&
      quizBonusAvailable(currentStudent.id, activeStory.id)
    ) {
      markQuizBonus(currentStudent.id, activeStory.id);

      progressSync.record({
        type: 'quiz',
        storyId: activeStory.id,
        correct: score,
        total,
      });

      const bonus = quizBonusStars(score, total);

      setLastSessionStats((prev) =>
        prev
          ? {
              ...prev,
              starsEarned: prev.starsEarned + bonus,
            }
          : prev,
      );
    }

    setShowQuizModal(false);
    refreshStudentState();
    setShowRewardModal(true);
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    authService.logout();
    void firebaseAuthService.logout();

    setSession(null);
    soundEffects.playWordPop();

    navigateTo('landing');
  };

  // ============================================================
  // ADD CUSTOM STORIES
  // ============================================================

  const handleAddCustomStory = (story: Story) => {
    offlineStorage.addCustomStory(story);
    setStories(offlineStorage.getStories());
    soundEffects.playStarChime();
  };

  const handleAddCustomStories = (newStories: Story[]) => {
    offlineStorage.addCustomStories(newStories);
    setStories(offlineStorage.getStories());
    soundEffects.playStarChime();
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-amber-200">
      {currentRoute !== 'reader' && (
        <Navbar
          currentRoute={currentRoute}
          onNavigate={navigateTo}
          session={session}
          student={currentStudent}
          onOpenOfflineModal={() => setShowOfflineModal(true)}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
        />
      )}

      <main
        className={`flex-1 flex flex-col ${
          session &&
          !['landing', 'login', 'reader'].includes(currentRoute)
            ? 'pl-[76px]'
            : ''
        }`}
      >
        {currentRoute === 'landing' && (
          <LandingPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'student_library' &&
          (selectedSubjectPage ? (
            <SubjectStoriesPage
              subject={selectedSubjectPage}
              stories={stories}
              student={currentStudent}
              onSelectStory={handleSelectStory}
              onOpenVoiceSetup={handleOpenVoiceSetup}
              onToggleOffline={handleToggleOffline}
              onOpenLab={handleOpenLab}
              onOpenEnglishCourse={() => handleOpenEnglishCourse(null)}
              onBack={() => {
                soundEffects.playPageTurn();
                setSelectedSubjectPage(null);
                window.history.pushState({}, '', '/student');

                window.scrollTo({
                  top: 0,
                  left: 0,
                  behavior: 'instant',
                });
              }}
            />
          ) : (
            <StudentLibraryPage
              onOpenDictionary={() => navigateTo('dictionary')}
              onOpenLab={handleOpenLab}
              stories={stories}
              student={currentStudent}
              onSelectStory={handleSelectStory}
              onOpenVoiceSetup={handleOpenVoiceSetup}
              onToggleOffline={handleToggleOffline}
              onOpenRewardChest={() => setShowRewardModal(true)}
              onOpenCertificateModal={() =>
                setShowCertificateModal(true)
              }
              onOpenOfflineModal={() => setShowOfflineModal(true)}
              onOpenProfile={() => setShowProfileModal(true)}
              onRefreshStudent={refreshStudentState}
              onOpenSubject={handleOpenSubject}
            />
          ))}

        {currentRoute === 'voice_setup' && (
          <VoiceSetupPage
            student={currentStudent}
            pendingStory={activeStory}
            stories={stories}
            onStartReading={handleSelectStory}
            onNavigateBack={() => navigateTo('student_library')}
            onPronunciationComplete={({
              language,
              accuracy,
              speedWPM,
              fluency,
            }) => {
              const current = offlineStorage.getCurrentStudent();

              const previous =
                current.pronunciationMetrics?.[language];

              const updatedMetrics = {
                ...(current.pronunciationMetrics || {}),
                [language]: {
                  accuracy,
                  speedWPM,
                  fluency,
                  attempts: (previous?.attempts || 0) + 1,
                  lastUpdated: new Date().toISOString(),
                },
              };

              const newAverageWpm = Math.round(
                (current.averageWPM + speedWPM) / 2,
              );

              const newOverallAccuracy = Math.round(
                (current.overallAccuracy + accuracy) / 2,
              );

              const starsForAttempt = accuracy >= 70 ? 2 : 0;

              const updatedStudent =
                offlineStorage.updateCurrentStudent({
                  pronunciationMetrics: updatedMetrics,
                  languageProficiency: {
                    ...current.languageProficiency,
                    [language]: accuracy,
                  },
                  averageWPM: newAverageWpm,
                  overallAccuracy: newOverallAccuracy,
                  stars: current.stars + starsForAttempt,
                });

              setCurrentStudent(updatedStudent);
              setStudentsList(offlineStorage.getStudents());
            }}
          />
        )}

        {currentRoute === 'faculty_dashboard' && (
          <FacultyPortalPage
            students={studentsList}
            readingLogs={readingLogs}
            stories={stories}
            onAddStory={handleAddCustomStory}
            onAddStories={handleAddCustomStories}
            onSelectStudent={(std) => {
              offlineStorage.setCurrentStudentId(std.id);
              setCurrentStudent(std);
              setShowProfileModal(true);
            }}
            onOpenSyncModal={() => setShowOfflineModal(true)}
            onNavigate={navigateTo}
          />
        )}

        {currentRoute === 'school_admin' && (
          <SchoolAdminPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'superadmin' && (
          <SuperAdminPortalPage onNavigate={navigateTo} />
        )}

        {currentRoute === 'login' && (
          <LoginPage
            onLoginSuccess={(newSession) => {
              setSession(newSession);
              refreshStudentState();
            }}
            onNavigate={navigateTo}
          />
        )}

        {currentRoute === 'dictionary' && (
          <WordDictionaryPage
            student={currentStudent}
            onBack={() => navigateTo('student_library')}
            onStudentChanged={refreshStudentState}
          />
        )}

        {currentRoute === 'learn_play' &&
          activeLabId &&
          labChapterById(activeLabId) && (
            <LearnPlayPage
              key={activeLabId}
              chapter={labChapterById(activeLabId)!}
              student={currentStudent}
              onBack={() =>
                handleOpenSubject(
                  labChapterById(activeLabId)!.subject,
                )
              }
              onReadAloud={handleSelectStory}
              onStudentChanged={refreshStudentState}
            />
          )}

        {currentRoute === 'english_course' && (
          <EnglishCoursePage
            student={currentStudent}
            unitId={englishUnitId}
            onOpenUnit={handleOpenEnglishCourse}
            onBack={() => handleOpenSubject('English')}
            onReadAloud={handleSelectStory}
            onStudentChanged={refreshStudentState}
          />
        )}

        {currentRoute === 'reader' && activeStory && (
          <ReadAlongReader
            key={activeStory.id}
            story={activeStory}
            onClose={returnToLibrary}
            onComplete={handleStoryComplete}
          />
        )}
      </main>

      {showQuizModal && activeStory && (
        <ComprehensionModal
          isOpen={showQuizModal}
          onClose={() => {
            setShowQuizModal(false);
            setShowRewardModal(true);
          }}
          questions={activeStory.comprehensionQuiz}
          storyTitle={activeStory.title}
          language={activeStory.language}
          onFinishQuiz={handleQuizFinish}
          bonusAvailable={quizBonusAvailable(
            currentStudent.id,
            activeStory.id,
          )}
        />
      )}

      {showRewardModal && (
        <RewardChestModal
          isOpen={showRewardModal}
          onClose={returnToLibrary}
          nextChapterTitle={nextChapter?.title}
          onNextChapter={handleNextChapter}
          isOpeningNextChapter={isOpeningNextChapter}
          onOpenWorkbook={
            activeStory?.isTextbookReading &&
            activeStory.sourceReadingId
              ? () => {
                  const target = {
                    readingId: activeStory.sourceReadingId as string,
                    chapterTitle: activeStory.title,
                    subject: activeStory.category,
                  };

                  returnToLibrary();
                  openWorkbook(target);
                }
              : undefined
          }
          student={currentStudent}
          lastSessionStats={lastSessionStats}
          onOpenCertificates={() => {
            if (
              lastSessionStats &&
              lastSessionStats.accuracy < 70
            ) {
              setShowRewardModal(false);

              setCertificateBlockedMessage(
                `Almost there! This story was read at ${lastSessionStats.accuracy}% accuracy. Read it again at 70% or higher to earn the certificate.`,
              );

              return;
            }

            setShowRewardModal(false);
            setShowCertificateModal(true);
          }}
        />
      )}

      {certificateBlockedMessage && (
        <div
          id="certificate-blocked-toast"
          className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-[#e8e4d8] text-center">
            <p className="text-sm font-bold text-stone-800">
              {certificateBlockedMessage}
            </p>

            <button
              type="button"
              onClick={() => {
                setCertificateBlockedMessage(null);

                if (currentRoute === 'reader') {
                  setShowRewardModal(true);
                }
              }}
              className="mt-4 bg-[#2d2d2d] hover:bg-black text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl"
            >
              Okay, I'll try again
            </button>
          </div>
        </div>
      )}

      {showCertificateModal && (
        <ReadingCertificateModal
          isOpen={showCertificateModal}
          onClose={() => {
            setShowCertificateModal(false);

            if (currentRoute === 'reader') {
              setShowRewardModal(true);
            }
          }}
          student={currentStudent}
          storiesReadCount={currentStudent.completedStoryIds.length}
        />
      )}

      {showOfflineModal && (
        <OfflineSyncModal
          isOpen={showOfflineModal}
          onClose={() => setShowOfflineModal(false)}
          stories={stories}
          onSyncComplete={refreshStudentState}
        />
      )}

      {showProfileModal && (
        <StudentProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          student={currentStudent}
          onUpdateStudent={(updated) => {
            setCurrentStudent(updated);
            refreshStudentState();
          }}
          onSelectAnotherStudent={(id) => {
            offlineStorage.setCurrentStudentId(id);
            refreshStudentState();
          }}
          availableStudents={studentsList}
        />
      )}

      <NetworkRetryToast />

      <ExplainerHost />

      <BookActivitiesHost
        studentId={
          session?.role === 'student'
            ? currentStudent?.id
            : null
        }
      />

      <UnitWorkbookHost
        studentId={
          session?.role === 'student'
            ? currentStudent?.id
            : null
        }
        className={currentStudent?.grade}
      />
    </div>
  );
}
