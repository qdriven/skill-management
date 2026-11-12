# Static mirror recipe (L1/SSG sites)

For statically-built sites (Astro / Vite SSG / Hugo / plain static exports) when the goal is fidelity. The deployed assets **are** the truth: served as-is from a web root, they run the site's real code — including its bugs.

## Why not wget

Runtime-fetched binaries (`.sog/.buf/.wasm/.riv`) are requested by JS at scroll progress — `wget --mirror` never sees them. `mirror-site.mjs` drives a real browser, scrolls the whole page, and captures **every** response, then re-downloads same-origin assets through the browser's network stack (same cookies/proxy), preserving original paths.

## Steps

```bash
# 1. Mirror (repo root)
node packages/clone-tools/scripts/mirror-site.mjs --url <url> --out apps/<slug>/RECON/mirror
# outputs: RECON/mirror/site/ (serve this as web root), mirror-manifest.json,
#          own-asset-urls.txt, third-party.json

# 2. Manual finish-up inside site/
#    a. Self-host locked webfonts: third-party.json lists webfont_css_to_selfhost
#       (Typekit kit.css / Google fonts CSS). Download the CSS, extract woff2/woff/otf
#       (identify by magic bytes), rewrite the @import to the local copy.
#    b. Remove tracking (GA/gtag/fbq/hotjar/clarity) — audit-clone.mjs finds them.
#    c. Public CDN references may stay online; disclose them in NOTES.md.

# 3. Serve + verify
cd apps/<slug>/RECON/mirror && npx serve site -l 8124
# console must be clean; compare against source with visual-diff.mjs
```

## Verify

Pixel-compare hero and each section against the source (same viewport/state). On a good L1 mirror expect diff ratios under ~1%. Record the score in NOTES.md. Tracking/brand residue: run `audit-clone.mjs --project apps/<slug> --brand "<name>"`.

License discipline from SKILL section 0 applies with full force: a perfect mirror is a perfect copy — no license means local study only.
