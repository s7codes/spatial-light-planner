import {
    ATTIC_SIZE_LIMITS_CM, CATALOG_DRAG_THRESHOLD_PX, clamp, CM_STEP_PX, csvField, DEFAULT_NOTE_TEXT, DEFAULT_POSTER_ART, escapeHtml,
    FEATURE_TYPES, getBounds, isFormField, isTextEntry, ITEM_DEPTH_CM, MARQUEE_THRESHOLD_PX, minSizeCm, NUDGE_KEYS, OBSTACLE_TYPES,
    PRESS_TRAVEL_PX, quantize, SCALE, SNAP_STEP_PX, toCm, WALL_BORDER_PX, WALL_HEIGHT_LIMITS_CM, WALL_WIDTH_LIMITS_CM
} from './core/constants.js';
import {
    accentColorPicker, alignLayer, atticHeightInput, atticSlopeToggle, atticWidthInput, atticZone, brightnessSlider, canvasArea, catalogItems,
    commandPalette, cornerColorPicker, enterStudioBtn, exportPngBtn, splashScreen, getItemElement, ioStatus, isModalOpen, isSplashShown, marqueeBox,
    newProjectName, preview3dModal, redoBtn, resetWallBtn, rulers, rulerX, scaleNote, selectionBounds, shortcutsModal,
    snapGridToggle, specModal, undoBtn, wallCanvas, wallHeightInput, wallItemsLayer, wallWidthInput
} from './core/dom.js';
import {
    commitLayoutChange, createIdleCatalogDrag, createIdleDragState, createIdleMarquee, createIdleResizeState,
    createItemId, expandGroups, getSelectedItem, getSelectedItems, isCreatorMode, isPointerBusy, isSelected,
    pushHistory, redo, state, undo
} from './core/state.js';
import {
    collectAlignLines, getAlignTargets, hasOverlap, intrudesAtticSlope, isOverlapping, nudgeSelection,
    renderAlignGuides, snapAxis, updateCollisionStates
} from './core/geometry.js';
import {
    applyAtticSlope, applyPanFrame, bindViewportEvents, cancelGuideDrag, cancelPan, endPan, finishGuideDrag, measure,
    measureLabelMetrics, pruneGuides, refreshMeasure, renderGuides, resetView, rulerBands, scheduleGuideFrame,
    isTapeMeasuring, setRuler, setSpaceHeld, setStudioMode, setTapeMeasure, setWallDimensions, stepZoom, toggleTapeMeasure
} from './ui/viewport-rulers.js';
import {
    bindInspectorEvents, closeContextMenu, copySelectedStyle, copySelection, cutSelection, duplicateSelectedItem,
    flashLockNote, groupSelection, handleContextMenuKey, isContextMenuOpen, moveSelectedLayerToEdge, pasteClipboard,
    pasteStyleToSelection,
    removeSelectedItems, renderPlanner, restoreCurrency,
    rotateSelection, selectAll, selectItem, selectWithGroups, setSelection, syncItemSize, syncPositions,
    toggleCommandPalette, toggleInSelection, toggleSelectedLock, ungroupSelection, updateInspectorPanel
} from './ui/inspector-layers.js';
import { currentBrandStamp, exportPng } from './io/export-png.js';
import { bindPreview3dEvents, buildSceneObj, togglePreview3d } from './ui/preview-3d.js';
import {
    applyDefaultLayout, bindProjectSpecEvents, importLayoutText, layoutPayload, loadState, openShortcuts,
    openSpecSheet, saveState
} from './io/projects-spec.js';

let ignoreWallClick = false;
let wallClickGuard = 0;
let suppressAltMenu = false;
let suppressCatalogClick = false;
let catalogClickGuard = 0;

// :focus-visible cannot tell the two apart here, since any key press makes a clicked button match it
let focusFromPointer = false;

// Items larger than a shrunken wall are cut down to fit, then everything is pushed back inside
function clampItemsToWall() {
    state.wallItems.forEach(item => {
        item.width = Math.min(item.width, state.wallWidthPx);
        item.height = Math.min(item.height, state.wallHeightPx);
        item.left = clamp(item.left, 0, state.wallWidthPx - item.width);
        item.top = clamp(item.top, 0, state.wallHeightPx - item.height);
    });
}

// A press that starts on an item, dragged or not, can end with the cursor off the item.
// The click that follows would land on the wall and deselect, so it is swallowed.
// Browsers run input ahead of timers, so the token stops a late timer from an earlier press
// clearing the guard of the press in progress.
export function guardNextWallClick() {
    const token = ++wallClickGuard;
    ignoreWallClick = true;
    window.addEventListener('mouseup', () => setTimeout(() => {
        if (token === wallClickGuard) ignoreWallClick = false;
    }, 0), { once: true });
}

export function startResize(e) {
    if (e.button !== 0) return;
    // The grip sits inside the item, so the press must not reach the item and start a move
    e.stopPropagation();
    e.preventDefault();
    guardNextWallClick();

    const handle = e.currentTarget;
    const el = handle.closest('.wall-item');
    const item = el && state.wallItems.find(i => i.id === el.dataset.id);
    if (!item || item.locked || isPointerBusy()) return;

    const wallRect = wallCanvas.getBoundingClientRect();
    state.resizeState = {
        ...createIdleResizeState(),
        active: true,
        itemId: item.id,
        element: el,
        handle: handle.dataset.handle,
        wallRect,
        scale: state.viewScale,
        startLocalX: (e.clientX - wallRect.left) / state.viewScale,
        startLocalY: (e.clientY - wallRect.top) / state.viewScale,
        pointerX: e.clientX,
        pointerY: e.clientY,
        startWidth: item.width,
        startHeight: item.height
    };

    handle.classList.add('is-active');
    document.body.classList.add(`is-resizing-${state.resizeState.handle}`);
    refreshMeasure();
}

function applyResizeFrame() {
    state.resizeState.frameId = 0;

    const item = state.wallItems.find(i => i.id === state.resizeState.itemId);
    if (!item) return;

    const { wallRect, scale, pointerX, pointerY, startLocalX, startLocalY, startWidth, startHeight, handle } = state.resizeState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;
    const [minWidthCm, minHeightCm] = minSizeCm(item.rotation);

    // Wall-space pointer travel, so the grip tracks the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    if (handle !== 's') {
        item.width = clamp(quantize(startWidth + localX - startLocalX, step), minWidthCm * SCALE, state.wallWidthPx - item.left);
    }
    if (handle !== 'e') {
        item.height = clamp(quantize(startHeight + localY - startLocalY, step), minHeightCm * SCALE, state.wallHeightPx - item.top);
    }

    syncItemSize(item, state.resizeState.element);
}

function scheduleResizeFrame() {
    if (state.resizeState.active && !state.resizeState.frameId) {
        state.resizeState.frameId = requestAnimationFrame(applyResizeFrame);
    }
}

function endResize() {
    if (state.resizeState.frameId) cancelAnimationFrame(state.resizeState.frameId);
    state.resizeState.element.querySelector('.resize-handle.is-active')?.classList.remove('is-active');
    document.body.classList.remove(`is-resizing-${state.resizeState.handle}`);
    state.resizeState = createIdleResizeState();
    updateCollisionStates();
}

function finishResize() {
    if (state.resizeState.frameId) {
        cancelAnimationFrame(state.resizeState.frameId);
        applyResizeFrame();
    }

    const item = state.wallItems.find(i => i.id === state.resizeState.itemId);
    const changed = item && (item.width !== state.resizeState.startWidth || item.height !== state.resizeState.startHeight);
    endResize();

    if (changed) {
        commitLayoutChange();
        updateInspectorPanel();
    }
}

// Escape puts the item back exactly as it was when the grip was pressed
function cancelResize() {
    const item = state.wallItems.find(i => i.id === state.resizeState.itemId);
    const el = state.resizeState.element;
    if (item) {
        item.width = state.resizeState.startWidth;
        item.height = state.resizeState.startHeight;
    }
    endResize();
    if (item && el) syncItemSize(item, el);
}

export function startDrag(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    guardNextWallClick();

    const el = e.currentTarget;
    const item = state.wallItems.find(i => i.id === el.dataset.id);
    if (!item) return;

    if (e.shiftKey) {
        toggleInSelection(item.id);
        return;
    }

    // Pressing a member of a multi-selection keeps it so the whole set can be dragged. Anything else
    // selects the pressed item together with its group, unless it was already picked on its own.
    const group = state.selectedItemIds.length > 1 && isSelected(item.id);
    if (!group && !isSelected(item.id)) selectWithGroups(item.id);

    const members = getSelectedItems();
    const blocked = members.some(member => member.locked);

    // Locked items can still be selected, they just never start a drag
    if (blocked) flashLockNote();
    if (blocked && !group) return;

    // The page never scrolls, so one layout read at drag start is enough unless the window resizes
    const wallRect = wallCanvas.getBoundingClientRect();
    const bounds = members.length === 1 ? { ...members[0] } : getBounds(members);

    state.dragState = {
        ...createIdleDragState(),
        isDragging: true,
        itemId: item.id,
        members: members.map(member => ({
            item: member,
            element: getItemElement(member.id),
            startLeft: member.left,
            startTop: member.top,
            // Members already inside the slope may move out of it; only new intrusions block a group
            clearOfSlope: !intrudesAtticSlope(member)
        })),
        excludedIds: new Set(members.map(member => member.id)),
        bounds,
        group,
        blocked,
        wallRect,
        scale: state.viewScale,
        offsetX: (e.clientX - wallRect.left) / state.viewScale - bounds.left,
        offsetY: (e.clientY - wallRect.top) / state.viewScale - bounds.top,
        pointerX: e.clientX,
        pointerY: e.clientY,
        pressX: e.clientX,
        pressY: e.clientY,
        startLeft: bounds.left,
        startTop: bounds.top,
        altKey: e.altKey
    };

    if (e.altKey) suppressAltMenu = true;
    if (!blocked) state.dragState.members.forEach(({ element }) => element?.classList.add('dragging'));
    refreshMeasure();
}

function groupFitsAt(dx, dy) {
    return state.dragState.members.every(({ item, startLeft, startTop, clearOfSlope }) =>
        !clearOfSlope || !intrudesAtticSlope({ ...item, left: startLeft + dx, top: startTop + dy }));
}

// A group moves as one rigid block. When the wanted spot pushes a member into the slope, the block
// slides along whichever axis is still free, and otherwise holds its last valid position.
function resolveGroupOffset(dx, dy) {
    const lastDx = state.dragState.bounds.left - state.dragState.startLeft;
    const lastDy = state.dragState.bounds.top - state.dragState.startTop;
    const candidates = [[dx, dy], [dx, lastDy], [lastDx, dy]];
    return candidates.find(([cx, cy]) => groupFitsAt(cx, cy)) || [lastDx, lastDy];
}

function applyDragFrame() {
    state.dragState.frameId = 0;
    if (state.dragState.blocked) return;

    const { wallRect, scale, pointerX, pointerY, offsetX, offsetY, members, excludedIds } = state.dragState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;
    const box = { ...state.dragState.bounds };

    // Screen deltas are divided by the view scale so the item stays under the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    // Clamping the bounding box keeps every member inside the wall without bending the group
    box.left = clamp(quantize(localX - offsetX, step), 0, state.wallWidthPx - box.width);
    box.top = clamp(quantize(localY - offsetY, step), 0, state.wallHeightPx - box.height);

    const xTargets = state.dragState.altKey ? [] : getAlignTargets(excludedIds, 'x');
    const yTargets = state.dragState.altKey ? [] : getAlignTargets(excludedIds, 'y');
    box.left = snapAxis(box, 'x', box.left, xTargets);
    box.top = snapAxis(box, 'y', box.top, yTargets);

    let dx = box.left - state.dragState.startLeft;
    let dy = box.top - state.dragState.startTop;
    if (members.length > 1) {
        [dx, dy] = resolveGroupOffset(dx, dy);
        box.left = state.dragState.startLeft + dx;
        box.top = state.dragState.startTop + dy;
    }

    members.forEach(member => {
        member.item.left = member.startLeft + dx;
        member.item.top = member.startTop + dy;
    });
    state.dragState.bounds = box;

    syncPositions(members);
    renderAlignGuides([...collectAlignLines(box, 'x', xTargets), ...collectAlignLines(box, 'y', yTargets)]);
}

// High polling-rate mice fire several events per frame; only the latest one matters
function scheduleDragFrame() {
    if (state.dragState.isDragging && !state.dragState.frameId) {
        state.dragState.frameId = requestAnimationFrame(applyDragFrame);
    }
}

// The border scales with the wall, so it comes off after converting to wall space
function toWallPoint(clientX, clientY, wallRect, scale) {
    return {
        x: clamp((clientX - wallRect.left) / scale - WALL_BORDER_PX, 0, state.wallWidthPx),
        y: clamp((clientY - wallRect.top) / scale - WALL_BORDER_PX, 0, state.wallHeightPx)
    };
}

function trackMarquee(e) {
    state.marquee.pointerX = e.clientX;
    state.marquee.pointerY = e.clientY;

    if (!state.marquee.active) {
        if (Math.hypot(e.clientX - state.marquee.pressX, e.clientY - state.marquee.pressY) <= MARQUEE_THRESHOLD_PX) return;
        startMarquee();
    }

    if (!state.marquee.frameId) state.marquee.frameId = requestAnimationFrame(applyMarqueeFrame);
}

function startMarquee() {
    state.marquee.active = true;
    state.marquee.elements = [...wallItemsLayer.querySelectorAll('.wall-item')];
    // The release can land on an item or the wall; either way its click belongs to the box
    guardNextWallClick();

    // Grips, rulers and the group outline describe the old selection, so they step aside until the release
    wallItemsLayer.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
    Object.values(rulers).forEach(ruler => setRuler(ruler, null));
    selectionBounds.hidden = true;
    marqueeBox.hidden = false;
    document.body.classList.add('is-selecting');
    refreshMeasure();
}

// Hits use the same AABB test as collisions, so touching an item edge does not count as crossing it
function applyMarqueeFrame() {
    state.marquee.frameId = 0;

    const { wallRect, scale, originX, originY, pointerX, pointerY } = state.marquee;
    const point = toWallPoint(pointerX, pointerY, wallRect, scale);
    const box = {
        left: Math.min(originX, point.x),
        top: Math.min(originY, point.y),
        width: Math.abs(point.x - originX),
        height: Math.abs(point.y - originY)
    };

    marqueeBox.style.left = `${box.left}px`;
    marqueeBox.style.top = `${box.top}px`;
    marqueeBox.style.width = `${box.width}px`;
    marqueeBox.style.height = `${box.height}px`;

    // Touching one member of a group catches the whole group; hidden items cannot be caught
    const hits = state.wallItems.filter(item => !item.hidden && isOverlapping(box, item)).map(item => item.id);
    const ids = new Set([...state.marquee.baseIds, ...expandGroups(hits)]);
    state.marquee.hitIds = [...ids];
    state.marquee.elements.forEach(el => el.classList.toggle('selected', ids.has(el.dataset.id)));
}

function endMarquee() {
    if (state.marquee.frameId) cancelAnimationFrame(state.marquee.frameId);
    marqueeBox.hidden = true;
    document.body.classList.remove('is-selecting');
    state.marquee = createIdleMarquee();
}

// Escape or a lost window puts the selection back as it was before the box was drawn
function cancelMarquee() {
    endMarquee();
    setSelection(state.selectedItemIds);
}

function mountCatalogItem(catalogEl, left, top) {
    const newItem = {
        id: createItemId(),
        type: catalogEl.dataset.type,
        name: catalogEl.dataset.name,
        price: parseFloat(catalogEl.dataset.price),
        left,
        top,
        width: parseFloat(catalogEl.dataset.width),
        height: parseFloat(catalogEl.dataset.height),
        depth: ITEM_DEPTH_CM[catalogEl.dataset.type] ?? 0,
        finish: catalogEl.dataset.finish || null,
        ledEnabled: !FEATURE_TYPES.includes(catalogEl.dataset.type),
        locked: false,
        itemLedColor: null,
        rotation: 0,
        groupId: null,
        hidden: false,
        ...(catalogEl.dataset.type === 'note' && { text: DEFAULT_NOTE_TEXT }),
        ...(catalogEl.dataset.type === 'poster' && { posterArt: DEFAULT_POSTER_ART })
    };

    // Doors, windows and sockets belong to the wall itself, so they start beneath the furniture
    if (OBSTACLE_TYPES.includes(newItem.type)) state.wallItems.unshift(newItem);
    else state.wallItems.push(newItem);
    state.selectedItemIds = [newItem.id];
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

export function spawnFromCatalog(catalogEl) {
    const offset = (state.wallItems.length * 20) % 160;
    const width = parseFloat(catalogEl.dataset.width);
    const height = parseFloat(catalogEl.dataset.height);

    // The cascade offset alone can push tall pieces past the floor line
    mountCatalogItem(catalogEl, clamp(200 + offset, 0, state.wallWidthPx - width), clamp(220 + offset, 0, state.wallHeightPx - height));
}

const pointInRect = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

function startCatalogDrag() {
    const { source } = state.catalogDrag;
    const width = parseFloat(source.dataset.width);
    const height = parseFloat(source.dataset.height);

    const ghost = document.createElement('div');
    ghost.className = 'catalog-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    ghost.innerHTML = `
        <div class="wall-item ${source.dataset.type} ${source.dataset.finish ? `finish-${source.dataset.finish}` : 'feature'} rot-0" style="width: ${width}px; height: ${height}px;">
            <span class="item-label">${escapeHtml(source.dataset.name)}</span>
        </div>`;
    document.body.appendChild(ghost);

    state.catalogDrag.active = true;
    state.catalogDrag.ghost = ghost;
    state.catalogDrag.canvasRect = canvasArea.getBoundingClientRect();
    document.body.classList.add('is-placing');

    // A release over the card itself would still fire its click; that click belongs to the drag.
    // The token keeps a late timer from an earlier drag from lifting this one early.
    const token = ++catalogClickGuard;
    suppressCatalogClick = true;
    window.addEventListener('mouseup', () => setTimeout(() => {
        if (token === catalogClickGuard) suppressCatalogClick = false;
    }, 0), { once: true });
}

function trackCatalogDrag(e) {
    state.catalogDrag.pointerX = e.clientX;
    state.catalogDrag.pointerY = e.clientY;

    if (!state.catalogDrag.active) {
        const travel = Math.hypot(e.clientX - state.catalogDrag.startX, e.clientY - state.catalogDrag.startY);
        if (travel <= CATALOG_DRAG_THRESHOLD_PX) return;
        startCatalogDrag();
    }

    if (!state.catalogDrag.frameId) state.catalogDrag.frameId = requestAnimationFrame(applyCatalogDragFrame);
}

// The ghost is centered on the cursor and scaled like the wall, previewing exactly where the drop lands
function applyCatalogDragFrame() {
    state.catalogDrag.frameId = 0;
    const { ghost, source, pointerX, pointerY, canvasRect } = state.catalogDrag;
    if (!ghost) return;

    const width = parseFloat(source.dataset.width) * state.viewScale;
    const height = parseFloat(source.dataset.height) * state.viewScale;
    const overCanvas = pointInRect(canvasRect, pointerX, pointerY);

    ghost.style.transform = `translate(${pointerX - width / 2}px, ${pointerY - height / 2}px) scale(${state.viewScale})`;
    ghost.classList.toggle('is-over-wall', overCanvas);
    wallCanvas.classList.toggle('drop-target', overCanvas);
}

function endCatalogDrag() {
    if (state.catalogDrag.frameId) cancelAnimationFrame(state.catalogDrag.frameId);
    state.catalogDrag.ghost?.remove();
    document.body.classList.remove('is-placing');
    wallCanvas.classList.remove('drop-target');
    state.catalogDrag = createIdleCatalogDrag();
}

function dropCatalogItem(catalogEl, clientX, clientY) {
    const wallRect = wallCanvas.getBoundingClientRect();
    const width = parseFloat(catalogEl.dataset.width);
    const height = parseFloat(catalogEl.dataset.height);
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;

    // The border scales with the wall, so it comes off after converting to wall space
    const localX = (clientX - wallRect.left) / state.viewScale - WALL_BORDER_PX;
    const localY = (clientY - wallRect.top) / state.viewScale - WALL_BORDER_PX;

    mountCatalogItem(
        catalogEl,
        clamp(quantize(localX - width / 2, step), 0, state.wallWidthPx - width),
        clamp(quantize(localY - height / 2, step), 0, state.wallHeightPx - height)
    );
}

// Plain L and R lock and rotate; with Ctrl or Cmd they stay with the browser (address bar, reload)
const isPlainItemShortcut = (e, key) =>
    (e.key || '').toLowerCase() === key &&
    !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat &&
    state.selectedItemIds.length > 0 && !isPointerBusy() && !isTextEntry(e.target);

const isLayerEdgeShortcut = (e) =>
    (e.key === ']' || e.key === '[') && e.ctrlKey === e.altKey && !e.metaKey &&
    state.selectedItemIds.length > 0 && !isPointerBusy() && !isTextEntry(e.target);

function handleModifierShortcut(e) {
    if (isTextEntry(e.target)) return false;

    const key = e.key.toLowerCase();

    if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return true;
    }

    if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
        return true;
    }

    if (key === 'd' && state.selectedItemIds.length) {
        // Stops the browser bookmark dialog; holding the keys should not spawn a stack of copies
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) duplicateSelectedItem();
        return true;
    }

    // Ctrl+G is the browser's find-next, so it is taken over even when there is nothing to group
    if (key === 'g') {
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) {
            if (e.shiftKey) ungroupSelection();
            else groupSelection();
        }
        return true;
    }

    // Ctrl+A would otherwise select the page text around the wall
    if (key === 'a' && !e.shiftKey) {
        e.preventDefault();
        if (!isPointerBusy()) selectAll();
        return true;
    }

    // Selected page text keeps the browser's own copy and cut
    if ((key === 'c' || key === 'x') && !e.shiftKey && state.selectedItemIds.length && !hasTextSelection()) {
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) (key === 'c' ? copySelection : cutSelection)();
        return true;
    }

    if (key === 'v' && !e.shiftKey && state.clipboardState.items.length) {
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) pasteClipboard();
        return true;
    }

    // The browser's page zoom is taken over, so the shortcuts zoom the wall instead of the whole app
    if (['=', '+', '-', '_', '0'].includes(key) || ['NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(e.code)) {
        e.preventDefault();
        if (key === '0' || e.code === 'Numpad0') resetView();
        else stepZoom(key === '-' || key === '_' || e.code === 'NumpadSubtract' ? -1 : 1);
        return true;
    }

    return false;
}

function hasTextSelection() {
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

// Arrow keys for 1cm nudging, Delete/Backspace to remove
function handleItemKeys(e) {
    if (!state.selectedItemIds.length || isPointerBusy()) return;
    if (e.target.tagName === 'INPUT') return; // Do not trigger while typing numbers in inputs

    const items = getSelectedItems();
    if (!items.length) return;

    const isRemoval = e.key === 'Delete' || e.key === 'Backspace';
    const nudge = NUDGE_KEYS[e.key];
    if (!isRemoval && !nudge) return;
    e.preventDefault();

    // Removal skips locked members, but a single locked member is enough to hold a group in place
    const locked = isRemoval ? items.every(item => item.locked) : items.some(item => item.locked);
    if (locked) {
        flashLockNote();
        return;
    }

    if (isRemoval) {
        removeSelectedItems();
        return;
    }

    const [dx, dy] = nudge;
    if (items.length === 1) {
        // Step from the nearest whole cm so older off-grid positions land back on it
        const [item] = items;
        if (dx) item.left = clamp((toCm(item.left) + dx) * SCALE, 0, state.wallWidthPx - item.width);
        if (dy) item.top = clamp((toCm(item.top) + dy) * SCALE, 0, state.wallHeightPx - item.height);
    } else if (!nudgeSelection(items, dx, dy)) {
        return;
    }

    syncPositions(items.map(item => ({ item, element: getItemElement(item.id) })));
    pushHistory(`nudge:${state.selectedItemIds.join(',')}`);
    saveState();
}

// ? toggles the guide but never stacks it on top of the spec sheet
function handleShortcutsKey(e) {
    if (shortcutsModal.open) {
        e.preventDefault();
        shortcutsModal.close();
    } else if (!specModal.open && !isPointerBusy()) {
        e.preventDefault();
        openShortcuts();
    }
}

// Dialogs close themselves on Escape; with none open it clears the selection, unless a field is being edited
function handleEscape(e) {
    if (!state.selectedItemIds.length || isPointerBusy() || isTextEntry(e.target)) return;
    selectItem(null);
}

function readWallInput(input, [min, max], current) {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value) ? clamp(value, min, max) : current;
}

function handleWallResize() {
    const widthCm = readWallInput(wallWidthInput, WALL_WIDTH_LIMITS_CM, state.wallWidthCm);
    const heightCm = readWallInput(wallHeightInput, WALL_HEIGHT_LIMITS_CM, state.wallHeightCm);

    if (widthCm === state.wallWidthCm && heightCm === state.wallHeightCm) {
        // Puts back the current size when the typed value was empty or clamped to what is already set
        wallWidthInput.value = state.wallWidthCm;
        wallHeightInput.value = state.wallHeightCm;
        return;
    }

    setWallDimensions(widthCm, heightCm);
    clampItemsToWall();
    if (pruneGuides()) renderGuides();
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    // Spinner clicks fire one change per step; merging keeps a resize to a single undo step
    pushHistory('wall-size');
    saveState();
}

function handleAtticResize() {
    const widthCm = readWallInput(atticWidthInput, ATTIC_SIZE_LIMITS_CM, state.atticWidthCm);
    const heightCm = readWallInput(atticHeightInput, ATTIC_SIZE_LIMITS_CM, state.atticHeightCm);
    const changed = widthCm !== state.atticWidthCm || heightCm !== state.atticHeightCm;

    state.atticWidthCm = widthCm;
    state.atticHeightCm = heightCm;
    // Also puts back the current size when the typed value was empty or clamped to what is already set
    applyAtticSlope();
    if (!changed) return;
    pushHistory('attic-size');
    saveState();
}

// v2.0 ran as a classic script, so DevTools and the end-to-end suite could read its top-level bindings
// by name. The module build republishes that surface on window, with live getters for mutable state.
function exposeConsoleBindings() {
    const live = {
        wallItems: () => state.wallItems,
        selectedItemIds: () => state.selectedItemIds,
        wallGuides: () => state.wallGuides,
        wallPaint: () => state.wallPaint,
        projects: () => state.projects,
        historyStack: () => state.historyStack,
        historyIndex: () => state.historyIndex,
        wallWidthCm: () => state.wallWidthCm,
        wallHeightCm: () => state.wallHeightCm,
        wallWidthPx: () => state.wallWidthPx,
        wallHeightPx: () => state.wallHeightPx,
        viewScale: () => state.viewScale,
        userZoom: () => state.userZoom,
        panX: () => state.panX,
        panY: () => state.panY,
        studioMode: () => state.studioMode
    };
    const fixed = {
        importLayoutText, layoutPayload, openSpecSheet, renderPlanner, updateInspectorPanel, setSelection, selectItem,
        getSelectedItem, getItemElement, csvField, hasOverlap, isOverlapping, intrudesAtticSlope, rulers, rulerBands,
        wallCanvas, wallItemsLayer, alignLayer, atticZone, atticSlopeToggle, atticWidthInput, atticHeightInput, accentColorPicker, cornerColorPicker,
        brightnessSlider, wallWidthInput, wallHeightInput, scaleNote, undoBtn, redoBtn, rulerX, ioStatus,
        newProjectName, specModal, shortcutsModal, commandPalette, currentBrandStamp, buildSceneObj
    };
    Object.entries(live).forEach(([name, get]) => Object.defineProperty(window, name, { get, configurable: true }));
    Object.entries(fixed).forEach(([name, value]) => Object.defineProperty(window, name, { value, configurable: true }));
    // The clipboard test empties the clipboard by assigning to it, so this one binding also takes writes
    Object.defineProperty(window, 'clipboardState', {
        get: () => state.clipboardState,
        set: (value) => { state.clipboardState = value; },
        configurable: true
    });
}

// The viewport binder goes first: its window mousemove listeners (crosshair, Alt-hover measuring)
// must see each move before the drag listener below schedules a frame, exactly as in v2.0
bindViewportEvents();
bindInspectorEvents();
bindProjectSpecEvents();
bindPreview3dEvents();

// The splash shows once per page load; after the fade it leaves the layout entirely
const SPLASH_FADE_MS = 400;
// Rest spots of the two light pools in % of the splash. The amber pool follows the pointer and the
// violet one drifts against it, which reads as parallax.
const SPLASH_GLOW_REST = { accentX: 30, accentY: 25, cornerX: 75, cornerY: 80 };
const SPLASH_ACCENT_DRIFT = 14;
const SPLASH_CORNER_DRIFT = -10;
const SPLASH_GLOW_EASE_MS = 220;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const splashGlow = { x: 0, y: 0, targetX: 0, targetY: 0, frameId: 0, lastTime: 0 };

function paintSplashGlow() {
    const { x, y } = splashGlow;
    const style = splashScreen.style;
    style.setProperty('--splash-accent-x', `${(SPLASH_GLOW_REST.accentX + x * SPLASH_ACCENT_DRIFT).toFixed(2)}%`);
    style.setProperty('--splash-accent-y', `${(SPLASH_GLOW_REST.accentY + y * SPLASH_ACCENT_DRIFT).toFixed(2)}%`);
    style.setProperty('--splash-corner-x', `${(SPLASH_GLOW_REST.cornerX + x * SPLASH_CORNER_DRIFT).toFixed(2)}%`);
    style.setProperty('--splash-corner-y', `${(SPLASH_GLOW_REST.cornerY + y * SPLASH_CORNER_DRIFT).toFixed(2)}%`);
}

function applySplashGlowFrame(time) {
    const dt = splashGlow.lastTime ? time - splashGlow.lastTime : 16;
    splashGlow.lastTime = time;
    // Exponential easing keeps the drift speed independent of the display refresh rate
    const k = 1 - Math.exp(-dt / SPLASH_GLOW_EASE_MS);
    splashGlow.x += (splashGlow.targetX - splashGlow.x) * k;
    splashGlow.y += (splashGlow.targetY - splashGlow.y) * k;
    const settled = Math.abs(splashGlow.targetX - splashGlow.x) < 0.001 && Math.abs(splashGlow.targetY - splashGlow.y) < 0.001;
    if (settled) {
        splashGlow.x = splashGlow.targetX;
        splashGlow.y = splashGlow.targetY;
        splashGlow.lastTime = 0;
    }
    paintSplashGlow();
    splashGlow.frameId = settled ? 0 : requestAnimationFrame(applySplashGlowFrame);
}

function aimSplashGlow(x, y) {
    splashGlow.targetX = x;
    splashGlow.targetY = y;
    if (reducedMotion.matches) {
        cancelAnimationFrame(splashGlow.frameId);
        Object.assign(splashGlow, { x, y, frameId: 0, lastTime: 0 });
        paintSplashGlow();
        return;
    }
    if (!splashGlow.frameId) splashGlow.frameId = requestAnimationFrame(applySplashGlowFrame);
}

splashScreen?.addEventListener('mousemove', (e) => {
    if (!isSplashShown() || reducedMotion.matches) return;
    // The splash covers the viewport, so the window size stands in for its rect without a layout read
    aimSplashGlow(
        clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1),
        clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1)
    );
});

splashScreen?.addEventListener('mouseleave', () => {
    if (isSplashShown() && (splashGlow.targetX || splashGlow.targetY)) aimSplashGlow(0, 0);
});

enterStudioBtn?.addEventListener('click', () => {
    if (splashScreen.classList.contains('fade-out')) return;
    splashScreen.classList.add('fade-out');
    cancelAnimationFrame(splashGlow.frameId);
    splashGlow.frameId = 0;
    enterStudioBtn.blur();
    setTimeout(() => { splashScreen.hidden = true; }, SPLASH_FADE_MS);
});

document.addEventListener('mousedown', () => { focusFromPointer = true; }, true);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') focusFromPointer = false;
}, true);

window.addEventListener('mousemove', (e) => {
    if (state.panState.active) {
        state.panState.pointerX = e.clientX;
        state.panState.pointerY = e.clientY;
        if (!state.panState.frameId) state.panState.frameId = requestAnimationFrame(applyPanFrame);
        return;
    }

    if (state.guideDrag.active) {
        state.guideDrag.pointerX = e.clientX;
        state.guideDrag.pointerY = e.clientY;
        scheduleGuideFrame();
        return;
    }

    if (state.resizeState.active) {
        state.resizeState.pointerX = e.clientX;
        state.resizeState.pointerY = e.clientY;
        scheduleResizeFrame();
        return;
    }

    if (state.catalogDrag.pending) {
        trackCatalogDrag(e);
        return;
    }

    if (state.marquee.pending) {
        trackMarquee(e);
        return;
    }

    if (!state.dragState.isDragging) return;

    state.dragState.pointerX = e.clientX;
    state.dragState.pointerY = e.clientY;
    state.dragState.altKey = e.altKey;
    if (!state.dragState.travelled) {
        state.dragState.travelled = Math.hypot(e.clientX - state.dragState.pressX, e.clientY - state.dragState.pressY) > PRESS_TRAVEL_PX;
    }
    if (e.altKey) suppressAltMenu = true;
    scheduleDragFrame();
});

window.addEventListener('mouseup', () => {
    if (!state.dragState.isDragging) return;

    if (state.dragState.frameId) {
        cancelAnimationFrame(state.dragState.frameId);
        applyDragFrame();
    }

    const { members, group, travelled, itemId } = state.dragState;
    const moved = members.some(({ item, startLeft, startTop }) => item.left !== startLeft || item.top !== startTop);

    members.forEach(({ element }) => element?.classList.remove('dragging'));
    state.dragState = createIdleDragState();
    renderAlignGuides([]);
    updateCollisionStates();

    if (moved) commitLayoutChange();
    // A plain click on one member of a multi-selection narrows it to that member and its group
    if (group && !travelled) selectWithGroups(itemId);
    refreshMeasure();
});

window.addEventListener('mouseup', () => {
    if (!state.resizeState.active) return;
    finishResize();
    refreshMeasure();
});

window.addEventListener('mouseup', () => {
    if (state.guideDrag.active) finishGuideDrag();
    if (state.panState.active) endPan();
});

// Items stop their own presses, so a press that reaches the wall started on bare wall
wallCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // A new press means the last one has released and its click has fired, so a guard it left behind
    // is stale. Clearing it here keeps a quick click right after a drag from being swallowed.
    wallClickGuard++;
    ignoreWallClick = false;
    if (isPointerBusy() || isModalOpen()) return;

    // No text selection while the box is dragged out; the blur stands in for the focus change it cancels
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

    const wallRect = wallCanvas.getBoundingClientRect();
    const origin = toWallPoint(e.clientX, e.clientY, wallRect, state.viewScale);
    state.marquee = {
        ...createIdleMarquee(),
        pending: true,
        baseIds: e.shiftKey ? [...state.selectedItemIds] : [],
        wallRect,
        scale: state.viewScale,
        originX: origin.x,
        originY: origin.y,
        pressX: e.clientX,
        pressY: e.clientY,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
});

window.addEventListener('mouseup', () => {
    if (!state.marquee.pending) return;

    // Short of the threshold this was a plain click, which the wall click handler deals with
    if (!state.marquee.active) {
        state.marquee = createIdleMarquee();
        return;
    }

    if (state.marquee.frameId) {
        cancelAnimationFrame(state.marquee.frameId);
        applyMarqueeFrame();
    }
    const ids = state.marquee.hitIds;
    endMarquee();
    setSelection(ids);
});

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || isPointerBusy() || isModalOpen()) return;
        // Stops text selection while the card is pulled across the sidebar
        e.preventDefault();
        suppressCatalogClick = false;
        state.catalogDrag = {
            ...createIdleCatalogDrag(),
            pending: true,
            source: catalogEl,
            startX: e.clientX,
            startY: e.clientY,
            pointerX: e.clientX,
            pointerY: e.clientY
        };
    });

    catalogEl.addEventListener('click', () => {
        if (suppressCatalogClick || isPointerBusy()) return;
        spawnFromCatalog(catalogEl);
    });
});

window.addEventListener('mouseup', (e) => {
    if (!state.catalogDrag.pending) return;

    // Short of the threshold this was a plain click, which the click handler mounts
    if (!state.catalogDrag.active) {
        state.catalogDrag = createIdleCatalogDrag();
        return;
    }

    const { source, canvasRect } = state.catalogDrag;
    const overCanvas = pointInRect(canvasRect, e.clientX, e.clientY);
    endCatalogDrag();
    if (overCanvas) dropCatalogItem(source, e.clientX, e.clientY);
});

// Losing the window mid-drag means the release will never arrive
window.addEventListener('blur', () => {
    if (state.catalogDrag.active) endCatalogDrag();
    else if (state.catalogDrag.pending) state.catalogDrag = createIdleCatalogDrag();
    if (state.resizeState.active) cancelResize();
    if (state.guideDrag.active) cancelGuideDrag();
    if (state.panState.active) endPan();
    setSpaceHeld(false);
    if (state.marquee.active) cancelMarquee();
    else if (state.marquee.pending) state.marquee = createIdleMarquee();
    closeContextMenu();
    measure.alt = false;
    refreshMeasure();
});

window.addEventListener('keydown', (e) => {
    // Escape abandons a catalog drag, a grip resize, a guide drag or a selection box before anything else sees the key
    const { catalogDrag, resizeState, marquee, guideDrag, panState } = state;
    if (e.key === 'Escape' && (catalogDrag.active || resizeState.active || marquee.active || guideDrag.active || panState.active)) {
        e.preventDefault();
        if (state.catalogDrag.active) endCatalogDrag();
        if (state.resizeState.active) cancelResize();
        if (state.guideDrag.active) cancelGuideDrag();
        if (state.panState.active) cancelPan();
        if (state.marquee.active) cancelMarquee();
        return;
    }

    if (isContextMenuOpen() && handleContextMenuKey(e)) return;

    // Taken over everywhere, so the browser never moves focus to its own search bar instead
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key || '').toLowerCase() === 'k') {
        e.preventDefault();
        if (!e.repeat) toggleCommandPalette();
        return;
    }

    if (e.key === '?' && !isFormField(e.target)) {
        handleShortcutsKey(e);
        return;
    }

    // V opens the 3D preview, or closes it again unless something is being typed. Read by physical key.
    if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (preview3dModal.open ? !isTextEntry(e.target) : !isFormField(e.target) && !isModalOpen() && !isPointerBusy()) {
            e.preventDefault();
            if (!e.repeat) togglePreview3d();
            return;
        }
    }

    // An open dialog is modal, so nothing behind it may react to shortcuts
    if (isModalOpen()) return;

    // Alt+M flips the workspace mode. The physical key is read, since Option+M on a Mac types a character.
    if (e.code === 'KeyM' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isFormField(e.target)) {
        e.preventDefault();
        suppressAltMenu = true;
        if (!e.repeat) setStudioMode(isCreatorMode() ? 'engineer' : 'creator');
        return;
    }

    // Alt+Shift+C / V copy and paste the item style, read by physical key for the same reason
    const styleKey = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyC' || e.code === 'KeyV');
    if (styleKey && !isTextEntry(e.target)) {
        e.preventDefault();
        suppressAltMenu = true;
        if (!e.repeat) (e.code === 'KeyC' ? copySelectedStyle : pasteStyleToSelection)();
        return;
    }

    // Space keeps its usual job in fields and on a button reached with Tab. A button that only holds
    // focus because it was clicked gives Space up, so clicking a control and then panning just works.
    const keyboardButton = e.target.tagName === 'BUTTON' && !focusFromPointer;
    if (e.code === 'Space' && !isFormField(e.target) && !keyboardButton) {
        e.preventDefault();
        if (!state.spaceHeld && !isPointerBusy()) setSpaceHeld(true);
        return;
    }

    // T takes the tape measure out or puts it away. The physical key is read so any layout matches it.
    if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isFormField(e.target)) {
        e.preventDefault();
        if (!e.repeat) toggleTapeMeasure();
        return;
    }

    if (e.key === 'Escape' && isTapeMeasuring() && !isTextEntry(e.target)) {
        setTapeMeasure(false);
        return;
    }

    if (e.key === 'Escape') {
        handleEscape(e);
        return;
    }

    if (e.key === 'Alt' && state.dragState.isDragging) {
        // Alt or Option suspends magnetic alignment for as long as it is held
        e.preventDefault();
        state.dragState.altKey = true;
        suppressAltMenu = true;
        scheduleDragFrame();
        return;
    }

    if (e.key === 'Alt') {
        // With a selection, Alt measures to whatever the pointer rests on
        measure.alt = true;
        if (state.selectedItemIds.length) {
            e.preventDefault();
            suppressAltMenu = true;
        }
        refreshMeasure();
        return;
    }

    if (isPlainItemShortcut(e, 'l')) {
        e.preventDefault();
        toggleSelectedLock();
        return;
    }

    if (isPlainItemShortcut(e, 'r')) {
        e.preventDefault();
        rotateSelection();
        return;
    }

    // ] and [ send the selection to the top or bottom of the stack. AltGr layouts type the brackets
    // with Ctrl and Alt both down, so that pair counts as no modifier.
    if (isLayerEdgeShortcut(e)) {
        e.preventDefault();
        if (!e.repeat) moveSelectedLayerToEdge(e.key === ']');
        return;
    }

    const hasModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (hasModifier && handleModifierShortcut(e)) return;
    handleItemKeys(e);
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && state.spaceHeld) {
        e.preventDefault();
        setSpaceHeld(false);
        return;
    }
    if (e.key !== 'Alt') return;

    measure.alt = false;
    refreshMeasure();

    if (state.dragState.isDragging) {
        state.dragState.altKey = false;
        scheduleDragFrame();
    }

    // Releasing Alt on its own would otherwise focus the browser menu bar in some browsers
    if (suppressAltMenu) {
        e.preventDefault();
        suppressAltMenu = false;
    }
});

// Shift keeps the selection, so a missed Shift-click does not throw away a group
wallCanvas.addEventListener('click', (e) => {
    if (ignoreWallClick || e.shiftKey) return;
    if (state.selectedItemIds.length) selectItem(null);
});

atticSlopeToggle.addEventListener('change', () => {
    applyAtticSlope();
    commitLayoutChange();
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

atticWidthInput.addEventListener('change', handleAtticResize);
atticHeightInput.addEventListener('change', handleAtticResize);

wallWidthInput.addEventListener('change', handleWallResize);
wallHeightInput.addEventListener('change', handleWallResize);

resetWallBtn.addEventListener('click', () => {
    applyDefaultLayout();
    state.selectedItemIds = [];
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();
});

exportPngBtn.addEventListener('click', exportPng);

exposeConsoleBindings();
measureLabelMetrics();
loadState();
restoreCurrency();
renderPlanner();
applyAtticSlope();
pushHistory();
