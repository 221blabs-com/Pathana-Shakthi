import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Layers,
  Mail,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

import { FacultyMember, ClassSection, SchoolInfo, GradeLevel } from '../../types';
import { offlineStorage } from '../../services/offlineStorage';
import { soundEffects } from '../../services/soundEffects';

import ClickSpark from '../home/ClickSpark';
import ShapeGrid from '../home/ShapeGrid';
import TiltedCard from '../TiltedCard';

interface SchoolAdminPageProps {
  onNavigate: (route: string) => void;
}

type AdminTab = 'overview' | 'classes' | 'faculty' | 'benchmarks';

const TABS: Array<{
  id: AdminTab;
  label: string;
  mobile: string;
  icon: React.ElementType;
}> = [
  { id: 'overview', label: 'School Overview & Stats', mobile: 'Overview', icon: TrendingUp },
  { id: 'classes', label: 'Classrooms & Grades (1–5)', mobile: 'Classrooms', icon: Layers },
  { id: 'faculty', label: 'Faculty & Teachers Roster', mobile: 'Faculty', icon: GraduationCap },
  { id: 'benchmarks', label: 'Reading Fluency Milestones', mobile: 'Milestones', icon: Award },
];

const BENCHMARKS = [
  {
    className: 'Class 1',
    title: 'Letter & Word Recognition',
    target:
      'Recognize primary alphabet letters and read 4–5 simple 2-letter words per minute with 80%+ accuracy.',
    color: 'from-[#ffb84d] to-[#ff704f]',
    icon: BookOpen,
  },
  {
    className: 'Class 2',
    title: 'Read-Along & Short Sentences',
    target:
      'Read storybooks with synchronized voice guidance at 30–45 words per minute.',
    color: 'from-[#8b7cf6] to-[#5e7bff]',
    icon: Activity,
  },
  {
    className: 'Class 3',
    title: 'Fluency & Comprehension Mastery',
    target:
      'Read multi-paragraph stories at 60+ words per minute with 90%+ pronunciation accuracy and quiz comprehension.',
    color: 'from-[#39b88d] to-[#38a9c8]',
    icon: Target,
  },
];

const Panel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <section
    className={`rounded-[30px] border border-black/[0.07] bg-white shadow-[0_20px_70px_rgba(30,25,20,0.05)] ${className}`}
  >
    {children}
  </section>
);

const SectionIntro: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
}> = ({ eyebrow, title, description, icon, right }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#ff704f]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.17em] text-[#d94f35]">
        {icon}
        {eyebrow}
      </div>
      <h2 className="text-xl font-black tracking-[-0.04em] text-[#17191f] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-xs leading-6 text-black/45 sm:text-sm">
        {description}
      </p>
    </div>
    {right}
  </div>
);

const ProgressBar: React.FC<{ value: number; gradient?: string }> = ({
  value,
  gradient = 'from-[#ffb84d] to-[#ff704f]',
}) => (
  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
    <motion.div
      initial={{ width: 0 }}
      whileInView={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
    />
  </div>
);

const MetricCard: React.FC<{
  eyebrow: string;
  value: React.ReactNode;
  support: React.ReactNode;
  icon: React.ReactNode;
  glow: string;
  index: number;
}> = ({ eyebrow, value, support, icon, glow, index }) => {
  const reducedMotion = useReducedMotion();

  return (
    <TiltedCard
      rotateAmplitude={index % 2 === 0 ? 3 : 3.5}
      scaleOnHover={1.02}
      className="h-full rounded-[26px]"
    >
      <motion.article
        initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: index * 0.06, ease: 'easeOut' }}
        className="group relative h-full min-h-[182px] overflow-hidden rounded-[26px] border border-black/[0.07] bg-white p-5 shadow-[0_16px_45px_rgba(30,25,20,0.05)]"
      >
        <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl opacity-60 transition-transform duration-500 group-hover:scale-125 ${glow}`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-black/[0.07] to-transparent" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">
              {eyebrow}
            </span>
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/[0.05] bg-[#f8f6f1] shadow-sm transition-transform duration-300 group-hover:scale-105">
              {icon}
            </div>
          </div>

          <div className="mt-auto pt-8">
            <div className="text-[38px] font-black leading-none tracking-[-0.055em] text-[#17191f]">
              {value}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold leading-5 text-black/42">
              {support}
            </div>
          </div>
        </div>
      </motion.article>
    </TiltedCard>
  );
};

const TeacherCard: React.FC<{
  faculty: FacultyMember;
  index: number;
}> = ({ faculty, index }) => {
  const reducedMotion = useReducedMotion();

  return (
    <TiltedCard
      rotateAmplitude={2.5}
      scaleOnHover={1.018}
      className="h-full rounded-[24px]"
    >
      <motion.article
        initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.04 }}
        className="h-full rounded-[24px] border border-black/[0.07] bg-[#faf9f6] p-5 shadow-[0_14px_40px_rgba(30,25,20,0.04)]"
      >
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-white text-2xl shadow-sm">
            {faculty.avatar}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-[#17191f]">{faculty.name}</h3>
                <p className="mt-1 text-[10px] font-black text-[#d94f35]">{faculty.designation}</p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#39b88d]/10 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#188a68]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39b88d]" />
                {faculty.status}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-[10px] font-semibold text-black/45 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-black/30" />
                <span className="truncate">{faculty.email}</span>
              </div>
              <div className="rounded-xl bg-white px-3 py-2.5">
                <span className="font-black text-black/65">Grades:</span>{' '}
                {faculty.assignedGrades.join(', ')}
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </TiltedCard>
  );
};

export const SchoolAdminPage: React.FC<SchoolAdminPageProps> = ({ onNavigate }) => {
  const reducedMotion = useReducedMotion();

  const [schools] = useState<SchoolInfo[]>(offlineStorage.getSchools());
  const [classes] = useState<ClassSection[]>(offlineStorage.getClasses());
  const [faculty, setFaculty] = useState<FacultyMember[]>(offlineStorage.getFaculty());
  const [activeSubTab, setActiveSubTab] = useState<AdminTab>('overview');

  const selectedSchool = schools[0];

  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [newFacName, setNewFacName] = useState('');
  const [newFacEmail, setNewFacEmail] = useState('');
  const [newFacDesignation, setNewFacDesignation] = useState('Primary Literacy Teacher');
  const [newFacGrade, setNewFacGrade] = useState<GradeLevel>('Class 2');
  const [facultySearch, setFacultySearch] = useState('');

  const totalStudents = classes.reduce((sum, cls) => sum + cls.totalStudents, 0);
  const avgSchoolAccuracy = Math.round(
    classes.reduce((sum, cls) => sum + cls.averageAccuracy, 0) / (classes.length || 1),
  );
  const avgSchoolWpm = Math.round(
    classes.reduce((sum, cls) => sum + cls.averageWpm, 0) / (classes.length || 1),
  );

  const strongestClass = useMemo(
    () => [...classes].sort((a, b) => b.averageAccuracy - a.averageAccuracy)[0],
    [classes],
  );

  const needsAttentionClass = useMemo(
    () => [...classes].sort((a, b) => a.averageAccuracy - b.averageAccuracy)[0],
    [classes],
  );

  const filteredFaculty = useMemo(() => {
    const query = facultySearch.trim().toLowerCase();
    if (!query) return faculty;

    return faculty.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.designation.toLowerCase().includes(query) ||
        member.assignedGrades.some((grade) => grade.toLowerCase().includes(query)),
    );
  }, [faculty, facultySearch]);

  const handleAddFaculty = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newFacName.trim() || !selectedSchool) return;

    soundEffects.playStarChime();

    const newMember: FacultyMember = {
      id: `fac_${Date.now()}`,
      name: newFacName.trim(),
      email:
        newFacEmail.trim() ||
        `${newFacName.toLowerCase().replace(/\s+/g, '.')}@school.gov.in`,
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
    setNewFacDesignation('Primary Literacy Teacher');
    setNewFacGrade('Class 2');
  };

  if (!selectedSchool) {
    return (
      <ClickSpark>
        <div className="min-h-screen bg-[#f5f2ea] p-6 font-sans text-[#17191f]">
          <div className="mx-auto max-w-xl rounded-[30px] border border-black/[0.08] bg-white p-8 text-center shadow-xl">
            <SchoolIconFallback />
            <h1 className="mt-4 text-2xl font-black">No school record found</h1>
            <p className="mt-2 text-sm leading-6 text-black/50">
              The admin workspace needs a school record before school-level data can be displayed.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#17191f] px-5 py-3 text-sm font-black text-white"
            >
              Back to Pathana Shakthi
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ClickSpark>
    );
  }

  return (
    <ClickSpark>
      <div className="relative min-h-screen overflow-hidden bg-[#f5f2ea] font-sans text-[#17191f]">
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          <ShapeGrid
            direction="diagonal"
            speed={0.16}
            borderColor="rgba(124, 58, 237, 0.08)"
            squareSize={58}
            hoverFillColor="rgba(255, 112, 79, 0.12)"
            shape="square"
            hoverTrailAmount={0}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(57,184,141,0.08),transparent_25%),radial-gradient(circle_at_92%_10%,rgba(255,184,77,0.10),transparent_24%),radial-gradient(circle_at_60%_90%,rgba(139,124,246,0.07),transparent_30%)]" />
        </div>

        <div className="relative z-10">
          <header className="relative overflow-hidden bg-[#17191f] text-white shadow-[0_18px_60px_rgba(23,25,31,0.15)]">
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#ff704f]/10 blur-[95px]" />
            <div className="pointer-events-none absolute bottom-[-160px] left-[35%] h-80 w-80 rounded-full bg-[#8b7cf6]/10 blur-[100px]" />

            <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffb84d] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#17191f]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Headmaster & Admin Portal
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[9px] font-black tracking-[0.12em] text-white/45">
                      {selectedSchool.code}
                    </span>
                  </div>

                  <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                    {selectedSchool.name}
                  </h1>
                  <p className="mt-2 text-xs font-semibold text-white/40 sm:text-sm">
                    {selectedSchool.district} District, {selectedSchool.state}{' '}
                    <span className="mx-2 text-white/20">•</span>
                    Board: {selectedSchool.board}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => onNavigate('landing')}
                    className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-black text-white/65 transition hover:bg-white/[0.09] hover:text-white sm:inline-flex"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Exit portal
                  </button>

                  <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-right shadow-xl backdrop-blur-xl">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-white/35">
                      Headmaster
                    </span>
                    <span className="mt-1 block text-xs font-black text-[#ffb84d]">
                      {selectedSchool.headmasterName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <nav className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f5f2ea]/92 backdrop-blur-xl">
            <div className="mx-auto max-w-[1500px] overflow-x-auto px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-max items-center gap-1.5 py-2.5">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeSubTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        soundEffects.playWordPop();
                        setActiveSubTab(tab.id);
                      }}
                      className={`relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[10px] font-black transition-all ${
                        active
                          ? 'bg-[#17191f] text-white shadow-[0_8px_25px_rgba(23,25,31,0.15)]'
                          : 'text-black/45 hover:bg-white hover:text-black/75'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.mobile}</span>
                      {active && (
                        <motion.span
                          layoutId="admin-active-tab"
                          className="absolute -bottom-[6px] left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-[#ffb84d]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <AnimatePresence mode="wait">
              {activeSubTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32 }}
                  className="space-y-6"
                >
                  <section className="relative overflow-hidden rounded-[32px] bg-[#17191f] p-6 text-white shadow-[0_28px_85px_rgba(23,25,31,0.16)] sm:p-8">
                    <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#39b88d]/12 blur-[100px]" />
                    <div className="pointer-events-none absolute bottom-[-130px] left-[35%] h-80 w-80 rounded-full bg-[#8b7cf6]/12 blur-[105px]" />

                    <div className="relative z-10 grid gap-7 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
                      <div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.17em] text-[#ffb84d]">
                          <Sparkles className="h-3.5 w-3.5" />
                          School performance, at a glance
                        </span>
                        <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.055em] sm:text-4xl">
                          Keep every classroom moving forward.
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/42">
                          See the school-wide reading pulse, compare grades, and keep teacher coverage visible from one place.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                          <div className="flex items-center justify-between gap-3 text-white/35">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em]">Strongest grade</span>
                            <TrendingUp className="h-4 w-4 text-[#39b88d]" />
                          </div>
                          <p className="mt-3 text-lg font-black">{strongestClass?.grade ?? '—'}</p>
                          <p className="mt-1 text-[10px] font-semibold text-white/35">{strongestClass?.averageAccuracy ?? 0}% accuracy</p>
                        </div>

                        <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                          <div className="flex items-center justify-between gap-3 text-white/35">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em]">Watch next</span>
                            <Target className="h-4 w-4 text-[#ffb84d]" />
                          </div>
                          <p className="mt-3 text-lg font-black">{needsAttentionClass?.grade ?? '—'}</p>
                          <p className="mt-1 text-[10px] font-semibold text-white/35">Lowest current accuracy</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      index={0}
                      eyebrow="Total primary students"
                      value={totalStudents}
                      support={
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#39b88d]" />
                          100% enrollment verified
                        </>
                      }
                      icon={<Users className="h-5 w-5 text-[#39b88d]" />}
                      glow="bg-[#39b88d]/18"
                    />
                    <MetricCard
                      index={1}
                      eyebrow="Average reading accuracy"
                      value={`${avgSchoolAccuracy}%`}
                      support="Across Telugu, Hindi & English"
                      icon={<Target className="h-5 w-5 text-[#ff704f]" />}
                      glow="bg-[#ff704f]/18"
                    />
                    <MetricCard
                      index={2}
                      eyebrow="Average reading speed"
                      value={
                        <>
                          {avgSchoolWpm}
                          <span className="ml-1 text-sm tracking-normal text-black/35">WPM</span>
                        </>
                      }
                      support="Target: 45–60 WPM (Classes 2–3)"
                      icon={<Activity className="h-5 w-5 text-[#8b7cf6]" />}
                      glow="bg-[#8b7cf6]/18"
                    />
                    <MetricCard
                      index={3}
                      eyebrow="Active faculty"
                      value={faculty.length}
                      support="5 primary classrooms"
                      icon={<GraduationCap className="h-5 w-5 text-[#ffb84d]" />}
                      glow="bg-[#ffb84d]/18"
                    />
                  </div>

                  <Panel className="p-5 sm:p-7">
                    <SectionIntro
                      eyebrow="Classroom pulse"
                      title="Reading fluency & accuracy by grade"
                      description="A quick view of where every classroom is sitting right now."
                      icon={<Layers className="h-3.5 w-3.5" />}
                      right={
                        <span className="hidden rounded-full bg-[#f8f6f1] px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-black/38 md:block">
                          {classes.length} primary classrooms
                        </span>
                      }
                    />

                    <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                      {classes.map((cls, index) => (
                        <TiltedCard
                          key={cls.id}
                          rotateAmplitude={2.5}
                          scaleOnHover={1.015}
                          className="h-full rounded-[22px]"
                        >
                          <motion.article
                            initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
                            whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.25 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            className="h-full rounded-[22px] border border-black/[0.06] bg-[#faf9f6] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black">{cls.grade}</span>
                              <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-black/40 shadow-sm">
                                {cls.totalStudents} kids
                              </span>
                            </div>

                            <div className="mt-5">
                              <div className="flex items-center justify-between text-[10px] font-bold text-black/40">
                                <span>Accuracy</span>
                                <span className="font-black text-[#17191f]">{cls.averageAccuracy}%</span>
                              </div>
                              <div className="mt-2">
                                <ProgressBar
                                  value={cls.averageAccuracy}
                                  gradient={index % 2 === 0 ? 'from-[#ffb84d] to-[#ff704f]' : 'from-[#8b7cf6] to-[#5e7bff]'}
                                />
                              </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
                              <span className="text-[9px] font-semibold text-black/35">Teacher</span>
                              <span className="truncate text-[10px] font-black text-black/70">
                                {cls.classTeacherName.split(' ')[1] || cls.classTeacherName}
                              </span>
                            </div>
                          </motion.article>
                        </TiltedCard>
                      ))}
                    </div>
                  </Panel>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_.85fr]">
                    <Panel className="p-6">
                      <SectionIntro
                        eyebrow="Priority signal"
                        title="Where attention can help most"
                        description="Use the lower-performing classroom as the next coaching checkpoint."
                        icon={<Target className="h-3.5 w-3.5" />}
                      />

                      <div className="mt-6 rounded-[24px] bg-[#fff7ef] p-5">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#d94f35] shadow-sm">
                              Needs attention
                            </span>
                            <h3 className="mt-4 text-2xl font-black tracking-[-0.04em]">
                              {needsAttentionClass?.grade ?? 'No classroom'}
                            </h3>
                            <p className="mt-1.5 text-xs font-semibold text-black/45">
                              {needsAttentionClass
                                ? `${needsAttentionClass.averageAccuracy}% current accuracy • ${needsAttentionClass.averageWpm} WPM`
                                : 'No classroom data available.'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              soundEffects.playWordPop();
                              setActiveSubTab('classes');
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17191f] px-4 py-3 text-[10px] font-black text-white transition hover:-translate-y-0.5"
                          >
                            View classroom
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </Panel>

                    <section className="relative overflow-hidden rounded-[30px] bg-[#17191f] p-6 text-white shadow-[0_25px_75px_rgba(23,25,31,0.12)]">
                      <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#8b7cf6]/12 blur-[90px]" />
                      <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#ffb84d]">
                          <CalendarDays className="h-3.5 w-3.5" />
                          School snapshot
                        </div>
                        <h3 className="mt-4 text-2xl font-black tracking-[-0.04em]">
                          Keep the reading rhythm visible.
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-white/38">
                          One compact snapshot for languages, faculty coverage, and classroom operations.
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">Languages</span>
                            <p className="mt-2 text-lg font-black">3</p>
                            <p className="mt-1 text-[9px] font-semibold text-white/35">Telugu • Hindi • English</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">Faculty coverage</span>
                            <p className="mt-2 text-lg font-black">{faculty.length}/5</p>
                            <p className="mt-1 text-[9px] font-semibold text-white/35">Active staff / classrooms</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </motion.div>
              )}

              {activeSubTab === 'classes' && (
                <motion.div
                  key="classes"
                  initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32 }}
                >
                  <Panel className="p-6 sm:p-7">
                    <SectionIntro
                      eyebrow="Classroom management"
                      title="Primary classroom sections"
                      description="See room assignments, class size, homeroom coverage, language focus, and current accuracy."
                      icon={<Layers className="h-3.5 w-3.5" />}
                      right={
                        <span className="rounded-full bg-[#17191f] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                          {classes.length} rooms
                        </span>
                      }
                    />

                    <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {classes.map((cls, index) => (
                        <TiltedCard
                          key={cls.id}
                          rotateAmplitude={3}
                          scaleOnHover={1.018}
                          className="h-full rounded-[25px]"
                        >
                          <motion.article
                            initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            className="h-full overflow-hidden rounded-[25px] border border-black/[0.07] bg-[#faf9f6]"
                          >
                            <div className="h-1.5 bg-gradient-to-r from-[#ffb84d] via-[#ff704f] to-[#8b7cf6]" />
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-black/32">Section</p>
                                  <h3 className="mt-1 text-lg font-black tracking-[-0.03em]">
                                    {cls.grade} — {cls.section}
                                  </h3>
                                  <p className="mt-1 text-[10px] font-semibold text-black/40">Room {cls.roomNumber}</p>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                                  <span className="block text-sm font-black">{cls.totalStudents}</span>
                                  <span className="text-[8px] font-black uppercase tracking-[0.12em] text-black/35">students</span>
                                </div>
                              </div>

                              <div className="mt-6 space-y-3">
                                <div className="rounded-2xl bg-white p-4">
                                  <span className="text-[9px] font-black uppercase tracking-[0.13em] text-black/30">Homeroom teacher</span>
                                  <p className="mt-1.5 text-xs font-black">{cls.classTeacherName}</p>
                                </div>
                                <div className="rounded-2xl bg-white p-4">
                                  <span className="text-[9px] font-black uppercase tracking-[0.13em] text-black/30">Language focus</span>
                                  <p className="mt-1.5 text-xs font-bold text-black/55">{cls.languageFocus.join(' • ')}</p>
                                </div>
                              </div>

                              <div className="mt-5">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.13em] text-black/30">
                                  <span>Accuracy</span>
                                  <span>{cls.averageAccuracy}%</span>
                                </div>
                                <div className="mt-2">
                                  <ProgressBar value={cls.averageAccuracy} gradient="from-[#ff704f] to-[#ffb84d]" />
                                </div>
                              </div>
                            </div>
                          </motion.article>
                        </TiltedCard>
                      ))}
                    </div>
                  </Panel>
                </motion.div>
              )}

              {activeSubTab === 'faculty' && (
                <motion.div
                  key="faculty"
                  initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32 }}
                >
                  <Panel className="p-6 sm:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                      <SectionIntro
                        eyebrow="People & coverage"
                        title="Faculty & literacy educators"
                        description="Manage teacher assignments while keeping the primary classroom roster easy to scan."
                        icon={<GraduationCap className="h-3.5 w-3.5" />}
                      />

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="relative">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
                          <input
                            value={facultySearch}
                            onChange={(event) => setFacultySearch(event.target.value)}
                            placeholder="Search teachers..."
                            className="h-11 w-full rounded-2xl border border-black/[0.08] bg-[#faf9f6] pl-9 pr-4 text-xs font-bold outline-none transition focus:border-[#8b7cf6] focus:ring-4 focus:ring-[#8b7cf6]/10 sm:w-56"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playWordPop();
                            setShowAddFacultyModal(true);
                          }}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#17191f] px-4 text-[10px] font-black text-white shadow-lg transition hover:-translate-y-0.5"
                        >
                          <PlusCircle className="h-4 w-4 text-[#ffb84d]" />
                          Onboard teacher
                        </button>
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] bg-[#f8f6f1] p-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Active faculty</span>
                        <p className="mt-2 text-2xl font-black">{faculty.length}</p>
                      </div>
                      <div className="rounded-[22px] bg-[#f8f6f1] p-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Primary grades</span>
                        <p className="mt-2 text-2xl font-black">1–5</p>
                      </div>
                      <div className="rounded-[22px] bg-[#f8f6f1] p-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Visible roster</span>
                        <p className="mt-2 text-2xl font-black">{filteredFaculty.length}</p>
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {filteredFaculty.map((member, index) => (
                        <TeacherCard key={member.id} faculty={member} index={index} />
                      ))}
                    </div>

                    {filteredFaculty.length === 0 && (
                      <div className="mt-7 rounded-[24px] border border-dashed border-black/10 bg-[#faf9f6] p-10 text-center">
                        <Search className="mx-auto h-8 w-8 text-black/18" />
                        <p className="mt-3 text-sm font-black">No teachers matched your search.</p>
                        <button
                          type="button"
                          onClick={() => setFacultySearch('')}
                          className="mt-3 text-[10px] font-black text-[#d94f35]"
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                  </Panel>
                </motion.div>
              )}

              {activeSubTab === 'benchmarks' && (
                <motion.div
                  key="benchmarks"
                  initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32 }}
                  className="space-y-6"
                >
                  <Panel className="p-6 sm:p-7">
                    <SectionIntro
                      eyebrow="Reading framework"
                      title="Primary reading fluency milestones"
                      description="Keep the school’s current grade-level expectations clear and easy to reference."
                      icon={<Award className="h-3.5 w-3.5" />}
                    />

                    <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {BENCHMARKS.map((benchmark, index) => {
                        const Icon = benchmark.icon;

                        return (
                          <TiltedCard
                            key={benchmark.className}
                            rotateAmplitude={3}
                            scaleOnHover={1.018}
                            className="h-full rounded-[26px]"
                          >
                            <motion.article
                              initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
                              animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                              transition={{ duration: 0.42, delay: index * 0.05 }}
                              className="h-full overflow-hidden rounded-[26px] border border-black/[0.07] bg-[#faf9f6] shadow-[0_14px_40px_rgba(30,25,20,0.04)]"
                            >
                              <div className={`h-1.5 bg-gradient-to-r ${benchmark.color}`} />
                              <div className="p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/45 shadow-sm">
                                    {benchmark.className}
                                  </span>
                                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-black/60 shadow-sm">
                                    <Icon className="h-5 w-5" />
                                  </div>
                                </div>

                                <h3 className="mt-5 text-lg font-black tracking-[-0.03em]">{benchmark.title}</h3>
                                <p className="mt-3 text-xs leading-6 text-black/45">{benchmark.target}</p>

                                <div className="mt-6 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-black/30">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-[#39b88d]" />
                                  Reading target reference
                                </div>
                              </div>
                            </motion.article>
                          </TiltedCard>
                        );
                      })}
                    </div>
                  </Panel>

                  <section className="relative overflow-hidden rounded-[30px] bg-[#17191f] p-6 text-white shadow-[0_25px_75px_rgba(23,25,31,0.12)] sm:p-7">
                    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#39b88d]/10 blur-[90px]" />
                    <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[0.17em] text-[#ffb84d]">Admin note</span>
                        <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">Keep targets visible, not buried.</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                          Use these milestones as a quick reference during classroom reviews and coaching conversations.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playWordPop();
                          setActiveSubTab('overview');
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black text-[#17191f] transition hover:-translate-y-0.5"
                      >
                        Back to overview
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        <AnimatePresence>
          {showAddFacultyModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/70 p-4 backdrop-blur-md"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowAddFacultyModal(false);
                }
              }}
            >
              <motion.div
                initial={reducedMotion ? undefined : { opacity: 0, y: 18, scale: 0.96 }}
                animate={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="w-full max-w-lg overflow-hidden rounded-[30px] border border-black/[0.08] bg-white shadow-[0_35px_110px_rgba(0,0,0,0.25)]"
              >
                <div className="relative bg-[#17191f] px-6 py-5 text-white">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#ff704f]/12 blur-3xl" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#ffb84d]">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Faculty onboarding
                      </div>
                      <h3 className="mt-3 text-xl font-black">Add a literacy teacher</h3>
                      <p className="mt-1 text-xs text-white/40">Add the teacher to this school’s faculty roster.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddFacultyModal(false)}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08] text-white/55 transition hover:bg-white/[0.14] hover:text-white"
                      aria-label="Close faculty onboarding dialog"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddFaculty} className="space-y-4 p-6">
                  <AdminField
                    label="Teacher full name"
                    value={newFacName}
                    onChange={setNewFacName}
                    placeholder="e.g. Smt. K. Ratna Kumari"
                    required
                  />

                  <AdminField
                    label="Email / Employee ID"
                    value={newFacEmail}
                    onChange={setNewFacEmail}
                    placeholder="e.g. ratna.kumari@school.gov.in"
                    type="email"
                  />

                  <AdminField
                    label="Designation"
                    value={newFacDesignation}
                    onChange={setNewFacDesignation}
                  />

                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-black/45">
                      Primary assigned grade
                    </label>
                    <select
                      value={newFacGrade}
                      onChange={(event) => setNewFacGrade(event.target.value as GradeLevel)}
                      className="w-full rounded-2xl border border-black/[0.08] bg-[#faf9f6] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#8b7cf6] focus:ring-4 focus:ring-[#8b7cf6]/10"
                    >
                      <option value="Class 1">Class 1</option>
                      <option value="Class 2">Class 2</option>
                      <option value="Class 3">Class 3</option>
                      <option value="Class 4">Class 4</option>
                      <option value="Class 5">Class 5</option>
                    </select>
                  </div>

                  <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setShowAddFacultyModal(false)}
                      className="flex-1 rounded-2xl bg-[#f1efea] px-4 py-3 text-xs font-black text-[#17191f] transition hover:bg-[#e7e3dc]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-2xl bg-[#17191f] px-4 py-3 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5"
                    >
                      Add teacher
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ClickSpark>
  );
};

const AdminField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required = false }) => (
  <div>
    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-black/45">
      {label}
    </label>
    <input
      type={type}
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-black/[0.08] bg-[#faf9f6] px-4 py-3 text-sm font-bold outline-none transition placeholder:text-black/25 focus:border-[#8b7cf6] focus:ring-4 focus:ring-[#8b7cf6]/10"
    />
  </div>
);

const SchoolIconFallback: React.FC = () => (
  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ff704f]/10 text-[#ff704f]">
    <GraduationCap className="h-7 w-7" />
  </div>
);

export default SchoolAdminPage;
