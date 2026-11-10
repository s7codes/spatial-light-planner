import {
    ATTIC_SIZE_LIMITS_CM, clamp, DEFAULT_ATTIC_HEIGHT_CM, DEFAULT_ATTIC_WIDTH_CM, DEFAULT_NOTE_TEXT, DEFAULT_POSTER_ART, DEFAULT_WALL_HEIGHT_CM, DEFAULT_WALL_PAINT, DEFAULT_WALL_WIDTH_CM,
    FEATURE_TYPES, FINISH_IDS, formatCurrency, GROUP_ID_PATTERN, GUIDE_ID_PATTERN, HISTORY_LIMIT, isFeature, isHexColor, isLedOn,
    ITEM_TYPES, MAX_DEPTH_CM, MAX_GUIDES,
    MAX_IMPORT_ITEMS, MAX_NAME_LENGTH, MERGE_WINDOW_MS, minSizeCm, NOTE_MAX_LENGTH, POSTER_ART_IDS, ROTATIONS,
    SAFE_ID_PATTERN, SCALE, toCmGrid, toFiniteNumber, toWallCm, WALL_HEIGHT_LIMITS_CM, WALL_PAINTS, WALL_WIDTH_LIMITS_CM
} from './constants.js';
import { atticSlopeToggle, CATALOG_DEFAULTS, redoBtn, undoBtn } from './dom.js';
import { applyAtticSlope, applyWallPaint, renderGuides, setWallDimensions } from '../ui/viewport-rulers.js';
import { renderPlanner, updateInspectorPanel } from '../ui/inspector-layers.js';
import { saveState } from '../io/projects-spec.js';

// A drag always moves the whole selection; a single item is simply a group of one
export const createIdleDragState = () => ({
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

export const createIdleResizeState = () => ({
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

export const createIdleCatalogDrag = () => ({
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

export const createIdleMarquee = () => ({
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

export const createIdleGuideDrag = () => ({
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

export const createIdlePan = () => ({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, pointerX: 0, pointerY: 0, frameId: 0 });

// Every binding more than one module reassigns lives here, so no module ever writes to an imported let
export const state = {
    isAmbientMode: true,
    // View states like the zoom: never saved, exported or undone, so every visit opens in Engineer Mode
    studioMode: 'engineer',
    floorBackdrop: 'none',
    floorBackdropAlign: 'center',
    // Kept in selection order; layer order comes from wallItems whenever it matters
    selectedItemIds: [],
    wallItems: [],
    // Reference guides: axis 'x' is a vertical line at x = cm, axis 'y' a horizontal one at y = cm
    wallGuides: [],
    wallPaint: DEFAULT_WALL_PAINT,

    // Index entries are { id, name, timestamp }; each layout sits in storage under its own key
    projects: [],

    wallWidthCm: DEFAULT_WALL_WIDTH_CM,
    wallHeightCm: DEFAULT_WALL_HEIGHT_CM,
    wallWidthPx: DEFAULT_WALL_WIDTH_CM * SCALE,
    wallHeightPx: DEFAULT_WALL_HEIGHT_CM * SCALE,
    // The slope cut-out in the top-right corner, kept with the layout even while the slope is off
    atticWidthCm: DEFAULT_ATTIC_WIDTH_CM,
    atticHeightCm: DEFAULT_ATTIC_HEIGHT_CM,
    viewScale: 1,
    // The view sits on top of the fit: viewScale = fitScale * userZoom, and the pan moves the wall's center
    userZoom: 1,
    panX: 0,
    panY: 0,
    spaceHeld: false,

    historyStack: [],
    historyIndex: -1,

    dragState: createIdleDragState(),
    resizeState: createIdleResizeState(),
    catalogDrag: createIdleCatalogDrag(),
    marquee: createIdleMarquee(),
    guideDrag: createIdleGuideDrag(),
    panState: createIdlePan(),

    // Kept in memory only: copies made here paste back here with their groups and stacking order
    clipboardState: { items: [], pasteCount: 0 },
    // Finish, backlight and print of one item, in memory only like the item clipboard
    styleClipboard: null,

    // Power routing is a drafting aid like the rulers: kept out of the layout, the history and the PNG
    powerRoutingOn: false,

    // A display preference kept in its own storage key, never in the layout, the history or the JSON
    currency: 'USD',

    // Quote session details: in memory only, never in the layout, the history, the JSON or a share link
    promoCode: null,
    quoteClient: ''
};

// Prices are stored in USD and shown in the picked currency
export const formatMoney = (value) => formatCurrency(value, state.currency);

let idCounter = 0;
let lastHistoryPush = { mergeKey: null, time: 0 };

export const isPointerBusy = () =>
    state.dragState.isDragging || state.resizeState.active || state.catalogDrag.active ||
    state.marquee.active || state.guideDrag.active || state.panState.active;

export const isDefaultView = () => state.userZoom === 1 && state.panX === 0 && state.panY === 0;
export const isCreatorMode = () => state.studioMode === 'creator';
export const isSelected = (itemId) => state.selectedItemIds.includes(itemId);
export const getSelectedItems = () => state.wallItems.filter(item => state.selectedItemIds.includes(item.id));

// The single-item editors only apply when exactly one item is selected
export const getSelectedItem = () => (state.selectedItemIds.length === 1 ? state.wallItems.find(i => i.id === state.selectedItemIds[0]) : undefined);
export const createItemId = () => `item-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
export const createGroupId = () => `group-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
export const createGuideId = () => `guide-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

// Files and saves are trusted for nothing: guides must lie on the wall, one per line, at most twelve
export function sanitizeGuides(raw, widthCm, heightCm) {
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

// Storage can be full, blocked or switched off; the planner keeps working in memory either way
export function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Nothing left to clean up when storage is unavailable
    }
}

export const createProjectId = () => `project-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export function sanitizeItem(raw, usedIds, bounds) {
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
    // Files from before v2.4 carry no depth, so every item takes its catalog extrusion
    const rawDepth = toFiniteNumber(raw.depth);
    const depth = !feature && rawDepth !== null && rawDepth >= 0
        ? Math.min(Math.round(rawDepth), MAX_DEPTH_CM)
        : defaults.depth;
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
        depth,
        finish: feature ? null : (FINISH_IDS.includes(raw.finish) ? raw.finish : defaults.finish),
        ledEnabled: !feature && (typeof raw.ledEnabled === 'boolean' ? raw.ledEnabled : true),
        locked: raw.locked === true,
        // Files from before v1.3 have no per-item color, so those items follow the global lighting
        itemLedColor: !feature && isHexColor(raw.itemLedColor) ? raw.itemLedColor.toLowerCase() : null,
        rotation,
        // Group ids only survive if at least two items share them; normalizeGroups checks that afterwards
        groupId: typeof raw.groupId === 'string' && GROUP_ID_PATTERN.test(raw.groupId) ? raw.groupId : null,
        hidden: raw.hidden === true,
        ...(raw.type === 'note' && { text: sanitizeNoteText(raw.text) }),
        // Files from before v2.2 carry no artwork, so their posters keep the original noir print
        ...(raw.type === 'poster' && { posterArt: POSTER_ART_IDS.includes(raw.posterArt) ? raw.posterArt : DEFAULT_POSTER_ART })
    };
}

// Notes keep line breaks but drop every other control character; an empty note gets the prompt back
export function sanitizeNoteText(raw) {
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
export function normalizeGroups(items) {
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
export function normalizeLayout(data) {
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
        // Files from before v2.6 only carry the flag, and their slope was always 90 x 90 cm
        atticWidthCm: toWallCm(data.atticWidthCm, ATTIC_SIZE_LIMITS_CM, DEFAULT_ATTIC_WIDTH_CM),
        atticHeightCm: toWallCm(data.atticHeightCm, ATTIC_SIZE_LIMITS_CM, DEFAULT_ATTIC_HEIGHT_CM),
        accentColor: isHexColor(data.accentColor) ? data.accentColor.toLowerCase() : null,
        cornerColor: isHexColor(data.cornerColor) ? data.cornerColor.toLowerCase() : null,
        brightness: brightness === null ? null : clamp(Math.round(brightness), 0, 100),
        // Files from before v1.7 have neither, so they load on the original wall with no guides
        wallPaint: WALL_PAINTS.some(paint => paint.id === data.wallPaint) ? data.wallPaint : DEFAULT_WALL_PAINT,
        wallGuides: sanitizeGuides(data.wallGuides, widthCm, heightCm)
    };
}

export const serializeHistoryState = () => JSON.stringify({
    items: state.wallItems,
    atticSlope: atticSlopeToggle.checked,
    atticWidthCm: state.atticWidthCm,
    atticHeightCm: state.atticHeightCm,
    wallWidthCm: state.wallWidthCm,
    wallHeightCm: state.wallHeightCm,
    wallGuides: state.wallGuides,
    wallPaint: state.wallPaint
});

export function updateHistoryButtons() {
    undoBtn.disabled = state.historyIndex <= 0;
    redoBtn.disabled = state.historyIndex >= state.historyStack.length - 1;
}

export function pushHistory(mergeKey = null) {
    const snapshot = serializeHistoryState();
    if (state.historyStack[state.historyIndex] === snapshot) return;

    const now = performance.now();
    // Held arrow nudges or rapid spinner clicks on the wall size fold into a single undo step
    const canMerge = mergeKey !== null &&
        mergeKey === lastHistoryPush.mergeKey &&
        now - lastHistoryPush.time < MERGE_WINDOW_MS &&
        state.historyIndex === state.historyStack.length - 1;

    lastHistoryPush = { mergeKey, time: now };

    if (canMerge) {
        state.historyStack[state.historyIndex] = snapshot;
    } else {
        state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
        state.historyStack.push(snapshot);
        if (state.historyStack.length > HISTORY_LIMIT) state.historyStack.shift();
        state.historyIndex = state.historyStack.length - 1;
    }

    updateHistoryButtons();
}

export function commitLayoutChange() {
    pushHistory();
    saveState();
}

export function restoreHistoryStep(step) {
    const target = state.historyIndex + step;
    if (isPointerBusy() || target < 0 || target >= state.historyStack.length) return;

    state.historyIndex = target;
    lastHistoryPush = { mergeKey: null, time: 0 };

    const snapshot = JSON.parse(state.historyStack[state.historyIndex]);
    setWallDimensions(snapshot.wallWidthCm, snapshot.wallHeightCm);
    state.wallItems = snapshot.items;
    atticSlopeToggle.checked = snapshot.atticSlope;
    state.atticWidthCm = snapshot.atticWidthCm;
    state.atticHeightCm = snapshot.atticHeightCm;
    state.wallGuides = snapshot.wallGuides;
    applyWallPaint(snapshot.wallPaint);
    renderGuides();
    state.selectedItemIds = state.selectedItemIds.filter(id => state.wallItems.some(item => item.id === id));

    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
    updateHistoryButtons();
    saveState();
}

export const undo = () => restoreHistoryStep(-1);
export const redo = () => restoreHistoryStep(1);

export const groupMembers = (groupId) => state.wallItems.filter(item => item.groupId === groupId);

// Picking one member of a group picks the whole group
export function expandGroups(ids) {
    const groupIds = new Set(state.wallItems.filter(item => ids.includes(item.id) && item.groupId).map(item => item.groupId));
    return [...new Set([...ids, ...state.wallItems.filter(item => groupIds.has(item.groupId)).map(item => item.id)])];
}

// Bottom-up blocks of the stack: a lone item, or a whole group, whose members always sit together
export function getUnits() {
    const units = [];
    state.wallItems.forEach(item => {
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
export function groupLabels() {
    const labels = new Map();
    state.wallItems.forEach(item => {
        if (item.groupId && !labels.has(item.groupId)) labels.set(item.groupId, `Group ${labels.size + 1}`);
    });
    return labels;
}

// The id of the group when the selection is exactly one complete group
export function selectedGroupId() {
    const items = getSelectedItems();
    const groupId = items[0]?.groupId;
    const whole = groupId && items.every(item => item.groupId === groupId) && groupMembers(groupId).length === items.length;
    return whole ? groupId : null;
}

// The style source is the first non-feature item in selection order, so Shift-click order picks it
export const styleSourceItem = () => state.selectedItemIds
    .map(id => state.wallItems.find(item => item.id === id))
    .find(item => item && !isFeature(item));

export const styleTargets = () => getSelectedItems().filter(item => !item.locked && !isFeature(item));
export const canCopyStyle = () => Boolean(styleSourceItem());
export const canPasteStyle = () => state.styleClipboard !== null && styleTargets().length > 0;

export const captureItemStyle = (item) => ({
    finish: item.finish,
    ledEnabled: isLedOn(item),
    itemLedColor: item.itemLedColor,
    posterArt: item.posterArt || DEFAULT_POSTER_ART
});

// Returns whether anything changed; the print only reaches posters
export function applyItemStyle(item, style) {
    const next = {
        finish: style.finish,
        ledEnabled: style.ledEnabled,
        itemLedColor: style.itemLedColor,
        ...(item.type === 'poster' && { posterArt: style.posterArt })
    };
    const changed = Object.keys(next).filter(key => item[key] !== next[key]);
    changed.forEach(key => { item[key] = next[key]; });
    return changed.length > 0;
}

export const canGroup = () => state.selectedItemIds.length > 1 && !selectedGroupId();
export const canUngroup = () => getSelectedItems().some(item => item.groupId);
