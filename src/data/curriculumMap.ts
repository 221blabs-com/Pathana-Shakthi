// The class's curriculum for the year, in one list per subject: the SCERT
// Telangana textbook chapters (Classes 6-10, src/data/telanganaSyllabus.ts),
// the chapters the teacher published from real books, and the built-in
// Learn & Play labs. Each chapter carries the teacher's plan (month, taught
// on) and what the class did with it — who read it, workbook "I can…"
// self-ratings per learning outcome, practice. Shared by the browser (map)
// and the server (stats), so it stays pure (unit tested).
import { syllabusTitleKey, type SyllabusBook } from './telanganaSyllabus';
import { academicYear } from './registers';

/* ------------------------------ inputs ------------------------------ */

export interface MapReading {
  id: string;
  bookKey: string;
  bookTitle: string;
  chapterTitle: string;
  chapterOrder?: number;
  /** One of the Subject Hub tiles (already mapped by the caller). */
  subject: string;
  /** The chapter workbook's "I can…" statements, in the order children rate them. */
  outcomes?: string[];
}

export interface MapLab {
  id: string;
  title: string;
  subject: string;
  emoji?: string;
}

export interface OutcomeCount {
  /** "I can" (2), "a little" (1), "not yet" (0). */
  can: number;
  partly: number;
  notYet: number;
}

export interface ChapterStats {
  readBy: number;
  /** Mean reading-aloud accuracy over the class's readings of the chapter. */
  accuracy: number | null;
  workbooks: number;
  workbooksDone: number;
  outcomes: OutcomeCount[];
  /** Children whose self-ratings average under "a little" (to give the chapter again). */
  needHelp: string[];
  practiced: number;
  practiceShare: number | null;
}

export interface LabStats {
  played: number;
  /** 2+ stars. */
  mastered: number;
}

export interface PlanEntry {
  /** YYYY-MM the teacher plans to teach it. */
  month?: string;
  /** YYYY-MM-DD it was taught. */
  taughtOn?: string;
}

/* ------------------------------ matching ------------------------------ */

/** The chapter (if any) whose title matches a textbook chapter title: exact first, then one containing the other. */
export function matchByTitle<T extends { chapterTitle: string; chapterOrder?: number }>(title: string, items: T[]): T | null {
  const key = syllabusTitleKey(title);
  if (!key) return null;
  const scored = items
    .map((r) => {
      const rk = syllabusTitleKey(r.chapterTitle);
      const exact = rk === key;
      const near = !exact && rk.length >= 6 && key.length >= 6 && (rk.includes(key) || key.includes(rk));
      return { r, score: exact ? 2 : near ? 1 : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.r.chapterOrder ?? 1e9) - (b.r.chapterOrder ?? 1e9));
  return scored[0]?.r ?? null;
}

const slug = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'x';

/** Plan keys are stored as Firestore map keys: letters, digits, ':', '_' and '-' only. */
export const PLAN_KEY = /^[A-Za-z0-9:_-]{1,120}$/;

/* ------------------------------ the map ------------------------------ */

export type Pace = 'taught' | 'now' | 'late' | 'later' | 'unplanned';

export interface MapRow {
  key: string;
  subject: string;
  /** Book / unit heading the row sits under. */
  group: string;
  title: string;
  no?: string;
  source: 'syllabus' | 'book' | 'lab';
  readingId?: string;
  labId?: string;
  emoji?: string;
  plan: PlanEntry;
  pace: Pace;
  stats?: ChapterStats;
  lab?: LabStats;
}

export interface SubjectMap {
  subject: string;
  rows: MapRow[];
  total: number;
  taught: number;
  now: number;
  late: number;
  unplanned: number;
}

export function paceOf(plan: PlanEntry, today: string): Pace {
  if (plan.taughtOn) return 'taught';
  if (!plan.month) return 'unplanned';
  const month = today.slice(0, 7);
  return plan.month < month ? 'late' : plan.month === month ? 'now' : 'later';
}

export interface MapInput {
  subjects: string[];
  syllabus: SyllabusBook[];
  readings: MapReading[];
  labs: MapLab[];
  stats?: Record<string, ChapterStats>;
  labStats?: Record<string, LabStats>;
  plan?: Record<string, PlanEntry>;
  today: string;
}

/** Every chapter of the class, per subject, in textbook order; nothing published is left out. */
export function buildCurriculumMap(input: MapInput): SubjectMap[] {
  const { stats = {}, labStats = {}, plan = {}, today } = input;
  const used = new Set<string>();
  const labsInSyllabus = new Set<string>();
  const row = (r: Omit<MapRow, 'plan' | 'pace' | 'stats' | 'lab'>): MapRow => {
    const p = plan[r.key] || {};
    return {
      ...r,
      plan: p,
      pace: paceOf(p, today),
      ...(r.readingId && stats[r.readingId] ? { stats: stats[r.readingId] } : {}),
      ...(r.labId && labStats[r.labId] ? { lab: labStats[r.labId] } : {}),
    };
  };

  const out: SubjectMap[] = [];
  for (const subject of input.subjects) {
    const rows: MapRow[] = [];
    const readings = input.readings
      .filter((r) => r.subject === subject)
      .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || (a.chapterOrder ?? 1e9) - (b.chapterOrder ?? 1e9));
    for (const book of input.syllabus.filter((b) => b.subject === subject)) {
      book.units.forEach((unit, u) => {
        for (const chapter of unit.chapters) {
          const match = matchByTitle(chapter.title, readings.filter((r) => !used.has(r.id)));
          if (match) used.add(match.id);
          if (chapter.labId) labsInSyllabus.add(chapter.labId);
          rows.push(
            row({
              key: `syl:${slug(book.book)}:${u}:${slug(String(chapter.no))}`,
              subject,
              group: unit.name === 'Chapters' ? book.book : `${book.book} · ${unit.name}`,
              title: chapter.title,
              no: String(chapter.no),
              source: 'syllabus',
              ...(match ? { readingId: match.id } : {}),
              ...(chapter.labId ? { labId: chapter.labId } : {}),
            })
          );
        }
      });
    }
    for (const r of readings) {
      if (used.has(r.id)) continue;
      used.add(r.id);
      rows.push(row({ key: `reading:${r.id}`, subject, group: r.bookTitle || 'Published chapters', title: r.chapterTitle, source: 'book', readingId: r.id }));
    }
    for (const lab of input.labs.filter((l) => l.subject === subject && !labsInSyllabus.has(l.id))) {
      rows.push(row({ key: `lab:${lab.id}`, subject, group: 'Learn & Play', title: lab.title, source: 'lab', labId: lab.id, ...(lab.emoji ? { emoji: lab.emoji } : {}) }));
    }
    if (!rows.length) continue;
    const count = (p: Pace) => rows.filter((r) => r.pace === p).length;
    out.push({ subject, rows, total: rows.length, taught: count('taught'), now: count('now'), late: count('late'), unplanned: count('unplanned') });
  }
  return out;
}

/* ------------------------------ the year ------------------------------ */

/** Teaching months of an academic year ("2026-27"): June to April (May is the summer break). */
export function academicMonths(year: string): string[] {
  const start = Number(year.slice(0, 4));
  return Array.from({ length: 11 }, (_, i) => {
    const m = 6 + i;
    return `${m > 12 ? start + 1 : start}-${String(((m - 1) % 12) + 1).padStart(2, '0')}`;
  });
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] || ''} ${month.slice(0, 4)}`;

/** Spread chapters evenly over the months left in the year (from this month), in order. */
export function spreadOverYear(keys: string[], today: string): Record<string, string> {
  const all = academicMonths(academicYear(today));
  const left = all.filter((m) => m >= today.slice(0, 7));
  const months = left.length ? left : all.slice(-1);
  return Object.fromEntries(keys.map((k, i) => [k, months[Math.floor((i * months.length) / keys.length)]]));
}

/** The year plan by month (for print): what each month teaches, and what is not planned yet. */
export function planByMonth(map: SubjectMap[], year: string): { month: string; rows: MapRow[] }[] {
  const months = academicMonths(year);
  const all = map.flatMap((s) => s.rows);
  const at = (r: MapRow) => r.plan.month || (r.plan.taughtOn ? r.plan.taughtOn.slice(0, 7) : '');
  return [
    ...months.map((month) => ({ month, rows: all.filter((r) => at(r) === month) })),
    { month: '', rows: all.filter((r) => !at(r) || !months.includes(at(r))) },
  ];
}

/* ------------------------------ outcomes ------------------------------ */

export interface OutcomeRow {
  subject: string;
  chapter: string;
  readingId: string;
  outcome: string;
  rated: number;
  count: OutcomeCount;
  /** Share of children who rated it who said "I can". */
  canShare: number;
  weak: boolean;
}

/** Every learning outcome children have rated, weakest first within each subject. */
export function outcomeRows(map: SubjectMap[], readings: MapReading[]): OutcomeRow[] {
  const byId = new Map(readings.map((r) => [r.id, r]));
  const out: OutcomeRow[] = [];
  for (const s of map) {
    for (const row of s.rows) {
      if (!row.readingId || !row.stats) continue;
      const texts = byId.get(row.readingId)?.outcomes || [];
      texts.forEach((outcome, i) => {
        const count = row.stats!.outcomes[i] || { can: 0, partly: 0, notYet: 0 };
        const rated = count.can + count.partly + count.notYet;
        if (!rated) return;
        const canShare = count.can / rated;
        out.push({ subject: s.subject, chapter: row.title, readingId: row.readingId!, outcome, rated, count, canShare, weak: rated >= 2 && canShare < 0.5 });
      });
    }
  }
  return out.sort((a, b) => a.subject.localeCompare(b.subject) || a.canShare - b.canShare);
}

/* ------------------------------ stats (server) ------------------------------ */

export interface StatsInput {
  readings: { id: string; outcomeCount: number }[];
  children: { id: string; completedStoryIds?: string[]; labProgress?: Record<string, { stars?: number }> }[];
  sessions: { studentId: string; storyId: string; accuracyRate?: number }[];
  units: { studentId: string; readingId: string; outcomes?: number[]; done?: boolean }[];
  practice: { studentId: string; readingId: string; right?: number; total?: number }[];
}

/** What the class did with each published chapter (only children of the class count). */
export function chapterStats(input: StatsInput): Record<string, ChapterStats> {
  const ids = new Set(input.children.map((c) => c.id));
  const out: Record<string, ChapterStats> = {};
  for (const r of input.readings) {
    const story = `reading_${r.id}`;
    const acc = input.sessions.filter((s) => s.storyId === story && ids.has(s.studentId)).map((s) => Number(s.accuracyRate) || 0);
    const units = input.units.filter((u) => u.readingId === r.id && ids.has(u.studentId));
    const practice = input.practice.filter((p) => p.readingId === r.id && ids.has(p.studentId));
    const outcomes: OutcomeCount[] = Array.from({ length: r.outcomeCount }, (_, i) => {
      const vals = units.map((u) => u.outcomes?.[i]).filter((v): v is number => typeof v === 'number');
      return { can: vals.filter((v) => v >= 2).length, partly: vals.filter((v) => v === 1).length, notYet: vals.filter((v) => v <= 0).length };
    });
    const needHelp = units
      .filter((u) => {
        const vals = (u.outcomes || []).slice(0, r.outcomeCount || undefined).map(Number).filter((v) => Number.isFinite(v));
        return vals.length > 0 && vals.reduce((a, b) => a + b, 0) / vals.length < 1;
      })
      .map((u) => u.studentId);
    const right = practice.reduce((n, p) => n + (Number(p.right) || 0), 0);
    const total = practice.reduce((n, p) => n + (Number(p.total) || 0), 0);
    out[r.id] = {
      readBy: input.children.filter((c) => (c.completedStoryIds || []).includes(story)).length,
      accuracy: acc.length ? Math.round(acc.reduce((a, b) => a + b, 0) / acc.length) : null,
      workbooks: units.length,
      workbooksDone: units.filter((u) => u.done).length,
      outcomes,
      needHelp,
      practiced: practice.length,
      practiceShare: total ? Math.round((right / total) * 100) / 100 : null,
    };
  }
  return out;
}

/** How many children played each lab, and how many have 2+ stars. */
export function labStats(children: StatsInput['children'], labIds: string[]): Record<string, LabStats> {
  return Object.fromEntries(
    labIds.map((id) => {
      const entries = children.map((c) => c.labProgress?.[id]).filter(Boolean);
      return [id, { played: entries.length, mastered: entries.filter((p) => (Number(p!.stars) || 0) >= 2).length }];
    })
  );
}

/** A change to one chapter's plan; null clears that field. */
export type PlanUpdate = Partial<Record<'month' | 'taughtOn', string | null>>;

/** A plan update from the browser, cleaned: known key shape, months of that year, real days. */
export function cleanPlanUpdate(raw: any, year: string): Record<string, PlanUpdate> {
  const months = new Set(academicMonths(year));
  const out: Record<string, PlanUpdate> = {};
  const entries = raw && typeof raw === 'object' ? Object.entries(raw).slice(0, 500) : [];
  for (const [key, value] of entries) {
    if (!PLAN_KEY.test(key) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const e: PlanUpdate = {};
    if ('month' in v) e.month = v.month === null ? null : months.has(String(v.month)) ? String(v.month) : undefined;
    if ('taughtOn' in v) e.taughtOn = v.taughtOn === null ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(v.taughtOn)) ? String(v.taughtOn) : undefined;
    for (const k of Object.keys(e) as ('month' | 'taughtOn')[]) if (e[k] === undefined) delete e[k];
    if (Object.keys(e).length) out[key] = e;
  }
  return out;
}
