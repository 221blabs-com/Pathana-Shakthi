import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, BookOpen, GraduationCap, Layers, Loader2, RefreshCw, School, Users } from 'lucide-react';
import { backendApi, SchoolOverview } from '../../services/backendApi';
import { soundEffects } from '../../services/soundEffects';
import { ClassDashboard } from '../TeacherDashboard/ClassDashboard';
import { RosterPanel } from '../TeacherDashboard/RosterPanel';
import { TeachersPanel } from '../TeacherDashboard/TeachersPanel';
import { PublishedBooksPanel } from '../TeacherDashboard/PublishedBooksPanel';
import { BarList, ColumnChart } from '../TeacherDashboard/charts';
import { downloadCsv } from '../../services/csv';

interface SchoolAdminPageProps {
  onNavigate: (route: string) => void;
}

type AdminTab = 'overview' | 'classes' | 'teachers' | 'students' | 'books';
const TABS: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'School overview', icon: BarChart3 },
  { id: 'classes', label: 'Class dashboards', icon: Layers },
  { id: 'teachers', label: 'Teachers', icon: GraduationCap },
  { id: 'students', label: 'Students & roll numbers', icon: Users },
  { id: 'books', label: 'Published books', icon: BookOpen },
];

const shortDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="card-3d rounded-2xl border border-stone-200 bg-white px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-stone-900">{value}</p>
    {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
  </div>
);

// The headmaster's dashboard: the whole school at a glance (every class side
// by side, readings, books, teachers) from live data, plus the class
// dashboards, teacher accounts, class lists and published books.
export const SchoolAdminPage: React.FC<SchoolAdminPageProps> = () => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [grade, setGrade] = useState('Class 1');
  const [data, setData] = useState<SchoolOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await backendApi.school.overview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the school dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openClass = (g: string) => {
    soundEffects.playWordPop();
    setGrade(g);
    setTab('classes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const school = data?.school;
  const t = data?.totals;

  return (
    <div className="min-h-screen bg-stone-50 pb-16 font-sans text-stone-900">
      <div className="border-b border-stone-800 bg-[#2d2d2d] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-stone-950">Headmaster dashboard</span>
              {school?.code && <span className="text-xs font-semibold text-stone-400">{school.code}</span>}
            </div>
            <h1 id="school-name" className="flex items-center gap-2 text-xl font-black sm:text-2xl">
              <School className="h-6 w-6 text-amber-400" /> {school?.name || 'Your school'}
            </h1>
            {school && (school.district || school.state) && (
              <p className="text-xs text-stone-300">
                {[school.district && `${school.district} District`, school.state, school.board && `Board: ${school.board}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-stone-600 px-3 py-2 text-xs font-bold text-stone-200 hover:bg-stone-800 disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div role="tablist" aria-label="Headmaster dashboard" className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`admin-tab-${id}`}
              aria-selected={tab === id}
              onClick={() => {
                soundEffects.playWordPop();
                setTab(id);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black ${
                tab === id ? 'bg-[#2d2d2d] text-white shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</p>}

        {tab === 'overview' && (
          <div id="school-overview" className="space-y-4">
            {loading && !data && (
              <p className="flex items-center gap-2 text-xs font-bold text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the school…
              </p>
            )}
            {data && t && (
              <>
                <div id="school-insights" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <img src="/shakthi-face-256.png" alt="Shakthi Mitra" className="h-14 w-14 shrink-0 rounded-full bg-white object-contain p-0.5 shadow" />
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-800">Shakthi Mitra's notes for the school</p>
                    {data.insights.length ? (
                      data.insights.map((note) => (
                        <p key={note.text} className="text-sm font-semibold text-stone-800">
                          {note.tone === 'cheer' ? '🌟 ' : note.tone === 'think' ? '💡 ' : '📘 '}
                          {note.text}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm font-semibold text-stone-800">Everything looks on track.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Stat label="Students" value={t.students} hint={`${t.activeThisWeek} active this week`} />
                  <Stat label="Readings" value={t.readings14d} hint={`last 14 days · ${t.readingsTotal} in all`} />
                  <Stat label="Avg accuracy" value={t.averageAccuracy === null ? '—' : `${t.averageAccuracy}%`} hint="children who have read" />
                  <Stat label="Minutes read" value={t.minutes} hint={`⭐ ${t.stars} stars earned`} />
                  <Stat label="Books published" value={t.books} hint={`${t.chapters} chapters`} />
                  <Stat label="Teachers" value={t.teachers} hint="active accounts" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <h3 className="text-sm font-black text-stone-900">Readings per day</h3>
                    <p className="text-[11px] text-stone-500">Whole school · last 14 days</p>
                    <div className="mt-3">
                      <ColumnChart
                        ariaLabel="Readings per day across the school, last 14 days"
                        data={data.daily.map((d) => ({
                          label: shortDay(d.day),
                          value: d.sessions,
                          tip: [shortDay(d.day), `${d.sessions} reading${d.sessions === 1 ? '' : 's'}`, `${d.readers} child${d.readers === 1 ? '' : 'ren'}`],
                        }))}
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <h3 className="text-sm font-black text-stone-900">Children active this week</h3>
                    <p className="text-[11px] text-stone-500">Per class (and class size)</p>
                    <div className="mt-3">
                      <BarList rows={data.classes.map((c) => ({ label: c.grade, value: c.activeThisWeek, note: `of ${c.students}` }))} />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                    <h3 className="text-sm font-black text-stone-900">Classes side by side</h3>
                    <button
                      type="button"
                      id="btn-school-csv"
                      onClick={() =>
                        downloadCsv(`school-report-${new Date().toISOString().slice(0, 10)}.csv`, [
                          ['Class', 'Students', 'Active this week', 'Readings (14 days)', 'Avg accuracy %', 'Below 50%', 'Books', 'Chapters', 'Teachers'],
                          ...data.classes.map((c) => [c.grade, c.students, c.activeThisWeek, c.readings14d, c.averageAccuracy ?? '', c.needHelp, c.books, c.chapters, c.teachers.join('; ')]),
                        ])
                      }
                      className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-700 hover:border-sky-300"
                    >
                      Download (Excel)
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table id="school-class-table" className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-stone-50 text-[10px] font-black uppercase text-stone-500">
                        <tr>
                          <th className="px-3 py-2.5">Class</th>
                          <th className="px-3 py-2.5">Teachers</th>
                          <th className="px-3 py-2.5 text-right">Students</th>
                          <th className="px-3 py-2.5 text-right">Active this week</th>
                          <th className="px-3 py-2.5 text-right">Readings (14 days)</th>
                          <th className="px-3 py-2.5 text-right">Avg accuracy</th>
                          <th className="px-3 py-2.5 text-right">Below 50%</th>
                          <th className="px-3 py-2.5 text-right">Books</th>
                          <th className="px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.classes.map((c) => (
                          <tr key={c.grade} className="school-class-row hover:bg-sky-50/50">
                            <td className="px-3 py-2.5 font-black">{c.grade}</td>
                            <td className="px-3 py-2.5 text-stone-600">{c.teachers.join(', ') || <span className="text-rose-600">None assigned</span>}</td>
                            <td className="px-3 py-2.5 text-right">{c.students}</td>
                            <td className="px-3 py-2.5 text-right">{c.activeThisWeek}</td>
                            <td className="px-3 py-2.5 text-right">{c.readings14d}</td>
                            <td className="px-3 py-2.5 text-right">
                              {c.averageAccuracy === null ? (
                                '—'
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-1.5 w-14 rounded-full bg-stone-100">
                                    <span className="block h-1.5 rounded-full bg-[#2a78d6]" style={{ width: `${c.averageAccuracy}%` }} />
                                  </span>
                                  <span className="w-9 font-bold">{c.averageAccuracy}%</span>
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-2.5 text-right ${c.needHelp ? 'font-black text-rose-700' : ''}`}>{c.needHelp}</td>
                            <td className="px-3 py-2.5 text-right">
                              {c.books} <span className="text-stone-400">({c.chapters} ch.)</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => openClass(c.grade)}
                                className="school-open-class rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-sky-300"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'classes' && <ClassDashboard selectedClass={grade} onSelectClass={setGrade} />}
        {tab === 'teachers' &&
          (data ? (
            <TeachersPanel teachers={data.teachers} onChanged={() => void load()} />
          ) : (
            loading && (
              <p className="flex items-center gap-2 text-xs font-bold text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading teachers…
              </p>
            )
          ))}
        {tab === 'students' && <RosterPanel grade={grade} onSelectGrade={setGrade} />}
        {tab === 'books' && <PublishedBooksPanel refreshKey={0} />}
      </main>
    </div>
  );
};
