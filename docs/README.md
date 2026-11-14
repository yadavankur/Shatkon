# SHATKON Field Manual

Open `index.html` directly in a browser. It's one self-contained page with no build step and no network access. Images are in `img/`.

- Source of truth: `yadavankur/Shatkon` main `a933596` (rules/ v0.4) plus `/beta/` (campaign-engine `960a0f7`: Combat v2 and the story campaign), and the story pack v3.
- `tools/verify_guide.py`: headless Chrome check at 1440 and 390 px (console errors, nav links, overflow, combat walkthrough run to the end). It writes screenshots to `screens/`.
- `tools/src/`: page sources. `extract.py` re-reads the YAML (it expects `git archive origin/main` exported to /workspace/repo-main) and writes `data.json`. `build.py` inlines the data and the scripts into `index.html`. Run both from `tools/src/`.

## Look and brand
- Palette: deep navy base, teal/blue primary, neon only as hints. The enemy (the Weave, Seeds, the mimic, enemy ships and story beats) is purple/pink. A muted amber marks warnings.
- `brand/`: the logo and its motif kit. `brand/logo.svg` is **corrected from the original logo** (the bottom-corner triangles are removed, giving 120° symmetry). `brand/logo_original_trace.svg` is a **faithful trace** of it, flaw included. See `brand/README.md`.
- `tools/src/geom.js` holds the logo geometry, shared by the guide and `tools/src/brand.js` (run `node brand.js` to regenerate `brand/`). Ship segments throughout the guide are drawn as logo cells: bays in the core hexagons, mounts in the tip rhombi.
- The "Shatkon: the geometry" section includes the layered decomposition, the 2D→3D, hexagon-in-hexagon and fractal ideas, the flaw toggle, the original logo, the motif kit and a flower designer that exports SVG. Every animation has a reduced-motion fallback.
- The pre-re-theme sources are kept on the workstation only and are not part of this zip.
