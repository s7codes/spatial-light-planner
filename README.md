# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale. The wall defaults to `300 x 250 cm` and can be resized anywhere from `150 x 150 cm` to `400 x 300 cm`. Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing, measure exact mounting offsets and clearances, check how warm backlights or corner RGB lamps interact in dark room conditions, and hand off a spec sheet or image of the final plan.

### Current Capabilities (v0.9)
- **Item Locking:** Lock an item from the inspector or with `L`. A locked item can still be selected, duplicated, reordered, or unlocked, but it cannot be dragged, nudged, resized, refinished, have its backlight toggled, or be removed. The inspector shows a lock badge and note, and the item's wall label carries a padlock.
- **Layer Ordering:** `Bring Forward` and `Send Backward` move the selected item one step up or down the paint order so it renders above or below overlapping items, with a live layer readout. Locking and reordering are both covered by undo/redo.
- **Installation Spec Sheet:** `View Spec Sheet` opens an accessible modal with a grouped Bill of Materials (quantities, unit prices, subtotals, grand total) and a Mounting & Drilling table giving every item's distance from the left wall, the ceiling, and the floor. `Copy as Markdown` puts both tables on the clipboard.
- **PNG Snapshot Export:** `Export PNG` renders the wall with the native Canvas 2D API at 2x pixel density and downloads `spatial-studio-plan.png`. It includes mode-correct backgrounds, LED glows at the current brightness, the attic slope, every item in layer order, and a dimensions caption.
- **Smart Alignment Guides:** While dragging, an item's edges or center snap onto matching lines of other items (and the wall's horizontal center) once within `1 cm`, with a crisp guide drawn across the aligned items. Hold `Alt` / `Option` to place items freely.
- **Gap Rulers:** The selected item shows the clearance to its nearest neighbor on each side as dashed rulers with `cm` readouts, alongside the wall-edge rulers. Labels never overlap.
- **Configurable Wall Size & Auto-Fit Viewport:** Set the wall from `150-400 cm` wide and `150-300 cm` high. Items outside a shrunken wall are pushed back inside as a single undo step, and walls larger than the canvas are scaled to fit with pixel-accurate dragging.
- **Per-Item Backlight LED:** Every item has its own `Backlight LED: ON / OFF` toggle, saved with the layout and covered by undo/redo.
- **Undo / Redo History:** A bounded 30-step history covers every layout change, including drags, nudges, edits, locks, layer moves, wall size, Attic Slope, imports, and Reset Layout.
- **Item Duplication:** `Duplicate Item` or `Ctrl+D` / `Cmd+D` clones the selected item `4 cm` down and to the right. The copy starts unlocked so it can be placed right away.
- **JSON Export & Validated Import:** Save the full studio configuration to `spatial-studio-layout.json` and load it back later. Imports are validated and sanitized before anything is applied, and invalid files show an inline error without touching the current layout.
- **Live Spatial Distance Guides:** Dashed X/Y rulers measure from the left wall edge and the ceiling to the selected item in real time.
- **Attic Slope Mode:** A `90 x 90 cm` 45-degree sloped ceiling cut-out in the top-right corner, with exact intrusion detection and a dedicated inspector warning.
- **Centimeter-Accurate Positioning:** Free dragging lands on whole centimeters, the `5 cm` snap toggle aligns to the grid, arrow keys nudge by exactly `1 cm`, and `Delete` / `Backspace` removes the selected item.
- **Local State Persistence:** Wall size, layout, lighting, and Attic Slope state are saved to `localStorage` and pass through the same sanitizer as imports.
- **Dual Canvas Modes & RGB Controls:** Switch between *Ambient Mode* and *Daylight Grid* (`10 x 10 cm` scale grid), with live RGB color pickers and master brightness dimmer.

## Technical Notes

### Locking Rules
Locking protects what an installer has already measured. Drag, nudge, removal, size, finish, and backlight changes all check the flag, and the matching inspector controls are disabled. Trying to move or delete a locked item briefly highlights the lock note to explain why nothing happened. Layer order stays editable, and a wall resize still pushes locked items inside the new bounds, since nothing may sit outside the wall.

### Spec Sheet
The Bill of Materials groups items by type, name, size in cm, finish, and price, then sorts by name. Mounting rows run left to right (then top to bottom), the order an installer works along a wall:

```
From Floor = wallHeightCm - topCm - heightCm
```

The same rows feed both the modal and the Markdown copy. The dialog is a native `<dialog>` opened with `showModal()`, so focus moves into it, the page behind becomes inert, `Escape` closes it, and focus returns to the button that opened it. Only a click that starts and ends on the backdrop closes it, so dragging a text selection out of a table does not. Editor shortcuts are ignored while it is open.

### PNG Export
The snapshot is drawn on an offscreen canvas sized to `wallWidthPx * 2` by `wallHeightPx * 2`, in the same stacking order as the live wall: background (and grid in daylight), attic slope, corner glow, then items in layer order and the caption.

Item visuals are read from each element's computed style: fill, border width and color, corner radius, the drop shadow, and the `::before` glow. The PNG therefore always matches the CSS on screen. Shadows are painted on their own by drawing the shape far off canvas and offsetting only its shadow back into place. Because shadow offsets and blur ignore the canvas transform, they are scaled by the pixel ratio by hand.

### Alignment Model
Each drag frame first rounds the position to the active grid (`1 cm`, or `5 cm` with snapping on), then looks for alignment between the dragged item's start, center, and end lines and every other item's lines, plus the wall's horizontal center. The closest match within `1 cm` wins. Alignments that would need a half-centimeter position are skipped, so a guide is only ever drawn for an exact alignment.

### Ruler Layout
Gap rulers connect the active item to the nearest neighbor on each side whose projection overlaps it, along the center of the shared overlap. When a neighbor sits on the left or top, the wall-edge ruler on that side moves out to the item's far edge. Label sizes are measured once at startup, and labels that would collide slide along their own ruler, with no layout reads during a drag. Blue marks wall distances, pink marks gaps, and green marks alignment.

### Viewport Scaling
When the wall is larger than the canvas, `#wall` gets a CSS `transform: scale(factor)` and pointer deltas are divided by that factor, so the item stays under the cursor at any fit level.

### History Model
History stores serialized snapshots of the items (including their backlight, lock state, and layer order), the wall size, and the Attic Slope flag, capped at 30 entries. Identical consecutive snapshots are dropped, a new change after an undo truncates the redo branch, and rapid nudges or wall-size spinner clicks merge into one step. Lighting colors and brightness are deliberately outside history.

### Import Validation
Imports accept a `wallItems` or `items` array. Wall size and all item geometry are rounded to whole centimeters and clamped to the wall, with files from v0.7 and earlier loading on the default `300 x 250 cm` wall. Unknown types are skipped and reported, and invalid finishes, sizes, and prices fall back to catalog values. `ledEnabled` defaults to on and `locked` to off unless they are explicit booleans. Names are length-limited and HTML-escaped, and files over 1 MB or 200 items are rejected.

### Collision Model
Items are axis-aligned rectangles, so item-to-item overlap uses a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal edge follows `y = x - (wallWidthPx - S)`, so checking the top-right corner of an item is an exact intersection test:

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
| Lock or unlock selected item | `L` |
| Remove selected item | `Delete` / `Backspace` |
| Duplicate selected item | `Ctrl+D` / `Cmd+D` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Y`, `Ctrl+Shift+Z` / `Cmd+Shift+Z` |
| Close the spec sheet | `Escape` |

## Project Structure

- `index.html` - Studio workspace layout, wall size controls, spec sheet dialog, and control bindings
- `styles/studio-workspace.css` - Flexbox UI layout, surface finish themes, lighting layers, rulers, alignment guides, lock indicators, the attic slope zone, and the spec sheet modal
- `scripts/planner-engine.js` - State management, undo/redo history, persistence, JSON and PNG export, import validation, wall sizing and viewport fit, drag-and-drop with alignment snapping, locking and layers, rulers, collision checks, and the spec sheet

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.

## License

Released under the [MIT License](LICENSE).