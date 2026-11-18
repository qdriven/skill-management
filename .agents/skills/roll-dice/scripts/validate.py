#!/usr/bin/env python3
"""Validate an Agent Skill directory against the Agent Skills format.

Zero-dependency re-implementation of the checks performed by the official
`skills-ref validate` command, so this runs on any Python 3 without PyYAML.

Checks performed:
  * SKILL.md exists at the skill root
  * the file starts with YAML frontmatter that is properly closed
  * only the allowed frontmatter fields are used
  * `name` is present, well-formed, and matches the directory name
  * `description` is present and within the length limit
  * `compatibility` is within the length limit (when present)

Usage:
    python validate.py <skill-dir> [skill-dir ...]

Exit code 0 when every skill is valid, 1 otherwise.
"""

from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

MAX_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
MAX_COMPATIBILITY_LENGTH = 500

ALLOWED_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}


def _fail_if_unclosed(raw: str) -> str | None:
    """Return an error string if frontmatter is missing or unterminated."""
    if not raw.startswith("---"):
        return "SKILL.md must start with YAML frontmatter (---)"
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return "SKILL.md frontmatter not properly closed with ---"
    return None


def _parse_scalar(value: str):
    """Parse a simple YAML scalar value (string, bool, or number)."""
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ("'", '"'):
        return text[1:-1]
    lowered = text.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass
    return text


def _parse_mapping(lines: list[str], start: int, indent: int) -> tuple[dict, int]:
    """Parse a YAML block mapping, collecting any nested mappings one level deeper."""
    result: dict = {}
    idx = start
    while idx < len(lines):
        raw = lines[idx]
        if not raw.strip() or raw.strip().startswith("#"):
            idx += 1
            continue
        line_indent = len(raw) - len(raw.lstrip())
        if line_indent < indent:
            break
        if line_indent > indent:
            idx += 1
            continue
        key, _, value = raw.strip().partition(":")
        key = key.strip()
        value = value.strip()
        if value:
            result[key] = _parse_scalar(value)
            idx += 1
            continue
        # Empty value: the nested mapping begins on the following indented lines.
        nested: dict = {}
        child_indent = None
        j = idx + 1
        while j < len(lines):
            nxt = lines[j]
            if not nxt.strip() or nxt.strip().startswith("#"):
                j += 1
                continue
            nxt_indent = len(nxt) - len(nxt.lstrip())
            if nxt_indent <= indent:
                break
            if child_indent is None:
                child_indent = nxt_indent
            ck, _, cv = nxt.strip().partition(":")
            nested[ck.strip()] = _parse_scalar(cv.strip())
            j += 1
        result[key] = nested
        idx = j
    return result, idx


def parse_frontmatter(raw: str) -> tuple[dict | None, str | None, str]:
    """Return (metadata, error, body)."""
    error = _fail_if_unclosed(raw)
    if error:
        return None, error, ""
    parts = raw.split("---", 2)
    block = parts[1]
    body = parts[2].strip()

    lines = block.splitlines()
    metadata, _ = _parse_mapping(lines, 0, 0)
    if not isinstance(metadata, dict) or not metadata:
        return None, "SKILL.md frontmatter must be a non-empty YAML mapping", body
    return metadata, None, body


def validate_name(name, skill_dir: Path) -> list[str]:
    errors = []
    if not isinstance(name, str) or not name.strip():
        errors.append("Field 'name' must be a non-empty string")
        return errors
    name = unicodedata.normalize("NFKC", name.strip())
    if len(name) > MAX_NAME_LENGTH:
        errors.append(
            f"Skill name '{name}' exceeds {MAX_NAME_LENGTH} character limit "
            f"({len(name)} chars)"
        )
    if name != name.lower():
        errors.append(f"Skill name '{name}' must be lowercase")
    if name.startswith("-") or name.endswith("-"):
        errors.append("Skill name cannot start or end with a hyphen")
    if "--" in name:
        errors.append("Skill name cannot contain consecutive hyphens")
    if not all(ch.isalnum() or ch == "-" for ch in name):
        errors.append(
            f"Skill name '{name}' contains invalid characters. "
            "Only letters, digits, and hyphens are allowed."
        )
    dir_name = unicodedata.normalize("NFKC", skill_dir.name)
    if dir_name != name:
        errors.append(
            f"Directory name '{skill_dir.name}' must match skill name '{name}'"
        )
    return errors


def validate_metadata(metadata: dict, skill_dir: Path) -> list[str]:
    errors = []
    extra = set(metadata) - ALLOWED_FIELDS
    if extra:
        errors.append(
            f"Unexpected fields in frontmatter: {', '.join(sorted(extra))}. "
            f"Allowed fields are {sorted(ALLOWED_FIELDS)}."
        )
    if "name" not in metadata:
        errors.append("Missing required field in frontmatter: name")
    else:
        errors.extend(validate_name(metadata["name"], skill_dir))
    if "description" not in metadata:
        errors.append("Missing required field in frontmatter: description")
    else:
        desc = metadata["description"]
        if not isinstance(desc, str) or not desc.strip():
            errors.append("Field 'description' must be a non-empty string")
        elif len(desc) > MAX_DESCRIPTION_LENGTH:
            errors.append(
                f"Description exceeds {MAX_DESCRIPTION_LENGTH} character limit "
                f"({len(desc)} chars)"
            )
    if "compatibility" in metadata:
        compat = metadata["compatibility"]
        if not isinstance(compat, str):
            errors.append("Field 'compatibility' must be a string")
        elif len(compat) > MAX_COMPATIBILITY_LENGTH:
            errors.append(
                f"Compatibility exceeds {MAX_COMPATIBILITY_LENGTH} character limit "
                f"({len(compat)} chars)"
            )
    return errors


def validate_skill(skill_dir: Path) -> list[str]:
    if not skill_dir.exists():
        return [f"Path does not exist: {skill_dir}"]
    if not skill_dir.is_dir():
        return [f"Not a directory: {skill_dir}"]

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        skill_md = skill_dir / "skill.md"
    if not skill_md.exists():
        return ["Missing required file: SKILL.md"]

    raw = skill_md.read_text(encoding="utf-8")
    metadata, error, _ = parse_frontmatter(raw)
    if error:
        return [error]
    return validate_metadata(metadata, skill_dir)


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: python validate.py <skill-dir> [skill-dir ...]", file=sys.stderr)
        return 2

    targets: list[Path] = []
    for arg in argv:
        path = Path(arg)
        if path.is_file() and path.name.lower() == "skill.md":
            path = path.parent
        # Resolve "." and relatives so skill_dir.name is the real directory name.
        path = path.resolve()
        targets.append(path)

    any_failed = False
    for skill_dir in targets:
        errors = validate_skill(skill_dir)
        if errors:
            any_failed = True
            print(f"Validation failed for {skill_dir}:", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"Valid skill: {skill_dir}")
    return 1 if any_failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
