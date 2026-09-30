import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  CircleCheck,
  Clock,
  Image as ImageIcon,
  Loader2,
  Play,
} from 'lucide-react';

import { PublishedReadingSummary, Story, Student } from '../../types';
import { StoryCard } from '../StoryCard';
import { backendApi } from '../../services/backendApi';
import {
  ReadingBook,
  bookContextFor,
  groupReadingsIntoBooks,
  hubSubjectForReading,
  publishedReadingToStory,
} from '../../services/publishedReadingToStory';

interface SubjectStoriesPageProps {
  subject: string;
  stories: Story[];
  student: Student;
  onSelectStory: (story: Story) => void;
  onOpenVoiceSetup?: (story?: Story) => void;
  onToggleOffline: (storyId: string) => void;
  onBack: () => void;
}

type StoryWithSubject = Story & {
  subject?: string;
};

const SUBJECT_META: Record<
  string,
  {
    subtitle: string;
    icon: string;
    accent: string;
    soft: string;
  }
> = {
  English: {
    subtitle: 'Reading & Words',
    icon: '📖',
    accent: 'text-violet-700',
    soft: 'bg-violet-50 border-violet-100',
  },

  Maths: {
    subtitle: 'Numbers & Logic',
    icon: '🔢',
    accent: 'text-blue-700',
    soft: 'bg-blue-50 border-blue-100',
  },

  Science: {
    subtitle: 'Explore & Discover',
    icon: '🧪',
    accent: 'text-emerald-700',
    soft: 'bg-emerald-50 border-emerald-100',
  },

  Social: {
    subtitle: 'People & World',
    icon: '🌍',
    accent: 'text-orange-700',
    soft: 'bg-orange-50 border-orange-100',
  },

  Hindi: {
    subtitle: 'हिंदी पढ़ें',
    icon: 'अ',
    accent: 'text-rose-700',
    soft: 'bg-rose-50 border-rose-100',
  },

  Telugu: {
    subtitle: 'తెలుగు చదవండి',
    icon: 'అ',
    accent: 'text-amber-700',
    soft: 'bg-amber-50 border-amber-100',
  },
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const storyBelongsToSubject = (
  story: StoryWithSubject,
  subject: string,
) => {
  const requested = normalize(subject);
  const explicitSubject = normalize(story.subject);
  const category = normalize(story.category);
  const title = normalize(story.title);
  const language = normalize(story.language);

  if (explicitSubject) {
    return explicitSubject === requested;
  }

  if (
    requested === 'english' ||
    requested === 'hindi' ||
    requested === 'telugu'
  ) {
    return language === requested;
  }

  return (
    category.includes(requested) ||
    title.includes(requested)
  );
};

export const SubjectStoriesPage: React.FC<
  SubjectStoriesPageProps
> = ({
  subject,
  stories,
  student,
  onSelectStory,
  onOpenVoiceSetup,
  onToggleOffline,
  onBack,
}) => {
  const meta =
    SUBJECT_META[subject] ?? {
      subtitle: 'Stories for your learning journey',
      icon: '📚',
      accent: 'text-stone-700',
      soft: 'bg-stone-50 border-stone-200',
    };

  const subjectStories = useMemo(
    () =>
      stories.filter(
        (story) =>
          story.gradeLevel === student.grade &&
          storyBelongsToSubject(
            story as StoryWithSubject,
            subject,
          ),
      ),
    [stories, subject, student.grade],
  );

  const completedCount = subjectStories.filter((story) =>
    student.completedStoryIds?.includes(story.id),
  ).length;

  /* ========================================================
     PUBLISHED TEXTBOOK READINGS
     Real OCR'd chapters a teacher published for this subject and grade —
     distinct from the AI-generated Story[] above. See PublishedReading /
     publishedReadingToStory.
  ======================================================== */

  const [publishedReadings, setPublishedReadings] = useState<PublishedReadingSummary[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(true);
  const [readingsError, setReadingsError] = useState('');
  const [openingReadingId, setOpeningReadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReadings = async () => {
      setReadingsLoading(true);
      setReadingsError('');

      try {
        // Grade-only query, subject matched here: published subjects are
        // AI-detected labels ("Poetry", "EVS") that rarely equal a hub tile.
        const response = await backendApi.readings.list(student.grade);
        if (!cancelled) {
          const all = Array.isArray(response?.readings) ? response.readings : [];
          setPublishedReadings(
            all.filter(
              (reading) =>
                hubSubjectForReading(reading.subject, reading.language) ===
                subject
            )
          );
        }
      } catch (error) {
        console.error('Failed to load published textbook readings:', error);
        if (!cancelled) {
          setReadingsError('Textbook readings could not be loaded right now.');
          setPublishedReadings([]);
        }
      } finally {
        if (!cancelled) {
          setReadingsLoading(false);
        }
      }
    };

    void loadReadings();

    return () => {
      cancelled = true;
    };
  }, [student.grade, subject]);

  const books = useMemo(() => groupReadingsIntoBooks(publishedReadings), [publishedReadings]);
  const [expandedBookKey, setExpandedBookKey] = useState<string | null>(null);
  const isChapterRead = (readingId: string) =>
    Boolean(student.completedStoryIds?.includes(`reading_${readingId}`));
  const readingsCompleted = publishedReadings.filter((r) => isChapterRead(r.id)).length;

  const handleOpenPublishedReading = async (readingId: string, book?: ReadingBook) => {
    setOpeningReadingId(readingId);
    setReadingsError('');
    try {
      const [readingResponse, imagesResponse] = await Promise.all([
        backendApi.readings.get(readingId),
        backendApi.readings.images(readingId),
      ]);
      const story = publishedReadingToStory(
        readingResponse.reading,
        imagesResponse.images || [],
        book ? bookContextFor(book) : undefined
      );
      onSelectStory(story);
    } catch (error) {
      console.error('Failed to open published reading:', error);
      setReadingsError('Could not open this reading. Please try again.');
    } finally {
      setOpeningReadingId(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-stone-50 text-stone-900 pb-16 font-sans pl-[76px]">

      {/* ========================================================
          BACKGROUND
      ======================================================== */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="
            absolute
            inset-0
            bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.10),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(124,58,237,0.08),transparent_30%)]
          "
        />
      </div>

      {/* ========================================================
          MAIN PAGE
      ======================================================== */}
      <div
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-7xl
          px-4
          sm:px-6
          lg:px-8
          pt-7
          sm:pt-9
        "
      >
        <motion.section
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.35,
            ease: 'easeOut',
          }}
          className="
            overflow-hidden
            rounded-[30px]
            border
            border-stone-200/80
            bg-white
            shadow-[0_18px_55px_rgba(50,45,35,0.07)]
          "
        >

          {/* ====================================================
              HEADER
          ==================================================== */}
          <div
            className="
              border-b
              border-stone-100
              bg-gradient-to-r
              from-white
              via-amber-50/35
              to-orange-50/30
              px-5
              py-5
              sm:px-7
              sm:py-6
            "
          >
            <button
              type="button"
              onClick={onBack}
              className="
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-stone-200
                bg-white
                px-3
                py-1.5
                text-[10px]
                font-black
                text-stone-600
                shadow-sm
                transition-all
                hover:-translate-x-0.5
                hover:border-amber-300
                hover:text-stone-900
              "
            >
              <ArrowLeft className="h-3.5 w-3.5" />

              Back to subjects
            </button>

            <div
              className="
                mt-5
                flex
                flex-col
                gap-4
                sm:flex-row
                sm:items-end
                sm:justify-between
              "
            >
              <div>

                <div
                  className={`
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    px-3
                    py-1.5
                    text-[9px]
                    font-black
                    uppercase
                    tracking-[0.16em]
                    ${meta.soft}
                    ${meta.accent}
                  `}
                >
                  <span className="text-base leading-none">
                    {meta.icon}
                  </span>

                  {subject} learning space
                </div>

                <h1
                  className="
                    mt-3
                    text-2xl
                    font-black
                    tracking-tight
                    text-stone-950
                    sm:text-3xl
                  "
                >
                  Explore {subject}
                </h1>

                <p
                  className="
                    mt-1
                    max-w-2xl
                    text-xs
                    leading-5
                    text-stone-500
                    sm:text-sm
                  "
                >
                  {meta.subtitle}. Pick a story and start your
                  reading adventure.
                </p>
              </div>

              <div
                className="
                  inline-flex
                  shrink-0
                  items-center
                  gap-2
                  self-start
                  rounded-2xl
                  border
                  border-emerald-100
                  bg-emerald-50
                  px-3
                  py-2
                "
              >
                <CircleCheck className="h-4 w-4 text-emerald-500" />

                <div>
                  <p
                    className="
                      text-[9px]
                      font-black
                      uppercase
                      tracking-wide
                      text-emerald-700
                    "
                  >
                    Ready to read
                  </p>

                  <p
                    className="
                      text-xs
                      font-black
                      text-emerald-900
                    "
                  >
                    {completedCount + readingsCompleted} of{' '}
                    {subjectStories.length + publishedReadings.length}{' '}
                    completed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================
              PUBLISHED TEXTBOOK READINGS
              Real OCR'd chapters a teacher published for this subject and
              grade — distinct from the AI-generated stories below.
          ==================================================== */}
          {(readingsLoading || publishedReadings.length > 0 || readingsError) && (
            <div className="px-5 sm:px-7 pt-5 sm:pt-7">
              <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/40 p-4 sm:p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 mb-3">
                  <BookOpen className="h-3.5 w-3.5" />
                  From Your Textbooks
                </div>

                {readingsError && (
                  <p className="text-xs text-rose-700 font-medium mb-2">{readingsError}</p>
                )}

                {readingsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-stone-500 font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading textbook readings...
                  </div>
                ) : books.length === 0 ? null : (
                  <div id="reading-books" className="space-y-3">
                    {books.map((book) => {
                      const readCount = book.chapters.filter((c) => isChapterRead(c.id)).length;
                      const nextChapter = book.chapters.find((c) => !isChapterRead(c.id)) || book.chapters[0];
                      const expanded =
                        expandedBookKey === book.key || (expandedBookKey === null && books.length === 1);
                      const percent = Math.round((readCount / book.chapters.length) * 100);
                      return (
                        <div
                          key={book.key}
                          id={`reading-book-${book.bookId.replace(/[^A-Za-z0-9_-]/g, '_')}`}
                          className="rounded-2xl border border-emerald-100 bg-white overflow-hidden"
                        >
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">📘</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm sm:text-base font-black text-stone-900 line-clamp-2">{book.bookTitle}</h3>
                              <p className="text-[11px] text-stone-500 font-semibold mt-0.5">
                                {book.chapters.length} {book.chapters.length === 1 ? 'chapter' : 'chapters'} · {readCount} read
                              </p>
                              <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-stone-100 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                className="btn-continue-book inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-black text-white disabled:opacity-60"
                                disabled={openingReadingId !== null}
                                onClick={() => handleOpenPublishedReading(nextChapter.id, book)}
                              >
                                {openingReadingId === nextChapter.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                                {readCount === 0 ? 'Start' : readCount === book.chapters.length ? 'Read again' : 'Continue'}
                              </button>
                              <button
                                type="button"
                                aria-expanded={expanded}
                                className="btn-toggle-book-chapters inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-600 hover:border-emerald-300"
                                onClick={() => setExpandedBookKey(expanded ? '' : book.key)}
                              >
                                Chapters
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {expanded && (
                            <ol className="border-t border-emerald-50 divide-y divide-stone-100">
                              {book.chapters.map((chapter, index) => {
                                const read = isChapterRead(chapter.id);
                                const isNext = !read && chapter.id === nextChapter.id;
                                return (
                                  <li key={chapter.id}>
                                    <button
                                      type="button"
                                      id={`reading-chapter-${chapter.id}`}
                                      onClick={() => handleOpenPublishedReading(chapter.id, book)}
                                      disabled={openingReadingId !== null}
                                      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors disabled:opacity-60 ${
                                        isNext ? 'bg-emerald-50/70' : 'hover:bg-stone-50'
                                      }`}
                                    >
                                      <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                          read ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-600'
                                        }`}
                                      >
                                        {read ? <CircleCheck className="w-4 h-4" /> : index + 1}
                                      </span>
                                      <span className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-stone-900 line-clamp-1">
                                          {chapter.chapterTitle}
                                        </span>
                                        {chapter.summary && (
                                          <span className="text-[11px] text-stone-500 line-clamp-2 sm:line-clamp-1">{chapter.summary}</span>
                                        )}
                                      </span>
                                      <span className="hidden sm:flex items-center gap-2 shrink-0 text-[10px] font-bold text-stone-400">
                                        {chapter.difficulty && (
                                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">{chapter.difficulty}</span>
                                        )}
                                        {chapter.estimatedReadingMinutes ? (
                                          <span className="flex items-center gap-0.5">
                                            <Clock className="w-3 h-3" />~{chapter.estimatedReadingMinutes} min
                                          </span>
                                        ) : null}
                                        {chapter.imageCount > 0 && (
                                          <span className="flex items-center gap-0.5">
                                            <ImageIcon className="w-3 h-3" />
                                            {chapter.imageCount}
                                          </span>
                                        )}
                                      </span>
                                      {openingReadingId === chapter.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                                      ) : (
                                        <Play className={`w-4 h-4 shrink-0 ${isNext ? 'text-emerald-600' : 'text-stone-300'}`} />
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ====================================================
              STORIES
          ==================================================== */}
          <div className="p-5 sm:p-7">

            {subjectStories.length === 0 && (readingsLoading || publishedReadings.length > 0) ? null : subjectStories.length === 0 ? (
              <div
                className="
                  rounded-[24px]
                  border
                  border-dashed
                  border-stone-200
                  bg-stone-50
                  px-6
                  py-14
                  text-center
                "
              >
                <div
                  className="
                    mx-auto
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-white
                    text-2xl
                    shadow-sm
                    ring-1
                    ring-stone-200
                  "
                >
                  📚
                </div>

                <h2
                  className="
                    mt-4
                    text-lg
                    font-black
                    text-stone-900
                  "
                >
                  No {subject} stories yet
                </h2>

                <p
                  className="
                    mx-auto
                    mt-1
                    max-w-md
                    text-xs
                    leading-5
                    text-stone-500
                    sm:text-sm
                  "
                >
                  This learning space is ready. Stories added
                  for {subject} will appear here automatically.
                </p>

                <button
                  type="button"
                  onClick={onBack}
                  className="
                    mt-5
                    inline-flex
                    items-center
                    gap-2
                    rounded-2xl
                    bg-stone-900
                    px-4
                    py-2.5
                    text-xs
                    font-black
                    text-white
                    transition-all
                    hover:bg-stone-800
                  "
                >
                  <BookOpen className="h-3.5 w-3.5" />

                  Choose another subject
                </button>
              </div>
            ) : (
              <>
                <div
                  className="
                    mb-5
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <h2
                      className="
                        flex
                        items-center
                        gap-2
                        text-base
                        font-black
                        text-stone-950
                        sm:text-lg
                      "
                    >
                      <BookOpen
                        className={`h-4 w-4 ${meta.accent}`}
                      />

                      {subject} stories
                    </h2>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        font-semibold
                        text-stone-400
                        sm:text-xs
                      "
                    >
                      {subjectStories.length}{' '}
                      {subjectStories.length === 1
                        ? 'story'
                        : 'stories'}{' '}
                      to explore
                    </p>
                  </div>
                </div>

                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},

                    show: {
                      transition: {
                        staggerChildren: 0.05,
                      },
                    },
                  }}
                  className="
                    grid
                    grid-cols-1
                    gap-5
                    sm:grid-cols-2
                    lg:grid-cols-3
                  "
                >
                  {subjectStories.map((story) => (
                    <motion.div
                      key={story.id}
                      variants={{
                        hidden: {
                          opacity: 0,
                          y: 12,
                        },

                        show: {
                          opacity: 1,
                          y: 0,
                        },
                      }}
                      className="relative"
                    >
                      {student.completedStoryIds?.includes(
                        story.id,
                      ) && (
                        <div
                          className="
                            pointer-events-none
                            absolute
                            right-3
                            top-3
                            z-20
                            inline-flex
                            items-center
                            gap-1
                            rounded-full
                            bg-emerald-500
                            px-2
                            py-1
                            text-[8px]
                            font-black
                            text-white
                            shadow-sm
                          "
                        >
                          <CircleCheck className="h-3 w-3" />

                          Read
                        </div>
                      )}

                      <StoryCard
                        story={story}
                        onSelect={onSelectStory}
                        onSetupAndRead={onOpenVoiceSetup}
                        onToggleOffline={onToggleOffline}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default SubjectStoriesPage;