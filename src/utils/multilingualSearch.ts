import { Story } from '../types';

// Multilingual keywords and transliteration dictionary for Telugu, Hindi, and English
const TRANSLITERATION_MAP: Record<string, string[]> = {
  // Telugu transliterations
  kaki: ['కాకి', 'crow'],
  kaaki: ['కాకి', 'crow'],
  simham: ['సింహం', 'lion', 'sher'],
  singam: ['సింహం', 'lion'],
  eluka: ['ఎలుక', 'mouse', 'rat', 'chuha'],
  mamidi: ['మామిడి', 'mango'],
  chettu: ['చెట్టు', 'tree', 'ped'],
  chetu: ['చెట్టు', 'tree'],
  neellu: ['నీళ్లు', 'నీరు', 'water', 'paani'],
  neeru: ['నీరు', 'నీళ్లు', 'water'],
  daaham: ['దాహం', 'thirst', 'pyaas'],
  daham: ['దాహం', 'thirst'],
  kunda: ['కుండ', 'pot', 'pitcher', 'ghada'],
  upayam: ['ఉపాయం', 'clever', 'idea', 'solution'],
  upaayam: ['ఉపాయం', 'clever', 'trick'],
  adavi: ['అడవి', 'forest', 'jungle'],
  sneham: ['స్నేహం', 'friendship', 'dosti'],
  snehitulu: ['స్నేహితులు', 'friends', 'mitra'],
  badi: ['బడి', 'school', 'paathashaala'],
  needa: ['నీడ', 'shade', 'chhaya'],
  uduta: ['ఉడుత', 'squirrel'],
  gulakarallu: ['గులకరాళ్లు', 'pebbles', 'stones', 'kankad'],

  // Hindi transliterations
  kauwa: ['कौआ', 'कौए', 'crow', 'kaki'],
  kavva: ['कौआ', 'crow'],
  sher: ['शेर', 'lion', 'simham'],
  chuha: ['चूहा', 'चूहे', 'mouse', 'eluka'],
  ghada: ['घड़ा', 'घड़े', 'pot', 'kunda'],
  paani: ['पानी', 'जल', 'water', 'neellu'],
  pani: ['पानी', 'water'],
  pyaas: ['प्यास', 'प्यासा', 'thirst', 'daaham'],
  pyas: ['प्यास', 'thirst'],
  baarish: ['बारिश', 'वर्षा', 'rain', 'varsham'],
  barish: ['बारिश', 'rain'],
  indradhanush: ['इंद्रधनुष', 'rainbow'],
  kankad: ['कंकड़', 'pebbles', 'stones'],
  dosti: ['दोस्ती', 'मित्रता', 'friendship', 'sneham'],
  mitra: ['मित्र', 'दोस्त', 'friend', 'snehitudu'],
  jungle: ['जंगल', 'वन', 'forest', 'adavi'],
  jangal: ['जंगल', 'forest'],
  mor: ['मोर', 'peacock', 'nemali'],
  suraj: ['सूरज', 'सूर्य', 'sun', 'surya', 'solar'],
  ped: ['पेड़', 'वृक्ष', 'tree', 'chettu'],

  // English words mapping to Telugu and Hindi
  crow: ['కాకి', 'कौआ', 'कौए', 'kaaki', 'kauwa'],
  lion: ['సింహం', 'शेर', 'simham', 'sher'],
  mouse: ['ఎలుక', 'चूहा', 'चूहे', 'eluka', 'chuha'],
  mango: ['మామిడి', 'आम', 'mamidi', 'aam'],
  tree: ['చెట్టు', 'पेड़', 'chettu', 'ped'],
  water: ['నీళ్లు', 'నీరు', 'पानी', 'neellu', 'paani'],
  thirst: ['దాహం', 'प्यास', 'daaham', 'pyaas'],
  pot: ['కుండ', 'घड़ा', 'kunda', 'ghada'],
  clever: ['ఉపాయం', 'చతుర', 'चतुर', 'समझदार'],
  forest: ['అడవి', 'जंगल', 'adavi', 'jungle'],
  friend: ['స్నేహితుడు', 'మిత్రులు', 'मित्र', 'दोस्त', 'friendship', 'sneham', 'dosti'],
  friendship: ['స్నేహం', 'దోస్తీ', 'दोस्ती', 'मित्रता', 'sneham', 'dosti'],
  rain: ['వర్షం', 'వాన', 'बारिश', 'rainy', 'baarish', 'rimjhim'],
  rainbow: ['ఇంద్రధనుస్సు', 'ఇంద్రధనువు', 'इंद्रधनुष', 'indradhanush'],
  sun: ['సూర్యుడు', 'सूरज', 'सूर्य', 'solar', 'sunlight'],
  solar: ['సౌర', 'सौर', 'sun', 'solar lantern', 'lantern'],
  seed: ['విత్తనం', 'బీజం', 'बीज', 'sprout', 'plant', 'beej'],
  sprout: ['చిగురు', 'మొక్క', 'अंकुर', 'पौधा', 'sprout', 'seed'],
  elephant: ['ఏనుగు', 'హాథీ', 'हाथी', 'appu', 'gaja'],
  pebbles: ['గులకరాళ్లు', 'కంకడ్', 'कंकड़', 'stones', 'pebble'],
  school: ['బడి', 'పాఠశాల', 'विद्यालय', 'स्कूल', 'badi'],
  panchatantra: ['పంచతంత్రం', 'పంచతంత్ర', 'पंचतंत्र', 'moral', 'folktale', 'neetulu', 'katha'],
  moral: ['నీతి', 'నీతికథలు', 'ప్రేరణ', 'प्रेरक', 'शिक्षा', 'seekh'],
  science: ['సైన్స్', 'విజ్ఞానం', 'శాస్త్రం', 'विज्ञान', 'solar', 'rainbow', 'plant', 'growth'],
  nature: ['ప్రకృతి', 'చెట్లు', 'జంతువులు', 'पर्यावरण', 'green', 'rain', 'forest', 'tree'],
  animal: ['జంతువులు', 'జంతువు', 'ప్రాణులు', 'पशु', 'जानवर', 'lion', 'mouse', 'crow', 'elephant', 'fawn'],
};

// Clean and normalize text
export function normalizeSearchString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filter stories based on query across Telugu, Hindi, English, subjects, and transliterations.
 */
export function searchStoriesMultilingual(
  stories: Story[],
  query: string,
  selectedLanguage: string = 'All',
  selectedGrade: string = 'All'
): Story[] {
  const cleanQuery = normalizeSearchString(query);

  return stories.filter((story) => {
    // 1. Language filter
    if (selectedLanguage !== 'All' && story.language !== selectedLanguage) {
      return false;
    }

    // 2. Grade filter
    if (selectedGrade !== 'All' && story.gradeLevel !== selectedGrade) {
      return false;
    }

    // 3. Query filter
    if (!cleanQuery) {
      return true;
    }

    // Build complete searchable corpus for this story
    const searchTerms: string[] = [
      story.title,
      story.titleEnglish,
      story.category,
      story.difficulty,
      story.gradeLevel,
      story.language,
      story.moralOrTakeaway,
    ];

    // Add spotlight words
    if (story.spotlightWords) {
      story.spotlightWords.forEach((sw) => {
        searchTerms.push(sw.word);
        searchTerms.push(sw.meaning);
        searchTerms.push(sw.pronunciation);
        if (sw.example) searchTerms.push(sw.example);
      });
    }

    // Add page texts, English translations, and transliterations
    story.pages.forEach((page) => {
      searchTerms.push(page.text);
      searchTerms.push(page.englishTranslation);
      if (page.transliteration) searchTerms.push(page.transliteration);
    });

    const fullCorpus = searchTerms.join(' ').toLowerCase();

    // Check direct substring match
    if (fullCorpus.includes(cleanQuery)) {
      return true;
    }

    // Split query by whitespace for multi-word search
    const queryTokens = cleanQuery.split(/\s+/).filter((t) => t.length > 0);
    const allTokensMatch = queryTokens.every((token) => {
      if (fullCorpus.includes(token)) return true;

      // Check transliteration mappings for this token
      const mappedAliases = TRANSLITERATION_MAP[token] || [];
      return mappedAliases.some((alias) => fullCorpus.includes(alias.toLowerCase()));
    });

    if (allTokensMatch) {
      return true;
    }

    // Check if whole query exists in transliteration dictionary
    const directAliases = TRANSLITERATION_MAP[cleanQuery] || [];
    if (directAliases.some((alias) => fullCorpus.includes(alias.toLowerCase()))) {
      return true;
    }

    return false;
  });
}
