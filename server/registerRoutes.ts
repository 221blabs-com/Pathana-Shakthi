// The teacher's registers (src/data/registers.ts): daily attendance and the
// FLN assessment rounds (baseline / midline / endline). Staff only, scoped to
// the teacher's school like the rest of the class routes; a record only ever
// names children of that class.
import { Router, Response } from "express";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { studentView, VALID_GRADES } from "./studentRoutes";
import { classStudents, schoolScope } from "./supportRoutes";
import { rateLimit } from "./security";
import { COMPETENCIES, competencyStatus } from "../src/data/competencies";
import { ROUNDS, academicYear, cleanEntry, suggestEntry, suggestPresent, type AssessmentEntry } from "../src/data/registers";

const router = Router();
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("class-registers", 60, 60_000)];
const ATTENDANCE = "attendance";
const ASSESSMENTS = "assessmentRounds";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const YEAR = /^\d{4}-\d{2}$/;
const scopeKey = (req: AuthenticatedRequest) => schoolScope(req) || "all";

function children(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  return docs
    .map((d) => ({ id: d.id, name: String(d.get("name") || ""), rollNumber: String(d.get("rollNumber") ?? ""), avatar: d.get("avatar") || "🧒" }))
    .sort((a, b) => (Number(a.rollNumber) || 0) - (Number(b.rollNumber) || 0) || a.name.localeCompare(b.name));
}

function checkGrade(req: AuthenticatedRequest, res: Response): string | null {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) {
    res.status(400).json({ error: "Unknown class." });
    return null;
  }
  return grade;
}

/* GET /api/class/:grade/attendance?day=YYYY-MM-DD — the day's record, or who used the app as a suggestion. */
router.get("/class/:grade/attendance", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = checkGrade(req, res);
  if (!grade) return;
  const day = String(req.query.day || "");
  if (!DAY.test(day)) return res.status(400).json({ error: "day must be YYYY-MM-DD." });
  try {
    const { db } = getFirebaseAdmin();
    const [docs, record] = await Promise.all([
      classStudents(req, grade),
      db.collection(ATTENDANCE).doc(`${scopeKey(req)}_${grade}_${day}`).get(),
    ]);
    return res.json({
      day,
      students: children(docs),
      record: record.exists ? { present: record.get("present") || [], markedAt: record.get("markedAt") || null } : null,
      suggested: suggestPresent(docs.map((d) => ({ id: d.id, dailyActivity: d.get("dailyActivity") || {} })), day),
    });
  } catch (error: any) {
    console.error("Attendance error:", error?.message || error);
    return res.status(500).json({ error: "Could not load attendance right now." });
  }
});

/* PUT /api/class/:grade/attendance {day, present: [ids]} */
router.put("/class/:grade/attendance", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = checkGrade(req, res);
  if (!grade) return;
  const day = String(req.body?.day || "");
  if (!DAY.test(day)) return res.status(400).json({ error: "day must be YYYY-MM-DD." });
  // Not more than a day ahead (time zones), never a future date.
  if (day > new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10)) return res.status(400).json({ error: "That day has not come yet." });
  try {
    const { db } = getFirebaseAdmin();
    const ids = new Set((await classStudents(req, grade)).map((d) => d.id));
    const asked: string[] = (Array.isArray(req.body?.present) ? req.body.present : []).map((id: unknown) => String(id));
    const present = [...new Set(asked)].filter((id) => ids.has(id));
    await db
      .collection(ATTENDANCE)
      .doc(`${scopeKey(req)}_${grade}_${day}`)
      .set({
        schoolId: schoolScope(req),
        grade,
        day,
        month: day.slice(0, 7),
        present,
        absent: [...ids].filter((id) => !present.includes(id)),
        markedBy: req.firebaseUser.uid,
        markedAt: new Date().toISOString(),
      });
    return res.json({ success: true, present: present.length, absent: ids.size - present.length });
  } catch (error: any) {
    console.error("Attendance save error:", error?.message || error);
    return res.status(500).json({ error: "Could not save attendance right now." });
  }
});

/* GET /api/class/:grade/attendance/month?month=YYYY-MM — every day's record for the register. */
router.get("/class/:grade/attendance/month", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = checkGrade(req, res);
  if (!grade) return;
  const month = String(req.query.month || "");
  if (!MONTH.test(month)) return res.status(400).json({ error: "month must be YYYY-MM." });
  try {
    const { db } = getFirebaseAdmin();
    const [docs, snap] = await Promise.all([
      classStudents(req, grade),
      db.collection(ATTENDANCE).where("schoolId", "==", schoolScope(req)).where("grade", "==", grade).where("month", "==", month).get(),
    ]);
    const records: Record<string, string[]> = {};
    for (const d of snap.docs) records[String(d.get("day"))] = d.get("present") || [];
    return res.json({ month, students: children(docs), records });
  } catch (error: any) {
    console.error("Attendance month error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the register right now." });
  }
});

const ROUND_IDS = ROUNDS.map((r) => r.id) as string[];
const numeracy = COMPETENCIES.filter((c) => c.id === "num-number-sense" || c.id === "num-operations");

/* GET /api/class/:grade/assessments?year= — all rounds of the year, with the app's suggestions. */
router.get("/class/:grade/assessments", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = checkGrade(req, res);
  if (!grade) return;
  const year = YEAR.test(String(req.query.year || "")) ? String(req.query.year) : academicYear(new Date().toISOString().slice(0, 10));
  try {
    const { db } = getFirebaseAdmin();
    const [docs, ...rounds] = await Promise.all([
      classStudents(req, grade),
      ...ROUND_IDS.map((r) => db.collection(ASSESSMENTS).doc(`${scopeKey(req)}_${grade}_${year}_${r}`).get()),
    ]);
    const suggested: Record<string, AssessmentEntry> = {};
    for (const d of docs) {
      const view = studentView(d.id, d.data());
      const status = Object.fromEntries(numeracy.map((c) => [c.id, competencyStatus(c, view, grade)]));
      suggested[d.id] = suggestEntry(
        { ...view, numeracy: { numberSense: status["num-number-sense"], operations: status["num-operations"] } },
        grade
      );
    }
    return res.json({
      grade,
      year,
      students: children(docs),
      suggested,
      rounds: Object.fromEntries(
        ROUND_IDS.map((r, i) => [
          r,
          rounds[i].exists
            ? { entries: rounds[i].get("entries") || {}, language: rounds[i].get("language") || "", savedAt: rounds[i].get("savedAt") || null }
            : null,
        ])
      ),
    });
  } catch (error: any) {
    console.error("Assessments error:", error?.message || error);
    return res.status(500).json({ error: "Could not load assessments right now." });
  }
});

/* PUT /api/class/:grade/assessments/:round {year, language, entries: {studentId: entry}} */
router.put("/class/:grade/assessments/:round", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = checkGrade(req, res);
  if (!grade) return;
  const round = String(req.params.round);
  if (!ROUND_IDS.includes(round)) return res.status(400).json({ error: "Unknown round." });
  const year = String(req.body?.year || "");
  if (!YEAR.test(year)) return res.status(400).json({ error: "year must look like 2026-27." });
  try {
    const { db } = getFirebaseAdmin();
    const ids = new Set((await classStudents(req, grade)).map((d) => d.id));
    const entries: Record<string, AssessmentEntry> = {};
    for (const [id, raw] of Object.entries(req.body?.entries || {})) {
      if (!ids.has(id)) continue;
      const entry = cleanEntry(raw);
      if (Object.keys(entry).length) entries[id] = entry;
    }
    const language = ["English", "Telugu", "Hindi", "Urdu"].includes(req.body?.language) ? req.body.language : "";
    await db
      .collection(ASSESSMENTS)
      .doc(`${scopeKey(req)}_${grade}_${year}_${round}`)
      .set({ schoolId: schoolScope(req), grade, year, round, language, entries, savedBy: req.firebaseUser.uid, savedAt: new Date().toISOString() });
    return res.json({ success: true, saved: Object.keys(entries).length });
  } catch (error: any) {
    console.error("Assessment save error:", error?.message || error);
    return res.status(500).json({ error: "Could not save the assessment right now." });
  }
});

export default router;
