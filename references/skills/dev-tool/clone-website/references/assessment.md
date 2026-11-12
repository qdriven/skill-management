# Assessment: complexity, modes, scoring

Companion to SKILL.md section 1. Classify before building; score after delivering.

## Complexity levels L1–L6

| Level | Signal | Honest fidelity ceiling |
|---|---|---|
| L1 | Static HTML/CSS | 90–98% (or 1:1 via mirror) |
| L2 | CMS/marketing site, templated pages | 85–95% |
| L3 | React/Next/Vue content frontend | 80–95% |
| L4 | Animated brand site (GSAP/Lenis/video masks) | 50–80% — rhythm and visual grammar matter more than pixels |
| L5 | WebGL/Canvas/Three.js core | 30–95% — entirely depends on finding real source/shaders |
| L6 | SaaS/e-commerce/auth business logic | Display layer only; transactions mocked |

## Four modes

- **Faithful clone** — reproduce as-is. No design-DNA shortcuts; real source/assets are the truth.
- **Visual clone** — keep the look, swap content later; may extract a design-DNA (tokens → CSS variables).
- **Rebrand/rebuild** — keep structure and effects, replace copy/media/brand from the start.
- **Teardown** — goal is a written technical breakdown (TEARDOWN.md), not a running copy.

Write the chosen level + mode and the **pre-build prediction** (what will be high-fidelity, what approximated, what excluded, main risks) into `apps/<slug>/NOTES.md` before building.

## Post-delivery score (0–5 per dimension, evidence-backed only)

Source evidence / structural fidelity / visual fidelity / motion & interaction / responsive / functional completeness / content replacement / legal-deployment risk. A score without supporting evidence (source lines, screenshots, run results) is not a score. Log in NOTES.md; `compare-recon.mjs` auto-computes the quantitative part into CLONE_REPORT.md.
