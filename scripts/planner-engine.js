const SCALE = 2.5; // 1 cm = 2.5 px

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
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(el.dataset.id);
        });
    });

    const totalPrice = wallItems.reduce((sum, item) => sum + item.price, 0);
    totalPriceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
}

catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        // Offset each new item slightly so multiple spawns don't stack invisibly
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
        selectItem(newItem.id);
        renderPlanner();
    });
});

function resetInspectorText() {
    inspectorBox.innerHTML = `<p>Select an item on the wall to view dimensions or remove it.</p>`;
}

function selectItem(itemId) {
    selectedItemId = itemId;
    renderPlanner();

    const item = wallItems.find(i => i.id === itemId);
    if (!item) {
        resetInspectorText();
        return;
    }

    const widthCm = Math.round(item.width / SCALE);
    const heightCm = Math.round(item.height / SCALE);
    const leftCm = Math.round(item.left / SCALE);
    const topCm = Math.round(item.top / SCALE);

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <span class="selected-item-title">${item.name}</span>
            <span>Size: <strong>${widthCm} × ${heightCm} cm</strong></span>
            <span>Offset: <strong>${leftCm} cm (X), ${topCm} cm (Y)</strong></span>
            <span>Cost: <strong>$${item.price}</strong></span>
            <button class="btn-danger" id="delete-item-btn">Remove Item</button>
        </div>
    `;

    document.getElementById('delete-item-btn').addEventListener('click', () => {
        wallItems = wallItems.filter(i => i.id !== itemId);
        selectedItemId = null;
        resetInspectorText();
        renderPlanner();
    });
}

wallCanvas.addEventListener('click', () => {
    if (selectedItemId !== null) {
        selectedItemId = null;
        renderPlanner();
        resetInspectorText();
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