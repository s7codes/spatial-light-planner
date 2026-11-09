# Spatial & Ambient Light Planner

Live Demo: https://s7codes.github.io/spatial-light-planner/

[![E2E Tests](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml/badge.svg)](https://github.com/s7codes/spatial-light-planner/actions/workflows/e2e.yml)

A to-scale 2D wall planner for shelving, framed art, and ambient RGB lighting. Mount items from a catalog, place, turn, mirror, align, and distribute them with centimeter precision against reference guides, or type exact coordinates, zoomed in as close as the detail needs, check them against overlaps, doors, windows, sockets, and a sloped attic ceiling, trace every cable run to the nearest socket, preview the backlighting in a dark room on a choice of wall paints, drive all of it from a `Ctrl + K` command palette, and hand off a bill of materials, drilling coordinates, a spreadsheet-ready CSV, or a high-resolution image of the finished plan. Every wall is kept as a named project in the browser, and any wall can be sent to someone else as a single link. Engineer Mode keeps every drafting tool in view, a decluttered Creator Mode clears them away for arranging and lighting, a bed, desk, or sofa sketched on the floor line shows how high everything really hangs, and poster frames take a choice of curated prints.

Built with vanilla HTML, CSS, and JavaScript (ES2020), split into native ES modules the browser loads directly. No framework, no bundler, no build step, no runtime dependencies. Playwright is the only dev dependency, and it powers the end-to-end suite.

## Highlights

- **Engineer and Creator modes:** A segmented switch at the head of the right sidebar, `Alt + M`, or the command palette flips the studio between Engineer Mode, with rulers, reference guides, cable runs, layers, room features, and exact coordinates, and a decluttered Creator Mode for arranging and lighting. The layout never changes, so switching back finds every tool as it was left.
- **Ergonomic clearance advisor:** The Inspector reads every piece of furniture against the floor: a poster's center against the `140-160 cm` eye-level gallery zone, other pieces by their bottom and center height, and, while a floor reference stands under the piece, its clearance above the bed, desk, or sofa, with a warning when they overlap.
- **Item style copy and paste:** Copy Style (`Alt + Shift + C`) takes the finish, backlight switch, LED color, and poster print of the selected piece, and Paste Style (`Alt + Shift + V`) applies it to every unlocked piece of furniture in the selection as one undo step.
- **Hardware and LED kit estimate:** The spec sheet totals the LED strip in meters, the power draw with a `24V` adapter recommendation, and the wall anchors needed for everything on the wall.
- **Floor reference silhouettes:** Sketch a `155 x 85 cm` bed, a `140 cm` desk with a monitor, `115 cm` tall overall, or a `200 x 82 cm` three-seat sofa in blueprint lines on the floor line, centered or stood near the left or right wall, to judge mounting heights against real furniture. It is a view aid only: never saved, undone, or exported.
- **Curated poster prints:** Every poster frame carries one of four prints, picked in the Inspector: the original Noir recess, a Bauhaus circle and bar, a Botanical stem, or a warm Horizon sun. The print is saved, undone, copied, and reproduced in the PNG export.
- **Small-item grips:** Up to `12 x 12 cm`, the resize grips of a selected piece sit outside its edges, so pressing anywhere on a wall socket drags it instead of resizing it.
- **Command palette:** `Ctrl + K` (or the HUD button) opens a searchable list of every studio action: mounting any component, view toggles, selection edits, lighting presets, wall paints, projects, and exports. Type a few words, walk the list with the arrow keys, and press `Enter`.
- **Typed coordinates and wall centering:** The Inspector takes an exact Left X and Top Y in centimeters, clamped to the wall and live while the item is dragged, nudged, or resized. Center H and Center V put a piece, or a whole selection as one rigid block, on the wall's center lines.
- **Power routing:** A drafting overlay traces each lit item to its nearest wall socket along an orthogonal cable path, labels every run in centimeters, flags runs over `250 cm`, and sums the total cable needed.
- **Precision placement:** Every position and size lives on a whole-centimeter grid. Dragging, arrow-key nudges, `5 cm` grid snapping, and magnetic alignment all land on exact centimeters, so on-screen readouts never drift from the stored layout.
- **CAD rulers:** Frosted edge rulers frame the top and left of the wall with a tick every `10 cm` and a label every `50 cm`. Live hairlines read the pointer position in whole centimeters, and a shaded band marks the selection's extent.
- **Reference guides:** Drag out of either ruler to drop up to 12 dashed guide lines on the wall. Items and whole selections snap to them, and they move in `1 cm` (or `5 cm`) steps, leave when dragged off the wall or double-clicked, and are saved with the layout.
- **Viewport zoom and pan:** Zoom from 50% to 250% with the floating HUD, `Ctrl + Wheel` (or a trackpad pinch) about the pointer, or `Ctrl + =` / `Ctrl + -`, and pan with `Space + Drag` or the middle button. The rulers stay in register, and every drag, selection box, catalog drop, and guide pull lands on exact centimeters at any zoom.
- **Studio clipboard:** `Ctrl + C`, `Ctrl + X`, and `Ctrl + V` copy, cut, and paste whole selections with their groups and stacking order. Repeated pastes cascade 4 cm apart, and every copy is fresh, unlocked, and kept on the wall.
- **Symmetry:** Flip a selection horizontally across its own center line, or mirror a single piece across the wall's center, with quarter turns swapping to their mirror image.
- **Share links:** Copy Share Link packs the whole wall into a URL. Opening it rebuilds the layout in any browser, as a new project for anyone who already has some.
- **Align & Distribute:** With two or more pieces selected, the Inspector lines them up by any edge or center, or spaces three or more with equal gaps, treating groups as rigid blocks and holding pieces clear of the attic slope.
- **Live measurement:** Dashed rulers show the distance from the left wall and the ceiling, plus the clearance to the nearest neighbor on every side. Green guides appear whenever an edge or center lines up with another item or the wall center.
- **Smart measurements:** Hold `Alt` / `Option` with something selected and point at any other item, or at bare wall, for Figma-style red distance lines and badges between the two boxes.
- **Room constraints:** Configurable wall size (`150-400 x 150-300 cm`), AABB overlap warnings, and an optional `90 x 90 cm` 45-degree attic slope with exact intrusion detection.
- **Room features:** Wall sockets, door clearances, and windows act as no-build zones. They cost nothing, carry no finish or lighting, and flag any furniture placed over them.
- **Text notes:** Sticky-note annotations from the Room Features group. Double-click one on the wall to type in place ("TV center", "Router here"); the text wraps on the wall and in the PNG alike.
- **Rotation:** Turn any piece, or a whole selection, by 90 degrees with `R`, the context menu, or the Inspector. Storage doors, lamp diffusers, spotlight washes, and backlights all turn with it, on screen and in the PNG.
- **Lighting preview:** Per-item backlights, a corner floor lamp glow, RGB pickers, presets, and a master dimmer, with an Ambient Mode for night and a Daylight Grid for layout work.
- **Wall paint:** Five architectural tones (Charcoal, Greige, Sage, Navy, Concrete) for the wall itself, each with a pale counterpart for the Daylight Grid, carried into the PNG export.
- **Material realism:** Bevelled millwork finishes, gallery posters with a mat and recessed artwork, a glowing lamp diffuser, and spotlight light washes, reproduced in the PNG export.
- **Direct manipulation:** Drag catalog cards straight onto the wall, or click to mount them. Resize the selected item with on-canvas grips on its right edge, bottom edge, and corner.
- **Multi-selection:** Drag a selection box across empty wall, `Shift`-click to add or remove items, or press `Ctrl + A`. A selection moves, nudges, locks, duplicates, re-layers, and changes finish as one rigid block, with a batch Inspector for shared edits.
- **True grouping:** `Ctrl + G` bundles a selection into a lasting group and `Ctrl + Shift + G` dissolves it. One click picks the whole group, and it drags, nudges, turns, and duplicates as a single object, while a double-click still reaches a single member.
- **Layer explorer:** A docked Layers panel lists every item and group in exact stacking order. Click rows to select, drag them to restack, and use the eye and padlock on each row to hide or lock items and whole groups.
- **Context menu:** Right-click any item for a frosted-glass menu with Duplicate, Group, Ungroup, Bring Forward, Send Backward, Rotate, Lock / Unlock, and Delete. Inside a selection it acts on all of it.
- **Per-item lighting:** Give any single item its own independent LED color, live on the wall and in the PNG export, or hand it back to the global picker with one click.
- **Editing workflow:** 30-step undo/redo, duplication, item locking, layer ordering, and three curated starter templates.
- **Project gallery:** Keep up to 24 walls as named projects. The My Projects dialog shows each one with a schematic thumbnail, its last edited date, and Load, Rename, and Delete, and the open project saves itself after every change.
- **Handoff:** A grouped bill of materials, floor-referenced drilling coordinates (copyable as Markdown or downloadable as one CSV file), JSON export/import, and a 2x HiDPI PNG snapshot.
- **Studio interface:** An obsidian, hairline-divided workspace with tactile catalog cards, a centered wall-size control, and an isometric brand mark that takes on the live lighting colors.
- **Tested end to end:** 388 Playwright tests cover every feature above and run in GitHub Actions on each push and pull request.

## Architecture

### ES6 Module Architecture
Since v2.1 the engine is a tree of native ES modules. `index.html` loads one entry with `<script type="module">`, and the browser resolves the rest; there is still no bundler or build step.

| Module | Responsibility |
| --- | --- |
| `scripts/core/constants.js` | Scale, limits, storage keys, catalog tables, templates and floor references, plus pure helpers (`clamp`, `toCm`, `getBounds`, `escapeHtml`, Base64URL, CSV and Markdown cells). Imports nothing. |
| `scripts/core/dom.js` | Every static element reference, the gap ruler table, catalog fallbacks read from the markup, `isModalOpen`, `getItemElement`, `ledColorOf`. Imports only constants. |
| `scripts/core/state.js` | The shared `state` object, idle factories for each pointer interaction, id generators, selection and group queries, the layout sanitizer, guarded `localStorage`, and undo / redo history. |
| `scripts/core/geometry.js` | AABB and attic slope collisions, gap and magnetic alignment solvers, the Alt-hover measurement solver, power routing, and rotation, arrange, mirror and nudge math. Reads state, never the UI. |
| `scripts/ui/viewport-rulers.js` | Wall sizing, fit, zoom and pan, CAD edge rulers and crosshairs, reference guides, distance rulers, the measurement overlay, cable runs, floor references, studio modes, wall paint and lighting. |
| `scripts/ui/inspector-layers.js` | `renderPlanner`, labels and grips, selection and item actions, inline note editing, the Layer Explorer, the Inspector, the context menu and the command palette. |
| `scripts/io/export-png.js` | The 2x Canvas 2D PNG renderer and its CSS parsing helpers. |
| `scripts/io/projects-spec.js` | Project gallery and autosave, legacy migration, `#plan=` share links, JSON import and export, templates, the spec sheet with Markdown and CSV, and the shortcuts dialog. |
| `scripts/planner-engine.js` | The entry: item drag, grip resize, catalog drag and drop, the selection box, keyboard shortcuts, event binding and the startup sequence. |

How the modules stay safe to wire together:

- **No writes to imported bindings:** an `export let` is read-only in every importing module, so any binding that more than one module reassigns lives on the exported `state` object in `core/state.js` (wall size, items, selection, guides, history, zoom and pan, the pointer interaction states, the clipboard). A binding only one module touches stays a private `let` in that module.
- **No load-time traps:** module cycles exist (history restore re-renders the UI, the UI saves through the projects module), but no module reads an imported value while it is being evaluated. Top-level code in every module only declares functions and local constants, functions are hoisted across cycles, and the only top-level calls are in the entry, which the browser evaluates last.
- **Listener order preserved:** feature modules expose `bindViewportEvents()`, `bindInspectorEvents()` and `bindProjectSpecEvents()`, and the entry calls them before binding its own pointer and keyboard listeners. The viewport binder goes first so the crosshair and Alt-hover listeners still see each `mousemove` before a drag frame is scheduled, exactly as in v2.0.
- **Console bridge:** v2.0 was a classic script whose top-level bindings were globals, reachable from DevTools and from the end-to-end suite. The entry republishes that read surface on `window` (live getters for state such as `wallItems`, `viewScale` and `historyIndex`, plain values for functions like `importLayoutText` and for element references), while everything else stays module-private.

### Coordinate Space
The wall is modeled at `1 cm = 2.5 px`. Item geometry is stored in wall pixels, but every value is kept to a multiple of `2.5`, i.e. whole centimeters.

- Drag positions are quantized to `1 cm` (or `5 cm` with snapping on) before clamping.
- Arrow keys step from the nearest whole centimeter.
- Imports and saved state are rounded back onto the grid.

Wall pixel sizes are derived from the wall's centimeter dimensions. The wall uses `content-box` sizing, so its 2 px border sits outside that area and items flush with the right or bottom edge stay fully visible. When the wall is larger than the canvas, it is scaled with a CSS `transform` and pointer deltas are divided by the same factor, so dragging stays 1:1 under the cursor at any fit level. The user's zoom multiplies that fit (see Viewport Zoom & Pan), and the same division keeps every interaction exact.

### Rendering Loop
`mousemove` only records the pointer; a single `requestAnimationFrame` callback per frame applies the newest position. Each frame writes inline `left` / `top` styles for every item being moved, then updates collisions, rulers, guides, and warnings once for the whole set, so the item DOM is never rebuilt during a drag. The selection box follows the same pattern.

Wall bounds are read once per drag, ruler label sizes are measured once at startup, and item label sizes once per render. No layout reads happen inside the frame loop. Alignment guide elements come from a small reusable pool.

Lamps and spotlights carry labels wider than themselves. When such an item sits near a wall edge, its label is shifted just far enough to stay inside the wall, live during drags and in the PNG export, instead of being clipped.

### Canvas Rulers
Edge rulers run along the top and left of the wall, the way CAD tools frame a drawing. They are absolutely positioned in the canvas padding, outside `#wall`, so the wall's box, its fit scale, and the drag math never see them. `pointer-events: none` lets every press fall through to the canvas.

- **Scale:** ticks sit every `10 cm` and labels every `50 cm`, at `cm * 2.5 * fitScale` px from the wall's inner corner. The marks are rebuilt only when the wall is fitted again (a wall resize, or a window or panel change reported by a `ResizeObserver` on the canvas), never on pointer moves. A label too close to the far end moves to the near side of its tick instead of being clipped.
- **Hairlines:** `mousemove` only stores the pointer. One `requestAnimationFrame` callback per frame converts it to wall space from the ruler origin cached at the last fit, then writes a `transform` on each hairline and its whole-centimeter readout, with no layout reads. The hairlines hide off the wall, when the pointer leaves the window, and while a dialog is open, and their readouts swap sides near the far end.
- **Selection extent:** the selected item, or a multi-selection's bounding box, is shaded on both rulers. The band follows drags and resizes through the same inline-style path as the selection outline.
- **Styling:** a translucent obsidian fill under `backdrop-filter: blur(8px)`, with an inset ring instead of a border so tick offsets start at the true edge.
- **Zoomed views:** the rulers are positioned from the wall's live bounding box, so they scale and pan with it. When a wall edge leaves the canvas, its ruler parks just inside the canvas edge and floats over the wall, as in CAD tools, with its ticks still registered. Ticks are rebuilt only when the scale or the wall size changes, so a pan only moves the two ruler elements.

### Viewport Zoom & Pan
The view sits on top of the fit: `viewScale = fitScale * userZoom`, with `userZoom` clamped to `0.5-2.5`, and `panX` / `panY` shift the wall's center.

- **Resting geometry:** at 100% with no pan, `#wall` gets exactly the transform earlier versions wrote (none at full size, a plain `scale()` when fitted), so its bounding box, the scale note, and the rulers are unchanged. Zoomed or panned, the transform is `translate(pan) scale(viewScale)` about the wall's center, which flexbox keeps on the canvas center.
- **Zoom about a point:** a wall point sits at `center + pan + s * p`. Holding that screen position steady while the scale goes from `s` to `s'` gives `pan' = q - (s' / s) * (q - pan)`, with `q` measured from the canvas center. `Ctrl + Wheel` uses the pointer as `q`, scaled so a mouse notch is one 10% step and a trackpad pinch stays smooth. The HUD buttons and `Ctrl + =` / `Ctrl + -` step to the next quarter about the canvas center, and `Ctrl + 0` or the percentage button resets the view.
- **Panning:** holding `Space` readies a pan, and a left press then, or any middle press, pans in a capture-phase handler on the canvas. It never reaches items or the wall, so nothing is dragged, boxed, or deselected. One `requestAnimationFrame` per frame writes the transform and moves the rulers. The pan is clamped so at least 80 px of the wall stays in view, and `Escape` puts it back.
- **Space and focus:** `Space` keeps its job in text fields and on a button reached with `Tab`. A button that only holds focus because it was clicked gives `Space` up, and the HUD buttons never take focus from a click, so clicking `+` and then panning just works.
- **Zero drift:** item drags, grip resizes, selection boxes, catalog drops, and guide pulls all read the wall's bounding box when they start and divide screen deltas by `viewScale`, so they land on exact centimeters at any zoom and pan. Zooming waits while any of them is in progress.
- **Scope:** zoom and pan are a view, not part of the layout: they are not saved, exported, or undone, and the scale note keeps describing the fit only.

### Reference Guides
`wallGuides` holds up to 12 entries of `{ id, axis, cm }`: axis `x` is a vertical line at `x = cm`, axis `y` a horizontal one.

- **Pulling a guide:** the rulers keep `pointer-events: none`, so a press on bare canvas is checked against their screen rectangles, rebuilt from the origin cached at the last fit. The top ruler pulls out a horizontal guide and the left ruler a vertical one. The canvas shows the matching resize cursor over a ruler, and a press inside `#wall` never reaches this path, so clicks and selection boxes on the wall behave exactly as before.
- **Dragging:** one `requestAnimationFrame` per frame converts the pointer to wall space, rounds it to `1 cm` (or `5 cm` with snapping on), and writes the guide's inline position and its cm tag. Only the guide's own axis decides whether it is still on the wall, so drifting along the line never deletes it. Released off the wall it is removed, dropped onto another guide it merges, and `Escape` puts it back. Every finished change, including a double-click removal, is one undo step.
- **Layers:** each guide is drawn twice. A transparent grab strip sits under the items, so pressing furniture still moves the furniture, and the dashed line with its cm tag sits above them so it stays visible. The tag is a handle of its own and moves to the other side of its line near the far edge.
- **Snapping:** guides are added to the magnet's target list as full-length lines, so items and groups snap their edges and centers to them within `1 cm`, with the same half-centimeter guard and `Alt` bypass.
- **Persistence:** guides are part of the project save, history snapshots, and the JSON export. A smaller wall drops the guides that fall off it, and undo brings them back with the old size. Guides are a drafting aid, so the PNG export leaves them out.

### Direct Manipulation
Resizing and catalog drops reuse the drag engine's rules: one `requestAnimationFrame` per frame, pointer positions converted to wall space by dividing by the fit scale, and every result quantized to `1 cm` (or `5 cm` with snapping) before it is clamped.

- **Resize grips:** only the selected, unlocked item carries the `e`, `s`, and `se` grips. A press on a grip stops propagation so it never starts a move. Width is clamped to `[8 cm, wallWidth - left]` and height to `[4 cm, wallHeight - top]`. Each frame updates the inline size, the label position, collisions, rulers, and the Inspector fields without rebuilding the panel. Release commits one undo step if the size changed, and `Escape` restores the starting size.
- **Grip placement:** grips straddle the item edge. Against the wall they would be half clipped, so `.flush-right` and `.flush-bottom` flags tuck them inside the item there. On pieces of `12 x 12 cm` or less, such as a wall socket, straddling grips would cover the whole face, so an `.is-tiny` flag moves them `16 px` out past the edges with a tighter hit area, and a press anywhere on the face moves the piece. At a flush wall edge those outside grips would be clipped, so they step aside there and the Inspector size fields take over.
- **Catalog drops:** a press on a catalog card becomes a drag after `6 px` of travel. A ghost of the piece, drawn at the wall's own scale, follows the cursor and the wall shows a drop outline. A release over the canvas mounts the item centered under the cursor as a single undo step, while a release elsewhere or `Escape` cancels. Clicking a card still mounts it at the cascading default spot.
- **Late timers:** browsers run input ahead of timers, so the deferred resets that swallow stray clicks after a press carry a token. A late timer from an earlier press can no longer clear the guard of the press in progress.

### Selection Model
The selection is an array of item ids, `selectedItemIds`. Every change goes through one `setSelection()` call that syncs the `.selected` classes, the resize grips, the Inspector, the rulers, and the group outline. The single-item editors (size fields, resize grips, backlight switch, per-item color) only appear when exactly one item is selected.

- **Selection box:** a press on bare wall becomes a box after `3 px` of travel. Corners are converted to wall space (divided by the fit scale, minus the border) and clamped to the wall. Each frame tests every item against the box with the same strict AABB check the collision engine uses, and toggles `.selected` live without touching the Inspector. The selection is committed once on release, `Shift` makes the box additive, and `Escape` restores the previous selection.
- **Clicks:** `Shift`-click toggles one item (or one whole group) and never starts a move. A plain press on a member of a multi-selection keeps the selection so it can be dragged, and a release without movement narrows it to that member and its group. A click on bare wall clears the selection, unless `Shift` is held.
- **Group outline and rulers:** a multi-selection is measured as one bounding box. A dashed outline marks it, and the wall and gap rulers measure that box against items outside the selection.

### Rotation Model
`rotation` is stored as `0`, `90`, `180`, or `270`, and `width` / `height` always describe the footprint on the wall. A quarter turn swaps them in the data model, so collisions, the selection box, snapping, rulers, and wall clamping keep working on a plain axis-aligned box with no rotated geometry anywhere.

- **Pivot:** an item turns clockwise about its center. When the center offset lands on a half centimeter, even turns round one way and odd turns the other, so four turns bring a piece back exactly where it started.
- **Fit:** a turned item is clamped back inside the wall. A piece whose swapped footprint would not fit at all (a full-width shelf on a shorter wall) stays as it is, and its Rotate controls are disabled.
- **Minimum sizes:** the `8 cm` minimum width and `4 cm` minimum height belong to the piece, so after a quarter turn they swap sides for resize grips, Inspector fields, and the sanitizer.
- **Selections and groups:** loose selected items each turn in place. A fully selected group turns as one rigid block about its own center: every member's offset inside the box is rotated with it, and the half-centimeter rounding is applied once to the whole box so the group never pulls apart. A locked member, or a box that would not fit the wall once turned, keeps that unit still.
- **Details:** each item carries a `rot-*` class that sets `--up-x`, `--up-y`, and `--turn`. Directional backlights read their offsets from the first two, the spotlight wash rotates with `--turn` about the fixture center, and per-rotation rules move the storage seam and handles and lay the lamp diffuser flat. Labels stay upright.
- **Bill of materials:** a turned shelf is still the same product, so the BOM lists it at its catalog orientation while the drilling table uses the real footprint.

### Room Features
Wall sockets (`8 x 8 cm`), door clearances (`90 x 210 cm`), and windows (`120 x 120 cm`) live in their own catalog group and are modeled as items with a reserved type.

- **Schema:** the sanitizer forces a `0` price, no finish, no backlight, and no per-item color, whatever a file claims. They never reach the budget, the bill of materials, or the drilling table.
- **Collisions:** furniture overlapping a feature turns red and shows a dedicated warning. Features may overlap each other (a socket inside a door frame), and the attic slope never flags them, since doors and windows are cut into the wall itself.
- **Placement:** a new feature joins the bottom of the layer stack, beneath existing furniture.
- **Drawing:** a door clearance is an elevation-style opening with a corner-to-corner cross, a window has a frame and mullions over tinted glass, and a socket shows its faceplate and pins. All of it is plain CSS that the PNG renderer reproduces, and the colors follow Ambient Mode and the Daylight Grid.

### True Grouping
Groups live in the flat item array: members share a `groupId`, which keeps collisions, the selection box, and DOM paint order working on plain items.

- **Contiguity:** members of a group always sit next to each other in the stack, so a group can be shown as one block in the Layers panel and moved as one. `normalizeGroups()` enforces this on every load, import, grouping, removal, and duplicate: scattered members are gathered at the position of the topmost one, and an id left with a single member is dropped.
- **Selecting:** a click, a context-menu target, or a selection box that touches one member expands to the whole group. A double-click (or a member row in the Layers panel) picks a single member, which then moves and edits on its own; `Select Group` in the Inspector widens it again.
- **Grouping:** groups are one level deep, so grouping members of other groups moves them into the new group. Ungrouping dissolves every group the selection touches and keeps all former members selected. Both are single undo steps.
- **Layer moves:** Bring Forward and Send Backward work on whole blocks, so a group is never split. When the selection sits inside one group without covering it, the members reorder among themselves instead.
- **Duplicates:** each copied group becomes a new group of its own copies.

### Layer Explorer
The Layers panel is docked between the scrolling Inspector and the budget, so it stays in view while properties scroll. Rows run top to bottom, the reverse of `wallItems`, and each row is keyed as `item:<id>` or `group:<id>` so clicks, toggles, and drops resolve through one helper.

- **Selection:** clicking a row selects it on the wall (`Shift` adds), and wall selections highlight their rows. Selection changes only flip row classes; the list is rebuilt only when the stack itself changes, never during a drag.
- **Restacking:** rows use native HTML5 drag and drop. A dragged item or group moves as one block among the top-level rows, and while it hovers a member row it is measured against that member's whole group. A member row only moves among its own group's members, and any other drop is refused. Each drop is a single undo step.
- **Visibility and locks:** the eye hides an item or a whole group. Hidden items fade to `opacity: 0`, ignore the pointer, and drop out of collisions, the attic check, rulers, the magnet, the selection box, `Ctrl + A`, and the PNG export. They stay in the plan, the budget, and the spec sheet. The padlock locks an item or a group, with mixed groups locking first.

### Text Notes
A text note is a room feature that never collides: it is free, has no finish or lighting, stays off the spec sheet, and is ignored by collisions and the attic check. Its `text` is cleaned on load (line breaks kept, other control characters removed, `160` characters at most, and an empty note falls back to the prompt).

- **Editing:** a double-click swaps the label for a `<textarea>` with the text selected. Presses inside it place the caret instead of dragging, and its keys never reach the app shortcuts. `Escape`, `Ctrl + Enter`, or clicking away saves, and an unchanged note costs no history step. The Inspector has the same text in a field for keyboard editing.
- **Live elements:** saving only rewrites the label. Because the note's element is never rebuilt, a drag that starts on another item and blurs the editor keeps working on live elements.
- **Export:** the renderer reads the browser's own line breaks back from the rendered label, one character range at a time, and draws each line where the browser placed it, so the PNG wraps exactly like the wall.

### Smart Measurements
Holding `Alt` / `Option` with a selection turns the pointer into a measuring probe. Pointing at any unselected item, or at bare wall, replaces the regular rulers with red distance lines and badges between the selection's bounding box and the hovered box.

- **Rules:** boxes that are apart on an axis get one line across the gap, through their shared span. When they are apart on both axes, each line runs through the selection's center and a dashed extension carries the hovered edge out to it. Boxes that intersect or nest, like an item inside a window or the wall itself, get a line between each pair of matching edges.
- **Cost:** pointer moves are batched into one frame, and the overlay is only rebuilt when one of the two boxes changes. Alt-arrow nudges update the readout live.
- **Scope:** measuring pauses during drags, resizes, and selection boxes, so `Alt` keeps its job of bypassing the magnet mid-drag. Releasing `Alt` brings the regular rulers back.

### Studio Clipboard
`clipboardState` lives in memory and holds deep clones of the copied items, in stacking order, plus a `pasteCount`.

- **Copy and cut:** `Ctrl + C` copies the selection and resets the count. `Ctrl + X` copies and then removes like `Delete`: locked items stay on the wall and selected, and the removal is one undo step. Both leave the browser's own copy alone when page text is selected or a field has focus.
- **Paste:** each paste raises the count and offsets the copies by `4 cm * pasteCount`, so repeated pastes cascade instead of stacking. Copies get fresh ids and start unlocked, and every group with two or more copied members becomes a new group of its own, so pasted groups are independent. The pasted items are selected, and the paste is one undo step.
- **Placement:** pasting shares `placeCopies()` with `Ctrl + D`. The offset is clamped for the whole block so relative spacing survives the wall edges. A multi-item block that would newly cut into the attic slope slides left or down to the nearest clear whole centimeter, while a single copy may land in the slope and is flagged red, like a single dragged item. Pieces copied before the wall shrank are trimmed to fit it.

### Align & Distribute
The batch Inspector shows an `Align & Distribute` grid whenever the selection holds at least two units and one of them can move: the top row works along the width (left, center, right, distribute) and the bottom row along the height.

- **Units:** these are the rotation units. A fully selected group is one rigid block and every other selected item stands alone. Locked units hold still but still count toward the selection box, so they act as anchors.
- **Align:** each movable unit moves to the matching edge or center of the selection's bounding box. A center that lands on a half centimeter is rounded back onto the grid.
- **Distribute:** needs three or more movable units. They are sorted along the axis, the first and last stay put, and the rest get equal gaps between their outer edges. Each position is rounded to whole centimeters, so two gaps differ by a centimeter at most.
- **Attic slope:** moving toward the slope only ever deepens an intrusion, so the clear offsets form one run from zero. A unit whose target would cut into the slope steps back a centimeter at a time to the farthest clear spot, and a status message says how many items were held back.
- **History:** each press is a single undo step. A press that moves nothing records nothing, and the rebuilt Inspector hands keyboard focus back to the same button.

### Coordinate Fields & Wall Centering
The single-item Inspector shows `Left X (cm)` and `Top Y (cm)` beside the size fields, under the unchanged offset readout.

- **Typing:** a committed value (`Enter` or leaving the field) is rounded to whole centimeters and clamped to `[0, wallWidth - width]` or `[0, wallHeight - height]`, and the cleaned value is written back. An empty field falls back to the current offset. The item, its rulers, the ruler band, and the readout update through the same inline-style path a drag uses, and a change is one undo step; an unchanged value records nothing. Locked items show the fields disabled.
- **Live sync:** every drag frame, nudge, and grip resize writes the fields in place, and only when a value or limit changed, so the panel is never rebuilt and a focused field keeps its focus and caret. A grip resize also moves the field limits as the item grows.
- **Center H and Center V:** shown whenever at least one selected unit can move. A single piece lands at `quantize((wall - size) / 2, 1 cm)`, so a half-centimeter center rounds onto the grid. A multi-selection or group moves as one rigid block made of its movable units, locked units staying put, and the block shares `arrangeAlong()` with Align: it stays inside the wall and steps back from the attic slope a centimeter at a time, with the same status message. Each press is one undo step, and a press that moves nothing records nothing.

### Command Palette
`#command-palette` is a native `<dialog>` hung from the upper third of the screen. `Ctrl + K` / `Cmd + K` opens it from anywhere, including a focused Inspector field, and closes it again; it never opens on top of another dialog. The `Ctrl+K` button in the zoom HUD opens it with the mouse, so the full topbar stays untouched.

- **Commands:** the list is rebuilt each time the palette opens, grouped as Selection (only with a selection: center on the wall, duplicate, lock, remove), Mount (one entry per catalog card), Wall & View, Lighting & Paint, and Project & Export. Each entry calls the same function as its button, card, or shortcut, and shows a hint such as the catalog size, a shortcut, or the current on/off state. Wall & View also switches the studio mode and the floor reference. In Creator Mode the list matches what is on screen, so the room-feature mounts, the Power Routing toggle, and Clear Reference Guides drop out.
- **Filtering:** every typed word must appear in the label or the group name, in any order and in any case, so `export png` finds `Export Plan PNG` and `export` alone lists the whole Project & Export group. The first match is highlighted, and a query with no match shows an empty state instead of a blank list.
- **Keyboard and mouse:** `ArrowDown` and `ArrowUp` move the highlight with wrap-around and keep it scrolled into view, `Enter` runs it, and a click runs any row. Hovering moves the highlight, and pressing a row keeps focus in the search field. The palette closes before the command runs, so commands that open a dialog of their own (projects, spec sheet) work straight away.
- **Focus:** opened from bare page, the palette has no control to hand focus back to, so focus is released explicitly on close. Otherwise the hidden search field would keep it and swallow the next shortcut, turning `Ctrl + Z` into a text undo. Every close path (`Escape`, `Ctrl + K`, running a command) blurs the search field synchronously, `Escape` in the same keydown that triggers the native `cancel`, rather than waiting for the queued `close` event. As a second guard, the shortcut filter treats a field inside a closed `<dialog>` as not being typed in, so `Escape` followed at once by `Ctrl + Z` always undoes the last layout action.

### Power Routing Overlay
The `Power Routing` switch in the Lighting panel turns on a live drafting aid. It starts off, is not saved or undone, and, like the rulers and reference guides, never reaches the PNG export.

- **Planning:** every visible lit item (shelf, cube, storage, poster, spotlight, or corner lamp with its backlight on) takes the visible socket with the shortest center-to-center Manhattan distance, `|dx| + |dy|`, rounded to whole centimeters. Ties go to the socket lower in the layer stack, so the choice never flickers during a drag.
- **Drawing:** each run is an SVG path `M item V socketY H socketX`: straight up or down to the socket's height, then along the wall. The paths sit beneath the items, so the stretch inside an item stays hidden and the cable appears where it leaves the bottom or top edge, while the length pills sit above everything on the run's longer leg. Runs over `250 cm` turn orange with an `.is-long-run` class.
- **Summary:** the readout under the switch reads `N powered | Total X.X m | Max YYY cm`, or warns `No wall sockets placed (N powered items)` when lit items have nothing to plug into.
- **Live updates:** renders, drag and nudge frames, grip resizes, and the per-item backlight switch all refresh the overlay, which rebuilds only when a run actually changed, so moving an unrelated item costs a string comparison.

### Studio Modes
`studioMode` is `'engineer'` or `'creator'` and is mirrored as `data-studio-mode` on `body.app-shell`. Like the zoom, it is a view rather than part of the layout: it is never saved, exported, or undone, so every visit opens in Engineer Mode with the full technical interface.

- **Switching:** a segmented `Engineer` / `Creator` control heads the right sidebar, outside the scrolling Inspector, so it never scrolls away. `Alt + M` flips the mode whenever no field or dialog has focus; it reads the physical key, because `Option + M` on a Mac types a character. The command palette lists `View: Switch to Creator Mode` and `View: Switch to Engineer Mode`. A switch waits while any drag, resize, pan, or selection box is in progress.
- **Creator Mode:** one block of CSS under `[data-studio-mode="creator"]` hides the canvas rulers, the reference guides and their grab strips, the cable runs and the Power Routing switch, the Layers panel, the Room Features catalog group, the Inspector's coordinate and size fields, and the offset and footprint readouts. The finish picker, the LED switch and color, Center H and Center V, Rotate, Mirror, Duplicate, Lock, and Remove all stay.
- **Hidden means inactive:** the ruler bands stop pulling out guides and showing the guide cursor, hidden guides stop pulling at the magnet, and the palette leaves out the room-feature mounts, the Power Routing toggle, and Clear Reference Guides. Room features already on the wall stay visible and keep their collision rules.
- **Nothing lost:** Creator Mode only hides elements, so the guides, the layer tree, and every field value wait untouched. Switching back to Engineer Mode shows all of it again without rebuilding the layout.

### Floor Reference
The `Floor Reference` control in the Lighting panel stands a front elevation of a familiar piece of furniture on the floor line, so mounting heights can be judged against something real.

- **Pieces:** `None` is the default. `Bed 155cm` draws a headboard behind a mattress topped at `55 cm`, two pillows, a framed base, and short legs, `155 x 85 cm` overall. `Desk 140cm` draws a desk top at `75 cm` with a drawer and a `60 cm` monitor on a short stand, `115 cm` tall overall. `Sofa 200cm` draws a low backrest between two armrests, three seat cushions topped at `42 cm`, a plinth, and short legs, `200 x 82 cm` overall. The four choices sit two by two, since one row would not fit the sidebar.
- **Alignment:** while a piece is shown, a compact `Left` / `Center` / `Right` row appears under the choices. `Center` is the default and the original centered position. `Left` stands the piece `16 px` in from the left wall edge with `left: 16px` and no transform, and `Right` does the same from the right edge with `right: 16px`. The choice is mirrored as `data-align` on `#floor-backdrop`, survives a change of piece, and resets to center on reload like the piece itself.
- **Drawing:** each silhouette is an inline SVG built from a short list of rectangles and paths in centimeters, scaled by `2.5`, inside `#floor-backdrop`. The container is centered on the wall's bottom edge with `left: 50%`, `bottom: 0`, and `translateX(-50%)`, so it stays centered on any wall size and at any zoom. Blueprint lines and a pale fill come from custom properties with Ambient Mode and Daylight Grid values, and a dimension line with a size tag runs `12 px` above the piece.
- **Out of the way:** the overlay has `pointer-events: none`, so every press reaches the items and the wall behind it, and the sketch never blocks a drag, a click, or a selection box.
- **A view aid:** like the zoom and the cable runs, the floor reference is not part of the layout. It is not saved, undone, shared, or exported, and the PNG renderer leaves it out. The palette offers `Backdrop: None`, `Backdrop: Bed (155 cm)`, `Backdrop: Desk (140 cm)`, and `Backdrop: Sofa (200 cm)`, plus `Backdrop Align: Left`, `Center`, and `Right` while a piece is shown.

### Ergonomic Clearance Advisor
Every non-feature item gets a live `#ergonomic-hint` line under its offset readout, in both studio modes. `describeErgonomics(item)` in `scripts/core/geometry.js` works in whole centimeters from the floor:

```
bottomFromFloorCm = wallHeightCm - toCm(top + height)
centerFromFloorCm = round(wallHeightCm - (top + height / 2) / 2.5)
```

- **Over a floor reference:** when the active bed, desk, or sofa horizontally overlaps the item at its current `Left` / `Center` / `Right` alignment, the hint reads `N cm clear above Bed (center C cm from floor)`, or `Overlaps Bed backdrop by N cm` in amber when the piece reaches down into it.
- **Posters:** a center between `140` and `160 cm` reads `Eye-level gallery zone`; anything else names the center and the ideal range.
- **Other furniture:** `Bottom B cm from floor (center C cm)`.
- **Live:** the hint follows drags, nudges, typed coordinates, resizes, and every change of floor reference or alignment without rebuilding the Inspector.

### Item Style Copy & Paste
`styleClipboard` lives in memory on the shared `state`, like the item clipboard. The Inspector shows a `Copy Style` / `Paste Style` row for a single piece of furniture, and for a batch that holds any.

- **Copy:** `Alt + Shift + C`, the button, or `Copy Item Style` in the palette's Selection group captures `finish`, `ledEnabled`, `itemLedColor`, and `posterArt` from the first piece of furniture in selection order. Room features never take part.
- **Paste:** `Alt + Shift + V`, the button, or `Paste Item Style` applies the style to every unlocked piece of furniture in the selection; the print only reaches posters. Locked items are skipped, a paste that changes nothing records nothing, and anything else is one undo step. `Paste Style` is disabled until something is copied and while every piece of furniture in the selection is locked.
- **Shortcuts:** both keys are read by physical key, like `Alt + M`, and are ignored while typing in a field. The in-app guide documents them below its ten pinned rows.

### Symmetry
`Flip Horizontally` appears in the batch Inspector whenever two or more items are selected and one unit can move, a single complete group included. `Mirror Across Wall` appears for a single item and is disabled while it is locked.

- **Flip:** each movable piece lands at `selectionLeft + selectionRight - (left + width)`. Units are the same as for Align: a group keeps its mirrored shape, and locked units stay put while still counting toward the selection box.
- **Mirror:** a single piece moves to `wallWidth - left - width`, the same spot measured from the other wall. A centered piece is already its own mirror image and records no history step.
- **Orientation:** a horizontal mirror turns a right-facing quarter turn into a left-facing one, so `90` and `270` swap while `0` and `180` stay, and a mirrored spotlight washes the other way.
- **Attic slope:** a unit is flipped inside its own box first and then slides as one block. If its mirrored spot would newly cut into the slope, it steps back toward where it was to the farthest clear whole centimeter, and the status message counts the items held back, exactly as Align does.

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
- **States:** Group needs a selection that is not already one complete group, Ungroup needs a grouped item, Bring Forward and Send Backward disable at the ends of the stack, Rotate disables when nothing selected can turn, Lock flips to Unlock, and Delete disables when every target is locked.
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

### Wall Paint
The five tones live in one table in the engine, each with an Ambient Mode color and a pale Daylight Grid counterpart. Picking a swatch writes `--wall-paint` and `--wall-paint-day` inline on `#wall`, whose background reads them, and the PNG exporter fills its background from the same table, so the screen and the export cannot drift apart. The swatch colors are also set from that table. Charcoal is the original `#1c1f26` wall, so the default look and every layout made before v1.7 are unchanged.

- **Layout, not preference:** unlike the lighting colors, the paint belongs to the layout. It is saved with each project, exported, and every change is an undo step.
- **Templates:** a template replaces the composition (items, wall size, slope, and guides) and keeps the look: the lighting colors and the wall paint. Reset Layout returns to charcoal.

### Interface Design System
The studio chrome is built from a small set of tokens on `:root`: layered obsidian surfaces (`--bg-app`, `--bg-panel`, `--bg-raised`, `--bg-inset`), `1px` hairlines at 7% white paired with a soft inset top highlight, `6px` and `8px` radii, and a single `160ms` ease-out curve for every transition.

- **Topbar:** a `1fr auto 1fr` grid keeps the wall-size control on the same center line as the canvas. When the action cluster outgrows its half on a narrow screen, the grid hands it the extra room instead of letting the controls overlap.
- **Catalog cards:** each card draws a miniature of its piece with CSS gradients keyed off `data-type`, so the catalog needs no images and stays in sync with the item finishes.
- **Controls:** the layout toggles are native checkboxes drawn as small status lights, the finish picker is a segmented control with a swatch bar per finish, the studio mode and floor reference switches sit on an inset track whose pressed segment is raised, and the brightness slider fills its track from `--led-opacity`.
- **Wall parity:** the wall surface, item finishes, and labels are untouched by the theme, and the wall only carries outer shadows, so the PNG export still matches the screen pixel for pixel.

### Collision Math
Items are axis-aligned rectangles, so item-to-item overlap is a standard AABB test. The attic slope is a right triangle with side `S = 225 px` whose diagonal follows `y = x - (wallWidthPx - S)`.

For an axis-aligned box, the top-right corner is always the point that reaches furthest past that line, so testing that single corner is an exact intersection test:

```
itemRight > wallWidthPx - S  &&  item.top < itemRight - (wallWidthPx - S)
```

### Magnetic Alignment & Gap Rulers
During a drag, the item's start, center, and end lines on each axis are compared with the same three lines of every other item, plus the wall's horizontal center and every reference guide. The closest match within `1 cm` wins, provided the item stays inside the wall. A candidate that would need a half-centimeter position is skipped rather than approximated, so a guide line only ever marks an exact alignment. Holding `Alt` / `Option` suspends the magnet.

Gap rulers find the nearest item on each side whose projection overlaps the active item, and measure along the center of that shared overlap. Labels are placed shortest ruler first; any label that would collide slides along its own ruler to the nearest clear spot.

### Undo / Redo History
History is a bounded stack of 30 serialized snapshots covering items (including groups, visibility, note text, poster prints, rotation, backlight, per-item color, lock state, and layer order), wall size, the attic slope, the reference guides, and the wall paint. The selection is not part of history; after an undo it keeps whichever selected items still exist. Lighting colors and brightness are treated as preferences and left out, and the studio mode and floor reference are views, like the zoom.

- Identical consecutive snapshots are dropped.
- A new action after an undo truncates the redo branch.
- Bursts of the same action are coalesced: held arrow-key nudges on one item, or rapid wall-size edits, become a single step.
- A drag commits exactly one snapshot on `mouseup`, and only if something moved. A group drag, a grip resize, and a catalog drop follow the same rule.
- Batch edits (grouping, rotation, align, distribute, wall centering, flip, mirror, finish, poster print, lock, visibility, duplicate, cut, paste, delete, layer moves) and a typed Left X or Top Y are one step each, held nudges on the same selection merge into one, and a color pick is one step however long the picker stays open.
- Opening another project starts a fresh history, the same as a reload.

### Project Gallery & Persistence
Layouts are stored per project instead of as one save.

- **Storage split:** a small index (`spatial_studio_projects_v1`) holds the open project id and each project's `id`, `name`, and `timestamp`. Every layout sits under its own key, so autosave rewrites only the open project, and the brightness slider and drags stay cheap however many projects exist.
- **Migration:** on the first boot after the upgrade, the single save from earlier versions passes through the sanitizer and becomes the `Default Project`, and the old key is removed. Once the gallery exists, a leftover or unreadable old save is simply dropped.
- **Recovery:** the index is validated on load. Malformed or duplicate ids are dropped, names are trimmed and limited to 60 characters, and at most 24 projects are kept. A missing open project falls back to the most recently edited one, and an unreadable layout opens as the starter wall. Every storage call is guarded, so full or blocked storage shows a status message while the planner keeps working in memory.
- **Gallery:** projects are listed most recently edited first, each with a schematic SVG thumbnail drawn from its items on its wall paint, its last edited date, item count, and wall size. `Save as New Project` forks the current wall under a new name, and a blank name becomes `Project N`. Loading a project clears the selection and the history.
- **Share links:** `Copy Share Link` serializes the same payload as the JSON export, UTF-8 encodes it, and writes it as Base64URL into `#plan=`, copying the link with the Clipboard API or a selection fallback inside the dialog. At startup, a `#plan=` hash is decoded, validated through `normalizeLayout()`, and applied, and the hash is cleared with `history.replaceState()` so a reload never applies it twice. A first visit fills the fresh Default Project. Someone with projects already gets the plan as a new `Shared Plan` project, so following a link never overwrites open work, and a full gallery explains why the link was not opened. A broken or truncated link reports `Share link could not be read.` and leaves the saved project in charge. A link pasted into a tab that is already open only changes the hash, so a `hashchange` listener opens it the same way.
- **Rename and delete:** Rename edits the name in place. `Enter` saves, `Escape` cancels without closing the dialog, and clicking away saves. The card is patched rather than re-rendered, so a click that ends a rename still lands on the button it was aimed at. Delete needs a second press within three seconds, and the open project cannot be deleted, so autosave always has a target.

### XSS-Safe JSON Schema Sanitizer
Saved projects, imported files, and starter templates all pass through one `normalizeLayout()` function. Nothing is applied until the whole file validates, so a bad file never leaves a half-loaded wall.

- **Wall:** dimensions are rounded to whole centimeters and clamped to the allowed range. Files from v0.7, which carry no wall size, load on the default `300 x 250 cm` wall.
- **Items:** unknown types are skipped and reported. Invalid finishes, sizes, and prices fall back to catalog values read from the catalog markup itself. Geometry is snapped to whole centimeters and clamped inside the wall. `ledEnabled`, `locked`, and `hidden` only accept real booleans, `itemLedColor` only a 6-digit hex color (stored lowercase) or `null`, `rotation` only a quarter turn (anything else falls back to `0`), and `groupId` only a short run of letters, digits, `-`, and `_`.
- **Names and ids:** names are trimmed, length-limited, and HTML-escaped wherever they are rendered. Valid unique ids are kept; duplicate or malformed ids are regenerated.
- **Poster prints:** `posterArt` only exists on posters and must be `noir`, `bauhaus`, `botanical`, or `horizon`. Anything else, or a file from before v2.2 without it, loads as `noir`. The schema version stays `1.7`, since older readers simply ignore the extra field.
- **Guides and paint:** guides need axis `x` or `y` and a position on the wall. They are rounded to whole centimeters, one per line, and capped at 12, and malformed ids are regenerated. `wallPaint` must be one of the five tones, or it falls back to `charcoal`.
- **Limits:** colors must be 6-digit hex, brightness is clamped to `0-100`, and files over 1 MB or 200 items are rejected.

The export schema is versioned (`"1.7"`, which adds `wallGuides` and `wallPaint`; `1.5` added `groupId`, `hidden`, and the text note, `1.4` added `rotation` and the room features, `1.3` added `itemLedColor`). Files from `0.7` through `1.5` import unchanged: their items load ungrouped, visible, unturned, and on the global lighting colors, on a charcoal wall with no guides.

### Bill of Materials & Drilling Coordinates
The spec sheet groups furniture by type, name, catalog size in cm, finish, and price into a priced bill of materials. Room features are left out of both tables. Every item is also listed left to right with its distance from the left wall, the ceiling, and the floor. Installers measure shelving up from the floor, so the bottom edge is derived as:

```
From Floor = wallHeightCm - topCm - heightCm
```

The same rows feed the modal tables and the `Copy as Markdown` export, which uses the async Clipboard API with a selection-based fallback.

`Export CSV` downloads both tables as one `spatial-studio-specs.csv` file: a short header block, the bill of materials with separate width and height columns, plain two-decimal prices and a total row, then the drilling table.

- **RFC 4180:** lines end in CRLF, and any field holding a comma, quote, or line break is quoted with its quotes doubled.
- **Formula guard:** text that starts with `=`, `+`, `-`, `@`, a tab, or a carriage return gets a leading apostrophe, so a spreadsheet shows it instead of evaluating it. Numbers are left untouched.
- **Encoding:** a UTF-8 byte order mark lets Excel read item names correctly.

Below the two tables, `Hardware & LED Kit Estimate` shows three cards, refreshed each time the sheet opens. They are not part of the Markdown or CSV output.

- **LED strip:** every lit piece adds its strip: the width of a shelf or storage unit (its long catalog side when turned), the perimeter `(width + height) * 2` of a cube or poster, `1.4 m` per corner lamp, and `0.2 m` per spotlight, shown to one decimal.
- **Power draw:** `ceil(meters * 14.4 + litSpotlights * 5)` watts with a `24V PSU` recommendation, or `0 W` when nothing is lit. Lengths stay in whole centimeters, so an exact `36 W` never rounds up to `37 W`.
- **Wall anchors:** `4` per shelf or storage unit, `2` per cube, poster, or spotlight, and `1` wall clip per corner lamp, lit or not.

### HiDPI Canvas 2D PNG Renderer
`Export PNG` draws the wall on an offscreen canvas at `wallWidthPx * 2` by `wallHeightPx * 2` with the native Canvas 2D API. It paints in the same stacking order as the live DOM: the wall paint (or its daylight tone with the grid), attic slope, corner glow, then items in layer order, and finally a dimensions caption. Reference guides, cable runs, the floor reference, and the other drafting overlays are left out.

Item fills, borders, corner radii, drop shadows, glow layers, and pseudo-element transforms are read from each element's computed style, so the PNG always matches the CSS on screen without a second copy of the palette. Shadows are painted in isolation by drawing the shape far off canvas and offsetting only its shadow back into place. Shadow offsets and blur ignore the canvas transform, so they are scaled to device pixels by hand.

### Material Rendering
- **Finishes:** each finish sets four custom properties: a highlight and a shade for a `4px` bevel band at the top and bottom of the face (`--sheen-*`), and two crisp `1px` inset edges (`--edge-*`). The CSS gradient and the canvas gradient are both built from those properties, and the band stays transparent across the middle of the face.
- **Posters:** the border is the frame, the background is the mat, and an `::after` box is the artwork, set back with inset shadows.
- **Poster prints:** `posterArt` is mirrored as `data-art` on the poster. Noir has no rule of its own, so it renders exactly as before. Bauhaus, Botanical, and Horizon give the artwork box a background color plus an inline `100 x 150` SVG at `background-size: cover`. The exporter reads that same computed `background-image` from the `::after` box, decodes it once, and draws it with the same cover math, clipped to the box and under the inset shadows, so the print on the wall and in the PNG cannot drift apart. `exportPng()` is async only to wait for that decode before it paints.
- **Lamp and spotlights:** the lamp's `::after` is an LED diffuser tinted by its `--led-color`. In daylight, or with the backlight off, it falls back to an unlit frosted strip. A spotlight's `::after` is a clipped light wash that fades from its `--led-color`.
- **Exporter:** a list parser reads spread and `inset` from computed `box-shadow` values. Inset shadows are painted by clipping to the shape and offsetting the shadow of a surrounding frame back inside it. The artwork, diffuser, and wash are read from each item's `::after` computed box, opacity, and clip path.
- **Rotation:** a turned spotlight's wash is painted through the same `matrix()` and `transform-origin` the browser resolved for its `::after`, so the canvas applies exactly the rotation the DOM shows. Storage handles are painted side by side from whichever borders the current rotation uses, and the diffuser and socket pins come from their computed boxes.
- **Notes and hidden items:** a note's text is painted line by line from the browser's own wrapping and clipped to the paper, and hidden items are skipped entirely.
- **See-through fills:** room features have translucent backgrounds, so their borders are painted as a ring instead of a full shape underneath, and the door cross and window mullions are drawn from the same custom properties as the CSS.
- **No transitions:** the exported pseudo-elements change instantly, so a snapshot taken right after a mode or LED switch reads the final state.
- **Glow geometry:** the glow layer spans the item's border box, so a framed item's glow starts outside its frame. That is also the shape the exporter uses.

### Accessibility
- The spec sheet, shortcuts guide, project gallery, and command palette are native `<dialog>` elements opened with `showModal()`. Focus moves inside, the page behind becomes inert, `Escape` closes them, and focus returns to the control that opened them. Only one can be open at a time.
- Catalog entries are real buttons, so items can be mounted with `Enter` or `Space`.
- Every button and input has a visible label, `aria-label`, or `title`, and buttons show a keyboard focus ring. Icon-only buttons such as Undo and Redo carry an `aria-label`.
- The restyled toggles are still native checkboxes, so they keep keyboard and screen reader support. Their focus ring wraps the whole chip.
- Transitions and the dialog entrance animation are switched off under `prefers-reduced-motion`.
- Inspector panel rebuilds hand keyboard focus back to the control that triggered them.
- The command palette's search field is a `combobox` that controls a `listbox` of `option` rows in labelled groups. The highlighted row carries `aria-selected="true"` and is announced through `aria-activedescendant`, so focus never leaves the field, and the empty state is a `status` region.
- The Power Routing control is a `role="switch"` button with `aria-checked`, described by its live summary line, and the Left X and Top Y fields are labelled inputs.
- The studio mode, floor reference, floor reference alignment, and poster print controls are labelled `role="group"` sets of buttons with `aria-pressed`, so each announces the current choice and the Inspector gains no extra switch. The floor sketch is `aria-hidden`, since it carries no layout data.
- The context menu uses `role="menu"` with `menuitem` buttons, exposes its shortcuts through `aria-keyshortcuts`, and is fully keyboard operable.
- The compact room feature tiles show short names and carry the full name and size in their `aria-label`.
- The zoom HUD is a labelled `role="group"`: the step buttons carry `aria-label`s, and the percentage button announces itself as a reset with the current level.
- The Align & Distribute grid is a labelled `role="group"` of buttons named by `aria-label` ("Align Left", "Distribute Horizontally"), with a `title` that explains a disabled control. The wall paint swatches are `aria-pressed` toggle buttons named after their tone.
- The canvas rulers are decorative and `aria-hidden`, since the Inspector already reports the selected item's offset. In the project gallery, the rename field is labelled, every card button names its project, and an armed delete button announces itself as a confirmation.
- The Layers panel is a `role="tree"` of `treeitem` rows with `aria-level`, `aria-selected`, and `aria-expanded`. Its eye and padlock are real buttons with `aria-pressed` and labels that name the item, and the note editor and Inspector field are labelled text areas.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Drag item | Move the item, or the whole selection, on the wall (with 1 cm magnetic alignment) |
| Drag on empty wall | Draw a selection box (`Shift` adds to the selection) |
| `Shift` + click | Add or remove an item from the selection |
| `Ctrl + A` / `Cmd + A` | Select every item on the wall |
| Right-click item | Open the item menu |
| `R` | Rotate the selection 90 degrees clockwise |
| `Ctrl + G` / `Cmd + G` | Group the selection |
| `Ctrl + Shift + G` / `Cmd + Shift + G` | Ungroup the selection |
| Double-click item | Pick a single member of a group, or edit a text note |
| Hold `Alt` / `Option` and point at an item or bare wall | Measure from the selection to it |
| Hold `Alt` / `Option` while dragging | Temporarily bypass magnetic alignment guides |
| Drag from the top or left ruler | Pull out a horizontal or vertical reference guide |
| Drag a guide off the wall, or double-click it | Remove the guide |
| Arrow keys | Nudge the selection by 1 cm |
| `Ctrl + Z` / `Cmd + Z` | Undo the last layout action (up to 30 steps) |
| `Ctrl + Y` / `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo a layout action |
| `Ctrl + D` / `Cmd + D` | Duplicate the selection (+4 cm offset) |
| `Ctrl + C` / `Ctrl + X` / `Ctrl + V` | Copy, cut, or paste the selection (each paste lands 4 cm further) |
| `Ctrl + Wheel` | Zoom about the pointer |
| `Ctrl + =` / `Ctrl + -` / `Ctrl + 0` | Zoom in, zoom out, or reset zoom and pan |
| `Space` + drag, or middle-button drag | Pan the view |
| `L` | Lock or unlock the selection's position and properties |
| `Delete` / `Backspace` | Remove the selected unlocked items |
| `Ctrl + K` / `Cmd + K` | Open or close the command palette |
| `Alt + M` / `Option + M` | Switch between Engineer Mode and Creator Mode |
| `Alt + Shift + C` / `Alt + Shift + V` | Copy the selected item's style, or paste it onto the unlocked selection |
| `?` | Toggle the keyboard shortcuts guide |
| `Escape` | Close the open menu or modal, or clear the selection |

Shortcuts are ignored while typing in a field, and the browser's own text undo keeps working inside number inputs. `Escape` also cancels a catalog drag, a grip resize, a guide drag, a pan, or a selection box in progress. The in-app guide keeps its table to the original ten rows and describes the newer gestures underneath it.

## Layout Templates

| Template | Wall | Attic Slope | Composition |
| --- | --- | --- | --- |
| Studio Default | 300 x 250 cm | Off | Black poster frame centered above a walnut floating shelf |
| Gallery & Storage | 320 x 250 cm | Off | Walnut storage unit near the floor, a mirrored pair of poster frames with top-mounted spotlights, a ledge shelf, and a corner floor lamp |
| Attic Corner | 300 x 240 cm | On | Shelving, a modular cube, and lighting tucked beneath the slope with 12-24 cm of clearance |

Every template is collision-free, and loading one is a single undo step that clears the reference guides and keeps your lighting colors and wall paint.

## Running Locally

There is nothing to install or build.

```bash
git clone https://github.com/s7codes/spatial-light-planner.git
cd spatial-light-planner
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Any static server works (VS Code Live Server, `npx serve`, or `npm run serve` on port 4173). Browsers only load ES modules over HTTP, so opening `index.html` straight from disk (`file://`) is no longer enough since v2.1.

## Testing

The end-to-end suite drives the real app in Chromium with [Playwright](https://playwright.dev): 388 tests in 32 spec files, one per feature area.

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
| `grouping-layers` | `Ctrl + G` / `Ctrl + Shift + G`, whole-group selection by click, marquee and `Shift`, double-click to a member, group drag, nudge, duplicate and rigid rotation, block layer moves, menu and Inspector controls, locked members, export, reload and sanitizing; layer list order and collapse, row selection, simulated and real HTML5 drag and drop, eye and padlock on items and groups |
| `text-notes` | $0 note from the catalog, double-click editing with `Escape` and click-away saves, history, empty and unchanged notes, locked notes, Inspector field, no collisions or spec sheet rows, PNG paper and line-wrap parity, import cleaning |
| `canvas-rulers` | Tick and label counts, positions against the fit scale, rebuilt marks after a wall resize, unclipped end labels, pointer hairlines with whole-cm readouts and no DOM rebuild, hiding off the wall and behind dialogs, selection bands, exact drags beneath the rulers |
| `projects` | Default Project on first visit, autosave into the open project, one-time legacy migration, Save as New Project, Load with a fresh history, name cleaning and escaping, in-place rename with `Enter`, `Escape` and click-away, two-step delete, damaged index and layout recovery, the 24-project limit |
| `csv-export` | Filename, byte order mark, exact CRLF payload, rows checked against the on-screen tables, grouped and turned pieces, RFC 4180 quoting read back by a strict parser, formula guard, empty wall, `Downloaded!` label |
| `align-guides-paint` | The Align & Distribute grid and when it shows, all six alignments and both distributions as single undo steps, whole-cm centering and gap rounding, rigid groups, locked anchors, the attic slope stop, ruler bands; pulling guides from both rulers, hidden until on the wall, Escape and off-wall cancels, 5 cm steps, moving, merging, drag-off and double-click removal, items still winning presses over a guide, item and group snapping, export and import sanitizing, reload, wall resize pruning, the 12-guide limit; wall paint swatches, undo, Daylight Grid tones, PNG parity in both modes, per-project persistence, templates and reset |
| `zoom-clipboard-share` | HUD steps, limits and exact reset of the resting geometry, fitted walls, `Ctrl + Wheel` about the pointer, `Space` and middle-button panning with no item drags, selections or deselecting clicks, `Escape` mid-pan; drags with hairline readouts, selection boxes, catalog drops and parked-ruler guide pulls at 150% and panned; copy and cascading pastes, fresh ids, unlocked copies, new independent groups, cut with locked items, edge clamping, the slope slide, field and text-selection guards; Flip Horizontally with rotation swap, rigid groups, locked anchors and the slope stop, Mirror Across Wall and its centered no-op; share links copied, opened in a first-time browser, opened as a new project, opened in place by a hash change, broken and truncated links, and a full gallery |
| `commands-coords-power` | Left X and Top Y fields with wall limits, typed moves with readout, rulers and ruler band, clamping, rounding, empty and unchanged values, single-step undo and redo, live sync through drags, nudges and grip resizes without a rebuild or lost focus, locked items; Center H and Center V for single items with half-centimeter rounding, rigid multi-selection blocks with locked units held, the attic slope stop; the palette from `Ctrl + K`, `Cmd + K` and the HUD, closing paths, no stacking on other dialogs, grouped commands and selection-only entries, word filtering across labels and groups, the empty state, wrap-around arrows with `aria-activedescendant`, hover, click and `Enter`, mounting like a catalog click, commands driving view toggles, paint, guides, selection edits, exports and dialogs, and focus released after a command; the routing switch, the no-socket warning, exact orthogonal paths and Manhattan lengths, live updates through socket drags, nudges, LED switches, rotations and hidden sockets, nearest-socket choice, long-run flags, and a PNG export identical with the overlay on |
| `studio-mode-backdrop` | Engineer Mode on startup with the segmented switch outside the Inspector; Creator Mode hiding rulers, guides, cable runs, layers, room features and coordinate fields while finishes, LED controls, centering and rotation keep working, with the layout and history untouched and a full restore in Engineer Mode; palette and `Alt + M` switching with field and dialog guards; hidden rulers and guides that no longer pull or snap; bed and desk silhouettes standing on the floor line at true size on any wall, presses passing through, no history, payload or PNG change, palette commands and a reset on reload; small-item grips outside the face, center drags that move a socket without resizing it, Inspector and outside-grip resizes, straddling grips on larger pieces, and grips stepping aside at a wall edge |
| `backdrop-poster-art` | `Escape` in the palette followed at once by `Ctrl + Z` undoing reliably over repeated rounds, a shortcut fired at the search field in the same task as the close, `isTextEntry` and closed dialogs, focus released by every close path; the sofa standing on the floor at true size, left, center and right alignment, the row hiding with no piece, palette commands, no history, payload or PNG change, reset on reload; the four poster prints from the Inspector with undo and redo, locked posters and batches, copies, persistence, sanitizing, and PNG pixels matched against the live wall |
| `ergonomics-style-kit` | The ergonomic hint for posters in and out of the eye-level zone, furniture heights, no hint on room features or batches, live updates through typed moves, nudges and drags, bed and sofa clearance and overlap with left, center and right alignment, Creator Mode visibility; Copy Style and Paste Style by button, `Alt + Shift + C` / `V` and the palette, mixed selections skipping locked items and features, single-step undo and redo, disabled states; LED strip, power draw and anchor cards following backlight switches, removals, turned shelves and exact whole-watt results, with the spec tables left in place |
| `modular-architecture` | The single `type="module"` entry and the version badge, all nine modules fetched once as JavaScript with an error-free boot, internals kept off `window` while the console bridge reads live state, dynamic imports returning the entry's own instances, cross-module writes; catalog mounting, snapped drags with rulers, zoom with ruler and band sync, Inspector edits, spec sheet Markdown and CSV, PNG export, entry shortcuts reaching every module, and autosave across a reload |
| `app-shell` | Zero failed requests, favicon, live-tinted logo, shortcuts guide, `Escape`, accessibility audit, topbar centering, responsive layout |

How the suite is built:

- `playwright.config.js` boots `tests/support/static-server.js`, a zero-dependency Node server, so the app is tested over HTTP as it is served in production.
- Every test starts in a fresh browser context with clean storage, and fails on any uncaught exception or console error.
- The group drag, per-item color, and ruler hairline tests tag elements first and check the tags afterwards, which proves those updates write inline styles instead of rebuilding the DOM.
- Storage tests seed `localStorage` the way a returning visitor would have left it, including broken JSON, and reload the app on top of it.
- Helpers read engine state through `page.evaluate` by name. v2.0 exposed those names as classic-script globals; since v2.1 the entry's console bridge republishes the same surface on `window`, so the helpers and specs did not change.
- Gap ruler readouts are compared with an independent implementation across 40 seeded random layouts.
- PNG exports are decoded in the browser and sampled pixel by pixel through a custom `toBeNearColor` matcher.
- Layout checks pass with Inter, DejaVu Sans, Liberation Sans, and FreeSans, so the result does not depend on the fonts installed on the CI runner.

### Continuous Integration

`.github/workflows/e2e.yml` runs the suite on every push to the main branch and on every pull request: Ubuntu, Node 22, and Chromium installed through Playwright. Failed tests are retried once with a trace, and the HTML report is uploaded as a build artifact.

## Project Structure

```
CLAUDE.md                     Context for Claude Code sessions: module map, pinned invariants, test protocol, git rules
index.html                    App shell, catalog, inspector, studio mode switch, canvas rulers, floor reference,
                              dialogs, command palette, context menu, inline SVG brand mark, and favicon
styles/studio-workspace.css   Design tokens, layout, finish themes, lighting layers, rulers, guides, cable runs,
                              floor references, Creator Mode rules, dialogs, the command palette, and the
                              project gallery
scripts/planner-engine.js     ES module entry: pointer interactions (item drag, grip resize, catalog drag and drop,
                              selection box), keyboard shortcuts, event binding, console bridge, and startup
scripts/core/constants.js     Constants, catalog tables, templates, floor references, and pure helpers
scripts/core/dom.js           Static element references and DOM lookups
scripts/core/state.js         Shared state object, ids, selection and groups, sanitizer, storage, undo / redo
scripts/core/geometry.js      Collisions, alignment and gap solvers, measuring, power routing, transform math
scripts/ui/viewport-rulers.js Zoom and pan, rulers, guides, overlays, studio modes, paint and lighting
scripts/ui/inspector-layers.js
                              Rendering, selection actions, notes, Layer Explorer, Inspector, context menu, palette
scripts/io/export-png.js      HiDPI Canvas 2D PNG renderer
scripts/io/projects-spec.js   Projects, share links, JSON import / export, templates, spec sheet, shortcuts dialog
tests/*.spec.js               Playwright end-to-end specs, one per feature area
tests/support/                Fixtures, shared helpers, and the zero-dependency static server
playwright.config.js          Chromium project, local web server, and CI reporters
.github/workflows/e2e.yml     Runs the suite on every push and pull request
```

## Browser Support

Current versions of Chrome, Edge, Firefox, and Safari (15.4 or later, for the native `<dialog>` element). A few accent tints use `color-mix()` inside an `@supports` block, so older engines show the same layout with fixed tints of the default accent. The automated suite runs in Chromium.

## License

Released under the [MIT License](LICENSE).
