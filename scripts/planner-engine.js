/**
 * Spatial & Ambient Light Planner - Core Engine (v0.3)
 * Handles state management, dynamic item spawning, budget calculation, and lighting controls.
 */

// 1. SELECT DOM ELEMENTS
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

// 2. APPLICATION STATE
let isAmbientMode = true;
let selectedItemId = null; // ID of currently selected wall item

// Initial wall items array (Starting with our default prototype items)
let wallItems = [
    { id: 'item-1', type: 'shelf', name: 'Floating Shelf (110 cm)', price: 45, left: 120, top: 380, width: 275, height: 20 },
    { id: 'item-2', type: 'poster', name: 'Poster Frame (50×70 cm)', price: 25, left: 195, top: 140, width: 125, height: 175 }
];

// 3. RENDER WALL ITEMS & CALCULATE TOTAL BUDGET
function renderPlanner() {
    // Keep the corner LED glow element inside the wall
    const cornerGlowHTML = `<div class="corner-led-glow"></div>`;
    
    // Generate HTML for all items currently in the state array
    let itemsHTML = wallItems.map(item => {
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

    // Attach click listeners to freshly rendered wall items
    document.querySelectorAll('.wall-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent wall click event
            selectItem(el.dataset.id);
        });
    });

    // Calculate total budget
    const totalPrice = wallItems.reduce((sum, item) => sum + item.price, 0);
    totalPriceDisplay.textContent = `$${totalPrice.toFixed(2)}`;
}

// 4. SPAWN NEW ITEM FROM CATALOG
catalogItems.forEach(catalogEl => {
    catalogEl.addEventListener('click', () => {
        const type = catalogEl.dataset.type;
        const name = catalogEl.dataset.name;
        const price = parseFloat(catalogEl.dataset.price);
        const width = parseInt(catalogEl.dataset.width);
        const height = parseInt(catalogEl.dataset.height);

        // Generate a unique ID using timestamp
        const newItem = {
            id: 'item-' + Date.now(),
            type: type,
            name: name,
            price: price,
            left: 220 + (wallItems.length * 15) % 150, // Stagger default spawn position
            top: 250 + (wallItems.length * 15) % 100,
            width: width,
            height: height
        };

        wallItems.push(newItem);
        selectItem(newItem.id); // Auto-select the newly added item
        renderPlanner();
    });
});

// 5. SELECT ITEM & UPDATE INSPECTOR PANEL
function selectItem(itemId) {
    selectedItemId = itemId;
    renderPlanner(); // Re-render to update visual selection outline

    const item = wallItems.find(i => i.id === itemId);
    if (!item) {
        inspectorBox.innerHTML = `<p>Click any mounted item on the wall to inspect properties or remove it.</p>`;
        return;
    }

    inspectorBox.innerHTML = `
        <div class="selected-item-info">
            <span class="selected-item-title">📌 ${item.name}</span>
            <span>Price: <strong>$${item.price}</strong></span>
            <span>Position: X: ${item.left}px, Y: ${item.top}px</span>
            <button class="btn-danger" id="delete-item-btn">Remove from Wall</button>
        </div>
    `;

    // Attach delete handler
    document.getElementById('delete-item-btn').addEventListener('click', () => {
        wallItems = wallItems.filter(i => i.id !== itemId);
        selectedItemId = null;
        inspectorBox.innerHTML = `<p>Click any mounted item on the wall to inspect properties or remove it.</p>`;
        renderPlanner();
    });
}

// Deselect when clicking empty wall space
wallCanvas.addEventListener('click', () => {
    selectedItemId = null;
    renderPlanner();
    inspectorBox.innerHTML = `<p>Click any mounted item on the wall to inspect properties or remove it.</p>`;
});

// 6. TOGGLE AMBIENT VS. DAYLIGHT MODE
themeToggleBtn.addEventListener('click', () => {
    isAmbientMode = !isAmbientMode;
    wallCanvas.classList.toggle('daylight-mode', !isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !isAmbientMode);

    themeToggleBtn.textContent = isAmbientMode ? '🌙 Ambient Mode: ON' : '☀️ Daylight Grid: ON';
});

// 7. REAL-TIME RGB COLOR & BRIGHTNESS CONTROLS
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

// Initial Render on Page Load
renderPlanner();