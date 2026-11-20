import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasClientConfig = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = hasClientConfig
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

// Local testing only (Firebase emulators): set VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 at build time.
const authEmulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (firebaseAuth && authEmulator) connectAuthEmulator(firebaseAuth, `http://${authEmulator}`, { disableWarnings: true });

export const isFirebaseConfigured = hasClientConfig;
