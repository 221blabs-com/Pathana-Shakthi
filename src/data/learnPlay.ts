// Built-in "Learn & Play" chapters: every subject tile gets ready-made,
// interactive chapters (animated lesson cards -> a game -> read aloud with
// the microphone -> quiz), independent of what teachers publish. Content is
// written for Classes 1-5; the maths games scale their numbers by class.
// Classes 6-10 get simulation labs (src/data/learnPlayHigh.ts) for the
// Telangana syllabus chapters that name them.
import { ComprehensionQuestion, Language } from '../types';
import { HIGH_SCHOOL_CHAPTERS } from './learnPlayHigh';
import { syllabusLabIds } from './telanganaSyllabus';

export type LabSubject = 'English' | 'Maths' | 'Science' | 'Social' | 'Hindi' | 'Telugu';

// Interactive simulations for Classes 6-10 (src/components/learnplay/sims).
export type SimKind =
  | 'integers'
  | 'fractions'
  | 'balance'
  | 'triangles'
  | 'graphs'
  | 'trig'
  | 'probability'
  | 'sets'
  | 'circuit'
  | 'magnet'
  | 'motion'
  | 'refraction'
  | 'lens'
  | 'acids'
  | 'atom'
  | 'photosynthesis'
  | 'heart'
  | 'solar'
  | 'globe'
  | 'seasons'
  | 'timeline';

export interface LabSim {
  kind: SimKind;
  /** e.g. graphs: 'line' | 'pair' | 'quadratic'; timeline: 'freedom' | 'telangana'; atom: 'rutherford'. */
  variant?: string;
}

// A counting animation for a maths card (src/components/learnplay/CountingScene.tsx):
// things appear one at a time with the count flashing, groups join and are
// counted again. `stage` picks which part of the chapter's example a card shows.
export type CountSpec =
  | { op: 'add'; a: number; b: number; emoji: string; stage?: 'groups' | 'join' | 'equation'; labels?: [string, string] }
  | { op: 'sub'; a: number; b: number; emoji: string; stage?: 'start' | 'remove' | 'equation' }
  | { op: 'count'; n: number; emoji: string }
  | { op: 'groups'; groups: number; each: number; emoji: string; stage?: 'groups' | 'add' | 'equation' }
  | { op: 'hop'; from: number; by: number };

export interface LabCard {
  emoji: string;
  title: string;
  text: string;
  // Optional animated scene drawn by the Learn step instead of the emoji.
  scene?: 'add' | 'subtract' | 'numberline' | 'shapes' | 'plant' | 'watercycle' | 'homes' | 'helpers' | 'compass' | 'letters' | 'rhyme';
  // Optional counting animation (maths), used instead of `scene`.
  count?: CountSpec;
  // Optional interactive simulation (Classes 6-10), shown in a taller area.
  sim?: LabSim;
  // Only for these classes (default: every class the chapter is for).
  grades?: [number, number];
}

export type LabGame =
  | { kind: 'addition' }
  | { kind: 'subtraction' }
  | { kind: 'numberline' }
  | { kind: 'shapes3d' }
  | { kind: 'plantparts' }
  | { kind: 'sequence'; steps: { emoji: string; label: string }[] }
  | { kind: 'match'; prompt: string; pairs: { left: string; right: string; leftLabel: string; rightLabel: string }[] }
  | { kind: 'gridwalk' }
  | { kind: 'wordbuild'; words: { word: string; tiles: string[]; emoji: string; meaning: string }[] }
  | { kind: 'sim'; sim: LabSim };

export interface LabChapter {
  id: string;
  subject: LabSubject;
  // Classes this chapter is written for, e.g. [1, 3] = Class 1 to Class 3.
  grades: [number, number];
  title: string;
  subtitle: string;
  emoji: string;
  // Tailwind gradient classes for the chapter card.
  gradient: string;
  language: Language;
  learn: LabCard[];
  gameTitle: string;
  game: LabGame;
  readAloud: string[];
  quiz: ComprehensionQuestion[];
}

const q = (question: string, options: string[], correctOptionIndex: number, explanation: string): ComprehensionQuestion => ({
  question,
  options,
  correctOptionIndex,
  explanation,
});

const BASE_CHAPTERS: LabChapter[] = [
  /* ---------------------------- MATHS ---------------------------- */
  {
    id: 'maths-adding',
    grades: [1, 5],
    subject: 'Maths',
    title: 'Adding Together',
    subtitle: 'Put groups together and count them all',
    emoji: '🥭',
    gradient: 'from-amber-300 via-orange-300 to-rose-300',
    language: 'English',
    learn: [
      { emoji: '🥭', title: 'Two baskets', text: 'Ravi has 3 mangoes. Sita has 2 mangoes.', scene: 'add', count: { op: 'add', a: 3, b: 2, emoji: '🥭', stage: 'groups', labels: ['Ravi', 'Sita'] } },
      { emoji: '➕', title: 'Put them together', text: 'When we put the mangoes in one basket, we add them.', scene: 'add', count: { op: 'add', a: 3, b: 2, emoji: '🥭', stage: 'join', labels: ['Ravi', 'Sita'] } },
      { emoji: '🔢', title: 'Count them all', text: '3 and 2 more makes 5. We write it as 3 + 2 = 5.', scene: 'add', count: { op: 'add', a: 3, b: 2, emoji: '🥭', stage: 'equation', labels: ['Ravi', 'Sita'] } },
    ],
    gameTitle: 'Mango Basket',
    game: { kind: 'addition' },
    readAloud: [
      'Ravi has three mangoes. Sita has two mangoes.',
      'They put all the mangoes in one big basket.',
      'Now there are five mangoes. Three plus two makes five.',
    ],
    quiz: [
      q('Ravi has 3 mangoes and Sita has 2. How many in all?', ['4', '5', '6', '1'], 1, '3 + 2 = 5.'),
      q('What does "add" mean?', ['Take away', 'Put together', 'Hide', 'Break'], 1, 'Adding means putting groups together.'),
      q('Which sign do we use to add?', ['−', '+', '=', '×'], 1, 'The plus sign (+) means add.'),
    ],
  },
  {
    id: 'maths-takeaway',
    grades: [1, 3],
    subject: 'Maths',
    title: 'Taking Away',
    subtitle: 'Balloons fly away — how many are left?',
    emoji: '🎈',
    gradient: 'from-sky-300 via-indigo-300 to-fuchsia-300',
    language: 'English',
    learn: [
      { emoji: '🎈', title: 'Five balloons', text: 'Meena holds 5 balloons at the fair.', scene: 'subtract', count: { op: 'sub', a: 5, b: 2, emoji: '🎈', stage: 'start' } },
      { emoji: '💨', title: 'Whoosh!', text: 'The wind blows and 2 balloons fly away.', scene: 'subtract', count: { op: 'sub', a: 5, b: 2, emoji: '🎈', stage: 'remove' } },
      { emoji: '➖', title: 'What is left?', text: '5 take away 2 leaves 3. We write it as 5 − 2 = 3.', scene: 'subtract', count: { op: 'sub', a: 5, b: 2, emoji: '🎈', stage: 'equation' } },
    ],
    gameTitle: 'Balloon Fair',
    game: { kind: 'subtraction' },
    readAloud: [
      'Meena has five balloons at the fair.',
      'The wind blows and two balloons fly away.',
      'Now Meena has three balloons. Five minus two is three.',
    ],
    quiz: [
      q('Meena had 5 balloons. 2 flew away. How many are left?', ['2', '3', '7', '5'], 1, '5 − 2 = 3.'),
      q('When things go away, we…', ['Add', 'Take away', 'Multiply', 'Count backwards to 100'], 1, 'Subtraction means taking away.'),
      q('Which sign means take away?', ['+', '−', '=', '÷'], 1, 'The minus sign (−) means take away.'),
    ],
  },
  {
    id: 'maths-numberline',
    grades: [1, 4],
    subject: 'Maths',
    title: 'Frog on the Number Line',
    subtitle: 'Jump forward to add, jump back to take away',
    emoji: '🐸',
    gradient: 'from-lime-300 via-emerald-300 to-teal-300',
    language: 'English',
    learn: [
      { emoji: '📏', title: 'The number line', text: 'Numbers sit in a line, getting bigger as we go right.', scene: 'numberline' },
      { emoji: '🐸', title: 'Jump forward', text: 'The frog is on 4. It jumps 3 forward and lands on 7. 4 + 3 = 7.', scene: 'numberline', count: { op: 'hop', from: 4, by: 3 } },
      { emoji: '⬅️', title: 'Jump back', text: 'From 7 it jumps 2 back and lands on 5. 7 − 2 = 5.', scene: 'numberline', count: { op: 'hop', from: 7, by: -2 } },
    ],
    gameTitle: 'Frog Jumps',
    game: { kind: 'numberline' },
    readAloud: [
      'The little frog sits on the number line.',
      'It jumps forward to add and jumps back to take away.',
      'Where will the frog land next?',
    ],
    quiz: [
      q('The frog is on 4 and jumps 3 forward. Where does it land?', ['1', '6', '7', '8'], 2, '4 + 3 = 7.'),
      q('Jumping back on the number line means we…', ['Add', 'Take away', 'Stop', 'Double'], 1, 'Going back makes the number smaller: taking away.'),
      q('Which number comes right after 9?', ['8', '10', '11', '19'], 1, 'After 9 comes 10.'),
    ],
  },
  {
    id: 'maths-shapes',
    grades: [1, 5],
    subject: 'Maths',
    title: 'Shapes Around Us',
    subtitle: 'Spin 3D shapes and name them',
    emoji: '🧊',
    gradient: 'from-violet-300 via-purple-300 to-pink-300',
    language: 'English',
    learn: [
      { emoji: '🧊', title: 'Cube', text: 'A cube has 6 flat square faces, like a dice.', scene: 'shapes' },
      { emoji: '⚽', title: 'Sphere', text: 'A sphere is round everywhere, like a ball.', scene: 'shapes' },
      { emoji: '🥫', title: 'Cylinder & Cone', text: 'A tin is a cylinder. An ice-cream cone is a cone.', scene: 'shapes' },
    ],
    gameTitle: 'Shape Spinner',
    game: { kind: 'shapes3d' },
    readAloud: [
      'A ball is a sphere. It is round everywhere.',
      'A dice is a cube. It has six square faces.',
      'A tin is a cylinder and an ice cream cone is a cone.',
    ],
    quiz: [
      q('A football is shaped like a…', ['Cube', 'Sphere', 'Cone', 'Cylinder'], 1, 'A ball is round everywhere: a sphere.'),
      q('How many faces does a cube have?', ['4', '5', '6', '8'], 2, 'A cube has 6 square faces.'),
      q('Which is shaped like a cylinder?', ['A tin', 'A dice', 'A ball', 'A book'], 0, 'A tin has two round ends and a curved side.'),
    ],
  },

  /* --------------------------- SCIENCE --------------------------- */
  {
    id: 'science-plant',
    grades: [2, 5],
    subject: 'Science',
    title: 'Parts of a Plant',
    subtitle: 'Roots, stem, leaves, flower and fruit',
    emoji: '🌱',
    gradient: 'from-green-300 via-emerald-300 to-lime-300',
    language: 'English',
    learn: [
      { emoji: '🌱', title: 'Roots', text: 'Roots hold the plant in the soil and drink water.', scene: 'plant' },
      { emoji: '🌿', title: 'Stem & leaves', text: 'The stem carries water up. Leaves make food using sunlight.', scene: 'plant' },
      { emoji: '🌼', title: 'Flower & fruit', text: 'Flowers become fruits, and fruits carry the seeds.', scene: 'plant' },
    ],
    gameTitle: 'Plant Explorer',
    game: { kind: 'plantparts' },
    readAloud: [
      'A plant has roots, a stem, leaves, flowers and fruits.',
      'The roots drink water from the soil.',
      'The green leaves make food with the help of sunlight.',
    ],
    quiz: [
      q('Which part of the plant drinks water from the soil?', ['Leaf', 'Root', 'Flower', 'Fruit'], 1, 'Roots take in water from the soil.'),
      q('Which part makes food for the plant?', ['Leaves', 'Roots', 'Stem', 'Seeds'], 0, 'Leaves make food using sunlight.'),
      q('Seeds are found inside the…', ['Stem', 'Root', 'Fruit', 'Leaf'], 2, 'Fruits carry the seeds.'),
    ],
  },
  {
    id: 'science-watercycle',
    grades: [3, 5],
    subject: 'Science',
    title: 'The Water Cycle',
    subtitle: 'Where does rain come from?',
    emoji: '🌧️',
    gradient: 'from-cyan-300 via-sky-300 to-blue-300',
    language: 'English',
    learn: [
      { emoji: '☀️', title: 'The sun heats water', text: 'The sun warms rivers and seas. Water turns into vapour and rises.', scene: 'watercycle' },
      { emoji: '☁️', title: 'Clouds form', text: 'High in the sky, the vapour cools and makes clouds.', scene: 'watercycle' },
      { emoji: '🌧️', title: 'Rain falls', text: 'Heavy clouds give rain. The rain flows back to rivers. The cycle goes on!', scene: 'watercycle' },
    ],
    gameTitle: 'Cycle Order',
    game: {
      kind: 'sequence',
      steps: [
        { emoji: '☀️', label: 'Sun heats the water' },
        { emoji: '💨', label: 'Water vapour rises' },
        { emoji: '☁️', label: 'Clouds form' },
        { emoji: '🌧️', label: 'Rain falls' },
      ],
    },
    readAloud: [
      'The sun heats the water in rivers and seas.',
      'The water rises up as vapour and makes clouds.',
      'The clouds give us rain, and the rain flows back to the rivers.',
    ],
    quiz: [
      q('What heats the water in rivers and seas?', ['The moon', 'The sun', 'The wind', 'Trees'], 1, 'The sun’s heat turns water into vapour.'),
      q('What do we call water rising up as a gas?', ['Ice', 'Vapour', 'Sand', 'Smoke'], 1, 'Water vapour rises into the sky.'),
      q('What comes after clouds form?', ['Rain', 'Sunrise', 'Snowman', 'Rainbow only'], 0, 'Heavy clouds give rain.'),
    ],
  },
  {
    id: 'science-homes',
    grades: [1, 3],
    subject: 'Science',
    title: 'Animals and Their Homes',
    subtitle: 'Who lives where?',
    emoji: '🐦',
    gradient: 'from-yellow-300 via-amber-300 to-orange-300',
    language: 'English',
    learn: [
      { emoji: '🐦', title: 'Nest', text: 'A bird builds a nest with twigs and grass.', scene: 'homes' },
      { emoji: '🐝', title: 'Hive', text: 'Bees live together in a hive and make honey.', scene: 'homes' },
      { emoji: '🦁', title: 'Den', text: 'A lion rests in a den. A fish lives in water.', scene: 'homes' },
    ],
    gameTitle: 'Home Match',
    game: {
      kind: 'match',
      prompt: 'Match each animal to its home',
      pairs: [
        { left: '🐦', leftLabel: 'Bird', right: '🪺', rightLabel: 'Nest' },
        { left: '🐝', leftLabel: 'Bee', right: '🍯', rightLabel: 'Hive' },
        { left: '🦁', leftLabel: 'Lion', right: '🪨', rightLabel: 'Den' },
        { left: '🐟', leftLabel: 'Fish', right: '🌊', rightLabel: 'Water' },
        { left: '🐄', leftLabel: 'Cow', right: '🛖', rightLabel: 'Shed' },
      ],
    },
    readAloud: [
      'A bird lives in a nest. Bees live in a hive.',
      'A lion lives in a den and a fish lives in water.',
      'Every animal needs a safe home.',
    ],
    quiz: [
      q('Where do bees live?', ['Nest', 'Hive', 'Den', 'Kennel'], 1, 'Bees live in a hive.'),
      q('A bird builds a…', ['Nest', 'Burrow', 'Stable', 'Shell'], 0, 'Birds build nests.'),
      q('Where does a fish live?', ['In a tree', 'In water', 'In a den', 'In a hive'], 1, 'Fish live in water.'),
    ],
  },

  /* ---------------------------- SOCIAL ---------------------------- */
  {
    id: 'social-helpers',
    grades: [1, 3],
    subject: 'Social',
    title: 'People Who Help Us',
    subtitle: 'Our community helpers',
    emoji: '👩‍⚕️',
    gradient: 'from-orange-300 via-amber-300 to-yellow-300',
    language: 'English',
    learn: [
      { emoji: '👩‍⚕️', title: 'Doctor', text: 'A doctor helps us when we are sick.', scene: 'helpers' },
      { emoji: '👨‍🌾', title: 'Farmer', text: 'A farmer grows rice, vegetables and fruits for us.', scene: 'helpers' },
      { emoji: '👮', title: 'Police', text: 'The police keep us safe. A postman brings our letters.', scene: 'helpers' },
    ],
    gameTitle: 'Helper Match',
    game: {
      kind: 'match',
      prompt: 'Match each helper to what they use',
      pairs: [
        { left: '👩‍⚕️', leftLabel: 'Doctor', right: '🩺', rightLabel: 'Stethoscope' },
        { left: '👨‍🌾', leftLabel: 'Farmer', right: '🌾', rightLabel: 'Crops' },
        { left: '👨‍🍳', leftLabel: 'Cook', right: '🍳', rightLabel: 'Pan' },
        { left: '👩‍🏫', leftLabel: 'Teacher', right: '📚', rightLabel: 'Books' },
        { left: '👨‍🚒', leftLabel: 'Firefighter', right: '🧯', rightLabel: 'Extinguisher' },
      ],
    },
    readAloud: [
      'Many people help us every day.',
      'The farmer grows our food and the doctor keeps us healthy.',
      'We should say thank you to all our helpers.',
    ],
    quiz: [
      q('Who helps us when we are sick?', ['Farmer', 'Doctor', 'Postman', 'Driver'], 1, 'A doctor treats sick people.'),
      q('Who grows rice and vegetables?', ['Farmer', 'Tailor', 'Pilot', 'Police'], 0, 'Farmers grow our food.'),
      q('What does a firefighter use?', ['Books', 'Extinguisher', 'Pan', 'Stethoscope'], 1, 'An extinguisher puts out fires.'),
    ],
  },
  {
    id: 'social-directions',
    grades: [3, 5],
    subject: 'Social',
    title: 'Finding the Way',
    subtitle: 'North, South, East and West',
    emoji: '🧭',
    gradient: 'from-teal-300 via-cyan-300 to-sky-300',
    language: 'English',
    learn: [
      { emoji: '🧭', title: 'Four directions', text: 'The four directions are North, South, East and West.', scene: 'compass' },
      { emoji: '🌅', title: 'Sunrise', text: 'The sun rises in the East and sets in the West.', scene: 'compass' },
      { emoji: '🗺️', title: 'Maps', text: 'On a map, North is at the top and South is at the bottom.', scene: 'compass' },
    ],
    gameTitle: 'Walk to School',
    game: { kind: 'gridwalk' },
    readAloud: [
      'There are four directions: north, south, east and west.',
      'The sun rises in the east and sets in the west.',
      'A map helps us find our way to school.',
    ],
    quiz: [
      q('Where does the sun rise?', ['West', 'East', 'North', 'South'], 1, 'The sun rises in the East.'),
      q('On a map, what is at the top?', ['South', 'North', 'West', 'East'], 1, 'North is at the top of a map.'),
      q('How many main directions are there?', ['2', '3', '4', '5'], 2, 'North, South, East and West.'),
    ],
  },

  /* --------------------------- ENGLISH --------------------------- */
  {
    id: 'english-words',
    grades: [1, 3],
    subject: 'English',
    title: 'Build a Word',
    subtitle: 'Put the letters in the right order',
    emoji: '🔤',
    gradient: 'from-violet-300 via-indigo-300 to-sky-300',
    language: 'English',
    learn: [
      { emoji: '🔤', title: 'Letters make words', text: 'Letters join together to make words.', scene: 'letters' },
      { emoji: '🐱', title: 'C - A - T', text: 'C and A and T make CAT.', scene: 'letters' },
      { emoji: '☀️', title: 'S - U - N', text: 'S and U and N make SUN. Say each sound, then blend!', scene: 'letters' },
    ],
    gameTitle: 'Word Builder',
    game: {
      kind: 'wordbuild',
      words: [
        { word: 'CAT', tiles: ['C', 'A', 'T'], emoji: '🐱', meaning: 'cat' },
        { word: 'SUN', tiles: ['S', 'U', 'N'], emoji: '☀️', meaning: 'sun' },
        { word: 'BUS', tiles: ['B', 'U', 'S'], emoji: '🚌', meaning: 'bus' },
        { word: 'FISH', tiles: ['F', 'I', 'S', 'H'], emoji: '🐟', meaning: 'fish' },
        { word: 'TREE', tiles: ['T', 'R', 'E', 'E'], emoji: '🌳', meaning: 'tree' },
      ],
    },
    readAloud: [
      'The cat sits in the sun.',
      'The bus goes to the big tree.',
      'A fish can swim in the pond.',
    ],
    quiz: [
      q('Which letters make CAT?', ['C, A, T', 'K, A, T', 'C, U, T', 'T, A, C'], 0, 'C - A - T spells cat.'),
      q('What shines in the sky in the day?', ['Moon', 'Sun', 'Star', 'Cloud'], 1, 'The sun shines in the day.'),
      q('Which word names an animal?', ['Bus', 'Tree', 'Fish', 'Sun'], 2, 'A fish is an animal.'),
    ],
  },
  {
    id: 'english-rhymes',
    grades: [1, 4],
    subject: 'English',
    title: 'Rhyme Time',
    subtitle: 'Words that sound the same at the end',
    emoji: '🎵',
    gradient: 'from-pink-300 via-rose-300 to-orange-300',
    language: 'English',
    learn: [
      { emoji: '🎵', title: 'Rhyming words', text: 'Rhyming words end with the same sound.', scene: 'rhyme' },
      { emoji: '🐱', title: 'Cat and hat', text: 'Cat, hat, bat and mat all rhyme.', scene: 'rhyme' },
      { emoji: '⭐', title: 'Star and car', text: 'Star rhymes with car. Can you find more?', scene: 'rhyme' },
    ],
    gameTitle: 'Rhyme Match',
    game: {
      kind: 'match',
      prompt: 'Match the words that rhyme',
      pairs: [
        { left: '🐱', leftLabel: 'cat', right: '🎩', rightLabel: 'hat' },
        { left: '⭐', leftLabel: 'star', right: '🚗', rightLabel: 'car' },
        { left: '🐝', leftLabel: 'bee', right: '🌳', rightLabel: 'tree' },
        { left: '🐟', leftLabel: 'fish', right: '🍽️', rightLabel: 'dish' },
        { left: '🐸', leftLabel: 'frog', right: '🪵', rightLabel: 'log' },
      ],
    },
    readAloud: [
      'A cat in a hat sat on a mat.',
      'A bee in a tree sang happily.',
      'A frog on a log jumped into the pond.',
    ],
    quiz: [
      q('Which word rhymes with cat?', ['Dog', 'Hat', 'Sun', 'Bee'], 1, 'Cat and hat both end in -at.'),
      q('Which word rhymes with star?', ['Car', 'Tree', 'Fish', 'Log'], 0, 'Star and car both end in -ar.'),
      q('Rhyming words sound the same at the…', ['Start', 'End', 'Middle only', 'Nowhere'], 1, 'Rhymes share their ending sound.'),
    ],
  },

  /* ---------------------------- TELUGU ---------------------------- */
  {
    id: 'telugu-words',
    grades: [1, 5],
    subject: 'Telugu',
    title: 'పదాలు కూర్చుదాం',
    subtitle: 'Build Telugu words from letters',
    emoji: '🐄',
    gradient: 'from-amber-300 via-yellow-300 to-lime-300',
    language: 'Telugu',
    learn: [
      { emoji: '🔤', title: 'అక్షరాలు', text: 'అక్షరాలు కలిస్తే పదాలు అవుతాయి.', scene: 'letters' },
      { emoji: '🐄', title: 'ఆ - వు', text: 'ఆ మరియు వు కలిస్తే ఆవు.', scene: 'letters' },
      { emoji: '🌸', title: 'పు - వ్వు', text: 'పు మరియు వ్వు కలిస్తే పువ్వు.', scene: 'letters' },
    ],
    gameTitle: 'పద నిర్మాణం',
    game: {
      kind: 'wordbuild',
      words: [
        { word: 'ఆవు', tiles: ['ఆ', 'వు'], emoji: '🐄', meaning: 'cow' },
        { word: 'అమ్మ', tiles: ['అ', 'మ్మ'], emoji: '👩‍👧', meaning: 'mother' },
        { word: 'పువ్వు', tiles: ['పు', 'వ్వు'], emoji: '🌸', meaning: 'flower' },
        { word: 'చేప', tiles: ['చే', 'ప'], emoji: '🐟', meaning: 'fish' },
        { word: 'కలము', tiles: ['క', 'ల', 'ము'], emoji: '🖊️', meaning: 'pen' },
      ],
    },
    readAloud: [
      'ఆవు పాలు ఇస్తుంది.',
      'అమ్మ పువ్వులు కోసింది.',
      'చేప నీటిలో ఈదుతుంది.',
    ],
    quiz: [
      q('ఆవు ఏమి ఇస్తుంది?', ['పాలు', 'గుడ్లు', 'తేనె', 'ఉన్ని'], 0, 'ఆవు పాలు ఇస్తుంది.'),
      q('చేప ఎక్కడ ఉంటుంది?', ['చెట్టు మీద', 'నీటిలో', 'గూటిలో', 'కొండ మీద'], 1, 'చేప నీటిలో ఈదుతుంది.'),
      q('"ఆ" మరియు "వు" కలిస్తే ఏ పదం?', ['ఆవు', 'అమ్మ', 'పువ్వు', 'చేప'], 0, 'ఆ + వు = ఆవు.'),
    ],
  },

  /* ---------------------------- HINDI ---------------------------- */
  {
    id: 'hindi-words',
    grades: [3, 5],
    subject: 'Hindi',
    title: 'शब्द बनाओ',
    subtitle: 'Build Hindi words from letters',
    emoji: '🏠',
    gradient: 'from-rose-300 via-pink-300 to-fuchsia-300',
    language: 'Hindi',
    learn: [
      { emoji: '🔤', title: 'अक्षर', text: 'अक्षर मिलकर शब्द बनाते हैं।', scene: 'letters' },
      { emoji: '🏠', title: 'घ - र', text: 'घ और र मिलकर बनता है घर।', scene: 'letters' },
      { emoji: '🪷', title: 'क - म - ल', text: 'क, म और ल मिलकर बनता है कमल।', scene: 'letters' },
    ],
    gameTitle: 'शब्द निर्माण',
    game: {
      kind: 'wordbuild',
      words: [
        { word: 'घर', tiles: ['घ', 'र'], emoji: '🏠', meaning: 'house' },
        { word: 'कमल', tiles: ['क', 'म', 'ल'], emoji: '🪷', meaning: 'lotus' },
        { word: 'फल', tiles: ['फ', 'ल'], emoji: '🍎', meaning: 'fruit' },
        { word: 'नल', tiles: ['न', 'ल'], emoji: '🚰', meaning: 'tap' },
        { word: 'बतख', tiles: ['ब', 'त', 'ख'], emoji: '🦆', meaning: 'duck' },
      ],
    },
    readAloud: [
      'यह मेरा घर है।',
      'तालाब में कमल खिला है।',
      'बतख पानी में तैरती है।',
    ],
    quiz: [
      q('तालाब में क्या खिला है?', ['कमल', 'घर', 'नल', 'फल'], 0, 'तालाब में कमल खिला है।'),
      q('बतख कहाँ तैरती है?', ['पेड़ पर', 'पानी में', 'घर में', 'आसमान में'], 1, 'बतख पानी में तैरती है।'),
      q('"घ" और "र" मिलकर क्या बनता है?', ['घर', 'कमल', 'फल', 'नल'], 0, 'घ + र = घर।'),
    ],
  },

  /* ------------------------ MORE BY CLASS ------------------------ */
  {
    id: 'maths-counting',
    subject: 'Maths',
    grades: [1, 2],
    title: 'Let Us Count',
    subtitle: 'Count things from 1 to 10',
    emoji: '🔢',
    gradient: 'from-lime-300 via-emerald-300 to-teal-300',
    language: 'English',
    learn: [
      { emoji: '🍎', title: 'One by one', text: 'We touch each thing and say one number.', count: { op: 'count', n: 5, emoji: '🍎' } },
      { emoji: '🖐️', title: 'Five fingers', text: 'One hand has five fingers. Two hands have ten.', count: { op: 'groups', groups: 2, each: 5, emoji: '👆', stage: 'add' } },
      { emoji: '🔟', title: 'Up to ten', text: 'One, two, three, four, five, six, seven, eight, nine, ten.', count: { op: 'count', n: 10, emoji: '⭐' } },
    ],
    gameTitle: 'Count and Match',
    game: {
      kind: 'match',
      prompt: 'Match each group to its number',
      pairs: [
        { left: '🍎', leftLabel: '1 apple', right: '1️⃣', rightLabel: 'One' },
        { left: '🐥🐥', leftLabel: '2 chicks', right: '2️⃣', rightLabel: 'Two' },
        { left: '⭐⭐⭐', leftLabel: '3 stars', right: '3️⃣', rightLabel: 'Three' },
        { left: '🎈🎈🎈🎈', leftLabel: '4 balloons', right: '4️⃣', rightLabel: 'Four' },
        { left: '🐟🐟🐟🐟🐟', leftLabel: '5 fish', right: '5️⃣', rightLabel: 'Five' },
      ],
    },
    readAloud: [
      'I can count from one to ten.',
      'One hand has five fingers.',
      'Two hands have ten fingers.',
    ],
    quiz: [
      q('How many fingers are on one hand?', ['Three', 'Five', 'Ten', 'Two'], 1, 'One hand has five fingers.'),
      q('Which number comes after 7?', ['6', '8', '9', '5'], 1, 'Seven, then eight.'),
      q('How many stars? ⭐⭐⭐', ['2', '3', '4', '5'], 1, 'Count them: one, two, three.'),
    ],
  },
  {
    id: 'maths-clock',
    subject: 'Maths',
    grades: [2, 4],
    title: 'Telling the Time',
    subtitle: 'Read the clock',
    emoji: '🕒',
    gradient: 'from-sky-300 via-indigo-300 to-violet-300',
    language: 'English',
    learn: [
      { emoji: '🕐', title: 'Two hands', text: 'A clock has a short hand for hours and a long hand for minutes.' },
      { emoji: '🕒', title: 'O clock', text: 'When the long hand points to 12, we say o clock. This is 3 o clock.' },
      { emoji: '🕡', title: 'Half past', text: 'When the long hand points to 6, it is half past. This is half past 6.' },
    ],
    gameTitle: 'Clock Match',
    game: {
      kind: 'match',
      prompt: 'Match each clock to its time',
      pairs: [
        { left: '🕐', leftLabel: 'Clock', right: '1', rightLabel: '1 o clock' },
        { left: '🕒', leftLabel: 'Clock', right: '3', rightLabel: '3 o clock' },
        { left: '🕕', leftLabel: 'Clock', right: '6', rightLabel: '6 o clock' },
        { left: '🕘', leftLabel: 'Clock', right: '9', rightLabel: '9 o clock' },
        { left: '🕡', leftLabel: 'Clock', right: '½', rightLabel: 'Half past 6' },
      ],
    },
    readAloud: [
      'A clock has two hands.',
      'The short hand shows the hour.',
      'The long hand shows the minutes.',
    ],
    quiz: [
      q('Which hand shows the hour?', ['The long hand', 'The short hand', 'Both hands', 'No hand'], 1, 'The short hand shows the hour.'),
      q('The long hand is on 12 and the short hand is on 3. What time is it?', ['12 o clock', '3 o clock', 'Half past 3', '6 o clock'], 1, 'Long hand on 12 means o clock.'),
      q('Where is the long hand at half past?', ['On 12', 'On 3', 'On 6', 'On 9'], 2, 'At half past, the long hand points to 6.'),
    ],
  },
  {
    id: 'maths-multiply',
    subject: 'Maths',
    grades: [3, 5],
    title: 'Groups Of',
    subtitle: 'Multiplication is adding equal groups',
    emoji: '✖️',
    gradient: 'from-fuchsia-300 via-pink-300 to-rose-300',
    language: 'English',
    learn: [
      { emoji: '🍪', title: 'Equal groups', text: 'There are 3 plates. Each plate has 2 laddus.', count: { op: 'groups', groups: 3, each: 2, emoji: '🟠', stage: 'groups' } },
      { emoji: '➕', title: 'Add the groups', text: '2 plus 2 plus 2 makes 6.', count: { op: 'groups', groups: 3, each: 2, emoji: '🟠', stage: 'add' } },
      { emoji: '✖️', title: 'Multiply', text: 'Three groups of two is 3 times 2, and 3 times 2 is 6.', count: { op: 'groups', groups: 3, each: 2, emoji: '🟠', stage: 'equation' } },
    ],
    gameTitle: 'Times Match',
    game: {
      kind: 'match',
      prompt: 'Match each sum to its answer',
      pairs: [
        { left: '2×3', leftLabel: '2 times 3', right: '6', rightLabel: 'Six' },
        { left: '4×2', leftLabel: '4 times 2', right: '8', rightLabel: 'Eight' },
        { left: '5×2', leftLabel: '5 times 2', right: '10', rightLabel: 'Ten' },
        { left: '3×3', leftLabel: '3 times 3', right: '9', rightLabel: 'Nine' },
        { left: '4×5', leftLabel: '4 times 5', right: '20', rightLabel: 'Twenty' },
      ],
    },
    readAloud: [
      'Multiplication means adding equal groups.',
      'Three groups of two make six.',
      'Four times five is twenty.',
    ],
    quiz: [
      q('What is 3 × 2?', ['5', '6', '8', '9'], 1, 'Three groups of two make six.'),
      q('2 + 2 + 2 + 2 is the same as…', ['4 × 2', '2 × 2', '6 × 2', '4 + 2'], 0, 'Four groups of two.'),
      q('What is 4 × 5?', ['9', '15', '20', '25'], 2, 'Four fives make twenty.'),
    ],
  },
  {
    id: 'maths-fractions',
    subject: 'Maths',
    grades: [3, 5],
    title: 'Halves and Quarters',
    subtitle: 'Sharing into equal parts',
    emoji: '🍕',
    gradient: 'from-amber-300 via-yellow-300 to-lime-300',
    language: 'English',
    learn: [
      { emoji: '🫓', title: 'Equal parts', text: 'Cut one roti into two equal parts. Each part is one half.' },
      { emoji: '🍕', title: 'Quarters', text: 'Cut it into four equal parts. Each part is one quarter.' },
      { emoji: '½', title: 'Writing it', text: 'We write one half as 1 over 2, and one quarter as 1 over 4.' },
    ],
    gameTitle: 'Fraction Match',
    game: {
      kind: 'match',
      prompt: 'Match each fraction to its name',
      pairs: [
        { left: '½', leftLabel: '1/2', right: '🌗', rightLabel: 'One half' },
        { left: '¼', leftLabel: '1/4', right: '🍕', rightLabel: 'One quarter' },
        { left: '¾', leftLabel: '3/4', right: '🥧', rightLabel: 'Three quarters' },
        { left: '⅓', leftLabel: '1/3', right: '🍫', rightLabel: 'One third' },
      ],
    },
    readAloud: [
      'A fraction is a part of a whole.',
      'Two equal parts are called halves.',
      'Four equal parts are called quarters.',
    ],
    quiz: [
      q('One roti is cut into 2 equal parts. Each part is…', ['One quarter', 'One half', 'One third', 'The whole'], 1, 'Two equal parts are halves.'),
      q('How many quarters make one whole?', ['2', '3', '4', '5'], 2, 'Four quarters make a whole.'),
      q('Which is bigger: one half or one quarter?', ['One half', 'One quarter', 'They are the same', 'Neither'], 0, 'Sharing among fewer people gives bigger parts.'),
    ],
  },
  {
    id: 'science-senses',
    subject: 'Science',
    grades: [1, 2],
    title: 'My Five Senses',
    subtitle: 'How we know the world',
    emoji: '👀',
    gradient: 'from-pink-300 via-rose-300 to-orange-300',
    language: 'English',
    learn: [
      { emoji: '👀', title: 'See and hear', text: 'We see with our eyes and hear with our ears.' },
      { emoji: '👃', title: 'Smell and taste', text: 'We smell with our nose and taste with our tongue.' },
      { emoji: '✋', title: 'Touch', text: 'We feel things with our skin. Ice feels cold.' },
    ],
    gameTitle: 'Sense Match',
    game: {
      kind: 'match',
      prompt: 'Match each body part to what it does',
      pairs: [
        { left: '👀', leftLabel: 'Eyes', right: '🌈', rightLabel: 'See' },
        { left: '👂', leftLabel: 'Ears', right: '🎵', rightLabel: 'Hear' },
        { left: '👃', leftLabel: 'Nose', right: '🌸', rightLabel: 'Smell' },
        { left: '👅', leftLabel: 'Tongue', right: '🍋', rightLabel: 'Taste' },
        { left: '✋', leftLabel: 'Skin', right: '🧊', rightLabel: 'Touch' },
      ],
    },
    readAloud: [
      'I see with my eyes and hear with my ears.',
      'I smell a flower with my nose.',
      'I taste a mango with my tongue.',
    ],
    quiz: [
      q('We hear with our…', ['Eyes', 'Ears', 'Nose', 'Hands'], 1, 'Ears help us hear.'),
      q('Which sense tells us a lemon is sour?', ['Touch', 'Taste', 'Sight', 'Hearing'], 1, 'Our tongue tastes.'),
      q('How many senses do we have?', ['Three', 'Four', 'Five', 'Six'], 2, 'See, hear, smell, taste and touch.'),
    ],
  },
  {
    id: 'science-food',
    subject: 'Science',
    grades: [3, 5],
    title: 'Food That Helps Us Grow',
    subtitle: 'Energy, growth and protection',
    emoji: '🥕',
    gradient: 'from-orange-300 via-amber-300 to-lime-300',
    language: 'English',
    learn: [
      { emoji: '🍚', title: 'Energy food', text: 'Rice, roti and potatoes give us energy to run and play.' },
      { emoji: '🥚', title: 'Body-building food', text: 'Dal, milk and eggs help our body grow strong.' },
      { emoji: '🥕', title: 'Protective food', text: 'Fruits and vegetables keep us healthy and fight illness.' },
    ],
    gameTitle: 'Food Groups',
    game: {
      kind: 'match',
      prompt: 'Match each food to what it does',
      pairs: [
        { left: '🍚', leftLabel: 'Rice', right: '⚡', rightLabel: 'Energy' },
        { left: '🥛', leftLabel: 'Milk', right: '💪', rightLabel: 'Growth' },
        { left: '🥕', leftLabel: 'Carrot', right: '🛡️', rightLabel: 'Protection' },
        { left: '🫘', leftLabel: 'Dal', right: '🏋️', rightLabel: 'Strong body' },
        { left: '💧', leftLabel: 'Water', right: '🌡️', rightLabel: 'Keeps us cool' },
      ],
    },
    readAloud: [
      'Rice and roti give us energy.',
      'Dal and milk help us grow strong.',
      'Fruits and vegetables keep us healthy.',
    ],
    quiz: [
      q('Which food gives us energy?', ['Rice', 'Water', 'Salt', 'Ice'], 0, 'Rice is an energy food.'),
      q('Dal and milk help our body to…', ['Sleep', 'Grow strong', 'Get cold', 'Stop'], 1, 'They are body-building foods.'),
      q('Why should we eat vegetables?', ['To stay healthy', 'To get sleepy', 'To grow hair only', 'No reason'], 0, 'Vegetables protect us from illness.'),
    ],
  },
  {
    id: 'social-festivals',
    subject: 'Social',
    grades: [1, 3],
    title: 'Our Festivals',
    subtitle: 'Celebrating together',
    emoji: '🪔',
    gradient: 'from-yellow-300 via-orange-300 to-red-300',
    language: 'English',
    learn: [
      { emoji: '🪔', title: 'Diwali', text: 'At Diwali we light lamps and share sweets.' },
      { emoji: '🌸', title: 'Bathukamma', text: 'In Telangana we make Bathukamma with colourful flowers.' },
      { emoji: '🌙', title: 'Eid and Christmas', text: 'At Eid we share food. At Christmas we decorate a tree.' },
    ],
    gameTitle: 'Festival Match',
    game: {
      kind: 'match',
      prompt: 'Match each festival to its symbol',
      pairs: [
        { left: '🪔', leftLabel: 'Diwali', right: '✨', rightLabel: 'Lamps' },
        { left: '🌸', leftLabel: 'Bathukamma', right: '💐', rightLabel: 'Flowers' },
        { left: '🌙', leftLabel: 'Eid', right: '🍲', rightLabel: 'Sheer khurma' },
        { left: '🎄', leftLabel: 'Christmas', right: '⭐', rightLabel: 'Star' },
        { left: '🪁', leftLabel: 'Sankranti', right: '🧵', rightLabel: 'Kites' },
      ],
    },
    readAloud: [
      'We celebrate many festivals in India.',
      'We light lamps at Diwali and fly kites at Sankranti.',
      'Festivals bring families and friends together.',
    ],
    quiz: [
      q('At which festival do we fly kites?', ['Diwali', 'Sankranti', 'Christmas', 'Eid'], 1, 'Kites fly at Sankranti.'),
      q('What do we light at Diwali?', ['Lamps', 'Kites', 'Trees', 'Boats'], 0, 'Diwali is the festival of lamps.'),
      q('Bathukamma is made with…', ['Flowers', 'Stones', 'Paper', 'Sand'], 0, 'Bathukamma is a stack of flowers.'),
    ],
  },
  {
    id: 'social-india',
    subject: 'Social',
    grades: [4, 5],
    title: 'States of India',
    subtitle: 'Our states and their capitals',
    emoji: '🇮🇳',
    gradient: 'from-orange-300 via-stone-100 to-emerald-300',
    language: 'English',
    learn: [
      { emoji: '🗺️', title: 'Our country', text: 'India has twenty eight states and eight union territories.' },
      { emoji: '🏛️', title: 'Capitals', text: 'Every state has a capital city. The capital of Telangana is Hyderabad.' },
      { emoji: '🇮🇳', title: 'New Delhi', text: 'New Delhi is the capital of India.' },
    ],
    gameTitle: 'Capital Match',
    game: {
      kind: 'match',
      prompt: 'Match each state to its capital',
      pairs: [
        { left: '🏰', leftLabel: 'Telangana', right: '🕌', rightLabel: 'Hyderabad' },
        { left: '🌊', leftLabel: 'Tamil Nadu', right: '🏖️', rightLabel: 'Chennai' },
        { left: '🌳', leftLabel: 'Karnataka', right: '🌆', rightLabel: 'Bengaluru' },
        { left: '🎬', leftLabel: 'Maharashtra', right: '🌉', rightLabel: 'Mumbai' },
        { left: '🐯', leftLabel: 'West Bengal', right: '🚋', rightLabel: 'Kolkata' },
      ],
    },
    readAloud: [
      'India is a big country with many states.',
      'Hyderabad is the capital of Telangana.',
      'New Delhi is the capital of India.',
    ],
    quiz: [
      q('What is the capital of Telangana?', ['Chennai', 'Hyderabad', 'Mumbai', 'Kolkata'], 1, 'Hyderabad is the capital of Telangana.'),
      q('What is the capital of India?', ['Mumbai', 'New Delhi', 'Bengaluru', 'Chennai'], 1, 'New Delhi is the capital of India.'),
      q('Chennai is the capital of…', ['Tamil Nadu', 'Kerala', 'Karnataka', 'Goa'], 0, 'Chennai is in Tamil Nadu.'),
    ],
  },
  {
    id: 'english-opposites',
    subject: 'English',
    grades: [2, 5],
    title: 'Opposite Words',
    subtitle: 'Big and small, hot and cold',
    emoji: '↔️',
    gradient: 'from-cyan-300 via-sky-300 to-indigo-300',
    language: 'English',
    learn: [
      { emoji: '🐘', title: 'Big and small', text: 'An elephant is big. An ant is small.' },
      { emoji: '☀️', title: 'Hot and cold', text: 'The sun is hot. Ice is cold.' },
      { emoji: '🐢', title: 'Fast and slow', text: 'A rabbit is fast. A tortoise is slow.' },
    ],
    gameTitle: 'Opposite Match',
    game: {
      kind: 'match',
      prompt: 'Match each word to its opposite',
      pairs: [
        { left: '🐘', leftLabel: 'Big', right: '🐜', rightLabel: 'Small' },
        { left: '🔥', leftLabel: 'Hot', right: '🧊', rightLabel: 'Cold' },
        { left: '🐇', leftLabel: 'Fast', right: '🐢', rightLabel: 'Slow' },
        { left: '☀️', leftLabel: 'Day', right: '🌙', rightLabel: 'Night' },
        { left: '😀', leftLabel: 'Happy', right: '😢', rightLabel: 'Sad' },
      ],
    },
    readAloud: [
      'An elephant is big and an ant is small.',
      'The sun is hot and ice is cold.',
      'A rabbit is fast and a tortoise is slow.',
    ],
    quiz: [
      q('What is the opposite of big?', ['Tall', 'Small', 'Fat', 'Long'], 1, 'Big and small are opposites.'),
      q('What is the opposite of day?', ['Morning', 'Night', 'Sun', 'Noon'], 1, 'Day and night are opposites.'),
      q('A tortoise is…', ['Fast', 'Slow', 'Hot', 'Tall'], 1, 'A tortoise moves slowly.'),
    ],
  },
  {
    id: 'english-sentences',
    subject: 'English',
    grades: [3, 5],
    title: 'Naming and Doing Words',
    subtitle: 'Nouns and verbs',
    emoji: '🏃',
    gradient: 'from-emerald-300 via-teal-300 to-cyan-300',
    language: 'English',
    learn: [
      { emoji: '🐕', title: 'Naming words', text: 'A naming word is a noun. Dog, school and Ravi are nouns.' },
      { emoji: '🏃', title: 'Doing words', text: 'A doing word is a verb. Run, jump and read are verbs.' },
      { emoji: '📝', title: 'A sentence', text: 'A sentence needs both. The dog runs fast.' },
    ],
    gameTitle: 'Who Does What',
    game: {
      kind: 'match',
      prompt: 'Match each noun to its verb',
      pairs: [
        { left: '🐕', leftLabel: 'The dog', right: '🦴', rightLabel: 'barks' },
        { left: '🐦', leftLabel: 'The bird', right: '🪽', rightLabel: 'flies' },
        { left: '🐟', leftLabel: 'The fish', right: '🌊', rightLabel: 'swims' },
        { left: '👧', leftLabel: 'The girl', right: '📖', rightLabel: 'reads' },
        { left: '👨‍🍳', leftLabel: 'The cook', right: '🍳', rightLabel: 'cooks' },
      ],
    },
    readAloud: [
      'The dog barks and the bird flies.',
      'The fish swims in the pond.',
      'The girl reads a story book.',
    ],
    quiz: [
      q('Which word is a noun?', ['Run', 'School', 'Jump', 'Sing'], 1, 'School is a naming word.'),
      q('Which word is a verb?', ['Tree', 'Ravi', 'Swim', 'Book'], 2, 'Swim is a doing word.'),
      q('In "The bird flies", the doing word is…', ['The', 'Bird', 'Flies', 'None'], 2, 'Flies tells what the bird does.'),
    ],
  },
];

export const LAB_CHAPTERS: LabChapter[] = [...BASE_CHAPTERS, ...HIGH_SCHOOL_CHAPTERS];

export const gradeNumber = (grade: string | undefined): number => Number(String(grade || '').replace(/\D/g, '')) || 1;

/**
 * Built-in chapters for a subject, only those written for this class when
 * given. A Class 6-10 simulation lab shows only in the classes whose
 * Telangana syllabus has the chapter it teaches.
 */
export function labChaptersFor(subject: string, grade?: string): LabChapter[] {
  const n = grade ? gradeNumber(grade) : null;
  const syllabusLabs = grade ? syllabusLabIds(grade) : null;
  return LAB_CHAPTERS.filter(
    (chapter) =>
      chapter.subject === subject &&
      (n === null || (n >= chapter.grades[0] && n <= chapter.grades[1])) &&
      (!syllabusLabs || chapter.game.kind !== 'sim' || syllabusLabs.has(chapter.id))
  );
}

/** The Learn cards a class sees (cards can be limited to some classes). */
export function labCardsFor(chapter: LabChapter, grade?: string): LabCard[] {
  if (!grade) return chapter.learn;
  const n = gradeNumber(grade);
  const cards = chapter.learn.filter((card) => !card.grades || (n >= card.grades[0] && n <= card.grades[1]));
  return cards.length ? cards : chapter.learn;
}

// Subject Hub tiles by class: Class 1-2 learn English, Maths, Telugu and
// Science (EVS); Social and Hindi join from Class 3. A tile also appears
// whenever a teacher has published a book for it.
export function subjectsForGrade(grade: string | undefined): LabSubject[] {
  return gradeNumber(grade) <= 2
    ? ['English', 'Maths', 'Science', 'Telugu']
    : ['English', 'Maths', 'Science', 'Social', 'Hindi', 'Telugu'];
}

export function labChapterById(id: string): LabChapter | undefined {
  return LAB_CHAPTERS.find((chapter) => chapter.id === id);
}

/* ------------------------- Maths number ranges ------------------------- */

// Largest sum (addition) / starting amount (subtraction) for a class.
export function mathsLimitForGrade(grade: string): number {
  switch (grade) {
    case 'Class 1':
      return 10;
    case 'Class 2':
      return 20;
    case 'Class 3':
      return 50;
    case 'Class 4':
      return 99;
    default:
      return 99;
  }
}

export interface MathsProblem {
  a: number;
  b: number;
  answer: number;
  options: number[];
}

// Three different answer choices near the answer, shuffled, never negative.
export function answerOptions(answer: number, random: () => number = Math.random): number[] {
  const options = new Set<number>([answer]);
  const spread = answer > 20 ? 10 : 3;
  let guard = 0;
  while (options.size < 3 && guard++ < 50) {
    const delta = Math.floor(random() * spread) + 1;
    const candidate = random() < 0.5 ? answer - delta : answer + delta;
    if (candidate >= 0) options.add(candidate);
  }
  for (let fill = answer + 1; options.size < 3; fill++) options.add(fill);
  return [...options].sort(() => random() - 0.5);
}

export function makeAdditionProblem(grade: string, random: () => number = Math.random): MathsProblem {
  const limit = mathsLimitForGrade(grade);
  const a = 1 + Math.floor(random() * (limit - 1));
  const b = 1 + Math.floor(random() * Math.max(1, limit - a));
  const answer = a + b;
  return { a, b, answer, options: answerOptions(answer, random) };
}

// Subtraction stays with countable balloons (up to 20) in every class.
export function makeSubtractionProblem(grade: string, random: () => number = Math.random): MathsProblem {
  const limit = Math.min(20, mathsLimitForGrade(grade));
  const a = 2 + Math.floor(random() * (limit - 1));
  const b = 1 + Math.floor(random() * (a - 1));
  const answer = a - b;
  return { a, b, answer, options: answerOptions(answer, random) };
}
