import { UserSession, UserRole } from '../types';
import { REAL_FACULTY_MEMBERS } from '../data/facultyData';
import { REAL_STUDENTS } from '../data/studentsData';
import { REAL_SCHOOLS } from '../data/schoolsData';

const SESSION_KEY = 'pathana_shakthi_auth_session';

export const SUPERADMIN_URI_CODE = 'superadmin221b';
export const SUPERADMIN_DEFAULT_KEY = 'shakthi_admin_2026';

/*
 * ---------------------------------------------------------------------------
 * LOCAL DEMO CREDENTIALS
 * ---------------------------------------------------------------------------
 * These are intentionally kept in one place so there are NO fallback
 * passwords in the UI and an empty password can NEVER authorize a session.
 *
 * For a production deployment, move credential verification to the backend
 * and store password hashes there. Never ship real production passwords in
 * frontend source code.
 */
export const DEMO_CREDENTIALS = {
  student: 'student2026',
  faculty: '1234',
  admin: '1234',
} as const;

export const DEMO_USERS: Record<string, UserSession> = {
  student: {
    id: REAL_STUDENTS[0].id,
    name: REAL_STUDENTS[0].name,
    role: 'student',
    rollNumber: REAL_STUDENTS[0].rollNumber,
    avatar: REAL_STUDENTS[0].avatar,
    schoolId: 'school_telangana_ktr',
    schoolName: 'Zilla Parishad Primary School, Kothur',
    grade: REAL_STUDENTS[0].grade,
    createdAt: '2026-06-01',
  },
  faculty: {
    id: REAL_FACULTY_MEMBERS[0].id,
    name: REAL_FACULTY_MEMBERS[0].name,
    email: REAL_FACULTY_MEMBERS[0].email,
    role: 'faculty',
    avatar: REAL_FACULTY_MEMBERS[0].avatar,
    schoolId: 'school_telangana_ktr',
    schoolName: 'Zilla Parishad Primary School, Kothur',
    designation: REAL_FACULTY_MEMBERS[0].designation,
    phone: REAL_FACULTY_MEMBERS[0].phone,
    createdAt: '2026-01-10',
  },
  admin: {
    id: 'admin_ktr_01',
    name: 'K. Venkateshwarlu (Headmaster)',
    email: 'headmaster.kothur@tg.gov.in',
    role: 'admin',
    avatar: '👨‍💼',
    schoolId: 'school_telangana_ktr',
    schoolName: 'Zilla Parishad Primary School, Kothur',
    designation: 'Headmaster & School Cluster Officer',
    phone: '+91 94400 11223',
    createdAt: '2025-05-15',
  },
  superadmin: {
    id: 'superadmin_root',
    name: 'Primary System Director (SuperAdmin)',
    email: 'admin.director@pathanashakthi.edu',
    role: 'superadmin',
    avatar: '🛡️',
    schoolId: 'all',
    schoolName: 'Primary Literacy Directorate',
    designation: 'Chief Technology & Learning Administrator',
    createdAt: '2025-01-01',
  },
};

class AuthService {
  private currentSession: UserSession | null = null;
  private listeners: Array<(session: UserSession | null) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SESSION_KEY);

      if (saved) {
        try {
          this.currentSession = JSON.parse(saved);
        } catch {
          this.currentSession = null;
          localStorage.removeItem(SESSION_KEY);
        }
      }
    }
  }

  public getSession(): UserSession | null {
    return this.currentSession;
  }

  public isAuthenticated(): boolean {
    return this.currentSession !== null;
  }

  public hasRole(roles: UserRole[]): boolean {
    if (!this.currentSession) return false;
    return roles.includes(this.currentSession.role);
  }

  /*
   * Kept for compatibility with existing callers.
   *
   * IMPORTANT:
   * This method is no longer a login bypass. It is intentionally disabled.
   * All authentication must go through loginWithCredentials().
   */
  public loginAsStudent(_studentId: string): never {
    throw new Error(
      'Password authentication required. Use loginWithCredentials() for student login.'
    );
  }

  public loginWithCredentials(
    emailOrRoll: string,
    pass: string,
    role: UserRole
  ): { success: boolean; session?: UserSession; error?: string } {
    const identifier = emailOrRoll.trim();
    const password = pass.trim();

    // Hard stop: blank passwords are NEVER accepted.
    if (!password) {
      return {
        success: false,
        error: 'Password is required. Authorization denied.',
      };
    }

    if (role === 'superadmin') {
      if (
        password === SUPERADMIN_DEFAULT_KEY ||
        password === SUPERADMIN_URI_CODE
      ) {
        const session = DEMO_USERS.superadmin;
        this.saveSession(session);
        return { success: true, session };
      }

      return {
        success: false,
        error: 'Invalid SuperAdmin security authorization key.',
      };
    }

    if (role === 'faculty') {
      const faculty = REAL_FACULTY_MEMBERS.find(
        (f) =>
          f.email.toLowerCase() === identifier.toLowerCase() ||
          f.id.toLowerCase() === identifier.toLowerCase()
      );

      if (!faculty) {
        return {
          success: false,
          error: 'Faculty account not found.',
        };
      }

      if (password !== DEMO_CREDENTIALS.faculty) {
        return {
          success: false,
          error: 'Incorrect faculty password.',
        };
      }

      const session: UserSession = {
        id: faculty.id,
        name: faculty.name,
        email: faculty.email,
        role: 'faculty',
        avatar: faculty.avatar,
        schoolId: faculty.schoolId,
        schoolName: faculty.schoolName,
        designation: faculty.designation,
        phone: faculty.phone,
        createdAt: new Date().toISOString(),
      };

      this.saveSession(session);
      return { success: true, session };
    }

    if (role === 'admin') {
      const admin = DEMO_USERS.admin;

      if (
        identifier.toLowerCase() !==
        admin.email.toLowerCase()
      ) {
        return {
          success: false,
          error: 'Administrator account not found.',
        };
      }

      if (password !== DEMO_CREDENTIALS.admin) {
        return {
          success: false,
          error: 'Incorrect administrator password.',
        };
      }

      this.saveSession(admin);
      return { success: true, session: admin };
    }

    // Student login: the selected student's roll number is the identifier.
    if (role === 'student') {
      const student = REAL_STUDENTS.find(
        (s) =>
          s.rollNumber.toLowerCase() ===
          identifier.toLowerCase()
      );

      if (!student) {
        return {
          success: false,
          error: 'Student account not found.',
        };
      }

      if (password !== DEMO_CREDENTIALS.student) {
        return {
          success: false,
          error: 'Incorrect student password.',
        };
      }

      const session: UserSession = {
        id: student.id,
        name: student.name,
        role: 'student',
        rollNumber: student.rollNumber,
        avatar: student.avatar,
        schoolId: 'school_telangana_ktr',
        schoolName: student.villageSchool,
        grade: student.grade,
        createdAt: new Date().toISOString(),
      };

      this.saveSession(session);
      return { success: true, session };
    }

    return {
      success: false,
      error: 'Invalid login role.',
    };
  }

  public logout() {
    this.currentSession = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }

    this.notify();
  }

  public saveSession(session: UserSession) {
    this.currentSession = session;

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );
    }

    this.notify();
  }

  public subscribe(
    listener: (session: UserSession | null) => void
  ): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (l) => l !== listener
      );
    };
  }

  private notify() {
    this.listeners.forEach((l) =>
      l(this.currentSession)
    );
  }
}

export const authService = new AuthService();