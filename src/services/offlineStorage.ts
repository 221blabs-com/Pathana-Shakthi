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
import { REAL_FACULTY_MEMBERS } from '../data/facultyData';
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

// Bumped when previously seeded sample data must be purged from browsers
// that already cached it in localStorage.
const DATA_VERSION = '2-real-data-only';
const DATA_VERSION_KEY = `${DB_PREFIX}data_version`;
// IDs of the sample stories older builds seeded into every browser.
const RETIRED_SAMPLE_STORY_IDS = new Set([
  'story_te_1', 'story_te_2', 'story_te_3',
  'story_hi_1', 'story_hi_2', 'story_hi_3',
  'story_en_1', 'story_en_2', 'story_en_3',
]);

/** A real student profile with no reading history yet. */
export function createBlankStudent(profile: {
  id: string;
  name: string;
  grade: Student['grade'];
  rollNumber?: string;
  avatar?: string;
  villageSchool?: string;
}): Student {
  return {
    id: profile.id,
    name: profile.name,
    rollNumber: profile.rollNumber || profile.id,
    avatar: profile.avatar || '🧒',
    grade: profile.grade,
    villageSchool: profile.villageSchool || '',
    stars: 0,
    streakDays: 0,
    lastActiveDate: '',
    mascotAccessory: 'none',
    badges: [],
    completedStoryIds: [],
    languageProficiency: { Telugu: 0, Hindi: 0, English: 0 },
    totalMinutesRead: 0,
    averageWPM: 0,
    overallAccuracy: 0,
  };
}

// Shown only before anyone has logged in as a student; never persisted.
const GUEST_STUDENT = createBlankStudent({ id: 'guest', name: 'Student', grade: 'Class 1' });

class OfflineStorageManager {
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.purgeSampleData();
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        this.processSyncQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
      });
    }
  }

  /**
   * One-time cleanup of the sample students, reading logs, classes, schools,
   * audit entries and stories older builds seeded into localStorage. Real
   * data the teacher or student created (custom/published stories) is kept.
   */
  private purgeSampleData(): void {
    try {
      if (localStorage.getItem(DATA_VERSION_KEY) === DATA_VERSION) return;
      [
        STORAGE_KEYS.STUDENTS,
        STORAGE_KEYS.CURRENT_STUDENT,
        STORAGE_KEYS.READING_LOGS,
        STORAGE_KEYS.OFFLINE_QUEUE,
        STORAGE_KEYS.FACULTY,
        STORAGE_KEYS.CLASSES,
        STORAGE_KEYS.SCHOOLS,
        STORAGE_KEYS.AUDIT_LOGS,
      ].forEach((key) => localStorage.removeItem(key));
      const stories = this.getStories();
      const kept = stories.filter((story) => !RETIRED_SAMPLE_STORY_IDS.has(story.id));
      if (kept.length !== stories.length) this.saveStories(kept);
      localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
    } catch {
      // Storage unavailable (private mode): nothing cached to purge.
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

  public addCustomStories(newStories: Story[]): void {
    const incomingById = new Map(newStories.map((story) => [story.id, story]));
    const existing = this.getStories().filter((story) => !incomingById.has(story.id));
    this.saveStories([...incomingById.values(), ...existing]);
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
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Add the student if new (keeping an existing record's progress) and make them current. */
  public signInStudent(profile: Student): Student {
    const existing = this.getStudents().find((s) => s.id === profile.id);
    const student = existing
      ? { ...existing, name: profile.name, grade: profile.grade, avatar: profile.avatar }
      : profile;
    const others = this.getStudents().filter((s) => s.id !== profile.id);
    this.saveStudents([student, ...others]);
    this.setCurrentStudentId(student.id);
    return student;
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
    if (typeof window === 'undefined') return GUEST_STUDENT.id;
    return localStorage.getItem(STORAGE_KEYS.CURRENT_STUDENT) || GUEST_STUDENT.id;
  }

  public setCurrentStudentId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.CURRENT_STUDENT, id);
  }

  public getCurrentStudent(): Student {
    const id = this.getCurrentStudentId();
    const students = this.getStudents();
    return students.find((s) => s.id === id) || students[0] || GUEST_STUDENT;
  }

  public updateCurrentStudent(updates: Partial<Student>): Student {
    const current = this.getCurrentStudent();
    const updated = { ...current, ...updates };
    if (current.id === GUEST_STUDENT.id) return updated; // nobody signed in: don't persist
    const all = this.getStudents().map((s) => (s.id === current.id ? updated : s));
    this.saveStudents(all);
    return updated;
  }

  /**
   * Record one finished activity toward today's learning-tree growth
   * (ReadingGrowthSprout). Each activity id counts once per day. Kept under
   * its old "certificate" name/fields so stored progress stays compatible.
   */
  public awardCurrentStudentDailyCertificate(certificateId: string): Student {
    return this.recordDailyActivity(certificateId);
  }

  public recordDailyActivity(certificateId: string): Student {
    const student = this.getCurrentStudent();
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const awardKey = `${DB_PREFIX}daily_certificates_${student.id}_${date}`;
    let awardedCertificateIds: string[] = [];

    try {
      awardedCertificateIds = JSON.parse(localStorage.getItem(awardKey) || '[]');
    } catch {
      awardedCertificateIds = [];
    }

    const dailyCount = student.dailyCertificateDate === date
      ? Math.max(0, Math.floor(student.dailyCertificatesEarned || 0))
      : 0;
    if (awardedCertificateIds.includes(certificateId)) return student;

    awardedCertificateIds.push(certificateId);
    try {
      localStorage.setItem(awardKey, JSON.stringify(awardedCertificateIds));
    } catch {
      // The student profile still records progress if local storage is full.
    }

    return this.updateCurrentStudent({
      dailyCertificateDate: date,
      dailyCertificatesEarned: dailyCount + 1,
    });
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
  // Faculty are the real login accounts (Firebase), so they are still seeded.
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
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
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
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
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
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.READING_LOGS) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
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
    // Running means over this student's own sessions (the first real session
    // must not be averaged against a starting 0).
    const priorSessions = logs.filter((l) => l.studentId === student.id).length;
    const runningMean = (previous: number, next: number) =>
      Math.round((previous * priorSessions + next) / (priorSessions + 1));
    const newAvgWpm = runningMean(student.averageWPM, log.wpm);
    const newAccuracy = runningMean(student.overallAccuracy, log.accuracyRate);

    // Update language proficiency
    const currentLangProf = { Telugu: 0, Hindi: 0, English: 0, ...student.languageProficiency };
    const priorLangSessions = logs.filter(
      (l) => l.studentId === student.id && l.language === log.language
    ).length;
    currentLangProf[log.language] = Math.min(
      100,
      priorLangSessions === 0
        ? Math.round(log.accuracyRate)
        : Math.round(currentLangProf[log.language] * 0.9 + log.accuracyRate * 0.1)
    );

    // Check badges
    const newBadges = [...student.badges];
    if (!newBadges.includes('first_story')) newBadges.push('first_story');
    if (log.wpm >= 45 && !newBadges.includes('speed_reader')) newBadges.push('speed_reader');
    if (log.quizScore === 3 && !newBadges.includes('quiz_master')) newBadges.push('quiz_master');
    if (log.language === 'Telugu' && log.accuracyRate >= 85 && !newBadges.includes('telugu_star')) newBadges.push('telugu_star');
    if (log.language === 'Hindi' && log.accuracyRate >= 85 && !newBadges.includes('hindi_star')) newBadges.push('hindi_star');
    if (log.language === 'English' && log.accuracyRate >= 85 && !newBadges.includes('english_star')) newBadges.push('english_star');

    // Consecutive-day reading streak.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const streakDays =
      student.lastActiveDate === today
        ? Math.max(1, student.streakDays || 0)
        : student.lastActiveDate === yesterday
          ? (student.streakDays || 0) + 1
          : 1;

    this.updateCurrentStudent({
      streakDays,
      lastActiveDate: today,
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
