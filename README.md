# family-tree-viewer

An embeddable JavaScript/TypeScript family tree visualization library. Reads and writes **GEDCOM 5.5.1** format, renders an interactive SVG tree with pan/zoom, and provides a slide-in panel for viewing and editing family members.

**[Live demo →](https://conormag.github.io/family-tree-viewer/)**

---

## Features

- Renders GEDCOM family trees as a zoomable, pannable SVG
- Gender-coded person cards (blue / rose / slate)
- Expand/collapse branches
- Click any person to open a detail/edit panel
- Add, edit, and remove individuals and families
- Export changes back to GEDCOM
- Light and dark themes
- Zero runtime dependencies — pure TypeScript, embeds anywhere
- Ships as ESM + UMD bundles with full TypeScript types

---

## Installation

```bash
npm install family-tree-viewer
```

---

## Quick start

```ts
import { FamilyTreeViewer } from 'family-tree-viewer';

const viewer = new FamilyTreeViewer('#container', {
  gedcom: gedcomString,
  theme: 'light',
  onSave: (gedcom) => console.log('updated GEDCOM:', gedcom),
});
```

The container element must have an explicit width and height (e.g. `width: 100%; height: 600px`).

### UMD / CDN

```html
<script src="https://unpkg.com/family-tree-viewer/dist/family-tree-viewer.umd.cjs"></script>
<script>
  const viewer = new FamilyTreeViewer.FamilyTreeViewer('#container', { gedcom: '...' });
</script>
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gedcom` | `string` | — | GEDCOM string to load on construction |
| `rootId` | `string` | — | GEDCOM individual ID to use as the layout root (e.g. `"@I1@"`) |
| `theme` | `'light' \| 'dark'` | `'light'` | Colour theme |
| `readonly` | `boolean` | `false` | Hides all edit controls when `true` |
| `onSave` | `(gedcom: string) => void` | — | Called after the user saves an edit |

---

## API

### `new FamilyTreeViewer(container, options?)`

Creates and mounts the viewer inside `container` (a CSS selector string or `HTMLElement`).

### `viewer.loadGedcom(text: string): void`

Replaces the currently displayed tree with a new GEDCOM string.

### `viewer.getGedcom(): string`

Returns the current tree as a GEDCOM string, including any edits made via the UI.

### `viewer.fitToScreen(): void`

Scales and centres the tree to fit the container.

### `viewer.selectPerson(id: string): void`

Programmatically selects a person by their GEDCOM ID and opens the detail panel.

### `viewer.destroy(): void`

Removes the viewer from the DOM and cleans up all event listeners.

---

## GEDCOM date format

Date fields accept standard GEDCOM date strings:

| Format | Example |
|--------|---------|
| Exact | `1 JAN 1850` |
| Month + year | `JAN 1850` |
| Year only | `1850` |
| Approximate | `ABT 1850` |
| Before | `BEF 1850` |
| After | `AFT 1850` |
| Between | `BET 1800 AND 1850` |
| Calculated | `CAL 1850` |
| Estimated | `EST 1850` |

---

## Building from source

```bash
npm install
npm run dev          # Dev server at localhost:5173 (demo)
npm run build        # Build library → dist/
npm test             # Run tests (Vitest)
npm run typecheck    # TypeScript type-check
```

---

## License

[AGPL-3.0](LICENSE) — source must be shared for network-accessible deployments.
