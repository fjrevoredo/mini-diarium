#!/usr/bin/env python3
"""Create a correctly named, correctly located, version-stamped plan file.

The git-tracking situation is reported, never silently changed: by default the
plan appears as `??` in `git status` and the two ways to resolve that are
printed.

`.gitignore` is itself a tracked file, so writing the exclusion there would
create exactly the commit the untracked default exists to avoid. That is why
`--exclude-locally` writes to `.git/info/exclude` instead.

The title should be ASCII. A non-ASCII title degrades badly
(`unicode-ish title` with accents slugs down to its consonants) -- valid against
E001 but useless as a filename.

Exit codes:
  0  plan created
  1  refused: the target file already exists (use --force)
  2  refused: the title yields no usable slug, or the generated filename would
     fail check-plan.py E001
 64  usage error
 65  could not read the skill version or the template
"""

import argparse
import datetime
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.realpath(__file__))
SKILL_ROOT = os.path.dirname(HERE)

# Must stay identical to check-plan.py E001.
E001_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-plan\.md$")


def slugify(title):
    """Lowercase, collapse every run of non-[a-z0-9] to one '-', strip edges.

    A naive `title.lower().replace(" ", "-")` produces filenames that this
    script's own checker rejects: "don't break it" keeps the apostrophe,
    "v0.5.3 review" keeps the dots, and "C++ / API_v2 fix" keeps a slash, which
    would create a subdirectory.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    # "already a plan" must not become "...-already-a-plan-plan.md".
    slug = re.sub(r"-?plan$", "", slug).strip("-")
    return slug


def skill_version():
    """Read metadata.version from SKILL.md's frontmatter.

    Never a literal in this script, so the stamp cannot disagree with the skill
    that produced it. Parsed with a regex rather than `yaml`, which is not in
    the standard library.
    """
    path = os.path.join(SKILL_ROOT, "SKILL.md")
    try:
        text = open(path, encoding="utf-8").read()
    except OSError as exc:
        sys.stderr.write("error: cannot read %s: %s\n" % (path, exc))
        return None
    parts = text.split("---")
    if len(parts) < 3:
        sys.stderr.write("error: %s has no YAML frontmatter\n" % path)
        return None
    m = re.search(r"^\s*version:\s*[\"']?(\d+\.\d+\.\d+)[\"']?\s*$", parts[1], re.M)
    if not m:
        sys.stderr.write("error: no metadata.version in %s frontmatter\n" % path)
        return None
    return m.group(1)


def git(args, cwd):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=False)


def git_root(start):
    out = git(["git", "rev-parse", "--show-toplevel"], start)
    if out.returncode != 0:
        return None
    return out.stdout.strip() or None


def has_tracked_plans(root, plan_dir):
    """Follow an existing repository convention rather than imposing one."""
    if not root:
        return False
    out = git(["git", "ls-files", "--", os.path.join(plan_dir, "*.md")], root)
    return out.returncode == 0 and bool(out.stdout.strip())


def main(argv=None):
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            self.print_usage(sys.stderr)
            sys.stderr.write("error: %s\n" % message)
            sys.exit(64)

    p = Parser(
        prog="new-plan.py",
        description="Create a new manual-planning plan file.",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("title", help="plan title; keep it ASCII")
    p.add_argument(
        "--milestoned",
        action="store_true",
        help="use the milestoned template (default: simple)",
    )
    p.add_argument(
        "--dir",
        default="docs/plans",
        help="plan directory, relative to the repository root (default: docs/plans)",
    )
    group = p.add_mutually_exclusive_group()
    group.add_argument(
        "--exclude-locally",
        action="store_true",
        help="append the plan directory to .git/info/exclude and stamp "
        "`Tracking: untracked (locally excluded)`",
    )
    group.add_argument(
        "--tracked",
        action="store_true",
        help="this project commits plans; leave git alone and stamp "
        "`Tracking: tracked (by user request)`",
    )
    p.add_argument("--force", action="store_true", help="overwrite an existing plan file")
    args = p.parse_args(argv)

    normalized_dir = os.path.normpath(args.dir)
    if os.path.isabs(args.dir) or normalized_dir == ".." or normalized_dir.startswith(".." + os.sep):
        sys.stderr.write("error: --dir must be a relative path within the repository\n")
        return 64

    slug = slugify(args.title)
    if not slug:
        sys.stderr.write(
            "error: title %r yields no usable slug; use ASCII letters or digits\n"
            % args.title
        )
        return 2

    version = skill_version()
    if version is None:
        return 65

    root = git_root(os.getcwd())
    base = root if root else os.getcwd()
    plan_dir = os.path.join(base, args.dir)

    name = "%s-%s-plan.md" % (datetime.date.today().isoformat(), slug)
    if not E001_RE.match(name):
        sys.stderr.write(
            "error: generated filename %r would fail check-plan.py E001; "
            "use a plainer ASCII title\n" % name
        )
        return 2

    target = os.path.join(plan_dir, name)
    if os.path.exists(target) and not args.force:
        sys.stderr.write("error: %s already exists; pass --force to overwrite\n" % target)
        return 1

    template_name = (
        "milestoned-plan-template.md" if args.milestoned else "simple-plan-template.md"
    )
    template_path = os.path.join(SKILL_ROOT, "assets", template_name)
    try:
        text = open(template_path, encoding="utf-8").read()
    except OSError as exc:
        sys.stderr.write("error: cannot read %s: %s\n" % (template_path, exc))
        return 65

    tracked_convention = has_tracked_plans(root, args.dir)
    if args.tracked or (tracked_convention and not args.exclude_locally):
        tracking = "tracked (by user request)"
    elif args.exclude_locally:
        tracking = "untracked (locally excluded)"
    else:
        tracking = "untracked"

    text = text.replace("# [Plan Title]", "# " + args.title.strip(), 1)
    text = re.sub(
        r"^- Plan Format: manual-planning v[\d.]+$",
        "- Plan Format: manual-planning v" + version,
        text,
        count=1,
        flags=re.M,
    )
    text = re.sub(r"^- Tracking: .*$", "- Tracking: " + tracking, text, count=1, flags=re.M)

    os.makedirs(plan_dir, exist_ok=True)
    with open(target, "w", encoding="utf-8") as fh:
        fh.write(text)

    print(target)

    if args.exclude_locally and root:
        exclude = os.path.join(root, ".git", "info", "exclude")
        entry = args.dir.rstrip("/") + "/"
        existing = ""
        if os.path.isfile(exclude):
            existing = open(exclude, encoding="utf-8").read()
        if entry not in existing.split():
            os.makedirs(os.path.dirname(exclude), exist_ok=True)
            with open(exclude, "a", encoding="utf-8") as fh:
                if existing and not existing.endswith("\n"):
                    fh.write("\n")
                fh.write(entry + "\n")
        sys.stderr.write("%s appended to .git/info/exclude\n" % entry)
    elif args.exclude_locally and not root:
        sys.stderr.write("note: not a git repository; --exclude-locally had nothing to do\n")

    if not root:
        sys.stderr.write("note: not a git repository; tracking not reported\n")
    elif args.exclude_locally:
        pass
    elif tracking.startswith("tracked"):
        reason = (
            "this project already commits plans" if tracked_convention else "requested"
        )
        sys.stderr.write(
            "%s : tracked (%s); git state left untouched\n" % (args.dir, reason)
        )
    else:
        display_dir = args.dir.rstrip("/") + "/"
        sys.stderr.write(
            "%s : not tracked, not excluded\n"
            "-> the plan will appear as `??` in git status\n"
            "   --exclude-locally   append %s to .git/info/exclude\n"
            "   --tracked           this project commits plans; leave git alone\n"
            % (display_dir, display_dir)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
