import { UserSession, UserRole, GradeLevel } from '../types';
import { REAL_FACULTY_MEMBERS } from '../data/facultyData';
import { REAL_STUDENTS } from '../data/studentsData';
import { REAL_SCHOOLS } from '../data/schoolsData';

const SESSION_KEY = 'pathana_shakthi_auth_session';

export const SUPERADMIN_URI_CODE = 'superadmin221b';
export const SUPERADMIN_DEFAULT_KEY = 'shakthi_admin_2026';

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

  public loginAsStudent(studentId: string): UserSession {
    const found = REAL_STUDENTS.find((s) => s.id === studentId) || REAL_STUDENTS[0];
    const session: UserSession = {
      id: found.id,
      name: found.name,
      role: 'student',
      rollNumber: found.rollNumber,
      avatar: found.avatar,
      schoolId: 'school_telangana_ktr',
      schoolName: found.villageSchool,
      grade: found.grade,
      createdAt: new Date().toISOString(),
    };
    this.saveSession(session);
    return session;
  }

  public loginWithCredentials(
    emailOrRoll: string,
    pass: string,
    role: UserRole
  ): { success: boolean; session?: UserSession; error?: string } {
    if (role === 'superadmin') {
      if (pass === SUPERADMIN_DEFAULT_KEY || pass === 'superadmin221b') {
        const session = DEMO_USERS.superadmin;
        this.saveSession(session);
        return { success: true, session };
      }
      return { success: false, error: 'Invalid SuperAdmin security authorization key.' };
    }

    if (role === 'faculty') {
      const faculty = REAL_FACULTY_MEMBERS.find(
        (f) => f.email.toLowerCase() === emailOrRoll.toLowerCase()
      ) || REAL_FACULTY_MEMBERS[0];

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
      const session = DEMO_USERS.admin;
      this.saveSession(session);
      return { success: true, session };
    }

    // Student login
    const student = REAL_STUDENTS.find(
      (s) => s.rollNumber.toLowerCase() === emailOrRoll.toLowerCase() || s.name.toLowerCase().includes(emailOrRoll.toLowerCase())
    ) || REAL_STUDENTS[0];

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
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    this.notify();
  }

  public subscribe(listener: (session: UserSession | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentSession));
  }
}

export const authService = new AuthService();
