import 'dotenv/config';
import { getFirebaseAdmin } from '../server/firebaseAdmin';
import { CURRICULUM_LESSONS } from '../src/data/curriculumData';

const { db } = getFirebaseAdmin();

async function main() {
  const writer = db.bulkWriter();
  for (const lesson of CURRICULUM_LESSONS) {
    writer.set(db.collection('lessons').doc(lesson.id), {
      ...lesson,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await writer.close();
  console.log(`Seeded ${CURRICULUM_LESSONS.length} curriculum lessons.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
