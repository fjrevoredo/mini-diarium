#!/usr/bin/env python3
import subprocess
import sys


def read_event(stdin):
    header_line = stdin.readline()
    if not header_line:
        return None, None

    header = {}
    for item in header_line.strip().split():
        if ":" in item:
            key, value = item.split(":", 1)
            header[key] = value

    payload_len = int(header.get("len", "0"))
    payload = stdin.read(payload_len) if payload_len > 0 else ""
    return header, payload


def main():
    target = sys.argv[1]
    supervisor_conf = "/opt/mini-diarium/docker/supervisor.conf"

    while True:
        sys.stdout.write("READY\n")
        sys.stdout.flush()

        header, payload = read_event(sys.stdin)
        if header is None:
            return 0

        payload_map = {}
        for item in payload.strip().split():
            if ":" in item:
                key, value = item.split(":", 1)
                payload_map[key] = value

        process_name = payload_map.get("processname")
        if process_name == target:
            subprocess.run(
                ["supervisorctl", "-c", supervisor_conf, "shutdown"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        sys.stdout.write("RESULT 2\nOK")
        sys.stdout.flush()


if __name__ == "__main__":
    raise SystemExit(main())
