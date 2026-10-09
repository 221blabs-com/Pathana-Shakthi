// The teacher's support loop (Teacher Handbook mapping):
//   Class → 🙋 Need Help / ✅ Go Ahead / ⭐ Very Good → a child → their work and
//   question → the teacher's answer and/or a piece of work to do → the child
//   sees it on their home screen (with sound) and says "Got it".
// Teachers can also give work to several children at once (a reading-level
// group, the Need Help group, or anyone they pick).
import { Router, Response } from "express";
import type { Query } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { ownStudentId, studentView, todayKey, VALID_GRADES } from "./studentRoutes";
import { rateLimit } from "./security";
import { SUPPORT_ORDER, supportFor, UnitResponseLike } from "./classSupport";

const router = Router();
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("class-support", 60, 60_000)];
const MESSAGES = "teacherMessages";
const ASSIGN_KINDS = ["reading", "workbook", "lab", "dictionary", "none"];

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const schoolScope = (req: AuthenticatedRequest) => (req.appUser?.role === "superadmin" ? null : req.appUser?.schoolId || null);

function cleanAssign(raw: any): { kind: string; id: string; title: string } | null {
  if (!raw || !ASSIGN_KINDS.includes(String(raw.kind)) || raw.kind === "none") return null;
  const id = clean(raw.id, 80);
  if (raw.kind !== "dictionary" && !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  return { kind: String(raw.kind), id, title: clean(raw.title, 160) };
}

async function classStudents(req: AuthenticatedRequest, grade: string) {
  const { db } = getFirebaseAdmin();
  const school = schoolScope(req);
  let q: Query = db.collection("students").where("grade", "==", grade);
  if (school) q = q.where("schoolId", "==", school);
  const snap = await q.get();
  return snap.docs.filter((d) => d.get("active") !== false);
}

/* GET /api/class/:grade/support — the three groups, each child with reasons and open questions. */
router.get("/class/:grade/support", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  try {
    const { db } = getFirebaseAdmin();
    const school = schoolScope(req);
    let unitsQuery: Query = db.collection("unitResponses").where("gradeLevel", "==", grade);
    if (school) unitsQuery = unitsQuery.where("schoolId", "==", school);
    let sentQuery: Query = db.collection(MESSAGES).where("grade", "==", grade);
    if (school) sentQuery = sentQuery.where("schoolId", "==", school);
    const [students, unitSnap, sentSnap] = await Promise.all([classStudents(req, grade), unitsQuery.limit(3000).get(), sentQuery.limit(1000).get()]);
    const units = new Map<string, UnitResponseLike[]>();
    for (const d of unitSnap.docs) {
      const u = d.data() as UnitResponseLike & { studentId: string };
      units.set(u.studentId, [...(units.get(u.studentId) || []), u]);
    }
    const sent = new Map<string, any[]>();
    for (const d of sentSnap.docs) {
      const m = d.data();
      sent.set(m.studentId, [...(sent.get(m.studentId) || []), { id: d.id, ...m }]);
    }
    const today = todayKey();
    const rows = students.map((d) => {
      const s = d.data();
      const view = studentView(d.id, s);
      const entry = supportFor(view, units.get(d.id) || [], today);
      return {
        id: d.id,
        name: view.name,
        avatar: view.avatar,
        rollNumber: view.rollNumber,
        readingLevel: view.readingLevel,
        overallAccuracy: view.overallAccuracy,
        averageWPM: view.averageWPM,
        sessionsCount: view.sessionsCount,
        lastActiveDate: view.lastActiveDate,
        stars: view.stars,
        struggledWords: Object.entries((s.struggledWords || {}) as Record<string, number>)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([word]) => word),
        ...entry,
        units: (units.get(d.id) || [])
          .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
          .slice(0, 5),
        messages: (sent.get(d.id) || [])
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, 5)
          .map((m) => ({ id: m.id, text: m.text, assign: m.assign || null, createdAt: m.createdAt, seenAt: m.seenAt || null, teacherName: m.teacherName })),
      };
    });
    rows.sort((a, b) => b.questions.length - a.questions.length || Number(a.rollNumber) - Number(b.rollNumber));
    const groups = Object.fromEntries(SUPPORT_ORDER.map((status) => [status, rows.filter((r) => r.status === status)]));
    return res.json({ grade, groups });
  } catch (error: any) {
    console.error("Class support error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the class right now." });
  }
});

async function sendMessages(
  req: AuthenticatedRequest,
  grade: string,
  studentIds: string[],
  body: { text: string; assign: ReturnType<typeof cleanAssign>; readingId?: string; chapterTitle?: string }
) {
  const { db } = getFirebaseAdmin();
  const students = new Map((await classStudents(req, grade)).map((d) => [d.id, d]));
  const now = new Date().toISOString();
  const teacherName = clean(req.appUser?.name, 80) || "Your teacher";
  const batch = db.batch();
  const sentTo: string[] = [];
  for (const id of studentIds) {
    const s = students.get(id);
    if (!s) continue;
    batch.set(db.collection(MESSAGES).doc(), {
      studentId: id,
      grade,
      schoolId: s.get("schoolId") || null,
      teacherId: req.appUser?.id || null,
      teacherName,
      text: body.text,
      assign: body.assign,
      readingId: body.readingId || null,
      chapterTitle: body.chapterTitle || null,
      createdAt: now,
      seenAt: null,
      doneAt: null,
    });
    if (body.readingId) {
      // The child's help request is answered.
      batch.set(
        db.collection("unitResponses").doc(`${id}_${body.readingId}`),
        { resolved: true, teacherReply: { text: body.text, at: now, by: teacherName } },
        { merge: true }
      );
    }
    sentTo.push(id);
  }
  if (sentTo.length) await batch.commit();
  return sentTo;
}

/* POST /api/class/:grade/support/:studentId/reply { text, readingId?, assign? } */
router.post("/class/:grade/support/:studentId/reply", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  const text = clean(req.body?.text, 600);
  const assign = cleanAssign(req.body?.assign);
  if (!text && !assign) return res.status(400).json({ error: "Write an answer or choose some work to give." });
  const readingId = /^[A-Za-z0-9_-]{1,80}$/.test(String(req.body?.readingId || "")) ? String(req.body.readingId) : undefined;
  try {
    const sent = await sendMessages(req, grade, [String(req.params.studentId)], { text, assign, readingId, chapterTitle: clean(req.body?.chapterTitle, 160) });
    if (!sent.length) return res.status(404).json({ error: "Student not found in this class." });
    console.log(`[SUPPORT] ${req.appUser?.role} answered a child in ${grade}${assign ? ` (+${assign.kind})` : ""}.`);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Support reply error:", error?.message || error);
    return res.status(500).json({ error: "Could not send the answer right now." });
  }
});

/* POST /api/class/:grade/assign { studentIds, text, assign } — work for a group. */
router.post("/class/:grade/assign", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.params.grade);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  const ids = (Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map((x: unknown) => clean(x, 40)).filter(Boolean).slice(0, 80);
  const assign = cleanAssign(req.body?.assign);
  const text = clean(req.body?.text, 600);
  if (!ids.length) return res.status(400).json({ error: "Choose at least one child." });
  if (!assign && !text) return res.status(400).json({ error: "Choose the work to give, or write a note." });
  try {
    const sent = await sendMessages(req, grade, ids, { text, assign });
    console.log(`[SUPPORT] ${req.appUser?.role} gave ${assign?.kind || "a note"} to ${sent.length} children in ${grade}.`);
    return res.json({ ok: true, sent: sent.length });
  } catch (error: any) {
    console.error("Assign error:", error?.message || error);
    return res.status(500).json({ error: "Could not give the work right now." });
  }
});

/* GET /api/student/messages — the signed-in child's answers and work from the teacher. */
router.get("/student/messages", requireFirebaseUser, requireRole(["student"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = ownStudentId(req);
  if (!id) return res.status(403).json({ error: "Not a student account." });
  try {
    const { db } = getFirebaseAdmin();
    const snap = await db.collection(MESSAGES).where("studentId", "==", id).limit(200).get();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const messages = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((m) => m.createdAt >= since)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        text: m.text,
        assign: m.assign || null,
        teacherName: m.teacherName,
        chapterTitle: m.chapterTitle || null,
        createdAt: m.createdAt,
        seenAt: m.seenAt || null,
        doneAt: m.doneAt || null,
      }));
    return res.json({ messages });
  } catch (error: any) {
    console.error("Student messages error:", error?.message || error);
    return res.status(500).json({ error: "Could not load messages." });
  }
});

/* POST /api/student/messages/:id { seen?: true, done?: true } */
router.post("/student/messages/:id", requireFirebaseUser, requireRole(["student"]), async (req: AuthenticatedRequest, res: Response) => {
  const id = ownStudentId(req);
  if (!id) return res.status(403).json({ error: "Not a student account." });
  try {
    const { db } = getFirebaseAdmin();
    const ref = db.collection(MESSAGES).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists || snap.get("studentId") !== id) return res.status(404).json({ error: "Message not found." });
    const now = new Date().toISOString();
    const update: Record<string, string> = {};
    if (req.body?.seen && !snap.get("seenAt")) update.seenAt = now;
    if (req.body?.done && !snap.get("doneAt")) update.doneAt = now;
    if (Object.keys(update).length) await ref.update(update);
    return res.json({ ok: true });
  } catch (error: any) {
    console.error("Student message update error:", error?.message || error);
    return res.status(500).json({ error: "Could not update the message." });
  }
});

export default router;
