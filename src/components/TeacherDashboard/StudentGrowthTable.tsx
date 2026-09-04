import React, { useState } from 'react';
import { Student, ReadingSessionLog } from '../../types';
import {
  FileCheck,
  Star,
  Flame,
  Award,
  Zap,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Search,
  Layers,
} from 'lucide-react';

interface StudentGrowthTableProps {
  students: Student[];
  readingLogs?: ReadingSessionLog[];
  selectedGrade?: string;
  onSelectStudent: (student: Student) => void;
  onPrintCertificate?: (student: Student) => void;
}

export const StudentGrowthTable: React.FC<StudentGrowthTableProps> = ({
  students,
  readingLogs = [],
  selectedGrade = 'All',
  onSelectStudent,
  onPrintCertificate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = students.filter(
    (s) =>
      (selectedGrade === 'All' || s.grade === selectedGrade) &&
      (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.includes(searchQuery) ||
        s.villageSchool.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-3xl border border-[#e8e4d8] shadow-xs overflow-hidden" id="student-growth-table-container">
      {/* Table Header & Search */}
      <div className="p-5 border-b border-[#f0ece1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-[#2d2d2d]">Individual Student Literacy Profiles</h3>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Click on any student to view diagnostic reading logs or issue certificates
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f4f1e8] border border-[#e5e1d5] rounded-xl text-xs font-bold text-[#2d2d2d] focus:ring-2 focus:ring-amber-400 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8f6f0] text-stone-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-[#e8e4d8]">
            <tr>
              <th className="py-3.5 px-5">Student</th>
              <th className="py-3.5 px-4">Grade & Village</th>
              <th className="py-3.5 px-4 text-center">Stars & Streak</th>
              <th className="py-3.5 px-4">Fluency (Telugu / Hindi / English)</th>
              <th className="py-3.5 px-4 text-center">Speed</th>
              <th className="py-3.5 px-4 text-center">Accuracy</th>
              <th className="py-3.5 px-5 text-right">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece1] font-medium">
            {filtered.map((student) => (
              <tr
                key={student.id}
                className="hover:bg-[#fcfaf4] transition-colors cursor-pointer group"
                onClick={() => onSelectStudent(student)}
              >
                {/* Name & Avatar */}
                <td className="py-3.5 px-5 flex items-center gap-3">
                  <div className="text-2xl p-1.5 bg-[#f4f1e8] rounded-2xl border border-[#e8e4d8] flex items-center justify-center">
                    {student.avatar}
                  </div>
                  <div>
                    <span className="font-extrabold text-[#2d2d2d] block group-hover:text-amber-800 transition-colors">
                      {student.name}
                    </span>
                    <span className="text-[10px] text-stone-400 font-bold">Roll #{student.rollNumber}</span>
                  </div>
                </td>

                {/* Grade & Village */}
                <td className="py-3.5 px-4">
                  <span className="font-extrabold text-[#2d2d2d] block">{student.grade}</span>
                  <span className="text-[10px] text-stone-500 truncate block max-w-xs">{student.villageSchool}</span>
                </td>

                {/* Stars & Streak */}
                <td className="py-3.5 px-4 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="font-black text-amber-900 bg-[#fff8e6] px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1 border border-[#fae2a0]">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                      {student.stars}
                    </span>
                    <span className="font-bold text-orange-950 bg-[#fff1ec] px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1 border border-[#ffd2c4]">
                      <Flame className="w-3 h-3 fill-orange-400 text-orange-500" />
                      {student.streakDays}d
                    </span>
                  </div>
                </td>

                {/* Multilingual Proficiency Pills */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#fef3c7] text-[#78350f] border border-[#fde68a]">
                      TE: {student.languageProficiency.Telugu}%
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#ffedd5] text-[#9a3412] border border-[#fed7aa]">
                      HI: {student.languageProficiency.Hindi}%
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#e0e7ff] text-[#3730a3] border border-[#c7d2fe]">
                      EN: {student.languageProficiency.English}%
                    </span>
                  </div>
                </td>

                {/* Speed */}
                <td className="py-3.5 px-4 text-center font-black text-[#2d2d2d]">
                  {student.averageWPM} <span className="text-[10px] font-normal text-stone-400">WPM</span>
                </td>

                {/* Accuracy */}
                <td className="py-3.5 px-4 text-center">
                  <span className={`font-black px-2.5 py-0.5 rounded-lg text-[11px] ${
                    student.overallAccuracy >= 90
                      ? 'bg-[#edf9f2] text-emerald-800 border border-[#c4ebd1]'
                      : student.overallAccuracy >= 80
                      ? 'bg-[#fff8e6] text-amber-800 border border-[#fae2a0]'
                      : 'bg-[#fee2e2] text-rose-800 border border-[#fecaca]'
                  }`}>
                    {student.overallAccuracy}%
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onSelectStudent(student)}
                      title="View Student Phonics Log"
                      className="p-1.5 bg-[#f4f1e8] hover:bg-amber-100 text-stone-800 hover:text-amber-950 rounded-xl transition-all border border-[#e5e1d5] cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-amber-700" />
                    </button>

                    {onPrintCertificate && (
                      <button
                        onClick={() => onPrintCertificate(student)}
                        title="Print Student Reading Certificate"
                        className="p-1.5 bg-[#eff6ff] hover:bg-[#dbeafe] text-blue-700 rounded-xl transition-all border border-[#bfdbfe] cursor-pointer"
                      >
                        <FileCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
