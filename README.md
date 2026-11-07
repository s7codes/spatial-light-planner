# Spatial & Ambient Light Planner

Live Demo: https://s7codes.github.io/spatial-light-planner/

A to-scale 2D wall planner for shelving, framed art, and ambient RGB lighting. Mount items from a catalog, place them with centimeter precision, check them against overlaps and a sloped attic ceiling, preview the backlighting in a dark room, and hand off a bill of materials, drilling coordinates, or a high-resolution image of the finished plan.

Built with vanilla HTML, CSS, and JavaScript (ES2020). No framework, no build step, no runtime dependencies.

## Highlights

- **Precision placement:** Every position and size lives on a whole-centimeter grid. Dragging, arrow-key nudges, `5 cm` grid snapping, and magnetic alignment all land on exact centimeters, so on-screen readouts never drift from the stored layout.
- **Live measurement:** Dashed rulers show the distance from the left wall and the ceiling, plus the clearance to the nearest neighbor on every side. Green guides appear whenever an edge or center lines up with another item or the wall center.
- **Room constraints:** Configurable wall size (`150-400 x 150-300 cm`), AABB overlap warnings, and an optional `90 x 90 cm` 45-degree attic slope with exact intrusion detection.
- **Lighting preview:** Per-item backlights, a corner floor lamp glow, RGB pickers, presets, and a master dimmer, with an Ambient Mode for night and a Daylight Grid for layout work.
- **Editing workflow:** 30-step undo/redo, duplication, item locking, layer ordering, and three curated starter templates.
- **Handoff:** A grouped bill of materials, floor-referenced drilling coordinates (copyable as Markdown), JSON export/import, and a 2x HiDPI PNG snapshot.

## Architecture

### Coordinate Space
The wall is modeled at `1 cm = 2.5 px`. Item geometry is stored in wall pixels, but every value is kept to a multiple of `2.5`, i.e. whole centimeters.

- Drag positions are quantized to `1 cm` (or `5 cm` with snapping on) before clamping.
- Arrow keys step from the nearest whole centimeter.
- Imports and saved state are rounded back onto the grid.

Wall pixel sizes are derived from the wall's centimeter dimensions. When the wall is larger than the canvas, it is scaled with a CSS `transform` and pointer deltas are divided by the same factor, so dragging stays 1:1 under the cursor at any fit level.

### Rendering Loop
`mousemove` only records the pointer; a single `requestAnimationFrame` callback per frame applies the newest position. Each frame writes inline `left` / `top` styles and updates rulers, guides, and warnings in place, so the item DOM is never rebuilt during a drag.

Wall bounds are read once per drag, and ruler label sizes are measured once at startup. No layout reads happen inside the frame loop. Alignment guide elements come from a small reusable pool.

### CSS Custom Property Lighting Engine
Glows are pure CSS. Each item's `::before` pseudo-element carries `box-shadow` layers tinted by `--accent-led`, the corner lamp and wall glow use `--corner-led`, and `--led-opacity` drives the master dimmer. JavaScript changes a lighting preset by setting three custom properties on the root element, with no per-item repaint logic.

Per-item backlights toggle a `.led-off` class, and Daylight Grid mode hides every glow through a single selector.

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
- Bursts of the same action are coalesced: held arrow-key nudges on one item, or rapid wall-size spinner clicks, become a single step.
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
- Every button and input has a visible label, `aria-label`, or `title`, and buttons show a keyboard focus ring.
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

Then open `http://localhost:8000`. Any static server works (VS Code Live Server, `npx serve`), and opening `index.html` directly from disk works too.

## Project Structure

```
index.html                    App shell, catalog, inspector, dialogs, and inline SVG favicon
styles/studio-workspace.css   Layout, finish themes, lighting layers, rulers, guides, and dialogs
scripts/planner-engine.js     State, history, persistence, sanitizer, drag engine, alignment,
                              collision checks, spec sheet, and the Canvas 2D PNG renderer
```

## Browser Support

Current versions of Chrome, Edge, Firefox, and Safari (15.4 or later, for the native `<dialog>` element).

## License

Released under the [MIT License](LICENSE).