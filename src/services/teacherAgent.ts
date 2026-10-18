// Client for Shakthi Mitra's teacher agent: streams the agent's steps
// (NDJSON from POST /api/teacher/agent), confirms proposed actions, and runs
// the "ui" ones (print a material, open a screen) right here in the browser.
import { authHeaders, backendApi } from './backendApi';
import { localDay } from './progressSync';
import { printHtml, workbookHtml } from './printWorkbook';
import {
  alphabetChartHtml,
  chapterReaderHtml,
  clockFaceHtml,
  factCardsHtml,
  hundredChartHtml,
  numberCardsHtml,
  questionCardsHtml,
  readingCardsHtml,
  wordCardsHtml,
} from './tlm';
import { mathsLimitForGrade } from '../data/learnPlay';
import { wordsPerPageForGrade } from './publishedReadingToStory';
import { printDayPlan } from '../components/TeacherDashboard/TodayPanel';
import { printReport } from '../components/TeacherDashboard/ReportPanel';
import { printCompetencies } from '../components/TeacherDashboard/CompetencyPanel';
import { openExplainer } from '../components/ExplainerPlayer';

export interface AgentStepEvent {
  n: number;
  thought: string;
  tool: string;
  kind: 'read' | 'action' | 'ui' | 'answer';
  args: Record<string, any>;
  summary: string;
}

export interface AgentAction {
  id: string;
  tool: string;
  kind: 'action' | 'ui';
  args: Record<string, any>;
  label: string;
}

export type AgentStreamEvent =
  | { type: 'step'; step: AgentStepEvent }
  | { type: 'proposal'; action: AgentAction }
  | { type: 'answer'; answer: string; followUps: string[] }
  | { type: 'error'; error: string };

export async function runTeacherAgent(
  message: string,
  history: { role: 'teacher' | 'mitra'; text: string }[],
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
) {
  const headers = new Headers(await authHeaders());
  headers.set('Content-Type', 'application/json');
  const res = await fetch('/api/teacher/agent', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history, day: localDay() }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Shakthi Mitra is not available (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          // a broken line is skipped
        }
      }
      nl = buffer.indexOf('\n');
    }
    if (done) break;
  }
}

export async function confirmAgentAction(id: string): Promise<string> {
  const headers = new Headers(await authHeaders());
  const res = await fetch(`/api/teacher/agent/actions/${encodeURIComponent(id)}/confirm`, { method: 'POST', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not do that.');
  return String(data.result || 'Done.');
}

export const TEACHER_OPEN_EVENT = 'pathana:teacher-open';
export type TeacherScreen = 'today' | 'class_support' | 'class_levels' | 'class_report' | 'class_progress' | 'students' | 'books' | 'tlm' | 'learnplay';

/** Run a ui action (print or open a screen) in this browser. */
export async function runUiAction(action: AgentAction): Promise<string> {
  const a = action.args;
  if (action.tool === 'open_screen') {
    window.dispatchEvent(new CustomEvent(TEACHER_OPEN_EVENT, { detail: { screen: a.screen as TeacherScreen, grade: a.grade } }));
    return 'Opened.';
  }
  if (action.tool === 'play_explainer') {
    openExplainer({ readingId: String(a.readingId), chapterTitle: String(a.title || '') });
    return 'Playing.';
  }
  if (action.tool !== 'print_material') throw new Error('Unknown action.');
  const grade = String(a.grade);
  const reading = async () => (await backendApi.readings.get(String(a.readingId))).reading;
  let html = '';
  switch (a.kind) {
    case 'day_plan':
      printDayPlan(localDay(), (await backendApi.teacherToday([grade], localDay())).classes);
      return 'Printing the day plan.';
    case 'report':
      printReport(await backendApi.support.report(grade, (['day', 'week', 'month'].includes(a.period) ? a.period : 'week') as 'day' | 'week' | 'month', localDay()));
      return 'Printing the report.';
    case 'competencies':
      printCompetencies(grade, await backendApi.support.competencies(grade));
      return 'Printing the competency record.';
    case 'chapter': {
      const r = await reading();
      html = chapterReaderHtml(r.chapterTitle, r.paragraphs, `${r.bookTitle} · ${grade}`);
      break;
    }
    case 'word_cards': {
      const r = await reading();
      html = wordCardsHtml(r.chapterTitle, r.keyVocabulary || []);
      break;
    }
    case 'reading_cards': {
      const r = await reading();
      const scale = a.level === 'beginner' ? 0.6 : a.level === 'proficient' ? 1.4 : 1;
      html = readingCardsHtml(r.chapterTitle, r.paragraphs, Math.max(6, Math.round(wordsPerPageForGrade(grade) * scale)));
      break;
    }
    case 'question_cards': {
      const r = await reading();
      html = questionCardsHtml(r.chapterTitle, (r.comprehensionQuiz || []).map((q) => ({ question: q.question, options: q.options })));
      break;
    }
    case 'worksheet':
    case 'worksheet_answers': {
      const { workbook } = await backendApi.readings.workbook(String(a.readingId));
      const r = await reading();
      html = workbookHtml(r.chapterTitle, workbook, { className: grade, withAnswers: a.kind === 'worksheet_answers' });
      break;
    }
    case 'number_cards':
      html = numberCardsHtml(Number(a.from) || 0, Math.min(100, Number(a.to) || 10));
      break;
    case 'hundred_chart':
      html = hundredChartHtml();
      break;
    case 'fact_cards':
      html = factCardsHtml(['+', '-', '×'].includes(a.op) ? a.op : '+', a.op === '×' ? 10 : mathsLimitForGrade(grade));
      break;
    case 'clock':
      html = clockFaceHtml();
      break;
    case 'alphabet':
      html = alphabetChartHtml((['English', 'Telugu', 'Hindi'].includes(a.language) ? a.language : 'English') as 'English' | 'Telugu' | 'Hindi');
      break;
    default:
      throw new Error('Unknown material.');
  }
  printHtml(html);
  return 'Printing.';
}
