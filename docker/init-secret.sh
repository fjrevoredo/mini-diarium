#!/bin/sh
set -eu

SECRET_PATH="${1:-docker/secrets/gui-password.txt}"
SECRET_DIR="$(dirname "$SECRET_PATH")"

mkdir -p "$SECRET_DIR"

if [ -f "$SECRET_PATH" ]; then
  echo "GUI password secret already exists at $SECRET_PATH"
  exit 0
fi

umask 077
openssl rand -base64 48 | tr -d '\n' > "$SECRET_PATH"
echo "Created GUI password secret at $SECRET_PATH"

