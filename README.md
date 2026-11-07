# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale. The wall defaults to `300 x 250 cm` and can be resized anywhere from `150 x 150 cm` to `400 x 300 cm`. Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing, measure exact mounting offsets and clearances, and check how warm backlights or corner RGB lamps interact in dark room conditions.

### Current Capabilities (v0.8)
- **Smart Alignment Guides:** While dragging, an item's left, center, or right edge snaps onto matching lines of other items (and the wall's horizontal center) once it comes within `1 cm`, with a crisp guide drawn across the aligned items. The same applies to top, center, and bottom. Hold `Alt` / `Option` to place items freely without the magnet.
- **Gap Rulers:** The selected item shows the clearance to its nearest neighbor on each side (left, right, above, below) as dashed rulers with `cm` readouts, alongside the wall-edge rulers. Labels never overlap; a ruler's label slides along its line when space is tight.
- **Configurable Wall Size:** Set the wall width (`150-400 cm`) and height (`150-300 cm`) from the topbar. Items outside a shrunken wall are pushed back inside (and cut down if they no longer fit), as a single undo step.
- **Auto-Fit Viewport:** Walls larger than the available canvas are scaled down to fit, with the current fit shown next to the scale note. Dragging stays pixel-accurate at any fit level.
- **Per-Item Backlight LED:** Every item has its own `Backlight LED: ON / OFF` toggle in the inspector, saved with the layout and covered by undo/redo.
- **Undo / Redo History:** A bounded 30-step history covers every layout change (drags, nudges, spawning, duplicating, deleting, resizing, finishes, backlight toggles, wall size, Attic Slope, imports, and Reset Layout).
- **Item Duplication:** `Duplicate Item` in the inspector, or `Ctrl+D` / `Cmd+D`, clones the selected item with its custom size, finish, backlight state, and price, offset by `4 cm` on both axes and clamped inside the wall.
- **JSON Export & Validated Import:** Save the full studio configuration (wall size, layout, Attic Slope, lighting colors, brightness) to `spatial-studio-layout.json` and load it back later. Imports are validated and sanitized before anything is applied, and invalid files show an inline error without touching the current layout.
- **Live Spatial Distance Guides:** Dashed X/Y rulers measure from the left wall edge and the ceiling to the selected item and update in real time during drags and arrow-key nudges.
- **Attic Slope Mode:** A topbar toggle adds a `90 x 90 cm` 45-degree sloped ceiling cut-out in the top-right corner. Items reaching into the slope are flagged in red with a dedicated inspector warning.
- **Live Property Inspector:** Edit mounted item dimensions (`Width` and `Height` in cm, up to the wall size) and switch surface finishes (*Walnut*, *Oak*, *Matte Black*, *White*) in real time.
- **Centimeter-Accurate Positioning:** Free dragging lands on whole centimeters, the `5 cm` snap toggle aligns to the grid, arrow keys nudge by exactly `1 cm`, and `Delete` / `Backspace` removes the selected item.
- **Local State Persistence:** Wall size, layout, lighting, and Attic Slope state are saved to `localStorage`. Saved state passes through the same sanitizer as imports, so corrupted storage falls back to the default layout.
- **Interactive Drag-and-Drop & Collision Checks:** Strict wall boundary clamping, real-time AABB overlap warnings, and sloped ceiling intrusion detection. Catalog items (shelf, cube, compact storage, poster frame, spotlight, corner lamp) mount true to scale and always spawn inside the wall.
- **Dual Canvas Modes & RGB Controls:** Switch between *Ambient Mode* and *Daylight Grid* (`10 x 10 cm` scale grid), with live RGB color pickers and master brightness dimmer.

## Technical Notes

### Alignment Model
Each drag frame first rounds the position to the active grid (`1 cm`, or `5 cm` with snapping on), then looks for alignment. For each axis, the dragged item's three anchor lines (start, center, end) are compared with every other item's three lines, plus the wall's horizontal center on the X axis. The closest match within `1 cm` wins, provided the item stays inside the wall.

Positions always stay on the whole-centimeter grid. If an alignment would need a half-centimeter position (for example, centering a `75 cm` unit on a `300 cm` wall), it is skipped rather than approximated, so a guide line is only ever drawn for an exact alignment. Guide lines come from a small reusable element pool and are restyled in place each frame.

### Ruler Layout
Wall-edge rulers measure from the left wall and the ceiling. Gap rulers connect the active item to the nearest neighbor on each side whose projection overlaps it, drawn along the center of that shared overlap. When a neighbor sits on the left or top, the wall-edge ruler on that side moves out to the item's far edge so the two never share a line.

Label sizes are measured once at startup. On each update, labels on shorter rulers are placed first at their ruler's midpoint; any label that would collide slides along its own ruler to the nearest clear spot. No layout reads happen during a drag. Colors carry meaning: blue for wall distances, pink for gaps, green for alignment.

### Viewport Scaling
When the wall is larger than the canvas (minus padding), `#wall` gets a CSS `transform: scale(factor)`. Pointer positions are converted into wall space by dividing screen deltas by that factor, so the item stays under the cursor at any fit level. A window resize refits the wall, and even refreshes the cached bounds mid-drag.

### History Model
History stores serialized snapshots of the layout: items, including their backlight state, plus wall size and the Attic Slope flag, capped at 30 entries. Identical consecutive snapshots are dropped, and a new change after an undo truncates the redo branch.

- A drag commits a single snapshot on `mouseup`, only if the item actually moved.
- Rapid or held arrow-key nudges on the same item, and rapid spinner clicks on the wall size, merge into one step.
- Lighting colors and brightness are deliberately outside history; they are preferences, not layout.
- Undo/redo shortcuts are ignored while typing in text and number fields, so the browser's own field undo keeps working there.

### Import Validation
The parser accepts either a `wallItems` or `items` array and validates everything before applying it:

- Wall size is rounded to whole centimeters and clamped to the allowed range. Files from v0.7 and earlier, which have no wall size, load on the default `300 x 250 cm` wall.
- Unknown item types are skipped and reported. Unknown finishes, missing sizes, and invalid prices fall back to the matching catalog values, and `ledEnabled` defaults to on unless it is explicitly `false`.
- Width, height, `left`, and `top` are rounded to whole centimeters and clamped to the imported wall.
- Colors must be 6-digit hex values, brightness is clamped to `0-100`, and Attic Slope must be a boolean.
- Item names are length-limited and HTML-escaped on render. Valid unique ids are kept; duplicate or malformed ids are regenerated.
- Files over 1 MB or with more than 200 items are rejected.

### Collision Model
Items are axis-aligned rectangles, so item-to-item overlap uses a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal edge follows `y = x - (wallWidthPx - S)`. Because the top-right corner of a rectangle is always the point that reaches furthest past that edge, checking that single corner is an exact intersection test:

```
itemRight > wallWidthPx - S  &&  item.top < itemRight - (wallWidthPx - S)
```

### Rendering Performance
Drag input is coalesced with `requestAnimationFrame`, and the wall bounds are measured once per drag. Each frame writes inline styles for the item, rulers, and alignment guides in place, so the item DOM is never rebuilt mid-drag.

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Nudge selected item by 1 cm | Arrow keys |
| Place without alignment snapping | Hold `Alt` / `Option` while dragging |
| Remove selected item | `Delete` / `Backspace` |
| Duplicate selected item | `Ctrl+D` / `Cmd+D` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Y`, `Ctrl+Shift+Z` / `Cmd+Shift+Z` |

## Project Structure

- `index.html` - Studio workspace layout, wall size controls, and control bindings
- `styles/studio-workspace.css` - Flexbox UI layout, surface finish themes, lighting layers, rulers, alignment guides, the attic slope zone, and toolbar controls
- `scripts/planner-engine.js` - State management, undo/redo history, localStorage persistence, JSON export and import validation, wall sizing and viewport fit, drag-and-drop with alignment snapping, rulers, and AABB plus slope collision checks

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.

## License

Released under the [MIT License](LICENSE).