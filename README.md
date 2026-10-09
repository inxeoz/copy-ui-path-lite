# copy-ui-path-lite

Lightweight browser extension that lets you hover any element on a page and copy its
selector path for E2E tests — Playwright, Cypress, or plain CSS / XPath.

Ships as a single codebase with two builds:

| Browser | Source dir | Manifest | Package |
|---|---|---|---|
| Firefox / AMO | [`firefox/`](firefox/) | V2 | `.xpi` |
| Chrome / Edge / Chromium | [`chromium/`](chromium/) | V3 | `.zip` |

## Project layout

```
firefox/     Firefox extension source (MV2) — background.js, picker.js, icons/, manifest.json
chromium/    Chromium extension source (MV3) — background.js, picker.js, manifest.json
store/       Store listing assets (appstore.png)
dist/        Build output (gitignored)
Makefile     Build / lint / run helpers
```

## Install (development)

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Select `firefox/manifest.json`

Or run it in a throwaway profile:

```bash
make run-firefox     # needs Node; uses npx web-ext
```

### Chromium

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. **Load unpacked** → select the `chromium/` folder

## How to use

1. Click the toolbar icon, press `Ctrl+Shift+X`, or right-click → **Copy Path**.
2. The page dims and a spotlight follows your cursor. The path preview updates live
   in the floating dialog.
3. Click an element to copy its path — a toast confirms and the picker closes.
4. `Esc` closes the picker without copying. Drag the dialog header to move it.

The overlay is injected as a closed shadow DOM, so it does not leak styles or script
into the page.

### Firefox picker

- **Format select** — `Context` (rich, annotated, default), `XPath`, `CSS`, `Playwright`.
- **Freeze navigation** — right-click freezes the current target, then `To Parent` /
  `To Child` walk the saved path; left-click unfreezes.
- **⚙ computed style** — pick which computed properties are appended to the path
  (colors get an inline swatch); the selection is stored in `localStorage`.
- **Copy Selected id** — copies just the element's `data-testid` / `id`
  (disabled when the element has neither).
- Overlay extras: viewport corner labels, element size, and a center `z:<n>` label.

### Chromium picker

Minimal version: hover, preview, click to copy `URL | path [z-index="…"]`.
Same overlay, toast, drag, `Esc`, and **Copy Selected id** button, but no format
select, computed-style panel, or freeze navigation.

## Copied path anatomy

Paths are built from a set of test attributes, in order:
`data-testid`, `data-test`, `data-cy`, `data-qa`, `data-automation-id`,
`data-automation`, `data-e2e`, `data-test-id`, `data-component`, `data-element`.

```text
checkout | section[1] > form[2] > button[1](#sign-in)   → Context (Firefox)
/body/section[1]/form[2]/button[1]                       → XPath  (Firefox)
section:nth-child(1) > form:nth-child(2) > #sign-in      → CSS    (Firefox)
section[1] > form[2] > btn:submit                        → Playwright (Firefox)
https://example.com/checkout | section[1] > form[2] > … [z-index="auto"]  → Chromium
```

Annotation rules honored by the path builder:

- `data-test-context="name"` — prefixes the path with `name | `.
- `data-testlabel="…"` — appended to the test id, e.g. `card:product[data-testlabel="Jacket"]`.
- `data-testignore` — the element is skipped when walking up.
- `{shadow}` markers mark shadow-DOM boundaries in Firefox.

## Build

```bash
make            # both packages into dist/
make firefox    # dist/copy-ui-path-lite-firefox-<version>.xpi
make chromium   # dist/copy-ui-path-lite-chromium-<version>.zip
make lint       # web-ext lint on firefox/ (needs Node)
make clean      # remove dist/ and web-ext-artifacts/
make version    # print manifest versions
```

`zip` is the only build dependency for packaging (the `.xpi` is a plain zip).

## Versions

- Firefox: read from [`firefox/manifest.json`](firefox/manifest.json)
- Chromium: read from [`chromium/manifest.json`](chromium/manifest.json)

The two builds version independently.
