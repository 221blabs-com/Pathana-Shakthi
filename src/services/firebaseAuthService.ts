import {
  createUserWithEmailAndPassword,
  getIdToken,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebase';
import { UserRole, UserSession } from '../types';

const requireAuth = () => {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error(
      'Firebase is not configured. Add the VITE_FIREBASE_* variables to .env.'
    );
  }

  return firebaseAuth;
};

const getBackendSession = async (
  credential: UserCredential
): Promise<UserSession> => {
  const idToken = await credential.user.getIdToken(true);

  const response = await fetch('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.session) {
    throw new Error(
      data.error ||
        'The Firebase account is not linked to a Pathana Shakthi profile.'
    );
  }

  return data.session as UserSession;
};

export const firebaseAuthService = {
  async loginWithPassword(
    email: string,
    password: string,
    role: Exclude<UserRole, 'student'>
  ): Promise<UserSession> {
    const auth = requireAuth();

    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    const session = await getBackendSession(credential);

    if (session.role !== role) {
      await signOut(auth);

      throw new Error(
        `This account is not authorized for the ${role} workspace.`
      );
    }

    return session;
  },

  async loginAsStudent(studentId: string): Promise<UserSession> {
    const auth = requireAuth();

    /*
     * Student accounts are passwordless.
     * They MUST use Firebase Anonymous Authentication.
     *
     * If a Faculty/Admin Firebase account is currently signed in,
     * sign it out first so we don't accidentally send a
     * non-anonymous token to the student-session endpoint.
     */
    if (auth.currentUser) {
      const isAnonymous = auth.currentUser.isAnonymous;

      if (!isAnonymous) {
        await signOut(auth);
      }
    }

    /*
     * Always create/reuse an anonymous Firebase user.
     */
    const credential = auth.currentUser
      ? {
          user: auth.currentUser,
        }
      : await signInAnonymously(auth);

    const user = credential.user;

    if (!user) {
      throw new Error(
        'Unable to establish a Firebase student session.'
      );
    }

    /*
     * Confirm that the Firebase user is actually anonymous.
     */
    if (!user.isAnonymous) {
      await signOut(auth);

      throw new Error(
        'Unable to establish a Firebase anonymous student session.'
      );
    }

    const idToken = await getIdToken(user, true);

    const response = await fetch('/api/auth/student-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        studentId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.session) {
      throw new Error(
        data.error || 'Unable to start the student session.'
      );
    }

    return data.session as UserSession;
  },

  async createFacultyAccount(
    email: string,
    password: string
  ): Promise<string> {
    const auth = requireAuth();

    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    return credential.user.uid;
  },

  async logout(): Promise<void> {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
  },
};