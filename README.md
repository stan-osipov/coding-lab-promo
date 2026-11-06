# coding-lab-promo

The Coding Lab marketing site: `coding-lab.co`. It is a **static site, no build
step** — plain HTML, one stylesheet and small browser scripts. Open
`public/index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000 --directory public
```

## Layout

```
public/
  index.html        the whole landing page
  assets/styles.css design tokens and components
  assets/app.js     the interactive bits (see below)
  assets/ua.js      Ukrainian copy, keyed by English source phrases
  assets/i18n.js    text bindings and the language switch
  assets/locale-policy.js language detection and shared-cookie contract
  og-image.png      1200×630 social preview
  favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest
tools/
  og-image.html     the source the social preview is rendered from
```

All asset paths in `index.html` are **relative**, so the folder works served
from a domain root or from a sub-path.

## Where it came from

Built from the `design_handoff_landing` handoff (Landing.dc.html + README),
which was itself built from the *Coding Lab — Pitch Deck* working doc.
Every product view on the page — the previews, the tables, the chart — is real
HTML and CSS, not a screenshot, so it stays sharp and can be translated.
Icons are inline Lucide-style SVG `<symbol>`s at the top of `index.html`.

The brand mark is the Coding Lab flask, taken from
`capital-wizard/logos/coding-lab-app-icons/web/` (the icon handoff). To update
it, copy that folder's `web/*` over the files in `public/` again.

## Interactions

State lives in the DOM; the page renders complete without JavaScript and
`app.js` moves it between states. Without JavaScript the complete English page remains available.

| What | Where | Behaviour |
|---|---|---|
| Language switch | top bar | Compact EN / UA buttons with the active language highlighted; supports keyboard arrows and translates both audiences, product previews, accessibility labels and the closed-demo panel. |
| Audience switch | hero | `data-audience` on `<body>` swaps the H1, the sub, the benefit cards and the product preview. Default: companies. |
| Access matrix | For companies | Click a cell to give or remove access. Alex's personal account is locked and blank for everyone else. Decorative: it resets on reload. |
| Overview tabs | For companies | By project / person / subscription swaps the table next to the chart. |
| Account list | Feature 01 | Click a row to make it active; the footer line follows. |
| Book a demo | every "Book a demo" button | **Booking is closed right now**: the modal says so and offers "Get started" instead. Set `BOOKING_OPEN = true` in `app.js` to bring back the form (name, work email, team size; "Request a demo" stays dimmed until the email is valid). |

Motion (the pulsing status dots, the blinking "working…") is turned off under
`prefers-reduced-motion`.

## Still to do before launch

- **Sample content.** Every person, company, project, repo, machine and number
  on the page is invented (Northwind Studio, orbit-web, Alex Rivera, …). Keep
  them invented or replace them with real, approved examples — and either
  replace the figures in the workspace overview or keep its "sample data" tag.
- **Open demo booking.** The form, its validation and a honeypot field are all
  in place but switched off behind `BOOKING_OPEN` in `app.js`, and the submit
  handler deliberately sends nothing. To open booking: point the handler at the
  CRM or form endpoint, track the submit event, then flip the flag.
- **Verify the claims** in the handoff's "Before launch" list against the
  product: per-account and per-person cost tracking, flagging of shared
  secrets, the mobile and iPad apps, the preconfigured agents, and per-machine
  environments.
- **Analytics**, and the real canonical/OG URLs if the domain changes.
- **Hosting.** Nothing in the repo picks one yet, and GitHub Pages is not
  enabled on it. Pages serves the repository root or `/docs`, so deploying
  that way means moving these files up out of `public/`; a host with a
  configurable publish directory (Netlify, Cloudflare Pages, Vercel) can point
  at `public/` as it stands.

## Regenerating the social preview

```sh
python3 -m http.server 8000 &
"$CHROME" --headless --window-size=1200,630 \
  --screenshot=public/og-image.png http://127.0.0.1:8000/tools/og-image.html
```

## Language and application sharing

The app and promo use `en` / `ua` internally; Ukrainian HTML uses the standard
`lang="uk"`. Detection follows the application:

1. A supported `?lng=` choice (`uk-UA` is accepted too).
2. The `coding_lab_locale` preference shared across `coding-lab.co` subdomains.
3. This origin’s saved `cw:locale` choice.
4. A Ukrainian timezone (`Europe/Kyiv`, `Kiev`, `Uzhgorod`, `Zaporozhye`).
5. The first supported browser language, then English.

An explicit switch is remembered locally and, on HTTPS Coding Lab hosts, in a
one-year `Secure; SameSite=Lax; Path=/; Domain=coding-lab.co` preference cookie.
It contains only `en` or `ua`. Automatic promo detection does not publish a
preference, so merely visiting the promo cannot replace a signed-in account’s
saved language. Every app CTA carries `?lng=en` or `?lng=ua`, including when
storage is blocked or the promo is hosted on a preview domain.

The companion application change in `capital-wizard/src/lib/codingLabLocale.ts`
and `i18n.ts` reads the cookie before local storage, writes it on app language
changes (including account hydration), and follows changes when a tab regains
focus or becomes visible. `accountLanguageSync.ts` adopts an explicit shared
browser choice over an older account preference. Without a shared choice, the
saved account language still wins. Capital Wizard hosts do not use this cookie.
Sharing is within one browser; the promo does not read authentication data.

`ua.js` contains plain-text translations, not HTML. `i18n.js` binds matching
English text nodes and attributes without replacing the page’s markup or
interactive state. Add a translation when adding English copy; the coverage
test flags missing phrases. `tests/untranslated-names.json` lists the product,
person, repository and machine identifiers that intentionally stay unchanged.
Page titles/descriptions change in the browser; the static social preview image
and metadata seen by crawlers that do not execute JavaScript remain English.

## Verification

There is no production build step. Node is only needed for development checks:

```sh
npm ci
npm test
npm run check
npx playwright install chromium
```

With the static server above running on port 8000:

```sh
PROMO_URL=http://127.0.0.1:8000 npm run test:browser
```

The browser suite serves local files at intercepted HTTPS Coding Lab origins in
an isolated context to verify real parent-domain cookie behavior. It never
opens the production app. It also checks Ukrainian timezone/browser detection,
blocked storage, language changes without losing interaction state, demo copy,
and layouts from 320 to 1440 pixels. Set `SCREENSHOT_DIR` to save previews.
The companion app has detector integration tests plus cookie/account precedence
unit tests. Keep the two repositories’ cookie name, scope and detector order in
sync when changing the language policy.
