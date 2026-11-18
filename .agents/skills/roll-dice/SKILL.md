---
name: roll-dice
description: Roll dice using a random number generator. Use when the user asks to roll a die, roll dice, throw dice, roll a d6/d10/d20/d100, roll multiple dice, or generate a random dice roll. Also use when the user wants a random number in a dice-style range such as 1-6 or 1-20.
---

# Roll Dice

Roll dice by generating a uniformly random integer within a dice's range. Always
roll with a real random source so results are unbiased and reproducible only by
chance.

## When to use

- The user asks to roll dice or a specific die (`d6`, `d10`, `d20`, `d100`, ...)
- The user asks to throw / cast dice, possibly multiple dice at once
- The user wants a random number expressed as a dice roll (e.g. "a random 1-6")

Do not use this skill for general random numbers outside a dice context (use a
plain random-number approach instead).

## How to roll

Prefer the bundled script, which handles ranges, multiple dice, and modifiers
uniformly:

```bash
python scripts/roll_dice.py --sides 20
python scripts/roll_dice.py --sides 6 --count 3
python scripts/roll_dice.py --sides 20 --modifier +5
python scripts/roll_dice.py --sides 6 --count 2 --modifier -1
```

### Dice notation

Accept the common shorthand and translate it to `--sides`:

| User says | Meaning | Command |
|-----------|---------|---------|
| `d6` | one 6-sided die | `python scripts/roll_dice.py --sides 6` |
| `d20` | one 20-sided die | `python scripts/roll_dice.py --sides 20` |
| `3d6` | three 6-sided dice | `python scripts/roll_dice.py --sides 6 --count 3` |
| `2d6+3` | two 6-sided dice plus 3 | `python scripts/roll_dice.py --sides 6 --count 2 --modifier +3` |

If the script is unavailable, fall back to a shell random source:

- bash: `echo $((RANDOM % <sides> + 1))`
- PowerShell: `Get-Random -Minimum 1 -Maximum (<sides> + 1)`

Replace `<sides>` with the number of sides (e.g. 6 for a d6, 20 for a d20).

## Interpreting results

- A single die rolls a value in `[1, sides]`, uniformly distributed.
- With `--count N`, report each individual die value **and** the total sum.
- Apply `--modifier` to the sum only, not to each individual die.

## Output format

Report concisely, one line per roll, and include the total when multiple dice
are rolled. Example for `3d6`:

```
Rolled 3d6: 4 + 2 + 5 = 11
```

## Edge cases

- **Missing number of sides**: if the user says "roll a die" without a size,
  assume a standard 6-sided die (d6) and state that assumption.
- **Invalid notation**: a die needs at least 2 sides. Reject `d1` and any
  `<sides>` below 2 with a clear message instead of rolling.
- **Large counts**: for very large `--count`, still report the total; do not
  list thousands of individual values — summarize (min, max, sum).

## Gotchas

- `RANDOM % <sides>` yields `0..sides-1`; always add `1` to land in `1..sides`.
  Getting this wrong silently biases rolls toward lower numbers.
- `Get-Random -Maximum N` is exclusive, so pass `<sides> + 1`, not `<sides>`.
- Do not use `time` or a counter to "randomize" — results are predictable.

## Validate this skill

After editing `SKILL.md`, run the bundled validator to confirm the frontmatter
still conforms to the Agent Skills format:

```bash
python scripts/validate.py .
```

Exit code `0` means valid; non-zero prints the specific format errors.
