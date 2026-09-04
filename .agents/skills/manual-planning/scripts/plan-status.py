#!/usr/bin/env python3
"""Change one task's status in a plan file, or show every status.

The only script here that mutates a plan, and deliberately narrow: one line,
one task, no inference. Three of the five task statuses contain a space, so
pass the status as a single quoted argument:

    plan-status.py <plan-file> set 1.2 "IN PROGRESS"
    plan-status.py <plan-file> show

Everything outside the single changed line is preserved byte for byte.

Exit codes:
  0  done
  1  the task id matched zero or more than one heading
  2  the status is outside the closed vocabulary
 64  usage error
 66  plan file not readable
"""

import argparse
import importlib.util
import os
import re
import sys

HERE = os.path.dirname(os.path.realpath(__file__))


def _load_checker():
    """Reuse check-plan.py's consistency rules rather than restating them."""
    path = os.path.join(HERE, "check-plan.py")
    spec = importlib.util.spec_from_file_location("check_plan", path)
    module = importlib.util.module_from_spec(spec)
    # Do not leave a __pycache__ behind in the skill directory.
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


CHECK = _load_checker()
TASK_STATUSES = CHECK.TASK_STATUSES
PLAN_STATUSES = CHECK.PLAN_STATUSES


def task_heading_indices(lines, task_id):
    """Indices of real headings for exactly this task id.

    The id is anchored on the trailing colon: a bare prefix match on `Task 1.1`
    also matches `Task 1.10`, which would make `set 1.1` ambiguous on any plan
    that reaches ten tasks in a milestone. Fenced examples and HTML comments are
    masked before matching.
    """
    rx = re.compile(r"^#{3,4}\s+Task\s+" + re.escape(task_id) + r"\s*:")
    return [i for i, line in enumerate(CHECK.mask(lines)) if rx.match(line)]


def read(path):
    try:
        with open(path, encoding="utf-8", newline="") as fh:
            return fh.read()
    except OSError as exc:
        sys.stderr.write("error: cannot read %s: %s\n" % (path, exc))
        return None


def collect(text):
    """(plan status, [(task id, status)]) as written."""
    lines = text.split("\n")
    masked = CHECK.mask(lines)
    plan_status = None
    tasks = []
    for i, line in enumerate(masked):
        if plan_status is None:
            m = re.match(r"^\s*-\s*Plan Status\s*:\s*(.*)$", line)
            if m:
                plan_status = m.group(1).strip()
        m = re.match(r"^(#{3,4})\s+Task\s+([0-9][0-9.]*)\s*:\s*(.*)$", line)
        if m:
            status = None
            for j in range(i + 1, len(masked)):
                if re.match(r"^#{1,6}\s", masked[j]):
                    break
                sm = re.match(r"^\s*-\s*Status\s*:\s*(.*)$", masked[j])
                if sm:
                    status = sm.group(1).strip()
                    break
            tasks.append((m.group(2), m.group(3).strip(), status))
    return plan_status, tasks


def cmd_show(path, text):
    plan_status, tasks = collect(text)
    print("Plan Status: %s" % (plan_status or "<none>"))
    if not tasks:
        print("(no tasks)")
        return 0
    width = max(len(t[0]) for t in tasks)
    for tid, title, status in tasks:
        print("  %-*s  %-12s  %s" % (width, tid, status or "<none>", title))
    normalized = [
        CHECK.normalize_status(s, TASK_STATUSES) for _, _, s in tasks if s is not None
    ]
    msg = CHECK.status_consistency(
        CHECK.normalize_status(plan_status, PLAN_STATUSES),
        [n for n in normalized if n],
    )
    if msg:
        sys.stderr.write("warning: E005 %s\n" % msg)
    return 0


def cmd_set(path, text, task_id, status):
    if status not in TASK_STATUSES:
        sys.stderr.write(
            "error: %r is not a task status; valid values are: %s\n"
            "note: three of them contain a space -- quote the argument, e.g. "
            '"IN PROGRESS"\n' % (status, ", ".join(sorted(TASK_STATUSES)))
        )
        return 2

    lines = text.split("\n")
    hits = task_heading_indices(lines, task_id)
    if len(hits) != 1:
        sys.stderr.write(
            "error: task id %r matched %d headings; expected exactly 1\n"
            % (task_id, len(hits))
        )
        return 1
    start = hits[0]

    target = None
    masked = CHECK.mask(lines)
    for j in range(start + 1, len(masked)):
        if re.match(r"^#{1,6}\s", masked[j]):
            break
        if re.match(r"^\s*-\s*Status\s*:", masked[j]):
            target = j
            break
    if target is None:
        sys.stderr.write("error: task %s has no `- Status:` line\n" % task_id)
        return 1

    indent = re.match(r"^(\s*-\s*)Status\s*:", lines[target]).group(1)
    line_ending = "\r" if lines[target].endswith("\r") else ""
    lines[target] = "%sStatus: %s%s" % (indent, status, line_ending)
    new_text = "\n".join(lines)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(new_text)
    print("Task %s -> %s" % (task_id, status))

    plan_status, tasks = collect(new_text)
    normalized = [
        CHECK.normalize_status(s, TASK_STATUSES) for _, _, s in tasks if s is not None
    ]
    msg = CHECK.status_consistency(
        CHECK.normalize_status(plan_status, PLAN_STATUSES),
        [n for n in normalized if n],
    )
    if msg:
        # Warn only. Promoting a plan to COMPLETED is a decision, not a
        # bookkeeping step, so this script never edits the plan status.
        sys.stderr.write("warning: E005 %s\n" % msg)
    return 0


def main(argv=None):
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            self.print_usage(sys.stderr)
            sys.stderr.write("error: %s\n" % message)
            sys.exit(64)

    p = Parser(
        prog="plan-status.py",
        description="Read or change task statuses in a manual-planning plan.",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("plan", help="path to the plan file")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("show", help="print the plan status and every task status")
    s = sub.add_parser("set", help="set one task's status")
    s.add_argument("task_id", help="task id as the plan numbers it, e.g. 1.2 or 2")
    s.add_argument(
        "status",
        help='new status, as ONE quoted argument, e.g. "IN PROGRESS"',
    )
    args = p.parse_args(argv)

    path = os.path.abspath(args.plan)
    text = read(path)
    if text is None:
        return 66
    if args.command == "show":
        return cmd_show(path, text)
    return cmd_set(path, text, args.task_id, args.status)


if __name__ == "__main__":
    sys.exit(main())
