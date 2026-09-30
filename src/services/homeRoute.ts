import { AppViewRoute, UserRole } from '../types';

// Where "Home" takes a signed-in person: their own dashboard, never the
// public landing page (which shows the signed-out navbar and looked like a
// logout).
export function homeRouteFor(role: UserRole | undefined | null): AppViewRoute {
  switch (role) {
    case 'faculty':
      return 'faculty_dashboard';
    case 'admin':
      return 'school_admin';
    case 'superadmin':
      return 'superadmin';
    case 'student':
      return 'student_library';
    default:
      return 'landing';
  }
}

export const HOME_PATHS: Partial<Record<AppViewRoute, string>> & Record<string, string> = {
  landing: '/',
  student_library: '/student',
  faculty_dashboard: '/faculty',
  school_admin: '/admin',
  superadmin: '/superadmin221b',
};
