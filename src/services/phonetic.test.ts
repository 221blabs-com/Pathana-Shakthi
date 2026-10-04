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
