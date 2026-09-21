import { UserSession, UserRole } from '../types';

const SESSION_KEY = 'pathana_shakthi_auth_session';

// The URL path SuperAdminPortalPage.tsx is mounted at. This is obscurity,
// not security — real access control is the Firebase-verified login form
// that page renders (see firebaseAuthService.loginWithPassword and
// server/firebaseRoutes.ts's requireRole middleware). Do not add a
// hardcoded passkey/secret here again; the whole point of this file's
// last rewrite was removing exactly that.
export const SUPERADMIN_URI_CODE = 'superadmin221b';

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
