# Contributing to family-tree-viewer

Thanks for your interest in contributing! This is a small open-source library and all contributions are welcome.

## Getting started

```bash
git clone https://github.com/conormag/family-tree-viewer.git
cd family-tree-viewer
npm install
npm run dev        # Dev server at http://localhost:5173 (loads demo/index.html)
```

## Before submitting a PR

```bash
npm test           # Must pass (61 tests)
npm run typecheck  # Must pass with no errors
npm run build      # Confirm the library builds cleanly
```

## Project structure

```
src/
  gedcom/       # GEDCOM parser and serializer
  model/        # Tree data model
  layout/       # Generation assignment and x/y positioning
  renderer/     # SVG rendering (cards, edges)
  interaction/  # Pan/zoom and event bus
  ui/           # Side panel (view + edit states)
  edit/         # Add/update/remove individuals and families
  styles.ts     # All CSS (ftv- prefix, injected at init)
  index.ts      # Public API: FamilyTreeViewer class
```

See [CLAUDE.md](CLAUDE.md) for architecture notes and design decisions.

## Guidelines

- **Keep it zero-dependency.** The library has no runtime dependencies and that's intentional.
- **Tests for new behaviour.** Add or update tests in `tests/` for any logic changes.
- **TypeScript strict.** No `any`, no type suppressions unless genuinely unavoidable.
- **CSS prefix.** All styles use the `ftv-` prefix to avoid collisions in host pages.
- **GEDCOM round-trips.** If you touch the parser or serializer, verify that parsing then serializing a file produces equivalent output.

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run the checks above
4. Open a PR with a clear description of what and why

For larger changes, open an issue first so we can discuss the approach before you invest time in the implementation.

## Reporting bugs

Use the [bug report template](https://github.com/conormag/family-tree-viewer/issues/new?template=bug_report.md). A minimal reproducing GEDCOM snippet is very helpful.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
