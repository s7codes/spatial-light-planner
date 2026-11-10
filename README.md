# Spatial Studio

[![E2E Tests](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml/badge.svg)](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml)

**Live demo:** https://s7codes.github.io/spatial-light-planner/

**Spatial Studio** (by Lumen) is a zero-dependency ES module configurator for wall elevations, shelving and
ambient RGB lighting, with a 3D room preview on top. Everything is drawn at `1 cm = 2.5 px` and snapped to
whole centimeters, so the plan on screen is the plan you drill from. Lay out a wall, check it against doors,
sockets and a sloped attic ceiling, preview the backlighting in a dark room, orbit the result in 3D, then export
a bill of materials, drilling coordinates, a high-resolution PNG, a Wavefront `.obj` mesh and a VAT quote.

Plain HTML, CSS and ES modules: no framework, no bundler, no build step, no runtime dependencies.

## Evolution & Release History (v1.0 -> v2.0 -> v3.0)

The project grew in three stages. Every release kept older layout files loading and the full end-to-end suite
green, so each stage is built on the one before it rather than beside it.

### v1.x: Core 2D CAD and ambient lighting engine

- To-scale wall canvas with whole-centimeter geometry.
- Drag-and-drop placement and resize grips on a 60 fps `requestAnimationFrame` pointer loop.
- AABB collision checks against room features (doors, windows, sockets) and an attic slope solver that tests
  pieces against the exact sloped edge.
- Magnetic alignment guides, live gap readouts and CAD rulers with draggable reference guides.
- A bounded undo / redo stack (30 steps).
- Named projects in split-key `localStorage` with autosave.
- A 2x HiDPI Canvas PNG renderer, plus a BOM and drilling spec sheet.

### v2.x: Modular ES architecture, dual-persona studio and commerce

- A refactor of the original script into nine ES modules across `core/`, `ui/` and `io/`, with all shared
  mutable state on one `state` object.
- Engineer and Creator workspace modes: one keeps every drafting tool in view, the other hides rulers, guides
  and coordinate fields for arranging and lighting.
- To-scale floor reference silhouettes (`Bed`, `Desk`, `Sofa`) for checking clearances.
- Curated SVG poster artworks that render identically on the wall and in the PNG.
- An orthogonal power routing solver that runs cables to the nearest socket.
- An ergonomic clearance advisor for eye-level art and headroom above furniture.
- Item style copy / paste, a hardware and LED kit estimator, and a tape measure tool.
- Multi-currency pricing (`USD`, `EUR`, `HUF`) and an illumination estimate in W/m2.
- A branded quote generator with 27% VAT, promo codes, a client line and stock / lead-time tracking.

### v3.0: 3D spatial preview, OBJ mesh export and the Lumen brand finale

The 3D work started in v2.9; v3.0 finishes it and closes the line.

- Editable Z depth per piece (2-60 cm), one undo step per change.
- An interactive 60 fps orthographic (axonometric) 3D room preview: orbit by dragging or with sliders, LED
  halos on lit pieces, shaded or wireframe.
- Standards-compliant Wavefront `.obj` export: the wall slab plus one box per visible piece, quad faces,
  centimeters, Y up.
- A cursor-reactive splash screen whose amber and violet light pools drift against each other as the pointer
  moves, and hold still under `prefers-reduced-motion`.
- One naming scheme everywhere: Spatial Studio is the product, Lumen the brand and Lumen Spatial Studio Kft. the
  company on the quote.

## Core Capabilities

- **To-scale editing.** Drag, resize, rotate, mirror, group, align and distribute, with exact X / Y fields,
  `Alt`-measure between items, layer moves to the front or back and a tape measure (`T`).
- **Collision X-ray.** A piece pushed into a conflict turns red and every item it hits pulses until the
  conflict clears.
- **Catalog** of shelving, posters, spotlights, a corner floor lamp and an RGB lightbar, plus room features
  (socket, door, window, 55" TV) that act as no-build zones. The attic slope is sized from the topbar.
- **RGB lighting engine** on CSS custom properties: per-item backlights, corner glow, spotlight cones and wall
  paints, rendered identically by the Canvas exporter.
- **Spec sheet and quote.** BOM with drilling coordinates, LED strip, power and anchor estimate, Markdown copy,
  CSV export and a printable quote in the selected currency.
- **Projects and permalinks.** Named projects with autosave, JSON import / export behind a strict sanitizer
  (or drop a `.json` file onto the canvas) and share links that carry a whole wall in the URL hash.

## Architecture & Engineering Highlights

**Zero-dependency ES module graph.** `index.html` loads one entry, `scripts/planner-engine.js`, which imports
ten modules in three layers:

- `scripts/core/` holds constants, DOM references, the shared `state` object and pure geometry with no
  rendering.
- `scripts/ui/` holds the viewport, rulers, Inspector, Layers panel, command palette and 3D preview.
- `scripts/io/` holds persistence, sharing, the spec sheet, the quote and the PNG renderer.

Modules never reassign imported bindings; anything mutable lives on `state`. That one rule kept the refactor
honest and made each module testable through the page alone.

**Zero-layout-thrash pointer loop.** Drags, resizes, pans, guide pulls and 3D orbits share one pattern:

- On `mousedown`, cache the bounding rect and the starting geometry once.
- On `mousemove`, only record the pointer.
- Apply the latest position in a single `requestAnimationFrame` callback with inline styles.

No frame reads layout after writing it, and the item DOM is never rebuilt mid-gesture. The full render and the
history commit happen once, on `mouseup`. The splash light pools follow the same idea with exponential easing,
so their drift speed does not depend on the display's refresh rate.

**Live Canvas painters.** The PNG exporter keeps no second drawing model. It walks the live items and reads
their computed styles: box shadows and inset glows, linear and radial gradients, `clip-path` spotlight cones
and SVG poster prints decoded from their `background-image` data URIs. Note text uses line boxes read back from
the DOM, so the export wraps exactly like the wall. The 3D preview projects the same item boxes through an
orbit camera with back-face culling and shares the LED and paint color helpers, and the OBJ writer emits those
boxes as geometry.

**Split-key persistence.** Projects keep a small index plus one key per layout. Autosave rewrites only the open
layout and the index, so scrubbing a slider never re-serializes the whole gallery. A full or blocked store
degrades to a status message instead of an exception.

**465 Playwright end-to-end tests.** Thirty-nine specs, organized by domain, drive the real app in Chromium. A
shared fixture fails any test that logs a console error or throws, exported PNG pixels are compared against
screen pixels, and CI runs the suite on every push to `main` and on every pull request.

## Project Structure

```
index.html                  App shell, splash, catalog, Inspector, dialogs, command palette
styles/
  studio-workspace.css      Design tokens, finishes, lighting layers, rulers, modes, splash
scripts/
  planner-engine.js         Entry: pointer interactions, shortcuts, splash, startup
  core/                     constants, dom, state (undo / redo, sanitizer), geometry
  ui/                       viewport-rulers, inspector-layers, preview-3d (3D view, OBJ export)
  io/                       export-png, projects-spec (projects, spec sheet, quote)
tests/
  *.spec.js                 Playwright end-to-end specs, one per domain
  support/                  Fixtures, helpers, zero-dependency static server
.github/workflows/e2e.yml   CI: Ubuntu, Node 22, Chromium
```

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Arrow keys | Nudge the selection by 1 cm |
| `Shift` + click, drag on empty wall | Add to the selection, or draw a selection box |
| `Alt` while pointing / dragging | Measure to an item, or bypass magnetic alignment |
| `R` / `L` | Rotate 90 degrees / lock or unlock |
| `T` | Tape measure on or off |
| `V` | 3D Room Preview |
| `]` / `[` | Bring to front / send to back |
| `Ctrl + G` / `Ctrl + Shift + G` | Group / ungroup |
| `Ctrl + C`, `X`, `V`, `D` | Copy, cut, paste, duplicate |
| `Alt + Shift + C` / `Alt + Shift + V` | Copy item style / paste it onto the selection |
| `Ctrl + Z` / `Ctrl + Y` | Undo / redo |
| `Ctrl + Wheel`, `Ctrl + 0` | Zoom about the pointer, reset the view |
| `Space` + drag | Pan |
| `Ctrl + K` | Command palette |
| `Alt + M` | Switch between Engineer and Creator Mode |
| `Delete` | Remove the selected unlocked items |
| `?` | Shortcuts guide |

On macOS, use `Cmd` for `Ctrl` and `Option` for `Alt`. Shortcuts are ignored while typing in a field.

## Local Development & Testing

Requires Node 20 or later. The app itself needs no install; any static server works, but browsers only load ES
modules over HTTP, so `file://` will not.

```bash
npm install
npm run serve
```

Then open `http://localhost:4173`. To run the end-to-end suite (Chromium):

```bash
npx playwright install chromium
npm test
```

`npm run test:ui` opens Playwright's interactive runner and `npm run test:report` shows the last HTML report.

## Browser Support

Current Chrome, Edge, Firefox and Safari 15.4 or later (for native `<dialog>`). CI runs Chromium.

## License

[MIT](LICENSE)
