const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../public/assets/locale-policy.js');
const policy = globalThis.CodingLabLocale;

test('explicit query, shared choice, local choice, timezone, browser, English fallback', () => {
  const base = { query: 'en', cookie: 'coding_lab_locale=ua', saved: 'en', timezone: 'Europe/Kyiv', languages: ['uk-UA'] };
  assert.equal(policy.detect(base), 'en');
  delete base.query;
  assert.equal(policy.detect(base), 'ua');
  delete base.cookie;
  assert.equal(policy.detect(base), 'en');
  delete base.saved;
  assert.equal(policy.detect(base), 'ua');
  base.timezone = 'Europe/London';
  assert.equal(policy.detect(base), 'ua');
  base.languages = ['de-DE'];
  assert.equal(policy.detect(base), 'en');
});
test('all app Ukrainian timezone aliases and BCP47 variants', () => {
  for (const timezone of ['Europe/Kyiv', 'Europe/Kiev', 'Europe/Uzhgorod', 'Europe/Zaporozhye']) {
    assert.equal(policy.detect({ timezone, languages: ['en-US'] }), 'ua');
  }
  for (const value of ['ua', 'uk', 'uk-UA', 'UK_ua']) assert.equal(policy.normalize(value), 'ua');
  for (const value of ['en', 'en-US', 'EN_gb']) assert.equal(policy.normalize(value), 'en');
  for (const value of ['fr', 'ukulele', '', null, 42]) assert.equal(policy.normalize(value), null);
});
test('invalid preferences fall through and the first supported browser language wins', () => {
  assert.equal(policy.detect({ query: 'xx', cookie: 'coding_lab_locale=xx', saved: 'xx', languages: ['de-DE', 'uk-UA', 'en-US'] }), 'ua');
  assert.equal(policy.detect({ languages: ['en-US', 'uk-UA'] }), 'en');
});
test('cookie scope excludes Capital Wizard, local previews and lookalike domains', () => {
  for (const host of ['coding-lab.co', 'www.coding-lab.co', 'app.coding-lab.co']) {
    assert.equal(policy.cookieValue('uk-UA', host), 'coding_lab_locale=ua; Domain=coding-lab.co; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
  }
  for (const host of ['localhost', 'app.capital-wizard.com', 'coding-lab.co.evil.test', 'notcoding-lab.co']) assert.equal(policy.cookieValue('ua', host), null);
  assert.equal(policy.cookieLanguage('other_coding_lab_locale=ua'), null);
});
