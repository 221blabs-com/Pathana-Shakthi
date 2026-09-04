import {
  Story,
  Student,
  ReadingSessionLog,
  Badge,
  FacultyMember,
  ClassSection,
  SchoolInfo,
  AuditLog,
} from '../types';
import { REAL_STUDENTS, REAL_READING_LOGS } from '../data/studentsData';
import { REAL_FACULTY_MEMBERS } from '../data/facultyData';
import { REAL_CLASSES } from '../data/classesData';
import { REAL_SCHOOLS } from '../data/schoolsData';
import { networkSyncToastService } from './networkSyncToastService';


const DB_PREFIX = 'pathana_shakthi_';
const STORAGE_KEYS = {
  STORIES: `${DB_PREFIX}stories`,
  STUDENTS: `${DB_PREFIX}students`,
  CURRENT_STUDENT: `${DB_PREFIX}current_student_id`,
  READING_LOGS: `${DB_PREFIX}reading_logs`,
  OFFLINE_QUEUE: `${DB_PREFIX}offline_sync_queue`,
  LAST_SYNC: `${DB_PREFIX}last_sync_timestamp`,
  OFFLINE_PACKS: `${DB_PREFIX}downloaded_packs`,
  FACULTY: `${DB_PREFIX}faculty`,
  CLASSES: `${DB_PREFIX}classes`,
  SCHOOLS: `${DB_PREFIX}schools`,
  AUDIT_LOGS: `${DB_PREFIX}audit_logs`,
};

export const DEFAULT_BADGES: Badge[] = [
  {
    id: 'first_story',
    name: 'First Reader',
    nameNative: 'మొదటి పాఠకుడు / पहला पाठक',
    description: 'Completed your very first story!',
    icon: '🌟',
    category: 'mastery',
  },
  {
    id: 'telugu_star',
    name: 'Telugu Champion',
    nameNative: 'తెలుగు భాషా రత్నం',
    description: 'Read 3 stories in Telugu with 80%+ accuracy',
    icon: '🦚',
    category: 'language',
  },
  {
    id: 'hindi_star',
    name: 'Hindi Explorer',
    nameNative: 'हिन्दी गौरव',
    description: 'Read 3 stories in Hindi with 80%+ accuracy',
    icon: '🦁',
    category: 'language',
  },
  {
    id: 'english_star',
    name: 'English Whiz',
    nameNative: 'English Champion',
    description: 'Read 3 stories in English with 80%+ accuracy',
    icon: '🚀',
    category: 'language',
  },
  {
    id: 'streak_3',
    name: '3-Day Streak',
    nameNative: '3 రోజుల దీక్ష / 3 दिन का संकल्प',
    description: 'Practiced reading 3 days in a row!',
    icon: '🔥',
    category: 'streak',
  },
  {
    id: 'speed_reader',
    name: 'Fluent Reader',
    nameNative: 'వేగవంతమైన పాఠకుడు / धाराप्रवाह पाठक',
    description: 'Achieved 45+ Words Per Minute',
    icon: '⚡',
    category: 'accuracy',
  },
  {
    id: 'quiz_master',
    name: 'Comprehension Master',
    nameNative: 'మేధావి / ज्ञानी',
    description: 'Scored 100% on 3 story quizzes',
    icon: '🏆',
    category: 'mastery',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit_01',
    timestamp: '2026-08-23T20:10:00Z',
    action: 'CURRICULUM_OCR_INGESTION',
    user: 'Smt. Shailaja Devi',
    role: 'faculty',
    details: 'Uploaded Class 3 Telugu Chapter 4: "మా ఊరి చెరువు" and generated 5-page Decodable Reader.',
    status: 'SUCCESS',
  },
  {
    id: 'audit_02',
    timestamp: '2026-08-23T21:05:00Z',
    action: 'STUDENT_BENCHMARK_SYNC',
    user: 'Sri. M. Anand Kumar',
    role: 'faculty',
    details: 'Synchronized 28 offline reading logs for Class 2-A with 91.4% overall fluency rate.',
    status: 'SUCCESS',
  },
  {
    id: 'audit_03',
    timestamp: '2026-08-23T21:45:00Z',
    action: 'SUPERADMIN_SECURITY_LOGIN',
    user: 'State Director',
    role: 'superadmin',
    details: 'SuperAdmin administrative session authenticated via /superadmin221b security portal.',
    status: 'INFO',
  },
];


class OfflineStorageManager {
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        this.processSyncQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
      });
    }
  }

  public isOnline(): boolean {
    if (networkSyncToastService.isSimulatedOffline()) {
      return false;
    }
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return this.isOnlineStatus;
  }

  // --- STORIES ---
  public getStories(): Story[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STORIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveStories(stories: Story[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.STORIES, JSON.stringify(stories));
    } catch (e) {
      console.warn('LocalStorage full or unavailable', e);
    }
  }

  public addCustomStory(story: Story): void {
    const existing = this.getStories();
    const updated = [story, ...existing.filter((s) => s.id !== story.id)];
    this.saveStories(updated);
  }

  public toggleStoryOffline(storyId: string): boolean {
    const stories = this.getStories();
    let isDownloaded = false;
    const updated = stories.map((s) => {
      if (s.id === storyId) {
        isDownloaded = !s.isDownloadedOffline;
        return { ...s, isDownloadedOffline: isDownloaded };
      }
      return s;
    });
    this.saveStories(updated);
    return isDownloaded;
  }

  public downloadAllOfflinePack(grade?: string, lang?: string): number {
    const stories = this.getStories();
    let count = 0;
    const updated = stories.map((s) => {
      const matchGrade = !grade || s.gradeLevel === grade;
      const matchLang = !lang || s.language === lang;
      if (matchGrade && matchLang) {
        count++;
        return { ...s, isDownloadedOffline: true };
      }
      return s;
    });
    this.saveStories(updated);
    return count;
  }

  /**
   * Safe fetch & download with graceful Network Error Toast and Retry action
   */
  public async fetchAndDownloadOfflinePack(
    grade?: string,
    lang?: string,
    simulateFail = false
  ): Promise<{ success: boolean; count: number }> {
    const packName = lang ? `${lang} Story Pack` : 'All Multilingual Story Packs';

    // Check online status or simulated failure
    if (!this.isOnline() || simulateFail) {
      // Surface graceful retry toast
      networkSyncToastService.notifyFetchError({
        packName,
        customMessage: `Connection lost while downloading ${packName}. Tap Retry below to re-attempt fetch.`,
        onRetry: async () => {
          // Re-attempt download
          const res = await this.fetchAndDownloadOfflinePack(grade, lang, false);
          return res.success;
        },
      });
      return { success: false, count: 0 };
    }

    // Perform successful download
    const count = this.downloadAllOfflinePack(grade, lang);
    return { success: true, count };
  }

  // --- STUDENTS ---
  public getStudents(): Student[] {
    if (typeof window === 'undefined') return REAL_STUDENTS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      this.saveStudents(REAL_STUDENTS);
      return REAL_STUDENTS;
    } catch {
      return REAL_STUDENTS;
    }
  }

  public saveStudents(students: Student[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    } catch (e) {
      console.warn('Error saving students:', e);
    }
  }

  public getCurrentStudentId(): string {
    if (typeof window === 'undefined') return REAL_STUDENTS[0].id;
    return localStorage.getItem(STORAGE_KEYS.CURRENT_STUDENT) || REAL_STUDENTS[0].id;
  }

  public setCurrentStudentId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.CURRENT_STUDENT, id);
  }

  public getCurrentStudent(): Student {
    const id = this.getCurrentStudentId();
    const students = this.getStudents();
    return students.find((s) => s.id === id) || students[0] || REAL_STUDENTS[0];
  }

  public updateCurrentStudent(updates: Partial<Student>): Student {
    const current = this.getCurrentStudent();
    const updated = { ...current, ...updates };
    const all = this.getStudents().map((s) => (s.id === current.id ? updated : s));
    this.saveStudents(all);
    return updated;
  }

  public addStudent(student: Student): void {
    const all = [...this.getStudents(), student];
    this.saveStudents(all);
    this.addAuditLog({
      action: 'STUDENT_ENROLLED',
      user: student.name,
      role: 'faculty',
      details: `Enrolled new student ${student.name} (Roll: ${student.rollNumber}) in ${student.grade}.`,
      status: 'SUCCESS',
    });
  }

  // --- FACULTY & STAFF ---
  public getFaculty(): FacultyMember[] {
    if (typeof window === 'undefined') return REAL_FACULTY_MEMBERS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FACULTY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      this.saveFaculty(REAL_FACULTY_MEMBERS);
      return REAL_FACULTY_MEMBERS;
    } catch {
      return REAL_FACULTY_MEMBERS;
    }
  }

  public saveFaculty(faculty: FacultyMember[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(faculty));
    } catch (e) {
      console.warn('Error saving faculty:', e);
    }
  }

  public addFacultyMember(member: FacultyMember): void {
    const all = [member, ...this.getFaculty()];
    this.saveFaculty(all);
    this.addAuditLog({
      action: 'FACULTY_ONBOARDED',
      user: member.name,
      role: 'admin',
      details: `Appointed ${member.name} as ${member.designation}.`,
      status: 'SUCCESS',
    });
  }

  // --- CLASSES ---
  public getClasses(): ClassSection[] {
    if (typeof window === 'undefined') return REAL_CLASSES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      this.saveClasses(REAL_CLASSES);
      return REAL_CLASSES;
    } catch {
      return REAL_CLASSES;
    }
  }

  public saveClasses(classes: ClassSection[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    } catch (e) {
      console.warn('Error saving classes:', e);
    }
  }

  // --- SCHOOLS ---
  public getSchools(): SchoolInfo[] {
    if (typeof window === 'undefined') return REAL_SCHOOLS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHOOLS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      this.saveSchools(REAL_SCHOOLS);
      return REAL_SCHOOLS;
    } catch {
      return REAL_SCHOOLS;
    }
  }

  public saveSchools(schools: SchoolInfo[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.SCHOOLS, JSON.stringify(schools));
    } catch (e) {
      console.warn('Error saving schools:', e);
    }
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    if (typeof window === 'undefined') return INITIAL_AUDIT_LOGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const existing = this.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...existing].slice(0, 50); // keep last 50
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving audit log:', e);
      }
    }
  }

  // --- READING SESSIONS & OFFLINE QUEUE ---
  public getReadingLogs(): ReadingSessionLog[] {
    if (typeof window === 'undefined') return REAL_READING_LOGS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.READING_LOGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return REAL_READING_LOGS;
    } catch {
      return REAL_READING_LOGS;
    }
  }

  public saveReadingSession(log: ReadingSessionLog): void {
    const logs = this.getReadingLogs();
    const isOnline = this.isOnline();
    const updatedLog = { ...log, synced: isOnline };
    const allLogs = [updatedLog, ...logs];

    try {
      localStorage.setItem(STORAGE_KEYS.READING_LOGS, JSON.stringify(allLogs));
    } catch (e) {
      console.warn('Failed saving log', e);
    }

    // Add to offline sync queue if offline
    if (!isOnline) {
      const queue = this.getOfflineQueue();
      queue.push(updatedLog);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));

      // Trigger graceful Retry Toast notification for the student
      networkSyncToastService.notifySyncError({
        pendingCount: queue.length,
        onRetry: async () => {
          const res = await this.processSyncQueue(true);
          return res.success;
        },
      });
    }

    // Update student stats
    const student = this.getCurrentStudent();
    const newStars = student.stars + log.starsEarned;
    const completedStoryIds = student.completedStoryIds.includes(log.storyId)
      ? student.completedStoryIds
      : [...student.completedStoryIds, log.storyId];

    const currentMinutes = student.totalMinutesRead + Math.round(log.durationSeconds / 60);
    const newAvgWpm = Math.round((student.averageWPM + log.wpm) / 2);
    const newAccuracy = Math.round((student.overallAccuracy + log.accuracyRate) / 2);

    // Update language proficiency
    const currentLangProf = { ...student.languageProficiency };
    currentLangProf[log.language] = Math.min(100, Math.round(currentLangProf[log.language] * 0.9 + log.accuracyRate * 0.1));

    // Check badges
    const newBadges = [...student.badges];
    if (!newBadges.includes('first_story')) newBadges.push('first_story');
    if (log.wpm >= 45 && !newBadges.includes('speed_reader')) newBadges.push('speed_reader');
    if (log.quizScore === 3 && !newBadges.includes('quiz_master')) newBadges.push('quiz_master');
    if (log.language === 'Telugu' && log.accuracyRate >= 85 && !newBadges.includes('telugu_star')) newBadges.push('telugu_star');
    if (log.language === 'Hindi' && log.accuracyRate >= 85 && !newBadges.includes('hindi_star')) newBadges.push('hindi_star');
    if (log.language === 'English' && log.accuracyRate >= 85 && !newBadges.includes('english_star')) newBadges.push('english_star');

    this.updateCurrentStudent({
      stars: newStars,
      completedStoryIds,
      totalMinutesRead: currentMinutes,
      averageWPM: newAvgWpm,
      overallAccuracy: newAccuracy,
      languageProficiency: currentLangProf,
      badges: newBadges,
    });
  }

  public getOfflineQueue(): ReadingSessionLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public clearOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  }

  public async processSyncQueue(
    forceOnline = false
  ): Promise<{ success: boolean; syncedCount: number; timestamp: string }> {
    const queue = this.getOfflineQueue();
    const online = forceOnline || this.isOnline();

    if (!online) {
      // Offline / Network error during sync attempt: notify with graceful Retry toast
      networkSyncToastService.notifySyncError({
        pendingCount: queue.length || 1,
        onRetry: async () => {
          const res = await this.processSyncQueue(true);
          return res.success;
        },
      });
      return { success: false, syncedCount: 0, timestamp: new Date().toLocaleTimeString() };
    }

    if (queue.length === 0) {
      return { success: true, syncedCount: 0, timestamp: new Date().toLocaleTimeString() };
    }

    // Mark all logs as synced
    const logs = this.getReadingLogs().map((l) => ({ ...l, synced: true }));
    try {
      localStorage.setItem(STORAGE_KEYS.READING_LOGS, JSON.stringify(logs));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      const count = queue.length;
      this.clearOfflineQueue();

      return { success: true, syncedCount: count, timestamp: new Date().toLocaleTimeString() };
    } catch (e) {
      console.warn('Sync error:', e);
      networkSyncToastService.notifySyncError({
        pendingCount: queue.length,
        onRetry: async () => {
          const res = await this.processSyncQueue(true);
          return res.success;
        },
      });
      return { success: false, syncedCount: 0, timestamp: new Date().toLocaleTimeString() };
    }
  }

  /**
   * Directly simulate a network error while syncing reading logs to demonstrate the Retry Toast
   */
  public triggerSimulatedSyncError(): void {
    const queue = this.getOfflineQueue();
    const count = queue.length > 0 ? queue.length : 2;
    networkSyncToastService.notifySyncError({
      pendingCount: count,
      customMessage: `Network timeout while transmitting ${count} reading logs to classroom server. Your speech evaluations and stars are preserved offline.`,
      onRetry: async () => {
        const res = await this.processSyncQueue(true);
        return res.success;
      },
    });
  }

  /**
   * Directly simulate a network error while fetching offline story packs
   */
  public triggerSimulatedFetchError(packName = 'Telugu Story Pack (తెలుగు)'): void {
    networkSyncToastService.notifyFetchError({
      packName,
      customMessage: `Connection lost while downloading ${packName}. Tap Retry to resume offline download.`,
      onRetry: async () => {
        const res = await this.fetchAndDownloadOfflinePack(undefined, 'Telugu', false);
        return res.success;
      },
    });
  }

  public getLastSyncTime(): string {
    if (typeof window === 'undefined') return 'Never';
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    if (!raw) return 'Ready to Sync';
    return new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export const offlineStorage = new OfflineStorageManager();
