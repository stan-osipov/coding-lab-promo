import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../public/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Europe/London', viewport: { width: 1440, height: 1000 } });
  // Serve local files at the real HTTPS origins in an isolated browser. No
  // production request is made; this exercises actual parent-domain cookies.
  await context.route('https://coding-lab.co/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = new URL(pathname === '/' ? 'index.html' : pathname.slice(1), root);
    if (!file.href.startsWith(root.href)) return route.abort();
    try { await route.fulfill({ path: fileURLToPath(file) }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await context.route('https://app.coding-lab.co/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>App language contract fixture</body></html>' }));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://coding-lab.co/');
  await page.waitForFunction(() => window.CodingLabI18n);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.locator('[data-language-switch]').selectOption('ua');
  assert.equal(await page.locator('html').getAttribute('lang'), 'uk');
  assert.equal(await page.title(), 'Coding Lab — простір для розробки з ШІ у вашій компанії');
  assert.equal(await page.locator('.h1 .for-teams').textContent(), 'Простір для розробки з ШІ у вашій компанії.');
  assert.equal(await page.locator('a[href^="https://app.coding-lab.co"]').first().getAttribute('href'), 'https://app.coding-lab.co/?lng=ua');
  await page.locator('[data-demo-open]').first().click();
  assert.equal(await page.locator('#demo-unavailable-title').textContent(), 'Демо поки недоступні');
  await page.keyboard.press('Escape');
  const grant = page.locator('[data-matrix] .grant:not([disabled])').first();
  await grant.click();
  assert.equal(await grant.locator('.grant__label').textContent(), 'Доступ');
  await page.locator('[data-stats-tab="people"]').click();
  await page.locator('[data-accounts] .account').nth(3).click();
  assert.equal(await page.locator('[data-active-account]').textContent(), 'API-ключ · Компанія');
  await page.locator('[data-language-switch]').selectOption('en');
  assert.equal(await grant.locator('.grant__label').textContent(), 'Access');
  assert.equal(await page.locator('[data-active-account]').textContent(), 'API key · Company');
  assert.equal(await page.locator('[data-stats-tab="people"]').getAttribute('aria-selected'), 'true');
  await page.locator('[data-language-switch]').selectOption('ua');
  await page.locator('[data-audience-set="developers"]').click();
  assert.equal(await page.locator('body').getAttribute('data-audience'), 'developers');
  assert.match(await page.locator('.h1 .for-dev').innerText(), /кожному вашому пристрої/);

  // Read/write only the synthetic preference in this isolated context.
  const app = await context.newPage();
  await app.goto('https://app.coding-lab.co/');
  assert.equal(await app.evaluate(() => document.cookie), 'coding_lab_locale=ua');
  await app.evaluate(() => { document.cookie = 'coding_lab_locale=en; Domain=coding-lab.co; Path=/; SameSite=Lax; Secure'; });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');

  // Stale origin-local storage must not beat the shared preference.
  await page.evaluate(() => localStorage.setItem('cw:locale', 'ua'));
  await page.goto('https://coding-lab.co/');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.goto('https://coding-lab.co/?lng=uk-UA#features');
  assert.equal(await page.locator('html').getAttribute('lang'), 'uk');

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth,
      header: document.querySelector('.topbar__inner').getBoundingClientRect().right,
      cta: document.querySelector('.topbar__cta').getBoundingClientRect().right }));
    assert.ok(dimensions.page <= width, `Page overflows at ${width}: ${JSON.stringify(dimensions)}`);
    assert.ok(dimensions.cta <= width, `Header overflows at ${width}: ${JSON.stringify(dimensions)}`);
    if (process.env.SCREENSHOT_DIR && [1440, 390].includes(width)) {
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/promo-ua-${width}.png`, fullPage: width === 1440 });
    }
  }
  const untranslated = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found = new Set(); let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script, style, svg, option')) continue;
      const text = node.nodeValue.trim().replace(/\s+/g, ' ');
      if (/[a-z]/i.test(text) && !/[а-яіїєґ]/i.test(text)) found.add(text);
    }
    return [...found];
  });
  console.log('Remaining Latin text (product/person/machine identifiers):', untranslated.join(' | '));
  await context.close();

  for (const scenario of [
    { timezoneId: 'Europe/Kyiv', locale: 'en-US', expected: 'uk' },
    { timezoneId: 'Europe/London', locale: 'uk-UA', expected: 'uk' },
    { timezoneId: 'Europe/London', locale: 'de-DE', expected: 'en' },
  ]) {
    const fresh = await browser.newContext(scenario);
    const tab = await fresh.newPage();
    await tab.goto(process.env.PROMO_URL || 'http://127.0.0.1:8765/');
    assert.equal(await tab.locator('html').getAttribute('lang'), scenario.expected);
    await fresh.close();
  }
  const blocked = await browser.newContext({ locale: 'uk-UA', timezoneId: 'Europe/London' });
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    Object.defineProperty(document, 'cookie', { get() { throw new Error('Cookies blocked'); }, set() { throw new Error('Cookies blocked'); } });
  });
  const tab = await blocked.newPage();
  tab.on('pageerror', error => errors.push(error.message));
  await tab.goto(process.env.PROMO_URL || 'http://127.0.0.1:8765/');
  assert.equal(await tab.locator('html').getAttribute('lang'), 'uk');
  await tab.locator('[data-language-switch]').selectOption('en');
  assert.equal(await tab.locator('html').getAttribute('lang'), 'en');
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log('PASS: language detection, two-way cookie sharing, blocked storage, interactive state, desktop/mobile layout.');
} finally { await browser.close(); }
