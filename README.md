# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale (default target wall: `300 x 250 cm`). Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing and check how warm backlights or corner RGB lamps interact in dark room conditions.

### Current Capabilities (v0.5)
- **Live Property Inspector:** Edit mounted item dimensions (`Width` and `Height` in cm) and switch surface finishes (*Walnut*, *Oak*, *Matte Black*, *White*) in real time.
- **Grid Snapping & Keyboard Nudge:** Toggle `5 cm` snap-to-grid alignment during mouse drag, use arrow keys for `1 cm` micro-adjustments, and press `Delete` / `Backspace` to remove selected items.
- **Local State Persistence:** Automatically serializes wall layout and lighting state to `localStorage` so configurations persist across browser reloads, complete with a layout reset action.
- **Interactive Drag-and-Drop & AABB Collision:** Direct mouse manipulation with strict wall boundary clamping (`0-300 cm` X, `0-250 cm` Y) and real-time overlap warnings.
- **Dual Canvas Modes & RGB Controls:** Switch between *Ambient Mode* and *Daylight Grid* (`10 x 10 cm` scale grid), with live RGB color pickers and master brightness dimmer.

## Project Structure

- `index.html` - Studio workspace layout and control bindings
- `styles/studio-workspace.css` - Flexbox UI layout, surface finish themes, and lighting layers
- `scripts/planner-engine.js` - State management, localStorage persistence, drag-and-drop coordinates, and AABB collision checks

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.

## License

Released under the [MIT License](LICENSE).