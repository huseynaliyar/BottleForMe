import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocale, isRtl, languages } from '../lib/locale';
import { translate } from '../lib/translations';
import { gettingStarted } from '../lib/getting-started';
import { supportFaq } from '../lib/support-faq';

test('six selectable locales cover core navigation, onboarding and support', () => {
  const primary = ['Log in', 'Register', 'Radar', 'Pickups', 'Settings', 'List Empties', 'Request pickup', 'Send message'];
  for (const { value } of languages) {
    assert.equal(isLocale(value), true);
    assert.equal(isRtl(value), value === 'ar' || value === 'ur');
    assert.equal(translate(value, 'User-written content'), 'User-written content');
    if (value === 'en') continue;
    for (const phrase of [
      ...primary.filter((phrase) => phrase !== 'Radar' || value !== 'it'),
      ...gettingStarted.flatMap(({ title, description }) => [title, description]),
      ...supportFaq.flatMap(({ question, answer }) => [question, answer]),
    ]) assert.notEqual(translate(value, phrase), phrase, value + ': ' + phrase);
  }
  assert.equal(isLocale('invalid'), false);
});
