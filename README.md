# Spatial & Ambient Light Planner

Live Demo: https://s7codes.github.io/spatial-light-planner/

[![E2E Tests](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml/badge.svg)](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml)

A to-scale 2D wall planner for shelving, framed art, and ambient RGB lighting. Mount items from a catalog, place them with centimeter precision, check them against overlaps and a sloped attic ceiling, preview the backlighting in a dark room, and hand off a bill of materials, drilling coordinates, or a high-resolution image of the finished plan.

Built with vanilla HTML, CSS, and JavaScript (ES2020). No framework, no build step, no runtime dependencies. Playwright is the only dev dependency, and it powers the end-to-end suite.

## Highlights

- **Precision placement:** Every position and size lives on a whole-centimeter grid. Dragging, arrow-key nudges, `5 cm` grid snapping, and magnetic alignment all land on exact centimeters, so on-screen readouts never drift from the stored layout.
- **Live measurement:** Dashed rulers show the distance from the left wall and the ceiling, plus the clearance to the nearest neighbor on every side. Green guides appear whenever an edge or center lines up with another item or the wall center.
- **Room constraints:** Configurable wall size (`150-400 x 150-300 cm`), AABB overlap warnings, and an optional `90 x 90 cm` 45-degree attic slope with exact intrusion detection.
- **Lighting preview:** Per-item backlights, a corner floor lamp glow, RGB pickers, presets, and a master dimmer, with an Ambient Mode for night and a Daylight Grid for layout work.
- **Editing workflow:** 30-step undo/redo, duplication, item locking, layer ordering, and three curated starter templates.
- **Handoff:** A grouped bill of materials, floor-referenced drilling coordinates (copyable as Markdown), JSON export/import, and a 2x HiDPI PNG snapshot.
- **Studio interface:** An obsidian, hairline-divided workspace with tactile catalog cards, a centered wall-size control, and an isometric brand mark that takes on the live lighting colors.
- **Tested end to end:** 169 Playwright tests cover every feature above and run in GitHub Actions on each push and pull request.

## Architecture

### Coordinate Space
The wall is modeled at `1 cm = 2.5 px`. Item geometry is stored in wall pixels, but every value is kept to a multiple of `2.5`, i.e. whole centimeters.

- Drag positions are quantized to `1 cm` (or `5 cm` with snapping on) before clamping.
- Arrow keys step from the nearest whole centimeter.
- Imports and saved state are rounded back onto the grid.

Wall pixel sizes are derived from the wall's centimeter dimensions. The wall uses `content-box` sizing, so its 2 px border sits outside that area and items flush with the right or bottom edge stay fully visible. When the wall is larger than the canvas, it is scaled with a CSS `transform` and pointer deltas are divided by the same factor, so dragging stays 1:1 under the cursor at any fit level.

### Rendering Loop
`mousemove` only records the pointer; a single `requestAnimationFrame` callback per frame applies the newest position. Each frame writes inline `left` / `top` styles and updates rulers, guides, and warnings in place, so the item DOM is never rebuilt during a drag.

Wall bounds are read once per drag, ruler label sizes are measured once at startup, and item label sizes once per render. No layout reads happen inside the frame loop. Alignment guide elements come from a small reusable pool.

Lamps and spotlights carry labels wider than themselves. When such an item sits near a wall edge, its label is shifted just far enough to stay inside the wall, live during drags and in the PNG export, instead of being clipped.

### CSS Custom Property Lighting Engine
Glows are pure CSS. Each item's `::before` pseudo-element carries `box-shadow` layers tinted by `--accent-led`, the corner lamp and wall glow use `--corner-led`, and `--led-opacity` drives the master dimmer. JavaScript changes a lighting preset by setting three custom properties on the root element, with no per-item repaint logic.

Per-item backlights toggle a `.led-off` class, and Daylight Grid mode hides every glow through a single selector.

The same three properties tint the interface: the logo's gradient stops and light beam, the catalog thumbnails, the price tags, and the brightness track all follow the current preset without any JavaScript of their own.

### Interface Design System
The studio chrome is built from a small set of tokens on `:root`: layered obsidian surfaces (`--bg-app`, `--bg-panel`, `--bg-raised`, `--bg-inset`), `1px` hairlines at 7% white paired with a soft inset top highlight, `6px` and `8px` radii, and a single `160ms` ease-out curve for every transition.

- **Topbar:** a `1fr auto 1fr` grid keeps the wall-size control on the same center line as the canvas. When the action cluster outgrows its half on a narrow screen, the grid hands it the extra room instead of letting the controls overlap.
- **Catalog cards:** each card draws a miniature of its piece with CSS gradients keyed off `data-type`, so the catalog needs no images and stays in sync with the item finishes.
- **Controls:** the layout toggles are native checkboxes drawn as small status lights, the finish picker is a segmented control with a swatch bar per finish, and the brightness slider fills its track from `--led-opacity`.
- **Wall parity:** the wall surface, item finishes, and labels are untouched by the theme, and the wall only carries outer shadows, so the PNG export still matches the screen pixel for pixel.

### Collision Math
Items are axis-aligned rectangles, so item-to-item overlap is a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal follows `y = x - (wallWidthPx - S)`.

For an axis-aligned box, the top-right corner is always the point that reaches furthest past that line, so testing that single corner is an exact intersection test:

```
itemRight > wallWidthPx - S  &&  item.top < itemRight - (wallWidthPx - S)
```

### Magnetic Alignment & Gap Rulers
During a drag, the item's start, center, and end lines on each axis are compared with the same three lines of every other item, plus the wall's horizontal center. The closest match within `1 cm` wins, provided the item stays inside the wall. A candidate that would need a half-centimeter position is skipped rather than approximated, so a guide line only ever marks an exact alignment. Holding `Alt` / `Option` suspends the magnet.

Gap rulers find the nearest item on each side whose projection overlaps the active item, and measure along the center of that shared overlap. Labels are placed shortest ruler first; any label that would collide slides along its own ruler to the nearest clear spot.

### Undo / Redo History
History is a bounded stack of 30 serialized snapshots covering items (including backlight, lock state, and layer order), wall size, and the attic slope. Lighting colors and brightness are treated as preferences and left out.

- Identical consecutive snapshots are dropped.
- A new action after an undo truncates the redo branch.
- Bursts of the same action are coalesced: held arrow-key nudges on one item, or rapid wall-size edits, become a single step.
- A drag commits exactly one snapshot on `mouseup`, and only if the item moved.

### XSS-Safe JSON Schema Sanitizer
Saved state, imported files, and starter templates all pass through one `normalizeLayout()` function. Nothing is applied until the whole file validates, so a bad file never leaves a half-loaded wall.

- **Wall:** dimensions are rounded to whole centimeters and clamped to the allowed range. Files from v0.7, which carry no wall size, load on the default `300 x 250 cm` wall.
- **Items:** unknown types are skipped and reported. Invalid finishes, sizes, and prices fall back to catalog values read from the catalog markup itself. Geometry is snapped to whole centimeters and clamped inside the wall. `ledEnabled` and `locked` only accept real booleans.
- **Names and ids:** names are trimmed, length-limited, and HTML-escaped wherever they are rendered. Valid unique ids are kept; duplicate or malformed ids are regenerated.
- **Limits:** colors must be 6-digit hex, brightness is clamped to `0-100`, and files over 1 MB or 200 items are rejected.

The export schema is versioned (`"1.0"`). Files from `0.7`, `0.8`, and `0.9` import unchanged.

### Bill of Materials & Drilling Coordinates
The spec sheet groups items by type, name, size in cm, finish, and price into a priced bill of materials. Every item is also listed left to right with its distance from the left wall, the ceiling, and the floor. Installers measure shelving up from the floor, so the bottom edge is derived as:

```
From Floor = wallHeightCm - topCm - heightCm
```

The same rows feed the modal tables and the `Copy as Markdown` export, which uses the async Clipboard API with a selection-based fallback.

### HiDPI Canvas 2D PNG Renderer
`Export PNG` draws the wall on an offscreen canvas at `wallWidthPx * 2` by `wallHeightPx * 2` with the native Canvas 2D API. It paints in the same stacking order as the live DOM: background or daylight grid, attic slope, corner glow, then items in layer order, and finally a dimensions caption.

Item fills, borders, corner radii, drop shadows, and glow layers are read from each element's computed style, so the PNG always matches the CSS on screen without a second copy of the palette. Shadows are painted in isolation by drawing the shape far off canvas and offsetting only its shadow back into place. Shadow offsets and blur ignore the canvas transform, so they are scaled to device pixels by hand.

### Accessibility
- Both modals are native `<dialog>` elements opened with `showModal()`. Focus moves inside, the page behind becomes inert, `Escape` closes them, and focus returns to the control that opened them. Only one can be open at a time.
- Catalog entries are real buttons, so items can be mounted with `Enter` or `Space`.
- Every button and input has a visible label, `aria-label`, or `title`, and buttons show a keyboard focus ring. Icon-only buttons such as Undo and Redo carry an `aria-label`.
- The restyled toggles are still native checkboxes, so they keep keyboard and screen reader support. Their focus ring wraps the whole chip.
- Transitions and the dialog entrance animation are switched off under `prefers-reduced-motion`.
- Inspector panel rebuilds hand keyboard focus back to the control that triggered them.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Drag item | Move item on the wall (with 1 cm magnetic alignment) |
| Hold `Alt` / `Option` while dragging | Temporarily bypass magnetic alignment guides |
| Arrow keys | Nudge the selected item by 1 cm |
| `Ctrl + Z` / `Cmd + Z` | Undo the last layout action (up to 30 steps) |
| `Ctrl + Y` / `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo a layout action |
| `Ctrl + D` / `Cmd + D` | Duplicate the selected item (+4 cm offset) |
| `L` | Lock or unlock the selected item's position and properties |
| `Delete` / `Backspace` | Remove the selected unlocked item |
| `?` | Toggle the keyboard shortcuts guide |
| `Escape` | Close the open modal or deselect the active item |

Shortcuts are ignored while typing in a field, and the browser's own text undo keeps working inside number inputs.

## Layout Templates

| Template | Wall | Attic Slope | Composition |
| --- | --- | --- | --- |
| Studio Default | 300 x 250 cm | Off | Black poster frame centered above a walnut floating shelf |
| Gallery & Storage | 320 x 250 cm | Off | Walnut storage unit near the floor, a mirrored pair of poster frames with top-mounted spotlights, a ledge shelf, and a corner floor lamp |
| Attic Corner | 300 x 240 cm | On | Shelving, a modular cube, and lighting tucked beneath the slope with 12-24 cm of clearance |

Every template is collision-free, and loading one is a single undo step that keeps your lighting colors.

## Running Locally

There is nothing to install or build.

```bash
git clone https://github.com/s7codes/spatial-light-planner.git
cd spatial-light-planner
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Any static server works (VS Code Live Server, `npx serve`, or `npm run serve` on port 4173), and opening `index.html` directly from disk works too.

## Testing

The end-to-end suite drives the real app in Chromium with [Playwright](https://playwright.dev): 169 tests in 11 spec files, one per feature area.

```bash
npm install
npx playwright install chromium
npm test
```

`npm run test:ui` opens the interactive runner, `npm run test:headed` shows the browser, and `npm run test:report` opens the last HTML report.

| Spec | Covers |
| --- | --- |
| `placement` | Starter wall geometry, rulers, 1 cm nudges, whole-cm drags, 5 cm snapping, catalog sizes, spawn cascade, edge labels |
| `collisions` | Attic slope rendering and the exact 45-degree intrusion test, overlap warnings, persistence |
| `history` | 30-step undo/redo, merge windows, redo truncation, text field guards, reload behavior |
| `editing` | Duplication, locking, layer and paint order, per-item backlights |
| `alignment` | Gap rulers, magnetic alignment, `Alt` bypass, half-centimeter guard |
| `wall-size` | Resizing, clamping, single-step history, auto-fit scaling, 1:1 drag tracking |
| `layout-files` | JSON export schema, import validation and sanitizing, HTML escaping, 0.7-0.9 compatibility |
| `templates` | All three templates: collision-free, on grid, labels inside the wall, one undo step |
| `spec-sheet` | BOM grouping, drilling coordinates, Markdown export, clipboard fallback, dialog behavior |
| `png-export` | 2x output size, finishes, glows, dimmer, daylight grid, attic slope, layer order |
| `app-shell` | Zero failed requests, favicon, live-tinted logo, shortcuts guide, `Escape`, accessibility audit, topbar centering, responsive layout |

How the suite is built:

- `playwright.config.js` boots `tests/support/static-server.js`, a zero-dependency Node server, so the app is tested over HTTP as it is served in production.
- Every test starts in a fresh browser context with clean storage, and fails on any uncaught exception or console error.
- The engine is a classic script, so helpers read its state through `page.evaluate` instead of adding test hooks to the app.
- Gap ruler readouts are compared with an independent implementation across 40 seeded random layouts.
- PNG exports are decoded in the browser and sampled pixel by pixel through a custom `toBeNearColor` matcher.
- Layout checks pass with Inter, DejaVu Sans, Liberation Sans, and FreeSans, so the result does not depend on the fonts installed on the CI runner.

### Continuous Integration

`.github/workflows/e2e.yml` runs the suite on every push to the main branch and on every pull request: Ubuntu, Node 22, and Chromium installed through Playwright. Failed tests are retried once with a trace, and the HTML report is uploaded as a build artifact.

## Project Structure

```
index.html                    App shell, catalog, inspector, dialogs, inline SVG brand mark, and favicon
styles/studio-workspace.css   Design tokens, layout, finish themes, lighting layers, rulers, guides, and dialogs
scripts/planner-engine.js     State, history, persistence, sanitizer, drag engine, alignment,
                              collision checks, spec sheet, and the Canvas 2D PNG renderer
tests/*.spec.js               Playwright end-to-end specs, one per feature area
tests/support/                Fixtures, shared helpers, and the zero-dependency static server
playwright.config.js          Chromium project, local web server, and CI reporters
.github/workflows/e2e.yml     Runs the suite on every push and pull request
```

## Browser Support

Current versions of Chrome, Edge, Firefox, and Safari (15.4 or later, for the native `<dialog>` element). A few accent tints use `color-mix()` inside an `@supports` block, so older engines show the same layout with fixed tints of the default accent. The automated suite runs in Chromium.

## License

Released under the [MIT License](LICENSE).