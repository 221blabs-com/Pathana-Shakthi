// School dashboard for headmasters (admin) plus the management a real school
// needs without a seed script: the class roster (add a child, fix a name or
// roll number, move a class, deactivate) for teachers and admins, and teacher
// accounts (create, change classes, reset password, deactivate) for admins.
// Admins and teachers only ever see and change their own school.
import { Router, Response } from "express";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { effectiveReadingLevel, isReadingLevel } from "../src/data/readingLevels";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { AuthenticatedRequest, requireFirebaseUser, requireRole } from "./firebaseRoutes";
import { forgetRoster, studentUid, todayKey, VALID_GRADES } from "./studentRoutes";
import { forgetProfile, rateLimit } from "./security";

const router = Router();
const staff = [requireFirebaseUser, requireRole(["faculty", "admin", "superadmin"]), rateLimit("school", 90, 60_000)];
const admins = [requireFirebaseUser, requireRole(["admin", "superadmin"]), rateLimit("school-admin", 30, 60_000)];

const STUDENT_AVATARS = ["👦", "👧", "🧒"];
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/* ----------------------------- pure helpers ----------------------------- */

/** A person's name as typed by a teacher: letters (any script), spaces, . ' - */
export function cleanPersonName(value: unknown): string | null {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > 60) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name)) return null;
  return name;
}

/** "07" → "7"; null unless 1-9999. */
export function cleanRollNumber(value: unknown): string | null {
  const roll = String(value ?? "").trim().replace(/^0+(?=\d)/, "");
  return /^\d{1,4}$/.test(roll) && Number(roll) > 0 ? roll : null;
}

/** The smallest roll number not taken in a class. */
export function nextRollNumber(taken: string[]): string {
  const used = new Set(taken.map((r) => Number(r)).filter((n) => n > 0));
  let n = 1;
  while (used.has(n)) n += 1;
  return String(n);
}

export const cleanGrades = (value: unknown): string[] =>
  Array.isArray(value) ? VALID_GRADES.filter((g) => value.includes(g)) : [];

/** A temporary password a headmaster can read out: no 0/O/1/l/I. */
export function tempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export interface OverviewInput {
  days: string[]; // 14 day keys, oldest first
  students: Array<{ id: string; name: string; grade: string; active?: boolean; lastActiveDate?: string; overallAccuracy?: number; sessionsCount?: number; stars?: number; totalMinutesRead?: number }>;
  sessions: Array<{ studentId?: string; gradeLevel?: string; day?: string; date?: string; accuracyRate?: number }>;
  readings: Array<{ grade?: string; bookId?: string | null; bookTitle?: string; teacherId?: string; createdAt?: string }>;
  teachers: Array<{ uid: string; name: string; grades: string[]; active: boolean }>;
}

const sessionDay = (s: { day?: string; date?: string }) => s.day || String(s.date || "").slice(0, 10);
const bookKey = (r: { bookId?: string | null; bookTitle?: string; grade?: string }) => r.bookId || `${r.grade}|${r.bookTitle || "Textbook"}`;
const firstName = (name: string) => String(name || "").split(" ")[0];

/** School-wide numbers for the headmaster, from plain records (unit tested). */
export function buildSchoolOverview(input: OverviewInput) {
  const { days } = input;
  const weekAgo = days[Math.max(0, days.length - 7)];
  const students = input.students.filter((s) => s.active !== false);
  const recent = input.sessions.filter((s) => sessionDay(s) >= days[0]);

  const daily = days.map((day) => {
    const onDay = recent.filter((s) => sessionDay(s) === day);
    return { day, sessions: onDay.length, readers: new Set(onDay.map((s) => s.studentId)).size };
  });

  const classes = VALID_GRADES.map((grade) => {
    const inClass = students.filter((s) => s.grade === grade);
    const readers = inClass.filter((s) => (s.sessionsCount || 0) > 0);
    const books = new Set(input.readings.filter((r) => r.grade === grade).map(bookKey));
    return {
      grade,
      students: inClass.length,
      activeThisWeek: inClass.filter((s) => s.lastActiveDate && s.lastActiveDate >= weekAgo).length,
      readings14d: recent.filter((s) => s.gradeLevel === grade).length,
      averageAccuracy: readers.length ? Math.round(mean(readers.map((s) => s.overallAccuracy || 0))) : null,
      needHelp: readers.filter((s) => (s.overallAccuracy || 0) < 50).length,
      books: books.size,
      chapters: input.readings.filter((r) => r.grade === grade).length,
      teachers: input.teachers.filter((t) => t.active && t.grades.includes(grade)).map((t) => t.name),
    };
  });

  const teachers = input.teachers.map((t) => {
    const own = input.readings.filter((r) => r.teacherId === t.uid);
    const last = own.map((r) => r.createdAt || "").sort().pop() || "";
    return { ...t, books: new Set(own.map(bookKey)).size, chapters: own.length, lastPublishedAt: last || null };
  });

  const readers = students.filter((s) => (s.sessionsCount || 0) > 0);
  const totals = {
    students: students.length,
    activeThisWeek: students.filter((s) => s.lastActiveDate && s.lastActiveDate >= weekAgo).length,
    readings14d: recent.length,
    readingsTotal: input.sessions.length,
    averageAccuracy: readers.length ? Math.round(mean(readers.map((s) => s.overallAccuracy || 0))) : null,
    minutes: Math.round(students.reduce((sum, s) => sum + (s.totalMinutesRead || 0), 0)),
    stars: students.reduce((sum, s) => sum + (s.stars || 0), 0),
    books: new Set(input.readings.map(bookKey)).size,
    chapters: input.readings.length,
    teachers: input.teachers.filter((t) => t.active).length,
  };

  // Plain notes for the headmaster, from the numbers above only.
  const insights: Array<{ tone: "cheer" | "think" | "happy"; text: string }> = [];
  const noBooks = classes.filter((c) => c.students > 0 && c.books === 0).map((c) => c.grade);
  if (noBooks.length) insights.push({ tone: "think", text: `${noBooks.join(", ")} ${noBooks.length === 1 ? "has" : "have"} no published book yet — ask the class teacher to scan one.` });
  const quiet = classes.filter((c) => c.students > 0 && c.activeThisWeek === 0).map((c) => c.grade);
  if (quiet.length) insights.push({ tone: "think", text: `No child in ${quiet.join(", ")} practised this week.` });
  const noTeacher = classes.filter((c) => c.students > 0 && c.teachers.length === 0).map((c) => c.grade);
  if (noTeacher.length) insights.push({ tone: "think", text: `${noTeacher.join(", ")} ${noTeacher.length === 1 ? "has" : "have"} no class teacher assigned.` });
  const help = classes.reduce((sum, c) => sum + c.needHelp, 0);
  if (help) insights.push({ tone: "think", text: `${help} ${help === 1 ? "child reads" : "children read"} below 50% accuracy across the school.` });
  const best = [...classes].filter((c) => c.averageAccuracy !== null && c.activeThisWeek > 0).sort((a, b) => (b.averageAccuracy || 0) - (a.averageAccuracy || 0))[0];
  if (best && (best.averageAccuracy || 0) >= 70) insights.push({ tone: "cheer", text: `${best.grade} leads the school at ${best.averageAccuracy}% reading accuracy.` });
  const topTeacher = [...teachers].filter((t) => t.chapters > 0).sort((a, b) => b.chapters - a.chapters)[0];
  if (topTeacher) insights.push({ tone: "happy", text: `${topTeacher.name} has published the most: ${topTeacher.books} ${topTeacher.books === 1 ? "book" : "books"}, ${topTeacher.chapters} chapters.` });
  if (!input.sessions.length) insights.push({ tone: "happy", text: "No readings yet. Children sign in with their class and roll number; publish a book for each class to get started." });

  return { totals, daily, classes, teachers, insights };
}

/* ------------------------------- scoping -------------------------------- */

// Admins and teachers act on their own school. Superadmin may name one
// (?schoolId=), otherwise the first school on record.
async function resolveSchool(req: AuthenticatedRequest): Promise<{ id: string; name: string } | null> {
  const { db } = getFirebaseAdmin();
  const own = req.appUser?.schoolId;
  if (req.appUser?.role !== "superadmin") return own ? { id: own, name: req.appUser?.schoolName || "" } : null;
  const asked = String(req.query.schoolId || req.body?.schoolId || "");
  const snap = asked ? await db.collection("schools").doc(asked).get() : null;
  if (snap?.exists) return { id: snap.id, name: snap.get("name") || "" };
  const first = await db.collection("schools").limit(1).get();
  return first.empty ? null : { id: first.docs[0].id, name: first.docs[0].get("name") || "" };
}

// Seeded teachers carry their classes in faculty/{id}; teachers created here
// carry them on users/{uid}.grades.
async function loadTeachers(schoolId: string) {
  const { db, auth } = getFirebaseAdmin();
  const [userSnap, facultySnap] = await Promise.all([
    db.collection("users").where("schoolId", "==", schoolId).get(),
    db.collection("faculty").where("schoolId", "==", schoolId).get(),
  ]);
  const gradesByEmail = new Map<string, string[]>();
  for (const d of facultySnap.docs) gradesByEmail.set(String(d.get("email") || "").toLowerCase(), cleanGrades(d.get("assignedGrades")));
  const docs = userSnap.docs.filter((d) => d.get("role") === "faculty");
  const signIns = new Map<string, string>();
  if (docs.length) {
    try {
      const found = await auth.getUsers(docs.slice(0, 100).map((d) => ({ uid: d.id })));
      for (const u of found.users) signIns.set(u.uid, u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : "");
    } catch {
      /* sign-in times are a nice-to-have */
    }
  }
  return docs
    .map((d) => {
      const email = String(d.get("email") || "");
      const grades = Array.isArray(d.get("grades")) ? cleanGrades(d.get("grades")) : gradesByEmail.get(email.toLowerCase()) || [];
      return {
        uid: d.id,
        name: String(d.get("name") || email),
        email,
        avatar: d.get("avatar") || "👩‍🏫",
        designation: d.get("designation") || "Teacher",
        grades,
        active: d.get("active") !== false,
        lastSignInAt: signIns.get(d.id) || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const lastDays = (n: number, now = new Date()) =>
  Array.from({ length: n }, (_, i) => todayKey(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));

/* -------------------------------- routes -------------------------------- */

router.get("/school/overview", ...admins, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const school = await resolveSchool(req);
    if (!school) return res.status(404).json({ error: "Your account is not linked to a school." });
    const { db } = getFirebaseAdmin();
    const [schoolSnap, studentSnap, sessionSnap, readingSnap, teachers] = await Promise.all([
      db.collection("schools").doc(school.id).get(),
      db.collection("students").where("schoolId", "==", school.id).get(),
      db.collection("readingSessions").where("schoolId", "==", school.id).limit(5000).get(),
      db.collection("publishedReadings").where("schoolId", "==", school.id).select("grade", "bookId", "bookTitle", "teacherId", "createdAt").get(),
      loadTeachers(school.id),
    ]);
    const overview = buildSchoolOverview({
      days: lastDays(14),
      students: studentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
      sessions: sessionSnap.docs.map((d) => d.data() as any),
      readings: readingSnap.docs.map((d) => d.data() as any),
      teachers,
    });
    const s = schoolSnap.exists ? schoolSnap.data() || {} : {};
    return res.json({
      school: {
        id: school.id,
        name: s.name || school.name || "Your School",
        code: s.code || "",
        district: s.district || "",
        state: s.state || "",
        board: s.board || "",
        headmasterName: s.headmasterName || "",
      },
      ...overview,
    });
  } catch (error: any) {
    console.error("School overview error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the school dashboard right now." });
  }
});

// Full roster of one class (names, roll numbers, status) for teachers/admins.
router.get("/school/students", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.query.grade || "");
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Unknown class." });
  try {
    const school = await resolveSchool(req);
    if (!school) return res.status(404).json({ error: "Your account is not linked to a school." });
    const { db } = getFirebaseAdmin();
    const snap = await db.collection("students").where("grade", "==", grade).where("schoolId", "==", school.id).get();
    const students = snap.docs
      .map((d) => ({
        id: d.id,
        name: String(d.get("name") || ""),
        rollNumber: String(d.get("rollNumber") || ""),
        avatar: d.get("avatar") || "🧒",
        active: d.get("active") !== false,
        lastActiveDate: d.get("lastActiveDate") || "",
        sessionsCount: d.get("sessionsCount") || 0,
      }))
      .sort((a, b) => Number(a.active === b.active ? 0 : a.active ? -1 : 1) || Number(a.rollNumber) - Number(b.rollNumber));
    // Roll numbers are unique per class across schools: sign-in asks only for class + roll.
    const taken = await db.collection("students").where("grade", "==", grade).select("rollNumber", "active").get();
    const nextRoll = nextRollNumber(taken.docs.filter((d) => d.get("active") !== false).map((d) => String(d.get("rollNumber") || "")));
    return res.json({ grade, students, nextRoll });
  } catch (error: any) {
    console.error("Roster error:", error?.message || error);
    return res.status(500).json({ error: "Could not load the class list." });
  }
});

async function rollTaken(grade: string, roll: string, exceptId?: string): Promise<boolean> {
  const { db } = getFirebaseAdmin();
  const snap = await db.collection("students").where("grade", "==", grade).where("rollNumber", "==", roll).get();
  return snap.docs.some((d) => d.id !== exceptId && d.get("active") !== false);
}

router.post("/school/students", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  const grade = String(req.body?.grade || "");
  const name = cleanPersonName(req.body?.name);
  const roll = cleanRollNumber(req.body?.rollNumber);
  const avatar = STUDENT_AVATARS.includes(req.body?.avatar) ? req.body.avatar : "🧒";
  if (!VALID_GRADES.includes(grade)) return res.status(400).json({ error: "Choose a class." });
  if (!name) return res.status(400).json({ error: "Type the child's name (letters only, 2-60 characters)." });
  if (!roll) return res.status(400).json({ error: "Roll number must be a number from 1 to 9999." });
  try {
    const school = await resolveSchool(req);
    if (!school) return res.status(404).json({ error: "Your account is not linked to a school." });
    if (await rollTaken(grade, roll)) return res.status(409).json({ error: `Roll number ${roll} is already used in ${grade}.` });
    const { db } = getFirebaseAdmin();
    const base = `PS2026${grade.replace(/\D/g, "")}${roll.padStart(3, "0")}`;
    let ref = db.collection("students").doc(base);
    if ((await ref.get()).exists) ref = db.collection("students").doc(`${base}_${randomBytes(3).toString("hex")}`);
    const now = new Date().toISOString();
    await ref.set({
      id: ref.id,
      name,
      grade,
      section: "A",
      rollNumber: roll,
      avatar,
      gender: avatar === "👧" ? "girl" : avatar === "👦" ? "boy" : "",
      schoolId: school.id,
      schoolName: school.name,
      active: true,
      addedBy: req.firebaseUser.uid,
      createdAt: now,
      updatedAt: now,
      stars: 0,
      streakDays: 0,
      lastActiveDate: "",
      completedStoryIds: [],
      totalMinutesRead: 0,
      overallAccuracy: 0,
      averageWPM: 0,
      sessionsCount: 0,
      labProgress: {},
      wordsPracticed: 0,
      dailyActivity: {},
      struggledWords: {},
    });
    forgetRoster(grade);
    console.log(`[SCHOOL] ${req.appUser?.role} added ${grade} roll ${roll} (${ref.id}).`);
    return res.json({ student: { id: ref.id, name, grade, rollNumber: roll, avatar, active: true, lastActiveDate: "", sessionsCount: 0 } });
  } catch (error: any) {
    console.error("Add student error:", error?.message || error);
    return res.status(500).json({ error: "Could not add the student right now." });
  }
});

router.patch("/school/students/:id", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const school = await resolveSchool(req);
    const { db, auth } = getFirebaseAdmin();
    const ref = db.collection("students").doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists || !school || snap.get("schoolId") !== school.id) return res.status(404).json({ error: "Student not found in your school." });
    const current = snap.data() || {};
    const update: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const name = cleanPersonName(req.body.name);
      if (!name) return res.status(400).json({ error: "Type the child's name (letters only, 2-60 characters)." });
      update.name = name;
    }
    if (req.body?.grade !== undefined) {
      if (!VALID_GRADES.includes(String(req.body.grade))) return res.status(400).json({ error: "Choose a class." });
      update.grade = String(req.body.grade);
    }
    if (req.body?.rollNumber !== undefined) {
      const roll = cleanRollNumber(req.body.rollNumber);
      if (!roll) return res.status(400).json({ error: "Roll number must be a number from 1 to 9999." });
      update.rollNumber = roll;
    }
    if (STUDENT_AVATARS.includes(req.body?.avatar)) update.avatar = req.body.avatar;
    if (typeof req.body?.active === "boolean") update.active = req.body.active;
    // Reading level (multi-level teaching): a level, or "auto" to follow the child's readings.
    if (req.body?.readingLevel !== undefined) {
      if (req.body.readingLevel === "auto") update.readingLevel = FieldValue.delete();
      else if (isReadingLevel(req.body.readingLevel)) update.readingLevel = req.body.readingLevel;
      else return res.status(400).json({ error: "Choose a reading level." });
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to change." });

    const grade = String(update.grade ?? current.grade);
    const roll = String(update.rollNumber ?? current.rollNumber);
    const willBeActive = (update.active ?? current.active) !== false;
    if (willBeActive && (update.grade || update.rollNumber || update.active === true) && (await rollTaken(grade, roll, snap.id))) {
      return res.status(409).json({ error: `Roll number ${roll} is already used in ${grade}.` });
    }
    update.updatedAt = new Date().toISOString();
    await ref.update(update);

    // Keep the sign-in profile in step: class/name drive what the child sees,
    // and a deactivated child is signed out.
    const uid = studentUid(snap.id);
    const profile: Record<string, unknown> = { grade, rollNumber: roll, active: willBeActive };
    if (update.name) profile.name = update.name;
    if (update.avatar) profile.avatar = update.avatar;
    const userRef = db.collection("users").doc(uid);
    if ((await userRef.get()).exists) await userRef.set(profile, { merge: true });
    forgetProfile(uid);
    if (!willBeActive) await auth.revokeRefreshTokens(uid).catch(() => undefined);
    forgetRoster(String(current.grade));
    forgetRoster(grade);
    console.log(`[SCHOOL] ${req.appUser?.role} updated student ${snap.id}: ${Object.keys(update).filter((k) => k !== "updatedAt").join(", ")}.`);
    const after: Record<string, any> = { ...current, ...update };
    if (req.body?.readingLevel === "auto") delete after.readingLevel;
    return res.json({
      student: {
        id: snap.id,
        name: after.name,
        grade: after.grade,
        rollNumber: String(after.rollNumber),
        avatar: after.avatar || "🧒",
        active: after.active !== false,
        lastActiveDate: after.lastActiveDate || "",
        sessionsCount: after.sessionsCount || 0,
        readingLevelSet: isReadingLevel(after.readingLevel) ? after.readingLevel : null,
        readingLevel: effectiveReadingLevel(after, String(after.grade)),
      },
    });
  } catch (error: any) {
    console.error("Update student error:", error?.message || error);
    return res.status(500).json({ error: "Could not update the student right now." });
  }
});

// The classes a signed-in teacher teaches (their dashboard opens on the first).
router.get("/school/my-classes", ...staff, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.appUser?.role !== "faculty") return res.json({ grades: VALID_GRADES });
    if (Array.isArray(req.appUser?.grades)) return res.json({ grades: cleanGrades(req.appUser.grades) });
    const { db } = getFirebaseAdmin();
    const email = String(req.appUser?.email || req.firebaseUser?.email || "");
    const snap = email ? await db.collection("faculty").where("email", "==", email).limit(1).get() : null;
    return res.json({ grades: snap && !snap.empty ? cleanGrades(snap.docs[0].get("assignedGrades")) : [] });
  } catch (error: any) {
    console.error("My classes error:", error?.message || error);
    return res.json({ grades: [] });
  }
});

router.post("/school/teachers", ...admins, async (req: AuthenticatedRequest, res: Response) => {
  const name = cleanPersonName(req.body?.name);
  const email = String(req.body?.email || "").trim().toLowerCase();
  const grades = cleanGrades(req.body?.grades);
  const designation = String(req.body?.designation || "Class Teacher").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Type the teacher's name (letters only, 2-60 characters)." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return res.status(400).json({ error: "Type a valid email address." });
  if (!grades.length) return res.status(400).json({ error: "Choose at least one class." });
  try {
    const school = await resolveSchool(req);
    if (!school) return res.status(404).json({ error: "Your account is not linked to a school." });
    const { auth, db } = getFirebaseAdmin();
    const exists = await auth.getUserByEmail(email).then(() => true, () => false);
    if (exists) return res.status(409).json({ error: "This email already has an account." });
    const password = tempPassword();
    const user = await auth.createUser({ email, password, displayName: name });
    await auth.setCustomUserClaims(user.uid, { role: "faculty" });
    const now = new Date().toISOString();
    await db.collection("users").doc(user.uid).set({
      id: user.uid,
      email,
      role: "faculty",
      name,
      avatar: "👩‍🏫",
      designation,
      grades,
      schoolId: school.id,
      schoolName: school.name,
      active: true,
      createdBy: req.firebaseUser.uid,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[SCHOOL] ${req.appUser?.role} created teacher ${user.uid} for ${grades.join(", ")}.`);
    return res.json({
      teacher: { uid: user.uid, name, email, avatar: "👩‍🏫", designation, grades, active: true, lastSignInAt: null },
      temporaryPassword: password,
    });
  } catch (error: any) {
    console.error("Create teacher error:", error?.code || error?.message || error);
    return res.status(500).json({ error: "Could not create the teacher account right now." });
  }
});

router.patch("/school/teachers/:uid", ...admins, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const school = await resolveSchool(req);
    const { auth, db } = getFirebaseAdmin();
    const uid = String(req.params.uid);
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists || snap.get("role") !== "faculty" || !school || snap.get("schoolId") !== school.id) {
      return res.status(404).json({ error: "Teacher not found in your school." });
    }
    const update: Record<string, unknown> = {};
    if (req.body?.grades !== undefined) {
      const grades = cleanGrades(req.body.grades);
      if (!grades.length) return res.status(400).json({ error: "Choose at least one class." });
      update.grades = grades;
    }
    if (typeof req.body?.active === "boolean") update.active = req.body.active;
    let password: string | null = null;
    if (req.body?.resetPassword === true) password = tempPassword();
    if (!Object.keys(update).length && !password) return res.status(400).json({ error: "Nothing to change." });

    if (typeof update.active === "boolean") {
      await auth.updateUser(uid, { disabled: !update.active });
      if (!update.active) await auth.revokeRefreshTokens(uid);
    }
    if (password) {
      await auth.updateUser(uid, { password });
      await auth.revokeRefreshTokens(uid);
    }
    if (Object.keys(update).length) await ref.update({ ...update, updatedAt: new Date().toISOString() });
    forgetProfile(uid);
    console.log(`[SCHOOL] ${req.appUser?.role} updated teacher ${uid}: ${[...Object.keys(update), password ? "password" : ""].filter(Boolean).join(", ")}.`);
    const teachers = await loadTeachers(school.id);
    return res.json({ teacher: teachers.find((t) => t.uid === uid) || null, temporaryPassword: password });
  } catch (error: any) {
    console.error("Update teacher error:", error?.code || error?.message || error);
    return res.status(500).json({ error: "Could not update the teacher right now." });
  }
});

export default router;
