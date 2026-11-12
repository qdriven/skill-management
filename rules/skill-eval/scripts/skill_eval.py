#!/usr/bin/env python3
"""Organize SKILL trial records into the shared skill-management layout.

Layout (the README basics of the shared directory):
    references/<skill-name>/        skill under test (rule 1)
    docs/<topic>/<skill-name>/      one directory per trial (rules 2-3)
        tests/    results/    analysis.md

Root resolution order:
    --root  >  $SKILL_EVAL_ROOT  >  ~/.skill-eval-root  >  auto-detect from cwd

Standard library only, so any project and any agent can run it.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from datetime import date
from pathlib import Path

MARKER = "SKILL使用评测"
HOME_CONFIG = Path.home() / ".skill-eval-root"
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
COPY_IGNORE = shutil.ignore_patterns(
    "__pycache__", "*.pyc", ".git", ".DS_Store", ".venv", "venv", "node_modules"
)
TEMPLATE = Path(__file__).resolve().parent.parent / "examples" / "analysis-template.md"


def configure_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except AttributeError:
            pass


def die(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(2)


def check_name(kind: str, value: str) -> str:
    if not value or not NAME_RE.match(value):
        die(f"invalid {kind} name {value!r}: use a slug (letters, digits, . _ -, e.g. ui-ux)")
    return value


def is_root(path: Path) -> bool:
    readme = path / "README.md"
    if not readme.is_file():
        return False
    try:
        if MARKER in readme.read_text(encoding="utf-8", errors="ignore"):
            return True
    except OSError:
        pass
    return (path / "docs").is_dir() and (path / "references").is_dir()


def resolve_root(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit).expanduser().resolve()
        if not root.is_dir():
            die(f"--root is not a directory: {root}")
        return root
    env = os.environ.get("SKILL_EVAL_ROOT", "").strip()
    if env:
        root = Path(env).expanduser().resolve()
        if root.is_dir():
            return root
        die(f"SKILL_EVAL_ROOT is not a directory: {root}")
    if HOME_CONFIG.is_file():
        text = HOME_CONFIG.read_text(encoding="utf-8", errors="ignore").strip()
        if text:
            root = Path(text).expanduser().resolve()
            if root.is_dir():
                return root
            die(f"{HOME_CONFIG} points to a missing directory: {root}")
    cwd = Path.cwd().resolve()
    for candidate in (cwd, *cwd.parents):
        if is_root(candidate):
            return candidate
    die("shared directory not found: run `root --set <skill-management dir>` once, "
        "or pass --root / set SKILL_EVAL_ROOT")


def cmd_root(args: argparse.Namespace) -> int:
    if args.set:
        root = Path(args.set).expanduser().resolve()
        if not root.is_dir():
            die(f"--set is not a directory: {root}")
        HOME_CONFIG.write_text(str(root) + "\n", encoding="utf-8")
        print(f"saved: {HOME_CONFIG} -> {root}")
        return 0
    print(resolve_root(args.root))
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    skill = check_name("skill", args.skill)
    topic = check_name("topic", args.topic)
    print(f"root: {root}")

    # Rule 1: the skill directory lives in references/<skill>/.
    ref_dir = root / "references" / skill
    origin = ""
    if args.skill_src:
        src = Path(args.skill_src).expanduser().resolve()
        if not src.is_dir():
            die(f"--skill-src is not a directory: {src}")
        if src == ref_dir:
            print(f"skill:  {ref_dir} (source is already the target)")
        elif ref_dir.is_dir() and any(ref_dir.iterdir()) and not args.force:
            print(f"skill:  {ref_dir} (kept, pass --force to refresh)")
        else:
            if ref_dir.exists():
                shutil.rmtree(ref_dir)
                print(f"skill:  {ref_dir} (refreshing)")
            ref_dir.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(src, ref_dir, ignore=COPY_IGNORE)
            print(f"skill:  {ref_dir} (copied from {src})")
        origin = f"（复制自 {src}）"
    else:
        ref_dir.mkdir(parents=True, exist_ok=True)
        if not any(ref_dir.iterdir()):
            print(f"skill:  {ref_dir} (empty — copy the skill directory here)")

    # Rules 2-3: one docs/<topic>/<skill>/ directory per trial, three pieces inside.
    trial_dir = root / "docs" / topic / skill
    tests = trial_dir / "tests"
    results = trial_dir / "results"
    analysis = trial_dir / "analysis.md"
    tests.mkdir(parents=True, exist_ok=True)
    results.mkdir(parents=True, exist_ok=True)
    if analysis.is_file():
        print(f"analysis: {analysis} (kept)")
    else:
        if not TEMPLATE.is_file():
            die(f"template missing: {TEMPLATE}")
        text = (
            TEMPLATE.read_text(encoding="utf-8")
            .replace("{{skill}}", skill)
            .replace("{{topic}}", topic)
            .replace("{{date}}", date.today().isoformat())
            .replace("{{source}}", f"references/{skill}/{origin}")
        )
        analysis.write_text(text, encoding="utf-8")
        print(f"analysis: {analysis}")
    print(f"tests:   {tests}")
    print(f"results: {results}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    root = resolve_root(args.root)
    print(f"root: {root}")
    docs = root / "docs"
    if not docs.is_dir():
        print("docs/: missing")
        return 1
    trials = 0
    missing = 0
    for topic_dir in sorted(p for p in docs.iterdir() if p.is_dir()):
        if args.topic and topic_dir.name != args.topic:
            continue
        for skill_dir in sorted(p for p in topic_dir.iterdir() if p.is_dir()):
            if args.skill and skill_dir.name != args.skill:
                continue
            trials += 1
            parts = {
                "tests": (skill_dir / "tests").is_dir(),
                "results": (skill_dir / "results").is_dir(),
                "analysis": (skill_dir / "analysis.md").is_file(),
                "refs": (root / "references" / skill_dir.name).is_dir(),
            }
            if all(parts.values()):
                print(f"  {topic_dir.name}/{skill_dir.name}: ok")
            else:
                missing += sum(1 for ok in parts.values() if not ok)
                marks = " ".join(f"{k}={'ok' if ok else 'MISSING'}" for k, ok in parts.items())
                print(f"  {topic_dir.name}/{skill_dir.name}: {marks}")
    if trials == 0:
        print("no trials found")
        return 1
    print(f"summary: {trials} trial(s), {missing} missing piece(s)")
    return 0 if missing == 0 else 1


def main() -> int:
    configure_utf8()
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_root = sub.add_parser("root", help="print the shared directory (or persist it with --set)")
    p_root.add_argument("--root", help="shared directory override")
    p_root.add_argument("--set", metavar="DIR", help="write ~/.skill-eval-root")

    p_init = sub.add_parser("init", help="scaffold references/<skill>/ + docs/<topic>/<skill>/")
    p_init.add_argument("--root", help="shared directory override")
    p_init.add_argument("--topic", required=True, help="topic slug, e.g. ui-ux")
    p_init.add_argument("--skill", required=True, help="skill slug under test")
    p_init.add_argument("--skill-src", help="skill directory under test (copied into references/<skill>/)")
    p_init.add_argument("--force", action="store_true", help="refresh references/<skill>/ from --skill-src")

    p_check = sub.add_parser("check", help="verify the trial layout")
    p_check.add_argument("--root", help="shared directory override")
    p_check.add_argument("--topic", help="limit to one topic")
    p_check.add_argument("--skill", help="limit to one skill")

    args = parser.parse_args()
    return {"root": cmd_root, "init": cmd_init, "check": cmd_check}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
