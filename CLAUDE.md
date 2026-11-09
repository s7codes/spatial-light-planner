# CLAUDE.md

Context for Claude Code sessions on Spatial & Ambient Light Planner, a vanilla HTML/CSS/JS (ES2020) wall layout
and ambient lighting planner. No framework, no bundler, no build step. Playwright is the only dev dependency.
Current milestone: v2.3 (388 Playwright tests in 32 spec files).

## Scale and geometry

- `1 cm = 2.5 px`. The default wall is `300 x 250 cm`, rendered at `750 x 625 px` with `box-sizing: content-box`.
- Item geometry is stored in wall px but always on whole centimeters (multiples of `2.5`).
- Drags, resizes, pans and guide pulls record the pointer on `mousemove` and apply it in one
  `requestAnimationFrame` callback with inline styles. Never rebuild the item DOM mid-drag.

## Module map

`index.html` loads one entry, `scripts/planner-engine.js`, with `<script type="module">`.

| Path | Owns |
| --- | --- |
| `scripts/core/constants.js` | Scale, limits, storage keys, catalog tables, templates, floor backdrops, poster prints, pure helpers (`isTextEntry`, `clamp`, CSV). Imports nothing. |
| `scripts/core/dom.js` | Static element references, `isModalOpen`, `getItemElement`, catalog fallbacks. |
| `scripts/core/state.js` | The shared `state` object, idle factories, ids, selection and groups, `styleClipboard` and style capture / apply, `sanitizeItem` / `normalizeLayout`, storage, undo / redo. |
| `scripts/core/geometry.js` | Collisions, attic slope, magnet and gap solvers, measuring, power routing, rotate / arrange / mirror math, `describeErgonomics` and floor backdrop spans. |
| `scripts/ui/viewport-rulers.js` | Wall fit, zoom and pan, rulers, guides, overlays, floor backdrops, studio modes, paint and lighting. |
| `scripts/ui/inspector-layers.js` | `renderPlanner`, selection actions, Inspector, Layers panel, context menu, command palette. |
| `scripts/io/export-png.js` | 2x Canvas 2D PNG renderer that reads computed styles. |
| `scripts/io/projects-spec.js` | Projects and autosave, share links, JSON import / export, templates, spec sheet with the hardware and LED kit estimate, shortcuts dialog. |
| `scripts/planner-engine.js` | Entry: pointer interactions, keyboard shortcuts, console bridge on `window`, startup. |

Rules: no writes to imported bindings (shared mutable state lives on `state`), no top-level reads of imported
values, and edit only the modules a task needs.

## Pinned DOM and test invariants

- Root shell: `<body class="app-shell" data-studio-mode="engineer|creator">`.
- Version badge `<span class="badge">vX.Y</span>` is asserted in `tests/placement.spec.js` and
  `tests/modular-architecture.spec.js`. `EXPORT_VERSION` stays `'1.7'`.
- `.topbar` (1600px) and `.sidebar.catalog` (1400 x 820 in Engineer Mode) are full: never add elements to the
  topbar or grow the Engineer catalog.
- The Inspector scroll container is `.inspector-content` (a class). `tests/app-shell.spec.js` scopes
  `getByRole('switch')` to it, so new Inspector toggles are `aria-pressed` segmented buttons, never `role="switch"`.
- `#context-menu` rows and the 10 rows of `.shortcut-table` in `#shortcuts-modal` are pinned. Document new
  shortcuts in `.shortcut-note` below the table.
- Canvas rulers keep `pointer-events: none`. `#floor-backdrop` keeps `pointer-events: none`.
- `#inspector-pos-readout` reads `XX cm (X), YY cm (Y)`.
- Guide grab strips use `.guide-hit`. Items up to `12 x 12 cm` use `.is-tiny` with external resize handles.
- Noir posters (`posterArt: 'noir'`) must render and export exactly as before; prints only add `data-art` rules.
- Floor backdrops and their alignment are view state: never saved, undone, shared or exported.
- `#command-palette` "Wall & View" commands are pinned by `tests/studio-mode-backdrop.spec.js`; selection commands
  (including `Copy Item Style` / `Paste Item Style`) go in "Selection", after the first five pinned entries.
- In `#spec-modal`, `#bom-body`, `#bom-foot`, `#mounting-body`, the Markdown copy and the CSV export are pinned.
  `#hardware-kit-section` (`#kit-led-strip`, `#kit-power-draw`, `#kit-wall-anchors`) sits below them and stays out of
  both exports.
- `#ergonomic-hint` shows for every non-feature single selection in both studio modes and is synced in
  `updateInspectorLive()`; the backdrop setters call it too.

## Fast test protocol

```bash
npx playwright test tests/<new>.spec.js tests/placement.spec.js tests/app-shell.spec.js
```

Run only the new spec plus those two while developing. Run the full suite (`npm test`) once at the end. Skip
multi-font and 3x stress runs unless `.topbar` or `.sidebar.catalog` geometry changed.

## Style

- Plain ASCII only: no emojis, no em-dashes, no multiplication signs. Write sizes as `300 x 250 cm`.
- Comments are short and only explain non-obvious math or edge-case guards. No section banners.

## Git (Windows PowerShell)

Give each command on its own single line, with no backslash continuations:

```powershell
git add <files>
git commit -m "vX.Y: short summary"
git push
```

Never use `--trailer`, `Co-Authored-By`, "Generated with Claude", or session or artifact links in commit messages.
