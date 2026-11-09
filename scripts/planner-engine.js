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
const ZOOM_LIMITS = [0.5, 2.5];
const ZOOM_BUTTON_STEP = 0.25;
const ZOOM_WHEEL_STEP = 0.1;
const PAN_KEEP_PX = 80; // this much of the wall always stays inside the canvas
const RULER_PIN_PX = 4; // a ruler whose wall edge has left the canvas parks this far inside it
const SHARE_HASH_PREFIX = '#plan=';
const MAX_SHARE_CHARS = 2 * 1024 * 1024;
const SHARE_LABEL = 'Copy Share Link';

// Before v1.6 a single layout lived under the legacy key. Projects now keep a small index plus one
// key per layout, so autosave only ever rewrites the layout that is open.
const LEGACY_STORAGE_KEY = 'spatial_studio_state_v1';
const PROJECT_INDEX_KEY = 'spatial_studio_projects_v1';
const PROJECT_LAYOUT_PREFIX = 'spatial_studio_project_v1_';
const PROJECT_ID_PATTERN = /^project-[a-z0-9-]{1,40}$/i;
const MAX_PROJECTS = 24;
const PROJECT_NAME_LENGTH = 60;
const EXPORT_VERSION = '1.7';
const EXPORT_FILENAME = 'spatial-studio-layout.json';
const CSV_FILENAME = 'spatial-studio-specs.csv';
const PNG_FILENAME = 'spatial-studio-plan.png';
const PNG_PIXEL_RATIO = 2;
const SHADOW_SHIFT_PX = 10000;
const CORNER_GLOW_ALPHA = 0.45; // mirrors the .corner-led-glow opacity factor
const SPOTLIGHT_CONE_FADE = 0.85; // mirrors the last stop of the .spotlight::after gradient
// Tones meant for a dark room, each with a pale counterpart so the Daylight Grid stays readable.
// Charcoal is the original wall, so older layouts and the default look are unchanged.
const WALL_PAINTS = [
    { id: 'charcoal', label: 'Charcoal', ambient: '#1c1f26', daylight: '#e5e7eb' },
    { id: 'greige', label: 'Greige', ambient: '#35312c', daylight: '#e9e4dc' },
    { id: 'sage', label: 'Sage', ambient: '#28312b', daylight: '#dfe7e0' },
    { id: 'navy', label: 'Navy', ambient: '#182133', daylight: '#dce3ee' },
    { id: 'concrete', label: 'Concrete', ambient: '#2e3033', daylight: '#e3e4e6' }
];
const DEFAULT_WALL_PAINT = 'charcoal';
const DAYLIGHT_GRID_PX = 10 * SCALE;

const COPY_LABEL = 'Copy as Markdown';
const CSV_LABEL = 'Export CSV';
const RULER_SIZE_PX = 16;
const RULER_GAP_PX = 4;
const RULER_TICK_CM = 10;
const RULER_LABEL_CM = 50;
const RULER_LABEL_ROOM_PX = 24;
const MAX_GUIDES = 12;
const GUIDE_ID_PATTERN = /^guide-[a-z0-9-]{1,40}$/i;
const GUIDE_TAG_ROOM_PX = 48;
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
const LONG_RUN_CM = 250; // longer runs usually need an extension lead
const POWER_IDLE_TEXT = 'Traces each lit item to its nearest socket';
const TINY_ITEM_PX = 12 * SCALE; // up to 12 x 12 cm the resize grips sit outside the item
const STUDIO_MODES = ['engineer', 'creator'];

const RESIZE_HANDLES_HTML = ['e', 's', 'se']
    .map(dir => `<span class="resize-handle handle-${dir}" data-handle="${dir}" aria-hidden="true"></span>`)
    .join('');

// Room features are free, unfinished and unlit. Doors, windows and sockets are also no-build zones,
// while a text note is a plain annotation that never collides with anything.
const OBSTACLE_TYPES = ['socket', 'door', 'window'];
const FEATURE_TYPES = [...OBSTACLE_TYPES, 'note'];
const ITEM_TYPES = ['shelf', 'cube', 'storage', 'poster', 'spotlight', 'corner-lamp', ...FEATURE_TYPES];
const ROTATIONS = [0, 90, 180, 270];
const DEFAULT_NOTE_TEXT = 'Double-click to edit';
const NOTE_MAX_LENGTH = 160;
const SAFE_ID_PATTERN = /^item-[a-z0-9-]{1,40}$/i;
// Group ids end up inside attribute selectors and layer keys, so only plain word characters pass
const GROUP_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

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
const measureLayer = document.getElementById('measure-layer');
const selectionBounds = document.getElementById('selection-bounds');
const guideHitLayer = document.getElementById('guide-hits');
const guideLineLayer = document.getElementById('guide-lines');

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
const exportCsvBtn = document.getElementById('export-csv-btn');

const projectsBtn = document.getElementById('projects-btn');
const projectsModal = document.getElementById('projects-modal');
const projectsSubtitle = document.getElementById('projects-subtitle');
const projectList = document.getElementById('project-list');
const newProjectForm = document.getElementById('new-project-form');
const newProjectName = document.getElementById('new-project-name');
const saveProjectBtn = document.getElementById('save-project-btn');
const projectLimitNote = document.getElementById('project-limit-note');
const closeProjectsBtn = document.getElementById('close-projects-btn');

const rulerX = document.getElementById('ruler-x');
const rulerY = document.getElementById('ruler-y');
const rulerCorner = document.getElementById('ruler-corner');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
const templateButtons = document.querySelectorAll('.template-btn');

const commandPalette = document.getElementById('command-palette');
const commandPaletteBtn = document.getElementById('command-palette-btn');
const commandSearchInput = document.getElementById('command-search-input');
const commandList = document.getElementById('command-list');
const commandEmpty = document.getElementById('command-empty');
const powerRoutingToggle = document.getElementById('power-routing-toggle');
const powerRoutingSummary = document.getElementById('power-routing-summary');
const powerRoutesLayer = document.getElementById('power-routes');
const floorBackdropLayer = document.getElementById('floor-backdrop');
const backdropButtons = document.querySelectorAll('[data-backdrop]');
const appShell = document.querySelector('.app-shell');
const modeEngineerBtn = document.getElementById('mode-engineer-btn');
const modeCreatorBtn = document.getElementById('mode-creator-btn');

const isModalOpen = () => specModal.open || shortcutsModal.open || projectsModal.open || commandPalette.open;

const accentColorPicker = document.getElementById('accent-color-picker');
const accentHexCode = document.getElementById('accent-hex-code');
const cornerColorPicker = document.getElementById('corner-color-picker');
const cornerHexCode = document.getElementById('corner-hex-code');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
const presetButtons = document.querySelectorAll('.btn-preset');
const paintSwatches = document.querySelectorAll('.paint-swatch');
const wallPaintName = document.getElementById('wall-paint-name');

const layersPanel = document.getElementById('layers-panel');
const layerList = document.getElementById('layer-list');
const layersCount = document.getElementById('layers-count');
const layersToggle = document.getElementById('layers-toggle');

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
    finish: el.dataset.finish || null
}]));

const defaultItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut', ledEnabled: true, locked: false, itemLedColor: null, rotation: 0, groupId: null, hidden: false },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black', ledEnabled: true, locked: false, itemLedColor: null, rotation: 0, groupId: null, hidden: false }
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
// View states like the zoom: never saved, exported or undone, so every visit opens in Engineer Mode
let studioMode = 'engineer';
let floorBackdrop = 'none';
// Kept in selection order; layer order comes from wallItems whenever it matters
let selectedItemIds = [];
let wallItems = [];
// Reference guides: axis 'x' is a vertical line at x = cm, axis 'y' a horizontal one at y = cm
let wallGuides = [];
let wallPaint = DEFAULT_WALL_PAINT;
let ignoreWallClick = false;
let wallClickGuard = 0;
let suppressAltMenu = false;
let idCounter = 0;
let ioStatusTimer = 0;
let copyLabelTimer = 0;
let csvLabelTimer = 0;

// Index entries are { id, name, timestamp }; each layout sits in storage under its own key
let projects = [];
let activeProjectId = null;

let wallWidthCm = DEFAULT_WALL_WIDTH_CM;
let wallHeightCm = DEFAULT_WALL_HEIGHT_CM;
let wallWidthPx = wallWidthCm * SCALE;
let wallHeightPx = wallHeightCm * SCALE;
let viewScale = 1;
let fitScale = 1;
// The view sits on top of the fit: viewScale = fitScale * userZoom, and the pan moves the wall's center
let userZoom = 1;
let panX = 0;
let panY = 0;
let spaceHeld = false;
let shareLabelTimer = 0;
let fittedCanvasSize = '';

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

const createIdleGuideDrag = () => ({
    active: false,
    guide: null,
    isNew: false,
    startCm: 0,
    inside: false,
    elements: [],
    tag: null,
    wallRect: null,
    scale: 1,
    pointerX: 0,
    pointerY: 0,
    frameId: 0
});

let guideDrag = createIdleGuideDrag();

const createIdlePan = () => ({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, pointerX: 0, pointerY: 0, frameId: 0 });
let panState = createIdlePan();

// Kept in memory only: copies made here paste back here with their groups and stacking order
let clipboardState = { items: [], pasteCount: 0 };

const isPointerBusy = () =>
    dragState.isDragging || resizeState.active || catalogDrag.active || marquee.active || guideDrag.active || panState.active;
const isDefaultView = () => userZoom === 1 && panX === 0 && panY === 0;
const isCreatorMode = () => studioMode === 'creator';

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
const createGroupId = () => `group-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const createGuideId = () => `guide-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const wallPaintById = (id) => WALL_PAINTS.find(paint => paint.id === id) || WALL_PAINTS[0];
const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const isObstacle = (item) => OBSTACLE_TYPES.includes(item.type);
const isFeature = (item) => FEATURE_TYPES.includes(item.type);
const isNote = (item) => item.type === 'note';
const isLedOn = (item) => !isFeature(item) && item.ledEnabled !== false;
// Hidden items and notes take no part in collisions, the slope check or the magnet
const isSolid = (item) => !item.hidden && !isNote(item);
const isQuarterTurn = (item) => item.rotation === 90 || item.rotation === 270;

// Width and height always describe the footprint on the wall, so a quarter turn swaps which side
// the minimum width and minimum height apply to
const minSizeCm = (rotation) => (rotation === 90 || rotation === 270
    ? [MIN_HEIGHT_CM, MIN_WIDTH_CM]
    : [MIN_WIDTH_CM, MIN_HEIGHT_CM]);
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
    fittedCanvasSize = `${canvasArea.clientWidth}x${canvasArea.clientHeight}`;
    const availableWidth = canvasArea.clientWidth - CANVAS_PADDING_PX * 2;
    const availableHeight = canvasArea.clientHeight - CANVAS_PADDING_PX * 2;
    const fit = Math.min(
        1,
        availableWidth / (wallWidthPx + WALL_BORDER_PX * 2),
        availableHeight / (wallHeightPx + WALL_BORDER_PX * 2)
    );

    // A collapsed canvas reports no usable size; keep full scale instead of shrinking to nothing
    fitScale = fit > 0 ? fit : 1;
    viewScale = fitScale * userZoom;
    clampPan();
    applyWallTransform();
    // The note describes the fit only; the zoom HUD owns the zoom level
    scaleNote.textContent = fitScale < 1
        ? `(1 cm = 2.5 px, fit ${Math.round(fitScale * 100)}%)`
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
    layoutRulers();
    syncZoomHud();
}

// The default view writes exactly what earlier versions wrote, so the resting geometry never changes.
// Otherwise the wall scales about its center (the canvas center) and the pan shifts that center.
function applyWallTransform() {
    wallCanvas.style.transform = isDefaultView()
        ? (viewScale < 1 ? `scale(${viewScale})` : '')
        : `translate(${panX}px, ${panY}px) scale(${viewScale})`;
}

// However far the view is pushed, part of the wall stays in sight, so it can always be grabbed back
function clampPan() {
    const reachX = Math.max(0, (canvasArea.clientWidth + (wallWidthPx + WALL_BORDER_PX * 2) * viewScale) / 2 - PAN_KEEP_PX);
    const reachY = Math.max(0, (canvasArea.clientHeight + (wallHeightPx + WALL_BORDER_PX * 2) * viewScale) / 2 - PAN_KEEP_PX);
    panX = Math.round(clamp(panX, -reachX, reachX));
    panY = Math.round(clamp(panY, -reachY, reachY));
}

function syncZoomHud() {
    const percent = `${Math.round(userZoom * 100)}%`;
    zoomResetBtn.textContent = percent;
    zoomResetBtn.setAttribute('aria-label', `Reset zoom and pan, now ${percent}`);
    zoomOutBtn.disabled = userZoom <= ZOOM_LIMITS[0] + EPSILON;
    zoomInBtn.disabled = userZoom >= ZOOM_LIMITS[1] - EPSILON;
}

// Keeps the screen point under (clientX, clientY) fixed. A wall point p sits at center + pan + s * p,
// so holding that sum steady while s changes gives pan' = q - (s' / s) * (q - pan), q measured from
// the canvas center, which is also the wall's transform origin.
function zoomTo(nextZoom, clientX, clientY) {
    const zoom = clamp(Math.round(nextZoom * 1000) / 1000, ZOOM_LIMITS[0], ZOOM_LIMITS[1]);
    if (zoom === userZoom || isPointerBusy() || isModalOpen()) return;

    const canvasRect = canvasArea.getBoundingClientRect();
    const centerX = canvasRect.left + canvasRect.width / 2;
    const centerY = canvasRect.top + canvasRect.height / 2;
    const qx = (clientX ?? centerX) - centerX;
    const qy = (clientY ?? centerY) - centerY;
    const ratio = zoom / userZoom;
    panX = qx - ratio * (qx - panX);
    panY = qy - ratio * (qy - panY);
    userZoom = zoom;
    fitWallToViewport();
}

// Buttons and shortcuts move to the next quarter step, so a wheel zoom of 110% steps to 125% or 100%
function stepZoom(direction) {
    const steps = userZoom / ZOOM_BUTTON_STEP;
    const next = direction > 0 ? Math.floor(steps + EPSILON) + 1 : Math.ceil(steps - EPSILON) - 1;
    zoomTo(next * ZOOM_BUTTON_STEP);
}

function resetView() {
    if (isPointerBusy()) return;
    userZoom = 1;
    panX = 0;
    panY = 0;
    fitWallToViewport();
}

// A click on the HUD leaves focus where it was, so Space still pans straight afterwards
[zoomOutBtn, zoomResetBtn, zoomInBtn, commandPaletteBtn].forEach(button => button.addEventListener('mousedown', e => e.preventDefault()));
zoomOutBtn.addEventListener('click', () => stepZoom(-1));
zoomInBtn.addEventListener('click', () => stepZoom(1));
zoomResetBtn.addEventListener('click', resetView);

// Ctrl or Cmd with the wheel (a trackpad pinch arrives the same way) zooms about the pointer.
// The delta is scaled, so a mouse notch is one 10% step and a pinch moves smoothly.
canvasArea.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    if (!delta) return;
    zoomTo(userZoom - clamp(delta / 100, -1, 1) * ZOOM_WHEEL_STEP, e.clientX, e.clientY);
}, { passive: false });

function startPan(e) {
    panState = {
        ...createIdlePan(),
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panX,
        startPanY: panY,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
    document.body.classList.add('is-panning');
    canvasArea.classList.add('is-panning');
}

// Only the transform and the ruler positions change per frame; the ruler ticks are not rebuilt
function applyPanFrame() {
    panState.frameId = 0;
    panX = panState.startPanX + panState.pointerX - panState.startX;
    panY = panState.startPanY + panState.pointerY - panState.startY;
    clampPan();
    applyWallTransform();
    layoutRulers();
}

function endPan() {
    if (panState.frameId) {
        cancelAnimationFrame(panState.frameId);
        applyPanFrame();
    }
    panState = createIdlePan();
    document.body.classList.remove('is-panning');
    canvasArea.classList.remove('is-panning');
}

function cancelPan() {
    panX = panState.startPanX;
    panY = panState.startPanY;
    if (panState.frameId) cancelAnimationFrame(panState.frameId);
    panState.frameId = 0;
    endPan();
    fitWallToViewport();
}

// :focus-visible cannot tell the two apart here, since any key press makes a clicked button match it
let focusFromPointer = false;
document.addEventListener('mousedown', () => { focusFromPointer = true; }, true);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') focusFromPointer = false;
}, true);

const setSpaceHeld = (held) => {
    spaceHeld = held;
    canvasArea.classList.toggle('is-pan-ready', held);
};

// Edge rulers live in the canvas padding, outside #wall, so they never touch the wall's bounding box
// or the drag math. Their origin is the wall's content corner in screen space, cached at each fit.
const rulerOrigin = { left: 0, top: 0 };
const crosshair = { clientX: 0, clientY: 0, frameId: 0, over: false };

function rulerMarkup(lengthCm, axis) {
    const position = axis === 'x' ? 'left' : 'top';
    const marks = [];
    for (let cm = 0; cm <= lengthCm; cm += RULER_TICK_CM) {
        const offset = cm * SCALE * viewScale;
        const major = cm % RULER_LABEL_CM === 0;
        marks.push(`<span class="ruler-tick${major ? ' is-major' : ''}" style="${position}: ${offset}px"></span>`);
        // A label with no room left before the far end would be clipped, so it sits before its tick instead
        if (major) {
            const end = cm > 0 && (lengthCm - cm) * SCALE * viewScale < RULER_LABEL_ROOM_PX ? ' is-end' : '';
            marks.push(`<span class="ruler-label${end}" style="${position}: ${offset}px">${cm}</span>`);
        }
    }
    return marks.join('');
}

// Screen rectangles of the two ruler bands and the canvas, refreshed with every layout
const rulerBands = { top: null, left: null, canvas: null };
let rulerScaleKey = '';

const inBand = (band, x, y) => Boolean(band) && x >= band.left && x <= band.right && y >= band.top && y <= band.bottom;

function layoutRulers() {
    const canvasRect = canvasArea.getBoundingClientRect();
    const wallRect = wallCanvas.getBoundingClientRect();
    const border = WALL_BORDER_PX * viewScale;
    const left = wallRect.left + border - canvasRect.left;
    const top = wallRect.top + border - canvasRect.top;
    const offset = border + RULER_GAP_PX + RULER_SIZE_PX;
    const width = wallWidthPx * viewScale;
    const height = wallHeightPx * viewScale;
    // Zoomed or panned, a wall edge can leave the canvas. Its ruler then parks just inside the canvas
    // edge and floats over the wall, as in CAD tools, while its ticks stay registered with the wall.
    const pinned = !isDefaultView();
    const xTop = pinned ? Math.max(top - offset, RULER_PIN_PX) : top - offset;
    const yLeft = pinned ? Math.max(left - offset, RULER_PIN_PX) : left - offset;

    rulerOrigin.left = wallRect.left + border;
    rulerOrigin.top = wallRect.top + border;
    rulerBands.canvas = canvasRect;
    rulerBands.top = { left: rulerOrigin.left, right: rulerOrigin.left + width, top: canvasRect.top + xTop, bottom: canvasRect.top + xTop + RULER_SIZE_PX };
    rulerBands.left = { left: canvasRect.left + yLeft, right: canvasRect.left + yLeft + RULER_SIZE_PX, top: rulerOrigin.top, bottom: rulerOrigin.top + height };

    Object.assign(rulerX.style, {
        left: `${left}px`, top: `${xTop}px`, width: `${width}px`, height: `${RULER_SIZE_PX}px`
    });
    Object.assign(rulerY.style, {
        left: `${yLeft}px`, top: `${top}px`, width: `${RULER_SIZE_PX}px`, height: `${height}px`
    });
    Object.assign(rulerCorner.style, {
        left: `${yLeft}px`, top: `${xTop}px`, width: `${RULER_SIZE_PX}px`, height: `${RULER_SIZE_PX}px`
    });
    // Tick positions depend only on the scale and the wall size, so a pan never rebuilds them
    const scaleKey = `${viewScale}|${wallWidthCm}|${wallHeightCm}`;
    if (scaleKey !== rulerScaleKey) {
        rulerScaleKey = scaleKey;
        rulerX.querySelector('.ruler-scale').innerHTML = rulerMarkup(wallWidthCm, 'x');
        rulerY.querySelector('.ruler-scale').innerHTML = rulerMarkup(wallHeightCm, 'y');
    }
    syncRulerSpans();
    applyCrosshair();
}

// The selected box is shaded on both rulers, the way CAD tools mark a selection's extent
function syncRulerSpans() {
    const selected = getSelectedItems();
    const spanX = rulerX.querySelector('.ruler-span');
    const spanY = rulerY.querySelector('.ruler-span');
    spanX.hidden = spanY.hidden = !selected.length;
    if (!selected.length) return;

    const box = selected.length === 1 ? selected[0] : getBounds(selected);
    spanX.style.left = `${box.left * viewScale}px`;
    spanX.style.width = `${box.width * viewScale}px`;
    spanY.style.top = `${box.top * viewScale}px`;
    spanY.style.height = `${box.height * viewScale}px`;
}

// The top ruler pulls out horizontal guides (axis 'y') and the left ruler vertical ones (axis 'x').
// Only the part of a band inside the canvas counts, since the canvas clips the rest.
function rulerAxisAt(clientX, clientY) {
    if (!inBand(rulerBands.canvas, clientX, clientY)) return null;
    if (inBand(rulerBands.top, clientX, clientY)) return 'y';
    return inBand(rulerBands.left, clientX, clientY) ? 'x' : null;
}

function applyCrosshair() {
    crosshair.frameId = 0;
    // The rulers never take the pointer themselves, so the canvas shows their cursor instead,
    // unless Creator Mode has hidden them
    const rulerAxis = crosshair.over && !isCreatorMode() && !isModalOpen() && !isPointerBusy()
        ? rulerAxisAt(crosshair.clientX, crosshair.clientY)
        : null;
    const hover = rulerAxis ? `guide-${rulerAxis}` : '';
    if (canvasArea.dataset.rulerHover !== hover) canvasArea.dataset.rulerHover = hover;

    const hairX = rulerX.querySelector('.ruler-hairline');
    const hairY = rulerY.querySelector('.ruler-hairline');
    const x = (crosshair.clientX - rulerOrigin.left) / viewScale;
    const y = (crosshair.clientY - rulerOrigin.top) / viewScale;
    // A zoomed wall can reach under the sidebars, where the pointer is not over the drawing at all
    const inside = crosshair.over && !isModalOpen() && inBand(rulerBands.canvas, crosshair.clientX, crosshair.clientY) &&
        x >= 0 && y >= 0 && x <= wallWidthPx && y <= wallHeightPx;

    hairX.hidden = hairY.hidden = !inside;
    if (!inside) return;

    hairX.style.transform = `translateX(${x * viewScale}px)`;
    hairY.style.transform = `translateY(${y * viewScale}px)`;
    hairX.firstElementChild.textContent = Math.round(x / SCALE);
    hairY.firstElementChild.textContent = Math.round(y / SCALE);
    // Readouts flip to the inner side near the far end so they are never clipped by the ruler
    hairX.classList.toggle('is-flipped', x > wallWidthPx - 40 / viewScale);
    hairY.classList.toggle('is-flipped', y > wallHeightPx - 40 / viewScale);
}

window.addEventListener('mousemove', (e) => {
    crosshair.clientX = e.clientX;
    crosshair.clientY = e.clientY;
    crosshair.over = true;
    if (!crosshair.frameId) crosshair.frameId = requestAnimationFrame(applyCrosshair);
});

document.documentElement.addEventListener('mouseleave', () => {
    crosshair.over = false;
    applyCrosshair();
});

// The window, late fonts or panel changes can all resize the canvas, so its size is watched directly.
// The observer also reports once at startup, after boot has already fitted that same size.
new ResizeObserver(() => {
    if (`${canvasArea.clientWidth}x${canvasArea.clientHeight}` !== fittedCanvasSize) fitWallToViewport();
}).observe(canvasArea);

// Each guide is drawn twice: a grab strip under the items, so pressing furniture still moves the
// furniture, and the visible line with its cm tag above them. The tag stays grabbable everywhere.
const guideStart = (guide) => (guide.axis === 'x' ? 'left' : 'top');
const guideLimitPx = (guide) => (guide.axis === 'x' ? wallWidthPx : wallHeightPx);
// Near the far edge the tag moves to the other side of its line, where the wall cannot clip it
const isGuideTagFlipped = (guide) => guide.cm * SCALE > guideLimitPx(guide) - GUIDE_TAG_ROOM_PX;

function renderGuides() {
    guideHitLayer.innerHTML = wallGuides.map(guide => `
        <div class="guide-hit axis-${guide.axis}" data-guide-id="${guide.id}" style="${guideStart(guide)}: ${guide.cm * SCALE}px"></div>`).join('');
    guideLineLayer.innerHTML = wallGuides.map(guide => `
        <div class="wall-guide axis-${guide.axis}${isGuideTagFlipped(guide) ? ' is-flipped' : ''}" data-guide-id="${guide.id}" style="${guideStart(guide)}: ${guide.cm * SCALE}px">
            <span class="wall-guide-tag" data-guide-id="${guide.id}" title="Drag to move this guide, drag it off the wall or double-click to remove it">${guide.cm} cm</span>
        </div>`).join('');
}

// Files and saves are trusted for nothing: guides must lie on the wall, one per line, at most twelve
function sanitizeGuides(raw, widthCm, heightCm) {
    if (!Array.isArray(raw)) return [];
    const lines = new Set();
    const ids = new Set();
    const guides = [];
    raw.forEach(entry => {
        if (guides.length >= MAX_GUIDES || !entry || (entry.axis !== 'x' && entry.axis !== 'y')) return;
        const value = toFiniteNumber(entry.cm);
        if (value === null || value < 0 || value > (entry.axis === 'x' ? widthCm : heightCm)) return;
        const cm = Math.round(value);
        if (lines.has(`${entry.axis}:${cm}`)) return;
        lines.add(`${entry.axis}:${cm}`);
        const id = typeof entry.id === 'string' && GUIDE_ID_PATTERN.test(entry.id) && !ids.has(entry.id)
            ? entry.id
            : createGuideId();
        ids.add(id);
        guides.push({ id, axis: entry.axis, cm });
    });
    return guides;
}

// A smaller wall drops the guides that no longer lie on it; undo brings them back with the size
function pruneGuides() {
    const kept = wallGuides.filter(guide => guide.cm * SCALE <= guideLimitPx(guide));
    const changed = kept.length !== wallGuides.length;
    wallGuides = kept;
    return changed;
}

function startGuideDrag(guide, isNew, e) {
    const elements = [...wallCanvas.querySelectorAll(`.guide-hit[data-guide-id="${guide.id}"], .wall-guide[data-guide-id="${guide.id}"]`)];
    guideDrag = {
        ...createIdleGuideDrag(),
        active: true,
        guide,
        isNew,
        startCm: guide.cm,
        inside: !isNew,
        elements,
        tag: elements[1]?.querySelector('.wall-guide-tag') || null,
        wallRect: wallCanvas.getBoundingClientRect(),
        scale: viewScale,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
    elements.forEach(el => el.classList.add('is-active'));
    document.body.classList.add(`is-dragging-guide-${guide.axis}`);
    applyGuideFrame();
}

// Only the guide's own axis decides whether it is still on the wall, so a hand drifting along the
// line never deletes it by accident
function applyGuideFrame() {
    guideDrag.frameId = 0;
    const { guide, wallRect, scale, pointerX, pointerY, elements, tag } = guideDrag;
    const vertical = guide.axis === 'x';
    const local = (vertical ? (pointerX - wallRect.left) : (pointerY - wallRect.top)) / scale - WALL_BORDER_PX;
    const limitPx = guideLimitPx(guide);
    const stepCm = snapGridToggle.checked ? SNAP_STEP_PX / SCALE : 1;

    guideDrag.inside = local >= 0 && local <= limitPx;
    if (guideDrag.inside) guide.cm = clamp(Math.round(local / SCALE / stepCm) * stepCm, 0, limitPx / SCALE);

    elements.forEach(el => {
        el.hidden = !guideDrag.inside;
        el.style[guideStart(guide)] = `${guide.cm * SCALE}px`;
    });
    elements[1]?.classList.toggle('is-flipped', isGuideTagFlipped(guide));
    if (tag) tag.textContent = `${guide.cm} cm`;
}

function scheduleGuideFrame() {
    if (guideDrag.active && !guideDrag.frameId) guideDrag.frameId = requestAnimationFrame(applyGuideFrame);
}

function endGuideDrag() {
    if (guideDrag.frameId) cancelAnimationFrame(guideDrag.frameId);
    guideDrag.elements.forEach(el => el.classList.remove('is-active'));
    document.body.classList.remove(`is-dragging-guide-${guideDrag.guide.axis}`);
    guideDrag = createIdleGuideDrag();
}

function finishGuideDrag() {
    if (guideDrag.frameId) {
        cancelAnimationFrame(guideDrag.frameId);
        applyGuideFrame();
    }

    const { guide, isNew, startCm, inside } = guideDrag;
    endGuideDrag();
    // Two guides on one line could never be told apart, so a guide dropped onto another merges into it
    const twin = inside && wallGuides.find(other => other !== guide && other.axis === guide.axis && other.cm === guide.cm);
    if (!inside || twin) {
        wallGuides = wallGuides.filter(other => other !== guide);
        renderGuides();
    }

    const changed = isNew ? inside && !twin : !inside || twin || guide.cm !== startCm;
    if (changed) commitLayoutChange();
}

// Escape puts a moved guide back and drops one that was still being pulled out of a ruler
function cancelGuideDrag() {
    const { guide, isNew, startCm } = guideDrag;
    endGuideDrag();
    if (isNew) wallGuides = wallGuides.filter(other => other !== guide);
    else guide.cm = startCm;
    renderGuides();
}

function removeGuide(id) {
    if (isPointerBusy() || !wallGuides.some(guide => guide.id === id)) return;
    wallGuides = wallGuides.filter(guide => guide.id !== id);
    renderGuides();
    commitLayoutChange();
}

// Runs in the capture phase, ahead of items and the wall. A middle press, or a left press with Space
// held, pans the view. The rulers keep pointer-events off so they never get in the way, so a press is
// checked against their bands here instead; a ruler parked over a zoomed wall still pulls guides.
canvasArea.addEventListener('mousedown', (e) => {
    if (e.target.closest('.zoom-hud') || isPointerBusy() || isModalOpen()) return;

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        e.preventDefault();
        e.stopPropagation();
        guardNextWallClick();
        startPan(e);
        return;
    }

    if (e.button !== 0) return;
    // Creator Mode hides the rulers, and the bands that pull out guides go with them
    const axis = isCreatorMode() ? null : rulerAxisAt(e.clientX, e.clientY);
    if (!axis) return;

    e.preventDefault();
    e.stopPropagation();
    if (wallGuides.length >= MAX_GUIDES) {
        showIoStatus(`A wall holds up to ${MAX_GUIDES} guides. Remove one to add another.`, 'error');
        return;
    }
    const guide = { id: createGuideId(), axis, cm: 0 };
    wallGuides.push(guide);
    renderGuides();
    startGuideDrag(guide, true, e);
}, true);

[guideHitLayer, guideLineLayer].forEach(layer => {
    layer.addEventListener('mousedown', (e) => {
        const el = e.target.closest('[data-guide-id]');
        if (!el || e.button !== 0) return;
        // Like an item press: no marquee, no text selection, and no deselecting click afterwards
        e.stopPropagation();
        e.preventDefault();
        if (isPointerBusy() || isModalOpen()) return;
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        guardNextWallClick();
        const guide = wallGuides.find(entry => entry.id === el.dataset.guideId);
        if (guide) startGuideDrag(guide, false, e);
    });
    layer.addEventListener('click', (e) => {
        if (e.target.closest('[data-guide-id]')) e.stopPropagation();
    });
    layer.addEventListener('dblclick', (e) => {
        const el = e.target.closest('[data-guide-id]');
        if (!el) return;
        e.stopPropagation();
        removeGuide(el.dataset.guideId);
    });
});

function applyWallPaint(id) {
    const paint = wallPaintById(id);
    wallPaint = paint.id;
    wallCanvas.style.setProperty('--wall-paint', paint.ambient);
    wallCanvas.style.setProperty('--wall-paint-day', paint.daylight);
    paintSwatches.forEach(button => {
        const active = button.dataset.paint === paint.id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    wallPaintName.textContent = paint.label;
}

// The wall paint belongs to the layout, so a change is an undo step like any other edit
function setWallPaint(id) {
    if (id === wallPaint || isPointerBusy()) return;
    applyWallPaint(id);
    commitLayoutChange();
}

paintSwatches.forEach(button => {
    button.style.setProperty('--swatch', wallPaintById(button.dataset.paint).ambient);
    button.addEventListener('click', () => setWallPaint(button.dataset.paint));
});

// Items larger than a shrunken wall are cut down to fit, then everything is pushed back inside
function clampItemsToWall() {
    wallItems.forEach(item => {
        item.width = Math.min(item.width, wallWidthPx);
        item.height = Math.min(item.height, wallHeightPx);
        item.left = clamp(item.left, 0, wallWidthPx - item.width);
        item.top = clamp(item.top, 0, wallHeightPx - item.height);
    });
}

// Storage can be full, blocked or switched off; the planner keeps working in memory either way
function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing left to clean up when storage is unavailable
    }
}

const currentLayoutData = () => ({
    items: wallItems,
    wallWidthCm,
    wallHeightCm,
    accentColor: accentColorPicker.value,
    cornerColor: cornerColorPicker.value,
    brightness: brightnessSlider.value,
    atticSlope: atticSlopeToggle.checked,
    wallPaint,
    wallGuides
});

const activeProject = () => projects.find(project => project.id === activeProjectId);
const createProjectId = () => `project-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const cleanProjectName = (raw, fallback) => (typeof raw === 'string' && raw.trim()
    ? raw.trim().replace(/\s+/g, ' ').slice(0, PROJECT_NAME_LENGTH)
    : fallback);

const writeProjectIndex = () =>
    storageSet(PROJECT_INDEX_KEY, JSON.stringify({ activeId: activeProjectId, projects }));
const writeProjectLayout = (id, layout = currentLayoutData()) =>
    storageSet(PROJECT_LAYOUT_PREFIX + id, JSON.stringify(layout));

function readProjectLayout(id) {
    try {
        return JSON.parse(storageGet(PROJECT_LAYOUT_PREFIX + id));
    } catch {
        return null;
    }
}

function saveState() {
    const project = activeProject();
    if (!project) return;

    project.timestamp = Date.now();
    if (!writeProjectLayout(project.id) || !writeProjectIndex()) {
        showIoStatus('Could not save: browser storage is full or blocked.', 'error');
    }
}

function readProjectIndex() {
    let data;
    try {
        data = JSON.parse(storageGet(PROJECT_INDEX_KEY));
    } catch {
        return null;
    }
    if (!data || !Array.isArray(data.projects)) return null;

    const seen = new Set();
    const list = [];
    data.projects.forEach(entry => {
        if (!entry || !PROJECT_ID_PATTERN.test(entry.id) || seen.has(entry.id) || list.length >= MAX_PROJECTS) return;
        seen.add(entry.id);
        list.push({
            id: entry.id,
            name: cleanProjectName(entry.name, 'Untitled Project'),
            timestamp: toFiniteNumber(entry.timestamp) ?? Date.now()
        });
    });
    return { activeId: typeof data.activeId === 'string' ? data.activeId : null, projects: list };
}

// The first boot after the upgrade keeps the old single save as the Default Project. A later leftover
// under the legacy key, or one that no longer parses, is simply dropped.
function migrateLegacyState() {
    const raw = storageGet(LEGACY_STORAGE_KEY);
    if (raw === null) return;

    if (!projects.length) {
        try {
            normalizeLayout(JSON.parse(raw));
            const project = { id: createProjectId(), name: 'Default Project', timestamp: Date.now() };
            if (storageSet(PROJECT_LAYOUT_PREFIX + project.id, raw)) {
                projects.push(project);
                activeProjectId = project.id;
            }
        } catch {
            // A corrupt single save is discarded and the planner starts from the starter layout
        }
    }
    storageRemove(LEGACY_STORAGE_KEY);
}

// Base64URL over UTF-8 bytes, so names and notes in any script survive the trip through a URL
function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    // Chunked, since spreading a long byte array into fromCharCode can overrun the argument limit
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded) {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Not Base64URL.');
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

// Returns the raw layout from a #plan= link, or null. The hash is cleared either way, so a reload or a
// bookmark of the cleaned address never applies the same link twice.
function takeSharedPlan() {
    if (!window.location.hash.startsWith(SHARE_HASH_PREFIX)) return null;
    const encoded = window.location.hash.slice(SHARE_HASH_PREFIX.length);
    try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
        // A sandboxed frame may refuse; the link is still read once
    }

    try {
        if (encoded.length > MAX_SHARE_CHARS) throw new Error('Too long.');
        const data = JSON.parse(fromBase64Url(encoded));
        normalizeLayout(data);
        return data;
    } catch {
        showIoStatus('Share link could not be read.', 'error');
        return null;
    }
}

function uniqueProjectName(base) {
    const names = new Set(projects.map(project => project.name));
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
    return name;
}

// Someone who already has projects gets the link as a new project, so following a link never
// overwrites their open work. A first visit just fills the fresh Default Project.
function addSharedProject() {
    if (projects.length >= MAX_PROJECTS) {
        showIoStatus(`The shared plan was not opened: the gallery already holds ${MAX_PROJECTS} projects.`, 'error');
        return null;
    }
    const project = { id: createProjectId(), name: uniqueProjectName('Shared Plan'), timestamp: Date.now() };
    projects.push(project);
    return project;
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
    const feature = FEATURE_TYPES.includes(raw.type);
    const rotation = ROTATIONS.includes(toFiniteNumber(raw.rotation)) ? toFiniteNumber(raw.rotation) : 0;
    const [minWidthCm, minHeightCm] = minSizeCm(rotation);
    const width = toCmGrid(toFiniteNumber(raw.width) ?? defaults.width, minWidthCm, bounds.width / SCALE);
    const height = toCmGrid(toFiniteNumber(raw.height) ?? defaults.height, minHeightCm, bounds.height / SCALE);
    const price = toFiniteNumber(raw.price);
    const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH)
        : defaults.name;

    return {
        id,
        type: raw.type,
        name,
        price: !feature && price !== null && price >= 0 ? Math.round(price * 100) / 100 : defaults.price,
        left: toCmGrid(toFiniteNumber(raw.left) ?? 0, 0, (bounds.width - width) / SCALE),
        top: toCmGrid(toFiniteNumber(raw.top) ?? 0, 0, (bounds.height - height) / SCALE),
        width,
        height,
        finish: feature ? null : (FINISH_IDS.includes(raw.finish) ? raw.finish : defaults.finish),
        ledEnabled: !feature && (typeof raw.ledEnabled === 'boolean' ? raw.ledEnabled : true),
        locked: raw.locked === true,
        // Files from before v1.3 have no per-item color, so those items follow the global lighting
        itemLedColor: !feature && isHexColor(raw.itemLedColor) ? raw.itemLedColor.toLowerCase() : null,
        rotation,
        // Group ids only survive if at least two items share them; normalizeGroups checks that afterwards
        groupId: typeof raw.groupId === 'string' && GROUP_ID_PATTERN.test(raw.groupId) ? raw.groupId : null,
        hidden: raw.hidden === true,
        ...(raw.type === 'note' && { text: sanitizeNoteText(raw.text) })
    };
}

// Notes keep line breaks but drop every other control character; an empty note gets the prompt back
function sanitizeNoteText(raw) {
    if (typeof raw !== 'string') return DEFAULT_NOTE_TEXT;
    const text = raw
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
        .trim()
        .slice(0, NOTE_MAX_LENGTH);
    return text || DEFAULT_NOTE_TEXT;
}

// A group is a run of items sharing a groupId. Members always sit next to each other in wallItems,
// so the layer list can show each group as one block. Lone survivors lose the id, and scattered
// members are gathered at the position of the topmost one.
function normalizeGroups(items) {
    const counts = new Map();
    items.forEach(item => {
        if (item.groupId) counts.set(item.groupId, (counts.get(item.groupId) || 0) + 1);
    });
    items.forEach(item => {
        if (item.groupId && counts.get(item.groupId) < 2) item.groupId = null;
    });

    const placed = new Set();
    const blocks = [];
    for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index];
        if (!item.groupId) {
            blocks.push([item]);
        } else if (!placed.has(item.groupId)) {
            placed.add(item.groupId);
            blocks.push(items.filter(member => member.groupId === item.groupId));
        }
    }
    return blocks.reverse().flat();
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
    const items = normalizeGroups(rawItems
        .slice(0, MAX_IMPORT_ITEMS)
        .map(raw => sanitizeItem(raw, usedIds, bounds))
        .filter(Boolean));

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
        brightness: brightness === null ? null : clamp(Math.round(brightness), 0, 100),
        // Files from before v1.7 have neither, so they load on the original wall with no guides
        wallPaint: WALL_PAINTS.some(paint => paint.id === data.wallPaint) ? data.wallPaint : DEFAULT_WALL_PAINT,
        wallGuides: sanitizeGuides(data.wallGuides, widthCm, heightCm)
    };
}

function applyLayoutSettings(layout) {
    setWallDimensions(layout.wallWidthCm, layout.wallHeightCm);
    wallItems = layout.items;
    if (layout.atticSlope !== null) atticSlopeToggle.checked = layout.atticSlope;
    if (layout.accentColor) updateAccentColor(layout.accentColor, false);
    if (layout.cornerColor) updateCornerColor(layout.cornerColor, false);
    if (layout.brightness !== null) setBrightness(layout.brightness);
    applyWallPaint(layout.wallPaint);
    wallGuides = layout.wallGuides;
    renderGuides();
}

function applyDefaultLayout() {
    setWallDimensions(DEFAULT_WALL_WIDTH_CM, DEFAULT_WALL_HEIGHT_CM);
    wallItems = cloneDefaults();
    atticSlopeToggle.checked = false;
    updateAccentColor('#ff9d42', false);
    updateCornerColor('#8b5cf6', false);
    setBrightness(100);
    applyWallPaint(DEFAULT_WALL_PAINT);
    wallGuides = [];
    renderGuides();
}

// A layout that is missing or fails validation leaves the starter layout in place
function applyProjectLayout(data) {
    applyDefaultLayout();
    if (!data) return;

    try {
        applyLayoutSettings(normalizeLayout(data));
    } catch {
        wallItems = cloneDefaults();
    }
}

function loadState() {
    const index = readProjectIndex();
    projects = index ? index.projects : [];
    activeProjectId = index ? index.activeId : null;
    migrateLegacyState();

    const returning = projects.length > 0;
    if (!projects.length) projects.push({ id: createProjectId(), name: 'Default Project', timestamp: Date.now() });
    if (!activeProject()) activeProjectId = [...projects].sort((a, b) => b.timestamp - a.timestamp)[0].id;

    let layout = readProjectLayout(activeProjectId);
    const shared = takeSharedPlan();
    if (shared) {
        const project = returning ? addSharedProject() : activeProject();
        if (project) {
            activeProjectId = project.id;
            layout = shared;
            showIoStatus(returning ? `Opened the shared plan as ${project.name}.` : 'Opened the shared plan.', 'success');
        }
    }

    applyProjectLayout(layout);
    // Opening a project is not an edit, so its timestamp stays as it was
    writeProjectLayout(activeProjectId);
    writeProjectIndex();
    syncProjectsButton();
}

const serializeHistoryState = () => JSON.stringify({
    items: wallItems,
    atticSlope: atticSlopeToggle.checked,
    wallWidthCm,
    wallHeightCm,
    wallGuides,
    wallPaint
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
    wallGuides = snapshot.wallGuides;
    applyWallPaint(snapshot.wallPaint);
    renderGuides();
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
        return `
            <div class="${classes}"
                 data-id="${escapeHtml(item.id)}"
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
    renderLayers();
    refreshMeasure();
    refreshPowerRoutes();
}

function isOverlapping(a, b) {
    return (
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top
    );
}

const overlapsAny = (item, accept) =>
    wallItems.some(other => other.id !== item.id && accept(other) && isOverlapping(item, other));

// Two room features may share space (a socket beside a door frame); every other solid overlap is a conflict
function hasOverlap(item) {
    return isSolid(item) && overlapsAny(item, other => isSolid(other) && !(isObstacle(item) && isObstacle(other)));
}

const overlapsFurniture = (item) =>
    isSolid(item) && !isFeature(item) && overlapsAny(item, other => isSolid(other) && !isFeature(other));
const blocksRoomFeature = (item) =>
    isSolid(item) && overlapsAny(item, other => isSolid(other) && isObstacle(item) !== isObstacle(other));

// The slope edge follows y = x - (wallWidthPx - S). For an axis-aligned box the top-right
// corner is the point that reaches furthest past that line, so testing it alone is exact.
// Doors and windows are cut into the wall itself, so the slope never flags them.
function intrudesAtticSlope(item) {
    if (!atticSlopeToggle.checked || isFeature(item) || item.hidden) return false;

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
        if (excludedIds.has(other.id) || other.hidden) return;
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
    // Alt measuring takes over the overlay; the regular rulers come back when it ends
    if (!selected.length || measure.active) {
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
    // A reference guide is a full-height (or full-width) line, so it snaps like the wall center does.
    // Creator Mode hides the guides, and a line nobody can see should not tug at anything.
    if (!isCreatorMode()) {
        wallGuides.forEach(guide => {
            if (guide.axis === axis) targets.push({ value: guide.cm * SCALE, other: null });
        });
    }
    wallItems.forEach(other => {
        if (excludedIds.has(other.id) || other.hidden) return;
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

// Alt-hover measuring. hoverId is the item under the pointer, 'wall' for bare wall, or null off the wall.
const measure = { alt: false, hoverId: null, active: false, key: '', frameId: 0 };

const boxEdges = (box) => ({ left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height });

// Figma's rules: boxes apart on an axis get one line across the gap, drawn through their shared span
// or, when they are also apart on the other axis, through the selection center with a dashed extension
// carrying the hovered edge out to it. Boxes that intersect (or nest, like the wall) get a line between
// each pair of matching edges instead.
function measureSegments(selection, target) {
    const a = boxEdges(selection);
    const b = boxEdges(target);
    const lines = [];
    const guides = [];
    const add = (list, axis, from, to, cross) => {
        if (Math.abs(to - from) > EPSILON) {
            list.push({ axis, start: Math.min(from, to), end: Math.max(from, to), cross: Math.round(cross) });
        }
    };

    const apartX = b.left >= a.right || b.right <= a.left;
    const apartY = b.top >= a.bottom || b.bottom <= a.top;
    const midX = apartX ? (a.left + a.right) / 2 : (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
    const midY = apartY ? (a.top + a.bottom) / 2 : (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;

    if (!apartX && !apartY) {
        add(lines, 'h', a.left, b.left, midY);
        add(lines, 'h', a.right, b.right, midY);
        add(lines, 'v', a.top, b.top, midX);
        add(lines, 'v', a.bottom, b.bottom, midX);
        return { lines, guides };
    }

    const right = b.left >= a.right;
    const below = b.top >= a.bottom;
    if (apartX) {
        add(lines, 'h', right ? a.right : a.left, right ? b.left : b.right, midY);
        if (apartY) add(guides, 'v', midY, below ? b.top : b.bottom, right ? b.left : b.right);
    }
    if (apartY) {
        add(lines, 'v', below ? a.bottom : a.top, below ? b.top : b.bottom, midX);
        if (apartX) add(guides, 'h', midX, right ? b.left : b.right, below ? b.top : b.bottom);
    }
    return { lines, guides };
}

const segmentStyle = ({ axis, start, end, cross }) => (axis === 'h'
    ? `left: ${start}px; top: ${cross}px; width: ${end - start}px;`
    : `left: ${cross}px; top: ${start}px; height: ${end - start}px;`);

function resolveMeasureTarget() {
    if (measure.hoverId === 'wall') return { left: 0, top: 0, width: wallWidthPx, height: wallHeightPx };
    if (!measure.hoverId || isSelected(measure.hoverId)) return null;
    return wallItems.find(item => item.id === measure.hoverId) || null;
}

function clearMeasure() {
    if (!measure.active) return;
    measure.active = false;
    measure.key = '';
    measureLayer.hidden = true;
    measureLayer.innerHTML = '';
    wallItemsLayer.querySelector('.measure-target')?.classList.remove('measure-target');
    updateDistanceGuides();
}

// Runs on hover changes, Alt presses and any change to the selection or its position. The overlay is
// only rebuilt when one of the two boxes actually changed, which keeps pointer moves inside one item free.
function refreshMeasure() {
    const selected = getSelectedItems();
    const ready = measure.alt && selected.length && !isPointerBusy() && !isModalOpen() && !isContextMenuOpen();
    const target = ready ? resolveMeasureTarget() : null;
    if (!target) {
        clearMeasure();
        return;
    }

    const box = selected.length === 1 ? selected[0] : getBounds(selected);
    const key = [box.left, box.top, box.width, box.height, target.left, target.top, target.width, target.height].join();
    const wasActive = measure.active;
    measure.active = true;

    if (key !== measure.key) {
        measure.key = key;
        const { lines, guides } = measureSegments(box, target);
        measureLayer.innerHTML = [
            ...guides.map(guide => `<div class="measure-guide is-${guide.axis}" style="${segmentStyle(guide)}"></div>`),
            ...lines.map(line => `
                <div class="measure-line is-${line.axis}" style="${segmentStyle(line)}">
                    <span class="measure-label">${toCm(line.end - line.start)} cm</span>
                </div>`)
        ].join('');
        measureLayer.hidden = false;
    }

    // Elements are rebuilt by renders, so the hover outline is re-applied on every pass
    wallItemsLayer.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('measure-target', el.dataset.id === measure.hoverId);
    });
    if (!wasActive) updateDistanceGuides();
}

function scheduleMeasure() {
    if (!measure.frameId) {
        measure.frameId = requestAnimationFrame(() => {
            measure.frameId = 0;
            refreshMeasure();
        });
    }
}

function hoverIdFrom(target) {
    if (!(target instanceof Element)) return null;
    const el = target.closest('.wall-item');
    if (el && wallItemsLayer.contains(el)) return el.dataset.id;
    return wallCanvas.contains(target) ? 'wall' : null;
}

window.addEventListener('mousemove', (e) => {
    measure.hoverId = hoverIdFrom(e.target);
    measure.alt = e.altKey;
    if (measure.alt || measure.active) scheduleMeasure();
});

// Power routing is a drafting aid like the rulers: kept out of the layout, the history and the PNG
let powerRoutingOn = false;
let powerRoutesKey = '';

const boxCenter = (item) => ({ x: item.left + item.width / 2, y: item.top + item.height / 2 });

// Every visible lit item takes the socket with the shortest center-to-center Manhattan run. On a tie
// the socket lower in the layer stack wins, so the choice never flickers during a drag.
function planPowerRoutes() {
    const visible = wallItems.filter(item => !item.hidden);
    const sockets = visible.filter(item => item.type === 'socket');
    const powered = visible.filter(isLedOn);
    const routes = sockets.length ? powered.map(item => {
        const from = boxCenter(item);
        let best = null;
        sockets.forEach(socket => {
            const to = boxCenter(socket);
            const run = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
            if (!best || run < best.run - EPSILON) best = { socket, to, run };
        });
        return { item, socket: best.socket, from, to: best.to, lengthCm: Math.round(best.run / SCALE) };
    }) : [];
    return { powered, sockets, routes };
}

function powerSummary({ powered, sockets, routes }) {
    if (!powered.length) return { text: 'No powered items on the wall', warning: false };
    if (!sockets.length) {
        return { text: `No wall sockets placed (${powered.length} powered item${powered.length === 1 ? '' : 's'})`, warning: true };
    }
    const total = routes.reduce((sum, route) => sum + route.lengthCm, 0);
    const longest = Math.max(...routes.map(route => route.lengthCm));
    return {
        text: `${powered.length} powered | Total ${(total / 100).toFixed(1)} m | Max ${longest} cm`,
        warning: longest > LONG_RUN_CM
    };
}

// The run leaves the item's center, goes straight up or down to the socket's height, then along the
// wall into the socket. The layer sits under the items, so the stretch inside the item stays hidden and
// the cable appears where it leaves the item's bottom or top edge. The pill sits on the longer leg.
function powerRouteMarkup(route) {
    const { item, socket, from, to, lengthCm } = route;
    const flag = lengthCm > LONG_RUN_CM ? ' is-long-run' : '';
    const vertical = Math.abs(to.y - from.y) >= Math.abs(to.x - from.x);
    const pillX = clamp(vertical ? from.x : (from.x + to.x) / 2, 24, wallWidthPx - 24);
    const pillY = clamp(vertical ? (from.y + to.y) / 2 : to.y, 9, wallHeightPx - 9);
    const ids = `data-item-id="${escapeHtml(item.id)}" data-socket-id="${escapeHtml(socket.id)}"`;
    return {
        path: `<path class="power-route${flag}" ${ids} data-length="${lengthCm}" d="M ${from.x} ${from.y} V ${to.y} H ${to.x}" />`,
        pill: `<span class="power-badge${flag}" ${ids} style="left: ${pillX}px; top: ${pillY}px;">${lengthCm} cm</span>`
    };
}

// Runs on every render and every drag, nudge or resize frame, but rebuilds only when a run changed
function refreshPowerRoutes() {
    if (!powerRoutingOn) return;

    const plan = planPowerRoutes();
    const summary = powerSummary(plan);
    const key = [
        wallWidthPx, wallHeightPx, summary.text,
        ...plan.routes.map(({ item, socket, from, to }) => `${item.id}>${socket.id}:${from.x},${from.y},${to.x},${to.y}`)
    ].join('|');
    if (key === powerRoutesKey) return;
    powerRoutesKey = key;

    const parts = plan.routes.map(powerRouteMarkup);
    powerRoutesLayer.innerHTML = `
        <svg class="power-routes-svg" width="${wallWidthPx}" height="${wallHeightPx}" viewBox="0 0 ${wallWidthPx} ${wallHeightPx}">
            ${parts.map(part => part.path).join('')}
        </svg>
        ${parts.map(part => part.pill).join('')}`;
    powerRoutingSummary.textContent = summary.text;
    powerRoutingSummary.classList.toggle('is-warning', summary.warning);
}

function setPowerRouting(on) {
    powerRoutingOn = on;
    powerRoutesKey = '';
    syncLedToggle(powerRoutingToggle, on);
    powerRoutesLayer.hidden = !on;
    if (on) {
        refreshPowerRoutes();
        return;
    }
    powerRoutesLayer.innerHTML = '';
    powerRoutingSummary.textContent = POWER_IDLE_TEXT;
    powerRoutingSummary.classList.remove('is-warning');
}

powerRoutingToggle.addEventListener('click', () => setPowerRouting(!powerRoutingOn));

// Floor references are front elevations in cm from the top-left corner of the piece, which stands on the
// floor line. A view aid like the cable runs, so it never reaches the layout, the history or the PNG.
const backdropRect = (x, y, w, h, r = 0, kind = 'shape') =>
    `<rect class="backdrop-${kind}" x="${x * SCALE}" y="${y * SCALE}" width="${w * SCALE}" height="${h * SCALE}" rx="${r * SCALE}" />`;
const backdropLine = (x1, y, x2) => `<path class="backdrop-detail" d="M ${x1 * SCALE} ${y * SCALE} H ${x2 * SCALE}" />`;

const FLOOR_BACKDROPS = {
    // A headboard behind a mattress topped at 55 cm, two pillows, a framed base and short legs
    bed: {
        name: 'Bed',
        widthCm: 155,
        heightCm: 85,
        art: [
            `<path class="backdrop-shape" d="M 0 ${30 * SCALE} V ${3 * SCALE} Q 0 0 ${3 * SCALE} 0 H ${152 * SCALE} Q ${155 * SCALE} 0 ${155 * SCALE} ${3 * SCALE} V ${30 * SCALE}" />`,
            backdropRect(10, 15, 60, 15, 6),
            backdropRect(85, 15, 60, 15, 6),
            backdropRect(3, 30, 149, 20, 3),
            backdropLine(3, 37, 152),
            backdropRect(1, 50, 153, 24, 1.5),
            backdropRect(5, 74, 6, 11),
            backdropRect(144, 74, 6, 11)
        ]
    },
    // A desk top at 75 cm on two legs with a drawer, and a 60 cm monitor on a short stand
    desk: {
        name: 'Desk',
        widthCm: 140,
        heightCm: 115,
        art: [
            backdropRect(40, 0, 60, 34, 1.5),
            backdropRect(42, 2, 56, 30, 0.5, 'detail'),
            backdropRect(67, 34, 6, 4.5),
            backdropRect(59, 38.5, 22, 1.5, 0.5),
            backdropRect(0, 40, 140, 3.5, 0.75),
            backdropRect(4, 43.5, 4, 71.5),
            backdropRect(132, 43.5, 4, 71.5),
            backdropRect(98, 43.5, 32, 16, 0.5),
            backdropLine(108, 51.5, 120)
        ]
    }
};

// The SVG lets the dimension line overflow its box, 12 px above the piece, with the tag sitting on it
function floorBackdropMarkup({ name, widthCm, heightCm, art }) {
    const width = widthCm * SCALE;
    const height = heightCm * SCALE;
    return `
        <svg class="floor-backdrop-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <path class="backdrop-dim" d="M 0 -12 H ${width} M 0 -17 V -7 M ${width} -17 V -7" />
            ${art.join('')}
        </svg>
        <span class="floor-backdrop-tag">${name} ${widthCm} x ${heightCm} cm</span>`;
}

function setFloorBackdrop(kind) {
    const backdrop = FLOOR_BACKDROPS[kind];
    floorBackdrop = backdrop ? kind : 'none';
    backdropButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.backdrop === floorBackdrop)));
    floorBackdropLayer.dataset.kind = floorBackdrop;
    floorBackdropLayer.innerHTML = backdrop ? floorBackdropMarkup(backdrop) : '';
    floorBackdropLayer.hidden = !backdrop;
}

backdropButtons.forEach(button => button.addEventListener('click', () => setFloorBackdrop(button.dataset.backdrop)));

// Creator Mode only hides the drafting tools through CSS, so Engineer Mode finds every guide, cable run,
// layer and coordinate field exactly as it left them
function setStudioMode(mode) {
    if (!STUDIO_MODES.includes(mode) || isPointerBusy()) return;
    studioMode = mode;
    appShell.dataset.studioMode = mode;
    modeEngineerBtn.setAttribute('aria-pressed', String(mode === 'engineer'));
    modeCreatorBtn.setAttribute('aria-pressed', String(mode === 'creator'));
    // A pointer resting on a ruler band stops, or starts, showing the guide cursor right away
    applyCrosshair();
}

modeEngineerBtn.addEventListener('click', () => setStudioMode('engineer'));
modeCreatorBtn.addEventListener('click', () => setStudioMode('creator'));

function updateInspectorLive() {
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
// so these flags tuck them inside the item there. A piece of 12 x 12 cm or less would vanish under
// its grips, so is-tiny moves them out past its edges and leaves the whole face to the drag.
function flagWallEdges(item, el) {
    el.classList.toggle('flush-right', item.left + item.width >= wallWidthPx - EPSILON);
    el.classList.toggle('flush-bottom', item.top + item.height >= wallHeightPx - EPSILON);
    el.classList.toggle('is-tiny', item.width <= TINY_ITEM_PX + EPSILON && item.height <= TINY_ITEM_PX + EPSILON);
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
    refreshMeasure();
    refreshPowerRoutes();
}

function syncSelectionBounds() {
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

// Only changed values are written, so a field that has focus keeps it and its caret
function syncInspectorPosition(item) {
    const fields = [
        [document.getElementById('edit-left-cm'), toCm(item.left), wallWidthCm - toCm(item.width)],
        [document.getElementById('edit-top-cm'), toCm(item.top), wallHeightCm - toCm(item.height)]
    ];
    fields.forEach(([input, valueCm, maxCm]) => {
        if (!input) return;
        if (input.value !== String(valueCm)) input.value = valueCm;
        if (input.max !== String(maxCm)) input.max = maxCm;
    });
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
    syncRulerSpans();
    refreshPowerRoutes();
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
    refreshMeasure();
}

function applyResizeFrame() {
    resizeState.frameId = 0;

    const item = wallItems.find(i => i.id === resizeState.itemId);
    if (!item) return;

    const { wallRect, scale, pointerX, pointerY, startLocalX, startLocalY, startWidth, startHeight, handle } = resizeState;
    const step = snapGridToggle.checked ? SNAP_STEP_PX : CM_STEP_PX;
    const [minWidthCm, minHeightCm] = minSizeCm(item.rotation);

    // Wall-space pointer travel, so the grip tracks the cursor at any fit level
    const localX = (pointerX - wallRect.left) / scale;
    const localY = (pointerY - wallRect.top) / scale;

    if (handle !== 's') {
        item.width = clamp(quantize(startWidth + localX - startLocalX, step), minWidthCm * SCALE, wallWidthPx - item.left);
    }
    if (handle !== 'e') {
        item.height = clamp(quantize(startHeight + localY - startLocalY, step), minHeightCm * SCALE, wallHeightPx - item.top);
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

    // Pressing a member of a multi-selection keeps it so the whole set can be dragged. Anything else
    // selects the pressed item together with its group, unless it was already picked on its own.
    const group = selectedItemIds.length > 1 && isSelected(item.id);
    if (!group && !isSelected(item.id)) selectWithGroups(item.id);

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
    refreshMeasure();
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
    if (panState.active) {
        panState.pointerX = e.clientX;
        panState.pointerY = e.clientY;
        if (!panState.frameId) panState.frameId = requestAnimationFrame(applyPanFrame);
        return;
    }

    if (guideDrag.active) {
        guideDrag.pointerX = e.clientX;
        guideDrag.pointerY = e.clientY;
        scheduleGuideFrame();
        return;
    }

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
    // A plain click on one member of a multi-selection narrows it to that member and its group
    if (group && !travelled) selectWithGroups(itemId);
    refreshMeasure();
});

window.addEventListener('mouseup', () => {
    if (!resizeState.active) return;
    finishResize();
    refreshMeasure();
});

window.addEventListener('mouseup', () => {
    if (guideDrag.active) finishGuideDrag();
    if (panState.active) endPan();
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
    refreshMeasure();
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

    // Touching one member of a group catches the whole group; hidden items cannot be caught
    const hits = wallItems.filter(item => !item.hidden && isOverlapping(box, item)).map(item => item.id);
    const ids = new Set([...marquee.baseIds, ...expandGroups(hits)]);
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
        finish: catalogEl.dataset.finish || null,
        ledEnabled: !FEATURE_TYPES.includes(catalogEl.dataset.type),
        locked: false,
        itemLedColor: null,
        rotation: 0,
        groupId: null,
        hidden: false,
        ...(catalogEl.dataset.type === 'note' && { text: DEFAULT_NOTE_TEXT })
    };

    // Doors, windows and sockets belong to the wall itself, so they start beneath the furniture
    if (OBSTACLE_TYPES.includes(newItem.type)) wallItems.unshift(newItem);
    else wallItems.push(newItem);
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
        <div class="wall-item ${source.dataset.type} ${source.dataset.finish ? `finish-${source.dataset.finish}` : 'feature'} rot-0" style="width: ${width}px; height: ${height}px;">
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
    if (guideDrag.active) cancelGuideDrag();
    if (panState.active) endPan();
    setSpaceHeld(false);
    if (marquee.active) cancelMarquee();
    else if (marquee.pending) marquee = createIdleMarquee();
    closeContextMenu();
    measure.alt = false;
    refreshMeasure();
});

function setSelection(ids) {
    const unique = [...new Set(ids)];
    selectedItemIds = unique.filter(id => wallItems.some(item => item.id === id));

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

const selectItem = (itemId) => setSelection(itemId ? [itemId] : []);

const groupMembers = (groupId) => wallItems.filter(item => item.groupId === groupId);

// Picking one member of a group picks the whole group
function expandGroups(ids) {
    const groupIds = new Set(wallItems.filter(item => ids.includes(item.id) && item.groupId).map(item => item.groupId));
    return [...new Set([...ids, ...wallItems.filter(item => groupIds.has(item.groupId)).map(item => item.id)])];
}

const selectWithGroups = (itemId) => setSelection(expandGroups([itemId]));

function toggleInSelection(itemId) {
    const ids = expandGroups([itemId]);
    setSelection(ids.every(isSelected)
        ? selectedItemIds.filter(id => !ids.includes(id))
        : [...selectedItemIds, ...ids]);
}

const selectAll = () => setSelection(wallItems.filter(item => !item.hidden).map(item => item.id));

// Bottom-up blocks of the stack: a lone item, or a whole group, whose members always sit together
function getUnits() {
    const units = [];
    wallItems.forEach(item => {
        const last = units.at(-1);
        if (item.groupId && last && last.groupId === item.groupId) {
            last.items.push(item);
        } else {
            units.push({ key: item.groupId ? `group:${item.groupId}` : `item:${item.id}`, groupId: item.groupId, items: [item] });
        }
    });
    return units;
}

// Groups are numbered bottom to top, in the order they appear in the stack
function groupLabels() {
    const labels = new Map();
    wallItems.forEach(item => {
        if (item.groupId && !labels.has(item.groupId)) labels.set(item.groupId, `Group ${labels.size + 1}`);
    });
    return labels;
}

// The id of the group when the selection is exactly one complete group
function selectedGroupId() {
    const items = getSelectedItems();
    const groupId = items[0]?.groupId;
    const whole = groupId && items.every(item => item.groupId === groupId) && groupMembers(groupId).length === items.length;
    return whole ? groupId : null;
}

const canGroup = () => selectedItemIds.length > 1 && !selectedGroupId();
const canUngroup = () => getSelectedItems().some(item => item.groupId);

// Groups are one level deep, so grouping members of other groups moves them into the new group
function groupSelection() {
    if (!canGroup()) return;

    const groupId = createGroupId();
    getSelectedItems().forEach(item => { item.groupId = groupId; });
    wallItems = normalizeGroups(wallItems);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Every group the selection touches dissolves, and all of its former members stay selected
function ungroupSelection() {
    const groupIds = new Set(getSelectedItems().map(item => item.groupId).filter(Boolean));
    if (!groupIds.size) return;

    const members = wallItems.filter(item => groupIds.has(item.groupId));
    members.forEach(item => { item.groupId = null; });
    selectedItemIds = [...new Set([...selectedItemIds, ...members.map(item => item.id)])];
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

// Locked items survive a removal and stay selected, so the user can see what was skipped
function removeItems(ids) {
    const removable = new Set(wallItems.filter(item => ids.includes(item.id) && !item.locked).map(item => item.id));
    if (!removable.size) return;

    wallItems = normalizeGroups(wallItems.filter(item => !removable.has(item.id)));
    selectedItemIds = selectedItemIds.filter(id => !removable.has(id));
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

const removeSelectedItems = () => removeItems(selectedItemIds);

// A block of copies that would newly cut into the slope slides left or down, a centimeter at a time,
// to the nearest clear spot, the way a group drag refuses new intrusions. A single copy may land in
// the slope and is flagged red, like a single dragged item.
function slopeClearOffset(sources, box, dx, dy) {
    const watched = sources.filter(source => !intrudesAtticSlope(source));
    const intrudes = (x, y) => watched.some(source => intrudesAtticSlope({ ...source, left: source.left + x, top: source.top + y }));
    if (sources.length < 2 || !intrudes(dx, dy)) return [dx, dy];

    for (let step = CM_STEP_PX; step <= Math.max(wallWidthPx, wallHeightPx); step += CM_STEP_PX) {
        const left = dx - step;
        const down = dy + step;
        if (box.left + left >= 0 && !intrudes(left, dy)) return [left, dy];
        if (box.top + box.height + down <= wallHeightPx && !intrudes(dx, down)) return [dx, down];
    }
    return [dx, dy];
}

// Copies keep their relative layout, so the offset is clamped for the block's box, not per item.
// Each group with two or more copied members becomes a new group of its own copies.
function placeCopies(sources, offsetPx) {
    const box = getBounds(sources);
    let dx = clamp(offsetPx, -box.left, wallWidthPx - box.left - box.width);
    let dy = clamp(offsetPx, -box.top, wallHeightPx - box.top - box.height);
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
        copy.width = Math.min(copy.width, wallWidthPx);
        copy.height = Math.min(copy.height, wallHeightPx);
        copy.left = clamp(source.left + dx, 0, wallWidthPx - copy.width);
        copy.top = clamp(source.top + dy, 0, wallHeightPx - copy.height);
        return copy;
    });

    // normalizeGroups drops the id of any group that ends up with a single copy
    wallItems = normalizeGroups([...wallItems, ...copies]);
    selectedItemIds = copies.map(copy => copy.id);
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
    return copies;
}

function duplicateSelectedItem() {
    const sources = getSelectedItems();
    if (sources.length) placeCopies(sources, DUPLICATE_OFFSET_PX);
}

const countLabel = (count) => `${count} item${count === 1 ? '' : 's'}`;

// Copies are taken in stacking order, so a paste rebuilds the same layering
function copySelection() {
    const items = getSelectedItems();
    if (!items.length) return false;
    clipboardState = { items: JSON.parse(JSON.stringify(items)), pasteCount: 0 };
    showIoStatus(`Copied ${countLabel(items.length)}.`, 'success');
    return true;
}

// Cut follows Delete: locked items are copied but stay on the wall, still selected
function cutSelection() {
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
function pasteClipboard() {
    if (!clipboardState.items.length || isPointerBusy()) return;
    clipboardState.pasteCount += 1;
    placeCopies(clipboardState.items, DUPLICATE_OFFSET_PX * clipboardState.pasteCount);
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

function canMoveLayer(step) {
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
        wallItems = ordered;
        return;
    }
    wallItems.splice(wallItems.findIndex(item => item.groupId === groupId), ordered.length, ...ordered);
}

// wallItems is also the paint order in #wall-items. Walking from the leading end lets every selected
// block hop over its unselected neighbor once, so a selection shifts one layer and keeps its inner order.
function moveSelectedLayer(step) {
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

// A quarter turn swaps the footprint, so the swapped box must still fit inside the wall
const fitsTurned = (box) => box.height <= wallWidthPx && box.width <= wallHeightPx;

// Turns the item clockwise about its center. Width and height swap so collisions, the marquee and
// wall clamping keep working on a plain axis-aligned box. When the center offset lands on a half
// centimeter, the even and odd turns round in opposite directions, so a full turn returns home.
function rotateItem(item) {
    const widthCm = toCm(item.width);
    const heightCm = toCm(item.height);
    const roundShift = item.rotation % 180 === 0 ? Math.floor : Math.ceil;
    const leftCm = toCm(item.left) + roundShift((widthCm - heightCm) / 2);
    const topCm = toCm(item.top) + roundShift((heightCm - widthCm) / 2);

    item.width = heightCm * SCALE;
    item.height = widthCm * SCALE;
    item.left = clamp(leftCm, 0, wallWidthCm - heightCm) * SCALE;
    item.top = clamp(topCm, 0, wallHeightCm - widthCm) * SCALE;
    item.rotation = (item.rotation + 90) % 360;
}

// A group turns as one rigid block about its own center. Members keep their places relative to the
// box, so the half-centimeter rounding happens once for the whole group and never pulls it apart.
function rotateGroup(members) {
    const box = getBounds(members);
    const [boxLeft, boxTop, boxWidth, boxHeight] = [box.left, box.top, box.width, box.height].map(toCm);
    const roundShift = members[0].rotation % 180 === 0 ? Math.floor : Math.ceil;
    const left = clamp(boxLeft + roundShift((boxWidth - boxHeight) / 2), 0, wallWidthCm - boxHeight);
    const top = clamp(boxTop + roundShift((boxHeight - boxWidth) / 2), 0, wallHeightCm - boxWidth);

    members.forEach(item => {
        const [itemLeft, itemTop, width, height] = [item.left, item.top, item.width, item.height].map(toCm);
        // Clockwise, the space below an item becomes the space to its left, and its left space its top
        item.left = (left + boxTop + boxHeight - itemTop - height) * SCALE;
        item.top = (top + itemLeft - boxLeft) * SCALE;
        item.width = height * SCALE;
        item.height = width * SCALE;
        item.rotation = (item.rotation + 90) % 360;
    });
}

// A fully selected group is one rotation unit; any other selected item is a unit of its own
function rotationUnits() {
    const units = [];
    const done = new Set();
    getSelectedItems().forEach(item => {
        if (done.has(item.id)) return;
        const members = item.groupId ? groupMembers(item.groupId) : [];
        const unit = members.length && members.every(member => isSelected(member.id)) ? members : [item];
        unit.forEach(member => done.add(member.id));
        units.push(unit);
    });
    return units;
}

const canRotateUnit = (unit) => unit.every(item => !item.locked) && fitsTurned(unit.length === 1 ? unit[0] : getBounds(unit));
const canRotateSelection = () => rotationUnits().some(canRotateUnit);

// Loose items turn in place and groups turn as a whole; locked or oversized units are left alone
function rotateSelection() {
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

// Align and Distribute use the rotation units: a fully selected group moves as one rigid block and any
// other selected item on its own. Locked units hold still but still count toward the selection box,
// so they work as anchors.
function arrangeUnits() {
    return rotationUnits().map(items => ({ items, box: getBounds(items), movable: items.every(item => !item.locked) }));
}

const canAlignSelection = (units = arrangeUnits()) => units.length > 1 && units.some(unit => unit.movable);
const canDistributeSelection = (units = arrangeUnits()) => units.filter(unit => unit.movable).length > 2;

const ALIGN_EDGES = {
    left: { axis: 'x', at: 0 },
    center: { axis: 'x', at: 0.5 },
    right: { axis: 'x', at: 1 },
    top: { axis: 'y', at: 0 },
    middle: { axis: 'y', at: 0.5 },
    bottom: { axis: 'y', at: 1 }
};

const axisKeys = (axis) => (axis === 'x' ? ['left', 'width'] : ['top', 'height']);

// Moving toward the slope only ever deepens an intrusion, so the clear offsets form one run that
// starts at zero. Stepping back from the target a centimeter at a time finds the farthest clear spot.
// As in a group drag, only pieces that start clear of the slope are held to it.
function slopeSafeOffset(items, key, offset) {
    const watched = items.filter(item => !intrudesAtticSlope(item));
    const intrudesAt = (shift) => watched.some(item => intrudesAtticSlope({ ...item, [key]: item[key] + shift }));
    let shift = offset;
    while (Math.sign(shift) === Math.sign(offset) && Math.abs(shift) > EPSILON && intrudesAt(shift)) {
        shift -= Math.sign(offset) * CM_STEP_PX;
    }
    return Math.abs(shift) < EPSILON || Math.sign(shift) !== Math.sign(offset) ? 0 : shift;
}

const reportHeld = (held) => {
    if (held) showIoStatus(`Kept ${held} ${held === 1 ? 'item' : 'items'} clear of the attic slope.`, 'error');
};

// A horizontal mirror turns a right-facing quarter turn into a left-facing one; 0 and 180 look the same
const mirroredRotation = (rotation) => (rotation === 90 ? 270 : rotation === 270 ? 90 : rotation);

// Mirrors units across the vertical line whose doubled position is axisSum: each piece lands at
// axisSum minus its right edge, so a group keeps its mirrored shape. The unit is flipped inside its own
// box first, then slides as one block; a unit that would newly cut into the slope steps back toward
// where it was, as with Align, and stays as it was when no step is clear.
function mirrorUnits(units, axisSum) {
    let held = 0;
    let moved = 0;

    units.forEach(({ items, box }) => {
        const right = box.left + box.width;
        const clear = items.map(item => !intrudesAtticSlope(item));
        const inner = items.map(item => box.left + right - (item.left + item.width));
        const fits = (shift) => items.every((item, i) => !clear[i] || !intrudesAtticSlope({ ...item, left: inner[i] + shift }));
        const offset = axisSum - box.left - right;

        let shift = offset;
        while (Math.abs(shift) > EPSILON && !fits(shift)) shift -= Math.sign(offset) * CM_STEP_PX;
        if (!fits(shift)) {
            held += items.length;
            return;
        }
        if (Math.abs(shift - offset) > EPSILON) held += items.length;

        const before = items.map(item => `${item.left}:${item.rotation}`).join();
        items.forEach((item, i) => {
            item.left = inner[i] + shift;
            item.rotation = mirroredRotation(item.rotation);
        });
        if (items.map(item => `${item.left}:${item.rotation}`).join() !== before) moved++;
    });

    return { held, moved };
}

function finishMirror({ held, moved }) {
    reportHeld(held);
    if (!moved) return;
    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

const canFlipSelection = () => selectedItemIds.length > 1 && arrangeUnits().some(unit => unit.movable);

// Locked units stay put but still count toward the box, so the mirror line is the whole selection's
function flipSelection() {
    if (!canFlipSelection() || isPointerBusy()) return;
    const bounds = getBounds(getSelectedItems());
    finishMirror(mirrorUnits(arrangeUnits().filter(unit => unit.movable), bounds.left * 2 + bounds.width));
}

function mirrorItemAcrossWall() {
    const item = getSelectedItem();
    if (!item || item.locked || isPointerBusy()) return;
    finishMirror(mirrorUnits([{ items: [item], box: getBounds([item]) }], wallWidthPx));
}

function arrangeAlong(axis, moves) {
    const [key, size] = axisKeys(axis);
    const limit = axis === 'x' ? wallWidthPx : wallHeightPx;
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

function alignSelection(edge) {
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
function distributeSelection(axis) {
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

const canCenterSelection = () => arrangeUnits().some(unit => unit.movable);

// One piece lands exactly on the center line. Several move as one rigid block made of their movable
// units, rounded to whole cm, and stop short of the attic slope the way Align does.
function centerSelectionOnWall(axis) {
    if (isPointerBusy()) return;
    const items = arrangeUnits().filter(unit => unit.movable).flatMap(unit => unit.items);
    if (!items.length) {
        if (selectedItemIds.length) flashLockNote();
        return;
    }

    const [key, size] = axisKeys(axis);
    const limit = axis === 'x' ? wallWidthPx : wallHeightPx;
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

const ARRANGE_ACTIONS = [
    { id: 'align-left', label: 'Align Left', hint: 'line up the left edges' },
    { id: 'align-center', label: 'Align Center', hint: 'center horizontally on the selection' },
    { id: 'align-right', label: 'Align Right', hint: 'line up the right edges' },
    { id: 'distribute-h', label: 'Distribute Horizontally', hint: 'equal gaps from left to right', distribute: true },
    { id: 'align-top', label: 'Align Top', hint: 'line up the top edges' },
    { id: 'align-middle', label: 'Align Middle', hint: 'center vertically on the selection' },
    { id: 'align-bottom', label: 'Align Bottom', hint: 'line up the bottom edges' },
    { id: 'distribute-v', label: 'Distribute Vertically', hint: 'equal gaps from top to bottom', distribute: true }
];

function runArrange(action) {
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

function startNoteEdit(item, el) {
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

function setNoteText(item, raw) {
    const text = sanitizeNoteText(raw);
    if (text === item.text) return false;

    item.text = text;
    const label = getItemElement(item.id)?.querySelector('.item-label');
    if (label) label.textContent = text;
    renderLayers();
    commitLayoutChange();
    return true;
}

function finishNoteEdit() {
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

wallItemsLayer.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.wall-item');
    const item = el && wallItems.find(i => i.id === el.dataset.id);
    if (!item || isPointerBusy()) return;

    if (isNote(item)) startNoteEdit(item, el);
    // Anywhere else a double-click steps into the group and picks just that member
    else if (item.groupId) selectItem(item.id);
});

// Layer explorer. Rows run top to bottom, the reverse of wallItems, and every row is keyed as
// item:<id> or group:<id> so clicks, toggles and drops all resolve through the same helper.
const collapsedGroups = new Set();
let layerDrag = null;

const layerName = (item) => (isNote(item) ? `Note: ${item.text.split('\n')[0]}` : item.name);

function layerItems(key) {
    const split = key.indexOf(':');
    const kind = key.slice(0, split);
    const id = key.slice(split + 1);
    return kind === 'group' ? groupMembers(id) : wallItems.filter(item => item.id === id);
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

function renderLayers() {
    const labels = groupLabels();
    const rows = [...getUnits()].reverse().flatMap(unit => {
        if (!unit.groupId) return [itemRowHtml(unit.items[0], null)];
        const collapsed = collapsedGroups.has(unit.groupId);
        const children = collapsed ? [] : [...unit.items].reverse().map(item => itemRowHtml(item, unit.groupId));
        return [groupRowHtml(unit, labels.get(unit.groupId), collapsed), ...children];
    });

    layerList.innerHTML = rows.join('') || '<li class="layer-empty">Nothing on the wall yet.</li>';
    layersCount.textContent = wallItems.length;
    syncLayerSelection();
}

// Selection changes only flip classes; the list itself is rebuilt when the stack changes
function syncLayerSelection() {
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
        else if (ids.every(isSelected)) setSelection(selectedItemIds.filter(id => !ids.includes(id)));
        else setSelection([...selectedItemIds, ...ids]);
    }
});

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

    const before = wallItems.map(item => item.id).join();
    applyBlockOrder(blocks, groupId);
    if (wallItems.map(item => item.id).join() === before) return;

    renderPlanner();
    updateInspectorPanel();
    commitLayoutChange();
}

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
    <div id="warning-feature" class="collision-warning" hidden>Furniture overlaps a door, window or socket zone</div>
    <div id="warning-attic" class="collision-warning" hidden>Intrudes into sloped ceiling zone</div>`;

const formatPrice = (value) => `$${Math.round(value * 100) / 100}`;

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
    const layerIndex = wallItems.indexOf(item);
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
                    ${feature ? '<span class="feature-badge">Room Feature</span>' : `<span>$${item.price}</span>`}
                </span>
            </div>
            <span class="tech-readout">Offset: <strong id="inspector-pos-readout">${formatOffset(item)}</strong></span>
            ${locked ? `<p class="lock-note" id="lock-note">${lockedParts} are locked. Press L or Unlock Item to edit.</p>` : ''}
            ${groupNote}

            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-left-cm">Left X (cm)</label>
                    <input type="number" id="edit-left-cm" class="dim-input" min="0" max="${wallWidthCm - toCm(item.width)}" value="${toCm(item.left)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-top-cm">Top Y (cm)</label>
                    <input type="number" id="edit-top-cm" class="dim-input" min="0" max="${wallHeightCm - toCm(item.height)}" value="${toCm(item.top)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="${minWidthCm}" max="${wallWidthCm}" value="${toCm(item.width)}" ${lockedAttr}>
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="${minHeightCm}" max="${wallHeightCm}" value="${toCm(item.height)}" ${lockedAttr}>
                </div>
            </div>
            ${centerWallFieldHtml()}
            ${feature ? featureNote : furnitureFields}

            ${rotationFieldHtml(`${item.rotation} deg`, [item])}
            ${symmetryFieldHtml([item])}
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

        const clampedW = clamp(rawW, minWidthCm, wallWidthCm);
        const clampedH = clamp(rawH, minHeightCm, wallHeightCm);

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

    const leftInput = document.getElementById('edit-left-cm');
    const topInput = document.getElementById('edit-top-cm');

    // Typed offsets are rounded to whole cm and clamped so the whole item stays on the wall
    function applyPositionChange() {
        if (item.locked) return;

        const readCm = (input, currentPx, maxCm) => {
            const value = Math.round(parseFloat(input.value));
            return clamp(Number.isFinite(value) ? value : toCm(currentPx), 0, maxCm);
        };
        const leftCm = readCm(leftInput, item.left, wallWidthCm - toCm(item.width));
        const topCm = readCm(topInput, item.top, wallHeightCm - toCm(item.height));
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
                    <span>${formatPrice(total)}</span>
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
    inspectorBox.querySelectorAll('[data-arrange]').forEach(btn => {
        btn.addEventListener('click', () => runArrange(btn.dataset.arrange));
    });
    document.getElementById('rotate-item-btn').addEventListener('click', rotateSelection);
    document.getElementById('center-wall-h-btn')?.addEventListener('click', () => centerSelectionOnWall('x'));
    document.getElementById('center-wall-v-btn')?.addEventListener('click', () => centerSelectionOnWall('y'));
    document.getElementById('flip-horizontal-btn')?.addEventListener('click', flipSelection);
    document.getElementById('mirror-wall-btn')?.addEventListener('click', mirrorItemAcrossWall);
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

const isContextMenuOpen = () => !contextMenu.hidden;

const CONTEXT_ACTIONS = {
    duplicate: duplicateSelectedItem,
    group: groupSelection,
    ungroup: ungroupSelection,
    forward: () => moveSelectedLayer(1),
    backward: () => moveSelectedLayer(-1),
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
        forward: { disabled: !canMoveLayer(1) },
        backward: { disabled: !canMoveLayer(-1) },
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
    refreshMeasure();
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

// Plain L and R lock and rotate; with Ctrl or Cmd they stay with the browser (address bar, reload)
const isPlainItemShortcut = (e, key) =>
    (e.key || '').toLowerCase() === key &&
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
    if ((key === 'c' || key === 'x') && !e.shiftKey && selectedItemIds.length && !hasTextSelection()) {
        e.preventDefault();
        if (!e.repeat && !isPointerBusy()) (key === 'c' ? copySelection : cutSelection)();
        return true;
    }

    if (key === 'v' && !e.shiftKey && clipboardState.items.length) {
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
    // Escape abandons a catalog drag, a grip resize, a guide drag or a selection box before anything else sees the key
    if (e.key === 'Escape' && (catalogDrag.active || resizeState.active || marquee.active || guideDrag.active || panState.active)) {
        e.preventDefault();
        if (catalogDrag.active) endCatalogDrag();
        if (resizeState.active) cancelResize();
        if (guideDrag.active) cancelGuideDrag();
        if (panState.active) cancelPan();
        if (marquee.active) cancelMarquee();
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

    // An open dialog is modal, so nothing behind it may react to shortcuts
    if (isModalOpen()) return;

    // Alt+M flips the workspace mode. The physical key is read, since Option+M on a Mac types a character.
    if (e.code === 'KeyM' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isFormField(e.target)) {
        e.preventDefault();
        suppressAltMenu = true;
        if (!e.repeat) setStudioMode(isCreatorMode() ? 'engineer' : 'creator');
        return;
    }

    // Space keeps its usual job in fields and on a button reached with Tab. A button that only holds
    // focus because it was clicked gives Space up, so clicking a control and then panning just works.
    const keyboardButton = e.target.tagName === 'BUTTON' && !focusFromPointer;
    if (e.code === 'Space' && !isFormField(e.target) && !keyboardButton) {
        e.preventDefault();
        if (!spaceHeld && !isPointerBusy()) setSpaceHeld(true);
        return;
    }

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

    if (e.key === 'Alt') {
        // With a selection, Alt measures to whatever the pointer rests on
        measure.alt = true;
        if (selectedItemIds.length) {
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

    const hasModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (hasModifier && handleModifierShortcut(e)) return;
    handleItemKeys(e);
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && spaceHeld) {
        e.preventDefault();
        setSpaceHeld(false);
        return;
    }
    if (e.key !== 'Alt') return;

    measure.alt = false;
    refreshMeasure();

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
    if (pruneGuides()) renderGuides();
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
    applyDefaultLayout();
    selectedItemIds = [];
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

// One payload for the JSON export and share links, so a link opens exactly what a file would
const layoutPayload = () => ({
    version: EXPORT_VERSION,
    wallWidthCm,
    wallHeightCm,
    wallItems,
    atticSlope: atticSlopeToggle.checked,
    wallPaint,
    wallGuides,
    accentColor: accentColorPicker.value,
    cornerColor: cornerColorPicker.value,
    brightness: Number(brightnessSlider.value)
});

function exportLayout() {
    downloadBlob(new Blob([JSON.stringify(layoutPayload(), null, 2)], { type: 'application/json' }), EXPORT_FILENAME);
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
// Room features are not bought or mounted, so the spec sheet leaves them out
const furnitureItems = () => wallItems.filter(item => !isFeature(item));

// A turned piece is still the same product, so the bill lists it at its catalog orientation
function buildBomRows() {
    const groups = new Map();
    furnitureItems().forEach(item => {
        const [widthCm, heightCm] = isQuarterTurn(item)
            ? [toCm(item.height), toCm(item.width)]
            : [toCm(item.width), toCm(item.height)];
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
    return furnitureItems()
        .sort((a, b) => a.left - b.left || a.top - b.top)
        .map(item => {
            const topCm = toCm(item.top);
            const heightCm = toCm(item.height);
            return {
                name: item.name,
                size: `${toCm(item.width)} x ${heightCm} cm`,
                widthCm: toCm(item.width),
                heightCm,
                left: toCm(item.left),
                top: topCm,
                floor: wallHeightCm - topCm - heightCm
            };
        });
}

function renderSpecSheet() {
    const bomRows = buildBomRows();
    const mountingRows = buildMountingRows();
    const count = furnitureItems().length;

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
    const count = furnitureItems().length;
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
// The buffer goes inside the open dialog, since a modal dialog makes everything outside it inert
function copyWithSelection(text, dialog = specModal, returnFocus = copyMarkdownBtn) {
    const buffer = document.createElement('textarea');
    buffer.value = text;
    buffer.setAttribute('readonly', '');
    buffer.className = 'clipboard-buffer';
    dialog.appendChild(buffer);
    buffer.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }
    buffer.remove();
    returnFocus.focus();
    return copied;
}

async function copyText(text, dialog, returnFocus) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return copyWithSelection(text, dialog, returnFocus);
    }
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
    clearTimeout(csvLabelTimer);
    copyMarkdownBtn.textContent = COPY_LABEL;
    exportCsvBtn.textContent = CSV_LABEL;
    renderSpecSheet();
    specModal.showModal();
}

// RFC 4180: a field holding a comma, quote or line break is quoted and its quotes are doubled.
// Text that starts like a formula gets a leading apostrophe so a spreadsheet shows it instead of running it.
function csvField(value) {
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (cells) => cells.map(csvField).join(',');

function buildSpecCsv() {
    const count = furnitureItems().length;
    const lines = [
        csvRow(['Spatial Studio Spec Sheet']),
        csvRow(['Wall (cm)', `${wallWidthCm} x ${wallHeightCm}`]),
        '',
        csvRow(['Bill of Materials']),
        csvRow(['Item', 'Width (cm)', 'Height (cm)', 'Finish', 'Qty', 'Unit Price (USD)', 'Subtotal (USD)']),
        ...buildBomRows().map(row => csvRow([
            row.name, row.widthCm, row.heightCm, finishLabel(row.finish), row.qty,
            row.price.toFixed(2), (row.price * row.qty).toFixed(2)
        ])),
        csvRow(['Total', '', '', '', count, '', totalPrice().toFixed(2)]),
        '',
        csvRow(['Mounting & Drilling Coordinates']),
        csvRow(['Item', 'Width (cm)', 'Height (cm)', 'From Left (cm)', 'From Ceiling (cm)', 'From Floor (cm)']),
        ...buildMountingRows().map(row => csvRow([row.name, row.widthCm, row.heightCm, row.left, row.top, row.floor]))
    ];
    return `${lines.join('\r\n')}\r\n`;
}

function flashCsvLabel(text) {
    clearTimeout(csvLabelTimer);
    exportCsvBtn.textContent = text;
    csvLabelTimer = setTimeout(() => { exportCsvBtn.textContent = CSV_LABEL; }, 2000);
}

// The byte order mark lets spreadsheet apps read item names as UTF-8
function exportSpecCsv() {
    downloadBlob(new Blob(['\ufeff', buildSpecCsv()], { type: 'text/csv;charset=utf-8' }), CSV_FILENAME);
    flashCsvLabel('Downloaded!');
}

viewSpecBtn.addEventListener('click', openSpecSheet);
closeSpecBtn.addEventListener('click', () => specModal.close());
copyMarkdownBtn.addEventListener('click', copySpecMarkdown);
exportCsvBtn.addEventListener('click', exportSpecCsv);

// Project gallery. Cards are listed most recently edited first; the open project cannot be deleted,
// so there is always one project for autosave to write to.
const PROJECT_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});
const THUMB_COLORS = {
    walnut: '#8b5a2b', oak: '#c89d66', black: '#525a66', white: '#e5e7eb',
    socket: '#d3d8e0', door: 'rgba(148, 163, 184, 0.4)', window: 'rgba(96, 165, 250, 0.45)', note: '#fde68a'
};

// The open project is read from the live wall; the others from storage, through the usual sanitizer
function projectLayout(project) {
    const data = project.id === activeProjectId ? currentLayoutData() : readProjectLayout(project.id);
    try {
        return normalizeLayout(data || {});
    } catch {
        return null;
    }
}

function projectThumbHtml(layout) {
    if (!layout) return '<span class="project-thumb is-empty" aria-hidden="true"></span>';
    const width = layout.wallWidthCm * SCALE;
    const height = layout.wallHeightCm * SCALE;
    const rects = layout.items.filter(item => !item.hidden).map(item => `
        <rect x="${item.left}" y="${item.top}" width="${item.width}" height="${item.height}" rx="3"
              fill="${THUMB_COLORS[isFeature(item) ? item.type : item.finish] || THUMB_COLORS.walnut}" />`).join('');
    return `
        <svg class="project-thumb" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect class="project-thumb-wall" width="${width}" height="${height}" fill="${wallPaintById(layout.wallPaint).ambient}" />${rects}
        </svg>`;
}

function projectCardHtml(project) {
    const layout = projectLayout(project);
    const current = project.id === activeProjectId;
    const name = escapeHtml(project.name);
    const count = layout ? layout.items.length : 0;
    const details = layout
        ? ` | ${count} item${count === 1 ? '' : 's'} | ${layout.wallWidthCm} x ${layout.wallHeightCm} cm`
        : ' | Unreadable layout';
    return `
        <li class="project-card${current ? ' is-current' : ''}" data-project-id="${project.id}">
            ${projectThumbHtml(layout)}
            <div class="project-info">
                <div class="project-title">
                    <span class="project-name">${name}</span>
                    ${current ? '<span class="project-badge">Open</span>' : ''}
                </div>
                <span class="project-meta">Edited ${PROJECT_DATE_FORMAT.format(project.timestamp)}${details}</span>
            </div>
            <div class="project-actions">
                <button type="button" class="btn-secondary" data-action="load" aria-label="Load ${name}" ${current ? 'disabled' : ''}>Load</button>
                <button type="button" class="btn-secondary" data-action="rename" aria-label="Rename ${name}">Rename</button>
                <button type="button" class="btn-danger" data-action="delete" aria-label="Delete ${name}" ${current ? 'disabled title="The open project cannot be deleted"' : ''}>Delete</button>
            </div>
        </li>`;
}

function renderProjects() {
    // Reversed first so that two saves within the same millisecond still list the newer one on top
    const sorted = [...projects].reverse().sort((a, b) => b.timestamp - a.timestamp);
    const full = projects.length >= MAX_PROJECTS;
    projectList.innerHTML = sorted.map(projectCardHtml).join('');
    projectsSubtitle.textContent = `${projects.length} saved project${projects.length === 1 ? '' : 's'}. Changes save to the open project automatically.`;
    saveProjectBtn.disabled = full;
    newProjectName.disabled = full;
    projectLimitNote.hidden = !full;
    syncProjectsButton();
}

const syncProjectsButton = () => { projectsBtn.title = `My Projects (open: ${activeProject().name})`; };

function saveAsNewProject() {
    if (projects.length >= MAX_PROJECTS) return;

    const project = {
        id: createProjectId(),
        name: cleanProjectName(newProjectName.value, `Project ${projects.length + 1}`),
        timestamp: Date.now()
    };
    projects.push(project);
    activeProjectId = project.id;
    saveState();
    newProjectName.value = '';
    renderProjects();
    showIoStatus(`Saved as ${project.name}.`, 'success');
}

// Each project keeps its own undo history, so switching starts a fresh one
function openProject(id) {
    const project = projects.find(entry => entry.id === id);
    if (!project || id === activeProjectId || isPointerBusy()) return;

    activeProjectId = id;
    selectedItemIds = [];
    applyProjectLayout(readProjectLayout(id));
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    historyStack = [];
    historyIndex = -1;
    pushHistory();
    writeProjectIndex();
    projectsModal.close();
    syncProjectsButton();
    showIoStatus(`Opened ${project.name}.`, 'success');
}

// Delete takes two presses; the first arms the button for a few seconds
function deleteProject(project, button) {
    if (project.id === activeProjectId) return;
    if (!button.classList.contains('is-armed')) {
        button.classList.add('is-armed');
        button.textContent = 'Confirm';
        button.setAttribute('aria-label', `Confirm deleting ${project.name}`);
        setTimeout(() => {
            if (!button.isConnected) return;
            button.classList.remove('is-armed');
            button.textContent = 'Delete';
            button.setAttribute('aria-label', `Delete ${project.name}`);
        }, 3000);
        return;
    }

    projects = projects.filter(entry => entry.id !== project.id);
    storageRemove(PROJECT_LAYOUT_PREFIX + project.id);
    writeProjectIndex();
    renderProjects();
    // The pressed button is gone with its card, so focus would otherwise fall out of the dialog
    newProjectName.focus();
}

// Escape inside the rename field cancels the edit, and that same key must not close the whole dialog
let renameEscape = false;

// The card is patched in place rather than re-rendered: a click that ends the rename by blurring the
// field must still land on the button it was aimed at
function startProjectRename(card, project) {
    const label = card.querySelector('.project-name');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'project-rename';
    input.value = project.name;
    input.maxLength = PROJECT_NAME_LENGTH;
    input.setAttribute('aria-label', 'Project name');
    label.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save, refocus) => {
        if (finished) return;
        finished = true;
        if (save) {
            project.name = cleanProjectName(input.value, project.name);
            writeProjectIndex();
            syncProjectsButton();
        }
        label.textContent = project.name;
        input.replaceWith(label);
        card.querySelectorAll('button[data-action]').forEach(button => {
            if (!button.classList.contains('is-armed')) button.setAttribute('aria-label', `${button.textContent} ${project.name}`);
        });
        if (refocus) card.querySelector('[data-action="rename"]').focus();
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true, true);
        } else if (e.key === 'Escape') {
            // The flag only covers the cancel event this same key press may raise
            renameEscape = true;
            setTimeout(() => { renameEscape = false; }, 0);
            finish(false, true);
        }
    });
    input.addEventListener('blur', () => finish(true, false));
}

projectList.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    const card = e.target.closest('.project-card');
    const project = card && projects.find(entry => entry.id === card.dataset.projectId);
    if (!button || !project) return;

    if (button.dataset.action === 'load') openProject(project.id);
    else if (button.dataset.action === 'rename') startProjectRename(card, project);
    else if (button.dataset.action === 'delete') deleteProject(project, button);
});

projectsModal.addEventListener('cancel', (e) => {
    if (renameEscape) e.preventDefault();
});

newProjectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveAsNewProject();
});

function openProjects() {
    if (isModalOpen() || isPointerBusy()) return;
    clearTimeout(shareLabelTimer);
    copyShareLinkBtn.textContent = SHARE_LABEL;
    renderProjects();
    projectsModal.showModal();
    newProjectName.focus();
}

function flashShareLabel(text) {
    clearTimeout(shareLabelTimer);
    copyShareLinkBtn.textContent = text;
    shareLabelTimer = setTimeout(() => { copyShareLinkBtn.textContent = SHARE_LABEL; }, 2000);
}

async function copyShareLink() {
    const url = `${window.location.href.split('#')[0]}${SHARE_HASH_PREFIX}${toBase64Url(JSON.stringify(layoutPayload()))}`;
    const copied = await copyText(url, projectsModal, copyShareLinkBtn);
    flashShareLabel(copied ? 'Link Copied' : 'Copy failed');
    showIoStatus(copied ? 'Share link copied. It opens this exact wall in any browser.' : 'The share link could not be copied.', copied ? 'success' : 'error');
}

copyShareLinkBtn.addEventListener('click', copyShareLink);

// A link pasted into a tab that already runs the planner only changes the hash, so it is picked up here
window.addEventListener('hashchange', () => {
    const shared = takeSharedPlan();
    if (!shared || isPointerBusy()) return;
    const project = addSharedProject();
    if (!project) return;
    storageSet(PROJECT_LAYOUT_PREFIX + project.id, JSON.stringify(shared));
    openProject(project.id);
});

projectsBtn.addEventListener('click', openProjects);
closeProjectsBtn.addEventListener('click', () => projectsModal.close());

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
closeOnBackdropClick(projectsModal);
closeOnBackdropClick(commandPalette);

function openShortcuts() {
    if (isModalOpen() || isPointerBusy()) return;
    shortcutsModal.showModal();
}

shortcutsBtn.addEventListener('click', openShortcuts);
closeShortcutsBtn.addEventListener('click', () => shortcutsModal.close());

function clearGuides() {
    if (!wallGuides.length || isPointerBusy()) return;
    wallGuides = [];
    renderGuides();
    commitLayoutChange();
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
    }

    catalogItems.forEach(card => {
        // Creator Mode keeps the room features out of the catalog, so the palette leaves them out too
        if (creator && FEATURE_TYPES.includes(card.dataset.type)) return;
        const size = `${toCm(parseFloat(card.dataset.width))} x ${toCm(parseFloat(card.dataset.height))} cm`;
        add('Mount', `Mount: ${card.dataset.name}`, () => spawnFromCatalog(card), size);
    });

    add('Wall & View', 'Toggle Ambient / Daylight Mode', toggleAmbientMode, isAmbientMode ? 'Ambient' : 'Daylight');
    add('Wall & View', 'Toggle Snap 5cm Grid', () => snapGridToggle.click(), onOff(snapGridToggle.checked));
    add('Wall & View', 'Toggle Attic Slope', () => atticSlopeToggle.click(), onOff(atticSlopeToggle.checked));
    if (!creator) add('Wall & View', 'Toggle Power Routing Overlay', () => setPowerRouting(!powerRoutingOn), onOff(powerRoutingOn));
    add('Wall & View', 'Reset Zoom & Pan', resetView, 'Ctrl+0');
    if (!creator) add('Wall & View', 'Clear Reference Guides', clearGuides, wallGuides.length ? `${wallGuides.length} placed` : 'None placed');
    add('Wall & View', 'View: Switch to Creator Mode', () => setStudioMode('creator'), creator ? 'Current' : 'Alt+M');
    add('Wall & View', 'View: Switch to Engineer Mode', () => setStudioMode('engineer'), creator ? 'Alt+M' : 'Current');
    add('Wall & View', 'Backdrop: None', () => setFloorBackdrop('none'), floorBackdrop === 'none' ? 'Current' : '');
    Object.entries(FLOOR_BACKDROPS).forEach(([kind, { name, widthCm }]) => {
        add('Wall & View', `Backdrop: ${name} (${widthCm} cm)`, () => setFloorBackdrop(kind), floorBackdrop === kind ? 'Current' : '');
    });

    presetButtons.forEach(button => add('Lighting & Paint', `Preset: ${button.textContent.trim()}`, () => button.click()));
    WALL_PAINTS.forEach(paint => {
        add('Lighting & Paint', `Wall Paint: ${paint.label}`, () => setWallPaint(paint.id), paint.id === wallPaint ? 'Current' : '');
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

// The palette closes first, so a command that opens a dialog of its own finds no modal in the way
function runCommand(index) {
    const command = palette.matches[index];
    if (!command) return;
    commandPalette.close();
    releasePaletteFocus();
    command.run();
}

function openCommandPalette() {
    if (isModalOpen() || isPointerBusy()) return;
    closeContextMenu();
    palette.commands = buildCommands();
    commandSearchInput.value = '';
    renderCommandList();
    commandPalette.showModal();
    commandSearchInput.focus();
}

function toggleCommandPalette() {
    if (commandPalette.open) commandPalette.close();
    else openCommandPalette();
}

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

commandPalette.addEventListener('close', releasePaletteFocus);
commandPaletteBtn.addEventListener('click', toggleCommandPalette);

function loadTemplate(key) {
    const template = LAYOUT_TEMPLATES[key];
    if (!template || isPointerBusy()) return;

    // Templates run through the same sanitizer as imports, which fills in catalog sizes, names and prices.
    // A template replaces the composition, guides included, and keeps the look: lighting and wall paint.
    const layout = normalizeLayout(template);
    selectedItemIds = [];
    applyLayoutSettings({ ...layout, wallPaint });
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

// Computed transforms always come back as matrix(a, b, c, d, e, f) or none
function parseMatrix(value) {
    const match = /matrix\(([^)]*)\)/.exec(value || '');
    return match ? match[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
}

// The wash is a clipped trapezoid fading from the item's LED color, read from the spotlight's ::after box.
// A turned spotlight rotates that box about the fixture center, so the same matrix and origin the CSS
// resolved are applied here and the trapezoid is drawn in the box's own coordinates.
function paintSpotlightCone(ctx, item, el, border) {
    const cone = getComputedStyle(el, '::after');
    const alpha = parseFloat(cone.opacity);
    if (!isAmbientMode || !isLedOn(item) || !(alpha > 0)) return;

    const width = parseFloat(cone.width);
    const height = parseFloat(cone.height);
    const points = parsePolygon(cone.clipPath, width, height);
    if (!points.length) return;

    const [originX, originY] = cone.transformOrigin.split(' ').map(parseFloat);
    const [r, g, b] = hexToRgb(ledColorOf(item));
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(SPOTLIGHT_CONE_FADE, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.save();
    ctx.translate(item.left + border + parseFloat(cone.left) + originX, item.top + border + parseFloat(cone.top) + originY);
    ctx.transform(...parseMatrix(cone.transform));
    ctx.translate(-originX, -originY);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function paintWallBackground(ctx) {
    const paint = wallPaintById(wallPaint);
    ctx.fillStyle = isAmbientMode ? paint.ambient : paint.daylight;
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

// Mirrors the cabinet seam on the .storage background; a cabinet on its side has a horizontal seam
function paintStorageSeam(ctx, item, border) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    if (isQuarterTurn(item)) {
        ctx.fillRect(item.left + border, item.top + item.height / 2 - 1, item.width - border * 2, 2);
    } else {
        ctx.fillRect(item.left + item.width / 2 - 1, item.top + border, 2, item.height - border * 2);
    }
}

// Mirrors the handle pair drawn by the .storage ::after. The bars are borders on whichever two sides
// the current rotation uses, so every side is read and painted on its own.
function paintStorageHandles(ctx, item, el, border) {
    const handles = getComputedStyle(el, '::after');
    const side = (name) => parseFloat(handles[`border${name}Width`]) || 0;
    const [leftBar, rightBar, topBar, bottomBar] = ['Left', 'Right', 'Top', 'Bottom'].map(side);
    const contentBox = handles.boxSizing !== 'border-box';
    const width = (parseFloat(handles.width) || 0) + (contentBox ? leftBar + rightBar : 0);
    const height = (parseFloat(handles.height) || 0) + (contentBox ? topBar + bottomBar : 0);
    const x = item.left + border + (parseFloat(handles.left) || 0);
    const y = item.top + border + (parseFloat(handles.top) || 0);

    ctx.fillStyle = handles.borderLeftColor;
    if (leftBar) ctx.fillRect(x, y, leftBar, height);
    if (rightBar) ctx.fillRect(x + width - rightBar, y, rightBar, height);
    ctx.fillStyle = handles.borderTopColor;
    if (topBar) ctx.fillRect(x, y, width, topBar);
    if (bottomBar) ctx.fillRect(x, y + height - bottomBar, width, bottomBar);
}

// Door clearances carry a corner-to-corner cross and windows a mullion cross, both on the background
function paintFeatureDetail(ctx, item, style, border) {
    const x = item.left + border;
    const y = item.top + border;
    const width = item.width - border * 2;
    const height = item.height - border * 2;
    const line = style.getPropertyValue('--feature-line').trim();
    const weight = parseFloat(style.getPropertyValue('--feature-weight')) || 1;

    ctx.save();
    if (item.type === 'door') {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.strokeStyle = line;
        ctx.lineWidth = weight;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        ctx.moveTo(x + width, y);
        ctx.lineTo(x, y + height);
        ctx.stroke();
    } else if (item.type === 'window') {
        ctx.fillStyle = line;
        ctx.fillRect(x + width / 2 - weight / 2, y, weight, height);
        ctx.fillRect(x, y + height / 2 - weight / 2, width, weight);
    }
    ctx.restore();
}

// Line breaks are read back from the rendered label one character at a time, so the export wraps
// exactly where the browser wrapped. Screen rects are divided by the fit scale to get wall pixels.
function paintNoteText(ctx, item, el, label, style) {
    const node = label.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const range = document.createRange();
    const origin = el.getBoundingClientRect().top;
    const lines = [];
    for (let index = 0; index < node.length; index++) {
        if (node.data[index] === '\n') continue;
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.height) continue;
        const line = lines.at(-1);
        if (line && Math.abs(rect.top - line.top) < 1) line.text += node.data[index];
        else lines.push({ top: rect.top, middle: (rect.top + rect.bottom) / 2, text: node.data[index] });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(item.left, item.top, item.width, item.height);
    ctx.clip();
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach(line => {
        ctx.fillText(line.text.trimEnd(), item.left + item.width / 2, item.top + (line.middle - origin) / viewScale);
    });
    ctx.restore();
}

function paintItemLabel(ctx, item, el) {
    const label = el.querySelector('.item-label');
    if (!label) return;

    const style = getComputedStyle(label);
    if (style.display === 'none') return;
    if (isNote(item)) {
        paintNoteText(ctx, item, el, label, style);
        return;
    }
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

    // A see-through fill (room features) must not show the border color through it, so the border is
    // painted as a ring there; opaque fills simply cover the inside of a full border-colored shape
    if (border > 0) {
        const seeThrough = (parseRgba(style.backgroundColor)?.a ?? 1) < 1;
        ctx.fillStyle = style.borderTopColor;
        traceShape(ctx, shape, 0);
        if (seeThrough) traceShape(ctx, shape, border, false);
        ctx.fill(seeThrough ? 'evenodd' : 'nonzero');
    }
    ctx.fillStyle = style.backgroundColor;
    traceShape(ctx, shape, border);
    ctx.fill();

    // Background layers, then inset shadows, then content, as CSS stacks them inside a box
    paintSheen(ctx, shape, border, style);
    if (item.type === 'storage') paintStorageSeam(ctx, item, border);
    if (item.type === 'door' || item.type === 'window') paintFeatureDetail(ctx, item, style, border);
    shadows.filter(shadow => shadow.inset).forEach(shadow => paintInsetShadow(ctx, shape, border, shadow, 1));

    if (item.type === 'storage') paintStorageHandles(ctx, item, el, border);
    if (['poster', 'corner-lamp', 'socket'].includes(item.type)) paintAfterLayer(ctx, item, el, border);
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
    // Hidden items stay in the plan but leave the picture, just as they leave the wall view
    wallItems.filter(item => !item.hidden).forEach(item => paintItem(ctx, item, brightness));
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

function toggleAmbientMode() {
    isAmbientMode = !isAmbientMode;
    wallCanvas.classList.toggle('daylight-mode', !isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !isAmbientMode);

    themeToggleBtn.textContent = isAmbientMode ? 'Ambient Mode: ON' : 'Daylight Grid: ON';
}

themeToggleBtn.addEventListener('click', toggleAmbientMode);

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

window.addEventListener('resize', closeContextMenu);

measureLabelMetrics();
loadState();
renderPlanner();
applyAtticSlope();
pushHistory();
