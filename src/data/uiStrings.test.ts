import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI_LANGS, UI_STRINGS, easyModeOn, subjectLabel, t } from './uiStrings';

const TELUGU = /[ఀ-౿]/;
const DEVANAGARI = /[ऀ-ॿ]/;

test('every label exists in English, Telugu and Hindi, in its own script, with the same placeholders', () => {
  for (const [key, row] of Object.entries(UI_STRINGS)) {
    for (const lang of UI_LANGS) assert.ok(row[lang]?.trim(), `${key} has no ${lang}`);
    assert.match(row.Telugu, TELUGU, `${key}: Telugu is not in Telugu script`);
    assert.match(row.Hindi, DEVANAGARI, `${key}: Hindi is not in Devanagari`);
    assert.doesNotMatch(row.English, TELUGU);
    const vars = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    assert.equal(vars(row.Telugu), vars(row.English), `${key}: Telugu placeholders`);
    assert.equal(vars(row.Hindi), vars(row.English), `${key}: Hindi placeholders`);
  }
});

test('t fills placeholders and falls back to English', () => {
  assert.equal(t('Telugu', 'classN', { n: 3 }), '3వ తరగతి');
  assert.equal(t('Hindi', 'hello', { name: 'Arjun' }), 'नमस्ते, Arjun!');
  assert.equal(t(undefined, 'start'), 'Start');
  assert.equal(t('French' as any, 'start'), 'Start');
  assert.equal(subjectLabel('Telugu', 'Maths'), 'గణితం');
  assert.equal(subjectLabel('Hindi', 'Art'), 'Art');
});

test('easy mode: the choice wins, else Class 1-2 and beginners', () => {
  assert.equal(easyModeOn({ grade: 'Class 1' }), true);
  assert.equal(easyModeOn({ grade: 'Class 2', readingLevel: 'proficient' }), true);
  assert.equal(easyModeOn({ grade: 'Class 3' }), false);
  assert.equal(easyModeOn({ grade: 'Class 5', readingLevel: 'beginner' }), true);
  assert.equal(easyModeOn({ grade: 'Class 1', easyMode: 'off' }), false);
  assert.equal(easyModeOn({ grade: 'Class 9', easyMode: 'on' }), true);
  assert.equal(easyModeOn(null), false);
});

test('only the sign-in sentences may be spoken without an account', async () => {
  const { isPublicSpeech } = await import('./uiStrings');
  assert.equal(isPublicSpeech(t('Telugu', 'tapClass')), true);
  assert.equal(isPublicSpeech(`${t('Hindi', 'classN', { n: 5 })}. ${t('Hindi', 'tapName')}`), true);
  assert.equal(isPublicSpeech(`${t('English', 'classN', { n: 10 })}. ${t('English', 'tapName')}`), true);
  assert.equal(isPublicSpeech(t('Telugu', 'isThisYou', { name: 'Arjun' })), true);
  assert.equal(isPublicSpeech(t('Hindi', 'isThisYou', { name: 'अर्जुन' })), true);
  assert.equal(isPublicSpeech(t('English', 'langChosen')), true);
  assert.equal(isPublicSpeech('Read me a long story about anything I like.'), false);
  assert.equal(isPublicSpeech(t('English', 'isThisYou', { name: 'x'.repeat(60) })), false);
  assert.equal(isPublicSpeech(`${t('English', 'tapClass')} ${t('English', 'tapName')} ${t('English', 'tapName')}`), false);
  assert.equal(isPublicSpeech(''), false);
});
