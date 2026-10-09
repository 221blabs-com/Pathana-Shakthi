import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownUp, Download, Loader2, RefreshCw, X } from 'lucide-react';
import { backendApi, ClassOverview, ClassStudentDetail, ClassStudentRow } from '../../services/backendApi';
import { labChapterById } from '../../data/learnPlay';
import { BarList, ColumnChart, PercentLineChart } from './charts';
import { ClassPlanCard } from './ClassPlanCard';
import { downloadCsv } from '../../services/csv';
import { ALL_GRADES } from '../../data/grades';
import { LEVEL_INFO, READING_LEVELS, ReadingLevel } from '../../data/readingLevels';

const GRADES: string[] = ALL_GRADES;

const shortDay = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const lastActive = (day: string) => {
  if (!day) return 'Never';
  const diff = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(day)) / 86_400_000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${diff} days ago`;
};

type SortKey = 'rollNumber' | 'name' | 'sessionsCount' | 'overallAccuracy' | 'averageWPM' | 'totalMinutesRead' | 'stars' | 'lastActiveDate';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="card-3d rounded-2xl border border-stone-200 bg-white px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-stone-900">{value}</p>
    {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
  </div>
);

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <div className={`rounded-2xl border border-stone-200 bg-white p-4 ${className}`}>
    <h3 className="text-sm font-black text-stone-900">{title}</h3>
    {subtitle && <p className="text-[11px] text-stone-500">{subtitle}</p>}
    <div className="mt-3">{children}</div>
  </div>
);

// Teacher's view of one class: every student's real progress (readings,
// Learn & Play games, word practice) with class-level trends and plain
// notes from Shakthi Mitra about who needs help.
export const ClassDashboard: React.FC<{ selectedClass: string; onSelectClass: (grade: string) => void }> = ({
  selectedClass,
  onSelectClass,
}) => {
  const [data, setData] = useState<ClassOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'rollNumber', desc: false });
  const [openStudent, setOpenStudent] = useState<ClassStudentRow | null>(null);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await backendApi.classDashboard.overview(selectedClass));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the class dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => {
    const rows = [...(data?.students || [])];
    const { key, desc } = sort;
    rows.sort((a, b) => {
      const av = key === 'rollNumber' ? Number(a.rollNumber) : (a as any)[key];
      const bv = key === 'rollNumber' ? Number(b.rollNumber) : (b as any)[key];
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv)) : (Number(av) || 0) - (Number(bv) || 0);
      return desc ? -cmp : cmp;
    });
    return rows;
  }, [data, sort]);

  const sortBy = (key: SortKey) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'rollNumber' && key !== 'name' }));
  const th = (key: SortKey, label: string, align = 'text-right') => (
    <th className={`px-3 py-2.5 ${align}`}>
      <button type="button" onClick={() => sortBy(key)} className="inline-flex items-center gap-1 font-black uppercase hover:text-stone-800">
        {label}
        <ArrowDownUp className={`h-3 w-3 ${sort.key === key ? 'text-sky-600' : 'text-stone-300'}`} />
      </button>
    </th>
  );

  const t = data?.totals;
  return (
    <section id="class-dashboard" aria-labelledby="class-dashboard-heading" className="mb-8 overflow-hidden rounded-3xl border border-sky-200 bg-sky-50/40 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-sky-100 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="class-dashboard-heading" className="text-lg font-black text-stone-900">
            Class dashboard
          </h2>
          <p className="text-xs text-stone-600">Every student's reading, games and word practice — updated as they learn.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Class" className="flex flex-wrap gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={g === selectedClass}
                onClick={() => onSelectClass(g)}
                className={`class-dashboard-tab rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
                  g === selectedClass ? 'bg-sky-600 text-white shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-sky-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</p>}
        {loading && !data && (
          <p className="flex items-center gap-2 text-xs font-bold text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading {selectedClass}…
          </p>
        )}

        {data && t && (
          <>
            {/* Shakthi Mitra's notes */}
            <div id="class-insights" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <img src="/shakthi-face-256.png" alt="Shakthi Mitra" className="h-14 w-14 shrink-0 rounded-full bg-white object-contain p-0.5 shadow" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-800">Shakthi Mitra's notes for {data.grade}</p>
                {data.insights.map((note) => (
                  <p key={note.text} className="text-sm font-semibold text-stone-800">
                    {note.tone === 'cheer' ? '🌟 ' : note.tone === 'think' ? '💡 ' : '📘 '}
                    {note.text}
                  </p>
                ))}
              </div>
            </div>

            <ClassPlanCard grade={data.grade} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Students" value={t.students} hint={`${t.activeThisWeek} active this week`} />
              <Stat label="Readings" value={t.sessions} hint={`${t.minutes} minutes read`} />
              <Stat label="Avg accuracy" value={t.averageAccuracy === null ? '—' : `${t.averageAccuracy}%`} hint="students who have read" />
              <Stat label="Avg speed" value={t.averageWPM === null ? '—' : t.averageWPM} hint="words per minute" />
              <Stat label="Games won" value={t.gamesCompleted} hint="Learn & Play chapters" />
              <Stat label="Words practised" value={t.wordsPracticed} hint={`⭐ ${t.stars} stars in class`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Readings per day" subtitle="Last 14 days">
                <ColumnChart
                  ariaLabel={`Readings per day in ${data.grade}, last 14 days`}
                  data={data.daily.map((d) => ({
                    label: shortDay(d.day),
                    value: d.sessions,
                    tip: [shortDay(d.day), `${d.sessions} reading${d.sessions === 1 ? '' : 's'}`, `${d.readers} student${d.readers === 1 ? '' : 's'}`],
                  }))}
                />
              </Panel>
              <Panel title="Average reading accuracy" subtitle="Last 14 days · days with no reading are left blank">
                <PercentLineChart
                  ariaLabel={`Average reading accuracy per day in ${data.grade}`}
                  data={data.daily.map((d) => ({
                    label: shortDay(d.day),
                    value: d.accuracy,
                    tip: [shortDay(d.day), d.accuracy === null ? 'No readings' : `${d.accuracy}% accuracy`],
                  }))}
                />
              </Panel>
            </div>
            <button type="button" onClick={() => setShowTable((v) => !v)} className="text-[11px] font-bold text-sky-700 underline">
              {showTable ? 'Hide' : 'Show'} these numbers as a table
            </button>
            {showTable && (
              <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="bg-stone-50 text-[10px] font-black uppercase text-stone-500">
                    <tr>
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2 text-right">Readings</th>
                      <th className="px-3 py-2 text-right">Students</th>
                      <th className="px-3 py-2 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.daily.map((d) => (
                      <tr key={d.day}>
                        <td className="px-3 py-1.5">{shortDay(d.day)}</td>
                        <td className="px-3 py-1.5 text-right">{d.sessions}</td>
                        <td className="px-3 py-1.5 text-right">{d.readers}</td>
                        <td className="px-3 py-1.5 text-right">{d.accuracy === null ? '—' : `${d.accuracy}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Reading level" subtitle="Students by overall accuracy">
                <BarList rows={data.bands.map((b) => ({ label: b.band, value: b.students }))} empty="Nobody has read yet." />
              </Panel>
              <Panel title="Subjects read" subtitle="Readings (and average accuracy)">
                <BarList
                  rows={data.subjects.slice(0, 6).map((s) => ({ label: s.subject, value: s.sessions, note: `${s.accuracy}%` }))}
                  empty="No readings yet."
                />
              </Panel>
              <Panel title="Words the class finds hard" subtitle="Missed most often while reading">
                {data.struggledWords.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.struggledWords.map((w) => (
                      <span key={w.word} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800" title={`Missed ${w.count} times`}>
                        {w.word} <span className="text-rose-500">×{w.count}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-stone-500">No hard words recorded yet.</p>
                )}
              </Panel>
            </div>

            {students.length > 0 && (
              <div id="class-level-groups" className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-stone-900">Reading-level groups</h3>
                    <p className="text-[11px] text-stone-500">
                      Set automatically from each child's reading (accuracy and speed against the class ORF goal). Tap a child to move them to another group.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {READING_LEVELS.map((level) => {
                    const group = students.filter((s) => (s.readingLevel || 'developing') === level);
                    return (
                      <div key={level} className={`level-group level-${level} rounded-xl border p-3 ${LEVEL_STYLE[level]}`}>
                        <p className="text-sm font-black text-stone-900">
                          {LEVEL_INFO[level].icon} {LEVEL_INFO[level].name} <span className="text-stone-500">· {group.length}</span>
                        </p>
                        <p className="mb-2 text-[11px] leading-snug text-stone-600">{LEVEL_INFO[level].forTeacher}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setOpenStudent(s)}
                              className="level-chip rounded-full border border-white/80 bg-white px-2 py-0.5 text-[11px] font-bold text-stone-800 shadow-xs hover:border-sky-300"
                              title={s.readingLevelSet ? 'Set by teacher' : 'Automatic'}
                            >
                              {s.avatar} {s.name.split(' ')[0]}
                              {s.readingLevelSet ? ' ✎' : ''}
                            </button>
                          ))}
                          {group.length === 0 && <span className="text-[11px] text-stone-400">Nobody</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h3 className="text-sm font-black text-stone-900">Students in {data.grade}</h3>
                <div className="flex items-center gap-3">
                  <span className="hidden text-[11px] text-stone-500 sm:inline">Tap a student for details</span>
                  <button
                    type="button"
                    id="btn-class-csv"
                    onClick={() =>
                      downloadCsv(`${data.grade.replace(/\s+/g, '-')}-progress-${new Date().toISOString().slice(0, 10)}.csv`, [
                        ['Roll', 'Name', 'Reading level', 'Readings', 'Accuracy %', 'Words per minute', 'Minutes read', 'Games won', 'Words practised', 'Stars', 'Last active', 'Hard words'],
                        ...students.map((s) => [
                          s.rollNumber,
                          s.name,
                          LEVEL_INFO[s.readingLevel || 'developing'].name,
                          s.sessionsCount,
                          s.sessionsCount ? s.overallAccuracy : '',
                          s.sessionsCount ? s.averageWPM : '',
                          Math.round(s.totalMinutesRead),
                          s.gamesCompleted,
                          s.wordsPracticed,
                          s.stars,
                          s.lastActiveDate || 'Never',
                          s.struggledWords.map((w) => w.word).join(' '),
                        ]),
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-sky-300"
                  >
                    <Download className="h-3.5 w-3.5" /> Download (Excel)
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table id="class-student-table" className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-stone-50 text-[10px] text-stone-500">
                    <tr>
                      {th('rollNumber', 'Roll', 'text-left')}
                      {th('name', 'Student', 'text-left')}
                      <th className="px-3 py-2.5 text-left font-black uppercase">Level</th>
                      {th('sessionsCount', 'Readings')}
                      {th('overallAccuracy', 'Accuracy')}
                      {th('averageWPM', 'Speed')}
                      {th('totalMinutesRead', 'Minutes')}
                      <th className="px-3 py-2.5 text-right font-black uppercase">Games</th>
                      <th className="px-3 py-2.5 text-right font-black uppercase">Words</th>
                      {th('stars', 'Stars')}
                      {th('lastActiveDate', 'Last active')}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {students.map((s) => (
                      <tr
                        key={s.id}
                        tabIndex={0}
                        onClick={() => setOpenStudent(s)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenStudent(s)}
                        className="class-student-row cursor-pointer hover:bg-sky-50/60 focus:bg-sky-50 focus:outline-none"
                      >
                        <td className="px-3 py-2.5 font-bold text-stone-500">{s.rollNumber}</td>
                        <td className="px-3 py-2.5 font-black text-stone-900">
                          {s.avatar} {s.name}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-stone-700">
                          {LEVEL_INFO[s.readingLevel || 'developing'].icon} {LEVEL_INFO[s.readingLevel || 'developing'].name}
                        </td>
                        <td className="px-3 py-2.5 text-right">{s.sessionsCount}</td>
                        <td className="px-3 py-2.5 text-right">
                          {s.sessionsCount ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="h-1.5 w-14 rounded-full bg-stone-100">
                                <span className="block h-1.5 rounded-full bg-[#2a78d6]" style={{ width: `${s.overallAccuracy}%` }} />
                              </span>
                              <span className="w-9 font-bold">{s.overallAccuracy}%</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">{s.sessionsCount ? s.averageWPM : '—'}</td>
                        <td className="px-3 py-2.5 text-right">{Math.round(s.totalMinutesRead)}</td>
                        <td className="px-3 py-2.5 text-right">{s.gamesCompleted}</td>
                        <td className="px-3 py-2.5 text-right">{s.wordsPracticed}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-amber-700">⭐ {s.stars}</td>
                        <td className="px-3 py-2.5 text-right text-stone-600">
                          {lastActive(s.lastActiveDate)}
                          {s.streakDays > 1 && <span className="ml-1 text-orange-600">🔥{s.streakDays}</span>}
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-stone-500">
                          No students in {data.grade} yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {openStudent && (
          <StudentDrawer
            grade={selectedClass}
            row={openStudent}
            onClose={() => setOpenStudent(null)}
            onLevelChanged={(level, set) => {
              setOpenStudent((row) => (row ? { ...row, readingLevel: level, readingLevelSet: set } : row));
              setData((d) =>
                d ? { ...d, students: d.students.map((s) => (s.id === openStudent.id ? { ...s, readingLevel: level, readingLevelSet: set } : s)) } : d
              );
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

const LEVEL_STYLE: Record<ReadingLevel, string> = {
  beginner: 'border-amber-200 bg-amber-50/60',
  developing: 'border-sky-200 bg-sky-50/60',
  proficient: 'border-emerald-200 bg-emerald-50/60',
};

const StudentDrawer: React.FC<{
  grade: string;
  row: ClassStudentRow;
  onClose: () => void;
  onLevelChanged: (level: ReadingLevel, set: ReadingLevel | null) => void;
}> = ({ grade, row, onClose, onLevelChanged }) => {
  const [detail, setDetail] = useState<ClassStudentDetail | null>(null);
  const [error, setError] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);
  const [levelError, setLevelError] = useState('');
  const chooseLevel = async (choice: ReadingLevel | 'auto') => {
    setSavingLevel(true);
    setLevelError('');
    try {
      const res = await backendApi.school.updateStudent(row.id, { readingLevel: choice });
      const saved = res.student as { readingLevel?: ReadingLevel; readingLevelSet?: ReadingLevel | null };
      onLevelChanged(saved.readingLevel || 'developing', saved.readingLevelSet ?? null);
    } catch (err) {
      setLevelError(err instanceof Error ? err.message : 'Could not change the level.');
    } finally {
      setSavingLevel(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    backendApi.classDashboard
      .student(grade, row.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load this student.'));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [grade, row.id, onClose]);

  const lab = Object.entries(row.labProgress || {});
  return (
    <motion.div className="fixed inset-0 z-[80] flex justify-end bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        id="class-student-drawer"
        role="dialog"
        aria-label={`${row.name} details`}
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg overflow-y-auto bg-stone-50 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-3xl">{row.avatar}</p>
            <h3 className="text-xl font-black text-stone-900">{row.name}</h3>
            <p className="text-xs text-stone-500">
              {grade} · Roll {row.rollNumber} · last active {lastActive(row.lastActiveDate).toLowerCase()}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl border border-stone-200 bg-white p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div id="drawer-reading-level" className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
          <p className="text-xs font-black text-stone-800">
            Reading level: {LEVEL_INFO[row.readingLevel || 'developing'].icon} {LEVEL_INFO[row.readingLevel || 'developing'].name}
            <span className="ml-1 font-semibold text-stone-500">{row.readingLevelSet ? '(set by teacher)' : '(automatic)'}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">{LEVEL_INFO[row.readingLevel || 'developing'].forTeacher}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['auto', ...READING_LEVELS] as const).map((choice) => {
              const active = choice === 'auto' ? !row.readingLevelSet : row.readingLevelSet === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={savingLevel}
                  onClick={() => !active && chooseLevel(choice)}
                  className={`level-choice rounded-lg border px-2.5 py-1 text-[11px] font-black disabled:opacity-60 ${
                    active ? 'border-sky-500 bg-sky-500 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-sky-300'
                  }`}
                >
                  {choice === 'auto' ? '⚙️ Automatic' : `${LEVEL_INFO[choice].icon} ${LEVEL_INFO[choice].name}`}
                </button>
              );
            })}
            {savingLevel && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
          </div>
          {levelError && <p className="mt-1 text-[11px] font-bold text-rose-700">{levelError}</p>}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Accuracy" value={row.sessionsCount ? `${row.overallAccuracy}%` : '—'} />
          <Stat label="Readings" value={row.sessionsCount} />
          <Stat label="Stars" value={`⭐ ${row.stars}`} />
        </div>

        {error && <p className="mt-4 text-xs font-bold text-rose-700">{error}</p>}
        {!detail && !error && (
          <p className="mt-4 flex items-center gap-2 text-xs text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {detail && (
          <div className="mt-4 space-y-4">
            <Panel title="Accuracy, reading by reading" subtitle="Oldest to newest">
              {detail.accuracyTrend.length ? (
                <PercentLineChart
                  height={150}
                  ariaLabel={`${row.name}'s accuracy per reading`}
                  data={detail.accuracyTrend.map((p, i) => ({
                    label: String(i + 1),
                    value: p.accuracy,
                    tip: [new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), `${p.accuracy}% accuracy`],
                  }))}
                />
              ) : (
                <p className="py-3 text-center text-xs text-stone-500">No readings yet.</p>
              )}
            </Panel>

            <Panel title="Recent readings">
              {detail.sessions.length ? (
                <ul className="divide-y divide-stone-100 text-xs">
                  {detail.sessions.slice(0, 10).map((s) => (
                    <li key={s.date} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-stone-800">{s.storyTitle}</span>
                        <span className="text-stone-500">
                          {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {s.subject || s.language}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-black text-stone-900">
                        {s.accuracyRate}%<span className="block text-[10px] font-semibold text-stone-500">{s.wpm} wpm</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-center text-xs text-stone-500">No readings yet.</p>
              )}
            </Panel>

            <Panel title="Words to practise" subtitle="Missed while reading">
              {detail.student.struggledWords.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.student.struggledWords.map((w) => (
                    <span key={w.word} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800">
                      {w.word} ×{w.count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500">None recorded.</p>
              )}
            </Panel>

            <Panel title="Learn & Play" subtitle="Stars per chapter (out of 3)">
              {lab.length ? (
                <BarList
                  rows={lab.map(([id, p]) => ({ label: labChapterById(id)?.title || id, value: p.stars, note: `${p.plays} play${p.plays === 1 ? '' : 's'}` }))}
                />
              ) : (
                <p className="text-xs text-stone-500">No games played yet.</p>
              )}
            </Panel>

            <Panel title="Word dictionary practice" subtitle={`${row.wordsPracticed} words practised`}>
              {detail.words.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {detail.words.slice(0, 20).map((w) => (
                    <li
                      key={w.date + w.word}
                      className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                        w.accuracy >= 60 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {w.accuracy >= 60 ? '✓' : '↻'} {w.word} {w.accuracy}%
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">No word practice yet.</p>
              )}
            </Panel>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
};
