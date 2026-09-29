import 'dotenv/config';
import { getFirebaseAdmin } from '../server/firebaseAdmin';
import { REAL_STUDENTS } from '../src/data/studentsData';
import { REAL_FACULTY_MEMBERS } from '../src/data/facultyData';
import { REAL_SCHOOLS } from '../src/data/schoolsData';
import { REAL_CLASSES } from '../src/data/classesData';

const { db, auth } = getFirebaseAdmin();

const DEFAULT_SEED_PASSWORD = process.env.FIREBASE_SEED_PASSWORD || 'ChangeMe_2026!';

const stripUndefined = (value: any): any => {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    );
  }
  return value;
};

async function upsertAuthUser(email: string, role: string, profile: Record<string, any>) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password: DEFAULT_SEED_PASSWORD, emailVerified: false });
  }
  await auth.updateUser(user.uid, { password: DEFAULT_SEED_PASSWORD });
  await auth.setCustomUserClaims(user.uid, { role });
  await db.collection('users').doc(user.uid).set(
    stripUndefined({
      ...profile,
      id: user.uid,
      email,
      role,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
  return user.uid;
}

async function main() {
  for (const school of REAL_SCHOOLS) {
    await db.collection('schools').doc(school.id).set(stripUndefined(school), { merge: true });
  }

  for (const cls of REAL_CLASSES) {
    await db.collection('classes').doc(cls.id).set(stripUndefined(cls), { merge: true });
  }

  for (const student of REAL_STUDENTS) {
    await db.collection('students').doc(student.id).set(
      stripUndefined({
        ...student,
        schoolId: 'school_telangana_ktr',
        schoolName: student.villageSchool,
      }),
      { merge: true },
    );
  }

  for (const faculty of REAL_FACULTY_MEMBERS) {
    await db.collection('faculty').doc(faculty.id).set(stripUndefined(faculty), { merge: true });
    await upsertAuthUser(faculty.email, 'faculty', {
      name: faculty.name,
      avatar: faculty.avatar,
      phone: faculty.phone,
      designation: faculty.designation,
      schoolId: faculty.schoolId,
      schoolName: faculty.schoolName,
    });
  }

  const adminEmail = process.env.FIREBASE_ADMIN_EMAIL || 'headmaster.kothur@tg.gov.in';
  await upsertAuthUser(adminEmail, 'admin', {
    name: 'K. Venkateshwarlu (Headmaster)',
    avatar: '👨‍💼',
    schoolId: 'school_telangana_ktr',
    schoolName: 'Zilla Parishad Primary School, Kothur',
    designation: 'Headmaster & School Cluster Officer',
    phone: '+91 94400 11223',
  });

  const superAdminEmail = process.env.FIREBASE_SUPERADMIN_EMAIL || 'admin.director@pathanashakthi.edu';
  await upsertAuthUser(superAdminEmail, 'superadmin', {
    name: 'Primary System Director (SuperAdmin)',
    avatar: '🛡️',
    schoolId: 'all',
    schoolName: 'Primary Literacy Directorate',
    designation: 'Chief Technology & Learning Administrator',
  });

  console.log(`Seeded ${REAL_SCHOOLS.length} schools, ${REAL_CLASSES.length} classes, ${REAL_STUDENTS.length} students and ${REAL_FACULTY_MEMBERS.length} faculty records.`);
  console.log('Firebase Auth accounts were created/updated with the seed password. Change it immediately after setup.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
