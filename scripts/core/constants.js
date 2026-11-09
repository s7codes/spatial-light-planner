export const SCALE = 2.5; // 1 cm = 2.5 px
export const CM_STEP_PX = SCALE;
export const SNAP_STEP_PX = 5 * SCALE; // 5 cm grid step (12.5 px)
export const ALIGN_THRESHOLD_PX = SCALE; // 1 cm magnet range
export const ATTIC_SLOPE_PX = 90 * SCALE; // 90 x 90 cm roof cut-out (225 px)
export const DUPLICATE_OFFSET_PX = 4 * SCALE; // 4 cm (10 px)
export const MIN_WIDTH_CM = 8;
export const MIN_HEIGHT_CM = 4;
export const EPSILON = 1e-6;

export const DEFAULT_WALL_WIDTH_CM = 300;
export const DEFAULT_WALL_HEIGHT_CM = 250;
export const WALL_WIDTH_LIMITS_CM = [150, 400];
export const WALL_HEIGHT_LIMITS_CM = [150, 300];
export const WALL_BORDER_PX = 2; // keep in sync with the .wall border
export const CANVAS_PADDING_PX = 24;
export const ZOOM_LIMITS = [0.5, 2.5];
export const ZOOM_BUTTON_STEP = 0.25;
export const ZOOM_WHEEL_STEP = 0.1;
export const PAN_KEEP_PX = 80; // this much of the wall always stays inside the canvas
export const RULER_PIN_PX = 4; // a ruler whose wall edge has left the canvas parks this far inside it
export const SHARE_HASH_PREFIX = '#plan=';
export const MAX_SHARE_CHARS = 2 * 1024 * 1024;
export const SHARE_LABEL = 'Copy Share Link';

// Before v1.6 a single layout lived under the legacy key. Projects now keep a small index plus one
// key per layout, so autosave only ever rewrites the layout that is open.
export const LEGACY_STORAGE_KEY = 'spatial_studio_state_v1';
export const PROJECT_INDEX_KEY = 'spatial_studio_projects_v1';
export const PROJECT_LAYOUT_PREFIX = 'spatial_studio_project_v1_';
export const PROJECT_ID_PATTERN = /^project-[a-z0-9-]{1,40}$/i;
export const MAX_PROJECTS = 24;
export const PROJECT_NAME_LENGTH = 60;
export const EXPORT_VERSION = '1.7';
export const EXPORT_FILENAME = 'spatial-studio-layout.json';
export const CSV_FILENAME = 'spatial-studio-specs.csv';
export const PNG_FILENAME = 'spatial-studio-plan.png';
export const PNG_PIXEL_RATIO = 2;
export const SHADOW_SHIFT_PX = 10000;
export const CORNER_GLOW_ALPHA = 0.45; // mirrors the .corner-led-glow opacity factor
export const SPOTLIGHT_CONE_FADE = 0.85; // mirrors the last stop of the .spotlight::after gradient

// Tones meant for a dark room, each with a pale counterpart so the Daylight Grid stays readable.
// Charcoal is the original wall, so older layouts and the default look are unchanged.
export const WALL_PAINTS = [
    { id: 'charcoal', label: 'Charcoal', ambient: '#1c1f26', daylight: '#e5e7eb' },
    { id: 'greige', label: 'Greige', ambient: '#35312c', daylight: '#e9e4dc' },
    { id: 'sage', label: 'Sage', ambient: '#28312b', daylight: '#dfe7e0' },
    { id: 'navy', label: 'Navy', ambient: '#182133', daylight: '#dce3ee' },
    { id: 'concrete', label: 'Concrete', ambient: '#2e3033', daylight: '#e3e4e6' }
];

export const DEFAULT_WALL_PAINT = 'charcoal';
export const DAYLIGHT_GRID_PX = 10 * SCALE;

export const COPY_LABEL = 'Copy as Markdown';
export const CSV_LABEL = 'Export CSV';
export const RULER_SIZE_PX = 16;
export const RULER_GAP_PX = 4;
export const RULER_TICK_CM = 10;
export const RULER_LABEL_CM = 50;
export const RULER_LABEL_ROOM_PX = 24;
export const MAX_GUIDES = 12;
export const GUIDE_ID_PATTERN = /^guide-[a-z0-9-]{1,40}$/i;
export const GUIDE_TAG_ROOM_PX = 48;
export const MOUNTING_NOTE = "Distances in cm from the left wall edge, the ceiling, and the floor to the item's left, top, and bottom edges.";
export const LOCK_ICON_HTML = '<span class="lock-icon" aria-hidden="true"></span>';

export const HISTORY_LIMIT = 30;
export const MERGE_WINDOW_MS = 600;
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_ITEMS = 200;
export const MAX_NAME_LENGTH = 40;

export const LABEL_GAP_PX = 3;
export const LABEL_SLIDE_STEP_PX = 4;
export const ITEM_LABEL_INSET_PX = 3; // clearance between an item label and the wall edge
export const CATALOG_DRAG_THRESHOLD_PX = 6;
export const MARQUEE_THRESHOLD_PX = 3;
export const PRESS_TRAVEL_PX = 3; // below this a press on a group member is a click, not a move
export const MENU_EDGE_PX = 8;
export const LONG_RUN_CM = 250; // longer runs usually need an extension lead
export const POWER_IDLE_TEXT = 'Traces each lit item to its nearest socket';
export const TINY_ITEM_PX = 12 * SCALE; // up to 12 x 12 cm the resize grips sit outside the item
export const STUDIO_MODES = ['engineer', 'creator'];

export const RESIZE_HANDLES_HTML = ['e', 's', 'se']
    .map(dir => `<span class="resize-handle handle-${dir}" data-handle="${dir}" aria-hidden="true"></span>`)
    .join('');

// Room features are free, unfinished and unlit. Doors, windows and sockets are also no-build zones,
// while a text note is a plain annotation that never collides with anything.
export const OBSTACLE_TYPES = ['socket', 'door', 'window'];
export const FEATURE_TYPES = [...OBSTACLE_TYPES, 'note'];
export const ITEM_TYPES = ['shelf', 'cube', 'storage', 'poster', 'spotlight', 'corner-lamp', ...FEATURE_TYPES];
export const ROTATIONS = [0, 90, 180, 270];
export const DEFAULT_NOTE_TEXT = 'Double-click to edit';
export const NOTE_MAX_LENGTH = 160;
export const SAFE_ID_PATTERN = /^item-[a-z0-9-]{1,40}$/i;

// Group ids end up inside attribute selectors and layer keys, so only plain word characters pass
export const GROUP_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export const FINISHES = [
    { id: 'walnut', label: 'Walnut' },
    { id: 'oak', label: 'Oak' },
    { id: 'black', label: 'Black' },
    { id: 'white', label: 'White' }
];

export const FINISH_IDS = FINISHES.map(f => f.id);

export const NUDGE_KEYS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};

// Shortcut guards only care about fields where Ctrl+Z means "undo my typing"
export const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file'];

export const defaultItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut', ledEnabled: true, locked: false, itemLedColor: null, rotation: 0, groupId: null, hidden: false },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black', ledEnabled: true, locked: false, itemLedColor: null, rotation: 0, groupId: null, hidden: false }
];

export const templateItem = (type, leftCm, topCm, finish) => ({ type, left: leftCm * SCALE, top: topCm * SCALE, finish });

// Positions are in cm. Every template is collision-free, and Attic Corner stays clear of the slope.
export const LAYOUT_TEMPLATES = {
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

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
export const quantize = (px, step) => Math.round(px / step) * step;
export const toCm = (px) => Math.round(px / SCALE);
export const isWholeCm = (px) => Math.abs(px / SCALE - Math.round(px / SCALE)) < EPSILON;
export const formatOffset = (item) => `${toCm(item.left)} cm (X), ${toCm(item.top)} cm (Y)`;
export const formatFootprint = (box) => `${toCm(box.width)} x ${toCm(box.height)} cm`;
export const wallPaintById = (id) => WALL_PAINTS.find(paint => paint.id === id) || WALL_PAINTS[0];
export const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const isObstacle = (item) => OBSTACLE_TYPES.includes(item.type);
export const isFeature = (item) => FEATURE_TYPES.includes(item.type);
export const isNote = (item) => item.type === 'note';
export const isLedOn = (item) => !isFeature(item) && item.ledEnabled !== false;

// Hidden items and notes take no part in collisions, the slope check or the magnet
export const isSolid = (item) => !item.hidden && !isNote(item);
export const isQuarterTurn = (item) => item.rotation === 90 || item.rotation === 270;

// Width and height always describe the footprint on the wall, so a quarter turn swaps which side
// the minimum width and minimum height apply to
export const minSizeCm = (rotation) => (rotation === 90 || rotation === 270
    ? [MIN_HEIGHT_CM, MIN_WIDTH_CM]
    : [MIN_WIDTH_CM, MIN_HEIGHT_CM]);

export function getBounds(items) {
    const left = Math.min(...items.map(i => i.left));
    const top = Math.min(...items.map(i => i.top));
    const right = Math.max(...items.map(i => i.left + i.width));
    const bottom = Math.max(...items.map(i => i.top + i.height));
    return { left, top, width: right - left, height: bottom - top };
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

// A typed "?" belongs to any form control that has focus, so the guide shortcut stays out of all of them
export const isFormField = (el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;

export const isTextEntry = (el) =>
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.includes(el.type));

// Base64URL over UTF-8 bytes, so names and notes in any script survive the trip through a URL
export function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    // Chunked, since spreading a long byte array into fromCharCode can overrun the argument limit
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded) {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Not Base64URL.');
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

export function toFiniteNumber(value) {
    const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

// Rounds a px value to whole centimeters, then clamps it to [minCm, maxCm]
export function toCmGrid(px, minCm, maxCm) {
    return clamp(Math.round(px / SCALE), minCm, maxCm) * SCALE;
}

export function toWallCm(value, [min, max], fallback) {
    const cm = toFiniteNumber(value);
    return cm === null ? fallback : clamp(Math.round(cm), min, max);
}

// Floor references are front elevations in cm from the top-left corner of the piece, which stands on the
// floor line. A view aid like the cable runs, so it never reaches the layout, the history or the PNG.
export const backdropRect = (x, y, w, h, r = 0, kind = 'shape') =>
    `<rect class="backdrop-${kind}" x="${x * SCALE}" y="${y * SCALE}" width="${w * SCALE}" height="${h * SCALE}" rx="${r * SCALE}" />`;

export const backdropLine = (x1, y, x2) => `<path class="backdrop-detail" d="M ${x1 * SCALE} ${y * SCALE} H ${x2 * SCALE}" />`;

export const FLOOR_BACKDROPS = {
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

export const countLabel = (count) => `${count} item${count === 1 ? '' : 's'}`;

export const ARRANGE_ACTIONS = [
    { id: 'align-left', label: 'Align Left', hint: 'line up the left edges' },
    { id: 'align-center', label: 'Align Center', hint: 'center horizontally on the selection' },
    { id: 'align-right', label: 'Align Right', hint: 'line up the right edges' },
    { id: 'distribute-h', label: 'Distribute Horizontally', hint: 'equal gaps from left to right', distribute: true },
    { id: 'align-top', label: 'Align Top', hint: 'line up the top edges' },
    { id: 'align-middle', label: 'Align Middle', hint: 'center vertically on the selection' },
    { id: 'align-bottom', label: 'Align Bottom', hint: 'line up the bottom edges' },
    { id: 'distribute-v', label: 'Distribute Vertically', hint: 'equal gaps from top to bottom', distribute: true }
];

export const formatPrice = (value) => `$${Math.round(value * 100) / 100}`;

export const formatMoney = (value) => `$${value.toFixed(2)}`;
export const finishLabel = (id) => (FINISHES.find(f => f.id === id) || { label: id }).label;
export const markdownCell = (value) => String(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|');

// RFC 4180: a field holding a comma, quote or line break is quoted and its quotes are doubled.
// Text that starts like a formula gets a leading apostrophe so a spreadsheet shows it instead of running it.
export function csvField(value) {
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (cells) => cells.map(csvField).join(',');
