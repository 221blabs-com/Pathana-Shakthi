// The headmaster's roll-up of the teachers' registers (src/data/registers.ts,
// src/data/curriculumMap.ts): per class, the month's attendance, the latest
// FLN assessment round and the curriculum pace, plus plain-language notes —
// what a school reports upward each month. Pure, so it is unit tested.
import { READING_LEVELS, MATHS_LEVELS, ROUNDS, absentStreak, levelChange, levelCounts, monthRegister, type AssessmentEntry, type AssessmentRound } from "../src/data/registers";
import { buildCurriculumMap } from "../src/data/curriculumMap";
import { labChaptersFor, subjectsForGrade } from "../src/data/learnPlay";
import { syllabusFor } from "../src/data/telanganaSyllabus";
import { hubSubjectForReading } from "../src/services/publishedReadingToStory";

export interface RollupInput {
  month: string;
  year: string;
  today: string;
  grades: string[];
  students: { id: string; grade: string; name: string; rollNumber?: string }[];
  attendance: { grade: string; day: string; present: string[] }[];
  rounds: { grade: string; round: string; entries: Record<string, AssessmentEntry> }[];
  plans: { grade: string; entries: Record<string, { month?: string; taughtOn?: string }> }[];
  readings: { id: string; grade: string; bookId?: string; bookTitle?: string; chapterTitle?: string; chapterOrder?: number; subject?: string; language?: string }[];
}

export interface ClassRollup {
  grade: string;
  children: number;
  attendance: { days: number; percent: number | null; below75: number; awayLast3: string[] };
  fln: {
    round: AssessmentRound | null;
    assessed: number;
    /** Children at each level or above, of those assessed. */
    readingWordPlus: number;
    readingParagraphPlus: number;
    readingStory: number;
    mathsAddSubPlus: number;
    reading: Record<string, number>;
    maths: Record<string, number>;
    /** Children who moved up / down a reading level since the round before it. */
    movedUp: number | null;
    movedDown: number | null;
    since: AssessmentRound | null;
  };
  curriculum: { total: number; taught: number; now: number; late: number; unplanned: number };
}

const ROUND_ORDER = ROUNDS.map((r) => r.id);
const atLeast = <T extends string>(ladder: readonly T[], from: T, value?: T) => (value ? ladder.indexOf(value) >= ladder.indexOf(from) : false);

export function buildSchoolRegisters(input: RollupInput) {
  const classes: ClassRollup[] = input.grades.map((grade) => {
    const kids = input.students
      .filter((s) => s.grade === grade)
      .map((s) => ({ id: s.id, name: s.name, rollNumber: String(s.rollNumber ?? "") }));

    // Attendance for the month.
    const records: Record<string, string[]> = {};
    for (const a of input.attendance) if (a.grade === grade && a.day.startsWith(input.month)) records[a.day] = a.present || [];
    const register = monthRegister(input.month, kids, records);
    const percents = register.rows.map((r) => r.percent).filter((p): p is number => p !== null);
    const attendance = {
      days: register.days.length,
      percent: register.days.length && kids.length ? Math.round(register.totals.reduce((n, t) => n + t.present, 0) / (register.days.length * kids.length) * 100) : null,
      below75: percents.filter((p) => p < 75).length,
      awayLast3: absentStreak(records, kids).map((c) => c.name),
    };

    // Latest FLN round saved this year, and movement since the one before it.
    const saved = ROUND_ORDER.map((id) => input.rounds.find((r) => r.grade === grade && r.round === id)).filter(Boolean) as RollupInput["rounds"];
    const latest = saved[saved.length - 1];
    const before = saved.length > 1 ? saved[saved.length - 2] : null;
    const ids = new Set(kids.map((k) => k.id));
    const entries = Object.fromEntries(Object.entries(latest?.entries || {}).filter(([id]) => ids.has(id)));
    const counts = levelCounts(entries);
    const present = Object.values(entries).filter((e) => !e.absent);
    const changes = before ? Object.entries(entries).map(([id, e]) => levelChange(before.entries[id], e)).filter((c): c is number => c !== null) : [];
    const fln = {
      round: (latest?.round as AssessmentRound) || null,
      assessed: counts.assessed,
      readingWordPlus: present.filter((e) => atLeast(READING_LEVELS, "word", e.reading)).length,
      readingParagraphPlus: present.filter((e) => atLeast(READING_LEVELS, "paragraph", e.reading)).length,
      readingStory: present.filter((e) => e.reading === "story").length,
      mathsAddSubPlus: present.filter((e) => atLeast(MATHS_LEVELS, "addsub", e.maths)).length,
      reading: counts.reading,
      maths: counts.maths,
      movedUp: before ? changes.filter((c) => c > 0).length : null,
      movedDown: before ? changes.filter((c) => c < 0).length : null,
      since: (before?.round as AssessmentRound) || null,
    };

    // Curriculum pace from the class's year plan.
    const readings = input.readings
      .filter((r) => r.grade === grade)
      .map((r) => ({
        id: r.id,
        bookKey: r.bookId || `title:${r.bookTitle || ""}`,
        bookTitle: r.bookTitle || "",
        chapterTitle: r.chapterTitle || "",
        chapterOrder: Number(r.chapterOrder) || 0,
        subject: hubSubjectForReading(r.subject || "", r.language) || r.subject || "English",
      }));
    const base = subjectsForGrade(grade) as string[];
    const subjects = [...base, ...readings.map((r) => r.subject).filter((s) => !base.includes(s))].filter((s, i, a) => a.indexOf(s) === i);
    const map = buildCurriculumMap({
      subjects,
      syllabus: subjects.flatMap((s) => syllabusFor(grade, s)),
      readings,
      labs: subjects.flatMap((s) => labChaptersFor(s, grade).map((l) => ({ id: l.id, title: l.title, subject: l.subject }))),
      plan: input.plans.find((p) => p.grade === grade)?.entries || {},
      today: input.today,
    });
    const sum = (k: "total" | "taught" | "now" | "late" | "unplanned") => map.reduce((n, s) => n + s[k], 0);
    const curriculum = { total: sum("total"), taught: sum("taught"), now: sum("now"), late: sum("late"), unplanned: sum("unplanned") };

    return { grade, children: kids.length, attendance, fln, curriculum };
  });

  const withKids = classes.filter((c) => c.children > 0);
  const notes: string[] = [];
  const names = (list: ClassRollup[]) => list.map((c) => c.grade).join(", ");
  const noAttendance = withKids.filter((c) => !c.attendance.days);
  if (noAttendance.length) notes.push(`No attendance marked this month: ${names(noAttendance)}.`);
  const lowAttendance = withKids.filter((c) => c.attendance.percent !== null && c.attendance.percent < 75);
  if (lowAttendance.length) notes.push(`Attendance under 75%: ${lowAttendance.map((c) => `${c.grade} (${c.attendance.percent}%)`).join(", ")}.`);
  const away = withKids.reduce((n, c) => n + c.attendance.awayLast3.length, 0);
  if (away) notes.push(`${away} ${away === 1 ? "child has" : "children have"} been away the last 3 days attendance was taken — a home visit or call may help.`);
  const noRound = withKids.filter((c) => !c.fln.round);
  if (noRound.length) notes.push(`No FLN assessment saved this year: ${names(noRound)}.`);
  const behind = withKids.filter((c) => c.curriculum.late > 0);
  if (behind.length) notes.push(`Chapters behind plan: ${behind.map((c) => `${c.grade} (${c.curriculum.late})`).join(", ")}.`);
  const noPlan = withKids.filter((c) => c.curriculum.total > 0 && c.curriculum.unplanned === c.curriculum.total);
  if (noPlan.length) notes.push(`No year plan yet: ${names(noPlan)}.`);
  const down = withKids.filter((c) => (c.fln.movedDown || 0) > (c.fln.movedUp || 0));
  if (down.length) notes.push(`More children moved down than up a reading level: ${names(down)}.`);

  const marked = withKids.filter((c) => c.attendance.percent !== null);
  const totalKids = withKids.reduce((n, c) => n + c.children, 0);
  const assessed = withKids.reduce((n, c) => n + c.fln.assessed, 0);
  return {
    month: input.month,
    year: input.year,
    classes,
    totals: {
      children: totalKids,
      attendancePercent: marked.length
        ? Math.round(marked.reduce((n, c) => n + (c.attendance.percent || 0) * c.children, 0) / marked.reduce((n, c) => n + c.children, 0))
        : null,
      assessed,
      readingParagraphPlus: withKids.reduce((n, c) => n + c.fln.readingParagraphPlus, 0),
      mathsAddSubPlus: withKids.reduce((n, c) => n + c.fln.mathsAddSubPlus, 0),
      taught: withKids.reduce((n, c) => n + c.curriculum.taught, 0),
      chapters: withKids.reduce((n, c) => n + c.curriculum.total, 0),
    },
    notes,
  };
}
