// The school's student sign-in code (server/schoolCode.ts), remembered on the
// device so a school tablet asks for it once and children then only tap
// their class and name. A sign-in card link (`/login?school=AB3K9P`) fills it in.
const KEY = 'ps_school_code';

export type SavedSchool = { code: string; name: string };

export function normalizeSchoolCode(value: string): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function savedSchool(): SavedSchool | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.code === 'string' && parsed.code.length === 6 ? { code: parsed.code, name: String(parsed.name || '') } : null;
  } catch {
    return null;
  }
}

export function saveSchool(school: SavedSchool) {
  try {
    localStorage.setItem(KEY, JSON.stringify(school));
  } catch {
    /* private mode: the child types it again next time */
  }
}

export function forgetSchool() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** A code from the page's URL (?school=AB3K9P), if any. */
export function schoolCodeFromUrl(): string {
  try {
    return normalizeSchoolCode(new URLSearchParams(window.location.search).get('school') || '');
  } catch {
    return '';
  }
}

/** Asks the server whether a code is real; the school's name, or an error message. */
export async function checkSchoolCode(code: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`/api/auth/school?code=${encodeURIComponent(code)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: data.error || 'That school code is not right.' };
    return { ok: true, name: String(data.school?.name || '') };
  } catch {
    return { ok: false, error: 'No internet connection. Please check and try again.' };
  }
}
