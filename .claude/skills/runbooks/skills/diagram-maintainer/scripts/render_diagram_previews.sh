#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Render SVG diagram previews to PNG for visual QA.

Usage:
  render_diagram_previews.sh [--diagrams-dir DIR] [--out-dir DIR] [--files FILE...]

Examples:
  render_diagram_previews.sh
  render_diagram_previews.sh --out-dir /tmp/diagram-previews
  render_diagram_previews.sh --files docs/diagrams/save-entry.svg docs/diagrams/save-entry-dark.svg

Environment:
  DIAGRAM_BROWSER   Override the browser executable path.

Notes:
  - Dark SVGs are wrapped in a dark HTML background before screenshotting.
  - This script works best in WSL with a local Windows Chrome or Edge install.
EOF
}

DIAGRAMS_DIR="docs/diagrams"
OUT_DIR=""
declare -a FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --diagrams-dir)
      DIAGRAMS_DIR="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --files)
      shift
      while [[ $# -gt 0 && "$1" != --* ]]; do
        FILES+=("$1")
        shift
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

detect_browser() {
  local candidates=()

  if [[ -n "${DIAGRAM_BROWSER:-}" ]]; then
    candidates+=("$DIAGRAM_BROWSER")
  fi

  candidates+=(
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
    "google-chrome"
    "chromium"
    "chromium-browser"
    "microsoft-edge"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ "$candidate" == /* ]]; then
      [[ -x "$candidate" ]] && printf '%s\n' "$candidate" && return 0
    elif command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done

  return 1
}

is_windows_browser() {
  [[ "$1" == /mnt/[a-zA-Z]/* ]] || [[ "$1" == *.exe ]]
}

to_browser_path() {
  local browser="$1"
  local path="$2"

  if is_windows_browser "$browser"; then
    wslpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

to_file_url() {
  local browser="$1"
  local path="$2"

  if is_windows_browser "$browser"; then
    printf 'file:///%s\n' "$(wslpath -w "$path")"
  else
    printf 'file://%s\n' "$(realpath "$path")"
  fi
}

window_size_for() {
  local base="$1"
  case "$base" in
    *save-entry*) printf '1800,2200\n' ;;
    *unlock*) printf '1600,1400\n' ;;
    *architecture*) printf '2200,1400\n' ;;
    *) printf '1600,800\n' ;;
  esac
}

if ! BROWSER="$(detect_browser)"; then
  echo "No supported browser found. Set DIAGRAM_BROWSER or install Chrome/Edge." >&2
  exit 1
fi

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$(mktemp -d /tmp/diagram-previews-XXXXXX)"
else
  mkdir -p "$OUT_DIR"
fi

WRAP_DIR="$(mktemp -d /tmp/diagram-preview-wraps-XXXXXX)"
trap 'rm -rf "$WRAP_DIR"' EXIT

if [[ ${#FILES[@]} -eq 0 ]]; then
  FILES=(
    "$DIAGRAMS_DIR/architecture.svg"
    "$DIAGRAMS_DIR/architecture-dark.svg"
    "$DIAGRAMS_DIR/save-entry.svg"
    "$DIAGRAMS_DIR/save-entry-dark.svg"
    "$DIAGRAMS_DIR/unlock.svg"
    "$DIAGRAMS_DIR/unlock-dark.svg"
    "$DIAGRAMS_DIR/context.svg"
    "$DIAGRAMS_DIR/context-dark.svg"
  )
fi

echo "Using browser: $BROWSER"
echo "Output directory: $OUT_DIR"

for svg in "${FILES[@]}"; do
  if [[ ! -f "$svg" ]]; then
    echo "Missing SVG: $svg" >&2
    exit 1
  fi

  base="$(basename "$svg" .svg)"
  size="$(window_size_for "$base")"
  out_png="$OUT_DIR/${base}.png"
  browser_out="$(to_browser_path "$BROWSER" "$out_png")"

  if [[ "$base" == *-dark ]]; then
    wrapper="$WRAP_DIR/${base}.html"
    cat > "$wrapper" <<EOF
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; background: #0b1220; }
    body { display: flex; justify-content: center; align-items: flex-start; padding: 24px; }
    img { display: block; max-width: none; height: auto; }
  </style>
</head>
<body>
  <img src="$(to_file_url "$BROWSER" "$svg")" alt="$base">
</body>
</html>
EOF
    target_url="$(to_file_url "$BROWSER" "$wrapper")"
  else
    target_url="$(to_file_url "$BROWSER" "$svg")"
  fi

  "$BROWSER" \
    --headless \
    --disable-gpu \
    --screenshot="$browser_out" \
    --window-size="$size" \
    "$target_url" \
    >/dev/null

  printf '%s\n' "$out_png"
done
