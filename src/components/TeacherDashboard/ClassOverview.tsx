import React from 'react';
import { Student, ReadingSessionLog } from '../../types';
import { aggregateClassroomPhonicsStruggles } from '../../utils/phonicsCategorizer';
import {
  TrendingUp,
  BookOpen,
  Award,
  AlertTriangle,
  Clock,
  Zap,
  Star,
  Users,
  Languages,
  Layers,
} from 'lucide-react';

interface ClassOverviewProps {
  students: Student[];
  readingLogs: ReadingSessionLog[];
  selectedGrade: string;
  onGradeChange: (grade: string) => void;
}

export const ClassOverview: React.FC<ClassOverviewProps> = ({
  students,
  readingLogs,
  selectedGrade,
  onGradeChange,
}) => {
  const filteredStudents = selectedGrade === 'All'
    ? students
    : students.filter((s) => s.grade === selectedGrade);

  const totalMinutes = filteredStudents.reduce((acc, s) => acc + s.totalMinutesRead, 0);
  const avgWPM = filteredStudents.length
    ? Math.round(filteredStudents.reduce((acc, s) => acc + s.averageWPM, 0) / filteredStudents.length)
    : 0;
  const avgAccuracy = filteredStudents.length
    ? Math.round(filteredStudents.reduce((acc, s) => acc + s.overallAccuracy, 0) / filteredStudents.length)
    : 0;
  const totalStars = filteredStudents.reduce((acc, s) => acc + s.stars, 0);

  // Language Proficiencies Average
  const teluguAvg = filteredStudents.length
    ? Math.round(filteredStudents.reduce((acc, s) => acc + (s.languageProficiency.Telugu || 0), 0) / filteredStudents.length)
    : 0;
  const hindiAvg = filteredStudents.length
    ? Math.round(filteredStudents.reduce((acc, s) => acc + (s.languageProficiency.Hindi || 0), 0) / filteredStudents.length)
    : 0;
  const englishAvg = filteredStudents.length
    ? Math.round(filteredStudents.reduce((acc, s) => acc + (s.languageProficiency.English || 0), 0) / filteredStudents.length)
    : 0;

  // At-risk students (accuracy < 85% or low WPM)
  const atRiskStudents = filteredStudents.filter((s) => s.overallAccuracy < 85 || s.averageWPM < 38);

  return (
    <div className="space-y-5" id="teacher-class-overview">
      {/* Grade Selector & School Header Bento Tile */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-[#e8e4d8] shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#2d2d2d]">
            Zilla Parishad Primary School • Literacy Growth Dashboard
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Monitoring individual decodable fluency & pronunciation in remote rural regions
          </p>
        </div>

        {/* Grade Filter */}
        <div className="flex items-center gap-1.5 bg-[#f4f1e8] p-1 rounded-2xl border border-[#e5e1d5]">
          {['All', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].map((grade) => (
            <button
              key={grade}
              onClick={() => onGradeChange(grade)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedGrade === grade
                  ? 'bg-white text-stone-900 shadow-xs border border-[#e2dec9]'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Bento Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Avg Speed */}
        <div className="bg-white p-4.5 rounded-3xl border border-[#e8e4d8] shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[#fff4eb] text-orange-700 rounded-2xl border border-[#fed7aa]">
            <Zap className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">Class Avg Speed</span>
            <div className="text-xl sm:text-2xl font-black text-[#2d2d2d] mt-0.5">
              {avgWPM} <span className="text-xs font-normal text-stone-500">WPM</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Accuracy */}
        <div className="bg-white p-4.5 rounded-3xl border border-[#e8e4d8] shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[#edf9f2] text-emerald-700 rounded-2xl border border-[#c4ebd1]">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">Reading Accuracy</span>
            <div className="text-xl sm:text-2xl font-black text-[#2d2d2d] mt-0.5">
              {avgAccuracy}%
            </div>
          </div>
        </div>

        {/* Metric 3: Time Read */}
        <div className="bg-white p-4.5 rounded-3xl border border-[#e8e4d8] shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[#eff6ff] text-blue-700 rounded-2xl border border-[#bfdbfe]">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">Total Read Time</span>
            <div className="text-xl sm:text-2xl font-black text-[#2d2d2d] mt-0.5">
              {totalMinutes} <span className="text-xs font-normal text-stone-500">mins</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Total Stars */}
        <div className="bg-white p-4.5 rounded-3xl border border-[#e8e4d8] shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[#fff8e6] text-amber-700 rounded-2xl border border-[#fae2a0]">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">Stars Collected</span>
            <div className="text-xl sm:text-2xl font-black text-[#2d2d2d] mt-0.5">
              {totalStars} ⭐
            </div>
          </div>
        </div>
      </div>

      {/* Multilingual Fluency Bento Card & Phonetic Diagnostic Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Language Fluency Distribution */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#e8e4d8] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-amber-700" />
              <h3 className="text-sm font-black text-[#2d2d2d]">Multilingual Literacy Fluency</h3>
            </div>
            <span className="text-xs font-bold text-stone-500 bg-[#f4f1e8] px-2.5 py-0.5 rounded-xl border border-[#e8e4d8]">{filteredStudents.length} Students</span>
          </div>

          <div className="space-y-4">
            {/* Telugu */}
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                <span className="text-[#2d2d2d]">Telugu (తెలుగు వాచకం)</span>
                <span className="text-amber-800 font-black">{teluguAvg}% Fluency</span>
              </div>
              <div className="w-full bg-[#f4f1e8] rounded-full h-3 overflow-hidden border border-[#e8e4d8]">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${teluguAvg}%` }}
                />
              </div>
            </div>

            {/* Hindi */}
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                <span className="text-[#2d2d2d]">Hindi (हिन्दी रिमझिम)</span>
                <span className="text-orange-800 font-black">{hindiAvg}% Fluency</span>
              </div>
              <div className="w-full bg-[#f4f1e8] rounded-full h-3 overflow-hidden border border-[#e8e4d8]">
                <div
                  className="bg-orange-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${hindiAvg}%` }}
                />
              </div>
            </div>

            {/* English */}
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                <span className="text-[#2d2d2d]">English (Primary Reader)</span>
                <span className="text-indigo-800 font-black">{englishAvg}% Fluency</span>
              </div>
              <div className="w-full bg-[#f4f1e8] rounded-full h-3 overflow-hidden border border-[#e8e4d8]">
                <div
                  className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${englishAvg}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* At-Risk Phonetic & Pronunciation Flag */}
        <div className="bg-[#fffbf0] p-6 rounded-3xl border border-[#fae2a0] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#78350f] font-black text-sm mb-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <span>Phonetic & Cluster Attention</span>
            </div>
            <p className="text-xs text-stone-600 mb-3 leading-relaxed">
              Early intervention list for students with hesitation in Telugu conjunct letters (ఒత్తులు) or English blends:
            </p>

            <div className="space-y-2">
              {atRiskStudents.length > 0 ? (
                atRiskStudents.slice(0, 2).map((s) => (
                  <div key={s.id} className="p-3 bg-white rounded-2xl border border-[#fae2a0] text-xs flex items-center justify-between shadow-2xs">
                    <span className="font-extrabold text-[#2d2d2d]">{s.name}</span>
                    <span className="text-[10px] bg-[#fee2e2] text-[#991b1b] font-black px-2 py-0.5 rounded-lg border border-[#fecaca]">
                      {s.averageWPM} WPM • {s.overallAccuracy}% Acc
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-emerald-900 font-bold p-3 bg-[#edf9f2] rounded-2xl border border-[#c4ebd1]">
                  🎉 All students meeting grade reading milestones!
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-stone-500 italic mt-3">
            Tip: Check the Phonics Diagnostic Matrix below for specific cluster drills.
          </p>
        </div>
      </div>
    </div>
  );
};
