# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-03-26

### Added
- Life events parsed from GEDCOM and displayed in the side panel view (`ADOP`, `BAPM`, `BARM`, `BASM`, `BLES`, `BURI`, `CENS`, `CHR`, `CHRA`, `CONF`, `CREM`, `EMIG`, `EVEN`, `FCOM`, `GRAD`, `IMMI`, `NATU`, `OCCU`, `ORDN`, `PROB`, `RELI`, `RESI`, `RETI`, `TITL`, `WILL`)
- Life events editor in the edit panel — add, remove, and edit events with type dropdown, date, and place fields
- Parents section in the side panel view
- Marriage date and place shown in the marriages section (view) and editable (edit)
- Photo URL field in the edit panel — updates the avatar circle and panel header image
- `updateFamily()` on `Tree` and `EditEngine` for persisting marriage edits
- Section headers in the edit panel grouping Birth & Death / Life Events / Marriages / Notes

### Changed
- Side panel inline styles replaced with proper `ftv-` CSS classes throughout

## [1.2.0] - 2026-03-26

### Added
- `apiBase` option on `loadWikiTree()` and `loadWikiTreeData()` — supply your own proxy URL to work around WikiTree's CORS restrictions
- Cloudflare Worker proxy (`cloudflare-worker/wikitree-proxy.js`) — forwards requests to WikiTree, adds CORS headers, caches responses for 5 minutes

### Fixed
- WikiTree API calls now work from GitHub Pages and any external origin via the Cloudflare Worker proxy
- HTTP 429 rate limit responses surface as a readable error message rather than a generic failure
- Dev server routes WikiTree requests through the Vite proxy to avoid CORS errors on localhost

## [1.1.0] - 2026-03-26

### Added
- `loadWikiTree(id, options?)` method — fetch and render ancestors directly from WikiTree by profile ID, no GEDCOM file needed
- `depth` option (1–4 generations, default 3) controls how many ancestor generations to retrieve
- Profile photos displayed in the avatar circle when available from WikiTree (`PhotoData` field)
- `photoUrl?: string` field on `Individual` type
- Multi-page GitHub Pages demo site: landing page, GEDCOM demo, WikiTree demo, API docs
- Cloudflare Worker proxy for WikiTree API CORS (production)
- Vite dev server proxy for WikiTree API CORS (development)

### Fixed
- WikiTree loader uses `getPeople` API (replaces deprecated `getAncestors`)
- Private/permission-denied profiles no longer crash the loader (Id ≤ 0 sentinel entries filtered out)
- Corrected example WikiTree IDs: `Einstein-1`, `Darwin-15`, `Washington-11`

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
