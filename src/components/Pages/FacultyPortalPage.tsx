import React, { useState } from 'react';
import {
  Student,
  ReadingSessionLog,
  Story,
  TextbookAnalysis,
} from '../../types';
import { TextbookOCRModal } from '../TeacherDashboard/TextbookOCRModal';
import { StoryGeneratorModal } from '../TeacherDashboard/StoryGeneratorModal';
import { soundEffects } from '../../services/soundEffects';
import {
  Sparkles,
  Upload,
  BookOpen,
  ChevronRight,
  Languages,
  PlayCircle,
  Library,
  Layers,
  Search,
  GraduationCap,
  Users,
  Calculator,
  Globe2,
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

type Subject =
  | 'English'
  | 'Hindi'
  | 'Telugu'
  | 'Mathematics'
  | 'Social Studies';

interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'Reading' | 'Phonics' | 'Vocabulary' | 'Practice' | 'Story';
}

interface ClassData {
  className: string;
  subjects: Record<Subject, Lesson[]>;
}

const SUBJECTS: Subject[] = [
  'English',
  'Hindi',
  'Telugu',
  'Mathematics',
  'Social Studies',
];

const makeLessons = (
  prefix: string,
  lessons: Array<[string, string, Lesson['type']]>,
): Lesson[] =>
  lessons.map(([title, description, type], index) => ({
    id: `${prefix}-${index + 1}`,
    title,
    description,
    type,
  }));

const CURRICULUM: ClassData[] = [
  {
    className: 'Class 1',
    subjects: {
      English: makeLessons('c1-en', [
        ['Alphabet & Letter Sounds', 'Recognise letters and practise their basic sounds.', 'Phonics'],
        ['Short Vowel Sounds', 'Practise short a, e, i, o and u sounds.', 'Phonics'],
        ['My First Words', 'Read simple three-letter words and familiar vocabulary.', 'Vocabulary'],
        ['At My School', 'Beginner read-along story about school.', 'Story'],
      ]),
      Hindi: makeLessons('c1-hi', [
        ['स्वर परिचय', 'Learn and recognise basic Hindi vowels.', 'Phonics'],
        ['व्यंजन परिचय', 'Identify common Hindi consonants and sounds.', 'Phonics'],
        ['सरल शब्द', 'Read simple familiar Hindi words.', 'Vocabulary'],
        ['मेरा विद्यालय', 'Beginner Hindi read-along story about school.', 'Story'],
      ]),
      Telugu: makeLessons('c1-te', [
        ['అచ్చులు', 'Learn and recognise basic Telugu vowels.', 'Phonics'],
        ['హల్లులు', 'Identify common Telugu consonants and sounds.', 'Phonics'],
        ['సులభ పదాలు', 'Read simple Telugu words.', 'Vocabulary'],
        ['నా పాఠశాల', 'Beginner Telugu read-along story about school.', 'Story'],
      ]),
      Mathematics: makeLessons('c1-math', [
        ['Numbers 1–20', 'Recognise, count and write numbers from 1 to 20.', 'Practice'],
        ['Addition Basics', 'Solve simple addition problems using objects and pictures.', 'Practice'],
        ['Shapes Around Us', 'Identify common 2D shapes in everyday objects.', 'Practice'],
        ['Patterns', 'Recognise and continue simple number and shape patterns.', 'Practice'],
      ]),
      'Social Studies': makeLessons('c1-ss', [
        ['My Family', 'Learn about family members and relationships.', 'Reading'],
        ['My School', 'Understand people and places in the school community.', 'Reading'],
        ['My Neighbourhood', 'Recognise important places around the neighbourhood.', 'Reading'],
        ['People Who Help Us', 'Learn about helpers in the community.', 'Reading'],
      ]),
    },
  },
  {
    className: 'Class 2',
    subjects: {
      English: makeLessons('c2-en', [
        ['Blending Sounds', 'Blend individual sounds to read simple words.', 'Phonics'],
        ['Word Families', 'Explore common word families and spelling patterns.', 'Phonics'],
        ['Everyday Vocabulary', 'Build vocabulary around home and classroom life.', 'Vocabulary'],
        ['The Little Seed', 'Decodable read-along story about a growing seed.', 'Story'],
      ]),
      Hindi: makeLessons('c2-hi', [
        ['मात्राओं का परिचय', 'Recognise and read common vowel signs.', 'Phonics'],
        ['मात्रा वाले शब्द', 'Practise words containing basic matras.', 'Phonics'],
        ['घर और परिवार', 'Build vocabulary around family and home.', 'Vocabulary'],
        ['छोटी चिड़िया', 'Simple Hindi read-along story.', 'Story'],
      ]),
      Telugu: makeLessons('c2-te', [
        ['గుణింతాలు', 'Recognise and read common Telugu vowel signs.', 'Phonics'],
        ['పద నిర్మాణం', 'Build and decode simple Telugu words.', 'Phonics'],
        ['ఇల్లు మరియు కుటుంబం', 'Vocabulary for home and family.', 'Vocabulary'],
        ['చిన్న పక్షి', 'Simple Telugu read-along story.', 'Story'],
      ]),
      Mathematics: makeLessons('c2-math', [
        ['Numbers up to 100', 'Read, write, compare and order numbers up to 100.', 'Practice'],
        ['Addition & Subtraction', 'Practise two-digit addition and subtraction.', 'Practice'],
        ['Multiplication Introduction', 'Explore equal groups and repeated addition.', 'Practice'],
        ['Money & Time', 'Identify common coins and read simple clock times.', 'Practice'],
      ]),
      'Social Studies': makeLessons('c2-ss', [
        ['My Community', 'Explore the people, places and services in a community.', 'Reading'],
        ['Our Neighbourhood', 'Identify important places and how people use them.', 'Reading'],
        ['Plants Around Us', 'Observe common plants and their uses.', 'Reading'],
        ['Keeping Our Surroundings Clean', 'Learn simple ways to care for shared spaces.', 'Reading'],
      ]),
    },
  },
  {
    className: 'Class 3',
    subjects: {
      English: makeLessons('c3-en', [
        ['Consonant Blends', 'Read words containing common consonant blends.', 'Phonics'],
        ['Digraphs', 'Practise sh, ch, th, wh and other digraphs.', 'Phonics'],
        ['Context Vocabulary', 'Use context to understand new words.', 'Vocabulary'],
        ['The Clever Rabbit', 'Story for developing reading fluency.', 'Story'],
      ]),
      Hindi: makeLessons('c3-hi', [
        ['संयुक्त शब्द', 'Read and decode longer Hindi words.', 'Phonics'],
        ['शब्द भंडार', 'Expand vocabulary through familiar themes.', 'Vocabulary'],
        ['वाक्य पठन', 'Read and understand short Hindi sentences.', 'Reading'],
        ['ईमानदार लकड़हारा', 'Guided Hindi read-along story.', 'Story'],
      ]),
      Telugu: makeLessons('c3-te', [
        ['సంయుక్తాక్షరాల పరిచయం', 'Introduction to common Telugu conjunct forms.', 'Phonics'],
        ['పదజాలం', 'Build vocabulary through familiar topics.', 'Vocabulary'],
        ['వాక్య పఠనం', 'Read and understand short Telugu sentences.', 'Reading'],
        ['తెలివైన కుందేలు', 'Guided Telugu read-along story.', 'Story'],
      ]),
      Mathematics: makeLessons('c3-math', [
        ['Multiplication Tables', 'Build fluency with multiplication facts.', 'Practice'],
        ['Division Basics', 'Understand sharing and grouping through simple division.', 'Practice'],
        ['Fractions', 'Recognise simple fractions such as halves and quarters.', 'Practice'],
        ['Measurement', 'Measure length, weight and capacity using standard units.', 'Practice'],
      ]),
      'Social Studies': makeLessons('c3-ss', [
        ['Our State', 'Learn about the state, its people and places.', 'Reading'],
        ['Maps & Directions', 'Read simple maps and use basic directions.', 'Practice'],
        ['Our Environment', 'Understand how people interact with their environment.', 'Reading'],
        ['Community Services', 'Explore services that support a community.', 'Reading'],
      ]),
    },
  },
  {
    className: 'Class 4',
    subjects: {
      English: makeLessons('c4-en', [
        ['Advanced Phonics Patterns', 'Practise common spelling and sound patterns.', 'Phonics'],
        ['Reading Fluency', 'Build speed, accuracy and expression.', 'Reading'],
        ['Meaning From Context', 'Infer word meanings from sentences and paragraphs.', 'Vocabulary'],
        ['A Journey Through the Forest', 'Extended read-along fluency story.', 'Story'],
      ]),
      Hindi: makeLessons('c4-hi', [
        ['संयुक्त व्यंजन', 'Practise common conjunct consonants.', 'Phonics'],
        ['प्रवाहपूर्ण पठन', 'Develop accurate and expressive reading.', 'Reading'],
        ['नए शब्दों का अर्थ', 'Understand unfamiliar vocabulary from context.', 'Vocabulary'],
        ['जंगल की यात्रा', 'Extended Hindi read-along story.', 'Story'],
      ]),
      Telugu: makeLessons('c4-te', [
        ['సంయుక్తాక్షరాల సాధన', 'Practise common Telugu conjunct letters.', 'Phonics'],
        ['సరళ పఠనం', 'Develop accurate and expressive Telugu reading.', 'Reading'],
        ['సందర్భం ద్వారా అర్థం', 'Understand unfamiliar words from context.', 'Vocabulary'],
        ['అడవిలో ప్రయాణం', 'Extended Telugu read-along story.', 'Story'],
      ]),
      Mathematics: makeLessons('c4-math', [
        ['Large Numbers', 'Read, compare and work with larger whole numbers.', 'Practice'],
        ['Multiplication & Division', 'Solve multi-step multiplication and division problems.', 'Practice'],
        ['Fractions & Decimals', 'Compare simple fractions and introduce decimals.', 'Practice'],
        ['Geometry', 'Explore angles, lines and common geometric shapes.', 'Practice'],
      ]),
      'Social Studies': makeLessons('c4-ss', [
        ['India: States & Regions', 'Explore the major regions and states of India.', 'Reading'],
        ['History Around Us', 'Understand important events and people from the past.', 'Reading'],
        ['Resources & Occupations', 'Learn how people use resources and earn a living.', 'Reading'],
        ['Caring for the Environment', 'Explore responsible ways to protect natural resources.', 'Reading'],
      ]),
    },
  },
  {
    className: 'Class 5',
    subjects: {
      English: makeLessons('c5-en', [
        ['Complex Word Patterns', 'Decode multisyllabic and complex words.', 'Phonics'],
        ['Paragraph Fluency', 'Read longer passages with accuracy and expression.', 'Reading'],
        ['Advanced Vocabulary', 'Build vocabulary using context and word relationships.', 'Vocabulary'],
        ['The Young Explorer', 'Longer read-along story for independent readers.', 'Story'],
      ]),
      Hindi: makeLessons('c5-hi', [
        ['कठिन शब्द पठन', 'Decode longer and more complex Hindi words.', 'Phonics'],
        ['अनुच्छेद पठन', 'Read longer Hindi passages with fluency.', 'Reading'],
        ['उन्नत शब्दावली', 'Develop vocabulary through context and usage.', 'Vocabulary'],
        ['नन्हा खोजी', 'Longer Hindi read-along story.', 'Story'],
      ]),
      Telugu: makeLessons('c5-te', [
        ['క్లిష్ట పదాల పఠనం', 'Decode longer and more complex Telugu words.', 'Phonics'],
        ['పేరాగ్రాఫ్ పఠనం', 'Read longer Telugu passages with fluency.', 'Reading'],
        ['ఉన్నత పదజాలం', 'Build advanced vocabulary through context.', 'Vocabulary'],
        ['చిన్న అన్వేషకుడు', 'Longer Telugu read-along story.', 'Story'],
      ]),
      Mathematics: makeLessons('c5-math', [
        ['Operations with Whole Numbers', 'Solve multi-step problems using the four operations.', 'Practice'],
        ['Fractions & Decimals', 'Compare, add and subtract familiar fractions and decimals.', 'Practice'],
        ['Geometry & Area', 'Calculate perimeter and area of common shapes.', 'Practice'],
        ['Data & Graphs', 'Read, interpret and create simple graphs and tables.', 'Practice'],
      ]),
      'Social Studies': makeLessons('c5-ss', [
        ['India: Geography', 'Explore major physical features and regions of India.', 'Reading'],
        ['Civics & Our Government', 'Understand basic roles and responsibilities in society.', 'Reading'],
        ['India Through History', 'Explore key events, people and developments from the past.', 'Reading'],
        ['People & Natural Resources', 'Understand responsible use and conservation of resources.', 'Reading'],
      ]),
    },
  },
];

const SUBJECT_STYLES: Record<Subject, string> = {
  English: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  Hindi: 'border-orange-200 bg-orange-50 text-orange-700',
  Telugu: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Mathematics: 'border-sky-200 bg-sky-50 text-sky-700',
  'Social Studies': 'border-violet-200 bg-violet-50 text-violet-700',
};

const TYPE_ICON = (type: Lesson['type']) => {
  if (type === 'Phonics') return <Layers className="w-3.5 h-3.5" />;
  if (type === 'Vocabulary') return <Search className="w-3.5 h-3.5" />;
  if (type === 'Reading') return <BookOpen className="w-3.5 h-3.5" />;
  return <PlayCircle className="w-3.5 h-3.5" />;
};

const ClassLessonLibrary: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState('Class 1');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('English');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const currentClass =
    CURRICULUM.find((item) => item.className === selectedClass) ??
    CURRICULUM[0];

  const lessons = currentClass.subjects[selectedSubject];

  const selectClass = (className: string) => {
    soundEffects.playWordPop();
    setSelectedClass(className);
    setSelectedLesson(null);
  };

  const selectSubject = (subject: Subject) => {
    soundEffects.playWordPop();
    setSelectedSubject(subject);
    setSelectedLesson(null);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library className="w-4 h-4 text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              Faculty Curriculum Library
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#2d2d2d]">
            Class-wise Lessons
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Choose a class, then a subject, to see every lesson for that class.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-stone-200 shadow-sm">
          <Languages className="w-4 h-4 text-amber-600" />
          <span className="text-[10px] font-black text-stone-600">
            Classes 1–5 · 5 Subjects
          </span>
        </div>
      </div>

      {/* ONLY the five class sections */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CURRICULUM.map((item, index) => {
          const active = selectedClass === item.className;

          return (
            <button
              key={item.className}
              type="button"
              onClick={() => selectClass(item.className)}
              className={`
                relative overflow-hidden rounded-2xl border px-4 py-4 text-left
                transition-all duration-200 cursor-pointer
                ${
                  active
                    ? 'bg-[#2d2d2d] border-[#2d2d2d] text-white shadow-lg -translate-y-0.5'
                    : 'bg-white border-stone-200 text-stone-800 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5'
                }
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p
                    className={`text-[9px] font-black uppercase tracking-[0.16em] ${
                      active ? 'text-amber-300' : 'text-amber-600'
                    }`}
                  >
                    Grade {index + 1}
                  </p>
                  <p className="text-base font-black mt-1">{item.className}</p>
                  <p className="text-[9px] text-stone-400 mt-2">
                    5 subjects · 20 lessons
                  </p>
                </div>

                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                    active
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Everything below is ALWAYS scoped to the selected class */}
      <div className="rounded-3xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-[#2d2d2d] px-5 sm:px-7 py-5 sm:py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Selected Class
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black">
                {currentClass.className}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                All 5 subjects and lessons for {currentClass.className}
              </p>
            </div>

            <div className="px-3 py-2 rounded-xl bg-amber-400 text-stone-950">
              <span className="text-[9px] font-black">20 LESSONS</span>
            </div>
          </div>
        </div>

        {/* Subject subsections */}
        <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-400 mb-3">
            Subjects
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SUBJECTS.map((subject) => {
              const active = selectedSubject === subject;

              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => selectSubject(subject)}
                  className={`
                    flex items-center justify-between gap-3 rounded-2xl border
                    px-4 py-4 text-left transition-all cursor-pointer
                    ${
                      active
                        ? `${SUBJECT_STYLES[subject]} shadow-sm`
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center font-black ${
                        active ? 'bg-white/70' : 'bg-stone-100'
                      }`}
                    >
                      {subject === 'English' && (
                        <span className="text-lg font-black">A</span>
                      )}
                      {subject === 'Hindi' && (
                        <span className="text-lg font-black">अ</span>
                      )}
                      {subject === 'Telugu' && (
                        <span className="text-[9px] font-black">తెలుగు</span>
                      )}
                      {subject === 'Mathematics' && (
                        <Calculator className="w-5 h-5" />
                      )}
                      {subject === 'Social Studies' && (
                        <Globe2 className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider opacity-60">
                        Subject
                      </p>
                      <h4 className="text-sm font-black text-stone-900">
                        {subject}
                      </h4>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 opacity-60" />
                </button>
              );
            })}
          </div>
        </div>

        {/* All lessons for selected class + selected subject */}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-600">
                {currentClass.className} · {selectedSubject}
              </p>
              <h4 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
                All {selectedSubject} Lessons
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Every lesson available for this class and subject.
              </p>
            </div>

            <span
              className={`self-start px-3 py-1.5 rounded-full text-[9px] font-black ${
                SUBJECT_STYLES[selectedSubject]
              }`}
            >
              {lessons.length} LESSONS
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {lessons.map((lesson, index) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => {
                  soundEffects.playWordPop();
                  setSelectedLesson(lesson);
                  window.setTimeout(() => {
                    document.getElementById('selected-lesson-details')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }, 0);
                }}
                className="group w-full text-left rounded-2xl border border-stone-200 bg-stone-50 hover:bg-white hover:border-amber-300 hover:shadow-md p-4 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-white border border-stone-200 flex items-center justify-center group-hover:border-amber-200 group-hover:bg-amber-50">
                    <span className="text-[10px] font-black text-stone-500 group-hover:text-amber-700">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                          Lesson {index + 1}
                        </p>
                        <h5 className="text-sm font-black text-stone-900 mt-0.5">
                          {lesson.title}
                        </h5>
                      </div>

                      <ChevronRight className="w-4 h-4 shrink-0 text-stone-300 group-hover:text-amber-500" />
                    </div>

                    <p className="text-[10px] text-stone-500 leading-relaxed mt-2">
                      {lesson.description}
                    </p>

                    <span
                      className={`mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wide ${SUBJECT_STYLES[selectedSubject]}`}
                    >
                      {TYPE_ICON(lesson.type)}
                      {lesson.type}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================
          SELECTED LESSON DETAILS
          Rendered inline so the page never disappears behind an overlay.
      ======================================================== */}
      {selectedLesson && (
        <div
          id="selected-lesson-details"
          className="rounded-3xl border border-amber-200 bg-white shadow-md overflow-hidden">
          <div className="bg-[#2d2d2d] text-white px-5 sm:px-7 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[9px] font-black uppercase text-stone-950">
                    {currentClass.className}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase text-stone-300">
                    {selectedSubject}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase text-stone-300">
                    {selectedLesson.type}
                  </span>
                </div>

                <h3 className="text-2xl font-black">{selectedLesson.title}</h3>

                <p className="text-sm text-stone-300 mt-1">
                  {selectedLesson.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 mb-5">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-600">
                Lesson Summary
              </p>
              <h4 className="text-lg font-black text-stone-900 mt-1">
                {currentClass.className} · {selectedSubject}
              </h4>
              <p className="text-sm text-stone-600 leading-relaxed mt-2">
                This lesson is part of the {selectedSubject} curriculum for{' '}
                {currentClass.className}. Students can practise the lesson
                through guided activities, lesson-specific vocabulary,
                reading support and targeted classroom practice.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Language Phonics Struggle Hotspots */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-700" />
                  <h5 className="text-sm font-black text-stone-900">
                    Language Phonics Struggle Hotspots
                  </h5>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  Review the sound patterns and reading areas that may require
                  additional practice for this lesson.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center rounded-xl bg-white border border-amber-100 px-3 py-2">
                    <span className="text-[10px] font-bold text-stone-600">
                      Language
                    </span>
                    <span className="text-[10px] font-black text-amber-700">
                      {selectedSubject}
                    </span>
                  </div>

                  <div className="flex justify-between items-center rounded-xl bg-white border border-amber-100 px-3 py-2">
                    <span className="text-[10px] font-bold text-stone-600">
                      Focus
                    </span>
                    <span className="text-[10px] font-black text-stone-800">
                      {selectedLesson.type === 'Phonics'
                        ? 'Phonics Practice'
                        : 'Reading Support'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Identified Challenge Words */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-rose-600" />
                  <h5 className="text-sm font-black text-stone-900">
                    Identified Challenge Words
                  </h5>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  Words connected to this lesson that can be used for targeted
                  reading and vocabulary practice.
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedSubject === 'English' && (
                    <>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">sounds</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">words</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">read</span>
                    </>
                  )}

                  {selectedSubject === 'Hindi' && (
                    <>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">शब्द</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">पढ़ना</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">आवाज़</span>
                    </>
                  )}

                  {selectedSubject === 'Telugu' && (
                    <>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">పదాలు</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">పఠనం</span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-100 text-[9px] font-bold">శబ్దం</span>
                    </>
                  )}
                </div>
              </div>

              {/* Individual Student Literacy Profiles */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h5 className="text-sm font-black text-stone-900">
                    Individual Student Literacy Profiles
                  </h5>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  View the learners in the classroom who can be supported with
                  this particular lesson.
                </p>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-white border border-indigo-100 px-3 py-3">
                  <span className="text-[10px] font-bold text-stone-600">
                    Students in class
                  </span>
                  <span className="text-base font-black text-indigo-700">
                    {students.length}
                  </span>
                </div>
              </div>

              {/* Recommended Practice */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-emerald-600" />
                  <h5 className="text-sm font-black text-stone-900">
                    Recommended Practice
                  </h5>
                </div>

                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  Start with guided reading, repeat difficult words, then let
                  students complete the lesson independently.
                </p>

                <button
                  type="button"
                  onClick={() => soundEffects.playWordPop()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  Start Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export const FacultyPortalPage: React.FC<FacultyPortalPageProps> = ({
  students,
  readingLogs,
  stories,
  onAddStory,
  onSelectStudent,
  onOpenSyncModal,
  onNavigate,
}) => {
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showStoryGenModal, setShowStoryGenModal] = useState(false);
  const [activeOCRAnalysis, setActiveOCRAnalysis] =
    useState<TextbookAnalysis | null>(null);

  const BLANK_ANALYSIS: TextbookAnalysis = {
    subject: 'Custom Story',
    grade: 'Class 2',
    chapterNumber: '',
    chapterTitle: 'New Read-Along Story',
    primaryLanguage: 'Telugu',
    extractedText: '',
    summary: 'A freshly generated decodable story for classroom read-along practice.',
    keyVocabulary: [],
    learningObjectives: [],
    suggestedStoryThemes: [],
  };

  const handleOCRComplete = (analysis: TextbookAnalysis) => {
    setActiveOCRAnalysis(analysis);
    setShowOCRModal(false);
    setShowStoryGenModal(true);
  };

  const handleOpenStoryGenerator = () => {
    soundEffects.playWordPop();
    setActiveOCRAnalysis((prev) => prev ?? BLANK_ANALYSIS);
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
      {/* Faculty Hero */}
      <div className="bg-[#2d2d2d] text-white py-8 px-4 sm:px-6 lg:px-8 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-500 text-stone-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                Classroom & Teacher Studio
              </span>
              <span className="text-xs text-stone-400 font-semibold">
                Telugu • Hindi • English • Mathematics • Social Studies
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Story Creator & Reading Diagnostics
            </h1>

            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              Explore class-wise lessons across five subjects, review lesson-level
              reading insights, and create interactive Read-Along stories with AI.
            </p>
          </div>

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
              onClick={handleOpenStoryGenerator}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs sm:text-sm border border-stone-700 cursor-pointer"
              id="btn-faculty-create-story"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Generate AI Story</span>
            </button>
          </div>
        </div>
      </div>

      {/* No analytics / phonics hotspot / challenge-word / student-profile sections here */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ClassLessonLibrary />
      </main>

      {showOCRModal && (
        <TextbookOCRModal
          onClose={() => setShowOCRModal(false)}
          onAnalysisComplete={handleOCRComplete}
        />
      )}

      {showStoryGenModal && activeOCRAnalysis && (
        <StoryGeneratorModal
          analysis={activeOCRAnalysis}
          onClose={() => {
            setShowStoryGenModal(false);
            setActiveOCRAnalysis(null);
          }}
          onStorySaved={handleSaveGeneratedStory}
        />
      )}
    </div>
  );
};