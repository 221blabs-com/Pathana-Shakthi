import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Student } from '../../types';
import { StudentProgressHub } from '../StudentProgressHub';

// The child's own page ("My progress"): who they are, stars, streak, stories,
// quick actions and the reading garden.
// These used to sit on the home page; home is now only for picking what to learn.
export const StudentProfilePage: React.FC<{
  student: Student;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenVoiceSetup?: () => void;
  onOpenRewardChest: () => void;
  onOpenCertificateModal: () => void;
  onRefreshStudent?: () => void;
}> = ({ student, onBack, ...hub }) => (
  <div className="min-h-screen bg-[#fffaf0] pb-12" id="student-profile-page">
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-black text-stone-700">
        <ArrowLeft className="h-4 w-4" /> Home
      </button>
      <div className="mt-4 flex items-center gap-4 rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-4xl" aria-hidden>
          {student.avatar || '🧒'}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black text-stone-900">{student.name}</h1>
          <p className="text-sm font-bold text-stone-500">
            {student.grade}
            {student.rollNumber ? ` · Roll ${student.rollNumber}` : ''}
          </p>
        </div>
      </div>
    </div>
    <StudentProgressHub student={student} {...hub} />
  </div>
);
