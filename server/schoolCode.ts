// School sign-in codes. A child signs in by tapping their class and name, so
// class + roll number alone used to be enough to sign in as any child, and the
// class list was public for every school. Now the class list and student
// sign-in need the school's code: a short code each school device enters once
// (it is remembered on the device), printed on the sign-in cards. It also
// makes roll numbers per school, so two schools can both have Class 3 roll 1.
import { randomBytes } from "crypto";
import { getFirebaseAdmin } from "./firebaseAdmin";

// No 0/O, 1/I/L: read out loud and typed by teachers.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SCHOOL_CODE_LENGTH = 6;

export function generateSchoolCode(bytes: Buffer = randomBytes(SCHOOL_CODE_LENGTH)): string {
  let out = "";
  for (let i = 0; i < SCHOOL_CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** "ab3-k9 p" → "AB3K9P"; null unless it has the shape of a code. */
export function normalizeSchoolCode(value: unknown): string | null {
  const code = String(value ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
  return code.length === SCHOOL_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

type School = { id: string; name: string };
const byCode = new Map<string, { school: School | null; at: number }>();
const CACHE_MS = 60_000;

export function forgetSchoolCode(code?: string) {
  if (code) byCode.delete(code);
  else byCode.clear();
}

/** The school a code belongs to, or null. Cached for a minute (also misses). */
export async function schoolForCode(value: unknown): Promise<School | null> {
  const code = normalizeSchoolCode(value);
  if (!code) return null;
  const hit = byCode.get(code);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.school;
  const { db } = getFirebaseAdmin();
  const snap = await db.collection("schools").where("signInCode", "==", code).limit(1).get();
  const school = snap.empty ? null : { id: snap.docs[0].id, name: String(snap.docs[0].get("name") || "") };
  byCode.set(code, { school, at: Date.now() });
  if (byCode.size > 2000) byCode.delete(byCode.keys().next().value as string);
  return school;
}

/** The school's code, made the first time anyone asks (or when `reset`). */
export async function ensureSchoolCode(schoolId: string, reset = false): Promise<string> {
  const { db } = getFirebaseAdmin();
  const ref = db.collection("schools").doc(schoolId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? normalizeSchoolCode(snap.get("signInCode")) : null;
    if (current && !reset) return current;
    let code = generateSchoolCode();
    // Codes are random over 31^6 ≈ 887 million; a clash is very unlikely, but check.
    for (let i = 0; i < 5; i++) {
      const clash = await db.collection("schools").where("signInCode", "==", code).limit(1).get();
      if (clash.empty) break;
      code = generateSchoolCode();
    }
    tx.set(ref, { signInCode: code, signInCodeUpdatedAt: new Date().toISOString() }, { merge: true });
    if (current) forgetSchoolCode(current);
    return code;
  });
}
