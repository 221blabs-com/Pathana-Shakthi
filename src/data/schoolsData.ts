import { SchoolInfo } from '../types';

// The school the seeded faculty/admin accounts belong to. Counts start at 0
// and grow from real enrolments.
export const REAL_SCHOOLS: SchoolInfo[] = [
  {
    id: 'school_telangana_ktr',
    name: 'Zilla Parishad Primary School, Kothur',
    code: 'ZPPS-TG-RR-104',
    district: 'Ranga Reddy',
    state: 'Telangana',
    board: 'State Primary School Board',
    type: 'Government Primary',
    totalStudents: 0,
    totalTeachers: 0,
    activeLanguageWings: ['Telugu (మాతృభాష)', 'English Medium', 'Hindi (భాష)'],
    headmasterName: 'K. Venkateshwarlu, M.A., B.Ed.',
    contactEmail: 'zpps.kothur.rr@tg.gov.in',
    establishedYear: 1984,
  },
];
