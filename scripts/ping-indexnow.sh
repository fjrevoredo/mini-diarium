#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: INDEXNOW_KEY=<key> $0 <url>"
  exit 1
fi

if [[ -z "${INDEXNOW_KEY:-}" ]]; then
  echo "INDEXNOW_KEY is required"
  exit 1
fi

site_url="$1"
host="${INDEXNOW_HOST:-mini-diarium.com}"
key_location="${INDEXNOW_KEY_LOCATION:-https://${host}/${INDEXNOW_KEY}.txt}"

curl -fsS "https://api.indexnow.org/indexnow?url=${site_url}&key=${INDEXNOW_KEY}&keyLocation=${key_location}"
