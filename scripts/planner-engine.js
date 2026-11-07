const SCALE = 2.5; // 1 cm = 2.5 px
const WALL_WIDTH = 750;
const WALL_HEIGHT = 625;
const CM_STEP_PX = SCALE;
const SNAP_STEP_PX = 5 * SCALE; // 5 cm grid step (12.5 px)
const ATTIC_SLOPE_PX = 90 * SCALE; // 90 x 90 cm roof cut-out (225 px)
const DUPLICATE_OFFSET_PX = 4 * SCALE; // 4 cm (10 px)
const MIN_WIDTH_CM = 8;
const MIN_HEIGHT_CM = 4;
const STORAGE_KEY = 'spatial_studio_state_v1';
const EXPORT_VERSION = '0.7';
const EXPORT_FILENAME = 'spatial-studio-layout.json';

const HISTORY_LIMIT = 30;
const NUDGE_MERGE_WINDOW_MS = 600;
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ITEMS = 200;
const MAX_NAME_LENGTH = 40;

const ITEM_TYPES = ['shelf', 'cube', 'poster', 'spotlight', 'corner-lamp'];
const SAFE_ID_PATTERN = /^item-[a-z0-9-]{1,40}$/i;

const FINISHES = [
    { id: 'walnut', label: 'Walnut' },
    { id: 'oak', label: 'Oak' },
    { id: 'black', label: 'Black' },
    { id: 'white', label: 'White' }
];
const FINISH_IDS = FINISHES.map(f => f.id);

const NUDGE_KEYS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};

// Shortcut guards only care about fields where Ctrl+Z means "undo my typing"
const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file'];

const wallCanvas = document.getElementById('wall');
const wallItemsLayer = document.getElementById('wall-items');
const atticZone = document.getElementById('attic-zone');
const guideX = document.getElementById('guide-x');
const guideY = document.getElementById('guide-y');
const guideXLabel = guideX.querySelector('.guide-label');
const guideYLabel = guideY.querySelector('.guide-label');

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const resetWallBtn = document.getElementById('reset-wall-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const snapGridToggle = document.getElementById('snap-grid-toggle');
const atticSlopeToggle = document.getElementById('attic-slope-toggle');
const catalogItems = document.querySelectorAll('.catalog-item');
const totalPriceDisplay = document.getElementById('total-price');
const inspectorBox = document.getElementById('inspector-box');

const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file-input');
const ioStatus = document.getElementById('io-status');

const accentColorPicker = document.getElementById('accent-color-picker');
const accentHexCode = document.getElementById('accent-hex-code');
const cornerColorPicker = document.getElementById('corner-color-picker');
const cornerHexCode = document.getElementById('corner-hex-code');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
const presetButtons = document.querySelectorAll('.btn-preset');

// Import fallbacks come straight from the catalog markup so there is one source of truth
const CATALOG_DEFAULTS = Object.fromEntries([...catalogItems].map(el => [el.dataset.type, {
    name: el.dataset.name,
    price: parseFloat(el.dataset.price),
    width: parseInt(el.dataset.width, 10),
    height: parseInt(el.dataset.height, 10),
    finish: el.dataset.finish || 'walnut'
}]));

const defaultItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut' },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black' }
];

let isAmbientMode = true;
let selectedItemId = null;
let wallItems = [];
let justDragged = false;
let idCounter = 0;
let ioStatusTimer = 0;

let historyStack = [];
let historyIndex = -1;
let lastHistoryPush = { mergeKey: null, time: 0 };

const createIdleDragState = () => ({
    isDragging: false,
    itemId: null,
    element: null,
    wallRect: null,
    offsetX: 0,
    offsetY: 0,
    pointerX: 0,
    pointerY: 0,
    startLeft: 0,
    startTop: 0,
    frameId: 0
});

let dragState = createIdleDragState();

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultItems));
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const quantize = (px, step) => Math.round(px / step) * step;
const toCm = (px) => Math.round(px / SCALE);
const formatOffset = (item) => `${toCm(item.left)} cm (X), ${toCm(item.top)} cm (Y)`;
const getSelectedItem = () => wallItems.find(i => i.id === selectedItemId);
const getItemElement = (itemId) => wallItemsLayer.querySelector(`.wall-item[data-id="${itemId}"]`);
const createItemId = () => `item-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const isTextEntry = (el) =>
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.includes(el.type));

function saveState() {
    const payload = {
        items: wallItems,
        accentColor: accentColorPicker.value,
        cornerColor: cornerColorPicker.value,
        brightness: brightnessSlider.value,
        atticSlope: atticSlopeToggle.checked
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function toFiniteNumber(value) {
    const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

// Rounds a px value to whole centimeters, then clamps it to [minCm, maxCm]
function toCmGrid(px, minCm, maxCm) {
    return clamp(Math.round(px / SCALE), minCm, maxCm) * SCALE;
}

function sanitizeItem(raw, usedIds) {
    if (!raw || typeof raw !== 'object' || !ITEM_TYPES.includes(raw.type)) return null;

    // Keep stable ids across reloads; anything malformed or repeated gets a fresh one
    const id = typeof raw.id === 'string' && SAFE_ID_PATTERN.test(raw.id) && !usedIds.has(raw.id)
        ? raw.id
        : createItemId();
    usedIds.add(id);

    const defaults = CATALOG_DEFAULTS[raw.type];
    const width = toCmGrid(toFiniteNumber(raw.width) ?? defaults.width, MIN_WIDTH_CM, WALL_WIDTH / SCALE);
    const height = toCmGrid(toFiniteNumber(raw.height) ?? defaults.height, MIN_HEIGHT_CM, WALL_HEIGHT / SCALE);
    const price = toFiniteNumber(raw.price);
    const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
        : defaults.name;

    return {
        id,
        type: raw.type,
        name,
        price: price !== null && price >= 0 ? Math.round(price * 100) / 100 : defaults.price,
        left: toCmGrid(toFiniteNumber(raw.left) ?? 0, 0, (WALL_WIDTH - width) / SCALE),
        top: toCmGrid(toFiniteNumber(raw.top) ?? 0, 0, (WALL_HEIGHT - height) / SCALE),
        width,
        height,
        finish: FINISH_IDS.includes(raw.finish) ? raw.finish : defaults.finish
    };
}

// Shared by localStorage restore and file import, so both paths get the same guarantees
function normalizeLayout(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Unrecognized layout format.');
    }

    const rawItems = Array.isArray(data.wallItems) ? data.wallItems : data.items;
    if (!Array.isArray(rawItems)) {
        throw new Error('Layout has no items array.');
    }

    const usedIds = new Set();
    const items = rawItems
        .slice(0, MAX_IMPORT_ITEMS)
        .map(raw => sanitizeItem(raw, usedIds))
        .filter(Boolean);
    if (rawItems.length > 0 && items.length === 0) {
        throw new Error('No valid items found in this file.');
    }

    const brightness = toFiniteNumber(data.brightness);

    return {
        items,
        skipped: rawItems.length - items.length,
        atticSlope: typeof data.atticSlope === 'boolean' ? data.atticSlope : null,
        accentColor: isHexColor(data.accentColor) ? data.accentColor.toLowerCase() : null,
        cornerColor: isHexColor(data.cornerColor) ? data.cornerColor.toLowerCase() : null,
        brightness: brightness === null ? null : clamp(Math.round(brightness), 0, 100)
    };
}

function applyLayoutSettings(layout) {
    wallItems = layout.items;
    if (layout.atticSlope !== null) atticSlopeToggle.checked = layout.atticSlope;
    if (layout.accentColor) updateAccentColor(layout.accentColor, false);
    if (layout.cornerColor) updateCornerColor(layout.cornerColor, false);
    if (layout.brightness !== null) setBrightness(layout.brightness);
}

function loadState() {
    atticSlopeToggle.checked = false;
    wallItems = cloneDefaults();

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
        applyLayoutSettings(normalizeLayout(JSON.parse(raw)));
    } catch {
        wallItems = cloneDefaults();
    }
}

const serializeHistoryState = () => JSON.stringify({ items: wallItems, atticSlope: atticSlopeToggle.checked });

function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function pushHistory(mergeKey = null) {
    const snapshot = serializeHistoryState();
    if (historyStack[historyIndex] === snapshot) return;

    const now = performance.now();
    // Held or rapid arrow nudges on the same item fold into a single undo step
    const canMerge = mergeKey !== null &&
        mergeKey === lastHistoryPush.mergeKey &&
        now - lastHistoryPush.time < NUDGE_MERGE_WINDOW_MS &&
        historyIndex === historyStack.length - 1;

    lastHistoryPush = { mergeKey, time: now };

    if (canMerge) {
        historyStack[historyIndex] = snapshot;
    } else {
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(snapshot);
        if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
        historyIndex = historyStack.length - 1;
    }

    updateHistoryButtons();
}

function commitLayoutChange() {
    pushHistory();
    saveState();
}

function restoreHistoryStep(step) {
    const target = historyIndex + step;
    if (dragState.isDragging || target < 0 || target >= historyStack.length) return;

    historyIndex = target;
    lastHistoryPush = { mergeKey: null, time: 0 };

    const { items, atticSlope } = JSON.parse(historyStack[historyIndex]);
    wallItems = items;
    atticSlopeToggle.checked = atticSlope;
    if (!getSelectedItem()) selectedItemId = null;

    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    updateHistoryButtons();
    saveState();
}

const undo = () => restoreHistoryStep(-1);
const redo = () => restoreHistoryStep(1);

function renderPlanner() {
    wallItemsLayer.innerHTML = wallItems.map(item => {
        const isSelected = item.id === selectedItemId ? 'selected' : '';
        const finishClass = item.finish ? `finish-${item.finish}` : 'finish-walnut';
        return `
            <div class="wall-item ${item.type} ${finishClass} ${isSelected}"
                 data-id="${escapeHtml(item.id)}"
                 style="left: ${item.left}px; top: ${item.top}px; width: ${item.width}px; height: ${item.height}px;">
                <span class="item-label">${escapeHtml(item.name)}</span>
            </div>
        `;
    }).join('');

    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    updateCollisionStates();
    updateDistanceGuides();

    const totalPrice = wallItems.reduce((sum, item) => sum + item.price, 0);
    totalPriceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
}

function isOverlapping(a, b) {
    return (
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top
    );
}

function hasOverlap(targetItem) {
    return wallItems.some(other => other.id !== targetItem.id && isOverlapping(targetItem, other));
}

// The slope edge follows y = x - (WALL_WIDTH - S). For an axis-aligned box the top-right
// corner is the point that reaches furthest past that line, so testing it alone is exact.
function intrudesAtticSlope(item) {
    if (!atticSlopeToggle.checked) return false;

    const slopeStartX = WALL_WIDTH - ATTIC_SLOPE_PX;
    const itemRight = item.left + item.width;
    return itemRight > slopeStartX && item.top < itemRight - slopeStartX;
}

function isColliding(item) {
    return hasOverlap(item) || intrudesAtticSlope(item);
}

function updateCollisionStates() {
    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        const item = wallItems.find(i => i.id === el.dataset.id);
        if (item) {
            el.classList.toggle('colliding', isColliding(item));
        }
    });
}

function updateDistanceGuides() {
    const item = getSelectedItem();
    if (!item) {
        guideX.hidden = true;
        guideY.hidden = true;
        return;
    }

    // Rulers run along the item's center axes; a zero-length ruler has nothing to measure
    const centerY = Math.round(item.top + item.height / 2);
    const centerX = Math.round(item.left + item.width / 2);

    guideX.hidden = item.left <= 0;
    guideX.style.top = `${centerY}px`;
    guideX.style.width = `${item.left}px`;
    guideXLabel.textContent = `${toCm(item.left)} cm`;

    guideY.hidden = item.top <= 0;
    guideY.style.left = `${centerX}px`;
    guideY.style.height = `${item.top}px`;
    guideYLabel.textContent = `${toCm(item.top)} cm`;
}

function updateInspectorLive(item) {
    const posReadout = document.getElementById('inspector-pos-readout');
    if (!posReadout || !item) return;

    posReadout.textContent = formatOffset(item);
    document.getElementById('warning-overlap').hidden = !hasOverlap(item);
    document.getElementById('warning-attic').hidden = !intrudesAtticSlope(item);
}

// Position-only updates skip renderPlanner so dragging and nudging never rebuild the DOM
function syncItemPosition(item, el) {
    el.style.left = `${item.left}px`;
    el.style.top = `${item.top}px`;
    updateCollisionStates();
    updateDistanceGuides();
    updateInspectorLive(item);
}

function startDrag(e) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const el = e.currentTarget;
    const item = wallItems.find(i => i.id === el.dataset.id);
    if (!item) return;

    selectItem(item.id);

    // The page never scrolls, so one layout read at drag start is enough for the whole drag
    const wallRect = wallCanvas.getBoundingClientRect();

    dragState = {
        ...createIdleDragState(),
        isDragging: true,
        itemId: item.id,
        element: el,
        wallRect,
        offsetX: e.clientX - wallRect.left - item.left,
        offsetY: e.clientY - wallRect.top - item.top,
        startLeft: item.left,
        startTop: item.top
    };

    el.classList.add('dragging');
}

function applyDragFrame() {
    dragState.frameId = 0;

    const item = wallItems.find(i => i.id === dragState.itemId);
    if (!item) return;

    const { wallRect, pointerX, pointerY, offsetX, offsetY } = dragState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;

    const newLeft = quantize(pointerX - wallRect.left - offsetX, step);
    const newTop = quantize(pointerY - wallRect.top - offsetY, step);

    item.left = clamp(newLeft, 0, WALL_WIDTH - item.width);
    item.top = clamp(newTop, 0, WALL_HEIGHT - item.height);

    syncItemPosition(item, dragState.element);
}

window.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;

    dragState.pointerX = e.clientX;
    dragState.pointerY = e.clientY;

    // High polling-rate mice fire several events per frame; only the latest one matters
    if (!dragState.frameId) {
        dragState.frameId = requestAnimationFrame(applyDragFrame);
    }
});

window.addEventListener('mouseup', () => {
    if (!dragState.isDragging) return;

    if (dragState.frameId) {
        cancelAnimationFrame(dragState.frameId);
        applyDragFrame();
    }

    const item = wallItems.find(i => i.id === dragState.itemId);
    const moved = item && (item.left !== dragState.startLeft || item.top !== dragState.startTop);

    dragState.element.classList.remove('dragging');
    dragState = createIdleDragState();

    // A drag can end with the cursor just off the item; swallow the click that follows
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);

    if (moved) commitLayoutChange();
});

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        const offset = (wallItems.length * 20) % 160;
        const width = parseInt(catalogEl.dataset.width, 10);
        const height = parseInt(catalogEl.dataset.height, 10);

        // The cascade offset alone can push tall pieces past the floor line
        const newItem = {
            id: createItemId(),
            type: catalogEl.dataset.type,
            name: catalogEl.dataset.name,
            price: parseFloat(catalogEl.dataset.price),
            left: clamp(200 + offset, 0, WALL_WIDTH - width),
            top: clamp(220 + offset, 0, WALL_HEIGHT - height),
            width,
            height,
            finish: catalogEl.dataset.finish || 'walnut'
        };

        wallItems.push(newItem);
        selectedItemId = newItem.id;
        renderPlanner();
        updateInspectorPanel();
        commitLayoutChange();
    });
});

function selectItem(itemId) {
    selectedItemId = itemId;

    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === itemId);
    });

    updateInspectorPanel();
    updateDistanceGuides();
}

function removeItem(itemId) {
    wallItems = wallItems.filter(i => i.id !== itemId);
    selectedItemId = null;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function duplicateSelectedItem() {
    const source = getSelectedItem();
    if (!source) return;

    const copy = {
        ...JSON.parse(JSON.stringify(source)),
        id: createItemId(),
        left: clamp(source.left + DUPLICATE_OFFSET_PX, 0, WALL_WIDTH - source.width),
        top: clamp(source.top + DUPLICATE_OFFSET_PX, 0, WALL_HEIGHT - source.height)
    };

    wallItems.push(copy);
    selectedItemId = copy.id;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function updateInspectorPanel() {
    const item = getSelectedItem();
    if (!item) {
        inspectorBox.innerHTML = `<p>Select or drag an item on the wall to edit dimensions, finish, or remove it.</p>`;
        return;
    }

    const currentFinish = item.finish || 'walnut';
    const finishButtons = FINISHES.map(({ id, label }) => `
        <button class="btn-finish ${currentFinish === id ? 'active' : ''}" data-finish="${id}">${label}</button>
    `).join('');

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <div class="selected-item-header">
                <span class="selected-item-title">${escapeHtml(item.name)}</span>
                <span>$${item.price}</span>
            </div>
            <span>Offset: <strong id="inspector-pos-readout">${formatOffset(item)}</strong></span>

            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="${MIN_WIDTH_CM}" max="${WALL_WIDTH / SCALE}" value="${toCm(item.width)}">
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="${MIN_HEIGHT_CM}" max="${WALL_HEIGHT / SCALE}" value="${toCm(item.height)}">
                </div>
            </div>

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtons}</div>
            </div>

            <div id="warning-overlap" class="collision-warning" hidden>Overlap detected with another item</div>
            <div id="warning-attic" class="collision-warning" hidden>Intrudes into sloped ceiling zone</div>

            <div class="inspector-actions">
                <button class="btn-secondary" id="duplicate-item-btn" title="Duplicate (Ctrl+D)">Duplicate Item</button>
                <button class="btn-danger" id="delete-item-btn" title="Remove (Delete)">Remove Item</button>
            </div>
        </div>
    `;

    updateInspectorLive(item);

    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');

    function applyDimensionChange() {
        const rawW = parseInt(widthInput.value, 10) || toCm(item.width);
        const rawH = parseInt(heightInput.value, 10) || toCm(item.height);

        const clampedW = clamp(rawW, MIN_WIDTH_CM, WALL_WIDTH / SCALE);
        const clampedH = clamp(rawH, MIN_HEIGHT_CM, WALL_HEIGHT / SCALE);

        // Whole cm always map to a multiple of 0.5 px, so no rounding is needed here
        item.width = clampedW * SCALE;
        item.height = clampedH * SCALE;

        // Keep item inside wall if resized near the right/bottom edge
        item.left = clamp(item.left, 0, WALL_WIDTH - item.width);
        item.top = clamp(item.top, 0, WALL_HEIGHT - item.height);

        widthInput.value = clampedW;
        heightInput.value = clampedH;

        renderPlanner();
        updateInspectorLive(item);
        commitLayoutChange();
    }

    widthInput.addEventListener('change', applyDimensionChange);
    heightInput.addEventListener('change', applyDimensionChange);

    inspectorBox.querySelectorAll('.btn-finish').forEach(btn => {
        btn.addEventListener('click', () => {
            item.finish = btn.dataset.finish;
            renderPlanner();
            updateInspectorPanel();
            commitLayoutChange();
        });
    });

    document.getElementById('duplicate-item-btn').addEventListener('click', duplicateSelectedItem);
    document.getElementById('delete-item-btn').addEventListener('click', () => removeItem(item.id));
}

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

    if (key === 'd' && selectedItemId) {
        // Stops the browser bookmark dialog; holding the keys should not spawn a stack of copies
        e.preventDefault();
        if (!e.repeat && !dragState.isDragging) duplicateSelectedItem();
        return true;
    }

    return false;
}

// Arrow keys for 1cm nudging, Delete/Backspace to remove
function handleItemKeys(e) {
    if (!selectedItemId || dragState.isDragging) return;
    if (e.target.tagName === 'INPUT') return; // Do not trigger while typing numbers in inputs

    const item = getSelectedItem();
    if (!item) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeItem(item.id);
        return;
    }

    const nudge = NUDGE_KEYS[e.key];
    if (!nudge) return;
    e.preventDefault();

    // Step from the nearest whole cm so older off-grid positions land back on it
    const [dx, dy] = nudge;
    if (dx) item.left = clamp((toCm(item.left) + dx) * SCALE, 0, WALL_WIDTH - item.width);
    if (dy) item.top = clamp((toCm(item.top) + dy) * SCALE, 0, WALL_HEIGHT - item.height);

    const el = getItemElement(item.id);
    if (el) syncItemPosition(item, el);
    pushHistory(`nudge:${item.id}`);
    saveState();
}

window.addEventListener('keydown', (e) => {
    const hasModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (hasModifier && handleModifierShortcut(e)) return;
    handleItemKeys(e);
});

wallCanvas.addEventListener('click', () => {
    if (justDragged) return;
    if (selectedItemId !== null) {
        selectItem(null);
    }
});

function applyAtticSlope() {
    atticZone.hidden = !atticSlopeToggle.checked;
    updateCollisionStates();
    updateInspectorLive(getSelectedItem());
}

atticSlopeToggle.addEventListener('change', () => {
    applyAtticSlope();
    commitLayoutChange();
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

resetWallBtn.addEventListener('click', () => {
    wallItems = cloneDefaults();
    selectedItemId = null;
    atticSlopeToggle.checked = false;
    updateAccentColor('#ff9d42', false);
    updateCornerColor('#8b5cf6', false);
    setBrightness(100);
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();
});

function showIoStatus(message, tone) {
    clearTimeout(ioStatusTimer);
    ioStatus.textContent = message;
    ioStatus.className = `io-status is-${tone}`;
    ioStatus.hidden = false;
    ioStatusTimer = setTimeout(() => { ioStatus.hidden = true; }, 5000);
}

function exportLayout() {
    const payload = {
        version: EXPORT_VERSION,
        wallItems,
        atticSlope: atticSlopeToggle.checked,
        accentColor: accentColorPicker.value,
        cornerColor: cornerColorPicker.value,
        brightness: Number(brightnessSlider.value)
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = EXPORT_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking in the same tick can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 0);

    showIoStatus('Layout exported.', 'success');
}

function importLayoutText(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('That file is not valid JSON.');
    }

    // Validation finishes before anything is applied, so a bad file never leaves a half-loaded wall
    const layout = normalizeLayout(data);

    selectedItemId = null;
    applyLayoutSettings(layout);
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();

    return layout;
}

function importLayoutFile(file) {
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
        showIoStatus('File is too large to be a layout export.', 'error');
        return;
    }

    const reader = new FileReader();

    reader.addEventListener('load', () => {
        try {
            const { items, skipped } = importLayoutText(reader.result);
            const countLabel = `${items.length} item${items.length === 1 ? '' : 's'}`;
            const skippedLabel = skipped ? `, skipped ${skipped} invalid` : '';
            showIoStatus(`Imported ${countLabel}${skippedLabel}.`, 'success');
        } catch (err) {
            showIoStatus(`Import failed: ${err.message}`, 'error');
        }
    });

    reader.addEventListener('error', () => {
        showIoStatus('Import failed: the file could not be read.', 'error');
    });

    reader.readAsText(file);
}

exportJsonBtn.addEventListener('click', exportLayout);
importJsonBtn.addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', () => {
    importLayoutFile(importFileInput.files[0]);
    // Clearing the value lets the same file be picked again after editing it
    importFileInput.value = '';
});

themeToggleBtn.addEventListener('click', () => {
    isAmbientMode = !isAmbientMode;
    wallCanvas.classList.toggle('daylight-mode', !isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !isAmbientMode);

    themeToggleBtn.textContent = isAmbientMode ? 'Ambient Mode: ON' : 'Daylight Grid: ON';
});

function updateAccentColor(hexColor, shouldSave = true) {
    document.documentElement.style.setProperty('--accent-led', hexColor);
    accentHexCode.textContent = hexColor.toUpperCase();
    accentColorPicker.value = hexColor;
    if (shouldSave) saveState();
}

function updateCornerColor(hexColor, shouldSave = true) {
    document.documentElement.style.setProperty('--corner-led', hexColor);
    cornerHexCode.textContent = hexColor.toUpperCase();
    cornerColorPicker.value = hexColor;
    if (shouldSave) saveState();
}

function setBrightness(percent) {
    brightnessSlider.value = percent;
    document.documentElement.style.setProperty('--led-opacity', percent / 100);
    brightnessValue.textContent = `${percent}%`;
}

accentColorPicker.addEventListener('input', (e) => updateAccentColor(e.target.value));
cornerColorPicker.addEventListener('input', (e) => updateCornerColor(e.target.value));

brightnessSlider.addEventListener('input', (e) => {
    setBrightness(e.target.value);
    saveState();
});

presetButtons.forEach(button => {
    button.addEventListener('click', () => {
        updateAccentColor(button.dataset.accent);
        updateCornerColor(button.dataset.corner);
        if (!isAmbientMode) themeToggleBtn.click();
    });
});

loadState();
renderPlanner();
applyAtticSlope();
pushHistory();