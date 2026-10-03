// Student accounts: login with class + roll number (server-issued Firebase
// custom token, so the student's identity comes from a signed token and not
// from anything the browser says), the student's own progress, and recording
// activity (readings, games, word practice) into Firestore. Teachers read it
// through the class dashboard (classRoutes.ts).
import { Router, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin, isFirebaseAdminConfigured } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { forgetProfile, rateLimit } from "./security";

export const VALID_GRADES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
const router = Router();

const clampNumber = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const cleanString = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export function studentUid(studentId: string) {
  return `student_${studentId}`;
}

// The public part of a student record (no internal fields).
export function studentView(id: string, s: any) {
  return {
    id,
    name: s.name,
    grade: s.grade,
    rollNumber: String(s.rollNumber ?? ""),
    avatar: s.avatar || "🧒",
    schoolId: s.schoolId || null,
    schoolName: s.schoolName || "",
    stars: s.stars || 0,
    streakDays: s.streakDays || 0,
    lastActiveDate: s.lastActiveDate || "",
    completedStoryIds: s.completedStoryIds || [],
    totalMinutesRead: s.totalMinutesRead || 0,
    overallAccuracy: s.overallAccuracy || 0,
    averageWPM: s.averageWPM || 0,
    sessionsCount: s.sessionsCount || 0,
    labProgress: s.labProgress || {},
    wordsPracticed: s.wordsPracticed || 0,
    dailyActivity: s.dailyActivity || {},
  };
}

/* ---------------------------------------------------------------
   GET /api/auth/class-roster?grade=Class 3
   Who is in a class, for the sign-in screen: first name + initial, roll
   number and avatar only (no ids, no full names, no progress), cached and
   rate limited, so a child can find their own name without an account.
---------------------------------------------------------------- */
const rosterCache = new Map<string, { at: number; students: any[] }>();
export const forgetRoster = (grade: string) => rosterCache.delete(grade);
export const shortName = (name: string) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};
router.get("/auth/class-roster", rateLimit("class-roster", 30, 60_000), async (req, res: Response) => {
  if (!isFirebaseAdminConfigured()) return res.status(503).json({ error: "Student login is not available right now." });
  const grade = cleanString(req.query.grade, 20);
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  const hit = rosterCache.get(grade);
  if (hit && Date.now() - hit.at < 60_000) return res.json({ grade, students: hit.students });
  try {
    const { db } = getFirebaseAdmin();
    const snap = await db.collection("students").where("grade", "==", grade).get();
    const students = snap.docs
      .filter((d) => d.get("active") !== false)
      .map((d) => ({ rollNumber: String(d.get("rollNumber") || ""), name: shortName(d.get("name")), avatar: d.get("avatar") || "🧒" }))
      .filter((s) => s.rollNumber)
      .sort((a, b) => Number(a.rollNumber) - Number(b.rollNumber));
    rosterCache.set(grade, { at: Date.now(), students });
    return res.json({ grade, students });
  } catch (error: any) {
    console.error("Class roster error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the class list." });
  }
});

/* ---------------------------------------------------------------
   POST /api/auth/student-login  { grade: "Class 3", rollNumber: "2" }
---------------------------------------------------------------- */
router.post("/auth/student-login", rateLimit("student-login", 12, 60_000), async (req, res: Response) => {
  if (!isFirebaseAdminConfigured()) return res.status(503).json({ error: "Student login is not available right now." });
  const grade = cleanString(req.body?.grade, 20);
  const roll = cleanString(req.body?.rollNumber, 10).replace(/^0+(?=\d)/, "");
  if (!VALID_GRADES.includes(grade) || !/^\d{1,4}$/.test(roll)) {
    return res.status(400).json({ error: "Choose your class and type your roll number." });
  }
  try {
    const { auth, db } = getFirebaseAdmin();
    const snap = await db
      .collection("students")
      .where("grade", "==", grade)
      .where("rollNumber", "==", roll)
      .limit(2)
      .get();
    const doc = snap.docs.find((d) => d.get("active") !== false);
    if (!doc) {
      return res.status(404).json({ error: `No student with roll number ${roll} in ${grade}. Check with your teacher.` });
    }
    const s = doc.data();
    const uid = studentUid(doc.id);
    // The users/{uid} profile is what every protected route authorizes on.
    await db.collection("users").doc(uid).set(
      {
        id: doc.id,
        uid,
        role: "student",
        name: s.name,
        grade: s.grade,
        rollNumber: roll,
        avatar: s.avatar || "🧒",
        schoolId: s.schoolId || null,
        schoolName: s.schoolName || "",
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
    forgetProfile(uid);
    const token = await auth.createCustomToken(uid, { role: "student", studentId: doc.id, grade: s.grade });
    console.log(`[AUTH] Student login ${grade} roll ${roll} (${doc.id}).`);
    return res.json({
      token,
      session: {
        id: doc.id,
        name: s.name,
        role: "student",
        rollNumber: roll,
        avatar: s.avatar || "🧒",
        schoolId: s.schoolId || null,
        schoolName: s.schoolName || "",
        grade: s.grade,
        createdAt: new Date().toISOString(),
      },
      student: studentView(doc.id, s),
    });
  } catch (error: any) {
    console.error("Student login error:", error?.message || error);
    return res.status(500).json({ error: "Could not sign in right now. Please try again." });
  }
});

// The child's own calendar day (India is UTC+5:30, so a UTC day would split
// a school morning). Accepted only within a day of the server's clock.
function clientDay(value: unknown, now: Date): string {
  const v = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const t = Date.parse(`${v}T12:00:00Z`);
    if (Number.isFinite(t) && Math.abs(t - now.getTime()) <= 36 * 3_600_000) return v;
  }
  return todayKey(now);
}

// Any activity on a new day extends (or restarts) the streak.
function nextStreak(s: any, day: string, _now: Date): number {
  const yesterday = todayKey(new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000));
  if (s.lastActiveDate === day) return s.streakDays || 1;
  return s.lastActiveDate === yesterday ? (s.streakDays || 0) + 1 : 1;
}

// Students may only act as themselves: the id comes from their profile.
function ownStudentId(req: AuthenticatedRequest): string | null {
  return req.appUser?.role === "student" ? String(req.appUser.id || "") || null : null;
}

router.get("/student/me", requireFirebaseUser, requireRole(["student"]), async (req: AuthenticatedRequest, res) => {
  const id = ownStudentId(req);
  if (!id) return res.status(403).json({ error: "Not a student account." });
  const { db } = getFirebaseAdmin();
  const snap = await db.collection("students").doc(id).get();
  if (!snap.exists) return res.status(404).json({ error: "Student record not found." });
  return res.json({ student: studentView(snap.id, snap.data()) });
});

/* ---------------------------------------------------------------
   POST /api/student/activity
   { type: "reading", id, storyId, storyTitle, subject, language, accuracyRate,
     wpm, durationSeconds, wordsRead, totalWords, starsEarned, struggledWords }
   { type: "game", chapterId, subject, score, total, stars }
   { type: "word", word, language, accuracy }
   { type: "quiz", storyId, correct, total }
   Values are clamped; the student and class come from the signed-in profile.
---------------------------------------------------------------- */
router.post(
  "/student/activity",
  requireFirebaseUser,
  requireRole(["student"]),
  rateLimit("student-activity", 90, 60_000),
  async (req: AuthenticatedRequest, res) => {
    const id = ownStudentId(req);
    if (!id) return res.status(403).json({ error: "Not a student account." });
    const body = req.body || {};
    const type = String(body.type || "");
    const { db } = getFirebaseAdmin();
    const studentRef = db.collection("students").doc(id);
    const grade = String(req.appUser.grade || "");
    const now = new Date();
    const day = clientDay(body.day, now);

    try {
      if (type === "reading") {
        const sessionId = cleanString(body.id, 80) || `log_${now.getTime()}`;
        const session = {
          id: sessionId,
          studentId: id,
          studentName: req.appUser.name || "",
          schoolId: req.appUser.schoolId || null,
          gradeLevel: grade,
          storyId: cleanString(body.storyId, 120),
          storyTitle: cleanString(body.storyTitle, 160),
          subject: cleanString(body.subject, 40),
          language: cleanString(body.language, 20),
          accuracyRate: Math.round(clampNumber(body.accuracyRate, 0, 100)),
          wpm: Math.round(clampNumber(body.wpm, 0, 300)),
          durationSeconds: Math.round(clampNumber(body.durationSeconds, 0, 3600)),
          wordsRead: Math.round(clampNumber(body.wordsRead, 0, 5000)),
          totalWords: Math.round(clampNumber(body.totalWords, 0, 5000)),
          starsEarned: Math.round(clampNumber(body.starsEarned, 0, 100)),
          struggledWords: (Array.isArray(body.struggledWords) ? body.struggledWords : [])
            .slice(0, 30)
            .map((w: unknown) => cleanString(w, 40))
            .filter(Boolean),
          date: now.toISOString(),
          day,
          synced: true,
          createdByUid: req.firebaseUser.uid,
        };
        if (!session.storyId) return res.status(400).json({ error: "storyId is required." });
        const sessionRef = db.collection("readingSessions").doc(`${id}_${sessionId}`.slice(0, 150));
        await db.runTransaction(async (tx) => {
          const [existing, studentSnap] = await Promise.all([tx.get(sessionRef), tx.get(studentRef)]);
          if (existing.exists) return; // replayed from the offline queue
          const s = studentSnap.data() || {};
          const count = (s.sessionsCount || 0) + 1;
          const mean = (old: number, value: number) => Math.round(((old || 0) * (count - 1) + value) / count);
          const struggled: Record<string, number> = { ...(s.struggledWords || {}) };
          for (const w of session.struggledWords) struggled[w] = (struggled[w] || 0) + 1;
          const top = Object.entries(struggled).sort((a, b) => b[1] - a[1]).slice(0, 60);
          const streak = nextStreak(s, day, now);
          tx.set(sessionRef, session);
          if (!studentSnap.exists) throw new Error("Student record not found.");
          // update() (not set) so the dotted dailyActivity key is a field path
          // and struggledWords is replaced by the pruned top-60 map.
          tx.update(
            studentRef,
            {
              sessionsCount: count,
              stars: (s.stars || 0) + session.starsEarned,
              totalMinutesRead: Math.round(((s.totalMinutesRead || 0) + session.durationSeconds / 60) * 10) / 10,
              overallAccuracy: mean(s.overallAccuracy, session.accuracyRate),
              averageWPM: mean(s.averageWPM, session.wpm),
              completedStoryIds: FieldValue.arrayUnion(session.storyId),
              struggledWords: Object.fromEntries(top),
              lastActiveDate: day,
              streakDays: streak,
              [`dailyActivity.${day}`]: FieldValue.arrayUnion(`read_${session.storyId}`),
              updatedAt: now.toISOString(),
            }
          );
        });
      } else if (type === "game") {
        const chapterId = cleanString(body.chapterId, 60);
        if (!/^[a-z0-9-]+$/.test(chapterId)) return res.status(400).json({ error: "Invalid chapter." });
        const total = Math.round(clampNumber(body.total, 1, 50));
        const score = Math.round(clampNumber(body.score, 0, total));
        const stars = Math.round(clampNumber(body.stars, 0, 3));
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(studentRef);
          if (!snap.exists) throw new Error("Student record not found.");
          const s = snap.data() || {};
          const previous = s.labProgress?.[chapterId] || {};
          const gained = Math.max(0, stars - (previous.stars || 0));
          tx.update(studentRef, {
            [`labProgress.${chapterId}`]: {
              stars: Math.max(previous.stars || 0, stars),
              bestScore: Math.max(previous.bestScore || 0, score),
              total,
              plays: (previous.plays || 0) + 1,
              subject: cleanString(body.subject, 30) || previous.subject || "",
              updatedAt: now.toISOString(),
            },
            stars: (s.stars || 0) + gained * 5,
            lastActiveDate: day,
            streakDays: nextStreak(s, day, now),
            [`dailyActivity.${day}`]: FieldValue.arrayUnion(`game_${chapterId}`),
            updatedAt: now.toISOString(),
          });
        });
      } else if (type === "quiz") {
        // Bonus for a story's quiz: 5 stars per right answer + 10 for
        // finishing, once per story per day (retakes earn nothing more).
        const storyId = cleanString(body.storyId, 120);
        if (!storyId) return res.status(400).json({ error: "storyId is required." });
        const total = Math.round(clampNumber(body.total, 1, 10));
        const correct = Math.round(clampNumber(body.correct, 0, total));
        const marker = `quiz_${storyId}`.slice(0, 140);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(studentRef);
          if (!snap.exists) throw new Error("Student record not found.");
          const s = snap.data() || {};
          const already = ((s.dailyActivity?.[day] || []) as string[]).includes(marker);
          tx.update(studentRef, {
            stars: (s.stars || 0) + (already ? 0 : correct * 5 + 10),
            lastActiveDate: day,
            streakDays: nextStreak(s, day, now),
            [`dailyActivity.${day}`]: FieldValue.arrayUnion(marker),
            updatedAt: now.toISOString(),
          });
        });
      } else if (type === "word") {
        const word = cleanString(body.word, 40);
        if (!word) return res.status(400).json({ error: "word is required." });
        const accuracy = Math.round(clampNumber(body.accuracy, 0, 100));
        await db.collection("wordPractice").add({
          studentId: id,
          schoolId: req.appUser.schoolId || null,
          gradeLevel: grade,
          word,
          language: cleanString(body.language, 20),
          accuracy,
          date: now.toISOString(),
          day,
        });
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(studentRef);
          if (!snap.exists) throw new Error("Student record not found.");
          tx.update(studentRef, {
            wordsPracticed: FieldValue.increment(1),
            // A well-said word earns a star, at most 10 a day from words.
            stars: FieldValue.increment(accuracy >= 60 && ((snap.get(`dailyActivity.${day}`) || []) as string[]).filter((x) => x.startsWith("word_")).length < 10 ? 1 : 0),
            lastActiveDate: day,
            streakDays: nextStreak(snap.data() || {}, day, now),
            [`dailyActivity.${day}`]: FieldValue.arrayUnion(`words_${day}`, ...(accuracy >= 60 ? [`word_${word}`.slice(0, 50)] : [])),
            updatedAt: now.toISOString(),
          });
        });
      } else {
        return res.status(400).json({ error: "Unknown activity type." });
      }
      const updated = await studentRef.get();
      return res.json({ success: true, student: studentView(updated.id, updated.data()) });
    } catch (error: any) {
      console.error("Student activity error:", error?.message || error);
      return res.status(500).json({ error: "Could not save your progress right now." });
    }
  }
);

export default router;
