// Telangana State Board (SCERT Telangana) textbooks for Classes 6-10: the
// units and chapters a high-school student studies, per subject tile. Taken
// from the SCERT Telangana textbooks (2024-26 editions) as listed by the
// state's textbook portals; chapter numbers are the textbook's own.
//
// A chapter can carry `labId`: a built-in interactive simulation lab
// (src/data/learnPlay.ts) that teaches it. Chapters a teacher publishes from
// the real textbook (OCR) are matched by title on the subject page.
import type { LabSubject } from './learnPlay';

export interface SyllabusChapter {
  no: number | string;
  title: string;
  labId?: string;
}

export interface SyllabusUnit {
  name: string;
  chapters: SyllabusChapter[];
}

export interface SyllabusBook {
  subject: LabSubject;
  /** Textbook name, e.g. "Physical Science" (Science has two books from Class 8). */
  book: string;
  units: SyllabusUnit[];
}

export const SYLLABUS_SOURCE = 'SCERT Telangana textbooks (State syllabus)';

const ch = (no: number | string, title: string, labId?: string): SyllabusChapter => (labId ? { no, title, labId } : { no, title });

const chapters = (list: (string | [string, string])[], start = 1): SyllabusChapter[] =>
  list.map((item, i) => (Array.isArray(item) ? ch(start + i, item[0], item[1]) : ch(start + i, item)));

export const TELANGANA_SYLLABUS: Record<number, SyllabusBook[]> = {
  /* ============================== CLASS 6 ============================== */
  6: [
    {
      subject: 'Maths',
      book: 'Mathematics',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Knowing Our Numbers',
            'Whole Numbers',
            'Playing with Numbers',
            'Basic Geometrical Ideas',
            'Measures of Lines and Angles',
            ['Integers', 'hs-integers'],
            ['Fractions and Decimals', 'hs-fractions'],
            'Data Handling',
            'Introduction to Algebra',
            'Perimeter and Area',
            'Ratio and Proportion',
            'Symmetry',
            'Practical Geometry',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'General Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Our Food',
            ['Playing with Magnets', 'hs-magnets'],
            'Rain - Where Does It Come From?',
            'What Do Animals Eat?',
            'Materials and Things',
            'Habitat',
            'Separation of Substances',
            'Fibre to Fabric',
            'Plants: Parts and Functions',
            'Changes Around Us',
            'Water in Our Life',
            ['Simple Electric Circuits', 'hs-circuits'],
            'Learning How to Measure',
            'Movements in Animals',
            'Light, Shadows and Images',
            'Living and Non-living',
          ]),
        },
      ],
    },
    {
      subject: 'Social',
      book: 'Social Studies',
      units: [
        {
          name: 'Theme I · Diversity on the Earth',
          chapters: [
            ch(1, 'Reading and Making Maps'),
            ch(2, 'Globe - A Model of the Earth', 'hs-globe'),
            ch(3, 'Land Forms'),
            ch(4, 'Penamakuru - A Village in the Krishna Delta'),
            ch(5, 'Dokur - A Village on the Plateau'),
            ch('5A', 'Penugolu - A Village on the Hills'),
          ],
        },
        {
          name: 'Theme II · Production, Exchange and Livelihoods',
          chapters: [
            ch(6, 'From Gathering Food to Growing Food - The Earliest People'),
            ch(7, 'Agriculture in Our Times'),
            ch(8, 'Trade in Agricultural Produce'),
          ],
        },
        {
          name: 'Theme III · Political Systems and Governance',
          chapters: chapters(
            [
              'Community Decision Making in a Tribe',
              'Emergence of Kingdoms and Republics',
              'First Empires',
              'Democratic Government',
              'Village Panchayats',
              'Local Self-Government in Urban Areas',
            ],
            9
          ),
        },
        { name: 'Theme IV · Social Organisation and Inequities', chapters: chapters(['Diversity in Our Society', 'Towards Gender Equality'], 15) },
        { name: 'Theme V · Religion and Society', chapters: chapters(['Religion and Society in Early Times', 'Devotion and Love towards God'], 17) },
        {
          name: 'Theme VI · Culture and Communication',
          chapters: chapters(['Language, Writing and Great Books', 'Sculptures and Buildings', 'Greenery in Telangana'], 19),
        },
      ],
    },
    {
      subject: 'English',
      book: 'Our World through English',
      units: [
        { name: 'Unit 1 · Peace and Harmony', chapters: [ch('1A', 'Peace and Harmony'), ch('1B', 'I Want Peace (Poem)'), ch('1C', 'Grand Contest in the Forest')] },
        {
          name: 'Unit 2 · Telangana, the Pride of the People',
          chapters: [ch('2A', 'Telangana, the Pride of the People'), ch('2B', 'In the Bazaars of Hyderabad (Poem)'), ch('2C', 'Bammera Pothana, the Jewel of Telugu Literature')],
        },
        {
          name: 'Unit 3 · What Can a Dollar and Eleven Cents Do?',
          chapters: [ch('3A', 'What Can a Dollar and Eleven Cents Do?'), ch('3B', "A Nation's Strength (Poem)"), ch('3C', 'Wilma Rudolph')],
        },
        { name: 'Unit 4 · An Adventure', chapters: [ch('4A', 'An Adventure'), ch('4B', 'The Naughty Boy (Poem)'), ch('4C', 'Tanaji Malusare')] },
        { name: 'Unit 5 · Plant a Tree', chapters: [ch('5A', 'Plant a Tree'), ch('5B', 'If a Tree Could Talk (Poem)'), ch('5C', 'Children, Speak Up!')] },
        { name: 'Unit 6 · Rip Van Winkle', chapters: [ch('6A', 'Rip Van Winkle'), ch('6B', 'My Shadow (Poem)'), ch('6C', "Gulliver's Travels")] },
        {
          name: 'Unit 7 · P.T. Usha, the Golden Girl',
          chapters: [ch('7A', 'P.T. Usha, the Golden Girl'), ch('7B', 'Indian Cricket Team (Poem)'), ch('7C', "Ranji's Wonderful Bat")],
        },
        { name: 'Unit 8 · Half the Price', chapters: [ch('8A', 'Half the Price'), ch('8B', "The Sheik's White Donkey")] },
      ],
    },
    {
      subject: 'Telugu',
      book: 'తెలుగు (ప్రథమ భాష)',
      units: [
        {
          name: 'పాఠాలు',
          chapters: chapters([
            'అభినందన',
            'స్నేహబంధం',
            'వర్షం',
            'లేఖ',
            'శతకసుధ',
            'పోతన బాల్యం',
            'ఉడుత సాయం',
            'చెరువు',
            'చీమలబారు',
            'బాలనాగమ్మ',
            'పల్లెటూరి పిల్లగాడా',
            'కాపాడుకుందాం',
          ]),
        },
      ],
    },
    {
      subject: 'Hindi',
      book: 'हिंदी',
      units: [
        {
          name: 'पाठ',
          chapters: chapters([
            'आम ले लो आम!',
            'हमारा गाँव',
            'रेलवे स्टेशन',
            'बाज़ार',
            'मेरा परिवार',
            'चिड़ियाघर',
            'मैदान',
            'बाल दिवस',
            'खुशियों की दुनिया',
            'चुक्की और जब्बार',
            'उद्यान',
            'बच्चे चले क्रिकेट खेलने',
          ]),
        },
      ],
    },
  ],

  /* ============================== CLASS 7 ============================== */
  7: [
    {
      subject: 'Maths',
      book: 'Mathematics',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            ['Integers', 'hs-integers'],
            ['Fractions, Decimals and Rational Numbers', 'hs-fractions'],
            ['Simple Equations', 'hs-equations'],
            'Lines and Angles',
            ['Triangle and Its Properties', 'hs-triangles'],
            'Ratio - Applications',
            'Data Handling',
            'Congruency of Triangles',
            'Construction of Triangles',
            'Algebraic Expressions',
            'Powers and Exponents',
            'Quadrilaterals',
            'Area and Perimeter',
            'Understanding 3D and 2D Shapes',
            'Symmetry',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'General Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Food Components',
            ['Acids and Bases', 'hs-acids'],
            'Animal Fibre',
            ['Motion and Time', 'hs-motion'],
            'Heat - Measurements',
            'Weather and Climate',
            ['Electricity - Current and Its Effects', 'hs-circuits'],
            'Air, Winds and Cyclones',
            'Reflection of Light',
            ['Nutrition in Plants', 'hs-photosynthesis'],
            'Respiration in Organisms',
            'Reproduction in Plants',
            'Seed Dispersal',
            'Water',
            'Soil - Our Life',
            'Forest - Our Life',
            'Changes Around Us',
          ]),
        },
      ],
    },
    {
      subject: 'Social',
      book: 'Social Studies',
      units: [
        {
          name: 'Theme I · Diversity on the Earth',
          chapters: chapters(['Reading Maps of Different Kinds', 'Rain and Rivers', 'Tanks and Ground Water', 'Oceans and Fishing', 'Europe', 'Africa']),
        },
        {
          name: 'Theme II · Production, Exchange and Livelihoods',
          chapters: chapters(['Handicrafts and Handlooms', 'Industrial Revolution', 'Production in a Factory - A Paper Mill', 'Importance of Transport System'], 7),
        },
        {
          name: 'Theme III · Political Systems and Governance',
          chapters: chapters(
            [
              'New Kings and Kingdoms',
              'The Kakatiyas - Emergence of a Regional Kingdom',
              'The Kings of Vijayanagara',
              'Mughal Empire',
              'Establishment of the British Empire in India',
              'Making of Laws in the State Assembly',
              'Implementation of Laws in the District',
            ],
            11
          ),
        },
        {
          name: 'Theme IV · Social Organisation and Inequities',
          chapters: chapters(['Caste Discrimination and the Struggle for Equalities', 'Livelihood and Struggles of Urban Workers'], 18),
        },
        { name: 'Theme V · Religion and Society', chapters: chapters(['Folk - Religion', 'Devotional Paths to the Divine'], 20) },
        { name: 'Theme VI · Culture and Communication', chapters: chapters(['Rulers and Buildings'], 22) },
      ],
    },
    {
      subject: 'English',
      book: 'Our World through English',
      units: [
        {
          name: 'Unit 1',
          chapters: [ch('1A', 'The Town Mouse and the Country Mouse'), ch('1B', 'The Town Child and the Country Child (Poem)'), ch('1C', 'The New Blue Dress')],
        },
        { name: 'Unit 2', chapters: [ch('2A', 'C.V. Raman, the Pride of India'), ch('2B', "It's Change (Poem)"), ch('2C', 'Susruta, an Ancient Plastic Surgeon')] },
        { name: 'Unit 3', chapters: [ch('3A', 'Puru, the Brave'), ch('3B', 'Home They Brought Her Warrior Dead (Poem)'), ch('3C', 'The Magic of Silk')] },
        { name: 'Unit 4', chapters: [ch('4A', 'Tenali Paints a Horse'), ch('4B', 'Dear Mum (Poem)'), ch('4C', "The Emperor's New Clothes")] },
        { name: 'Unit 5', chapters: [ch('5A', 'A Trip to Andaman'), ch('5B', 'My Trip to the Moon (Poem)'), ch('5C', 'Sindbad, the Sailor')] },
        { name: 'Unit 6', chapters: [ch('6A', 'A Hero'), ch('6B', 'My Nasty Adventure (Poem)'), ch('6C', 'Learn How to Climb Trees')] },
        { name: 'Unit 7', chapters: [ch('7A', 'The Wonderful World of Chess'), ch('7B', 'Chess (Poem)'), ch('7C', 'Koneru Humpy')] },
        { name: 'Unit 8', chapters: [ch('8A', 'Snakes in India'), ch('8B', 'Trees (Poem)'), ch('8C', 'A Letter from Mother Earth')] },
      ],
    },
    {
      subject: 'Telugu',
      book: 'తెలుగు (ప్రథమ భాష)',
      units: [
        {
          name: 'పాఠాలు',
          chapters: chapters([
            'చదువు',
            'నాయనమ్మ',
            'శతక సుధ',
            'అమ్మ జ్ఞాపకాలు',
            'పల్లె అందాలు',
            'ప్రేరణ',
            'శిల్పి',
            'గ్రామాలలోని వేడుకలు, క్రీడావినోదాలు',
            'ఏ కులం?',
            'సీత ఇష్టాలు',
            'శ్రీలు పొంగిన జీవగడ్డ',
            'రాణి శంకరమ్మ',
          ]),
        },
        {
          name: 'ఉపవాచకం',
          chapters: [ch('ఉ1', 'అద్భుతమైన సెలవులు'), ch('ఉ2', 'రుద్రమదేవి'), ch('ఉ3', 'మన పండుగలు'), ch('ఉ4', 'ఆరుట్ల కమలాదేవి')],
        },
      ],
    },
    {
      subject: 'Hindi',
      book: 'हिंदी',
      units: [
        {
          name: 'पाठ',
          chapters: chapters([
            'मन करता है',
            'सच्चा दोस्त',
            'हिंदी दिवस',
            'अपना प्यारा भारत देश',
            'आसमान गिरा',
            'छुट्टी पत्र',
            'चारमीनार',
            'हमारे त्योहार',
            'गुसाडी',
            'कबीर के दोहे',
            'साहसी सुनीता',
            'आत्मविश्वास',
          ]),
        },
      ],
    },
  ],

  /* ============================== CLASS 8 ============================== */
  8: [
    {
      subject: 'Maths',
      book: 'Mathematics',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Rational Numbers',
            ['Linear Equations in One Variable', 'hs-equations'],
            'Construction of Quadrilaterals',
            'Exponents and Powers',
            'Comparing Quantities using Proportion',
            'Square Roots and Cube Roots',
            'Frequency Distribution Tables and Graphs',
            'Exploring Geometrical Figures',
            'Area of Plane Figures',
            'Direct and Inverse Proportions',
            'Algebraic Expressions',
            'Factorisation',
            'Visualizing 3-D in 2-D',
            'Surface Area and Volume (Cube-Cuboid)',
            'Playing with Numbers',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Physical Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Force',
            'Friction',
            'Synthetic Fibres and Plastics',
            'Metals and Non-metals',
            'Sound',
            'Reflection of Light at Plane Surfaces',
            'Coal and Petroleum',
            'Combustion, Fuels and Flame',
            'Electrical Conductivity of Liquids',
            'Some Natural Phenomena',
            ['Stars and the Solar System', 'hs-solar'],
            ['Graphs of Motion', 'hs-motion'],
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Biological Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'What is Science?',
            'Cell - The Basic Unit of Life',
            'Microbial World - 1',
            'Microbial World - 2',
            'Reproduction in Animals',
            'Adolescence',
            'Biodiversity and Its Conservation',
            'Different Ecosystems',
            'Food Production from Plants',
            'Food Production from Animals',
            'Not for Drinking - Not for Breathing',
            'Why Do We Fall Ill?',
          ]),
        },
      ],
    },
    {
      subject: 'Social',
      book: 'Social Studies',
      units: [
        {
          name: 'Theme I · Diversity on the Earth',
          chapters: [
            ch(1, 'Reading and Analysis of Maps'),
            ch(2, 'Energy from the Sun'),
            ch(3, 'Earth Movements and Seasons', 'hs-seasons'),
            ch(4, 'The Polar Regions'),
            ch(5, 'Forests: Using and Protecting Them'),
            ch(6, 'Minerals and Mining'),
          ],
        },
        {
          name: 'Theme II · Production, Exchange and Livelihoods',
          chapters: chapters(['Money and Banking', 'Impact of Technology on Livelihoods', 'Public Health and the Government'], 7),
        },
        {
          name: 'Theme III · Political Systems and Governance',
          chapters: [
            ch(10, 'Landlords and Tenants under the British and the Nizam'),
            ch('11A', 'National Movement - The Early Phase 1885-1919', 'hs-freedom'),
            ch('11B', 'National Movement - The Last Phase 1919-1947', 'hs-freedom'),
            ch(12, 'Freedom Movement in Hyderabad State'),
          ],
        },
        {
          name: 'Theme IV · Social Organisation and Inequities',
          chapters: chapters(
            [
              'The Indian Constitution',
              'Parliament and Central Government',
              'Law and Justice - A Case Study',
              'Abolition of Zamindari System',
              'Understanding Poverty',
              'Rights Approach to Development',
            ],
            13
          ),
        },
        { name: 'Theme V · Religion and Society', chapters: chapters(['Social and Religious Reform Movements', 'Understanding Secularism'], 19) },
        {
          name: 'Theme VI · Culture and Communication',
          chapters: chapters(
            ['Performing Arts and Artistes in Modern Times', 'Film and Print Media', 'Sports: Nationalism and Commerce', 'Disaster Management'],
            21
          ),
        },
      ],
    },
    {
      subject: 'English',
      book: 'Our World through English',
      units: [
        { name: 'Unit 1 · Family', chapters: [ch('1A', 'The Tattered Blanket'), ch('1B', 'My Mother (Poem)'), ch('1C', 'A Letter to a Friend')] },
        {
          name: 'Unit 2 · Social Issues',
          chapters: [ch('2A', 'Oliver Asks for More'), ch('2B', 'The Cry of the Children (Poem)'), ch('2C', 'Reaching the Unreached')],
        },
        {
          name: 'Unit 3 · Humanity',
          chapters: [ch('3A', 'The Selfish Giant (Part I)'), ch('3B', 'The Garden Within (Poem)'), ch('3C', 'The Selfish Giant (Part II)')],
        },
        {
          name: 'Unit 4 · Science and Technology',
          chapters: [ch('4A', 'The Fun They Had'), ch('4B', 'Preteen Pretext (Poem)'), ch('4C', 'The Computer Game')],
        },
        {
          name: 'Unit 5 · Education and Career',
          chapters: [ch('5A', 'The Treasure Within (Part I)'), ch('5B', 'The Treasure Within (Part II)'), ch('5C', 'They Literally Build the Nation')],
        },
        // The sources give no theme name for this unit.
        { name: 'Unit 6', chapters: [ch('6A', 'The Story of Ikat'), ch('6B', 'The Earthen Goblet (Poem)'), ch('6C', 'Maestro with a Mission')] },
        {
          name: 'Unit 7 · Women Empowerment',
          chapters: [ch('7A', 'Bonsai Life (Part 1)'), ch('7B', 'Bonsai Life (Part 2)'), ch('7C', 'I Can Take Care of Myself')],
        },
        { name: 'Unit 8 · Gratitude', chapters: [ch('8A', 'Dr. Dwarakanath Kotnis'), ch('8B', 'Be Thankful (Poem)')] },
      ],
    },
    {
      subject: 'Telugu',
      book: 'తెలుగు (ప్రథమ భాష)',
      units: [
        {
          name: 'పాఠాలు',
          chapters: chapters([
            'త్యాగనిరతి',
            'సముద్ర ప్రయాణం',
            'బండారి బసవన్న',
            'అసామాన్యులు',
            'శతక సుధ',
            'తెలుగు జానపద గేయాలు',
            'మంజీర',
            'చిన్నప్పుడే',
            'అమరులు',
            'సింగరేణి',
            'కాపుబిడ్డ',
            'మాట్లాడే నాగలి',
          ]),
        },
        {
          name: 'ఉపవాచకం',
          chapters: [
            ch('ఉ1', 'చిత్రగ్రీవం'),
            ch('ఉ2', 'షోయబుల్లాఖాన్'),
            ch('ఉ3', 'చిందు ఎల్లమ్మ'),
            ch('ఉ4', 'ఇల్లు - ఆనందాలహరివిల్లు'),
            ch('ఉ5', 'జానపద కళలు'),
            ch('ఉ6', 'పి.వి. నరసింహారావు'),
          ],
        },
      ],
    },
    {
      subject: 'Hindi',
      book: 'हिंदी',
      units: [
        {
          name: 'पाठ',
          chapters: chapters([
            'हम होंगे कामयाब',
            'राजा बदल गया',
            'प्यारा गाँव',
            'कौन?',
            'धरती की आँखें',
            'दिल्ली से पत्र',
            'त्योहारों का देश',
            'चावल के दाने',
            'मैं सिनेमा हूँ',
            'अनमोल रत्न',
            'हार के आगे जीत है',
            'बढ़ते कदम',
          ]),
        },
      ],
    },
  ],

  /* ============================== CLASS 9 ============================== */
  9: [
    {
      subject: 'Maths',
      book: 'Mathematics',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Real Numbers',
            'Polynomials and Factorisation',
            'The Elements of Geometry',
            'Lines and Angles',
            'Co-ordinate Geometry',
            ['Linear Equations in Two Variables', 'hs-linear-graphs'],
            'Triangles',
            'Quadrilaterals',
            'Statistics',
            'Surface Areas and Volumes',
            'Areas',
            'Circles',
            'Geometrical Constructions',
            ['Probability', 'hs-probability'],
            'Proofs in Mathematics',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Physical Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Matter Around Us',
            ['Motion', 'hs-motion'],
            'Laws of Motion',
            ['Refraction of Light at Plane Surfaces', 'hs-refraction'],
            'Gravitation',
            'Is Matter Pure?',
            'Atoms, Molecules and Chemical Reactions',
            'Floating Bodies',
            ['What is Inside the Atom?', 'hs-atom'],
            'Work and Energy',
            'Heat',
            'Sound',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Biological Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Cell - Its Structure and Functions',
            'Plant Tissues',
            'Animal Tissues',
            'Plasma Membrane',
            'Diversity in Living Organisms',
            'Sense Organs',
            'Animal Behaviour',
            'Challenges in Improving Agricultural Products',
            'Adaptations in Different Ecosystems',
            'Soil Pollution',
            'Bio-geo-chemical Cycles',
          ]),
        },
      ],
    },
    {
      subject: 'Social',
      book: 'Social Studies',
      units: [
        {
          name: 'Part I · Natural Realms of the Earth and Economy',
          chapters: chapters([
            ['Our Earth', 'hs-globe'],
            'The Natural Realms of the Earth - Lithosphere',
            'Hydrosphere',
            'Atmosphere',
            'Biosphere',
            'Agriculture in India',
            'Industries in India',
            'Service Activities in India',
            'Credit in the Financial System',
            'Prices and Cost of Living',
            'The Government Budget and Taxation',
          ]),
        },
        {
          name: 'Part II · World from Medieval to Modern Times',
          chapters: chapters(
            [
              'Democratic and Nationalist Revolutions: 17th, 18th and 19th Centuries',
              'Industrialisation and Social Change',
              'Social Protest Movements',
              'Colonialism in Latin America, Asia and Africa',
              'Impact of Colonialism in India',
              'Expansion of Democracy',
              'Democracy: An Evolving Idea',
              'Human Rights and Fundamental Rights',
              'Women Protection Acts',
              'Disaster Management',
              'Traffic Education',
            ],
            12
          ),
        },
      ],
    },
    {
      subject: 'English',
      book: 'Our World through English',
      units: [
        { name: 'Unit 1 · Humour', chapters: [ch('1A', 'The Snake and the Mirror'), ch('1B', 'The Duck and the Kangaroo (Poem)'), ch('1C', 'Little Bobby')] },
        {
          name: 'Unit 2 · Games and Sports',
          chapters: [ch('2A', 'True Height'), ch('2B', 'What Is a Player? (Poem)'), ch('2C', 'V.V.S. Laxman, Very Very Special')],
        },
        {
          name: 'Unit 3 · School Life',
          chapters: [ch('3A', 'Swami Is Expelled from School'), ch('3B', 'Not Just a Teacher, but a Friend (Poem)'), ch('3C', 'Homework')],
        },
        {
          name: 'Unit 4 · Environment',
          chapters: [ch('4A', 'What Is Man Without the Beasts?'), ch('4B', 'The River (Poem)'), ch('4C', "Can't Climb Trees Any More")],
        },
        {
          name: 'Unit 5 · Disasters',
          chapters: [ch('5A', 'A Havoc of Flood'), ch('5B', 'Grabbing Everything on the Land (Poem)'), ch('5C', 'The Ham Radio')],
        },
        {
          name: 'Unit 6 · Freedom',
          chapters: [ch('6A', 'A Long Walk to Freedom'), ch('6B', 'Where the Mind is Without Fear (Poem)'), ch('6C', 'An Icon of Civil Rights')],
        },
        {
          name: 'Unit 7 · Theatre',
          chapters: [ch('7A', 'The Trial'), ch('7B', "Antony's Speech (Poem)"), ch('7C', 'Mahatma Gandhi, Pushed out of Train')],
        },
        {
          name: 'Unit 8 · Travel and Tourism',
          chapters: [ch('8A', 'The Accidental Tourist'), ch('8B', 'Father Returning Home (Poem)'), ch('8C', 'Kathmandu')],
        },
      ],
    },
    {
      subject: 'Telugu',
      book: 'తెలుగు (ప్రథమ భాష)',
      units: [
        {
          name: 'పాఠాలు',
          chapters: chapters([
            'ధర్మార్జునులు',
            'నేనెరిగిన బూర్గుల',
            'వలసకూలీ',
            'రంగాచార్యతో ముఖాముఖి',
            'శతక మధురిమ',
            'దీక్షకు సిద్ధంకండి',
            'చెలిమి',
            'ఉద్యమ స్ఫూర్తి',
            'కోరస్',
            'వాగ్భూషణం',
            'వాయసం',
            'తీయని పలకరింపు',
          ]),
        },
      ],
    },
    {
      subject: 'Hindi',
      book: 'हिंदी',
      units: [
        {
          name: 'पाठ',
          chapters: chapters([
            'जिस देश में गंगा बहती है',
            'गाने वाली चिड़िया',
            'बदलें अपनी सोच',
            'प्रकृति की सीख',
            'फुटबॉल',
            'बेटी के नाम पत्र',
            'मेरा जीवन',
            'यक्ष प्रश्न',
            'रमज़ान',
            'अमर वाणी',
            'सुनीता विलियम्स',
            'जागो ग्राहक जागो!',
          ]),
        },
        {
          name: 'उपवाचक',
          chapters: [
            ch('उ1', 'तारे ज़मीन पर'),
            ch('उ2', 'सम्मक्का-सारक्का जातरा'),
            ch('उ3', 'बुद्धिमान बालक'),
            ch('उ4', 'अपना स्थान स्वयं बनायें'),
          ],
        },
      ],
    },
  ],

  /* ============================== CLASS 10 ============================= */
  10: [
    {
      subject: 'Maths',
      book: 'Mathematics',
      units: [
        {
          name: 'Paper I',
          chapters: [
            ch(1, 'Real Numbers'),
            ch(2, 'Sets', 'hs-sets'),
            ch(3, 'Polynomials'),
            ch(4, 'Pair of Linear Equations in Two Variables', 'hs-linear-graphs'),
            ch(8, 'Similar Triangles'),
            ch(11, 'Trigonometry', 'hs-trigonometry'),
            ch(12, 'Applications of Trigonometry', 'hs-trigonometry'),
            ch(14, 'Statistics'),
          ],
        },
        {
          name: 'Paper II',
          chapters: [
            ch(5, 'Quadratic Equations', 'hs-quadratics'),
            ch(6, 'Progressions'),
            ch(7, 'Coordinate Geometry'),
            ch(9, 'Tangents and Secants to a Circle'),
            ch(10, 'Mensuration'),
            ch(13, 'Probability', 'hs-probability'),
          ],
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Physical Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            'Reflection of Light at Curved Surfaces',
            'Chemical Equations',
            ['Acids, Bases and Salts', 'hs-acids'],
            ['Refraction of Light at Curved Surfaces', 'hs-lens'],
            'Human Eye and Colourful World',
            ['Structure of Atom', 'hs-atom'],
            ['Classification of Elements - The Periodic Table', 'hs-atom'],
            'Chemical Bonding',
            ['Electric Current', 'hs-circuits'],
            ['Electromagnetism', 'hs-magnets'],
            'Principles of Metallurgy',
            'Carbon and Its Compounds',
          ]),
        },
      ],
    },
    {
      subject: 'Science',
      book: 'Biological Science',
      units: [
        {
          name: 'Chapters',
          chapters: chapters([
            ['Nutrition', 'hs-photosynthesis'],
            'Respiration',
            ['Circulation', 'hs-heart'],
            'Excretion',
            'Coordination',
            'Reproduction',
            'Coordination in Life Processes',
            'Heredity - Evolution',
            'Our Environment',
            'Natural Resources',
          ]),
        },
      ],
    },
    {
      subject: 'Social',
      book: 'Social Studies',
      units: [
        {
          name: 'Part I · Resources, Development and Equity',
          chapters: chapters([
            'India - Relief Features',
            'Ideas of Development',
            'Production and Employment',
            'Climate of India',
            'Indian Rivers and Water Resources',
            'India - Population',
            'Settlements - Migrations',
            'Rampur - A Village Economy',
            'Globalisation',
            'Food Security',
            'Sustainable Development with Equity',
          ]),
        },
        {
          name: 'Part II · Contemporary World and India',
          chapters: chapters(
            [
              'The World Between Wars 1900-1950',
              'National Liberation Movements in the Colonies',
              ['National Movement in India - Partition and Independence 1939-1947', 'hs-freedom'],
              "Making of Independent India's Constitution",
              'The Election Process in India',
              'Independent India (The First 30 Years 1947-1977)',
              'Emerging Political Trends 1977-2007',
              'Post-War World and India',
              'Social Movements in Our Times',
              ['The Movement for the Formation of Telangana State', 'hs-telangana'],
            ],
            12
          ),
        },
      ],
    },
    {
      subject: 'English',
      book: 'English',
      units: [
        {
          name: 'Unit 1 · Personality Development',
          chapters: [ch('1A', 'Attitude is Altitude'), ch('1B', 'Every Success Story is also a Story of Great Failures'), ch('1C', 'I Will Do It')],
        },
        {
          name: 'Unit 2 · Wit and Humour',
          chapters: [ch('2A', 'The Dear Departed (Part 1)'), ch('2B', 'The Dear Departed (Part 2)'), ch('2C', 'The Brave Potter')],
        },
        { name: 'Unit 3 · Human Relations', chapters: [ch('3A', 'The Journey'), ch('3B', 'Once Upon a Time (Poem)'), ch('3C', 'The Never-Never Nest')] },
        {
          name: 'Unit 4 · Films and Theatre',
          chapters: [ch('4A', 'The Storeyed House (Part 1)'), ch('4B', 'The Storeyed House (Part 2)'), ch('4C', 'Abandoned (Poem)')],
        },
        { name: 'Unit 6 · Bio-Diversity', chapters: [ch('6A', 'Environment'), ch('6B', 'Or Will the Dreamer Wake? (Poem)'), ch('6C', 'A Tale of Three Villages')] },
        { name: 'Unit 7 · Nation and Diversity', chapters: [ch('7A', 'My Childhood'), ch('7B', 'A Plea for India'), ch('7C', 'Unity in Diversity in India')] },
        // Unit 5 is left out and Unit 8 lists only its first reading: the sources disagreed on
        // the rest, and a wrong title is worse than a missing one (teachers' OCR books still match).
        { name: 'Unit 8 · Human Rights', chapters: [ch('8A', 'Jamaican Fragment')] },
      ],
    },
    {
      subject: 'Telugu',
      book: 'తెలుగు (ప్రథమ భాష)',
      units: [
        {
          name: 'పాఠాలు',
          chapters: chapters([
            'దానశీలము',
            'ఎవరి భాష వాళ్ళకు వినసొంపు',
            'వీర తెలంగాణ',
            'కొత్తబాట',
            'నగరగీతం',
            'భాగ్యోదయం',
            'శతక మధురిమ',
            'లక్ష్య సిద్ధి',
            'జీవనభాష్యం',
            'గోలకొండ పట్టణము',
            'భిక్ష',
          ]),
        },
        { name: 'ఉపవాచకం', chapters: [ch('ఉ', 'రామాయణం')] },
      ],
    },
    {
      subject: 'Hindi',
      book: 'हिंदी',
      units: [
        {
          name: 'पाठ',
          chapters: chapters([
            'बरसते बादल',
            'ईदगाह',
            'माँ मुझे आने दे',
            'कण-कण का अधिकारी',
            'लोकगीत',
            'अंतरराष्ट्रीय स्तर पर हिंदी',
            'भक्ति पद',
            'स्वराज्य की नींव',
            'दक्षिणी गंगा गोदावरी',
            'नीति दोहे',
            'जल ही जीवन है',
          ]),
        },
      ],
    },
  ],
};

const gradeNumberOf = (grade: string | undefined) => Number(String(grade || '').replace(/\D/g, '')) || 0;

/** The Telangana textbooks (with units and chapters) of a subject tile for a class, [] below Class 6. */
export function syllabusFor(grade: string | undefined, subject: string): SyllabusBook[] {
  return (TELANGANA_SYLLABUS[gradeNumberOf(grade)] || []).filter((book) => book.subject === subject);
}

/** Lab ids used by the syllabus of a class (so a lab shows only where its chapter is taught). */
export function syllabusLabIds(grade: string | undefined): Set<string> {
  const ids = new Set<string>();
  for (const book of TELANGANA_SYLLABUS[gradeNumberOf(grade)] || []) {
    for (const unit of book.units) for (const chapter of unit.chapters) if (chapter.labId) ids.add(chapter.labId);
  }
  return ids;
}

/** Loose title key for matching a published (OCR) chapter to a syllabus chapter. */
export function syllabusTitleKey(title: string): string {
  return String(title || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\((part|poem)[^)]*\)/g, '')
    .replace(/^(chapter|lesson|unit)\s*[\w.-]*\s*[:.-]?\s*/i, '')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}
