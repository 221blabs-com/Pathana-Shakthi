// Shakthi Mitra, the teacher's agent. It looks things up itself (classes,
// children, support groups, competencies, reports, chapters, labs) and
// prepares actions for the teacher — give work, answer a child, change a
// reading level, unlock chapters in order, print materials, open a screen.
// Reads run at once; every change is only PROPOSED and runs when the teacher
// taps Confirm (POST /api/teacher/agent/actions/:id/confirm), re-checked
// against the teacher's own classes and school at that moment.
//
// POST /api/teacher/agent  { message, history? } → NDJSON stream of events:
//   {type:"step"}  {type:"proposal", action:{id,…}}  {type:"answer"}  {type:"error"}
import { Router, Response } from "express";
import { randomUUID } from "crypto";
import type { Query } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { forgetProfile, rateLimit } from "./security";
import { studentView, todayKey } from "./studentRoutes";
import { gradesForUser } from "./schoolRoutes";
import { loadClassData, schoolScope, sendMessages, settingsId } from "./supportRoutes";
import { supportFor } from "./classSupport";
import { buildDayPlan, nextChapters } from "./dayPlan";
import { buildClassReport, Period } from "./classReport";
import { AGENT_SCHEMA, AgentTool, ProposedAction, runAgentLoop } from "./agentLoop";
import { CLASSROOM_IDEAS, competenciesFor, competencyStatus, practiceFor, STATUS_INFO } from "../src/data/competencies";
import { labChapterById, labChaptersFor, subjectsForGrade } from "../src/data/learnPlay";
import { isReadingLevel } from "../src/data/readingLevels";

type Generate = (prompt: string, options?: { temperature?: number; format?: unknown; timeoutMs?: number; interactive?: boolean }) => Promise<{ text: string; model: string }>;

interface Ctx {
  req: AuthenticatedRequest;
  grades: string[];
  day: string;
  cache: Map<string, Promise<ClassSnapshot>>;
}

type ClassSnapshot = Awaited<ReturnType<typeof loadSnapshot>>;

const first = (name: string) => String(name || "").split(" ")[0];

async function loadSnapshot(ctx: Ctx, grade: string) {
  const { db } = getFirebaseAdmin();
  const school = schoolScope(ctx.req);
  let rq: Query = db.collection("publishedReadings").where("grade", "==", grade);
  if (school) rq = rq.where("schoolId", "==", school);
  const [{ students, units, sent }, readingSnap] = await Promise.all([
    loadClassData(ctx.req, grade),
    rq.select("bookId", "bookTitle", "chapterTitle", "chapterOrder", "chapterNumber", "subject").limit(500).get(),
  ]);
  const comps = competenciesFor(grade);
  const children = students
    .map((d) => {
      const raw = d.data();
      const view = studentView(d.id, raw);
      const childUnits = units.get(d.id) || [];
      return {
        view,
        units: childUnits,
        messages: sent.get(d.id) || [],
        support: supportFor(view, childUnits, ctx.day),
        competencies: Object.fromEntries(comps.map((c) => [c.id, competencyStatus(c, { ...view, units: childUnits }, grade)])) as Record<string, string>,
        struggled: Object.entries((raw.struggledWords || {}) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([w]) => w),
      };
    })
    .sort((a, b) => Number(a.view.rollNumber) - Number(b.view.rollNumber));
  const readings = readingSnap.docs.map((r) => {
    const x = r.data();
    return {
      id: r.id,
      bookKey: x.bookId || `title:${x.bookTitle || ""}`,
      bookTitle: x.bookTitle || "",
      chapterTitle: x.chapterTitle || "",
      chapterOrder: Number(x.chapterOrder ?? Number.parseFloat(x.chapterNumber)) || 0,
      subject: x.subject || "",
    };
  });
  return { grade, children, readings, comps };
}

function snapshot(ctx: Ctx, grade: string) {
  if (!ctx.cache.has(grade)) ctx.cache.set(grade, loadSnapshot(ctx, grade));
  return ctx.cache.get(grade)!;
}

function checkGrade(ctx: Ctx, grade: unknown): string {
  const g = String(grade || "").trim();
  const match = ctx.grades.find((x) => x.toLowerCase() === g.toLowerCase() || x.replace(/\D/g, "") === g.replace(/\D/g, ""));
  if (!match) throw new Error(`"${g}" is not one of your classes (${ctx.grades.join(", ")}).`);
  return match;
}

function findChild(snap: ClassSnapshot, ref: unknown) {
  const r = String(ref || "").trim().toLowerCase();
  if (!r) throw new Error("Say which child (id or name).");
  const exact = snap.children.find((c) => c.view.id.toLowerCase() === r || c.view.name.toLowerCase() === r);
  if (exact) return exact;
  const matches = snap.children.filter((c) => first(c.view.name).toLowerCase() === r || c.view.name.toLowerCase().includes(r) || c.view.rollNumber === r);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`More than one child matches "${ref}": ${matches.map((m) => `${m.view.name} (${m.view.id})`).join(", ")}.`);
  throw new Error(`No child "${ref}" in ${snap.grade}.`);
}

const childLine = (c: ClassSnapshot["children"][number]) => ({
  id: c.view.id,
  name: c.view.name,
  roll: c.view.rollNumber,
  level: c.view.readingLevel,
  readings: c.view.sessionsCount,
  accuracy: c.view.sessionsCount ? c.view.overallAccuracy : null,
  wpm: c.view.averageWPM || null,
  group: c.support.status,
  openQuestion: c.support.questions[0] ? `${c.support.questions[0].question || "(no text)"} — ${c.support.questions[0].chapterTitle}` : null,
  lastActive: c.view.lastActiveDate || "never",
});

function selectGroup(snap: ClassSnapshot, group: string) {
  const g = String(group || "").toLowerCase().replace(/\s+/g, "_");
  if (g === "all" || !g) return snap.children;
  if (["need_help", "go_ahead", "very_good"].includes(g)) return snap.children.filter((c) => c.support.status === g);
  if (isReadingLevel(g)) return snap.children.filter((c) => c.view.readingLevel === g);
  if (g === "inactive") return snap.children.filter((c) => !c.view.lastActiveDate || c.view.lastActiveDate < todayKey(new Date(Date.now() - 3 * 86_400_000)));
  throw new Error(`Unknown group "${group}". Use all, need_help, go_ahead, very_good, beginner, developing, proficient or inactive.`);
}

function findCompetency(snap: ClassSnapshot, ref: unknown) {
  const r = String(ref || "").toLowerCase();
  const c = snap.comps.find((x) => x.id === r || x.short.toLowerCase() === r || x.name.toLowerCase().includes(r) || x.short.toLowerCase().includes(r));
  if (!c) throw new Error(`Unknown competency "${ref}". This class has: ${snap.comps.map((x) => `${x.id} (${x.short})`).join(", ")}.`);
  return c;
}

async function resolveWork(ctx: Ctx, grade: string, raw: Record<string, any>) {
  // Models name the id differently: id, readingId, chapterId, labId.
  const args: Record<string, any> = { ...raw, id: raw.id || raw.readingId || raw.chapterId || raw.labId || raw.lab || raw.chapter };
  const kind = String(args.kind || (raw.labId ? "lab" : raw.readingId ? "reading" : ""));
  if (kind === "dictionary") return { kind: "dictionary", id: "dictionary", title: "Word practice" };
  if (kind === "lab") {
    const lab = labChapterById(String(args.id || ""));
    if (!lab || !subjectsForGrade(grade).some((s) => labChaptersFor(s, grade).some((c) => c.id === lab.id))) {
      throw new Error(`Learn & Play chapter "${args.id}" is not available for ${grade} — use list_labs.`);
    }
    return { kind: "lab", id: lab.id, title: lab.title };
  }
  if (kind === "reading" || kind === "workbook") {
    const snap = await snapshot(ctx, grade);
    const r = snap.readings.find((x) => x.id === String(args.id || ""));
    if (!r) throw new Error(`Chapter "${args.id}" is not published for ${grade} — use list_chapters.`);
    return { kind, id: r.id, title: r.chapterTitle };
  }
  throw new Error('Work "kind" must be reading, workbook, lab or dictionary.');
}

const KIND_LABEL: Record<string, string> = { reading: "📘 Read", workbook: "📝 Workbook", lab: "🎮 Learn & Play", dictionary: "🔤 Word practice" };
const PRINT_KINDS = ["day_plan", "report", "competencies", "chapter", "word_cards", "reading_cards", "question_cards", "worksheet", "worksheet_answers", "number_cards", "hundred_chart", "fact_cards", "clock", "alphabet"];
const SCREENS = ["today", "class_support", "class_levels", "class_report", "class_progress", "students", "books", "tlm", "learnplay"];

export const TEACHER_TOOLS: AgentTool<Ctx>[] = [
  {
    name: "class_summary",
    kind: "read",
    description: 'class_summary {grade} — children with level, reading numbers, support group (need_help/go_ahead/very_good), open questions; competency totals; next chapters; today\'s goals.',
    activity: (a) => `Looking at ${a.grade}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const plan = buildDayPlan({
        grade,
        day: ctx.day,
        children: snap.children.map((c) => ({
          id: c.view.id,
          name: c.view.name,
          avatar: c.view.avatar,
          rollNumber: c.view.rollNumber,
          readingLevel: c.view.readingLevel,
          dailyActivity: c.view.dailyActivity,
          completedStoryIds: c.view.completedStoryIds,
          lastActiveDate: c.view.lastActiveDate,
          openQuestions: c.support.questions.length,
          pendingWork: c.messages.filter((m: any) => m.assign && !m.doneAt).length,
          units: c.units.map((u: any) => ({ readingId: u.readingId, day: u.day, done: u.done })),
        })),
        readings: snap.readings,
        competencies: snap.comps.map((c) => ({ id: c.id, icon: c.icon, short: c.short, idea: CLASSROOM_IDEAS[c.id] || "", practice: practiceFor(c, grade) })),
        statuses: Object.fromEntries(snap.children.map((c) => [c.view.id, c.competencies])),
      });
      return {
        grade,
        children: snap.children.map(childLine),
        competencies: snap.comps.map((c) => ({
          id: c.id,
          name: c.short,
          achieved: snap.children.filter((k) => k.competencies[c.id] === "achieved").length,
          beginning: snap.children.filter((k) => k.competencies[c.id] === "beginning").length,
          total: snap.children.length,
        })),
        nextChapters: plan.nextChapters,
        todayGoals: plan.goals.map((g) => `${g.name}: ${g.done}/${g.total}`),
        focus: plan.focus.map((f) => f.short),
        counts: plan.counts,
      };
    },
  },
  {
    name: "find_students",
    kind: "read",
    description: "find_students {grade, group?: all|need_help|go_ahead|very_good|beginner|developing|proficient|inactive, competency?: id or name (children NOT achieved), name?} — matching children with ids.",
    activity: (a) => `Finding children in ${a.grade}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      let list = selectGroup(snap, a.group || "all");
      if (a.competency) {
        const c = findCompetency(snap, a.competency);
        list = list.filter((k) => k.competencies[c.id] !== "achieved").map((k) => k);
      }
      if (a.name) list = list.filter((k) => k.view.name.toLowerCase().includes(String(a.name).toLowerCase()));
      return { grade, count: list.length, children: list.map(childLine) };
    },
  },
  {
    name: "student_detail",
    kind: "read",
    description: "student_detail {grade, student: id or name} — one child: reading numbers and recent readings, hard words, level (and whether the teacher set it), support reasons, workbooks, competencies, messages sent.",
    activity: (a) => `Looking at ${a.student}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const c = findChild(snap, a.student);
      const { db } = getFirebaseAdmin();
      const sessions = await db.collection("readingSessions").where("studentId", "==", c.view.id).limit(200).get();
      return {
        ...childLine(c),
        levelSetByTeacher: c.view.readingLevelSet || null,
        supportReasons: c.support.reasons,
        openQuestions: c.support.questions,
        hardWords: c.struggled,
        recentReadings: sessions.docs
          .map((d) => d.data())
          .sort((x: any, y: any) => String(y.date).localeCompare(String(x.date)))
          .slice(0, 6)
          .map((s: any) => ({ day: s.day || String(s.date).slice(0, 10), title: s.storyTitle, accuracy: s.accuracyRate, wpm: s.wpm })),
        workbooks: c.units.slice(0, 5).map((u: any) => ({ chapter: u.chapterTitle, readingId: u.readingId, blanks: `${u.blanksCorrect ?? 0}/${u.blanksTotal ?? 0}`, answersKnown: `${u.questionsKnown ?? 0}/${u.questionsTotal ?? 0}`, outcomes: u.outcomes, feeling: u.reflection?.feeling, done: u.done })),
        competencies: snap.comps.map((k) => `${k.short}: ${STATUS_INFO[c.competencies[k.id] as keyof typeof STATUS_INFO]?.name}`),
        messagesSent: c.messages.slice(0, 4).map((m: any) => ({ text: m.text, work: m.assign?.title || null, seen: Boolean(m.seenAt), done: Boolean(m.doneAt) })),
        learnPlayStars: Object.entries(c.view.labProgress || {}).map(([id, p]: any) => `${id}: ${p?.stars ?? 0}★`),
      };
    },
  },
  {
    name: "competency_detail",
    kind: "read",
    description: "competency_detail {grade, competency: id or name} — what it is, framework, how measured, children per status, a classroom idea and suggested practice.",
    activity: (a) => `Checking ${a.competency} in ${a.grade}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const c = findCompetency(snap, a.competency);
      const by = (s: string) => snap.children.filter((k) => k.competencies[c.id] === s).map((k) => `${k.view.name} (${k.view.id})`);
      return {
        id: c.id,
        name: c.name,
        framework: c.framework,
        measured: c.measured,
        achieved: by("achieved"),
        developing: by("developing"),
        beginning: by("beginning"),
        notStarted: by("not_started"),
        classroomIdea: CLASSROOM_IDEAS[c.id] || "",
        suggestedPractice: practiceFor(c, grade),
      };
    },
  },
  {
    name: "class_report",
    kind: "read",
    description: "class_report {grade, period: day|week|month} — readings, accuracy vs before, workbooks, help answered, work given and follow-up, who needs attention, priorities.",
    activity: (a) => `Reading the ${a.period || "week"} report for ${a.grade}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const period = (["day", "week", "month"].includes(a.period) ? a.period : "week") as Period;
      const snap = await snapshot(ctx, grade);
      const { db } = getFirebaseAdmin();
      const school = schoolScope(ctx.req);
      let sq: Query = db.collection("readingSessions").where("gradeLevel", "==", grade);
      if (school) sq = sq.where("schoolId", "==", school);
      const sessions = await sq.limit(5000).get();
      const r = buildClassReport({
        grade,
        day: ctx.day,
        period,
        children: snap.children.map((c) => ({ id: c.view.id, name: c.view.name, readingLevel: c.view.readingLevel, overallAccuracy: c.view.overallAccuracy, sessionsCount: c.view.sessionsCount, dailyActivity: c.view.dailyActivity })),
        sessions: sessions.docs.map((d) => {
          const x = d.data();
          return { studentId: x.studentId, storyTitle: x.storyTitle, accuracyRate: x.accuracyRate, wpm: x.wpm, durationSeconds: x.durationSeconds, day: x.day || String(x.date || "").slice(0, 10) };
        }),
        units: snap.children.flatMap((c) => c.units.map((u: any) => ({ ...u, studentId: c.view.id }))),
        messages: snap.children.flatMap((c) => c.messages),
        competencies: snap.comps.map((c) => ({ short: c.short, icon: c.icon, achieved: snap.children.filter((k) => k.competencies[c.id] === "achieved").length, total: snap.children.length })),
      });
      const { perDay, ...rest } = r;
      return rest;
    },
  },
  {
    name: "list_chapters",
    kind: "read",
    description: "list_chapters {grade, subject?} — published textbook chapters (ids for reading/workbook work) with how many children read each.",
    activity: (a) => `Listing ${a.grade} chapters`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const subject = String(a.subject || "").toLowerCase();
      const rows = snap.readings
        .filter((r) => !subject || r.subject.toLowerCase().includes(subject) || r.bookTitle.toLowerCase().includes(subject))
        .sort((x, y) => x.bookTitle.localeCompare(y.bookTitle) || x.chapterOrder - y.chapterOrder)
        .map((r) => ({ id: r.id, book: r.bookTitle, title: r.chapterTitle, subject: r.subject, readBy: snap.children.filter((c) => c.view.completedStoryIds.includes(`reading_${r.id}`)).length }));
      return { grade, count: rows.length, chapters: rows.slice(0, 40), next: nextChapters(snap.readings, snap.children.map((c) => ({ completedStoryIds: c.view.completedStoryIds })) as any) };
    },
  },
  {
    name: "list_labs",
    kind: "read",
    description: "list_labs {grade, subject?} — Learn & Play chapters (ids for lab work) for the class.",
    activity: (a) => `Listing Learn & Play for ${a.grade}`,
    run: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const subjects = a.subject ? [String(a.subject)] : subjectsForGrade(grade);
      return subjects.flatMap((s) => labChaptersFor(s, grade).map((c) => ({ id: c.id, subject: c.subject, title: c.title })));
    },
  },
  {
    name: "give_work",
    kind: "action",
    description:
      "give_work {grade, students?: [ids or names], group?: need_help|beginner|developing|proficient|all|…, kind: reading|workbook|lab|dictionary, id (chapter or lab id; not for dictionary), note?} — PROPOSE giving work; it appears on each child's home screen.",
    prepare: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const kids = Array.isArray(a.students) && a.students.length ? a.students.map((s: unknown) => findChild(snap, s)) : selectGroup(snap, a.group || "all");
      if (!kids.length) throw new Error("No children to give work to.");
      const work = await resolveWork(ctx, grade, a);
      const names = kids.map((k: any) => first(k.view.name));
      return {
        args: { grade, studentIds: kids.map((k: any) => k.view.id), work, note: String(a.note || "").slice(0, 400) },
        label: `Give ${KIND_LABEL[work.kind]} “${work.title}” to ${names.length > 5 ? `${names.slice(0, 5).join(", ")} +${names.length - 5}` : names.join(", ")} (${grade})`,
      };
    },
  },
  {
    name: "reply_to_child",
    kind: "action",
    description: "reply_to_child {grade, student, text, readingId? (the chapter they asked about; default their open question), work?: {kind,id}} — PROPOSE answering a child's question / sending guidance; read aloud on their home screen.",
    prepare: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const c = findChild(snap, a.student);
      const text = String(a.text || "").trim().slice(0, 600);
      if (!text) throw new Error("Write the answer text.");
      const q = c.support.questions.find((x) => x.readingId === a.readingId) || c.support.questions[0];
      const work = a.work && a.work.kind ? await resolveWork(ctx, grade, a.work) : null;
      return {
        args: { grade, studentId: c.view.id, text, readingId: q?.readingId || null, chapterTitle: q?.chapterTitle || null, work },
        label: `Send to ${first(c.view.name)}: “${text.length > 90 ? `${text.slice(0, 88)}…` : text}”${work ? ` + ${KIND_LABEL[work.kind]} ${work.title}` : ""}`,
      };
    },
  },
  {
    name: "set_reading_level",
    kind: "action",
    description: "set_reading_level {grade, student, level: beginner|developing|proficient|auto} — PROPOSE moving a child to a reading-level group (auto = follow their readings).",
    prepare: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const c = findChild(snap, a.student);
      const level = String(a.level || "").toLowerCase();
      if (level !== "auto" && !isReadingLevel(level)) throw new Error("level must be beginner, developing, proficient or auto.");
      return { args: { grade, studentId: c.view.id, level }, label: `Move ${first(c.view.name)} to ${level === "auto" ? "the automatic level" : level} (now ${c.view.readingLevel})` };
    },
  },
  {
    name: "set_unlock_in_order",
    kind: "action",
    description: "set_unlock_in_order {grade, on: true|false} — PROPOSE switching 'chapters open in order' for a class.",
    prepare: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const on = a.on === true || a.on === "true";
      return { args: { grade, on }, label: `${on ? "Turn on" : "Turn off"} “unlock chapters in order” for ${grade}` };
    },
  },
  {
    name: "print_material",
    kind: "ui",
    description: `print_material {grade, kind: ${PRINT_KINDS.join("|")}, readingId? (chapter kinds), level? (reading_cards), period? (report), language?: English|Telugu|Hindi (alphabet), op?: +|-|× (fact_cards), from?/to? (number_cards)} — a Print button for the teacher.`,
    prepare: async (ctx, input) => {
      let a = input;
      const grade = checkGrade(ctx, a.grade);
      const kind = String(a.kind || "");
      if (!PRINT_KINDS.includes(kind)) throw new Error(`kind must be one of ${PRINT_KINDS.join(", ")}.`);
      let title = "";
      if (["chapter", "word_cards", "reading_cards", "question_cards", "worksheet", "worksheet_answers"].includes(kind)) {
        const snap = await snapshot(ctx, grade);
        const id = String(a.readingId || a.id || a.chapterId || "");
        const r = snap.readings.find((x) => x.id === id);
        if (!r) throw new Error("readingId must be a published chapter of the class — use list_chapters.");
        a = { ...a, readingId: r.id };
        title = ` · ${r.chapterTitle}`;
      }
      const args = { ...a, grade, kind };
      return { args, label: `🖨️ Print ${kind.replace(/_/g, " ")}${title} (${grade})` };
    },
  },
  {
    name: "play_explainer",
    kind: "ui",
    description: "play_explainer {grade, readingId} — a button that plays a chapter's animated lesson (pictures, real-life examples, narration) full screen, e.g. on a classroom projector.",
    prepare: async (ctx, a) => {
      const grade = checkGrade(ctx, a.grade);
      const snap = await snapshot(ctx, grade);
      const id = String(a.readingId || a.id || a.chapterId || "");
      const r = snap.readings.find((x) => x.id === id);
      if (!r) throw new Error("readingId must be a published chapter of the class — use list_chapters.");
      return { args: { grade, readingId: r.id, title: r.chapterTitle }, label: `🎬 Play the animated lesson “${r.chapterTitle}”` };
    },
  },
  {
    name: "open_screen",
    kind: "ui",
    description: `open_screen {screen: ${SCREENS.join("|")}, grade?} — a button that opens that part of the dashboard.`,
    prepare: async (ctx, a) => {
      const screen = String(a.screen || "");
      if (!SCREENS.includes(screen)) throw new Error(`screen must be one of ${SCREENS.join(", ")}.`);
      const grade = a.grade ? checkGrade(ctx, a.grade) : undefined;
      return { args: { screen, grade }, label: `Open ${screen.replace(/_/g, " ")}${grade ? ` · ${grade}` : ""}` };
    },
  },
];

/** Carry out a confirmed action (checked again against the teacher's classes and school). */
async function executeAction(ctx: Ctx, action: ProposedAction): Promise<string> {
  const a = action.args;
  const grade = checkGrade(ctx, a.grade);
  if (action.tool === "give_work") {
    const sent = await sendMessages(ctx.req, grade, a.studentIds, { text: a.note || "", assign: a.work });
    return `Sent ${a.work.title} to ${sent.length} ${sent.length === 1 ? "child" : "children"}.`;
  }
  if (action.tool === "reply_to_child") {
    const sent = await sendMessages(ctx.req, grade, [a.studentId], { text: a.text, assign: a.work, readingId: a.readingId || undefined, chapterTitle: a.chapterTitle || undefined });
    if (!sent.length) throw new Error("That child is not in the class any more.");
    return "Sent — it is on the child's home screen.";
  }
  if (action.tool === "set_reading_level") {
    const { db } = getFirebaseAdmin();
    const ref = db.collection("students").doc(String(a.studentId));
    const snap = await ref.get();
    const school = schoolScope(ctx.req);
    if (!snap.exists || snap.get("grade") !== grade || (school && snap.get("schoolId") !== school)) throw new Error("Student not found in this class.");
    await ref.update({ readingLevel: a.level === "auto" ? FieldValue.delete() : a.level, updatedAt: new Date().toISOString() });
    forgetProfile(`student_${snap.id}`);
    return `${first(snap.get("name"))} is now ${a.level === "auto" ? "on the automatic level" : a.level}.`;
  }
  if (action.tool === "set_unlock_in_order") {
    const { db } = getFirebaseAdmin();
    await db
      .collection("classSettings")
      .doc(settingsId(schoolScope(ctx.req), grade))
      .set({ grade, schoolId: schoolScope(ctx.req), unlockInOrder: Boolean(a.on), updatedAt: new Date().toISOString(), updatedBy: ctx.req.appUser?.id || null }, { merge: true });
    return `Chapters in order is now ${a.on ? "on" : "off"} for ${grade}.`;
  }
  throw new Error("This action cannot be confirmed here.");
}

export function buildAgentPrompt(input: { teacher: string; role: string; grades: string[]; day: string; history: { role: "teacher" | "mitra"; text: string }[]; message: string }) {
  const tools = TEACHER_TOOLS.map((t) => `- [${t.kind}] ${t.description}`).join("\n");
  return `You are Shakthi Mitra 🐯, the AI teaching assistant AGENT inside Pathana Shakthi, a reading and learning app used in government schools in Telangana, India. You work for ${input.teacher} (${input.role}), whose classes are: ${input.grades.join(", ")}. Today is ${input.day}.

You can USE TOOLS to look at their classes and to PREPARE actions. How you work:
1. Think about what the teacher needs. Use read tools to get the facts — never invent children, ids, numbers or chapters. Use the exact ids from tool results.
2. When the teacher asks you to DO something (give work, answer a child, move a child to a group, unlock chapters), or when an action clearly follows from what you found, call the action tool. Actions are only PROPOSED: the teacher sees a card and taps Confirm. Never say an action is done — say it is ready to confirm.
3. ui tools (print_material, play_explainer, open_screen) give the teacher a button. Nothing is printed, played or opened until the teacher taps it: say "Tap Open/Print/Play below", never "I have opened/printed".
4. Call ONE tool per step. When you have enough, set "tool" to "" and write "answer".
5. If a class is not named and the teacher has one class, use it; if several, use the one they talked about, else ask in your answer.

Teaching knowledge to use: multi-grade and multi-level classrooms (beginner / developing / proficient groups), Foundational Literacy and Numeracy (NIPUN Bharat), Oral Reading Fluency goals (Class 2: 45-60, Class 3: 60 words correct per minute), SCERT Telangana learning outcomes, low-cost materials (chalk, slate, stones, sticks, paper, one phone).

Answer style: simple English, short (under 150 words), "- " bullet points, children by first name, concrete steps with minutes and materials. Never show ids to the teacher (ids are only for tools). You may use **bold** for names. Then 2-3 short follow-up suggestions in followUps, written as things the teacher could ask you next.

TOOLS:
${tools}

Reply ONLY with JSON: {"thought": "...", "tool": "<tool name or empty>", "args": "<the tool's arguments as a JSON object string, e.g. {\\"grade\\":\\"Class 5\\"}>", "answer": "<empty unless tool is empty>", "followUps": []}

CONVERSATION:
${input.history.map((h) => `${h.role === "teacher" ? "Teacher" : "Mitra"}: ${h.text}`).join("\n")}
Teacher: ${input.message}`;
}

// Proposed actions wait here until the teacher confirms (30 minutes, per teacher).
const pending = new Map<string, { uid: string; action: ProposedAction; at: number }>();
const PENDING_MS = 30 * 60_000;
function sweep() {
  const now = Date.now();
  for (const [id, p] of pending) if (now - p.at > PENDING_MS) pending.delete(id);
}

export function createTeacherAgentRouter(generate: Generate) {
  const router = Router();
  const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"])];

  router.post("/teacher/agent", ...staff, rateLimit("teacher-agent", 8, 60_000), async (req: AuthenticatedRequest, res: Response) => {
    const message = String(req.body?.message || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 800);
    if (message.length < 2) return res.status(400).json({ error: "Type a message." });
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .slice(-8)
      .map((h: any) => ({ role: h?.role === "mitra" ? "mitra" : "teacher", text: String(h?.text || "").slice(0, 700) })) as { role: "teacher" | "mitra"; text: string }[];
    const dayParam = String(req.body?.day || "");
    const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : todayKey();
    let grades: string[] = [];
    try {
      grades = await gradesForUser(req);
    } catch {
      grades = [];
    }
    if (!grades.length) return res.status(403).json({ error: "Your account has no classes yet. Ask your headmaster to add them." });

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    // compression() buffers responses: flush each event so the teacher sees steps as they happen.
    const send = (event: unknown) => {
      res.write(`${JSON.stringify(event)}\n`);
      (res as any).flush?.();
    };
    const started = Date.now();
    const ctx: Ctx = { req, grades, day, cache: new Map() };
    let calls = 0;
    try {
      sweep();
      await runAgentLoop({
        ctx,
        tools: TEACHER_TOOLS,
        prompt: buildAgentPrompt({ teacher: String(req.appUser?.name || "the teacher"), role: String(req.appUser?.role || "faculty"), grades, day, history, message }),
        generate: async (p) => {
          calls++;
          return (await generate(p, { temperature: 0.2, format: AGENT_SCHEMA, timeoutMs: 45_000, interactive: true })).text;
        },
        onEvent: (event) => {
          if (event.type === "proposal") {
            const id = randomUUID();
            if (event.action.kind === "action") pending.set(id, { uid: String(req.appUser?.id || req.firebaseUser?.uid), action: event.action, at: Date.now() });
            send({ type: "proposal", action: { id, ...event.action } });
          } else send(event);
        },
      });
      console.log(`[AGENT] ${req.appUser?.role} ${calls} model calls -> ${Date.now() - started}ms`);
    } catch (error: any) {
      console.error("Teacher agent error:", error?.message || error);
      send({ type: "error", error: "Shakthi Mitra could not finish right now. Please try again in a minute." });
    }
    res.end();
  });

  router.post("/teacher/agent/actions/:id/confirm", ...staff, rateLimit("teacher-agent-confirm", 30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
    sweep();
    const entry = pending.get(String(req.params.id));
    if (!entry || entry.uid !== String(req.appUser?.id || req.firebaseUser?.uid)) {
      return res.status(404).json({ error: "This suggestion has expired. Ask Shakthi Mitra again." });
    }
    try {
      const grades = await gradesForUser(req);
      const result = await executeAction({ req, grades, day: todayKey(), cache: new Map() }, entry.action);
      pending.delete(String(req.params.id));
      console.log(`[AGENT] ${req.appUser?.role} confirmed ${entry.action.tool}.`);
      return res.json({ ok: true, result });
    } catch (error: any) {
      return res.status(400).json({ error: String(error?.message || "Could not do that.") });
    }
  });
  return router;
}


