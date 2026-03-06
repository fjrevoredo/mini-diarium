#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
index_path="${root_dir}/website/index.html"

extract() {
  local label="$1"
  local pattern="$2"
  local value
  value="$(sed -nE "s|.*${pattern}.*|\\1|p" "${index_path}" | head -n1)"
  printf '%s: %s\n' "${label}" "${value}"
}

extract "Windows" 'href="(https://github.com/fjrevoredo/mini-diarium/releases/latest/download/Mini-Diarium-[0-9]+\.[0-9]+\.[0-9]+-windows\.exe)"'
extract "macOS" 'href="(https://github.com/fjrevoredo/mini-diarium/releases/latest/download/Mini-Diarium-[0-9]+\.[0-9]+\.[0-9]+-macos\.dmg)"'
extract "Linux" 'href="(https://github.com/fjrevoredo/mini-diarium/releases/latest/download/Mini-Diarium-[0-9]+\.[0-9]+\.[0-9]+-linux\.AppImage)"'
