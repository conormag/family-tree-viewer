# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-25

### Added
- GEDCOM parser and serializer (two-pass tokenizer, CONC/CONT merge, round-trip safe)
- Bottom-up layout engine with BFS generation assignment and spouse alignment
- SVG renderer with orthogonal elbow edges and ghost nodes for unknown spouses
- Pan/zoom (mouse, touch, wheel) with `fitToContainer()`
- Expand/collapse nodes
- Slide-in side panel with view and edit states
- Edit engine: add/update/remove individuals and families with cascade
- Light/dark theme support
- `readonly` mode
- `onSave` callback
- Zero runtime dependencies
- ESM + UMD builds with TypeScript declarations
