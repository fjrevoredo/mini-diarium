#!/bin/sh
set -eu

APP_UID="${MINI_DIARIUM_APP_UID:-10001}"
APP_GID="${MINI_DIARIUM_APP_GID:-10001}"
MARKER="/data/.mini-diarium-docker-init-v1"

install -d \
  -o "$APP_UID" \
  -g "$APP_GID" \
  /data/home \
  /data/xdg/data \
  /data/xdg/config \
  /data/xdg/state

if [ -d /exchange ]; then
  chmod 0755 /exchange || true
fi

chown -R "$APP_UID:$APP_GID" /data
touch "$MARKER"
chown "$APP_UID:$APP_GID" "$MARKER"

echo "Initialized /data for Mini Diarium Docker runtime"

