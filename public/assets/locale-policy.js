/* Browser language policy. Keep the cookie contract in sync with
   capital-wizard/src/lib/codingLabLocale.ts and detector order in i18n.ts. */
(function (root) {
  'use strict';
  function normalize(value) {
    var base = typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : '';
    return base === 'uk' || base === 'ua' ? 'ua' : base === 'en' ? 'en' : null;
  }
  function sharedHost(host) {
    return host === 'coding-lab.co' || host.endsWith('.coding-lab.co');
  }
  function cookieLanguage(cookie) {
    var pair = cookie.split(';').map(function (part) { return part.trim(); })
      .find(function (part) { return part.startsWith('coding_lab_locale='); });
    return normalize(pair && pair.slice('coding_lab_locale='.length));
  }
  function cookieValue(language, host) {
    var value = normalize(language);
    return sharedHost(host) && value
      ? 'coding_lab_locale=' + value + '; Domain=coding-lab.co; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
      : null;
  }
  function detect(options) {
    return normalize(options.query) || cookieLanguage(options.cookie || '') || normalize(options.saved)
      || (/^Europe\/(Kyiv|Kiev|Uzhgorod|Zaporozhye)$/.test(options.timezone) ? 'ua' : null)
      || (options.languages || []).map(normalize).find(Boolean) || 'en';
  }
  root.CodingLabLocale = { normalize: normalize, sharedHost: sharedHost, cookieLanguage: cookieLanguage, cookieValue: cookieValue, detect: detect };
})(typeof window === 'undefined' ? globalThis : window);
