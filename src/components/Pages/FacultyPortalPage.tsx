import React, { useEffect, useState } from 'react';
import {
  Student,
  ReadingSessionLog,
  Story,
  TextbookAnalysis,
  GradeLevel,
} from '../../types';
import { TextbookOCRModal } from '../TeacherDashboard/TextbookOCRModal';
import { StoryGeneratorModal } from '../TeacherDashboard/StoryGeneratorModal';
import { PublishedBooksPanel } from '../TeacherDashboard/PublishedBooksPanel';
import { ClassDashboard } from '../TeacherDashboard/ClassDashboard';
import { RosterPanel } from '../TeacherDashboard/RosterPanel';
import { LearnPlayProgressPanel } from '../TeacherDashboard/LearnPlayProgressPanel';
import { soundEffects } from '../../services/soundEffects';
import { backendApi } from '../../services/backendApi';
import { BarChart3, BookOpen, CalendarDays, Gamepad2, Printer, Sparkles, Upload, Users } from 'lucide-react';
import { TlmPanel } from '../TeacherDashboard/TlmPanel';
import { TodayPanel } from '../TeacherDashboard/TodayPanel';

type TeacherTab = 'today' | 'class' | 'students' | 'books' | 'tlm' | 'learnplay';
const TEACHER_TABS: { id: TeacherTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'class', label: 'Class dashboard', icon: BarChart3 },
  { id: 'students', label: 'Students & roll numbers', icon: Users },
  { id: 'books', label: 'Published books', icon: BookOpen },
  { id: 'tlm', label: 'Teaching materials', icon: Printer },
  { id: 'learnplay', label: 'Learn & Play progress', icon: Gamepad2 },
];

interface FacultyPortalPageProps {
  students: Student[];
  readingLogs: ReadingSessionLog[];
  stories: Story[];
  onAddStory: (story: Story) => void;
  onAddStories: (stories: Story[]) => void;
  onSelectStudent: (student: Student) => void;
  onOpenSyncModal: () => void;
  onNavigate: (route: string) => void;
}

export const FacultyPortalPage: React.FC<FacultyPortalPageProps> = ({
  students,
  readingLogs,
  stories,
  onAddStory,
  onAddStories,
  onSelectStudent,
  onOpenSyncModal,
  onNavigate,
}) => {
  const [selectedClass, setSelectedClass] = useState(() => students[0]?.grade || 'Class 1');
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showStoryGenModal, setShowStoryGenModal] = useState(false);
  const [activeOCRAnalysis, setActiveOCRAnalysis] =
    useState<TextbookAnalysis | null>(null);
  const [booksRefreshKey, setBooksRefreshKey] = useState(0);
  const [tab, setTab] = useState<TeacherTab>('today');
  const [myClasses, setMyClasses] = useState<string[]>([]);

  // Open on the teacher's own class.
  useEffect(() => {
    let live = true;
    backendApi.school
      .myClasses()
      .then(({ grades }) => {
        if (!live || !grades.length) return;
        setMyClasses(grades);
        setSelectedClass((current) => (grades.includes(current) ? current : (grades[0] as GradeLevel)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const BLANK_ANALYSIS: TextbookAnalysis = {
    subject: 'Custom Story',
    grade: 'Class 2',
    chapterNumber: '',
    chapterTitle: 'New Read-Along Story',
    primaryLanguage: 'Telugu',
    extractedText: '',
    summary: 'A freshly generated decodable story for classroom read-along practice.',
    keyVocabulary: [],
    learningObjectives: [],
    suggestedStoryThemes: [],
  };

  const resolveOCRGrade = (analysis: TextbookAnalysis): TextbookAnalysis => {
    // The teacher's selected class is the publishing target and takes
    // precedence over an uncertain grade guess from OCR/model metadata.
    return { ...analysis, grade: selectedClass };
  };

  const handleOCRComplete = (analysis: TextbookAnalysis) => {
    const classAnalysis = resolveOCRGrade(analysis);
    setActiveOCRAnalysis(classAnalysis);
    setShowOCRModal(false);
    setShowStoryGenModal(true);
  };

  const handleOpenStoryGenerator = () => {
    soundEffects.playWordPop();
    setActiveOCRAnalysis((prev) => prev ?? BLANK_ANALYSIS);
    setShowStoryGenModal(true);
  };

  const handleSaveGeneratedStory = (story: Story) => {
    onAddStory(story);
    soundEffects.playStarChime();
    setShowStoryGenModal(false);
    setActiveOCRAnalysis(null);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16 font-sans">
      {/* Faculty Hero */}
      <div className="bg-[#2d2d2d] text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                Classroom & Teacher Studio
              </span>
              <span className="text-xs text-stone-400 font-semibold">
                English • Telugu • Hindi • Maths • Science • Social
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Class Dashboard & Teacher Studio
            </h1>

            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              See how every child in your class is reading, publish textbooks
              for them, and fix published books — all in one place.
            </p>
            <p className="text-[11px] font-semibold text-amber-200/90">
              {myClasses.length ? `Your classes: ${myClasses.join(', ')} · ` : ''}Textbook scans publish to {selectedClass} students.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEffects.playWordPop();
                setShowOCRModal(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              id="btn-faculty-ocr-scanner"
            >
              <Upload className="w-4 h-4" />
              <span>Scan Textbook (OCR to Story)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenStoryGenerator}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs sm:text-sm border border-stone-700 cursor-pointer"
              id="btn-faculty-create-story"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate AI Story</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div role="tablist" aria-label="Teacher dashboard" className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {TEACHER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`teacher-tab-${id}`}
              aria-selected={tab === id}
              onClick={() => {
                soundEffects.playWordPop();
                setTab(id);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-colors ${
                tab === id ? 'bg-[#2d2d2d] text-white shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {tab === 'today' && (
          <TodayPanel
            grades={myClasses}
            defaultGrade={selectedClass}
            onOpenClass={(g) => {
              setSelectedClass(g as GradeLevel);
              setTab('class');
            }}
          />
        )}
        {tab === 'class' && <ClassDashboard selectedClass={selectedClass} onSelectClass={(g) => setSelectedClass(g as GradeLevel)} />}
        {tab === 'students' && <RosterPanel grade={selectedClass} onSelectGrade={(g) => setSelectedClass(g as GradeLevel)} />}
        {tab === 'books' && <PublishedBooksPanel refreshKey={booksRefreshKey} />}
        {tab === 'tlm' && <TlmPanel grade={selectedClass} onSelectGrade={(g) => setSelectedClass(g as GradeLevel)} />}
        {tab === 'learnplay' && <LearnPlayProgressPanel grade={selectedClass} onSelectGrade={(g) => setSelectedClass(g as GradeLevel)} />}
      </main>

      {showOCRModal && (
        <TextbookOCRModal
          defaultGrade={selectedClass as GradeLevel}
          onClose={() => {
            setShowOCRModal(false);
            setBooksRefreshKey((n) => n + 1);
          }}
          onAnalysisComplete={handleOCRComplete}
        />
      )}

      {showStoryGenModal && activeOCRAnalysis && (
        <StoryGeneratorModal
          analysis={activeOCRAnalysis}
          onClose={() => {
            setShowStoryGenModal(false);
            setActiveOCRAnalysis(null);
          }}
          onStorySaved={handleSaveGeneratedStory}
        />
      )}
    </div>
  );
};
