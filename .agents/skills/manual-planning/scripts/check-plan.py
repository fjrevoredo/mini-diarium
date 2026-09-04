#!/usr/bin/env python3
"""Validate a manual-planning plan file.

Read-only. Reports findings with stable check IDs so a rejected plan can be
discussed by ID rather than by paraphrase.

Exit codes:
  0  clean
  1  errors present
  2  warnings only
 64  usage error
 66  plan file not readable
"""

import argparse
import json
import os
import re
import subprocess
import sys

VERSION = "2.0.0"
HERE = os.path.dirname(os.path.realpath(__file__))
TEMPLATE_NAMES = ("simple-plan-template.md", "milestoned-plan-template.md")

PLAN_STATUSES = {
    "DRAFT",
    "QUESTIONS PENDING",
    "READY FOR APPROVAL",
    "APPROVED",
    "IN PROGRESS",
    "COMPLETED",
    "BLOCKED",
}

TASK_STATUSES = {"TO BE DONE", "IN PROGRESS", "COMPLETED", "BLOCKED", "SKIPPED"}

# Real plans annotate a status inline -- `COMPLETED (2026-05-22) - 381/381 passing`.
# The vocabulary applies to the leading token; everything after a separator is a note.
ANNOTATION_START = (" ", "(", "\u2014", "-", ";", ",", ":", "*", "\t")


def normalize_status(value, vocabulary):
    """Canonical vocabulary token for `value`, or None if it invents one."""
    if value is None:
        return None
    value = value.strip().strip("`*")
    for token in sorted(vocabulary, key=len, reverse=True):
        if value == token:
            return token
        if value.startswith(token) and value[len(token):][:1] in ANNOTATION_START:
            return token
    return None

def normalized_template_sections(text):
    """Return canonical top-level section slots from a template."""
    lines = mask(text.split("\n"))
    sections = []
    for line in lines:
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if not m:
            continue
        title = m.group(1)
        slot = "Milestones or Tasks" if title in ("Milestones", "Tasks") else title
        if slot not in sections:
            sections.append(slot)
    return sections


def required_sections():
    """Load and compare the canonical section slots from both templates."""
    sections = []
    for name in TEMPLATE_NAMES:
        path = os.path.join(HERE, "..", "assets", name)
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except OSError as exc:
            raise RuntimeError("cannot read canonical template %s: %s" % (path, exc))
        sections.append((name, normalized_template_sections(text)))
    if sections[0][1] != sections[1][1]:
        raise RuntimeError(
            "canonical templates have different top-level sections: %s=%s, %s=%s"
            % (sections[0][0], sections[0][1], sections[1][0], sections[1][1])
        )
    return sections[0][1]

REMOVED_METADATA_FIELDS = ["Created", "Last Updated", "Owner", "Approval"]

APPROVAL_BOILERPLATE = "Implementation must not start until the user approves this plan."

FILENAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-plan\.md$")

# Evidence form 1: a file:line citation, e.g. agent-chat.component.ts:139
EVIDENCE_FILE_LINE_RE = re.compile(r"\b[\w][\w./-]*\.[A-Za-z0-9]{1,8}:\d+\b")
# Evidence form 2: a section reference, e.g. SKILL_RULES.md §5, AGENTS.md § Testing
EVIDENCE_SECTION_RE = re.compile(r"\b[\w][\w./-]*\.[A-Za-z0-9]{1,8}\s*(?:§|#{1,2}\s*Section\b)")
# Evidence form 3: a fenced block holding a re-runnable inspection command whose
# output would substantiate a claim. Deliberately narrow -- a build or test
# command proves the change works, it does not evidence a claim about the code.
EVIDENCE_COMMAND_RE = re.compile(
    r"(?:^|[\n;|&]\s*)(?:grep|rg|sed\s+-n|awk|cat|head|tail|wc|find|ls|"
    r"git\s+(?:log|show|ls-files|blame|grep|rev-parse)|"
    r"readlink|diff|jq|python3?\s+-c)\b"
)

VAGUE_VERBS = ["improve", "handle errors", "write tests", "refactor", "clean up"]
VAGUE_VERB_RE = re.compile(
    r"(?<![\w-])(?:" + "|".join(v.replace(" ", r"\s+") for v in VAGUE_VERBS) + r")(?![\w-])",
    re.IGNORECASE,
)
# A concrete target on the same line: a backticked span, a path, or a call.
CONCRETE_TARGET_RE = re.compile(r"`[^`]+`|\b[\w][\w./-]*\.[A-Za-z0-9]{1,8}\b|\b\w+\(\)")

TASK_FIELDS = ["Status", "Depends On", "Objective", "Steps", "Validation", "Notes"]

CHECK_HELP = """check IDs

errors (exit 1)
  E001  filename matches YYYY-MM-DD-<name>-plan.md
  E002  plan sits in the plan directory (--dir, default docs/plans)
  E003  metadata carries `Plan Format: manual-planning vX.Y.Z`
  E004  every Plan Status / task Status value is in the closed vocabulary
  E005  plan status and task statuses are mutually consistent
  E006  every task has Status, Depends On, Objective, Steps, Validation, Notes
  E007  more than 10 tasks implies milestones exist
  E008  every milestone has Exit Criteria
  E009  all required top-level sections are present
  E010  conditional: a CHANGELOG at the repo root implies a task step mentions it
  E011  conditional: the plan edits files that exist but carries no evidence at all
  E012  metadata carries none of the fields v2 removes

warnings (exit 2)
  W001  the Tracking field disagrees with git
  W002  Approval Gate still holds template boilerplate at APPROVED or later
  W003  no evidence in a plan of more than 5 tasks
  W004  a vague verb with no file, command or symbol on the same line
  W005  the inline Decision Log holds more than 10 entries

Evidence (E011/W003) counts in any of three forms: a file:line reference, a
section reference (`SKILL_RULES.md §5`), or a fenced re-runnable inspection
command. Line numbers are unstable in prose files, so file:line alone is not
required.
"""


class Finding:
    def __init__(self, check_id, severity, line, message):
        self.id = check_id
        self.severity = severity
        self.line = line
        self.message = message

    def as_dict(self):
        return {
            "id": self.id,
            "severity": self.severity,
            "line": self.line,
            "message": self.message,
        }


def mask(lines):
    """Blank out fenced code blocks and HTML comments.

    A plan that documents the plan format contains headings and metadata lines
    inside its own examples. Parsing those as structure is wrong, so they are
    blanked while line numbering is preserved.
    """
    masked = []
    fence = None
    in_comment = False
    for raw in lines:
        stripped = raw.strip()
        if fence is None:
            m = re.match(r"^(`{3,}|~{3,})", stripped)
            if m and not in_comment:
                fence = m.group(1)[0] * 3
                masked.append("")
                continue
        else:
            masked.append("")
            if re.match(r"^(`{3,}|~{3,})\s*$", stripped):
                fence = None
            continue

        line = raw
        if in_comment:
            if "-->" in line:
                line = line.split("-->", 1)[1]
                in_comment = False
            else:
                masked.append("")
                continue
        while "<!--" in line:
            before, rest = line.split("<!--", 1)
            if "-->" in rest:
                line = before + rest.split("-->", 1)[1]
            else:
                line = before
                in_comment = True
                break
        masked.append(line)
    return masked


def section_body(masked, start, level=2):
    """Lines of the section starting at index `start`, up to the next heading of
    the same or shallower level."""
    out = []
    pattern = re.compile(r"^#{1," + str(level) + r"} ")
    for i in range(start + 1, len(masked)):
        if pattern.match(masked[i]):
            break
        out.append((i, masked[i]))
    return out


def field_value(body, name):
    rx = re.compile(r"^\s*-\s*" + re.escape(name) + r"\s*:\s*(.*)$", re.IGNORECASE)
    for _, line in body:
        m = rx.match(line)
        if m:
            return m.group(1).strip()
    return None


def milestone_level_body(body):
    """Keep milestone fields before the first nested task heading."""
    out = []
    for i, line in body:
        if re.match(r"^####\s+", line):
            break
        out.append((i, line))
    return out


def task_steps(body):
    """Return only the task's Steps field, excluding later task fields."""
    lines = []
    steps_indent = None
    for _, line in body:
        if steps_indent is None:
            match = re.match(r"^(\s*)-\s*Steps\s*:", line)
            if not match:
                continue
            steps_indent = match.group(1)
            lines.append(line)
            continue
        if re.match(r"^#{1,6}\s", line):
            break
        field = re.match(r"^(\s*)-\s*[A-Za-z][A-Za-z ]*\s*:", line)
        if field and field.group(1) == steps_indent:
            break
        lines.append(line)
    return lines


class Plan:
    def __init__(self, path, text):
        self.path = os.path.abspath(path)
        self.text = text
        self.lines = text.split("\n")
        self.masked = mask(self.lines)
        self.sections = {}
        self.section_order = []
        for i, line in enumerate(self.masked):
            m = re.match(r"^##\s+(.+?)\s*$", line)
            if m and not line.startswith("###"):
                title = m.group(1)
                self.sections.setdefault(title, i)
                self.section_order.append((title, i))
        self.metadata = self._metadata()
        self.plan_status = self.metadata.get("Plan Status")
        self.tasks = self._tasks()
        self.milestones = self._milestones()

    def _metadata(self):
        idx = self.sections.get("Metadata")
        meta = {}
        if idx is None:
            return meta
        for _, line in section_body(self.masked, idx):
            m = re.match(r"^\s*-\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$", line)
            if m:
                meta.setdefault(m.group(1).strip(), m.group(2).strip())
        return meta

    def _tasks(self):
        tasks = []
        for i, line in enumerate(self.masked):
            m = re.match(r"^(#{3,4})\s+Task\s+([0-9][0-9.]*)\s*:\s*(.*)$", line)
            if m:
                level = len(m.group(1))
                tasks.append(
                    {
                        "id": m.group(2),
                        "title": m.group(3).strip(),
                        "line": i + 1,
                        "index": i,
                        "body": section_body(self.masked, i, level=level),
                    }
                )
        return tasks

    def _milestones(self):
        out = []
        for i, line in enumerate(self.masked):
            m = re.match(r"^###\s+Milestone\s+([^:]+?)\s*:\s*(.*)$", line)
            if m:
                out.append(
                    {
                        "id": m.group(1).strip(),
                        "title": m.group(2).strip(),
                        "line": i + 1,
                        "body": section_body(self.masked, i, level=3),
                    }
                )
        return out


def git_root(path):
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=os.path.dirname(path),
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if out.returncode != 0:
        return None
    root = out.stdout.strip()
    return root or None


def guessed_layout_root(path, plan_dir):
    """Derive the fallback root by removing the configured plan directory."""
    root = os.path.dirname(path)
    for component in os.path.normpath(plan_dir).split(os.sep):
        if component not in ("", "."):
            root = os.path.dirname(root)
    return root


def is_tracked(root, path):
    out = subprocess.run(
        ["git", "ls-files", "--error-unmatch", path],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    return out.returncode == 0


def status_consistency(plan_status, task_statuses):
    """E005. Returns a message when plan status and task statuses contradict.

    Shared with plan-status.py, which imports this function.
    """
    if plan_status is None:
        return None
    unfinished = [s for s in task_statuses if s in ("TO BE DONE", "IN PROGRESS")]
    if plan_status == "COMPLETED" and unfinished:
        return (
            "plan status is COMPLETED but %d of %d tasks are still TO BE DONE or "
            "IN PROGRESS" % (len(unfinished), len(task_statuses))
        )
    if plan_status in ("APPROVED", "IN PROGRESS"):
        # The "at least one task" guard is load-bearing: on an empty task list
        # "every task is finished" is vacuously true, and a fresh skeleton would
        # be reported as stale the moment it is created.
        if task_statuses and all(s in ("COMPLETED", "SKIPPED") for s in task_statuses):
            return (
                "every task is COMPLETED or SKIPPED but plan status is still %s"
                % plan_status
            )
    if plan_status in ("DRAFT", "QUESTIONS PENDING", "READY FOR APPROVAL"):
        moved = [s for s in task_statuses if s != "TO BE DONE"]
        if moved:
            return (
                "plan status is %s but %d task(s) have moved off TO BE DONE"
                % (plan_status, len(moved))
            )
    return None


def evidence_forms(plan):
    """Which of the three evidence forms the plan uses."""
    forms = set()
    body = "\n".join(plan.masked)
    if EVIDENCE_FILE_LINE_RE.search(body):
        forms.add("file:line")
    if EVIDENCE_SECTION_RE.search(body):
        forms.add("section-reference")
    # Fenced blocks were masked out, so scan the raw text for them.
    for block in re.findall(r"```[^\n]*\n(.*?)```", plan.text, re.DOTALL):
        if EVIDENCE_COMMAND_RE.search(block):
            forms.add("command")
            break
    return forms


PATH_TOKEN_RE = re.compile(r"[\w][\w./-]*\.[A-Za-z0-9]{1,8}")


def named_existing_files(plan, root):
    """Files the plan names that actually exist on disk.

    Tokens are extracted from anywhere in the text, not only from a backtick
    span that is *entirely* a path: real plans write `todo_path: docs/todo/TODO.md`
    and `D:\\Repos\\x\\SKILL.md`, and anchoring the match to the whole span misses
    both. Existence against the repository root is what makes this safe -- a
    token like `1.0.0` matches the shape but resolves to nothing.
    """
    base = root if root else os.path.dirname(plan.path)
    found = []
    for token in dict.fromkeys(PATH_TOKEN_RE.findall(plan.text)):
        if "://" in token:
            continue
        if os.path.isfile(os.path.join(base, token)):
            found.append(token)
    return found


def check(plan, plan_dir, layout_root, git_root_path, root_is_guess, required):
    f = []
    add = lambda i, s, l, m: f.append(Finding(i, s, l, m))

    name = os.path.basename(plan.path)
    if not FILENAME_RE.match(name):
        add(
            "E001",
            "error",
            0,
            "filename %r does not match YYYY-MM-DD-<name>-plan.md" % name,
        )

    # E002
    if layout_root:
        expected = os.path.normpath(os.path.join(layout_root, plan_dir))
        actual = os.path.dirname(plan.path)
        if os.path.normpath(actual) != expected:
            add(
                "E002" if not root_is_guess else "E002",
                "warning" if root_is_guess else "error",
                0,
                "plan is in %s, expected %s" % (actual, expected),
            )

    # E003
    fmt = plan.metadata.get("Plan Format", "")
    if not re.search(r"manual-planning\s+v\d+\.\d+\.\d+", fmt):
        add(
            "E003",
            "error",
            plan.sections.get("Metadata", 0) + 1,
            "metadata is missing `Plan Format: manual-planning vX.Y.Z`",
        )

    # E004
    plan_status = normalize_status(plan.plan_status, PLAN_STATUSES)
    if plan.plan_status is not None and plan_status is None:
        add(
            "E004",
            "error",
            plan.sections.get("Metadata", 0) + 1,
            "Plan Status %r is not in the closed vocabulary" % plan.plan_status,
        )
    task_statuses = []
    for t in plan.tasks:
        raw = field_value(t["body"], "Status")
        st = normalize_status(raw, TASK_STATUSES)
        if raw is not None:
            if st is not None:
                task_statuses.append(st)
            else:
                add(
                    "E004",
                    "error",
                    t["line"],
                    "Task %s status %r is not in the closed vocabulary"
                    % (t["id"], raw[:60]),
                )
    for ms in plan.milestones:
        raw = field_value(ms["body"], "Status")
        if raw is not None and normalize_status(raw, TASK_STATUSES) is None:
            add(
                "E004",
                "error",
                ms["line"],
                "Milestone %s status %r is not in the closed vocabulary"
                % (ms["id"], raw[:60]),
            )

    # E005
    msg = status_consistency(plan_status, task_statuses)
    if msg:
        add("E005", "error", plan.sections.get("Metadata", 0) + 1, msg)

    # E006
    for t in plan.tasks:
        missing = [name for name in TASK_FIELDS if field_value(t["body"], name) is None]
        if missing:
            add(
                "E006",
                "error",
                t["line"],
                "Task %s is missing: %s" % (t["id"], ", ".join(missing)),
            )

    # E007
    if len(plan.tasks) > 10 and not plan.milestones:
        add(
            "E007",
            "error",
            0,
            "%d tasks and no milestones; more than 10 tasks requires milestones"
            % len(plan.tasks),
        )

    # E008
    for ms in plan.milestones:
        if field_value(milestone_level_body(ms["body"]), "Exit Criteria") is None:
            add(
                "E008",
                "error",
                ms["line"],
                "Milestone %s has no Exit Criteria" % ms["id"],
            )

    # E009
    for required_slot in required:
        options = ("Milestones", "Tasks") if required_slot == "Milestones or Tasks" else (required_slot,)
        if not any(o in plan.sections for o in options):
            add(
                "E009",
                "error",
                0,
                "missing required section: %s" % " or ".join("## " + o for o in options),
            )

    # E010
    if git_root_path:
        changelogs = [
            n for n in os.listdir(git_root_path) if n.upper().startswith("CHANGELOG")
        ]
        if changelogs:
            step_text = "\n".join(
                line for t in plan.tasks for line in task_steps(t["body"])
            )
            if "changelog" not in step_text.lower():
                add(
                    "E010",
                    "error",
                    0,
                    "%s exists at the repository root but no task step mentions it"
                    % changelogs[0],
                )

    # E011 / W003
    forms = evidence_forms(plan)
    existing = named_existing_files(plan, layout_root)
    if not forms:
        if existing:
            add(
                "E011",
                "error",
                0,
                "the plan names %d existing file(s) (e.g. %s) but carries no evidence: "
                "no file:line reference, no section reference, no re-runnable command"
                % (len(existing), existing[0]),
            )
        elif len(plan.tasks) > 5:
            add(
                "W003",
                "warning",
                0,
                "no evidence in any accepted form in a plan of %d tasks"
                % len(plan.tasks),
            )

    # E012
    for name in REMOVED_METADATA_FIELDS:
        if name in plan.metadata:
            add(
                "E012",
                "error",
                plan.sections.get("Metadata", 0) + 1,
                "metadata carries `%s`, which v2 removes" % name,
            )

    # W001
    if git_root_path and "Tracking" in plan.metadata:
        declared = plan.metadata["Tracking"].split()[0] if plan.metadata["Tracking"] else ""
        tracked = is_tracked(git_root_path, plan.path)
        if declared == "tracked" and not tracked:
            add("W001", "warning", 0, "Tracking says tracked but git does not track this file")
        elif declared == "untracked" and tracked:
            add("W001", "warning", 0, "Tracking says untracked but git tracks this file")

    # W002
    idx = plan.sections.get("Approval Gate")
    if idx is not None and plan_status in ("APPROVED", "IN PROGRESS", "COMPLETED"):
        body = "\n".join(line for _, line in section_body(plan.masked, idx))
        if APPROVAL_BOILERPLATE in body:
            add(
                "W002",
                "warning",
                idx + 1,
                "Approval Gate still holds template boilerplate at status %s; replace it "
                "with `Approved by <who> on <date>.`" % plan_status,
            )

    # W004
    for t in plan.tasks:
        in_steps = False
        for lineno, line in t["body"]:
            if re.match(r"^\s*-\s*Steps\s*:", line):
                in_steps = True
            elif re.match(r"^\s*-\s*(Validation|Notes)\s*:", line):
                in_steps = False
            is_objective = bool(re.match(r"^\s*-\s*Objective\s*:", line))
            if not (in_steps or is_objective):
                continue
            m = VAGUE_VERB_RE.search(line)
            if m and not CONCRETE_TARGET_RE.search(line):
                add(
                    "W004",
                    "warning",
                    lineno + 1,
                    "Task %s: %r with no file, command or symbol on the same line"
                    % (t["id"], m.group(0)),
                )

    # W005
    idx = plan.sections.get("Decision Log")
    if idx is not None:
        entries = [
            l
            for _, l in section_body(plan.masked, idx)
            if re.match(r"^###\s+DEC-\d+", l)
        ]
        if len(entries) > 10:
            add(
                "W005",
                "warning",
                idx + 1,
                "%d Decision Log entries; promote to YYYY-MM-DD-<name>-decisions.md"
                % len(entries),
            )

    f.sort(key=lambda x: (x.id, x.line))
    return f


class Parser(argparse.ArgumentParser):
    def error(self, message):
        self.print_usage(sys.stderr)
        sys.stderr.write("error: %s\n" % message)
        sys.exit(64)


def main(argv=None):
    p = Parser(
        prog="check-plan.py",
        description="Validate a manual-planning plan file (read-only).",
        epilog=CHECK_HELP,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("plan", help="path to the plan file")
    p.add_argument("--json", action="store_true", help="emit one JSON object on stdout")
    p.add_argument(
        "--strict", action="store_true", help="promote every warning to an error"
    )
    p.add_argument(
        "--dir",
        default="docs/plans",
        help="plan directory, relative to the repository root (default: docs/plans)",
    )
    p.add_argument("--version", action="version", version="check-plan.py " + VERSION)
    args = p.parse_args(argv)

    normalized_dir = os.path.normpath(args.dir)
    if os.path.isabs(args.dir) or normalized_dir == ".." or normalized_dir.startswith(".." + os.sep):
        sys.stderr.write("error: --dir must be a relative path within the repository\n")
        return 64

    path = os.path.abspath(args.plan)
    if not os.path.isfile(path):
        sys.stderr.write("error: no such plan file: %s\n" % args.plan)
        return 66
    try:
        text = open(path, encoding="utf-8").read()
    except OSError as exc:
        sys.stderr.write("error: cannot read %s: %s\n" % (args.plan, exc))
        return 66

    real_git_root = git_root(path)
    root_is_guess = real_git_root is None
    layout_root = real_git_root
    if layout_root is None:
        # Outside a git repository: guess the root from the plan's own location
        # and downgrade E002 rather than inventing an answer.
        layout_root = guessed_layout_root(path, args.dir)
        sys.stderr.write(
            "note: not inside a git repository; assuming root %s, E002 downgraded to a "
            "warning, W001 and E010 skipped\n" % layout_root
        )

    try:
        required = required_sections()
    except RuntimeError as exc:
        sys.stderr.write("error: checker configuration: %s\n" % exc)
        return 65

    plan = Plan(path, text)
    findings = check(plan, args.dir, layout_root, real_git_root, root_is_guess, required)

    if args.strict:
        for finding in findings:
            finding.severity = "error"

    errors = [x for x in findings if x.severity == "error"]
    warnings = [x for x in findings if x.severity == "warning"]

    if args.json:
        print(
            json.dumps(
                {
                    "plan": path,
                    "checker_version": VERSION,
                    "errors": len(errors),
                    "warnings": len(warnings),
                    "checks": [x.as_dict() for x in findings],
                },
                indent=2,
            )
        )
    else:
        for x in findings:
            print("%s %s %d: %s" % (x.id, x.severity, x.line, x.message))
        print("%d error(s), %d warning(s)" % (len(errors), len(warnings)))

    if errors:
        return 1
    if warnings:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
