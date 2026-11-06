# coding-lab-promo

The Coding Lab marketing site: `coding-lab.co`. It is a **static site, no build
step** — plain HTML, one stylesheet and one small script. Open
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
`app.js` only moves it between states.

| What | Where | Behaviour |
|---|---|---|
| Audience switch | hero | `data-audience` on `<body>` swaps the H1, the sub, the benefit cards and the product preview. Default: companies. |
| Access matrix | For companies | Click a cell to give or remove access. Alex's personal account is locked and blank for everyone else. Decorative: it resets on reload. |
| Overview tabs | For companies | By project / person / subscription swaps the table next to the chart. |
| Account list | Feature 01 | Click a row to make it active; the footer line follows. |
| Book a demo | every "Book a demo" button | Modal with name, work email and team size. "Request a demo" stays dimmed until the email is valid. |

Motion (the pulsing status dots, the blinking "working…") is turned off under
`prefers-reduced-motion`.

## Still to do before launch

- **Sample content.** Every person, company, project, repo, machine and number
  on the page is invented (Northwind Studio, orbit-web, Alex Rivera, …). Keep
  them invented or replace them with real, approved examples — and either
  replace the figures in the workspace overview or keep its "sample data" tag.
- **Wire the demo form.** `app.js` has the submit handler and a honeypot field,
  but it deliberately sends nothing: point it at the CRM or form endpoint and
  track the submit event.
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
