// Government benchmarks Pathana Shakthi is built to, and the ways to partner —
// the same content as the pitch deck and brochure (Details page). Prices stay in the
// downloadable deck and brochure, never on the site.

export interface Benchmark {
  name: string;
  asks: string;
  meets: string;
}

export const BENCHMARKS: Benchmark[] = [
  { name: 'NIPUN Bharat', asks: 'Every child reads with understanding and does basic maths by the end of Class 3 (2026-27)', meets: 'Literacy and numeracy competencies tracked for every child from real work' },
  { name: 'NIPUN Bharat reading speed', asks: 'Class 2: 45–60 words correct per minute · Class 3: 60', meets: 'Timed oral reading in every chapter’s reading check, scored against the norm' },
  { name: 'Tholimettu (Telangana)', asks: 'Telugu reading speed: Class 1: 20 · Class 2: 25 words per minute', meets: 'Telugu norms used for Telugu chapters' },
  { name: 'NEP 2020', asks: 'Foundational learning in the mother tongue', meets: 'Telugu, Hindi and English — read, heard and checked' },
  { name: 'SCERT Telangana', asks: 'State textbooks and the end-of-lesson exercise pattern', meets: 'Real textbooks uploaded; the workbook follows the SCERT sections' },
  { name: 'FLN assessment rounds', asks: 'Baseline, midline and endline levels for every child', meets: 'Registers pre-filled from the app; the teacher confirms' },
];

export interface PartnerRoute {
  tag: string;
  icon: string;
  title: string;
  description: string;
}

export const PARTNER_ROUTES: PartnerRoute[] = [
  { tag: 'Primary', icon: '🏛️', title: 'State governments', description: 'FLN programmes under Samagra Shiksha, district by district.' },
  { tag: 'Bridge', icon: '🤝', title: 'CSR and foundations', description: 'Adopt-a-school and district programmes with measured reading gains.' },
  { tag: 'Expansion', icon: '🏫', title: 'Low-fee private schools', description: 'The same state textbooks and the same need, paid directly.' },
];
