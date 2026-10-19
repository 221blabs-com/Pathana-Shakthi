import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY_WORDS } from './dictionary';
import { aksharas, buildPractice, chapterWords, orderSentences, practicePlan, practiceResults } from './practice';

const ENGLISH = {
  id: 'reading-crow',
  grade: 'Class 1',
  paragraphs: [
    'The crow was thirsty. It saw a pot under the tree.',
    'The crow dropped stones in the pot. The water came up.',
    'The cat and the dog saw the crow drink. The sun was hot.',
  ],
  keyVocabulary: [],
};

const TELUGU = {
  id: 'reading-kaaki',
  grade: 'Class 2',
  paragraphs: ['కాకికి దాహం వేసింది. కుండలో నీళ్ళు తక్కువగా ఉన్నాయి.', 'కాకి రాళ్ళు వేసింది. నీళ్ళు పైకి వచ్చాయి. కాకి నీళ్ళు తాగింది.'],
};

describe('aksharas', () => {
  test('keeps a consonant with its vowel sign, and conjuncts together', () => {
    assert.deepEqual(aksharas('కాకి'), ['కా', 'కి']);
    assert.deepEqual(aksharas('నీళ్ళు'), ['నీ', 'ళ్ళు']);
    assert.deepEqual(aksharas('तक्कर'), ['त', 'क्क', 'र']);
    assert.deepEqual(aksharas('crow'), ['c', 'r', 'o', 'w']);
  });
});

describe('chapter words and sentences', () => {
  test('English: real words, no short or common words, most used first', () => {
    const words = chapterWords(ENGLISH.paragraphs, 'English');
    assert.equal(words[0], 'crow');
    assert.ok(words.includes('pot') && words.includes('stones'));
    assert.ok(!words.includes('the') && !words.includes('was') && !words.includes('it'));
  });
  test('sentence order: only short sentences whose words are all different', () => {
    const s = orderSentences(['The sun was hot. The crow saw the pot.'], 4);
    assert.deepEqual(s, [['The', 'sun', 'was', 'hot']]);
  });
});

describe('buildPractice', () => {
  test('English Class 1: every kind it can make, each answer among its options, no two alike', () => {
    const set = buildPractice(ENGLISH, DICTIONARY_WORDS);
    assert.equal(set.language, 'English');
    const kinds = new Set(set.items.map((i) => i.kind));
    for (const k of ['picture_word', 'listen_choose', 'first_sound', 'missing_letter', 'word_order']) assert.ok(kinds.has(k as any), k);
    for (const item of set.items) {
      if (item.kind === 'word_order') {
        assert.notEqual(item.options.join(' '), item.answer);
        assert.deepEqual([...item.options].sort(), item.answer.split(' ').sort());
        continue;
      }
      assert.ok(item.options.includes(item.answer), `${item.kind}: answer in options`);
      assert.equal(new Set(item.options).size, item.options.length, `${item.kind}: distinct options`);
      assert.equal(item.options.length, 3);
    }
    // First sound is heard, never shown (the written word gives it away).
    assert.ok(set.items.filter((i) => i.kind === 'first_sound').every((i) => !i.display));
    // A picture item shows a picture of its own word.
    const picture = set.items.find((i) => i.kind === 'picture_word')!;
    assert.ok(picture.emoji);
    assert.equal(DICTIONARY_WORDS.find((d) => d.word === picture.answer && d.language === 'English')?.emoji, picture.emoji);
  });

  test('missing letter never offers a choice that makes another word', () => {
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      for (const item of buildPractice({ ...ENGLISH, id }, DICTIONARY_WORDS).items.filter((i) => i.kind === 'missing_letter')) {
        const wrong = item.options.filter((o) => o !== item.answer);
        assert.ok(wrong.every((w) => vowels.has(w) !== vowels.has(item.answer)), `${item.display}: ${item.options}`);
        assert.equal(item.display!.replace(' _ ', ` ${item.answer} `).replace(/ /g, ''), item.word);
      }
    }
  });

  test('the same chapter always gets the same set (worksheet = what the child played)', () => {
    assert.deepEqual(buildPractice(ENGLISH, DICTIONARY_WORDS), buildPractice(ENGLISH, DICTIONARY_WORDS));
  });

  test('Telugu: aksharas and base letters, in Telugu script', () => {
    const set = buildPractice(TELUGU, DICTIONARY_WORDS);
    assert.equal(set.language, 'Telugu');
    const first = set.items.find((i) => i.kind === 'first_sound');
    assert.ok(first, 'first sound item');
    assert.equal([...first!.answer].length, 1);
    assert.ok(first!.word.startsWith(first!.answer));
    const missing = set.items.find((i) => i.kind === 'missing_letter');
    if (missing) {
      assert.equal(missing.display!.replace('_', missing.answer), missing.word);
      assert.ok(missing.options.every((o) => /[ఀ-౿]/.test(o)));
    }
    assert.ok(set.items.every((i) => /[ఀ-౿]/.test(i.answer)));
  });

  test('older classes get meanings and sentences instead of pictures and sounds', () => {
    assert.equal(practicePlan('Class 1').word_meaning, 0);
    assert.ok(practicePlan('Class 8').word_meaning > practicePlan('Class 8').first_sound);
    const set = buildPractice(
      {
        ...ENGLISH,
        grade: 'Class 4',
        keyVocabulary: [
          { word: 'thirsty', meaning: 'wanting to drink water' },
          { word: 'pot', meaning: 'a round container for water' },
          { word: 'stone', meaning: 'a small hard piece of rock' },
        ],
      },
      DICTIONARY_WORDS
    );
    const meaning = set.items.filter((i) => i.kind === 'word_meaning');
    assert.equal(meaning.length, 2);
    assert.ok(meaning.every((m) => m.options.length === 3 && m.options.includes(m.answer)));
  });

  test('a chapter with too little text gives no broken items', () => {
    assert.deepEqual(buildPractice({ id: 'x', grade: 'Class 1', paragraphs: ['Hi.'] }, DICTIONARY_WORDS).items, []);
  });
});

test('practiceResults counts first tries per kind', () => {
  const set = buildPractice(ENGLISH, DICTIONARY_WORDS);
  const firstTry: Record<number, boolean> = {};
  set.items.forEach((_, i) => (firstTry[i] = i % 2 === 0));
  const results = practiceResults(set.items, firstTry);
  const total = Object.values(results).reduce((n, r) => n + r!.total, 0);
  const right = Object.values(results).reduce((n, r) => n + r!.right, 0);
  assert.equal(total, set.items.length);
  assert.equal(right, Math.ceil(set.items.length / 2));
});
