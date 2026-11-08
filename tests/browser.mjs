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
  const english = page.getByRole('radio', { name: 'English', exact: true });
  const ukrainian = page.getByRole('radio', { name: 'Українська', exact: true });
  assert.equal(await english.getAttribute('aria-checked'), 'true');
  await english.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await ukrainian.getAttribute('aria-checked'), 'true');
  assert.equal(await ukrainian.evaluate(button => button === document.activeElement), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await english.getAttribute('aria-checked'), 'true');
  await page.locator('[data-language-set="ua"]').click();
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
  await page.locator('[data-language-set="en"]').click();
  assert.equal(await grant.locator('.grant__label').textContent(), 'Access');
  assert.equal(await page.locator('[data-active-account]').textContent(), 'API key · Company');
  assert.equal(await page.locator('[data-stats-tab="people"]').getAttribute('aria-selected'), 'true');
  await page.locator('[data-language-set="ua"]').click();
  await page.locator('[data-audience-set="developers"]').click();
  assert.equal(await page.locator('body').getAttribute('data-audience'), 'developers');
  assert.match(await page.locator('.h1 .for-dev').innerText(), /кожному вашому пристрої/);

  // Handoff v2: linked benefits, working sample audits and local models.
  await page.locator('[data-language-set="en"]').click();
  await page.locator('[data-audience-set="teams"]').click();
  assert.equal(await page.locator('.benefits.for-teams .benefit').count(), 6);
  assert.equal(await page.locator('.benefits.for-dev .benefit').count(), 4);
  for (const link of await page.locator('.benefits.for-teams .benefit').all()) {
    const target = await link.getAttribute('href');
    assert.equal(await page.locator(target).count(), 1, `Missing benefit target ${target}`);
  }
  await page.locator('[data-prompt-filter="flagged"]').click();
  assert.equal(await page.locator('[data-prompt-state]:visible').count(), 2);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-prompt-filter="reviewed"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-prompt-state]:visible').count(), 1);
  await page.locator('[data-language-set="ua"]').click();
  assert.equal(await page.locator('[data-prompt-filter="reviewed"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-prompt-state]:visible').count(), 1);
  assert.match(await page.locator('[data-prompt-state]:visible').innerText(), /Перевірено · схвалено/);
  await page.locator('[data-prompt-filter="all"]').click();
  assert.equal(await page.locator('[data-prompt-state]:visible').count(), 4);
  await page.locator('[data-accounts] .account').last().click();
  assert.equal(await page.locator('[data-active-account]').textContent(), 'Qwen3 Coder · локальна');
  await page.locator('[data-language-set="en"]').click();
  assert.equal(await page.locator('[data-active-account]').textContent(), 'Qwen3 Coder · local');
  const localGrant = page.locator('.matrix__row').first().locator('.grant').last();
  assert.equal(await localGrant.getAttribute('data-granted'), 'true');
  await localGrant.click();
  assert.equal(await localGrant.getAttribute('aria-pressed'), 'false');
  await localGrant.click();
  assert.equal(await localGrant.getAttribute('aria-pressed'), 'true');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-export-usage]').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'coding-lab-sample-usage.csv');
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  assert.equal(csv.trim().split('\r\n').length, 6);
  assert.match(csv, /"Over session budget"/);
  assert.match(csv, /Qwen3 Coder/);
  assert.match(csv, /"\$0.00"/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.benefit').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('.mini-redact').evaluate(el => getComputedStyle(el).animationName), 'none');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const lang of ['en', 'ua']) {
      await page.locator(`[data-language-set="${lang}"]`).click();
      for (const audience of ['teams', 'developers']) {
        await page.locator(`[data-audience-set="${audience}"]`).click();
        const visible = audience === 'teams' ? 'for-teams' : 'for-dev';
        assert.equal(await page.locator(`.preview.${visible}`).isVisible(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang}/${audience} overflows at ${width}`);
        const cards = await page.locator(`.benefits.${visible} .benefit`).evaluateAll(els => els.map(el => ({ x: el.offsetLeft, y: el.offsetTop })));
        if (width === 1440) assert.equal(new Set(cards.map(c => c.y)).size, audience === 'teams' ? 2 : 1);
        if (process.env.SCREENSHOT_DIR && [1440, 390].includes(width)) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/benefits-${lang}-${audience}-${width}.png` });
        }
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-language-set="ua"]').click();

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
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/promo-ua-${width}.png` });
    }
    await page.locator('[data-language-set="en"]').click();
    const englishWidth = await page.locator('.topbar__cta').evaluate(element => element.getBoundingClientRect().right);
    assert.ok(englishWidth <= width, `English header overflows at ${width}: ${englishWidth}`);
    await page.locator('[data-language-set="ua"]').click();
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
  await tab.locator('[data-language-set="en"]').click();
  assert.equal(await tab.locator('html').getAttribute('lang'), 'en');
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log('PASS: language detection, two-way cookie sharing, blocked storage, interactive state, desktop/mobile layout.');
} finally { await browser.close(); }
