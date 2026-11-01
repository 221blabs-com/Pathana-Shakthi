import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Student } from '../../types';
import { StudentProgressHub } from '../StudentProgressHub';
import { backendApi } from '../../services/backendApi';
import { FlnChips, openFlnCheck } from '../FlnCheckPanel';
import { flnSummary, type FlnResult } from '../../data/flnCheck';

// The child's own page ("My progress"): who they are, stars, streak, stories,
// quick actions and the reading garden, and the chapter reading checks (FLN) they did.
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
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <MyReadingChecks />
    </div>
  </div>
);

/** The child's reading checks (src/data/flnCheck.ts), newest first; tap one to open it again. */
const MyReadingChecks: React.FC = () => {
  const [results, setResults] = useState<FlnResult[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    backendApi.fln
      .mine()
      .then((r) => !cancelled && setResults(Object.values(r.results || {}).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))))
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!results || results.length === 0) return null;
  return (
    <section className="rounded-3xl border border-sky-200 bg-white p-4" id="my-reading-checks">
      <h2 className="text-lg font-black text-stone-900">🧪 My reading checks</h2>
      <ul className="mt-2 divide-y divide-stone-100">
        {results.map((r) => (
          <li key={r.readingId}>
            <button type="button" onClick={() => openFlnCheck({ readingId: r.readingId, chapterTitle: r.chapterTitle || '' })} className="flex w-full flex-wrap items-center gap-2 py-2 text-left">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-800">{r.chapterTitle}</span>
              <FlnChips summary={flnSummary(r)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
