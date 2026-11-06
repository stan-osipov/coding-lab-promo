const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(publicDir, 'assets/ua.js'), 'utf8'), scope);
const copy = scope.window.CodingLabUkrainian;
const names = new Set(require('./untranslated-names.json'));

test('all page copy, preview labels and accessibility text have Ukrainian translations', () => {
  const texts = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1]);
  texts.push(...[...html.matchAll(/(?:title|aria-label|placeholder|data-account-name)="([^"]+)"/g)].map(match => match[1]));
  texts.push(...[...html.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)" content="([^"]+)"/g)].map(match => match[1]));
  const missing = texts.map(text => text.trim().replace(/\s+/g, ' '))
    .filter(text => /[a-z]/i.test(text) && !names.has(text) && !Object.hasOwn(copy, text));
  assert.deepEqual([...new Set(missing)], []);
  for (const [source, translated] of Object.entries(copy)) {
    assert.ok(translated.trim(), `Empty translation: ${source}`);
    assert.ok(!/[<>]/.test(translated), `Translation must be plain text: ${source}`);
  }
});
test('every referenced local asset and SVG symbol exists', () => {
  const ids = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]));
  for (const [, id] of html.matchAll(/<use href="#([^"]+)"/g)) assert.ok(ids.has(id), id);
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^https?:/.test(asset)) continue;
    assert.ok(fs.existsSync(path.join(publicDir, asset)), asset);
  }
});
