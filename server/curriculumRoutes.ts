// The class's curriculum map (src/data/curriculumMap.ts): the published
// chapters with what the class did with them, and the teacher's year plan
// (month per chapter, taught on). Staff only, own school; the browser lays
// the chapters out against the SCERT syllabus and the Learn & Play labs.
import { Router, Response } from "express";
import type { Query } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { VALID_GRADES } from "./studentRoutes";
import { classStudents, schoolScope } from "./supportRoutes";
import { rateLimit } from "./security";
import { workbookOutcomes } from "./unitWorkbook";
import { academicYear } from "../src/data/registers";
import { chapterStats, cleanPlanUpdate, labStats } from "../src/data/curriculumMap";
import { labChaptersFor, subjectsForGrade } from "../src/data/learnPlay";

const router = Router();
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("class-curriculum", 60, 60_000)];
const PLANS = "curriculumPlans";
const YEAR = /^\d{4}-\d{2}$/;
const scopeKey = (req: AuthenticatedRequest) => schoolScope(req) || "all";
const yearOf = (raw: unknown) => (YEAR.test(String(raw || "")) ? String(raw) : academicYear(new Date().toISOString().slice(0, 10)));

/* GET /api/class/:grade/curriculum?year= — published chapters, what the class did, the year plan. */
router.get("/class/:grade/curriculum", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  const year = yearOf(req.query.year);
  try {
    const { db } = getFirebaseAdmin();
    const school = schoolScope(req);
    const scoped = (q: Query) => (school ? q.where("schoolId", "==", school) : q);
    const [students, readingSnap, sessionSnap, unitSnap, practiceSnap, planSnap] = await Promise.all([
      classStudents(req, grade),
      scoped(db.collection("publishedReadings").where("grade", "==", grade))
        .select("bookId", "bookTitle", "chapterTitle", "chapterOrder", "chapterNumber", "subject", "language", "learningObjectives", "workbook")
        .limit(800)
        .get(),
      scoped(db.collection("readingSessions").where("gradeLevel", "==", grade)).select("studentId", "storyId", "accuracyRate").limit(5000).get(),
      scoped(db.collection("unitResponses").where("gradeLevel", "==", grade)).select("studentId", "readingId", "outcomes", "done").limit(3000).get(),
      scoped(db.collection("practiceResponses").where("gradeLevel", "==", grade)).select("studentId", "readingId", "right", "total").limit(3000).get(),
      db.collection(PLANS).doc(`${scopeKey(req)}_${grade}_${year}`).get(),
    ]);
    const readings = readingSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        bookKey: x.bookId || `title:${x.bookTitle || ""}`,
        bookTitle: String(x.bookTitle || ""),
        chapterTitle: String(x.chapterTitle || ""),
        chapterOrder: Number(x.chapterOrder ?? Number.parseFloat(x.chapterNumber)) || 0,
        subject: String(x.subject || ""),
        language: String(x.language || ""),
        outcomes: workbookOutcomes(x),
      };
    });
    const children = students.map((d) => ({ id: d.id, completedStoryIds: d.get("completedStoryIds") || [], labProgress: d.get("labProgress") || {} }));
    const labIds = subjectsForGrade(grade).flatMap((s) => labChaptersFor(s, grade).map((l) => l.id));
    return res.json({
      grade,
      year,
      classSize: children.length,
      readings,
      stats: chapterStats({
        readings: readings.map((r) => ({ id: r.id, outcomeCount: r.outcomes.length })),
        children,
        sessions: sessionSnap.docs.map((d) => d.data() as any),
        units: unitSnap.docs.map((d) => d.data() as any),
        practice: practiceSnap.docs.map((d) => d.data() as any),
      }),
      labStats: labStats(children, labIds),
      plan: planSnap.exists ? planSnap.get("entries") || {} : {},
    });
  } catch (error: any) {
    console.error("Curriculum map error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the curriculum map right now." });
  }
});

/* PUT /api/class/:grade/curriculum/plan {year, entries: {key: {month?, taughtOn?}}} — null clears a field. */
router.put("/class/:grade/curriculum/plan", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  const year = String(req.body?.year || "");
  if (!YEAR.test(year)) return res.status(400).json({ error: "year must look like 2026-27." });
  const updates = cleanPlanUpdate(req.body?.entries, year);
  const keys = Object.keys(updates);
  if (!keys.length) return res.status(400).json({ error: "Nothing to change." });
  try {
    const { db } = getFirebaseAdmin();
    const entries: Record<string, Record<string, unknown>> = {};
    for (const key of keys) {
      entries[key] = Object.fromEntries(Object.entries(updates[key]).map(([field, value]) => [field, value === null ? FieldValue.delete() : value]));
    }
    await db
      .collection(PLANS)
      .doc(`${scopeKey(req)}_${grade}_${year}`)
      .set({ schoolId: schoolScope(req), grade, year, entries, updatedBy: req.firebaseUser.uid, updatedAt: new Date().toISOString() }, { merge: true });
    return res.json({ success: true, changed: keys.length });
  } catch (error: any) {
    console.error("Curriculum plan save error:", error?.message || error);
    return res.status(500).json({ error: "Could not save the plan right now." });
  }
});

export default router;
