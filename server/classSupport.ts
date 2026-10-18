// Teacher Handbook mapping: every child in a class is in one of three groups
// the teacher acts on — 🙋 Need Help, ✅ Go Ahead, ⭐ Very Good — with the
// reasons in plain words and the questions children asked from their
// chapter workbooks (unitResponses). Pure, so the rules are unit tested.

export type SupportStatus = "need_help" | "go_ahead" | "very_good";

export interface UnitResponseLike {
  readingId: string;
  chapterTitle?: string;
  subject?: string;
  blanksCorrect?: number;
  blanksTotal?: number;
  questionsKnown?: number;
  questionsTotal?: number;
  outcomes?: number[];
  reflection?: { feeling?: string; note?: string };
  needHelp?: boolean;
  helpQuestion?: string;
  resolved?: boolean;
  teacherReply?: { text: string; at: string; by?: string } | null;
  done?: boolean;
  updatedAt?: string;
}

export interface StudentLike {
  id: string;
  name: string;
  readingLevel?: string;
  sessionsCount?: number;
  overallAccuracy?: number;
  lastActiveDate?: string;
}

export interface SupportEntry {
  status: SupportStatus;
  reasons: string[];
  /** Open "I need help" requests, newest first. */
  questions: { readingId: string; chapterTitle: string; question: string; at: string }[];
  /** The most recent workbook, for the teacher's overlay. */
  latestUnit: UnitResponseLike | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function supportFor(student: StudentLike, units: UnitResponseLike[], today: string): SupportEntry {
  const sorted = [...units].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const latest = sorted[0] || null;
  const questions = sorted
    .filter((u) => u.needHelp && !u.resolved)
    .map((u) => ({
      readingId: u.readingId,
      chapterTitle: u.chapterTitle || "",
      question: (u.helpQuestion || "").trim(),
      at: u.updatedAt || "",
    }));

  const sessions = Number(student.sessionsCount) || 0;
  const accuracy = Number(student.overallAccuracy) || 0;
  const outcomeAvg = latest ? avg((latest.outcomes || []).map(Number)) : null;
  const blanksShare = latest && latest.blanksTotal ? (latest.blanksCorrect || 0) / latest.blanksTotal : null;

  const help: string[] = [];
  if (questions.length) help.push(`Asked for help in ${questions.map((q) => q.chapterTitle || "a chapter").join(", ")}`);
  if (sessions >= 2 && accuracy < 50) help.push(`Reads ${accuracy}% of words correctly`);
  if (outcomeAvg !== null && outcomeAvg < 0.75) help.push(`Says "not yet" to most of "I can…" in ${latest!.chapterTitle || "the last chapter"}`);
  if (latest?.reflection?.feeling === "hard" && blanksShare !== null && blanksShare < 0.5) {
    help.push(`Found ${latest.chapterTitle || "the last chapter"} hard (${latest.blanksCorrect}/${latest.blanksTotal} blanks)`);
  }
  if (help.length) return { status: "need_help", reasons: help, questions, latestUnit: latest };

  const good: string[] = [];
  if (student.readingLevel === "proficient") good.push("Proficient reader");
  else if (sessions >= 2 && accuracy >= 85) good.push(`Reads ${accuracy}% correctly`);
  const unitStrong = outcomeAvg === null || outcomeAvg >= 1.5;
  if (good.length && unitStrong) {
    if (latest?.done) good.push(`Finished the ${latest.chapterTitle || "chapter"} workbook`);
    return { status: "very_good", reasons: good, questions, latestUnit: latest };
  }

  const ahead: string[] = [];
  if (!sessions && !latest) ahead.push("Has not started reading yet");
  else if (sessions) ahead.push(`${sessions} readings, ${accuracy}% correct`);
  if (latest) ahead.push(`Workbook: ${latest.chapterTitle || "chapter"}${latest.done ? " (finished)" : ""}`);
  if (student.lastActiveDate && student.lastActiveDate < today) ahead.push(`Last active ${student.lastActiveDate}`);
  return { status: "go_ahead", reasons: ahead, questions, latestUnit: latest };
}

export const SUPPORT_ORDER: SupportStatus[] = ["need_help", "go_ahead", "very_good"];
