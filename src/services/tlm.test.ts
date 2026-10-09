import test from 'node:test';
import assert from 'node:assert/strict';
import { alphabetChartHtml, factCards, hundredChartHtml, splitIntoCards, wordCardsHtml } from './tlm';

test('reading cards split at sentence ends', () => {
  const cards = splitIntoCards(['One two three. Four five six. Seven eight.', 'Nine ten।'], 6);
  assert.deepEqual(cards, ['One two three. Four five six.', 'Seven eight.', 'Nine ten।']);
});

test('fact cards stay within the class limit and never repeat', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const add = factCards('+', 10, 20, random);
  assert.equal(add.length, 20);
  assert.ok(add.every((f) => f.a <= 10));
  assert.equal(new Set(add.map((f) => f.q)).size, 20);
  const sub = factCards('-', 20, 15, random);
  assert.ok(sub.every((f) => f.a >= 0));
  const mul = factCards('×', 10, 10, random);
  assert.ok(mul.every((f) => eval(f.q.replace('×', '*')) === f.a));
});

test('charts and cards escape text and include every letter', () => {
  assert.match(hundredChartHtml(), />100</);
  assert.match(wordCardsHtml('<b>', [{ word: 'a&b', meaning: 'x' }]), /a&amp;b/);
  const te = alphabetChartHtml('Telugu');
  assert.ok(te.includes('అ') && te.includes('ఱ'));
  assert.ok(alphabetChartHtml('Hindi').includes('ज्ञ'));
});
