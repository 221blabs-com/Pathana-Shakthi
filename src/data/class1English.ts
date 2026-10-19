// "My English Book · Class 1": a full Class 1 English course for students and
// teachers, built on the lesson shape Telangana's Tholimettu (FLN) programme
// asks for in an English period: face sheet (picture talk) → listening text →
// reading (model / collaborative / individual) → post-reading → writing.
// Research notes: curriculum-research/ (the SCERT Class 1 FLN book itself could
// not be opened when this was written, so every story, rhyme and picture here
// is Pathana Shakthi's own; the unit themes follow the ones reported for the
// SCERT Class 1 English book). Shared by the browser and printing; unit tested.
import { ComprehensionQuestion } from '../types';

export interface PictureWord {
  word: string;
  emoji: string;
}

export interface LetterLesson {
  letter: string; // lower case; the capital is letter.toUpperCase()
  sound: string; // how the teacher says it, e.g. "sss as in sun"
  words: PictureWord[]; // first one is the key word
  /** 'end': the letter is taught by its ending sound (x in fox, box). */
  position?: 'start' | 'end';
}

export interface ListeningQuestion {
  question: string;
  options: PictureWord[]; // pictures to tap
  answer: number;
}

export interface EnglishUnit {
  id: string;
  number: number;
  title: string;
  theme: string;
  emoji: string;
  gradient: string;
  /** Face sheet: one big scene the class talks about. */
  pictureTalk: { scene: string; items: PictureWord[]; prompts: string[] };
  /** Listening text: the teacher (or app) reads it, children listen. */
  story: { title: string; lines: string[]; questions: ListeningQuestion[] };
  rhyme: { title: string; lines: string[]; action: string };
  letters: LetterLesson[];
  sightWords: string[];
  /** Short lines the child reads aloud with the microphone. */
  readAloud: string[];
  quiz: ComprehensionQuestion[];
  /** "The learner …" — what a child can do after the unit. */
  outcomes: string[];
  /** A doing activity for the classroom (role play, show and tell, …). */
  classActivity: string;
  /** Worksheet: what to draw, and the sentence starter to finish under it. */
  draw: { prompt: string; starter: string };
}

const pw = (word: string, emoji: string): PictureWord => ({ word, emoji });
const q = (question: string, options: string[], correctOptionIndex: number, explanation: string): ComprehensionQuestion => ({
  question,
  options,
  correctOptionIndex,
  explanation,
});
const lq = (question: string, options: PictureWord[], answer: number): ListeningQuestion => ({ question, options, answer });

export const CLASS1_ENGLISH_UNITS: EnglishUnit[] = [
  {
    id: 'e1-family',
    number: 1,
    title: 'My Family',
    theme: 'Family',
    emoji: '👨‍👩‍👧‍👦',
    gradient: 'from-amber-200 via-orange-200 to-rose-200',
    pictureTalk: {
      scene: 'Chinni’s family at home in the evening',
      items: [pw('mother', '👩'), pw('father', '👨'), pw('grandmother', '👵'), pw('baby', '👶'), pw('brother', '👦'), pw('house', '🏠'), pw('cat', '🐈')],
      prompts: ['Who do you see in the picture?', 'Who is the baby?', 'Who lives in your house?', 'What does your mother do in the evening?'],
    },
    story: {
      title: 'Chinni and Her Family',
      lines: [
        'This is Chinni.',
        'Chinni lives with her family in a small house.',
        'Her father grows rice in the field.',
        'Her mother makes hot rotis.',
        'Granny tells stories at night.',
        'Chinni loves her family.',
      ],
      questions: [
        lq('Who tells stories at night?', [pw('father', '👨'), pw('granny', '👵'), pw('baby', '👶')], 1),
        lq('What does father grow?', [pw('rice', '🌾'), pw('mango', '🥭'), pw('flowers', '🌸')], 0),
        lq('What does mother make?', [pw('tea', '🍵'), pw('rotis', '🫓'), pw('cake', '🎂')], 1),
      ],
    },
    rhyme: {
      title: 'One, Two, My Family',
      lines: ['One, two, Amma and you,', 'Three, four, Nanna at the door,', 'Five, six, Granny’s stories mix,', 'Seven, eight, we sit and wait.', 'Nine, ten, we sing again!'],
      action: 'Show the number with your fingers on each line.',
    },
    letters: [
      { letter: 's', sound: 'sss — like a snake', words: [pw('sun', '☀️'), pw('snake', '🐍'), pw('sock', '🧦')] },
      { letter: 'a', sound: 'a — like in ant', words: [pw('ant', '🐜'), pw('apple', '🍎'), pw('alligator', '🐊')] },
      { letter: 't', sound: 't t t — like a clock ticking', words: [pw('tiger', '🐯'), pw('tomato', '🍅'), pw('tent', '⛺')] },
    ],
    sightWords: ['I', 'a', 'my'],
    readAloud: ['I am Chinni.', 'This is my mother.', 'This is my father.', 'I love my family.'],
    quiz: [
      q('Who tells stories at night?', ['Father', 'Granny', 'Chinni'], 1, 'Granny tells stories at night.'),
      q('Which word starts with s?', ['sun', 'tiger', 'ant'], 0, 'Sun starts with sss.'),
      q('Chinni loves her…', ['family', 'bus', 'pen'], 0, 'Chinni loves her family.'),
    ],
    outcomes: [
      'names family members when shown a picture',
      'listens to a short story and answers simple questions by pointing',
      'recites a rhyme with actions',
      'says the sounds s, a, t and finds pictures that begin with them',
      'reads the words I, a, my',
    ],
    classActivity: 'Show and tell: each child draws their family and says "This is my …" for each person.',
    draw: { prompt: 'Draw your family.', starter: 'This is my' },
  },
  {
    id: 'e1-school',
    number: 2,
    title: 'My School',
    theme: 'School',
    emoji: '🏫',
    gradient: 'from-sky-200 via-cyan-200 to-emerald-200',
    pictureTalk: {
      scene: 'A classroom in a village school',
      items: [pw('teacher', '👩‍🏫'), pw('book', '📕'), pw('bag', '🎒'), pw('pencil', '✏️'), pw('blackboard', '🖤'), pw('bell', '🔔'), pw('clock', '🕘')],
      prompts: ['What is the teacher doing?', 'What is in your bag?', 'What do you do when the bell rings?', 'What do you like in school?'],
    },
    story: {
      title: 'Raju Goes to School',
      lines: [
        'Raju gets up early.',
        'He packs his bag with a book and a pencil.',
        'The school bell rings. Ding, dong!',
        'The teacher says, "Good morning, children."',
        'Raju says, "Good morning, teacher."',
        'Raju is happy in school.',
      ],
      questions: [
        lq('What rings at school?', [pw('phone', '📱'), pw('bell', '🔔'), pw('drum', '🥁')], 1),
        lq('What does Raju pack in his bag?', [pw('ball', '⚽'), pw('book', '📕'), pw('apple', '🍎')], 1),
        lq('Who says "Good morning, children"?', [pw('teacher', '👩‍🏫'), pw('mother', '👩'), pw('cat', '🐈')], 0),
      ],
    },
    rhyme: {
      title: 'Ding Dong Bell',
      lines: ['Ding, dong, the school bell rings,', 'We stand up straight and sing,', 'Book in bag and pencil too,', 'Good morning, teacher, how are you?'],
      action: 'Ring a pretend bell, then stand up straight.',
    },
    letters: [
      { letter: 'p', sound: 'p p p — a little puff of air', words: [pw('pen', '🖊️'), pw('parrot', '🦜'), pw('pig', '🐷')] },
      { letter: 'i', sound: 'i — like in ink', words: [pw('ink', '🖋️'), pw('insect', '🐛'), pw('ill', '🤒')] },
      { letter: 'n', sound: 'nnn — hum through your nose', words: [pw('nest', '🪺'), pw('nose', '👃'), pw('net', '🥅')] },
    ],
    sightWords: ['is', 'the', 'see'],
    readAloud: ['I see the bell.', 'The bell is big.', 'I see my teacher.', 'Good morning, teacher.'],
    quiz: [
      q('What does Raju say to the teacher?', ['Good night', 'Good morning', 'Bye bye'], 1, 'He greets the teacher: Good morning.'),
      q('Which word starts with p?', ['nest', 'pen', 'ink'], 1, 'Pen starts with p.'),
      q('Raju is ___ in school.', ['sad', 'happy', 'angry'], 1, 'Raju is happy in school.'),
    ],
    outcomes: [
      'names things in the classroom',
      'greets the teacher and friends ("Good morning", "Thank you")',
      'says the sounds p, i, n and finds pictures that begin with them',
      'reads the words is, the, see',
    ],
    classActivity: 'Role play: one child is the teacher, the class greets them and says what is in their bag.',
    draw: { prompt: 'Draw your school bag and what is in it.', starter: 'I see a' },
  },
  {
    id: 'e1-friends',
    number: 3,
    title: 'My Friends',
    theme: 'Friendship',
    emoji: '🤝',
    gradient: 'from-violet-200 via-fuchsia-200 to-pink-200',
    pictureTalk: {
      scene: 'Children playing in the school ground',
      items: [pw('ball', '⚽'), pw('skipping rope', '🪢'), pw('tree', '🌳'), pw('girl', '👧'), pw('boy', '👦'), pw('dog', '🐕'), pw('kite', '🪁')],
      prompts: ['What games are the children playing?', 'Who is your best friend?', 'What do you play with your friends?', 'How do you help a friend?'],
    },
    story: {
      title: 'Salma Shares',
      lines: [
        'Salma and Ravi are friends.',
        'They play with a red ball.',
        'Ravi falls down. Oh no!',
        'Salma helps him get up.',
        'She shares her mango with him.',
        'Good friends help and share.',
      ],
      questions: [
        lq('What colour is the ball?', [pw('red', '🔴'), pw('blue', '🔵'), pw('green', '🟢')], 0),
        lq('What does Salma share?', [pw('mango', '🥭'), pw('ball', '⚽'), pw('book', '📕')], 0),
        lq('Who falls down?', [pw('Salma', '👧'), pw('Ravi', '👦'), pw('dog', '🐕')], 1),
      ],
    },
    rhyme: {
      title: 'Hand in Hand',
      lines: ['Hand in hand, we walk to play,', 'Friends together every day,', 'If you fall, I help you stand,', 'Friends are friends, hand in hand.'],
      action: 'Hold your friend’s hand and walk in a circle.',
    },
    letters: [
      { letter: 'm', sound: 'mmm — like yummy food', words: [pw('mango', '🥭'), pw('moon', '🌙'), pw('monkey', '🐒')] },
      { letter: 'd', sound: 'd d d — like a drum', words: [pw('dog', '🐕'), pw('drum', '🥁'), pw('duck', '🦆')] },
      { letter: 'g', sound: 'g g g — from the back of your throat', words: [pw('goat', '🐐'), pw('grapes', '🍇'), pw('gift', '🎁')] },
    ],
    sightWords: ['we', 'go', 'to'],
    readAloud: ['We go to play.', 'I see a red ball.', 'We play with the ball.', 'Salma is my friend.'],
    quiz: [
      q('What do good friends do?', ['Fight', 'Help and share', 'Run away'], 1, 'Good friends help and share.'),
      q('Which word starts with m?', ['mango', 'dog', 'goat'], 0, 'Mango starts with mmm.'),
      q('Salma and Ravi play with a…', ['kite', 'ball', 'doll'], 1, 'They play with a red ball.'),
    ],
    outcomes: [
      'talks about friends and games in short sentences',
      'listens to a story and tells what happened',
      'says the sounds m, d, g and finds pictures that begin with them',
      'reads the words we, go, to',
    ],
    classActivity: 'Pair talk: tell your partner "My friend is … We play …".',
    draw: { prompt: 'Draw you and your friend playing.', starter: 'We go to' },
  },
  {
    id: 'e1-habits',
    number: 4,
    title: 'Good Habits',
    theme: 'Good habits',
    emoji: '🪥',
    gradient: 'from-emerald-200 via-teal-200 to-sky-200',
    pictureTalk: {
      scene: 'Morning at home: getting ready for school',
      items: [pw('toothbrush', '🪥'), pw('soap', '🧼'), pw('water', '💧'), pw('towel', '🧻'), pw('comb', '🪮'), pw('plate', '🍽️'), pw('sun', '🌅')],
      prompts: ['What do you do when you get up?', 'Why do we wash our hands?', 'When do we brush our teeth?', 'What do you eat in the morning?'],
    },
    story: {
      title: 'Kiran’s Clean Hands',
      lines: [
        'Kiran gets up with the sun.',
        'He brushes his teeth.',
        'He takes a bath.',
        'Before eating, he washes his hands with soap.',
        'He puts the plate back after eating.',
        'Kiran is a good boy.',
      ],
      questions: [
        lq('What does Kiran use to wash his hands?', [pw('soap', '🧼'), pw('sand', '🏖️'), pw('milk', '🥛')], 0),
        lq('When does Kiran get up?', [pw('with the sun', '🌅'), pw('at night', '🌙'), pw('at lunch', '🍛')], 0),
        lq('What does he brush?', [pw('teeth', '🦷'), pw('shoes', '👟'), pw('cat', '🐈')], 0),
      ],
    },
    rhyme: {
      title: 'This Is the Way',
      lines: ['This is the way we brush our teeth,', 'Brush our teeth, brush our teeth,', 'This is the way we wash our hands,', 'Early in the morning.'],
      action: 'Pretend to brush and wash as you sing.',
    },
    letters: [
      { letter: 'o', sound: 'o — like in ox', words: [pw('ox', '🐂'), pw('octopus', '🐙'), pw('olive', '🫒')] },
      { letter: 'c', sound: 'c — a hard k sound, like cat', words: [pw('cat', '🐈'), pw('cap', '🧢'), pw('cow', '🐄')] },
      { letter: 'k', sound: 'k — the same sound as c', words: [pw('kite', '🪁'), pw('key', '🔑'), pw('king', '🤴')] },
    ],
    sightWords: ['in', 'up', 'can'],
    readAloud: ['I can get up.', 'I can brush my teeth.', 'I can wash my hands.', 'I am clean.'],
    quiz: [
      q('When should we wash our hands?', ['Before eating', 'Never', 'Only on Sunday'], 0, 'We wash our hands before eating.'),
      q('Which word starts with c?', ['kite', 'cat', 'ox'], 1, 'Cat starts with c.'),
      q('Kiran washes his hands with…', ['soap', 'mud', 'oil'], 0, 'He uses soap.'),
    ],
    outcomes: [
      'tells the order of morning activities (first, then)',
      'follows simple instructions ("Wash your hands", "Stand up")',
      'says the sounds o, c, k and finds pictures that begin with them',
      'reads the words in, up, can',
    ],
    classActivity: 'Action game: the teacher says a habit, children act it out ("Brush your teeth!").',
    draw: { prompt: 'Draw yourself brushing your teeth.', starter: 'I can' },
  },
  {
    id: 'e1-food',
    number: 5,
    title: 'Fruits and Vegetables',
    theme: 'Health',
    emoji: '🥕',
    gradient: 'from-lime-200 via-yellow-200 to-orange-200',
    pictureTalk: {
      scene: 'The Rythu Bazaar (farmers’ market) on Sunday',
      items: [pw('tomato', '🍅'), pw('banana', '🍌'), pw('carrot', '🥕'), pw('brinjal', '🍆'), pw('onion', '🧅'), pw('mango', '🥭'), pw('basket', '🧺')],
      prompts: ['What fruits can you see?', 'What vegetables can you see?', 'Which fruit do you like?', 'What colour is a carrot?'],
    },
    story: {
      title: 'At the Rythu Bazaar',
      lines: [
        'Amma and Lakshmi go to the market.',
        'They buy red tomatoes and green chillies.',
        'Lakshmi wants a yellow banana.',
        'Amma buys a big brinjal too.',
        'Fruits and vegetables make us strong.',
        'Lakshmi carries the basket home.',
      ],
      questions: [
        lq('What colour are the tomatoes?', [pw('red', '🔴'), pw('blue', '🔵'), pw('black', '⚫')], 0),
        lq('What does Lakshmi want?', [pw('banana', '🍌'), pw('cake', '🎂'), pw('chips', '🍟')], 0),
        lq('Who carries the basket?', [pw('Lakshmi', '👧'), pw('a dog', '🐕'), pw('the bus', '🚌')], 0),
      ],
    },
    rhyme: {
      title: 'Red and Green',
      lines: ['Red tomato, round and bright,', 'Yellow banana, a tasty bite,', 'Green chilli, hot hot hot!', 'Eat them all, and grow a lot!'],
      action: 'Make a round shape for the tomato and fan your mouth for "hot".',
    },
    letters: [
      { letter: 'e', sound: 'e — like in egg', words: [pw('egg', '🥚'), pw('elephant', '🐘'), pw('envelope', '✉️')] },
      { letter: 'u', sound: 'u — like in umbrella', words: [pw('umbrella', '☂️'), pw('up', '⬆️'), pw('upset', '😟')] },
      { letter: 'r', sound: 'rrr — like a growling dog', words: [pw('rabbit', '🐇'), pw('rose', '🌹'), pw('rain', '🌧️')] },
    ],
    sightWords: ['you', 'it', 'and'],
    readAloud: ['I see a red tomato.', 'It is big and red.', 'I like a banana.', 'Do you like it?'],
    quiz: [
      q('Which one is a vegetable?', ['Banana', 'Brinjal', 'Mango'], 1, 'Brinjal is a vegetable.'),
      q('Which word starts with r?', ['egg', 'rabbit', 'umbrella'], 1, 'Rabbit starts with rrr.'),
      q('Fruits and vegetables make us…', ['strong', 'sleepy', 'sad'], 0, 'They make us strong.'),
    ],
    outcomes: [
      'names common fruits and vegetables and their colours',
      'says what they like ("I like …")',
      'says the sounds e, u, r and finds pictures that begin with them',
      'reads the words you, it, and',
    ],
    classActivity: 'Market play: set up a pretend shop; children buy and sell, saying "I want a …, please."',
    draw: { prompt: 'Draw your favourite fruit.', starter: 'I like a' },
  },
  {
    id: 'e1-animals',
    number: 6,
    title: 'Animals Around Us',
    theme: 'Environment',
    emoji: '🐄',
    gradient: 'from-green-200 via-emerald-200 to-lime-200',
    pictureTalk: {
      scene: 'A village farm with animals',
      items: [pw('cow', '🐄'), pw('hen', '🐔'), pw('goat', '🐐'), pw('dog', '🐕'), pw('buffalo', '🐃'), pw('parrot', '🦜'), pw('tree', '🌳')],
      prompts: ['Which animals live on the farm?', 'What does a cow give us?', 'Which animal says "cluck"?', 'Which animal do you like?'],
    },
    story: {
      title: 'Who Says What?',
      lines: [
        'In the morning the hen says, "Cluck, cluck!"',
        'The cow says, "Moo, moo!"',
        'The dog says, "Bow, wow!"',
        'The parrot sits on the tree.',
        'The farmer gives them water and food.',
        'We must be kind to animals.',
      ],
      questions: [
        lq('Which animal says "Moo"?', [pw('cow', '🐄'), pw('dog', '🐕'), pw('hen', '🐔')], 0),
        lq('Where does the parrot sit?', [pw('on the tree', '🌳'), pw('in the bus', '🚌'), pw('in a cup', '☕')], 0),
        lq('Which animal says "Bow, wow"?', [pw('goat', '🐐'), pw('dog', '🐕'), pw('hen', '🐔')], 1),
      ],
    },
    rhyme: {
      title: 'On the Farm',
      lines: ['The hen says cluck, the cow says moo,', 'The dog says bow, wow, how do you do?', 'The goat says maa, the cat says mew,', 'Animals, animals, we love you!'],
      action: 'Make each animal’s sound and move like it.',
    },
    letters: [
      { letter: 'h', sound: 'h — a soft breath, like a tired dog', words: [pw('hen', '🐔'), pw('hat', '👒'), pw('house', '🏠')] },
      { letter: 'b', sound: 'b b b — lips together, then pop', words: [pw('ball', '⚽'), pw('bus', '🚌'), pw('banana', '🍌')] },
      { letter: 'f', sound: 'fff — top teeth on your lip', words: [pw('fish', '🐟'), pw('frog', '🐸'), pw('flower', '🌸')] },
      { letter: 'l', sound: 'lll — tongue up behind your teeth', words: [pw('lion', '🦁'), pw('leaf', '🍃'), pw('lamp', '🪔')] },
    ],
    sightWords: ['look', 'big', 'little'],
    readAloud: ['Look at the cow.', 'The cow is big.', 'Look at the hen.', 'The hen is little.'],
    quiz: [
      q('Which animal says "Cluck, cluck"?', ['Hen', 'Cow', 'Dog'], 0, 'The hen says cluck.'),
      q('Which word starts with f?', ['fish', 'hen', 'ball'], 0, 'Fish starts with fff.'),
      q('We must be ___ to animals.', ['kind', 'loud', 'late'], 0, 'We must be kind to animals.'),
    ],
    outcomes: [
      'names farm animals and the sounds they make',
      'uses big and little to describe things',
      'says the sounds h, b, f, l and finds pictures that begin with them',
      'reads the words look, big, little',
    ],
    classActivity: 'Guess the animal: a child makes a sound or action, the class names the animal.',
    draw: { prompt: 'Draw a big animal and a little animal.', starter: 'Look at the' },
  },
  {
    id: 'e1-travel',
    number: 7,
    title: 'Going Places',
    theme: 'Travel and community services',
    emoji: '🚌',
    gradient: 'from-red-200 via-orange-200 to-amber-200',
    pictureTalk: {
      scene: 'A busy road near the bus stand',
      items: [pw('bus', '🚌'), pw('auto', '🛺'), pw('bicycle', '🚲'), pw('train', '🚆'), pw('traffic light', '🚦'), pw('police', '👮'), pw('road', '🛣️')],
      prompts: ['How do you come to school?', 'What does a red light mean?', 'Who helps us on the road?', 'Where does a train go?'],
    },
    story: {
      title: 'The Bus to Granny’s Village',
      lines: [
        'Chinni and Nanna wait at the bus stand.',
        'The big red bus comes.',
        'They get in and sit by the window.',
        'Chinni sees fields, trees and a river.',
        'The bus stops at Granny’s village.',
        'Granny hugs Chinni. "Welcome!"',
      ],
      questions: [
        lq('What colour is the bus?', [pw('red', '🔴'), pw('green', '🟢'), pw('yellow', '🟡')], 0),
        lq('Where do they sit?', [pw('by the window', '🪟'), pw('on the roof', '🏠'), pw('on the road', '🛣️')], 0),
        lq('Who hugs Chinni?', [pw('granny', '👵'), pw('teacher', '👩‍🏫'), pw('police', '👮')], 0),
      ],
    },
    rhyme: {
      title: 'The Wheels on the Bus',
      lines: ['The wheels on the bus go round and round,', 'Round and round, round and round,', 'The wheels on the bus go round and round,', 'All through the town.'],
      action: 'Roll your hands round and round.',
    },
    letters: [
      { letter: 'j', sound: 'j — like in jeep', words: [pw('jeep', '🚙'), pw('juice', '🧃'), pw('jacket', '🧥')] },
      { letter: 'v', sound: 'vvv — top teeth on your lip, hum', words: [pw('van', '🚐'), pw('violin', '🎻'), pw('vase', '🏺')] },
      { letter: 'w', sound: 'w — round lips, like water', words: [pw('water', '💧'), pw('watch', '⌚'), pw('window', '🪟')] },
      { letter: 'y', sound: 'y — like in yellow', words: [pw('yellow', '💛'), pw('yo-yo', '🪀'), pw('yarn', '🧶')] },
    ],
    sightWords: ['come', 'here', 'play'],
    readAloud: ['Come here, Chinni.', 'The bus is here.', 'I go in the bus.', 'I see a big tree.'],
    quiz: [
      q('What does a red traffic light say?', ['Go', 'Stop', 'Run'], 1, 'Red means stop.'),
      q('Which word starts with w?', ['van', 'water', 'jeep'], 1, 'Water starts with w.'),
      q('Chinni goes to Granny’s village by…', ['bus', 'boat', 'plane'], 0, 'She goes by bus.'),
    ],
    outcomes: [
      'names vehicles and people who help us',
      'follows road safety words: stop, wait, go',
      'says the sounds j, v, w, y and finds pictures that begin with them',
      'reads the words come, here, play',
    ],
    classActivity: 'Traffic game: hold up red/yellow/green cards; children stop, wait or walk.',
    draw: { prompt: 'Draw a bus, an auto or a bicycle.', starter: 'Come here,' },
  },
  {
    id: 'e1-festivals',
    number: 8,
    title: 'Festival Fun',
    theme: 'Entertainment',
    emoji: '🪁',
    gradient: 'from-pink-200 via-rose-200 to-yellow-200',
    pictureTalk: {
      scene: 'Sankranti morning: kites, rangoli and sweets',
      items: [pw('kite', '🪁'), pw('rangoli', '🌺'), pw('sweets', '🍬'), pw('lamp', '🪔'), pw('flowers', '🌼'), pw('new clothes', '👗'), pw('sky', '🌤️')],
      prompts: ['What are the children flying?', 'What festival do you like?', 'What sweets do you eat at festivals?', 'Who do you visit at festival time?'],
    },
    story: {
      title: 'Bathukamma Flowers',
      lines: [
        'It is Bathukamma time.',
        'Lakshmi and Amma pick yellow flowers.',
        'They make a tall stack of flowers.',
        'Women and girls sing and clap in a circle.',
        'Lakshmi dances and laughs.',
        'Festivals make us happy.',
      ],
      questions: [
        lq('What do they pick?', [pw('flowers', '🌼'), pw('stones', '🪨'), pw('books', '📚')], 0),
        lq('What do they do in a circle?', [pw('sing and clap', '👏'), pw('sleep', '😴'), pw('cook', '🍳')], 0),
        lq('How do festivals make us feel?', [pw('happy', '😀'), pw('sad', '😢'), pw('angry', '😠')], 0),
      ],
    },
    rhyme: {
      title: 'Fly, Kite, Fly',
      lines: ['Fly, kite, fly, up in the sky,', 'Red and yellow, way up high,', 'Pull the string and let it go,', 'Dance in the wind, to and fro!'],
      action: 'Pretend to pull a kite string and look up.',
    },
    letters: [
      { letter: 'x', sound: 'ks — at the end of fox and box', words: [pw('fox', '🦊'), pw('box', '📦'), pw('six', '6️⃣')], position: 'end' },
      { letter: 'z', sound: 'zzz — like a buzzing bee', words: [pw('zebra', '🦓'), pw('zero', '0️⃣'), pw('zip', '🤐')] },
      { letter: 'q', sound: 'kw — q is with u: qu', words: [pw('queen', '👸'), pw('question', '❓'), pw('quiet', '🤫')] },
    ],
    sightWords: ['like', 'run', 'said'],
    readAloud: ['I like the kite.', 'The kite is up.', 'Run, run, run!', 'Amma said, "Happy Sankranti!"'],
    quiz: [
      q('What do Lakshmi and Amma pick?', ['Flowers', 'Fruits', 'Stones'], 0, 'They pick yellow flowers.'),
      q('Which word starts with z?', ['zebra', 'fox', 'queen'], 0, 'Zebra starts with zzz.'),
      q('Which letter do we hear at the end of "box"?', ['b', 'x', 'o'], 1, 'Box ends with x.'),
    ],
    outcomes: [
      'talks about festivals in short sentences',
      'recites a rhyme with expression and actions',
      'says the sounds x (at the end), z, q',
      'reads the words like, run, said',
      'knows all 26 letter sounds',
    ],
    classActivity: 'Festival corner: children bring or draw one thing from a festival and say one sentence about it.',
    draw: { prompt: 'Draw a kite in the sky.', starter: 'I like the' },
  },
];

/* ------------------------------ Look-ups ------------------------------ */

export function englishUnitById(id: string): EnglishUnit | undefined {
  return CLASS1_ENGLISH_UNITS.find((u) => u.id === id);
}

/** Every letter in teaching order. */
export function lettersInOrder(): LetterLesson[] {
  return CLASS1_ENGLISH_UNITS.flatMap((u) => u.letters);
}

/** Sight words up to and including this unit (cumulative revision). */
export function sightWordsUpTo(unitNumber: number): string[] {
  return CLASS1_ENGLISH_UNITS.filter((u) => u.number <= unitNumber).flatMap((u) => u.sightWords);
}

/* --------------------------- Lesson steps --------------------------- */

// One lesson = the steps of a Tholimettu English period, in that order.
export type LessonStepId = 'talk' | 'listen' | 'rhyme' | 'sounds' | 'trace' | 'words' | 'read';

export const LESSON_STEPS: { id: LessonStepId; label: string; emoji: string; tholimettu: string }[] = [
  { id: 'talk', label: 'Picture talk', emoji: '🖼️', tholimettu: 'Facesheet based activities' },
  { id: 'listen', label: 'Listen', emoji: '👂', tholimettu: 'Listening text and related activities' },
  { id: 'rhyme', label: 'Rhyme', emoji: '🎵', tholimettu: 'Listening and speaking: rhyme with actions' },
  { id: 'sounds', label: 'Sounds', emoji: '🔤', tholimettu: 'Reading readiness: letter sounds' },
  { id: 'trace', label: 'Write', emoji: '✍️', tholimettu: 'Writing: letter formation' },
  { id: 'words', label: 'Words', emoji: '🧩', tholimettu: 'Reading: sight words and post-reading' },
  { id: 'read', label: 'Read', emoji: '🎤', tholimettu: 'Model, collaborative and individual reading' },
];

/* --------------------------- Practice rounds --------------------------- */

export interface ChoiceRound<T> {
  prompt: string;
  /** What to say aloud to the child. */
  say: string;
  options: T[];
  answer: number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * "Which picture starts with /s/?" — one round per word of each of the
 * unit's letters; wrong pictures come from other letters' words (never one
 * that starts or ends with the same letter).
 */
export function beginningSoundRounds(unit: EnglishUnit, random: () => number = Math.random): ChoiceRound<PictureWord>[] {
  const others = lettersInOrder().filter((l) => !unit.letters.includes(l));
  return unit.letters.flatMap((lesson) => {
    const has = (w: PictureWord) => (lesson.position === 'end' ? w.word.endsWith(lesson.letter) : w.word.startsWith(lesson.letter));
    const pool = others.flatMap((l) => l.words).filter((w) => !has(w) && !w.word.includes(lesson.letter));
    return lesson.words.slice(0, 2).map((right) => {
      const wrong = shuffled(pool, random).slice(0, 2);
      const options = shuffled([right, ...wrong], random);
      const where = lesson.position === 'end' ? 'ends with' : 'starts with';
      return {
        prompt: `Which picture ${where} “${lesson.letter}”?`,
        say: `Which picture ${where} ${lesson.sound.split(' — ')[0]}?`,
        options,
        answer: options.indexOf(right),
      };
    });
  });
}

/** "Tap the word you hear": each sight word against two others from the course. */
export function sightWordRounds(unit: EnglishUnit, random: () => number = Math.random): ChoiceRound<string>[] {
  const all = sightWordsUpTo(CLASS1_ENGLISH_UNITS.length);
  return unit.sightWords.map((word) => {
    const wrong = shuffled(
      all.filter((w) => w.toLowerCase() !== word.toLowerCase()),
      random
    ).slice(0, 2);
    const options = shuffled([word, ...wrong], random);
    return { prompt: 'Tap the word you hear', say: word, options, answer: options.indexOf(word) };
  });
}

export interface MissingLetterRound {
  word: PictureWord;
  /** The word with its first letter (or last, for 'end' letters) hidden: "_un". */
  masked: string;
  options: string[];
  answer: number;
}

/** "Fill the missing letter": picture + word with the unit's letter hidden. */
export function missingLetterRounds(unit: EnglishUnit, random: () => number = Math.random): MissingLetterRound[] {
  const allLetters = lettersInOrder().map((l) => l.letter);
  return unit.letters.map((lesson) => {
    const word = lesson.words[0];
    const atEnd = lesson.position === 'end';
    const masked = atEnd ? `${word.word.slice(0, -1)}_` : `_${word.word.slice(1)}`;
    const wrong = shuffled(
      allLetters.filter((l) => l !== lesson.letter),
      random
    ).slice(0, 2);
    const options = shuffled([lesson.letter, ...wrong], random);
    return { word, masked, options, answer: options.indexOf(lesson.letter) };
  });
}

/* ------------------------------ Teacher ------------------------------ */

export interface PlannedPeriod {
  period: number;
  focus: string;
  steps: { step: string; minutes: number; what: string }[];
}

/**
 * A 10-period unit plan for the teacher, each period following the steps of
 * a Tholimettu English period (face sheet → listening → reading → post-reading
 * → writing/editing). Periods are 40 minutes.
 */
export function periodPlanFor(unit: EnglishUnit): PlannedPeriod[] {
  const [l1, l2, l3, l4] = unit.letters;
  const letterPeriod = (n: number, lesson: LetterLesson | undefined, focus: string): PlannedPeriod | null =>
    lesson
      ? {
          period: n,
          focus,
          steps: [
            { step: 'Warm-up', minutes: 5, what: `Sing "${unit.rhyme.title}" with actions.` },
            { step: 'Sound', minutes: 10, what: `Say the sound of "${lesson.letter}": ${lesson.sound}. Children repeat; show ${lesson.words.map((w) => `${w.word} ${w.emoji}`).join(', ')}.` },
            { step: 'Listen and point', minutes: 8, what: `Say words; children clap when they hear ${lesson.position === 'end' ? 'it at the end' : 'it at the start'}.` },
            { step: 'Write', minutes: 12, what: `Model ${lesson.letter.toUpperCase()} ${lesson.letter} on the board in the air, then on slates/notebooks (5 times each).` },
            { step: 'Check', minutes: 5, what: 'Each child says one word with the sound. Note children who need help.' },
          ],
        }
      : null;
  const periods: (PlannedPeriod | null)[] = [
    {
      period: 1,
      focus: 'Face sheet: picture talk',
      steps: [
        { step: 'Warm-up', minutes: 5, what: 'Greetings; a familiar rhyme.' },
        { step: 'Picture interaction', minutes: 15, what: `Show "${unit.pictureTalk.scene}". Ask: ${unit.pictureTalk.prompts.join(' ')}` },
        { step: 'New words', minutes: 10, what: `Point and say: ${unit.pictureTalk.items.map((i) => i.word).join(', ')}. Children repeat and point.` },
        { step: 'Talk', minutes: 10, what: 'Children say one sentence each about the picture, in any language first, then in English with help.' },
      ],
    },
    {
      period: 2,
      focus: 'Listening text',
      steps: [
        { step: 'Pre-listening', minutes: 5, what: `Ask what they think "${unit.story.title}" is about.` },
        { step: 'Listening', minutes: 15, what: 'Read the story aloud twice with expression and gestures (or play it in the app).' },
        { step: 'Related activities', minutes: 15, what: `Ask: ${unit.story.questions.map((x) => x.question).join(' ')} Children answer by pointing to pictures.` },
        { step: 'Retell', minutes: 5, what: 'Children retell one line each.' },
      ],
    },
    {
      period: 3,
      focus: 'Rhyme',
      steps: [
        { step: 'Model', minutes: 10, what: `Sing "${unit.rhyme.title}" twice. ${unit.rhyme.action}` },
        { step: 'Echo', minutes: 15, what: 'Line by line: teacher sings, children echo; then groups take lines.' },
        { step: 'Perform', minutes: 15, what: 'Groups perform with actions; others clap the beat.' },
      ],
    },
    letterPeriod(4, l1, `Letter sound ${l1?.letter ?? ''}`),
    letterPeriod(5, l2, `Letter sound ${l2?.letter ?? ''}`),
    letterPeriod(6, l3, `Letter sound ${l3?.letter ?? ''}`),
    l4 ? letterPeriod(7, l4, `Letter sound ${l4.letter}`) : null,
    {
      period: 0,
      focus: 'Sight words',
      steps: [
        { step: 'Show', minutes: 10, what: `Word cards: ${unit.sightWords.join(', ')}. Say, children repeat, put in a sentence.` },
        { step: 'Find', minutes: 15, what: 'Hide cards in the room; children find and read them.' },
        { step: 'Use', minutes: 15, what: `Make sentences on the board with the words, e.g. "${unit.readAloud[0]}"` },
      ],
    },
    {
      period: 0,
      focus: 'Reading',
      steps: [
        { step: 'Model reading', minutes: 8, what: 'Teacher reads the reading lines pointing to each word.' },
        { step: 'Collaborative reading', minutes: 10, what: 'Class reads together, then in groups.' },
        { step: 'Individual reading', minutes: 15, what: 'Children read alone to the teacher or in the app (microphone). Note words they find hard.' },
        { step: 'Post-reading', minutes: 7, what: unit.quiz.map((x) => x.question).join(' ') },
      ],
    },
    {
      period: 0,
      focus: 'Review and assessment',
      steps: [
        { step: 'Class activity', minutes: 15, what: unit.classActivity },
        { step: 'Worksheet', minutes: 15, what: 'Print the unit worksheet: trace, beginning sounds, missing letter, match, sight words.' },
        { step: 'Check outcomes', minutes: 10, what: `Tick each child against: ${unit.outcomes.join('; ')}.` },
      ],
    },
  ];
  return periods.filter((p): p is PlannedPeriod => p !== null).map((p, i) => ({ ...p, period: i + 1 }));
}

/* ------------------------------ Progress ------------------------------ */

export interface UnitProgress {
  steps: Partial<Record<LessonStepId, boolean>>;
  /** Best score per practice game, e.g. { sounds: [5, 6] }. */
  scores: Partial<Record<LessonStepId, [number, number]>>;
}

export function unitStepsDone(p: UnitProgress | undefined): number {
  return p ? LESSON_STEPS.filter((s) => p.steps[s.id]).length : 0;
}

/** The first step not done yet (the place to continue), or 'talk' when all are done. */
export function nextStep(p: UnitProgress | undefined): LessonStepId {
  return LESSON_STEPS.find((s) => !p?.steps[s.id])?.id ?? 'talk';
}

/** A unit opens when the one before it has at least 4 of its 7 steps done. */
export function unitUnlocked(unitNumber: number, all: Record<string, UnitProgress>): boolean {
  if (unitNumber <= 1) return true;
  const before = CLASS1_ENGLISH_UNITS.find((u) => u.number === unitNumber - 1);
  return !!before && unitStepsDone(all[before.id]) >= 4;
}
