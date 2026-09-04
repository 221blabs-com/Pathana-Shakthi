import React, { useState } from 'react';
//test
import {
  Student,
  ReadingSessionLog,
  Story,
  TextbookAnalysis,
  GradeLevel,
} from '../../types';
import { ClassOverview } from '../TeacherDashboard/ClassOverview';
import { StudentGrowthTable } from '../TeacherDashboard/StudentGrowthTable';
import { TextbookOCRModal } from '../TeacherDashboard/TextbookOCRModal';
import { StoryGeneratorModal } from '../TeacherDashboard/StoryGeneratorModal';
import { WordStruggleVisualization } from '../WordStruggleVisualization';
import { soundEffects } from '../../services/soundEffects';
import {
  GraduationCap,
  Sparkles,
  Upload,
  BookOpen,
  FileSpreadsheet,
  PlusCircle,
  Users,
  CheckCircle2,
  Layers,
  BarChart3,
  Search,
} from 'lucide-react';

interface FacultyPortalPageProps {
  students: Student[];
  readingLogs: ReadingSessionLog[];
  stories: Story[];
  onAddStory: (story: Story) => void;
  onSelectStudent: (student: Student) => void;
  onOpenSyncModal: () => void;
  onNavigate: (route: string) => void;
}

export const FacultyPortalPage: React.FC<FacultyPortalPageProps> = ({
  students,
  readingLogs,
  stories,
  onAddStory,
  onSelectStudent,
  onOpenSyncModal,
  onNavigate,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'word_struggles' | 'students'>('overview');
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showStoryGenModal, setShowStoryGenModal] = useState(false);
  const [activeOCRAnalysis, setActiveOCRAnalysis] = useState<TextbookAnalysis | null>(null);

  const handleOCRComplete = (analysis: TextbookAnalysis) => {
    setActiveOCRAnalysis(analysis);
    setShowOCRModal(false);
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
      {/* Faculty Hero Banner */}
      <div className="bg-[#2d2d2d] text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                Classroom & Teacher Studio
              </span>
              <span className="text-xs text-stone-400 font-semibold">Telugu • Hindi • English Read-Along</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Story Creator & Reading Diagnostics
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              Scan story pages into interactive Read-Along stories with AI OCR, analyze language-specific phonics struggles (like Telugu conjunct consonants), and track individual growth.
            </p>
          </div>

          {/* Action CTAs */}
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
              onClick={() => {
                soundEffects.playWordPop();
                setShowStoryGenModal(true);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs sm:text-sm border border-stone-700 shadow-2xs transition-all cursor-pointer"
              id="btn-faculty-create-story"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate AI Story</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs for Faculty Dashboard */}
        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-stone-700/60 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('overview');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-stone-950 shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Classroom Fluency Overview</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('word_struggles');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'word_struggles'
                ? 'bg-amber-400 text-stone-950 shadow-sm'
                : 'text-amber-300 hover:text-white hover:bg-stone-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Phonics & Word Struggle Analysis 🎯</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('students');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'students'
                ? 'bg-white text-stone-950 shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-stone-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Student Diagnostic Roster ({students.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {activeTab === 'overview' && (
          <>
            {/* Class Overview Bento Grid */}
            <ClassOverview
              students={students}
              readingLogs={readingLogs}
              selectedGrade={selectedGrade}
              onGradeChange={setSelectedGrade}
            />

            {/* Embedded Word Struggle Teaser / Matrix */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-[#2d2d2d] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Language Phonics Struggle Hotspots</span>
                </h3>
                <button
                  onClick={() => {
                    soundEffects.playWordPop();
                    setActiveTab('word_struggles');
                  }}
                  className="text-xs font-black text-amber-800 hover:text-amber-950"
                >
                  Open Full Phonics Diagnostics →
                </button>
              </div>
              <WordStruggleVisualization
                readingLogs={readingLogs}
                students={students}
                mode="teacher_classroom"
              />
            </div>

            {/* Student Growth & Diagnostic Roster */}
            <StudentGrowthTable
              students={students}
              readingLogs={readingLogs}
              selectedGrade={selectedGrade}
              onSelectStudent={onSelectStudent}
            />
          </>
        )}

        {activeTab === 'word_struggles' && (
          <div className="space-y-6">
            <WordStruggleVisualization
              readingLogs={readingLogs}
              students={students}
              mode="teacher_classroom"
            />
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            <StudentGrowthTable
              students={students}
              readingLogs={readingLogs}
              selectedGrade={selectedGrade}
              onSelectStudent={onSelectStudent}
            />
          </div>
        )}
      </div>

      {/* OCR Modal */}
      <TextbookOCRModal
        isOpen={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onAnalysisComplete={handleOCRComplete}
      />

      {/* Story Generator Modal */}
      <StoryGeneratorModal
        isOpen={showStoryGenModal}
        onClose={() => {
          setShowStoryGenModal(false);
          setActiveOCRAnalysis(null);
        }}
        prefilledAnalysis={activeOCRAnalysis}
        onSaveStory={handleSaveGeneratedStory}
      />
    </div>
  );
};
