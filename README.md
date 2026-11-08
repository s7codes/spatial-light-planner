# Spatial & Ambient Light Planner

Live Demo: https://s7codes.github.io/spatial-light-planner/

[![E2E Tests](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml/badge.svg)](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml)

A to-scale 2D wall planner for shelving, framed art, and ambient RGB lighting. Mount items from a catalog, place and turn them with centimeter precision, check them against overlaps, doors, windows, sockets, and a sloped attic ceiling, preview the backlighting in a dark room, and hand off a bill of materials, drilling coordinates, or a high-resolution image of the finished plan.

Built with vanilla HTML, CSS, and JavaScript (ES2020). No framework, no build step, no runtime dependencies. Playwright is the only dev dependency, and it powers the end-to-end suite.

## Highlights

- **Precision placement:** Every position and size lives on a whole-centimeter grid. Dragging, arrow-key nudges, `5 cm` grid snapping, and magnetic alignment all land on exact centimeters, so on-screen readouts never drift from the stored layout.
- **Live measurement:** Dashed rulers show the distance from the left wall and the ceiling, plus the clearance to the nearest neighbor on every side. Green guides appear whenever an edge or center lines up with another item or the wall center.
- **Smart measurements:** Hold `Alt` / `Option` with something selected and point at any other item, or at bare wall, for Figma-style red distance lines and badges between the two boxes.
- **Room constraints:** Configurable wall size (`150-400 x 150-300 cm`), AABB overlap warnings, and an optional `90 x 90 cm` 45-degree attic slope with exact intrusion detection.
- **Room features:** Wall sockets, door clearances, and windows act as no-build zones. They cost nothing, carry no finish or lighting, and flag any furniture placed over them.
- **Rotation:** Turn any piece, or a whole selection, by 90 degrees with `R`, the context menu, or the Inspector. Storage doors, lamp diffusers, spotlight washes, and backlights all turn with it, on screen and in the PNG.
- **Lighting preview:** Per-item backlights, a corner floor lamp glow, RGB pickers, presets, and a master dimmer, with an Ambient Mode for night and a Daylight Grid for layout work.
- **Material realism:** Bevelled millwork finishes, gallery posters with a mat and recessed artwork, a glowing lamp diffuser, and spotlight light washes, reproduced in the PNG export.
- **Direct manipulation:** Drag catalog cards straight onto the wall, or click to mount them. Resize the selected item with on-canvas grips on its right edge, bottom edge, and corner.
- **Multi-selection:** Drag a selection box across empty wall, `Shift`-click to add or remove items, or press `Ctrl + A`. A group moves, nudges, locks, duplicates, re-layers, and changes finish as one rigid block, with a batch Inspector for shared edits.
- **Context menu:** Right-click any item for a frosted-glass menu with Duplicate, Bring Forward, Send Backward, Lock / Unlock, and Delete. Inside a group it acts on the whole group.
- **Per-item lighting:** Give any single item its own independent LED color, live on the wall and in the PNG export, or hand it back to the global picker with one click.
- **Editing workflow:** 30-step undo/redo, duplication, item locking, layer ordering, and three curated starter templates.
- **Handoff:** A grouped bill of materials, floor-referenced drilling coordinates (copyable as Markdown), JSON export/import, and a 2x HiDPI PNG snapshot.
- **Studio interface:** An obsidian, hairline-divided workspace with tactile catalog cards, a centered wall-size control, and an isometric brand mark that takes on the live lighting colors.
- **Tested end to end:** 257 Playwright tests cover every feature above and run in GitHub Actions on each push and pull request.

## Architecture

### Coordinate Space
The wall is modeled at `1 cm = 2.5 px`. Item geometry is stored in wall pixels, but every value is kept to a multiple of `2.5`, i.e. whole centimeters.

- Drag positions are quantized to `1 cm` (or `5 cm` with snapping on) before clamping.
- Arrow keys step from the nearest whole centimeter.
- Imports and saved state are rounded back onto the grid.

Wall pixel sizes are derived from the wall's centimeter dimensions. The wall uses `content-box` sizing, so its 2 px border sits outside that area and items flush with the right or bottom edge stay fully visible. When the wall is larger than the canvas, it is scaled with a CSS `transform` and pointer deltas are divided by the same factor, so dragging stays 1:1 under the cursor at any fit level.

### Rendering Loop
`mousemove` only records the pointer; a single `requestAnimationFrame` callback per frame applies the newest position. Each frame writes inline `left` / `top` styles for every item being moved, then updates collisions, rulers, guides, and warnings once for the whole set, so the item DOM is never rebuilt during a drag. The selection box follows the same pattern.

Wall bounds are read once per drag, ruler label sizes are measured once at startup, and item label sizes once per render. No layout reads happen inside the frame loop. Alignment guide elements come from a small reusable pool.

Lamps and spotlights carry labels wider than themselves. When such an item sits near a wall edge, its label is shifted just far enough to stay inside the wall, live during drags and in the PNG export, instead of being clipped.

### Direct Manipulation
Resizing and catalog drops reuse the drag engine's rules: one `requestAnimationFrame` per frame, pointer positions converted to wall space by dividing by the fit scale, and every result quantized to `1 cm` (or `5 cm` with snapping) before it is clamped.

- **Resize grips:** only the selected, unlocked item carries the `e`, `s`, and `se` grips. A press on a grip stops propagation so it never starts a move. Width is clamped to `[8 cm, wallWidth - left]` and height to `[4 cm, wallHeight - top]`. Each frame updates the inline size, the label position, collisions, rulers, and the Inspector fields without rebuilding the panel. Release commits one undo step if the size changed, and `Escape` restores the starting size.
- **Grip placement:** grips straddle the item edge. Against the wall they would be half clipped, so `.flush-right` and `.flush-bottom` flags tuck them inside the item there.
- **Catalog drops:** a press on a catalog card becomes a drag after `6 px` of travel. A ghost of the piece, drawn at the wall's own scale, follows the cursor and the wall shows a drop outline. A release over the canvas mounts the item centered under the cursor as a single undo step, while a release elsewhere or `Escape` cancels. Clicking a card still mounts it at the cascading default spot.
- **Late timers:** browsers run input ahead of timers, so the deferred resets that swallow stray clicks after a press carry a token. A late timer from an earlier press can no longer clear the guard of the press in progress.

### Selection Model
The selection is an array of item ids, `selectedItemIds`. Every change goes through one `setSelection()` call that syncs the `.selected` classes, the resize grips, the Inspector, the rulers, and the group outline. The single-item editors (size fields, resize grips, backlight switch, per-item color) only appear when exactly one item is selected.

- **Selection box:** a press on bare wall becomes a box after `3 px` of travel. Corners are converted to wall space (divided by the fit scale, minus the border) and clamped to the wall. Each frame tests every item against the box with the same strict AABB check the collision engine uses, and toggles `.selected` live without touching the Inspector. The selection is committed once on release, `Shift` makes the box additive, and `Escape` restores the previous selection.
- **Clicks:** `Shift`-click toggles one item and never starts a move. A plain press on a member of a group keeps the group so it can be dragged, and a release without movement narrows the selection to that member. A click on bare wall clears the selection, unless `Shift` is held.
- **Group outline and rulers:** a multi-selection is measured as one bounding box. A dashed outline marks it, and the wall and gap rulers measure that box against items outside the selection.

### Rotation Model
`rotation` is stored as `0`, `90`, `180`, or `270`, and `width` / `height` always describe the footprint on the wall. A quarter turn swaps them in the data model, so collisions, the selection box, snapping, rulers, and wall clamping keep working on a plain axis-aligned box with no rotated geometry anywhere.

- **Pivot:** an item turns clockwise about its center. When the center offset lands on a half centimeter, even turns round one way and odd turns the other, so four turns bring a piece back exactly where it started.
- **Fit:** a turned item is clamped back inside the wall. A piece whose swapped footprint would not fit at all (a full-width shelf on a shorter wall) stays as it is, and its Rotate controls are disabled.
- **Minimum sizes:** the `8 cm` minimum width and `4 cm` minimum height belong to the piece, so after a quarter turn they swap sides for resize grips, Inspector fields, and the sanitizer.
- **Groups:** every unlocked member turns in place as one undo step. Locked members are skipped.
- **Details:** each item carries a `rot-*` class that sets `--up-x`, `--up-y`, and `--turn`. Directional backlights read their offsets from the first two, the spotlight wash rotates with `--turn` about the fixture center, and per-rotation rules move the storage seam and handles and lay the lamp diffuser flat. Labels stay upright.
- **Bill of materials:** a turned shelf is still the same product, so the BOM lists it at its catalog orientation while the drilling table uses the real footprint.

### Room Features
Wall sockets (`8 x 8 cm`), door clearances (`90 x 210 cm`), and windows (`120 x 120 cm`) live in their own catalog group and are modeled as items with a reserved type.

- **Schema:** the sanitizer forces a `0` price, no finish, no backlight, and no per-item color, whatever a file claims. They never reach the budget, the bill of materials, or the drilling table.
- **Collisions:** furniture overlapping a feature turns red and shows a dedicated warning. Features may overlap each other (a socket inside a door frame), and the attic slope never flags them, since doors and windows are cut into the wall itself.
- **Placement:** a new feature joins the bottom of the layer stack, beneath existing furniture.
- **Drawing:** a door clearance is an elevation-style opening with a corner-to-corner cross, a window has a frame and mullions over tinted glass, and a socket shows its faceplate and pins. All of it is plain CSS that the PNG renderer reproduces, and the colors follow Ambient Mode and the Daylight Grid.

### Smart Measurements
Holding `Alt` / `Option` with a selection turns the pointer into a measuring probe. Pointing at any unselected item, or at bare wall, replaces the regular rulers with red distance lines and badges between the selection's bounding box and the hovered box.

- **Rules:** boxes that are apart on an axis get one line across the gap, through their shared span. When they are apart on both axes, each line runs through the selection's center and a dashed extension carries the hovered edge out to it. Boxes that intersect or nest, like an item inside a window or the wall itself, get a line between each pair of matching edges.
- **Cost:** pointer moves are batched into one frame, and the overlay is only rebuilt when one of the two boxes changes. Alt-arrow nudges update the readout live.
- **Scope:** measuring pauses during drags, resizes, and selection boxes, so `Alt` keeps its job of bypassing the magnet mid-drag. Releasing `Alt` brings the regular rulers back.

### Group Drag & Batch Editing
A drag always moves the selection as a group, and a single item is simply a group of one, so both share one code path.

- **Rigid block:** the group's bounding box is quantized to the snap step and clamped to the wall. Every member then moves by the same delta, so the group stops at the wall edge without changing shape.
- **Alignment:** the bounding box snaps to the edges and centers of items outside the selection, with the same `1 cm` magnet, `Alt` bypass, and whole-centimeter guard as a single item.
- **Attic slope:** a group refuses any frame that would push a member into the slope. It first tries to slide along whichever axis is still free, and otherwise holds its last valid position. Members that were already inside the slope may move out of it. A single item keeps the original behavior: it can enter the slope and is flagged red, so a tight fit can still be tested.
- **Locks:** one locked member holds the whole group in place and flashes the lock note. Removal and finish changes skip locked members instead, and Lock All locks a mixed selection before it ever unlocks.
- **Keyboard:** arrow keys nudge the group with the offset clamped to the bounding box, so members never squeeze out of formation against a wall edge.
- **Duplicates:** copies keep their relative layout, so the `4 cm` offset is clamped for the group box rather than per item, and the copies become the new selection.
- **Layers:** Bring Forward walks the stack from the top and lets each selected item hop over its unselected neighbor once. The group shifts one layer and keeps its inner order, even when it is split across the stack. Send Backward mirrors this from the bottom.

### Context Menu
Right-clicking an item replaces the browser menu with a custom panel built from a frosted-glass surface: `backdrop-filter: blur(16px)` over a translucent obsidian fill, hairline borders, and soft depth shadows.

- **Targeting:** an item outside the selection is selected first. An item inside a group opens the menu for the whole group, and the title and labels follow (`Lock All`, `2 items selected`).
- **Placement:** the panel lives outside the scaled wall, so `position: fixed` follows the viewport. It is measured after opening and flipped to the other side of the cursor wherever it would run off screen.
- **States:** Bring Forward and Send Backward disable at the ends of the stack, Rotate disables when nothing selected can turn, Lock flips to Unlock, and Delete disables when every target is locked.
- **Dismissal:** a press anywhere else (caught in the capture phase), `Escape`, `Tab`, an action, a window blur, or a resize closes it.
- **Keyboard:** the arrow keys, `Home`, and `End` walk the enabled items and `Enter` runs one. Any other key closes the menu and still runs its shortcut, so the hints printed in the menu keep working while it is open.

### CSS Custom Property Lighting Engine
Glows are pure CSS. Each item's `::before` pseudo-element carries `box-shadow` layers tinted by `--led-color`, the corner lamp and wall glow follow `--corner-led`, and `--led-opacity` drives the master dimmer. JavaScript changes a lighting preset by setting three custom properties on the root element, with no per-item repaint logic.

Per-item color is a one-line cascade on each item:

```css
.wall-item             { --led-color: var(--item-color, var(--accent-led)); }
.wall-item.corner-lamp { --led-color: var(--item-color, var(--corner-led)); }
```

`--item-color` is written inline only on items that carry an `itemLedColor`, so every other item keeps inheriting the global picker. While the color picker is open, only that inline property changes, so the preview is live without a rebuild, and the `change` event commits one undo step. `Use Global` removes the property again. The PNG exporter reads the resolved glow from the computed style and takes the spotlight wash color from the same data.

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
History is a bounded stack of 30 serialized snapshots covering items (including rotation, backlight, per-item color, lock state, and layer order), wall size, and the attic slope. The selection is not part of history; after an undo it keeps whichever selected items still exist. Lighting colors and brightness are treated as preferences and left out.

- Identical consecutive snapshots are dropped.
- A new action after an undo truncates the redo branch.
- Bursts of the same action are coalesced: held arrow-key nudges on one item, or rapid wall-size edits, become a single step.
- A drag commits exactly one snapshot on `mouseup`, and only if something moved. A group drag, a grip resize, and a catalog drop follow the same rule.
- Batch edits (rotation, finish, lock, duplicate, delete, layer moves) are one step each, held nudges on the same selection merge into one, and a color pick is one step however long the picker stays open.

### XSS-Safe JSON Schema Sanitizer
Saved state, imported files, and starter templates all pass through one `normalizeLayout()` function. Nothing is applied until the whole file validates, so a bad file never leaves a half-loaded wall.

- **Wall:** dimensions are rounded to whole centimeters and clamped to the allowed range. Files from v0.7, which carry no wall size, load on the default `300 x 250 cm` wall.
- **Items:** unknown types are skipped and reported. Invalid finishes, sizes, and prices fall back to catalog values read from the catalog markup itself. Geometry is snapped to whole centimeters and clamped inside the wall. `ledEnabled` and `locked` only accept real booleans, `itemLedColor` only a 6-digit hex color (stored lowercase) or `null`, and `rotation` only a quarter turn; anything else falls back to `0`.
- **Names and ids:** names are trimmed, length-limited, and HTML-escaped wherever they are rendered. Valid unique ids are kept; duplicate or malformed ids are regenerated.
- **Limits:** colors must be 6-digit hex, brightness is clamped to `0-100`, and files over 1 MB or 200 items are rejected.

The export schema is versioned (`"1.4"`, which adds `rotation` and the room feature types; `1.3` added `itemLedColor`). Files from `0.7` through `1.3` import unchanged: their items load unturned and follow the global lighting colors.

### Bill of Materials & Drilling Coordinates
The spec sheet groups furniture by type, name, catalog size in cm, finish, and price into a priced bill of materials. Room features are left out of both tables. Every item is also listed left to right with its distance from the left wall, the ceiling, and the floor. Installers measure shelving up from the floor, so the bottom edge is derived as:

```
From Floor = wallHeightCm - topCm - heightCm
```

The same rows feed the modal tables and the `Copy as Markdown` export, which uses the async Clipboard API with a selection-based fallback.

### HiDPI Canvas 2D PNG Renderer
`Export PNG` draws the wall on an offscreen canvas at `wallWidthPx * 2` by `wallHeightPx * 2` with the native Canvas 2D API. It paints in the same stacking order as the live DOM: background or daylight grid, attic slope, corner glow, then items in layer order, and finally a dimensions caption.

Item fills, borders, corner radii, drop shadows, glow layers, and pseudo-element transforms are read from each element's computed style, so the PNG always matches the CSS on screen without a second copy of the palette. Shadows are painted in isolation by drawing the shape far off canvas and offsetting only its shadow back into place. Shadow offsets and blur ignore the canvas transform, so they are scaled to device pixels by hand.

### Material Rendering
- **Finishes:** each finish sets four custom properties: a highlight and a shade for a `4px` bevel band at the top and bottom of the face (`--sheen-*`), and two crisp `1px` inset edges (`--edge-*`). The CSS gradient and the canvas gradient are both built from those properties, and the band stays transparent across the middle of the face.
- **Posters:** the border is the frame, the background is the mat, and an `::after` box is the artwork, set back with inset shadows.
- **Lamp and spotlights:** the lamp's `::after` is an LED diffuser tinted by its `--led-color`. In daylight, or with the backlight off, it falls back to an unlit frosted strip. A spotlight's `::after` is a clipped light wash that fades from its `--led-color`.
- **Exporter:** a list parser reads spread and `inset` from computed `box-shadow` values. Inset shadows are painted by clipping to the shape and offsetting the shadow of a surrounding frame back inside it. The artwork, diffuser, and wash are read from each item's `::after` computed box, opacity, and clip path.
- **Rotation:** a turned spotlight's wash is painted through the same `matrix()` and `transform-origin` the browser resolved for its `::after`, so the canvas applies exactly the rotation the DOM shows. Storage handles are painted side by side from whichever borders the current rotation uses, and the diffuser and socket pins come from their computed boxes.
- **See-through fills:** room features have translucent backgrounds, so their borders are painted as a ring instead of a full shape underneath, and the door cross and window mullions are drawn from the same custom properties as the CSS.
- **No transitions:** the exported pseudo-elements change instantly, so a snapshot taken right after a mode or LED switch reads the final state.
- **Glow geometry:** the glow layer spans the item's border box, so a framed item's glow starts outside its frame. That is also the shape the exporter uses.

### Accessibility
- Both modals are native `<dialog>` elements opened with `showModal()`. Focus moves inside, the page behind becomes inert, `Escape` closes them, and focus returns to the control that opened them. Only one can be open at a time.
- Catalog entries are real buttons, so items can be mounted with `Enter` or `Space`.
- Every button and input has a visible label, `aria-label`, or `title`, and buttons show a keyboard focus ring. Icon-only buttons such as Undo and Redo carry an `aria-label`.
- The restyled toggles are still native checkboxes, so they keep keyboard and screen reader support. Their focus ring wraps the whole chip.
- Transitions and the dialog entrance animation are switched off under `prefers-reduced-motion`.
- Inspector panel rebuilds hand keyboard focus back to the control that triggered them.
- The context menu uses `role="menu"` with `menuitem` buttons, exposes its shortcuts through `aria-keyshortcuts`, and is fully keyboard operable.
- The compact room feature tiles show short names and carry the full name and size in their `aria-label`.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Drag item | Move the item, or the whole selection, on the wall (with 1 cm magnetic alignment) |
| Drag on empty wall | Draw a selection box (`Shift` adds to the selection) |
| `Shift` + click | Add or remove an item from the selection |
| `Ctrl + A` / `Cmd + A` | Select every item on the wall |
| Right-click item | Open the item menu |
| `R` | Rotate the selection 90 degrees clockwise |
| Hold `Alt` / `Option` and point at an item or bare wall | Measure from the selection to it |
| Hold `Alt` / `Option` while dragging | Temporarily bypass magnetic alignment guides |
| Arrow keys | Nudge the selection by 1 cm |
| `Ctrl + Z` / `Cmd + Z` | Undo the last layout action (up to 30 steps) |
| `Ctrl + Y` / `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo a layout action |
| `Ctrl + D` / `Cmd + D` | Duplicate the selection (+4 cm offset) |
| `L` | Lock or unlock the selection's position and properties |
| `Delete` / `Backspace` | Remove the selected unlocked items |
| `?` | Toggle the keyboard shortcuts guide |
| `Escape` | Close the open menu or modal, or clear the selection |

Shortcuts are ignored while typing in a field, and the browser's own text undo keeps working inside number inputs. `Escape` also cancels a catalog drag, a grip resize, or a selection box in progress.

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

The end-to-end suite drives the real app in Chromium with [Playwright](https://playwright.dev): 257 tests in 20 spec files, one per feature area.

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
| `materials` | Screen and PNG parity on every new material, finish bevels, poster mat and artwork, lamp diffuser, spotlight wash |
| `resize` | Grip visibility, live width and height with Inspector and ruler sync, snapping, wall and minimum clamps, undo, `Escape`, scaled walls |
| `catalog-drag` | Drop centering, snapping, edge clamps, ghost and drop target, cancel paths, short presses as clicks, scaled walls |
| `multi-select` | Selection box hits and live classes, `Shift` toggles, `Ctrl + A`, `Escape` restore, group outline and rulers, rigid group drag with wall clamp, attic block and slide, lock hold, group nudges, single undo steps, scaled walls |
| `context-menu` | Glass panel at the cursor, default menu suppressed, retargeting, group actions, disabled states, close paths, keyboard navigation, viewport flipping |
| `batch-inspector` | Count, total and group geometry, batch finish, Lock All / Unlock All, group duplicate, delete that keeps locked items, split-group layer moves |
| `item-led` | Inline `--item-color`, live preview without a rebuild, one undo step, `Use Global`, global pickers for the rest, PNG parity, locks, export, duplicate, reload, legacy and malformed files |
| `rotation-obstacles` | Center-pivot turns with swapped footprints, drift-free full turns, collisions, marquee and clamping on turned items, unfit and locked pieces, batch turns, rotation-aware minimums, PNG parity for turned details, $0 room features kept out of the budget and spec sheet, feature collision rules, legacy and malformed rotations |
| `measure` | Alt-hover gap lines and badges, diagonal extensions, wall-edge and nested measurements, group boxes, live updates while nudging, idle states, Alt magnet bypass |
| `app-shell` | Zero failed requests, favicon, live-tinted logo, shortcuts guide, `Escape`, accessibility audit, topbar centering, responsive layout |

How the suite is built:

- `playwright.config.js` boots `tests/support/static-server.js`, a zero-dependency Node server, so the app is tested over HTTP as it is served in production.
- Every test starts in a fresh browser context with clean storage, and fails on any uncaught exception or console error.
- The group drag and per-item color tests tag item elements first and check the tags afterwards, which proves those updates write inline styles instead of rebuilding the DOM.
- The engine is a classic script, so helpers read its state through `page.evaluate` instead of adding test hooks to the app.
- Gap ruler readouts are compared with an independent implementation across 40 seeded random layouts.
- PNG exports are decoded in the browser and sampled pixel by pixel through a custom `toBeNearColor` matcher.
- Layout checks pass with Inter, DejaVu Sans, Liberation Sans, and FreeSans, so the result does not depend on the fonts installed on the CI runner.

### Continuous Integration

`.github/workflows/e2e.yml` runs the suite on every push to the main branch and on every pull request: Ubuntu, Node 22, and Chromium installed through Playwright. Failed tests are retried once with a trace, and the HTML report is uploaded as a build artifact.

## Project Structure

```
index.html                    App shell, catalog, inspector, dialogs, context menu, inline SVG brand mark, and favicon
styles/studio-workspace.css   Design tokens, layout, finish themes, lighting layers, rulers, guides, and dialogs
scripts/planner-engine.js     State, selection model, history, persistence, sanitizer, drag and selection-box
                              engine, alignment, collision checks, context menu, spec sheet, and the
                              Canvas 2D PNG renderer
tests/*.spec.js               Playwright end-to-end specs, one per feature area
tests/support/                Fixtures, shared helpers, and the zero-dependency static server
playwright.config.js          Chromium project, local web server, and CI reporters
.github/workflows/e2e.yml     Runs the suite on every push and pull request
```

## Browser Support

Current versions of Chrome, Edge, Firefox, and Safari (15.4 or later, for the native `<dialog>` element). A few accent tints use `color-mix()` inside an `@supports` block, so older engines show the same layout with fixed tints of the default accent. The automated suite runs in Chromium.

## License

Released under the [MIT License](LICENSE).
