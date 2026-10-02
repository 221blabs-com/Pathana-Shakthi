// Class dashboard for teachers: every student in a class with their real
// progress (from students/{id}, kept up to date by POST /api/student/activity)
// plus class-level aggregates over readingSessions. Faculty and admins see
// their own school; superadmin sees every school.
import { Router, Response } from "express";
import type { Query } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { studentView, todayKey, VALID_GRADES } from "./studentRoutes";
import { rateLimit } from "./security";

const router = Router();
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("class-dashboard", 60, 60_000)];

function schoolScope(req: AuthenticatedRequest): string | null {
  return req.appUser?.role === "superadmin" ? null : req.appUser?.schoolId || null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

function lastDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => todayKey(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));
}

type Insight = { tone: "cheer" | "think" | "happy"; text: string };

async function loadClassOverview(req: AuthenticatedRequest, grade: string) {
  const { db } = getFirebaseAdmin();
  const school = schoolScope(req);
  let studentsQuery: Query = db.collection("students").where("grade", "==", grade);
  if (school) studentsQuery = studentsQuery.where("schoolId", "==", school);
  let sessionsQuery: Query = db.collection("readingSessions").where("gradeLevel", "==", grade);
  if (school) sessionsQuery = sessionsQuery.where("schoolId", "==", school);
  const [studentSnap, sessionSnap] = await Promise.all([studentsQuery.get(), sessionsQuery.limit(3000).get()]);

  const students = studentSnap.docs
    .filter((d) => d.get("active") !== false)
    .map((d) => {
      const s = d.data();
      const view = studentView(d.id, s);
      const lab = Object.values(view.labProgress || {}) as any[];
      return {
        ...view,
        gamesCompleted: lab.filter((c) => (c?.stars || 0) > 0).length,
        struggledWords: Object.entries((s.struggledWords || {}) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([word, count]) => ({ word, count })),
      };
    })
    .sort((a, b) => Number(a.rollNumber) - Number(b.rollNumber));

  const sessions = sessionSnap.docs.map((d) => d.data());
  const days = lastDays(14);
  const since = days[0];
  const recent = sessions.filter((s: any) => (s.day || String(s.date || "").slice(0, 10)) >= since);

  const daily = days.map((day) => {
    const onDay = recent.filter((s: any) => (s.day || String(s.date || "").slice(0, 10)) === day);
    return {
      day,
      sessions: onDay.length,
      readers: new Set(onDay.map((s: any) => s.studentId)).size,
      accuracy: onDay.length ? Math.round(mean(onDay.map((s: any) => Number(s.accuracyRate) || 0))) : null,
    };
  });

  const bySubject = new Map<string, { sessions: number; accuracy: number[] }>();
  for (const s of sessions as any[]) {
    const key = s.subject || "Other";
    const entry = bySubject.get(key) || { sessions: 0, accuracy: [] };
    entry.sessions += 1;
    entry.accuracy.push(Number(s.accuracyRate) || 0);
    bySubject.set(key, entry);
  }
  const subjects = [...bySubject.entries()]
    .map(([subject, v]) => ({ subject, sessions: v.sessions, accuracy: Math.round(mean(v.accuracy)) }))
    .sort((a, b) => b.sessions - a.sessions);

  const words = new Map<string, number>();
  for (const st of studentSnap.docs) {
    for (const [w, c] of Object.entries((st.get("struggledWords") || {}) as Record<string, number>)) {
      words.set(w, (words.get(w) || 0) + (Number(c) || 0));
    }
  }
  const struggledWords = [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Accuracy bands for students who have read at least once.
  const readers = students.filter((s) => s.sessionsCount > 0);
  const bands = [
    { band: "Needs help", min: 0, max: 50 },
    { band: "Getting there", min: 50, max: 70 },
    { band: "Good", min: 70, max: 85 },
    { band: "Excellent", min: 85, max: 101 },
  ].map((b) => ({ band: b.band, students: readers.filter((s) => s.overallAccuracy >= b.min && s.overallAccuracy < b.max).length }));

  const weekAgo = days[7];
  const activeThisWeek = students.filter((s) => s.lastActiveDate && s.lastActiveDate >= weekAgo).length;
  const totals = {
    students: students.length,
    activeThisWeek,
    sessions: sessions.length,
    minutes: Math.round(students.reduce((sum, s) => sum + (s.totalMinutesRead || 0), 0)),
    averageAccuracy: readers.length ? Math.round(mean(readers.map((s) => s.overallAccuracy))) : null,
    averageWPM: readers.length ? Math.round(mean(readers.map((s) => s.averageWPM))) : null,
    stars: students.reduce((sum, s) => sum + (s.stars || 0), 0),
    gamesCompleted: students.reduce((sum, s) => sum + s.gamesCompleted, 0),
    wordsPracticed: students.reduce((sum, s) => sum + (s.wordsPracticed || 0), 0),
  };

  // Plain-language notes for the teacher, from the numbers above only.
  const insights: Insight[] = [];
  const inactive = students.filter((s) => !s.lastActiveDate || s.lastActiveDate < weekAgo);
  if (students.length && inactive.length) {
    insights.push({
      tone: "think",
      text: `${inactive.length} of ${students.length} students have not practised this week: ${inactive
        .slice(0, 4)
        .map((s) => s.name.split(" ")[0])
        .join(", ")}${inactive.length > 4 ? "…" : ""}.`,
    });
  }
  const needHelp = readers.filter((s) => s.overallAccuracy < 50);
  if (needHelp.length) {
    insights.push({
      tone: "think",
      text: `${needHelp.map((s) => s.name.split(" ")[0]).join(", ")} ${needHelp.length === 1 ? "reads" : "read"} below 50% accuracy — try reading together with them.`,
    });
  }
  const top = [...readers].sort((a, b) => b.overallAccuracy - a.overallAccuracy || b.sessionsCount - a.sessionsCount)[0];
  if (top && top.overallAccuracy >= 70) {
    insights.push({ tone: "cheer", text: `${top.name} is the class star: ${top.overallAccuracy}% accuracy over ${top.sessionsCount} readings.` });
  }
  if (struggledWords.length) {
    insights.push({
      tone: "happy",
      text: `Words the class finds hard: ${struggledWords.slice(0, 5).map((w) => w.word).join(", ")}. Practise them together in the Word Dictionary.`,
    });
  }
  if (!sessions.length) {
    insights.push({ tone: "happy", text: `No readings in ${grade} yet. Publish a book and ask the children to log in with their class and roll number.` });
  }

  return { grade, totals, daily, subjects, bands, struggledWords, students, insights };
}

router.get("/class/:grade/overview", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  try {
    return res.json(await loadClassOverview(req, grade));
  } catch (error: any) {
    console.error("Class overview error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the class dashboard right now." });
  }
});

router.get("/class/:grade/students/:id", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { db } = getFirebaseAdmin();
    const snap = await db.collection("students").doc(String(req.params.id)).get();
    const school = schoolScope(req);
    if (!snap.exists || snap.get("grade") !== req.params.grade || (school && snap.get("schoolId") !== school)) {
      return res.status(404).json({ error: "Student not found in this class." });
    }
    const [sessionSnap, wordSnap] = await Promise.all([
      db.collection("readingSessions").where("studentId", "==", snap.id).limit(300).get(),
      db.collection("wordPractice").where("studentId", "==", snap.id).limit(300).get(),
    ]);
    const sessions = sessionSnap.docs
      .map((d) => d.data())
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 30)
      .map((s: any) => ({
        date: s.date,
        storyTitle: s.storyTitle,
        subject: s.subject,
        language: s.language,
        accuracyRate: s.accuracyRate,
        wpm: s.wpm,
        durationSeconds: s.durationSeconds,
        starsEarned: s.starsEarned,
        struggledWords: s.struggledWords || [],
      }));
    const words = wordSnap.docs
      .map((d) => d.data())
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 30)
      .map((w: any) => ({ word: w.word, language: w.language, accuracy: w.accuracy, date: w.date }));
    const s = snap.data() || {};
    return res.json({
      student: {
        ...studentView(snap.id, s),
        struggledWords: Object.entries((s.struggledWords || {}) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([word, count]) => ({ word, count })),
      },
      sessions,
      words,
      accuracyTrend: [...sessions].reverse().map((x) => ({ date: x.date, accuracy: x.accuracyRate })),
      averageAccuracy: round1(mean(sessions.map((x) => Number(x.accuracyRate) || 0))),
    });
  } catch (error: any) {
    console.error("Class student error:", error?.message || error);
    return res.status(500).json({ error: "Could not load this student right now." });
  }
});

export default router;

/* ---------------------------------------------------------------
   POST /api/class/:grade/plan
   Shakthi Mitra's plan for the coming week, written by the AI from this
   class's real numbers only (first names, no ids), in plain English.
---------------------------------------------------------------- */
type Generate = (prompt: string, options?: { temperature?: number; format?: unknown; timeoutMs?: number }) => Promise<{ text: string; model: string }>;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, detail: { type: "string" }, students: { type: "array", items: { type: "string" } } },
        required: ["title", "detail", "students"],
      },
    },
    wordsToPractise: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "actions", "wordsToPractise"],
};

export function buildClassPlanPrompt(o: Awaited<ReturnType<typeof loadClassOverview>>): string {
  const first = (name: string) => String(name || "").split(" ")[0];
  const weekAgo = lastDays(8)[0];
  const lines = o.students.map(
    (s) =>
      `- ${first(s.name)}: ${s.sessionsCount} readings, ${s.sessionsCount ? `${s.overallAccuracy}% accuracy, ${s.averageWPM} words/min` : "not read yet"}, ${
        s.lastActiveDate && s.lastActiveDate >= weekAgo ? "active this week" : "not active this week"
      }, ${s.gamesCompleted} Learn & Play games, hard words: ${s.struggledWords.map((w) => w.word).slice(0, 4).join(", ") || "none"}`
  );
  return `You are Shakthi Mitra, a helpful assistant for a primary school teacher in India. Write a short, practical plan for the coming week for ${o.grade}.

Class numbers (from the reading app):
- ${o.totals.students} students, ${o.totals.activeThisWeek} practised this week, ${o.totals.sessions} readings in total.
- Average accuracy: ${o.totals.averageAccuracy ?? "no readings yet"}%; average speed: ${o.totals.averageWPM ?? "-"} words per minute.
- Reading levels: ${o.bands.map((b) => `${b.band} ${b.students}`).join(", ")}.
- Subjects read: ${o.subjects.map((s) => `${s.subject} (${s.sessions} readings, ${s.accuracy}%)`).join(", ") || "none yet"}.
- Words the class finds hard: ${o.struggledWords.map((w) => w.word).slice(0, 12).join(", ") || "none yet"}.

Students:
${lines.join("\n") || "- (no students yet)"}

Rules:
- Use only the facts above. Never invent numbers, names or activities that did not happen.
- 3 or 4 actions, most important first, each one something the teacher can do in class this week (small groups, reading together, practising words, using the app's Word Dictionary or Learn & Play, praising progress).
- "students" in an action lists the first names it is about (empty when it is for the whole class).
- summary: 1-2 sentences on how the class is doing.
- wordsToPractise: up to 8 words from the hard words above.
- Plain, warm English for a busy teacher. No emojis.

Return JSON: {"summary": "...", "actions": [{"title": "...", "detail": "...", "students": ["..."]}], "wordsToPractise": ["..."]}`;
}

const planCache = new Map<string, { at: number; plan: unknown }>();

export function createClassPlanRouter(generate: Generate) {
  const planRouter = Router();
  planRouter.post(
    "/class/:grade/plan",
    requireFirebaseUser,
    requireRole(["faculty", "admin", "superadmin"]),
    rateLimit("class-plan", 6, 60_000),
    async (req: AuthenticatedRequest, res: Response) => {
      const grade = String(req.params.grade);
      if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
      const key = `${schoolScope(req) || "all"}|${grade}`;
      const hit = planCache.get(key);
      if (hit && Date.now() - hit.at < 10 * 60_000 && req.body?.refresh !== true) return res.json(hit.plan);
      const started = Date.now();
      try {
        const overview = await loadClassOverview(req, grade);
        if (!overview.students.length) {
          return res.json({ summary: `There are no students in ${grade} yet.`, actions: [], wordsToPractise: [], generatedAt: new Date().toISOString() });
        }
        const { text } = await generate(buildClassPlanPrompt(overview), { temperature: 0.3, format: PLAN_SCHEMA, timeoutMs: 60_000 });
        const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        const names = new Set(overview.students.map((s) => String(s.name).split(" ")[0]));
        const plan = {
          summary: String(raw.summary || "").slice(0, 400),
          actions: (Array.isArray(raw.actions) ? raw.actions : [])
            .slice(0, 4)
            .map((a: any) => ({
              title: String(a?.title || "").slice(0, 120),
              detail: String(a?.detail || "").slice(0, 500),
              // Only names that really are in this class.
              students: (Array.isArray(a?.students) ? a.students : []).map(String).filter((n: string) => names.has(n)).slice(0, 12),
            }))
            .filter((a: any) => a.title && a.detail),
          wordsToPractise: (Array.isArray(raw.wordsToPractise) ? raw.wordsToPractise : []).map(String).slice(0, 8),
          generatedAt: new Date().toISOString(),
        };
        planCache.set(key, { at: Date.now(), plan });
        console.log(`[PLAN] ${req.appUser?.role} ${grade} -> ${Date.now() - started}ms`);
        return res.json(plan);
      } catch (error: any) {
        console.error("Class plan error:", error?.message || error);
        return res.status(502).json({ error: "Shakthi Mitra could not write a plan right now. Please try again in a minute." });
      }
    }
  );
  return planRouter;
}
