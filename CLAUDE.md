# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`family-tree-viewer` is an embeddable JavaScript family tree visualization library, intended for use within the Irish genealogy monorepo ecosystem (see `../CLAUDE.md` for workspace context).

**License:** AGPL v3 — source must be shared for network-accessible deployments.

## Commands

```bash
npm run dev          # Dev server on :5173 (serves demo/index.html with sample.ged)
npm run build        # tsc declarations + Vite → dist/family-tree-viewer.{js,umd.cjs}
npm test             # Vitest (jsdom) — 61 tests
npm run test:watch   # Watch mode
npm run typecheck    # tsc --noEmit
```

## Tech Stack

- **Language:** TypeScript strict (no `exactOptionalPropertyTypes` — causes friction with `year?: number` + `extractYear()`)
- **Bundler:** Vite library mode → ESM + UMD with `vite-plugin-dts`
- **Tests:** Vitest (jsdom environment)
- **Styling:** CSS injected via `injectStyles()` at init (idempotent, `<style id="ftv-styles-v1">`)
- **Zero runtime dependencies**

## Architecture

```
src/
  gedcom/parser.ts        # parseGedcom(text) → GedcomNode[] (two-pass: tokenize + tree, CONC/CONT merge)
  gedcom/serializer.ts    # serializeGedcom(tree, header) → GEDCOM string (CRLF, round-trip safe)
  model/Tree.ts           # Tree class + buildTree(nodes) factory
  layout/engine.ts        # computeLayout(tree, rootId?, opts?) → LayoutResult
  renderer/SVGRenderer.ts # owns <svg>, orchestrates render
  renderer/NodeCard.ts    # creates one SVG person card <g>
  renderer/EdgePainter.ts # orthogonal elbow parent-child lines + couple connectors
  interaction/EventBus.ts # typed pub/sub (node:click, node:hover, tree:change)
  interaction/PanZoom.ts  # mouse/touch pan + wheel zoom, fitToContainer()
  ui/SidePanel.ts         # HTML slide-in panel (view + edit states)
  edit/EditEngine.ts      # add/update/remove individuals and families with cascade + bus events
  styles.ts               # all CSS as template literals (ftv- prefix)
  index.ts                # public FamilyTreeViewer class
```

## Embedding API

```ts
import { FamilyTreeViewer } from 'family-tree-viewer';

const viewer = new FamilyTreeViewer('#container', {
  gedcom: gedcomString,   // optional initial GEDCOM
  rootId: '@I1@',         // optional root person
  theme: 'light',         // 'light' | 'dark'
  readonly: false,        // hides edit controls when true
  onSave: (gedcom) => {}, // called after edits (not on every field change)
});

viewer.loadGedcom(text);
viewer.getGedcom();       // current GEDCOM string
viewer.fitToScreen();
viewer.selectPerson('@I3@');
viewer.destroy();
```

## Layout Engine Notes

Generation assignment is two-phase:
1. BFS parent→child only (no spouse crossing) from root ancestors (individuals with no `familyAsChild`)
2. Spouse alignment: raise spouse generation to match the higher of the pair (preserves parent-child lineage)

Ghost nodes are synthesized for FAMs with only one known spouse (rendered with dashed border).
