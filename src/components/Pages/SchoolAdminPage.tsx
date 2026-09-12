import React, { useState, useEffect } from 'react';
import {
  School,
  Users,
  GraduationCap,
  Award,
  BookOpen,
  PlusCircle,
  TrendingUp,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { FacultyMember, ClassSection, SchoolInfo, GradeLevel } from '../../types';
import { offlineStorage } from '../../services/offlineStorage';
import { soundEffects } from '../../services/soundEffects';

interface SchoolAdminPageProps {
  onNavigate: (route: string) => void;
}

export const SchoolAdminPage: React.FC<SchoolAdminPageProps> = ({ onNavigate }) => {
  const [schools, setSchools] = useState<SchoolInfo[]>(offlineStorage.getSchools());
  const [classes, setClasses] = useState<ClassSection[]>(offlineStorage.getClasses());
  const [faculty, setFaculty] = useState<FacultyMember[]>(offlineStorage.getFaculty());
  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo>(schools[0]);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'classes' | 'faculty' | 'benchmarks'>('overview');

  // Add Faculty Modal State
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [newFacName, setNewFacName] = useState('');
  const [newFacEmail, setNewFacEmail] = useState('');
  const [newFacDesignation, setNewFacDesignation] = useState('Primary Literacy Teacher');
  const [newFacGrade, setNewFacGrade] = useState<GradeLevel>('Class 2');

  const handleAddFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacName.trim()) return;

    soundEffects.playStarChime();
    const newMember: FacultyMember = {
      id: `fac_${Date.now()}`,
      name: newFacName.trim(),
      email: newFacEmail.trim() || `${newFacName.toLowerCase().replace(/\s+/g, '.')}@school.gov.in`,
      avatar: '👩‍🏫',
      phone: '+91 98480 ' + Math.floor(10000 + Math.random() * 90000),
      designation: newFacDesignation,
      assignedGrades: [newFacGrade],
      subjects: ['Telugu (తెలుగు)', 'English Phonics'],
      schoolId: selectedSchool.id,
      schoolName: selectedSchool.name,
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'active',
      activeClassrooms: 1,
      studentsCount: 28,
    };

    offlineStorage.addFacultyMember(newMember);
    setFaculty(offlineStorage.getFaculty());
    setShowAddFacultyModal(false);
    setNewFacName('');
    setNewFacEmail('');
  };

  const totalStudents = classes.reduce((sum, c) => sum + c.totalStudents, 0);
  const avgSchoolAccuracy = Math.round(
    classes.reduce((sum, c) => sum + c.averageAccuracy, 0) / (classes.length || 1)
  );
  const avgSchoolWpm = Math.round(
    classes.reduce((sum, c) => sum + c.averageWpm, 0) / (classes.length || 1)
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Header / Institutional Banner */}
      <div className="bg-[#2d2d2d] text-white py-6 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                Headmaster & Admin Portal
              </span>
              <span className="text-xs text-stone-400 font-semibold">{selectedSchool.code}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{selectedSchool.name}</h1>
            <p className="text-xs text-stone-300">
              {selectedSchool.district} District, {selectedSchool.state} • Board: {selectedSchool.board}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-stone-800/90 border border-stone-700 rounded-xl p-3 text-right">
              <span className="text-[10px] text-stone-400 block font-semibold">Headmaster</span>
              <span className="text-xs font-bold text-amber-300">{selectedSchool.headmasterName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto py-2">
          {(
            [
              { id: 'overview', label: 'School Overview & Stats', icon: TrendingUp },
              { id: 'classes', label: 'Classrooms & Grades (1-5)', icon: Layers },
              { id: 'faculty', label: 'Faculty & Teachers Roster', icon: GraduationCap },
              { id: 'benchmarks', label: 'Reading Fluency Milestones', icon: Award },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  setActiveSubTab(tab.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-black shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Admin Workspace */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* OVERVIEW TAB */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-xs text-stone-500 font-bold uppercase">Total Primary Students</span>
                <p className="text-3xl font-black text-stone-900">{totalStudents}</p>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Enrollment Verified
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-xs text-stone-500 font-bold uppercase">Average Reading Accuracy</span>
                <p className="text-3xl font-black text-amber-600">{avgSchoolAccuracy}%</p>
                <span className="text-[11px] text-stone-500 font-semibold">Across Telugu, Hindi & English</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-xs text-stone-500 font-bold uppercase">Average Reading Speed</span>
                <p className="text-3xl font-black text-sky-600">{avgSchoolWpm} <span className="text-sm font-bold text-stone-500">WPM</span></p>
                <span className="text-[11px] text-stone-500 font-semibold">Target: 45-60 WPM (Classes 2-3)</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-xs text-stone-500 font-bold uppercase">Active Faculty</span>
                <p className="text-3xl font-black text-stone-900">{faculty.length}</p>
                <span className="text-[11px] text-stone-500 font-semibold">5 Primary Classrooms</span>
              </div>
            </div>

            {/* Performance By Grade Level */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-2xs space-y-4">
              <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <span>Class-Wise Reading Fluency & Accuracy Breakdown</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {classes.map((cls) => (
                  <div key={cls.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-900">{cls.grade}</span>
                      <span className="text-[10px] font-bold text-stone-500">{cls.totalStudents} Kids</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-stone-600">
                        <span>Accuracy</span>
                        <span className="font-bold text-amber-700">{cls.averageAccuracy}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${cls.averageAccuracy}%` }}
                        />
                      </div>
                    </div>
                    <div className="pt-1 text-[11px] text-stone-500 flex justify-between">
                      <span>Teacher:</span>
                      <span className="font-medium text-stone-800 truncate">{cls.classTeacherName.split(' ')[1] || cls.classTeacherName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLASSES TAB */}
        {activeSubTab === 'classes' && (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs p-6 space-y-4">
            <h2 className="text-base font-black text-stone-900">Primary Classroom Sections & Homerooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-black text-stone-900">{cls.grade} — {cls.section}</h3>
                      <p className="text-xs text-stone-500">{cls.roomNumber}</p>
                    </div>
                    <span className="text-xs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                      {cls.totalStudents} Students
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-200 text-xs space-y-1.5">
                    <p className="text-stone-700">
                      <strong className="text-stone-900">Homeroom Teacher:</strong> {cls.classTeacherName}
                    </p>
                    <p className="text-stone-700">
                      <strong className="text-stone-900">Languages:</strong> {cls.languageFocus.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FACULTY TAB */}
        {activeSubTab === 'faculty' && (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-stone-900">Faculty & Literacy Educators</h2>
                <p className="text-xs text-stone-500">Managing teacher assignments and primary subject coordination</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddFacultyModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
                id="btn-add-faculty"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Onboard New Teacher</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {faculty.map((fac) => (
                <div key={fac.id} className="p-5 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-2xl shrink-0">
                    {fac.avatar}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-stone-900 truncate">{fac.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {fac.status}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-amber-800">{fac.designation}</p>
                    <p className="text-[11px] text-stone-500">
                      Grades: {fac.assignedGrades.join(', ')} • {fac.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BENCHMARKS TAB */}
        {activeSubTab === 'benchmarks' && (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xs p-6 space-y-4">
            <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>Primary Reading Fluency & Accuracy Milestones</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900">Class 1: Letter & Word Recognition</h3>
                <p className="text-stone-600">
                  Target: Recognize primary alphabet letters and read 4-5 simple 2-letter words per minute with 80%+ accuracy.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900">Class 2: Read-Along & Short Sentences</h3>
                <p className="text-stone-600">
                  Target: Read storybooks with synchronized voice guidance at 30-45 words per minute.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900">Class 3: Fluency & Comprehension Mastery</h3>
                <p className="text-stone-600">
                  Target: Read multi-paragraph stories at 60+ words per minute with 90%+ pronunciation accuracy and quiz comprehension.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Faculty Modal */}
      {showAddFacultyModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-stone-900">Onboard Faculty Member</h3>
            <form onSubmit={handleAddFaculty} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Teacher Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smt. K. Ratna Kumari"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Email / Employee ID:</label>
                <input
                  type="email"
                  placeholder="e.g. ratna.kumari@school.gov.in"
                  value={newFacEmail}
                  onChange={(e) => setNewFacEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Designation:</label>
                <input
                  type="text"
                  value={newFacDesignation}
                  onChange={(e) => setNewFacDesignation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Primary Assigned Grade:</label>
                <select
                  value={newFacGrade}
                  onChange={(e) => setNewFacGrade(e.target.value as GradeLevel)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="Class 1">Class 1</option>
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                  <option value="Class 4">Class 4</option>
                  <option value="Class 5">Class 5</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddFacultyModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black cursor-pointer shadow-2xs"
                >
                  Add Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
