import {
    ALIGN_THRESHOLD_PX, BACKORDER_LEAD_DAYS, clamp, CM_STEP_PX, EPSILON, escapeHtml, FLOOR_BACKDROPS, getBounds,
    isFeature, ITEM_STOCK_LIMITS, isLedOn, isObstacle, isQuarterTurn, isSolid, isWholeCm, LONG_RUN_CM, SCALE, toCm
} from './constants.js';
import { alignLayer, atticSlopeToggle, wallItemsLayer } from './dom.js';
import { getSelectedItems, groupMembers, isCreatorMode, isSelected, state } from './state.js';

const alignLinePool = [];

export function isOverlapping(a, b) {
    return (
        a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top
    );
}

const overlapsAny = (item, accept) =>
    state.wallItems.some(other => other.id !== item.id && accept(other) && isOverlapping(item, other));

// Two room features may share space (a socket beside a door frame); every other solid overlap is a conflict
const clashesWith = (item, other) => isSolid(other) && !(isObstacle(item) && isObstacle(other));

export function hasOverlap(item) {
    return isSolid(item) && overlapsAny(item, other => clashesWith(item, other));
}

export const collisionTargets = (item) => (isSolid(item)
    ? state.wallItems.filter(other => other.id !== item.id && clashesWith(item, other) && isOverlapping(item, other))
    : []);

// Only the pieces under the pointer reveal what they hit; resting overlaps stay plain red
function movingItemIds() {
    if (state.dragState.isDragging && !state.dragState.blocked) return state.dragState.excludedIds;
    if (state.resizeState.active) return new Set([state.resizeState.itemId]);
    return null;
}

export const overlapsFurniture = (item) =>
    isSolid(item) && !isFeature(item) && overlapsAny(item, other => isSolid(other) && !isFeature(other));

export const blocksRoomFeature = (item) =>
    isSolid(item) && overlapsAny(item, other => isSolid(other) && isObstacle(item) !== isObstacle(other));

// The slope edge runs from (wallWidthPx - W, 0) down to (wallWidthPx, H). For an axis-aligned box the
// top-right corner is the point that reaches furthest past that line, so testing it alone is exact.
// The comparison is cross-multiplied, which stays exact on the half-pixel grid for any W:H ratio.
// Doors and windows are cut into the wall itself, so the slope never flags them.
export function intrudesAtticSlope(item) {
    if (!atticSlopeToggle.checked || isFeature(item) || item.hidden) return false;

    const slopeW = state.atticWidthCm * SCALE;
    const slopeH = state.atticHeightCm * SCALE;
    const reach = Math.min(item.left + item.width - (state.wallWidthPx - slopeW), slopeW);
    return reach > 0 && item.top * slopeW < reach * slopeH;
}

export function isColliding(item) {
    return hasOverlap(item) || intrudesAtticSlope(item);
}

export function updateCollisionStates() {
    const moving = movingItemIds();
    const xrayIds = new Set();
    const elements = [...wallItemsLayer.querySelectorAll('.wall-item')];
    elements.forEach(el => {
        const item = state.wallItems.find(i => i.id === el.dataset.id);
        if (!item) return;
        const colliding = isColliding(item);
        el.classList.toggle('colliding', colliding);
        if (colliding && moving?.has(item.id)) {
            collisionTargets(item).forEach(other => { if (!moving.has(other.id)) xrayIds.add(other.id); });
        }
    });
    elements.forEach(el => el.classList.toggle('is-xray-target', xrayIds.has(el.dataset.id)));
}

// The excluded ids are the selection itself, so a group measures only to items outside it
export function findNeighborGaps(item, excludedIds) {
    const right = item.left + item.width;
    const bottom = item.top + item.height;
    const nearest = {};

    const consider = (side, gap, other) => {
        if (!nearest[side] || gap < nearest[side].gap) nearest[side] = { gap, other };
    };

    state.wallItems.forEach(other => {
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
export function pickOuterEdge(near, far, from, limit) {
    const preferNear = from - near >= far - from;
    const first = preferNear ? near : far;
    const second = preferNear ? far : near;
    return first > 0 && first < limit ? first : second;
}

export function getAlignTargets(excludedIds, axis) {
    const targets = axis === 'x' ? [{ value: state.wallWidthPx / 2, other: null }] : [];
    // A reference guide is a full-height (or full-width) line, so it snaps like the wall center does.
    // Creator Mode hides the guides, and a line nobody can see should not tug at anything.
    if (!isCreatorMode()) {
        state.wallGuides.forEach(guide => {
            if (guide.axis === axis) targets.push({ value: guide.cm * SCALE, other: null });
        });
    }
    state.wallItems.forEach(other => {
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
export function snapAxis(item, axis, start, targets) {
    const size = axis === 'x' ? item.width : item.height;
    const limit = (axis === 'x' ? state.wallWidthPx : state.wallHeightPx) - size;
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

export function collectAlignLines(item, axis, targets) {
    const start = axis === 'x' ? item.left : item.top;
    const size = axis === 'x' ? item.width : item.height;
    const fullSpan = [0, axis === 'x' ? state.wallHeightPx : state.wallWidthPx];
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
export function renderAlignGuides(lines) {
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

const boxEdges = (box) => ({ left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height });

// Figma's rules: boxes apart on an axis get one line across the gap, drawn through their shared span
// or, when they are also apart on the other axis, through the selection center with a dashed extension
// carrying the hovered edge out to it. Boxes that intersect (or nest, like the wall) get a line between
// each pair of matching edges instead.
export function measureSegments(selection, target) {
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

const boxCenter = (item) => ({ x: item.left + item.width / 2, y: item.top + item.height / 2 });

// Every visible lit item takes the socket with the shortest center-to-center Manhattan run. On a tie
// the socket lower in the layer stack wins, so the choice never flickers during a drag.
export function planPowerRoutes() {
    const visible = state.wallItems.filter(item => !item.hidden);
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

const LED_WATTS_PER_M = 14.4;
const FIXED_LIGHT_WATTS = { spotlight: 5, lightbar: 9, 'corner-lamp': 20 };

// Shelves and storage carry a strip along their long catalog side, cubes and posters one around the frame
export function lightWatts(item) {
    if (item.type in FIXED_LIGHT_WATTS) return FIXED_LIGHT_WATTS[item.type];
    const [widthCm, heightCm] = [item.width, item.height].map(toCm);
    const stripCm = item.type === 'cube' || item.type === 'poster'
        ? (widthCm + heightCm) * 2
        : (isQuarterTurn(item) ? heightCm : widthCm);
    return (stripCm / 100) * LED_WATTS_PER_M;
}

// Lit, visible items only, scaled by the master brightness. Exactly 4 or 12 W/m2 counts as Cozy.
export function estimateIllumination(brightnessPercent) {
    const fullWatts = state.wallItems
        .filter(item => !item.hidden && isLedOn(item))
        .reduce((sum, item) => sum + lightWatts(item), 0);
    const watts = fullWatts * clamp(Number(brightnessPercent) || 0, 0, 100) / 100;
    const areaM2 = (state.wallWidthCm * state.wallHeightCm) / 10000;
    const density = watts / areaM2;
    const label = density < 4 ? 'Dim / Accent' : density <= 12 ? 'Cozy / Balanced' : 'Bright / Task';
    return { watts, areaM2, density, label, text: `${label} (${density.toFixed(1)} W/m\u00B2)` };
}

export function powerSummary({ powered, sockets, routes }) {
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
export function powerRouteMarkup(route) {
    const { item, socket, from, to, lengthCm } = route;
    const flag = lengthCm > LONG_RUN_CM ? ' is-long-run' : '';
    const vertical = Math.abs(to.y - from.y) >= Math.abs(to.x - from.x);
    const pillX = clamp(vertical ? from.x : (from.x + to.x) / 2, 24, state.wallWidthPx - 24);
    const pillY = clamp(vertical ? (from.y + to.y) / 2 : to.y, 9, state.wallHeightPx - 9);
    const ids = `data-item-id="${escapeHtml(item.id)}" data-socket-id="${escapeHtml(socket.id)}"`;
    return {
        path: `<path class="power-route${flag}" ${ids} data-length="${lengthCm}" d="M ${from.x} ${from.y} V ${to.y} H ${to.x}" />`,
        pill: `<span class="power-badge${flag}" ${ids} style="left: ${pillX}px; top: ${pillY}px;">${lengthCm} cm</span>`
    };
}

// A block of copies that would newly cut into the slope slides left or down, a centimeter at a time,
// to the nearest clear spot, the way a group drag refuses new intrusions. A single copy may land in
// the slope and is flagged red, like a single dragged item.
export function slopeClearOffset(sources, box, dx, dy) {
    const watched = sources.filter(source => !intrudesAtticSlope(source));
    const intrudes = (x, y) => watched.some(source => intrudesAtticSlope({ ...source, left: source.left + x, top: source.top + y }));
    if (sources.length < 2 || !intrudes(dx, dy)) return [dx, dy];

    for (let step = CM_STEP_PX; step <= Math.max(state.wallWidthPx, state.wallHeightPx); step += CM_STEP_PX) {
        const left = dx - step;
        const down = dy + step;
        if (box.left + left >= 0 && !intrudes(left, dy)) return [left, dy];
        if (box.top + box.height + down <= state.wallHeightPx && !intrudes(dx, down)) return [dx, down];
    }
    return [dx, dy];
}

// A quarter turn swaps the footprint, so the swapped box must still fit inside the wall
export const fitsTurned = (box) => box.height <= state.wallWidthPx && box.width <= state.wallHeightPx;

// Turns the item clockwise about its center. Width and height swap so collisions, the marquee and
// wall clamping keep working on a plain axis-aligned box. When the center offset lands on a half
// centimeter, the even and odd turns round in opposite directions, so a full turn returns home.
export function rotateItem(item) {
    const widthCm = toCm(item.width);
    const heightCm = toCm(item.height);
    const roundShift = item.rotation % 180 === 0 ? Math.floor : Math.ceil;
    const leftCm = toCm(item.left) + roundShift((widthCm - heightCm) / 2);
    const topCm = toCm(item.top) + roundShift((heightCm - widthCm) / 2);

    item.width = heightCm * SCALE;
    item.height = widthCm * SCALE;
    item.left = clamp(leftCm, 0, state.wallWidthCm - heightCm) * SCALE;
    item.top = clamp(topCm, 0, state.wallHeightCm - widthCm) * SCALE;
    item.rotation = (item.rotation + 90) % 360;
}

// A group turns as one rigid block about its own center. Members keep their places relative to the
// box, so the half-centimeter rounding happens once for the whole group and never pulls it apart.
export function rotateGroup(members) {
    const box = getBounds(members);
    const [boxLeft, boxTop, boxWidth, boxHeight] = [box.left, box.top, box.width, box.height].map(toCm);
    const roundShift = members[0].rotation % 180 === 0 ? Math.floor : Math.ceil;
    const left = clamp(boxLeft + roundShift((boxWidth - boxHeight) / 2), 0, state.wallWidthCm - boxHeight);
    const top = clamp(boxTop + roundShift((boxHeight - boxWidth) / 2), 0, state.wallHeightCm - boxWidth);

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
export function rotationUnits() {
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

export const canRotateUnit = (unit) => unit.every(item => !item.locked) && fitsTurned(unit.length === 1 ? unit[0] : getBounds(unit));
export const canRotateSelection = () => rotationUnits().some(canRotateUnit);

// Align and Distribute use the rotation units: a fully selected group moves as one rigid block and any
// other selected item on its own. Locked units hold still but still count toward the selection box,
// so they work as anchors.
export function arrangeUnits() {
    return rotationUnits().map(items => ({ items, box: getBounds(items), movable: items.every(item => !item.locked) }));
}

export const canAlignSelection = (units = arrangeUnits()) => units.length > 1 && units.some(unit => unit.movable);
export const canDistributeSelection = (units = arrangeUnits()) => units.filter(unit => unit.movable).length > 2;

export const ALIGN_EDGES = {
    left: { axis: 'x', at: 0 },
    center: { axis: 'x', at: 0.5 },
    right: { axis: 'x', at: 1 },
    top: { axis: 'y', at: 0 },
    middle: { axis: 'y', at: 0.5 },
    bottom: { axis: 'y', at: 1 }
};

export const axisKeys = (axis) => (axis === 'x' ? ['left', 'width'] : ['top', 'height']);

// Moving toward the slope only ever deepens an intrusion, so the clear offsets form one run that
// starts at zero. Stepping back from the target a centimeter at a time finds the farthest clear spot.
// As in a group drag, only pieces that start clear of the slope are held to it.
export function slopeSafeOffset(items, key, offset) {
    const watched = items.filter(item => !intrudesAtticSlope(item));
    const intrudesAt = (shift) => watched.some(item => intrudesAtticSlope({ ...item, [key]: item[key] + shift }));
    let shift = offset;
    while (Math.sign(shift) === Math.sign(offset) && Math.abs(shift) > EPSILON && intrudesAt(shift)) {
        shift -= Math.sign(offset) * CM_STEP_PX;
    }
    return Math.abs(shift) < EPSILON || Math.sign(shift) !== Math.sign(offset) ? 0 : shift;
}

// A horizontal mirror turns a right-facing quarter turn into a left-facing one; 0 and 180 look the same
const mirroredRotation = (rotation) => (rotation === 90 ? 270 : rotation === 270 ? 90 : rotation);

// Mirrors units across the vertical line whose doubled position is axisSum: each piece lands at
// axisSum minus its right edge, so a group keeps its mirrored shape. The unit is flipped inside its own
// box first, then slides as one block; a unit that would newly cut into the slope steps back toward
// where it was, as with Align, and stays as it was when no step is clear.
export function mirrorUnits(units, axisSum) {
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

export const canFlipSelection = () => state.selectedItemIds.length > 1 && arrangeUnits().some(unit => unit.movable);

export const canCenterSelection = () => arrangeUnits().some(unit => unit.movable);

// A group nudge clamps the shared offset to the group box, so members never squeeze against a wall
// edge out of formation. Like a group drag it refuses to push a member newly into the slope.
export function nudgeSelection(items, dx, dy) {
    const box = getBounds(items);
    const stepX = clamp(dx * SCALE, -box.left, state.wallWidthPx - box.left - box.width);
    const stepY = clamp(dy * SCALE, -box.top, state.wallHeightPx - box.top - box.height);
    const blocked = items.length > 1 && items.some(item =>
        !intrudesAtticSlope(item) && intrudesAtticSlope({ ...item, left: item.left + stepX, top: item.top + stepY }));
    if (blocked || (!stepX && !stepY)) return false;

    items.forEach(item => {
        item.left += stepX;
        item.top += stepY;
    });
    return true;
}

// Mirrors .floor-backdrop[data-align]: left and right stand the piece 16 px in from the wall edge
const BACKDROP_EDGE_INSET_PX = 16;

export function floorBackdropSpan() {
    const backdrop = FLOOR_BACKDROPS[state.floorBackdrop];
    if (!backdrop) return null;
    const width = backdrop.widthCm * SCALE;
    const left = state.floorBackdropAlign === 'left'
        ? BACKDROP_EDGE_INSET_PX
        : state.floorBackdropAlign === 'right'
            ? state.wallWidthPx - BACKDROP_EDGE_INSET_PX - width
            : (state.wallWidthPx - width) / 2;
    return { backdrop, left, right: left + width };
}

const placedOfType = (type) => state.wallItems.filter(item => item.type === type && !item.hidden).length;

export function describeItemStock(item) {
    if (!item || isFeature(item) || !Object.hasOwn(ITEM_STOCK_LIMITS, item.type)) return null;
    const limit = ITEM_STOCK_LIMITS[item.type];
    const placed = placedOfType(item.type);
    if (placed < limit) return { status: 'in-stock', placed, limit, text: `In Stock (${placed} of ${limit} used)` };
    if (placed === limit) return { status: 'low-stock', placed, limit, text: `Last Unit in Stock (${placed} of ${limit})` };
    return {
        status: 'backorder', placed, limit,
        text: `Backorder: +${BACKORDER_LEAD_DAYS} business days (${placed} placed, ${limit} in stock)`
    };
}

export function summarizeWallStock() {
    const backordered = Object.entries(ITEM_STOCK_LIMITS)
        .reduce((sum, [type, limit]) => sum + Math.max(0, placedOfType(type) - limit), 0);
    return backordered
        ? { status: 'backorder', backordered, text: `Availability: ${backordered} item(s) on backorder (ships in 5-7 business days)` }
        : { status: 'in-stock', backordered, text: 'Availability: All items in stock (ships in 1-2 business days)' };
}

export function describeErgonomics(item) {
    const bottomFromFloorCm = state.wallHeightCm - toCm(item.top + item.height);
    const centerFromFloorCm = Math.round(state.wallHeightCm - (item.top + item.height / 2) / SCALE);
    const span = floorBackdropSpan();

    if (span && item.left < span.right && item.left + item.width > span.left) {
        const { name, heightCm } = span.backdrop;
        const clearanceCm = bottomFromFloorCm - heightCm;
        if (clearanceCm < 0) return { text: `Overlaps ${name} backdrop by ${Math.abs(clearanceCm)} cm`, warning: true };
        return { text: `${clearanceCm} cm clear above ${name} (center ${centerFromFloorCm} cm from floor)`, warning: false };
    }
    if (item.type === 'poster') {
        return centerFromFloorCm >= 140 && centerFromFloorCm <= 160
            ? { text: `Eye-level gallery zone (center ${centerFromFloorCm} cm from floor)`, warning: false }
            : { text: `Center ${centerFromFloorCm} cm from floor (ideal eye level: 140-160 cm)`, warning: false };
    }
    return { text: `Bottom ${bottomFromFloorCm} cm from floor (center ${centerFromFloorCm} cm)`, warning: false };
}
