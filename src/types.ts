export type Language = 'Telugu' | 'Hindi' | 'English';

export type GradeLevel =
  | 'Class 1'
  | 'Class 2'
  | 'Class 3'
  | 'Class 4'
  | 'Class 5';

export type Difficulty = 'Easy' | 'Medium' | 'Challenging';

export interface SpotlightWord {
  word: string;
  meaning: string;
  pronunciation?: string;
  phonetic?: string;
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
  // A real photo/illustration OCR extracted from the source textbook page,
  // present only when this page comes from a published textbook reading
  // (Story.isTextbookReading) rather than an AI-invented story. Takes
  // priority over illustrationPrompt in the reader when present.
  imageBase64?: string;
  imageMimeType?: string;
  imageCaption?: string;
  // A table OCR recognized on this page, as markdown (see
  // DetectedChapterTable on the server). Rendered inline below the text.
  tableMarkdown?: string;
  tableCaption?: string;
  // The printed textbook page this reader page's text came from.
  sourcePage?: number | null;
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
  // True when this Story's pages are the real OCR'd textbook chapter a
  // teacher published (see PublishedReading), not AI-invented fiction.
  // sourceReadingId is the PublishedReading document this was built from —
  // used only to avoid re-fetching/re-converting a reading already open.
  isTextbookReading?: boolean;
  sourceReadingId?: string;
  // For a chapter of a published book: the book's chapter reading ids in
  // order, so the reader flow can offer "Next chapter".
  bookId?: string;
  bookTitle?: string;
  bookChapters?: Array<{ id: string; title: string; number: string }>;
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
  accuracyRate: number;
  wpm: number;
  starsEarned: number;
  quizScore?: number;
  struggledWords: string[];
  synced: boolean;
}

export interface PronunciationMetric {
  attempts?: number;
  correct?: number;
  accuracy?: number;
  averageScore?: number;
  lastScore?: number;
  fluency?: number;
  speed?: number;
  speedWPM?: number;
  lastEvaluatedAt?: string;
  [key: string]: unknown;
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
  mascotAccessory:
    | 'none'
    | 'scholar_cap'
    | 'star_crown'
    | 'glasses'
    | 'superhero_cape'
    | 'golden_wand';
  badges: string[];
  completedStoryIds: string[];
  languageProficiency: {
    Telugu: number;
    Hindi: number;
    English: number;
  };
  totalMinutesRead: number;
  averageWPM: number;
  overallAccuracy: number;
  pronunciationMetrics?: Partial<Record<Language, PronunciationMetric>>;
  // Daily reading-goal tracking (see ReadingGrowthSprout) — dailyCertificateDate
  // is the last day dailyCertificatesEarned was counted for, reset once a new
  // day's key no longer matches.
  dailyCertificateDate?: string;
  dailyCertificatesEarned?: number;
}

export interface TextbookChapterImage {
  // Compressed JPEG bytes, base64-encoded — render as
  // `data:${mimeType};base64,${base64}`.
  base64: string;
  mimeType: string;
  pageNumber: number | null;
  caption: string;
}

export interface TextbookChapterTable {
  // The table's structure and cell text, as markdown — directly usable both
  // for display and as AI prompt context, without a separate renderer.
  markdown: string;
  pageNumber: number | null;
  caption: string;
}

export interface TextbookChapterAnalysis {
  chapterNumber: string;
  chapterTitle: string;
  // From the cleanup pass: the book part it belongs to ("Love", "Unit 2"),
  // a subtitle such as the title's translation, and its text's language.
  part?: string;
  subtitle?: string;
  language?: string;
  paragraphPages?: (number | null)[];
  // Full OCR text for this chapter/section, never truncated.
  text: string;
  paragraphs: string[];
  // Every picture/table Docling extracted from this chapter/section, never
  // truncated or dropped.
  images: TextbookChapterImage[];
  tables: TextbookChapterTable[];
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
  // From the AI book-structure pass: which Subject Hub subject this chapter
  // belongs to and what kind of unit it is (lesson/story/poem/exercise).
  subject?: string;
  kind?: string;
  // Deeper analysis.
  keyPoints?: string[];
  themes?: string[];
  moralOrMessage?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | '';
  teachingTips?: string[];
  discussionQuestions?: string[];
  estimatedReadingMinutes?: number;
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
  // How the AI book-structure pass reshaped the raw OCR sections.
  rawSectionCount?: number;
  skippedSectionCount?: number;
  aiStructured?: boolean;
}

// A textbook chapter a teacher has published for their students to read —
// the real OCR'd text/images/tables, not an AI-invented story. Persisted
// server-side (Firestore) via POST /api/readings/publish so it survives
// across devices/browsers and can be grade-filtered, unlike the
// localStorage-only Story[] custom stories use.
export interface PublishedReading {
  id: string;
  schoolId?: string;
  teacherId: string;
  teacherName?: string;
  grade: GradeLevel;
  subject: string;
  language: Language;
  bookTitle: string;
  chapterNumber: string;
  chapterTitle: string;
  paragraphs: string[];
  paragraphPages?: (number | null)[];
  tables: TextbookChapterTable[];
  primaryTopic: string;
  summary: string;
  importantConcepts: string[];
  keyVocabulary: {
    word: string;
    meaning: string;
    phonetic: string;
  }[];
  learningObjectives: string[];
  // Generated from the real paragraphs above at publish time — see
  // generateQuizFromRealText in server.ts — never from an invented story.
  comprehensionQuiz: ComprehensionQuestion[];
  imageCount: number;
  createdAt: string;
  keyPoints?: string[];
  themes?: string[];
  moralOrMessage?: string;
  difficulty?: string;
  discussionQuestions?: string[];
  kind?: string;
  estimatedReadingMinutes?: number | null;
  part?: string;
  subtitle?: string;
  // Set when published as part of a whole book (POST /api/readings/publish-book).
  bookId?: string | null;
  chapterOrder?: number | null;
  chapterCount?: number | null;
}

// Lightweight form of PublishedReading for list views (GET /api/readings) —
// omits paragraphs/quiz/vocabulary detail that only the reader needs, so a
// student's library loads without pulling every reading's full text.
export interface PublishedReadingSummary {
  id: string;
  grade: GradeLevel;
  subject: string;
  language: Language;
  bookTitle: string;
  chapterNumber: string;
  chapterTitle: string;
  summary: string;
  imageCount: number;
  teacherName?: string;
  createdAt: string;
  bookId?: string | null;
  chapterOrder?: number | null;
  chapterCount?: number | null;
  kind?: string;
  difficulty?: string;
  estimatedReadingMinutes?: number | null;
  part?: string;
  subtitle?: string;
}

// A teacher's view of one published book (GET /api/readings/books/mine).
// key is the bookId, or "reading:<id>" for an older single-chapter publish.
export interface PublishedBookSummary {
  key: string;
  bookTitle: string;
  grades: string[];
  subjects: string[];
  chapterCount: number;
  missingQuiz: number;
  // Chapters whose questions are missing, unchecked (older generator) or in
  // the wrong script: what "Fix questions" remakes.
  staleQuiz?: number;
  teacherName?: string | null;
  createdAt: string;
}

// One image belonging to a PublishedReading, fetched separately
// (GET /api/readings/:id/images) — kept out of the main document so a
// chapter with several images never risks Firestore's 1MiB document limit.
export interface PublishedReadingImage {
  id: string;
  base64: string;
  mimeType: string;
  pageNumber: number | null;
  caption: string;
}

export type MascotMood =
  | 'happy'
  | 'listening'
  | 'cheering'
  | 'clapping'
  | 'thinking'
  | 'celebrating'
  | 'sleepy';

export type ReaderMode =
  | 'listen'
  | 'read_aloud'
  | 'practice';

export type KidVoiceProfileId =
  | 'ananya'
  | 'rohan'
  | 'chintu'
  | 'deepa';

export type VoiceEngineType =
  | 'browser_native'
  | 'sarvam_hd'
  | 'kid_buddies';

export type GeminiNeuralVoiceId =
  | 'Kore'
  | 'Puck'
  | 'Fenrir'
  | 'Zephyr'
  | 'Aoede'
  | 'Charon';

export type SarvamNeuralVoiceId =
  | 'Priya'
  | 'Neel'
  | 'Ritu'
  | 'Aman'
  | 'Aditya'
  | 'Kavya'
  | 'Varun'
  | 'Ishita'
  | 'Rahul'
  | 'Anu'
  | 'Arjun'
  | 'Meera'
  | 'Vikram'
  | 'Pooja'
  | 'Riya'
  | 'Kabir'
  | 'Nisha'
  | 'Dev'
  | 'Simran'
  | 'Kiran'
  | 'Sita'
  | 'Gita'
  | 'Ravi'
  | 'Mohan'
  | 'Sanjay'
  | 'Asha'
  | 'Lakshmi'
  | 'Vijay'
  | 'Sneha'
  | 'Deepak'
  | 'Neha'
  | 'Anjali'
  | 'Aarav'
  | 'Diya'
  | 'Ira'
  | 'Aditi'
  | 'Shreya'
  | 'Tara'
  | 'Zoya'
  | 'default'
  | (string & {});

export interface GeminiVoiceOption {
  id: GeminiNeuralVoiceId;
  name: string;
  nativeTitle: Record<Language, string>;
  gender: 'female' | 'male';
  tone: string;
  avatar: string;
  bestFor: string;
  samplePhrase: Record<Language, string>;
}

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
  geminiVoice?: GeminiNeuralVoiceId;
  sarvamVoice: SarvamNeuralVoiceId;
  rate: number;
  pitch: number;
  volume: number;
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

export interface KidSpeechOptions {
  engine?: VoiceEngineType;
  sarvamVoice?: SarvamNeuralVoiceId;
  geminiVoice?: GeminiNeuralVoiceId;
  kidProfileId?: KidVoiceProfileId;
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: Language;
}

export type UserRole =
  | 'student'
  | 'faculty'
  | 'admin'
  | 'superadmin';

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
  section?: string;
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
  designation: string;
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
  code: string;
  district: string;
  state: string;
  board: string;
  type:
    | 'Government Primary'
    | 'Zilla Parishad School'
    | 'Model Residential'
    | 'Aided Primary';
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
  section: string;
  classTeacherId: string;
  classTeacherName: string;
  schoolId: string;
  roomNumber: string;
  totalStudents: number;
  averageAccuracy: number;
  averageWpm: number;
  languageFocus: Language[];
}

// Shape of GET /api/superadmin/telemetry (server.ts). Counts are real:
// in-memory counters since the last server restart, plus Firestore counts
// (null when Firestore is unreachable).
export interface SystemTelemetry {
  serverStatus: 'healthy' | 'degraded' | 'maintenance';
  uptimeSeconds: number;
  providers: { ocr: string; text: string; speech: string };
  geminiConfigured: boolean;
  sarvamConfigured: boolean;
  geminiTextModels: string[];
  geminiOcrModels: string[];
  lastTextModelUsed: string;
  totalOcrScans: number;
  totalStoriesGenerated: number;
  totalSpeechEvaluations: number;
  publishedReadings: number | null;
  publishedByLanguage: Record<string, number>;
  facultyAccounts: number | null;
  schoolsWithAccounts: number | null;
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
  | 'learn_play'
  | 'voice_setup'
  | 'reader'
  | 'student_profile'
  | 'faculty_dashboard'
  | 'school_admin'
  | 'superadmin'
  | 'login';