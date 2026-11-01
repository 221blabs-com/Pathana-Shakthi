// The FLN check of every published chapter (src/data/flnCheck.ts): the check
// itself (text version at once, AI questions made in the background and stored
// on the reading), the child's attempts with mistakes and tries, AI marks for
// open answers, and the teacher's view where every mark can be changed.
import { Router, Response } from "express";
import type { Query } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireProfile, requireRole } from "./firebaseRoutes";
import { ownStudentId, VALID_GRADES } from "./studentRoutes";
import { classStudents, schoolScope } from "./supportRoutes";
import { rateLimit } from "./security";
import { scriptLanguage } from "./textbookOcr";
import {
  FLN_CHECK_SCHEMA,
  FLN_CHECK_VERSION,
  OPEN_EVAL_SCHEMA,
  WRITING_MAX,
  WRITING_RUBRIC,
  buildFlnCheckPrompt,
  buildOpenEvalPrompt,
  buildTextFlnCheck,
  classChapterFln,
  cleanAnswers,
  cleanOrf,
  cleanSentences,
  flnSummary,
  normalizeAiFlnCheck,
  orfNorm,
  type FlnCheck,
  type FlnResult,
} from "../src/data/flnCheck";

type Generate = (prompt: string, options?: { temperature?: number; format?: unknown; timeoutMs?: number; interactive?: boolean }) => Promise<{ text: string; model: string }>;

const READINGS = "publishedReadings";
const RESULTS = "flnChecks";
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("class-fln", 60, 60_000)];

function parseJson(text: string): any {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

/** A student only ever sees chapters of their own class and school. */
function mayRead(req: AuthenticatedRequest, reading: any): boolean {
  if (req.appUser?.role !== "student") return true;
  if (reading?.grade !== req.appUser.grade) return false;
  return !reading?.schoolId || !req.appUser.schoolId || reading.schoolId === req.appUser.schoolId;
}

/** The chapter's language, from its script first (a Telugu chapter in an "English" book is Telugu). */
const languageOf = (reading: any) => scriptLanguage((reading?.paragraphs || []).join(" ").slice(0, 2000)) || reading?.language || "English";

/** The check children get now: the stored AI version, else the text version. */
export function currentCheck(reading: any): FlnCheck {
  if (reading?.flnCheck?.version === FLN_CHECK_VERSION) return reading.flnCheck as FlnCheck;
  return buildTextFlnCheck({ ...reading, language: languageOf(reading) });
}

export function createFlnRouter(generate: Generate) {
  const router = Router();
  const inFlight = new Set<string>();

  async function makeAiCheck(id: string, reading: any) {
    if (inFlight.has(id)) return;
    inFlight.add(id);
    const ref = getFirebaseAdmin().db.collection(READINGS).doc(id);
    try {
      await ref.update({ flnCheckTriedAt: new Date().toISOString() });
      const base = buildTextFlnCheck({ ...reading, language: languageOf(reading) });
      if (!base.passage) return;
      const result = await generate(buildFlnCheckPrompt(base, reading.grade, reading.chapterTitle), { format: FLN_CHECK_SCHEMA, temperature: 0.3 });
      const check = normalizeAiFlnCheck(parseJson(result.text), base);
      if (check.source === "ai") await ref.update({ flnCheck: check });
      console.log(`[FLN] ${id}: ${check.source === "ai" ? `AI questions ready (${check.questions.map((q) => q.kind).join(",")}, ${result.model})` : "AI questions unusable; text version kept"}.`);
    } catch (error: any) {
      console.warn(`[FLN] ${id}: AI questions failed (${String(error?.message || error).slice(0, 160)}); the text version is used.`);
    } finally {
      inFlight.delete(id);
    }
  }

  /* GET /api/readings/:id/fln-check — the chapter's FLN check (pending while AI questions are being made). */
  router.get("/readings/:id/fln-check", requireFirebaseUser, requireProfile, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const snap = await getFirebaseAdmin().db.collection(READINGS).doc(String(req.params.id)).get();
      const reading = snap.data();
      if (!snap.exists || !mayRead(req, reading)) return res.status(404).json({ error: "Chapter not found." });
      const check = currentCheck(reading);
      const norm = orfNorm(String(reading?.grade || ""), check.language);
      if (check.source === "ai") return res.json({ check, norm, pending: false });
      const tried = Date.parse(String(reading?.flnCheckTriedAt || "")) || 0;
      const start = req.query.ai !== "0" && Date.now() - tried > 6 * 3_600_000;
      if (start) void makeAiCheck(snap.id, reading);
      return res.json({ check, norm, pending: start || inFlight.has(snap.id) });
    } catch (error: any) {
      console.error("FLN check error:", error?.message || error);
      return res.status(500).json({ error: "Could not load the reading check right now." });
    }
  });

  /* GET /api/student/fln — the child's own results, per chapter. */
  router.get("/student/fln", requireFirebaseUser, requireRole(["student"]), async (req: AuthenticatedRequest, res: Response) => {
    const id = ownStudentId(req);
    if (!id) return res.status(403).json({ error: "Not a student account." });
    try {
      const snap = await getFirebaseAdmin().db.collection(RESULTS).where("studentId", "==", id).limit(300).get();
      const results: Record<string, FlnResult> = {};
      for (const d of snap.docs) results[String(d.get("readingId"))] = d.data() as FlnResult;
      return res.json({ results });
    } catch (error: any) {
      console.error("FLN results error:", error?.message || error);
      return res.status(500).json({ error: "Could not load your reading checks right now." });
    }
  });

  /* POST /api/student/fln/:readingId {part: sentences|orf|comprehension|writing, ...} — one part of the check. */
  router.post(
    "/student/fln/:readingId",
    requireFirebaseUser,
    requireRole(["student"]),
    rateLimit("student-fln", 30, 60_000),
    async (req: AuthenticatedRequest, res: Response) => {
      const id = ownStudentId(req);
      if (!id) return res.status(403).json({ error: "Not a student account." });
      const readingId = String(req.params.readingId);
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(readingId)) return res.status(400).json({ error: "Unknown chapter." });
      const part = String(req.body?.part || "");
      try {
        const { db } = getFirebaseAdmin();
        const readingSnap = await db.collection(READINGS).doc(readingId).get();
        const reading = readingSnap.data();
        if (!readingSnap.exists || !mayRead(req, reading)) return res.status(404).json({ error: "Chapter not found." });
        const check = currentCheck(reading);
        const ref = db.collection(RESULTS).doc(`${id}_${readingId}`);
        const existing = ((await ref.get()).data() || {}) as FlnResult & Record<string, any>;
        const update: Record<string, any> = {};

        if (part === "sentences") {
          const sentences = cleanSentences(req.body?.sentences);
          if (!sentences.length) return res.status(400).json({ error: "No sentences were read." });
          update.sentences = sentences;
        } else if (part === "orf") {
          const orf = cleanOrf(req.body?.orf, String(reading?.grade || req.appUser.grade || ""), check.language);
          if (!orf) return res.status(400).json({ error: "The reading was not heard." });
          orf.tries = (existing.orf?.tries || 0) + 1;
          update.orf = orf;
        } else if (part === "comprehension") {
          const answers = cleanAnswers(req.body?.answers);
          if (!answers.length) return res.status(400).json({ error: "No answers." });
          // What a good answer mentions comes from the check, never from the browser.
          for (const a of answers) if (a.kind === "open") a.expected = check.questions.find((q) => q.question === a.question)?.expected;
          const open = answers.filter((a) => a.kind === "open" && a.text);
          if (open.length) {
            try {
              const { text } = await generate(buildOpenEvalPrompt(check.passage, String(reading?.grade || ""), open.map((a) => ({ question: a.question, expected: a.expected, answer: a.text || "" }))), {
                format: OPEN_EVAL_SCHEMA,
                temperature: 0.1,
                timeoutMs: 30_000,
                interactive: true,
              });
              const scores = parseJson(text)?.scores || [];
              open.forEach((a, i) => {
                const s = Number(scores[i]?.score);
                if (Number.isInteger(s) && s >= 0 && s <= 2) {
                  a.aiScore = s;
                  a.aiReason = String(scores[i]?.reason || "").slice(0, 300);
                }
              });
            } catch (error: any) {
              console.warn(`[FLN] open answers of ${readingId} not marked by AI (${String(error?.message || error).slice(0, 120)}); the teacher marks them.`);
            }
          }
          for (const a of answers) if (a.kind === "open" && !a.text) a.aiScore = 0;
          update.comprehension = { answers, tries: (existing.comprehension?.tries || 0) + 1 };
        } else if (part === "writing") {
          update.writing = { ...(existing.writing || {}), done: true, max: WRITING_MAX };
        } else {
          return res.status(400).json({ error: "Unknown part." });
        }

        const now = new Date().toISOString();
        await ref.set(
          {
            studentId: id,
            studentName: String(req.appUser.name || "").slice(0, 80),
            schoolId: req.appUser.schoolId || null,
            gradeLevel: String(req.appUser.grade || ""),
            readingId,
            chapterTitle: String(reading?.chapterTitle || "").slice(0, 160),
            subject: String(reading?.subject || "").slice(0, 40),
            language: check.language,
            ...update,
            updatedAt: now,
          },
          { merge: true }
        );
        return res.json({ success: true, result: { ...existing, ...update, readingId, updatedAt: now } });
      } catch (error: any) {
        console.error("FLN save error:", error?.message || error);
        return res.status(500).json({ error: "Could not save right now. Try again." });
      }
    }
  );

  /* GET /api/class/:grade/fln?readingId= — one chapter: every child's results; without it: every chapter's summary. */
  router.get("/class/:grade/fln", ...staff, async (req: AuthenticatedRequest, res: Response) => {
    const grade = String(req.params.grade);
    if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
    try {
      const { db } = getFirebaseAdmin();
      const school = schoolScope(req);
      let rq: Query = db.collection(RESULTS).where("gradeLevel", "==", grade);
      if (school) rq = rq.where("schoolId", "==", school);
      const readingId = String(req.query.readingId || "");
      if (readingId) rq = rq.where("readingId", "==", readingId);
      const [students, snap] = await Promise.all([classStudents(req, grade), rq.limit(3000).get()]);
      const ids = new Set(students.map((d) => d.id));
      const results = snap.docs.map((d) => d.data() as FlnResult & { studentId: string }).filter((r) => ids.has(r.studentId));
      if (readingId) {
        const byChild = new Map(results.map((r) => [r.studentId, r]));
        return res.json({
          readingId,
          rubric: WRITING_RUBRIC,
          children: students
            .map((d) => ({
              id: d.id,
              name: String(d.get("name") || ""),
              rollNumber: String(d.get("rollNumber") ?? ""),
              avatar: d.get("avatar") || "🧒",
              result: byChild.get(d.id) || null,
              summary: flnSummary(byChild.get(d.id)),
            }))
            .sort((a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name)),
        });
      }
      return res.json({ classSize: students.length, chapters: classChapterFln(results) });
    } catch (error: any) {
      console.error("Class FLN error:", error?.message || error);
      return res.status(500).json({ error: "Could not load the reading checks right now." });
    }
  });

  /* PATCH /api/class/:grade/fln/:studentId/:readingId {answers?: {index: score|null}, writing?: {rubric, note}} — the teacher's marks. */
  router.patch("/class/:grade/fln/:studentId/:readingId", ...staff, async (req: AuthenticatedRequest, res: Response) => {
    const grade = String(req.params.grade);
    if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
    const studentId = String(req.params.studentId);
    const readingId = String(req.params.readingId);
    try {
      const { db } = getFirebaseAdmin();
      if (!(await classStudents(req, grade)).some((d) => d.id === studentId)) return res.status(404).json({ error: "That child is not in this class." });
      const ref = db.collection(RESULTS).doc(`${studentId}_${readingId}`);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "This child has not done the check yet." });
      const result = snap.data() as FlnResult;
      const update: Record<string, any> = {};
      const marks = req.body?.answers;
      if (marks && typeof marks === "object" && result.comprehension?.answers?.length) {
        const answers = result.comprehension.answers.map((a, i) => {
          if (!(String(i) in marks)) return a;
          const v = marks[String(i)];
          const next = { ...a };
          if (v === null) delete next.teacherScore;
          else if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= a.max) next.teacherScore = Number(v);
          return next;
        });
        update.comprehension = { ...result.comprehension, answers };
      }
      const w = req.body?.writing;
      if (w && typeof w === "object") {
        const rubric: Record<string, number> = {};
        for (const r of WRITING_RUBRIC) {
          const v = Number(w.rubric?.[r.key]);
          if (Number.isFinite(v)) rubric[r.key] = Math.max(0, Math.min(r.max, Math.round(v)));
        }
        const filled = Object.keys(rubric).length === WRITING_RUBRIC.length;
        update.writing = {
          ...(result.writing || { done: false, max: WRITING_MAX }),
          rubric,
          ...(filled ? { teacherScore: Object.values(rubric).reduce((a, b) => a + b, 0) } : {}),
          note: String(w.note || "").slice(0, 300),
        };
      }
      if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to change." });
      await ref.set({ ...update, markedBy: req.firebaseUser.uid, markedAt: new Date().toISOString() }, { merge: true });
      const next = { ...result, ...update };
      return res.json({ success: true, result: next, summary: flnSummary(next) });
    } catch (error: any) {
      console.error("FLN mark error:", error?.message || error);
      return res.status(500).json({ error: "Could not save the marks right now." });
    }
  });

  return router;
}
