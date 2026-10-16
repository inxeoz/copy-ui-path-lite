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
src/         picker.core.js — picker backend logic (never templated)
templates/   picker_ui.j2 — the picker UI markup (Jinja2)
themes/      carbon.json (default), midnight.json, paper.json — UI color tokens
tools/       build_ui.py — renders template + theme into firefox/picker.js
docs/        a3-design-reference.html — static mock of the default theme
firefox/     Firefox extension source (MV2) — background.js, picker.js*, icons/, manifest.json
chromium/    Chromium extension source (MV3) — background.js, picker.js*, icons/, manifest.json
store/       Store listing assets (appstore.png)
dist/        Build output (gitignored)
Makefile     Build / sync / lint / run helpers
```

\* `picker.js` is a generated file — see [UI templating](#ui-templating).

## UI templating

The picker's UI is separated from its logic, so you can restyle the dialog without
touching backend behavior:

| Piece | File | Edit it to… |
|---|---|---|
| Backend logic | `src/picker.core.js` | change path building, multi-pick, clipboard, freeze/walk |
| UI markup | `templates/picker_ui.j2` | change layout, add/remove buttons, reorder the sidebar |
| Colors / fonts | `themes/<name>.json` | reskin (backgrounds, accent, path colors, radius, sidebar width) |

`firefox/picker.js` is **generated**: `tools/build_ui.py` renders the template with a
theme and injects it into the core at the `/*__CTP_UI__*/` marker. Never edit it by hand.

```bash
make themes                  # list available themes
make ui                      # re-render with the default theme (themes/default.txt)
make ui THEME=paper          # render a one-off theme
make ui THEME=/path/my.json  # render a custom theme file
make ui-check                # fail if firefox/picker.js is stale
make sync && make build      # push to chromium/ and package
```

`make build` runs `make ui` first, so packages always contain the current template.

### Changing the theme

1. Edit `themes/carbon.json` (or copy it to a new file).
2. `make ui && make sync && make build`.

### Making a new theme

```bash
cp themes/carbon.json themes/ocean.json
$EDITOR themes/ocean.json          # any token in the file
echo ocean > themes/default.txt    # optional: make it the default
make ui THEME=ocean
```

Every token is documented by example in the existing theme files. `path_colors`
controls the syntax colors of the path preview (`url`, `path_tid`, `ctx_key`, …).

### Changing the layout

Edit `templates/picker_ui.j2`. The backend binds to the UI by **element id** and a few
**class hooks** — keep these and any layout works:

- ids (28): `overlay`, `ocean`, `island`, `dialog`, `dialog-header`, `el-info`,
  `settingsPanel`, `saveState`, `path-display`, `queue-list`, `queue-count`,
  `sep-select`, `copyAllBtn`, `clearBtn`, `closeAfterCopy`, `multiBtn`, `quitBtn`,
  `stepBackBtn`, `stepNextBtn`, `format-select`, `configBtn`, `config-checks`,
  `config-custom`, `copyIdBtn`, `copyBtn`, `opt-nav`, `opt-move`, `opt-settings`,
  `opt-info`
- classes: `tab` + `data-tab` on the tab buttons, `panel` + `data-panel` on the panels,
  `active` (`#multiBtn`, settings tabs), `open` (`#dialog`, `.preview-actions`),
  `has-items` (`#queue-list`), `closing`, `frozen` (`#dialog` / `#overlay`), plus the
  queue row classes `preview-row`, `n`, `path-text`, `preview-body`, `row-actions`
  (`copy-one`, `add-note`, `view-one`), `preview-notes` / `note` / `note-editor`,
  and `expanded` (a row whose full path is showing)

`#settingsPanel` starts `hidden` and is toggled by `#configBtn`. Keep it out of the
dialog's normal flow (`position: absolute; bottom: 100%`) — a fixed, auto-height box
keeps its top edge when its content grows, so an in-flow panel would open below the
bottom of the viewport.

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

### The picker UI

The picker opens as a compact **toolbox bar** — copy, freeze, multi-pick, settings, quit —
with the settings panel collapsed. Click **⚙** to open it above the bar; the panel is
organised into three tabs:

| Tab | What is in it |
|---|---|
| **Style** | computed-property presets, the property list, and a custom comma-separated list |
| **Config** | path format, separator for multiple paths, close-after-copy, and which toolbar controls to show |
| **Path Preview** | the live path for the hovered element, the picked-path list, and the copy actions |

Every picked path gets its own row with **Copy**, **Add Details** and **View Path** —
Copy grabs that single path, Add Details attaches a note describing what the path is
for (notes are keyed by path text, so they return when you re-pick the same element),
and View Path expands the row to show the path in full. Once a second path is picked
the toolbar's primary button switches from **Copy Path** to **Copy All Path**.

Everything saves itself as you change it — there is no Save button. Changes are written to
`localStorage` under `ctp-lite-settings` (styles), `ctp-lite-notes` (path details), and
`ctp-lite-computed-props` (the style list), and the indicator in the panel header shows
`Saving…` / `Saved ✓`. The last tab you used is remembered for the next time the panel opens.

- **Format select** — `Context` (rich, annotated, default), `XPath`, `CSS`, `Playwright`.
- **Freeze navigation** — right-click freezes the current target, then `To Parent` /
  `To Child` walk the saved path; left-click unfreezes.
- **Computed style** — pick which computed properties are appended to the path
  (colors get an inline swatch); the selection is stored in `localStorage`.
- **Copy Selected id** — copies just the element's `data-testid` / `id`
  (disabled when the element has neither).
- Overlay extras: viewport corner labels, element size, and a center `z:<n>` label.

### Chromium picker

Same picker as Firefox. The picker is browser-agnostic (no `browser.*` / `chrome.*`
calls), so both builds ship the identical generated file — run `make sync` after
`make ui` to copy it (and the icons) into `chromium/`.

## Copied path anatomy

Paths are built from a set of test attributes, in order:
`data-testid`, `data-test`, `data-cy`, `data-qa`, `data-automation-id`,
`data-automation`, `data-e2e`, `data-test-id`, `data-component`, `data-element`.

```text
checkout | section[1] > form[2] > button[1](#sign-in)          → Context (default)
/body/section[1]/form[2]/button[1]                             → XPath
section:nth-child(1) > form:nth-child(2) > #sign-in            → CSS
section[1] > form[2] > btn:submit                              → Playwright
```

Annotation rules honored by the path builder:

- `data-test-context="name"` — prefixes the path with `name | `.
- `data-testlabel="…"` — appended to the test id, e.g. `card:product[data-testlabel="Jacket"]`.
- `data-testignore` — the element is skipped when walking up.
- `{shadow}` markers mark shadow-DOM boundaries.

## Build

```bash
make            # render UI, then both packages into dist/
make ui         # render templates/ + themes/ into firefox/picker.js
make themes     # list UI themes
make sync       # copy firefox/picker.js + icons into chromium/ (shared source)
make firefox    # dist/copy-ui-path-lite-firefox-<version>.xpi
make chromium   # dist/copy-ui-path-lite-chromium-<version>.zip
make lint       # web-ext lint on firefox/ (needs Node)
make clean      # remove dist/ and web-ext-artifacts/
make version    # print manifest versions
```

`zip` is the only build dependency for packaging (the `.xpi` is a plain zip).

## Versions

Both builds share one version number — currently **1.10.1**. `firefox/manifest.json`
is the single source of truth; `make sync` copies its version into
`chromium/manifest.json`, and every build runs `make check-versions` first, so the
two can never drift apart.

```bash
# release a new version
edit firefox/manifest.json   # bump "version"
make sync                    # pushes version + picker.js + icons into chromium/
make                         # fails if versions ever differ
