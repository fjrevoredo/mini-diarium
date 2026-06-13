#!/bin/sh
set -eu

if [ "$#" -lt 3 ]; then
  echo "Usage: route-guard.sh <uid> <gid> <command> [args...]" >&2
  exit 1
fi

APP_UID="$1"
APP_GID="$2"
shift 2

if ip route show default | grep -q .; then
  ip route del default
fi

if ip -6 route show default 2>/dev/null | grep -q .; then
  ip -6 route del default || true
fi

if ip route show default | grep -q .; then
  echo "Default IPv4 route still present after bootstrap" >&2
  exit 1
fi

if ip route get 1.1.1.1 >/dev/null 2>&1; then
  echo "Raw IP routing is still available after bootstrap" >&2
  exit 1
fi

if getent ahostsv4 one.one.one.one >/tmp/route-guard-hosts 2>/dev/null; then
  OUTBOUND_IP="$(awk 'NR==1 { print $1; exit }' /tmp/route-guard-hosts)"
  if [ -n "${OUTBOUND_IP:-}" ] && nc -z -w 2 "$OUTBOUND_IP" 80 >/dev/null 2>&1; then
    echo "Outbound TCP remained available after bootstrap" >&2
    exit 1
  fi
fi

exec setpriv \
  --reuid "$APP_UID" \
  --regid "$APP_GID" \
  --clear-groups \
  --nnp \
  --inh-caps -all \
  --ambient-caps -all \
  --reset-env \
  env \
    HOME=/data/home \
    USER=app \
    LOGNAME=app \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    DISPLAY=:0 \
    MINI_DIARIUM_VNC_GEOMETRY="${MINI_DIARIUM_VNC_GEOMETRY:-1440x900}" \
    MINI_DIARIUM_VNC_DEPTH="${MINI_DIARIUM_VNC_DEPTH:-24}" \
    XDG_DATA_HOME=/data/xdg/data \
    XDG_CONFIG_HOME=/data/xdg/config \
    XDG_STATE_HOME=/data/xdg/state \
    XDG_CACHE_HOME=/tmp/xdg-cache \
    MINI_DIARIUM_FONTS_DIR=/opt/mini-diarium/fonts \
    "$@"
