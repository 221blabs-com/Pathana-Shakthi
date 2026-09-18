export type Language = 'Telugu' | 'Hindi' | 'English';

export type GradeLevel = 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4' | 'Class 5';

export type Difficulty = 'Easy' | 'Medium' | 'Challenging';

export interface SpotlightWord {
  word: string;
  meaning: string;
  pronunciation?: string;
  example?: string;
  audioHint?: string;
}

export interface ComprehensionQuestion {
  question: string;
  questionEnglish?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  englishTranslation: string;
  transliteration: string;
  illustrationPrompt: string;
  illustrationTheme?: string;
  suggestedSoundEffect?: string;
}

export interface Story {
  id: string;
  title: string;
  titleEnglish: string;
  language: Language;
  gradeLevel: GradeLevel;
  difficulty: Difficulty;
  category: string;
  coverEmoji: string;
  coverColor: string;
  coverIllustrationPrompt?: string;
  moralOrTakeaway: string;
  pages: StoryPage[];
  spotlightWords: SpotlightWord[];
  comprehensionQuiz: ComprehensionQuestion[];
  isDownloadedOffline?: boolean;
  isCustomGenerated?: boolean;
  sourceChapter?: string;
  createdDate?: string;
}

export interface Badge {
  id: string;
  name: string;
  nameNative: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  category: 'language' | 'streak' | 'accuracy' | 'mastery';
}

export interface ReadingSessionLog {
  id: string;
  studentId: string;
  storyId: string;
  storyTitle: string;
  language: Language;
  gradeLevel: GradeLevel;
  date: string;
  durationSeconds: number;
  wordsRead: number;
  totalWords: number;
  accuracyRate: number; // 0 - 100
  wpm: number;
  starsEarned: number;
  quizScore?: number; // e.g. 3/3
  struggledWords: string[];
  synced: boolean;
}

export interface PronunciationLanguageMetrics {
  accuracy: number;
  speedWPM: number;
  fluency: number;
  attempts: number;
  lastUpdated: string;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  avatar: string;
  grade: GradeLevel;
  villageSchool: string;
  stars: number;
  streakDays: number;
  lastActiveDate: string;
  mascotAccessory: 'none' | 'scholar_cap' | 'star_crown' | 'glasses' | 'superhero_cape' | 'golden_wand';
  badges: string[]; // badge ids
  completedStoryIds: string[];
  languageProficiency: {
    Telugu: number; // 0 - 100
    Hindi: number;
    English: number;
  };
  totalMinutesRead: number;
  averageWPM: number;
  overallAccuracy: number;
  pronunciationMetrics?: Partial<Record<Language, PronunciationLanguageMetrics>>;
}

export interface TextbookChapterAnalysis {
  chapterNumber: string;
  chapterTitle: string;
  // Full OCR text for this chapter/section, never truncated.
  text: string;
  paragraphs: string[];
  primaryTopic: string;
  summary: string;
  importantConcepts: string[];
  keyVocabulary: {
    word: string;
    meaning: string;
    phonetic: string;
  }[];
  learningObjectives: string[];
  suggestedStoryThemes: string[];
}

export interface TextbookAnalysis {
  subject: string;
  grade: string;
  // These four fields mirror the currently-selected chapter (chapters[0] by
  // default) so existing single-chapter consumers (e.g. StoryGeneratorModal)
  // keep working unchanged. Use `chapters` to browse/select any chapter.
  chapterNumber: string;
  chapterTitle: string;
  primaryLanguage: 'Telugu' | 'Hindi' | 'English' | 'Bilingual';
  extractedText: string;
  summary: string;
  keyVocabulary: {
    word: string;
    meaning: string;
    phonetic: string;
  }[];
  learningObjectives: string[];
  suggestedStoryThemes: string[];
  // Every chapter/section the OCR pipeline detected in the uploaded book,
  // each with its own full text, paragraphs, and AI-generated insights.
  chapters?: TextbookChapterAnalysis[];
  bookTitle?: string;
  overallSummary?: string;
}

export type MascotMood = 'happy' | 'listening' | 'cheering' | 'clapping' | 'thinking' | 'celebrating' | 'sleepy';

export type ReaderMode = 'listen' | 'read_aloud' | 'practice';

export type KidVoiceProfileId = 'ananya' | 'rohan' | 'chintu' | 'deepa';

export type VoiceEngineType = 'sarvam_hd' | 'kid_buddies' | 'browser_native';

export type SarvamNeuralVoiceId = 'Priya' | 'Shubh';

export interface SarvamVoiceOption {
  id: SarvamNeuralVoiceId;
  name: string;
  nativeTitle: Record<Language, string>;
  gender: 'female' | 'male';
  tone: string;
  avatar: string;
  bestFor: string;
  samplePhrase: Record<Language, string>;
}

export interface VoiceSettingsState {
  engine: VoiceEngineType;
  kidProfileId: KidVoiceProfileId;
  sarvamVoice: SarvamNeuralVoiceId;
  rate: number; // 0.6 to 1.4
  pitch: number; // 0.8 to 1.8
  volume: number; // 0.0 to 1.0
  autoPronounceSlowPhonics: boolean;
  streamNeuralAudio: boolean;
}

export interface KidVoiceProfile {
  id: KidVoiceProfileId;
  name: string;
  nativeName: string;
  avatar: string;
  gender: 'girl' | 'boy';
  pitch: number;
  rate: number;
  accent: string;
  description: string;
  samplePhrase: Record<Language, string>;
}

export type UserRole = 'student' | 'faculty' | 'admin' | 'superadmin';

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  rollNumber?: string;
  avatar: string;
  schoolId: string;
  schoolName: string;
  grade?: GradeLevel;
  designation?: string;
  phone?: string;
  createdAt: string;
}

export interface FacultyMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phone: string;
  designation: string; // e.g. "Primary Telugu Head", "Class 2 Homeroom Teacher", "Special Literacy Educator"
  assignedGrades: GradeLevel[];
  subjects: string[];
  schoolId: string;
  schoolName: string;
  joinedDate: string;
  status: 'active' | 'on_leave';
  activeClassrooms: number;
  studentsCount: number;
}

export interface SchoolInfo {
  id: string;
  name: string;
  code: string; // e.g. "ZPHS-KTR-04"
  district: string;
  state: string;
  board: string; // e.g. "Primary State Board / Model School Board"
  type: 'Government Primary' | 'Zilla Parishad School' | 'Model Residential' | 'Aided Primary';
  totalStudents: number;
  totalTeachers: number;
  activeLanguageWings: string[];
  headmasterName: string;
  contactEmail: string;
  establishedYear: number;
}

export interface ClassSection {
  id: string;
  grade: GradeLevel;
  section: string; // e.g. "A (Akshara)", "B (Chaitanya)"
  classTeacherId: string;
  classTeacherName: string;
  schoolId: string;
  roomNumber: string;
  totalStudents: number;
  averageAccuracy: number;
  averageWpm: number;
  languageFocus: Language[];
}

export interface SystemTelemetry {
  serverStatus: 'healthy' | 'degraded' | 'maintenance';
  uptimeSeconds: number;
  geminiModel: string;
  totalOcrScans: number;
  totalStoriesGenerated: number;
  totalReadingMinutes: number;
  totalSpeechEvaluations: number;
  activeSchoolsCount: number;
  totalStudentsRegistered: number;
  totalFacultyMembers: number;
  geminiApiLatencyMs: number;
  tokenConsumptionEstimate: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  role: UserRole;
  ipAddress?: string;
  details: string;
  status: 'SUCCESS' | 'WARN' | 'INFO';
}

export type NetworkToastType =
  | 'sync_error'
  | 'fetch_error'
  | 'sync_success'
  | 'fetch_success'
  | 'offline_detected';

export interface NetworkSyncToast {
  id: string;
  type: NetworkToastType;
  title: string;
  titleNative?: string;
  message: string;
  messageNative?: string;
  itemCount?: number;
  packName?: string;
  canRetry?: boolean;
  isRetrying?: boolean;
  actionLabel?: string;
  timestamp?: string;
  retryAction?: () => Promise<boolean | void>;
}

export type AppViewRoute =
  | 'landing'
  | 'student_library'
  | 'voice_setup'
  | 'reader'
  | 'student_profile'
  | 'faculty_dashboard'
  | 'school_admin'
  | 'superadmin'
  | 'login';


