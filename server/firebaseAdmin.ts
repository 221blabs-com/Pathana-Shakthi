import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let initialized = false;

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  );
}

export function getFirebaseAdmin() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_SERVICE_ACCOUNT_JSON).',
    );
  }

  if (!getApps().length && !initialized) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    initialized = true;
  }

  return {
    auth: getAuth(),
    db: getFirestore(),
  };
}
