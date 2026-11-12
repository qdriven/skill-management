# Field notes: known failure modes

Driver-agnostic lessons from past clones. Check the relevant ones during observation (SKILL section 3) and comparison (section 5).

## Assets

- **favicon.ico is a hard requirement.** Sites without an explicit link tag still serve `/favicon.ico`; browsers request it and show 404 noise. Always fetch and self-host it.
- **URL extension lies.** A `.png` URL can return AVIF/WebP; verify response content-type and bytes, store the real format locally.
- **HTTP 200 ≠ asset.** CDNs and image optimizers return an error page or placeholder with status 200. Verify dimensions by decoding, not by status.
- **`/_next/image` (Next.js optimizer) returns an HTML error shell** when the origin param is rejected — don't mirror those URLs; resolve to the underlying asset and store it directly.
- **Layered visuals are multiple assets.** Background watercolor + foreground mockup + overlay icons are separate stacked elements. Inspect stacking before rebuilding as one image or as HTML.
- **Animated SVGs depend on ancestors.** Shared symbols, fonts, ancestor-selector keyframes. Exporting the SVG alone loses the animation; carry the dependencies and watch a full cycle.
- **Fonts: verify real weight/style before declaring `@font-face`.** A static medium file served as a "variable family" makes regular text too heavy. Locked/subscription fonts (Typekit) need self-hosting from the observed files.

## Behavior

- **Determine the interaction model before layout**: scroll-driven vs click-driven vs time-driven. Imitating a scroll-driven section with clicks is a different product — the most expensive mistake.
- **Pinned scenes need scroll distance and release behavior**, not just `position: sticky`. Measure pin duration.
- **An "animated visual" may be a video.** Check `<video>` / media elements before rebuilding motion in code; use the real media when available.
- **Smooth scrolling is usually Lenis** (class `lenis` on `<html>`, or `window.lenis`). Read its options; scripted scrolling bypasses it and makes comparisons lie.
- **Full-page screenshot ≠ observed page.** Reveal-on-scroll content stays invisible unless scrolled first. Lazy media needs the scroll to enter the network log.
- **Drag verification needs real input.** Synthetic events have `isTrusted: false`; if a behavior can't be verified honestly, record it as unverified instead of claiming success.

## Comparison

- **Compare at the same viewport, scroll position, and state, after animations settle.** Entry animations make early screenshots misleading in both directions.
- **Console must be clean.** Runtime errors and failed asset requests are defects, even when the page looks right.
- **Tailwind-built sources:** extracting cleaned `outerHTML` of a section is often more faithful than hand-transcribing classes into new markup.
