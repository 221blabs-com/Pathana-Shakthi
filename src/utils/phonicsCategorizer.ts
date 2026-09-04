import { Language } from '../types';

export type PhonicsClusterCategory =
  | 'telugu_conjunct_ottu'       // ఒత్తులు & సంయుక్తాక్షరాలు (e.g., ళ్ల, ట్టి, త్ర్య, స్నే, ర్ఘ)
  | 'telugu_gunintham_vowel'     // గుణింతాలు & దీర్ఘాలు (e.g., ఋ, ఐ, ఔ, ఏత్వం, ఓత్వం)
  | 'telugu_mahaprana_aspirated' // మహా ప్రాణాలు (e.g., ఖ, ఘ, ఛ, ఝ, ఠ, ఢ, థ, ధ, ఫ, భ)
  | 'telugu_anusvara_nasal'      // సున్నాలు & అనుస్వారాలు (e.g., ందం, ంత, ంగ, ంచు)
  | 'hindi_samyuktakshar'        // संयुक्ताक्षर (e.g., क्ष, त्र, ज्ञ, श्र, द्व, त्त, स्त, प्र)
  | 'hindi_mahapran'             // महाप्राण वर्ण (e.g., ख, घ, छ, झ, ठ, ढ, थ, ध, फ, भ)
  | 'hindi_matra_nasal'          // मात्राएं, अनुस्वार व चंद्रबिंदु (e.g., ऋ, ऐ, औ, अं, अँ)
  | 'hindi_nukta'                // नुक्ता वर्ण (e.g., ज़, फ़, ख़, ग़)
  | 'english_complex_blend'      // str, spl, spr, scr, thr, shr, squ
  | 'english_digraph_diphthong'  // th, sh, ch, ph, wh, ea, ee, oa, ou, ow, oi, oy, igh
  | 'english_silent_letter'      // kn, wr, mb, gn, gh, ps
  | 'english_multisyllabic';     // -tion, -sion, -able, -ment, -ight, -ough

export interface PhonicsClusterInfo {
  cluster: string;
  category: PhonicsClusterCategory;
  categoryName: string;
  categoryNameNative: string;
  language: Language;
  description: string;
  teachingTip: string;
  practiceExample: string;
}

export interface StruggledWordAnalysis {
  word: string;
  language: Language;
  meaning?: string;
  phoneticBreakdown: string[];
  detectedClusters: PhonicsClusterInfo[];
  primaryCategory: PhonicsClusterCategory;
  primaryCategoryName: string;
  primaryCategoryNameNative: string;
  difficultyScore: number; // 1 to 5
  attemptsCount: number;
  lastEncountered?: string;
  studentsStrugglingCount?: number;
  studentsList?: string[];
}

export interface LanguagePhonicsSummary {
  language: Language;
  totalStruggles: number;
  uniqueWordsCount: number;
  clusterCategories: {
    category: PhonicsClusterCategory;
    name: string;
    nameNative: string;
    count: number;
    hardestClusters: { cluster: string; count: number; words: string[] }[];
    percentage: number;
  }[];
  topStruggledWords: StruggledWordAnalysis[];
}

// Known phonics rule tables
const TELUGU_CONJUNCT_MAP: Record<string, { desc: string; tip: string }> = {
  'ళ్ల': { desc: 'ళ-వత్తు (Retroflex Lateral Conjunct)', tip: 'Curl the tip of the tongue backwards against the soft palate.' },
  'ట్టి': { desc: 'ట-వత్తు (Retroflex Double Consonant)', tip: 'Emphasize the hard tap of the tongue on the roof of the mouth.' },
  'త్ర్య': { desc: 'త్ర-య వత్తు (Triple Conjunct)', tip: 'Blend "T" + "R" + "Ya" smoothly without inserting an extra vowel.' },
  'ష్ట్ర': { desc: 'ష-ట్ర వత్తు (Sibilant + Retroflex Blend)', tip: 'Start with soft "sh" and transition into hard "tra".' },
  'ద్వి': { desc: 'వ-వత్తు (Dental + Labial Blend)', tip: 'Pronounce soft "d" followed immediately by "vi".' },
  'స్నే': { desc: 'న-వత్తు (Sibilant + Nasal Blend)', tip: 'Continuous breath on "s" leading into long "ne".' },
  'ర్ఘ': { desc: 'ఘ-వత్తు (Aspirated Rhotic Conjunct)', tip: 'Light "r" tap followed by deep throated "gha".' },
  'ద్ద': { desc: 'ద-వత్తు (Double Dental Consonant)', tip: 'Tongue touches back of upper teeth with sustained contact.' },
  'క్క': { desc: 'క-వత్తు (Double Velar Stop)', tip: 'Brief pause and release at the back of the tongue.' },
  'ప్ప': { desc: 'ప-వత్తు (Double Bilabial Plosive)', tip: 'Firm press of both lips before opening.' },
  'చ్చ': { desc: 'చ-వత్తు (Double Palatal Affricate)', tip: 'Clean, crisp "ccha" release with tongue blade.' },
  'మ్మ': { desc: 'మ-వత్తు (Double Bilabial Nasal)', tip: 'Sustained nasal resonance on "mma".' },
  'న్న': { desc: 'న-వత్తు (Double Alveolar Nasal)', tip: 'Hold tongue firmly on the alveolar ridge for "nna".' },
  'క్ష': { desc: 'సంయుక్తాక్షరం (Ksha Consonant Cluster)', tip: 'Combine velar "k" directly into retroflex "sha".' },
  'జ్ఞ': { desc: 'సంయుక్తాక్షరం (Jnya Cluster)', tip: 'Nasalized palatal stop blend.' },
};

const HINDI_SAMYUKTA_MAP: Record<string, { desc: string; tip: string }> = {
  'क्ष': { desc: 'संयुक्त व्यंजन (k + ṣa)', tip: 'Pronounce "k" swiftly followed by cerebral "sh".' },
  'त्र': { desc: 'संयुक्त व्यंजन (t + ra)', tip: 'Light tap of "t" blending immediately into trilled "r".' },
  'ज्ञ': { desc: 'संयुक्त व्यंजन (j + nya / gya)', tip: 'Standard Hindi blends this as "gya".' },
  'श्र': { desc: 'संयुक्त व्यंजन (ś + ra)', tip: 'Soft palatal "sh" flowing into rolling "r".' },
  'द्व': { desc: 'द + व द्वित्व', tip: 'Dental "d" with quick lip rounding for "va".' },
  'त्त': { desc: 'त + त द्वित्व व्यंजन', tip: 'Double dental consonant with sustained closure.' },
  'स्त': { desc: 'स + त गुच्छ', tip: 'Hissing "s" directly into crisp dental "t".' },
  'क्त': { desc: 'क + त गुच्छ', tip: 'Stop "k" into dental "ta".' },
  'प्र': { desc: 'प + र पदेन र', tip: 'Lip release of "p" blended with rolled "ra".' },
  'क्र': { desc: 'क + र पदेन र', tip: 'Throat "k" blending smoothly into "ra".' },
};

const ENGLISH_BLENDS_MAP: Record<string, { desc: string; tip: string }> = {
  'thr': { desc: 'Triple Consonant Blend', tip: 'Tongue between teeth for "th", then pull back for "r".' },
  'str': { desc: '3-Letter Consonant Blend', tip: 'Keep air flowing smoothly through "s-t-r" without extra vowel sounds.' },
  'spl': { desc: '3-Letter Initial Blend', tip: 'Quick transition from "s" to "p" to tongue-tip "l".' },
  'th': { desc: 'Voiced/Unvoiced Dental Digraph', tip: 'Place tongue tip gently between top and bottom front teeth.' },
  'ph': { desc: 'Digraph sounding as /f/', tip: 'Top teeth touch bottom lip as in "peacock" or "phonics".' },
  'igh': { desc: 'Vowel Trigragh (/aɪ/)', tip: 'Long "I" sound; the "gh" remains completely silent.' },
  'ou': { desc: 'Diphthong (/aʊ/)', tip: 'Start with open mouth "ah" and glide into rounded "oo".' },
  'tion': { desc: 'Suffix Cluster (/ʃən/)', tip: 'Soft "shun" syllable at the end of multi-syllabic words.' },
  'kn': { desc: 'Silent Initial Consonant', tip: 'The "k" is silent; start voice directly on "n".' },
  'wr': { desc: 'Silent Initial Consonant', tip: 'The "w" is silent; start directly on "r".' },
};

/**
 * Categorizes an individual word based on language and phonics rules
 */
export function analyzeWordPhonics(word: string, language: Language): StruggledWordAnalysis {
  const clean = word.replace(/[।,!?.":;()—–-]/g, '').trim();
  const detectedClusters: PhonicsClusterInfo[] = [];

  if (language === 'Telugu') {
    // 1. Check for Conjunct Consonants / Ottulu
    const conjunctPatterns = ['ళ్ల', 'ట్టి', 'త్ర్య', 'ష్ట్ర', 'ద్వి', 'స్నే', 'ర్ఘ', 'ద్ద', 'క్క', 'ప్ప', 'చ్చ', 'మ్మ', 'న్న', 'క్ష', 'జ్ఞ', 'ష్ట', 'గ్ర', 'ప్ర', 'క్ర', 'త్ర', 'శ్చ', 'ర్భ'];
    for (const pat of conjunctPatterns) {
      if (clean.includes(pat)) {
        const info = TELUGU_CONJUNCT_MAP[pat] || { desc: 'సంయుక్త / ద్విత్వ అక్షరం (Conjunct)', tip: 'Pronounce the base consonant and vowel conjunct clearly.' };
        detectedClusters.push({
          cluster: pat,
          category: 'telugu_conjunct_ottu',
          categoryName: 'Telugu Conjunct Consonants (ఒత్తులు)',
          categoryNameNative: 'సంయుక్తాక్షరాలు & ఒత్తులు',
          language: 'Telugu',
          description: info.desc,
          teachingTip: info.tip,
          practiceExample: `శబ్దంలో ఒత్తును గుర్తించండి: "${pat}" in "${clean}"`,
        });
      }
    }

    // 2. Check for Mahaprana (Aspirated)
    const mahapranaList = ['ఖ', 'ఘ', 'ఛ', 'ఝ', 'ఠ', 'ఢ', 'థ', 'ధ', 'ఫ', 'భ'];
    for (const mp of mahapranaList) {
      if (clean.includes(mp)) {
        detectedClusters.push({
          cluster: mp,
          category: 'telugu_mahaprana_aspirated',
          categoryName: 'Aspirated Consonants (మహా ప్రాణాలు)',
          categoryNameNative: 'మహా ప్రాణ ధ్వనులు',
          language: 'Telugu',
          description: `మహా ప్రాణ అక్షరం: "${mp}"`,
          teachingTip: 'Feel the puff of warm air on your palm when exhaling on this aspirated consonant.',
          practiceExample: `గాలి ఒత్తిడితో పలకండి: "${mp}" in "${clean}"`,
        });
      }
    }

    // 3. Check for Guninthalu & Complex Vowels
    const guninthamVowels = ['ఋ', 'ౠ', 'ై', 'ౌ', 'ో', 'ే'];
    for (const gv of guninthamVowels) {
      if (clean.includes(gv)) {
        detectedClusters.push({
          cluster: gv,
          category: 'telugu_gunintham_vowel',
          categoryName: 'Vowel Modifiers & Length (గుణింతాల దీర్ఘాలు)',
          categoryNameNative: 'గుణింతాలు & సంక్లిష్ట స్వరాలు',
          language: 'Telugu',
          description: 'Complex vowel elongation / matra modifier',
          teachingTip: 'Sustain the vowel melody for 2 counts to match the long meter.',
          practiceExample: `స్వరాన్ని సాగదీసి పలకండి: "${gv}" in "${clean}"`,
        });
      }
    }

    // 4. Check for Anusvara (సున్నాలు)
    if (clean.includes('ం') || clean.includes('ః')) {
      detectedClusters.push({
        cluster: 'ం (సున్నా)',
        category: 'telugu_anusvara_nasal',
        categoryName: 'Nasal Blends & Anusvara (అనుస్వారాలు)',
        categoryNameNative: 'సున్నాలు & బిందువులు',
        language: 'Telugu',
        description: 'Nasal resonance marker',
        teachingTip: 'Let the sound hum through the nose softly.',
        practiceExample: `అనుస్వార ధ్వని: "ం" in "${clean}"`,
      });
    }

    // Fallback if no specific cluster matched
    if (detectedClusters.length === 0) {
      detectedClusters.push({
        cluster: clean.slice(0, 3),
        category: 'telugu_conjunct_ottu',
        categoryName: 'Telugu Syllable Blending',
        categoryNameNative: 'తెలుగు అక్షర సంధానం',
        language: 'Telugu',
        description: 'Multi-syllable word decodable sequence',
        teachingTip: 'Break word into individual aksharas and blend smoothly.',
        practiceExample: `అక్షరాలను విడదీసి చదవండి: "${clean}"`,
      });
    }
  } else if (language === 'Hindi') {
    // 1. Samyuktakshar
    const hindiSamyukta = ['क्ष', 'त्र', 'ज्ञ', 'श्र', 'द्व', 'त्त', 'स्त', 'क्त', 'प्र', 'क्र', 'ध्य', 'न्न', 'म्म', 'च्च', 'ल्ल', 'ष्ट'];
    for (const hs of hindiSamyukta) {
      if (clean.includes(hs)) {
        const info = HINDI_SAMYUKTA_MAP[hs] || { desc: 'संयुक्त व्यंजन (Conjunct)', tip: 'Do not pronounce an inherent "a" between the combined consonants.' };
        detectedClusters.push({
          cluster: hs,
          category: 'hindi_samyuktakshar',
          categoryName: 'Hindi Conjuncts (संयुक्ताक्षर)',
          categoryNameNative: 'संयुक्ताक्षर एवं द्वित्व',
          language: 'Hindi',
          description: info.desc,
          teachingTip: info.tip,
          practiceExample: `संयुक्ताक्षर का अभ्यास: "${hs}" in "${clean}"`,
        });
      }
    }

    // 2. Mahapran
    const hindiMahapran = ['ख', 'घ', 'छ', 'झ', 'ठ', 'ढ', 'थ', 'ध', 'फ', 'भ'];
    for (const hm of hindiMahapran) {
      if (clean.includes(hm)) {
        detectedClusters.push({
          cluster: hm,
          category: 'hindi_mahapran',
          categoryName: 'Aspirated Letters (महाप्राण वर्ण)',
          categoryNameNative: 'महाप्राण ध्वनियाँ',
          language: 'Hindi',
          description: `महाप्राण ध्वनि: "${hm}"`,
          teachingTip: 'Release a sharp burst of air while pronouncing this letter.',
          practiceExample: `प्राणवायु के साथ बोलें: "${hm}" in "${clean}"`,
        });
      }
    }

    // 3. Matras & Nasals
    if (clean.includes('ृ') || clean.includes('ै') || clean.includes('ौ') || clean.includes('ं') || clean.includes('ँ')) {
      const match = clean.match(/[ृैौंधँ]/)?.[0] || 'मात्रा';
      detectedClusters.push({
        cluster: match,
        category: 'hindi_matra_nasal',
        categoryName: 'Vowel Matras & Anusvara (मात्रा व अनुस्वार)',
        categoryNameNative: 'मात्राएं व नासिक्य ध्वनियाँ',
        language: 'Hindi',
        description: 'Vowel diacritic or nasal resonance',
        teachingTip: 'Focus on correct mouth aperture for matras.',
        practiceExample: `मात्रा का सही उच्चारण: "${match}" in "${clean}"`,
      });
    }

    // 4. Nukta
    if (clean.includes('ज़') || clean.includes('फ़') || clean.includes('ख़') || clean.includes('ग़')) {
      detectedClusters.push({
        cluster: 'नुक्ता (ज़/फ़)',
        category: 'hindi_nukta',
        categoryName: 'Nukta Sounds (नुक्ता ध्वनियाँ)',
        categoryNameNative: 'नुक्ता युक्त वर्ण',
        language: 'Hindi',
        description: 'Loan phoneme with fricative articulation',
        teachingTip: 'Vibrate upper teeth against bottom lip for /z/ and /f/.',
        practiceExample: `नुक्ता वर्ण: "${clean}"`,
      });
    }

    if (detectedClusters.length === 0) {
      detectedClusters.push({
        cluster: clean.slice(0, 2),
        category: 'hindi_samyuktakshar',
        categoryName: 'Hindi Word Decodability',
        categoryNameNative: 'हिन्दी शब्द विन्यास',
        language: 'Hindi',
        description: 'Word level blending',
        teachingTip: 'Segment into varnas and blend smoothly.',
        practiceExample: `वर्ण संयोजन: "${clean}"`,
      });
    }
  } else {
    // English
    const lower = clean.toLowerCase();
    
    // 1. Silent letters
    const silentList = ['kn', 'wr', 'mb', 'gn', 'gh', 'ps'];
    for (const sl of silentList) {
      if (lower.includes(sl)) {
        detectedClusters.push({
          cluster: sl,
          category: 'english_silent_letter',
          categoryName: 'Silent Letter Clusters',
          categoryNameNative: 'Silent Consonants',
          language: 'English',
          description: ENGLISH_BLENDS_MAP[sl]?.desc || 'Silent letter combination',
          teachingTip: ENGLISH_BLENDS_MAP[sl]?.tip || 'One letter is mute; pronounce only the active consonant.',
          practiceExample: `Remember: "${sl}" in "${clean}" has a silent sound.`,
        });
      }
    }

    // 2. Complex blends
    const complexBlends = ['thr', 'str', 'spl', 'spr', 'scr', 'shr', 'squ'];
    for (const cb of complexBlends) {
      if (lower.includes(cb)) {
        detectedClusters.push({
          cluster: cb,
          category: 'english_complex_blend',
          categoryName: '3-Letter Consonant Blends',
          categoryNameNative: 'Triple Blends',
          language: 'English',
          description: ENGLISH_BLENDS_MAP[cb]?.desc || 'Complex consonant blend',
          teachingTip: ENGLISH_BLENDS_MAP[cb]?.tip || 'Blend all 3 sounds without inserting an "uh" sound between them.',
          practiceExample: `Blend smoothly: "${cb}" in "${clean}"`,
        });
      }
    }

    // 3. Digraphs and Diphthongs
    const digraphs = ['th', 'sh', 'ch', 'ph', 'wh', 'ea', 'ee', 'oa', 'ou', 'ow', 'oi', 'oy', 'igh', 'tion'];
    for (const dg of digraphs) {
      if (lower.includes(dg) && !detectedClusters.some(c => c.cluster.includes(dg))) {
        detectedClusters.push({
          cluster: dg,
          category: dg === 'tion' ? 'english_multisyllabic' : 'english_digraph_diphthong',
          categoryName: dg === 'tion' ? 'Suffix & Multi-syllable Clusters' : 'Digraphs & Vowel Teams',
          categoryNameNative: dg === 'tion' ? 'Suffixes (-tion)' : 'Digraph Teams',
          language: 'English',
          description: ENGLISH_BLENDS_MAP[dg]?.desc || 'Two letters making one distinct phoneme sound',
          teachingTip: ENGLISH_BLENDS_MAP[dg]?.tip || 'Two letters work together as a single sound team.',
          practiceExample: `Sound team: "${dg}" in "${clean}"`,
        });
      }
    }

    if (detectedClusters.length === 0) {
      detectedClusters.push({
        cluster: lower.slice(0, 3),
        category: 'english_multisyllabic',
        categoryName: 'Multi-syllable Phonics',
        categoryNameNative: 'Syllable Blends',
        language: 'English',
        description: 'Multi-syllable word structure',
        teachingTip: 'Clap out the syllables (beats) and pronounce chunk by chunk.',
        practiceExample: `Break into syllables: "${clean}"`,
      });
    }
  }

  const primary = detectedClusters[0];

  // Estimate difficulty score
  let score = 2;
  if (primary.category.includes('conjunct') || primary.category.includes('samyuktakshar') || primary.category.includes('complex_blend')) {
    score = 4;
  } else if (primary.category.includes('silent') || primary.category.includes('mahaprana') || primary.category.includes('mahapran')) {
    score = 3;
  }
  if (clean.length > 8) score = Math.min(5, score + 1);

  // Generate decodable syllable chunks
  const phoneticBreakdown = clean.length > 4 
    ? [clean.slice(0, Math.ceil(clean.length / 2)), clean.slice(Math.ceil(clean.length / 2))] 
    : [clean];

  return {
    word: clean,
    language,
    phoneticBreakdown,
    detectedClusters,
    primaryCategory: primary.category,
    primaryCategoryName: primary.categoryName,
    primaryCategoryNameNative: primary.categoryNameNative,
    difficultyScore: score,
    attemptsCount: 1,
  };
}

/**
 * Aggregates all reading session logs into structured phonics diagnostic analytics
 */
export function aggregateClassroomPhonicsStruggles(
  readingLogs: { language: Language; struggledWords?: string[]; studentId?: string }[],
  allStudents: { id: string; name: string }[] = []
): Record<Language, LanguagePhonicsSummary> {
  const studentMap = new Map(allStudents.map(s => [s.id, s.name]));

  const summaryMap: Record<Language, {
    wordMap: Map<string, StruggledWordAnalysis>;
    clusterCategoryCounts: Map<PhonicsClusterCategory, {
      name: string;
      nameNative: string;
      count: number;
      clusterMap: Map<string, { count: number; words: Set<string> }>;
    }>;
  }> = {
    Telugu: { wordMap: new Map(), clusterCategoryCounts: new Map() },
    Hindi: { wordMap: new Map(), clusterCategoryCounts: new Map() },
    English: { wordMap: new Map(), clusterCategoryCounts: new Map() },
  };

  // Process all logs
  for (const log of readingLogs) {
    const lang = log.language || 'Telugu';
    const target = summaryMap[lang] || summaryMap['Telugu'];
    const words = log.struggledWords || [];
    const studentName = log.studentId ? studentMap.get(log.studentId) || 'Student' : 'Student';

    for (const rawWord of words) {
      if (!rawWord || !rawWord.trim()) continue;
      const cleanWord = rawWord.replace(/[।,!?.":;()—–-]/g, '').trim();
      if (!cleanWord) continue;

      let analysis = target.wordMap.get(cleanWord);
      if (!analysis) {
        analysis = analyzeWordPhonics(cleanWord, lang);
        analysis.studentsList = [studentName];
        analysis.studentsStrugglingCount = 1;
        target.wordMap.set(cleanWord, analysis);
      } else {
        analysis.attemptsCount += 1;
        if (!analysis.studentsList?.includes(studentName)) {
          analysis.studentsList = [...(analysis.studentsList || []), studentName];
          analysis.studentsStrugglingCount = analysis.studentsList.length;
        }
      }

      // Track by detected clusters
      for (const clusterInfo of analysis.detectedClusters) {
        let catObj = target.clusterCategoryCounts.get(clusterInfo.category);
        if (!catObj) {
          catObj = {
            name: clusterInfo.categoryName,
            nameNative: clusterInfo.categoryNameNative,
            count: 0,
            clusterMap: new Map(),
          };
          target.clusterCategoryCounts.set(clusterInfo.category, catObj);
        }

        catObj.count += 1;
        let cData = catObj.clusterMap.get(clusterInfo.cluster);
        if (!cData) {
          cData = { count: 0, words: new Set() };
          catObj.clusterMap.set(clusterInfo.cluster, cData);
        }
        cData.count += 1;
        cData.words.add(cleanWord);
      }
    }
  }

  // Build final structured summaries
  const result: Record<Language, LanguagePhonicsSummary> = {
    Telugu: { language: 'Telugu', totalStruggles: 0, uniqueWordsCount: 0, clusterCategories: [], topStruggledWords: [] },
    Hindi: { language: 'Hindi', totalStruggles: 0, uniqueWordsCount: 0, clusterCategories: [], topStruggledWords: [] },
    English: { language: 'English', totalStruggles: 0, uniqueWordsCount: 0, clusterCategories: [], topStruggledWords: [] },
  };

  for (const lang of ['Telugu', 'Hindi', 'English'] as Language[]) {
    const raw = summaryMap[lang];
    const wordsList = Array.from(raw.wordMap.values()).sort((a, b) => b.attemptsCount - a.attemptsCount);
    const totalStruggles = wordsList.reduce((acc, w) => acc + w.attemptsCount, 0);

    const categoriesList = Array.from(raw.clusterCategoryCounts.entries()).map(([catKey, val]) => {
      const hardestClusters = Array.from(val.clusterMap.entries())
        .map(([cName, cObj]) => ({
          cluster: cName,
          count: cObj.count,
          words: Array.from(cObj.words),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        category: catKey,
        name: val.name,
        nameNative: val.nameNative,
        count: val.count,
        hardestClusters,
        percentage: totalStruggles > 0 ? Math.round((val.count / totalStruggles) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);

    result[lang] = {
      language: lang,
      totalStruggles,
      uniqueWordsCount: wordsList.length,
      clusterCategories: categoriesList,
      topStruggledWords: wordsList,
    };
  }

  return result;
}
