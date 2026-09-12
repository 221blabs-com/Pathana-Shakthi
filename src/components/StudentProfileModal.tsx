import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Student, Badge } from '../types';
import { DEFAULT_BADGES, offlineStorage } from '../services/offlineStorage';
import { WordStruggleVisualization } from './WordStruggleVisualization';
import { soundEffects } from '../services/soundEffects';
import {
  User,
  Star,
  Flame,
  Award,
  BookOpen,
  CheckCircle2,
  X,
  PlusCircle,
  Clock,
  Zap,
  Sparkles,
  Layers,
  Users,
} from 'lucide-react';

interface StudentProfileModalProps {
  isOpen?: boolean;
  student?: Student;
  currentStudent?: Student;
  onClose: () => void;
  onSelectStudent?: (student: Student) => void;
  onUpdateStudent?: (student: Student) => void;
  onSelectAnotherStudent?: (studentId: string) => void;
  availableStudents?: Student[];
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  currentStudent: passedStudent,
  onClose,
  onSelectStudent,
  onUpdateStudent,
  onSelectAnotherStudent,
  availableStudents,
}) => {
  const activeStudent = student || passedStudent || offlineStorage.getCurrentStudent();
  const [activeTab, setActiveTab] = useState<'profile' | 'phonics' | 'switch'>('profile');
  const [allStudents, setAllStudents] = useState<Student[]>(
    availableStudents || offlineStorage.getStudents()
  );
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Class 2');
  const [newStudentAvatar, setNewStudentAvatar] = useState('👧');

  const readingLogs = offlineStorage.getReadingLogs();

  const handleSwitchStudent = (s: Student) => {
    soundEffects.playWordPop();
    offlineStorage.setCurrentStudentId(s.id);
    if (onSelectStudent) onSelectStudent(s);
    if (onSelectAnotherStudent) onSelectAnotherStudent(s.id);
    if (onUpdateStudent) onUpdateStudent(s);
    onClose();
  };

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newStudent: Student = {
      id: `stud_${Date.now()}`,
      name: newStudentName.trim(),
      rollNumber: String(allStudents.length + 1).padStart(2, '0'),
      avatar: newStudentAvatar,
      grade: newStudentGrade as any,
      villageSchool: activeStudent.villageSchool || 'ZPHS Kothur Model Primary School',
      stars: 50, // Welcome star bonus!
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      mascotAccessory: 'none',
      badges: ['first_story'],
      completedStoryIds: [],
      languageProficiency: { Telugu: 70, Hindi: 60, English: 60 },
      totalMinutesRead: 0,
      averageWPM: 35,
      overallAccuracy: 85,
    };

    offlineStorage.addStudent(newStudent);
    offlineStorage.setCurrentStudentId(newStudent.id);
    setAllStudents(offlineStorage.getStudents());
    if (onSelectStudent) onSelectStudent(newStudent);
    if (onUpdateStudent) onUpdateStudent(newStudent);
    setIsAddingStudent(false);
    soundEffects.playVictoryFanfare();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="student-profile-modal">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-[#e8e4d8] relative my-auto max-h-[92vh] overflow-y-auto"
        id="student-profile-card"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5] cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Current Active Student Hero Bento Box */}
        <div className="flex items-center gap-3.5 bg-[#fbf9f4] p-4.5 rounded-3xl border border-[#e8e4d8] mb-4">
          <div className="text-4xl p-2.5 bg-white rounded-2xl border border-[#e8e4d8] shadow-2xs">
            {activeStudent.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#2d2d2d]">{activeStudent.name}</h2>
              <span className="bg-[#2d2d2d] text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                {activeStudent.grade}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">{activeStudent.villageSchool}</p>

            <div className="flex items-center gap-3 mt-2 text-xs font-black flex-wrap">
              <span className="text-amber-800 bg-[#fff8e6] px-2 py-0.5 rounded-lg border border-[#fae2a0] flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                {activeStudent.stars} Stars
              </span>
              <span className="text-orange-800 bg-[#fff1ec] px-2 py-0.5 rounded-lg border border-[#ffd2c4] flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-500" />
                {activeStudent.streakDays} Day Streak
              </span>
              <span className="text-emerald-800 bg-[#edf9f2] px-2 py-0.5 rounded-lg border border-[#c4ebd1] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                {activeStudent.averageWPM} WPM • {activeStudent.overallAccuracy}% Acc
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#f4f1e8] p-1 rounded-2xl border border-[#e5e1d5] mb-4">
          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('profile');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-stone-900 shadow-xs border border-[#ded9c5]'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Badges & Stats</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('phonics');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'phonics'
                ? 'bg-amber-400 text-stone-950 shadow-xs'
                : 'text-amber-900 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Word Struggles & Phonics 🎯</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playWordPop();
              setActiveTab('switch');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'switch'
                ? 'bg-white text-stone-900 shadow-xs border border-[#ded9c5]'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Switch Student</span>
          </button>
        </div>

        {/* Tab 1: Profile & Badges */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Badges Collection Showcase */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[#2d2d2d] uppercase tracking-wider">
                  🏆 Badges & Achievements ({activeStudent.badges.length}):
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {DEFAULT_BADGES.map((badge) => {
                  const isUnlocked = activeStudent.badges.includes(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs transition-all ${
                        isUnlocked
                          ? 'bg-[#fff8e6] border-[#fae2a0] text-amber-950 shadow-2xs'
                          : 'bg-[#fbf9f4] border-[#e8e4d8] text-stone-400 opacity-60'
                      }`}
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <div className="min-w-0">
                        <span className="font-black block truncate text-[11px] text-[#2d2d2d]">{badge.name}</span>
                        <span className="text-[9px] block text-stone-500 truncate">{badge.nameNative}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language Fluency Meters */}
            <div className="p-4 bg-[#fbf9f4] rounded-2xl border border-[#e8e4d8] space-y-2.5">
              <span className="text-xs font-black text-stone-700 block">Language Proficiency:</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-stone-500 block">Telugu</span>
                  <span className="text-sm font-black text-amber-900">{activeStudent.languageProficiency?.Telugu || 80}%</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-orange-200">
                  <span className="text-[10px] text-stone-500 block">Hindi</span>
                  <span className="text-sm font-black text-orange-900">{activeStudent.languageProficiency?.Hindi || 70}%</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-indigo-200">
                  <span className="text-[10px] text-stone-500 block">English</span>
                  <span className="text-sm font-black text-indigo-900">{activeStudent.languageProficiency?.English || 75}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Word Struggle Phonics Breakdown */}
        {activeTab === 'phonics' && (
          <div className="space-y-4">
            <WordStruggleVisualization
              readingLogs={readingLogs}
              students={allStudents}
              currentStudent={activeStudent}
              mode="student_personal"
            />
          </div>
        )}

        {/* Tab 3: Switch Student Profiles List */}
        {activeTab === 'switch' && (
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-stone-700 uppercase tracking-wider">
                Select Active Reader in Class:
              </span>
              <button
                onClick={() => setIsAddingStudent(!isAddingStudent)}
                className="text-xs font-black text-[#2d2d2d] hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isAddingStudent ? 'Cancel' : 'Add New Student'}</span>
              </button>
            </div>

            {/* Add Student Form */}
            {isAddingStudent ? (
              <form onSubmit={handleCreateStudent} className="p-4 bg-[#fbf9f4] rounded-3xl border border-[#e8e4d8] space-y-3 mb-3">
                <div>
                  <label className="text-[11px] font-black text-stone-700 block mb-1">Student Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Varma"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#e8e4d8] rounded-xl text-xs font-bold text-[#2d2d2d] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-black text-stone-700 block mb-1">Grade / Class:</label>
                    <select
                      value={newStudentGrade}
                      onChange={(e) => setNewStudentGrade(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#e8e4d8] rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="Class 1">Class 1</option>
                      <option value="Class 2">Class 2</option>
                      <option value="Class 3">Class 3</option>
                      <option value="Class 4">Class 4</option>
                      <option value="Class 5">Class 5</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-stone-700 block mb-1">Avatar:</label>
                    <select
                      value={newStudentAvatar}
                      onChange={(e) => setNewStudentAvatar(e.target.value)}
                      className="w-full p-2.5 bg-white border border-[#e8e4d8] rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="👧">👧 Girl (Ananya)</option>
                      <option value="👦">👦 Boy (Rohan)</option>
                      <option value="👧🏽">👧🏽 Girl (Lakshmi)</option>
                      <option value="👦🏾">👦🏾 Boy (Sai)</option>
                      <option value="🧒">🧒 Child</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#2d2d2d] hover:bg-black text-white font-black text-xs py-3 rounded-2xl shadow-2xs transition-all cursor-pointer"
                >
                  Save & Start Reading ⭐
                </button>
              </form>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {allStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSwitchStudent(s)}
                    className={`w-full p-2.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      s.id === activeStudent.id
                        ? 'bg-[#fff8e6] border-[#fae2a0] font-black'
                        : 'bg-[#fbf9f4] hover:bg-[#fff8e6] border-[#e8e4d8]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{s.avatar}</span>
                      <div>
                        <span className="text-xs font-black text-[#2d2d2d] block">{s.name}</span>
                        <span className="text-[10px] text-stone-500 font-medium">{s.grade} • Roll #{s.rollNumber}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-[#fae2a0]">{s.stars} ⭐</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

