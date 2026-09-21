import { Router, Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin, isFirebaseAdminConfigured } from './firebaseAdmin';
import type { Query } from 'firebase-admin/firestore';
import { UserRole } from '../src/types';

export type AuthenticatedRequest = Request & {
  firebaseUser?: any;
  appUser?: any;
};

const router = Router();

function unavailable(res: Response) {
  return res.status(503).json({
    error: 'Firebase backend is not configured yet. Complete Firebase setup and restart the server.',
  });
}

export async function requireFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!isFirebaseAdminConfigured()) return unavailable(res);

  try {
    const authHeader = req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication token required.' });

    const { auth, db } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    req.firebaseUser = decoded;

    const userSnap = await db.collection('users').doc(decoded.uid).get();
    req.appUser = userSnap.exists ? userSnap.data() : null;

    next();
  } catch (error: any) {
    console.error('Firebase auth middleware:', error);
    return res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.appUser?.role as UserRole | undefined;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'You are not authorized for this resource.' });
    }
    next();
  };
}

router.get('/health', (_req, res) => {
  res.json({ firebaseConfigured: isFirebaseAdminConfigured() });
});

router.get('/auth/me', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const profile = req.appUser;
  if (!profile) return res.status(403).json({ error: 'No Pathana Shakthi profile is linked to this Firebase account.' });

  res.json({
    session: {
      ...profile,
      id: profile.id || req.firebaseUser.uid,
      createdAt: profile.createdAt || new Date().toISOString(),
    },
  });
});

router.post('/auth/student-session', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  // Passwordless student mode is intentionally kept for the current prototype.
  // Anonymous Firebase Auth proves possession of a device/session, while the
  // selected student profile comes from the seeded school roster.
  if (req.firebaseUser?.firebase?.sign_in_provider !== 'anonymous') {
    return res.status(403).json({ error: 'Student sessions must use Firebase anonymous authentication.' });
  }

  const studentId = String(req.body?.studentId || '').trim();
  if (!studentId) return res.status(400).json({ error: 'studentId is required.' });

  const { db } = getFirebaseAdmin();
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists) return res.status(404).json({ error: 'Student profile not found.' });

  const student = studentSnap.data()!;
  const session = {
    id: student.id,
    name: student.name,
    role: 'student' as const,
    rollNumber: student.rollNumber,
    avatar: student.avatar,
    schoolId: student.schoolId,
    schoolName: student.schoolName || student.villageSchool,
    grade: student.grade,
    createdAt: new Date().toISOString(),
  };

  res.json({ session });
});

router.get('/curriculum', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { db } = getFirebaseAdmin();
  const grade = typeof req.query.grade === 'string' ? req.query.grade : undefined;
  const subject = typeof req.query.subject === 'string' ? req.query.subject : undefined;

  let query: Query = db.collection('lessons');
  if (grade) query = query.where('grade', '==', grade);
  if (subject) query = query.where('subject', '==', subject);

  const snap = await query.orderBy('lessonNumber', 'asc').get();
  res.json({ lessons: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
});

router.get('/lessons/:lessonId', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const { db } = getFirebaseAdmin();
  const lessonRef = db.collection('lessons').doc(req.params.lessonId);
  const lessonSnap = await lessonRef.get();
  if (!lessonSnap.exists) return res.status(404).json({ error: 'Lesson not found.' });

  const lesson = { id: lessonSnap.id, ...lessonSnap.data() };
  const [challengeWords, diagnostics] = await Promise.all([
    lessonRef.collection('challengeWords').limit(50).get(),
    db.collection('readingSessions').where('lessonId', '==', req.params.lessonId).limit(200).get(),
  ]);

  res.json({
    lesson,
    diagnostics: {
      challengeWords: challengeWords.docs.map((d) => ({ id: d.id, ...d.data() })),
      readingSessions: diagnostics.docs.map((d) => ({ id: d.id, ...d.data() })),
    },
  });
});

router.post('/reading-sessions', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const role = req.appUser?.role as UserRole | undefined;
  if (role !== 'student' && role !== 'faculty' && role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to record reading sessions.' });
  }

  const session = req.body || {};
  if (!session.id || !session.studentId || !session.storyId) {
    return res.status(400).json({ error: 'Reading session requires id, studentId and storyId.' });
  }

  const { db } = getFirebaseAdmin();
  const ref = db.collection('readingSessions').doc(String(session.id));
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      ...session,
      synced: true,
      serverReceivedAt: new Date().toISOString(),
      createdByUid: req.firebaseUser.uid,
    });
  }

  res.json({ success: true, id: ref.id, duplicate: existing.exists });
});

router.post('/sync/reading-sessions', requireFirebaseUser, async (req: AuthenticatedRequest, res) => {
  const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
  if (!sessions.length) return res.json({ success: true, accepted: 0, duplicates: 0 });

  const { db } = getFirebaseAdmin();
  const writer = db.bulkWriter();
  let accepted = 0;
  let duplicates = 0;

  for (const session of sessions) {
    if (!session?.id || !session?.studentId || !session?.storyId) continue;
    const ref = db.collection('readingSessions').doc(String(session.id));
    const snap = await ref.get();
    if (snap.exists) {
      duplicates += 1;
      continue;
    }

    writer.set(ref, {
      ...session,
      synced: true,
      serverReceivedAt: new Date().toISOString(),
      createdByUid: req.firebaseUser.uid,
    });
    accepted += 1;
  }

  await writer.close();
  res.json({ success: true, accepted, duplicates });
});

router.get('/analytics/class/:grade', requireFirebaseUser, requireRole(['faculty', 'admin', 'superadmin']), async (req, res) => {
  const { db } = getFirebaseAdmin();
  const snap = await db.collection('readingSessions').where('gradeLevel', '==', req.params.grade).limit(1000).get();
  const sessions = snap.docs.map((d) => d.data());

  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  res.json({
    grade: req.params.grade,
    sessionCount: sessions.length,
    averageAccuracy: Number(avg(sessions.map((s: any) => Number(s.accuracyRate) || 0)).toFixed(1)),
    averageWpm: Number(avg(sessions.map((s: any) => Number(s.wpm) || 0)).toFixed(1)),
    totalMinutes: Math.round(sessions.reduce((sum: number, s: any) => sum + ((Number(s.durationSeconds) || 0) / 60), 0)),
  });
});

export default router;
