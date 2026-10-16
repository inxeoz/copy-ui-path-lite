# Context Path Plan

## Purpose

This document describes how the extension locates the source file for a clicked element. It also describes the fallback system when the source file cannot be found.

## Background

The extension copies a prompt for a coding agent. The prompt must tell the agent where to find the element in the source code. The URL of the page is mandatory context. It must always appear in the prompt.

## Design Principles

Take inspiration from the existing extension. Do not copy it. Build a different implementation.

**Keep from the existing extension:**

- The layered fallback approach — try multiple strategies, use the first that works.
- The MAIN-world bridge — it is necessary. Framework data lives in the page context. A content script cannot see it.
- The source map proof system — verify a line before reporting it. Do not guess.
- The framework detection order — React, Vue, Svelte, Angular.
- The component chain concept — show the nesting hierarchy.
- The `@path:line` output format that Claude Code loads.
- The re-check timer — re-prove lines after 500ms and 1500ms because source maps arrive late.

**Change:**

- Use different terminology. Do not reuse the existing extension's exact terms.
- Use a different output structure. Do not mirror the existing prompt format.
- Add per-field customization. The existing extension has fixed detail levels. This plan offers individual toggles.
- Make the URL mandatory at every detail level. The existing extension shows it only at forensic level.
- Add source text search as a last resort only. The existing extension has no equivalent. This plan adds it for production builds where no other layer works.
- Combine source text search with source-map proof. Use search only when proof is impossible.

## Context Path Layers

The extension uses four layers to find the source file. It tries each layer in order. It stops at the first layer that gives a result.

### Layer 1: Framework Internals

The extension reads framework data from the page. This gives the exact file and line.

| Framework | Data Source | Build Mode |
|---|---|---|
| React | Fiber `_debugSource` or `_debugStack` with source map proof | Development only |
| Vue | Component `__file` property | Development only |
| Svelte | Element `__svelte_meta.loc` | Development only |
| Angular | `ng.getOwningComponent` or `ɵsetClassDebugInfo` | Development only |
| Sentry | `data-sentry-component` and `data-sentry-source-file` | Production |

This layer gives the best result. It gives the project-relative path, the absolute path, the component chain, and the line number.

### Layer 2: Build Plugin Annotations

Some build tools write source locations into the DOM as attributes. The extension reads these attributes.

- `data-v-inspector` (vite-plugin-vue-inspector)
- `data-inspector-relative-path` (react-dev-inspector)
- `data-astro-source-file` (Astro dev toolbar)

This layer gives the file and line. It works when the framework does not report its own data.

### Layer 3: Source Text Search (Last Resort)

The extension fetches all same-origin scripts that the page loaded. It searches their source code for strings from the clicked element. The strings are:

- Element text content
- `aria-label` value
- `data-testid` value
- A stable class name

The search returns the file and the line where the string appears. This layer works on any stack. It works on production builds. It does not need framework hooks. Use this layer only when Layer 1 and Layer 2 give no result.

Rules for this layer:

- Search only same-origin scripts.
- Search only scripts that the page already loaded.
- A string must be unique or near-unique. Do not report a match if the string appears in more than five files.
- Report the file path as project-relative when possible. Otherwise report the full URL.
- Report the line number where the string appears.
- Re-run the search after 500ms and 1500ms. Scripts may load late. A stale match is worse than no match.

### Layer 4: DOM Fingerprint

This layer always works. It gives a description of the element. The agent uses this description to search the codebase.

The fingerprint includes:

- CSS selector
- DOM path (tag hierarchy)
- Element text content
- All classes
- Key attributes (`role`, `aria-label`, `name`, `type`, `href`, `alt`, `title`)
- Computed styles (only non-default values)
- Section heading (nearest `section`, `article`, `form`, `nav`, `header`, or `footer` with a label or heading)
- Nearby text (previous and next sibling text)
- Screenshot (when the user attaches one)

This layer does not give a file path. It gives enough information for the agent to find the element by searching.

## Mandatory Context: URL

The URL of the page must always appear in the prompt. It does not depend on any layer.

The URL appears at every detail level. It appears as a single line:

```
- Page: https://example.com/products/42?dark=on
```

The URL includes the origin, path, query string, and hash. The agent uses the URL to understand the route and the application state.

## Fallback Chain

The extension builds the context for each annotation in this order:

1. Try Layer 1 (framework internals). If it gives a result, use it.
2. Try Layer 2 (build plugin annotations). If it gives a result, use it.
3. Try Layer 3 (source text search). If it gives a result, use it.
4. Always add Layer 4 (DOM fingerprint).
5. Always add the URL.

The prompt always contains at least the URL and the DOM fingerprint. It contains the source file path when any of the first three layers succeed.

## Output Format

The context path appears in the prompt in this format:

```
- Source: @src/components/ProductCard.tsx:42
```

When the source file is known but the line is not:

```
- Source: @src/components/ProductCard.tsx
```

When no source file is known:

```
- Source: not found. Use the selector and fingerprint to search.
```

The URL always appears:

```
- Page: https://example.com/products/42
```

## Implementation Steps

1. Build the MAIN-world bridge for framework data collection.
2. Add the source map proof system to the bridge.
3. Add the re-check timer (500ms, 1500ms) for late-arriving source maps.
4. Add Layer 3 (source text search) as a last-resort fallback.
5. Add the URL to every detail level in the output.
6. Add per-field toggles to the settings panel.
7. Add the toggle filter to the output builder.
8. Test on React development, React production, Vue development, Vue production, Svelte development, and a plain HTML page.
9. Measure how often each layer succeeds. Use this data to order the layers.

## Examples

### Layer 1 Example: React Development

The user clicks a button on `https://shop.example.com/products/42`. The fiber has `_debugSource` with file and line.

```
- Source: @src/components/ProductCard.tsx:42
- React component: App > ThemeProvider > ProductCard > button
- Page: https://shop.example.com/products/42
```

### Layer 2 Example: Vue with vite-plugin-vue-inspector

The user clicks an input on `https://checkout.example.com/payment`. The DOM has a `data-v-inspector` attribute.

```
- Source: @src/views/CheckoutForm.vue:88
- Vue component: App > CheckoutForm > BaseInput
- Page: https://checkout.example.com/payment
```

### Layer 3 Example: Production React with No Source Maps

The user clicks a button on `https://app.example.com/dashboard`. No framework data exists. The source text search finds the button string "Submit order" in one file.

```
- Source: @src/components/Dashboard.tsx:156
- Page: https://app.example.com/dashboard
```

### Layer 4 Example: Plain HTML Page with No Framework

The user clicks a link on `https://old-site.example.com/about`. No framework data exists. No source text match exists.

```
- Selector: main > div.content > p > a
- DOM path: html > body > main > div.content > p > a
- Text: "Read more"
- Classes: link external
- Page: https://old-site.example.com/about
```

### Forensic Detail Level Example

The user sets the detail level to "Forensic". The prompt includes all available context.

```
- Page: https://shop.example.com/products/42?dark=on
- Page title: Product Details
- Scroll position: (0, 340)
- Device pixel ratio: 2
- Browser: Chrome 120
- Captured: 2026-10-16T14:32:00.000Z
- Source: @src/components/ProductCard.tsx:42
- React component: App > ThemeProvider > ProductCard > button
- Rendered inside: <ThemeProvider dark> at @src/App.tsx:18
- Classes: btn primary
- Text: "Add to cart"
- Attributes: type="button"
- Position: 120x36 at (248, 312)
- Section: "Product details"
- Nearby: before it "Add to cart", after it "Save for later"
- HTML: <button type="button" class="btn primary"
- DOM path: html > body > main > section.product > div.card > button
- Computed styles: display: flex; background-color: #3b82f6; border-radius: 6px
```

## Context Customization

The user can toggle each part of the context. The extension stores the toggles in `chrome.storage.local`. The user changes the toggles in the settings panel.

### Available Toggles

| Toggle | Default | What It Controls |
|---|---|---|
| `includeURL` | On | Page URL line |
| `includeTitle` | Off | Page title (forensic level only) |
| `includeSource` | On | Source file path and line |
| `includeComponentChain` | On | Framework component hierarchy |
| `includeUsage` | Off | Rendered-inside line (parent component and props) |
| `includeSelector` | On | CSS selector |
| `includeDOMPath` | Off | Tag hierarchy path |
| `includeClasses` | On | Element classes |
| `includeText` | On | Element text content |
| `includeAttributes` | Off | Key attributes |
| `includePosition` | Off | Element position and size |
| `includeSection` | Off | Nearest section heading |
| `includeNearby` | Off | Previous and next sibling text |
| `includeHTML` | Off | Outer HTML (truncated) |
| `includeStyles` | Off | Computed styles |
| `includeViewport` | On | Window size line |
| `includeScreenshot` | On | Attach screenshot to annotation |

### Toggle Behavior

- A toggle that is off removes that line from the prompt.
- The URL toggle cannot be turned off. The URL is mandatory.
- The screenshot toggle controls whether a new annotation captures a screenshot. It does not remove screenshots from existing annotations.
- The source toggle does not disable the source search. It only hides the source line from the prompt. The source data still helps the agent when the user edits the prompt by hand.

### Settings Panel

The settings panel groups the toggles into sections:

```
Context
  [x] Page URL (always on, cannot disable)
  [x] Source file path
  [x] Component chain
  [ ] Rendered inside
  [ ] Viewport size
  [ ] Page title

Element
  [x] CSS selector
  [ ] DOM path
  [x] Classes
  [x] Text content
  [ ] Attributes
  [ ] Position and size
  [ ] Section heading
  [ ] Nearby text
  [ ] HTML snippet
  [ ] Computed styles

Screenshot
  [x] Capture with new annotation
  [ ] Include in compact output
```

### Example: Minimal Context

The user turns off all optional toggles. The prompt contains only the source, the URL, and the text.

```
## 1. Element: button "Add to cart"
Task: Make full-width

- Source: @src/components/ProductCard.tsx:42
- Page: https://shop.example.com/products/42
```

### Example: Full Context

The user turns on all toggles. The prompt contains every available fact.

```
## 1. Element: button "Add to cart"
Task: Make full-width

- Source: @src/components/ProductCard.tsx:42
- React component: App > ThemeProvider > ProductCard > button
- Rendered inside: <ThemeProvider dark> at @src/App.tsx:18
- Selector: main > section.product > div.card > button.primary
- Classes: btn primary
- Text: "Add to cart"
- Attributes: type="button"
- Position: 120x36 at (248, 312)
- Section: "Product details"
- Nearby: before it "Add to cart", after it "Save for later"
- HTML: <button type="button" class="btn primary"
- DOM path: html > body > main > section.product > div.card > button
- Computed styles: display: flex; background-color: #3b82f6; border-radius: 6px
- Viewport: 1280x720
- Page: https://shop.example.com/products/42
- Page title: Product Details
```

## Test Cases

### Layer 1: Framework Internals

| ID | Scenario | Expected Result |
|---|---|---|
| L1-01 | Click a button on a React 18 dev server (Vite) | Source path and line appear. Component chain appears. |
| L1-02 | Click a button on a React 19 dev server (Vite) | Source path and line appear after source map proof. |
| L1-03 | Click a button on a Vue 3 dev server (Vite) | Source path and line appear. Component chain appears. |
| L1-04 | Click a component on a Svelte 5 dev server | Source path and line appear. Component chain appears. |
| L1-05 | Click an element in an Angular dev build | Source path and component chain appear. |
| L1-06 | Click an element in a React production build (no Sentry) | No source. Falls through to Layer 4. |
| L1-07 | Click an element in a Vue production build | No source. Falls through to Layer 4. |
| L1-08 | Click an element in a Svelte production build | No source. Falls through to Layer 4. |

### Layer 2: Build Plugin Annotations

| ID | Scenario | Expected Result |
|---|---|---|
| L2-01 | Click an element with `data-v-inspector` | Source path and line from the attribute appear. |
| L2-02 | Click an element with `data-inspector-relative-path` | Source path and line from the attribute appear. |
| L2-03 | Click an element with `data-astro-source-file` | Source path and line from the attribute appear. |
| L2-04 | Click an element with `data-sentry-component` and `data-sentry-source-file` | Source path and component name appear. |

### Layer 3: Source Text Search

| ID | Scenario | Expected Result |
|---|---|---|
| L3-01 | Click a button with unique text "Submit order" on a production build | Source path and line where the string appears. |
| L3-02 | Click a button with common text "Submit" on a production build | No match (string appears in too many files). Falls through to Layer 4. |
| L3-03 | Click an element whose text is built from an i18n key | No match. Falls through to Layer 4. |
| L3-04 | Click an element on a page with 200+ scripts | Search completes within 2 seconds. No browser freeze. |
| L3-05 | Click an element, then a script loads within 500ms | Re-check finds the late script. Source path appears. |

### Layer 4: DOM Fingerprint

| ID | Scenario | Expected Result |
|---|---|---|
| L4-01 | Click an element on a plain HTML page | Selector, DOM path, text, classes, and URL appear. |
| L4-02 | Click an element with no text and no classes | Selector, DOM path, and URL appear. |
| L4-03 | Click an element with no unique selector | DOM path and URL appear. |

### URL Inclusion

| ID | Scenario | Expected Result |
|---|---|---|
| URL-01 | Copy a prompt at compact detail level | URL appears. |
| URL-02 | Copy a prompt at standard detail level | URL appears. |
| URL-03 | Copy a prompt at detailed detail level | URL appears. |
| URL-04 | Copy a prompt at forensic detail level | URL appears. |
| URL-05 | Turn off all optional toggles | URL still appears. |

### Customization Toggles

| ID | Scenario | Expected Result |
|---|---|---|
| CUST-01 | Turn off "Classes" toggle | Classes line does not appear in the prompt. |
| CUST-02 | Turn off "Component chain" toggle | Component chain line does not appear. |
| CUST-03 | Turn off "Source" toggle | Source line does not appear. The source data still saves. |
| CUST-04 | Turn off all toggles except URL | Only the URL appears. |
| CUST-05 | Turn off "Screenshot" toggle | New annotations do not capture screenshots. |

### Fallback Chain

| ID | Scenario | Expected Result |
|---|---|---|
| FB-01 | Layer 1 succeeds | Layers 2, 3, and 4 do not run. URL still appears. |
| FB-02 | Layer 1 fails, Layer 2 succeeds | Layers 3 does not run. Layer 4 and URL still appear. |
| FB-03 | Layers 1 and 2 fail, Layer 3 succeeds | Layer 4 and URL still appear. |
| FB-04 | All layers fail | Only Layer 4 (fingerprint) and URL appear. |

## Success Criteria

- The URL appears in every prompt, at every detail level.
- On a React development page, the source file and line appear.
- On a production page with no framework hooks, the source text search gives a file path in most cases.
- When no source file is found, the DOM fingerprint and URL give the agent enough context to search.
- The agent can find the element in the source code for at least 90 percent of annotations.
