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
const EXPORT_VERSION = '1.3';
const EXPORT_FILENAME = 'spatial-studio-layout.json';
const PNG_FILENAME = 'spatial-studio-plan.png';
const PNG_PIXEL_RATIO = 2;
const SHADOW_SHIFT_PX = 10000;
const CORNER_GLOW_ALPHA = 0.45; // mirrors the .corner-led-glow opacity factor
const SPOTLIGHT_CONE_FADE = 0.85; // mirrors the last stop of the .spotlight::after gradient
const WALL_FILL = { ambient: '#1c1f26', daylight: '#e5e7eb' };
const DAYLIGHT_GRID_PX = 10 * SCALE;

const COPY_LABEL = 'Copy as Markdown';
const MOUNTING_NOTE = "Distances in cm from the left wall edge, the ceiling, and the floor to the item's left, top, and bottom edges.";
const LOCK_ICON_HTML = '<span class="lock-icon" aria-hidden="true"></span>';

const HISTORY_LIMIT = 30;
const MERGE_WINDOW_MS = 600;
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ITEMS = 200;
const MAX_NAME_LENGTH = 40;

const LABEL_GAP_PX = 3;
const LABEL_SLIDE_STEP_PX = 4;
const ITEM_LABEL_INSET_PX = 3; // clearance between an item label and the wall edge
const CATALOG_DRAG_THRESHOLD_PX = 6;
const MARQUEE_THRESHOLD_PX = 3;
const PRESS_TRAVEL_PX = 3; // below this a press on a group member is a click, not a move
const MENU_EDGE_PX = 8;

const RESIZE_HANDLES_HTML = ['e', 's', 'se']
    .map(dir => `<span class="resize-handle handle-${dir}" data-handle="${dir}" aria-hidden="true"></span>`)
    .join('');

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
const marqueeBox = document.getElementById('selection-marquee');
const selectionBounds = document.getElementById('selection-bounds');

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
const exportPngBtn = document.getElementById('export-png-btn');

const viewSpecBtn = document.getElementById('view-spec-btn');
const specModal = document.getElementById('spec-modal');
const specSubtitle = document.getElementById('spec-modal-subtitle');
const specNote = document.getElementById('spec-mounting-note');
const bomBody = document.getElementById('bom-body');
const bomFoot = document.getElementById('bom-foot');
const mountingBody = document.getElementById('mounting-body');
const copyMarkdownBtn = document.getElementById('copy-markdown-btn');
const closeSpecBtn = document.getElementById('close-spec-btn');

const shortcutsBtn = document.getElementById('shortcuts-btn');
const shortcutsModal = document.getElementById('shortcuts-modal');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
const templateButtons = document.querySelectorAll('.template-btn');

const isModalOpen = () => specModal.open || shortcutsModal.open;

const accentColorPicker = document.getElementById('accent-color-picker');
const accentHexCode = document.getElementById('accent-hex-code');
const cornerColorPicker = document.getElementById('corner-color-picker');
const cornerHexCode = document.getElementById('corner-hex-code');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
const presetButtons = document.querySelectorAll('.btn-preset');

const contextMenu = document.getElementById('context-menu');
const contextMenuTitle = document.getElementById('context-menu-title');
const contextMenuButtons = [...contextMenu.querySelectorAll('.context-menu-item')];

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
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut', ledEnabled: true, locked: false, itemLedColor: null },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black', ledEnabled: true, locked: false, itemLedColor: null }
];

const templateItem = (type, leftCm, topCm, finish) => ({ type, left: leftCm * SCALE, top: topCm * SCALE, finish });

// Positions are in cm. Every template is collision-free, and Attic Corner stays clear of the slope.
const LAYOUT_TEMPLATES = {
    'studio-default': {
        label: 'Studio Default',
        wallWidthCm: 300,
        wallHeightCm: 250,
        atticSlope: false,
        items: defaultItems
    },
    'gallery-storage': {
        label: 'Gallery & Storage',
        wallWidthCm: 320,
        wallHeightCm: 250,
        atticSlope: false,
        // Posters, spotlights and shelf share the 160 cm center line. A 75 cm unit cannot be centered on
        // a 320 cm wall at whole-cm precision, so the storage sits 0.5 cm left of it.
        items: [
            templateItem('storage', 122, 170, 'walnut'),
            templateItem('shelf', 105, 148, 'walnut'),
            templateItem('poster', 102, 64, 'black'),
            templateItem('poster', 168, 64, 'black'),
            templateItem('spotlight', 119, 38, 'black'),
            templateItem('spotlight', 185, 38, 'black'),
            templateItem('corner-lamp', 284, 110, 'black')
        ]
    },
    'attic-corner': {
        label: 'Attic Corner',
        wallWidthCm: 300,
        wallHeightCm: 240,
        atticSlope: true,
        // The top shelf, cube and lamp tuck under the slope with 12 to 24 cm of clearance
        items: [
            templateItem('shelf', 150, 70, 'walnut'),
            templateItem('cube', 196, 34, 'oak'),
            templateItem('spotlight', 162, 40, 'black'),
            templateItem('corner-lamp', 266, 100, 'black'),
            templateItem('shelf', 30, 150, 'walnut')
        ]
    }
};

let isAmbientMode = true;
// Kept in selection order; layer order comes from wallItems whenever it matters
let selectedItemIds = [];
let wallItems = [];
let ignoreWallClick = false;
let wallClickGuard = 0;
let suppressAltMenu = false;
let idCounter = 0;
let ioStatusTimer = 0;
let fitFrame = 0;
let copyLabelTimer = 0;

let wallWidthCm = DEFAULT_WALL_WIDTH_CM;
let wallHeightCm = DEFAULT_WALL_HEIGHT_CM;
let wallWidthPx = wallWidthCm * SCALE;
let wallHeightPx = wallHeightCm * SCALE;
let viewScale = 1;

let labelMetrics = { single: 34, digit: 6, height: 18 };
let itemLabelSizes = new Map();
const alignLinePool = [];

let historyStack = [];
let historyIndex = -1;
let lastHistoryPush = { mergeKey: null, time: 0 };

// A drag always moves the whole selection; a single item is simply a group of one
const createIdleDragState = () => ({
    isDragging: false,
    itemId: null,
    members: [],
    excludedIds: new Set(),
    bounds: null,
    group: false,
    blocked: false,
    travelled: false,
    wallRect: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    pointerX: 0,
    pointerY: 0,
    pressX: 0,
    pressY: 0,
    startLeft: 0,
    startTop: 0,
    altKey: false,
    frameId: 0
});

let dragState = createIdleDragState();

const createIdleResizeState = () => ({
    active: false,
    itemId: null,
    element: null,
    handle: null,
    wallRect: null,
    scale: 1,
    startLocalX: 0,
    startLocalY: 0,
    pointerX: 0,
    pointerY: 0,
    startWidth: 0,
    startHeight: 0,
    frameId: 0
});

let resizeState = createIdleResizeState();

const createIdleCatalogDrag = () => ({
    pending: false,
    active: false,
    source: null,
    ghost: null,
    canvasRect: null,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    frameId: 0
});

let catalogDrag = createIdleCatalogDrag();
let suppressCatalogClick = false;
let catalogClickGuard = 0;

const createIdleMarquee = () => ({
    pending: false,
    active: false,
    baseIds: [],
    hitIds: [],
    elements: [],
    wallRect: null,
    scale: 1,
    originX: 0,
    originY: 0,
    pressX: 0,
    pressY: 0,
    pointerX: 0,
    pointerY: 0,
    frameId: 0
});

let marquee = createIdleMarquee();

const isPointerBusy = () => dragState.isDragging || resizeState.active || catalogDrag.active || marquee.active;

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultItems));
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const quantize = (px, step) => Math.round(px / step) * step;
const toCm = (px) => Math.round(px / SCALE);
const isWholeCm = (px) => Math.abs(px / SCALE - Math.round(px / SCALE)) < EPSILON;
const formatOffset = (item) => `${toCm(item.left)} cm (X), ${toCm(item.top)} cm (Y)`;
const formatFootprint = (box) => `${toCm(box.width)} x ${toCm(box.height)} cm`;
const isSelected = (itemId) => selectedItemIds.includes(itemId);
const getSelectedItems = () => wallItems.filter(item => selectedItemIds.includes(item.id));
// The single-item editors only apply when exactly one item is selected
const getSelectedItem = () => (selectedItemIds.length === 1 ? wallItems.find(i => i.id === selectedItemIds[0]) : undefined);
const getItemElement = (itemId) => wallItemsLayer.querySelector(`.wall-item[data-id="${itemId}"]`);
const createItemId = () => `item-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const isLedOn = (item) => item.ledEnabled !== false;
const ledColorOf = (item) => (isHexColor(item.itemLedColor)
    ? item.itemLedColor
    : (item.type === 'corner-lamp' ? cornerColorPicker : accentColorPicker).value);

function getBounds(items) {
    const left = Math.min(...items.map(i => i.left));
    const top = Math.min(...items.map(i => i.top));
    const right = Math.max(...items.map(i => i.left + i.width));
    const bottom = Math.max(...items.map(i => i.top + i.height));
    return { left, top, width: right - left, height: bottom - top };
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

// A typed "?" belongs to any form control that has focus, so the guide shortcut stays out of all of them
const isFormField = (el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;

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
    if (resizeState.active) {
        resizeState.wallRect = wallCanvas.getBoundingClientRect();
        resizeState.scale = viewScale;
    }
    if (catalogDrag.active) {
        catalogDrag.canvasRect = canvasArea.getBoundingClientRect();
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
        ledEnabled: typeof raw.ledEnabled === 'boolean' ? raw.ledEnabled : true,
        locked: raw.locked === true,
        // Files from before v1.3 have no per-item color, so those items follow the global lighting
        itemLedColor: isHexColor(raw.itemLedColor) ? raw.itemLedColor.toLowerCase() : null
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
    if (isPointerBusy() || target < 0 || target >= historyStack.length) return;

    historyIndex = target;
    lastHistoryPush = { mergeKey: null, time: 0 };

    const snapshot = JSON.parse(historyStack[historyIndex]);
    setWallDimensions(snapshot.wallWidthCm, snapshot.wallHeightCm);
    wallItems = snapshot.items;
    atticSlopeToggle.checked = snapshot.atticSlope;
    selectedItemIds = selectedItemIds.filter(id => wallItems.some(item => item.id === id));

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
        const selectedClass = isSelected(item.id) ? 'selected' : '';
        const finishClass = item.finish ? `finish-${item.finish}` : 'finish-walnut';
        const ledClass = isLedOn(item) ? '' : 'led-off';
        const lockClass = item.locked ? 'locked' : '';
        const ledColor = isHexColor(item.itemLedColor) ? ` --item-color: ${item.itemLedColor};` : '';
        return `
            <div class="wall-item ${item.type} ${finishClass} ${selectedClass} ${ledClass} ${lockClass}"
                 data-id="${escapeHtml(item.id)}"
                 style="left: ${item.left}px; top: ${item.top}px; width: ${item.width}px; height: ${item.height}px;${ledColor}">
                <span class="item-label">${item.locked ? LOCK_ICON_HTML : ''}${escapeHtml(item.name)}</span>
            </div>
        `;
    }).join('');

    const elements = [...wallItemsLayer.children];
    elements.forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    // Every label is measured before any is moved, so a render costs one layout and drag frames none
    itemLabelSizes = new Map(elements.map(el => {
        const label = el.querySelector('.item-label');
        return [el.dataset.id, { width: label.offsetWidth, height: label.offsetHeight }];
    }));
    wallItems.forEach((item, index) => {
        placeItemLabel(item, elements[index]);
        flagWallEdges(item, elements[index]);
    });
    syncResizeHandles();
    syncSelectionBounds();

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

// The excluded ids are the selection itself, so a group measures only to items outside it
function findNeighborGaps(item, excludedIds) {
    const right = item.left + item.width;
    const bottom = item.top + item.height;
    const nearest = {};

    const consider = (side, gap, other) => {
        if (!nearest[side] || gap < nearest[side].gap) nearest[side] = { gap, other };
    };

    wallItems.forEach(other => {
        if (excludedIds.has(other.id)) return;
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

// A multi-selection is measured as one box, the same box the group drag snaps with
function updateDistanceGuides() {
    const selected = getSelectedItems();
    if (!selected.length) {
        Object.values(rulers).forEach(ruler => setRuler(ruler, null));
        return;
    }

    const item = selected.length === 1 ? selected[0] : getBounds(selected);
    const gaps = findNeighborGaps(item, new Set(selectedItemIds));
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

function getAlignTargets(excludedIds, axis) {
    const targets = axis === 'x' ? [{ value: wallWidthPx / 2, other: null }] : [];
    wallItems.forEach(other => {
        if (excludedIds.has(other.id)) return;
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

function updateInspectorLive() {
    const posReadout = document.getElementById('inspector-pos-readout');
    const selected = getSelectedItems();
    if (!posReadout || !selected.length) return;

    const box = selected.length === 1 ? selected[0] : getBounds(selected);
    posReadout.textContent = formatOffset(box);
    const footprint = document.getElementById('batch-footprint-readout');
    if (footprint) footprint.textContent = formatFootprint(box);
    document.getElementById('warning-overlap').hidden = !selected.some(hasOverlap);
    document.getElementById('warning-attic').hidden = !selected.some(intrudesAtticSlope);
}

// Lamps and spotlights carry labels wider than themselves, so near a wall edge the label
// shifts just far enough to stay inside the wall instead of being clipped by it
function labelShift(start, size, labelSize, limit) {
    const labelStart = start + (size - labelSize) / 2;
    const maxStart = Math.max(ITEM_LABEL_INSET_PX, limit - ITEM_LABEL_INSET_PX - labelSize);
    return clamp(labelStart, ITEM_LABEL_INSET_PX, maxStart) - labelStart;
}

function placeItemLabel(item, el) {
    const size = itemLabelSizes.get(item.id);
    const label = el.querySelector('.item-label');
    if (!size || !label) return;

    const dx = labelShift(item.left, item.width, size.width, wallWidthPx);
    const dy = labelShift(item.top, item.height, size.height, wallHeightPx);
    label.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
}

// Grips normally straddle the item edge; flush against the wall they would be half clipped,
// so these flags tuck them inside the item there
function flagWallEdges(item, el) {
    el.classList.toggle('flush-right', item.left + item.width >= wallWidthPx - EPSILON);
    el.classList.toggle('flush-bottom', item.top + item.height >= wallHeightPx - EPSILON);
}

// Position-only updates skip renderPlanner so dragging and nudging never rebuild the DOM.
// Each member gets its inline styles first, then the shared readouts run once for the whole group.
function syncPositions(members) {
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
}

function syncSelectionBounds() {
    const selected = getSelectedItems();
    selectionBounds.hidden = selected.length < 2;
    if (selected.length < 2) return;

    const box = getBounds(selected);
    selectionBounds.style.left = `${box.left}px`;
    selectionBounds.style.top = `${box.top}px`;
    selectionBounds.style.width = `${box.width}px`;
    selectionBounds.style.height = `${box.height}px`;
}

// A press that starts on an item, dragged or not, can end with the cursor off the item.
// The click that follows would land on the wall and deselect, so it is swallowed.
// Browsers run input ahead of timers, so the token stops a late timer from an earlier press
// clearing the guard of the press in progress.
function guardNextWallClick() {
    const token = ++wallClickGuard;
    ignoreWallClick = true;
    window.addEventListener('mouseup', () => setTimeout(() => {
        if (token === wallClickGuard) ignoreWallClick = false;
    }, 0), { once: true });
}

// Selection changes without a re-render, so the grips are moved to the selected item here
function syncResizeHandles() {
    wallItemsLayer.querySelectorAll('.resize-handle').forEach(handle => handle.remove());

    const item = getSelectedItem();
    const el = item && !item.locked ? getItemElement(item.id) : null;
    if (!el) return;

    el.insertAdjacentHTML('beforeend', RESIZE_HANDLES_HTML);
    el.querySelectorAll('.resize-handle').forEach(handle => handle.addEventListener('mousedown', startResize));
}

function syncInspectorSize(item) {
    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');
    if (widthInput) widthInput.value = toCm(item.width);
    if (heightInput) heightInput.value = toCm(item.height);
}

// Size-only counterpart of syncItemPosition: inline styles and live readouts, no rebuild
function syncItemSize(item, el) {
    el.style.width = `${item.width}px`;
    el.style.height = `${item.height}px`;
    placeItemLabel(item, el);
    flagWallEdges(item, el);
    updateCollisionStates();
    updateDistanceGuides();
    updateInspectorLive();
    syncInspectorSize(item);
}

function startResize(e) {
    if (e.button !== 0) return;
    // The grip sits inside the item, so the press must not reach the item and start a move
    e.stopPropagation();
    e.preventDefault();
    guardNextWallClick();

    const handle = e.currentTarget;
    const el = handle.closest('.wall-item');
    const item = el && wallItems.find(i => i.id === el.dataset.id);
    if (!item || item.locked || isPointerBusy()) return;

    const wallRect = wallCanvas.getBoundingClientRect();
    resizeState = {
        ...createIdleResizeState(),
        active: true,
        itemId: item.id,
        element: el,
        handle: handle.dataset.handle,
        wallRect,
        scale: viewScale,
        startLocalX: (e.clientX - wallRect.left) / viewScale,
        startLocalY: (e.clientY - wallRect.top) / viewScale,
        pointerX: e.clientX,
        pointerY: e.clientY,
        startWidth: item.width,
        startHeight: item.height
    };

    handle.classList.add('is-active');
    document.body.classList.add(`is-resizing-${resizeState.handle}`);
}

function applyResizeFrame() {
    resizeState.frameId = 0;

    const item = wallItems.find(i => i.id === resizeState.itemId);
    if (!item) return;

    const { wallRect, scale, pointerX, pointerY, startLocalX, startLocalY, startWidth, startHeight, handle } = resizeState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;

    // Wall-space pointer travel, so the grip tracks the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    if (handle !== 's') {
        item.width = clamp(quantize(startWidth + localX - startLocalX, step), MIN_WIDTH_CM * SCALE, wallWidthPx - item.left);
    }
    if (handle !== 'e') {
        item.height = clamp(quantize(startHeight + localY - startLocalY, step), MIN_HEIGHT_CM * SCALE, wallHeightPx - item.top);
    }

    syncItemSize(item, resizeState.element);
}

function scheduleResizeFrame() {
    if (resizeState.active && !resizeState.frameId) {
        resizeState.frameId = requestAnimationFrame(applyResizeFrame);
    }
}

function endResize() {
    if (resizeState.frameId) cancelAnimationFrame(resizeState.frameId);
    resizeState.element.querySelector('.resize-handle.is-active')?.classList.remove('is-active');
    document.body.classList.remove(`is-resizing-${resizeState.handle}`);
    resizeState = createIdleResizeState();
}

function finishResize() {
    if (resizeState.frameId) {
        cancelAnimationFrame(resizeState.frameId);
        applyResizeFrame();
    }

    const item = wallItems.find(i => i.id === resizeState.itemId);
    const changed = item && (item.width !== resizeState.startWidth || item.height !== resizeState.startHeight);
    endResize();

    if (changed) {
        commitLayoutChange();
        updateInspectorPanel();
    }
}

// Escape puts the item back exactly as it was when the grip was pressed
function cancelResize() {
    const item = wallItems.find(i => i.id === resizeState.itemId);
    const el = resizeState.element;
    if (item) {
        item.width = resizeState.startWidth;
        item.height = resizeState.startHeight;
    }
    endResize();
    if (item && el) syncItemSize(item, el);
}

function startDrag(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    guardNextWallClick();

    const el = e.currentTarget;
    const item = wallItems.find(i => i.id === el.dataset.id);
    if (!item) return;

    if (e.shiftKey) {
        toggleInSelection(item.id);
        return;
    }

    // Pressing a member of a multi-selection keeps the group so the whole set can be dragged
    const group = selectedItemIds.length > 1 && isSelected(item.id);
    if (!group) selectItem(item.id);

    const members = getSelectedItems();
    const blocked = members.some(member => member.locked);

    // Locked items can still be selected, they just never start a drag
    if (blocked) flashLockNote();
    if (blocked && !group) return;

    // The page never scrolls, so one layout read at drag start is enough unless the window resizes
    const wallRect = wallCanvas.getBoundingClientRect();
    const bounds = members.length === 1 ? { ...members[0] } : getBounds(members);

    dragState = {
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
        scale: viewScale,
        offsetX: (e.clientX - wallRect.left) / viewScale - bounds.left,
        offsetY: (e.clientY - wallRect.top) / viewScale - bounds.top,
        pointerX: e.clientX,
        pointerY: e.clientY,
        pressX: e.clientX,
        pressY: e.clientY,
        startLeft: bounds.left,
        startTop: bounds.top,
        altKey: e.altKey
    };

    if (e.altKey) suppressAltMenu = true;
    if (!blocked) dragState.members.forEach(({ element }) => element?.classList.add('dragging'));
}

function groupFitsAt(dx, dy) {
    return dragState.members.every(({ item, startLeft, startTop, clearOfSlope }) =>
        !clearOfSlope || !intrudesAtticSlope({ ...item, left: startLeft + dx, top: startTop + dy }));
}

// A group moves as one rigid block. When the wanted spot pushes a member into the slope, the block
// slides along whichever axis is still free, and otherwise holds its last valid position.
function resolveGroupOffset(dx, dy) {
    const lastDx = dragState.bounds.left - dragState.startLeft;
    const lastDy = dragState.bounds.top - dragState.startTop;
    const candidates = [[dx, dy], [dx, lastDy], [lastDx, dy]];
    return candidates.find(([cx, cy]) => groupFitsAt(cx, cy)) || [lastDx, lastDy];
}

function applyDragFrame() {
    dragState.frameId = 0;
    if (dragState.blocked) return;

    const { wallRect, scale, pointerX, pointerY, offsetX, offsetY, members, excludedIds } = dragState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;
    const box = { ...dragState.bounds };

    // Screen deltas are divided by the view scale so the item stays under the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    // Clamping the bounding box keeps every member inside the wall without bending the group
    box.left = clamp(quantize(localX - offsetX, step), 0, wallWidthPx - box.width);
    box.top = clamp(quantize(localY - offsetY, step), 0, wallHeightPx - box.height);

    const xTargets = dragState.altKey ? [] : getAlignTargets(excludedIds, 'x');
    const yTargets = dragState.altKey ? [] : getAlignTargets(excludedIds, 'y');
    box.left = snapAxis(box, 'x', box.left, xTargets);
    box.top = snapAxis(box, 'y', box.top, yTargets);

    let dx = box.left - dragState.startLeft;
    let dy = box.top - dragState.startTop;
    if (members.length > 1) {
        [dx, dy] = resolveGroupOffset(dx, dy);
        box.left = dragState.startLeft + dx;
        box.top = dragState.startTop + dy;
    }

    members.forEach(member => {
        member.item.left = member.startLeft + dx;
        member.item.top = member.startTop + dy;
    });
    dragState.bounds = box;

    syncPositions(members);
    renderAlignGuides([...collectAlignLines(box, 'x', xTargets), ...collectAlignLines(box, 'y', yTargets)]);
}

// High polling-rate mice fire several events per frame; only the latest one matters
function scheduleDragFrame() {
    if (dragState.isDragging && !dragState.frameId) {
        dragState.frameId = requestAnimationFrame(applyDragFrame);
    }
}

window.addEventListener('mousemove', (e) => {
    if (resizeState.active) {
        resizeState.pointerX = e.clientX;
        resizeState.pointerY = e.clientY;
        scheduleResizeFrame();
        return;
    }

    if (catalogDrag.pending) {
        trackCatalogDrag(e);
        return;
    }

    if (marquee.pending) {
        trackMarquee(e);
        return;
    }

    if (!dragState.isDragging) return;

    dragState.pointerX = e.clientX;
    dragState.pointerY = e.clientY;
    dragState.altKey = e.altKey;
    if (!dragState.travelled) {
        dragState.travelled = Math.hypot(e.clientX - dragState.pressX, e.clientY - dragState.pressY) > PRESS_TRAVEL_PX;
    }
    if (e.altKey) suppressAltMenu = true;
    scheduleDragFrame();
});

window.addEventListener('mouseup', () => {
    if (!dragState.isDragging) return;

    if (dragState.frameId) {
        cancelAnimationFrame(dragState.frameId);
        applyDragFrame();
    }

    const { members, group, travelled, itemId } = dragState;
    const moved = members.some(({ item, startLeft, startTop }) => item.left !== startLeft || item.top !== startTop);

    members.forEach(({ element }) => element?.classList.remove('dragging'));
    dragState = createIdleDragState();
    renderAlignGuides([]);

    if (moved) commitLayoutChange();
    // A plain click on one member of a group narrows the selection to that member
    if (group && !travelled) selectItem(itemId);
});

window.addEventListener('mouseup', () => {
    if (resizeState.active) finishResize();
});

// The border scales with the wall, so it comes off after converting to wall space
function toWallPoint(clientX, clientY, wallRect, scale) {
    return {
        x: clamp((clientX - wallRect.left) / scale - WALL_BORDER_PX, 0, wallWidthPx),
        y: clamp((clientY - wallRect.top) / scale - WALL_BORDER_PX, 0, wallHeightPx)
    };
}

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
    const origin = toWallPoint(e.clientX, e.clientY, wallRect, viewScale);
    marquee = {
        ...createIdleMarquee(),
        pending: true,
        baseIds: e.shiftKey ? [...selectedItemIds] : [],
        wallRect,
        scale: viewScale,
        originX: origin.x,
        originY: origin.y,
        pressX: e.clientX,
        pressY: e.clientY,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
});

function trackMarquee(e) {
    marquee.pointerX = e.clientX;
    marquee.pointerY = e.clientY;

    if (!marquee.active) {
        if (Math.hypot(e.clientX - marquee.pressX, e.clientY - marquee.pressY) <= MARQUEE_THRESHOLD_PX) return;
        startMarquee();
    }

    if (!marquee.frameId) marquee.frameId = requestAnimationFrame(applyMarqueeFrame);
}

function startMarquee() {
    marquee.active = true;
    marquee.elements = [...wallItemsLayer.querySelectorAll('.wall-item')];
    // The release can land on an item or the wall; either way its click belongs to the box
    guardNextWallClick();

    // Grips, rulers and the group outline describe the old selection, so they step aside until the release
    wallItemsLayer.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
    Object.values(rulers).forEach(ruler => setRuler(ruler, null));
    selectionBounds.hidden = true;
    marqueeBox.hidden = false;
    document.body.classList.add('is-selecting');
}

// Hits use the same AABB test as collisions, so touching an item edge does not count as crossing it
function applyMarqueeFrame() {
    marquee.frameId = 0;

    const { wallRect, scale, originX, originY, pointerX, pointerY } = marquee;
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

    const ids = new Set(marquee.baseIds);
    wallItems.forEach(item => {
        if (isOverlapping(box, item)) ids.add(item.id);
    });
    marquee.hitIds = [...ids];
    marquee.elements.forEach(el => el.classList.toggle('selected', ids.has(el.dataset.id)));
}

function endMarquee() {
    if (marquee.frameId) cancelAnimationFrame(marquee.frameId);
    marqueeBox.hidden = true;
    document.body.classList.remove('is-selecting');
    marquee = createIdleMarquee();
}

// Escape or a lost window puts the selection back as it was before the box was drawn
function cancelMarquee() {
    endMarquee();
    setSelection(selectedItemIds);
}

window.addEventListener('mouseup', () => {
    if (!marquee.pending) return;

    // Short of the threshold this was a plain click, which the wall click handler deals with
    if (!marquee.active) {
        marquee = createIdleMarquee();
        return;
    }

    if (marquee.frameId) {
        cancelAnimationFrame(marquee.frameId);
        applyMarqueeFrame();
    }
    const ids = marquee.hitIds;
    endMarquee();
    setSelection(ids);
});

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
        finish: catalogEl.dataset.finish || 'walnut',
        ledEnabled: true,
        locked: false,
        itemLedColor: null
    };

    wallItems.push(newItem);
    selectedItemIds = [newItem.id];
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function spawnFromCatalog(catalogEl) {
    const offset = (wallItems.length * 20) % 160;
    const width = parseFloat(catalogEl.dataset.width);
    const height = parseFloat(catalogEl.dataset.height);

    // The cascade offset alone can push tall pieces past the floor line
    mountCatalogItem(catalogEl, clamp(200 + offset, 0, wallWidthPx - width), clamp(220 + offset, 0, wallHeightPx - height));
}

const pointInRect = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

function startCatalogDrag() {
    const { source } = catalogDrag;
    const width = parseFloat(source.dataset.width);
    const height = parseFloat(source.dataset.height);

    const ghost = document.createElement('div');
    ghost.className = 'catalog-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    ghost.innerHTML = `
        <div class="wall-item ${source.dataset.type} finish-${source.dataset.finish || 'walnut'}" style="width: ${width}px; height: ${height}px;">
            <span class="item-label">${escapeHtml(source.dataset.name)}</span>
        </div>`;
    document.body.appendChild(ghost);

    catalogDrag.active = true;
    catalogDrag.ghost = ghost;
    catalogDrag.canvasRect = canvasArea.getBoundingClientRect();
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
    catalogDrag.pointerX = e.clientX;
    catalogDrag.pointerY = e.clientY;

    if (!catalogDrag.active) {
        const travel = Math.hypot(e.clientX - catalogDrag.startX, e.clientY - catalogDrag.startY);
        if (travel <= CATALOG_DRAG_THRESHOLD_PX) return;
        startCatalogDrag();
    }

    if (!catalogDrag.frameId) catalogDrag.frameId = requestAnimationFrame(applyCatalogDragFrame);
}

// The ghost is centered on the cursor and scaled like the wall, previewing exactly where the drop lands
function applyCatalogDragFrame() {
    catalogDrag.frameId = 0;
    const { ghost, source, pointerX, pointerY, canvasRect } = catalogDrag;
    if (!ghost) return;

    const width = parseFloat(source.dataset.width) * viewScale;
    const height = parseFloat(source.dataset.height) * viewScale;
    const overCanvas = pointInRect(canvasRect, pointerX, pointerY);

    ghost.style.transform = `translate(${pointerX - width / 2}px, ${pointerY - height / 2}px) scale(${viewScale})`;
    ghost.classList.toggle('is-over-wall', overCanvas);
    wallCanvas.classList.toggle('drop-target', overCanvas);
}

function endCatalogDrag() {
    if (catalogDrag.frameId) cancelAnimationFrame(catalogDrag.frameId);
    catalogDrag.ghost?.remove();
    document.body.classList.remove('is-placing');
    wallCanvas.classList.remove('drop-target');
    catalogDrag = createIdleCatalogDrag();
}

function dropCatalogItem(catalogEl, clientX, clientY) {
    const wallRect = wallCanvas.getBoundingClientRect();
    const width = parseFloat(catalogEl.dataset.width);
    const height = parseFloat(catalogEl.dataset.height);
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;

    // The border scales with the wall, so it comes off after converting to wall space
    const localX = (clientX - wallRect.left) / viewScale - WALL_BORDER_PX;
    const localY = (clientY - wallRect.top) / viewScale - WALL_BORDER_PX;

    mountCatalogItem(
        catalogEl,
        clamp(quantize(localX - width / 2, step), 0, wallWidthPx - width),
        clamp(quantize(localY - height / 2, step), 0, wallHeightPx - height)
    );
}

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || isPointerBusy() || isModalOpen()) return;
        // Stops text selection while the card is pulled across the sidebar
        e.preventDefault();
        suppressCatalogClick = false;
        catalogDrag = {
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
    if (!catalogDrag.pending) return;

    // Short of the threshold this was a plain click, which the click handler mounts
    if (!catalogDrag.active) {
        catalogDrag = createIdleCatalogDrag();
        return;
    }

    const { source, canvasRect } = catalogDrag;
    const overCanvas = pointInRect(canvasRect, e.clientX, e.clientY);
    endCatalogDrag();
    if (overCanvas) dropCatalogItem(source, e.clientX, e.clientY);
});

// Losing the window mid-drag means the release will never arrive
window.addEventListener('blur', () => {
    if (catalogDrag.active) endCatalogDrag();
    else if (catalogDrag.pending) catalogDrag = createIdleCatalogDrag();
    if (resizeState.active) cancelResize();
    if (marquee.active) cancelMarquee();
    else if (marquee.pending) marquee = createIdleMarquee();
    closeContextMenu();
});

function setSelection(ids) {
    const unique = [...new Set(ids)];
    selectedItemIds = unique.filter(id => wallItems.some(item => item.id === id));

    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('selected', isSelected(el.dataset.id));
    });
    syncResizeHandles();
    syncSelectionBounds();

    updateInspectorPanel();
    updateDistanceGuides();
}

const selectItem = (itemId) => setSelection(itemId ? [itemId] : []);

function toggleInSelection(itemId) {
    setSelection(isSelected(itemId)
        ? selectedItemIds.filter(id => id !== itemId)
        : [...selectedItemIds, itemId]);
}

const selectAll = () => setSelection(wallItems.map(item => item.id));

// Locked items survive a removal and stay selected, so the user can see what was skipped
function removeItems(ids) {
    const removable = new Set(wallItems.filter(item => ids.includes(item.id) && !item.locked).map(item => item.id));
    if (!removable.size) return;

    wallItems = wallItems.filter(item => !removable.has(item.id));
    selectedItemIds = selectedItemIds.filter(id => !removable.has(id));
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

const removeSelectedItems = () => removeItems(selectedItemIds);

// Copies keep their relative layout, so the offset is clamped for the group box, not per item
function duplicateSelectedItem() {
    const sources = getSelectedItems();
    if (!sources.length) return;

    const box = getBounds(sources);
    const dx = clamp(DUPLICATE_OFFSET_PX, -box.left, wallWidthPx - box.left - box.width);
    const dy = clamp(DUPLICATE_OFFSET_PX, -box.top, wallHeightPx - box.top - box.height);

    const copies = sources.map(source => ({
        ...JSON.parse(JSON.stringify(source)),
        id: createItemId(),
        // A copy starts unlocked so it can be placed right away
        locked: false,
        left: source.left + dx,
        top: source.top + dy
    }));

    wallItems.push(...copies);
    selectedItemIds = copies.map(copy => copy.id);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// A mixed selection locks everything first; only a fully locked selection unlocks
function toggleSelectedLock() {
    const items = getSelectedItems();
    if (!items.length) return;

    const lock = items.some(item => !item.locked);
    items.forEach(item => { item.locked = lock; });
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function canMoveLayer(step) {
    return wallItems.some((item, index) => {
        const neighbor = wallItems[index + step];
        return isSelected(item.id) && neighbor && !isSelected(neighbor.id);
    });
}

// wallItems is also the paint order in #wall-items. Walking from the leading end lets every selected
// item hop over its unselected neighbor once, so a group shifts one layer and keeps its inner order.
function moveSelectedLayer(step) {
    if (!canMoveLayer(step)) return;

    const indexes = wallItems.map((_, index) => index);
    if (step > 0) indexes.reverse();
    indexes.forEach(index => {
        const target = index + step;
        const neighbor = wallItems[target];
        if (isSelected(wallItems[index].id) && neighbor && !isSelected(neighbor.id)) {
            [wallItems[index], wallItems[target]] = [neighbor, wallItems[index]];
        }
    });

    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

function flashLockNote() {
    const note = document.getElementById('lock-note');
    if (!note) return;

    note.classList.remove('is-flashing');
    // Reading layout restarts the animation when the user keeps trying to move a locked item
    void note.offsetWidth;
    note.classList.add('is-flashing');
}

function syncLedToggle(button, on) {
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
    <div id="warning-attic" class="collision-warning" hidden>Intrudes into sloped ceiling zone</div>`;

const formatPrice = (value) => `$${Math.round(value * 100) / 100}`;

function applyFinish(finish) {
    const targets = getSelectedItems().filter(item => !item.locked && item.finish !== finish);
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

function syncItemLedField() {
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

function renderItemInspector(item) {
    const ledOn = isLedOn(item);
    const locked = item.locked === true;
    const lockedAttr = locked ? 'disabled' : '';
    const layerIndex = wallItems.indexOf(item);

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <div class="selected-item-header">
                <span class="selected-item-title">${escapeHtml(item.name)}</span>
                <span class="selected-item-meta">
                    ${locked ? `<span class="lock-badge">${LOCK_ICON_HTML}Locked</span>` : ''}
                    <span>$${item.price}</span>
                </span>
            </div>
            <span>Offset: <strong id="inspector-pos-readout">${formatOffset(item)}</strong></span>
            ${locked ? '<p class="lock-note" id="lock-note">Position, size, finish, backlight and removal are locked. Press L or Unlock Item to edit.</p>' : ''}

            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="${MIN_WIDTH_CM}" max="${wallWidthCm}" value="${toCm(item.width)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="${MIN_HEIGHT_CM}" max="${wallHeightCm}" value="${toCm(item.height)}" ${lockedAttr}>
                </div>
            </div>

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
            </div>

            ${layerFieldHtml(`${layerIndex + 1} of ${wallItems.length}`)}
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
        updateInspectorLive();
        commitLayoutChange();
    }

    widthInput.addEventListener('change', applyDimensionChange);
    heightInput.addEventListener('change', applyDimensionChange);

    const ledToggleBtn = document.getElementById('led-toggle-btn');
    ledToggleBtn.addEventListener('click', () => {
        if (item.locked) return;
        item.ledEnabled = !isLedOn(item);
        const el = getItemElement(item.id);
        if (el) el.classList.toggle('led-off', !item.ledEnabled);
        syncLedToggle(ledToggleBtn, item.ledEnabled);
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
    const sharedFinish = items.every(item => item.finish === items[0].finish) ? items[0].finish : null;
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const lockNote = lockedCount
        ? `<p class="lock-note" id="lock-note">${lockedCount} of ${count} items are locked, so the group stays in place. Finish changes and removal skip locked items.</p>`
        : '';

    inspectorBox.innerHTML = `
        <div class="selected-item-info is-batch">
            <div class="selected-item-header">
                <span class="selected-item-title" id="batch-count">${count} items selected</span>
                <span class="selected-item-meta">
                    ${lockedCount ? `<span class="lock-badge">${LOCK_ICON_HTML}${lockedCount} Locked</span>` : ''}
                    <span>${formatPrice(total)}</span>
                </span>
            </div>
            <span>Group: <strong id="inspector-pos-readout">${formatOffset(getBounds(items))}</strong></span>
            <span>Footprint: <strong id="batch-footprint-readout">${formatFootprint(getBounds(items))}</strong></span>
            ${lockNote}

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtonsHtml(sharedFinish, allLocked)}</div>
            </div>

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

function updateInspectorPanel() {
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

const isContextMenuOpen = () => !contextMenu.hidden;

const CONTEXT_ACTIONS = {
    duplicate: duplicateSelectedItem,
    forward: () => moveSelectedLayer(1),
    backward: () => moveSelectedLayer(-1),
    lock: toggleSelectedLock,
    delete: removeSelectedItems
};

function syncContextMenu() {
    const items = getSelectedItems();
    const allLocked = items.every(item => item.locked);
    const lockLabel = allLocked ? 'Unlock' : 'Lock';
    const state = {
        duplicate: { disabled: false },
        forward: { disabled: !canMoveLayer(1) },
        backward: { disabled: !canMoveLayer(-1) },
        lock: { disabled: false, label: items.length > 1 ? `${lockLabel} All` : lockLabel },
        delete: { disabled: allLocked }
    };

    contextMenuTitle.textContent = items.length === 1 ? items[0].name : `${items.length} items selected`;
    contextMenuButtons.forEach(button => {
        const { disabled, label } = state[button.dataset.action];
        button.disabled = disabled;
        if (label) button.querySelector('.context-menu-label').textContent = label;
    });
}

// Measured once visible, then flipped across the cursor wherever it would run past the viewport
function openContextMenu(clientX, clientY) {
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
    // The panel takes focus rather than its first item, so a mouse open shows no highlighted row
    // while the arrow keys still start from the top or the bottom
    contextMenu.focus({ preventScroll: true });
}

function closeContextMenu() {
    if (contextMenu.hidden) return;
    contextMenu.hidden = true;
    if (contextMenu.contains(document.activeElement)) document.activeElement.blur();
}

// While the menu is open the arrows walk its items and Escape or Tab dismisses it. Any other key closes
// the menu and carries on, so the shortcut printed next to an item still does its job.
function handleContextMenuKey(e) {
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

wallItemsLayer.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.wall-item');
    if (!el) return;

    e.preventDefault();
    if (isPointerBusy() || isModalOpen()) return;
    if (!isSelected(el.dataset.id)) selectItem(el.dataset.id);
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

// Plain L toggles the lock; Ctrl/Cmd+L stays with the browser address bar
const isLockShortcut = (e) =>
    (e.key || '').toLowerCase() === 'l' &&
    !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat &&
    selectedItemIds.length > 0 && !isPointerBusy() && !isTextEntry(e.target);

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

    if (key === 'd' && selectedItemIds.length) {
        // Stops the browser bookmark dialog; holding the keys should not spawn a stack of copies
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) duplicateSelectedItem();
        return true;
    }

    // Ctrl+A would otherwise select the page text around the wall
    if (key === 'a' && !e.shiftKey) {
        e.preventDefault();
        if (!isPointerBusy()) selectAll();
        return true;
    }

    return false;
}

// A group nudge clamps the shared offset to the group box, so members never squeeze against a wall
// edge out of formation. Like a group drag it refuses to push a member newly into the slope.
function nudgeSelection(items, dx, dy) {
    const box = getBounds(items);
    const stepX = clamp(dx * SCALE, -box.left, wallWidthPx - box.left - box.width);
    const stepY = clamp(dy * SCALE, -box.top, wallHeightPx - box.top - box.height);
    const blocked = items.length > 1 && items.some(item =>
        !intrudesAtticSlope(item) && intrudesAtticSlope({ ...item, left: item.left + stepX, top: item.top + stepY }));
    if (blocked || (!stepX && !stepY)) return false;

    items.forEach(item => {
        item.left += stepX;
        item.top += stepY;
    });
    return true;
}

// Arrow keys for 1cm nudging, Delete/Backspace to remove
function handleItemKeys(e) {
    if (!selectedItemIds.length || isPointerBusy()) return;
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
        if (dx) item.left = clamp((toCm(item.left) + dx) * SCALE, 0, wallWidthPx - item.width);
        if (dy) item.top = clamp((toCm(item.top) + dy) * SCALE, 0, wallHeightPx - item.height);
    } else if (!nudgeSelection(items, dx, dy)) {
        return;
    }

    syncPositions(items.map(item => ({ item, element: getItemElement(item.id) })));
    pushHistory(`nudge:${selectedItemIds.join(',')}`);
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
    if (!selectedItemIds.length || isPointerBusy() || isTextEntry(e.target)) return;
    selectItem(null);
}

window.addEventListener('keydown', (e) => {
    // Escape abandons a catalog drag, a grip resize or a selection box before anything else sees the key
    if (e.key === 'Escape' && (catalogDrag.active || resizeState.active || marquee.active)) {
        e.preventDefault();
        if (catalogDrag.active) endCatalogDrag();
        if (resizeState.active) cancelResize();
        if (marquee.active) cancelMarquee();
        return;
    }

    if (isContextMenuOpen() && handleContextMenuKey(e)) return;

    if (e.key === '?' && !isFormField(e.target)) {
        handleShortcutsKey(e);
        return;
    }

    // An open dialog is modal, so nothing behind it may react to shortcuts
    if (isModalOpen()) return;

    if (e.key === 'Escape') {
        handleEscape(e);
        return;
    }

    if (e.key === 'Alt' && dragState.isDragging) {
        // Alt or Option suspends magnetic alignment for as long as it is held
        e.preventDefault();
        dragState.altKey = true;
        suppressAltMenu = true;
        scheduleDragFrame();
        return;
    }

    if (isLockShortcut(e)) {
        e.preventDefault();
        toggleSelectedLock();
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

// Shift keeps the selection, so a missed Shift-click does not throw away a group
wallCanvas.addEventListener('click', (e) => {
    if (ignoreWallClick || e.shiftKey) return;
    if (selectedItemIds.length) selectItem(null);
});

function applyAtticSlope() {
    atticZone.hidden = !atticSlopeToggle.checked;
    updateCollisionStates();
    updateInspectorLive();
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
    selectedItemIds = [];
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

    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), EXPORT_FILENAME);
    showIoStatus('Layout exported.', 'success');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking in the same tick can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 0);
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

    selectedItemIds = [];
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

const formatMoney = (value) => `$${value.toFixed(2)}`;
const finishLabel = (id) => (FINISHES.find(f => f.id === id) || { label: id }).label;
const markdownCell = (value) => String(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|');
const totalPrice = () => wallItems.reduce((sum, item) => sum + item.price, 0);

function buildBomRows() {
    const groups = new Map();
    wallItems.forEach(item => {
        const widthCm = toCm(item.width);
        const heightCm = toCm(item.height);
        const key = JSON.stringify([item.type, item.name, widthCm, heightCm, item.finish, item.price]);
        const group = groups.get(key);
        if (group) group.qty += 1;
        else groups.set(key, { name: item.name, widthCm, heightCm, finish: item.finish, price: item.price, qty: 1 });
    });

    return [...groups.values()].sort((a, b) =>
        a.name.localeCompare(b.name) || a.widthCm - b.widthCm || a.heightCm - b.heightCm || a.finish.localeCompare(b.finish));
}

// Installers work along the wall, so rows run left to right, then top to bottom
function buildMountingRows() {
    return [...wallItems]
        .sort((a, b) => a.left - b.left || a.top - b.top)
        .map(item => {
            const topCm = toCm(item.top);
            const heightCm = toCm(item.height);
            return {
                name: item.name,
                size: `${toCm(item.width)} x ${heightCm} cm`,
                left: toCm(item.left),
                top: topCm,
                floor: wallHeightCm - topCm - heightCm
            };
        });
}

function renderSpecSheet() {
    const bomRows = buildBomRows();
    const mountingRows = buildMountingRows();
    const count = wallItems.length;

    specSubtitle.textContent = `Wall ${wallWidthCm} x ${wallHeightCm} cm | ${count} item${count === 1 ? '' : 's'}`;
    specNote.textContent = MOUNTING_NOTE;

    bomBody.innerHTML = bomRows.length
        ? bomRows.map(row => `
            <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${row.widthCm} x ${row.heightCm} cm</td>
                <td>${finishLabel(row.finish)}</td>
                <td class="num">${row.qty}</td>
                <td class="num">${formatMoney(row.price)}</td>
                <td class="num">${formatMoney(row.price * row.qty)}</td>
            </tr>`).join('')
        : '<tr><td colspan="6" class="spec-empty">No items on the wall yet.</td></tr>';

    bomFoot.innerHTML = `
        <tr>
            <th scope="row" colspan="3">Total</th>
            <td class="num">${count}</td>
            <td></td>
            <td class="num grand-total">${formatMoney(totalPrice())}</td>
        </tr>`;

    mountingBody.innerHTML = mountingRows.length
        ? mountingRows.map(row => `
            <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${row.size}</td>
                <td class="num">${row.left} cm</td>
                <td class="num">${row.top} cm</td>
                <td class="num">${row.floor} cm</td>
            </tr>`).join('')
        : '<tr><td colspan="5" class="spec-empty">No items to mount yet.</td></tr>';
}

function buildSpecMarkdown() {
    const count = wallItems.length;
    const total = formatMoney(totalPrice());

    return [
        '# Spatial Studio Spec Sheet',
        '',
        `Wall: ${wallWidthCm} x ${wallHeightCm} cm | Items: ${count} | Total: ${total}`,
        '',
        '## Bill of Materials',
        '',
        '| Item | Dimensions | Finish | Qty | Unit Price | Subtotal |',
        '| :--- | :--- | :--- | ---: | ---: | ---: |',
        ...buildBomRows().map(row =>
            `| ${markdownCell(row.name)} | ${row.widthCm} x ${row.heightCm} cm | ${finishLabel(row.finish)} | ${row.qty} | ${formatMoney(row.price)} | ${formatMoney(row.price * row.qty)} |`),
        `| **Total** | | | **${count}** | | **${total}** |`,
        '',
        '## Mounting & Drilling Coordinates',
        '',
        MOUNTING_NOTE,
        '',
        '| Item | Size (W x H) | From Left (X) | From Ceiling (Y) | From Floor (Bottom Edge) |',
        '| :--- | :--- | ---: | ---: | ---: |',
        ...buildMountingRows().map(row =>
            `| ${markdownCell(row.name)} | ${row.size} | ${row.left} cm | ${row.top} cm | ${row.floor} cm |`)
    ].join('\n');
}

function flashCopyLabel(text) {
    clearTimeout(copyLabelTimer);
    copyMarkdownBtn.textContent = text;
    copyLabelTimer = setTimeout(() => { copyMarkdownBtn.textContent = COPY_LABEL; }, 2000);
}

// Fallback for contexts without the async clipboard API. The buffer lives inside the dialog
// because everything outside an open modal dialog is inert and cannot be selected.
function copyWithSelection(text) {
    const buffer = document.createElement('textarea');
    buffer.value = text;
    buffer.setAttribute('readonly', '');
    buffer.className = 'clipboard-buffer';
    specModal.appendChild(buffer);
    buffer.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }
    buffer.remove();
    copyMarkdownBtn.focus();
    return copied;
}

async function copySpecMarkdown() {
    const text = buildSpecMarkdown();
    let copied = false;
    try {
        await navigator.clipboard.writeText(text);
        copied = true;
    } catch {
        copied = copyWithSelection(text);
    }
    flashCopyLabel(copied ? 'Copied to Clipboard' : 'Copy failed');
}

function openSpecSheet() {
    if (isModalOpen() || isPointerBusy()) return;

    clearTimeout(copyLabelTimer);
    copyMarkdownBtn.textContent = COPY_LABEL;
    renderSpecSheet();
    specModal.showModal();
}

viewSpecBtn.addEventListener('click', openSpecSheet);
closeSpecBtn.addEventListener('click', () => specModal.close());
copyMarkdownBtn.addEventListener('click', copySpecMarkdown);

// Only a click that starts and ends on the backdrop closes a dialog, so dragging a text
// selection out of the panel does not dismiss it
function closeOnBackdropClick(dialog) {
    let pressedBackdrop = false;
    dialog.addEventListener('mousedown', (e) => {
        pressedBackdrop = e.target === dialog;
    });
    dialog.addEventListener('click', (e) => {
        if (pressedBackdrop && e.target === dialog) dialog.close();
        pressedBackdrop = false;
    });
}

closeOnBackdropClick(specModal);
closeOnBackdropClick(shortcutsModal);

function openShortcuts() {
    if (isModalOpen() || isPointerBusy()) return;
    shortcutsModal.showModal();
}

shortcutsBtn.addEventListener('click', openShortcuts);
closeShortcutsBtn.addEventListener('click', () => shortcutsModal.close());

function loadTemplate(key) {
    const template = LAYOUT_TEMPLATES[key];
    if (!template || isPointerBusy()) return;

    // Templates run through the same sanitizer as imports, which fills in catalog sizes, names and prices
    const layout = normalizeLayout(template);
    selectedItemIds = [];
    applyLayoutSettings(layout);
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    commitLayoutChange();
    showIoStatus(`Loaded the ${template.label} template.`, 'success');
}

templateButtons.forEach(button => {
    button.addEventListener('click', () => loadTemplate(button.dataset.template));
});

function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Splits on the commas between list entries, not the ones inside rgba(...)
function splitTopLevel(value) {
    const parts = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        else if (value[i] === ',' && depth === 0) {
            parts.push(value.slice(from, i));
            from = i + 1;
        }
    }
    parts.push(value.slice(from));
    return parts.map(part => part.trim()).filter(Boolean);
}

// Computed box-shadow entries read like "rgb(0, 0, 0) 0px 8px 15px 0px inset", though some engines put the
// color last. Fully transparent entries are the placeholders the item rules use and are dropped.
function parseShadows(value) {
    if (!value || value === 'none') return [];

    return splitTopLevel(value)
        .map(entry => {
            const color = (entry.match(/rgba?\([^)]*\)/) || [''])[0];
            const [x = 0, y = 0, blur = 0, spread = 0] = (entry.replace(color, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
            return { color, x, y, blur, spread, inset: /\binset\b/.test(entry) };
        })
        .filter(shadow => shadow.color && (parseRgba(shadow.color)?.a ?? 1) > 0);
}

function parseRgba(value) {
    const match = /rgba?\(([^)]*)\)/.exec(value || '');
    if (!match) return null;
    const [r, g, b, a = 1] = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
}

const rgbaString = ({ r, g, b, a }, alpha = a) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

// Reads a CSS polygon() clip path into points inside a w x h box
function parsePolygon(value, w, h) {
    const body = /polygon\(([^)]*)\)/.exec(value || '');
    if (!body) return [];
    const toPx = (token, size) => (token.endsWith('%') ? (parseFloat(token) / 100) * size : parseFloat(token));
    return body[1].split(',').map(pair => {
        const [px, py] = pair.trim().split(/\s+/);
        return [toPx(px, w), toPx(py, h)];
    });
}

function itemShape(item, radius) {
    const percent = radius.endsWith('%') ? parseFloat(radius) : null;
    return {
        x: item.left,
        y: item.top,
        w: item.width,
        h: item.height,
        // A 50% radius is how the spotlight becomes a circle, or an ellipse once resized
        ellipse: percent !== null && percent >= 50,
        radius: percent !== null ? Math.min(item.width, item.height) * percent / 100 : parseFloat(radius) || 0
    };
}

// A negative inset grows the shape, which is how shadow spread is drawn
function traceShape(ctx, shape, inset, startPath = true) {
    const x = shape.x + inset;
    const y = shape.y + inset;
    const w = Math.max(0, shape.w - inset * 2);
    const h = Math.max(0, shape.h - inset * 2);

    if (startPath) ctx.beginPath();
    if (shape.ellipse) {
        ctx.moveTo(x + w, y + h / 2);
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        return;
    }

    const r = Math.max(0, Math.min(shape.radius - inset, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Paints only a shape's shadow: the shape itself is drawn far off canvas and the shadow is offset back.
// Shadow offsets and blur ignore the canvas transform, so they are given in device pixels.
function paintShadowOnly(ctx, shape, shadow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * PNG_PIXEL_RATIO;
    ctx.shadowOffsetX = (shadow.x + SHADOW_SHIFT_PX) * PNG_PIXEL_RATIO;
    ctx.shadowOffsetY = shadow.y * PNG_PIXEL_RATIO;
    ctx.translate(-SHADOW_SHIFT_PX, 0);
    traceShape(ctx, shape, -(shadow.spread || 0));
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
}

// Inset shadows are cast by a frame around the shape: clip to the shape, draw the frame far off canvas,
// and offset only its shadow back inside, the same trick paintShadowOnly uses for outer shadows
function paintInsetShadow(ctx, shape, inset, shadow, alpha) {
    const reach = Math.abs(shadow.x) + Math.abs(shadow.y) + shadow.blur * 2 + Math.abs(shadow.spread) + 20;

    ctx.save();
    traceShape(ctx, shape, inset);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * PNG_PIXEL_RATIO;
    ctx.shadowOffsetX = (shadow.x + SHADOW_SHIFT_PX) * PNG_PIXEL_RATIO;
    ctx.shadowOffsetY = shadow.y * PNG_PIXEL_RATIO;
    ctx.translate(-SHADOW_SHIFT_PX, 0);
    ctx.beginPath();
    ctx.rect(shape.x - reach, shape.y - reach, shape.w + reach * 2, shape.h + reach * 2);
    traceShape(ctx, shape, inset + shadow.spread, false);
    ctx.fillStyle = '#000';
    ctx.fill('evenodd');
    ctx.restore();
}

// Mirrors the --sheen background: a highlight fading down from the top edge and a shade rising from the bottom
function paintSheen(ctx, shape, border, style) {
    const highlight = parseRgba(style.getPropertyValue('--sheen-highlight'));
    const shade = parseRgba(style.getPropertyValue('--sheen-shade'));
    const band = parseFloat(style.getPropertyValue('--sheen-band'));
    const top = shape.y + border;
    const height = shape.h - border * 2;
    if (!highlight || !shade || !(band > 0) || height <= 0) return;

    const edge = Math.min(band / height, 0.5);
    const gradient = ctx.createLinearGradient(0, top, 0, top + height);
    gradient.addColorStop(0, rgbaString(highlight));
    gradient.addColorStop(edge, rgbaString(highlight, 0));
    gradient.addColorStop(1 - edge, rgbaString(shade, 0));
    gradient.addColorStop(1, rgbaString(shade));

    ctx.fillStyle = gradient;
    traceShape(ctx, shape, border);
    ctx.fill();
}

// The poster artwork and the lamp diffuser are ::after boxes, positioned against the padding box
function paintAfterLayer(ctx, item, el, border) {
    const layer = getComputedStyle(el, '::after');
    const alpha = parseFloat(layer.opacity);
    if (layer.content === 'none' || !(alpha > 0)) return;

    const shape = {
        x: item.left + border + parseFloat(layer.left),
        y: item.top + border + parseFloat(layer.top),
        w: parseFloat(layer.width),
        h: parseFloat(layer.height),
        radius: parseFloat(layer.borderTopLeftRadius) || 0,
        ellipse: false
    };
    const shadows = parseShadows(layer.boxShadow);

    shadows.filter(shadow => !shadow.inset).forEach(shadow => paintShadowOnly(ctx, shape, shadow, alpha));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = layer.backgroundColor;
    traceShape(ctx, shape, 0);
    ctx.fill();
    ctx.restore();
    shadows.filter(shadow => shadow.inset).forEach(shadow => paintInsetShadow(ctx, shape, 0, shadow, alpha));
}

// The wash is a clipped trapezoid fading from the item's LED color, read from the spotlight's ::after box
function paintSpotlightCone(ctx, item, el, border) {
    const cone = getComputedStyle(el, '::after');
    const alpha = parseFloat(cone.opacity);
    if (!isAmbientMode || !isLedOn(item) || !(alpha > 0)) return;

    const x = item.left + border + parseFloat(cone.left);
    const y = item.top + border + parseFloat(cone.top);
    const points = parsePolygon(cone.clipPath, parseFloat(cone.width), parseFloat(cone.height));
    if (!points.length) return;

    const [r, g, b] = hexToRgb(ledColorOf(item));
    const gradient = ctx.createLinearGradient(0, y, 0, y + parseFloat(cone.height));
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(SPOTLIGHT_CONE_FADE, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    points.forEach(([px, py], index) => (index ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function paintWallBackground(ctx) {
    ctx.fillStyle = isAmbientMode ? WALL_FILL.ambient : WALL_FILL.daylight;
    ctx.fillRect(0, 0, wallWidthPx, wallHeightPx);
    if (isAmbientMode) return;

    // Same 1px lines every 10 cm as the Daylight Grid background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let x = 0; x < wallWidthPx; x += DAYLIGHT_GRID_PX) ctx.fillRect(x, 0, 1, wallHeightPx);
    for (let y = 0; y < wallHeightPx; y += DAYLIGHT_GRID_PX) ctx.fillRect(0, y, wallWidthPx, 1);
}

function paintAtticZone(ctx, fontFamily) {
    const wallStyle = getComputedStyle(wallCanvas);
    const cssVar = (name) => wallStyle.getPropertyValue(name).trim();
    const startX = wallWidthPx - ATTIC_SLOPE_PX;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(wallWidthPx, 0);
    ctx.lineTo(wallWidthPx, ATTIC_SLOPE_PX);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = cssVar('--attic-fill');
    ctx.fillRect(startX, 0, ATTIC_SLOPE_PX, ATTIC_SLOPE_PX);

    // Hatch lines follow x + y = c, 8 px apart like the CSS repeating gradient
    ctx.strokeStyle = cssVar('--attic-hatch');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = startX; c <= wallWidthPx + ATTIC_SLOPE_PX; c += 8 * Math.SQRT2) {
        ctx.moveTo(c, 0);
        ctx.lineTo(c - ATTIC_SLOPE_PX, ATTIC_SLOPE_PX);
    }
    ctx.stroke();

    // The clip keeps only the inner half of this 4px stroke, matching the 2px CSS edge band
    ctx.strokeStyle = cssVar('--attic-edge');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(wallWidthPx, ATTIC_SLOPE_PX);
    ctx.stroke();

    ctx.fillStyle = cssVar('--attic-label');
    ctx.font = `600 10px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    [...atticZone.querySelectorAll('.attic-zone-label span')].forEach((span, index) => {
        ctx.fillText(span.textContent.toUpperCase(), wallWidthPx - 10, 10 + index * 15);
    });
    ctx.restore();
}

function paintCornerGlow(ctx, brightness) {
    const style = getComputedStyle(wallCanvas.querySelector('.corner-led-glow'));
    const radiusX = parseFloat(style.width) / 2;
    const radiusY = parseFloat(style.height) / 2;
    const centerX = wallWidthPx - parseFloat(style.right) - radiusX;
    const centerY = wallHeightPx - parseFloat(style.bottom) - radiusY;
    const [r, g, b] = hexToRgb(cornerColorPicker.value);

    ctx.save();
    // The CSS "ellipse closest-side" gradient is a circle stretched to its box proportions
    ctx.translate(centerX, centerY);
    ctx.scale(1, radiusY / radiusX);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    // Fading to the same color at zero alpha avoids the gray fringe a plain "transparent" stop gives
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.globalAlpha = CORNER_GLOW_ALPHA * brightness;
    ctx.fillStyle = gradient;
    ctx.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
    ctx.restore();
}

// Mirrors the cabinet seam on the .storage background
function paintStorageSeam(ctx, item, border) {
    const centerX = item.left + item.width / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(centerX - 1, item.top + border, 2, item.height - border * 2);
}

// Mirrors the handle pair drawn by the .storage ::after
function paintStorageHandles(ctx, item, el, border) {
    const centerX = item.left + item.width / 2;
    const handles = getComputedStyle(el, '::after');
    const barWidth = parseFloat(handles.borderLeftWidth) || 0;
    const contentWidth = parseFloat(handles.width) || 0;
    const outerWidth = handles.boxSizing === 'border-box' ? contentWidth : contentWidth + barWidth * 2;
    const top = item.top + border + (parseFloat(handles.top) || 0);
    const height = parseFloat(handles.height) || 0;

    ctx.fillStyle = handles.borderLeftColor;
    ctx.fillRect(centerX - outerWidth / 2, top, barWidth, height);
    ctx.fillRect(centerX + outerWidth / 2 - barWidth, top, barWidth, height);
}

function paintItemLabel(ctx, item, el) {
    const label = el.querySelector('.item-label');
    if (!label) return;

    const style = getComputedStyle(label);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = ctx.measureText(item.name).width + parseFloat(style.paddingLeft) * 2;
    const height = label.offsetHeight;
    const centerX = item.left + item.width / 2 + labelShift(item.left, item.width, width, wallWidthPx);
    const centerY = item.top + item.height / 2 + labelShift(item.top, item.height, height, wallHeightPx);

    ctx.fillStyle = style.backgroundColor;
    traceShape(ctx, { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height, radius: parseFloat(style.borderTopLeftRadius) || 0, ellipse: false }, 0);
    ctx.fill();

    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.name, centerX, centerY);
}

// Item visuals come from the live computed styles, so the snapshot always matches the CSS on screen
function paintItem(ctx, item, brightness) {
    const el = getItemElement(item.id);
    if (!el) return;

    const style = getComputedStyle(el);
    const shape = itemShape(item, style.borderTopLeftRadius);
    const border = parseFloat(style.borderTopWidth) || 0;
    const shadows = parseShadows(style.boxShadow);

    // Same order the DOM paints in: drop shadow, LED glow and light wash, then the body over them
    shadows.filter(shadow => !shadow.inset).forEach(shadow => paintShadowOnly(ctx, shape, shadow, 1));
    if (isAmbientMode && isLedOn(item) && brightness > 0) {
        parseShadows(getComputedStyle(el, '::before').boxShadow)
            .filter(shadow => !shadow.inset)
            .forEach(shadow => paintShadowOnly(ctx, shape, shadow, brightness));
    }
    if (item.type === 'spotlight') paintSpotlightCone(ctx, item, el, border);

    if (border > 0) {
        ctx.fillStyle = style.borderTopColor;
        traceShape(ctx, shape, 0);
        ctx.fill();
    }
    ctx.fillStyle = style.backgroundColor;
    traceShape(ctx, shape, border);
    ctx.fill();

    // Background layers, then inset shadows, then content, as CSS stacks them inside a box
    paintSheen(ctx, shape, border, style);
    if (item.type === 'storage') paintStorageSeam(ctx, item, border);
    shadows.filter(shadow => shadow.inset).forEach(shadow => paintInsetShadow(ctx, shape, border, shadow, 1));

    if (item.type === 'storage') paintStorageHandles(ctx, item, el, border);
    if (item.type === 'poster' || item.type === 'corner-lamp') paintAfterLayer(ctx, item, el, border);
    paintItemLabel(ctx, item, el);
}

function paintCaption(ctx, fontFamily) {
    const text = `${wallWidthCm} x ${wallHeightCm} cm | Scale 1:1 cm`;
    const margin = 10;
    const height = 20;
    ctx.font = `600 11px ${fontFamily}`;
    const width = ctx.measureText(text).width + 16;
    const top = wallHeightPx - margin - height;

    ctx.fillStyle = isAmbientMode ? 'rgba(15, 17, 21, 0.72)' : 'rgba(255, 255, 255, 0.82)';
    traceShape(ctx, { x: margin, y: top, w: width, h: height, radius: 4, ellipse: false }, 0);
    ctx.fill();

    ctx.fillStyle = isAmbientMode ? 'rgba(243, 244, 246, 0.8)' : 'rgba(17, 24, 39, 0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, margin + 8, top + height / 2);
}

function exportPng() {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(wallWidthPx * PNG_PIXEL_RATIO);
    canvas.height = Math.round(wallHeightPx * PNG_PIXEL_RATIO);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showIoStatus('PNG export failed: canvas is unavailable.', 'error');
        return;
    }

    const fontFamily = getComputedStyle(document.body).fontFamily;
    const brightness = Number(brightnessSlider.value) / 100;
    ctx.scale(PNG_PIXEL_RATIO, PNG_PIXEL_RATIO);

    // Same stacking as the live wall: background, attic zone, corner glow, then items in layer order
    paintWallBackground(ctx);
    if (atticSlopeToggle.checked) paintAtticZone(ctx, fontFamily);
    if (isAmbientMode && brightness > 0) paintCornerGlow(ctx, brightness);
    wallItems.forEach(item => paintItem(ctx, item, brightness));
    paintCaption(ctx, fontFamily);

    canvas.toBlob(blob => {
        if (!blob) {
            showIoStatus('PNG export failed.', 'error');
            return;
        }
        downloadBlob(blob, PNG_FILENAME);
        showIoStatus('Plan exported as PNG.', 'success');
    }, 'image/png');
}

exportPngBtn.addEventListener('click', exportPng);

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
    syncItemLedField();
    if (shouldSave) saveState();
}

function updateCornerColor(hexColor, shouldSave = true) {
    document.documentElement.style.setProperty('--corner-led', hexColor);
    cornerHexCode.textContent = hexColor.toUpperCase();
    cornerColorPicker.value = hexColor;
    syncItemLedField();
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
    closeContextMenu();
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
