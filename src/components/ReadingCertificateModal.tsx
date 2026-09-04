import React from 'react';
import { motion } from 'motion/react';
import { Student, Story } from '../types';
import { PathanaShakthiLogo } from './PathanaShakthiLogo';
import { Trophy, Award, Sparkles, Printer, X, CheckCircle, Star } from 'lucide-react';

interface ReadingCertificateModalProps {
  isOpen?: boolean;
  student: Student;
  storyTitle?: string;
  language?: string;
  storiesReadCount?: number;
  onClose: () => void;
}

export const ReadingCertificateModal: React.FC<ReadingCertificateModalProps> = ({
  student,
  storyTitle = 'BoloRead Literacy Level 1',
  language = 'Telugu & English',
  storiesReadCount,
  onClose,
}) => {
  const count = storiesReadCount ?? student.completedStoryIds?.length ?? 1;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="certificate-modal-overlay">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-[#e8e4d8] relative my-auto print:border-4 print:shadow-none"
        id="printable-reading-certificate"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          id="btn-close-certificate"
          className="absolute top-4 right-4 p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5] print:hidden"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Certificate Border Decor */}
        <div className="border border-[#fae2a0] rounded-3xl p-6 sm:p-8 text-center bg-[#fffbf0]">
          <div className="flex justify-center mb-3">
            <PathanaShakthiLogo size="sm" showSubtitle={false} />
          </div>

          <div className="flex items-center justify-center gap-2 text-amber-700 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="font-extrabold tracking-widest uppercase text-xs">Primary School Literacy Award</span>
            <Sparkles className="w-4 h-4" />
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-[#2d2d2d] my-2 tracking-tight">
            Certificate of Reading Excellence
          </h1>

          <p className="text-xs text-stone-500 italic">This is proudly awarded to</p>

          <div className="my-4">
            <h2 className="text-2xl sm:text-3xl font-black text-[#2d2d2d] border-b-2 border-amber-400 inline-block px-8 pb-1">
              {student.name}
            </h2>
            <p className="text-xs text-stone-600 font-bold mt-1">
              {student.grade} • {student.villageSchool}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-stone-700 max-w-md mx-auto leading-relaxed font-medium">
            For outstanding enthusiasm and successful mastery in reading the story{' '}
            <span className="font-extrabold text-amber-950">"{storyTitle}"</span> in{' '}
            <span className="font-extrabold text-amber-950">{language}</span> with brilliant pronunciation and understanding.
          </p>

          {/* Medallion / Badge stamp */}
          <div className="flex items-center justify-center gap-6 my-6">
            <div className="w-16 h-16 rounded-full bg-amber-400 border-2 border-amber-600 flex flex-col items-center justify-center shadow-xs">
              <Trophy className="w-7 h-7 text-amber-950" />
              <span className="text-[7px] font-black text-amber-950 uppercase tracking-tighter">Pathana Star</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-[10px] font-extrabold text-amber-900 mt-1">
                Total Stars: {student.stars} ⭐
              </span>
            </div>
          </div>

          {/* Footer Signature & Date */}
          <div className="flex items-center justify-between border-t border-[#f0ece1] pt-4 mt-4 text-left text-xs text-stone-600">
            <div>
              <p className="font-bold text-[#2d2d2d]">{new Date().toLocaleDateString()}</p>
              <p className="text-[10px] text-stone-500">Date Awarded</p>
            </div>
            <div className="text-right">
              <p className="italic font-bold text-[#2d2d2d]">Pathana Shakthi Class Teacher</p>
              <p className="text-[10px] text-stone-500">Authorized Signature</p>
            </div>
          </div>
        </div>

        {/* Print & Close Buttons */}
        <div className="flex items-center justify-end gap-3 mt-4 print:hidden">
          <button
            onClick={handlePrint}
            id="btn-print-action"
            className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-black text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-xs transition-all"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Certificate</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
