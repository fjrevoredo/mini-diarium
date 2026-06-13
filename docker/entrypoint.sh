#!/bin/sh
set -eu

APP_UID="${MINI_DIARIUM_APP_UID:-10001}"
APP_GID="${MINI_DIARIUM_APP_GID:-10001}"
SECRET_FILE="/run/secrets/gui_password"
HTPASSWD_FILE="/run/mini-diarium/htpasswd"
SUPERVISOR_CONF="/opt/mini-diarium/docker/supervisor.conf"

if [ ! -e "$SECRET_FILE" ]; then
  echo "Missing GUI password secret at $SECRET_FILE" >&2
  exit 1
fi

if [ ! -f "$SECRET_FILE" ]; then
  echo "GUI password secret path is not a regular file: $SECRET_FILE" >&2
  exit 1
fi

if [ ! -r "$SECRET_FILE" ]; then
  echo "GUI password secret is not readable: $SECRET_FILE" >&2
  exit 1
fi

if [ ! -s "$SECRET_FILE" ]; then
  echo "GUI password secret is empty: $SECRET_FILE" >&2
  exit 1
fi

mkdir -p \
  /run/mini-diarium \
  /run/nginx \
  /tmp/supervisor \
  /tmp/xdg-cache \
  /tmp/nginx \
  /tmp/nginx/client_body \
  /tmp/nginx/proxy \
  /tmp/nginx/fastcgi \
  /tmp/nginx/uwsgi \
  /tmp/nginx/scgi

GUI_PASSWORD="$(tr -d '\r\n' < "$SECRET_FILE")"
if [ -z "$GUI_PASSWORD" ]; then
  echo "GUI password secret is empty" >&2
  exit 1
fi

GUI_PASSWORD_HASH="$(openssl passwd -apr1 "$GUI_PASSWORD")"
unset GUI_PASSWORD

printf 'mini:%s\n' "$GUI_PASSWORD_HASH" > "$HTPASSWD_FILE"
unset GUI_PASSWORD_HASH
chmod 0777 /run/mini-diarium
chmod 0777 \
  /run/nginx \
  /tmp/supervisor \
  /tmp/xdg-cache \
  /tmp/nginx \
  /tmp/nginx/client_body \
  /tmp/nginx/proxy \
  /tmp/nginx/fastcgi \
  /tmp/nginx/uwsgi \
  /tmp/nginx/scgi
chmod 0644 "$HTPASSWD_FILE"

exec /opt/mini-diarium/docker/route-guard.sh \
  "$APP_UID" \
  "$APP_GID" \
  /usr/bin/supervisord \
  -c \
  "$SUPERVISOR_CONF"
