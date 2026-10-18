// Class 1–10 student roster for class + roll number login
// (POST /api/auth/student-login). Replaces the old sample `students` docs
// (which carried invented stats) with real, zeroed records.
//   npm run seed:students
import 'dotenv/config';
import { getFirebaseAdmin } from '../server/firebaseAdmin';

const SCHOOL_ID = 'school_telangana_ktr';
const SCHOOL_NAME = 'Zilla Parishad Primary School, Kothur';

type RosterEntry = { roll: number; name: string; avatar: string; gender: 'boy' | 'girl'; id?: string };

const ROSTER: Record<string, RosterEntry[]> = {
  'Class 1': [
    { roll: 1, name: 'Aarav Reddy', avatar: '👦', gender: 'boy' },
    { roll: 2, name: 'Diya Sharma', avatar: '👧', gender: 'girl' },
    { roll: 3, name: 'Kiran Naidu', avatar: '🧒', gender: 'boy' },
    { roll: 4, name: 'Pooja Goud', avatar: '👧', gender: 'girl' },
    { roll: 5, name: 'Sai Charan', avatar: '👦', gender: 'boy' },
  ],
  'Class 2': [
    { roll: 1, name: 'Meera Rao', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Rohan Varma', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Sana Begum', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Ganesh Yadav', avatar: '🧒', gender: 'boy' },
    { roll: 5, name: 'Keerthi Reddy', avatar: '👧', gender: 'girl' },
  ],
  'Class 3': [
    { roll: 1, name: 'Charan Teja', avatar: '👦', gender: 'boy' },
    { roll: 2, name: 'Lakshmi Priya', avatar: '👧', gender: 'girl' },
    { roll: 3, name: 'Vikram Singh', avatar: '🧒', gender: 'boy' },
    { roll: 4, name: 'Ayesha Fatima', avatar: '👧', gender: 'girl' },
    { roll: 5, name: 'Nikhil Kumar', avatar: '👦', gender: 'boy' },
  ],
  'Class 4': [
    { roll: 1, name: 'Anika Das', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Harsha Vardhan', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Zoya Khan', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Manoj Rathod', avatar: '🧒', gender: 'boy' },
    { roll: 5, name: 'Swathi Chary', avatar: '👧', gender: 'girl' },
  ],
  'Class 5': [
    { roll: 1, name: 'Sneha Patel', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Rahul Yadav', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Divya Sri', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Imran Shaik', avatar: '🧒', gender: 'boy' },
    { roll: 17, name: 'Arjun Kumar', avatar: '👦', gender: 'boy', id: 'PS20260017' },
  ],
  'Class 6': [
    { roll: 1, name: 'Bhavana Reddy', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Tarun Goud', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Nazia Begum', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Srikanth Naik', avatar: '🧒', gender: 'boy' },
    { roll: 5, name: 'Harini Rao', avatar: '👧', gender: 'girl' },
  ],
  'Class 7': [
    { roll: 1, name: 'Ajay Kumar', avatar: '👦', gender: 'boy' },
    { roll: 2, name: 'Pranavi Sharma', avatar: '👧', gender: 'girl' },
    { roll: 3, name: 'Sameer Shaik', avatar: '🧒', gender: 'boy' },
    { roll: 4, name: 'Vaishnavi Goud', avatar: '👧', gender: 'girl' },
    { roll: 5, name: 'Ravi Teja', avatar: '👦', gender: 'boy' },
  ],
  'Class 8': [
    { roll: 1, name: 'Sahithi Reddy', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Mahesh Yadav', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Fathima Khan', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Naveen Chary', avatar: '🧒', gender: 'boy' },
    { roll: 5, name: 'Sravani Naidu', avatar: '👧', gender: 'girl' },
  ],
  'Class 9': [
    { roll: 1, name: 'Akhil Varma', avatar: '👦', gender: 'boy' },
    { roll: 2, name: 'Deepika Rani', avatar: '👧', gender: 'girl' },
    { roll: 3, name: 'Arif Mohammed', avatar: '🧒', gender: 'boy' },
    { roll: 4, name: 'Spandana Rao', avatar: '👧', gender: 'girl' },
    { roll: 5, name: 'Venkatesh Naik', avatar: '👦', gender: 'boy' },
  ],
  'Class 10': [
    { roll: 1, name: 'Manasa Reddy', avatar: '👧', gender: 'girl' },
    { roll: 2, name: 'Karthik Goud', avatar: '👦', gender: 'boy' },
    { roll: 3, name: 'Shabana Begum', avatar: '👧', gender: 'girl' },
    { roll: 4, name: 'Prashanth Kumar', avatar: '🧒', gender: 'boy' },
    { roll: 5, name: 'Likhitha Sri', avatar: '👧', gender: 'girl' },
  ],
};

export const studentIdFor = (grade: string, roll: number) =>
  `PS2026${grade.replace(/\D/g, '')}${String(roll).padStart(3, '0')}`;

async function main() {
  const { db } = getFirebaseAdmin();
  const wanted = new Set<string>();
  for (const [grade, entries] of Object.entries(ROSTER)) {
    for (const e of entries) wanted.add(e.id || studentIdFor(grade, e.roll));
  }

  // Remove old sample students (and their login profiles) not in the roster.
  const existing = await db.collection('students').get();
  let removed = 0;
  for (const doc of existing.docs) {
    // Children added by a teacher or headmaster in the app are real; only
    // old sample records are removed.
    if (wanted.has(doc.id) || doc.get('addedBy')) continue;
    await db.collection('users').doc(`student_${doc.id}`).delete().catch(() => undefined);
    await doc.ref.delete();
    removed += 1;
  }

  const now = new Date().toISOString();
  let created = 0;
  for (const [grade, entries] of Object.entries(ROSTER)) {
    for (const e of entries) {
      const id = e.id || studentIdFor(grade, e.roll);
      const ref = db.collection('students').doc(id);
      const snap = await ref.get();
      // Identity fields are (re)written; progress fields only when new, so
      // re-running the seed never wipes a child's real progress.
      const identity = {
        id,
        name: e.name,
        grade,
        section: 'A',
        rollNumber: String(e.roll),
        avatar: e.avatar,
        gender: e.gender,
        schoolId: SCHOOL_ID,
        schoolName: SCHOOL_NAME,
        active: true,
        updatedAt: now,
      };
      const seeded = snap.exists && snap.get('seedVersion') === 2;
      const fresh = seeded
        ? {}
        : {
            seedVersion: 2,
            createdAt: now,
            stars: 0,
            streakDays: 0,
            lastActiveDate: '',
            completedStoryIds: [],
            totalMinutesRead: 0,
            overallAccuracy: 0,
            averageWPM: 0,
            sessionsCount: 0,
            labProgress: {},
            wordsPracticed: 0,
            dailyActivity: {},
            struggledWords: {},
          };
      // Old sample docs are replaced outright (their stats were invented).
      await ref.set({ ...identity, ...fresh }, { merge: seeded });
      created += 1;
    }
  }
  console.log(`Roster ready: ${created} students in Class 1–10 (${removed} old sample records removed).`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
