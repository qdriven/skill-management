# Roll Dice

A minimal, self-contained Agent Skill that rolls dice using a real random
source and reports each die value plus the total.

## Purpose

Give an agent a reliable, unbiased way to roll dice — a single die (`d20`),
multiple dice (`3d6`), or dice with a modifier (`2d6+3`) — and format the
result consistently.

## When to use

Use this skill when the user asks to:

- roll a die, roll dice, throw or cast dice
- roll a `d6` / `d10` / `d20` / `d100`, or roll multiple dice
- get a random number expressed as a dice roll (e.g. "a random 1-6")

## Structure

```
roll-dice/
├── SKILL.md              # Required: metadata + roll instructions
└── scripts/
    ├── roll_dice.py      # Roll dice with random ranges, counts, modifiers
    └── validate.py       # Zero-dependency format validator (skills-ref rules)
```

## Usage

```bash
# Single die
python scripts/roll_dice.py --sides 20

# Multiple dice
python scripts/roll_dice.py --sides 6 --count 3

# Dice with a modifier
python scripts/roll_dice.py --sides 6 --count 2 --modifier +3

# Only the total
python scripts/roll_dice.py --sides 6 --quiet
```

## Validate the skill

```bash
python scripts/validate.py .
```

Exit code `0` means the `SKILL.md` frontmatter conforms to the Agent Skills
format (required fields present, `name` well-formed and matching the
directory). Non-zero exit prints the specific errors.
