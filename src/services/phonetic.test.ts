import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneticKey, samePhoneticWord } from './phonetic';

test('two spellings of the same Telugu/Hindi word compare equal', () => {
  assert.ok(samePhoneticWord('చెయ్యి', 'చేయి'));
  assert.ok(samePhoneticWord('వాన', 'వానా.'));
  assert.ok(samePhoneticWord('ఆట', 'ఆటా'));
  assert.ok(samePhoneticWord('అక్క', 'అక్కా'));
  assert.ok(samePhoneticWord('माँ', 'मां'));
  assert.ok(samePhoneticWord('पेड़', 'पेड'));
  assert.ok(samePhoneticWord('River', 'river.'));
});

test('different words stay different', () => {
  assert.ok(!samePhoneticWord('పిల్లి', 'పెళ్లి'));
  assert.ok(!samePhoneticWord('అన్న', 'అన్నం'));
  assert.ok(!samePhoneticWord('చేప', 'చే'));
  assert.ok(!samePhoneticWord('cat', 'god'));
  assert.ok(!samePhoneticWord('a', 'a')); // too short to judge
  assert.equal(phoneticKey('నాన్న'), 'నన');
});

test('digits and English sound-alikes compare as the spoken word', async () => {
  const { canonicalWord } = await import('./phonetic');
  assert.equal(canonicalWord('5', 'English'), canonicalWord('five', 'English'));
  assert.equal(canonicalWord('28', 'English'), 'twentyeight');
  assert.equal(canonicalWord('I.', 'English'), canonicalWord('eye', 'English'));
  assert.equal(canonicalWord('3', 'Telugu'), 'మూడు');
  assert.equal(canonicalWord('5', 'Hindi'), canonicalWord('पाँच', 'Hindi'));
  assert.notEqual(canonicalWord('cat', 'English'), canonicalWord('cot', 'English'));
});

test('English read-aloud: a different word is a mistake, a long-word spelling variant is not', async () => {
  const { englishNearMatch } = await import('./phonetic');
  // Misreads the old edit-distance rule accepted as correct.
  assert.equal(englishNearMatch('thirty', 'thirsty'), false);
  assert.equal(englishNearMatch('ship', 'shop'), false);
  assert.equal(englishNearMatch('bake', 'bike'), false);
  assert.equal(englishNearMatch('seven', 'seventy'), false);
  assert.equal(englishNearMatch('walk', 'walked'), false);
  // Spelling variants of the same long word.
  assert.equal(englishNearMatch('neighbor', 'neighbour'), true);
  assert.equal(englishNearMatch('traveled', 'travelled'), true);
  assert.equal(englishNearMatch('water', 'water'), true);
});
