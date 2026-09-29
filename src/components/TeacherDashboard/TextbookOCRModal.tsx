import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GradeLevel, Language, TextbookAnalysis, TextbookChapterAnalysis } from '../../types';
import { soundEffects } from '../../services/soundEffects';
import { backendApi } from '../../services/backendApi';
import {
  HUB_SUBJECTS,
  HubSubject,
  hubSubjectForReading,
} from '../../services/publishedReadingToStory';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  GraduationCap,
  Languages,
  Send,
} from 'lucide-react';

const OCR_LANGUAGES: Language[] = ['Telugu', 'Hindi', 'English'];
const PUBLISH_GRADES: GradeLevel[] = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];

// The single-chapter fields on TextbookAnalysis (chapterNumber, summary,
// etc.) always mirror whichever chapter is "selected" — chapters[0] right
// after analysis, or whatever the teacher picked in the chapter navigator.
// Downstream consumers (StoryGeneratorModal) only ever read those top-level
// fields, so they don't need to know chapters[] exists at all.
function buildAnalysisForChapter(
  base: TextbookAnalysis,
  chapter: TextbookChapterAnalysis | undefined
): TextbookAnalysis {
  if (!chapter) return base;
  return {
    ...base,
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.chapterTitle,
    extractedText: chapter.text,
    summary: chapter.summary,
    keyVocabulary: chapter.keyVocabulary,
    learningObjectives: chapter.learningObjectives,
    suggestedStoryThemes: chapter.suggestedStoryThemes,
  };
}

interface TextbookOCRModalProps {
  onClose: () => void;
  onAnalysisComplete: (analysis: TextbookAnalysis) => void;
}

// Preset samples of Indian primary school textbook pages for rapid testing
const SAMPLE_TEXTBOOKS = [
  {
    name: 'Telugu Story Class 3 (పాఠం: చెరువు ప్రాముఖ్యత)',
    subject: 'Telugu Reader',
    grade: 'Class 3',
    language: 'Telugu',
    sampleText: 'మా ఊరి చెరువు ఎంతో అందమైనది. వర్షాకాలంలో చెరువు నీటితో నిండి కనువిందు చేస్తుంది. రైతులు చెరువు నీటితో వరి, చెరకు పంటలు పండిస్తారు. చెరువులో తామర పూలు వికసిస్తాయి.',
    summary: 'This chapter teaches children about the lifeline of rural villages—the village lake (చెరువు). It highlights rain water harvesting, irrigation for crops, and aquatic ecosystems.',
  },
  {
    name: 'Hindi Story Class 2 (पाठ: तितली और कली)',
    subject: 'Hindi Rimjhim',
    grade: 'Class 2',
    language: 'Hindi',
    sampleText: 'हरी डाल पर लगी हुई थी, नन्हीं सुंदर एक कली। तितली उससे आकर बोली, तुम लगती हो बड़ी भली। अब जागो तुम आँखें खोलो, और हमारे संग खेलो।',
    summary: 'A joyful poem celebrating nature, awakening flowers, and the playful friendship between a butterfly and a budding blossom.',
  },
  {
    name: 'Primary EVS Science Class 3 (Water Cycle & Rain in Villages)',
    subject: 'Environmental Studies (EVS)',
    grade: 'Class 3',
    language: 'English',
    sampleText: 'When the hot sun shines on ponds and rivers, water warms up and turns into invisible vapor. It rises up into the cool sky to form fluffy clouds and brings rain back to the earth.',
    summary: 'A fundamental environmental science lesson explaining evaporation, condensation, cloud formation, and rainfall.',
  },
];

export const TextbookOCRModal: React.FC<TextbookOCRModalProps> = ({
  onClose,
  onAnalysisComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; data: string; mimeType: string } | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<Language>('Telugu');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('Preparing textbook...');
  const [analysisResult, setAnalysisResult] = useState<TextbookAnalysis | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ocrInfo, setOcrInfo] = useState<{ engine: string; failedPages: number[] } | null>(null);
  const [publishGrade, setPublishGrade] = useState<GradeLevel>('Class 3');
  const [publishSubject, setPublishSubject] = useState<HubSubject>('English');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedReadingId, setPublishedReadingId] = useState<string | null>(null);

  const chapters = analysisResult?.chapters;
  const activeChapterView = useMemo(
    () =>
      analysisResult
        ? buildAnalysisForChapter(analysisResult, chapters?.[selectedChapterIndex])
        : null,
    [analysisResult, chapters, selectedChapterIndex]
  );

  // Publishing is per-chapter: reset any previous publish result/error when
  // the teacher switches chapters or picks a fresh grade, so a stale
  // "Published!" state can't linger on the wrong chapter.
  useEffect(() => {
    setPublishedReadingId(null);
    setPublishError(null);
  }, [selectedChapterIndex, analysisResult]);

  // Default the publish grade to Qwen's guess when it lands on one of the
  // five grades this app supports; otherwise leave the teacher's own last
  // pick (or the initial default) in place rather than resetting it.
  useEffect(() => {
    if (analysisResult && PUBLISH_GRADES.includes(analysisResult.grade as GradeLevel)) {
      setPublishGrade(analysisResult.grade as GradeLevel);
    }
    if (analysisResult) {
      setPublishSubject(
        hubSubjectForReading(analysisResult.subject, analysisResult.primaryLanguage) ??
          hubSubjectForReading('', ocrLanguage) ??
          'English'
      );
    }
  }, [analysisResult]);

  // The reader's voice (TTS/STT) language comes from the reading's language,
  // so an AI label like "Bilingual"/"Unknown" must not reach it.
  const publishLanguage: Language = (['Telugu', 'Hindi', 'English'] as string[]).includes(
    String(analysisResult?.primaryLanguage)
  )
    ? (analysisResult!.primaryLanguage as Language)
    : ocrLanguage;

  const handlePublishToStudents = async () => {
    const chapter = chapters?.[selectedChapterIndex];
    if (!chapter || !analysisResult) return;

    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await backendApi.readings.publish(
        chapter,
        publishGrade,
        publishSubject,
        publishLanguage,
        analysisResult.bookTitle || selectedFile?.name || 'Textbook'
      );
      setPublishedReadingId(result.id);
      soundEffects.playVictoryFanfare();
    } catch (err: any) {
      setPublishError(err?.message || 'Failed to publish this chapter to students.');
    } finally {
      setIsPublishing(false);
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setOcrInfo(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        data: dataUrl,
        mimeType: file.type || 'application/pdf',
      });
      soundEffects.playWordPop();
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read uploaded file.');
    };
    reader.readAsDataURL(file);
  };

  // Start asynchronous OCR + Ollama analysis.
  // The backend returns a job id immediately. We then poll the job until it
  // finishes. HTTP errors are handled separately from real network failures.
  const handleAnalyzeDocument = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(2);
    setAnalysisStage('Uploading textbook and starting OCR...');
    setErrorMsg(null);
    setOcrInfo(null);
    setSelectedChapterIndex(0);
    soundEffects.playPageTurn();

    const startJob = async () => {
      const response = await fetch('/api/ocr/analyze-textbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: selectedFile.data,
          mimeType: selectedFile.mimeType,
          fileName: selectedFile.name,
          language: ocrLanguage,
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Backend returned an invalid response (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !data.success || !data.jobId) {
        throw new Error(
          data.error || `Could not start textbook processing (HTTP ${response.status}).`
        );
      }

      return data;
    };

    try {
      let startData = await startJob();
      let jobId = startData.jobId as string;

      setAnalysisProgress(startData.progress ?? 5);
      setAnalysisStage(startData.stageMessage || 'Textbook queued...');

      let consecutiveNetworkErrors = 0;
      let jobRestarted = false;

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
          const statusResponse = await fetch(
            `/api/ocr/analyze-textbook/status/${encodeURIComponent(jobId)}`,
            {
              method: 'GET',
              cache: 'no-store',
            }
          );

          let statusData: any = {};
          try {
            statusData = await statusResponse.json();
          } catch {
            throw new Error(
              `Backend returned an invalid status response (HTTP ${statusResponse.status}).`
            );
          }

          // A 404 is NOT a network failure. It usually means the backend was
          // restarted and its in-memory job map was cleared. Since the file is
          // still in the browser, safely create a fresh job once.
          if (statusResponse.status === 404 && !jobRestarted) {
            jobRestarted = true;
            consecutiveNetworkErrors = 0;
            setAnalysisProgress(3);
            setAnalysisStage(
              'Analysis session was restarted. Starting the textbook again...'
            );

            startData = await startJob();
            jobId = startData.jobId as string;
            setAnalysisProgress(startData.progress ?? 5);
            setAnalysisStage(
              startData.stageMessage || 'Textbook queued again...'
            );
            continue;
          }

          if (!statusResponse.ok) {
            throw new Error(
              statusData.error ||
                `Could not read textbook analysis status (HTTP ${statusResponse.status}).`
            );
          }

          // We successfully reached the backend, so reset the network error
          // counter immediately.
          consecutiveNetworkErrors = 0;

          if (statusData.status === 'failed' || statusData.success === false) {
            throw new Error(
              statusData.error || 'Textbook analysis failed.'
            );
          }

          if (statusData.status === 'completed' && statusData.analysis) {
            setAnalysisProgress(100);
            setAnalysisStage('Textbook analysis completed.');
            setAnalysisResult(statusData.analysis);
            setOcrInfo({
              engine: String(statusData.ocr?.engine || ''),
              failedPages: Array.isArray(statusData.ocr?.failedPages)
                ? statusData.ocr.failedPages
                : [],
            });
            soundEffects.playVictoryFanfare();
            break;
          }

          setAnalysisProgress(
            Math.max(2, Math.min(99, Number(statusData.progress ?? 5)))
          );
          setAnalysisStage(
            statusData.stageMessage || 'Processing textbook...'
          );
        } catch (pollError: any) {
          const isNetworkError =
            pollError?.name === 'TypeError' ||
            /fetch failed|failed to fetch|network|connection|socket|timeout/i.test(
              String(pollError?.message || '')
            );

          if (!isNetworkError) {
            throw pollError;
          }

          // Temporary browser/Vite connection hiccups should not cancel the
          // backend job. Keep trying rather than giving up after 8 attempts.
          consecutiveNetworkErrors += 1;

          setAnalysisStage(
            `Connection hiccup — reconnecting (${consecutiveNetworkErrors})...`
          );

          // Give the browser a little more time before the next poll.
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    } catch (err: any) {
      console.warn('OCR processing error:', err);
      setErrorMsg(
        err.message ||
          'OCR processing failed. Check that the Docling OCR service and Ollama are running.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load a preset sample textbook
  const handleLoadSample = (sample: typeof SAMPLE_TEXTBOOKS[0]) => {
    soundEffects.playWordPop();
    const keyVocabulary = [
      { word: sample.language === 'Telugu' ? 'చెరువు' : sample.language === 'Hindi' ? 'तितली' : 'Vapor', meaning: 'Core subject concept', phonetic: 'Phonetic root' },
      { word: sample.language === 'Telugu' ? 'వర్షాకాలం' : sample.language === 'Hindi' ? 'कली' : 'Condensation', meaning: 'Seasonal phenomenon', phonetic: 'Phonetic root' },
    ];
    const learningObjectives = [
      'Understand rural ecosystem and natural cycles',
      'Learn vocabulary in ' + sample.language,
      'Develop decodable reading comprehension',
    ];
    const suggestedStoryThemes = ['Village Nature', 'Helpful Friends in Nature'];
    const chapter: TextbookChapterAnalysis = {
      chapterNumber: 'Chapter 3',
      chapterTitle: sample.name,
      text: sample.sampleText,
      paragraphs: [sample.sampleText],
      images: [],
      tables: [],
      primaryTopic: sample.subject,
      summary: sample.summary,
      importantConcepts: [],
      keyVocabulary,
      learningObjectives,
      suggestedStoryThemes,
    };
    const mockAnalysis: TextbookAnalysis = {
      subject: sample.subject,
      grade: sample.grade,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      primaryLanguage: sample.language as any,
      extractedText: sample.sampleText,
      summary: sample.summary,
      keyVocabulary,
      learningObjectives,
      suggestedStoryThemes,
      chapters: [chapter],
    };

    setSelectedChapterIndex(0);
    setAnalysisResult(mockAnalysis);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="ocr-modal-overlay">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-[#e8e4d8] relative my-auto max-h-[90vh] flex flex-col justify-between overflow-y-auto"
        id="ocr-modal-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#fff8e6] text-amber-900 rounded-2xl border border-[#fae2a0]">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#2d2d2d]">
                Textbook OCR & Chapter Ingestion
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Upload State Board or NCERT Textbook PDFs / Scans (Telugu, Hindi, English)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-600 rounded-full transition-all border border-[#e5e1d5]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {!analysisResult ? (
          <div className="space-y-4">
            {/* Upload Area */}
            <label
              htmlFor="textbook-file-input"
              className="border-2 border-dashed border-[#d8d3c5] hover:border-[#2d2d2d] bg-[#fbf9f4] hover:bg-[#f5f1e6] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#f4f1e8] text-[#2d2d2d] border border-[#e8e4d8] flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-black text-[#2d2d2d]">
                {selectedFile ? selectedFile.name : 'Click to Upload Textbook PDF or Page Photo'}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Supports PDF, JPG, PNG (Telugu, Hindi, English textbooks)
              </p>
              <input
                id="textbook-file-input"
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Textbook language — Docling's Tesseract backend loads a
                different language set per script, so this must be picked
                before scanning. */}
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block mb-2">
                Textbook Language
              </span>
              <div className="flex gap-2">
                {OCR_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      soundEffects.playWordPop();
                      setOcrLanguage(lang);
                    }}
                    disabled={isAnalyzing}
                    className={`flex-1 px-3 py-2.5 rounded-2xl text-xs font-black border transition-all disabled:opacity-50 ${
                      ocrLanguage === lang
                        ? 'bg-[#2d2d2d] text-white border-[#2d2d2d]'
                        : 'bg-[#fbf9f4] text-stone-600 border-[#e8e4d8] hover:border-[#2d2d2d]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Error banner if any */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Live analysis progress */}
            {isAnalyzing && (
              <div className="p-4 bg-[#fbf9f4] border border-[#e8e4d8] rounded-2xl">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-black text-[#2d2d2d]">
                    {analysisStage}
                  </span>
                  <span className="text-[11px] font-black text-amber-700">
                    {analysisProgress}%
                  </span>
                </div>
                <div className="h-2 bg-[#e8e4d8] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-2">
                  This runs locally. You can wait here while Docling reads the pages and Qwen builds the educational summary.
                </p>
              </div>
            )}

            {/* Action to Analyze */}
            {selectedFile && (
              <button
                onClick={handleAnalyzeDocument}
                disabled={isAnalyzing}
                className="w-full bg-[#2d2d2d] hover:bg-black disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>AI reading and analyzing textbook...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Run AI OCR & Classify Subject</span>
                  </>
                )}
              </button>
            )}

            {/* Preset Samples Section for Quick Testing */}
            <div className="pt-3 border-t border-[#f0ece1]">
              <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block mb-2.5">
                Or Try Rural School Textbook Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SAMPLE_TEXTBOOKS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLoadSample(sample)}
                    className="p-3.5 bg-[#fbf9f4] hover:bg-[#fff8e6] border border-[#e8e4d8] hover:border-[#fae2a0] rounded-2xl text-left transition-all group"
                  >
                    <span className="text-xs font-black text-[#2d2d2d] group-hover:text-amber-900 block truncate">{sample.subject}</span>
                    <span className="text-[11px] text-stone-500 font-medium block mt-0.5">{sample.grade} • {sample.language}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : activeChapterView ? (
          /* OCR Analysis Result Display */
          <div className="space-y-4" id="ocr-analysis-result">
            {ocrInfo && ocrInfo.failedPages.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900">
                {ocrInfo.failedPages.length === 1 ? 'Page' : 'Pages'} {ocrInfo.failedPages.join(', ')} could
                not be read and {ocrInfo.failedPages.length === 1 ? 'is' : 'are'} missing below. Try uploading
                {ocrInfo.failedPages.length === 1 ? ' that page' : ' those pages'} again separately.
              </div>
            )}
            {ocrInfo?.engine && (
              <span className="text-[10px] text-stone-400 font-bold block">
                Read with {ocrInfo.engine}
              </span>
            )}
            {/* Classified Meta Badges */}
            <div className="grid grid-cols-3 gap-2.5 bg-[#fbf9f4] p-3.5 rounded-2xl border border-[#e8e4d8] text-xs">
              <div>
                <span className="text-[10px] text-stone-400 font-black uppercase block">Subject</span>
                <span className="font-black text-[#2d2d2d] truncate block mt-0.5">{analysisResult.subject}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-black uppercase block">Class / Grade</span>
                <span className="font-black text-[#2d2d2d] block mt-0.5">{analysisResult.grade}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-black uppercase block">Language</span>
                <span className="font-black text-[#2d2d2d] block mt-0.5">{analysisResult.primaryLanguage}</span>
              </div>
            </div>

            {/* Chapter Navigator — every chapter/section OCR detected in the
                book, not just the first one. */}
            {chapters && chapters.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {chapters.length} Chapters Detected
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedChapterIndex((i) => Math.max(0, i - 1))}
                      disabled={selectedChapterIndex === 0}
                      className="p-1.5 rounded-lg bg-[#f4f1e8] hover:bg-[#eae5d8] disabled:opacity-40 text-stone-600"
                      aria-label="Previous chapter"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-black text-stone-500 w-14 text-center">
                      {selectedChapterIndex + 1} / {chapters.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedChapterIndex((i) => Math.min(chapters.length - 1, i + 1))
                      }
                      disabled={selectedChapterIndex === chapters.length - 1}
                      className="p-1.5 rounded-lg bg-[#f4f1e8] hover:bg-[#eae5d8] disabled:opacity-40 text-stone-600"
                      aria-label="Next chapter"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {chapters.map((chapter, index) => (
                    <button
                      key={`${chapter.chapterNumber}-${index}`}
                      type="button"
                      onClick={() => setSelectedChapterIndex(index)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-black border transition-all max-w-[160px] truncate ${
                        index === selectedChapterIndex
                          ? 'bg-[#2d2d2d] text-white border-[#2d2d2d]'
                          : 'bg-[#fbf9f4] text-stone-600 border-[#e8e4d8] hover:border-[#2d2d2d]'
                      }`}
                      title={chapter.chapterTitle}
                    >
                      {chapter.chapterTitle}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chapter Details */}
            <div className="bg-[#f8f6f0] p-4 rounded-2xl border border-[#e8e4d8]">
              <div className="flex items-center gap-2 text-xs font-black text-stone-500 mb-1">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>{activeChapterView.chapterNumber || 'Chapter'}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#2d2d2d]">
                {activeChapterView.chapterTitle}
              </h3>
              {chapters?.[selectedChapterIndex]?.paragraphs?.length ? (
                <p className="text-[10px] text-stone-400 font-bold mt-1">
                  {chapters[selectedChapterIndex].paragraphs.length} paragraph
                  {chapters[selectedChapterIndex].paragraphs.length === 1 ? '' : 's'} extracted
                  {chapters[selectedChapterIndex].images?.length ? (
                    <> · {chapters[selectedChapterIndex].images.length} image
                    {chapters[selectedChapterIndex].images.length === 1 ? '' : 's'}</>
                  ) : null}
                </p>
              ) : null}
            </div>

            {/* Extracted Images — every picture Docling pulled out of this
                chapter/section, with its resolved caption if it had one. */}
            {chapters?.[selectedChapterIndex]?.images?.length ? (
              <div>
                <span className="text-xs font-black text-stone-700 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  Extracted Images:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {chapters[selectedChapterIndex].images.map((image, i) => (
                    <div
                      key={i}
                      className="bg-[#fbf9f4] border border-[#e8e4d8] rounded-2xl overflow-hidden"
                    >
                      <img
                        src={`data:${image.mimeType};base64,${image.base64}`}
                        alt={image.caption || `Figure ${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      {image.caption ? (
                        <p className="text-[10px] text-stone-500 font-medium px-2 py-1.5 truncate" title={image.caption}>
                          {image.caption}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Chapter Summary */}
            <div className="p-4 bg-[#fff8e6] border border-[#fae2a0] rounded-2xl">
              <span className="text-xs font-black text-amber-950 uppercase tracking-wider block mb-1">
                📖 Chapter Summary:
              </span>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                {activeChapterView.summary}
              </p>
            </div>

            {/* Extracted Vocabulary */}
            {activeChapterView.keyVocabulary?.length > 0 && (
              <div>
                <span className="text-xs font-black text-stone-700 block mb-2">
                  Spotlight Vocabulary:
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeChapterView.keyVocabulary.map((v, i) => (
                    <span
                      key={i}
                      className="text-xs bg-[#f4f1e8] text-[#2d2d2d] font-bold px-3 py-1 rounded-xl border border-[#e8e4d8]"
                    >
                      {v.word} ({v.meaning})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Objectives */}
            {activeChapterView.learningObjectives?.length > 0 && (
              <div className="bg-[#eff6ff] p-3.5 rounded-2xl border border-[#bfdbfe] text-xs text-blue-950">
                <span className="font-black block mb-1">🎯 Learning Objectives:</span>
                <ul className="list-disc list-inside space-y-0.5 font-medium text-stone-700">
                  {activeChapterView.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Publish to Students — sends the REAL OCR'd chapter (text,
                images, tables) to students in the picked grade, with a
                comprehension quiz Qwen generates from that real text. This
                is the primary path; "Build Read-Along Story" below is a
                separate, secondary option that has Qwen invent new
                narrative content instead. */}
            <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Publish This Chapter to Students
                </span>
                <select
                  value={publishGrade}
                  onChange={(e) => setPublishGrade(e.target.value as GradeLevel)}
                  disabled={isPublishing}
                  id="publish-grade-select"
                  className="text-xs font-bold bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-emerald-900 disabled:opacity-50"
                >
                  {PUBLISH_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select
                  value={publishSubject}
                  onChange={(e) => setPublishSubject(e.target.value as HubSubject)}
                  disabled={isPublishing}
                  id="publish-subject-select"
                  aria-label="Subject students will find this chapter under"
                  className="text-xs font-bold bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-emerald-900 disabled:opacity-50"
                >
                  {HUB_SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {publishError && (
                <p className="text-[11px] text-rose-700 font-medium">{publishError}</p>
              )}

              {publishedReadingId ? (
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Published! Students in {publishGrade} will find this chapter under {publishSubject}.
                  </span>
                </div>
              ) : (
                <button
                  onClick={handlePublishToStudents}
                  disabled={isPublishing}
                  id="btn-publish-reading-to-students"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm py-2.5 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing & generating quiz...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Publish to {publishGrade}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Action: Scan another / secondary AI-story option */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#f0ece1]">
              <button
                onClick={() => setAnalysisResult(null)}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 px-3 py-2"
              >
                ← Scan Another Textbook
              </button>

              <button
                onClick={() => onAnalysisComplete(activeChapterView)}
                id="btn-generate-story-from-ocr"
                className="bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700 font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl transition-all flex items-center gap-2 border border-[#e5e1d5]"
              >
                <span>Or Build an AI Story From This Chapter Instead</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};
