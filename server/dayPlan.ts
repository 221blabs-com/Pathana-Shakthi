// "Plan the Day" for one class: today's goals and how far each child got,
// what needs the teacher (questions, work not done, children away), what to
// teach each reading-level group from the class's own published chapters,
// and the two competencies the class most needs. Pure, so it is unit tested;
// supportRoutes.ts feeds it one class at a time (several for multi-grade).

export type Level = "beginner" | "developing" | "proficient";

export interface DayChild {
  id: string;
  name: string;
  avatar: string;
  rollNumber: string;
  readingLevel: Level;
  dailyActivity: Record<string, string[]>;
  completedStoryIds: string[];
  lastActiveDate: string;
  openQuestions: number;
  pendingWork: number;
  /** Workbooks touched, with the child's local day. */
  units: { readingId: string; day?: string; done?: boolean }[];
}

export interface DayReading {
  id: string;
  bookKey: string;
  bookTitle: string;
  chapterTitle: string;
  chapterOrder: number;
  subject: string;
}

export interface DayCompetency {
  id: string;
  icon: string;
  short: string;
  idea: string;
  practice: { kind: string; id: string; title: string } | null;
}

export type DayWork = { kind: "reading" | "workbook" | "lab" | "dictionary"; id: string; title: string } | null;

export const DAY_GOALS = [
  { id: "read", icon: "📖", name: "Read a chapter aloud" },
  { id: "workbook", icon: "📝", name: "Work on a chapter workbook" },
  { id: "words", icon: "🔤", name: "Practise words" },
  { id: "play", icon: "🎮", name: "Play a Learn & Play game" },
] as const;
export type GoalId = (typeof DAY_GOALS)[number]["id"];

const daysBetween = (from: string, to: string) =>
  from ? Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)) : null;

export function goalsDone(child: DayChild, day: string): Record<GoalId, boolean> {
  const today = child.dailyActivity?.[day] || [];
  return {
    read: today.some((a) => a.startsWith("read_")),
    workbook: child.units.some((u) => u.day === day) || today.some((a) => a.startsWith("unit_")),
    words: today.some((a) => a.startsWith("words_") || a.startsWith("word_")),
    play: today.some((a) => a.startsWith("game_")),
  };
}

/** For each book, the first chapter fewer than half the class has read. */
export function nextChapters(readings: DayReading[], children: DayChild[]) {
  const books = new Map<string, DayReading[]>();
  for (const r of readings) books.set(r.bookKey, [...(books.get(r.bookKey) || []), r]);
  const half = Math.max(1, Math.ceil(children.length / 2));
  const out: { readingId: string; bookTitle: string; chapterTitle: string; subject: string; readBy: number }[] = [];
  for (const list of books.values()) {
    list.sort((a, b) => a.chapterOrder - b.chapterOrder);
    for (const r of list) {
      const readBy = children.filter((c) => c.completedStoryIds.includes(`reading_${r.id}`)).length;
      if (readBy < half) {
        out.push({ readingId: r.id, bookTitle: r.bookTitle, chapterTitle: r.chapterTitle, subject: r.subject, readBy });
        break;
      }
    }
  }
  return out;
}

export function buildDayPlan(input: {
  grade: string;
  day: string;
  children: DayChild[];
  readings: DayReading[];
  competencies: DayCompetency[];
  /** childId → competencyId → status */
  statuses: Record<string, Record<string, string>>;
}) {
  const { grade, day, children, readings, competencies, statuses } = input;
  const rows = children.map((c) => {
    const done = goalsDone(c, day);
    const away = daysBetween(c.lastActiveDate, day);
    return {
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      rollNumber: c.rollNumber,
      readingLevel: c.readingLevel,
      done,
      doneCount: Object.values(done).filter(Boolean).length,
      openQuestions: c.openQuestions,
      pendingWork: c.pendingWork,
      daysAway: away,
    };
  });
  const goals = DAY_GOALS.map((g) => ({ ...g, done: rows.filter((r) => r.done[g.id]).length, total: rows.length }));

  const next = nextChapters(readings, children);
  const main = next[0] || null;

  // Competencies the class most needs: most children not there yet, then most at "beginning".
  const focus = competencies
    .map((c) => {
      const s = children.map((ch) => statuses[ch.id]?.[c.id] || "not_started");
      return {
        ...c,
        notAchieved: s.filter((x) => x !== "achieved").length,
        beginning: s.filter((x) => x === "beginning").length,
        started: s.filter((x) => x !== "not_started").length,
      };
    })
    .filter((c) => c.notAchieved > 0)
    .sort((a, b) => b.beginning - a.beginning || b.notAchieved - a.notAchieved || b.started - a.started)
    .slice(0, 2);

  const practice = (focus.find((f) => f.practice)?.practice as DayWork) || null;
  const chapterWork = (kind: "reading" | "workbook"): DayWork => (main ? { kind, id: main.readingId, title: main.chapterTitle } : practice);
  const groups = (["beginner", "developing", "proficient"] as Level[])
    .map((level) => {
      const ids = rows.filter((r) => r.readingLevel === level).map((r) => r.id);
      const ch = main ? `“${main.chapterTitle}”` : "";
      const plan =
        level === "beginner"
          ? main
            ? `Sit with this group for 10 minutes: read ${ch} line by line — you read, they repeat (the app reads each page to them first). Show its new words on word cards.`
            : "Sit with this group for 10 minutes: picture talk and word cards; let them listen to a Learn & Play chapter and say each word."
          : level === "developing"
            ? main
              ? `Pairs read ${ch} aloud to each other in the app, then do the fill-in-the-blanks in its workbook.`
              : "Pairs practise words in the Word Dictionary and play the focus game below."
            : main
              ? `Finish the ${ch} workbook and its activity, then each one is a reading buddy for a beginner.`
              : "Play the focus game below, then each one is a reading buddy for a beginner.";
      const work: DayWork = level === "proficient" ? chapterWork("workbook") : chapterWork("reading");
      return { level, studentIds: ids, plan, work };
    })
    .filter((g) => g.studentIds.length > 0);

  const counts = {
    children: rows.length,
    activeToday: rows.filter((r) => r.doneCount > 0).length,
    openQuestions: rows.reduce((n, r) => n + r.openQuestions, 0),
    childrenWithQuestions: rows.filter((r) => r.openQuestions > 0).length,
    pendingWork: rows.reduce((n, r) => n + r.pendingWork, 0),
    awayThreeDays: rows.filter((r) => r.daysAway === null || r.daysAway >= 3).length,
  };
  return { grade, day, counts, goals, children: rows, nextChapters: next, groups, focus };
}
