# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale (default target wall: `300 x 250 cm`). Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing, measure exact mounting offsets, and check how warm backlights or corner RGB lamps interact in dark room conditions.

### Current Capabilities (v0.7)
- **Undo / Redo History:** A bounded 30-step history covers every layout change (drags, nudges, spawning, duplicating, deleting, resizing, finishes, Attic Slope, imports, and Reset Layout). Use the topbar buttons or `Ctrl+Z` / `Cmd+Z` to undo and `Ctrl+Y`, `Ctrl+Shift+Z` or `Cmd+Shift+Z` to redo.
- **Item Duplication:** `Duplicate Item` in the inspector, or `Ctrl+D` / `Cmd+D`, clones the selected item with its custom size, finish, and price, offset by `4 cm` on both axes and clamped inside the wall.
- **JSON Export & Validated Import:** Save the full studio configuration (layout, Attic Slope, lighting colors, brightness) to `spatial-studio-layout.json` and load it back later. Imports are validated and sanitized before anything is applied, and invalid files show an inline error without touching the current layout.
- **Live Spatial Distance Guides:** Selecting or dragging an item draws dashed X/Y rulers from the left wall edge and the ceiling to the item, with live `cm` readouts. Guides follow mouse drags and arrow-key nudges in real time and hide when nothing is selected.
- **Attic Slope Mode:** A topbar toggle adds a `90 x 90 cm` 45-degree sloped ceiling cut-out in the top-right corner, drawn as a hatched hazard zone. Items reaching into the slope are flagged in red with a dedicated inspector warning, and the toggle state is persisted.
- **Live Property Inspector:** Edit mounted item dimensions (`Width` and `Height` in cm) and switch surface finishes (*Walnut*, *Oak*, *Matte Black*, *White*) in real time. Offset readouts and collision warnings update live while dragging.
- **Centimeter-Accurate Positioning:** Free dragging lands on whole centimeters, the `5 cm` snap toggle aligns to the grid, arrow keys nudge by exactly `1 cm`, and `Delete` / `Backspace` removes the selected item.
- **Local State Persistence:** Automatically serializes wall layout, lighting, and attic slope state to `localStorage` so configurations persist across browser reloads. Saved state passes through the same sanitizer as imports, so corrupted storage falls back to the default layout.
- **Interactive Drag-and-Drop & Collision Checks:** Direct mouse manipulation with strict wall boundary clamping (`0-300 cm` X, `0-250 cm` Y), real-time AABB overlap warnings, and sloped ceiling intrusion detection. Catalog items mount true to scale and always spawn inside the wall bounds.
- **Dual Canvas Modes & RGB Controls:** Switch between *Ambient Mode* and *Daylight Grid* (`10 x 10 cm` scale grid), with live RGB color pickers and master brightness dimmer.

## Technical Notes

### History Model
History stores serialized snapshots of the layout (`wallItems` plus the Attic Slope flag), capped at 30 entries. Identical consecutive snapshots are dropped, and a new change after an undo truncates the redo branch.

- A drag records its starting position on `mousedown` and commits a single snapshot on `mouseup`, only if the item actually moved.
- Rapid or held arrow-key nudges on the same item merge into one step, so one undo reverses the whole adjustment.
- Lighting colors and brightness are deliberately outside history; they are preferences, not layout.
- Undo/redo shortcuts are ignored while typing in text and number fields, so the browser's own field undo keeps working there. They still work after clicking a checkbox or slider.

### Import Validation
The parser accepts either a `wallItems` or `items` array and validates everything before applying it:

- Unknown item types are skipped and reported. Unknown finishes, missing sizes, and invalid prices fall back to the matching catalog values.
- Width, height, `left`, and `top` are rounded to whole centimeters and clamped to the physical wall.
- Colors must be 6-digit hex values, brightness is clamped to `0-100`, and Attic Slope must be a boolean.
- Item names are length-limited and HTML-escaped on render. Valid unique ids are kept; duplicate or malformed ids are regenerated.
- Files over 1 MB or with more than 200 items are rejected.

### Collision Model
Items are axis-aligned rectangles, so item-to-item overlap uses a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal edge follows `y = x - (WALL_WIDTH - S)`. Because the top-right corner of a rectangle is always the point that reaches furthest past that edge, checking that single corner is an exact intersection test:

```
itemRight > WALL_WIDTH - S  &&  item.top < itemRight - (WALL_WIDTH - S)
```

### Rendering Performance
Drag input is coalesced with `requestAnimationFrame`, and the wall bounds are measured once per drag. Each frame writes inline `left` / `top` styles and updates the guides and warnings in place, so the item DOM is never rebuilt mid-drag.

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Nudge selected item by 1 cm | Arrow keys |
| Remove selected item | `Delete` / `Backspace` |
| Duplicate selected item | `Ctrl+D` / `Cmd+D` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Y`, `Ctrl+Shift+Z` / `Cmd+Shift+Z` |

## Project Structure

- `index.html` - Studio workspace layout and control bindings
- `styles/studio-workspace.css` - Flexbox UI layout, surface finish themes, lighting layers, distance guides, the attic slope zone, and toolbar controls
- `scripts/planner-engine.js` - State management, undo/redo history, localStorage persistence, JSON export and import validation, drag-and-drop coordinates, distance guides, and AABB plus slope collision checks

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.

## License

Released under the [MIT License](LICENSE).