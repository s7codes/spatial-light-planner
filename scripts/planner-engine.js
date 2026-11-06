/**
 * Spatial & Ambient Light Planner - Core Engine (v0.2)
 * Handles Day/Night mode state and real-time CSS Custom Property manipulation.
 */

// 1. SELECT DOM ELEMENTS
const wallCanvas = document.getElementById('wall');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

const accentColorPicker = document.getElementById('accent-color-picker');
const accentHexCode = document.getElementById('accent-hex-code');

const cornerColorPicker = document.getElementById('corner-color-picker');
const cornerHexCode = document.getElementById('corner-hex-code');

const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');

const presetButtons = document.querySelectorAll('.btn-preset');

// Application State
let isAmbientMode = true;

// 2. TOGGLE AMBIENT (NIGHT) VS. DAYLIGHT (BLUEPRINT) MODE
themeToggleBtn.addEventListener('click', () => {
    isAmbientMode = !isAmbientMode; // Flip boolean state (true <-> false)

    // Toggle the daylight-mode CSS class on the wall container
    wallCanvas.classList.toggle('daylight-mode', !isAmbientMode);
    themeToggleBtn.classList.toggle('daylight-active', !isAmbientMode);

    // Update button label and icon based on current state
    if (isAmbientMode) {
        themeToggleBtn.textContent = '🌙 Ambient Mode: ON';
    } else {
        themeToggleBtn.textContent = '☀️ Daylight Grid: ON';
    }
});

// 3. REAL-TIME RGB COLOR UPDATES
function updateAccentColor(hexColor) {
    // Update global CSS variable (--accent-led) on the root <html> element
    document.documentElement.style.setProperty('--accent-led', hexColor);
    accentHexCode.textContent = hexColor.toUpperCase();
    accentColorPicker.value = hexColor;
}

function updateCornerColor(hexColor) {
    // Update global CSS variable (--corner-led) on the root <html> element
    document.documentElement.style.setProperty('--corner-led', hexColor);
    cornerHexCode.textContent = hexColor.toUpperCase();
    cornerColorPicker.value = hexColor;
}

// Listen for continuous color dragging ('input' event fires immediately as user drags)
accentColorPicker.addEventListener('input', (event) => {
    updateAccentColor(event.target.value);
});

cornerColorPicker.addEventListener('input', (event) => {
    updateCornerColor(event.target.value);
});

// 4. MASTER BRIGHTNESS DIMMER (0% - 100%)
brightnessSlider.addEventListener('input', (event) => {
    const percent = event.target.value;
    const opacityDecimal = percent / 100; // Convert 0-100 range to 0.0-1.0 for CSS opacity

    document.documentElement.style.setProperty('--led-opacity', opacityDecimal);
    brightnessValue.textContent = `${percent}%`;
});

// 5. QUICK AMBIENCE PRESET SCENE BUTTONS
presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
        // Read custom data-accent and data-corner attributes from the clicked HTML button
        const newAccent = button.dataset.accent;
        const newCorner = button.dataset.corner;

        updateAccentColor(newAccent);
        updateCornerColor(newCorner);

        // Automatically switch back to Ambient Mode if user was in Daylight Mode
        if (!isAmbientMode) {
            themeToggleBtn.click();
        }
    });
});