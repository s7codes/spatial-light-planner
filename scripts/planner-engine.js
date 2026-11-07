const SCALE = 2.5; // 1 cm = 2.5 px
const WALL_WIDTH = 750;
const WALL_HEIGHT = 625;

const wallCanvas = document.getElementById('wall');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
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

let isAmbientMode = true;
let selectedItemId = null;

// Drag state tracking
let dragState = {
    isDragging: false,
    itemId: null,
    element: null,
    offsetX: 0,
    offsetY: 0
};

let wallItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf', price: 45, left: 120, top: 380, width: 275, height: 20 },
    { id: 'item-2', type: 'poster', name: 'Poster Frame', price: 25, left: 195, top: 140, width: 125, height: 175 }
];

function renderPlanner() {
    const cornerGlowHTML = `<div class="corner-led-glow"></div>`;
    
    const itemsHTML = wallItems.map(item => {
        const isSelected = item.id === selectedItemId ? 'selected' : '';
        return `
            <div class="wall-item ${item.type} ${isSelected}" 
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

// Axis-Aligned Bounding Box (AABB) overlap check between two items
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
    if (e.button !== 0) return; // Only left mouse button
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
        // Distance between cursor and the item's top-left corner
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

    // Clamp position so item stays strictly inside the 300x250cm wall boundaries
    newLeft = Math.max(0, Math.min(newLeft, WALL_WIDTH - item.width));
    newTop = Math.max(0, Math.min(newTop, WALL_HEIGHT - item.height));

    item.left = Math.round(newLeft);
    item.top = Math.round(newTop);

    // Direct style update avoids rebuilding DOM nodes during 60fps mouse movement
    dragState.element.style.left = `${item.left}px`;
    dragState.element.style.top = `${item.top}px`;

    updateCollisionStates();
    updateInspectorPanel();
});

window.addEventListener('mouseup', () => {
    if (!dragState.isDragging) return;

    if (dragState.element) {
        dragState.element.classList.remove('dragging');
    }

    dragState.isDragging = false;
    dragState.itemId = null;
    dragState.element = null;
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
            height: parseInt(catalogEl.dataset.height, 10)
        };

        wallItems.push(newItem);
        selectedItemId = newItem.id;
        renderPlanner();
        updateInspectorPanel();
    });
});

function selectItem(itemId) {
    selectedItemId = itemId;

    document.querySelectorAll('.wall-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === itemId);
    });

    updateInspectorPanel();
}

function updateInspectorPanel() {
    const item = wallItems.find(i => i.id === selectedItemId);
    if (!item) {
        inspectorBox.innerHTML = `<p>Select or drag an item on the wall to view coordinates or remove it.</p>`;
        return;
    }

    const widthCm = Math.round(item.width / SCALE);
    const heightCm = Math.round(item.height / SCALE);
    const leftCm = Math.round(item.left / SCALE);
    const topCm = Math.round(item.top / SCALE);
    const colliding = hasCollision(item);

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <span class="selected-item-title">${item.name}</span>
            <span>Size: <strong>${widthCm} × ${heightCm} cm</strong></span>
            <span>Position: <strong>${leftCm} cm (X), ${topCm} cm (Y)</strong></span>
            <span>Cost: <strong>$${item.price}</strong></span>
            ${colliding ? '<div class="collision-warning">Overlap detected with another item</div>' : ''}
            <button class="btn-danger" id="delete-item-btn">Remove Item</button>
        </div>
    `;

    document.getElementById('delete-item-btn').addEventListener('click', () => {
        wallItems = wallItems.filter(i => i.id !== item.id);
        selectedItemId = null;
        renderPlanner();
        updateInspectorPanel();
    });
}

wallCanvas.addEventListener('click', () => {
    if (selectedItemId !== null) {
        selectItem(null);
    }
});

themeToggleBtn.addEventListener('click', () => {
    isAmbientMode = !isAmbientMode;
    wallCanvas.classList.toggle('daylight-mode', !isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !isAmbientMode);

    themeToggleBtn.textContent = isAmbientMode ? 'Ambient Mode: ON' : 'Daylight Grid: ON';
});

function updateAccentColor(hexColor) {
    document.documentElement.style.setProperty('--accent-led', hexColor);
    accentHexCode.textContent = hexColor.toUpperCase();
    accentColorPicker.value = hexColor;
}

function updateCornerColor(hexColor) {
    document.documentElement.style.setProperty('--corner-led', hexColor);
    cornerHexCode.textContent = hexColor.toUpperCase();
    cornerColorPicker.value = hexColor;
}

accentColorPicker.addEventListener('input', (e) => updateAccentColor(e.target.value));
cornerColorPicker.addEventListener('input', (e) => updateCornerColor(e.target.value));

brightnessSlider.addEventListener('input', (e) => {
    const percent = e.target.value;
    document.documentElement.style.setProperty('--led-opacity', percent / 100);
    brightnessValue.textContent = `${percent}%`;
});

presetButtons.forEach(button => {
    button.addEventListener('click', () => {
        updateAccentColor(button.dataset.accent);
        updateCornerColor(button.dataset.corner);
        if (!isAmbientMode) themeToggleBtn.click();
    });
});

renderPlanner();