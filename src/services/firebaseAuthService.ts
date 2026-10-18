import {
  createUserWithEmailAndPassword,
  signInWithCustomToken,
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

// Firebase's own messages ("Firebase: Error (auth/invalid-credential).")
// mean nothing to a teacher; say what actually went wrong.
const friendlyAuthError = (error: unknown): Error => {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return new Error('Incorrect password or PIN. Please check it and try again.');
    case 'auth/too-many-requests':
      return new Error('Too many wrong attempts. Please wait a few minutes and try again.');
    case 'auth/network-request-failed':
      return new Error('No internet connection to the login server. Please check your network and try again.');
    case 'auth/user-disabled':
      return new Error('This account has been disabled. Please contact your school administrator.');
    default:
      return error instanceof Error ? error : new Error('Unable to sign in.');
  }
};

const isWrongCredential = (error: unknown) =>
  ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(
    (error as { code?: string })?.code || ''
  );

export const firebaseAuthService = {
  async loginWithPassword(
    email: string,
    password: string,
    role: Exclude<UserRole, 'student'>
  ): Promise<UserSession> {
    const auth = requireAuth();

    let credential: UserCredential;
    try {
      credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      // Phone keyboards often add a trailing space to a typed PIN.
      if (isWrongCredential(error) && password.trim() && password.trim() !== password) {
        try {
          credential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
        } catch (retryError) {
          throw friendlyAuthError(retryError);
        }
      } else {
        throw friendlyAuthError(error);
      }
    }

    const session = await getBackendSession(credential);

    if (session.role !== role) {
      await signOut(auth);

      throw new Error(
        `This account is not authorized for the ${role} workspace.`
      );
    }

    return session;
  },

  // Students sign in with their class and roll number. The server looks the
  // child up in the class roster and answers with a signed Firebase custom
  // token for that child's own account (uid student_<id>), so the browser
  // never gets to say which student it is.
  async loginStudentByRoll(grade: string, rollNumber: string): Promise<UserSession> {
    const auth = requireAuth();
    let response: Response;
    try {
      response = await fetch('/api/auth/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, rollNumber }),
      });
    } catch {
      throw new Error('No internet connection. Please check and try again.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token || !data.session) {
      throw new Error(data.error || 'Could not sign in right now. Please try again.');
    }
    if (auth.currentUser) await signOut(auth);
    await signInWithCustomToken(auth, data.token);
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