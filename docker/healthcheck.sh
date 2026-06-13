#!/bin/sh
set -eu

APP_UID="${MINI_DIARIUM_APP_UID:-10001}"
APP_GID="${MINI_DIARIUM_APP_GID:-10001}"
SUPERVISOR_CONF="/opt/mini-diarium/docker/supervisor.conf"

setpriv \
  --reuid "$APP_UID" \
  --regid "$APP_GID" \
  --clear-groups \
  supervisorctl -c "$SUPERVISOR_CONF" status \
  | awk '
      $1 == "xvnc" && $2 == "RUNNING" { xvnc = 1 }
      $1 == "openbox" && $2 == "RUNNING" { openbox = 1 }
      $1 == "mini-diarium" && $2 == "RUNNING" { app = 1 }
      $1 == "websockify" && $2 == "RUNNING" { websockify = 1 }
      $1 == "nginx" && $2 == "RUNNING" { nginx = 1 }
      END { exit !(xvnc && openbox && app && websockify && nginx) }
    '

nc -z 127.0.0.1 6080

if ip route show default | grep -q .; then
  echo "Default route still present" >&2
  exit 1
fi

grep -Eq '^CapEff:\s+0+$' /proc/1/status
grep -Eq '^CapPrm:\s+0+$' /proc/1/status
grep -Eq '^NoNewPrivs:\s+1$' /proc/1/status
