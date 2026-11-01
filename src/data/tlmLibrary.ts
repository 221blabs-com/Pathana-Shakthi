// The TLM library: low-cost Teaching-Learning Materials a primary teacher can
// make and use, each from a learning point of view — what the child learns,
// which competency it builds (src/data/competencies.ts), how to make it from
// what a government school has, how to use it in a period, how to adapt it
// for each reading level, and what to look for. Pictures are drawn by
// TlmPicture.tsx from `picture`. These are common FLN classroom practices,
// not quotations from an SCERT handbook (which could not be read; see
// curriculum-research/). Shared by the browser and the teacher's agent.

export type TlmArea = 'Literacy' | 'Numeracy' | 'EVS';

export type TlmPictureKind =
  | 'cards'
  | 'wheel'
  | 'wall'
  | 'strips'
  | 'chart'
  | 'sequence'
  | 'puppet'
  | 'grid'
  | 'dice'
  | 'bundles'
  | 'numberline'
  | 'tenframe'
  | 'abacus'
  | 'pocket'
  | 'clock'
  | 'money'
  | 'fraction'
  | 'shapes'
  | 'balance'
  | 'pictograph'
  | 'jar'
  | 'calendar';

/** A printable the app already makes (TlmPanel / src/services/tlm.ts). */
export type TlmPrintable = 'word_cards' | 'reading_cards' | 'question_cards' | 'number_cards' | 'hundred_chart' | 'fact_cards' | 'clock' | 'alphabet' | 'practice_sheet';

export interface TlmItem {
  id: string;
  name: string;
  area: TlmArea;
  picture: TlmPictureKind;
  grades: [number, number];
  /** Competency ids (src/data/competencies.ts) it builds. */
  competencies: string[];
  /** What the child learns, in one or two sentences. */
  learning: string;
  materials: string[];
  make: string[];
  use: string[];
  levels: { beginner: string; developing: string; proficient: string };
  /** What to look for while children use it. */
  check: string;
  printable?: TlmPrintable;
  /** Words that match a chapter or a teacher's question. */
  keywords: string[];
}

export const TLM_LIBRARY: TlmItem[] = [
  /* ------------------------------ literacy ------------------------------ */
  {
    id: 'picture-word-cards',
    name: 'Picture–word cards',
    area: 'Literacy',
    picture: 'cards',
    grades: [1, 3],
    competencies: ['lit-vocab', 'lit-decoding'],
    learning: 'Children link a spoken word, its picture and its written form, and start reading whole words they meet in the chapter.',
    materials: ['Old calendars or chart paper cut into cards', 'Sketch pens', 'A small box to keep them'],
    make: ['Pick 10–15 key words from the chapter (the app\'s word cards list them).', 'Draw or paste a picture on one side, write the word large on the other.', 'Make a second set with words only, for matching.'],
    use: ['Show the picture, children say the word; turn the card, they read it.', 'Matching: spread word-only cards, a child picks the one for your picture.', 'Pairs: one child shows a picture, the partner finds and reads the word card.'],
    levels: {
      beginner: 'Picture side first; say the word together and point to its first letter.',
      developing: 'Word side first; the child reads, then checks with the picture.',
      proficient: 'Use the word in a sentence about the chapter.',
    },
    check: 'Can the child read the word without seeing the picture? Note words they still guess from the first letter only.',
    printable: 'word_cards',
    keywords: ['vocabulary', 'words', 'picture', 'reading', 'flash cards', 'word'],
  },
  {
    id: 'letter-wheel',
    name: 'Letter–sound wheel (akshara chakram)',
    area: 'Literacy',
    picture: 'wheel',
    grades: [1, 2],
    competencies: ['lit-phonics', 'lit-decoding'],
    learning: 'Children blend a consonant with each vowel sign (క, కా, కి… / क, का, कि… / ba, be, bi…) and hear how one sound changes into many syllables.',
    materials: ['Two cardboard circles (one smaller)', 'A split pin or a matchstick', 'Marker'],
    make: ['On the big circle write vowel signs or endings around the edge.', 'On the small circle cut a window and write one consonant beside it.', 'Pin the circles together so the window shows one sign at a time.'],
    use: ['Turn the wheel; children read the syllable aloud together.', 'Ask: "Which turn makes ki?" A child turns to it.', 'Make words: read two syllables from two wheels together.'],
    levels: {
      beginner: 'One consonant, three vowel signs; say the sound with them.',
      developing: 'All vowel signs; children read alone.',
      proficient: 'Two wheels side by side to build and read real words from the chapter.',
    },
    check: 'Does the child read the syllable at once, or say letter names first? Note which vowel signs are confused.',
    printable: 'alphabet',
    keywords: ['phonics', 'letters', 'syllables', 'vowel signs', 'gunintham', 'matra', 'sounds', 'akshara'],
  },
  {
    id: 'word-wall',
    name: 'Word wall',
    area: 'Literacy',
    picture: 'wall',
    grades: [1, 5],
    competencies: ['lit-vocab', 'lit-decoding'],
    learning: 'Words the class learns stay in sight, so children read and use them every day and see them grouped by sound or meaning.',
    materials: ['A wall or a long chart paper', 'Cards or paper strips', 'Thread and clips (optional)'],
    make: ['Write each new chapter word on a strip in large letters.', 'Group them under a letter, a sound or a topic (animals, food, actions).', 'Add a small picture for Class 1–2 words.'],
    use: ['Start the period by reading the wall together.', 'Games: "I spy a word that starts with ప", "Find a naming word".', 'Children use wall words when they write.'],
    levels: {
      beginner: 'Read with you, pointing to each word.',
      developing: 'Find and read a word you name.',
      proficient: 'Sort words into new groups and write a sentence with three of them.',
    },
    check: 'Which wall words children read fast, and which they still skip in the reading check (the FLN view lists missed words).',
    printable: 'word_cards',
    keywords: ['vocabulary', 'sight words', 'words', 'naming words', 'spelling'],
  },
  {
    id: 'sentence-strips',
    name: 'Sentence strips',
    area: 'Literacy',
    picture: 'strips',
    grades: [1, 4],
    competencies: ['lit-decoding', 'lit-orf', 'lit-comprehension'],
    learning: 'Children read whole sentences from the chapter, see that words have an order, and build their own sentences.',
    materials: ['Chart paper cut into long strips', 'Marker', 'Scissors'],
    make: ['Write 5–6 short sentences from the chapter, one per strip.', 'Cut one copy of each into word pieces.'],
    use: ['Read a strip together, then children read it alone.', 'Jumbled words: a group puts the pieces back in order and reads it.', 'Change one word (crow → parrot) and read the new sentence.'],
    levels: {
      beginner: 'Three-word sentences; you read, they echo.',
      developing: 'Order the cut words and read the sentence.',
      proficient: 'Write a new sentence with the same pattern.',
    },
    check: 'Does the child read word by word or in phrases? This is the same skill as "Read the sentences" in the FLN check.',
    printable: 'reading_cards',
    keywords: ['sentences', 'reading', 'word order', 'fluency', 'grammar'],
  },
  {
    id: 'picture-chart',
    name: 'Big picture chart (picture talk / face sheet)',
    area: 'Literacy',
    picture: 'chart',
    grades: [1, 5],
    competencies: ['lit-vocab', 'lit-comprehension'],
    learning: 'Before reading, children talk about a big picture: they name things, say what is happening and guess the story — oral language first, as the SCERT period steps begin.',
    materials: ['The chapter\'s opening picture drawn large on chart paper (or projected)', 'Sketch pens'],
    make: ['Copy the chapter picture large, or use the textbook\'s face sheet.', 'Leave space around it to write words children say.'],
    use: ['Ask: What do you see? Where is this? What is happening? What will happen next?', 'Write children\'s words around the picture and read them together.', 'After reading, come back: was our guess right?'],
    levels: {
      beginner: 'Point and name things, in any language.',
      developing: 'Say a sentence about the picture.',
      proficient: 'Tell a short story about the picture.',
    },
    check: 'Who speaks and who stays silent; note new words children use. The writing part of the FLN check uses the same kind of picture.',
    keywords: ['picture', 'oral', 'speaking', 'face sheet', 'picture talk', 'describe'],
  },
  {
    id: 'story-sequence-cards',
    name: 'Story sequence cards',
    area: 'Literacy',
    picture: 'sequence',
    grades: [2, 5],
    competencies: ['lit-comprehension', 'lit-reflection'],
    learning: 'Children put the events of a story in order and retell it — the base of comprehension and of the open questions in the FLN check.',
    materials: ['4–6 cards per story', 'Pictures drawn or cut from old books'],
    make: ['Pick 4–6 events of the chapter.', 'Draw one event per card; write a short caption on the back.'],
    use: ['Mix the cards; a group puts them in order and retells the story.', 'Remove one card: what is missing?', 'Ask "why" between two cards (why did the water come up?).'],
    levels: {
      beginner: 'Three cards; first, then, last.',
      developing: 'Five cards and retell with "then", "after that".',
      proficient: 'Add a new ending card and explain it.',
    },
    check: 'Can the child say why one event follows another (indirect questions), not only what happened?',
    keywords: ['story', 'sequence', 'comprehension', 'retell', 'order', 'events'],
  },
  {
    id: 'puppets',
    name: 'Stick and finger puppets',
    area: 'Literacy',
    picture: 'puppet',
    grades: [1, 3],
    competencies: ['lit-comprehension', 'lit-vocab'],
    learning: 'Shy children speak through a puppet: they act out dialogues from the chapter and practise speaking in sentences.',
    materials: ['Old socks or paper', 'Ice-cream sticks', 'Glue, colours'],
    make: ['Draw the chapter\'s characters on stiff paper and cut them out.', 'Stick each on an ice-cream stick.'],
    use: ['Children act the chapter\'s dialogue with the puppets.', 'Hot seat: a puppet answers questions as the character.', 'Make up a new conversation between two characters.'],
    levels: {
      beginner: 'Repeat a line after you with the puppet.',
      developing: 'Say the character\'s lines from memory.',
      proficient: 'Invent new lines that fit the character.',
    },
    check: 'Does the child speak in full sentences? Note children who speak more with the puppet than without.',
    keywords: ['speaking', 'dialogue', 'drama', 'role play', 'story', 'characters'],
  },
  {
    id: 'vowel-sign-chart',
    name: 'Vowel-sign chart (gunintham / barakhadi)',
    area: 'Literacy',
    picture: 'grid',
    grades: [1, 3],
    competencies: ['lit-phonics', 'lit-decoding'],
    learning: 'Every consonant with every vowel sign in one grid, so children see the pattern and read any syllable.',
    materials: ['Chart paper', 'Ruler', 'Two colours of pen'],
    make: ['Draw a grid: consonants down the side, vowel signs across the top.', 'Fill each box; write the vowel sign in a second colour.'],
    use: ['Read a row together (క కా కి కీ…).', 'Point to a box at random; children read it.', 'Find the syllables of a chapter word in the chart.'],
    levels: {
      beginner: 'One row a day, read together.',
      developing: 'Read any box you point to.',
      proficient: 'Write a word from three boxes and read it.',
    },
    check: 'Which vowel signs are mixed up (long and short, ి / ీ, ि / ी)?',
    printable: 'alphabet',
    keywords: ['gunintham', 'barakhadi', 'vowel signs', 'matra', 'telugu', 'hindi', 'phonics'],
  },
  {
    id: 'question-dice',
    name: 'Question dice',
    area: 'Literacy',
    picture: 'dice',
    grades: [2, 5],
    competencies: ['lit-comprehension', 'lit-reflection'],
    learning: 'Children ask and answer who / what / where / when / why / how questions about what they read — direct and indirect comprehension.',
    materials: ['A cardboard cube (an old box)', 'Paper', 'Glue'],
    make: ['Write Who? What? Where? When? Why? How? on the six faces.'],
    use: ['After reading, a child throws the dice and asks a question of that kind about the passage.', 'Another child answers; the class says if the answer is "in the text" or "in my head".'],
    levels: {
      beginner: 'Who and What only; answers are in the text.',
      developing: 'Where, When; find the line in the text.',
      proficient: 'Why and How; answer from thinking, not copying.',
    },
    check: 'Can the child tell a question answered in the text (direct) from one that needs thinking (indirect)?',
    printable: 'question_cards',
    keywords: ['questions', 'comprehension', 'why', 'how', 'thinking', 'inference'],
  },

  /* ------------------------------ numeracy ------------------------------ */
  {
    id: 'bundles-sticks',
    name: 'Bundles and sticks',
    area: 'Numeracy',
    picture: 'bundles',
    grades: [1, 3],
    competencies: ['num-number-sense', 'num-operations'],
    learning: 'Ten loose sticks become one bundle: children see tens and ones, and why 23 is two bundles and three sticks.',
    materials: ['100+ ice-cream sticks, broomsticks or straws', 'Rubber bands'],
    make: ['Count out sticks in tens and tie each ten with a rubber band.', 'Keep loose sticks in a box.'],
    use: ['Show a number with bundles and sticks; children say and write it.', 'Add: put two collections together; when 10 loose sticks gather, tie a new bundle (carrying).', 'Subtract by untying a bundle (borrowing).'],
    levels: {
      beginner: 'Count loose sticks to 20 and make one bundle.',
      developing: 'Show 2-digit numbers; add without carrying.',
      proficient: 'Add and subtract with carrying and borrowing, then do it on paper.',
    },
    check: 'Does the child count a bundle as 10 at once, or untie and count by ones?',
    printable: 'number_cards',
    keywords: ['place value', 'tens', 'ones', 'counting', 'addition', 'subtraction', 'carrying'],
  },
  {
    id: 'number-line',
    name: 'Floor number line',
    area: 'Numeracy',
    picture: 'numberline',
    grades: [1, 3],
    competencies: ['num-number-sense', 'num-operations'],
    learning: 'Children walk on numbers: adding is jumping forward, taking away is jumping back, and bigger numbers are further along.',
    materials: ['Chalk on the floor, or a long cloth strip', 'Number cards 0–20 (or 0–100)'],
    make: ['Draw a straight line with equal steps; write 0–20 under the marks.'],
    use: ['A child stands on 5, jumps 3 forward: where are you?', 'Which is bigger, 12 or 9? Stand on both.', 'Skip-count by 2 or 5 with jumps.'],
    levels: {
      beginner: '0–10, forward jumps only.',
      developing: '0–20, forward and back.',
      proficient: 'Missing jumps: from 7 to 15, how many?',
    },
    check: 'Does the child count the starting number as a jump (a common mistake)?',
    printable: 'number_cards',
    keywords: ['number line', 'addition', 'subtraction', 'counting', 'compare', 'skip counting'],
  },
  {
    id: 'ten-frame',
    name: 'Ten frame',
    area: 'Numeracy',
    picture: 'tenframe',
    grades: [1, 2],
    competencies: ['num-number-sense'],
    learning: 'Children see a number at a glance (7 = 5 and 2 more, 3 short of 10), the base for adding within 20.',
    materials: ['Card with a 2 × 5 grid drawn on it', 'Seeds, bottle caps or stones as counters'],
    make: ['Draw a 2 × 5 grid on a card, boxes big enough for a bottle cap.', 'One card per pair; two cards for numbers to 20.'],
    use: ['Flash a filled frame for 2 seconds: how many?', 'Show 8: how many more to make 10?', 'Two frames for 9 + 4: fill the first frame, how many left?'],
    levels: {
      beginner: 'Fill and count to 5, then 10.',
      developing: 'Say the number without counting one by one.',
      proficient: 'Make-ten strategy for additions to 20.',
    },
    check: 'Does the child see "5 and 2" or count every counter?',
    keywords: ['counting', 'number sense', 'ten', 'addition', 'subitising'],
  },
  {
    id: 'abacus',
    name: 'Bead string / abacus',
    area: 'Numeracy',
    picture: 'abacus',
    grades: [1, 3],
    competencies: ['num-number-sense', 'num-operations'],
    learning: 'Beads in two colours of five make counting, adding and place value visible and quick.',
    materials: ['A string with 20 beads (10 of each colour) or a frame with wires', 'Old bangles work too'],
    make: ['Thread 5 beads of one colour, 5 of another, repeat.', 'For an abacus: rods for ones, tens, hundreds.'],
    use: ['Slide beads to show a number; children say it.', 'Add by sliding more beads; take away by sliding back.', 'Place value on the abacus: 10 beads on ones become 1 on tens.'],
    levels: {
      beginner: 'Count to 10 with one string.',
      developing: 'Numbers to 20, quick showing.',
      proficient: 'Three-digit numbers on the abacus, with carrying.',
    },
    check: 'Can the child show a number in one move, using the colour groups?',
    keywords: ['abacus', 'beads', 'counting', 'place value', 'addition'],
  },
  {
    id: 'place-value-pocket',
    name: 'Place value pocket chart',
    area: 'Numeracy',
    picture: 'pocket',
    grades: [2, 4],
    competencies: ['num-number-sense', 'num-operations'],
    learning: 'Pockets for hundreds, tens and ones show what each digit is worth and what happens when we regroup.',
    materials: ['Chart paper folded into pockets', 'Strips of card (or sticks)', 'Number cards'],
    make: ['Fold and staple three pockets: H, T, O.', 'Use strips or sticks as counters.'],
    use: ['Show 345 with strips; children write the number.', 'Add 8 to 37: regroup ten ones into one ten pocket.', 'Read the expanded form: 300 + 40 + 5.'],
    levels: {
      beginner: 'Tens and ones only.',
      developing: 'Three digits; read and write.',
      proficient: 'Regroup while adding and subtracting.',
    },
    check: 'Does the child know the 4 in 345 means 40?',
    keywords: ['place value', 'hundreds', 'tens', 'ones', 'expanded form', 'regroup'],
  },
  {
    id: 'clock',
    name: 'Clock with moving hands',
    area: 'Numeracy',
    picture: 'clock',
    grades: [2, 4],
    competencies: ['num-measurement'],
    learning: 'Children read and show time, and connect it to their day (school starts, lunch, going home).',
    materials: ['Paper plate or cardboard circle', 'Two card hands', 'Split pin'],
    make: ['Write 1–12 around the plate; mark minutes for older classes.', 'Fix two hands of different lengths with a pin.'],
    use: ['Show a time; children say it. Say a time; a child shows it.', 'Our day: set the clock to each school event.', 'How long from 9 o\'clock to 11 o\'clock?'],
    levels: {
      beginner: 'O\'clock times.',
      developing: 'Half past and quarter past.',
      proficient: 'Minutes and time taken.',
    },
    check: 'Does the child mix up the hour and minute hands?',
    printable: 'clock',
    keywords: ['time', 'clock', 'hours', 'minutes', 'measurement'],
  },
  {
    id: 'play-money',
    name: 'Play money and class shop',
    area: 'Numeracy',
    picture: 'money',
    grades: [2, 5],
    competencies: ['num-operations', 'num-measurement'],
    learning: 'Buying and selling makes adding, taking away and giving change real.',
    materials: ['Paper notes and coins (drawn)', 'Empty packets and bottles with price tags'],
    make: ['Draw ₹1, ₹2, ₹5, ₹10, ₹20, ₹50 notes and coins.', 'Put price tags on empty packets.'],
    use: ['One child is the shopkeeper; others buy two things and pay.', 'The shopkeeper gives change and both check it.', 'Write the bill.'],
    levels: {
      beginner: 'Prices up to ₹10, pay exactly.',
      developing: 'Two things, add the prices.',
      proficient: 'Pay with a bigger note and give change.',
    },
    check: 'Can the child give change by counting on, not only by subtracting on paper?',
    keywords: ['money', 'rupees', 'shop', 'change', 'addition', 'subtraction', 'bill'],
  },
  {
    id: 'fraction-kit',
    name: 'Fraction circles and strips',
    area: 'Numeracy',
    picture: 'fraction',
    grades: [3, 5],
    competencies: ['num-fractions'],
    learning: 'Children fold and cut wholes into equal parts, so ½, ¼ and ¾ are things they hold before they are symbols.',
    materials: ['Paper circles and strips of the same size', 'Colours', 'Scissors'],
    make: ['Leave one strip whole; fold others into 2, 4 and 8 equal parts and cut.', 'Colour each family the same.'],
    use: ['How many quarters make a half? Lay them on top.', 'Show ¾ of a roti drawing.', 'Which is bigger, ⅓ or ¼? Compare the pieces.'],
    levels: {
      beginner: 'Halves and quarters by folding.',
      developing: 'Name and compare fractions.',
      proficient: 'Equal fractions (2/4 = 1/2) and adding like fractions.',
    },
    check: 'Does the child think ¼ is bigger than ½ because 4 is bigger than 2?',
    keywords: ['fractions', 'half', 'quarter', 'parts', 'equal parts'],
  },
  {
    id: 'shapes-kit',
    name: 'Shapes kit and tangram',
    area: 'Numeracy',
    picture: 'shapes',
    grades: [1, 5],
    competencies: ['num-shapes'],
    learning: 'Children name, sort and build with shapes, and find them in the classroom and at home.',
    materials: ['Card shapes in different sizes and colours', 'A square card cut into 7 tangram pieces', 'Boxes, balls, cones from home'],
    make: ['Cut circles, squares, triangles and rectangles of different sizes.', 'Cut one square into tangram pieces.'],
    use: ['Sort by shape, not colour or size.', 'Shape hunt: find three rectangles in the room.', 'Build a house or a bird with tangram pieces.'],
    levels: {
      beginner: 'Name four flat shapes.',
      developing: 'Count sides and corners.',
      proficient: 'Make one shape from others; solid shapes and their faces.',
    },
    check: 'Does the child still call a turned square a "diamond" and not a square?',
    keywords: ['shapes', 'geometry', 'triangle', 'square', 'circle', 'tangram', 'solid'],
  },
  {
    id: 'hanger-balance',
    name: 'Hanger balance and measuring strip',
    area: 'Numeracy',
    picture: 'balance',
    grades: [2, 5],
    competencies: ['num-measurement'],
    learning: 'Comparing heavier/lighter and longer/shorter with simple tools before using kilograms and centimetres.',
    materials: ['A clothes hanger, two cups and string', 'A paper strip marked in centimetres', 'Things to weigh: stones, pencils, fruit'],
    make: ['Hang a cup from each end of the hanger.', 'Mark a strip every centimetre with a ruler.'],
    use: ['Which is heavier, the mango or the stone? Predict, then check.', 'Measure the desk with hand spans, then with the strip.', 'Record the results in a table.'],
    levels: {
      beginner: 'Compare two things: heavier / lighter.',
      developing: 'Measure with spans and sticks (non-standard units).',
      proficient: 'Centimetres and grams; estimate first.',
    },
    check: 'Does the child start measuring at 0 on the strip?',
    keywords: ['measurement', 'weight', 'length', 'heavy', 'light', 'centimetre'],
  },
  {
    id: 'pictograph',
    name: 'Class pictograph chart',
    area: 'Numeracy',
    picture: 'pictograph',
    grades: [3, 5],
    competencies: ['num-operations', 'sub-maths'],
    learning: 'Children collect real data from the class, show it with pictures and read it: how many, more, fewer.',
    materials: ['Chart paper', 'Small picture cards or stickers'],
    make: ['Draw rows for choices (favourite fruit, how we come to school).', 'Each child sticks one picture in their row.'],
    use: ['Which row has the most? How many more walk than cycle?', 'One picture = 2 children: redraw and read again.'],
    levels: {
      beginner: 'Count pictures in each row.',
      developing: 'Compare rows: more and fewer.',
      proficient: 'A key (one picture = 2 or 5) and a bar chart.',
    },
    check: 'Can the child answer a question that needs two rows (how many more)?',
    keywords: ['data', 'pictograph', 'graph', 'chart', 'survey', 'statistics'],
  },

  /* ------------------------------ EVS ------------------------------ */
  {
    id: 'germination-jar',
    name: 'Seed germination jar',
    area: 'EVS',
    picture: 'jar',
    grades: [3, 5],
    competencies: ['evs', 'sub-science'],
    learning: 'Children watch a seed become a plant, record changes day by day and learn what a plant needs.',
    materials: ['A clear bottle or jar', 'Wet cotton or tissue', 'Seeds (green gram, beans)'],
    make: ['Line the jar with wet cotton.', 'Place seeds between the cotton and the glass so they can be seen.'],
    use: ['Each day children draw what they see and measure the shoot.', 'Keep one jar in the dark and one dry: what changes?', 'Talk: what does a seed need to grow?'],
    levels: {
      beginner: 'Draw the seed each day.',
      developing: 'Name the parts: root, shoot, leaves.',
      proficient: 'Plan a fair test and explain the result.',
    },
    check: 'Does the child say what the plant needed, from what they saw?',
    keywords: ['plants', 'seeds', 'germination', 'science', 'evs', 'growth', 'water'],
  },
  {
    id: 'weather-calendar',
    name: 'Weather and calendar chart',
    area: 'EVS',
    picture: 'calendar',
    grades: [1, 5],
    competencies: ['evs', 'num-measurement'],
    learning: 'A daily routine: days, months and the weather, and noticing patterns over a month.',
    materials: ['Chart with a month grid', 'Weather picture cards (sun, cloud, rain, wind)'],
    make: ['Draw a month grid; prepare small weather cards.'],
    use: ['Every morning a child puts today\'s weather card on the date.', 'At month end: how many rainy days? Which was more?', 'Say the date, the day before and the day after.'],
    levels: {
      beginner: 'Name the day and the weather.',
      developing: 'Count weather days in the month.',
      proficient: 'Compare two months and explain.',
    },
    check: 'Can the child say yesterday\'s and tomorrow\'s day without counting from Monday?',
    keywords: ['weather', 'calendar', 'days', 'months', 'seasons', 'evs'],
  },
];

const gradeNum = (grade: string) => Number(String(grade || '').replace(/\D+/g, '')) || 1;

const AREA_OF_SUBJECT: Record<string, TlmArea[]> = {
  English: ['Literacy'],
  Telugu: ['Literacy'],
  Hindi: ['Literacy'],
  Maths: ['Numeracy'],
  Science: ['EVS'],
  Social: ['EVS'],
};

/** TLMs for a class, optionally one subject, a competency or a few words (a chapter title, a teacher's question). */
export function tlmsFor(opts: { grade?: string; subject?: string; competency?: string; query?: string }): TlmItem[] {
  const n = opts.grade ? gradeNum(opts.grade) : null;
  const areas = opts.subject ? AREA_OF_SUBJECT[opts.subject] : null;
  const words = String(opts.query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
  const scored = TLM_LIBRARY.filter(
    (t) =>
      (n === null || (n >= t.grades[0] && n <= t.grades[1])) &&
      (!areas || areas.includes(t.area)) &&
      (!opts.competency || t.competencies.includes(opts.competency))
  ).map((t) => {
    const hay = `${t.name} ${t.learning} ${t.keywords.join(' ')}`.toLowerCase();
    return { t, score: words.filter((w) => hay.includes(w)).length };
  });
  if (words.length && scored.some((s) => s.score > 0)) return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.t);
  return scored.map((s) => s.t);
}

export function tlmById(id: string): TlmItem | undefined {
  return TLM_LIBRARY.find((t) => t.id === id);
}
