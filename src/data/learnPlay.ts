// Built-in "Learn & Play" chapters: every subject tile gets ready-made,
// interactive chapters (animated lesson cards -> a game -> read aloud with
// the microphone -> quiz), independent of what teachers publish. Content is
// written for Classes 1-5; the maths games scale their numbers by class.
import { ComprehensionQuestion, Language } from '../types';

export type LabSubject = 'English' | 'Maths' | 'Science' | 'Social' | 'Hindi' | 'Telugu';

export interface LabCard {
  emoji: string;
  title: string;
  text: string;
  // Optional animated scene drawn by the Learn step instead of the emoji.
  scene?: 'add' | 'subtract' | 'numberline' | 'shapes' | 'plant' | 'watercycle' | 'homes' | 'helpers' | 'compass' | 'letters' | 'rhyme';
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
  | { kind: 'wordbuild'; words: { word: string; tiles: string[]; emoji: string; meaning: string }[] };

export interface LabChapter {
  id: string;
  subject: LabSubject;
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

export const LAB_CHAPTERS: LabChapter[] = [
  /* ---------------------------- MATHS ---------------------------- */
  {
    id: 'maths-adding',
    subject: 'Maths',
    title: 'Adding Together',
    subtitle: 'Put groups together and count them all',
    emoji: '🥭',
    gradient: 'from-amber-300 via-orange-300 to-rose-300',
    language: 'English',
    learn: [
      { emoji: '🥭', title: 'Two baskets', text: 'Ravi has 3 mangoes. Sita has 2 mangoes.', scene: 'add' },
      { emoji: '➕', title: 'Put them together', text: 'When we put the mangoes in one basket, we add them.', scene: 'add' },
      { emoji: '🔢', title: 'Count them all', text: '3 and 2 more makes 5. We write it as 3 + 2 = 5.', scene: 'add' },
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
    subject: 'Maths',
    title: 'Taking Away',
    subtitle: 'Balloons fly away — how many are left?',
    emoji: '🎈',
    gradient: 'from-sky-300 via-indigo-300 to-fuchsia-300',
    language: 'English',
    learn: [
      { emoji: '🎈', title: 'Five balloons', text: 'Meena holds 5 balloons at the fair.', scene: 'subtract' },
      { emoji: '💨', title: 'Whoosh!', text: 'The wind blows and 2 balloons fly away.', scene: 'subtract' },
      { emoji: '➖', title: 'What is left?', text: '5 take away 2 leaves 3. We write it as 5 − 2 = 3.', scene: 'subtract' },
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
    subject: 'Maths',
    title: 'Frog on the Number Line',
    subtitle: 'Jump forward to add, jump back to take away',
    emoji: '🐸',
    gradient: 'from-lime-300 via-emerald-300 to-teal-300',
    language: 'English',
    learn: [
      { emoji: '📏', title: 'The number line', text: 'Numbers sit in a line, getting bigger as we go right.', scene: 'numberline' },
      { emoji: '🐸', title: 'Jump forward', text: 'The frog is on 4. It jumps 3 forward and lands on 7. 4 + 3 = 7.', scene: 'numberline' },
      { emoji: '⬅️', title: 'Jump back', text: 'From 7 it jumps 2 back and lands on 5. 7 − 2 = 5.', scene: 'numberline' },
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
];

export function labChaptersFor(subject: string): LabChapter[] {
  return LAB_CHAPTERS.filter((chapter) => chapter.subject === subject);
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
