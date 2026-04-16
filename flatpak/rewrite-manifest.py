#!/usr/bin/env python3
"""Rewrite the Flatpak manifest to replace the local dir source with a remote git source."""
import os
import re
import sys
from pathlib import Path

commit = os.environ.get("COMMIT") or (sys.argv[1] if len(sys.argv) > 1 else "")
if not commit:
    sys.exit("Usage: COMMIT=<sha> rewrite-manifest.py  (or pass sha as first arg)")

manifest = Path("flatpak/io.github.fjrevoredo.mini-diarium.yml")
text = manifest.read_text()

remote_block = """      - type: git
        url: https://github.com/fjrevoredo/mini-diarium
        commit: __COMMIT__"""

text, dir_replacements = re.subn(
    r"(?m)^ {6}- type: dir\n(?: {8}#.*\n)* {8}path: \.\.$",
    remote_block,
    text,
    count=1,
)
if dir_replacements != 1:
    sys.exit("Expected exactly one local dir source block in flatpak manifest")

if "--features custom-protocol" not in text:
    sys.exit("Flatpak manifest is missing the Tauri custom-protocol release build flag")

manifest.write_text(text.replace("__COMMIT__", commit))
print(f"Manifest rewritten with commit {commit}")
