import {
    CANVAS_PADDING_PX, clamp, EPSILON, FLOOR_BACKDROPS, getBounds, GUIDE_TAG_ROOM_PX, LABEL_GAP_PX,
    LABEL_SLIDE_STEP_PX, MAX_GUIDES, PAN_KEEP_PX, POWER_IDLE_TEXT, RULER_GAP_PX, RULER_LABEL_CM, RULER_LABEL_ROOM_PX,
    RULER_PIN_PX, RULER_SIZE_PX, RULER_TICK_CM, SCALE, SNAP_STEP_PX, STUDIO_MODES, toCm, WALL_BORDER_PX,
    wallPaintById, ZOOM_BUTTON_STEP, ZOOM_LIMITS, ZOOM_WHEEL_STEP
} from '../core/constants.js';
import {
    accentColorPicker, accentHexCode, appShell, atticSlopeToggle, atticZone, backdropButtons, brightnessSlider,
    brightnessValue, canvasArea, commandPaletteBtn, cornerColorPicker, cornerHexCode, floorBackdropLayer,
    guideHitLayer, guideLineLayer, isModalOpen, measureLayer, modeCreatorBtn, modeEngineerBtn, paintSwatches,
    powerRoutesLayer, powerRoutingSummary, powerRoutingToggle, presetButtons, rulerCorner, rulers, rulerX, rulerY,
    scaleNote, snapGridToggle, themeToggleBtn, wallCanvas, wallHeightInput, wallItemsLayer, wallPaintName,
    wallWidthInput, zoomInBtn, zoomOutBtn, zoomResetBtn
} from '../core/dom.js';
import {
    commitLayoutChange, createGuideId, createIdleGuideDrag, createIdlePan, getSelectedItems, isCreatorMode,
    isDefaultView, isPointerBusy, isSelected, state
} from '../core/state.js';
import {
    findNeighborGaps, measureSegments, pickOuterEdge, planPowerRoutes, powerRouteMarkup, powerSummary,
    updateCollisionStates
} from '../core/geometry.js';
import { isContextMenuOpen, syncItemLedField, syncLedToggle, updateInspectorLive } from './inspector-layers.js';
import { saveState, showIoStatus } from '../io/projects-spec.js';
import { guardNextWallClick } from '../planner-engine.js';

let fitScale = 1;
let fittedCanvasSize = '';

let labelMetrics = { single: 34, digit: 6, height: 18 };

export function setWallDimensions(widthCm, heightCm) {
    state.wallWidthCm = widthCm;
    state.wallHeightCm = heightCm;
    state.wallWidthPx = widthCm * SCALE;
    state.wallHeightPx = heightCm * SCALE;

    wallCanvas.style.width = `${state.wallWidthPx}px`;
    wallCanvas.style.height = `${state.wallHeightPx}px`;
    wallWidthInput.value = widthCm;
    wallHeightInput.value = heightCm;

    fitWallToViewport();
}

export function fitWallToViewport() {
    fittedCanvasSize = `${canvasArea.clientWidth}x${canvasArea.clientHeight}`;
    const availableWidth = canvasArea.clientWidth - CANVAS_PADDING_PX * 2;
    const availableHeight = canvasArea.clientHeight - CANVAS_PADDING_PX * 2;
    const fit = Math.min(
        1,
        availableWidth / (state.wallWidthPx + WALL_BORDER_PX * 2),
        availableHeight / (state.wallHeightPx + WALL_BORDER_PX * 2)
    );

    // A collapsed canvas reports no usable size; keep full scale instead of shrinking to nothing
    fitScale = fit > 0 ? fit : 1;
    state.viewScale = fitScale * state.userZoom;
    clampPan();
    applyWallTransform();
    // The note describes the fit only; the zoom HUD owns the zoom level
    scaleNote.textContent = fitScale < 1
        ? `(1 cm = 2.5 px, fit ${Math.round(fitScale * 100)}%)`
        : '(1 cm = 2.5 px)';

    // Item offsets are stored in wall space, so a resize mid-drag only needs fresh screen bounds
    if (state.dragState.isDragging) {
        state.dragState.wallRect = wallCanvas.getBoundingClientRect();
        state.dragState.scale = state.viewScale;
    }
    if (state.resizeState.active) {
        state.resizeState.wallRect = wallCanvas.getBoundingClientRect();
        state.resizeState.scale = state.viewScale;
    }
    if (state.catalogDrag.active) {
        state.catalogDrag.canvasRect = canvasArea.getBoundingClientRect();
    }
    layoutRulers();
    syncZoomHud();
}

// The default view writes exactly what earlier versions wrote, so the resting geometry never changes.
// Otherwise the wall scales about its center (the canvas center) and the pan shifts that center.
export function applyWallTransform() {
    wallCanvas.style.transform = isDefaultView()
        ? (state.viewScale < 1 ? `scale(${state.viewScale})` : '')
        : `translate(${state.panX}px, ${state.panY}px) scale(${state.viewScale})`;
}

// However far the view is pushed, part of the wall stays in sight, so it can always be grabbed back
export function clampPan() {
    const reachX = Math.max(0, (canvasArea.clientWidth + (state.wallWidthPx + WALL_BORDER_PX * 2) * state.viewScale) / 2 - PAN_KEEP_PX);
    const reachY = Math.max(0, (canvasArea.clientHeight + (state.wallHeightPx + WALL_BORDER_PX * 2) * state.viewScale) / 2 - PAN_KEEP_PX);
    state.panX = Math.round(clamp(state.panX, -reachX, reachX));
    state.panY = Math.round(clamp(state.panY, -reachY, reachY));
}

export function syncZoomHud() {
    const percent = `${Math.round(state.userZoom * 100)}%`;
    zoomResetBtn.textContent = percent;
    zoomResetBtn.setAttribute('aria-label', `Reset zoom and pan, now ${percent}`);
    zoomOutBtn.disabled = state.userZoom <= ZOOM_LIMITS[0] + EPSILON;
    zoomInBtn.disabled = state.userZoom >= ZOOM_LIMITS[1] - EPSILON;
}

// Keeps the screen point under (clientX, clientY) fixed. A wall point p sits at center + pan + s * p,
// so holding that sum steady while s changes gives pan' = q - (s' / s) * (q - pan), q measured from
// the canvas center, which is also the wall's transform origin.
export function zoomTo(nextZoom, clientX, clientY) {
    const zoom = clamp(Math.round(nextZoom * 1000) / 1000, ZOOM_LIMITS[0], ZOOM_LIMITS[1]);
    if (zoom === state.userZoom || isPointerBusy() || isModalOpen()) return;

    const canvasRect = canvasArea.getBoundingClientRect();
    const centerX = canvasRect.left + canvasRect.width / 2;
    const centerY = canvasRect.top + canvasRect.height / 2;
    const qx = (clientX ?? centerX) - centerX;
    const qy = (clientY ?? centerY) - centerY;
    const ratio = zoom / state.userZoom;
    state.panX = qx - ratio * (qx - state.panX);
    state.panY = qy - ratio * (qy - state.panY);
    state.userZoom = zoom;
    fitWallToViewport();
}

// Buttons and shortcuts move to the next quarter step, so a wheel zoom of 110% steps to 125% or 100%
export function stepZoom(direction) {
    const steps = state.userZoom / ZOOM_BUTTON_STEP;
    const next = direction > 0 ? Math.floor(steps + EPSILON) + 1 : Math.ceil(steps - EPSILON) - 1;
    zoomTo(next * ZOOM_BUTTON_STEP);
}

export function resetView() {
    if (isPointerBusy()) return;
    state.userZoom = 1;
    state.panX = 0;
    state.panY = 0;
    fitWallToViewport();
}

export function startPan(e) {
    state.panState = {
        ...createIdlePan(),
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: state.panX,
        startPanY: state.panY,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
    document.body.classList.add('is-panning');
    canvasArea.classList.add('is-panning');
}

// Only the transform and the ruler positions change per frame; the ruler ticks are not rebuilt
export function applyPanFrame() {
    state.panState.frameId = 0;
    state.panX = state.panState.startPanX + state.panState.pointerX - state.panState.startX;
    state.panY = state.panState.startPanY + state.panState.pointerY - state.panState.startY;
    clampPan();
    applyWallTransform();
    layoutRulers();
}

export function endPan() {
    if (state.panState.frameId) {
        cancelAnimationFrame(state.panState.frameId);
        applyPanFrame();
    }
    state.panState = createIdlePan();
    document.body.classList.remove('is-panning');
    canvasArea.classList.remove('is-panning');
}

export function cancelPan() {
    state.panX = state.panState.startPanX;
    state.panY = state.panState.startPanY;
    if (state.panState.frameId) cancelAnimationFrame(state.panState.frameId);
    state.panState.frameId = 0;
    endPan();
    fitWallToViewport();
}

export const setSpaceHeld = (held) => {
    state.spaceHeld = held;
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
        const offset = cm * SCALE * state.viewScale;
        const major = cm % RULER_LABEL_CM === 0;
        marks.push(`<span class="ruler-tick${major ? ' is-major' : ''}" style="${position}: ${offset}px"></span>`);
        // A label with no room left before the far end would be clipped, so it sits before its tick instead
        if (major) {
            const end = cm > 0 && (lengthCm - cm) * SCALE * state.viewScale < RULER_LABEL_ROOM_PX ? ' is-end' : '';
            marks.push(`<span class="ruler-label${end}" style="${position}: ${offset}px">${cm}</span>`);
        }
    }
    return marks.join('');
}

// Screen rectangles of the two ruler bands and the canvas, refreshed with every layout
export const rulerBands = { top: null, left: null, canvas: null };
let rulerScaleKey = '';

const inBand = (band, x, y) => Boolean(band) && x >= band.left && x <= band.right && y >= band.top && y <= band.bottom;

export function layoutRulers() {
    const canvasRect = canvasArea.getBoundingClientRect();
    const wallRect = wallCanvas.getBoundingClientRect();
    const border = WALL_BORDER_PX * state.viewScale;
    const left = wallRect.left + border - canvasRect.left;
    const top = wallRect.top + border - canvasRect.top;
    const offset = border + RULER_GAP_PX + RULER_SIZE_PX;
    const width = state.wallWidthPx * state.viewScale;
    const height = state.wallHeightPx * state.viewScale;
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
    const scaleKey = `${state.viewScale}|${state.wallWidthCm}|${state.wallHeightCm}`;
    if (scaleKey !== rulerScaleKey) {
        rulerScaleKey = scaleKey;
        rulerX.querySelector('.ruler-scale').innerHTML = rulerMarkup(state.wallWidthCm, 'x');
        rulerY.querySelector('.ruler-scale').innerHTML = rulerMarkup(state.wallHeightCm, 'y');
    }
    syncRulerSpans();
    applyCrosshair();
}

// The selected box is shaded on both rulers, the way CAD tools mark a selection's extent
export function syncRulerSpans() {
    const selected = getSelectedItems();
    const spanX = rulerX.querySelector('.ruler-span');
    const spanY = rulerY.querySelector('.ruler-span');
    spanX.hidden = spanY.hidden = !selected.length;
    if (!selected.length) return;

    const box = selected.length === 1 ? selected[0] : getBounds(selected);
    spanX.style.left = `${box.left * state.viewScale}px`;
    spanX.style.width = `${box.width * state.viewScale}px`;
    spanY.style.top = `${box.top * state.viewScale}px`;
    spanY.style.height = `${box.height * state.viewScale}px`;
}

// The top ruler pulls out horizontal guides (axis 'y') and the left ruler vertical ones (axis 'x').
// Only the part of a band inside the canvas counts, since the canvas clips the rest.
export function rulerAxisAt(clientX, clientY) {
    if (!inBand(rulerBands.canvas, clientX, clientY)) return null;
    if (inBand(rulerBands.top, clientX, clientY)) return 'y';
    return inBand(rulerBands.left, clientX, clientY) ? 'x' : null;
}

export function applyCrosshair() {
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
    const x = (crosshair.clientX - rulerOrigin.left) / state.viewScale;
    const y = (crosshair.clientY - rulerOrigin.top) / state.viewScale;
    // A zoomed wall can reach under the sidebars, where the pointer is not over the drawing at all
    const inside = crosshair.over && !isModalOpen() && inBand(rulerBands.canvas, crosshair.clientX, crosshair.clientY) &&
        x >= 0 && y >= 0 && x <= state.wallWidthPx && y <= state.wallHeightPx;

    hairX.hidden = hairY.hidden = !inside;
    if (!inside) return;

    hairX.style.transform = `translateX(${x * state.viewScale}px)`;
    hairY.style.transform = `translateY(${y * state.viewScale}px)`;
    hairX.firstElementChild.textContent = Math.round(x / SCALE);
    hairY.firstElementChild.textContent = Math.round(y / SCALE);
    // Readouts flip to the inner side near the far end so they are never clipped by the ruler
    hairX.classList.toggle('is-flipped', x > state.wallWidthPx - 40 / state.viewScale);
    hairY.classList.toggle('is-flipped', y > state.wallHeightPx - 40 / state.viewScale);
}

// Each guide is drawn twice: a grab strip under the items, so pressing furniture still moves the
// furniture, and the visible line with its cm tag above them. The tag stays grabbable everywhere.
const guideStart = (guide) => (guide.axis === 'x' ? 'left' : 'top');
const guideLimitPx = (guide) => (guide.axis === 'x' ? state.wallWidthPx : state.wallHeightPx);

// Near the far edge the tag moves to the other side of its line, where the wall cannot clip it
const isGuideTagFlipped = (guide) => guide.cm * SCALE > guideLimitPx(guide) - GUIDE_TAG_ROOM_PX;

export function renderGuides() {
    guideHitLayer.innerHTML = state.wallGuides.map(guide => `
        <div class="guide-hit axis-${guide.axis}" data-guide-id="${guide.id}" style="${guideStart(guide)}: ${guide.cm * SCALE}px"></div>`).join('');
    guideLineLayer.innerHTML = state.wallGuides.map(guide => `
        <div class="wall-guide axis-${guide.axis}${isGuideTagFlipped(guide) ? ' is-flipped' : ''}" data-guide-id="${guide.id}" style="${guideStart(guide)}: ${guide.cm * SCALE}px">
            <span class="wall-guide-tag" data-guide-id="${guide.id}" title="Drag to move this guide, drag it off the wall or double-click to remove it">${guide.cm} cm</span>
        </div>`).join('');
}

// A smaller wall drops the guides that no longer lie on it; undo brings them back with the size
export function pruneGuides() {
    const kept = state.wallGuides.filter(guide => guide.cm * SCALE <= guideLimitPx(guide));
    const changed = kept.length !== state.wallGuides.length;
    state.wallGuides = kept;
    return changed;
}

export function startGuideDrag(guide, isNew, e) {
    const elements = [...wallCanvas.querySelectorAll(`.guide-hit[data-guide-id="${guide.id}"], .wall-guide[data-guide-id="${guide.id}"]`)];
    state.guideDrag = {
        ...createIdleGuideDrag(),
        active: true,
        guide,
        isNew,
        startCm: guide.cm,
        inside: !isNew,
        elements,
        tag: elements[1]?.querySelector('.wall-guide-tag') || null,
        wallRect: wallCanvas.getBoundingClientRect(),
        scale: state.viewScale,
        pointerX: e.clientX,
        pointerY: e.clientY
    };
    elements.forEach(el => el.classList.add('is-active'));
    document.body.classList.add(`is-dragging-guide-${guide.axis}`);
    applyGuideFrame();
}

// Only the guide's own axis decides whether it is still on the wall, so a hand drifting along the
// line never deletes it by accident
export function applyGuideFrame() {
    state.guideDrag.frameId = 0;
    const { guide, wallRect, scale, pointerX, pointerY, elements, tag } = state.guideDrag;
    const vertical = guide.axis === 'x';
    const local = (vertical ? (pointerX - wallRect.left) : (pointerY - wallRect.top)) / scale - WALL_BORDER_PX;
    const limitPx = guideLimitPx(guide);
    const stepCm = snapGridToggle.checked ? SNAP_STEP_PX / SCALE : 1;

    state.guideDrag.inside = local >= 0 && local <= limitPx;
    if (state.guideDrag.inside) guide.cm = clamp(Math.round(local / SCALE / stepCm) * stepCm, 0, limitPx / SCALE);

    elements.forEach(el => {
        el.hidden = !state.guideDrag.inside;
        el.style[guideStart(guide)] = `${guide.cm * SCALE}px`;
    });
    elements[1]?.classList.toggle('is-flipped', isGuideTagFlipped(guide));
    if (tag) tag.textContent = `${guide.cm} cm`;
}

export function scheduleGuideFrame() {
    if (state.guideDrag.active && !state.guideDrag.frameId) state.guideDrag.frameId = requestAnimationFrame(applyGuideFrame);
}

export function endGuideDrag() {
    if (state.guideDrag.frameId) cancelAnimationFrame(state.guideDrag.frameId);
    state.guideDrag.elements.forEach(el => el.classList.remove('is-active'));
    document.body.classList.remove(`is-dragging-guide-${state.guideDrag.guide.axis}`);
    state.guideDrag = createIdleGuideDrag();
}

export function finishGuideDrag() {
    if (state.guideDrag.frameId) {
        cancelAnimationFrame(state.guideDrag.frameId);
        applyGuideFrame();
    }

    const { guide, isNew, startCm, inside } = state.guideDrag;
    endGuideDrag();
    // Two guides on one line could never be told apart, so a guide dropped onto another merges into it
    const twin = inside && state.wallGuides.find(other => other !== guide && other.axis === guide.axis && other.cm === guide.cm);
    if (!inside || twin) {
        state.wallGuides = state.wallGuides.filter(other => other !== guide);
        renderGuides();
    }

    const changed = isNew ? inside && !twin : !inside || twin || guide.cm !== startCm;
    if (changed) commitLayoutChange();
}

// Escape puts a moved guide back and drops one that was still being pulled out of a ruler
export function cancelGuideDrag() {
    const { guide, isNew, startCm } = state.guideDrag;
    endGuideDrag();
    if (isNew) state.wallGuides = state.wallGuides.filter(other => other !== guide);
    else guide.cm = startCm;
    renderGuides();
}

export function removeGuide(id) {
    if (isPointerBusy() || !state.wallGuides.some(guide => guide.id === id)) return;
    state.wallGuides = state.wallGuides.filter(guide => guide.id !== id);
    renderGuides();
    commitLayoutChange();
}

export function applyWallPaint(id) {
    const paint = wallPaintById(id);
    state.wallPaint = paint.id;
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
export function setWallPaint(id) {
    if (id === state.wallPaint || isPointerBusy()) return;
    applyWallPaint(id);
    commitLayoutChange();
}

// One layout read at startup lets the label placer size labels without touching layout per frame
export function measureLabelMetrics() {
    const probe = document.createElement('span');
    probe.className = 'guide-label';
    probe.style.visibility = 'hidden';
    wallCanvas.appendChild(probe);

    const widthOf = (text) => {
        probe.textContent = text;
        return probe.getBoundingClientRect().width / state.viewScale;
    };
    const single = widthOf('0 cm');
    const digit = (widthOf('000 cm') - single) / 2;
    const height = probe.getBoundingClientRect().height / state.viewScale;
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

export function setRuler(ruler, spec) {
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

// A multi-selection is measured as one box, the same box the group drag snaps with
export function updateDistanceGuides() {
    const selected = getSelectedItems();
    // Alt measuring takes over the overlay; the regular rulers come back when it ends
    if (!selected.length || measure.active) {
        Object.values(rulers).forEach(ruler => setRuler(ruler, null));
        return;
    }

    const item = selected.length === 1 ? selected[0] : getBounds(selected);
    const gaps = findNeighborGaps(item, new Set(state.selectedItemIds));
    const right = item.left + item.width;
    const bottom = item.top + item.height;

    // A neighbor on the left or top owns the shared overlap axis, so the wall ruler on that
    // side moves out to the item's outer edge instead of running along the same line
    const wallXCross = gaps.left
        ? pickOuterEdge(item.top, bottom, gaps.left.cross, state.wallHeightPx)
        : Math.round(item.top + item.height / 2);
    const wallYCross = gaps.up
        ? pickOuterEdge(item.left, right, gaps.up.cross, state.wallWidthPx)
        : Math.round(item.left + item.width / 2);

    setRuler(rulers.wallX, { axis: 'h', start: 0, end: item.left, cross: wallXCross, text: `${toCm(item.left)} cm` });
    setRuler(rulers.wallY, { axis: 'v', start: 0, end: item.top, cross: wallYCross, text: `${toCm(item.top)} cm` });
    setRuler(rulers.gapLeft, gaps.left);
    setRuler(rulers.gapRight, gaps.right);
    setRuler(rulers.gapUp, gaps.up);
    setRuler(rulers.gapDown, gaps.down);

    placeRulerLabels();
}

// Alt-hover measuring. hoverId is the item under the pointer, 'wall' for bare wall, or null off the wall.
export const measure = { alt: false, hoverId: null, active: false, key: '', frameId: 0 };

const segmentStyle = ({ axis, start, end, cross }) => (axis === 'h'
    ? `left: ${start}px; top: ${cross}px; width: ${end - start}px;`
    : `left: ${cross}px; top: ${start}px; height: ${end - start}px;`);

function resolveMeasureTarget() {
    if (measure.hoverId === 'wall') return { left: 0, top: 0, width: state.wallWidthPx, height: state.wallHeightPx };
    if (!measure.hoverId || isSelected(measure.hoverId)) return null;
    return state.wallItems.find(item => item.id === measure.hoverId) || null;
}

export function clearMeasure() {
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
export function refreshMeasure() {
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

export function scheduleMeasure() {
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

let powerRoutesKey = '';

// Runs on every render and every drag, nudge or resize frame, but rebuilds only when a run changed
export function refreshPowerRoutes() {
    if (!state.powerRoutingOn) return;

    const plan = planPowerRoutes();
    const summary = powerSummary(plan);
    const key = [
        state.wallWidthPx, state.wallHeightPx, summary.text,
        ...plan.routes.map(({ item, socket, from, to }) => `${item.id}>${socket.id}:${from.x},${from.y},${to.x},${to.y}`)
    ].join('|');
    if (key === powerRoutesKey) return;
    powerRoutesKey = key;

    const parts = plan.routes.map(powerRouteMarkup);
    powerRoutesLayer.innerHTML = `
        <svg class="power-routes-svg" width="${state.wallWidthPx}" height="${state.wallHeightPx}" viewBox="0 0 ${state.wallWidthPx} ${state.wallHeightPx}">
            ${parts.map(part => part.path).join('')}
        </svg>
        ${parts.map(part => part.pill).join('')}`;
    powerRoutingSummary.textContent = summary.text;
    powerRoutingSummary.classList.toggle('is-warning', summary.warning);
}

export function setPowerRouting(on) {
    state.powerRoutingOn = on;
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

export function setFloorBackdrop(kind) {
    const backdrop = FLOOR_BACKDROPS[kind];
    state.floorBackdrop = backdrop ? kind : 'none';
    backdropButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.backdrop === state.floorBackdrop)));
    floorBackdropLayer.dataset.kind = state.floorBackdrop;
    floorBackdropLayer.innerHTML = backdrop ? floorBackdropMarkup(backdrop) : '';
    floorBackdropLayer.hidden = !backdrop;
}

// Creator Mode only hides the drafting tools through CSS, so Engineer Mode finds every guide, cable run,
// layer and coordinate field exactly as it left them
export function setStudioMode(mode) {
    if (!STUDIO_MODES.includes(mode) || isPointerBusy()) return;
    state.studioMode = mode;
    appShell.dataset.studioMode = mode;
    modeEngineerBtn.setAttribute('aria-pressed', String(mode === 'engineer'));
    modeCreatorBtn.setAttribute('aria-pressed', String(mode === 'creator'));
    // A pointer resting on a ruler band stops, or starts, showing the guide cursor right away
    applyCrosshair();
}

export function applyAtticSlope() {
    atticZone.hidden = !atticSlopeToggle.checked;
    updateCollisionStates();
    updateInspectorLive();
}

export function clearGuides() {
    if (!state.wallGuides.length || isPointerBusy()) return;
    state.wallGuides = [];
    renderGuides();
    commitLayoutChange();
}

export function toggleAmbientMode() {
    state.isAmbientMode = !state.isAmbientMode;
    wallCanvas.classList.toggle('daylight-mode', !state.isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !state.isAmbientMode);

    themeToggleBtn.textContent = state.isAmbientMode ? 'Ambient Mode: ON' : 'Daylight Grid: ON';
}

export function updateAccentColor(hexColor, shouldSave = true) {
    document.documentElement.style.setProperty('--accent-led', hexColor);
    accentHexCode.textContent = hexColor.toUpperCase();
    accentColorPicker.value = hexColor;
    syncItemLedField();
    if (shouldSave) saveState();
}

export function updateCornerColor(hexColor, shouldSave = true) {
    document.documentElement.style.setProperty('--corner-led', hexColor);
    cornerHexCode.textContent = hexColor.toUpperCase();
    cornerColorPicker.value = hexColor;
    syncItemLedField();
    if (shouldSave) saveState();
}

export function setBrightness(percent) {
    brightnessSlider.value = percent;
    document.documentElement.style.setProperty('--led-opacity', percent / 100);
    brightnessValue.textContent = `${percent}%`;
}

export function bindViewportEvents() {
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
        zoomTo(state.userZoom - clamp(delta / 100, -1, 1) * ZOOM_WHEEL_STEP, e.clientX, e.clientY);
    }, { passive: false });

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

    // Runs in the capture phase, ahead of items and the wall. A middle press, or a left press with Space
    // held, pans the view. The rulers keep pointer-events off so they never get in the way, so a press is
    // checked against their bands here instead; a ruler parked over a zoomed wall still pulls guides.
    canvasArea.addEventListener('mousedown', (e) => {
        if (e.target.closest('.zoom-hud') || isPointerBusy() || isModalOpen()) return;

        if (e.button === 1 || (e.button === 0 && state.spaceHeld)) {
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
        if (state.wallGuides.length >= MAX_GUIDES) {
            showIoStatus(`A wall holds up to ${MAX_GUIDES} guides. Remove one to add another.`, 'error');
            return;
        }
        const guide = { id: createGuideId(), axis, cm: 0 };
        state.wallGuides.push(guide);
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
            const guide = state.wallGuides.find(entry => entry.id === el.dataset.guideId);
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

    paintSwatches.forEach(button => {
        button.style.setProperty('--swatch', wallPaintById(button.dataset.paint).ambient);
        button.addEventListener('click', () => setWallPaint(button.dataset.paint));
    });

    window.addEventListener('mousemove', (e) => {
        measure.hoverId = hoverIdFrom(e.target);
        measure.alt = e.altKey;
        if (measure.alt || measure.active) scheduleMeasure();
    });

    powerRoutingToggle.addEventListener('click', () => setPowerRouting(!state.powerRoutingOn));

    backdropButtons.forEach(button => button.addEventListener('click', () => setFloorBackdrop(button.dataset.backdrop)));

    modeEngineerBtn.addEventListener('click', () => setStudioMode('engineer'));
    modeCreatorBtn.addEventListener('click', () => setStudioMode('creator'));

    themeToggleBtn.addEventListener('click', toggleAmbientMode);

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
            if (!state.isAmbientMode) themeToggleBtn.click();
        });
    });
}
