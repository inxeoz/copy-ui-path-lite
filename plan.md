# Multi UI Path Copy — Plan

## Goal
Extend single-click copy to multi-pick: user adds as many UIs as wanted, each gets a tag number (badge on page + numbered list in dialog), then copies all at once.

## Current behavior (`firefox/picker.js`)
- Hover → preview in `#path-display`, click → `doCopy()` (`:853`) copies one path + `quit()` (`:911`).
- `Ctrl+click` stays open (`onOverlayClick:947`), but does not accumulate a list.
- Template at `:563`, state vars at `:719-729`, clipboard at `:501-524`.

## Decisions (user-confirmed)
1. Add interaction: `Add +` mode toggle in dialog. When ON, clicks append instead of closing.
2. Number tags: both — pinned badge on each picked element + numbered list in dialog.
3. Copy output: default `\n` (one path per line), with `#sep-select` to change style (`newline | numbered "1. ..." | comma | JSON`).
4. After Copy All: stay open by default, with `☐ close after copy` toggle.
5. Remove: renumber compact (remove #2 from 1,2,3 → 1,2).
6. Duplicates: skip (shake + toast); format switch re-renders all rows live.

## Changes (`firefox/picker.js` only, then `make sync`)
Single source of truth is `firefox/picker.js`; `Makefile:38-45` syncs to `chromium/`.

### 1. State (`:719` area)
- `collected = [{n, el}]` — store element refs so `formatMode` changes rebuild via `getSelectorPath(el, formatMode)` (`:462`).
- `multiMode=false`, `sepStyle` (persist `localStorage` like `cfgProps:610`), `closeAfterCopy=false`.

### 2. Dialog UI (template `:563`)
- Header: `Add +` toggle button (active style like `.frozen`).
- New `#queue-list` under `#path-display` (scrollable, rows: `N. <truncated path> [x]`).
- Footer row: count label, `#sep-select`, `Copy All (N)`, `Clear`, `☐ close after copy` checkbox.
- Keep existing `Copy path` (single) unchanged.

### 3. Interaction
- `onOverlayClick:947` — if `multiMode` → `addItem(elFromPoint)` + stay open; else existing single flow.
- `addItem(el)`: dedupe by ref (`skip + shake`), push `{n: collected.length+1, el}`, `renderQueue()` + `addBadge()`, toast `Added #N`.
- Row `[x]` / `Clear`: remove, renumber `1..N`, update badges + list.
- `Copy All`: map `collected` → `getSelectorPath` → join by `sepStyle` → `copyToClipboard()` → toast; close only if `closeAfterCopy` checked (reuse close animation in `doCopy`).
- `quit:911`: also remove all badges + clear `collected`.

### 4. Badges
- `fixed` divs in `document.body` (siblings to `hlEl:697`, `cornerLabels:701`), gold bg, text `N`, at `rect.left/top-24px`.
- Reposition on `scroll/resize`; optional faint outline on picked els.
- Cleanup in `quit()`.

### 5. Separator styles
- `newline`: `path1\npath2`
- `numbered`: `1. path1\n2. path2`
- `comma`: `path1, path2`
- `JSON`: `[{n,path}]`
- Applied at copy time; preview list updates live.

## Verify
- `node --check firefox/picker.js`
- `make sync && make build`
- Manual: temp add-on / unpacked → toggle Add → click 3 els → badges 1,2,3 + list → switch format + separator → Copy All → paste check → remove middle → renumber check → Clear / Esc cleanup.
