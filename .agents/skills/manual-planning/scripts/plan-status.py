#!/usr/bin/env python3
"""Read or change a plan's state: task statuses, plan status, Resume block,
decisions and notes.

The only script here that mutates a plan, and deliberately narrow. Every write
locates its target through the masked heading structure that check-plan.py
parses -- an exact `## <Section>` or `### Task <id>:` heading, never a substring
search in the raw text -- and replaces only that target. Everything else is
preserved byte for byte, line endings included.

    plan-status.py <plan-file> show
    plan-status.py <plan-file> brief
    plan-status.py <plan-file> set 1.2 "IN PROGRESS"
    plan-status.py <plan-file> set-plan "IN PROGRESS"
    plan-status.py <plan-file> resume --state "..." --next "2.4" --stop ask --detail "..."
    plan-status.py <plan-file> decision --task 2.3 --title T --decision D --rationale R
    plan-status.py <plan-file> note --task 2.3 "evidence line"

Three of the five task statuses contain a space: pass a status as a single
quoted argument.

Every mutating command appends one JSON line to the status event log
(`git rev-parse --git-path manual-planning/<plan-stem>.events.jsonl`). A log
failure is a warning; the plan write still stands.

Stop reasons (resume --stop): done, ask, gate, question, context, limit.

Exit codes:
  0  done
  1  the target matched zero or more than one heading, or set-plan COMPLETED
     contradicts the task statuses
  2  a value is outside its closed vocabulary, or the Resume block would exceed
     its cap (3 KB / 40 lines)
 64  usage error
 66  plan file not readable
"""

import argparse
import datetime
import importlib.util
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.realpath(__file__))


def _load(name, filename):
    """Load a sibling module by path without leaving a __pycache__ behind."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, filename))
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


def _load_checker():
    """Reuse check-plan.py's parser and consistency rules rather than restating them."""
    return _load("check_plan", "check-plan.py")


CHECK = _load_checker()
EVENTS = CHECK.EVENTS
TASK_STATUSES = CHECK.TASK_STATUSES
PLAN_STATUSES = CHECK.PLAN_STATUSES
STOP_REASONS = CHECK.STOP_REASONS

RESUME_FIELDS = [
    "Updated",
    "State",
    "Green / Red",
    "Next runnable",
    "Live environment",
    "Next IDs",
    "Risks",
    "Stop",
]
RESUME_MAX_LINES = 40
RESUME_COMMENT = [
    "<!--",
    'Written by `plan-status.py resume`; do not edit by hand. Restart prompt: "Continue <plan> from',
    'its Resume block". Stop: done | ask | gate | question | context | limit.',
    "-->",
]
BRIEF_BUDGET = 15 * 1024
FINISHED = ("COMPLETED", "SKIPPED")


class WriteError(Exception):
    """A write target could not be located unambiguously."""


# ---------------------------------------------------------------- io helpers


def read(path):
    try:
        with open(path, encoding="utf-8", newline="") as fh:
            return fh.read()
    except OSError as exc:
        sys.stderr.write("error: cannot read %s: %s\n" % (path, exc))
        return None


def write_text(path, text):
    """Replace the file atomically, so an interrupted write never truncates it."""
    fd, tmp = tempfile.mkstemp(prefix=".plan-status-", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def eol_of(line):
    return "\r" if line.endswith("\r") else ""


def utc_stamp():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def today():
    return datetime.date.today().isoformat()


def log_event(path, text, event, **fields):
    plan = CHECK.Plan(path, text)
    record = {
        "event": event,
        "format": ".".join(str(x) for x in plan.version) if plan.version else None,
        "bytes": len(text.encode("utf-8")),
    }
    record.update(fields)
    err = EVENTS.append(path, record)
    if err:
        sys.stderr.write("warning: %s\n" % err)


def companion(path, kind):
    """`<dir>/YYYY-MM-DD-<name>-<kind>.md` for a `YYYY-MM-DD-<name>-plan.md` plan."""
    stem = os.path.splitext(os.path.basename(path))[0]
    base = stem[: -len("-plan")] if stem.endswith("-plan") else stem
    return os.path.join(os.path.dirname(path), "%s-%s.md" % (base, kind))


# ------------------------------------------------------ section-safe writing


def section_bounds(plan, title):
    """(heading index, end index) of the one `## title` section.

    Headings come from the masked text, so a `## Resume` inside a fenced example
    or an HTML comment is invisible, and `**Resume here**` in prose is not a
    heading at all. The title must match exactly and exactly once.
    """
    hits = [i for t, i in plan.section_order if t == title]
    if len(hits) != 1:
        raise WriteError("section `## %s` matched %d headings; expected exactly 1" % (title, len(hits)))
    start = hits[0]
    end = len(plan.lines)
    for i in range(start + 1, len(plan.masked)):
        if re.match(r"^#{1,2}\s", plan.masked[i]):
            end = i
            break
    return start, end


def splice(lines, start, end, new_lines, eol):
    """Replace lines[start:end] with new_lines (given without line endings)."""
    out = [l + eol for l in new_lines]
    if end == len(lines) and out:
        # The last element of a split text is what follows the final newline.
        out[-1] = new_lines[-1]
    lines[start:end] = out
    return lines


def replace_section_body(path, text, title, body):
    """Text with the body of `## title` replaced by `body` (a list of lines)."""
    plan = CHECK.Plan(path, text)
    start, end = section_bounds(plan, title)
    lines = text.split("\n")
    eol = eol_of(lines[start])
    splice(lines, start + 1, end, [""] + body + [""], eol)
    return "\n".join(lines)


def insert_section_after(path, text, after, title, body):
    """Text with a new `## title` section inserted after the section `after`."""
    plan = CHECK.Plan(path, text)
    _, end = section_bounds(plan, after)
    lines = text.split("\n")
    eol = eol_of(lines[0])
    new = ["## " + title, ""] + body + [""]
    if end == len(lines):
        new = [""] + new
    lines[end:end] = [l + eol for l in new]
    return "\n".join(lines)


# ------------------------------------------------------------- plan queries


def task_heading_indices(lines, task_id):
    """Indices of real headings for exactly this task id.

    The id is anchored on the trailing colon: a bare prefix match on `Task 1.1`
    also matches `Task 1.10`, which would make `set 1.1` ambiguous on any plan
    that reaches ten tasks in a milestone. Fenced examples and HTML comments are
    masked before matching.
    """
    rx = re.compile(r"^#{3,4}\s+Task\s+" + re.escape(task_id) + r"\s*:")
    return [i for i, line in enumerate(CHECK.mask(lines)) if rx.match(line)]


def collect(text):
    """(plan status, [(task id, title, status)]) as written."""
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


def consistency(text):
    plan_status, tasks = collect(text)
    normalized = [CHECK.normalize_status(s, TASK_STATUSES) for _, _, s in tasks if s is not None]
    return CHECK.status_consistency(
        CHECK.normalize_status(plan_status, PLAN_STATUSES),
        [n for n in normalized if n],
    )


def task_status(task):
    return CHECK.normalize_status(CHECK.field_value(task["body"], "Status"), TASK_STATUSES)


def dependencies(task, known):
    """Task ids named in `Depends On` that exist in the plan.

    Understands lists (`1.1, 1.2`), ranges (`1.1-1.4`, `1.1–4`) and
    `Milestone 2` (every task of that milestone). Returns (ids, unparsed) where
    unparsed is True when the field names something but no known id.
    """
    text = CHECK.field_value(task["body"], "Depends On") or ""
    if not text or re.match(r"^\W*none\b", text, re.I):
        return [], False
    ids = []
    for m in re.finditer(r"\b(\d+)\.(\d+)\s*[–-]\s*(?:(\d+)\.)?(\d+)\b", text):
        major, lo, major2, hi = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        if major2 in (None, major):
            ids += ["%s.%d" % (major, n) for n in range(lo, hi + 1)]
    for m in re.finditer(r"\bMilestone\s+(\d+)\b", text, re.I):
        ids += [k for k in known if k.startswith(m.group(1) + ".")]
    ids += re.findall(r"(?<![\w.])\d+(?:\.\d+)*(?![\w.])", text)
    ids = [i for i in dict.fromkeys(ids) if i in known and i != task["id"]]
    return ids, not ids


def runnable_tasks(plan):
    status = {t["id"]: task_status(t) for t in plan.tasks}
    out = []
    for t in plan.tasks:
        if status[t["id"]] != "TO BE DONE":
            continue
        deps, unparsed = dependencies(t, status)
        if all(status[d] in FINISHED for d in deps):
            out.append((t, deps, unparsed))
    return out


def id_key(task_id):
    return tuple(int(x) for x in task_id.split(".") if x.isdigit())


def next_task_id(plan, near=None):
    ids = [t["id"] for t in plan.tasks]
    if not ids:
        return "1"
    if all("." not in i for i in ids):
        return str(max(int(i) for i in ids) + 1)
    major = (near or max(ids, key=id_key)).split(".")[0]
    minors = [id_key(i)[1] for i in ids if i.split(".")[0] == major and len(id_key(i)) > 1]
    return "%s.%d" % (major, (max(minors) if minors else 0) + 1)


def decision_entries(lines):
    """[(index, namespace, number, heading)] of Decision Log entry headings."""
    out = []
    for i, line in enumerate(CHECK.mask(lines)):
        m = CHECK.DECISION_HEADING_RE.match(line)
        if m:
            out.append((i, m.group(1), int(m.group(2)), line))
    return out


def is_placeholder(heading):
    return "<short title>" in heading


def declared_namespace(text):
    m = re.search(r"namespace[^\n]*?`?\b([A-Z][A-Z0-9]*-DEC)-", text, re.I)
    if not m:
        m = re.search(r"`([A-Z][A-Z0-9]*-DEC)-`[^\n]*namespace", text, re.I)
    return m.group(1) if m else None


def next_decision_id(path, text, namespace=None):
    """(next id, namespace) honouring the plan's namespace across plan and companion.

    The namespace comes from, in order: `--namespace`; the companion decisions
    file (its last entry, else the namespace it declares), since that is where
    new entries go; the plan's inline log (last entry, else declared); `DEC`.
    Declarations are read from masked text: the template's own comment names
    `POOL-DEC-001` as an example.
    """
    plan = CHECK.Plan(path, text)
    span = plan.section_span("Decision Log")
    plan_log = plan.masked[span[0]:span[1]] if span else []
    plan_entries = [e for e in decision_entries(plan.lines) if not is_placeholder(e[3])]
    comp_log, comp_entries = [], []
    comp = companion(path, "decisions")
    if os.path.isfile(comp):
        comp_lines = (read(comp) or "").split("\n")
        comp_log = CHECK.mask(comp_lines)
        comp_entries = decision_entries(comp_lines)
    if namespace is None:
        for entries, log in ((comp_entries, comp_log), (plan_entries, plan_log)):
            namespace = entries[-1][1] if entries else declared_namespace("\n".join(log))
            if namespace:
                break
        namespace = namespace or "DEC"
    numbers = [n for _, ns, n, _ in comp_entries + plan_entries if ns == namespace]
    return "%s-%03d" % (namespace, (max(numbers) if numbers else 0) + 1), namespace


# ------------------------------------------------------------------ commands


def cmd_show(path, text):
    plan_status, tasks = collect(text)
    print("Plan Status: %s" % (plan_status or "<none>"))
    if not tasks:
        print("(no tasks)")
        return 0
    width = max(len(t[0]) for t in tasks)
    for tid, title, status in tasks:
        print("  %-*s  %-12s  %s" % (width, tid, status or "<none>", title))
    msg = consistency(text)
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
            "error: task id %r matched %d headings; expected exactly 1\n" % (task_id, len(hits))
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

    old = re.match(r"^\s*-\s*Status\s*:\s*(.*?)\r?$", lines[target]).group(1)
    indent = re.match(r"^(\s*-\s*)Status\s*:", lines[target]).group(1)
    lines[target] = "%sStatus: %s%s" % (indent, status, eol_of(lines[target]))
    new_text = "\n".join(lines)
    write_text(path, new_text)
    print("Task %s -> %s" % (task_id, status))
    log_event(
        path,
        new_text,
        "status",
        task=task_id,
        **{"from": CHECK.normalize_status(old, TASK_STATUSES), "to": status}
    )

    msg = consistency(new_text)
    if msg:
        # Warn only. Promoting a plan to COMPLETED is a decision, not a
        # bookkeeping step, so `set` never edits the plan status.
        sys.stderr.write("warning: E005 %s\n" % msg)
    return 0


def cmd_set_plan(path, text, status):
    if status not in PLAN_STATUSES:
        sys.stderr.write(
            "error: %r is not a plan status; valid values are: %s\n"
            % (status, ", ".join(sorted(PLAN_STATUSES)))
        )
        return 2
    _, tasks = collect(text)
    normalized = [CHECK.normalize_status(s, TASK_STATUSES) for _, _, s in tasks if s is not None]
    msg = CHECK.status_consistency(status, [n for n in normalized if n])
    if msg and status == "COMPLETED":
        sys.stderr.write("error: refusing COMPLETED: E005 %s\n" % msg)
        return 1

    plan = CHECK.Plan(path, text)
    try:
        start, end = section_bounds(plan, "Metadata")
    except WriteError as exc:
        sys.stderr.write("error: %s\n" % exc)
        return 1
    target = None
    for i in range(start + 1, end):
        if re.match(r"^\s*-\s*Plan Status\s*:", plan.masked[i]):
            target = i
            break
    if target is None:
        sys.stderr.write("error: `## Metadata` has no `- Plan Status:` line\n")
        return 1
    lines = text.split("\n")
    old = re.match(r"^\s*-\s*Plan Status\s*:\s*(.*?)\r?$", lines[target]).group(1)
    indent = re.match(r"^(\s*-\s*)Plan Status\s*:", lines[target]).group(1)
    lines[target] = "%sPlan Status: %s%s" % (indent, status, eol_of(lines[target]))
    new_text = "\n".join(lines)
    write_text(path, new_text)
    print("Plan Status -> %s" % status)
    log_event(
        path,
        new_text,
        "plan_status",
        **{"from": CHECK.normalize_status(old, PLAN_STATUSES), "to": status}
    )
    if msg:
        sys.stderr.write("warning: E005 %s\n" % msg)
    return 0


FIELD_ALIASES = {re.sub(r"[^a-z]", "", f.lower()): f for f in RESUME_FIELDS}
FIELD_ALIASES.update({"green": "Green / Red", "env": "Live environment", "next": "Next runnable"})


def parse_resume_file(text):
    """Fields from `Field: value` / `- Field: value` lines; indented lines continue."""
    fields, current = {}, None
    for raw in text.splitlines():
        m = re.match(r"^\s*(?:-\s*)?([A-Za-z][A-Za-z /]*?)\s*:\s*(.*)$", raw)
        key = FIELD_ALIASES.get(re.sub(r"[^a-z]", "", m.group(1).lower())) if m else None
        if key is None and m and m.group(1).strip().lower() == "detail":
            key = "detail"
        if key:
            current = key
            fields[key] = m.group(2).strip()
        elif current and raw.strip():
            fields[current] += "\n" + raw.strip()
    return fields


def cmd_resume(path, text, args):
    fields = {}
    if args.from_file:
        src = read(args.from_file)
        if src is None:
            return 66
        fields = parse_resume_file(src)
    if "Stop" in fields and "detail" not in fields:
        m = re.match(r"^\s*`?(\w+)`?\s*(?:[—:-]+\s*(.*))?$", fields["Stop"], re.S)
        if m:
            fields["Stop"], fields["detail"] = m.group(1), (m.group(2) or "").strip()
    for key, value in (
        ("State", args.state),
        ("Next runnable", args.next),
        ("Stop", args.stop),
        ("detail", args.detail),
        ("Green / Red", args.green),
        ("Live environment", args.env),
        ("Next IDs", args.next_ids),
        ("Risks", args.risks),
    ):
        if value is not None:
            fields[key] = value
    missing = [k for k in ("State", "Next runnable", "Stop") if not fields.get(k)]
    if missing:
        sys.stderr.write("error: resume needs %s (flags or --from-file)\n" % ", ".join(missing))
        return 64
    stop = fields["Stop"].strip().strip("`").lower()
    if stop not in STOP_REASONS:
        sys.stderr.write(
            "error: %r is not a stop reason; valid values are: %s\n"
            % (fields["Stop"], " | ".join(STOP_REASONS))
        )
        return 2
    detail = (fields.get("detail") or "").strip()

    plan = CHECK.Plan(path, text)
    if not fields.get("Next IDs"):
        in_progress = [t["id"] for t in plan.tasks if task_status(t) == "IN PROGRESS"]
        near = in_progress[0] if in_progress else None
        fields["Next IDs"] = "Task %s; %s" % (
            next_task_id(plan, near),
            next_decision_id(path, text)[0],
        )
    fields["Updated"] = utc_stamp()
    fields.setdefault("Green / Red", "not recorded")
    fields.setdefault("Live environment", "none")
    fields.setdefault("Risks", "none")
    fields["Stop"] = stop + (" — " + detail if detail else "")

    body = list(RESUME_COMMENT) + [""]
    for name in RESUME_FIELDS:
        value = fields.get(name) or "none"
        first, *rest = value.split("\n")
        body.append("- %s: %s" % (name, first.strip()))
        body += ["  " + r.strip() for r in rest if r.strip()]
    block = "\n".join(["## Resume", ""] + body + [""])
    size = len(block.encode("utf-8"))
    if size > CHECK.RESUME_SIZE_LIMIT or len(body) > RESUME_MAX_LINES:
        sys.stderr.write(
            "error: Resume block would be %d bytes / %d lines (cap %d bytes / %d lines); "
            "move detail to the notes file (`note`) and link it\n"
            % (size, len(body), CHECK.RESUME_SIZE_LIMIT, RESUME_MAX_LINES)
        )
        return 2

    try:
        if "Resume" in plan.sections:
            new_text = replace_section_body(path, text, "Resume", body)
        else:
            after = "Status Legend" if "Status Legend" in plan.sections else "Metadata"
            new_text = insert_section_after(path, text, after, "Resume", body)
            sys.stderr.write("note: the plan had no `## Resume`; inserted after `## %s`\n" % after)
    except WriteError as exc:
        sys.stderr.write("error: %s\n" % exc)
        return 1
    write_text(path, new_text)
    in_progress = [t["id"] for t in CHECK.Plan(path, new_text).tasks if task_status(t) == "IN PROGRESS"]
    log_event(
        path,
        new_text,
        "resume",
        task=",".join(in_progress) or None,
        stop=stop,
        detail_empty=not detail,
    )
    print("Resume block written (%d bytes). Restart prompt:" % size)
    print('  Continue %s from its Resume block' % os.path.relpath(path))
    print("End the final message with: Stop: %s" % fields["Stop"])
    return 0


def entry_lines(entry_id, title, task, decision, rationale):
    def wrap(label, value):
        first, *rest = value.strip().split("\n")
        return ["- %s: %s" % (label, first)] + ["  " + r.strip() for r in rest if r.strip()]

    return (
        ["### %s — %s" % (entry_id, title.strip()), ""]
        + wrap("Date", today())
        + wrap("Task", task)
        + wrap("Decision", decision)
        + wrap("Rationale", rationale)
    )


def cmd_decision(path, text, args):
    plan = CHECK.Plan(path, text)
    if args.task not in {t["id"] for t in plan.tasks}:
        sys.stderr.write("warning: no `Task %s:` heading in the plan; recorded as given\n" % args.task)
    entry_id, _ = next_decision_id(path, text, args.namespace)
    entry = entry_lines(entry_id, args.title, args.task, args.decision, args.rationale)

    comp = companion(path, "decisions")
    if os.path.isfile(comp):
        ctext = read(comp)
        if ctext is None:
            return 66
        newline = "\r\n" if "\r\n" in ctext else "\n"
        clines = [l.rstrip("\r") for l in ctext.split("\n")]
        masked = CHECK.mask(clines)
        # The companion's "no entries yet" placeholder would contradict the first entry.
        clines = [l for l, m in zip(clines, masked) if not re.match(r"^_None yet\b.*_$", m.strip())]
        while clines and clines[-1].strip() == "":
            clines.pop()
        write_text(comp, newline.join(clines + [""] + entry) + newline)
        where = os.path.basename(comp)
    else:
        try:
            start, end = section_bounds(plan, "Decision Log")
        except WriteError as exc:
            sys.stderr.write("error: %s\n" % exc)
            return 1
        lines = text.split("\n")
        eol = eol_of(lines[start])
        placeholder = [e for e in decision_entries(lines) if start < e[0] < end and is_placeholder(e[3])]
        if placeholder:
            # Replace the template's example entry rather than numbering past it.
            p = placeholder[0][0]
            q = end
            for i in range(p + 1, end):
                if re.match(r"^#{1,3}\s", plan.masked[i]):
                    q = i
                    break
            while q - 1 > p and lines[q - 1].strip() == "":
                q -= 1
            splice(lines, p, q, entry, eol)
        else:
            k = end
            while k - 1 > start and lines[k - 1].strip() == "":
                k -= 1
            new = [""] + entry
            if k == end and end < len(lines):
                new.append("")
            lines[k:k] = [l + eol for l in new]
        new_text = "\n".join(lines)
        write_text(path, new_text)
        text = new_text
        where = "## Decision Log"
    print("%s appended to %s" % (entry_id, where))
    log_event(path, read(path) or text, "decision", task=args.task, to=entry_id)
    return 0


def cmd_note(path, text, args):
    note_path = companion(path, "notes")
    body = " ".join(args.text).strip()
    if not body:
        sys.stderr.write("error: empty note\n")
        return 64
    if os.path.isfile(note_path):
        existing = read(note_path)
        if existing is None:
            return 66
    else:
        existing = (
            "# Notes — %s\n\nAppend-only evidence and run ledger for [%s](%s), written by "
            "`plan-status.py note`. The plan keeps at most 3 result lines per task.\n\n"
            % (os.path.basename(path), os.path.basename(path), os.path.basename(path))
        )
    eol = "\r\n" if "\r\n" in existing else "\n"
    first, *rest = body.split("\n")
    entry = ["- %s — Task %s: %s" % (utc_stamp(), args.task, first)]
    entry += ["  " + r.strip() for r in rest if r.strip()]
    if not existing.endswith("\n"):
        existing += eol
    write_text(note_path, existing + eol.join(entry) + eol)
    print("note appended to %s" % os.path.basename(note_path))
    log_event(path, text, "note", task=args.task)
    return 0


def raw_block(plan, start, end):
    return "\n".join(l.rstrip("\r") for l in plan.lines[start:end]).strip("\n")


def checker_summary(plan):
    try:
        required = CHECK.required_sections()
    except RuntimeError as exc:
        return "unavailable (%s)" % exc
    root = CHECK.git_root(plan.path)
    layout = root or os.path.dirname(plan.path)
    findings = CHECK.check(plan, "docs/plans", layout, root, root is None, required)
    findings = [f for f in findings if f.id != "E002"]  # location is not a resume concern
    errors = sorted({f.id for f in findings if f.severity == "error"})
    warnings = sorted({f.id for f in findings if f.severity == "warning"})
    def part(severity, ids):
        n = sum(1 for f in findings if f.severity == severity)
        return "%d %s(s)%s" % (n, severity, " (%s)" % ", ".join(ids) if ids else "")

    return "%s, %s" % (part("error", errors), part("warning", warnings))


def cmd_brief(path, text):
    plan = CHECK.Plan(path, text)
    out = []
    size = len(text.encode("utf-8"))
    counts = {}
    for t in plan.tasks:
        s = task_status(t) or "<invalid>"
        counts[s] = counts.get(s, 0) + 1
    out.append("# Brief: %s" % os.path.basename(path))
    out.append("")
    out.append(
        "- Plan Status: %s | Format: %s | %d KB%s"
        % (
            plan.plan_status or "<none>",
            plan.metadata.get("Plan Format", "<none>"),
            size // 1024,
            " (over 60 KB: read sections, not the whole file)" if size > CHECK.PLAN_SIZE_LIMIT else "",
        )
    )
    out.append("- Tasks: " + ", ".join("%d %s" % (n, s) for s, n in sorted(counts.items())))
    out.append("- check-plan: " + checker_summary(plan))
    msg = consistency(text)
    if msg:
        out.append("- E005: " + msg)

    span = plan.section_span("Resume")
    out.append("")
    if span:
        out.append(raw_block(plan, span[0], span[1]))
    else:
        out.append("## Resume\n\n(none: this plan predates v2.1; `resume` will add one)")

    in_progress = [t for t in plan.tasks if task_status(t) == "IN PROGRESS"]
    runnable = runnable_tasks(plan)
    out.append("")
    out.append("## Runnable next")
    out.append("")
    if runnable:
        for t, deps, unparsed in runnable:
            note = "deps %s" % ", ".join(deps) if deps else "no deps"
            if unparsed:
                note = "deps unparsed: %s" % CHECK.field_value(t["body"], "Depends On")
            out.append("- %s: %s (%s; line %d)" % (t["id"], t["title"], note, t["line"]))
    else:
        out.append("- none")
    near = in_progress[0]["id"] if in_progress else (runnable[0][0]["id"] if runnable else None)
    dec_id, _ = next_decision_id(path, text)
    out.append("")
    out.append("- Next IDs: Task %s; %s" % (next_task_id(plan, near), dec_id))

    comps = []
    stem = os.path.splitext(os.path.basename(path))[0]
    base = stem[: -len("-plan")] if stem.endswith("-plan") else stem
    directory = os.path.dirname(path)
    for name in sorted(os.listdir(directory)):
        if name.startswith(base + "-") and name.endswith(".md") and name != os.path.basename(path):
            comps.append("%s (%d KB)" % (name, os.path.getsize(os.path.join(directory, name)) // 1024))
    out.append("- Companion files: " + (", ".join(comps) if comps else "none"))
    events = EVENTS.read(path)
    out.append("- Event log: %d event(s) at %s" % (len(events), EVENTS.log_path(path)))

    head = "\n".join(out)
    budget = BRIEF_BUDGET - len(head.encode("utf-8")) - 256
    tail = ["", "## In progress", ""]
    if not in_progress:
        tail.append("- none")
    for t in in_progress:
        end = t["body"][-1][0] + 1 if t["body"] else t["index"] + 1
        block = raw_block(plan, t["index"], end)
        share = max(512, budget // len(in_progress))
        encoded = block.encode("utf-8")
        if len(encoded) > share:
            block = encoded[:share].decode("utf-8", "ignore").rstrip() + (
                "\n... (truncated; read plan lines %d-%d)" % (t["index"] + 1, end)
            )
        tail += [block, ""]
    sys.stdout.write(head + "\n" + "\n".join(tail).rstrip("\n") + "\n")
    return 0


# ---------------------------------------------------------------------- main


class Parser(argparse.ArgumentParser):
    def error(self, message):
        self.print_usage(sys.stderr)
        sys.stderr.write("error: %s\n" % message)
        sys.exit(64)


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = Parser(
        prog="plan-status.py",
        description="Read or change the state of a manual-planning plan.",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("plan", help="path to the plan file")
    sub = p.add_subparsers(dest="command", required=True, parser_class=Parser)
    sub.add_parser("show", help="print the plan status and every task status")
    sub.add_parser(
        "brief",
        help="read-only resume digest: Resume block, runnable tasks, IN PROGRESS task bodies (<= 15 KB)",
    )
    s = sub.add_parser("set", help="set one task's status")
    s.add_argument("task_id", help="task id as the plan numbers it, e.g. 1.2 or 2")
    s.add_argument("status", help='new status, as ONE quoted argument, e.g. "IN PROGRESS"')
    sp = sub.add_parser("set-plan", help="set the metadata Plan Status (refuses an inconsistent COMPLETED)")
    sp.add_argument("status", help='new plan status, as ONE quoted argument, e.g. "IN PROGRESS"')
    r = sub.add_parser("resume", help="rewrite the ## Resume block (the session handover)")
    r.add_argument("--state", help="where the work stands, one or two sentences")
    r.add_argument("--next", help="next runnable task id(s)")
    r.add_argument("--stop", help="stop reason: " + " | ".join(STOP_REASONS))
    r.add_argument("--detail", help="why, for any stop short of done (the gate, question, ...)")
    r.add_argument("--green", help="Green / Red: last full build/lint/test result")
    r.add_argument("--env", help="live environment: processes, ports, scratch paths")
    r.add_argument("--next-ids", help="next task / decision id (computed when omitted)")
    r.add_argument("--risks", help="open risks for what is left")
    r.add_argument("--from-file", help="read the fields from a `Field: value` file; flags override it")
    d = sub.add_parser("decision", help="append a Decision Log entry with the next id")
    d.add_argument("--task", required=True, help="task id the decision belongs to")
    d.add_argument("--title", required=True)
    d.add_argument("--decision", required=True, help="what was chosen")
    d.add_argument("--rationale", required=True, help="why")
    d.add_argument("--namespace", help="id namespace, e.g. POOL-DEC (default: the plan's own)")
    n = sub.add_parser("note", help="append a timestamped line to the companion -notes.md")
    n.add_argument("--task", required=True, help="task id the note belongs to")
    n.add_argument("text", nargs="+", help="the note")
    args = p.parse_args(argv)

    path = os.path.abspath(args.plan)
    text = read(path)
    if text is None:
        return 66
    if args.command == "show":
        return cmd_show(path, text)
    if args.command == "brief":
        return cmd_brief(path, text)
    if args.command == "set":
        return cmd_set(path, text, args.task_id, args.status)
    if args.command == "set-plan":
        return cmd_set_plan(path, text, args.status)
    if args.command == "resume":
        return cmd_resume(path, text, args)
    if args.command == "decision":
        return cmd_decision(path, text, args)
    return cmd_note(path, text, args)


if __name__ == "__main__":
    sys.exit(main())
