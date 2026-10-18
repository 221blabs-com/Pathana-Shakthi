export type CurriculumSubject =
  | 'English'
  | 'Hindi'
  | 'Telugu'
  | 'Mathematics'
  | 'Social Studies';

export interface CurriculumLesson {
  id: string;
  grade: string;
  subject: CurriculumSubject;
  lessonNumber: number;
  title: string;
  description: string;
  type: 'Reading' | 'Phonics' | 'Vocabulary' | 'Practice' | 'Story';
}

const lessonSets: Record<CurriculumSubject, string[][]> = {
  English: [
    ['Alphabet & Letter Sounds', 'Recognise letters and practise their basic sounds.', 'Phonics'],
    ['Blending Sounds', 'Blend individual sounds to read simple words.', 'Phonics'],
    ['Reading Fluency', 'Build accuracy, pace and expression through guided reading.', 'Reading'],
    ['Story Time', 'Read a child-friendly story and answer comprehension questions.', 'Story'],
  ],
  Hindi: [
    ['स्वर और व्यंजन', 'Learn and recognise common Hindi vowels and consonants.', 'Phonics'],
    ['मात्राओं का अभ्यास', 'Practise reading words with common Hindi matras.', 'Phonics'],
    ['वाक्य पठन', 'Read short Hindi sentences with growing fluency.', 'Reading'],
    ['कहानी समय', 'Read a child-friendly Hindi story and discuss its meaning.', 'Story'],
  ],
  Telugu: [
    ['అచ్చులు మరియు హల్లులు', 'Learn and recognise common Telugu vowels and consonants.', 'Phonics'],
    ['గుణింతాల సాధన', 'Practise reading Telugu words with common vowel signs.', 'Phonics'],
    ['వాక్య పఠనం', 'Read short Telugu sentences with growing fluency.', 'Reading'],
    ['కథా సమయం', 'Read a child-friendly Telugu story and discuss its meaning.', 'Story'],
  ],
  Mathematics: [
    ['Numbers & Counting', 'Recognise, compare and work with numbers for the class level.', 'Practice'],
    ['Addition & Subtraction', 'Practise age-appropriate addition and subtraction problems.', 'Practice'],
    ['Multiplication & Division', 'Build understanding of grouping, multiplication and division.', 'Practice'],
    ['Geometry & Measurement', 'Explore shapes, measurement and spatial reasoning.', 'Practice'],
  ],
  'Social Studies': [
    ['My Family & Community', 'Explore family, school and the people around us.', 'Reading'],
    ['Our Neighbourhood', 'Understand important places and community services.', 'Reading'],
    ['Maps & Our Environment', 'Read simple maps and learn about the local environment.', 'Practice'],
    ['People, Places & History', 'Build age-appropriate understanding of society and the past.', 'Reading'],
  ],
};

const classSpecificTitles: Record<string, Partial<Record<CurriculumSubject, string[]>>> = {
  'Class 1': {
    English: ['Alphabet & Letter Sounds', 'Short Vowel Sounds', 'My First Words', 'At My School'],
    Hindi: ['स्वर परिचय', 'व्यंजन परिचय', 'सरल शब्द', 'मेरा विद्यालय'],
    Telugu: ['అచ్చులు', 'హల్లులు', 'సులభ పదాలు', 'నా పాఠశాల'],
    Mathematics: ['Numbers 1–20', 'Addition Basics', 'Shapes Around Us', 'Patterns'],
    'Social Studies': ['My Family', 'My School', 'My Neighbourhood', 'People Who Help Us'],
  },
  'Class 2': {
    English: ['Blending Sounds', 'Word Families', 'Everyday Vocabulary', 'The Little Seed'],
    Hindi: ['मात्राओं का परिचय', 'मात्रा वाले शब्द', 'घर और परिवार', 'छोटी चिड़िया'],
    Telugu: ['గుణింతాలు', 'పద నిర్మాణం', 'ఇల్లు మరియు కుటుంబం', 'చిన్న పక్షి'],
    Mathematics: ['Numbers up to 100', 'Addition & Subtraction', 'Multiplication Introduction', 'Money & Time'],
    'Social Studies': ['My Community', 'Our Neighbourhood', 'Plants Around Us', 'Keeping Our Surroundings Clean'],
  },
  'Class 3': {
    English: ['Consonant Blends', 'Digraphs', 'Context Vocabulary', 'The Clever Rabbit'],
    Hindi: ['संयुक्त शब्द', 'शब्द भंडार', 'वाक्य पठन', 'ईमानदार लकड़हारा'],
    Telugu: ['సంయుక్తాక్షరాల పరిచయం', 'పదజాలం', 'వాక్య పఠనం', 'తెలివైన కుందేలు'],
    Mathematics: ['Multiplication Tables', 'Division Basics', 'Fractions', 'Measurement'],
    'Social Studies': ['Our State', 'Maps & Directions', 'Our Environment', 'Community Services'],
  },
  'Class 4': {
    English: ['Advanced Phonics Patterns', 'Reading Fluency', 'Meaning From Context', 'A Journey Through the Forest'],
    Hindi: ['संयुक्त व्यंजन', 'प्रवाहपूर्ण पठन', 'नए शब्दों का अर्थ', 'जंगल की यात्रा'],
    Telugu: ['సంయుక్తాక్షరాల సాధన', 'సరళ పఠనం', 'సందర్భం ద్వారా అర్థం', 'అడవిలో ప్రయాణం'],
    Mathematics: ['Large Numbers', 'Multiplication & Division', 'Fractions & Decimals', 'Geometry'],
    'Social Studies': ['India: States & Regions', 'History Around Us', 'Resources & Occupations', 'Caring for the Environment'],
  },
  'Class 5': {
    English: ['Complex Word Patterns', 'Paragraph Fluency', 'Advanced Vocabulary', 'The Young Explorer'],
    Hindi: ['कठिन शब्द पठन', 'अनुच्छेद पठन', 'उन्नत शब्दावली', 'नन्हा खोजी'],
    Telugu: ['క్లిష్ట పదాల పఠనం', 'పేరాగ్రాఫ్ పఠనం', 'ఉన్నత పదజాలం', 'చిన్న అన్వేషకుడు'],
    Mathematics: ['Operations with Whole Numbers', 'Fractions & Decimals', 'Geometry & Area', 'Data & Graphs'],
    'Social Studies': ['India: Geography', 'Civics & Our Government', 'India Through History', 'People & Natural Resources'],
  },
};

export const CURRICULUM_LESSONS: CurriculumLesson[] = Object.entries(classSpecificTitles).flatMap(
  ([grade, subjects]) =>
    (Object.keys(lessonSets) as CurriculumSubject[]).flatMap((subject) =>
      (subjects[subject] || lessonSets[subject].map((x) => x[0])).map((title, index) => {
        const base = lessonSets[subject][index];
        return {
          id: `${grade.toLowerCase().replace(/ /g, '_')}_${subject.toLowerCase().replace(/ /g, '_')}_${index + 1}`,
          grade,
          subject,
          lessonNumber: index + 1,
          title,
          description: base[1],
          type: base[2] as CurriculumLesson['type'],
        };
      }),
    ),
);
