# copy-ui-path-lite — Firefox (MV2)

Source for the Firefox build. See the [project README](../README.md) for install,
usage, and build instructions.

> `picker.js` here is **generated** — backend lives in `../src/picker.core.js`,
> UI in `../templates/picker_ui.j2` + `../themes/*.json`. Rebuild with `make ui`
> from the project root; never edit `picker.js` directly.

## web-ext

```bash
# run in a temporary profile
npx --yes web-ext run

# lint (AMO needs 0 warnings/errors)
npx --yes web-ext lint

# package into web-ext-artifacts/copy-ui-path-lite-<version>.zip
npx --yes web-ext build
```

Upload the zip from `web-ext-artifacts/` to [addons.mozilla.org](https://addons.mozilla.org/developer/addon/).
Or build the `.xpi` from the project root with `make firefox`.
