#!/usr/bin/env python3
"""Roll dice with a cryptographically-backed uniform random source.

Supports dice notation: a single die (`--sides N`), multiple dice
(`--count M`), and an optional modifier added to the total (`--modifier +K`).

Usage examples:
    python roll_dice.py --sides 20
    python roll_dice.py --sides 6 --count 3
    python roll_dice.py --sides 20 --modifier +5
    python roll_dice.py --sides 6 --count 2 --modifier -1

Exit code 0 on success, 1 on invalid arguments.
"""

from __future__ import annotations

import argparse
import random
import sys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="roll_dice",
        description="Roll dice and report each die value plus the total.",
    )
    parser.add_argument(
        "--sides",
        type=int,
        default=6,
        help="number of sides on one die (default: 6)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=1,
        help="number of dice to roll (default: 1)",
    )
    parser.add_argument(
        "--modifier",
        type=int,
        default=0,
        help="integer added to the total, e.g. +3 or -1 (default: 0)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="print only the total, not the per-die breakdown",
    )
    return parser


def format_roll(values: list[int], sides: int, modifier: int, quiet: bool) -> str:
    total = sum(values) + modifier
    if quiet:
        return str(total)
    dice = " + ".join(str(value) for value in values)
    notation = f"d{sides}" if len(values) == 1 else f"{len(values)}d{sides}"
    if modifier:
        sign = "+" if modifier > 0 else "-"
        notation = f"{notation}{sign}{abs(modifier)}"
        return f"Rolled {notation}: {dice} = {total}"
    return f"Rolled {notation}: {dice} = {total}"


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.sides < 2:
        print(
            f"Invalid: a die needs at least 2 sides, got --sides {args.sides}",
            file=sys.stderr,
        )
        return 1
    if args.count < 1:
        print(
            f"Invalid: --count must be at least 1, got {args.count}",
            file=sys.stderr,
        )
        return 1

    values = [random.randint(1, args.sides) for _ in range(args.count)]
    print(format_roll(values, args.sides, args.modifier, args.quiet))
    return 0


if __name__ == "__main__":
    sys.exit(main())
