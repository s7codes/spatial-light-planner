import {
    ARRANGE_ACTIONS, BACKDROP_ALIGNS, clamp, CM_STEP_PX, countLabel, CURRENCY_STORAGE_KEY, DEFAULT_NOTE_TEXT, DEFAULT_POSTER_ART,
    DUPLICATE_OFFSET_PX, EPSILON, escapeHtml, FEATURE_TYPES, FINISHES, FLOOR_BACKDROPS, formatFootprint, formatOffset,
    formatPrice, getBounds, isCurrencyCode, isFeature, isHexColor, isLedOn, isNote, isObstacle, ITEM_LABEL_INSET_PX, LOCK_ICON_HTML,
    MENU_EDGE_PX, minSizeCm, NOTE_MAX_LENGTH, POSTER_ARTS, quantize, RESIZE_HANDLES_HTML, SCALE, TINY_ITEM_PX, toCm,
    WALL_PAINTS
} from '../core/constants.js';
import {
    atticSlopeToggle, brightnessSlider, catalogItems, commandEmpty, currencySelector, illumStatus, commandList, commandPalette, commandPaletteBtn, commandSearchInput,
    contextMenu, contextMenuButtons, contextMenuTitle, getItemElement, inspectorBox, isModalOpen, layerList,
    layersCount, layersPanel, layersToggle, ledColorOf, presetButtons, selectionBounds, snapGridToggle,
    totalPriceDisplay, wallItemsLayer
} from '../core/dom.js';
import {
    applyItemStyle, canCopyStyle, canGroup, canPasteStyle, canUngroup, captureItemStyle, commitLayoutChange,
    createGroupId, createItemId, expandGroups, formatMoney, getSelectedItem, getSelectedItems, getUnits, groupLabels, groupMembers,
    isCreatorMode, isPointerBusy, isSelected, normalizeGroups, sanitizeNoteText, selectedGroupId, state,
    storageGet, storageSet, styleSourceItem, styleTargets
} from '../core/state.js';
import {
    ALIGN_EDGES, arrangeUnits, axisKeys, blocksRoomFeature, canAlignSelection, canCenterSelection,
    canDistributeSelection, canFlipSelection, canRotateSelection, canRotateUnit, describeErgonomics, describeItemStock,
    estimateIllumination, intrudesAtticSlope, mirrorUnits,
    overlapsFurniture, rotateGroup, rotateItem, rotationUnits, slopeClearOffset, slopeSafeOffset,
    updateCollisionStates
} from '../core/geometry.js';
import {
    clearGuides, refreshMeasure, refreshPowerRoutes, resetView, setFloorBackdrop, setFloorBackdropAlign, setPowerRouting,
    setStudioMode, setWallPaint, syncRulerSpans, toggleAmbientMode, updateDistanceGuides
} from './viewport-rulers.js';
import { exportPng } from '../io/export-png.js';
import { exportLayout, exportSpecCsv, openProjects, openSpecSheet, showIoStatus } from '../io/projects-spec.js';
import { spawnFromCatalog, startDrag, startResize } from '../planner-engine.js';

let itemLabelSizes = new Map();

export function renderPlanner() {
    wallItemsLayer.innerHTML = state.wallItems.map(item => {
        const finishClass = isFeature(item)
            ? `feature${isObstacle(item) ? ' obstacle' : ''}`
            : `finish-${item.finish || 'walnut'}`;
        const classes = [
            'wall-item', item.type, finishClass, `rot-${item.rotation || 0}`,
            isSelected(item.id) && 'selected',
            !isFeature(item) && !isLedOn(item) && 'led-off',
            item.locked && 'locked',
            item.hidden && 'is-hidden',
            item.groupId && 'in-group'
        ].filter(Boolean).join(' ');
        const ledColor = isHexColor(item.itemLedColor) ? ` --item-color: ${item.itemLedColor};` : '';
        const label = isNote(item)
            ? `<span class="item-label note-text">${escapeHtml(item.text)}</span>`
            : `<span class="item-label">${item.locked ? LOCK_ICON_HTML : ''}${escapeHtml(item.name)}</span>`;
        const art = item.type === 'poster' ? ` data-art="${escapeHtml(item.posterArt || DEFAULT_POSTER_ART)}"` : '';
        return `
            <div class="${classes}"
                 data-id="${escapeHtml(item.id)}"${art}
                 style="left: ${item.left}px; top: ${item.top}px; width: ${item.width}px; height: ${item.height}px;${ledColor}">
                ${label}
            </div>
        `;
    }).join('');

    const elements = [...wallItemsLayer.children];
    elements.forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    // Every label is measured before any is moved, so a render costs one layout and drag frames none.
    // Note text fills its own box and never needs shifting.
    itemLabelSizes = new Map(elements.filter(el => !el.classList.contains('note')).map(el => {
        const label = el.querySelector('.item-label');
        return [el.dataset.id, { width: label.offsetWidth, height: label.offsetHeight }];
    }));
    state.wallItems.forEach((item, index) => {
        placeItemLabel(item, elements[index]);
        flagWallEdges(item, elements[index]);
    });
    syncResizeHandles();
    syncSelectionBounds();

    updateCollisionStates();
    updateDistanceGuides();

    renderTotalPrice();
    renderLayers();
    refreshMeasure();
    refreshPowerRoutes();
    renderIllumination();
}

export function renderTotalPrice() {
    totalPriceDisplay.textContent = formatMoney(state.wallItems.reduce((sum, item) => sum + item.price, 0));
}

// Runs on renders, LED toggles, resize frames and brightness moves; it only writes when the text changed
export function renderIllumination() {
    const { text } = estimateIllumination(brightnessSlider.value);
    if (illumStatus.textContent !== text) illumStatus.textContent = text;
}

export function setCurrency(code, persist = true) {
    state.currency = isCurrencyCode(code) ? code : 'USD';
    currencySelector.value = state.currency;
    if (persist) storageSet(CURRENCY_STORAGE_KEY, state.currency);
    renderTotalPrice();
    updateInspectorPanel();
}

export const restoreCurrency = () => setCurrency(storageGet(CURRENCY_STORAGE_KEY), false);

export function updateInspectorLive() {
    const posReadout = document.getElementById('inspector-pos-readout');
    const selected = getSelectedItems();
    if (!posReadout || !selected.length) return;

    const box = selected.length === 1 ? selected[0] : getBounds(selected);
    posReadout.textContent = formatOffset(box);
    if (selected.length === 1) syncInspectorPosition(box);
    const footprint = document.getElementById('batch-footprint-readout');
    if (footprint) footprint.textContent = formatFootprint(box);
    document.getElementById('warning-overlap').hidden = !selected.some(overlapsFurniture);
    document.getElementById('warning-feature').hidden = !selected.some(blocksRoomFeature);
    document.getElementById('warning-attic').hidden = !selected.some(intrudesAtticSlope);
    syncErgonomicHint(selected.length === 1 ? selected[0] : null);
    syncStockBadge(selected.length === 1 ? selected[0] : null);
}

function syncStockBadge(item) {
    const badge = document.getElementById('inspector-stock-badge');
    const stock = describeItemStock(item);
    if (!badge || !stock) return;
    if (badge.textContent !== stock.text) badge.textContent = stock.text;
    badge.dataset.stockStatus = stock.status;
}

function syncErgonomicHint(item) {
    const hint = document.getElementById('ergonomic-hint');
    if (!hint || !item) return;
    const { text, warning } = describeErgonomics(item);
    if (hint.textContent !== text) hint.textContent = text;
    hint.classList.toggle('is-warning', warning);
}

// Lamps and spotlights carry labels wider than themselves, so near a wall edge the label
// shifts just far enough to stay inside the wall instead of being clipped by it
export function labelShift(start, size, labelSize, limit) {
    const labelStart = start + (size - labelSize) / 2;
    const maxStart = Math.max(ITEM_LABEL_INSET_PX, limit - ITEM_LABEL_INSET_PX - labelSize);
    return clamp(labelStart, ITEM_LABEL_INSET_PX, maxStart) - labelStart;
}

export function placeItemLabel(item, el) {
    const size = itemLabelSizes.get(item.id);
    const label = el.querySelector('.item-label');
    if (!size || !label) return;

    const dx = labelShift(item.left, item.width, size.width, state.wallWidthPx);
    const dy = labelShift(item.top, item.height, size.height, state.wallHeightPx);
    label.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
}

// Grips normally straddle the item edge; flush against the wall they would be half clipped,
// so these flags tuck them inside the item there. A piece of 12 x 12 cm or less would vanish under
// its grips, so is-tiny moves them out past its edges and leaves the whole face to the drag.
export function flagWallEdges(item, el) {
    el.classList.toggle('flush-right', item.left + item.width >= state.wallWidthPx - EPSILON);
    el.classList.toggle('flush-bottom', item.top + item.height >= state.wallHeightPx - EPSILON);
    el.classList.toggle('is-tiny', item.width <= TINY_ITEM_PX + EPSILON && item.height <= TINY_ITEM_PX + EPSILON);
}

// Position-only updates skip renderPlanner so dragging and nudging never rebuild the DOM.
// Each member gets its inline styles first, then the shared readouts run once for the whole group.
export function syncPositions(members) {
    members.forEach(({ item, element }) => {
        if (!element) return;
        element.style.left = `${item.left}px`;
        element.style.top = `${item.top}px`;
        placeItemLabel(item, element);
        flagWallEdges(item, element);
    });
    updateCollisionStates();
    updateDistanceGuides();
    updateInspectorLive();
    syncSelectionBounds();
    refreshMeasure();
    refreshPowerRoutes();
}

export function syncSelectionBounds() {
    const selected = getSelectedItems();
    syncRulerSpans();
    selectionBounds.hidden = selected.length < 2;
    if (selected.length < 2) return;

    const box = getBounds(selected);
    selectionBounds.style.left = `${box.left}px`;
    selectionBounds.style.top = `${box.top}px`;
    selectionBounds.style.width = `${box.width}px`;
    selectionBounds.style.height = `${box.height}px`;
}

// Selection changes without a re-render, so the grips are moved to the selected item here
export function syncResizeHandles() {
    wallItemsLayer.querySelectorAll('.resize-handle').forEach(handle => handle.remove());

    const item = getSelectedItem();
    const el = item && !item.locked ? getItemElement(item.id) : null;
    if (!el) return;

    el.insertAdjacentHTML('beforeend', RESIZE_HANDLES_HTML);
    el.querySelectorAll('.resize-handle').forEach(handle => handle.addEventListener('mousedown', startResize));
}

// Only changed values are written, so a field that has focus keeps it and its caret
export function syncInspectorPosition(item) {
    const fields = [
        [document.getElementById('edit-left-cm'), toCm(item.left), state.wallWidthCm - toCm(item.width)],
        [document.getElementById('edit-top-cm'), toCm(item.top), state.wallHeightCm - toCm(item.height)]
    ];
    fields.forEach(([input, valueCm, maxCm]) => {
        if (!input) return;
        if (input.value !== String(valueCm)) input.value = valueCm;
        if (input.max !== String(maxCm)) input.max = maxCm;
    });
}

export function syncInspectorSize(item) {
    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');
    if (widthInput) widthInput.value = toCm(item.width);
    if (heightInput) heightInput.value = toCm(item.height);
}

// Size-only counterpart of syncItemPosition: inline styles and live readouts, no rebuild
export function syncItemSize(item, el) {
    el.style.width = `${item.width}px`;
    el.style.height = `${item.height}px`;
    placeItemLabel(item, el);
    flagWallEdges(item, el);
    updateCollisionStates();
    updateDistanceGuides();
    updateInspectorLive();
    syncInspectorSize(item);
    syncRulerSpans();
    refreshPowerRoutes();
    renderIllumination();
}

export function setSelection(ids) {
    const unique = [...new Set(ids)];
    state.selectedItemIds = unique.filter(id => state.wallItems.some(item => item.id === id));

    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('selected', isSelected(el.dataset.id));
    });
    syncResizeHandles();
    syncSelectionBounds();
    syncLayerSelection();

    updateInspectorPanel();
    updateDistanceGuides();
    refreshMeasure();
}

export const selectItem = (itemId) => setSelection(itemId ? [itemId] : []);

export const selectWithGroups = (itemId) => setSelection(expandGroups([itemId]));

export function toggleInSelection(itemId) {
    const ids = expandGroups([itemId]);
    setSelection(ids.every(isSelected)
        ? state.selectedItemIds.filter(id => !ids.includes(id))
        : [...state.selectedItemIds, ...ids]);
}

export const selectAll = () => setSelection(state.wallItems.filter(item => !item.hidden).map(item => item.id));

// Groups are one level deep, so grouping members of other groups moves them into the new group
export function groupSelection() {
    if (!canGroup()) return;

    const groupId = createGroupId();
    getSelectedItems().forEach(item => { item.groupId = groupId; });
    state.wallItems = normalizeGroups(state.wallItems);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Every group the selection touches dissolves, and all of its former members stay selected
export function ungroupSelection() {
    const groupIds = new Set(getSelectedItems().map(item => item.groupId).filter(Boolean));
    if (!groupIds.size) return;

    const members = state.wallItems.filter(item => groupIds.has(item.groupId));
    members.forEach(item => { item.groupId = null; });
    state.selectedItemIds = [...new Set([...state.selectedItemIds, ...members.map(item => item.id)])];
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Locked items survive a removal and stay selected, so the user can see what was skipped
export function removeItems(ids) {
    const removable = new Set(state.wallItems.filter(item => ids.includes(item.id) && !item.locked).map(item => item.id));
    if (!removable.size) return;

    state.wallItems = normalizeGroups(state.wallItems.filter(item => !removable.has(item.id)));
    state.selectedItemIds = state.selectedItemIds.filter(id => !removable.has(id));
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

export const removeSelectedItems = () => removeItems(state.selectedItemIds);

// Copies keep their relative layout, so the offset is clamped for the block's box, not per item.
// Each group with two or more copied members becomes a new group of its own copies.
export function placeCopies(sources, offsetPx) {
    const box = getBounds(sources);
    let dx = clamp(offsetPx, -box.left, state.wallWidthPx - box.left - box.width);
    let dy = clamp(offsetPx, -box.top, state.wallHeightPx - box.top - box.height);
    [dx, dy] = slopeClearOffset(sources, box, dx, dy);

    const copiedGroups = new Map();
    const copies = sources.map(source => {
        if (source.groupId && !copiedGroups.has(source.groupId)) copiedGroups.set(source.groupId, createGroupId());
        const copy = {
            ...JSON.parse(JSON.stringify(source)),
            id: createItemId(),
            // A copy starts unlocked so it can be placed right away
            locked: false,
            groupId: source.groupId ? copiedGroups.get(source.groupId) : null
        };
        // Pieces copied before the wall shrank may not fit it any more, so they are trimmed to it
        copy.width = Math.min(copy.width, state.wallWidthPx);
        copy.height = Math.min(copy.height, state.wallHeightPx);
        copy.left = clamp(source.left + dx, 0, state.wallWidthPx - copy.width);
        copy.top = clamp(source.top + dy, 0, state.wallHeightPx - copy.height);
        return copy;
    });

    // normalizeGroups drops the id of any group that ends up with a single copy
    state.wallItems = normalizeGroups([...state.wallItems, ...copies]);
    state.selectedItemIds = copies.map(copy => copy.id);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
    return copies;
}

export function duplicateSelectedItem() {
    const sources = getSelectedItems();
    if (sources.length) placeCopies(sources, DUPLICATE_OFFSET_PX);
}

// Copies are taken in stacking order, so a paste rebuilds the same layering
export function copySelection() {
    const items = getSelectedItems();
    if (!items.length) return false;
    state.clipboardState = { items: JSON.parse(JSON.stringify(items)), pasteCount: 0 };
    showIoStatus(`Copied ${countLabel(items.length)}.`, 'success');
    return true;
}

// Cut follows Delete: locked items are copied but stay on the wall, still selected
export function cutSelection() {
    if (!copySelection()) return;
    const items = getSelectedItems();
    const locked = items.filter(item => item.locked).length;
    if (locked === items.length) {
        flashLockNote();
        showIoStatus(`Copied ${countLabel(items.length)}; locked items stay on the wall.`, 'error');
        return;
    }
    removeSelectedItems();
    showIoStatus(locked
        ? `Cut ${countLabel(items.length - locked)}; ${locked} locked stayed on the wall.`
        : `Cut ${countLabel(items.length)}.`, 'success');
}

// Each paste lands another 4 cm further along, so repeated pastes fan out instead of stacking
export function pasteClipboard() {
    if (!state.clipboardState.items.length || isPointerBusy()) return;
    state.clipboardState.pasteCount += 1;
    placeCopies(state.clipboardState.items, DUPLICATE_OFFSET_PX * state.clipboardState.pasteCount);
}

export function copySelectedStyle() {
    const source = styleSourceItem();
    if (!source) return;
    state.styleClipboard = captureItemStyle(source);
    showIoStatus(`Copied style from ${source.name}.`, 'success');
    // Only the Paste Style button depends on the clipboard, so the panel is not rebuilt
    const pasteBtn = document.getElementById('paste-style-btn');
    if (pasteBtn) pasteBtn.disabled = !canPasteStyle();
}

// Locked items and room features are skipped; the whole paste is one undo step
export function pasteStyleToSelection() {
    if (!canPasteStyle() || isPointerBusy()) {
        if (state.styleClipboard && getSelectedItems().some(item => item.locked && !isFeature(item))) flashLockNote();
        return;
    }
    const changed = styleTargets().filter(item => applyItemStyle(item, state.styleClipboard)).length;
    if (!changed) return;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
    showIoStatus(`Pasted style onto ${countLabel(changed)}.`, 'success');
}

// A mixed selection locks everything first; only a fully locked selection unlocks
export function toggleSelectedLock() {
    const items = getSelectedItems();
    if (!items.length) return;

    const lock = items.some(item => !item.locked);
    items.forEach(item => { item.locked = lock; });
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Layer moves shift whole blocks so a group never splits. When the selection sits inside one group
// without covering all of it, the members reorder among themselves instead.
function layerScope() {
    const items = getSelectedItems();
    const groupId = items[0]?.groupId;
    const inside = groupId && items.every(item => item.groupId === groupId) && items.length < groupMembers(groupId).length;
    if (inside) {
        return { groupId, blocks: groupMembers(groupId).map(item => ({ key: `item:${item.id}`, items: [item] })) };
    }
    return { groupId: null, blocks: getUnits() };
}

const isBlockSelected = (block) => block.items.some(item => isSelected(item.id));

export function canMoveLayer(step) {
    const { blocks } = layerScope();
    return blocks.some((block, index) => {
        const neighbor = blocks[index + step];
        return isBlockSelected(block) && neighbor && !isBlockSelected(neighbor);
    });
}

// Writes a reordered run of blocks back; inside a group only that group's slice of wallItems changes
function applyBlockOrder(blocks, groupId) {
    const ordered = blocks.flatMap(block => block.items);
    if (!groupId) {
        state.wallItems = ordered;
        return;
    }
    state.wallItems.splice(state.wallItems.findIndex(item => item.groupId === groupId), ordered.length, ...ordered);
}

// Room features (doors, windows, sockets, TVs) form the floor of the stack. Send to Back drops furniture
// onto that floor, never under it, and only a selected feature sinks below the other features. A feature
// brought to the front rises to the top of the floor, so furniture never ends up beneath one.
const isFloorBlock = (block) => block.items.every(isObstacle);

function layerEdgeOrder(toFront) {
    const { blocks, groupId } = layerScope();
    const rest = blocks.filter(block => !isBlockSelected(block));
    const picked = blocks.filter(isBlockSelected);
    const floorEnd = rest.findIndex(block => !isFloorBlock(block));
    const floor = floorEnd < 0 ? rest : rest.slice(0, floorEnd);
    const above = floorEnd < 0 ? [] : rest.slice(floorEnd);
    const pickedFloor = picked.filter(isFloorBlock);
    const pickedOther = picked.filter(block => !isFloorBlock(block));
    const ordered = toFront
        ? [...floor, ...pickedFloor, ...above, ...pickedOther]
        : [...pickedFloor, ...floor, ...pickedOther, ...above];
    const changed = picked.length > 0 && ordered.some((block, index) => block !== blocks[index]);
    return { ordered, groupId, changed };
}

export const canMoveLayerToEdge = (toFront) => layerEdgeOrder(toFront).changed;

export function moveSelectedLayerToEdge(toFront) {
    const { ordered, groupId, changed } = layerEdgeOrder(toFront);
    if (!changed) return;

    applyBlockOrder(ordered, groupId);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// wallItems is also the paint order in #wall-items. Walking from the leading end lets every selected
// block hop over its unselected neighbor once, so a selection shifts one layer and keeps its inner order.
export function moveSelectedLayer(step) {
    if (!canMoveLayer(step)) return;

    const { blocks, groupId } = layerScope();
    const indexes = blocks.map((_, index) => index);
    if (step > 0) indexes.reverse();
    indexes.forEach(index => {
        const target = index + step;
        const neighbor = blocks[target];
        if (isBlockSelected(blocks[index]) && neighbor && !isBlockSelected(neighbor)) {
            [blocks[index], blocks[target]] = [neighbor, blocks[index]];
        }
    });

    applyBlockOrder(blocks, groupId);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Loose items turn in place and groups turn as a whole; locked or oversized units are left alone
export function rotateSelection() {
    const targets = rotationUnits().filter(canRotateUnit);
    if (!targets.length) {
        if (getSelectedItems().some(item => item.locked)) flashLockNote();
        return;
    }

    targets.forEach(unit => (unit.length === 1 ? rotateItem(unit[0]) : rotateGroup(unit)));
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

const reportHeld = (held) => {
    if (held) showIoStatus(`Kept ${held} ${held === 1 ? 'item' : 'items'} clear of the attic slope.`, 'error');
};

function finishMirror({ held, moved }) {
    reportHeld(held);
    if (!moved) return;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Locked units stay put but still count toward the box, so the mirror line is the whole selection's
export function flipSelection() {
    if (!canFlipSelection() || isPointerBusy()) return;
    const bounds = getBounds(getSelectedItems());
    finishMirror(mirrorUnits(arrangeUnits().filter(unit => unit.movable), bounds.left * 2 + bounds.width));
}

export function mirrorItemAcrossWall() {
    const item = getSelectedItem();
    if (!item || item.locked || isPointerBusy()) return;
    finishMirror(mirrorUnits([{ items: [item], box: getBounds([item]) }], state.wallWidthPx));
}

function arrangeAlong(axis, moves) {
    const [key, size] = axisKeys(axis);
    const limit = axis === 'x' ? state.wallWidthPx : state.wallHeightPx;
    let held = 0;
    let moved = 0;

    moves.forEach(({ unit, offset }) => {
        const wanted = clamp(unit.box[key] + offset, 0, limit - unit.box[size]) - unit.box[key];
        const allowed = slopeSafeOffset(unit.items, key, wanted);
        if (Math.abs(allowed - wanted) > EPSILON) held += unit.items.length;
        if (Math.abs(allowed) < EPSILON) return;
        unit.items.forEach(item => { item[key] += allowed; });
        moved++;
    });

    reportHeld(held);
    if (!moved) return;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

export function alignSelection(edge) {
    const units = arrangeUnits();
    if (!canAlignSelection(units) || isPointerBusy()) return;

    const { axis, at } = ALIGN_EDGES[edge];
    const [key, size] = axisKeys(axis);
    const bounds = getBounds(getSelectedItems());
    // Centering can land on a half centimeter, so the target is rounded back onto the grid
    arrangeAlong(axis, units.filter(unit => unit.movable).map(unit => ({
        unit,
        offset: quantize(bounds[key] + (bounds[size] - unit.box[size]) * at, CM_STEP_PX) - unit.box[key]
    })));
}

// The first and last units stay put and the rest get equal gaps between their outer edges. Each
// position is rounded to whole centimeters, so two gaps differ by a centimeter at most.
export function distributeSelection(axis) {
    const units = arrangeUnits().filter(unit => unit.movable);
    if (units.length < 3 || isPointerBusy()) return;

    const [key, size] = axisKeys(axis);
    units.sort((a, b) => a.box[key] - b.box[key] || a.box[size] - b.box[size]);
    const first = units[0].box;
    const last = units.at(-1).box;
    const occupied = units.reduce((sum, unit) => sum + unit.box[size], 0);
    const gap = (last[key] + last[size] - first[key] - occupied) / (units.length - 1);

    let cursor = first[key];
    arrangeAlong(axis, units.map(unit => {
        const offset = quantize(cursor, CM_STEP_PX) - unit.box[key];
        cursor += unit.box[size] + gap;
        return { unit, offset };
    }));
}

// One piece lands exactly on the center line. Several move as one rigid block made of their movable
// units, rounded to whole cm, and stop short of the attic slope the way Align does.
export function centerSelectionOnWall(axis) {
    if (isPointerBusy()) return;
    const items = arrangeUnits().filter(unit => unit.movable).flatMap(unit => unit.items);
    if (!items.length) {
        if (state.selectedItemIds.length) flashLockNote();
        return;
    }

    const [key, size] = axisKeys(axis);
    const limit = axis === 'x' ? state.wallWidthPx : state.wallHeightPx;
    const box = getBounds(items);
    const target = clamp(quantize((limit - box[size]) / 2, CM_STEP_PX), 0, limit - box[size]);

    if (items.length > 1) {
        arrangeAlong(axis, [{ unit: { items, box }, offset: target - box[key] }]);
        return;
    }
    if (Math.abs(target - items[0][key]) < EPSILON) return;
    items[0][key] = target;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

const centerWallFieldHtml = () => (canCenterSelection() ? `
    <div class="inspector-field">
        <label id="center-wall-label">Center on Wall</label>
        <div class="center-wall-row" role="group" aria-labelledby="center-wall-label">
            <button type="button" class="btn-secondary center-wall-btn" id="center-wall-h-btn" title="Center horizontally on the wall">
                <span class="center-icon" aria-hidden="true"></span>Center H
            </button>
            <button type="button" class="btn-secondary center-wall-btn" id="center-wall-v-btn" title="Center vertically on the wall">
                <span class="center-icon is-vertical" aria-hidden="true"></span>Center V
            </button>
        </div>
    </div>` : '');

export function runArrange(action) {
    if (action === 'distribute-h') distributeSelection('x');
    else if (action === 'distribute-v') distributeSelection('y');
    else alignSelection(action.replace('align-', ''));
}

function arrangeFieldHtml() {
    const units = arrangeUnits();
    if (!canAlignSelection(units)) return '';

    const distributable = canDistributeSelection(units);
    const buttons = ARRANGE_ACTIONS.map(({ id, label, hint, distribute }) => {
        const off = distribute && !distributable;
        return `
            <button type="button" class="arrange-btn" id="${id}-btn" data-arrange="${id}" aria-label="${label}"
                    title="${label}: ${off ? 'select 3 or more movable items' : hint}" ${off ? 'disabled' : ''}>
                <span class="arrange-icon icon-${id}" aria-hidden="true"></span>
            </button>`;
    }).join('');
    return `
        <div class="inspector-field">
            <label id="arrange-label">Align &amp; Distribute</label>
            <div class="arrange-grid" role="group" aria-labelledby="arrange-label">${buttons}</div>
        </div>`;
}

// Double-clicking a note swaps its label for a textarea. The item element is never rebuilt while the
// editor is open, and saving only rewrites the label, so a drag that starts on another item and
// blurs the editor keeps working on live elements.
let noteEditor = null;

export function startNoteEdit(item, el) {
    selectItem(item.id);
    if (item.locked) {
        flashLockNote();
        return;
    }

    const label = el.querySelector('.item-label');
    const editor = document.createElement('textarea');
    editor.className = 'note-editor';
    editor.value = item.text;
    editor.maxLength = NOTE_MAX_LENGTH;
    editor.spellcheck = false;
    editor.setAttribute('aria-label', 'Note text');
    label.hidden = true;
    el.classList.add('is-editing');
    el.append(editor);
    noteEditor = { item, el, label, editor };

    // Presses inside place the caret instead of dragging, and keys stay with the text
    ['mousedown', 'click', 'dblclick'].forEach(type => editor.addEventListener(type, e => e.stopPropagation()));
    editor.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            editor.blur();
        }
    });
    editor.addEventListener('blur', finishNoteEdit, { once: true });
    editor.focus();
    editor.select();
}

export function setNoteText(item, raw) {
    const text = sanitizeNoteText(raw);
    if (text === item.text) return false;

    item.text = text;
    const label = getItemElement(item.id)?.querySelector('.item-label');
    if (label) label.textContent = text;
    renderLayers();
    commitLayoutChange();
    return true;
}

export function finishNoteEdit() {
    if (!noteEditor) return;

    const { item, el, label, editor } = noteEditor;
    noteEditor = null;
    editor.remove();
    label.hidden = false;
    el.classList.remove('is-editing');
    setNoteText(item, editor.value);

    const field = document.getElementById('note-text');
    if (field) field.value = item.text;
}

// Layer explorer. Rows run top to bottom, the reverse of wallItems, and every row is keyed as
// item:<id> or group:<id> so clicks, toggles and drops all resolve through the same helper.
const collapsedGroups = new Set();
let layerDrag = null;

const layerName = (item) => (isNote(item) ? `Note: ${item.text.split('\n')[0]}` : item.name);

function layerItems(key) {
    const split = key.indexOf(':');
    const kind = key.slice(0, split);
    const id = key.slice(split + 1);
    return kind === 'group' ? groupMembers(id) : state.wallItems.filter(item => item.id === id);
}

function layerToggles(name, hidden, locked) {
    return `
        <button type="button" class="layer-toggle layer-eye ${hidden ? 'is-off' : ''}" aria-pressed="${hidden}" aria-label="${hidden ? 'Show' : 'Hide'} ${name}" title="${hidden ? 'Show' : 'Hide'} ${name}"><span class="eye-icon" aria-hidden="true"></span></button>
        <button type="button" class="layer-toggle layer-lock ${locked ? 'is-on' : ''}" aria-pressed="${locked}" aria-label="${locked ? 'Unlock' : 'Lock'} ${name}" title="${locked ? 'Unlock' : 'Lock'} ${name}">${LOCK_ICON_HTML}</button>`;
}

function itemRowHtml(item, groupId) {
    const name = escapeHtml(layerName(item));
    const swatch = isFeature(item) ? item.type : item.finish;
    const classes = ['layer-row', groupId && 'is-child', item.hidden && 'is-hidden', item.locked && 'is-locked'].filter(Boolean).join(' ');
    return `
        <li class="${classes}" role="treeitem" aria-level="${groupId ? 2 : 1}" aria-selected="false" draggable="true"
            data-layer="item:${escapeHtml(item.id)}" data-item-id="${escapeHtml(item.id)}"${groupId ? ` data-group="${escapeHtml(groupId)}"` : ''}>
            <span class="layer-grip" aria-hidden="true"></span>
            <button type="button" class="layer-name" title="Select ${name}">
                <span class="layer-icon" data-swatch="${swatch}" aria-hidden="true"></span><span class="layer-text">${name}</span>
            </button>${layerToggles(name, item.hidden, item.locked)}
        </li>`;
}

function groupRowHtml(unit, label, collapsed) {
    const hidden = unit.items.every(item => item.hidden);
    const locked = unit.items.every(item => item.locked);
    const classes = ['layer-row', 'is-group', hidden && 'is-hidden', locked && 'is-locked'].filter(Boolean).join(' ');
    return `
        <li class="${classes}" role="treeitem" aria-level="1" aria-expanded="${!collapsed}" aria-selected="false" draggable="true"
            data-layer="group:${escapeHtml(unit.groupId)}" data-group-id="${escapeHtml(unit.groupId)}">
            <button type="button" class="layer-caret" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${label}" title="${collapsed ? 'Expand' : 'Collapse'} ${label}"></button>
            <button type="button" class="layer-name" title="Select ${label}">
                <span class="layer-icon" data-swatch="group" aria-hidden="true"></span><span class="layer-text">${label}</span><span class="layer-count">${unit.items.length}</span>
            </button>${layerToggles(label, hidden, locked)}
        </li>`;
}

export function renderLayers() {
    const labels = groupLabels();
    const rows = [...getUnits()].reverse().flatMap(unit => {
        if (!unit.groupId) return [itemRowHtml(unit.items[0], null)];
        const collapsed = collapsedGroups.has(unit.groupId);
        const children = collapsed ? [] : [...unit.items].reverse().map(item => itemRowHtml(item, unit.groupId));
        return [groupRowHtml(unit, labels.get(unit.groupId), collapsed), ...children];
    });

    layerList.innerHTML = rows.join('') || '<li class="layer-empty">Nothing on the wall yet.</li>';
    layersCount.textContent = state.wallItems.length;
    syncLayerSelection();
}

// Selection changes only flip classes; the list itself is rebuilt when the stack changes
export function syncLayerSelection() {
    layerList.querySelectorAll('.layer-row').forEach(row => {
        const items = layerItems(row.dataset.layer);
        const selected = items.length > 0 && items.every(item => isSelected(item.id));
        row.classList.toggle('is-selected', selected);
        row.setAttribute('aria-selected', selected);
    });
}

function toggleLayerFlag(key, flag) {
    const items = layerItems(key);
    if (!items.length) return;

    // Mixed groups switch every member on first, matching the Lock All rule
    const value = items.some(item => !item[flag]);
    items.forEach(item => { item[flag] = value; });
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// A dragged member may only move among its own group's members. Any other row moves as a whole block,
// and while it hovers a member row it is measured against that member's whole group instead.
function resolveLayerDrop(e) {
    const row = e.target instanceof Element ? e.target.closest('.layer-row') : null;
    if (!layerDrag || !row || row.dataset.layer === layerDrag.key) return null;

    if (layerDrag.groupId) {
        if (!row.classList.contains('is-child') || row.dataset.group !== layerDrag.groupId) return null;
        const rect = row.getBoundingClientRect();
        const place = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        return { key: row.dataset.layer, place, marker: row };
    }

    const head = row.classList.contains('is-child')
        ? layerList.querySelector(`[data-layer="group:${row.dataset.group}"]`)
        : row;
    if (!head || head.dataset.layer === layerDrag.key) return null;

    const block = [head, ...layerList.querySelectorAll(`.is-child[data-group="${head.dataset.groupId}"]`)];
    const top = block[0].getBoundingClientRect().top;
    const bottom = block.at(-1).getBoundingClientRect().bottom;
    const place = e.clientY < (top + bottom) / 2 ? 'above' : 'below';
    return { key: head.dataset.layer, place, marker: place === 'above' ? head : block.at(-1) };
}

function clearLayerMarkers() {
    layerList.querySelectorAll('.drop-above, .drop-below').forEach(row => row.classList.remove('drop-above', 'drop-below'));
}

// The list runs top to bottom while wallItems runs bottom to top, so "above" lands one index higher
function reorderLayer(dragKey, targetKey, place, groupId) {
    const blocks = groupId
        ? groupMembers(groupId).map(item => ({ key: `item:${item.id}`, items: [item] }))
        : getUnits();
    const from = blocks.findIndex(block => block.key === dragKey);
    if (from < 0) return;
    const [moving] = blocks.splice(from, 1);
    const at = blocks.findIndex(block => block.key === targetKey);
    if (at < 0) return;
    blocks.splice(place === 'above' ? at + 1 : at, 0, moving);

    const before = state.wallItems.map(item => item.id).join();
    applyBlockOrder(blocks, groupId);
    if (state.wallItems.map(item => item.id).join() === before) return;

    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

export function flashLockNote() {
    const note = document.getElementById('lock-note');
    if (!note) return;

    note.classList.remove('is-flashing');
    // Reading layout restarts the animation when the user keeps trying to move a locked item
    void note.offsetWidth;
    note.classList.add('is-flashing');
}

export function syncLedToggle(button, on) {
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-checked', String(on));
    button.querySelector('.led-toggle-state').textContent = on ? 'ON' : 'OFF';
}

const EMPTY_INSPECTOR_HTML = `
    <p>Select or drag an item on the wall to edit dimensions, finish, or remove it.
    Shift-click items or drag across empty wall to select several.</p>`;

const finishButtonsHtml = (activeFinish, disabled) => FINISHES.map(({ id, label }) => `
    <button class="btn-finish ${activeFinish === id ? 'active' : ''}" data-finish="${id}" aria-pressed="${activeFinish === id}" title="${label} finish" ${disabled ? 'disabled' : ''}>${label}</button>
`).join('');

const layerFieldHtml = (readout) => `
    <div class="inspector-field">
        <label>Layer${readout ? ` <span class="layer-readout">${readout}</span>` : ''}</label>
        <div class="layer-buttons">
            <button type="button" class="btn-secondary" id="send-backward-btn" title="Move one layer down, behind overlapping items" ${canMoveLayer(-1) ? '' : 'disabled'}>Send Backward</button>
            <button type="button" class="btn-secondary" id="bring-forward-btn" title="Move one layer up, above overlapping items" ${canMoveLayer(1) ? '' : 'disabled'}>Bring Forward</button>
        </div>
    </div>`;

const WARNINGS_HTML = `
    <div id="warning-overlap" class="collision-warning" hidden>Overlap detected with another item</div>
    <div id="warning-feature" class="collision-warning" hidden>Furniture overlaps a door, window or socket zone</div>
    <div id="warning-attic" class="collision-warning" hidden>Intrudes into sloped ceiling zone</div>`;

// Single posters always show the picker (disabled while locked); a batch shows it for its unlocked posters
function posterArtFieldHtml(posters, disabled = false) {
    if (!posters.length) return '';
    const shared = posters.every(item => item.posterArt === posters[0].posterArt) ? posters[0].posterArt : null;
    const buttons = POSTER_ARTS.map(({ id, label }) => `
        <button type="button" class="segmented-btn btn-poster-art" id="poster-art-${id}-btn" data-poster-art="${id}" aria-pressed="${shared === id}" title="${label} artwork" ${disabled ? 'disabled' : ''}>${label}</button>`).join('');
    return `
            <div class="inspector-field">
                <label id="poster-art-label">Poster Artwork</label>
                <div class="segmented segmented-grid poster-art" role="group" aria-labelledby="poster-art-label">${buttons}</div>
            </div>`;
}

// The print only changes the data-art hook, so the item element is updated in place rather than rebuilt
function applyPosterArt(art) {
    const targets = getSelectedItems().filter(item => item.type === 'poster' && !item.locked && item.posterArt !== art);
    if (!targets.length) return;

    targets.forEach(item => {
        item.posterArt = art;
        getItemElement(item.id)?.setAttribute('data-art', art);
    });
    updateInspectorPanel();
    commitLayoutChange();
}

function applyFinish(finish) {
    const targets = getSelectedItems().filter(item => !item.locked && !isFeature(item) && item.finish !== finish);
    if (!targets.length) return;

    targets.forEach(item => { item.finish = finish; });
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Live preview while the picker is open: only the inline custom property changes, nothing is rebuilt
function setItemLedColor(item, color) {
    if (!item || item.locked) return;

    item.itemLedColor = isHexColor(color) ? color.toLowerCase() : null;
    const el = getItemElement(item.id);
    if (el && item.itemLedColor) el.style.setProperty('--item-color', item.itemLedColor);
    else if (el) el.style.removeProperty('--item-color');
    syncItemLedField();
}

export function syncItemLedField() {
    const picker = document.getElementById('item-led-color');
    const item = getSelectedItem();
    if (!picker || !item) return;

    const custom = isHexColor(item.itemLedColor);
    const color = ledColorOf(item);
    const readout = document.getElementById('item-led-hex');
    if (picker.value !== color) picker.value = color;
    readout.textContent = custom ? color.toUpperCase() : 'Global';
    readout.title = custom ? 'This item overrides the global lighting color' : `Following the global color ${color.toUpperCase()}`;
    readout.classList.toggle('is-global', !custom);
    document.getElementById('item-led-reset').disabled = !custom || item.locked;
}

const styleFieldHtml = (finishLocked) => `
    <div class="inspector-field">
        <label id="item-style-label">Item Style</label>
        <div class="style-copy-row" role="group" aria-labelledby="item-style-label">
            <button type="button" class="btn-secondary" id="copy-style-btn" title="Copy finish, backlight, LED color and poster print (Alt+Shift+C)">Copy Style</button>
            <button type="button" class="btn-secondary" id="paste-style-btn" title="Paste the copied style onto the unlocked selection (Alt+Shift+V)" ${!state.styleClipboard || finishLocked ? 'disabled' : ''}>Paste Style</button>
        </div>
    </div>`;

const symmetryFieldHtml = (items) => {
    const button = items.length > 1
        ? (canFlipSelection()
            ? '<button type="button" class="btn-secondary" id="flip-horizontal-btn" title="Mirror the selection across its own vertical center line">Flip Horizontally</button>'
            : '')
        : `<button type="button" class="btn-secondary" id="mirror-wall-btn" title="Mirror the item across the wall's vertical center line" ${items[0].locked ? 'disabled' : ''}>Mirror Across Wall</button>`;
    return button ? `
    <div class="inspector-field">
        <label>Symmetry</label>
        ${button}
    </div>` : '';
};

const rotationFieldHtml = (readout, items) => `
    <div class="inspector-field">
        <label>Rotation${readout ? ` <span class="rotation-readout" id="rotation-readout">${readout}</span>` : ''}</label>
        <button type="button" class="btn-secondary rotate-btn" id="rotate-item-btn" title="${items.length > 1 ? 'Turn groups as a whole and other items in place' : 'Turn the item about its center'}, 90 degrees clockwise (R)" ${canRotateSelection() ? '' : 'disabled'}>
            <span class="rotate-icon" aria-hidden="true"></span>Rotate 90 Degrees
        </button>
    </div>`;

function renderItemInspector(item) {
    const ledOn = isLedOn(item);
    const feature = isFeature(item);
    const locked = item.locked === true;
    const lockedAttr = locked ? 'disabled' : '';
    const layerIndex = state.wallItems.indexOf(item);
    const [minWidthCm, minHeightCm] = minSizeCm(item.rotation);
    const lockedParts = feature ? 'Position, size, rotation and removal' : 'Position, size, rotation, finish, backlight and removal';
    const groupLabel = item.groupId ? groupLabels().get(item.groupId) : '';

    const furnitureFields = `
            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtonsHtml(item.finish || 'walnut', locked)}</div>
            </div>

            <button type="button" id="led-toggle-btn" class="led-toggle ${ledOn ? 'is-on' : ''}" role="switch" aria-checked="${ledOn}" ${lockedAttr}>
                <span class="led-toggle-track" aria-hidden="true"><span class="led-toggle-thumb"></span></span>
                <span class="led-toggle-text">Backlight LED: <strong class="led-toggle-state">${ledOn ? 'ON' : 'OFF'}</strong></span>
            </button>

            <div class="inspector-field">
                <label for="item-led-color">Independent LED Color</label>
                <div class="color-input-wrapper">
                    <input type="color" id="item-led-color" value="${ledColorOf(item)}" title="LED color for this item only" ${lockedAttr}>
                    <span id="item-led-hex" class="hex-readout"></span>
                    <button type="button" id="item-led-reset" class="btn-secondary led-reset" title="Follow the global lighting color again">Use Global</button>
                </div>
            </div>`;
    const featureNote = isNote(item)
        ? `
            <div class="inspector-field">
                <label for="note-text">Note Text</label>
                <textarea id="note-text" class="note-field" rows="3" maxlength="${NOTE_MAX_LENGTH}" spellcheck="false" ${lockedAttr}>${escapeHtml(item.text)}</textarea>
            </div>
            <p class="feature-note" id="feature-note">An annotation: notes never collide, add nothing to the estimate and can also be edited by double-clicking them on the wall.</p>`
        : `
            <p class="feature-note" id="feature-note">A no-build zone: furniture placed over it is flagged red. Room features add nothing to the estimate and carry no finish or lighting.</p>`;
    const groupNote = groupLabel
        ? `
            <div class="group-note" id="group-note">
                <span>Part of <strong>${groupLabel}</strong></span>
                <button type="button" class="btn-secondary" id="select-group-btn" title="Select every item in ${groupLabel}">Select Group</button>
            </div>`
        : '';

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <div class="selected-item-header">
                <span class="selected-item-title">${escapeHtml(item.name)}</span>
                <span class="selected-item-meta">
                    ${locked ? `<span class="lock-badge">${LOCK_ICON_HTML}Locked</span>` : ''}
                    ${feature ? '<span class="feature-badge">Room Feature</span>' : `<span>${formatPrice(item.price, state.currency)}</span>`}
                </span>
            </div>
            <span class="tech-readout">Offset: <strong id="inspector-pos-readout">${formatOffset(item)}</strong></span>
            ${feature ? '' : '<p id="ergonomic-hint" class="ergonomic-hint" aria-live="polite"></p>'}
            ${feature ? '' : '<div id="inspector-stock-badge" class="stock-badge" role="status" data-stock-status="in-stock"></div>'}
            ${locked ? `<p class="lock-note" id="lock-note">${lockedParts} are locked. Press L or Unlock Item to edit.</p>` : ''}
            ${groupNote}

            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-left-cm">Left X (cm)</label>
                    <input type="number" id="edit-left-cm" class="dim-input" min="0" max="${state.wallWidthCm - toCm(item.width)}" value="${toCm(item.left)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-top-cm">Top Y (cm)</label>
                    <input type="number" id="edit-top-cm" class="dim-input" min="0" max="${state.wallHeightCm - toCm(item.height)}" value="${toCm(item.top)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="${minWidthCm}" max="${state.wallWidthCm}" value="${toCm(item.width)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="${minHeightCm}" max="${state.wallHeightCm}" value="${toCm(item.height)}" ${lockedAttr}>
                </div>
                <div class="inspector-field depth-field">
                    <label for="edit-depth-cm">Depth (cm)</label>
                    <input type="number" id="edit-depth-cm" class="dim-input depth-input" value="${item.depth ?? 0}" readonly aria-readonly="true" tabindex="-1" title="Wall-to-front extrusion, reserved for the 3D view">
                </div>
            </div>
            ${centerWallFieldHtml()}
            ${feature ? featureNote : furnitureFields}
            ${item.type === 'poster' ? posterArtFieldHtml([item], locked) : ''}
            ${feature ? '' : styleFieldHtml(locked)}

            ${rotationFieldHtml(`${item.rotation} deg`, [item])}
            ${symmetryFieldHtml([item])}
            ${layerFieldHtml(`${layerIndex + 1} of ${state.wallItems.length}`)}
            ${WARNINGS_HTML}

            <div class="inspector-actions">
                <button type="button" class="btn-secondary lock-toggle ${locked ? 'is-locked' : ''}" id="lock-toggle-btn" aria-pressed="${locked}" title="${locked ? 'Unlock' : 'Lock'} (L)">${LOCK_ICON_HTML}${locked ? 'Unlock Item' : 'Lock Item'}</button>
                <button class="btn-secondary" id="duplicate-item-btn" title="Duplicate (Ctrl+D)">Duplicate Item</button>
                <button class="btn-danger" id="delete-item-btn" title="Remove (Delete)" ${lockedAttr}>Remove Item</button>
            </div>
        </div>
    `;

    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');

    function applyDimensionChange() {
        if (item.locked) return;

        const rawW = parseInt(widthInput.value, 10) || toCm(item.width);
        const rawH = parseInt(heightInput.value, 10) || toCm(item.height);

        const clampedW = clamp(rawW, minWidthCm, state.wallWidthCm);
        const clampedH = clamp(rawH, minHeightCm, state.wallHeightCm);

        // Whole cm always map to a multiple of 0.5 px, so no rounding is needed here
        item.width = clampedW * SCALE;
        item.height = clampedH * SCALE;

        // Keep item inside wall if resized near the right/bottom edge
        item.left = clamp(item.left, 0, state.wallWidthPx - item.width);
        item.top = clamp(item.top, 0, state.wallHeightPx - item.height);

        widthInput.value = clampedW;
        heightInput.value = clampedH;

        renderPlanner();
        updateInspectorLive();
        commitLayoutChange();
    }

    widthInput.addEventListener('change', applyDimensionChange);
    heightInput.addEventListener('change', applyDimensionChange);

    const leftInput = document.getElementById('edit-left-cm');
    const topInput = document.getElementById('edit-top-cm');

    // Typed offsets are rounded to whole cm and clamped so the whole item stays on the wall
    function applyPositionChange() {
        if (item.locked) return;

        const readCm = (input, currentPx, maxCm) => {
            const value = Math.round(parseFloat(input.value));
            return clamp(Number.isFinite(value) ? value : toCm(currentPx), 0, maxCm);
        };
        const leftCm = readCm(leftInput, item.left, state.wallWidthCm - toCm(item.width));
        const topCm = readCm(topInput, item.top, state.wallHeightCm - toCm(item.height));
        leftInput.value = leftCm;
        topInput.value = topCm;
        if (item.left === leftCm * SCALE && item.top === topCm * SCALE) return;

        item.left = leftCm * SCALE;
        item.top = topCm * SCALE;
        syncPositions([{ item, element: getItemElement(item.id) }]);
        commitLayoutChange();
    }

    leftInput.addEventListener('change', applyPositionChange);
    topInput.addEventListener('change', applyPositionChange);
    document.getElementById('select-group-btn')?.addEventListener('click', () => selectWithGroups(item.id));

    // Typing previews on the wall at once; leaving the field saves the cleaned text as one step
    const noteField = document.getElementById('note-text');
    if (noteField) {
        noteField.addEventListener('input', () => {
            const label = getItemElement(item.id)?.querySelector('.item-label');
            if (label) label.textContent = noteField.value.trim() ? noteField.value : DEFAULT_NOTE_TEXT;
        });
        noteField.addEventListener('change', () => {
            setNoteText(item, noteField.value);
            noteField.value = item.text;
        });
    }
    if (feature) return;

    const ledToggleBtn = document.getElementById('led-toggle-btn');
    ledToggleBtn.addEventListener('click', () => {
        if (item.locked) return;
        item.ledEnabled = !isLedOn(item);
        const el = getItemElement(item.id);
        if (el) el.classList.toggle('led-off', !item.ledEnabled);
        syncLedToggle(ledToggleBtn, item.ledEnabled);
        refreshPowerRoutes();
        renderIllumination();
        commitLayoutChange();
    });

    // Dragging inside the picker fires input many times and change once, so the history gets one step
    const ledPicker = document.getElementById('item-led-color');
    ledPicker.addEventListener('input', () => setItemLedColor(item, ledPicker.value));
    ledPicker.addEventListener('change', () => {
        setItemLedColor(item, ledPicker.value);
        commitLayoutChange();
    });
    document.getElementById('item-led-reset').addEventListener('click', () => {
        setItemLedColor(item, null);
        commitLayoutChange();
    });
    syncItemLedField();
}

function renderBatchInspector(items) {
    const count = items.length;
    const lockedCount = items.filter(item => item.locked).length;
    const removable = count - lockedCount;
    const allLocked = lockedCount === count;
    const finishable = items.filter(item => !isFeature(item));
    const groupId = selectedGroupId();
    const title = groupId ? groupLabels().get(groupId) : `${count} items selected`;
    const grouping = canGroup()
        ? `<button type="button" class="btn-secondary" id="group-toggle-btn" title="Bundle the selection into one group (Ctrl+G)">Group Selection</button>`
        : `<button type="button" class="btn-secondary" id="group-toggle-btn" title="Dissolve the group back into single items (Ctrl+Shift+G)">Ungroup</button>`;
    const sharedFinish = finishable.length && finishable.every(item => item.finish === finishable[0].finish)
        ? finishable[0].finish
        : null;
    const finishLocked = !finishable.some(item => !item.locked);
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const lockNote = lockedCount
        ? `<p class="lock-note" id="lock-note">${lockedCount} of ${count} items are locked, so the group stays in place. Rotation, finish changes and removal skip locked items.</p>`
        : '';

    inspectorBox.innerHTML = `
        <div class="selected-item-info is-batch">
            <div class="selected-item-header">
                <span class="selected-item-title" id="batch-count">${title}</span>
                <span class="selected-item-meta">
                    ${lockedCount ? `<span class="lock-badge">${LOCK_ICON_HTML}${lockedCount} Locked</span>` : ''}
                    <span>${formatPrice(total, state.currency)}</span>
                </span>
            </div>
            <span class="tech-readout">Group: <strong id="inspector-pos-readout">${formatOffset(getBounds(items))}</strong></span>
            <span class="tech-readout">Footprint: <strong id="batch-footprint-readout">${formatFootprint(getBounds(items))}</strong></span>
            ${groupId ? `<span class="group-count">${count} items grouped</span>` : ''}
            ${lockNote}
            ${arrangeFieldHtml()}
            ${centerWallFieldHtml()}

            <div class="inspector-field">
                <label>Grouping</label>
                ${grouping}
            </div>

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtonsHtml(sharedFinish, finishLocked)}</div>
            </div>
            ${posterArtFieldHtml(items.filter(item => item.type === 'poster' && !item.locked))}
            ${finishable.length ? styleFieldHtml(finishLocked) : ''}

            ${rotationFieldHtml('', items)}
            ${symmetryFieldHtml(items)}
            ${layerFieldHtml('')}
            ${WARNINGS_HTML}

            <div class="inspector-actions">
                <button type="button" class="btn-secondary lock-toggle ${allLocked ? 'is-locked' : ''}" id="lock-toggle-btn" aria-pressed="${allLocked}" title="${allLocked ? 'Unlock' : 'Lock'} all selected items (L)">${LOCK_ICON_HTML}${allLocked ? 'Unlock All' : 'Lock All'}</button>
                <button class="btn-secondary" id="duplicate-item-btn" title="Duplicate the selection (Ctrl+D)">Duplicate ${count} Items</button>
                <button class="btn-danger" id="delete-item-btn" title="Remove the unlocked items (Delete)" ${removable ? '' : 'disabled'}>Remove ${removable} Item${removable === 1 ? '' : 's'}</button>
            </div>
        </div>
    `;
}

export function updateInspectorPanel() {
    // Rebuilding the panel drops keyboard focus, so it is handed back to the same control afterwards
    const focusedId = inspectorBox.contains(document.activeElement) ? document.activeElement.id : '';
    const selected = getSelectedItems();

    if (!selected.length) {
        inspectorBox.innerHTML = EMPTY_INSPECTOR_HTML;
        return;
    }

    if (selected.length === 1) renderItemInspector(selected[0]);
    else renderBatchInspector(selected);
    updateInspectorLive();

    inspectorBox.querySelectorAll('.btn-finish').forEach(btn => {
        btn.addEventListener('click', () => applyFinish(btn.dataset.finish));
    });
    inspectorBox.querySelectorAll('.btn-poster-art').forEach(btn => {
        btn.addEventListener('click', () => applyPosterArt(btn.dataset.posterArt));
    });
    inspectorBox.querySelectorAll('[data-arrange]').forEach(btn => {
        btn.addEventListener('click', () => runArrange(btn.dataset.arrange));
    });
    document.getElementById('rotate-item-btn').addEventListener('click', rotateSelection);
    document.getElementById('center-wall-h-btn')?.addEventListener('click', () => centerSelectionOnWall('x'));
    document.getElementById('center-wall-v-btn')?.addEventListener('click', () => centerSelectionOnWall('y'));
    document.getElementById('flip-horizontal-btn')?.addEventListener('click', flipSelection);
    document.getElementById('mirror-wall-btn')?.addEventListener('click', mirrorItemAcrossWall);
    document.getElementById('copy-style-btn')?.addEventListener('click', copySelectedStyle);
    document.getElementById('paste-style-btn')?.addEventListener('click', pasteStyleToSelection);
    document.getElementById('group-toggle-btn')?.addEventListener('click', () => (canGroup() ? groupSelection() : ungroupSelection()));
    document.getElementById('send-backward-btn').addEventListener('click', () => moveSelectedLayer(-1));
    document.getElementById('bring-forward-btn').addEventListener('click', () => moveSelectedLayer(1));
    document.getElementById('lock-toggle-btn').addEventListener('click', toggleSelectedLock);
    document.getElementById('duplicate-item-btn').addEventListener('click', duplicateSelectedItem);
    document.getElementById('delete-item-btn').addEventListener('click', removeSelectedItems);

    if (focusedId) {
        const target = document.getElementById(focusedId);
        if (target && !target.disabled) target.focus();
    }
}

export const isContextMenuOpen = () => !contextMenu.hidden;

const CONTEXT_ACTIONS = {
    duplicate: duplicateSelectedItem,
    group: groupSelection,
    ungroup: ungroupSelection,
    front: () => moveSelectedLayerToEdge(true),
    forward: () => moveSelectedLayer(1),
    backward: () => moveSelectedLayer(-1),
    back: () => moveSelectedLayerToEdge(false),
    rotate: rotateSelection,
    lock: toggleSelectedLock,
    delete: removeSelectedItems
};

function syncContextMenu() {
    const items = getSelectedItems();
    const allLocked = items.every(item => item.locked);
    const lockLabel = allLocked ? 'Unlock' : 'Lock';
    const state = {
        duplicate: { disabled: false },
        group: { disabled: !canGroup() },
        ungroup: { disabled: !canUngroup() },
        front: { disabled: !canMoveLayerToEdge(true) },
        forward: { disabled: !canMoveLayer(1) },
        backward: { disabled: !canMoveLayer(-1) },
        back: { disabled: !canMoveLayerToEdge(false) },
        rotate: { disabled: !canRotateSelection() },
        lock: { disabled: false, label: items.length > 1 ? `${lockLabel} All` : lockLabel },
        delete: { disabled: allLocked }
    };

    const groupId = selectedGroupId();
    contextMenuTitle.textContent = groupId
        ? groupLabels().get(groupId)
        : (items.length === 1 ? layerName(items[0]) : `${items.length} items selected`);
    contextMenuButtons.forEach(button => {
        const { disabled, label } = state[button.dataset.action];
        button.disabled = disabled;
        if (label) button.querySelector('.context-menu-label').textContent = label;
    });
}

// Measured once visible, then flipped across the cursor wherever it would run past the viewport
export function openContextMenu(clientX, clientY) {
    syncContextMenu();
    contextMenu.hidden = false;

    const width = contextMenu.offsetWidth;
    const height = contextMenu.offsetHeight;
    const flipX = clientX + width + MENU_EDGE_PX > window.innerWidth;
    const flipY = clientY + height + MENU_EDGE_PX > window.innerHeight;
    const left = clamp(flipX ? clientX - width : clientX, MENU_EDGE_PX, window.innerWidth - width - MENU_EDGE_PX);
    const top = clamp(flipY ? clientY - height : clientY, MENU_EDGE_PX, window.innerHeight - height - MENU_EDGE_PX);

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.transformOrigin = `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`;
    refreshMeasure();
    // The panel takes focus rather than its first item, so a mouse open shows no highlighted row
    // while the arrow keys still start from the top or the bottom
    contextMenu.focus({ preventScroll: true });
}

export function closeContextMenu() {
    if (contextMenu.hidden) return;
    contextMenu.hidden = true;
    if (contextMenu.contains(document.activeElement)) document.activeElement.blur();
}

// While the menu is open the arrows walk its items and Escape or Tab dismisses it. Any other key closes
// the menu and carries on, so the shortcut printed next to an item still does its job.
export function handleContextMenuKey(e) {
    const enabled = contextMenuButtons.filter(button => !button.disabled);
    const index = enabled.indexOf(document.activeElement);
    const moves = {
        ArrowDown: index + 1,
        ArrowUp: index < 0 ? enabled.length - 1 : index - 1,
        Home: 0,
        End: enabled.length - 1
    };

    if (e.key in moves) {
        e.preventDefault();
        enabled[(moves[e.key] + enabled.length) % enabled.length]?.focus();
        return true;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        closeContextMenu();
        return true;
    }
    // Enter and Space press the focused item through the button's own activation
    if ((e.key === 'Enter' || e.key === ' ') && contextMenu.contains(e.target)) return true;

    closeContextMenu();
    return false;
}

// Commands are rebuilt each time the palette opens, so selection entries and on/off hints match the
// moment. Each one calls the same function as its button, card or shortcut.
function buildCommands() {
    const commands = [];
    const add = (group, label, run, hint = '') => commands.push({ group, label, run, hint });
    const onOff = (on) => (on ? 'On' : 'Off');
    const selected = getSelectedItems();
    const creator = isCreatorMode();

    if (selected.length) {
        if (canCenterSelection()) {
            add('Selection', 'Center Horizontally on Wall', () => centerSelectionOnWall('x'), countLabel(selected.length));
            add('Selection', 'Center Vertically on Wall', () => centerSelectionOnWall('y'), countLabel(selected.length));
        }
        add('Selection', 'Duplicate Selection', duplicateSelectedItem, 'Ctrl+D');
        add('Selection', 'Lock / Unlock Selection', toggleSelectedLock, 'L');
        if (selected.some(item => !item.locked)) add('Selection', 'Remove Selection', removeSelectedItems, 'Del');
        if (canCopyStyle()) add('Selection', 'Copy Item Style', copySelectedStyle, 'Alt+Shift+C');
        if (canPasteStyle()) add('Selection', 'Paste Item Style', pasteStyleToSelection, 'Alt+Shift+V');
        if (canMoveLayerToEdge(true)) add('Selection', 'Bring to Front', () => moveSelectedLayerToEdge(true), ']');
        if (canMoveLayerToEdge(false)) add('Selection', 'Send to Back', () => moveSelectedLayerToEdge(false), '[');
    }

    catalogItems.forEach(card => {
        // Creator Mode keeps the room features out of the catalog, so the palette leaves them out too
        if (creator && FEATURE_TYPES.includes(card.dataset.type)) return;
        const size = `${toCm(parseFloat(card.dataset.width))} x ${toCm(parseFloat(card.dataset.height))} cm`;
        add('Mount', `Mount: ${card.dataset.name}`, () => spawnFromCatalog(card), size);
    });

    add('Wall & View', 'Toggle Ambient / Daylight Mode', toggleAmbientMode, state.isAmbientMode ? 'Ambient' : 'Daylight');
    add('Wall & View', 'Toggle Snap 5cm Grid', () => snapGridToggle.click(), onOff(snapGridToggle.checked));
    add('Wall & View', 'Toggle Attic Slope', () => atticSlopeToggle.click(), onOff(atticSlopeToggle.checked));
    if (!creator) add('Wall & View', 'Toggle Power Routing Overlay', () => setPowerRouting(!state.powerRoutingOn), onOff(state.powerRoutingOn));
    add('Wall & View', 'Reset Zoom & Pan', resetView, 'Ctrl+0');
    if (!creator) add('Wall & View', 'Clear Reference Guides', clearGuides, state.wallGuides.length ? `${state.wallGuides.length} placed` : 'None placed');
    add('Wall & View', 'View: Switch to Creator Mode', () => setStudioMode('creator'), creator ? 'Current' : 'Alt+M');
    add('Wall & View', 'View: Switch to Engineer Mode', () => setStudioMode('engineer'), creator ? 'Alt+M' : 'Current');
    add('Wall & View', 'Backdrop: None', () => setFloorBackdrop('none'), state.floorBackdrop === 'none' ? 'Current' : '');
    Object.entries(FLOOR_BACKDROPS).forEach(([kind, { name, widthCm }]) => {
        add('Wall & View', `Backdrop: ${name} (${widthCm} cm)`, () => setFloorBackdrop(kind), state.floorBackdrop === kind ? 'Current' : '');
    });
    // Like the Inspector row, the alignment entries only appear while a floor reference is shown
    if (state.floorBackdrop !== 'none') {
        BACKDROP_ALIGNS.forEach(({ id, label }) => {
            add('Wall & View', `Backdrop Align: ${label}`, () => setFloorBackdropAlign(id), state.floorBackdropAlign === id ? 'Current' : '');
        });
    }

    presetButtons.forEach(button => add('Lighting & Paint', `Preset: ${button.textContent.trim()}`, () => button.click()));
    WALL_PAINTS.forEach(paint => {
        add('Lighting & Paint', `Wall Paint: ${paint.label}`, () => setWallPaint(paint.id), paint.id === state.wallPaint ? 'Current' : '');
    });

    add('Project & Export', 'Open My Projects', openProjects);
    add('Project & Export', 'Open Installation Spec Sheet', openSpecSheet);
    add('Project & Export', 'Export Layout JSON', exportLayout);
    add('Project & Export', 'Export Plan PNG', exportPng);
    add('Project & Export', 'Export Spec Sheet CSV', exportSpecCsv);

    return commands;
}

const palette = { commands: [], matches: [], active: -1 };

// Every typed word has to appear somewhere in the group name or the label, in any order
function matchCommands(query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return palette.commands.filter(command => {
        const text = `${command.group} ${command.label}`.toLowerCase();
        return tokens.every(token => text.includes(token));
    });
}

function setActiveCommand(index, reveal = true) {
    palette.active = index;
    commandList.querySelectorAll('[role="option"]').forEach(option => {
        const active = Number(option.dataset.index) === index;
        option.classList.toggle('is-active', active);
        option.setAttribute('aria-selected', String(active));
        if (active && reveal) option.scrollIntoView({ block: 'nearest' });
    });
    if (index >= 0) commandSearchInput.setAttribute('aria-activedescendant', `command-option-${index}`);
    else commandSearchInput.removeAttribute('aria-activedescendant');
}

function renderCommandList() {
    const query = commandSearchInput.value.trim();
    palette.matches = matchCommands(query);

    const groups = [];
    palette.matches.forEach((command, index) => {
        if (groups.at(-1)?.name !== command.group) groups.push({ name: command.group, rows: [] });
        groups.at(-1).rows.push(`
            <li class="command-item" role="option" id="command-option-${index}" data-index="${index}" aria-selected="false">
                <span class="command-label">${escapeHtml(command.label)}</span>
                ${command.hint ? `<span class="command-hint">${escapeHtml(command.hint)}</span>` : ''}
            </li>`);
    });
    commandList.innerHTML = groups.map((group, n) => `
        <li class="command-group" role="group" aria-labelledby="command-group-${n}">
            <span class="command-group-label" id="command-group-${n}">${escapeHtml(group.name)}</span>
            <ul class="command-group-items" role="none">${group.rows.join('')}</ul>
        </li>`).join('');

    commandList.hidden = !palette.matches.length;
    commandEmpty.hidden = palette.matches.length > 0;
    commandEmpty.textContent = palette.matches.length ? '' : `No commands match "${query}"`;
    commandList.scrollTop = 0;
    setActiveCommand(palette.matches.length ? 0 : -1);
}

function moveActiveCommand(step) {
    const count = palette.matches.length;
    if (count) setActiveCommand((palette.active + step + count) % count);
}

// Opened from bare page, the palette has nowhere to hand focus back to, and a hidden search field that kept
// it would swallow the next shortcut. The close event is queued and can land after a quick reopen.
function releasePaletteFocus() {
    if (!commandPalette.open && commandPalette.contains(document.activeElement)) document.activeElement.blur();
}

// The search field lets go of focus in the same task that shuts the dialog, so a shortcut pressed right
// after the close can never land in the hidden field while the queued close event is still on its way
function closeCommandPalette() {
    commandPalette.close();
    commandSearchInput.blur();
}

// The palette closes first, so a command that opens a dialog of its own finds no modal in the way
function runCommand(index) {
    const command = palette.matches[index];
    if (!command) return;
    closeCommandPalette();
    command.run();
}

export function openCommandPalette() {
    if (isModalOpen() || isPointerBusy()) return;
    closeContextMenu();
    palette.commands = buildCommands();
    commandSearchInput.value = '';
    renderCommandList();
    commandPalette.showModal();
    commandSearchInput.focus();
}

export function toggleCommandPalette() {
    if (commandPalette.open) closeCommandPalette();
    else openCommandPalette();
}

export function bindInspectorEvents() {
    currencySelector.addEventListener('change', () => setCurrency(currencySelector.value));

    wallItemsLayer.addEventListener('dblclick', (e) => {
        const el = e.target.closest('.wall-item');
        const item = el && state.wallItems.find(i => i.id === el.dataset.id);
        if (!item || isPointerBusy()) return;

        if (isNote(item)) startNoteEdit(item, el);
        // Anywhere else a double-click steps into the group and picks just that member
        else if (item.groupId) selectItem(item.id);
    });

    layerList.addEventListener('click', (e) => {
        const row = e.target.closest('.layer-row');
        const button = e.target.closest('button');
        if (!row || !button) return;

        const key = row.dataset.layer;
        if (button.classList.contains('layer-caret')) {
            const groupId = row.dataset.groupId;
            if (collapsedGroups.has(groupId)) collapsedGroups.delete(groupId);
            else collapsedGroups.add(groupId);
            renderLayers();
        } else if (button.classList.contains('layer-eye')) {
            toggleLayerFlag(key, 'hidden');
        } else if (button.classList.contains('layer-lock')) {
            toggleLayerFlag(key, 'locked');
        } else if (button.classList.contains('layer-name')) {
            // A member row picks just that member, so a group's parts can still be edited one by one
            const ids = layerItems(key).map(item => item.id);
            if (!e.shiftKey) setSelection(ids);
            else if (ids.every(isSelected)) setSelection(state.selectedItemIds.filter(id => !ids.includes(id)));
            else setSelection([...state.selectedItemIds, ...ids]);
        }
    });

    layerList.addEventListener('dragstart', (e) => {
        const row = e.target instanceof Element ? e.target.closest('.layer-row') : null;
        if (!row) return;

        layerDrag = { key: row.dataset.layer, groupId: row.classList.contains('is-child') ? row.dataset.group : null };
        row.classList.add('is-dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', row.dataset.layer);
        }
    });

    layerList.addEventListener('dragover', (e) => {
        const drop = resolveLayerDrop(e);
        clearLayerMarkers();
        if (!drop) return;

        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        drop.marker.classList.add(drop.place === 'above' ? 'drop-above' : 'drop-below');
    });

    layerList.addEventListener('drop', (e) => {
        const drop = resolveLayerDrop(e);
        const drag = layerDrag;
        e.preventDefault();
        clearLayerMarkers();
        layerDrag = null;
        if (drop && drag) reorderLayer(drag.key, drop.key, drop.place, drag.groupId);
    });

    layerList.addEventListener('dragend', () => {
        layerDrag = null;
        clearLayerMarkers();
        layerList.querySelectorAll('.is-dragging').forEach(row => row.classList.remove('is-dragging'));
    });

    layersToggle.addEventListener('click', () => {
        const collapsed = layersPanel.classList.toggle('is-collapsed');
        layersToggle.setAttribute('aria-expanded', !collapsed);
        layersToggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} the layer list`);
        layersToggle.title = `${collapsed ? 'Expand' : 'Collapse'} the layer list`;
    });

    wallItemsLayer.addEventListener('contextmenu', (e) => {
        const el = e.target.closest('.wall-item');
        if (!el) return;

        e.preventDefault();
        if (isPointerBusy() || isModalOpen()) return;
        if (!isSelected(el.dataset.id)) selectWithGroups(el.dataset.id);
        openContextMenu(e.clientX, e.clientY);
    });

    contextMenu.addEventListener('contextmenu', (e) => e.preventDefault());

    contextMenu.addEventListener('click', (e) => {
        const button = e.target.closest('.context-menu-item');
        if (!button || button.disabled) return;
        closeContextMenu();
        CONTEXT_ACTIONS[button.dataset.action]();
    });

    // Capture phase, so a press anywhere else closes the menu before that press does its own work
    window.addEventListener('mousedown', (e) => {
        if (isContextMenuOpen() && !contextMenu.contains(e.target)) closeContextMenu();
    }, true);

    commandSearchInput.addEventListener('input', renderCommandList);

    commandSearchInput.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveActiveCommand(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            runCommand(palette.active);
        }
    });

    // Pressing a row keeps focus in the search field; hovering moves the highlight without scrolling the list
    commandList.addEventListener('mousedown', (e) => e.preventDefault());

    commandList.addEventListener('mousemove', (e) => {
        const option = e.target.closest('[role="option"]');
        if (option && Number(option.dataset.index) !== palette.active) setActiveCommand(Number(option.dataset.index), false);
    });

    commandList.addEventListener('click', (e) => {
        const option = e.target.closest('[role="option"]');
        if (option) runCommand(Number(option.dataset.index));
    });

    // Escape still closes through the native cancel step; the field just lets go of focus first
    commandPalette.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.isComposing) commandSearchInput.blur();
    });
    commandPalette.addEventListener('cancel', () => { commandSearchInput.blur(); });
    commandPalette.addEventListener('close', releasePaletteFocus);
    commandPaletteBtn.addEventListener('click', toggleCommandPalette);

    window.addEventListener('resize', closeContextMenu);
}
