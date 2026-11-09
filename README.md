# Spatial & Ambient Light Planner

[![E2E Tests](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml/badge.svg)](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml)

**Live demo:** https://s7codes.github.io/spatial-light-planner/

A to-scale 2D wall elevation planner for shelving, framed art and ambient RGB lighting. Everything is drawn at
`2.5 px = 1 cm` and snapped to whole centimeters, so the plan on screen is the plan you drill from. Lay out a
wall, check it against doors, sockets and a sloped attic ceiling, preview the backlighting in a dark room, then
export a bill of materials, drilling coordinates and a high-resolution PNG. Plain HTML, CSS and ES modules: no
framework, no bundler, no build step, no runtime dependencies.

## Core Capabilities

- **To-scale drag and resize** with magnetic alignment, live gap rulers, `Alt`-measure between items, exact
  X / Y fields, rotation, mirroring, grouping, align and distribute, layer moves to the front or back (room
  features always stay below the furniture), and 30-step undo.
- **Tape measure.** Press `T` or use the HUD ruler button, then drag anywhere on the wall for a straight-line
  distance in cm.
- **Collision X-ray.** A piece dragged or resized into a conflict turns red, and every item it hits pulses
  with a red outline until the conflict clears or the piece is released.
- **Catalog** of shelving, posters, spotlights, a corner floor lamp and a wall-mounted RGB lightbar, plus room
  features (socket, door, window, 55" TV screen) that act as no-build zones.
- **Configurable attic slope.** Set the sloped ceiling's width and drop (30-150 cm, 90 x 90 cm by default) from
  the topbar; collisions, Align and the PNG follow the exact edge.
- **RGB lighting engine** built on CSS custom properties: per-item backlight colors, corner glow, spotlight
  cones and wall paints, rendered identically by the Canvas exporter. An illumination estimate turns the lit
  LED watts at the current brightness into W/m2 of wall and rates it Dim, Cozy or Bright.
- **Engineer and Creator workspace modes.** Engineer keeps every drafting tool in view; Creator hides rulers,
  guides, layers and coordinate fields for arranging and lighting.
- **CAD rulers and magnetic reference guides** pulled from either ruler, plus zoom about the pointer and
  `Space`-drag panning.
- **Ergonomic hints** for eye-level posters and clearance above a bed, desk or sofa drawn to scale on the floor.
- **Power routing and spec sheet.** Orthogonal cable runs to the nearest socket, a BOM with drilling
  coordinates, an LED strip, power and wall anchor estimate, Markdown copy and CSV export.
- **Multi-currency prices.** Show the estimate, spec sheet, CSV and quote in USD, EUR or HUF; the choice is
  remembered in the browser and never written to layout files.
- **Lumen branding.** A printable invoice-style quote with net subtotal, 27% Hungarian VAT and gross total in
  the selected currency, a Lumen splash screen on launch, and PNG exports signed with the project name and date
  in a free corner.
- **Z-depth foundation.** Every item carries a wall-to-front depth in cm (read-only in the Inspector), saved
  in layout files and ready for a future 3D viewport.
- **Multi-project storage and permalinks.** Named projects with autosave, JSON import / export with a strict
  sanitizer (or drop a `.json` layout straight onto the canvas), and share links that carry a whole wall in
  the URL hash.

## Architecture & Engineering Notes

**Zero-dependency ES module tree.** `index.html` loads a single entry, `scripts/planner-engine.js`, which pulls
in three layers:

- `scripts/core/` holds constants, DOM references, the shared `state` object and pure geometry with no
  rendering.
- `scripts/ui/` holds the viewport, rulers, Inspector, Layers panel and command palette.
- `scripts/io/` holds persistence, sharing, the spec sheet and the PNG renderer.

Shared mutable state lives on one `state` object, so modules never reassign imported bindings.

**60 fps pointer loop.** Drags, resizes, pans and guide pulls follow the same pattern:

- On `mousedown`, cache the wall's bounding rect and the starting geometry once.
- On `mousemove`, only record the pointer.
- Apply the latest position in a single `requestAnimationFrame` callback with inline `left` / `top` styles.

No frame reads layout after writing it, and the item DOM is never rebuilt mid-gesture. The full render and
history commit happen once, on `mouseup`.

**2x HiDPI Canvas PNG renderer.** The exporter does not maintain a second drawing model. It walks the live
items and reads their computed styles:

- box shadows and inset glows, parsed even when they hold `rgba(...)` lists
- linear and radial gradients
- `clip-path` polygons for spotlight cones
- SVG poster prints, decoded from their computed `background-image` data URIs

Note text is placed using line boxes read back from the DOM, so the export wraps on exactly the same lines as
the wall. Tests compare exported pixels against screen pixels.

**Split-key `localStorage` persistence.** Projects keep a small index plus one key per layout. Autosave rewrites
only the open layout and the index, so scrubbing the brightness slider or dragging a color picker never
re-serializes the whole gallery. Storage access is wrapped so a full or blocked store degrades to a status
message instead of an exception.

## Project Structure

```
index.html                  App shell, catalog, Inspector, dialogs, command palette
styles/
  studio-workspace.css      Design tokens, finishes, lighting layers, rulers, modes
scripts/
  planner-engine.js         Entry: pointer interactions, shortcuts, startup
  core/                     constants, dom, state (undo / redo, sanitizer), geometry
  ui/                       viewport-rulers, inspector-layers
  io/                       export-png, projects-spec
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

Then open `http://localhost:4173`. To run the end-to-end suite (443 tests in 37 specs, Chromium):

```bash
npx playwright install chromium
npx playwright test
```

`npm run test:ui` opens Playwright's interactive runner and `npm run test:report` shows the last HTML report.

## Browser Support

Current Chrome, Edge, Firefox and Safari 15.4 or later (for native `<dialog>`). CI runs Chromium.

## License

[MIT](LICENSE)
