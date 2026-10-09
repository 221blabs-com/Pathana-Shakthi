// End-of-day / week / month report for a class (Teacher Reflection &
// Reporting, Track Progress, Remediation & Follow-up): what was read, how
// reading changed against the previous period, workbooks and help requests,
// the work the teacher gave and whether children did it and improved
// afterwards, who needs attention, and what to prioritise next. Pure, so it
// is unit tested; supportRoutes.ts loads the data.

export type Period = "day" | "week" | "month";
export const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 };

export interface ReportSession {
  studentId: string;
  storyTitle?: string;
  subject?: string;
  accuracyRate?: number;
  wpm?: number;
  durationSeconds?: number;
  day: string;
}

export interface ReportChild {
  id: string;
  name: string;
  readingLevel: string;
  overallAccuracy: number;
  sessionsCount: number;
  dailyActivity: Record<string, string[]>;
}

export interface ReportUnit {
  studentId: string;
  chapterTitle?: string;
  day?: string;
  done?: boolean;
  needHelp?: boolean;
  resolved?: boolean;
  teacherReply?: { at?: string } | null;
}

export interface ReportMessage {
  studentId: string;
  createdAt: string;
  assign?: { kind: string; title: string } | null;
  seenAt?: string | null;
  doneAt?: string | null;
}

/** The days of a period ending on `day` (inclusive), oldest first. */
export function periodDays(day: string, period: Period): string[] {
  const end = Date.parse(`${day}T00:00:00Z`);
  return Array.from({ length: PERIOD_DAYS[period] }, (_, i) => new Date(end - (PERIOD_DAYS[period] - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function buildClassReport(input: {
  grade: string;
  day: string;
  period: Period;
  children: ReportChild[];
  sessions: ReportSession[];
  units: ReportUnit[];
  messages: ReportMessage[];
  /** competency short name → children achieved (current snapshot) */
  competencies: { short: string; icon: string; achieved: number; total: number }[];
}) {
  const { grade, day, period, children, sessions, units, messages, competencies } = input;
  const days = periodDays(day, period);
  const from = days[0];
  const prevDays = periodDays(new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10), period);
  const inPeriod = sessions.filter((s) => s.day >= from && s.day <= day);
  const inPrev = sessions.filter((s) => s.day >= prevDays[0] && s.day <= prevDays[prevDays.length - 1]);

  const accuracy = mean(inPeriod.map((s) => Number(s.accuracyRate) || 0));
  const prevAccuracy = mean(inPrev.map((s) => Number(s.accuracyRate) || 0));
  const titles = new Map<string, number>();
  for (const s of inPeriod) if (s.storyTitle) titles.set(s.storyTitle, (titles.get(s.storyTitle) || 0) + 1);

  const activeIds = new Set<string>();
  for (const c of children) if (days.some((d) => (c.dailyActivity?.[d] || []).length)) activeIds.add(c.id);
  for (const s of inPeriod) activeIds.add(s.studentId);

  const periodUnits = units.filter((u) => u.day && u.day >= from && u.day <= day);
  const helpAsked = periodUnits.filter((u) => u.needHelp);
  const periodMessages = messages.filter((m) => m.createdAt.slice(0, 10) >= from && m.createdAt.slice(0, 10) <= day);
  const work = periodMessages.filter((m) => m.assign);

  // Follow-up: for each child given work, did they do it, and did their reading improve afterwards?
  const followUps = [...new Set(work.map((m) => m.studentId))].map((id) => {
    const theirs = work.filter((m) => m.studentId === id);
    const first = theirs.map((m) => m.createdAt).sort()[0];
    const child = children.find((c) => c.id === id);
    const before = mean(sessions.filter((s) => s.studentId === id && s.day < first.slice(0, 10)).map((s) => Number(s.accuracyRate) || 0));
    const after = mean(sessions.filter((s) => s.studentId === id && s.day >= first.slice(0, 10)).map((s) => Number(s.accuracyRate) || 0));
    return {
      studentId: id,
      name: child?.name || id,
      given: theirs.length,
      done: theirs.filter((m) => m.doneAt).length,
      accuracyBefore: before,
      accuracyAfter: after,
      improved: before !== null && after !== null ? after > before : null,
    };
  });

  const attention = children
    .map((c) => {
      const reasons: string[] = [];
      if (!activeIds.has(c.id)) reasons.push(period === "day" ? "did not practise today" : `did not practise this ${period}`);
      if (c.sessionsCount >= 2 && c.overallAccuracy < 50) reasons.push(`reads ${c.overallAccuracy}% correctly`);
      const open = units.filter((u) => u.studentId === c.id && u.needHelp && !u.resolved).length;
      if (open) reasons.push(`${open} question${open > 1 ? "s" : ""} waiting`);
      const pending = messages.filter((m) => m.studentId === c.id && m.assign && !m.doneAt).length;
      if (pending) reasons.push(`${pending} piece${pending > 1 ? "s" : ""} of work not done`);
      return { studentId: c.id, name: c.name, reasons };
    })
    .filter((a) => a.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length);

  const weakest = [...competencies].filter((c) => c.total > 0).sort((a, b) => a.achieved / a.total - b.achieved / b.total).slice(0, 2);
  const priorities: string[] = [];
  const openQuestions = units.filter((u) => u.needHelp && !u.resolved).length;
  if (openQuestions) priorities.push(`Answer ${openQuestions} waiting question${openQuestions > 1 ? "s" : ""} (Need Help).`);
  const away = children.length - activeIds.size;
  if (away) priorities.push(`Get the ${away} child${away > 1 ? "ren" : ""} who did not practise back to reading — a short read with you or a reading buddy.`);
  for (const c of weakest) priorities.push(`Focus on ${c.icon} ${c.short}: ${c.achieved} of ${c.total} children have it.`);
  const notDone = work.filter((m) => !m.doneAt).length;
  if (notDone) priorities.push(`Follow up ${notDone} piece${notDone > 1 ? "s" : ""} of work not done yet.`);

  return {
    grade,
    period,
    from,
    to: day,
    reading: {
      sessions: inPeriod.length,
      readers: new Set(inPeriod.map((s) => s.studentId)).size,
      minutes: Math.round(inPeriod.reduce((n, s) => n + (Number(s.durationSeconds) || 0), 0) / 60),
      accuracy,
      prevAccuracy,
      wpm: mean(inPeriod.map((s) => Number(s.wpm) || 0)),
      chapters: [...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([title, times]) => ({ title, times })),
    },
    activeChildren: activeIds.size,
    totalChildren: children.length,
    perDay: days.map((d) => ({
      day: d,
      readings: inPeriod.filter((s) => s.day === d).length,
      active: children.filter((c) => (c.dailyActivity?.[d] || []).length).length,
    })),
    workbooks: {
      worked: periodUnits.length,
      finished: periodUnits.filter((u) => u.done).length,
      helpAsked: helpAsked.length,
      helpAnswered: helpAsked.filter((u) => u.resolved).length,
    },
    work: { messages: periodMessages.length, given: work.length, done: work.filter((m) => m.doneAt).length, seen: periodMessages.filter((m) => m.seenAt).length },
    followUps,
    attention,
    competencies,
    priorities,
  };
}
