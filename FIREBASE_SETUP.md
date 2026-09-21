# Pathana Shakthi — Firebase Backend Setup

This project now has a Firebase-backed backend foundation using:

- Firebase Authentication for faculty/admin accounts
- Firebase Anonymous Authentication for the current passwordless student flow
- Cloud Firestore for schools, users, students, faculty, classes, lessons and reading sessions
- Firebase Admin SDK on the Express server for privileged reads/writes
- Firebase ID-token verification on protected API routes

## 1. Create the Firebase project

1. Open the Firebase Console.
2. Create a new project, for example `pathana-shakthi`.
3. Add a **Web App** to the project.
4. Copy the Firebase Web configuration values.

## 2. Enable Authentication

Firebase Console → Authentication → Sign-in method:

- Enable **Email/Password**
- Enable **Anonymous**

Email/Password is used for faculty/admin. Anonymous auth is used for the current passwordless student prototype.

## 3. Create Firestore

Firebase Console → Firestore Database → Create database.

Use the Standard edition for this application.

The repository includes `firestore.rules` and `firestore.indexes.json`.

## 4. Create a server credential

Firebase Console → Project Settings → Service Accounts → Firebase Admin SDK → Generate new private key.

Download the JSON file somewhere outside source control.

Do **not** commit this file.

## 5. Configure `.env`

Copy `.env.example` to `.env` and fill in:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\firebase-service-account.json

FIREBASE_SEED_PASSWORD=...
FIREBASE_ADMIN_EMAIL=headmaster.kothur@tg.gov.in
FIREBASE_SUPERADMIN_EMAIL=admin.director@pathanashakthi.edu
SUPERADMIN_URI_CODE=...
SUPERADMIN_DEFAULT_KEY=...
```

The `VITE_FIREBASE_*` values are client configuration. The service-account credentials are server-only and must never be exposed to Vite/client code.

## 6. Install dependencies

```powershell
npm install
```

This installs:

```text
firebase
firebase-admin
```

## 7. Seed the current demo data

After Firebase is configured:

```powershell
npm run seed:firebase
```

This seeds the existing schools, classes, students, faculty and the Class 1–5 curriculum with:

- English
- Hindi
- Telugu
- Mathematics
- Social Studies

It also creates/updates Firebase Authentication accounts for the faculty, admin and superadmin emails and assigns their role claims.

Change the seed password immediately after the first successful login.

## 8. Run the app

```powershell
npm run dev
```

The Express server remains on:

```text
http://localhost:3000
```

## Backend endpoints added

### Authentication

```text
GET  /api/auth/me
POST /api/auth/student-session
```

### Curriculum

```text
GET /api/curriculum
GET /api/lessons/:lessonId
```

Optional curriculum filters:

```text
/api/curriculum?grade=Class%202&subject=English
```

### Reading

```text
POST /api/reading-sessions
POST /api/sync/reading-sessions
```

### Analytics

```text
GET /api/analytics/class/:grade
```

## Security model

The browser signs in through Firebase Authentication and receives a Firebase ID token.

The Express backend verifies that token with the Firebase Admin SDK before allowing protected API access.

Firestore client access is intentionally denied by `firestore.rules`; application data access goes through the Express backend while the authorization layer is being established.

## Student passwordless note

The current product requirement is that students do not enter a password. Firebase Anonymous Auth is used to establish a real Firebase session for the device.

For a production school deployment, the next upgrade should be a **student enrollment code / QR code / classroom device binding** so a child cannot simply select another child's profile.
