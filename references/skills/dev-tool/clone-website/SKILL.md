---
name: clone-website
description: Rebuild existing web pages as working local code, matching their real content, assets, responsive layout, and interactions. Use for website cloning, replication, or reverse engineering, including Framer sites and animated pages. 中文触发词：复刻网站、克隆网站、仿站、抄个站、照着这个站做一个、还原网页效果/交互、把网站搬下来。
---

# Clone a website (workspace edition)

> 中文版：[SKILL.zh-CN.md](SKILL.zh-CN.md) · 修改清单：[TODO.md](TODO.md)

Recreate the target site inside this workspace. One site = one app under `apps/<slug>/` (created by `init-clone`). Match the source before adding any new design direction. Deliver working, editable code or a faithful static mirror: screenshots, iframes, and downloaded production bundles are references, not the implementation.

**All paths below are relative to the workspace root; run all tools from there.** Tools live in `packages/clone-tools/scripts/` (node >= 18, playwright auto-falls-back to local Chrome on Windows).

## 0. Contract and guardrails

1. **License first.** Before extracting anything, identify the site's license (repo README, site footer, terms page). **No license = all rights reserved: local study only, never deploy publicly.** Record the verdict in `apps/<slug>/NOTES.md`. Run `audit-clone.mjs` before any handoff — it flags tracking scripts and brand residue.
2. **Truth first. Never trust AI-guessed code.** Prefer real source code (GitHub, sourcemaps) over reconstruction; every concept-level analysis must be verified line-by-line against real source before you copy anything. Mark evidence `SOURCE` (real code/bytes), `PARTIAL` (named but unverified), `GUESS` (visual fit). Never present a GUESS as done.
3. **RUNSHEET contract.** Create `apps/<slug>/docs/RUNSHEET.md` before building: one checkbox + evidence line per step. Re-read it after every context compression; update it as you go. A claim without evidence is not done.
4. **Stay in scope.** No databases, admin panels, CMS backends, lead storage, or deployment unless explicitly requested. Local build passing is the default finish line.

## 1. Decide: source, classify, pick a path

Work top-down; do not skip to building.

1. **Hunt real source first.** `gh search repos` / web search for the project; check `sourcemap-hunt.mjs` for shipped `.map` files. Found and license-compatible → build from source (highest fidelity), skip heavy recon.
2. **Recon.** Baseline always:
   ```bash
   node packages/clone-tools/scripts/recon-site.mjs --url <url> --out apps/<slug>/RECON --label original
   ```
   Add per signals: multi-page → `route-crawl.mjs`; interactions/animations → `interaction-probe.mjs`; SPA/API data → `network-capture.mjs`; assets → `asset-harvest.mjs`; bundles → `sourcemap-hunt.mjs`.
   For apps that paint a loading overlay or draw a startup sequence, pass `--settle-text "<loading text>"` to both `recon-site` and `interaction-probe` so the capture waits for the overlay to disappear instead of photographing it. Add `--reuse-page` to `interaction-probe` for single-page apps so the startup sequence does not replay per action and the "changed" signal stays meaningful.
3. **Classify and pick a mode** (L1-L6, four modes, scoring — see [assessment](references/assessment.md)). Write the pre-build prediction (what will be high-fidelity, what approximated, what excluded) into NOTES.md.
4. **Pick a path:**

| Signal | Path |
|---|---|
| Real source available | Rebuild from source in `apps/<slug>` |
| Static-built site (Astro/Vite SSG/Hugo), fidelity is the goal | `mirror-site.mjs` 1:1 mirror — see [static-mirror](references/static-mirror.md) |
| Framework SPA (React/Next/Vue), needs editing | Rebuild: sections 2→5 below |
| SaaS/logged-in app, display layer only | Rebuild shell + `network-capture` fixtures for data |
| WebGL/canvas effect core | Deep reverse-engineering discipline — real shaders/source, never invented |
| Open-source theme exists | Use the theme, rebrand content |

**Interaction-model check comes before any layout work:** determine whether each animated section is scroll-driven or click-driven (run `interaction-probe`, inspect native inputs). A click imitation of a scroll-driven section is a different product — this is the most expensive mistake; make it first.

## 2. Map the work

Read this skill's conventions and existing `apps/*` routes. Record a short source-URL → local-destination map and the files each page owns in NOTES.md.

- Clone artifacts live inside the app: `RECON/` (evidence), `docs/` (RUNSHEET, research briefs, specs), `site/` (mirror output) or the app source itself.
- Different origins get **separate apps** — that is this workspace's default. Combined sites (only if requested) need distinct route prefixes and scoped fonts/styles/layout.
- Preserve source pathnames for multiple pages of one origin; query/fragment variants are states of the same route — reproduce the states.
- A first clone may replace nothing — apps here start empty except NOTES/RECON.
- Escape URL segments that clash with framework syntax (`_`, `@`, brackets), then verify the real request still resolves.

Finish this section when every requested URL has a destination and file ownership is clear.

## 3. Observe before building

Inspect the whole page at desktop and mobile widths. Scroll top to bottom to load lazy media and reveal sticky/pinned scenes. Then exercise menus, tabs, accordions, carousels, hover states, and primary links. Distinguish changes driven by **scroll, click, hover, or time**.

Treat each observation as one sample of a **rule**. Read declared values (computed styles, CSS variables, a library's live options) rather than inferring from one rendering; vary viewport width (including wider than the design), height, input, and state until you know what drives each change. Drive the page the way visitors do (wheel, touch, keyboard, pointer); scripted scrolling bypasses behavior attached to those inputs, such as smooth scrolling.

Save source screenshots labeled with viewport, scroll position, and interaction state (RECON/screenshots). Keep one compact page brief in `docs/`: section order, typography, layout measurements, asset mapping, interactions. Extraction details: [inspection-guide](references/inspection-guide.md). Framer/sticky/reveal pages: [framer-and-motion](references/framer-and-motion.md).

Use the source's real text and the files it actually loads (fonts, images, SVGs, video). A same-named substitute from another provider has different metrics or shapes. Track source URL → local path and verify content type/dimensions: a `.png` URL may return AVIF; an HTTP 200 may be an error page. Known failure modes: [field-notes](references/field-notes.md).

Finish when every section and meaningful state has enough evidence to build, with unavailable details identified. A large DOM dump does not replace looking at the page.

## 4. Build a complete first pass

Establish fonts, page width, colors, assets, routes, page-wide behavior, and shared components first — each shared component built with every observed state (hover, focus, breakpoints) so later sections reuse it as-is. Prefer CSS for layout/simple motion; add an animation library only when source behavior needs it.

**Spec files are the single source of truth for delegated work.** For each independent section write `docs/research/components/<name>.spec.md`: DOM structure, exact computed styles, states & behaviors (trigger → before/after → transition), verbatim text, assets, breakpoints. **A spec over ~150 lines must be split.** Give builders the spec inline plus screenshots, asset paths, destination files, and a concrete finish line. Build order: foundation first, then sections (parallelizable once shared files have an owner), then page assembly.

Recreate in-scope interactions; visible controls must perform what they promise. Keep out-of-scope outbound links pointing at the source and disclose them. Run the project's build check after each integrated slice.

## 5. Compare, repair, repeat

Open source/local at the **same viewport, scroll position, and state**. Let fonts, media, and reveals settle. Review every place section 3 found a rule changing, plus one viewport wider than the design. A side-by-side montage locates drift; full-size sections establish detail.

**Quantified screening:**
```bash
node packages/clone-tools/scripts/visual-diff.mjs --original <src.png> --clone <local.png> --out apps/<slug>/RECON/diff.json --diff apps/<slug>/RECON/diff.png
node packages/clone-tools/scripts/compare-recon.mjs --original apps/<slug>/RECON/original-recon.json --clone apps/<slug>/RECON/clone-recon.json --visual-diff apps/<slug>/RECON/diff.json --out apps/<slug>/CLONE_REPORT.md
```

Fix the largest visible differences first: geometry, missing sections/layers, typography/wrapping, asset crop — then spacing and motion. Compare animated regions in initial, active, and settled states, including reverse scroll.

**Dual audit loop:** run two review passes — one for pixel fidelity (typography, spacing, color, crops, breakpoints), one for behavior fidelity (every interaction recorded in research notes, exercised for real). Both passes find what is wrong and praise nothing. Merge findings into a fix list (above-the-fold first, drop nothing), fix, re-verify. **Done = two consecutive rounds with zero findings, plus a passing production build and rendered comparison.** State remaining differences precisely instead of calling an unchecked result pixel-perfect.

## 6. Audit and deliver

```bash
node packages/clone-tools/scripts/audit-clone.mjs --project apps/<slug> --brand "<source name>" --out apps/<slug>/CLONE_AUDIT.md
```

Resolve tracking/brand residue findings. Then deliver: preview/run instructions, the source→local route map, representative desktop/mobile comparisons, checks actually run, remaining visual/functional gaps, and the license/attribution note from NOTES.md. Update NOTES.md scores with evidence. Artifact templates: [deliverables](references/deliverables.md).
