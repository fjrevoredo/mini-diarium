"""Status event log shared by plan-status.py (writer) and check-plan.py (reader).

One JSON object per line, one line per mutating plan-status.py command. The log
is a telemetry anchor: it gives exact task boundaries and stop reasons without
asking the executing agent to do anything new.

Location: `git rev-parse --git-path manual-planning/<plan-stem>.events.jsonl`,
which is inside `.git` -- never tracked, correct per worktree, and needs no
`.git/info/exclude` entry. Outside git: `<plan-dir>/.manual-planning/`.

Records carry ids, timestamps, statuses, stop reasons and byte counts only --
never free text -- so the log is safe to read in any telemetry report.
"""

import datetime
import json
import os
import subprocess

STOP_REASONS = ("done", "ask", "gate", "question", "context", "limit")


def log_path(plan_path):
    plan_path = os.path.abspath(plan_path)
    plan_dir = os.path.dirname(plan_path)
    stem = os.path.splitext(os.path.basename(plan_path))[0]
    name = "manual-planning/%s.events.jsonl" % stem
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--git-path", name],
            cwd=plan_dir,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        out = None
    if out is not None and out.returncode == 0 and out.stdout.strip():
        return os.path.normpath(os.path.join(plan_dir, out.stdout.strip()))
    return os.path.join(plan_dir, ".manual-planning", "%s.events.jsonl" % stem)


def now_iso():
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def append(plan_path, record):
    """Append one record. Returns None on success, else an error message.

    A logging failure must never fail the plan write that triggered it, so
    callers print the message as a warning and carry on.
    """
    path = log_path(plan_path)
    rec = {"t": now_iso(), "plan": os.path.splitext(os.path.basename(plan_path))[0]}
    rec.update(record)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")
    except OSError as exc:
        return "cannot append to event log %s: %s" % (path, exc)
    return None


def read(plan_path):
    """Every well-formed record, oldest first. A missing log is an empty list."""
    path = log_path(plan_path)
    out = []
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if isinstance(rec, dict):
                    out.append(rec)
    except OSError:
        return []
    return out
