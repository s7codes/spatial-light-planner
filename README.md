# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale (default target wall: `300 x 250 cm`). Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing, measure exact mounting offsets, and check how warm backlights or corner RGB lamps interact in dark room conditions.

### Current Capabilities (v0.6)
- **Live Spatial Distance Guides:** Selecting or dragging an item draws dashed X/Y rulers from the left wall edge and the ceiling to the item, with live `cm` readouts. Guides follow mouse drags and arrow-key nudges in real time and hide when nothing is selected.
- **Attic Slope Mode:** A topbar toggle adds a `90 x 90 cm` 45-degree sloped ceiling cut-out in the top-right corner, drawn as a hatched hazard zone. Items reaching into the slope are flagged in red with a dedicated inspector warning, and the toggle state is persisted.
- **Live Property Inspector:** Edit mounted item dimensions (`Width` and `Height` in cm) and switch surface finishes (*Walnut*, *Oak*, *Matte Black*, *White*) in real time. Offset readouts and collision warnings update live while dragging.
- **Centimeter-Accurate Positioning:** Free dragging lands on whole centimeters, the `5 cm` snap toggle aligns to the grid, arrow keys nudge by exactly `1 cm`, and `Delete` / `Backspace` removes the selected item.
- **Local State Persistence:** Automatically serializes wall layout, lighting, and attic slope state to `localStorage` so configurations persist across browser reloads, complete with a layout reset action.
- **Interactive Drag-and-Drop & Collision Checks:** Direct mouse manipulation with strict wall boundary clamping (`0-300 cm` X, `0-250 cm` Y), real-time AABB overlap warnings, and sloped ceiling intrusion detection. Catalog items mount true to scale and always spawn inside the wall bounds.
- **Dual Canvas Modes & RGB Controls:** Switch between *Ambient Mode* and *Daylight Grid* (`10 x 10 cm` scale grid), with live RGB color pickers and master brightness dimmer.

## Technical Notes

### Collision Model
Items are axis-aligned rectangles, so item-to-item overlap uses a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal edge follows `y = x - (WALL_WIDTH - S)`. Because the top-right corner of a rectangle is always the point that reaches furthest past that edge, checking that single corner is an exact intersection test:

```
itemRight > WALL_WIDTH - S  &&  item.top < itemRight - (WALL_WIDTH - S)
```

### Rendering Performance
Drag input is coalesced with `requestAnimationFrame`, and the wall bounds are measured once per drag. Each frame writes inline `left` / `top` styles and updates the guides and warnings in place, so the item DOM is never rebuilt mid-drag.

## Project Structure

- `index.html` - Studio workspace layout and control bindings
- `styles/studio-workspace.css` - Flexbox UI layout, surface finish themes, lighting layers, distance guides, and the attic slope zone
- `scripts/planner-engine.js` - State management, localStorage persistence, drag-and-drop coordinates, distance guides, and AABB plus slope collision checks

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.

## License

Released under the [MIT License](LICENSE).