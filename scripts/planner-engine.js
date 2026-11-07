const SCALE = 2.5; // 1 cm = 2.5 px
const CM_STEP_PX = SCALE;
const SNAP_STEP_PX = 5 * SCALE; // 5 cm grid step (12.5 px)
const ALIGN_THRESHOLD_PX = SCALE; // 1 cm magnet range
const ATTIC_SLOPE_PX = 90 * SCALE; // 90 x 90 cm roof cut-out (225 px)
const DUPLICATE_OFFSET_PX = 4 * SCALE; // 4 cm (10 px)
const MIN_WIDTH_CM = 8;
const MIN_HEIGHT_CM = 4;
const EPSILON = 1e-6;

const DEFAULT_WALL_WIDTH_CM = 300;
const DEFAULT_WALL_HEIGHT_CM = 250;
const WALL_WIDTH_LIMITS_CM = [150, 400];
const WALL_HEIGHT_LIMITS_CM = [150, 300];
const WALL_BORDER_PX = 2; // keep in sync with the .wall border
const CANVAS_PADDING_PX = 24;

const STORAGE_KEY = 'spatial_studio_state_v1';
const EXPORT_VERSION = '0.8';
const EXPORT_FILENAME = 'spatial-studio-layout.json';

const HISTORY_LIMIT = 30;
const MERGE_WINDOW_MS = 600;
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ITEMS = 200;
const MAX_NAME_LENGTH = 40;

const LABEL_GAP_PX = 3;
const LABEL_SLIDE_STEP_PX = 4;

const ITEM_TYPES = ['shelf', 'cube', 'storage', 'poster', 'spotlight', 'corner-lamp'];
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
const canvasArea = document.querySelector('.canvas-area');
const wallItemsLayer = document.getElementById('wall-items');
const atticZone = document.getElementById('attic-zone');
const alignLayer = document.getElementById('align-guides');

const wallWidthInput = document.getElementById('wall-width-input');
const wallHeightInput = document.getElementById('wall-height-input');
const scaleNote = document.getElementById('scale-note');

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

const createRuler = (id) => {
    const el = document.getElementById(id);
    return { el, label: el.querySelector('.guide-label'), spec: null };
};

const rulers = {
    wallX: createRuler('guide-x'),
    wallY: createRuler('guide-y'),
    gapLeft: createRuler('gap-left'),
    gapRight: createRuler('gap-right'),
    gapUp: createRuler('gap-up'),
    gapDown: createRuler('gap-down')
};

// Import fallbacks come straight from the catalog markup so there is one source of truth
const CATALOG_DEFAULTS = Object.fromEntries([...catalogItems].map(el => [el.dataset.type, {
    name: el.dataset.name,
    price: parseFloat(el.dataset.price),
    width: parseFloat(el.dataset.width),
    height: parseFloat(el.dataset.height),
    finish: el.dataset.finish || 'walnut'
}]));

const defaultItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut', ledEnabled: true },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black', ledEnabled: true }
];

let isAmbientMode = true;
let selectedItemId = null;
let wallItems = [];
let justDragged = false;
let suppressAltMenu = false;
let idCounter = 0;
let ioStatusTimer = 0;
let fitFrame = 0;

let wallWidthCm = DEFAULT_WALL_WIDTH_CM;
let wallHeightCm = DEFAULT_WALL_HEIGHT_CM;
let wallWidthPx = wallWidthCm * SCALE;
let wallHeightPx = wallHeightCm * SCALE;
let viewScale = 1;

let labelMetrics = { single: 34, digit: 6, height: 18 };
const alignLinePool = [];

let historyStack = [];
let historyIndex = -1;
let lastHistoryPush = { mergeKey: null, time: 0 };

const createIdleDragState = () => ({
    isDragging: false,
    itemId: null,
    element: null,
    wallRect: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    pointerX: 0,
    pointerY: 0,
    startLeft: 0,
    startTop: 0,
    altKey: false,
    frameId: 0
});

let dragState = createIdleDragState();

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultItems));
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const quantize = (px, step) => Math.round(px / step) * step;
const toCm = (px) => Math.round(px / SCALE);
const isWholeCm = (px) => Math.abs(px / SCALE - Math.round(px / SCALE)) < EPSILON;
const formatOffset = (item) => `${toCm(item.left)} cm (X), ${toCm(item.top)} cm (Y)`;
const getSelectedItem = () => wallItems.find(i => i.id === selectedItemId);
const getItemElement = (itemId) => wallItemsLayer.querySelector(`.wall-item[data-id="${itemId}"]`);
const createItemId = () => `item-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const isLedOn = (item) => item.ledEnabled !== false;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const isTextEntry = (el) =>
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.includes(el.type));

function setWallDimensions(widthCm, heightCm) {
    wallWidthCm = widthCm;
    wallHeightCm = heightCm;
    wallWidthPx = widthCm * SCALE;
    wallHeightPx = heightCm * SCALE;

    wallCanvas.style.width = `${wallWidthPx}px`;
    wallCanvas.style.height = `${wallHeightPx}px`;
    wallWidthInput.value = widthCm;
    wallHeightInput.value = heightCm;

    fitWallToViewport();
}

function fitWallToViewport() {
    const availableWidth = canvasArea.clientWidth - CANVAS_PADDING_PX * 2;
    const availableHeight = canvasArea.clientHeight - CANVAS_PADDING_PX * 2;
    const fit = Math.min(
        1,
        availableWidth / (wallWidthPx + WALL_BORDER_PX * 2),
        availableHeight / (wallHeightPx + WALL_BORDER_PX * 2)
    );

    // A collapsed canvas reports no usable size; keep full scale instead of shrinking to nothing
    viewScale = fit > 0 ? fit : 1;
    wallCanvas.style.transform = viewScale < 1 ? `scale(${viewScale})` : '';
    scaleNote.textContent = viewScale < 1
        ? `(1 cm = 2.5 px, fit ${Math.round(viewScale * 100)}%)`
        : '(1 cm = 2.5 px)';

    // Item offsets are stored in wall space, so a resize mid-drag only needs fresh screen bounds
    if (dragState.isDragging) {
        dragState.wallRect = wallCanvas.getBoundingClientRect();
        dragState.scale = viewScale;
    }
}

// Items larger than a shrunken wall are cut down to fit, then everything is pushed back inside
function clampItemsToWall() {
    wallItems.forEach(item => {
        item.width = Math.min(item.width, wallWidthPx);
        item.height = Math.min(item.height, wallHeightPx);
        item.left = clamp(item.left, 0, wallWidthPx - item.width);
        item.top = clamp(item.top, 0, wallHeightPx - item.height);
    });
}

function saveState() {
    const payload = {
        items: wallItems,
        wallWidthCm,
        wallHeightCm,
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

function toWallCm(value, [min, max], fallback) {
    const cm = toFiniteNumber(value);
    return cm === null ? fallback : clamp(Math.round(cm), min, max);
}

function sanitizeItem(raw, usedIds, bounds) {
    if (!raw || typeof raw !== 'object' || !ITEM_TYPES.includes(raw.type)) return null;

    // Keep stable ids across reloads; anything malformed or repeated gets a fresh one
    const id = typeof raw.id === 'string' && SAFE_ID_PATTERN.test(raw.id) && !usedIds.has(raw.id)
        ? raw.id
        : createItemId();
    usedIds.add(id);

    const defaults = CATALOG_DEFAULTS[raw.type];
    const width = toCmGrid(toFiniteNumber(raw.width) ?? defaults.width, MIN_WIDTH_CM, bounds.width / SCALE);
    const height = toCmGrid(toFiniteNumber(raw.height) ?? defaults.height, MIN_HEIGHT_CM, bounds.height / SCALE);
    const price = toFiniteNumber(raw.price);
    const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
        : defaults.name;

    return {
        id,
        type: raw.type,
        name,
        price: price !== null && price >= 0 ? Math.round(price * 100) / 100 : defaults.price,
        left: toCmGrid(toFiniteNumber(raw.left) ?? 0, 0, (bounds.width - width) / SCALE),
        top: toCmGrid(toFiniteNumber(raw.top) ?? 0, 0, (bounds.height - height) / SCALE),
        width,
        height,
        finish: FINISH_IDS.includes(raw.finish) ? raw.finish : defaults.finish,
        ledEnabled: typeof raw.ledEnabled === 'boolean' ? raw.ledEnabled : true
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

    // Layouts from before v0.8 carry no wall size and were always planned on the default wall
    const widthCm = toWallCm(data.wallWidthCm, WALL_WIDTH_LIMITS_CM, DEFAULT_WALL_WIDTH_CM);
    const heightCm = toWallCm(data.wallHeightCm, WALL_HEIGHT_LIMITS_CM, DEFAULT_WALL_HEIGHT_CM);
    const bounds = { width: widthCm * SCALE, height: heightCm * SCALE };

    const usedIds = new Set();
    const items = rawItems
        .slice(0, MAX_IMPORT_ITEMS)
        .map(raw => sanitizeItem(raw, usedIds, bounds))
        .filter(Boolean);

    if (rawItems.length > 0 && items.length === 0) {
        throw new Error('No valid items found in this file.');
    }

    const brightness = toFiniteNumber(data.brightness);

    return {
        items,
        skipped: rawItems.length - items.length,
        wallWidthCm: widthCm,
        wallHeightCm: heightCm,
        atticSlope: typeof data.atticSlope === 'boolean' ? data.atticSlope : null,
        accentColor: isHexColor(data.accentColor) ? data.accentColor.toLowerCase() : null,
        cornerColor: isHexColor(data.cornerColor) ? data.cornerColor.toLowerCase() : null,
        brightness: brightness === null ? null : clamp(Math.round(brightness), 0, 100)
    };
}

function applyLayoutSettings(layout) {
    setWallDimensions(layout.wallWidthCm, layout.wallHeightCm);
    wallItems = layout.items;
    if (layout.atticSlope !== null) atticSlopeToggle.checked = layout.atticSlope;
    if (layout.accentColor) updateAccentColor(layout.accentColor, false);
    if (layout.cornerColor) updateCornerColor(layout.cornerColor, false);
    if (layout.brightness !== null) setBrightness(layout.brightness);
}

function loadState() {
    setWallDimensions(DEFAULT_WALL_WIDTH_CM, DEFAULT_WALL_HEIGHT_CM);
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

const serializeHistoryState = () => JSON.stringify({
    items: wallItems,
    atticSlope: atticSlopeToggle.checked,
    wallWidthCm,
    wallHeightCm
});

function updateHistoryButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function pushHistory(mergeKey = null) {
    const snapshot = serializeHistoryState();
    if (historyStack[historyIndex] === snapshot) return;

    const now = performance.now();
    // Held arrow nudges or rapid spinner clicks on the wall size fold into a single undo step
    const canMerge = mergeKey !== null &&
        mergeKey === lastHistoryPush.mergeKey &&
        now - lastHistoryPush.time < MERGE_WINDOW_MS &&
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

    const snapshot = JSON.parse(historyStack[historyIndex]);
    setWallDimensions(snapshot.wallWidthCm, snapshot.wallHeightCm);
    wallItems = snapshot.items;
    atticSlopeToggle.checked = snapshot.atticSlope;
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
        const ledClass = isLedOn(item) ? '' : 'led-off';
        return `
            <div class="wall-item ${item.type} ${finishClass} ${isSelected} ${ledClass}"
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

// The slope edge follows y = x - (wallWidthPx - S). For an axis-aligned box the top-right
// corner is the point that reaches furthest past that line, so testing it alone is exact.
function intrudesAtticSlope(item) {
    if (!atticSlopeToggle.checked) return false;

    const slopeStartX = wallWidthPx - ATTIC_SLOPE_PX;
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

// One layout read at startup lets the label placer size labels without touching layout per frame
function measureLabelMetrics() {
    const probe = document.createElement('span');
    probe.className = 'guide-label';
    probe.style.visibility = 'hidden';
    wallCanvas.appendChild(probe);

    const widthOf = (text) => {
        probe.textContent = text;
        return probe.getBoundingClientRect().width / viewScale;
    };
    const single = widthOf('0 cm');
    const digit = (widthOf('000 cm') - single) / 2;
    const height = probe.getBoundingClientRect().height / viewScale;
    probe.remove();

    if (single > 0 && height > 0) labelMetrics = { single, digit, height };
}

// Labels only ever hold "<digits> cm", so the width follows from the digit count
const estimateLabelWidth = (text) => labelMetrics.single + Math.max(0, text.length - 4) * labelMetrics.digit;

const rectsOverlap = (a, b) =>
    a.x < b.x + b.w + LABEL_GAP_PX && b.x < a.x + a.w + LABEL_GAP_PX &&
    a.y < b.y + b.h + LABEL_GAP_PX && b.y < a.y + a.h + LABEL_GAP_PX;

// Tries the ruler midpoint first, then slides outward along the ruler until the label is clear
function findLabelSpot(spec, placed) {
    const width = estimateLabelWidth(spec.text);
    const height = labelMetrics.height;
    const extent = spec.axis === 'h' ? width : height;
    const mid = (spec.start + spec.end) / 2;
    const min = spec.start + extent / 2;
    const max = spec.end - extent / 2;

    const candidates = [mid];
    for (let step = LABEL_SLIDE_STEP_PX; mid + step <= max || mid - step >= min; step += LABEL_SLIDE_STEP_PX) {
        if (mid + step <= max) candidates.push(mid + step);
        if (mid - step >= min) candidates.push(mid - step);
    }

    for (const center of candidates) {
        const rect = spec.axis === 'h'
            ? { x: center - width / 2, y: spec.cross - height / 2, w: width, h: height }
            : { x: spec.cross - width / 2, y: center - height / 2, w: width, h: height };
        if (!placed.some(other => rectsOverlap(rect, other))) return { center, rect };
    }
    return null;
}

function placeRulerLabels() {
    const placed = [];
    const active = Object.values(rulers).filter(ruler => ruler.spec);
    // Short rulers have the least room to slide, so they claim their spot first
    active.sort((a, b) => (a.spec.end - a.spec.start) - (b.spec.end - b.spec.start));

    active.forEach(ruler => {
        const spot = findLabelSpot(ruler.spec, placed);
        ruler.label.hidden = !spot;
        if (!spot) return;

        placed.push(spot.rect);
        const offset = `${spot.center - ruler.spec.start}px`;
        if (ruler.spec.axis === 'h') ruler.label.style.left = offset;
        else ruler.label.style.top = offset;
    });
}

function setRuler(ruler, spec) {
    if (spec) ruler.label.textContent = spec.text;

    ruler.spec = spec && spec.end - spec.start > 0 ? spec : null;
    ruler.el.hidden = !ruler.spec;
    if (!ruler.spec) return;

    const { el } = ruler;
    const length = `${spec.end - spec.start}px`;
    if (spec.axis === 'h') {
        el.style.left = `${spec.start}px`;
        el.style.top = `${spec.cross}px`;
        el.style.width = length;
    } else {
        el.style.left = `${spec.cross}px`;
        el.style.top = `${spec.start}px`;
        el.style.height = length;
    }
}

function findNeighborGaps(item) {
    const right = item.left + item.width;
    const bottom = item.top + item.height;
    const nearest = {};

    const consider = (side, gap, other) => {
        if (!nearest[side] || gap < nearest[side].gap) nearest[side] = { gap, other };
    };

    wallItems.forEach(other => {
        if (other.id === item.id) return;
        const otherRight = other.left + other.width;
        const otherBottom = other.top + other.height;
        // A neighbor only counts when its projection overlaps the active item on the other axis
        const sharesRows = other.top < bottom && otherBottom > item.top;
        const sharesColumns = other.left < right && otherRight > item.left;

        if (sharesRows && otherRight <= item.left) consider('left', item.left - otherRight, other);
        if (sharesRows && other.left >= right) consider('right', other.left - right, other);
        if (sharesColumns && otherBottom <= item.top) consider('up', item.top - otherBottom, other);
        if (sharesColumns && other.top >= bottom) consider('down', other.top - bottom, other);
    });

    const rowCenter = (other) => Math.round((Math.max(item.top, other.top) + Math.min(bottom, other.top + other.height)) / 2);
    const columnCenter = (other) => Math.round((Math.max(item.left, other.left) + Math.min(right, other.left + other.width)) / 2);
    const label = (gap) => `${toCm(gap)} cm`;

    // A touching neighbor blocks anything behind it but leaves no gap to draw
    const build = (side, makeSpec) => (nearest[side] && nearest[side].gap > 0 ? makeSpec(nearest[side]) : null);

    return {
        left: build('left', ({ gap, other }) => ({
            axis: 'h', start: other.left + other.width, end: item.left, cross: rowCenter(other), text: label(gap)
        })),
        right: build('right', ({ gap, other }) => ({
            axis: 'h', start: right, end: other.left, cross: rowCenter(other), text: label(gap)
        })),
        up: build('up', ({ gap, other }) => ({
            axis: 'v', start: other.top + other.height, end: item.top, cross: columnCenter(other), text: label(gap)
        })),
        down: build('down', ({ gap, other }) => ({
            axis: 'v', start: bottom, end: other.top, cross: columnCenter(other), text: label(gap)
        }))
    };
}

// Picks the item edge farther from the gap ruler, unless that edge sits on the wall boundary
function pickOuterEdge(near, far, from, limit) {
    const preferNear = from - near >= far - from;
    const first = preferNear ? near : far;
    const second = preferNear ? far : near;
    return first > 0 && first < limit ? first : second;
}

function updateDistanceGuides() {
    const item = getSelectedItem();
    if (!item) {
        Object.values(rulers).forEach(ruler => setRuler(ruler, null));
        return;
    }

    const gaps = findNeighborGaps(item);
    const right = item.left + item.width;
    const bottom = item.top + item.height;

    // A neighbor on the left or top owns the shared overlap axis, so the wall ruler on that
    // side moves out to the item's outer edge instead of running along the same line
    const wallXCross = gaps.left
        ? pickOuterEdge(item.top, bottom, gaps.left.cross, wallHeightPx)
        : Math.round(item.top + item.height / 2);
    const wallYCross = gaps.up
        ? pickOuterEdge(item.left, right, gaps.up.cross, wallWidthPx)
        : Math.round(item.left + item.width / 2);

    setRuler(rulers.wallX, { axis: 'h', start: 0, end: item.left, cross: wallXCross, text: `${toCm(item.left)} cm` });
    setRuler(rulers.wallY, { axis: 'v', start: 0, end: item.top, cross: wallYCross, text: `${toCm(item.top)} cm` });
    setRuler(rulers.gapLeft, gaps.left);
    setRuler(rulers.gapRight, gaps.right);
    setRuler(rulers.gapUp, gaps.up);
    setRuler(rulers.gapDown, gaps.down);

    placeRulerLabels();
}

function getAlignTargets(item, axis) {
    const targets = axis === 'x' ? [{ value: wallWidthPx / 2, other: null }] : [];
    wallItems.forEach(other => {
        if (other.id === item.id) return;
        const start = axis === 'x' ? other.left : other.top;
        const size = axis === 'x' ? other.width : other.height;
        targets.push(
            { value: start, other },
            { value: start + size / 2, other },
            { value: start + size, other }
        );
    });
    return targets;
}

// Returns the closest start position that lines up an edge or center with a target line,
// or the original start when nothing sits within the 1 cm magnet range
function snapAxis(item, axis, start, targets) {
    const size = axis === 'x' ? item.width : item.height;
    const limit = (axis === 'x' ? wallWidthPx : wallHeightPx) - size;
    let best = null;

    [0, size / 2, size].forEach(anchor => {
        targets.forEach(({ value }) => {
            const candidate = value - anchor;
            const distance = Math.abs(candidate - start);
            if (distance > ALIGN_THRESHOLD_PX + EPSILON) return;
            // A half-cm result would leave the whole-cm grid, so that alignment is skipped rather than faked
            if (!isWholeCm(candidate) || candidate < -EPSILON || candidate > limit + EPSILON) return;
            if (!best || distance < best.distance) best = { candidate, distance };
        });
    });

    return best ? best.candidate : start;
}

// An x alignment draws a vertical line, so it spans both items vertically (and vice versa)
function spanBetween(a, b, axis) {
    return axis === 'x'
        ? [Math.min(a.top, b.top), Math.max(a.top + a.height, b.top + b.height)]
        : [Math.min(a.left, b.left), Math.max(a.left + a.width, b.left + b.width)];
}

function collectAlignLines(item, axis, targets) {
    const start = axis === 'x' ? item.left : item.top;
    const size = axis === 'x' ? item.width : item.height;
    const fullSpan = [0, axis === 'x' ? wallHeightPx : wallWidthPx];
    const lines = new Map();

    [start, start + size / 2, start + size].forEach(anchor => {
        targets.forEach(({ value, other }) => {
            if (Math.abs(value - anchor) > EPSILON) return;
            const [from, to] = other ? spanBetween(item, other, axis) : fullSpan;
            const existing = lines.get(value);
            lines.set(value, existing ? [Math.min(existing[0], from), Math.max(existing[1], to)] : [from, to]);
        });
    });

    return [...lines].map(([position, [from, to]]) => ({ axis, position, from, to }));
}

// Line elements are pooled and restyled each frame instead of being recreated
function renderAlignGuides(lines) {
    while (alignLinePool.length < lines.length) {
        const el = document.createElement('div');
        el.className = 'align-line';
        alignLayer.appendChild(el);
        alignLinePool.push(el);
    }

    alignLinePool.forEach((el, index) => {
        const line = lines[index];
        el.hidden = !line;
        if (!line) return;

        const vertical = line.axis === 'x';
        el.classList.toggle('is-vertical', vertical);
        el.style.left = `${vertical ? line.position : line.from}px`;
        el.style.top = `${vertical ? line.from : line.position}px`;
        el.style.width = vertical ? '' : `${line.to - line.from}px`;
        el.style.height = vertical ? `${line.to - line.from}px` : '';
    });
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

    // The page never scrolls, so one layout read at drag start is enough unless the window resizes
    const wallRect = wallCanvas.getBoundingClientRect();

    dragState = {
        ...createIdleDragState(),
        isDragging: true,
        itemId: item.id,
        element: el,
        wallRect,
        scale: viewScale,
        offsetX: (e.clientX - wallRect.left) / viewScale - item.left,
        offsetY: (e.clientY - wallRect.top) / viewScale - item.top,
        pointerX: e.clientX,
        pointerY: e.clientY,
        startLeft: item.left,
        startTop: item.top,
        altKey: e.altKey
    };

    if (e.altKey) suppressAltMenu = true;
    el.classList.add('dragging');
}

function applyDragFrame() {
    dragState.frameId = 0;

    const item = wallItems.find(i => i.id === dragState.itemId);
    if (!item) return;

    const { wallRect, scale, pointerX, pointerY, offsetX, offsetY } = dragState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;

    // Screen deltas are divided by the view scale so the item stays under the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    item.left = clamp(quantize(localX - offsetX, step), 0, wallWidthPx - item.width);
    item.top = clamp(quantize(localY - offsetY, step), 0, wallHeightPx - item.height);

    let lines = [];
    if (!dragState.altKey) {
        const xTargets = getAlignTargets(item, 'x');
        const yTargets = getAlignTargets(item, 'y');
        item.left = snapAxis(item, 'x', item.left, xTargets);
        item.top = snapAxis(item, 'y', item.top, yTargets);
        lines = [...collectAlignLines(item, 'x', xTargets), ...collectAlignLines(item, 'y', yTargets)];
    }

    syncItemPosition(item, dragState.element);
    renderAlignGuides(lines);
}

// High polling-rate mice fire several events per frame; only the latest one matters
function scheduleDragFrame() {
    if (dragState.isDragging && !dragState.frameId) {
        dragState.frameId = requestAnimationFrame(applyDragFrame);
    }
}

window.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;

    dragState.pointerX = e.clientX;
    dragState.pointerY = e.clientY;
    dragState.altKey = e.altKey;
    if (e.altKey) suppressAltMenu = true;
    scheduleDragFrame();
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
    renderAlignGuides([]);

    // A drag can end with the cursor just off the item; swallow the click that follows
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);

    if (moved) commitLayoutChange();
});

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        const offset = (wallItems.length * 20) % 160;
        const width = parseFloat(catalogEl.dataset.width);
        const height = parseFloat(catalogEl.dataset.height);

        // The cascade offset alone can push tall pieces past the floor line
        const newItem = {
            id: createItemId(),
            type: catalogEl.dataset.type,
            name: catalogEl.dataset.name,
            price: parseFloat(catalogEl.dataset.price),
            left: clamp(200 + offset, 0, wallWidthPx - width),
            top: clamp(220 + offset, 0, wallHeightPx - height),
            width,
            height,
            finish: catalogEl.dataset.finish || 'walnut',
            ledEnabled: true
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
        left: clamp(source.left + DUPLICATE_OFFSET_PX, 0, wallWidthPx - source.width),
        top: clamp(source.top + DUPLICATE_OFFSET_PX, 0, wallHeightPx - source.height)
    };

    wallItems.push(copy);
    selectedItemId = copy.id;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function syncLedToggle(button, on) {
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-checked', String(on));
    button.querySelector('.led-toggle-state').textContent = on ? 'ON' : 'OFF';
}

function updateInspectorPanel() {
    const item = getSelectedItem();
    if (!item) {
        inspectorBox.innerHTML = `<p>Select or drag an item on the wall to edit dimensions, finish, or remove it.</p>`;
        return;
    }

    const currentFinish = item.finish || 'walnut';
    const ledOn = isLedOn(item);
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
                    <input type="number" id="edit-width-cm" class="dim-input" min="${MIN_WIDTH_CM}" max="${wallWidthCm}" value="${toCm(item.width)}">
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="${MIN_HEIGHT_CM}" max="${wallHeightCm}" value="${toCm(item.height)}">
                </div>
            </div>

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtons}</div>
            </div>

            <button type="button" id="led-toggle-btn" class="led-toggle ${ledOn ? 'is-on' : ''}" role="switch" aria-checked="${ledOn}">
                <span class="led-toggle-track" aria-hidden="true"><span class="led-toggle-thumb"></span></span>
                <span class="led-toggle-text">Backlight LED: <strong class="led-toggle-state">${ledOn ? 'ON' : 'OFF'}</strong></span>
            </button>

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

        const clampedW = clamp(rawW, MIN_WIDTH_CM, wallWidthCm);
        const clampedH = clamp(rawH, MIN_HEIGHT_CM, wallHeightCm);

        // Whole cm always map to a multiple of 0.5 px, so no rounding is needed here
        item.width = clampedW * SCALE;
        item.height = clampedH * SCALE;

        // Keep item inside wall if resized near the right/bottom edge
        item.left = clamp(item.left, 0, wallWidthPx - item.width);
        item.top = clamp(item.top, 0, wallHeightPx - item.height);

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

    const ledToggleBtn = document.getElementById('led-toggle-btn');
    ledToggleBtn.addEventListener('click', () => {
        item.ledEnabled = !isLedOn(item);
        const el = getItemElement(item.id);
        if (el) el.classList.toggle('led-off', !item.ledEnabled);
        syncLedToggle(ledToggleBtn, item.ledEnabled);
        commitLayoutChange();
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
    if (dx) item.left = clamp((toCm(item.left) + dx) * SCALE, 0, wallWidthPx - item.width);
    if (dy) item.top = clamp((toCm(item.top) + dy) * SCALE, 0, wallHeightPx - item.height);

    const el = getItemElement(item.id);
    if (el) syncItemPosition(item, el);
    pushHistory(`nudge:${item.id}`);
    saveState();
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && dragState.isDragging) {
        // Alt or Option suspends magnetic alignment for as long as it is held
        e.preventDefault();
        dragState.altKey = true;
        suppressAltMenu = true;
        scheduleDragFrame();
        return;
    }

    const hasModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (hasModifier && handleModifierShortcut(e)) return;
    handleItemKeys(e);
});

window.addEventListener('keyup', (e) => {
    if (e.key !== 'Alt') return;

    if (dragState.isDragging) {
        dragState.altKey = false;
        scheduleDragFrame();
    }

    // Releasing Alt on its own would otherwise focus the browser menu bar in some browsers
    if (suppressAltMenu) {
        e.preventDefault();
        suppressAltMenu = false;
    }
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

function readWallInput(input, [min, max], current) {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value) ? clamp(value, min, max) : current;
}

function handleWallResize() {
    const widthCm = readWallInput(wallWidthInput, WALL_WIDTH_LIMITS_CM, wallWidthCm);
    const heightCm = readWallInput(wallHeightInput, WALL_HEIGHT_LIMITS_CM, wallHeightCm);

    if (widthCm === wallWidthCm && heightCm === wallHeightCm) {
        // Puts back the current size when the typed value was empty or clamped to what is already set
        wallWidthInput.value = wallWidthCm;
        wallHeightInput.value = wallHeightCm;
        return;
    }

    setWallDimensions(widthCm, heightCm);
    clampItemsToWall();
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    // Spinner clicks fire one change per step; merging keeps a resize to a single undo step
    pushHistory('wall-size');
    saveState();
}

wallWidthInput.addEventListener('change', handleWallResize);
wallHeightInput.addEventListener('change', handleWallResize);

resetWallBtn.addEventListener('click', () => {
    setWallDimensions(DEFAULT_WALL_WIDTH_CM, DEFAULT_WALL_HEIGHT_CM);
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
        wallWidthCm,
        wallHeightCm,
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

window.addEventListener('resize', () => {
    if (fitFrame) return;
    fitFrame = requestAnimationFrame(() => {
        fitFrame = 0;
        fitWallToViewport();
    });
});

measureLabelMetrics();
loadState();
renderPlanner();
applyAtticSlope();
pushHistory();