import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv';

test('csv: quotes, newlines, scripts and formula-looking cells', () => {
  assert.equal(toCsv([['Roll', 'Name'], [1, 'Asha, R']]), 'Roll,Name\r\n1,"Asha, R"');
  assert.equal(toCsv([['say "hi"', null, undefined]]), '"say ""hi""",,');
  assert.equal(toCsv([['=HYPERLINK("x")', '+1', '-2', '@a']]), `"'=HYPERLINK(""x"")",'+1,'-2,'@a`);
  assert.equal(toCsv([['రవి', 'राम']]), 'రవి,राम');
});
