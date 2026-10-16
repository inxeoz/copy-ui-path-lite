# Handoff — unselect-picked-path

**Task:** Let the user remove a picked path two ways — an `×` on its Path Preview row, and
hovering the numbered page badge to reveal an `×` that removes it.
**Done when:** Both removal routes work, the queue renumbers 1..n after either, the badge
disappears and its element's dashed outline is restored, and adding the same element again
works after removal.

## Context for this task

- **`removeItem(el)` already exists and has zero callers.** It removes the badge, splices
  `collected`, calls `renumberBadges()` + `renderQueue()`. It is dead code left over from
  when a `×` was deleted from the row. Wire it; do not rewrite it.

- **Two deliverables, one function.** The row button and the badge button both end at the
  same `removeItem(item.el)` + `stopPropagation()`. Only the markup and the click target
  differ. Do not fork the logic.

### Row route (straightforward)

- Row markup is built imperatively in `renderQueue()`. The three existing buttons append at
  one place — add the fourth beside them, in the same style.

### Badge route (this is the fiddly one)

- **The badge is `pointer-events: none`** (`src/picker.core.js:960`, inside the inline
  `cssText`). It can never be hovered until that flips to `auto`. That single property is
  the whole obstacle.

- **Consequence of flipping it:** the badge is a 20px pill parked at `rect.top - 24`, i.e.
  just *above* the element it tags. With `pointer-events:auto` that small area no longer
  forwards hover to the overlay. Acceptable, but it means you cannot hover-highlight the
  page directly under a badge.

- **`renumberBadges()` will silently destroy any child element you add to the badge.**
  It does `badgeEl.textContent = String(i + 1)` (`:993`), which wipes all children. If the
  `×` is a child node it vanishes on the very next removal. Restructure the badge as
  wrapper → `<span class="ctp-badge-n">` + `<button class="ctp-badge-x">×</button>` and
  renumber only the span. `addBadge` (`:959`) also sets `b.textContent`, so it needs the
  same split at creation.

- **Hover reveal needs a real stylesheet, not inline styles.** Inline `cssText` cannot
  express `.badge:hover .badge-x { display: inline-flex }`. There is already a `<style>`
  injected into `document.head` and removed on quit (`injectedStyle`, `:9`) — that is the
  right home for badge rules. Keep the base look in `cssText` (or move it wholesale into
  `injectedStyle`; either is fine, just be consistent).

- **Click isolation.** `onOverlayClick` (`:1365`) resolves the target with
  `elFromPoint(e.clientX, e.clientY)`. Clicking the `×` must `preventDefault()` +
  `stopPropagation()`. The badge lives in `document.body`, not inside the overlay's shadow
  tree, so the overlay's listener will not receive the event anyway — but guard it, because
  `document`-level listeners elsewhere do receive bubbled clicks.

- **Hover highlight pauses over badges, by design.** `onMouseMove` is bound to the overlay
  only (`:1480`); a mousemove over a badge with `pointer-events:auto` never reaches it. So
  the live path preview freezes while the pointer sits on a badge. This is actually
  desirable here — the `×` is hoverable rather than the pass-through being broken — but if
  you wire mouseenter/mouseleave on the badge instead of CSS, remember the highlight is not
  tracking, so don't expect `currentEl` to be current.

- **Badge colors are hardcoded** (`#FFD700` / `#1E3A5F` at `:960`) and are the one piece of
  chrome that ignores theming. Decide: theme it now or leave it. Not blocking.

- **Notes survive removal.** Details live in `localStorage` under `ctp-lite-notes`, keyed
  by path text, and re-attach when the same element is re-picked. Removing a path keeps its
  notes. `removeNote(item, txt)` exists if you want removal to also drop them (see Open).

- **Ruled out:** do not touch the toolbar, and do not reuse the global `Clear` — both act
  on the whole queue. This is per-row / per-badge.

## Pointers

- `src/picker.core.js:1132-1134` `renderQueue()` — the three `actions.appendChild(...)`
  calls; insertion point for the row `×`.
- `src/picker.core.js:1086-1090` `renderQueue()` — `.preview-row` + `.n` number badge.
- `src/picker.core.js:955-966` `addBadge()` — badge creation; `:959` is the `textContent`
  clobber, `:960` is the inline `cssText` holding `pointer-events:none`.
- `src/picker.core.js:968-971` `positionBadge()` — left/top placement (`rect.top - 24`).
- `src/picker.core.js:990` `renumberBadges()` — the `textContent` reset; must become span-scoped.
- `src/picker.core.js:985` `removeBadge()` — removes the node and restores `outline`; the
  DOM state the badge `×` must complete.
- `src/picker.core.js:1203` `removeItem(el)` — existing, uncalled; the single sink for both routes.
- `src/picker.core.js:1215` `clearQueue()` — whole-queue path; contrast only.
- `src/picker.core.js:490` `elFromPoint()` — hides badges before hit-testing; keep.
- `src/picker.core.js:9` `injectedStyle` — document-head `<style>`, removed on quit; home
  for badge hover CSS.
- `templates/picker_ui.j2:96` `.row-actions button` — base style the row `×` inherits.
- `README.md:80-86` — the UI contract's row-class list; `rm` was removed from it earlier,
  so re-add the class you land on, and document the badge classes too.

## Commands

```bash
make ui          # render templates/picker_ui.j2 + themes/ into firefox/picker.js
make sync        # copy picker.js + icons into chromium/
make build       # package both
python3 tools/build_ui.py --check   # fail if picker.js is stale
```

`src/picker.core.js` is the only file to edit; `firefox/picker.js` and `chromium/picker.js`
are generated — never hand-edit.

## Test harness (exists, ephemeral)

`/tmp/opencode/verify.js` drives the real `firefox/picker.js` in headless Chromium over CDP,
piercing the closed shadow root to resolve elements by id (no guessed coordinates). 52
checks, including `cnt('Copy')`, `cnt('Add Details')`, `cnt('View Path')` which count row
buttons **by text** — a row `×` won't affect them.

Badges are different: they live in `document.body`, so the harness can read them with plain
`Runtime.evaluate`. Add checks in this shape: pick two paths, dispatch a hover
(`Input.dispatchMouseEvent mouseMoved`) over the first badge's coordinates, assert the `×`
child becomes visible, click it, assert `__ctp_multi.get().length` drops to 1 and the
survivor is the correct element. Run with `node /tmp/opencode/verify.js`.

If `/tmp/opencode` has been wiped, check before rebuilding — the shadow-piercing helpers
are the expensive part to rederive.

## Gotchas

- `make firefox` alone does **not** re-render; run `make ui` first or the xpi ships old UI.
- Firefox temporary add-ons do not hot-reload. After `make ui`, click **Reload** in
  `about:debugging` *and* reload the page under test.
- Badge is 20px at 360px-constrained UI — a wide `×` could make the pill wrap or spill
  over the tagged element.
- `addBadge` early-returns if `getBoundingClientRect()` throws; a removed-from-DOM element
  mid-pick will leave `item.badgeEl` null. Guard both routes for that.
- `dont commit` is a standing rule in the global AGENTS.md — deliberate override only.

## Open (?)

- Should unselecting also delete that path's saved notes, or leave them for a re-pick?
- Should the row `×` be hidden when only one path remains, or is `Clear` the only exit?
- Should the page badge be themed (currently the only unthemed chrome), or left as-is?

---

## Result (implemented)

Both routes are wired and verified — `node /tmp/opencode/verify.js` reports **69/69**
(52 pre-existing + 17 new). Built with `make ui && make sync && make build` and
re-extracted from `dist/copy-ui-path-lite-firefox-1.10.1.xpi` (byte-identical to
`firefox/picker.js`).

Decisions on the Open questions:

- **Notes are kept.** Details are keyed by path text and re-attach when the same
  element is re-picked — the harness asserts exactly that, so removal is
  non-destructive.
- **The row `×` is always shown**, one per row, whatever the queue size. A row only
  exists while it has a path, so an empty queue is already an empty list; `Clear`
  stays the bulk action.
- **Badge left unthemed** (`#FFD700` / `#1E3A5F`) — out of scope, as stated.

One thing the handoff did not anticipate: **the badge had to move out of
`document.body`.** A `z-index:2147483647` div in `<body>` still loses to the picker
host, because the host is a later sibling of `<body>` in the root stacking context
(tree order decides the tie), so the badge stayed *under* the overlay and could
never be hovered — flipping `pointer-events` alone achieved nothing. Badges are now
appended to `document.documentElement`, after the host, so they win the tie and are
hoverable/clickable. Everything that touches a badge (`elFromPoint`'s hit-test
hiding, `removeBadge`, `repositionBadges`, `quit`) is parent-agnostic and needed no
change beyond a corrected comment.

Trade-off, as predicted: the pill (30×20px when hovered) no longer forwards hover or
clicks to the page element it sits above.

---

## Task
**Goal:** Remove a picked path from either its Path Preview row or its numbered page badge.
**Done:**
- [ ] `×` button renders on every picked-path row
- [ ] Row `×` calls `removeItem(item.el)` with propagation stopped
- [ ] Page badge is hoverable and reveals an `×`; clicking it removes that path
- [ ] `renumberBadges()` scoped to the number span so the `×` survives renumbering
- [ ] Both routes renumber 1..n, drop the badge, restore the outline, and revert the
      toolbar label via `updateCopyBtn()`
- [ ] Re-picking the same element works after removal
- [ ] Harness gains checks for both routes
- [ ] `make ui && make sync && make build`, verified against the extracted xpi
**Constraints:** Edit `src/picker.core.js` (+ template CSS only); keep the existing three
row buttons; no new backend logic beyond wiring `removeItem`.
**Start:** `src/picker.core.js:1086-1140` — read `renderQueue()` in full to see how `item`
and `full` are closure-bound per row, then append the fourth button.
**Out of scope:** toolbar changes, bulk-clear behaviour, notes GC, theming the badge
(unless you take the Open question above).
**First step:** Open `renderQueue()` and add the row `×`; the badge restructure
(`src/picker.core.js:955-966`) is the part to plan for before touching it.
