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
  Sparkles,
  Loader2,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  X,
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
  // Whole-book view: subject filter, per-chapter subject overrides, and the
  // result of publishing every chapter at once.
  const [subjectFilter, setSubjectFilter] = useState<HubSubject | 'All'>('All');
  const [subjectOverrides, setSubjectOverrides] = useState<Record<number, HubSubject>>({});
  const [showFullText, setShowFullText] = useState(false);
  const [isPublishingBook, setIsPublishingBook] = useState(false);
  const [bookPublishResult, setBookPublishResult] = useState<
    { published: number; total: number; bySubject: Record<string, number> } | null
  >(null);

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
    setShowFullText(false);
  }, [selectedChapterIndex, analysisResult]);

  useEffect(() => {
    setSubjectOverrides({});
    setSubjectFilter('All');
    setBookPublishResult(null);
  }, [analysisResult]);

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

  // Each chapter's Subject Hub tile: the teacher's override, else the AI's
  // per-chapter subject, else the book-level default.
  const chapterSubject = (index: number): HubSubject =>
    subjectOverrides[index] ??
    hubSubjectForReading(chapters?.[index]?.subject || '', publishLanguage) ??
    publishSubject;

  const subjectCounts = useMemo(() => {
    const counts = new Map<HubSubject, number>();
    (chapters || []).forEach((_, i) => {
      const subject = chapterSubject(i);
      counts.set(subject, (counts.get(subject) || 0) + 1);
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, subjectOverrides, publishSubject, publishLanguage]);

  const visibleChapterIndexes = (chapters || [])
    .map((_, i) => i)
    .filter((i) => subjectFilter === 'All' || chapterSubject(i) === subjectFilter);

  const handlePublishBook = async () => {
    if (!analysisResult || !chapters?.length) return;
    setIsPublishingBook(true);
    setPublishError(null);
    try {
      const withSubjects = chapters.map((chapter, i) => ({ ...chapter, subject: chapterSubject(i) }));
      const result = await backendApi.readings.publishBook(
        withSubjects,
        publishGrade,
        publishLanguage,
        analysisResult.bookTitle || selectedFile?.name || 'Textbook'
      );
      const bySubject: Record<string, number> = {};
      withSubjects.forEach((chapter, i) => {
        if (result.results[i]?.id) bySubject[chapter.subject] = (bySubject[chapter.subject] || 0) + 1;
      });
      setBookPublishResult({ published: result.published, total: result.total, bySubject });
      soundEffects.playVictoryFanfare();
    } catch (err: any) {
      setPublishError(err?.message || 'Failed to publish the book to students.');
    } finally {
      setIsPublishingBook(false);
    }
  };

  const handlePublishToStudents = async () => {
    const chapter = chapters?.[selectedChapterIndex];
    if (!chapter || !analysisResult) return;

    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await backendApi.readings.publish(
        chapter,
        publishGrade,
        chapterSubject(selectedChapterIndex),
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
          'OCR processing failed. Please try again; if it keeps failing, check the server logs.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none overflow-y-auto font-sans" id="ocr-modal-overlay">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`bg-white rounded-3xl ${analysisResult ? 'max-w-5xl' : 'max-w-2xl'} w-full p-6 sm:p-8 shadow-xl border border-[#e8e4d8] relative my-auto max-h-[90vh] flex flex-col justify-between overflow-y-auto`}
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
                  AI reads every page, works out the book's real chapters and subjects, then analyses each chapter in depth. A long textbook can take a few minutes.
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

          </div>
        ) : activeChapterView && chapters ? (
          /* Whole-book result: book header, publish-all, chapters by subject,
             and the selected chapter's full analysis. */
          <div className="space-y-4" id="ocr-analysis-result">
            {ocrInfo && ocrInfo.failedPages.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-900">
                {ocrInfo.failedPages.length === 1 ? 'Page' : 'Pages'} {ocrInfo.failedPages.join(', ')} could
                not be read and {ocrInfo.failedPages.length === 1 ? 'is' : 'are'} missing below. Try uploading
                {ocrInfo.failedPages.length === 1 ? ' that page' : ' those pages'} again separately.
              </div>
            )}

            {/* Book header */}
            <div className="bg-[#2d2d2d] text-white p-5 rounded-3xl space-y-2" id="ocr-book-header">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {analysisResult.grade !== 'Unknown' ? analysisResult.grade : 'Grade not detected'} ·{' '}
                    {analysisResult.primaryLanguage}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black truncate">
                    {analysisResult.bookTitle || selectedFile?.name || 'Textbook'}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-stone-300 text-right" id="ocr-structure-stats">
                  {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
                  {analysisResult.aiStructured && analysisResult.rawSectionCount
                    ? ` · AI-organised from ${analysisResult.rawSectionCount} scanned sections`
                    : ''}
                  {analysisResult.skippedSectionCount
                    ? ` · ${analysisResult.skippedSectionCount} cover/contents/index section${analysisResult.skippedSectionCount === 1 ? '' : 's'} left out`
                    : ''}
                  {ocrInfo?.engine ? <span className="block text-stone-400">Read with {ocrInfo.engine}</span> : null}
                </span>
              </div>
              {analysisResult.overallSummary && (
                <p className="text-xs text-stone-200 leading-relaxed">{analysisResult.overallSummary}</p>
              )}
            </div>

            {/* Publish the whole book */}
            <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl space-y-3" id="publish-book-panel">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Publish this book to students
                </span>
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                  Class
                  <select
                    value={publishGrade}
                    onChange={(e) => setPublishGrade(e.target.value as GradeLevel)}
                    disabled={isPublishing || isPublishingBook}
                    id="publish-grade-select"
                    className="text-xs font-bold bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-emerald-900 disabled:opacity-50"
                  >
                    {PUBLISH_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-emerald-900/80 font-medium">
                Students in {publishGrade} will see each chapter, in order, under its subject:{' '}
                {[...subjectCounts.entries()].map(([subject, n]) => `${subject} (${n})`).join(', ')}. Each chapter gets
                comprehension questions made from its real text.
              </p>
              {publishError && <p className="text-[11px] text-rose-700 font-medium">{publishError}</p>}
              {bookPublishResult ? (
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800" id="publish-book-result">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Published {bookPublishResult.published} of {bookPublishResult.total} chapters to {publishGrade}:{' '}
                    {Object.entries(bookPublishResult.bySubject)
                      .map(([subject, n]) => `${subject} (${n})`)
                      .join(', ')}
                    .
                  </span>
                </div>
              ) : (
                <button
                  onClick={handlePublishBook}
                  disabled={isPublishingBook || isPublishing}
                  id="btn-publish-book"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm py-3 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isPublishingBook ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing {chapters.length} chapters & generating quizzes...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Publish whole book ({chapters.length} chapter{chapters.length === 1 ? '' : 's'}) to {publishGrade}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-4">
              {/* Subjects -> chapters */}
              <div className="space-y-3" id="ocr-chapter-list">
                <div className="flex flex-wrap gap-1.5">
                  {(['All', ...subjectCounts.keys()] as Array<HubSubject | 'All'>).map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => setSubjectFilter(subject)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${
                        subjectFilter === subject
                          ? 'bg-[#2d2d2d] text-white border-[#2d2d2d]'
                          : 'bg-[#fbf9f4] text-stone-600 border-[#e8e4d8] hover:border-[#2d2d2d]'
                      }`}
                    >
                      {subject === 'All' ? `All (${chapters.length})` : `${subject} (${subjectCounts.get(subject)})`}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 max-h-[52vh] overflow-y-auto pr-1">
                  {visibleChapterIndexes.map((index) => {
                    const chapter = chapters[index];
                    const selected = index === selectedChapterIndex;
                    return (
                      <button
                        key={`${chapter.chapterNumber}-${index}`}
                        type="button"
                        onClick={() => setSelectedChapterIndex(index)}
                        id={`ocr-chapter-${index}`}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                          selected
                            ? 'bg-[#2d2d2d] text-white border-[#2d2d2d]'
                            : 'bg-[#fbf9f4] text-[#2d2d2d] border-[#e8e4d8] hover:border-[#2d2d2d]'
                        }`}
                      >
                        <span
                          className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${
                            selected ? 'bg-amber-400 text-amber-950' : 'bg-[#f0ece1] text-stone-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[10px] font-black uppercase ${selected ? 'text-amber-300' : 'text-stone-400'}`}>
                            {chapter.chapterNumber} · {chapterSubject(index)}
                            {chapter.kind && chapter.kind !== 'lesson' ? ` · ${chapter.kind}` : ''}
                          </span>
                          <span className="block text-xs font-black truncate">{chapter.chapterTitle}</span>
                          <span className={`block text-[10px] font-bold ${selected ? 'text-stone-300' : 'text-stone-400'}`}>
                            {chapter.paragraphs.length} paragraph{chapter.paragraphs.length === 1 ? '' : 's'}
                            {chapter.estimatedReadingMinutes ? ` · ~${chapter.estimatedReadingMinutes} min` : ''}
                            {chapter.difficulty ? ` · ${chapter.difficulty}` : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected chapter: in-depth analysis */}
              <div className="space-y-3" id="ocr-chapter-detail">
                <div className="bg-[#f8f6f0] p-4 rounded-2xl border border-[#e8e4d8] space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 text-xs font-black text-stone-500">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      {activeChapterView.chapterNumber || 'Chapter'}
                    </span>
                    <label className="text-[11px] font-bold text-stone-500 flex items-center gap-1.5">
                      Subject
                      <select
                        value={chapterSubject(selectedChapterIndex)}
                        onChange={(e) =>
                          setSubjectOverrides((prev) => ({ ...prev, [selectedChapterIndex]: e.target.value as HubSubject }))
                        }
                        id="publish-subject-select"
                        className="text-[11px] font-bold bg-white border border-[#e8e4d8] rounded-lg px-2 py-1"
                      >
                        {HUB_SUBJECTS.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-[#2d2d2d]">{activeChapterView.chapterTitle}</h3>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
                    {chapters[selectedChapterIndex]?.kind && (
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-[#e8e4d8] text-stone-600 uppercase">
                        {chapters[selectedChapterIndex].kind}
                      </span>
                    )}
                    {chapters[selectedChapterIndex]?.difficulty && (
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-[#e8e4d8] text-stone-600">
                        {chapters[selectedChapterIndex].difficulty}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-[#e8e4d8] text-stone-600">
                      {chapters[selectedChapterIndex]?.paragraphs.length} paragraphs
                      {chapters[selectedChapterIndex]?.images?.length ? ` · ${chapters[selectedChapterIndex].images.length} images` : ''}
                      {chapters[selectedChapterIndex]?.tables?.length ? ` · ${chapters[selectedChapterIndex].tables.length} tables` : ''}
                    </span>
                    {(chapters[selectedChapterIndex]?.themes || []).map((theme, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>

                {chapters[selectedChapterIndex]?.images?.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {chapters[selectedChapterIndex].images.map((image, i) => (
                      <div key={i} className="bg-[#fbf9f4] border border-[#e8e4d8] rounded-2xl overflow-hidden">
                        <img
                          src={`data:${image.mimeType};base64,${image.base64}`}
                          alt={image.caption || `Figure ${i + 1}`}
                          className="w-full h-20 object-cover"
                        />
                        {image.caption ? (
                          <p className="text-[10px] text-stone-500 font-medium px-2 py-1 truncate" title={image.caption}>
                            {image.caption}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="p-4 bg-[#fff8e6] border border-[#fae2a0] rounded-2xl space-y-2" id="ocr-chapter-summary">
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">Summary</span>
                  <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">{activeChapterView.summary}</p>
                  {chapters[selectedChapterIndex]?.moralOrMessage && (
                    <p className="text-xs text-amber-950 font-bold">Message: {chapters[selectedChapterIndex].moralOrMessage}</p>
                  )}
                </div>

                {(chapters[selectedChapterIndex]?.keyPoints || []).length > 0 && (
                  <div className="p-3.5 bg-white border border-[#e8e4d8] rounded-2xl text-xs" id="ocr-chapter-keypoints">
                    <span className="font-black block mb-1 text-stone-800">Key points</span>
                    <ol className="list-decimal list-inside space-y-0.5 font-medium text-stone-700">
                      {chapters[selectedChapterIndex].keyPoints!.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {activeChapterView.keyVocabulary?.length > 0 && (
                  <div className="p-3.5 bg-white border border-[#e8e4d8] rounded-2xl text-xs">
                    <span className="font-black block mb-1.5 text-stone-800">Vocabulary</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {activeChapterView.keyVocabulary.map((v, i) => (
                        <div key={i} className="bg-[#f8f6f0] rounded-xl px-2.5 py-1.5">
                          <span className="font-black text-[#2d2d2d]">{v.word}</span>
                          {v.phonetic ? <span className="text-stone-400"> /{v.phonetic}/</span> : null}
                          <span className="block text-stone-600">{v.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {activeChapterView.learningObjectives?.length > 0 && (
                    <div className="bg-[#eff6ff] p-3.5 rounded-2xl border border-[#bfdbfe] text-blue-950">
                      <span className="font-black block mb-1">Learning objectives</span>
                      <ul className="list-disc list-inside space-y-0.5 font-medium text-stone-700">
                        {activeChapterView.learningObjectives.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(chapters[selectedChapterIndex]?.teachingTips || []).length > 0 && (
                    <div className="bg-[#f5f3ff] p-3.5 rounded-2xl border border-[#ddd6fe] text-violet-950">
                      <span className="font-black block mb-1">Teaching tips</span>
                      <ul className="list-disc list-inside space-y-0.5 font-medium text-stone-700">
                        {chapters[selectedChapterIndex].teachingTips!.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {(chapters[selectedChapterIndex]?.discussionQuestions || []).length > 0 && (
                  <div className="p-3.5 bg-white border border-[#e8e4d8] rounded-2xl text-xs">
                    <span className="font-black block mb-1 text-stone-800">Discussion questions</span>
                    <ul className="list-disc list-inside space-y-0.5 font-medium text-stone-700">
                      {chapters[selectedChapterIndex].discussionQuestions!.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3.5 bg-white border border-[#e8e4d8] rounded-2xl text-xs">
                  <button
                    type="button"
                    onClick={() => setShowFullText((v) => !v)}
                    className="font-black text-stone-800 flex items-center gap-1.5"
                    id="btn-toggle-chapter-text"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {showFullText ? 'Hide' : 'Show'} the chapter's extracted text
                  </button>
                  {showFullText && (
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto text-stone-700 leading-relaxed whitespace-pre-line">
                      {chapters[selectedChapterIndex].paragraphs.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                      {chapters[selectedChapterIndex].tables.map((table, i) => (
                        <pre key={`t${i}`} className="text-[10px] bg-[#f8f6f0] p-2 rounded-lg overflow-x-auto">
                          {table.markdown}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>

                {/* Single-chapter publish (secondary to publishing the whole book). */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {publishedReadingId ? (
                    <span className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                      Published! Students in {publishGrade} will find this chapter under {chapterSubject(selectedChapterIndex)}.
                    </span>
                  ) : (
                    <button
                      onClick={handlePublishToStudents}
                      disabled={isPublishing || isPublishingBook}
                      id="btn-publish-reading-to-students"
                      className="bg-white hover:bg-emerald-50 disabled:opacity-50 text-emerald-800 border border-emerald-300 font-black text-xs px-4 py-2 rounded-2xl transition-all flex items-center gap-2"
                    >
                      {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Publish only this chapter</span>
                    </button>
                  )}
                  <button
                    onClick={() => onAnalysisComplete(activeChapterView)}
                    id="btn-generate-story-from-ocr"
                    className="bg-[#f4f1e8] hover:bg-[#eae5d8] text-stone-700 font-black text-xs px-4 py-2 rounded-2xl transition-all flex items-center gap-2 border border-[#e5e1d5]"
                  >
                    <span>Build an AI story from this chapter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#f0ece1]">
              <button
                onClick={() => setAnalysisResult(null)}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 px-3 py-2"
              >
                ← Scan Another Textbook
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};
