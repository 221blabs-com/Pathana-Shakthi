import { Router, Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin, isFirebaseAdminConfigured } from './firebaseAdmin';
import type { Query } from 'firebase-admin/firestore';
import { UserRole } from '../src/types';
import { cachedProfile } from './security';

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

    req.appUser = await cachedProfile(decoded.uid, async () => {
      const userSnap = await db.collection('users').doc(decoded.uid).get();
      return userSnap.exists ? userSnap.data() : null;
    });

    next();
  } catch (error: any) {
    console.error('Firebase auth middleware:', error?.code || error?.message || error);
    return res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
  }
}

// Like requireFirebaseUser, but lets the request through without a token
// (e.g. narration on the landing page). A token that is present but invalid
// is still rejected. Used so rate limits can key on the user when known.
export async function optionalFirebaseUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ') || !isFirebaseAdminConfigured()) return next();
  return requireFirebaseUser(req, res, next);
}

// Any signed-in account with a Pathana Shakthi profile (users/{uid}).
export function requireProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.appUser?.role) return res.status(403).json({ error: 'Please sign in again.' });
  next();
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

router.get('/curriculum', requireFirebaseUser, requireProfile, async (req: AuthenticatedRequest, res) => {
  const { db } = getFirebaseAdmin();
  const grade = typeof req.query.grade === 'string' ? req.query.grade : undefined;
  const subject = typeof req.query.subject === 'string' ? req.query.subject : undefined;

  let query: Query = db.collection('lessons');
  if (grade) query = query.where('grade', '==', grade);
  if (subject) query = query.where('subject', '==', subject);

  const snap = await query.orderBy('lessonNumber', 'asc').get();
  res.json({ lessons: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
});

router.get('/lessons/:lessonId', requireFirebaseUser, requireRole(['faculty', 'admin', 'superadmin']), async (req: AuthenticatedRequest, res) => {
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
