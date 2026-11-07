const SCALE = 2.5; // 1 cm = 2.5 px
const WALL_WIDTH = 750;
const WALL_HEIGHT = 625;
const CM_STEP_PX = SCALE;
const SNAP_STEP_PX = 5 * SCALE; // 5 cm grid step (12.5 px)
const ATTIC_SLOPE_PX = 90 * SCALE; // 90 x 90 cm roof cut-out (225 px)
const STORAGE_KEY = 'spatial_studio_state_v1';

const FINISHES = [
    { id: 'walnut', label: 'Walnut' },
    { id: 'oak', label: 'Oak' },
    { id: 'black', label: 'Black' },
    { id: 'white', label: 'White' }
];

const NUDGE_KEYS = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};

const wallCanvas = document.getElementById('wall');
const wallItemsLayer = document.getElementById('wall-items');
const atticZone = document.getElementById('attic-zone');
const guideX = document.getElementById('guide-x');
const guideY = document.getElementById('guide-y');
const guideXLabel = guideX.querySelector('.guide-label');
const guideYLabel = guideY.querySelector('.guide-label');

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const resetWallBtn = document.getElementById('reset-wall-btn');
const snapGridToggle = document.getElementById('snap-grid-toggle');
const atticSlopeToggle = document.getElementById('attic-slope-toggle');
const catalogItems = document.querySelectorAll('.catalog-item');
const totalPriceDisplay = document.getElementById('total-price');
const inspectorBox = document.getElementById('inspector-box');

const accentColorPicker = document.getElementById('accent-color-picker');
const accentHexCode = document.getElementById('accent-hex-code');
const cornerColorPicker = document.getElementById('corner-color-picker');
const cornerHexCode = document.getElementById('corner-hex-code');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
const presetButtons = document.querySelectorAll('.btn-preset');

const defaultItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20, finish: 'walnut' },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175, finish: 'black' }
];

let isAmbientMode = true;
let selectedItemId = null;
let wallItems = [];
let justDragged = false;

const createIdleDragState = () => ({
    isDragging: false,
    itemId: null,
    element: null,
    wallRect: null,
    offsetX: 0,
    offsetY: 0,
    pointerX: 0,
    pointerY: 0,
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

function loadState() {
    atticSlopeToggle.checked = false;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        wallItems = cloneDefaults();
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        wallItems = Array.isArray(parsed.items) ? parsed.items : cloneDefaults();
        if (parsed.accentColor) updateAccentColor(parsed.accentColor, false);
        if (parsed.cornerColor) updateCornerColor(parsed.cornerColor, false);
        if (parsed.brightness !== undefined) setBrightness(parsed.brightness);
        atticSlopeToggle.checked = parsed.atticSlope === true;
    } catch {
        wallItems = cloneDefaults();
    }
}

function renderPlanner() {
    wallItemsLayer.innerHTML = wallItems.map(item => {
        const isSelected = item.id === selectedItemId ? 'selected' : '';
        const finishClass = item.finish ? `finish-${item.finish}` : 'finish-walnut';
        return `
            <div class="wall-item ${item.type} ${finishClass} ${isSelected}" 
                 data-id="${item.id}" 
                 style="left: ${item.left}px; top: ${item.top}px; width: ${item.width}px; height: ${item.height}px;">
                <span class="item-label">${item.name}</span>
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
        offsetY: e.clientY - wallRect.top - item.top
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

    dragState.element.classList.remove('dragging');
    dragState = createIdleDragState();

    // A drag can end with the cursor just off the item; swallow the click that follows
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);

    saveState();
});

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        const offset = (wallItems.length * 20) % 160;
        const width = parseInt(catalogEl.dataset.width, 10);
        const height = parseInt(catalogEl.dataset.height, 10);

        // The cascade offset alone can push tall pieces past the floor line
        const newItem = {
            id: 'item-' + Date.now(),
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
        saveState();
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
    saveState();
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
                <span class="selected-item-title">${item.name}</span>
                <span>$${item.price}</span>
            </div>
            <span>Offset: <strong id="inspector-pos-readout">${formatOffset(item)}</strong></span>
            
            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="10" max="300" value="${toCm(item.width)}">
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="5" max="250" value="${toCm(item.height)}">
                </div>
            </div>

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">${finishButtons}</div>
            </div>

            <div id="warning-overlap" class="collision-warning" hidden>Overlap detected with another item</div>
            <div id="warning-attic" class="collision-warning" hidden>Intrudes into sloped ceiling zone</div>
            <button class="btn-danger" id="delete-item-btn">Remove Item</button>
        </div>
    `;

    updateInspectorLive(item);

    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');

    function applyDimensionChange() {
        const rawW = parseInt(widthInput.value, 10) || toCm(item.width);
        const rawH = parseInt(heightInput.value, 10) || toCm(item.height);

        const clampedW = clamp(rawW, 8, 300);
        const clampedH = clamp(rawH, 4, 250);

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
        saveState();
    }

    widthInput.addEventListener('change', applyDimensionChange);
    heightInput.addEventListener('change', applyDimensionChange);

    inspectorBox.querySelectorAll('.btn-finish').forEach(btn => {
        btn.addEventListener('click', () => {
            item.finish = btn.dataset.finish;
            renderPlanner();
            updateInspectorPanel();
            saveState();
        });
    });

    document.getElementById('delete-item-btn').addEventListener('click', () => removeItem(item.id));
}

// Keyboard shortcuts: Arrow keys for 1cm nudging, Delete/Backspace to remove
window.addEventListener('keydown', (e) => {
    if (!selectedItemId) return;
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
    saveState();
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
    saveState();
});

resetWallBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    wallItems = cloneDefaults();
    selectedItemId = null;
    atticSlopeToggle.checked = false;
    updateAccentColor('#ff9d42', false);
    updateCornerColor('#8b5cf6', false);
    setBrightness(100);
    renderPlanner();
    applyAtticSlope();
    updateInspectorPanel();
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