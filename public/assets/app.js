/* Coding Lab landing page — interactions.
   State lives in the DOM: the page renders complete without JavaScript and
   these handlers only move it between states. */
(function () {
  'use strict';

  var t = function (text) { return window.CodingLabI18n ? window.CodingLabI18n.t(text) : text; };

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* -- Segmented controls: left/right arrows move between the options ----- */
  function wireArrowKeys(buttons) {
    buttons.forEach(function (btn, i) {
      btn.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                 : e.key === 'ArrowLeft'  || e.key === 'ArrowUp'   ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = buttons[(i + step + buttons.length) % buttons.length];
        next.focus();
        next.click();
      });
    });
  }

  /* -- 1 · Audience switch (hero copy, benefits and product preview) ------ */
  var audienceButtons = $$('[data-audience-set]');
  function setAudience(value) {
    document.body.setAttribute('data-audience', value);
    audienceButtons.forEach(function (btn) {
      var on = btn.getAttribute('data-audience-set') === value;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  }
  audienceButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setAudience(btn.getAttribute('data-audience-set')); });
  });
  wireArrowKeys(audienceButtons);
  if (audienceButtons.length) setAudience(document.body.getAttribute('data-audience') || 'teams');

  /* -- 2 · Access matrix: click a cell to give or remove access ----------- */
  function paintGrant(btn) {
    var granted   = btn.getAttribute('data-granted') === 'true';
    var isDefault = btn.getAttribute('data-default') === 'true';
    var label = $('.grant__label', btn);
    if (label) label.textContent = t(granted ? (isDefault ? 'Default' : 'Access') : 'Give access');
    btn.title = t(granted ? 'Click to remove access' : 'Click to give access');
    btn.setAttribute('aria-pressed', granted ? 'true' : 'false');
  }
  $$('[data-matrix] .grant').forEach(function (btn) {
    if (btn.disabled) return;
    paintGrant(btn);
    btn.addEventListener('click', function () {
      btn.setAttribute('data-granted', btn.getAttribute('data-granted') === 'true' ? 'false' : 'true');
      paintGrant(btn);
    });
  });

  /* -- 3 · Workspace overview: by project / person / subscription --------- */
  var statsTabs = $$('[data-stats-tab]');
  statsTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-stats-tab');
      statsTabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      $$('[data-stats-panel]').forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-stats-panel') !== key;
      });
    });
  });
  wireArrowKeys(statsTabs);

  /* -- 4 · Feature 1: pick the account the next conversation runs on ------ */
  var accountButtons = $$('[data-accounts] .account');
  var activeAccountLabel = $('[data-active-account]');
  accountButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      accountButtons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      if (activeAccountLabel) activeAccountLabel.textContent = btn.getAttribute('data-account-name');
    });
  });
  wireArrowKeys(accountButtons);
  function refreshTranslatedState() {
    $$('[data-matrix] .grant').forEach(function (btn) { if (!btn.disabled) paintGrant(btn); });
    var active = $('[data-accounts] [aria-checked="true"]');
    if (active && activeAccountLabel) activeAccountLabel.textContent = active.getAttribute('data-account-name');
    var firstName = $('[data-demo-firstname]');
    if (firstName) firstName.textContent = firstName.dataset.name || t('there');
  }
  document.addEventListener('codinglab:languagechange', refreshTranslatedState);
  refreshTranslatedState();

  /* -- 5 · Book a demo --------------------------------------------------- */

  /* Demo booking is closed for now: every "Book a demo" button opens a short
     "not open yet" panel instead of the form. Flip this to true (and wire the
     form's submit handler to the CRM) to turn booking back on. */
  var BOOKING_OPEN = false;

  var backdrop  = $('[data-demo-backdrop]');
  if (backdrop) {
    var dialog    = $('[data-demo-dialog]');
    var form      = $('[data-demo-form]');
    var done      = $('[data-demo-done]');
    var closed    = $('[data-demo-unavailable]');
    var nameInput = $('[data-demo-name]');
    var mailInput = $('[data-demo-email]');
    var honeypot  = $('[data-demo-honeypot]');
    var submitBtn = $('[data-demo-submit]');
    var errorNote = $('#demo-email-error');
    var sizePills = $$('[data-size]');
    var lastFocused = null;

    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var emailOk = function () { return EMAIL.test(mailInput.value.trim()); };

    function refreshSubmit() {
      submitBtn.setAttribute('aria-disabled', emailOk() ? 'false' : 'true');
    }

    function open() {
      lastFocused = document.activeElement;
      backdrop.hidden = false;
      document.body.classList.add('is-locked');
      done.hidden = true;
      errorNote.hidden = true;

      if (!BOOKING_OPEN) {
        form.hidden = true;
        closed.hidden = false;
        dialog.setAttribute('aria-labelledby', 'demo-unavailable-title');
        $('[data-demo-close]', closed).focus();
        return;
      }

      closed.hidden = true;
      form.hidden = false;
      dialog.setAttribute('aria-labelledby', 'demo-title');
      refreshSubmit();
      nameInput.focus();
    }

    function close() {
      backdrop.hidden = true;
      document.body.classList.remove('is-locked');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    $$('[data-demo-open]').forEach(function (btn) { btn.addEventListener('click', open); });
    $$('[data-demo-close]').forEach(function (btn) { btn.addEventListener('click', close); });

    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    dialog.addEventListener('click', function (e) { e.stopPropagation(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !backdrop.hidden) close();
    });

    mailInput.addEventListener('input', function () {
      refreshSubmit();
      if (emailOk()) errorNote.hidden = true;
    });

    sizePills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var alreadyOn = pill.getAttribute('aria-pressed') === 'true';
        sizePills.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });
        pill.setAttribute('aria-pressed', alreadyOn ? 'false' : 'true');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!emailOk()) {
        errorNote.hidden = false;
        mailInput.focus();
        return;
      }
      // Honeypot filled in means a bot: swallow it and show the same success.
      if (!honeypot.value) {
        /* TODO before launch: POST to the CRM or form endpoint here, and track
           the submit event. The prototype deliberately sends nothing. */
      }
      var first = nameInput.value.trim().split(/\s+/)[0] || '';
      $('[data-demo-firstname]').dataset.name = first;
      $('[data-demo-firstname]').textContent = first || t('there');
      $('[data-demo-sent-to]').textContent = mailInput.value.trim();
      form.hidden = true;
      done.hidden = false;
      $('[data-demo-close]', done).focus();
    });

    // Keep focus inside the dialog while it is open.
    backdrop.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusable = $$('button, input, a[href]', dialog).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
})();
