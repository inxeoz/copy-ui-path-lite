# Handoff — corner-label-toggles

**Task:** Add four independent checkboxes to the Config panel — `show tl in hover`, `show tr
in hover`, `show bl in hover`, `show br in hover` — that hide each corner coordinate label
from the page while hovering, without removing it from the path.
**Done when:** unchecking one hides only that corner's label on hover, the other three still
show, the `[...]` corner block in the path preview / copied path still lists all four
corners, the state persists across reloads, and re-checking brings the label back.

## Context for this task

- **Two separate code paths, only one of them changes.** The corner labels drawn on the page
  come from `updateCornerLabels()` (`src/picker.core.js:840`), called once from `updateUI()`
  (`:942`). The corner text inside the path is a single `PART.CORNER` segment built in
  `buildPathData()` (`:461`) and is *not* per-corner. So the feature is entirely a gate in
  `updateCornerLabels()` — **do not touch `:461`**, that is the "still in path context" half
  of the requirement.
- **`updateCornerLabels()` sets all four to `display:block` unconditionally** (after the size
  early-return). The gate is four `if (settings[key])` checks around those four assignments,
  with `display:none` in the else branch.
- **The labels have no id and no class** (`:808-818`) — they are bare `div`s in
  `document.body`. Adding `el.className = 'ctp-corner ctp-corner-' + name` in that same loop
  costs one line and gives the harness (and any future CSS) something to hold. Recommended.
- **Ordering trap.** The generic toolbar-toggle loop (`:786-799`) runs *before* the corner
  labels exist (`:808`), and it calls `applyToolbarToggle(id)` during setup — so a corner id
  dropped into `TOOLBAR_TARGETS` (`:772`, id → shadow selector) would resolve `undefined` and
  throw. Either move corner-label creation above `:770`, or keep corners in a second map
  (id → the label element) with its own apply function. The map's values are shadow selectors;
  corners are not in the shadow tree.
- **Settings plumbing is already generic.** `:786-798` derives the storage key as
  `id.replace('opt-', '')`, seeds `box.checked` from `settings[key]`, writes back on `change`
  and calls `autoSave()` (`:632`, one debounced `ctp-lite-settings` record). Ids
  `opt-corner-tl/tr/bl/br` → keys `corner-tl/tr/bl/br` for free. All four must default to
  **on** (`settings[key] === undefined` → checked) so existing users see no change. Do not
  touch the legacy `settings.nav` migration at `:791` — it is only for the walk buttons.
- **A toggle change will not refresh the labels already on screen.** `updateUI()` early-returns
  when `el === currentEl` (`:908`), and `updateCornerLabels` is only called from it. The change
  handler must force a refresh — call `updateCornerLabels(currentEl.getBoundingClientRect())`
  directly, or null `currentEl` and re-enter `updateUI`. Without this the effect only appears
  after the pointer moves to a different element.
- **Labels only exist above a size threshold** — `SIZE_THRESHOLD_W = 100`,
  `SIZE_THRESHOLD_H = 40` (`:837-838`), and `updateCornerLabels` calls `hideCornerLabels()`
  below it (`:842`). Leave that as is; the harness must hover a big element (`<header>`,
  `<section>`), not the small inputs.
- **`hideCornerLabels()` (`:875`) hides all four** and is also called from `hidePicker()`
  (`:575`). Keep it as the blunt "hide everything" path; the gate is per-corner only in the
  show direction.
- Ruled out: touching the toolbar toggle behaviour, the center `z:` label
  (`updateCenterLabel`, `:882`), or making the path block per-corner (four `PART.*` parts) —
  the user asked only for the hover labels.

## Pointers

- `src/picker.core.js:840-880` `updateCornerLabels()` / `hideCornerLabels()` — the gate goes here.
- `src/picker.core.js:770-799` toolbar-toggle map + generic settings loop — extend, don't fork.
- `src/picker.core.js:807-818` corner-label creation — the elements to gate; recommended spot
  for a `ctp-corner-*` class so the harness can count them.
- `src/picker.core.js:907-908` `updateUI()` early-return — why the toggle needs a forced refresh.
- `src/picker.core.js:461` `PART.CORNER` — must stay untouched; this is the path context.
- `src/picker.core.js:622-640` settings load / `autoSave()` — persistence is already wired.
- `templates/picker_ui.j2:159-163` Config panel rows — copy the `opt-child` row shape for all four.
- `README.md:77-89` the UI contract's id list — the count (29) and the list both need the four new ids.
- `/tmp/opencode/verify.js:206-209` Config-tab id assertions — a loop, so new ids don't break it;
  add the new checks beside it.

## Commands

```bash
make ui          # render templates/picker_ui.j2 + themes/ into firefox/picker.js
make sync        # copy picker.js + icons into chromium/
make build       # package both
python3 tools/build_ui.py --check   # fail if picker.js is stale
node /tmp/opencode/verify.js        # 69 checks; add the new ones here
```

`src/picker.core.js` + `templates/picker_ui.j2` are the only files to edit; `firefox/picker.js`
and `chromium/picker.js` are generated — never hand-edit.

## Test harness (exists, ephemeral)

`/tmp/opencode/verify.js` drives the real `firefox/picker.js` in headless Chromium over CDP,
piercing the closed shadow root. Corner labels live in `document.body` (like the page
badges), so read them with plain `Runtime.evaluate` — filter on the new
`ctp-corner-*` classes, or fall back to text matching `tl[`/`tr[`/`bl[`/`br[`. Shape: hover a
>100×40 element with all four on → 4 labels shown; uncheck `opt-corner-tr` → 3 shown, `tr`
gone; assert `#path-display` still contains `tr=[`; re-check → 4 again. Keep the existing
`cnt('Copy')`-style text counts in mind — they count row buttons by text and are unaffected.

## Gotchas

- `make firefox` alone does **not** re-render; run `make ui` first or the xpi ships old UI.
- The Config panel floats above the 52px bar (`bottom:100%`) and scrolls, so four extra rows
  are safe — but assert the bar height stays `52px` (the harness already does).
- Corner labels are `pointer-events:none` `position:fixed` divs at `z-index:2147483646` —
  below the picker host but above the page. They never intercept clicks; leave that.
- Don't commit (standing rule in the global AGENTS.md).

## Open (?)

- Four independent boxes (assumed, from the request) or one "show corners" master plus four
  sub-boxes?
- Should a disabled corner still count in the element-info chip's dimensions? (No change
  proposed — the chip shows `w×h`, not corners.)

---

## Task
**Goal:** Let the user turn each corner coordinate label off independently in the Config
panel, while the corners stay in the path.
**Done:**
- [ ] Four Config checkboxes (`opt-corner-tl/tr/bl/br`) labelled `show tl/tr/bl/br in hover`
- [ ] Unchecked corner stops rendering in `updateCornerLabels()` on hover; the others still do
- [ ] All four still appear in the path preview and in the copied path (`PART.CORNER` untouched)
- [ ] Defaults to all four on; state persists via `autoSave()` and restores on reload
- [ ] Toggling refreshes labels for the currently hovered element without needing a re-hover
- [ ] Four-corner labels are countable (class hook) and the harness asserts on/off/on
- [ ] `README.md` id list + count updated
- [ ] `make ui && make sync && make build`, verified against the extracted xpi
**Constraints:** Edit `src/picker.core.js` + `templates/picker_ui.j2` only; reuse the existing
generic settings loop rather than adding a parallel one; no path-format changes.
**Start:** `src/picker.core.js:840` `updateCornerLabels()` — add the four gates, then read
`:770-799` to see how the existing `opt-*` ids get their keys and change handlers.
**Out of scope:** the center `z:` label, the toolbar toggle row semantics, per-corner path
parts, notes/badges.
**First step:** Add the four `if (settings[key])` gates in `updateCornerLabels()` around the
existing `display:block` assignments.
