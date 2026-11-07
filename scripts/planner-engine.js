const SCALE = 2.5; // 1 cm = 2.5 px
const WALL_WIDTH = 750;
const WALL_HEIGHT = 625;
const SNAP_STEP_PX = 5 * SCALE; // 5 cm grid step (12.5 px)
const STORAGE_KEY = 'spatial_studio_state_v1';

const wallCanvas = document.getElementById('wall');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const resetWallBtn = document.getElementById('reset-wall-btn');
const snapGridToggle = document.getElementById('snap-grid-toggle');
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

let dragState = {
    isDragging: false,
    itemId: null,
    element: null,
    offsetX: 0,
    offsetY: 0
};

function saveState() {
    const payload = {
        items: wallItems,
        accentColor: accentColorPicker.value,
        cornerColor: cornerColorPicker.value,
        brightness: brightnessSlider.value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        wallItems = JSON.parse(JSON.stringify(defaultItems));
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        wallItems = Array.isArray(parsed.items) ? parsed.items : JSON.parse(JSON.stringify(defaultItems));
        if (parsed.accentColor) updateAccentColor(parsed.accentColor, false);
        if (parsed.cornerColor) updateCornerColor(parsed.cornerColor, false);
        if (parsed.brightness !== undefined) {
            brightnessSlider.value = parsed.brightness;
            document.documentElement.style.setProperty('--led-opacity', parsed.brightness / 100);
            brightnessValue.textContent = `${parsed.brightness}%`;
        }
    } catch {
        wallItems = JSON.parse(JSON.stringify(defaultItems));
    }
}

function renderPlanner() {
    const cornerGlowHTML = `<div class="corner-led-glow"></div>`;
    
    const itemsHTML = wallItems.map(item => {
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

    wallCanvas.innerHTML = itemsHTML + cornerGlowHTML;

    document.querySelectorAll('.wall-item').forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    updateCollisionStates();

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

function hasCollision(targetItem) {
    return wallItems.some(other => other.id !== targetItem.id && isOverlapping(targetItem, other));
}

function updateCollisionStates() {
    document.querySelectorAll('.wall-item').forEach(el => {
        const item = wallItems.find(i => i.id === el.dataset.id);
        if (item) {
            el.classList.toggle('colliding', hasCollision(item));
        }
    });
}

function startDrag(e) {
    if (e.button !== 0) return;
    e.stopPropagation();

    const el = e.currentTarget;
    const itemId = el.dataset.id;
    const item = wallItems.find(i => i.id === itemId);
    if (!item) return;

    selectItem(itemId);

    const wallRect = wallCanvas.getBoundingClientRect();

    dragState = {
        isDragging: true,
        itemId: itemId,
        element: el,
        offsetX: e.clientX - wallRect.left - item.left,
        offsetY: e.clientY - wallRect.top - item.top
    };

    el.classList.add('dragging');
}

window.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;

    const item = wallItems.find(i => i.id === dragState.itemId);
    if (!item) return;

    const wallRect = wallCanvas.getBoundingClientRect();
    let newLeft = e.clientX - wallRect.left - dragState.offsetX;
    let newTop = e.clientY - wallRect.top - dragState.offsetY;

    if (snapGridToggle.checked) {
        newLeft = Math.round(newLeft / SNAP_STEP_PX) * SNAP_STEP_PX;
        newTop = Math.round(newTop / SNAP_STEP_PX) * SNAP_STEP_PX;
    }

    newLeft = Math.max(0, Math.min(newLeft, WALL_WIDTH - item.width));
    newTop = Math.max(0, Math.min(newTop, WALL_HEIGHT - item.height));

    item.left = Math.round(newLeft);
    item.top = Math.round(newTop);

    dragState.element.style.left = `${item.left}px`;
    dragState.element.style.top = `${item.top}px`;

    updateCollisionStates();
    updateInspectorCoordinates(item);
});

window.addEventListener('mouseup', () => {
    if (!dragState.isDragging) return;

    if (dragState.element) {
        dragState.element.classList.remove('dragging');
    }

    dragState.isDragging = false;
    dragState.itemId = null;
    dragState.element = null;
    saveState();
});

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        const offset = (wallItems.length * 20) % 160;

        const newItem = {
            id: 'item-' + Date.now(),
            type: catalogEl.dataset.type,
            name: catalogEl.dataset.name,
            price: parseFloat(catalogEl.dataset.price),
            left: 200 + offset,
            top: 220 + offset,
            width: parseInt(catalogEl.dataset.width, 10),
            height: parseInt(catalogEl.dataset.height, 10),
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

    document.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === itemId);
    });

    updateInspectorPanel();
}

function updateInspectorCoordinates(item) {
    const posReadout = document.getElementById('inspector-pos-readout');
    if (posReadout && item) {
        const leftCm = Math.round(item.left / SCALE);
        const topCm = Math.round(item.top / SCALE);
        posReadout.textContent = `${leftCm} cm (X), ${topCm} cm (Y)`;
    }
}

function updateInspectorPanel() {
    const item = wallItems.find(i => i.id === selectedItemId);
    if (!item) {
        inspectorBox.innerHTML = `<p>Select or drag an item on the wall to edit dimensions, finish, or remove it.</p>`;
        return;
    }

    const widthCm = Math.round(item.width / SCALE);
    const heightCm = Math.round(item.height / SCALE);
    const leftCm = Math.round(item.left / SCALE);
    const topCm = Math.round(item.top / SCALE);
    const colliding = hasCollision(item);
    const currentFinish = item.finish || 'walnut';

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <div class="selected-item-header">
                <span class="selected-item-title">${item.name}</span>
                <span>$${item.price}</span>
            </div>
            <span>Offset: <strong id="inspector-pos-readout">${leftCm} cm (X), ${topCm} cm (Y)</strong></span>
            
            <div class="inspector-grid">
                <div class="inspector-field">
                    <label for="edit-width-cm">Width (cm)</label>
                    <input type="number" id="edit-width-cm" class="dim-input" min="10" max="300" value="${widthCm}">
                </div>
                <div class="inspector-field">
                    <label for="edit-height-cm">Height (cm)</label>
                    <input type="number" id="edit-height-cm" class="dim-input" min="5" max="250" value="${heightCm}">
                </div>
            </div>

            <div class="inspector-field">
                <label>Surface Finish</label>
                <div class="finish-swatches">
                    <button class="btn-finish ${currentFinish === 'walnut' ? 'active' : ''}" data-finish="walnut">Walnut</button>
                    <button class="btn-finish ${currentFinish === 'oak' ? 'active' : ''}" data-finish="oak">Oak</button>
                    <button class="btn-finish ${currentFinish === 'black' ? 'active' : ''}" data-finish="black">Black</button>
                    <button class="btn-finish ${currentFinish === 'white' ? 'active' : ''}" data-finish="white">White</button>
                </div>
            </div>

            ${colliding ? '<div class="collision-warning">Overlap detected with another item</div>' : ''}
            <button class="btn-danger" id="delete-item-btn">Remove Item</button>
        </div>
    `;

    const widthInput = document.getElementById('edit-width-cm');
    const heightInput = document.getElementById('edit-height-cm');

    function applyDimensionChange() {
        const rawW = parseInt(widthInput.value, 10) || widthCm;
        const rawH = parseInt(heightInput.value, 10) || heightCm;

        const clampedW = Math.max(8, Math.min(rawW, 300));
        const clampedH = Math.max(4, Math.min(rawH, 250));

        item.width = Math.round(clampedW * SCALE);
        item.height = Math.round(clampedH * SCALE);

        // Keep item inside wall if resized near the right/bottom edge
        item.left = Math.min(item.left, WALL_WIDTH - item.width);
        item.top = Math.min(item.top, WALL_HEIGHT - item.height);

        renderPlanner();
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

    document.getElementById('delete-item-btn').addEventListener('click', () => {
        wallItems = wallItems.filter(i => i.id !== item.id);
        selectedItemId = null;
        renderPlanner();
        updateInspectorPanel();
        saveState();
    });
}

// Keyboard shortcuts: Arrow keys for 1cm nudging, Delete/Backspace to remove
window.addEventListener('keydown', (e) => {
    if (!selectedItemId) return;
    if (e.target.tagName === 'INPUT') return; // Do not trigger while typing numbers in inputs

    const item = wallItems.find(i => i.id === selectedItemId);
    if (!item) return;

    const stepPx = Math.round(SCALE); // ~1 cm nudge

    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        wallItems = wallItems.filter(i => i.id !== selectedItemId);
        selectedItemId = null;
        renderPlanner();
        updateInspectorPanel();
        saveState();
        return;
    }

    let moved = false;
    if (e.key === 'ArrowLeft') {
        item.left = Math.max(0, item.left - stepPx);
        moved = true;
    } else if (e.key === 'ArrowRight') {
        item.left = Math.min(WALL_WIDTH - item.width, item.left + stepPx);
        moved = true;
    } else if (e.key === 'ArrowUp') {
        item.top = Math.max(0, item.top - stepPx);
        moved = true;
    } else if (e.key === 'ArrowDown') {
        item.top = Math.min(WALL_HEIGHT - item.height, item.top + stepPx);
        moved = true;
    }

    if (moved) {
        e.preventDefault();
        renderPlanner();
        updateInspectorPanel();
        saveState();
    }
});

wallCanvas.addEventListener('click', () => {
    if (selectedItemId !== null) {
        selectItem(null);
    }
});

resetWallBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    wallItems = JSON.parse(JSON.stringify(defaultItems));
    selectedItemId = null;
    updateAccentColor('#ff9d42', false);
    updateCornerColor('#8b5cf6', false);
    brightnessSlider.value = 100;
    document.documentElement.style.setProperty('--led-opacity', 1);
    brightnessValue.textContent = '100%';
    renderPlanner();
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

accentColorPicker.addEventListener('input', (e) => updateAccentColor(e.target.value));
cornerColorPicker.addEventListener('input', (e) => updateCornerColor(e.target.value));

brightnessSlider.addEventListener('input', (e) => {
    const percent = e.target.value;
    document.documentElement.style.setProperty('--led-opacity', percent / 100);
    brightnessValue.textContent = `${percent}%`;
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