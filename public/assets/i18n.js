/* Bind the existing English text nodes once, preserving icons, inline emphasis,
   event listeners and input values. Only phrases in ua.js are translated. */
(function () {
  'use strict';
  var policy = window.CodingLabLocale;
  var copy = window.CodingLabUkrainian;
  var language = 'en';
  var bindings = [];
  var originalLinks = [];
  var has = function (key) { return Object.prototype.hasOwnProperty.call(copy, key); };
  function translate(text) { return language === 'ua' && has(text) ? copy[text] : text; }
  function readCookie() {
    try { return policy.sharedHost(location.hostname) ? document.cookie : ''; } catch (_) { return ''; }
  }
  function readSaved() {
    try { return localStorage.getItem('cw:locale'); } catch (_) { return null; }
  }
  function remember(value, shared) {
    try { localStorage.setItem('cw:locale', value); } catch (_) { /* Private browsing. */ }
    if (shared) {
      try {
        var cookie = policy.cookieValue(value, location.hostname);
        if (cookie) document.cookie = cookie;
      } catch (_) { /* Links still carry the language when cookies are blocked. */ }
    }
  }
  var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest('script, style, svg, [data-active-account], [data-demo-firstname], [data-demo-sent-to]')) continue;
    var source = node.nodeValue;
    var phrase = source.trim().replace(/\s+/g, ' ');
    if (has(phrase)) bindings.push({ node: node, source: source, phrase: phrase });
  }
  document.querySelectorAll('[title], [aria-label], [placeholder], [data-account-name], meta[content]').forEach(function (element) {
    ['title', 'aria-label', 'placeholder', 'data-account-name', 'content'].forEach(function (attr) {
      var source = element.getAttribute(attr);
      if (source && has(source)) bindings.push({ node: element, attr: attr, source: source, phrase: source });
    });
  });
  document.querySelectorAll('a[href]').forEach(function (link) {
    var url = new URL(link.href);
    if (url.origin === 'https://app.coding-lab.co') originalLinks.push({ node: link, url: url.href });
  });
  var switcher = document.querySelector('[data-language-switch]');
  var languageButtons = Array.from(switcher.querySelectorAll('[data-language-set]'));
  function render(value, explicit) {
    language = policy.normalize(value) || 'en';
    bindings.forEach(function (binding) {
      var translated = translate(binding.phrase);
      if (binding.attr) binding.node.setAttribute(binding.attr, translated);
      else binding.node.nodeValue = binding.source.replace(/\S[\s\S]*\S|\S/, translated);
    });
    document.documentElement.lang = language === 'ua' ? 'uk' : 'en';
    document.querySelector('meta[property="og:locale"]').content = language === 'ua' ? 'uk_UA' : 'en_US';
    languageButtons.forEach(function (button) {
      var selected = button.getAttribute('data-language-set') === language;
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    });
    originalLinks.forEach(function (link) {
      var url = new URL(link.url);
      url.searchParams.set('lng', language);
      link.node.href = url.href;
    });
    var url = new URL(location.href);
    if (explicit || url.searchParams.has('lng')) {
      url.searchParams.set('lng', language);
      try { history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch (_) { /* file:// */ }
    }
    document.dispatchEvent(new CustomEvent('codinglab:languagechange'));
  }
  var query = new URLSearchParams(location.search).get('lng');
  var saved = readSaved();
  var cookie = readCookie();
  var timezone = '';
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { /* Browser language follows. */ }
  window.CodingLabI18n = { t: translate, language: function () { return language; } };
  render(policy.detect({ query: query, cookie: cookie, saved: saved, timezone: timezone, languages: navigator.languages || [navigator.language] }));
  // Inferred defaults stay local. An explicit choice (including an existing saved
  // preference) crosses subdomains; a first visit cannot overwrite the app's account.
  if (policy.normalize(query) || policy.cookieLanguage(cookie) || policy.normalize(saved)) remember(language, true);
  switcher.hidden = false;
  languageButtons.forEach(function (button, index) {
    button.addEventListener('click', function () {
      render(button.getAttribute('data-language-set'), true);
      remember(language, true);
    });
    button.addEventListener('keydown', function (event) {
      var direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      var next = languageButtons[(index + direction + languageButtons.length) % languageButtons.length];
      next.focus();
      next.click();
    });
  });
  function refreshSharedLanguage() {
    var shared = policy.cookieLanguage(readCookie()) || policy.normalize(readSaved());
    if (shared && shared !== language) {
      render(shared);
      remember(language, false);
    }
  }
  window.addEventListener('focus', refreshSharedLanguage);
  window.addEventListener('pageshow', refreshSharedLanguage);
  window.addEventListener('storage', refreshSharedLanguage);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshSharedLanguage();
  });
})();
