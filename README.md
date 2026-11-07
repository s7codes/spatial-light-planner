# Spatial & Ambient Light Planner

A 2D wall layout and lighting tool built to plan shelving, framed art, and ambient RGB lighting setups to scale before drilling into the wall.

## Overview

The canvas represents a physical room wall at a fixed `1 cm = 2.5 px` scale (default target wall: `300 × 250 cm`). Items mounted from the catalog render at their proportional physical dimensions, allowing you to test spacing and check how warm backlights or corner RGB lamps interact in dark room conditions.

### Current Capabilities (v0.3)
- **Dual Canvas Modes:** Switch between *Ambient Mode* (dark room with diffused CSS shadow projections) and *Daylight Grid* (`10 × 10 cm` alignment grid with lighting layers disabled).
- **Live Lighting Controls:** Real-time color pickers and master dimmer mapped directly to root CSS custom properties (`--accent-led`, `--corner-led`, `--led-opacity`).
- **State-Driven Catalog & Budget:** Click-to-mount component catalog that dynamically renders items onto the wall, tracks selection state in the inspector, and calculates total setup cost.

## Project Structure

- `index.html` – Studio workspace layout and control bindings
- `styles/studio-workspace.css` – Flexbox UI layout, grid backgrounds, and lighting layers
- `scripts/planner-engine.js` – State array management, DOM rendering, and event listeners

## Running Locally

No build step required. Clone the repository and open `index.html` via VS Code Live Server or any local static server.