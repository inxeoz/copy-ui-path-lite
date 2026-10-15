# copy-ui-path-lite — Chromium (MV3)

Source for the Chrome / Edge / Chromium build. See the [project README](../README.md).

`picker.js` (generated) and `icons/` are shared with the Firefox build — the UI
source lives in [`../src/`](../src/), [`../templates/`](../templates/) and
[`../themes/`](../themes/). Run `make ui && make sync` from the project root.

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

## Package

From the project root: `make chromium` → `dist/copy-ui-path-lite-chromium-<version>.zip`.
