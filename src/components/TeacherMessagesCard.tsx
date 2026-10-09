import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Volume2 } from 'lucide-react';
import { Language, Story, Student } from '../types';
import { backendApi, TeacherMessage } from '../services/backendApi';
import { kidSpeech } from '../services/speechSynthesis';
import { soundEffects } from '../services/soundEffects';
import { publishedReadingToStory } from '../services/publishedReadingToStory';
import { levelOfStudent, readerSettingsFor } from '../data/readingLevels';
import { openWorkbook } from './UnitWorkbookPanel';

// "Message from your teacher" on the child's home: the teacher's answer to an
// "I need help" request and any work they gave, read aloud on tap, with one
// big button that opens the work. "Got it" / doing the work hides it.

const scriptOf = (t: string): Language => (/[ఀ-౿]/.test(t) ? 'Telugu' : /[ऀ-ॿ]/.test(t) ? 'Hindi' : 'English');
const WORK_LABEL = { reading: '📘 Read', workbook: '📝 Workbook', lab: '🎮 Play', dictionary: '🔤 Words' } as const;

export const TeacherMessagesCard: React.FC<{
  student: Student;
  onSelectStory: (story: Story) => void;
  onOpenLab?: (chapterId: string) => void;
  onOpenDictionary?: () => void;
}> = ({ student, onSelectStory, onOpenLab, onOpenDictionary }) => {
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(() => {
    backendApi.studentMessages
      .list()
      .then((r) => setMessages((r.messages || []).filter((m) => !m.doneAt && !(m.seenAt && !m.assign))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!student.id || student.id === 'guest') return;
    load();
  }, [student.id, load]);

  const mark = (m: TeacherMessage, change: { seen?: boolean; done?: boolean }) => {
    void backendApi.studentMessages.mark(m.id, change).catch(() => undefined);
    setMessages((list) =>
      list.filter((x) => x.id !== m.id || (!change.done && !(change.seen && !m.assign))).map((x) => (x.id === m.id ? { ...x, seenAt: x.seenAt || 'now' } : x))
    );
  };

  const hear = (m: TeacherMessage) => {
    kidSpeech.stop();
    const say = [m.text, m.assign ? `Your work: ${m.assign.title}` : ''].filter(Boolean).join('. ');
    void kidSpeech.speakText(say, scriptOf(m.text || m.assign?.title || '')).catch(() => undefined);
    if (!m.seenAt) mark(m, { seen: true });
  };

  const doWork = async (m: TeacherMessage) => {
    if (!m.assign) return;
    soundEffects.playPageTurn();
    const { kind, id, title } = m.assign;
    if (kind === 'workbook') {
      mark(m, { seen: true, done: true });
      openWorkbook({ readingId: id, chapterTitle: title });
    } else if (kind === 'lab') {
      mark(m, { seen: true, done: true });
      onOpenLab?.(id);
    } else if (kind === 'dictionary') {
      mark(m, { seen: true, done: true });
      onOpenDictionary?.();
    } else if (kind === 'reading') {
      setOpening(m.id);
      try {
        const [r, imgs] = await Promise.all([backendApi.readings.get(id), backendApi.readings.images(id)]);
        mark(m, { seen: true, done: true });
        onSelectStory(publishedReadingToStory(r.reading, imgs.images || [], undefined, readerSettingsFor(levelOfStudent(student)).wordsScale));
      } catch {
        // The chapter may have been removed; the message stays.
      } finally {
        setOpening(null);
      }
    }
  };

  if (!messages.length) return null;
  return (
    <section id="teacher-messages" className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8" aria-label="Messages from your teacher">
      <div className="rounded-[24px] border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
        <p className="mb-2 flex items-center gap-2 text-base font-black text-sky-900">
          <span className="text-2xl" aria-hidden>
            👩‍🏫
          </span>
          Message from your teacher
        </p>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {messages.slice(0, 3).map((m) => (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="teacher-message rounded-2xl border border-sky-100 bg-white p-3"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => hear(m)}
                    aria-label="Hear the message"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    {m.text && <p className="text-[15px] font-bold leading-snug text-stone-900">{m.text}</p>}
                    <p className="mt-0.5 text-[11px] font-semibold text-stone-500">
                      {m.teacherName}
                      {m.chapterTitle ? ` · about ${m.chapterTitle}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.assign && (
                    <button
                      type="button"
                      onClick={() => doWork(m)}
                      disabled={opening === m.id}
                      className="teacher-work btn-3d flex items-center gap-1.5 bg-emerald-500 px-4 py-2 text-sm text-white"
                    >
                      {opening === m.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {WORK_LABEL[m.assign.kind]}: {m.assign.title}
                    </button>
                  )}
                  {!m.assign && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playCorrect();
                        mark(m, { seen: true });
                      }}
                      className="teacher-got-it rounded-2xl border-2 border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800"
                    >
                      👍 Got it
                    </button>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
};
