#!/usr/bin/env python3
"""Render the picker UI template into firefox/picker.js.

Backend logic lives in src/picker.core.js and is never templated.
Only the UI markup (style + svg + dialog) comes from templates/picker_ui.j2
and the active theme in themes/<name>.json.

Usage:
    python3 tools/build_ui.py                    # default theme (carbon)
    python3 tools/build_ui.py --theme paper      # one-off theme
    python3 tools/build_ui.py --theme mytheme.json
    python3 tools/build_ui.py --check            # verify firefox/picker.js is current
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CORE = ROOT / "src" / "picker.core.js"
TEMPLATE = ROOT / "templates" / "picker_ui.j2"
THEMES_DIR = ROOT / "themes"
OUT = ROOT / "firefox" / "picker.js"
DEFAULT_THEME = ROOT / "themes" / "default.txt"

MARKER = "/*__CTP_UI__*/''"


def load_theme(name: str) -> tuple[dict, str]:
    if name.endswith(".json"):
        path = pathlib.Path(name)
        if not path.is_absolute():
            path = ROOT / path
        label = path.stem
    else:
        label = name
        path = THEMES_DIR / f"{name}.json"
    if not path.exists():
        available = sorted(p.stem for p in THEMES_DIR.glob("*.json"))
        sys.exit(f"unknown theme {name!r} (available: {', '.join(available)})")
    return json.loads(path.read_text()), label


def render(theme: dict) -> str:
    try:
        from jinja2 import Environment, FileSystemLoader, StrictUndefined
    except ImportError:
        sys.exit("jinja2 is required: uv pip install jinja2")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE.parent)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        autoescape=False,
    )
    return env.get_template(TEMPLATE.name).render(t=theme).strip()


def build(theme_name: str) -> tuple[str, str]:
    theme, label = load_theme(theme_name)
    ui = render(theme)
    core = CORE.read_text()
    if MARKER not in core:
        sys.exit(f"marker {MARKER!r} not found in {CORE}")

    payload = "/*__CTP_UI__*/" + json.dumps(ui)
    out = core.replace(MARKER, payload)
    banner = (
        "// GENERATED FILE — do not edit by hand.\n"
        f"//   backend : src/picker.core.js\n"
        f"//   ui      : templates/picker_ui.j2 + themes/{label}.json\n"
        "//   rebuild : make ui [THEME=<name>]\n"
    )
    return banner + out, label


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--theme", default=None, help="theme name or path to a theme json")
    ap.add_argument("--out", default=None, help="output file (default firefox/picker.js)")
    ap.add_argument("--check", action="store_true", help="fail if output differs from a fresh render")
    args = ap.parse_args()

    theme_name = args.theme or (DEFAULT_THEME.read_text().strip() if DEFAULT_THEME.exists() else "carbon")
    body, label = build(theme_name)
    out_path = pathlib.Path(args.out) if args.out else OUT

    if args.check:
        current = out_path.read_text() if out_path.exists() else ""
        if current != body:
            sys.exit(f"{out_path} is stale — run: make ui (theme: {theme_name})")
        print(f"{out_path.name} is up to date (theme: {label})")
        return 0

    out_path.write_text(body)
    print(f"rendered {out_path.relative_to(ROOT)}  (theme: {label}, {len(body):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
