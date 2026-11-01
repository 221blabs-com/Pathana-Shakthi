// The Teacher Handbook inside the dashboard: what the government curriculum
// asks for (FLN goals and ORF norms, the SCERT period steps, the assessment
// year) and how each part of Pathana Shakthi carries it out, with a button to
// open that part and questions to ask Shakthi Mitra. Built from summaries of
// public sources (curriculum-research/, SOURCES.md) and the app's own rules —
// not the text of an SCERT handbook, which could not be opened. Shared by the
// browser (HandbookPanel) and the teacher's agent (read tool `handbook`).
import { orfNorm } from './flnCheck';
import { COMPETENCIES, CLASSROOM_IDEAS } from './competencies';
import { LEVEL_INFO } from './readingLevels';
import { WRITING_RUBRIC } from './flnCheck';

export type HandbookBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; text: string };

/** A teacher screen the section links to (TEACHER_OPEN_EVENT screens). */
export type HandbookScreen = 'today' | 'class_support' | 'class_fln' | 'class_levels' | 'class_report' | 'curriculum' | 'registers' | 'tlm' | 'books';

export interface HandbookSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  blocks: HandbookBlock[];
  open?: { label: string; screen: HandbookScreen }[];
  ask?: string[];
  source: string;
}

const orfRows = (): string[][] =>
  [1, 2, 3, 4, 5].map((n) => {
    const g = `Class ${n}`;
    const en = orfNorm(g, 'English');
    const te = orfNorm(g, 'Telugu');
    const fmt = (x: typeof en) => `${x.range ? `${x.range[0]}–${x.range[1]}` : x.target} wcpm${x.govt ? '' : ' (app goal)'}`;
    return [g, fmt(en), fmt(te), en.govt || te.govt ? [en.govt ? en.source : '', te.govt && te.source !== en.source ? te.source : ''].filter(Boolean).join('; ') : 'no government number'];
  });

export const HANDBOOK: HandbookSection[] = [
  {
    id: 'fln-goals',
    icon: '🎯',
    title: 'FLN goals and government norms',
    summary: 'What every child should reach: NIPUN Bharat and Tholimettu, with the reading-speed norms the app measures.',
    blocks: [
      {
        kind: 'p',
        text: 'NIPUN Bharat (Ministry of Education, July 2021) asks that every child reaches foundational literacy and numeracy by the end of Class 3, by 2026-27. Telangana runs it as Tholimettu (First Step) for Classes 1–5, with model year, unit and period plans from SCERT.',
      },
      { kind: 'table', head: ['Class', 'English / Hindi', 'Telugu', 'Source'], rows: orfRows() },
      {
        kind: 'list',
        items: [
          'ORF = words correct per minute on an unseen, age-appropriate passage, with understanding — the FLN check of every chapter measures exactly this.',
          'Writing (Tholimettu): Class 1 simple words; Class 2 words with vowel signs (gunintalu / vattulu); Classes 3–5 a paragraph of 4–5 sentences.',
          'Numeracy components: pre-number concepts, numbers and operations, shapes and space, measurement, data handling.',
        ],
      },
      { kind: 'note', text: "Tholimettu's Telugu numbers (20 and 25) are lower than NIPUN's Class 2 figure; the app uses Tholimettu for Telugu and NIPUN for English and Hindi." },
    ],
    open: [
      { label: 'FLN checks of my class', screen: 'class_fln' },
      { label: 'FLN assessment rounds', screen: 'registers' },
    ],
    ask: ['Which children in my class are below the ORF norm, and what should I do with them this week?'],
    source: 'NIPUN Bharat (PIB), Tholimettu summaries — curriculum-research/00 and 02',
  },
  {
    id: 'period',
    icon: '🗒️',
    title: 'How a period runs (SCERT steps)',
    summary: 'The steps of a period in English and in Telugu/Hindi, and how the app fills them with your chapter.',
    blocks: [
      { kind: 'p', text: 'English period steps:' },
      { kind: 'list', ordered: true, items: ['Face sheet / picture interaction', 'Listening text and activities', 'Reading — individual, collaborative and model reading', 'Post-reading activities', 'Editing'] },
      { kind: 'p', text: 'Telugu / Urdu (and the app uses them for Hindi):' },
      { kind: 'list', ordered: true, items: ['Oral language development', 'Introduction of key words', 'Reading — model, shared, individual', 'Comprehension activities', 'Practice / writing', 'Story time'] },
      { kind: 'list', items: ['A unit takes about 10–15 periods; a bridge activity about 5.', 'Registers → Period plan lays these steps out with your chapter\'s own words, sentences and questions — print it as your lesson plan.', 'Picture talk first, then listening, then reading, then writing: one lesson builds all four skills.'] },
    ],
    open: [{ label: 'Period plan for a chapter', screen: 'registers' }],
    ask: ['Make me a period plan for the next chapter my class has not read.'],
    source: 'Tholimettu period steps (Intensive Implementation Fortnight orders, via teacher sites) — curriculum-research/02',
  },
  {
    id: 'fln-check',
    icon: '🧪',
    title: 'The chapter FLN check',
    summary: 'Reading sentences, oral reading fluency, comprehension and writing — what each part measures and how to mark it.',
    blocks: [
      {
        kind: 'list',
        items: [
          '📖 Reading sentences: three sentences from the chapter, read aloud; the app marks every word and keeps the words missed and the tries.',
          '⏱️ Oral reading fluency: a passage read aloud (up to 29 seconds), scaled to words correct per minute and compared with the norm above.',
          '❓ Reading comprehension on the same passage, three kinds of question — direct (the answer is written in the passage: "Where did the crow see the pot?"), indirect (the child works it out: "Why did the water come up?") and open (the child\'s own answer: "When have you solved a problem like the crow?"). Open answers get an AI mark with a reason; you can change any mark.',
          '✍️ Writing: the chapter\'s picture and prompts ("Describe the picture in 4–5 sentences"); children write in their notebooks and you mark it.',
        ],
      },
      { kind: 'table', head: ['Writing rubric', 'Marks'], rows: WRITING_RUBRIC.map((r) => [r.label, String(r.max)]) },
      { kind: 'note', text: 'Your mark always wins over the app\'s or the AI\'s. The FLN assessment round in Registers is pre-filled from each child\'s latest check.' },
    ],
    open: [{ label: 'FLN checks', screen: 'class_fln' }],
    ask: ['Which open answers in my class still need my marks?'],
    source: 'Teacher dashboard requirements (Pathana Shakthi), NIPUN Bharat ORF',
  },
  {
    id: 'multilevel',
    icon: '🧭',
    title: 'Teaching a multi-level class',
    summary: 'Beginner, developing and proficient readers in one room: what each group needs.',
    blocks: [
      { kind: 'list', items: (['beginner', 'developing', 'proficient'] as const).map((l) => `${LEVEL_INFO[l].icon} ${LEVEL_INFO[l].name}: ${LEVEL_INFO[l].forTeacher}`) },
      {
        kind: 'list',
        items: [
          'The app sets each child\'s level after two readings; you can change it in Class dashboard → Levels.',
          'Beginners hear each page first ("Listen first") and get shorter pages; proficient readers get longer ones.',
          'Plan one task with three versions — every TLM in the library has a line for each level.',
        ],
      },
    ],
    open: [{ label: 'Reading-level groups', screen: 'class_levels' }],
    ask: ['Give each reading-level group in my class one activity for tomorrow.'],
    source: 'Pathana Shakthi reading levels (src/data/readingLevels.ts)',
  },
  {
    id: 'assessment',
    icon: '📊',
    title: 'Assessment through the year',
    summary: 'Baseline, midline and endline FLN rounds, formative tools and summatives.',
    blocks: [
      {
        kind: 'table',
        head: ['When (2025-26)', 'What'],
        rows: [
          ['25–30 June', 'FLN baseline; results to the Telangana School Education App by 15 July'],
          ['through the year', 'Formative assessments FA1–FA4'],
          ['25–30 November', 'FLN midline; results by 15 December'],
          ['December / year end', 'Summative SA1, SA2'],
          ['early March', 'Endline (reported for LIP; FLN dates to confirm)'],
        ],
      },
      { kind: 'p', text: 'Formative tools: observation / participation, written work, project work and slip test. Primary mark splits differ between sources (10/10/10/20 or 10/10/20) — follow your school\'s circular.' },
      { kind: 'note', text: 'The app pre-fills each round from what children did and you confirm it child by child; the export may need to be copied into the government app or sheet.' },
    ],
    open: [{ label: 'FLN assessment rounds', screen: 'registers' }],
    ask: ['How did my class move between baseline and midline?'],
    source: 'SCERT circulars and CCE register, via search summaries — curriculum-research/03 and 05',
  },
  {
    id: 'support',
    icon: '🙋',
    title: 'Need Help · Go Ahead · Very Good',
    summary: 'Every day: who needs you, who can go on, who can help others.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Need Help: a child asked for help in a workbook, read under half the words right twice, or rated most "I can…" statements "not yet".',
          'Very Good: a proficient reader whose "I can…" ratings are high — let them lead a group.',
          'Answer a child\'s question with a message and a piece of work; it appears on their home screen with sound.',
        ],
      },
    ],
    open: [{ label: 'Support today', screen: 'class_support' }],
    ask: ['Who needs help today and why?'],
    source: 'Pathana Shakthi support loop (server/classSupport.ts)',
  },
  {
    id: 'tlm',
    icon: '🧰',
    title: 'Using Teaching-Learning Materials',
    summary: 'Concrete first, then pictures, then symbols — and low-cost materials every school has.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Concrete → picture → symbol: bundles and sticks before writing 23; a picture talk before the text.',
          'Make TLMs with children from what is around: sticks, seeds, bottle caps, old calendars.',
          'Every material in the TLM library says what children learn, how to make and use it, how to adapt it for each level and what to look for.',
        ],
      },
    ],
    open: [{ label: 'TLM library', screen: 'tlm' }],
    ask: ['Which TLM should I make for the chapter my class is reading now?'],
    source: 'Common FLN classroom practice (src/data/tlmLibrary.ts)',
  },
  {
    id: 'remediation',
    icon: '🛠️',
    title: 'Remedial ideas by competency',
    summary: 'One classroom idea for each FLN and subject competency the app tracks.',
    blocks: [{ kind: 'table', head: ['Competency', 'Try this'], rows: COMPETENCIES.filter((c) => CLASSROOM_IDEAS[c.id]).map((c) => [c.short, CLASSROOM_IDEAS[c.id]]) }],
    open: [{ label: 'Levels & competencies', screen: 'class_levels' }],
    ask: ['What is my class weakest at, and what should I practise?'],
    source: 'Pathana Shakthi competencies (src/data/competencies.ts)',
  },
  {
    id: 'day',
    icon: '📅',
    title: 'Your day with Pathana Shakthi',
    summary: 'A simple routine that keeps records without extra paperwork.',
    blocks: [
      {
        kind: 'list',
        ordered: true,
        items: [
          'Today: see each child\'s goals, questions waiting and the next chapter.',
          'Registers: mark attendance (everyone starts present; tap who is away).',
          'Teach the period with the period plan and a TLM.',
          'Children read, practise and do the FLN check of the chapter; you mark writing and any open answers.',
          'Support: answer "I need help" and give work to a group.',
          'Curriculum: tick the chapter as taught; the headmaster\'s report adds it up.',
        ],
      },
    ],
    open: [
      { label: 'Today', screen: 'today' },
      { label: 'Curriculum map', screen: 'curriculum' },
    ],
    ask: ['Plan my day for my class.'],
    source: 'Pathana Shakthi',
  },
  {
    id: 'curriculum',
    icon: '🏛️',
    title: 'What the curriculum asks for',
    summary: 'Mother tongue first, learning by doing, and listening–speaking–reading–writing together.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Telangana SCF 2011: teach "as far as practicable, in the child\'s mother tongue"; learning through "explorations, experiments, discovery, activities, tasks, project work".',
          'English is taught as integrated skills: listening, speaking, reading, writing and thinking together; academic standards are listening and speaking, reading comprehension, conventions of writing, vocabulary and grammar, creative expression.',
          'NCF for the Foundational Stage (2022): play at the centre for ages 3–8.',
        ],
      },
      { kind: 'note', text: 'These are summaries of public documents; the full SCF and handbook texts could not be read when this was written.' },
    ],
    source: 'SCF 2011, SCERT English module, NCF-FS summaries — curriculum-research/00',
  },
];

/** A section as plain text (for the agent and for printing). */
export function handbookText(s: HandbookSection): string {
  const lines = [`${s.icon} ${s.title} — ${s.summary}`];
  for (const b of s.blocks) {
    if (b.kind === 'p' || b.kind === 'note') lines.push(b.text);
    else if (b.kind === 'list') lines.push(...b.items.map((t, i) => `${b.ordered ? `${i + 1}.` : '-'} ${t}`));
    else lines.push(b.head.join(' | '), ...b.rows.map((r) => r.join(' | ')));
  }
  lines.push(`Source: ${s.source}`);
  return lines.join('\n');
}

/** The sections that match a topic word (title, summary or text); all when no topic. */
export function handbookFind(topic?: string): HandbookSection[] {
  const words = String(topic || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  if (!words.length) return HANDBOOK;
  const scored = HANDBOOK.map((s) => ({ s, n: words.filter((w) => handbookText(s).toLowerCase().includes(w)).length })).filter((x) => x.n > 0);
  return scored.sort((a, b) => b.n - a.n).map((x) => x.s);
}
